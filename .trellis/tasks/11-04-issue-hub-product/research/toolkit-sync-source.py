from pathlib import Path
import hashlib
import json
import subprocess

# 只认领已在目标提交中的相同内容，再正常快进；不新提交、不覆盖或清理其他工作。
root = Path(__file__).resolve().parents[4]
target = 'codex/issue-hub-in-yg'
paths = ['plugins/yg-toolkit/skills/edgeone-app-builder/SKILL.md', 'plugins/yg-toolkit/skills/edgeone-app-builder/references/yg-portal.md']
def git(*args):
    return subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8')
assert git('diff', '--cached', '--name-only').stdout.strip() == '', '已有暂存内容，保留现场'
assert git('merge-base', '--is-ancestor', 'HEAD', target).returncode == 0
before = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}
oids = {}
for path in paths:
    working = git('hash-object', f'--path={path}', path).stdout.strip()
    published = git('rev-parse', f'{target}:{path}').stdout.strip()
    assert working and working == published, '其他任务仍有未发布内容，拒绝同步'
    oids[path] = published
assert git('add', '--', *paths).returncode == 0
try:
    assert all(git('rev-parse', f':{path}').stdout.strip() == oid for path, oid in oids.items())
    merged = git('merge', '--ff-only', target)
    assert merged.returncode == 0, 'Git拒绝快进，保留文件'
except BaseException:
    # 初始索引为空，只撤回本脚本的两个已发布路径；不动工作区文件。
    git('restore', '--staged', '--', *paths)
    raise
after = {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}
assert before == after
assert git('diff', '--cached', '--name-only').stdout.strip() == ''
result = {'fastForwarded': True, 'head': git('rev-parse', 'HEAD').stdout.strip(), 'branchNamePreserved': git('branch', '--show-current').stdout.strip(), 'publishedOtherContentUnchanged': True, 'newCommitCreated': False, 'indexClean': True}
(Path(__file__).parent / 'toolkit-source-sync.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
