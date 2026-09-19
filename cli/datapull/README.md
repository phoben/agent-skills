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

# 安装到所有兼容 .agents/skills 的项目级共享目录
datapull skill install --target universal:project --yes

# 也可明确选择 OpenCode、Trae CN 等平台
datapull skill install --target opencode:user --target trae-cn:user --yes
```

完整命令族包括 `connection add|list|show|update|remove|test`、`database list|favorite add|favorite remove`、`pull`、`skill install|list|status|sync`、`config path|validate` 和 `doctor`。

## Agent 平台

DataPull 的平台注册表基于 `vercel-labs/skills` v1.7.0，识别该快照中的 79 个 ID（含内部 `universal` 目标）。`datapull skill list` 可查看当前版本接受的平台、范围和实际目录；`claude-code` 同时作为现有 `claude` ID 的兼容别名。

首次运行向导会读取本机配置痕迹来缩短选择过程，但不会把“存在配置目录”描述为 Agent 已安装或可运行。项目级安装默认写入 `.agents/skills/datapull` 一次，供 Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode 等共享该目录的平台读取；Claude Code、Trae、Windsurf 等专属目录按需添加。用户级目录不会套用项目共享规则，会分别遵循 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`、XDG 或各平台的用户目录约定。

平台注册表来自上游路径契约和本地路径测试，不等于所有 Agent 都已完成真实运行时验收。发布兼容矩阵仍单独记录已在目标操作系统完成落盘、元数据和内容哈希回验的组合。设计来源与取舍见 [Vercel `skills` 平台选择与 UI 调研](../../docs/research/2026-09-19-vercel-skills-agent-targets-and-ui.md)。

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

`npm run release:check` 验证 `resources/compatibility-matrix.json` 是否已经包含三种数据库、五类操作系统、NPM 安装及八个既有 Skill 目标的真实通过记录。Skill 位于预期目录，且安装元数据、版本与内容哈希回验一致，即视为该目标的 Agent Skill 落盘验收通过；无需启动或实际打开 Agent。新注册平台在进入发布兼容声明前仍须补充真实平台记录；开发包的空矩阵会阻止公开发布，不能用本地单元测试替代真实数据库或跨平台验收。

跨平台验收使用仓库的“DataPull 兼容性验收”GitHub Actions 工作流。远程数据库、Actions Secrets、自托管运行器和取证步骤见 [兼容性与发布 CI](https://github.com/phoben/agent-skills/blob/main/cli/datapull/docs/release-ci.md)。

后续新增命令、数据库引擎、对象类型、Agent 目标或配置版本前，请先阅读 [维护者指南](https://github.com/phoben/agent-skills/blob/main/cli/datapull/docs/maintenance.md)。NPM 版本通过 Trusted Publishing 与 `datapull-v*` 标签自动发布，不使用长期写 Token。
