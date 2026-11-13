---
name: database-schema
description: 兼容旧的 database-schema 显式调用，将数据库结构导出交给 DataPull 统一执行；新任务使用 datapull。
---

# DB Schema

这是旧调用的兼容入口。读取并按 [DataPull](../datapull/SKILL.md) 完成任务，所有导出、安全与验收规则以该文件为准。

旧格式 `$database-schema <连接别名> <数据库名>` 中的两个参数分别映射到 `datapull pull --connection <连接别名> --database <数据库名>`。保留用户明确指定的对象范围；未限定类型时使用 DataPull 的全部类型流程。

首次从旧版切换时，说明现在使用 DataPull CLI，需要通过 CLI 登记连接，输出位于项目根的 `.database-schema/<连接别名>/<数据库名>/`。已有旧配置和快照保持原样，不读取秘密或自动迁移。旧 Python/PowerShell 导出器已移除。
