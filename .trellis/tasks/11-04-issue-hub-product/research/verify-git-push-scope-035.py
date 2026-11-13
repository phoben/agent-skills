from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[4]
directory = Path(__file__).parent
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args])
before = json.loads((directory / 'git-push-preserved-035.json').read_text(encoding='utf-8'))
changed = {p for p in run('diff', '--name-only', '-z', before['base'], 'HEAD').decode().split('\0') if p}
expected = set(before['featureFiles']) | {'.codex/hooks/bump_plugin_version_before_push.py', '.codex/hooks/test_bump_plugin_version.py', 'docs/adr/0009-auto-bump-plugin-version-before-codex-push.md'}
assert changed == expected, '提交文件集合超出本次范围'
assert not run('diff', '--cached', '--name-only').strip(), '提交后索引不为空'
sys.path.insert(0, str(root / '.codex/hooks'))
import bump_plugin_version_before_push as hook
affected = hook.affected_plugins(root, 'origin/main')
assert [plugin.name for plugin in affected] == ['issue-hub']
plugin = affected[0]
hook.preflight(root, plugin)
version = hook.checked_version(root, 'HEAD', plugin)
assert version == '0.3.5'
assert not hook.tracked(root, 'origin/main', plugin.manifest)
hook.validate_artifacts(root, plugin, version)
preserved = all((root / p).is_file() and hashlib.sha256((root / p).read_bytes()).hexdigest() == digest for p, digest in before['otherFiles'].items())
assert preserved, '其他任务内容在核对期间发生变化，需保留现场核查'
result = {'branch': run('branch', '--show-current').decode().strip(), 'head': run('rev-parse', 'HEAD').decode().strip(), 'commits': run('rev-list', '--count', f"{before['base']}..HEAD").decode().strip(), 'changedFiles': len(changed), 'affectedPlugins': [p.name for p in affected], 'version': version, 'firstIntroduction': True, 'artifactsVerified': True, 'unrelatedFilesUnchanged': preserved}
(directory / 'git-push-scope-035.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
