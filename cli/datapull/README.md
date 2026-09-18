# DataPull

DataPull 是一款面向人类交互、同时提供稳定 Agent 自动化接口的数据库结构文件拉取 CLI。它将 MySQL、PostgreSQL 或 SQL Server 的 DDL 按对象保存到当前项目根目录的 `.database-schema/`，不拉取业务数据、用户、角色或授权。

## 安装

```bash
npm install --global @yg-toolkit/datapull
datapull
```

需要 Node.js `>=22.12`。只执行 `datapull` 会进入中文引导流程；NPM 安装生命周期不会启动交互、访问数据库或安装 Agent Skill。

## 常用命令

```bash
# 进入完整中文向导
datapull

# 查看脱敏连接
datapull connection list

# 拉取表和视图；连接必须已经登记
datapull pull --connection main --database app --include table,view --yes

# Agent 友好的机器可读输出
datapull pull --connection main --database app --include table,view --yes --json

# 为使用自签名证书的 SQL Server 保存显式信任设置
datapull connection update --alias sqlserver-dev --trust-server-certificate --yes

# 恢复严格证书验证
datapull connection update --alias sqlserver-dev --verify-server-certificate --yes

# 诊断环境，不自动安装
datapull doctor --json

# 为 Codex 用户级目录安装内置 Skill
datapull skill install --target codex:user --yes
```

完整命令族包括 `connection add|list|show|update|remove|test`、`database list|favorite add|favorite remove`、`pull`、`skill install|list|status|sync`、`config path|validate` 和 `doctor`。

## 配置和秘密

登记连接是当前操作系统用户的全局配置：

- Windows：`%APPDATA%/datapull/`
- macOS：`$HOME/Library/Application Support/datapull/`
- Linux：`${XDG_CONFIG_HOME:-$HOME/.config}/datapull/`

非秘密连接信息保存在 `config.json`，密码或完整含秘密 URL 保存在权限受限的 `credentials.env`。秘密只能通过交互式隐藏输入或用户手工编辑该文件写入；不要把密码放入命令参数。

SQL Server 始终启用传输加密并默认严格验证服务器证书。自签名或内部 CA 环境可在用户明确确认后，仅本次使用 `--trust-server-certificate --yes`，或把该设置保存到登记连接。该模式不会关闭加密，但无法验证服务器身份，适合已确认风险的开发、测试或受控内网；生产连接优先安装可信 CA，并保持严格验证。

## 覆盖规则

本次选择的对象类型作为一个文件事务整体更新；未选择类型原样保留。任一所选类型读取、生成、校验或提交失败时，所有所选类型保留上一次结果。进程异常终止后，下一次访问同一目标时会先执行持久化事务恢复。

SQL 文件默认可纳入 Git。DataPull 只在 `.database-schema/.gitignore` 中忽略临时目录、锁、事务日志和提交期备份，不修改项目根 `.gitignore`。

## 开发验证

```bash
npm install --ignore-scripts
npm run check
npm test
npm run build
npm run skill:check
```

`npm run release:check` 验证 `resources/compatibility-matrix.json` 是否已经包含三种数据库、五类操作系统、NPM 安装及八个 Skill 目标路径的真实通过记录。开发包的空矩阵会阻止公开发布，不能用本地单元测试替代真实数据库或跨平台验收。Agent 实际发现采用独立兼容性认证；未认证组合必须保留原因并标为计划兼容，不得宣称已支持。

跨平台验收使用仓库的“DataPull 兼容性验收”GitHub Actions 工作流。远程数据库、Actions Secrets、自托管运行器和取证步骤见 [兼容性 CI 说明](https://github.com/phoben/agent-skills/blob/main/cli/datapull/docs/release-ci.md)。
