# YG Toolkit

> 约格维护并开源的 Codex Plugin，为工程配置迁移、数据库工具、文档工作和软件版本发布提供可复用的 Skills。

## 内置 Skills

| Skill | 用途 |
| --- | --- |
| [`config-migrate`](./plugins/yg-toolkit/skills/config-migrate/SKILL.md) | 盘点并迁移 Claude、Codex、Cursor、Trae、ZCode、Kimi 等平台的工程化配置 |
| [`user-manual`](./plugins/yg-toolkit/skills/user-manual/SKILL.md) | 基于真实仓库、权限与运行界面创建或增量维护最终用户操作手册 |
| [`requirement-docs`](./plugins/yg-toolkit/skills/requirement-docs/SKILL.md) | 创建 BRD、PRD、TRD 和 SRS 等需求文档 |
| [`issue-triage`](./plugins/yg-toolkit/skills/issue-triage/SKILL.md) | 读取 Issue、组织只读调研，澄清诉求并经确认后回复和分类 |
| [`issue-extract`](./plugins/yg-toolkit/skills/issue-extract/SKILL.md) | 从已有资料提取待办，核验项目现状、筛选有效 Issue，交付草案并经用户选定后创建 |
| [`enterprise-ui-design`](./plugins/yg-toolkit/skills/enterprise-ui-design/SKILL.md) | 继承现有企业系统规范，设计高密度页面与复杂交互，并通过原型和独立审查验证 |
| [`edgeone-app-builder`](./plugins/yg-toolkit/skills/edgeone-app-builder/SKILL.md) | 指导来源项目构建、验证并交付符合 EdgeOne 运行方式和目标路径要求的应用成品 |
| [`datapull`](./plugins/yg-toolkit/skills/datapull/SKILL.md) | 通过 DataPull CLI 安全导出 MySQL、PostgreSQL 或 SQL Server 的 DDL，处理环境、对象范围、证书异常与结果验收 |
| [`version-release`](./plugins/yg-toolkit/skills/version-release/SKILL.md) | 检查工作区并完成提交、推送、发布、故障恢复和公开安装验证 |

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
