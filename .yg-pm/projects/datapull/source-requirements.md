# DataPull 原始需求与已确认决策

## 原始目标

将现有 `database-schema` Skill 的能力作为参考，独立建设一个可通过 NPM 安装和升级、以人类交互体验为优先、同时便于 Agent 自动调用的数据库结构文件拉取 CLI。CLI 源码放置在 `cli/datapull/`，另提供新的轻量 `datapull` Skill；现有 `plugins/yg-toolkit/skills/database-schema/` 不做改动。

## 原始功能要求

1. CLI 提供中文优先的列表单选、多选、输入、隐藏输入、确认、任务清单和动态进度。
2. 管理数据库连接、数据库名和登录凭证，支持增删改查。
3. 支持 MySQL、PostgreSQL、SQL Server，检测并指导处理对应官方工具依赖。
4. 结构文件输出到当前项目根目录的 `.database-schema/`。
5. 只执行 `datapull` 时进入引导模式：选择或新增连接、校验连接、选择或输入数据库并校验、选择对象范围、显示拉取进度、反馈结果、结束或恢复。
6. 同时提供适合高级用户与 Agent 的快捷命令，不沿用原始示例中的参数设计，按 CLI 最佳实践重新设计。
7. CLI 内置 Skill 安装能力，支持 Codex、Claude Code、Cursor 和 Trae IDE。
8. 新 Skill 用于检测环境、协助用户安装 CLI、指导 Agent 使用 CLI，不复制数据库拉取逻辑。

## 已确认产品决策

1. 最终文档为单份 SRS。
2. 凭证由用户在 CLI 的隐藏输入中填写，长期保存在用户级独立 `credentials.env`，也允许用户手工修改；连接与偏好保存在用户级 `config.json`。
3. 配置属于当前用户并可跨项目复用；结构文件属于当前项目。
4. 项目根优先取 Git 顶层目录，非 Git 目录使用当前工作目录。
5. 新 CLI 继续使用 `.database-schema/`，但不承担与现有 Skill 的迁移或兼容责任。
6. 引导模式优先服务人类；命令模式提供完整子命令、稳定退出码和可选 `--json`。
7. 一个登记连接可访问多个目标数据库；CLI 尝试枚举，也允许输入，并记录最近使用和收藏。
8. 对象范围按引擎动态展示，常用对象优先、高级对象可展开，默认全选。
9. 本次选择的全部对象类型作为一个事务范围：全部成功后才覆盖这些类型；未选择类型保留；任一失败则所有已选类型保持原样。
10. 本期只维护按对象类型更新的结构文件集，不承诺同一时点完整结构快照。
11. 缺少数据库官方工具时，展示工具、来源、命令、权限及下载影响，用户确认后优先自动安装；失败后显示手工指引。
12. 首版支持 Windows 10/11、macOS、Ubuntu LTS、Debian Stable、Fedora；支持 `winget`、Homebrew、`apt`、`dnf`，未识别包管理器只给指引。
13. 首次运行 CLI 时引导安装 Skill；NPM 安装生命周期不启动交互。
14. Agent 工具采用内置清单，不检测是否安装。用户可多选目标，并为每个目标分别选择用户级或项目级路径；目标目录不存在时预览并确认后创建。
15. Skill 同步时，未修改副本可升级；用户修改过的副本停止覆盖，并提供差异、备份和强制覆盖选择。
16. CLI 不提供 `datapull update`；用户通过 NPM 升级。
17. NPM 包名为公开的 `@yg-toolkit/datapull`，二进制命令为 `datapull`。
18. 支持用户名/密码、完整连接 URL，以及 Windows 下 SQL Server 集成认证；不含云 IAM、OAuth、SSH 隧道和跳板机。
19. 输出采用人类可读层级：`.database-schema/<连接别名>/<数据库>/<对象类型>/<schema>/<对象>.sql`；MySQL 可省略 schema 层，冲突或非法名称追加稳定短哈希。
20. 不输出业务数据、账户、角色、授权、所有者和 `DEFINER` 等环境身份信息。
21. 中文用于交互提示、帮助和错误解释；命令、选项、JSON 字段和错误代码使用英文。
22. CLI 与 Skill 命名均为 DataPull / `datapull`。
23. 支持厂商仍处于官方支持期的数据库版本，并维护明确兼容矩阵。
24. Agent 若先通过 Plugin 获得 Skill，Skill 只提供准确 NPM 安装命令并由用户执行；随后 Agent 验证 CLI。
25. 快捷命令采用分层子命令：`connection`、`pull`、`skill`、`config`、`doctor` 等。
26. 引导失败时保留已有输入，提供重试、修改相关信息、返回连接选择和退出。
27. 项目结构 SQL 默认可纳入 Git，只忽略临时目录、锁和本地运行状态；CLI 不擅自修改项目根 `.gitignore`。
28. CLI 以 TypeScript/Node.js 独立实现，不依赖 Python；现有 Skill 只作为行为和测试参考。
29. 首版不提供 Docker 或其他容器备用路径。
30. `datapull` Skill 唯一源码位于 `cli/datapull/skill/`，构建时同步到 YG Toolkit Plugin 和 NPM 包。
31. Skill 支持对象中的 Trae 指 Trae IDE，不包含 TraeCode CLI。
32. Node.js 最低版本为 `22.12`。

## 参考实现的事实基线

- MySQL：表、视图、函数、过程、触发器、事件。
- PostgreSQL：schema、扩展、表、视图、物化视图、序列、函数、过程、触发器、类型。
- SQL Server：schema、表、视图、函数、过程、触发器、序列、同义词、类型。
- 表结构包含列、约束和索引；触发器单独输出。
- MySQL 使用 `mysql`，PostgreSQL 使用 `psql` 与 `pg_dump`，SQL Server 使用 `sqlcmd`、PowerShell 与官方 `SqlServer` 模块。
- SQL Server 默认启用传输加密并验证服务器证书；证书不可信时不得自动关闭加密。

以上事实只用于定义新 CLI 的需求基线，不构成代码复用或格式兼容承诺。
