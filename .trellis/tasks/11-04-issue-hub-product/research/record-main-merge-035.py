from pathlib import Path
import hashlib
import json
import subprocess

# 合并回执只保存本机任务，不增加额外提交。
root = Path(__file__).resolve().parents[4]
directory = Path(__file__).parent
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
head = run('rev-parse', 'main')
remote = run('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split()[0]
assert head == remote == run('rev-parse', 'codex/issue-hub')
assert run('rev-list', '--left-right', '--count', 'main...origin/main').split() == ['0', '0']
before = json.loads((directory / 'git-push-preserved-035.json').read_text(encoding='utf-8'))
preserved = all((root / p).is_file() and hashlib.sha256((root / p).read_bytes()).hexdigest() == digest for p, digest in before['otherFiles'].items())
assert preserved
result = {'target': 'main', 'method': 'fast-forward', 'head': head, 'remoteHead': remote, 'source': 'codex/issue-hub', 'version': '0.3.5', 'originalWorkspaceBranch': run('branch', '--show-current'), 'otherTaskFilesPreserved': preserved, 'temporaryWorktreeRemoved': not (root / '.worktrees/issue-hub-main-20261104').exists()}
(directory / 'main-merge-receipt-035.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
task_file = directory.parent / 'task.json'
task = json.loads(task_file.read_text(encoding='utf-8'))
task['notes'] = 'Issue Hub 0.3.5相关两提交已推送功能分支，并按用户授权快进合并和推送main，远端SHA一致。使用独立工作区，清理后原工作区仍在codex/issue-hub，其他任务内容哈希不变。221测试/49语法/23钩子及本机验收已通过，A7第二台Windows仍按用户安排暂缓。未创建正式发布。'
task['meta'] = {**task.get('meta', {}), 'main_pushed_head': head, 'merge_method': 'fast-forward'}
task_file.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
