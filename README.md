# YG Toolkit

> 约格维护并开源的 Codex Plugin，为工程配置迁移、数据库工具、文档工作和软件版本发布提供可复用的 Skills。

## 内置 Skills

| Skill | 用途 |
| --- | --- |
| [`config-migrate`](./plugins/yg-toolkit/skills/config-migrate/SKILL.md) | 盘点并迁移 Claude、Codex、Cursor、Trae、ZCode、Kimi 等平台的工程化配置 |
| [`user-manual`](./plugins/yg-toolkit/skills/user-manual/SKILL.md) | 基于真实仓库、权限与运行界面创建或增量维护最终用户操作手册 |
| [`requirement-docs`](./plugins/yg-toolkit/skills/requirement-docs/SKILL.md) | 创建 BRD、PRD、TRD 和 SRS 等需求文档 |
| [`database-schema`](./plugins/yg-toolkit/skills/database-schema/SKILL.md) | 通过连接别名安全提取指定 MySQL、PostgreSQL 或 SQL Server 数据库的分类 DDL 结构快照 |
| [`datapull`](./plugins/yg-toolkit/skills/datapull/SKILL.md) | 检查并指导安装 DataPull CLI，帮助 Agent 安全拉取数据库结构文件 |
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
            ├── requirement-docs/
            ├── user-manual/
            └── version-release/
```

插件清单统一使用 `yg-toolkit` 作为名称，Skill 的目录名与各自 `SKILL.md` 中的 `name` 保持一致。

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
