---
name: datapull
description: 使用 DataPull CLI 安全导出 MySQL、PostgreSQL 或 SQL Server 的 DDL 结构文件；适用于数据库结构快照、环境诊断、连接登记、对象范围选择和导出异常恢复。
---

# DataPull

通过 DataPull CLI 读取数据库逻辑结构，按对象保存 SQL 文件。Skill 负责目标解析、安全调用和结果验收；连接、凭证、官方工具适配与文件事务由 CLI 维护。

只导出结构，不导出表内业务数据、用户、角色、授权、密码或服务器级配置。数据库事件可作为引擎支持的结构对象导出。使用具备目标对象元数据与定义读取权限的账户；连接测试成功不代表具备全部对象权限。

## 环境检查

1. 检查 Node.js 是否为 `>=22.12`、NPM 是否可用、`datapull --version` 是否成功。
2. CLI 缺失时，提供 `npm install --global @yg-toolkit/datapull`，由用户亲自执行全局安装。
3. CLI 可执行后运行 `datapull doctor --json`。同时检查 `healthy` 与每项 `checks[].ok`；退出码为零和 `ok:true` 不代表所有诊断通过。按目标引擎处理工具缺失，其他引擎工具缺失不阻止当前任务。

安装或下载数据库工具前，向用户说明 CLI 返回的 `actionPlan.installation` 中的工具、来源、命令、权限和下载影响。已有授权覆盖该安装计划时直接继续；否则获得明确授权后，才在下一次调用中加入 `--install-missing --yes`。无法安装或读取对象时停止，保留错误和旧文件。

## 连接与凭证

`datapull connection list --json` 列出脱敏登记连接。连接别名描述服务器、认证和安全策略；数据库名是每次拉取单独指定的真实名称，二者不得混用。别名必须精确匹配，不能用数据库名或模糊子串代替。

尚未登记连接时，让用户在自己的交互终端运行 `datapull connection add`。CLI 隐藏输入秘密并校验连接，成功后可输入目标数据库名立即拉取全部支持的对象。临时运行可使用 `npx --yes --package=@yg-toolkit/datapull@latest datapull connection add`；说明首次运行会下载 NPM 包。Agent 的自动化调用使用子命令与 `--json`，不代填隐藏输入。

密码和含秘密 URL 只由用户在 CLI 隐藏输入中填写，或手工更新 CLI 显示的 `credentials.env`。不读取该文件，不在聊天中索要、复述或传递秘密，不把秘密放入命令参数。连接与凭证由 CLI 在用户目录保存，不复制到项目、Skill 目录或 Git。

## 确定目标并拉取

- 用户明确提供连接别名和数据库名时直接使用；缺少的信息可从当前任务上下文或 CLI 脱敏结果确定，无法唯一确定时再询问。
- 需要发现数据库时运行 `datapull database list --connection <alias> --json`。检查 `enumerationError`；收藏或最近使用项不证明数据库当前可访问。
- 用户要求完整结构、结构快照或未限定对象类型时，省略 `--include`，拉取当前引擎支持的全部类型。用户明确要求部分类型时，用逗号分隔的 `--include <types>`；范围含糊且会影响覆盖结果时再询问。对象类型以当前 CLI 的帮助与校验回执为准。
- Git 项目以 Git 顶层目录为根，非 Git 项目使用当前工作目录。运行前说明连接别名、数据库名、对象范围与项目根；目标明确且已授权时直接执行，无需重复确认。

全部结构：

```bash
datapull pull --connection <alias> --database <database> --yes --json
```

只更新指定类型：

```bash
datapull pull --connection <alias> --database <database> --include table,view --yes --json
```

输出固定在 `.database-schema/<连接别名>/<数据库名>/<对象类型>/[schema/]<对象>.sql`。CLI 处理跨平台文件名与同名、重载冲突；Agent 不自行生成 DDL 或改写目录结构。

本次所选类型作为一个文件事务整体替换，清除这些类型中已删除对象的旧文件；未选类型保持原样。任一对象读取或校验失败即本次失败，不跳过无权读取的对象。清理与异常中断恢复由 CLI 处理；遇到锁或回滚错误，保留现场并按回执恢复，不手工删除其他运行的锁、备份或临时文件。

## SQL Server 证书异常

返回 `SQLSERVER_TLS_CERTIFICATE_UNTRUSTED` 时停止自动重试。说明传输仍可加密，但信任服务器证书会失去服务器身份验证。正式、生产或公网连接优先修复可信证书或本机 CA 链。

只有用户明确选择后，才执行对应操作；已有授权仅适用于其指定连接和范围：

- 安装可信 CA：说明证书来源与系统信任变更，按用户批准的方案处理，再保持严格校验重试。
- 仅本次信任：在 `connection test`、`database list` 或 `pull` 中加入 `--trust-server-certificate --yes`；这是单次覆盖，不修改保存的连接。
- 保存到连接：`datapull connection update --alias <alias> --trust-server-certificate --yes --json`。
- 恢复验证：`datapull connection update --alias <alias> --verify-server-certificate --yes --json`。

始终保持加密，不以关闭加密解决证书异常。使用信任模式成功后，明确说明“传输已加密，但服务器身份未校验”，以及本次未修改保存配置或连接将持续保留信任设置。

## 验收与失败处理

只有同时满足以下条件，才报告拉取成功：

- CLI 退出码为零，JSON 中 `ok:true`；`connectionAlias`、`database`、`projectRoot` 和 `outputPath` 与目标一致。
- `updatedTypes` 与请求范围一致，`preservedTypes` 只表示未选类型，不能宣称这些类型本次也已刷新。
- 按 `objectCounts` 逐个核对本次更新类型中的 SQL 文件数，包含 schema 子目录；文件存在且非空。零对象允许零文件，不伪造对象。
- 解释 `warnings`；锁或清理警告应作为待处理事项保留。检查 SQL Server 的安全警告，披露未校验服务器身份及其生效范围。
- 检查输出与回执不含凭证；如发现疑似泄露，停止传播，不复述秘密值。

DataPull 不生成旧版 `manifest.json` 或 `last-run.json`，不以这些文件作为验收条件。失败时保留稳定 `error.code`（数据库枚举还需检查 `enumerationError.code`），依据回执和 `--help` 给出下一条恢复命令。CLI 已负责有限的只读瞬态重试；Agent 不额外循环重试认证、权限、TLS、SQL 或解析错误。

完成汇报区分本地静态/模拟测试、CLI 可执行、连接成功和真实结构文件验收；部分类型更新只报告该范围。旧 `database-schema` 的连接配置与快照不会自动迁移，首次切换需通过 CLI 登记连接；保留项目中已有旧文件。
