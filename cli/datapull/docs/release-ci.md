# DataPull 兼容性 CI

兼容性工作流通过三个远程验收数据库，在每个平台上安装打包后的 DataPull、拉取全部对象类型并生成脱敏证据。工作流不会修改兼容矩阵，也不会自动发布 NPM 包。

## 安全边界

- 工作流仅支持手动触发，仓库权限固定为 `contents: read`。
- 数据库运行账号应为专用只读账号；建库和执行种子脚本使用另一组管理员凭证。
- SQL Server 必须提供受运行器信任的 TLS 证书；工作流不会启用 `trustServerCertificate`。
- 不要在 Issue、提交、工作流参数或聊天中传递秘密。数据库秘密只写入 GitHub Actions Secrets。
- Windows、Debian、Fedora 自托管运行器必须是可重建的专用验收机，不得与开发者日常账号或生产网络共用。
- CI 只验证八个 Skill 路径的安装和回验。四种 Agent 对 Skill 的实际发现仍需在专用桌面验收机上确认，证据中的 `agentDiscoveryVerified` 因此保持 `false`。

## 远程数据库

分别创建专用数据库并执行以下种子脚本：

- `resources/ci/mysql-seed.sql`
- `resources/ci/postgresql-seed.sql`
- `resources/ci/sqlserver-seed.sql`

种子库故意包含一条 `DATAPULL_BUSINESS_DATA_MUST_NOT_APPEAR` 数据。CI 会确认该值没有进入结构文件，并要求每个受支持对象类型至少成功拉取一个对象。

运行账号至少需要连接目标数据库、读取元数据和查看对象定义的权限，不应拥有建表、修改数据、账户管理或授权权限。

## GitHub Actions Secrets

在仓库 Settings → Secrets and variables → Actions 中配置：

| 数据库 | 必填 Secrets | 可选 Secrets |
|---|---|---|
| MySQL | `DATAPULL_CI_MYSQL_HOST`、`DATAPULL_CI_MYSQL_USERNAME`、`DATAPULL_CI_MYSQL_PASSWORD`、`DATAPULL_CI_MYSQL_DATABASE` | `DATAPULL_CI_MYSQL_PORT`、`DATAPULL_CI_MYSQL_SSL_MODE` |
| PostgreSQL | `DATAPULL_CI_POSTGRESQL_HOST`、`DATAPULL_CI_POSTGRESQL_USERNAME`、`DATAPULL_CI_POSTGRESQL_PASSWORD`、`DATAPULL_CI_POSTGRESQL_DATABASE` | `DATAPULL_CI_POSTGRESQL_PORT`、`DATAPULL_CI_POSTGRESQL_SSL_MODE` |
| SQL Server | `DATAPULL_CI_SQLSERVER_HOST`、`DATAPULL_CI_SQLSERVER_USERNAME`、`DATAPULL_CI_SQLSERVER_PASSWORD`、`DATAPULL_CI_SQLSERVER_DATABASE` | `DATAPULL_CI_SQLSERVER_PORT`、`DATAPULL_CI_SQLSERVER_CA_CERT` |

未设置时分别采用端口 `3306`、`5432`、`1433`，MySQL TLS 模式采用 `REQUIRED`，PostgreSQL 采用 `verify-full`。

可在本机使用 `gh secret set SECRET_NAME` 逐项安全录入；命令会从终端隐藏输入读取值。不要把秘密作为命令参数。

SQL Server 使用私有 CA 或自签名证书时，将签发服务器证书的根 CA PEM 全文写入
`DATAPULL_CI_SQLSERVER_CA_CERT`。macOS 与 Ubuntu 托管任务会在连接前把该 CA 加入系统信任库，
但仍会校验证书有效期和主机名；证书的 SAN 必须包含配置中的 DNS 名称或 IP 地址。自托管运行器由
维护者预先安装同一 CA，工作流不会修改其系统信任库。

## 运行器

macOS 15 Intel 与 Ubuntu 24.04 使用 GitHub 托管运行器。以下平台使用专用自托管运行器：

| 平台 | 必需标签 |
|---|---|
| Windows 10/11 x64 | `self-hosted`、`Windows`、`X64`、`datapull-windows-10-11` |
| Debian Stable x64 | `self-hosted`、`Linux`、`X64`、`datapull-debian-stable` |
| Fedora Current x64 | `self-hosted`、`Linux`、`X64`、`datapull-fedora-current` |

自托管运行器必须安装 Node.js 可执行环境以及 `mysql`、`psql`、`pg_dump`、`sqlcmd`、`pwsh` 和 PowerShell `SqlServer` 模块，或在手动触发时明确启用 `install_missing`。由于仓库公开，自托管运行器只能用于本工作流，不得允许来自 PR 的任务执行。

## 执行与取证

在 Actions 页面手动运行“DataPull 兼容性验收”：

1. 先选择 `hosted`，验证 macOS 与 Ubuntu。
2. 三个自托管运行器上线后，分别选择对应平台。
3. 每个成功任务都会上传 `datapull-compatibility-<platform>`，保留 30 天。
4. 审查证据中的提交 SHA、数据库/客户端版本、对象数量和平台信息。
5. 完成四种 Agent 的实际发现验证后，才可把证据录入 `resources/compatibility-matrix.json`。
6. 执行 `npm run release:check`；只有完整矩阵可以进入发布。

首次公开包仍需由已启用 2FA 的 owner 在本机发布。包创建后再配置 NPM Trusted Publisher，并使用 GitHub 托管发布任务及 OIDC；不要为发布创建长期写 Token。
