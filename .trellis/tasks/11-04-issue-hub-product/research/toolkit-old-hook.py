"""在 Codex 推送前按插件归属核对版本，必要时准备独立版本提交。"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple


class Plugin(NamedTuple):
    name: str
    manifest: Path
    portable: Path
    build: Path
    outputs: tuple[Path, ...]
    sources: tuple[str, ...]
    build_inputs: tuple[str, ...]
    marker: str | None = None


PLUGINS = (
    Plugin(
        "yg-toolkit", Path("plugins/yg-toolkit/.codex-plugin/plugin.json"),
        Path("plugins/yg-toolkit/plugin.json"), Path("packages/token-usage/scripts/build.mjs"),
        tuple(Path(f"plugins/yg-toolkit/dist/{name}") for name in ("token-usage.cjs", "token-usage.html", "THIRD-PARTY-LICENSES.txt")),
        ("plugins/yg-toolkit/", "packages/token-usage/"),
        ("packages/token-usage/src", "packages/token-usage/ui", "packages/token-usage/scripts", "packages/token-usage/package.json", "packages/token-usage/package-lock.json", "plugins/yg-toolkit/assets"),
    ),
    Plugin(
        "issue-hub", Path("plugins/issue-hub/.codex-plugin/plugin.json"),
        Path("plugins/issue-hub/plugin.json"), Path("packages/issue-hub/scripts/build.mjs"),
        tuple(Path(f"plugins/issue-hub/dist/{name}") for name in ("issue-hub.cjs", "app.html", "THIRD-PARTY-LICENSES.txt")),
        ("plugins/issue-hub/", "packages/issue-hub/"),
        ("packages/issue-hub/src", "packages/issue-hub/ui", "packages/issue-hub/scripts", "packages/issue-hub/package.json", "packages/issue-hub/package-lock.json", "plugins/issue-hub/assets"),
        "Issue Hub 版本: ",
    ),
)
# 保留旧常量与单插件辅助入口，便于已有验证脚本调用；主流程始终走注册表。
PLUGIN_MANIFEST, PORTABLE_MANIFEST, BUILD_SCRIPT, BUILD_OUTPUTS = PLUGINS[0].manifest, PLUGINS[0].portable, PLUGINS[0].build, PLUGINS[0].outputs
MARKETPLACE = Path(".agents/plugins/marketplace.json")
PUSH_COMMAND = re.compile(r"(?:^|[;&|]\s*)git(?:\.exe)?\s+(?:-\w+\s+)*push(?:\s|$)", re.IGNORECASE)
VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$")


class HookError(Exception):
    """可向 Codex 展示的推送拦截原因。"""


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True, text=True, encoding="utf-8")
    return result.stdout.strip()


def deny(message: str) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": message}}, ensure_ascii=False))


def parse_version(value: str) -> tuple[int, int, int, int]:
    match = VERSION.fullmatch(value)
    if match is None:
        raise HookError(f"插件版本「{value}」不符合 x.y.z 版本格式，已停止推送。")
    major, minor, patch, prerelease = match.groups()
    return int(major), int(minor), int(patch), 0 if prerelease else 1


def tracked(root: Path, revision: str, path: Path) -> bool:
    return bool(git(root, "ls-tree", "--name-only", revision, "--", path.as_posix()))


def read_version(root: Path, revision: str | None = None, path: Path = PLUGIN_MANIFEST) -> str:
    contents = (root / path).read_text(encoding="utf-8") if revision is None else git(root, "show", f"{revision}:{path.as_posix()}")
    manifest = json.loads(contents)
    if not isinstance(manifest, dict):
        raise HookError(f"{path.as_posix()} 插件清单必须是对象。")
    version = manifest.get("version")
    if not isinstance(version, str):
        raise HookError(f"{path.as_posix()} 缺少字符串类型的 version，已停止推送。")
    parse_version(version)
    return version


def checked_version(root: Path, revision: str | None = None, plugin: Plugin = PLUGINS[0]) -> str:
    version = read_version(root, revision, plugin.manifest)
    portable_exists = (root / plugin.portable).exists() if revision is None else tracked(root, revision, plugin.portable)
    if plugin.name == 'issue-hub' and not portable_exists:
        raise HookError("Issue Hub 缺少双清单，请先补齐并同步版本。")
    if portable_exists and read_version(root, revision, plugin.portable) != version:
        raise HookError(f"{revision or '工作区'} 的 {plugin.name} 两份插件清单版本不一致，请先同步版本，再重试推送。")
    return version


def marketplace_entries(root: Path, revision: str) -> dict:
    if not tracked(root, revision, MARKETPLACE):
        return {}
    value = json.loads(git(root, "show", f"{revision}:{MARKETPLACE.as_posix()}"))
    if not isinstance(value, dict):
        raise HookError("插件市场清单必须是对象。")
    entries = value.get("plugins")
    if not isinstance(entries, list) or any(not isinstance(item, dict) or not isinstance(item.get("name"), str) for item in entries):
        raise HookError("插件市场列表格式无效，无法确定变更归属。")
    result = {item["name"]: item for item in entries}
    if len(result) != len(entries):
        raise HookError("插件市场列表存在重复标识，无法确定变更归属。")
    return result


def affected_plugins(root: Path, upstream: str) -> list[Plugin]:
    # 只检查将要推送的已提交内容，不把其他会话的工作区修改打入构建。
    paths = [path for path in git(root, "diff", "--name-only", "-z", "--no-renames", upstream, "HEAD", "--").split('\0') if path]
    changed_entries = set()
    if MARKETPLACE.as_posix() in paths:
        before, after = marketplace_entries(root, upstream), marketplace_entries(root, "HEAD")
        changed_entries = {name for name in before.keys() | after.keys() if before.get(name) != after.get(name)}
    return [plugin for plugin in PLUGINS if plugin.name in changed_entries or any(any(path.startswith(prefix) for prefix in plugin.sources) for path in paths)]


def targets_for(root: Path, plugin: Plugin) -> tuple[list[Path], bool]:
    manifests = [plugin.manifest]
    if (root / plugin.portable).exists() or tracked(root, "HEAD", plugin.portable):
        manifests.append(plugin.portable)
    build_required = tracked(root, "HEAD", plugin.build)
    return [*manifests, *(plugin.outputs if build_required else ())], build_required


def preflight(root: Path, plugin: Plugin) -> tuple[list[Path], bool]:
    targets, build_required = targets_for(root, plugin)
    paths = [path.as_posix() for path in targets]
    if git(root, "status", "--porcelain", "--untracked-files=all", "--ignored=matching", "--", *paths):
        raise HookError(f"{plugin.name} 插件清单或构建产物已有未提交修改，请先整理后重试推送。")
    for target in targets:
        if any(path.is_symlink() for path in (root / target, *(root / target).parents) if path != root):
            raise HookError("插件版本目标包含符号链接，已停止推送。")
    if build_required and git(root, "status", "--porcelain", "--untracked-files=all", "--", *plugin.build_inputs):
        raise HookError(f"{plugin.name} 构建输入已有未提交修改，不能将工作区内容打入版本提交。")
    return targets, build_required


def validate_artifacts(root: Path, plugin: Plugin, version: str, revision: str = "HEAD") -> None:
    if not tracked(root, revision, plugin.build):
        if plugin.name == "issue-hub":
            raise HookError("Issue Hub 首次发布缺少已提交的构建入口。")
        return
    for path in plugin.outputs:
        if not tracked(root, revision, path):
            raise HookError(f"{plugin.name} 缺少已提交的分发产物 {path.as_posix()}。")
    if plugin.marker:
        # 构建器写入专用头部版本标记；不依赖打包器压缩后的变量名。
        for path in plugin.outputs[:2]:
            first = git(root, "show", f"{revision}:{path.as_posix()}").splitlines()[0]
            if first.strip() != version_header(plugin, path, version):
                raise HookError(f"{plugin.name} 已提交构建版本与清单不一致，请重新构建并提交产物。")


def version_header(plugin: Plugin, path: Path, version: str) -> str:
    return f"// {plugin.marker}{version}" if path.suffix == '.cjs' else f"<!-- {plugin.marker}{version} -->"


def bump_versions(root: Path, plans: list[tuple[Plugin, str]]) -> dict[str, str]:
    # 多插件先全部预检，再改任何文件；全部构建成功后只创建一个独立版本提交。
    prepared = [(plugin, version, *preflight(root, plugin)) for plugin, version in plans]
    all_targets = list(dict.fromkeys(path for _, _, targets, _ in prepared for path in targets))
    paths = [path.as_posix() for path in all_targets]
    snapshots = {path: (root / path).read_bytes() if (root / path).exists() else None for path in all_targets}
    versions = {}
    try:
        for plugin, head_version, targets, build_required in prepared:
            major, minor, patch, _ = parse_version(head_version)
            next_version = f"{major}.{minor}.{patch + 1}"
            versions[plugin.name] = next_version
            for path in targets:
                if path not in (plugin.manifest, plugin.portable):
                    continue
                manifest = json.loads((root / path).read_text(encoding="utf-8"))
                manifest["version"] = next_version
                (root / path).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            if build_required:
                subprocess.run(["node", str(root / plugin.build)], cwd=root, check=True, capture_output=True, text=True, encoding="utf-8")
                if any(not (root / path).is_file() for path in plugin.outputs):
                    raise HookError(f"{plugin.name} 构建未生成全部分发文件。")
                if plugin.marker:
                    for path in plugin.outputs[:2]:
                        if (root / path).read_text(encoding="utf-8").splitlines()[0].strip() != version_header(plugin, path, next_version):
                            raise HookError(f"{plugin.name} 构建版本与清单不一致。")
        git(root, "add", "--", *paths)
        scope = plans[0][0].name if len(plans) == 1 else "plugins"
        summary = "、".join(f"{name} {version}" for name, version in versions.items())
        git(root, "commit", "--only", "-m", f"chore({scope}): 升级插件版本至 {summary}", "--", *paths)
    except (OSError, ValueError, IndexError, HookError, subprocess.CalledProcessError) as error:
        try:
            git(root, "reset", "--quiet", "HEAD", "--", *paths)
        except (OSError, subprocess.CalledProcessError) as reset_error:
            raise HookError("自动升级失败，暂存区恢复受阻，请检查 Git 锁和版本目标后重试推送。") from reset_error
        finally:
            for path, content in snapshots.items():
                if content is None:
                    (root / path).unlink(missing_ok=True)
                else:
                    (root / path).write_bytes(content)
        raise HookError("自动升级插件版本的构建或提交失败，已恢复版本目标并停止推送。") from error
    return versions


def bump_version(root: Path, head_version: str) -> str:
    return bump_versions(root, [(PLUGINS[0], head_version)])[PLUGINS[0].name]


def main(event: dict | None = None) -> None:
    if event is None:
        event = json.load(sys.stdin)
    command = event.get("tool_input", {}).get("command", "")
    if not isinstance(command, str) or PUSH_COMMAND.search(command) is None or re.search(r"(?:^|\s)--dry-run(?:\s|$)", command):
        return
    cwd = event.get("cwd")
    if not isinstance(cwd, str):
        raise HookError("Codex 未提供推送目录，无法核对插件版本，已停止推送。")
    root = Path(git(Path(cwd).resolve(), "rev-parse", "--show-toplevel")).resolve()
    if not git(root, "branch", "--show-current"):
        raise HookError("当前处于 detached HEAD，无法确定要比较的远端分支，已停止推送。")
    try:
        upstream = git(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    except subprocess.CalledProcessError as error:
        raise HookError("当前分支没有上游，请先明确远端跟踪分支后重试推送。") from error
    plans = []
    for plugin in affected_plugins(root, upstream):
        if not tracked(root, "HEAD", plugin.manifest) or not (root / plugin.manifest).is_file():
            raise HookError(f"仓库缺少 {plugin.manifest.as_posix()}，无法核对插件版本。")
        head_version = checked_version(root, "HEAD", plugin)
        checked_version(root, plugin=plugin)
        # 不论先后顺序，一者脏目标均在其他插件改写之前拦截。
        preflight(root, plugin)
        if not tracked(root, upstream, plugin.manifest):
            validate_artifacts(root, plugin, head_version)
            continue
        remote_version = checked_version(root, upstream, plugin)
        if parse_version(head_version) < parse_version(remote_version):
            raise HookError(f"{plugin.name} 当前版本低于远端，请先整理版本再推送。")
        if parse_version(head_version) > parse_version(remote_version):
            validate_artifacts(root, plugin, head_version)
            continue
        plans.append((plugin, head_version))
    if not plans:
        return
    versions = bump_versions(root, plans)
    summary = "、".join(f"{name} {version}" for name, version in versions.items())
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "systemMessage": f"已自动升级插件版本：{summary}，并创建独立提交。"}}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (HookError, OSError, ValueError, KeyError, IndexError, subprocess.CalledProcessError) as error:
        deny(str(error))
