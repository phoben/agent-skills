from pathlib import Path
import json
import subprocess

# 汇总本机迁移与源码回执，历史原生验收及其他工作区保持原样。
root = Path(__file__).resolve().parents[4]
directory = Path(__file__).parent
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
head = run('rev-parse', 'main')
assert run('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split()[0] == head
assert run('rev-parse', 'codex/issue-hub-in-yg') == head
assert not run('diff', '--name-only', 'f9afd50..main', '--', 'plugins/yg-toolkit/skills')
data = json.loads((directory / 'toolkit-data-after.json').read_text(encoding='utf-8'))
services = json.loads((directory / 'toolkit-real-install.json').read_text(encoding='utf-8'))
task_restore = json.loads((directory / 'toolkit-existing-task.json').read_text(encoding='utf-8'))
assert data['protectedStateUnchanged'] and services['passed'] and task_restore['passed']
result = {'pluginId': 'yg-toolkit@yg', 'version': '0.3.0', 'mainHead': head, 'sourceBranch': 'codex/issue-hub-in-yg', 'legacyPluginUninstalled': True, 'cacheFilesVerified': services['cacheFiles'], 'services': services['services'], 'protectedStateUnchanged': True, 'existingLinkedTaskRestored': True, 'sourcePointerPreserved': True, 'originalSourceUpdated': True, 'publishedSkillsUnmodified': True, 'secondMachine': 'deferred-by-user', 'temporaryWorktreeRemoved': not (root / '.worktrees/issue-hub-in-yg-20261104').exists()}
(directory / 'toolkit-integration-receipt.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
task_file = directory.parent / 'task.json'
task = json.loads(task_file.read_text(encoding='utf-8'))
task['commit'] = head
task['description'] = 'YG Toolkit内的Issue管理、离线草稿与工作区会话联动；当前统一分发与本机迁移已通过'
task['notes'] = '用户选择Issue Hub纳入YG Toolkit。统一YG0.3.0已安装，旧独立插件官方卸载；159缓存文件、双服务11工具/2入口、原持久状态摘要与既有linked聊天恢复均通过。Issue237/Tokens35/语法53/Hook19及最终Windows包隔离验收通过。相关提交5569276已推送整合分支并快进main，保留f9已发布EdgeOne且本次技能正文无diff。原源指针保留、源码安全同步，其他本机材料未提交。第二台Windows仍按用户要求暂缓。'
task['meta'] = {**task.get('meta', {}), 'plugin_id': 'yg-toolkit@yg', 'delivery_version': '0.3.0', 'integration_main_head': head, 'legacy_plugin_retired': True, 'original_data_preserved': True}
task_file.write_text(json.dumps(task, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
