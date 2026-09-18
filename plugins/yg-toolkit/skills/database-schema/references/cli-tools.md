# 数据库 CLI 与异常处理

核心提取必须通过数据库官方 CLI 或官方脚本对象模型完成。执行安装前先查看当前平台的官方说明和现有包管理器；安装会修改用户环境，必须获得用户确认。

## MySQL

- 必需：`mysql`
- 结构来源：`INFORMATION_SCHEMA` 与 `SHOW CREATE ...`
- 密码传递：权限受限的临时 `[client]` option file；不得使用命令行密码参数
- 官方参考：[MySQL client options](https://dev.mysql.com/doc/refman/8.4/en/mysql-command-options.html)、[Using option files](https://dev.mysql.com/doc/refman/8.4/en/option-files.html)

常见安装包是 MySQL Client 或 MySQL Shell 所属发行包。若本机安装困难，可在用户批准后评估官方 MySQL 容器；使用容器前必须确认目标主机从容器网络可达，不能把 `localhost` 原样解释为宿主机。

## PostgreSQL

- 必需：`psql`、`pg_dump`
- 结构来源：系统目录、`pg_get_*def` 与逐对象 `pg_dump --schema-only`
- 密码传递：仅注入子进程的 `PGPASSWORD`
- 官方参考：[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)、[psql](https://www.postgresql.org/docs/current/app-psql.html)

两个程序必须来自兼容版本的 PostgreSQL 客户端包。若版本低于服务端并导致导出失败，升级客户端，不要降低校验或跳过对象。

## SQL Server

- 必需：`sqlcmd`、PowerShell，以及 PowerShell `SqlServer` 模块
- 结构来源：`sqlcmd` 连接预检与官方 SMO `Scripter`
- 密码传递：仅注入子进程的 `SQLCMDPASSWORD` 和临时内部环境变量，不得使用 `-P`
- 官方参考：[sqlcmd](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility)、[SMO scripting](https://learn.microsoft.com/sql/relational-databases/server-management-objects-smo/tasks/scripting)

缺少模块时，在用户确认后使用 `Install-Module SqlServer -Scope CurrentUser`。Linux 或 macOS 还需 PowerShell 7。SMO 无法使用时，可以建议安装官方模块或在受控环境使用 SQL Server 工具容器；不要用不完整的手写表定义冒充完整快照。

SQL Server 默认加密并严格验证服务器证书。若 `last-run.json` 返回 `errorCode: SQLSERVER_TLS_CERTIFICATE_UNTRUSTED`：

1. 停止自动重试，保留旧快照；这不是密码错误。
2. 正式、生产或公网连接优先修复服务器证书或本机 CA 链。
3. 仅在用户明确批准后，才对目标连接设置 `trustServerCertificate: true`，保持 `encrypt: true` 并重试一次。用户只批准单次导出时，无论成功或失败都恢复原配置；只有连接级批准才保留设置。
4. 成功结果必须披露服务器身份未校验，并说明配置是否已恢复；不得把关闭加密作为自动回退。

## 统一失败策略

1. 先报告缺少的可执行文件或模块，不修改旧快照。
2. 给出官方文档和适合当前平台的安装方向，请求用户确认后再安装。
3. 安装不可行时，评估已有 Docker；使用前说明镜像下载、网络与认证影响。
4. 任一对象无法读取、CLI 返回非零或输出为空时，本数据库本次导出失败。
5. 导出失败时保留该连接别名与数据库名下的上一份完整快照，并返回非零状态。
