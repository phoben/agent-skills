# DataPull 兼容性与发布 CI

兼容性工作流通过三个远程验收数据库，在每个平台上安装打包后的 DataPull、拉取全部对象类型并生成脱敏证据。它不会修改兼容矩阵，也不会自动发布 NPM 包。发布由独立的 `datapull-publish.yml` 工作流完成。

## 安全边界

- 工作流仅支持手动触发，仓库权限固定为 `contents: read`。
- 数据库运行账号应为专用只读账号；建库和执行种子脚本使用另一组管理员凭证。
- SQL Server 始终使用加密连接；验收库可显式启用 `trustServerCertificate`，该选择不代表生产环境建议。
- 不要在 Issue、提交、工作流参数或聊天中传递秘密。数据库秘密只写入 GitHub Actions Secrets。
- Windows、Debian、Fedora 自托管运行器必须是可重建的专用验收机，不得与开发者日常账号或生产网络共用。
- CI 验证八个 Skill 目标是否写入预期目录，以及安装元数据、版本和内容哈希是否一致。全部目标状态为 `current` 即视为 Agent Skill 验收通过；无需安装、启动、登录或实际打开对应 Agent。

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

当前自动验收连接会明确保存 `trustServerCertificate=true`，用于兼容隔离测试库的自签名证书；
连接仍然加密，但不验证服务器身份。若配置 `DATAPULL_CI_SQLSERVER_CA_CERT` 并希望验证证书链，
应移除验收脚本中的 `--trust-server-certificate` 后运行。

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
5. 审查八个 Skill 目标的预期路径、安装或更新结果、版本与内容哈希，并把 `skillInstallationVerified:true` 的证据录入 `resources/compatibility-matrix.json`。
6. 执行 `npm run release:check`；只有数据库、平台 NPM 安装与 Skill 安装回验矩阵完整时才可进入发布。

## npm OIDC 自动发布

`@yg-toolkit/datapull` 已使用 NPM Trusted Publishing 绑定 GitHub Actions。正常发布不需要
`npm login`、OTP、通行密钥或长期写 Token；GitHub 为每次任务签发短期 OIDC 身份，NPM 自动生成
provenance。

当前信任配置是发布契约，字段区分大小写：

| 字段 | 值 |
|---|---|
| Provider | GitHub Actions |
| Organization or user | `phoben` |
| Repository | `agent-skills` |
| Workflow filename | `datapull-publish.yml` |
| Environment | 留空 |
| Allowed actions | 允许直接 `npm publish` |

工作流必须位于 `.github/workflows/datapull-publish.yml`，使用 GitHub 托管运行器，并保留
`id-token: write` 和 `contents: read`。NPM OIDC 要求 Node.js `>=22.14.0` 与 npm `>=11.5.1`；
发布任务固定使用 Node.js 24 和 npm 11.5.1。`package.json` 中的 `repository.url` 必须继续精确指向
`https://github.com/phoben/agent-skills`。

### 发布一个新版本

1. 更新 `cli/datapull/package.json` 和锁文件中的版本并完成对应功能验收。
2. 运行本地门禁与 `npm run release:check`。
3. 提交并推送版本变更，确认目标提交已经位于 `origin/main`。
4. 创建并推送与包版本一致的标签：

```bash
git tag -a datapull-v0.1.2 -m "发布 @yg-toolkit/datapull 0.1.2"
git push origin datapull-v0.1.2
```

5. 观察“DataPull 发布 npm 包”工作流。只有工作流成功、公开 registry 返回新版本且空目录安装执行通过，才能宣布完成：

```bash
npm view @yg-toolkit/datapull version --registry=https://registry.npmjs.org
npx --yes --package=@yg-toolkit/datapull@0.1.2 datapull --version
```

发布标签只承担发布触发职责，不替代版本提交。禁止在包版本未更新时复用或强推旧标签。

### 常见失败与恢复

- `ENEEDAUTH`：优先核对 NPM Trusted Publisher 的仓库名、工作流文件名和 Environment 是否与触发工作流完全一致，并确认工作流有 `id-token: write`；不要改回长期 Token。
- `EOTP`：说明正在走手工发布或 OIDC 未被识别。`npm login` 不会免除逐次发布 2FA，`/auth/cli/` 链接在原进程退出后可能 404。
- 标签版本不一致：工作流会在上传前失败。删除尚未发布的错误远端标签，修正版本后创建正确标签；已经发布的版本不可覆盖。
- 工作流成功但 registry 暂无新版本：检查日志是否出现 `+ @yg-toolkit/datapull@<版本>`、签名 provenance 和“正在处理”提示。NPM 可能需要数分钟完成处理，应轮询 registry，不能立即重复发布。
- 版本已经存在：递增版本、重新验收并创建新标签；NPM 不允许覆盖同名版本。
- 工作流重命名或仓库迁移：NPM 上现有 Trusted Publisher 连接不可原地编辑，先新增或删除后重建对应连接，再触发发布。

首次 OIDC 发布已由 `datapull-v0.1.1` 验证通过。确认 OIDC 稳定后，Publishing access 应保持
“Require two-factor authentication and disallow bypass 2FA tokens”，并撤销不再使用的自动化写 Token；
该限制不会阻止 Trusted Publisher。
