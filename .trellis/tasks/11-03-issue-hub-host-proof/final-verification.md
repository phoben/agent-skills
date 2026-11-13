# P0 当前交付状态

更新：用户已确认 0.1.2 出现三个主图标，指出真正目标为内置项那样的原生悬浮侧栏。因此旧双入口测试只作为历史协议证据，不证明目标导航已满足。0.1.3 已修正为单主入口；原生浮层 API 仍未找到通用契约。详见 [专项调查](../11-03-github-issue-plugin/research/native-flyout-correction.md)。

日期：2026-11-03。用户已授权设计完成后直接实施；本任务已进入 `in_progress`，尚未满足全部真实宿主验收，不归档、不提交、不推送。

## 当前版本 0.1.3

- 只有 issue-proof-status 一个 global，标题 Issue Hub；两个仓库工具为 app-only 非 global，不产生主图标，不被称作原生子项。
- 新回归在旧源码两项均失败，修后独立检查 22 项测试、18 模块语法、构建、包外检查通过；刷新、空目录和不同上限也只有一个主入口。
- 主 Agent 实际执行 `codex plugin add issue-hub@yg --json` 安装 0.1.3，再通过新 App Server 发现 8 工具、1 global、2 个诊断仓库工具及 UI 资源。
- 8 个安装文件 SHA-256 均与当前仓库产物一致。当前证据：[安装发现](research/installed-host.json)、[哈希](research/installed-hashes.json)、[独立检查](check-single-entry-0.1.3.md)、[红绿记录](research/single-entry-fix-0.1.3.md)。
- desktopRenderingVerified=false、nativeFlyoutVerified=false。用户要的原生悬浮栏没有已证实的第三方接入契约，V3 未通过；不能要求用户验收错误的多个主图标来解除此限制。

以下内容保留此前过程，不能作为当前原生浮层实现证明。现阶段等待产品取舍或可核验的新宿主契约，不继续旧点检步骤。

## 代码与独立检查

已交付独立 `packages/issue-hub/`、`plugins/issue-hub/` 和 marketplace 新条目。包含项目读取、直接 Git 仓库目录、多仓库 global 入口、工作区草稿、唯一引用关联与返回已知聊天。

独立 Trellis 检查修复页面重建后恢复请求、迟到恢复结果覆盖新请求、连接关闭后仍可操作及已关联检查的最终身份复核。检查过程见 [check.md](check.md)，历史实现结果见 [verification.md](research/verification.md)。两份历史记录保留各自版本与当时状态，不冒充后续版本验收。

## 最终安装版本 0.1.2

0.1.0 为首次安装。0.1.1 同版本更新时，`codex plugin add` 返回“failed to back up plugin cache entry / 拒绝访问”，随后哈希检查发现服务和页面产物仍与仓库不同；不能因 App Server 能读取资源就判断缓存正确。原结果已保存在 `research/installed-hashes-0.1.1.json`。

主 Agent 将本包、锁文件、双清单和版本模块统一升为 0.1.2，重新构建后安装，避免继续覆盖已有版本缓存：

| 实际执行 | 结果 |
| --- | --- |
| `npm --prefix packages/issue-hub test` | 21 项通过，0 失败、跳过或取消。 |
| `npm --prefix packages/issue-hub run check` | 18 个 JavaScript 模块语法检查通过；没有声称独立 lint 或 TypeScript 类型检查。 |
| `npm --prefix packages/issue-hub run build` | 0.1.2 自包含服务、内联页面和第三方许可构建通过。 |
| `npm --prefix packages/issue-hub run verify:stdio` | 包外启动、恰好 2 个仓库入口、资源读取、非法参数拒绝通过；desktopVerified=false。 |
| `codex plugin add issue-hub@yg --json` | 0.1.2 安装成功，仅新增/更新 Issue Hub，不更改 YG Toolkit 的清单或产物。 |
| `node .trellis/tasks/11-03-issue-hub-host-proof/research/check-installed-host.mjs` | 真实独立 App Server 发现 0.1.2、8 个工具、2 个仓库入口、3 个 global 项，UI 资源可读；没有创建聊天。 |
| 安装缓存 SHA-256 核对 | 8 个文件全部与仓库一致，含双清单、MCP 配置、图标、许可、CJS、HTML 和第三方许可。 |

0.1.2 历史安装证据：[宿主发现](research/installed-host-0.1.2.json)、[文件哈希](research/installed-hashes-0.1.2.json)。现有 npm 用户配置会输出 home 未知配置提示，未改用户设置，命令成功退出。

## 仍未通过的门槛

- 原生侧栏真实渲染、点击后仓库上下文、动态增删和重连行为。
- 完整桌面项目对照；当前直接仓库发现只有 partial，不能宣称所有嵌套仓库均已发现。
- 两个工作区草稿准确预填、不自动发送、已有草稿不丢失。
- 用户发送后首条引用可读取、独立 App Server 索引可见、唯一关联及返回同一真实聊天。

真实只读计数为 22 项目、25 root、11 GitHub 仓库和 11 工作区绑定；分类及覆盖说明见历史实现记录。计数不是桌面对照证据。

P0 JSON 状态只用于单实例技术点检，多进程事务将在 P1 按 SQLite 方案实现；这不是已完成的生产存储。现有 Tokens 未修改。没有 GitHub 写入、自动聊天发送或正式产品 UI。

## 下一步

旧的 [真实桌面点检](desktop-checklist.md) 已暂停，不让用户重复验证多个主图标。当前需要原生浮层的第三方契约或用户明确变更交互范围；未经选择不改成页面内导航。U1 仍保留方向选择和原型确认，不重新请求整份方案开工批准。
