# YG Toolkit

> 约格维护并开源的 Codex Plugin，统一提供工程与文档 Skills、Tokens 用量页和 Issue Hub。

## 内置 Skills

| Skill | 用途 |
| --- | --- |
| [`config-migrate`](./plugins/yg-toolkit/skills/config-migrate/SKILL.md) | 盘点并迁移 Claude、Codex、Cursor、Trae、ZCode、Kimi 等平台的工程化配置 |
| [`user-manual`](./plugins/yg-toolkit/skills/user-manual/SKILL.md) | 基于真实仓库、权限与运行界面创建或增量维护最终用户操作手册 |
| [`requirement-docs`](./plugins/yg-toolkit/skills/requirement-docs/SKILL.md) | 创建 BRD、PRD、TRD 和 SRS 等需求文档 |
| [`issue-triage`](./plugins/yg-toolkit/skills/issue-triage/SKILL.md) | 读取 Issue、组织只读调研，澄清诉求并经确认后回复和分类 |
| [`issue-extract`](./plugins/yg-toolkit/skills/issue-extract/SKILL.md) | 从已有资料提取待办，核验项目现状、筛选有效 Issue，交付草案并经用户选定后创建 |
| [`enterprise-ui-design`](./plugins/yg-toolkit/skills/enterprise-ui-design/SKILL.md) | 继承现有企业系统规范，设计高密度页面与复杂交互，并通过原型和独立审查验证 |
| [`edgeone-app-builder`](./plugins/yg-toolkit/skills/edgeone-app-builder/SKILL.md) | 新建或更新 EdgeOne 应用；沿用现有项目的技术栈与界面体系，并验证部署路径和交付成品 |
| [`datapull`](./plugins/yg-toolkit/skills/datapull/SKILL.md) | 通过 DataPull CLI 安全导出 MySQL、PostgreSQL 或 SQL Server 的 DDL，处理环境、对象范围、证书异常与结果验收 |
| [`version-release`](./plugins/yg-toolkit/skills/version-release/SKILL.md) | 检查工作区并完成提交、推送、发布、故障恢复和公开安装验证 |

## Tokens 用量页面

YG Toolkit提供Codex侧栏用量页：查看当前账号官方趋势、本机项目逐日分布、Tokens桑基关系与会话分项明细。界面采用已确认的C版流量对照板，固定项目→会话两层。

账号与本机统计各自标明覆盖范围，身份未知的旧记录和其他账号会排除。使用方式见[用量页面说明](./docs/token-usage.md)，开发与验证见[模块说明](./packages/token-usage/README.md)。

## Issue Hub

YG Toolkit 0.3.0纳入Issue Hub。只安装一个YG插件，Tokens与Issue Hub保留各自页面入口和独立MCP进程，统一升级版本。Issue Hub可发现本机项目仓库、管理Issue与评论、保存离线草稿，并在正确工作区预填任务、关联和返回已有聊天。

旧独立Issue Hub的缓存、草稿和聊天关联继续使用原本机目录，无需搬动或重新创建。使用Issue管理需要成员自己的gh登录；缺gh不阻断Tokens或工程技能。旧独立插件应保持停用，确认整合版后可卸载其插件缓存；不删除业务数据。见[整合架构](./docs/issue-hub/architecture.md)及[迁移交接](./docs/issue-hub/windows-handoff.md)。

## 仓库结构

```text
.
├── .agents/plugins/marketplace.json
└── plugins/
    └── yg-toolkit/
        ├── .codex-plugin/plugin.json
        └── skills/
            ├── config-migrate/
            ├── database-schema/
            ├── datapull/
            ├── enterprise-ui-design/
            ├── edgeone-app-builder/
            ├── issue-triage/
            ├── issue-extract/
            ├── requirement-docs/
            ├── user-manual/
            └── version-release/
```

插件清单统一使用 `yg-toolkit` 作为名称，Skill 的目录名与各自 `SKILL.md` 中的 `name` 保持一致。

技能调用标识与界面名称使用简短英文，功能描述与默认提示词使用中文。新增或调整技能时，遵循 [AGENTS.md 中的技能命名规范](./AGENTS.md#技能命名规范)。

数据库结构导出统一使用 `$datapull`。旧 [`$database-schema`](./plugins/yg-toolkit/skills/database-schema/SKILL.md) 只保留显式调用的兼容入口，不再包含独立导出器。两者执行同一套 DataPull 流程；旧连接配置需通过 CLI 重新登记，已有旧快照不自动迁移或删除。对比与取舍见 [合并决策](./docs/adr/0008-unify-database-skills-on-datapull.md)。

项目 Codex 会在推送前自动递增 YG Toolkit 插件补丁版本；规则与边界见 [自动版本升级决策](./docs/adr/0009-auto-bump-plugin-version-before-codex-push.md)。

整合版统一构建入口为 `npm --prefix packages/token-usage run build`，串行构建Tokens与Issue Hub。先分别为 `packages/token-usage`、`packages/issue-hub` 执行 `npm ci`；私有源码包版本不作为插件安装版本。

## 在 Codex 中安装

克隆仓库后，将仓库根目录注册为本地 Marketplace，再安装插件：

```bash
codex plugin marketplace add <仓库根目录>
codex plugin add yg-toolkit@yg
```

安装或更新后，请新建一个 Codex 任务，以加载最新的 Skills。

## 开发校验

插件交付前应完成以下校验：

```bash
python <plugin-creator目录>/scripts/validate_plugin.py plugins/yg-toolkit
python <skill-creator目录>/scripts/quick_validate.py plugins/yg-toolkit/skills/<skill-name>
```

## License

[MIT](./LICENSE)
