---
name: datapull
description: 检查并指导安装 DataPull CLI，使用已登记连接拉取 MySQL、PostgreSQL 或 SQL Server 的结构文件；适用于环境诊断、连接选择、对象范围确认和 CLI 错误恢复，不替代 CLI 管理凭证或生成 DDL。
---

# DataPull

把 DataPull CLI 作为唯一执行入口。本 Skill 负责环境检查、安装指导和安全调用，不实现连接管理、依赖安装或结构文件生成。

## 环境门

1. 检查 Node.js 是否为 `>=22.12`、NPM 是否可用、`datapull --version` 是否成功。
2. CLI 缺失时，只向用户提供 `npm install --global @yg-toolkit/datapull`；由用户亲自执行，不代替用户进行全局安装。
3. CLI 存在时执行 `datapull doctor --json`，依据退出码和 `error.code` 给出下一条恢复命令。环境门完成的标准是 CLI 可执行且诊断结果已被解释。

## 调用流程

优先使用带 `--json` 的命令模式：

- `datapull connection list --json`：列出脱敏登记连接。
- `datapull database list --connection <alias> --json`：读取收藏、最近使用和可访问数据库。
- `datapull pull --connection <alias> --database <database> --include <types> --yes --json`：拉取结构文件。

人类用户要在一次终端会话中新增连接并立即拉取时，运行 `datapull connection add`。CLI 会通过隐藏输入登记秘密、校验工具与连接，然后询问是否立即拉取；用户同意并输入目标数据库名后，默认获取该引擎支持的全部结构对象。通过 NPM 临时运行时使用 `npx --yes --package=@yg-toolkit/datapull@latest datapull connection add`。该交互便捷流程不改变 `--json` 的非交互契约。

执行拉取前向用户说明连接别名、目标数据库、对象类型和当前项目根。任一值无法从用户请求或 CLI 脱敏结果唯一确定时，停在该步骤并请用户决定；不猜测连接、数据库或对象范围。

当 CLI 返回缺少工具时，说明 `actionPlan.installation` 中的工具、来源、命令、权限与下载影响。只有用户明确要求执行该安装计划后，才在下一次 CLI 调用中加入 `--install-missing --yes`。

当 SQL Server 返回 `SQLSERVER_TLS_CERTIFICATE_UNTRUSTED` 时，说明连接仍可保持加密，但信任服务器证书会失去服务器身份验证并带来中间人攻击风险。由用户在“安装可信 CA”“仅本次信任”“保存到该连接”中决定；只有用户明确选择后，才分别调用：

- 仅本次：在 `connection test`、`database list` 或 `pull` 中加入 `--trust-server-certificate --yes`。
- 保存：`datapull connection update --alias <alias> --trust-server-certificate --yes --json`。
- 恢复验证：`datapull connection update --alias <alias> --verify-server-certificate --yes --json`。

Agent 不替用户选择信任证书，也不把测试环境的放宽策略推广到其他连接。

## 秘密边界

数据库密码或含秘密 URL 只由用户在 CLI 隐藏输入中填写，或手工更新 CLI 显示的 `credentials.env`。不要在聊天中索要、复述或传递秘密，不读取该文件内容，也不把秘密放入命令参数。

## 完成标准

只有在 CLI 退出码为零、JSON 中 `ok:true`，且 `outputPath`、`updatedTypes`、`preservedTypes` 与用户目标一致时，才报告拉取成功。失败时原样保留稳定 `error.code`，给出一条对应的恢复命令，并区分本地契约验证与真实数据库拉取结果。
