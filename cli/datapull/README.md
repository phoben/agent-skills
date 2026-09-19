# DataPull

DataPull 是一款面向人类交互、同时提供稳定自动化接口的数据库结构拉取 CLI。它以只读方式连接 MySQL、PostgreSQL 或 SQL Server，把数据库对象的 DDL 保存到当前项目的 `.database-schema/`。

DataPull 不导出表内业务数据、数据库用户、角色或授权，也不是数据库备份工具。

三种数据库通过统一的 Provider/Registry 架构接入。数据库名称、默认端口、认证方式、对象范围、工具依赖、交互选项和兼容性验收都由同一份 Provider Manifest 驱动；新增数据库无需再在完整拉取流程中复制分支。

## 60 秒上手

### 1. 检查运行环境

需要 Node.js `>=22.12` 和可用的 NPM：

```powershell
node --version
npm --version
```

### 2. 用一条命令新增连接并拉取

无需全局安装：

```powershell
npx --yes --package=@yg-toolkit/datapull@latest datapull connection add
```

已经全局安装时：

```powershell
datapull connection add
```

可以使用下面这组模拟信息熟悉流程。域名为示例保留域名，需要替换成自己的数据库地址才能真正连接：

| 提示项 | 模拟输入 | 说明 |
|---|---|---|
| 连接别名 | `demo-mysql` | 后续命令通过该名称选择连接 |
| 数据库类型 | `MySQL` | 也支持 PostgreSQL、SQL Server |
| 认证方式 | `用户名和密码` | 密码使用隐藏输入，不写入命令历史 |
| 数据库主机 | `mysql.demo.example` | 替换为真实主机名或 IP |
| 端口 | `3306` | MySQL 默认端口 |
| 用户名 | `schema_reader` | 建议使用只读结构账号 |
| 数据库密码 | 隐藏输入 | 不会回显 |

连接保存后，DataPull 会检查数据库工具并校验连通性。校验成功后选择“立即拉取”，再输入模拟数据库名：

```text
shop_demo
```

DataPull 随后拉取该引擎支持的全部结构对象，并输出实际写入目录和对象数量。拒绝立即拉取时，连接仍会保存，稍后可通过 `pull` 命令使用。

直接运行 `datapull` 进入完整向导时，对象范围分为四类：

| 范围 | 行为 |
|---|---|
| 全部对象 | 拉取当前数据库引擎支持的所有对象类型 |
| 常用对象 | 拉取数据表、视图、函数、存储过程，以及 PostgreSQL/SQL Server 的模式 |
| 高级对象 | 拉取当前引擎中不属于常用范围的对象类型 |
| 自定义 | 展示完整中文对象列表，默认只勾选数据表、视图和函数 |

范围选择默认停留在“常用对象”。只有选择“自定义”才会出现多选列表；列表完整展示当前引擎支持的对象类型，并在首尾停止，不会循环滚动。

## 拉取已有连接

拉取 `demo-mysql` 连接中的 `shop_demo` 数据库全部结构：

```powershell
datapull pull --connection demo-mysql --database shop_demo --yes
```

通过 npx 执行同一操作：

```powershell
npx --yes --package=@yg-toolkit/datapull@latest datapull pull --connection demo-mysql --database shop_demo --yes
```

只更新表和视图，保留其他类型的既有文件：

```powershell
datapull pull --connection demo-mysql --database shop_demo --include table,view --yes
```

给 Agent、CI 或脚本使用机器可读输出：

```powershell
datapull pull --connection demo-mysql --database shop_demo --include table,view --yes --json
```

`--json` 模式只在 stdout 输出一个最终 JSON 文档；阶段进度和诊断信息写入 stderr。

## PostgreSQL 与 SQL Server 示例

交互式新增连接时，只需替换数据库类型和连接信息：

| 数据库 | 模拟主机 | 默认端口 | 模拟数据库名 |
|---|---|---:|---|
| MySQL | `mysql.demo.example` | 3306 | `shop_demo` |
| PostgreSQL | `postgres.demo.example` | 5432 | `analytics_demo` |
| SQL Server | `sqlserver.demo.example` | 1433 | `orders_demo` |

已有 PostgreSQL 连接的拉取示例：

```powershell
datapull pull --connection demo-postgres --database analytics_demo --yes
```

已有 SQL Server 连接的拉取示例：

```powershell
datapull pull --connection demo-sqlserver --database orders_demo --yes
```

SQL Server 始终启用传输加密并默认严格验证服务器证书。遇到内部 CA 或自签名证书时，优先安装可信 CA；只有明确接受风险时，才选择仅本次信任或保存信任设置。

## 输出目录

结构文件按连接、数据库、对象类型和可选 schema 分层：

```text
.database-schema/
└── demo-mysql/
    └── shop_demo/
        ├── table/
        │   ├── customers.sql
        │   └── orders.sql
        ├── view/
        └── procedure/
```

本次选择的对象类型会作为一个文件事务整体更新；未选择类型原样保留。任一所选类型读取、校验或提交失败时，不会留下半套新文件。

## 支持的对象类型

命令模式省略 `--include` 时，默认拉取当前引擎支持的全部类型；完整向导则先询问“全部、常用、高级、自定义”范围。

