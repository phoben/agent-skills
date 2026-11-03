"""在临时仓库验证推送钩子的版本、构建及暂存边界。"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "version_hook", Path(__file__).with_name("bump_plugin_version_before_push.py")
)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class VersionHookTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="yg-version-hook-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "repo"
        self.root.mkdir()
        self.run_git("init", "--initial-branch=main")
        self.run_git("config", "user.name", "钩子测试")
        self.run_git("config", "user.email", "hook@example.invalid")
        self.run_git("config", "core.autocrlf", "false")
        # 每次测试使用本地 bare 远端，绝不连接真实仓库或互联网。
        subprocess.run(
            ["git", "init", "--bare", str(self.base / "remote.git")],
            check=True, capture_output=True,
        )
        self.run_git("remote", "add", "origin", str(self.base / "remote.git"))

    def run_git(self, *args):
        return hook.git(self.root, *args)

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", newline="\n")

    def initialize(self, *, portable=True, build=True):
        self.write(hook.PLUGIN_MANIFEST, json.dumps({"version": "0.2.0"}) + "\n")
        if portable:
            self.write(hook.PORTABLE_MANIFEST, json.dumps({"version": "0.2.0"}) + "\n")
        self.write(Path("other.txt"), "原始内容\n")
        if build:
            # 本机 Node 执行真实构建入口；输出中的版本模拟 MCP serverInfo。
            self.write(hook.BUILD_SCRIPT, """
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const legacy = JSON.parse(readFileSync('plugins/yg-toolkit/.codex-plugin/plugin.json', 'utf8'));
const portable = JSON.parse(readFileSync('plugins/yg-toolkit/plugin.json', 'utf8'));
if (legacy.version !== portable.version) throw new Error('两份清单版本不同');
mkdirSync('plugins/yg-toolkit/dist', { recursive: true });
for (const name of ['token-usage.cjs', 'token-usage.html', 'THIRD-PARTY-LICENSES.txt']) {
  writeFileSync(`plugins/yg-toolkit/dist/${name}`, JSON.stringify({ serverInfo: { version: legacy.version } }));
}
""")
            for path in hook.BUILD_OUTPUTS:
                self.write(path, json.dumps({"serverInfo": {"version": "0.2.0"}}))
        self.run_git("add", ".")
        self.run_git("commit", "-m", "chore: 初始化临时仓库")
        self.run_git("push", "--set-upstream", "origin", "main")
        self.original_head = self.run_git("rev-parse", "HEAD")

    def invoke(self, command="git push"):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            hook.main({"cwd": str(self.root), "tool_input": {"command": command}})
        return output.getvalue()

    @unittest.skipUnless(shutil.which("node"), "构建版本测试需要本机 Node")
    def test_syncs_manifests_build_version_and_preserves_other_staged_files(self):
        self.initialize()
        self.write(Path("other.txt"), "已经暂存\n")
        self.run_git("add", "other.txt")
        self.write(Path("other.txt"), "尚未暂存\n")
        self.write(Path("plugins/yg-toolkit/dist/unrelated.txt"), "旁路文件\n")
        output = self.invoke()
        self.assertIn("0.2.1", output)
        for path in (hook.PLUGIN_MANIFEST, hook.PORTABLE_MANIFEST):
            self.assertEqual(hook.read_version(self.root, "HEAD", path), "0.2.1")
        for path in hook.BUILD_OUTPUTS:
            built = json.loads((self.root / path).read_text(encoding="utf-8"))
            self.assertEqual(built["serverInfo"]["version"], "0.2.1")
        owned_paths = {hook.PLUGIN_MANIFEST.as_posix(), hook.PORTABLE_MANIFEST.as_posix()}
        owned_paths.update(path.as_posix() for path in hook.BUILD_OUTPUTS)
        self.assertEqual(set(self.run_git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").splitlines()), owned_paths)
        self.assertEqual(self.run_git("show", ":other.txt"), "已经暂存")
        self.assertEqual((self.root / "other.txt").read_text(encoding="utf-8"), "尚未暂存\n")
        self.assertEqual(self.run_git("show", "HEAD:other.txt"), "原始内容")
        self.assertEqual(self.run_git("diff", "--cached", "--name-only"), "other.txt")
        self.assertEqual((self.root / "plugins/yg-toolkit/dist/unrelated.txt").read_text(encoding="utf-8"), "旁路文件\n")
        # 未推送的独立版本提交可直接重试，不再次构建或递增。
        with patch.object(hook, "bump_version", side_effect=AssertionError("不得再次升级")):
            self.assertEqual(self.invoke(), "")

    def test_legacy_manifest_without_portable_or_build_stays_supported(self):
        self.initialize(portable=False, build=False)
        self.invoke()
        self.assertEqual(hook.read_version(self.root, "HEAD"), "0.2.1")
        self.assertFalse((self.root / hook.PORTABLE_MANIFEST).exists())
        self.assertEqual(self.run_git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), hook.PLUGIN_MANIFEST.as_posix())

    def test_rejects_mismatched_manifest_versions_without_modification(self):
        self.initialize(build=False)
        self.write(hook.PORTABLE_MANIFEST, '{"version":"0.2.1"}\n')
        before = (self.root / hook.PLUGIN_MANIFEST).read_bytes()
        with self.assertRaisesRegex(hook.HookError, "版本不一致"):
            self.invoke()
        self.assertEqual((self.root / hook.PLUGIN_MANIFEST).read_bytes(), before)
        self.assertEqual(self.run_git("rev-parse", "HEAD"), self.original_head)

    def test_rejects_dirty_targets_in_worktree_or_index(self):
        self.initialize()
        for path in (hook.PLUGIN_MANIFEST, hook.PORTABLE_MANIFEST, *hook.BUILD_OUTPUTS):
            for staged in (False, True):
                with self.subTest(path=path, staged=staged):
                    original = (self.root / path).read_bytes()
                    (self.root / path).write_bytes(original + b"\n")
                    if staged:
                        self.run_git("add", "--", path.as_posix())
                    before_status = self.run_git("status", "--porcelain")
                    with self.assertRaisesRegex(hook.HookError, "已有未提交修改"):
                        self.invoke()
                    self.assertEqual((self.root / path).read_bytes(), original + b"\n")
                    self.assertEqual(self.run_git("status", "--porcelain"), before_status)
                    self.assertEqual(self.run_git("rev-parse", "HEAD"), self.original_head)
                    self.run_git("restore", "--staged", "--worktree", "--", path.as_posix())

    def test_rejects_deleted_portable_manifest(self):
        self.initialize(build=False)
        (self.root / hook.PORTABLE_MANIFEST).unlink()
        with self.assertRaisesRegex(hook.HookError, "已有未提交修改"):
            self.invoke()
        self.assertFalse((self.root / hook.PORTABLE_MANIFEST).exists())

    def test_portable_manifest_added_after_legacy_remote_is_supported(self):
        self.initialize(portable=False, build=False)
        self.write(hook.PORTABLE_MANIFEST, '{"version":"0.2.0"}\n')
        self.run_git("add", "--", hook.PORTABLE_MANIFEST.as_posix())
        self.run_git("commit", "-m", "feat: 增加便携插件清单")
        self.invoke()
        self.assertEqual(hook.read_version(self.root, "HEAD"), "0.2.1")
        self.assertEqual(hook.read_version(self.root, "HEAD", hook.PORTABLE_MANIFEST), "0.2.1")

    def test_rejects_untracked_and_ignored_build_targets(self):
        self.initialize()
        path = hook.BUILD_OUTPUTS[0]
        self.run_git("rm", "--", path.as_posix())
        self.run_git("commit", "-m", "chore: 移除临时产物")
        self.write(path, "需要保留的未跟踪文件")
        for ignored in (False, True):
            with self.subTest(ignored=ignored):
                if ignored:
                    self.write(Path(".gitignore"), path.as_posix() + "\n")
                with self.assertRaisesRegex(hook.HookError, "已有未提交修改"):
                    self.invoke()
                self.assertEqual((self.root / path).read_text(encoding="utf-8"), "需要保留的未跟踪文件")

    @unittest.skipUnless(shutil.which("node"), "构建失败测试需要本机 Node")
    def test_build_failure_removes_only_newly_created_owned_outputs(self):
        self.initialize()
        self.run_git("rm", "--", *(path.as_posix() for path in hook.BUILD_OUTPUTS))
        self.run_git("commit", "-m", "chore: 移除临时构建产物")
        self.write(hook.BUILD_SCRIPT, "import { writeFileSync } from 'node:fs';\nwriteFileSync('plugins/yg-toolkit/dist/token-usage.cjs', '构建中断');\nprocess.exit(1);\n")
        with self.assertRaisesRegex(hook.HookError, "已恢复版本目标"):
            self.invoke()
        for path in hook.BUILD_OUTPUTS:
            self.assertFalse((self.root / path).exists())
        self.assertEqual(hook.read_version(self.root), "0.2.0")

    @unittest.skipUnless(shutil.which("node"), "构建失败测试需要本机 Node")
    def test_build_failure_restores_owned_targets_only(self):
        self.initialize()
        self.write(hook.BUILD_SCRIPT, "import { writeFileSync } from 'node:fs';\nwriteFileSync('plugins/yg-toolkit/dist/token-usage.cjs', '构建中断');\nprocess.exit(1);\n")
        self.write(Path("other.txt"), "需要保留\n")
        self.run_git("add", "other.txt")
        before_status = self.run_git("status", "--porcelain")
        with self.assertRaisesRegex(hook.HookError, "已恢复版本目标"):
            self.invoke()
        self.assertEqual(self.run_git("status", "--porcelain"), before_status)
        self.assertEqual(self.run_git("diff", "HEAD", "--", *(path.as_posix() for path in (hook.PLUGIN_MANIFEST, hook.PORTABLE_MANIFEST, *hook.BUILD_OUTPUTS))), "")
        self.assertEqual(self.run_git("show", ":other.txt"), "需要保留")
        self.assertEqual(self.run_git("rev-parse", "HEAD"), self.original_head)

    @unittest.skipUnless(shutil.which("node"), "提交失败测试需要本机 Node")
    def test_commit_failure_restores_targets_and_preserves_index(self):
        self.initialize()
        self.write(Path("other.txt"), "需要保留\n")
        self.run_git("add", "other.txt")
        real_git = hook.git

        def failing_commit(root, *args):
            if args[0] == "commit":
                raise subprocess.CalledProcessError(1, ["git", "commit"])
            return real_git(root, *args)

        with patch.object(hook, "git", side_effect=failing_commit):
            with self.assertRaisesRegex(hook.HookError, "已恢复版本目标"):
                self.invoke()
        self.assertEqual(self.run_git("status", "--porcelain"), "M  other.txt")
        self.assertEqual(self.run_git("show", ":other.txt"), "需要保留")
        self.assertEqual(self.run_git("rev-parse", "HEAD"), self.original_head)

    def test_dry_run_and_non_push_have_no_side_effects(self):
        self.initialize(build=False)
        self.assertEqual(self.invoke("git push --dry-run"), "")
        self.assertEqual(self.invoke("git status"), "")
        self.assertEqual(self.run_git("rev-parse", "HEAD"), self.original_head)
        self.assertEqual(self.run_git("status", "--porcelain"), "")


if __name__ == "__main__":
    unittest.main()
