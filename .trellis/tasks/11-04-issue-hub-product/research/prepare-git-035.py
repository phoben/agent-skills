from pathlib import Path
import hashlib
import json
import subprocess

# 明确提交范围并保留其他任务的内容快照，不改索引或工作区内容。
root = Path(__file__).resolve().parents[4]
run = lambda *args: subprocess.check_output(['git', '-C', str(root), *args])
staged = [p for p in run('diff', '--cached', '--name-only', '-z').decode().split('\0') if p]
exact = {'.agents/plugins/marketplace.json', '.trellis/spec/backend/index.md', '.trellis/spec/backend/issue-hub.md', '.trellis/spec/frontend/index.md', '.trellis/spec/frontend/issue-hub.md', '.trellis/spec/guides/cross-layer-thinking-guide.md', 'GLOSSARY.md', 'docs/adr/0010-share-issue-data-through-github.md', 'docs/adr/0011-use-in-page-repository-navigation.md'}
prefixes = ('packages/issue-hub/', 'plugins/issue-hub/', 'docs/issue-hub/')
assert len(staged) == 77
assert all(p in exact or p.startswith(prefixes) for p in staged)
assert not any('/node_modules/' in p or p.startswith('.trellis/tasks/') for p in staged)
directory = Path(__file__).parent
other = ['plugins/yg-toolkit/skills/edgeone-app-builder/SKILL.md', 'plugins/yg-toolkit/skills/edgeone-app-builder/references/yg-portal.md']
other += [p.relative_to(root).as_posix() for p in (root / '.playwright-cli').rglob('*') if p.is_file()]
hashes = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in other if (root / p).is_file()}
(directory / 'git-push-preserved-035.json').write_text(json.dumps({'branch': run('branch', '--show-current').decode().strip(), 'base': run('rev-parse', 'HEAD').decode().strip(), 'featureFiles': staged, 'otherFiles': hashes}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(directory / 'commit-feature-035.txt').write_text('feat(issue-hub): 新增 Issue 管理与工作区会话联动\n\n新增独立 MCP 页面、仓库发现、Issue 读写与离线草稿。\n支持正确工作区预填、可靠关联和返回，交付 0.3.5 自包含插件。\n整理需求、架构与本机验收，第二台 Windows 留待交接。\n\n验证：221 项插件测试、49 模块语法、构建与包外 stdio 通过；\n本机安装 8 文件哈希一致，既有真实 GitHub 和桌面闭环已验收。\n', encoding='utf-8')
(directory / 'commit-hook-035.txt').write_text('fix(plugins): 按归属隔离推送前自动升版\n\n分别识别 Issue Hub 和 YG Toolkit 源码及市场条目变更，避免交叉升版。\n首个入库版本保持已提交版本，脏构建输入拒绝重建，失败回退本轮目标。\n\n验证：23 项临时仓库及本地 bare 远端测试通过。\n', encoding='utf-8')
print(json.dumps({'featureFiles': len(staged), 'preservedOtherFiles': len(hashes), 'scopeValid': True}, ensure_ascii=False))
