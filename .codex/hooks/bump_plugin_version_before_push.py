"""在 Codex 执行 git push 前递增并提交 YG Toolkit 插件补丁版本。"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PLUGIN_MANIFEST = Path("plugins/yg-toolkit/.codex-plugin/plugin.json")
PORTABLE_MANIFEST = Path("plugins/yg-toolkit/plugin.json")
BUILD_SCRIPT = Path("packages/token-usage/scripts/build.mjs")
BUILD_OUTPUTS = (
    Path("plugins/yg-toolkit/dist/token-usage.cjs"),
    Path("plugins/yg-toolkit/dist/token-usage.html"),
    Path("plugins/yg-toolkit/dist/THIRD-PARTY-LICENSES.txt"),
)
PUSH_COMMAND = re.compile(r"(?:^|[;&|]\s*)git(?:\.exe)?\s+(?:-\w+\s+)*push(?:\s|$)", re.IGNORECASE)
VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$")


class HookError(Exception):
    """可向 Codex 展示的推送拦截原因。"""


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def deny(message: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": message,
                }
            },
            ensure_ascii=False,
        )
    )


def parse_version(value: str) -> tuple[int, int, int, int]:
    match = VERSION.fullmatch(value)
    if match is None:
        raise HookError(f"插件版本「{value}」不符合 x.y.z 版本格式，已停止推送。")
    major, minor, patch, prerelease = match.groups()
    # 正式版本高于相同数字的预发布版本。
    stage = 0 if prerelease else 1
    return int(major), int(minor), int(patch), stage


def read_version(root: Path, revision: str | None = None, path: Path = PLUGIN_MANIFEST) -> str:
    if revision is None:
        manifest = json.loads((root / path).read_text(encoding="utf-8"))
    else:
        contents = git(root, "show", f"{revision}:{path.as_posix()}")
        manifest = json.loads(contents)
    version = manifest.get("version")
    if not isinstance(version, str):
        raise HookError(f"{path.as_posix()} 缺少字符串类型的 version，已停止推送。")
    parse_version(version)
    return version


def checked_version(root: Path, revision: str | None = None) -> str:
    version = read_version(root, revision)
    portable_exists = (
        (root / PORTABLE_MANIFEST).exists()
        if revision is None
        else bool(git(root, "ls-tree", "--name-only", revision, "--", PORTABLE_MANIFEST.as_posix()))
    )
    if portable_exists and read_version(root, revision, PORTABLE_MANIFEST) != version:
        location = revision or "工作区"
        raise HookError(f"{location} 的两份插件清单版本不一致，请先同步版本，再重试推送。")
    return version


def bump_version(root: Path, head_version: str) -> str:
    manifests = [PLUGIN_MANIFEST]
    if (root / PORTABLE_MANIFEST).exists() or git(
        root, "ls-tree", "--name-only", "HEAD", "--", PORTABLE_MANIFEST.as_posix()
    ):
        manifests.append(PORTABLE_MANIFEST)
    build_required = (root / BUILD_SCRIPT).is_file()
    targets = [*manifests, *(BUILD_OUTPUTS if build_required else ())]
    paths = [path.as_posix() for path in targets]
    # 所有目标须预先干净，才可保存快照并进入修改；不接管调用者的暂存内容。
    if git(root, "status", "--porcelain", "--untracked-files=all", "--ignored=matching", "--", *paths):
        raise HookError("插件清单或用量构建产物已有未提交修改。请先整理这些文件，再重试推送。")
    for target in targets:
        if any(path.is_symlink() for path in (root / target, *(root / target).parents) if path != root):
            raise HookError("插件版本目标包含符号链接，已停止推送。")
    snapshots = {
        target: ((root / target).read_bytes() if (root / target).exists() else None)
        for target in targets
    }
    major, minor, patch, _ = parse_version(head_version)
    next_version = f"{major}.{minor}.{patch + 1}"
    try:
        for path in manifests:
            manifest = json.loads((root / path).read_text(encoding="utf-8"))
            manifest["version"] = next_version
            (root / path).write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
        if build_required:
            # 只调用本机 Node；构建失败不安装依赖，也不回显可能含私有信息的子进程输出。
            subprocess.run(
                ["node", str(root / BUILD_SCRIPT)], cwd=root, check=True,
                capture_output=True, text=True, encoding="utf-8",
            )
            if any(not (root / path).is_file() for path in BUILD_OUTPUTS):
                raise HookError("用量构建未生成全部分发文件。")
        git(root, "add", "--", *paths)
        git(
            root, "commit", "--only", "-m",
            f"chore(yg-toolkit): 升级插件版本至 {next_version}", "--", *paths,
        )
    except (OSError, ValueError, HookError, subprocess.CalledProcessError) as error:
        # 预检确保这些路径原本与 HEAD 一致，恢复时不触及其他文件的工作区或暂存区。
        try:
            git(root, "reset", "--quiet", "HEAD", "--", *paths)
        except (OSError, subprocess.CalledProcessError) as reset_error:
            raise HookError("自动升级失败，暂存区恢复受阻，请检查 Git 锁和版本目标后重试推送。") from reset_error
        finally:
            # 即使索引被其他 Git 操作锁住，也恢复本钩子改写的工作区内容。
            for path, content in snapshots.items():
                if content is None:
                    (root / path).unlink(missing_ok=True)
                else:
                    (root / path).write_bytes(content)
        raise HookError(f"自动升级插件版本 {next_version} 的构建或提交失败，已恢复版本目标并停止推送。") from error
    return next_version


def main(event: dict | None = None) -> None:
    if event is None:
        event = json.load(sys.stdin)
    command = event.get("tool_input", {}).get("command", "")
    if not isinstance(command, str) or PUSH_COMMAND.search(command) is None:
        return
    if re.search(r"(?:^|\s)--dry-run(?:\s|$)", command):
        return

    cwd = event.get("cwd")
    if not isinstance(cwd, str):
        raise HookError("Codex 未提供推送目录，无法核对插件版本，已停止推送。")
    working_directory = Path(cwd).resolve()
    root = Path(git(working_directory, "rev-parse", "--show-toplevel")).resolve()
    manifest_path = root / PLUGIN_MANIFEST
    if not manifest_path.is_file():
        raise HookError(f"仓库缺少 {PLUGIN_MANIFEST.as_posix()}，无法核对插件版本。")

    branch = git(root, "branch", "--show-current")
    if not branch:
        raise HookError("当前处于 detached HEAD，无法确定要比较的远端分支，已停止推送。")
    upstream = git(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    remote_version = checked_version(root, upstream)
    head_version = checked_version(root, "HEAD")
    checked_version(root)
    if parse_version(head_version) > parse_version(remote_version):
        return

    next_version = bump_version(root, head_version)
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "systemMessage": (
                        f"已自动将 YG Toolkit 插件版本从 {remote_version} "
                        f"升级至 {next_version}，并创建独立提交。"
                    ),
                }
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (HookError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        deny(str(error))