| 数据库 | 对象类型 |
|---|---|
| MySQL | `table`、`view`、`function`、`procedure`、`trigger`、`event` |
| PostgreSQL | `schema`、`extension`、`table`、`view`、`materialized_view`、`sequence`、`function`、`procedure`、`trigger`、`type` |
| SQL Server | `schema`、`table`、`view`、`function`、`procedure`、`trigger`、`sequence`、`synonym`、`type` |

## 常用命令

```powershell
# 完整中文向导
datapull

# 新增、保存并校验连接，成功后可立即拉取
datapull connection add

# 查看脱敏连接
datapull connection list

# 查看连接可访问、收藏和最近使用的数据库
datapull database list --connection demo-mysql

# 测试连接及指定数据库
datapull connection test --alias demo-mysql --database shop_demo --json

# 诊断 Node.js、配置与数据库工具，不自动安装
datapull doctor --json

# 查看完整帮助或具体命令帮助
datapull --help
datapull connection add --help
datapull pull --help
```

完整命令族包括：

- `connection add|list|show|update|remove|test`
- `database list|favorite add|favorite remove`
- `pull`
- `skill install|list|status|sync`
- `config path|validate`
- `doctor`

## 自动化调用

交互式 `connection add` 会校验连接并询问是否立即拉取。带 `--json` 的非交互调用保持稳定契约：只登记连接，不追加提示或自动访问数据库。

自动化新增连接时，先通过进程环境或 CI Secret 安全注入凭证变量，不要把真实密码直接写在命令参数中。以下命令假设环境中已经存在 `DATAPULL_DEMO_MYSQL_PASSWORD`：

```powershell
datapull connection add `
  --alias demo-mysql `
  --engine mysql `
  --auth-mode password `
  --host mysql.demo.example `
  --port 3306 `
  --username schema_reader `
  --yes `
  --json
```

然后显式执行拉取：

```powershell
datapull pull --connection demo-mysql --database shop_demo --yes --json
```

## 配置和秘密

登记连接属于当前操作系统用户：

- Windows：`%APPDATA%/datapull/`
- macOS：`$HOME/Library/Application Support/datapull/`
- Linux：`${XDG_CONFIG_HOME:-$HOME/.config}/datapull/`

非秘密连接信息保存在 `config.json`，密码或完整含秘密 URL 保存在权限受限的 `credentials.env`。秘密只能通过交互式隐藏输入、进程环境或用户手工维护凭证文件提供，不会写入结构文件。

推荐为 DataPull 使用只读结构账号，只授予连接数据库、读取元数据和查看对象定义所需的最小权限。

## 常见问题

### 提示缺少数据库工具

DataPull 会展示缺少的官方客户端、来源、安装命令、所需权限和下载影响。交互模式下确认后才能自动安装；自动化模式需要显式加入 `--install-missing --yes`。

### 提示凭证不可用

运行 `datapull connection show --alias <连接别名>` 查看脱敏的凭证引用，再通过隐藏输入、进程环境或 CLI 指示的 `credentials.env` 提供对应值。不要把密码发到聊天或日志中。

### SQL Server 证书不受信任

生产环境优先安装可信 CA 并保持严格验证。仅在开发、测试或受控内网明确接受中间人攻击风险时，选择仅本次信任或保存该设置；该选项不会关闭加密，但会失去服务器身份验证。

### 不确定失败发生在哪一层

```powershell
datapull doctor --json
```

根据返回的稳定 `error.code` 处理配置、凭证、工具或连接问题。

数据库客户端执行失败时，人类模式会继续展示已脱敏的 `psql`、`pg_dump`、`mysql` 或 `sqlcmd` 详情；自动化场景可加入 `--json` 获取结构化 `error.details`。内置 Provider 的幂等只读操作遇到明确识别的连接中断或超时时最多尝试三次；认证、权限、TLS、SQL 与解析错误不会重试。

连接登记时的校验只证明服务器、认证和基础查询可用。具体数据库的对象读取权限会在拉取时校验；PostgreSQL 表较多时，终端会显示“当前表/总表数”，并以最多四个 `pg_dump` 任务并发读取，避免完全串行或同时创建过多连接。

## Agent Skill

DataPull 内置 Agent Skill 安装器。平台注册表基于 `vercel-labs/skills` v1.7.0，当前识别 79 个 ID（包含内部 `universal` 目标）：

```powershell
datapull skill list
datapull skill install --target codex:user --yes
datapull skill install --target universal:project --yes
datapull skill install --target opencode:user --target trae-cn:user --yes
```

`skill list` 展示的是路径契约，不代表对应 Agent 已安装或完成真实运行时验收。平台分类和选择逻辑见 [Vercel `skills` 平台选择与 UI 调研](../../docs/research/2026-09-19-vercel-skills-agent-targets-and-ui.md)。

## 开发与发布

```powershell
npm install --ignore-scripts
npm run check
npm test
npm run build
npm run skill:check
```

`npm run release:check` 验证真实数据库、五类操作系统、NPM 安装及既有 Skill 目标的兼容矩阵是否完整。单元测试不能替代真实数据库和跨平台验收。

- DataPull 维护要求：[维护者指南](docs/maintenance.md)
- 跨平台验收与发布：[兼容性与发布 CI](docs/release-ci.md)
- 仓库级通用 CLI 工程要求：[通用 CLI 开发规范](../CLI-DEVELOPMENT-STANDARD.md)
