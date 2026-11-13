from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[4]
directory = Path(__file__).parent
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
head = run('rev-parse', 'main')
assert run('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split()[0] == head
assert run('rev-parse', 'codex/issue-hub-read-recovery') == head
data = json.loads((directory / 'issue-recovery-data-after.json').read_text(encoding='utf-8'))
install = json.loads((directory / 'issue-recovery-real-install.json').read_text(encoding='utf-8'))
read = json.loads((directory / 'issue-recovery-installed-read.json').read_text(encoding='utf-8'))
assert data['protectedStateUnchanged'] and install['passed'] and read['passed']
receipt = {'version': '0.3.1', 'mainHead': head, 'userReportedRecovered': True, 'initialTransportCauseCaptured': False, 'recoveryFixVerified': True, 'issueTests': 255, 'syntaxModules': 53, 'cacheFiles': install['cacheFiles'], 'latestIssueRead': read['passed'], 'dataPreserved': True}
(directory / 'issue-recovery-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
task_file = directory.parent / 'task.json'
task = json.loads(task_file.read_text(encoding='utf-8'))
task['commit'] = head
task['notes'] = 'YG0.3.1已安装并推送main80848c2，修复详情重新读到后旧错误屏及旧请求覆盖新状态/正文。255插件测试/53语法/双服务11工具2入口通过，159缓存文件一致、目标Issue实际联网读回成功、保护数据摘要一致。用户已报告恢复；首次底层请求失败未捕获，不归因代理或权限。仍保留第二台Windows暂缓，原工作区其他材料未提交。'
task['meta'] = {**task.get('meta', {}), 'delivery_version': '0.3.1', 'latest_bugfix_head': head, 'main_pushed_head': head, 'source_pushed_head': head, 'initial_network_cause_captured': False}
task_file.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
