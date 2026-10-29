"""在 Codex 执行 git push 前递增并提交 YG Toolkit 插件补丁版本。"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PLUGIN_MANIFEST = Path("plugins/yg-toolkit/.codex-plugin/plugin.json")
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


def read_version(root: Path, revision: str | None = None) -> str:
    if revision is None:
        manifest = json.loads((root / PLUGIN_MANIFEST).read_text(encoding="utf-8"))
    else:
        contents = git(root, "show", f"{revision}:{PLUGIN_MANIFEST.as_posix()}")
        manifest = json.loads(contents)
    version = manifest.get("version")
    if not isinstance(version, str):
        raise HookError(f"{PLUGIN_MANIFEST.as_posix()} 缺少字符串类型的 version，已停止推送。")
    parse_version(version)
    return version


def main() -> None:
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
    remote_version = read_version(root, upstream)
    head_version = read_version(root, "HEAD")
    if parse_version(head_version) > parse_version(remote_version):
        return

    # 只创建插件清单的独立提交，保留调用者已暂存的其他文件。
    modified = git(root, "status", "--porcelain", "--", PLUGIN_MANIFEST)
    if modified:
        raise HookError(
            f"{PLUGIN_MANIFEST.as_posix()} 已有未提交修改。请先整理该文件，再重试推送。"
        )

    major, minor, patch, _ = parse_version(head_version)
    next_version = f"{major}.{minor}.{patch + 1}"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["version"] = next_version
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    git(root, "add", "--", PLUGIN_MANIFEST.as_posix())
    try:
        git(
            root,
            "commit",
            "--only",
            "-m",
            f"chore(yg-toolkit): 升级插件版本至 {next_version}",
            "--",
            PLUGIN_MANIFEST.as_posix(),
        )
    except subprocess.CalledProcessError as error:
        manifest_path.unlink(missing_ok=True)
        git(root, "checkout", "--", PLUGIN_MANIFEST.as_posix())
        raise HookError(
            f"自动提交插件版本 {next_version} 失败，已停止推送。"
        ) from error
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


try:
    main()
except (HookError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
    deny(str(error))
