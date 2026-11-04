"""用临时Git仓库验证统一YG的双服务构建、版本和暂存边界。"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


source = Path(os.environ.get('YG_HOOK_TEST_SOURCE', Path(__file__).with_name('bump_plugin_version_before_push.py')))
spec = importlib.util.spec_from_file_location('version_hook', source)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class VersionHookTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='yg-unified-hook-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'repo'
        self.root.mkdir()
        self.git('init', '--initial-branch=main')
        self.git('config', 'user.name', '版本测试')
        self.git('config', 'user.email', 'hook@example.invalid')
        self.git('config', 'core.autocrlf', 'false')
        remote = Path(self.temporary.name) / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(remote)], check=True, capture_output=True)
        self.git('remote', 'add', 'origin', str(remote))

    def git(self, *args):
        return hook.git(self.root, *args)

    def write(self, path, text):
        path = self.root / path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8', newline='\n')

    def commit(self, message='test: 准备场景'):
        self.git('add', '.')
        self.git('commit', '-m', message)

    def initialize(self, *, build=True, portable=True, change=True, remote_without_plugin=False):
        if remote_without_plugin:
            self.write('other.txt', '原始内容\n')
            self.commit('chore: 准备尚无插件的远端')
            self.git('push', '--set-upstream', 'origin', 'main')
        self.write(hook.PLUGIN_MANIFEST, '{"version":"0.2.0"}\n')
        if portable:
            self.write(hook.PORTABLE_MANIFEST, '{"version":"0.2.0"}\n')
        self.write('other.txt', '原始内容\n')
        self.write('packages/issue-hub/src/main.mjs', '// 已提交的Issue模块\n')
        if build:
            self.write(hook.BUILD_SCRIPT, '''
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('plugins/yg-toolkit/plugin.json','utf8'));
const version=process.env.YG_TOKEN_BUILD_VERSION||manifest.version;
mkdirSync('plugins/yg-toolkit/dist',{recursive:true});
for(const [name,marker] of [['token-usage.cjs','YG Toolkit'],['token-usage.html','YG Toolkit'],['issue-hub.cjs','Issue Hub'],['issue-hub.html','Issue Hub']]) {
  writeFileSync('plugins/yg-toolkit/dist/'+name,(name.endsWith('.cjs')?'// '+marker+' 版本: '+version:'<!-- '+marker+' 版本: '+version+' -->')+String.fromCharCode(10));
}
for(const name of ['THIRD-PARTY-LICENSES.txt','issue-hub-THIRD-PARTY-LICENSES.txt']) writeFileSync('plugins/yg-toolkit/dist/'+name,'测试许可');
''')
            for name, marker in [('token-usage.cjs', 'YG Toolkit'), ('token-usage.html', 'YG Toolkit'), ('issue-hub.cjs', 'Issue Hub'), ('issue-hub.html', 'Issue Hub')]:
                header = f'// {marker} 版本: 0.2.0\n' if name.endswith('.cjs') else f'<!-- {marker} 版本: 0.2.0 -->\n'
                self.write(f'plugins/yg-toolkit/dist/{name}', header)
            for name in ('THIRD-PARTY-LICENSES.txt', 'issue-hub-THIRD-PARTY-LICENSES.txt'):
                self.write(f'plugins/yg-toolkit/dist/{name}', '测试许可')
        self.commit('chore: 初始化本机测试仓库')
        if not remote_without_plugin:
            self.git('push', '--set-upstream', 'origin', 'main')
        if change:
            self.write('plugins/yg-toolkit/skills/test/SKILL.md', '新增工具能力\n')
            self.commit()
        self.before = self.git('rev-parse', 'HEAD')

    def invoke(self, command='git push'):
        with contextlib.redirect_stdout(io.StringIO()) as result:
            hook.main({'cwd': str(self.root), 'tool_input': {'command': command}})
        return result.getvalue()

    def targets(self):
        return [hook.PLUGIN_MANIFEST, hook.PORTABLE_MANIFEST, *hook.BUILD_OUTPUTS]

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_issue_component_change_upgrades_only_unified_yg(self):
        self.initialize(change=False)
        self.write('packages/issue-hub/src/main.mjs', '// Issue模块变更\n')
        self.commit('feat: 修改Issue模块')
        self.assertIn('0.2.1', self.invoke())
        self.assertEqual(hook.read_version(self.root, 'HEAD'), '0.2.1')
        self.assertEqual(len(hook.PLUGINS), 1)
        self.assertEqual(len(hook.BUILD_OUTPUTS), 6)
        self.assertFalse((self.root / 'plugins/issue-hub').exists())
        for path in hook.marker_paths(hook.PLUGINS[0]):
            self.assertEqual((self.root / path).read_text(encoding='utf-8').strip(), hook.version_header(hook.PLUGINS[0], path, '0.2.1'))

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_syncs_six_outputs_and_preserves_unrelated_index_and_worktree(self):
        self.initialize()
        self.write('other.txt', '已暂存\n')
        self.git('add', 'other.txt')
        self.write('other.txt', '未暂存\n')
        self.invoke()
        self.assertEqual(self.git('show', ':other.txt'), '已暂存')
        self.assertEqual((self.root / 'other.txt').read_text(encoding='utf-8'), '未暂存\n')
        changed = set(self.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').splitlines())
        owned = {p.as_posix() for p in self.targets()}
        self.assertTrue(changed <= owned)
        self.assertTrue({hook.PLUGIN_MANIFEST.as_posix(), hook.PORTABLE_MANIFEST.as_posix(), *(p.as_posix() for p in hook.marker_paths(hook.PLUGINS[0]))} <= changed)
        self.assertEqual(self.git('diff', '--cached', '--name-only'), 'other.txt')

    def test_legacy_manifest_without_build_remains_supported(self):
        self.initialize(build=False, portable=False)
        self.invoke()
        self.assertEqual(hook.read_version(self.root, 'HEAD'), '0.2.1')

    def test_first_unified_publication_keeps_declared_version(self):
        self.initialize(change=False, remote_without_plugin=True)
        self.assertEqual(self.invoke(), '')
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.before)
        self.assertEqual(hook.read_version(self.root), '0.2.0')

    def test_first_publication_requires_all_six_outputs(self):
        self.initialize(change=False, remote_without_plugin=True)
        self.git('rm', '--', 'plugins/yg-toolkit/dist/issue-hub.html')
        self.git('commit', '-m', 'test: 首次发布缺失Issue页面')
        with self.assertRaisesRegex(hook.HookError, '缺少已提交的分发产物'):
            self.invoke()

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_build_target_overrides_inherited_version_environment(self):
        self.initialize()
        with patch.dict(os.environ, {'YG_TOKEN_BUILD_VERSION': '99.1.2'}):
            self.invoke()
        self.assertEqual(hook.read_version(self.root), '0.2.1')
        for path in hook.marker_paths(hook.PLUGINS[0]):
            self.assertEqual((self.root / path).read_text(encoding='utf-8').strip(), hook.version_header(hook.PLUGINS[0], path, '0.2.1'))

    def test_mismatched_manifests_refuse_without_writes(self):
        self.initialize(build=False)
        self.write(hook.PORTABLE_MANIFEST, '{"version":"0.2.1"}')
        with self.assertRaisesRegex(hook.HookError, '版本不一致'):
            self.invoke()
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.before)

    def test_missing_integrated_portable_manifest_is_rejected(self):
        self.initialize()
        self.git('rm', '--', hook.PORTABLE_MANIFEST.as_posix())
        self.git('commit', '-m', 'test: 移除便携清单')
        with self.assertRaisesRegex(hook.HookError, '缺少双清单'):
            self.invoke()

    def test_all_manifest_and_six_output_dirty_targets_are_protected(self):
        self.initialize()
        for path in self.targets():
            for staged in (False, True):
                with self.subTest(path=path, staged=staged):
                    original = (self.root / path).read_bytes()
                    (self.root / path).write_bytes(original + b'\n')
                    if staged:
                        self.git('add', '--', path.as_posix())
                    status = self.git('status', '--porcelain')
                    with self.assertRaisesRegex(hook.HookError, '已有未提交修改'):
                        self.invoke()
                    self.assertEqual(self.git('status', '--porcelain'), status)
                    self.assertEqual((self.root / path).read_bytes(), original + b'\n')
                    self.git('restore', '--staged', '--worktree', '--', path.as_posix())

    def test_dirty_issue_build_input_is_protected(self):
        self.initialize()
        self.write('packages/issue-hub/src/main.mjs', '// 不能打进产物的未提交输入\n')
        with self.assertRaisesRegex(hook.HookError, '构建输入已有未提交修改'):
            self.invoke()

    def test_missing_or_stale_issue_output_in_head_is_rejected(self):
        self.initialize(change=False)
        self.write(hook.PORTABLE_MANIFEST, '{"version":"0.3.0"}')
        self.write(hook.PLUGIN_MANIFEST, '{"version":"0.3.0"}')
        self.commit('feat: 声明已升版')
        with self.assertRaisesRegex(hook.HookError, '构建版本与清单不一致'):
            self.invoke()
        self.git('rm', '--', 'plugins/yg-toolkit/dist/issue-hub.html')
        self.git('commit', '-m', 'test: 移除Issue页面')
        with self.assertRaisesRegex(hook.HookError, '缺少已提交的分发产物'):
            self.invoke()

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_second_module_failure_restores_all_outputs_and_index(self):
        self.initialize()
        self.write(hook.BUILD_SCRIPT, "import {writeFileSync} from 'node:fs';writeFileSync('plugins/yg-toolkit/dist/token-usage.cjs','已写Tokens');process.exit(1);\n")
        self.commit('test: 第二模块构建失败')
        before = {p: (self.root / p).read_bytes() for p in self.targets()}
        head = self.git('rev-parse', 'HEAD')
        self.write('other.txt', '不能混入\n')
        self.git('add', 'other.txt')
        with self.assertRaisesRegex(hook.HookError, '已恢复版本目标'):
            self.invoke()
        self.assertEqual(head, self.git('rev-parse', 'HEAD'))
        self.assertEqual(self.git('diff', '--cached', '--name-only'), 'other.txt')
        for path, contents in before.items():
            self.assertEqual((self.root / path).read_bytes(), contents)

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_success_exit_with_stale_issue_header_restores_both_modules(self):
        self.initialize()
        original_script = (self.root / hook.BUILD_SCRIPT).read_text(encoding='utf-8')
        self.write(hook.BUILD_SCRIPT, original_script + "\nwriteFileSync('plugins/yg-toolkit/dist/issue-hub.html','<!-- Issue Hub 版本: 0.2.0 -->');\n")
        self.commit('test: Issue构建退出成功但版本陈旧')
        before = {p: (self.root / p).read_bytes() for p in self.targets()}
        with self.assertRaisesRegex(hook.HookError, '已恢复版本目标'):
            self.invoke()
        for path, contents in before.items():
            self.assertEqual((self.root / path).read_bytes(), contents)

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_commit_failure_restores_all_targets(self):
        self.initialize()
        before = {p: (self.root / p).read_bytes() for p in self.targets()}
        original = hook.git
        def fail_commit(root, *args):
            if args[0] == 'commit':
                raise subprocess.CalledProcessError(1, ['git', 'commit'])
            return original(root, *args)
        with patch.object(hook, 'git', side_effect=fail_commit), self.assertRaisesRegex(hook.HookError, '已恢复版本目标'):
            self.invoke()
        for path, contents in before.items():
            self.assertEqual((self.root / path).read_bytes(), contents)
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.before)

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_repeated_failed_push_does_not_bump_twice(self):
        self.initialize()
        self.invoke()
        head = self.git('rev-parse', 'HEAD')
        self.assertEqual(self.invoke(), '')
        self.assertEqual(self.git('rev-parse', 'HEAD'), head)

    def test_no_upstream_refuses_push(self):
        self.initialize(build=False)
        self.git('branch', '--unset-upstream')
        with self.assertRaisesRegex(hook.HookError, '没有上游'):
            self.invoke()

    def test_non_push_dry_run_and_unrelated_changes_do_not_bump(self):
        self.initialize(build=False, change=False)
        self.assertEqual(self.invoke('git push --dry-run'), '')
        self.assertEqual(self.invoke('git status'), '')
        self.assertEqual(self.invoke(), '')
        self.write('other.txt', '普通文档\n')
        self.commit()
        self.assertEqual(self.invoke(), '')
        self.assertEqual(hook.read_version(self.root), '0.2.0')

    def test_marketplace_yg_entry_change_is_attributed_to_yg(self):
        self.initialize(build=False, change=False)
        value = {'plugins': [{'name': 'yg-toolkit', 'description': '原始'}]}
        self.write(hook.MARKETPLACE, json.dumps(value))
        self.commit()
        self.git('push', 'origin', 'main')
        value['plugins'][0]['description'] = '包含Issue管理'
        self.write(hook.MARKETPLACE, json.dumps(value))
        self.commit()
        self.invoke()
        self.assertEqual(hook.read_version(self.root), '0.2.1')

    @unittest.skipUnless(shutil.which('node'), '需要本机Node')
    def test_chinese_component_path_is_attributed(self):
        self.initialize(change=False)
        self.write('packages/issue-hub/说明/页面.md', '中文资料\n')
        self.commit()
        self.invoke()
        self.assertEqual(hook.read_version(self.root), '0.2.1')


if __name__ == '__main__':
    unittest.main()
