# 0.1.3 单主入口纠正

日期：2026-11-03。按用户澄清及主 Agent 的最小修复任务执行。本轮仅修改 Issue Hub 包、独立插件产物和本记录，没有安装、操作桌面、发送聊天、写 GitHub、提交或推送；不改旧验收历史。

## 问题与范围

用户要求一个插件图标展开 Codex 原生悬浮左栏，类似首页、资料空间、定时任务和代码审查。旧版给状态页和两个仓库工具都声明 global，导致三个主图标；旧测试保护了错误的目标。

本修复只消除错误多主入口。没有新增原生浮层契约、内置 API 桥接或页面内仓库导航，不能宣称所需浮层已实现。

## 红灯复现

先只修改 `test/server.test.mjs`，执行 `node --test test/server.test.mjs`，退出码 1、2 项失败：

- 预期 global 只有 `issue-proof-status`，实际数组还有 `issue-proof-open-aaaaaaaaaaaaaaaaaaaa`、`issue-proof-open-bbbbbbbbbbbbbbbbbbbb`，恰好 3 项。
- 空目录初始一个主入口，但刷新到有仓库后变成 2 项，违反主入口数量不随诊断工具变化的约束。

上述仓库键为隔离测试 fixture，不是用户真实仓库数据。

## 修复

- 仅 `issue-proof-status` 带 global 元数据，标题为 Issue Hub。
- 动态仓库工具保留 app-only 和绑定上下文，移除 global 元数据；目录刷新仍可通知诊断工具集合变化，但不再生成仓库主图标。
- 删除误导字段 `sidebarEntries`、`entryLimit`，改为 `primaryEntrypoints`、`diagnosticRepositoryTools`、`diagnosticToolLimit` 和 `nativeFlyoutStatus: unverified`。
- 保留 `ISSUE_HUB_P0_MAX_ENTRIES` 配置名，仅限制诊断工具数，主入口恒为 1；README、UI 诊断说明与插件描述同步纠正。
- 保留受限 RPC、身份复核、请求恢复、nonce 关联和已有聊天定位代码，不改变其授权或候选读取范围。
- package、lock、版本模块、便携/兼容清单统一 0.1.3；重新生成自包含服务、内联页面与第三方许可。

## 绿灯验证

| 命令 | 实际结果 |
| --- | --- |
| `node --test test/server.test.mjs` | 修复后 2 项通过，覆盖不同目录、空目录、刷新及诊断上限变化，global 始终只有 1。 |
| `npm install --package-lock-only --ignore-scripts --offline` | 更新本包锁文件版本，退出码 0。 |
| `npm test` | 22 项全部通过；已有 RPC、身份、持久请求恢复、UI 竞争及 nonce 测试保持通过。 |
| `npm run check` | 18 个 JavaScript 模块语法检查通过，不称 TypeScript 类型检查。 |
| `npm run build` | 0.1.3 自包含产物构建成功。 |
| `npm run verify:stdio` | 包外实际检查恰好 1 global、2 app-only 非 global 仓库诊断工具、UI 资源和非法参数拒绝，退出码 0。 |
| 版本一致性及 `git diff --check` | 清单、package、lock 根记录版本一致，差异格式检查通过。 |

包外验证摘要：

```json
{"packageOutsideWorkspace":true,"primaryEntrypoints":1,"diagnosticRepositoryTools":2,"nativeFlyoutStatus":"unverified","uiResource":true,"invalidArgumentsRejected":true,"desktopVerified":false}
```

## 未完成的需求

原生悬浮仓库导航仍未接入，P0 的 V3 不通过。待取得可核验的第三方契约后，才可实现和点检仓库子项。单 global、app-only 工具和 MCP 清单通知都不是该契约的替代证据。

最终安装、真实宿主发现及缓存哈希由主 Agent 后续执行；本记录不将构建版本自动等同于已安装版本，也不将协议结果等同于桌面表现。
