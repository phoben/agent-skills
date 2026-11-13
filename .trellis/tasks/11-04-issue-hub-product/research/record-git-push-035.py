from pathlib import Path
import json
import subprocess

# 推送回执只写本机任务记录，不追加无关提交。
root = Path(__file__).resolve().parents[4]
directory = Path(__file__).parent
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
head = run('rev-parse', 'HEAD')
remote = run('ls-remote', '--exit-code', 'origin', 'refs/heads/codex/issue-hub').split()[0]
assert remote == head
assert run('rev-list', '--left-right', '--count', 'HEAD...@{upstream}').split() == ['0', '0']
commits = run('rev-list', '--reverse', 'def572b..HEAD').splitlines()
assert len(commits) == 2
receipt = {'branch': 'codex/issue-hub', 'upstream': run('rev-parse', '--abbrev-ref', '@{upstream}'), 'head': head, 'remoteHead': remote, 'commits': commits, 'version': '0.3.5', 'sourceOnly': True, 'officialReleaseCreated': False, 'otherTaskFilesPreserved': True}
(directory / 'git-push-receipt-035.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
task_file = directory.parent / 'task.json'
task = json.loads(task_file.read_text(encoding='utf-8'))
task['commit'] = head
task['notes'] = '本机功能验收完成；分发0.3.5仅清理空白和版本元数据，221测试/49语法/包外stdio及8文件哈希通过。用户授权后已将IssueHub相关80文件分两条提交推送origin/codex/issue-hub，远端SHA一致；其他任务和本机QA保留未提交。正式交接入口docs/issue-hub，A7第二台Windows仍按用户安排暂缓，未创建正式发布。'
task['meta'] = {**task.get('meta', {}), 'delivery_version': '0.3.5', 'source_pushed_head': head, 'feature_commit': commits[0], 'hook_commit': commits[1]}
task_file.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
