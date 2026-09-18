# DataPull 独立构建且不依赖 Python 运行时

DataPull 在 `cli/datapull` 中以 Node.js 与 TypeScript 独立实现，通过 NPM 分发，不封装或调用现有 `database-schema` 技能的 Python 脚本；现有实现只作为业务行为和测试场景参考。数据库结构仍通过对应的官方客户端或官方脚本组件获取，SQL Server 可以调用 PowerShell 与官方 `SqlServer` 模块。这样可避免用户为 NPM CLI 额外安装 Python，也让新产品能够独立演进而不对旧技能形成运行时耦合。
