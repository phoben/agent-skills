# 本地提交计划

功能实现、构建、真实读取和本地安装已完成。按Trellis3.4执行以下三批提交，再完成任务归档和会话记录。

当前决定：用户于2026-11-03明确要求“提交并推送”，覆盖此前的暂缓决定。提交后以普通推送发布当前分支codex/token-usage-sidebar，不合并main、不创建标签或公开发布制品。

## 1. chore(trellis): 初始化项目开发工作流

- `.agents/skills/trellis-*/`及其英文显示名、中文说明。
- `.codex/agents/`、新Trellis助手配置及三个生成hook；`.gitattributes`。
- `.trellis/`基础工作流、脚本、配置、规范索引与初始化任务；本功能制品单独放下一批。

## 2. feat(yg-toolkit): 增加账号和项目用量侧栏

- `packages/token-usage/`：源码、测试、锁文件、构建与验收命令，排除node_modules。
- `plugins/yg-toolkit/plugin.json`、兼容清单、`mcp.json`及三个dist产物。
- `README.md`、`docs/token-usage.md`、`docs/design/token-usage.md`。
- `.trellis/spec/backend/token-usage.md`、`frontend/token-usage.md`。
- 当前任务的PRD、设计、实现清单、上下文、脱敏运行时发现、验收及提交计划。

## 3. fix(yg-toolkit): 同步双清单与构建版本

- `.codex/hooks/bump_plugin_version_before_push.py`。
- `.codex/hooks/test_bump_plugin_version.py`。
- `docs/adr/0009-auto-bump-plugin-version-before-codex-push.md`。

工作提交完成后，按Trellis记录归档与会话日志，使用中文chore提交；不自动清理其他任务。

## 保留在工作区

- `prototypes/`为前序设计产物；`.oil-ui/`为候选、截图与私有过程材料。
- 当前任务research中的本机探测和浏览器临时脚本不纳入提交；用于上下文的`runtime-findings.md`已脱敏，可纳入。
- Codex用户目录统计缓存、账号信息及真实用量结果不在仓库提交范围。
