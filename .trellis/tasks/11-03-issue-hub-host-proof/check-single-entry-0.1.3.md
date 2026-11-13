# 0.1.3 单主入口独立复核

日期：2026-11-03。依据用户纠正后的 PRD、设计、实施清单、原生浮层专项调查和 Issue Hub 后端/前端规范复核。本记录不覆盖旧 check.md 或旧安装历史。

## 结论

未发现本轮单入口修正引入的局部正确性问题，无额外源码修复。检查者重新构建了 0.1.3 产物；后续安装和缓存哈希核对由主 Agent 执行，本轮没有安装、操作 Codex UI、读取真实聊天、写 GitHub、提交或推送。

已核对：

- 只有 `issue-proof-status` 声明 global，标题为 Issue Hub。
- 仓库诊断工具保留 app-only 与受绑定上下文，但没有 global 元数据；刷新、空目录与不同诊断上限不会增加主图标。
- 响应使用 `primaryEntrypoints`、`diagnosticRepositoryTools`、`diagnosticToolLimit` 和 `nativeFlyoutStatus: unverified`，不再输出 sidebarEntries 作为原生子项数量。
- 没有新增 children provider、虚构原生侧栏方法、内置插件身份或私有 first-party 桥接，也没有增加页面内仓库导航作为替代。
- RPC 白名单、目录及身份复核、nonce 唯一关联、持久请求恢复和异步作用域保护保留，相关回归继续通过。
- package、lock 顶层及根 package 记录、便携和兼容清单、源版本模块六处一致为 0.1.3。

## 实际验证

| 命令 | 结果 |
| --- | --- |
| `npm --prefix packages/issue-hub test` | 22 项通过，无失败、取消或跳过；包含单 global 在刷新、空目录和诊断上限变化时不变的回归。 |
| `npm --prefix packages/issue-hub run check` | 18 模块 JavaScript 语法检查通过；不是完整 lint 或 TypeScript 类型检查。 |
| `npm --prefix packages/issue-hub run build` | 自包含 0.1.3 构建通过。 |
| `npm --prefix packages/issue-hub run verify:stdio` | 包外启动通过，1 global、2 app-only 非 global 仓库诊断工具、UI 资源与非法参数检查通过。 |
| 版本一致性与 `git diff --check` | 通过。 |

包外结果明确保留 `nativeFlyoutStatus=unverified` 和 `desktopVerified=false`。

## 未满足的边界

用户要求的单图标原生悬浮仓库栏仍没有已证实的第三方接入契约，本轮只消除旧多主图标错误，不构成 P0 V3 通过，也不能据此宣布原生浮层已完成。没有契约前不能重新让用户验收旧多 global 布局或自绘替代布局。

原有 P0 的直接目录 partial 覆盖、单实例 JSON 存储及真实工作区草稿/聊天关联点检限制继续有效；本轮不扩大存储或正式管理功能范围。

## 冻结产物 SHA-256

- `issue-hub.cjs`：`191CE627F060701FAA98D21BC9ACA8E6825B63712146A983F7AC2FD148D7907A`
- `host-proof.html`：`E2EA34D12BA99612FE35308DB9123DEE24871EE091FDBA60DE94F46DBF85E6F2`
- `THIRD-PARTY-LICENSES.txt`：`8D5E11BCE493EF95A0813190B12A3A3DE92E9B55B82F2229800B7E7179C5A73D`
