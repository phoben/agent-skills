# P0 独立检查

日期：2026-11-03。检查范围为新包、独立插件产物、marketplace 条目和适用规范。未提交、推送、安装插件、自动操作 Codex UI、发送真实聊天或写入 GitHub。

## 已修复

1. **页面重建后无法继续关联。** 原实现虽然持久化请求，页面只能从内存取得 request ID，打开草稿再返回侧栏可能丢失检查入口。新增 `tasks.latest` 与 app-only、只读 `issue-proof-task-latest`，仅恢复当前身份、仓库、工作区、cwd 和项目一致的最新自有请求，不读取聊天。
2. **恢复请求的异步竞争。** UI 在收到仓库上下文或切换工作区后恢复状态，使用上下文与请求修订号阻止旧恢复覆盖新准备请求、切换后的仓库或新工作区；已确认请求也可恢复。刷新导致原工作区消失时清理旧请求显示。
3. **宿主关闭后按钮仍可操作。** 关闭时清除请求显示、禁用动作并失效在途恢复，迟到响应不能重新启用旧请求。
4. **已关联检查的身份复核缺口。** 已知关联在目录复核后补查身份，避免复核期间切换账号后返回旧关联。

主要位置：`src/tasks.mjs:47`、`:75`、`:113`，`src/server.mjs:35`，`ui/app.mjs:10`、`:54`。README 已说明返回页面后的恢复步骤。单元测试验证服务重建后恢复、身份/仓库/工作区隔离、继续关联并返回；UI 模块测试验证页面重建、恢复竞争和连接关闭。

## 未修复与验收边界

- P0 JSON 状态只有单进程队列，没有跨进程写事务；本阶段按已明确的单实例技术点检使用。P1 应按已确认 SQLite 方案实施并验证多进程并发，本次不改存储架构。
- 当前只检查注册 roots 的直接 Git 仓库，不扫描子目录；代码及 README 显示 partial，不能宣称完整发现所有仓库。
- 原生侧栏实际渲染、项目完整覆盖对照、草稿保护和真实发送后的会话关联/返回仍待用户点检；代码、fixture、包外协议与独立 App Server 发现都不能代替这些结果。
- 账号或配置文件变化会使旧身份指纹失效，属于 P0 的保守拒绝策略；不自动放行旧请求。长期产品状态应在 P1/P4 中保持已确认的账号隔离要求。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| `npm --prefix packages/issue-hub test` | 21 项通过，无失败、跳过或取消。 |
| `npm --prefix packages/issue-hub run check` | 18 个 JavaScript 模块语法检查通过。未配置完整 lint，不称为 lint 或 TypeScript 类型检查。 |
| `npm --prefix packages/issue-hub run build` | 0.1.1 自包含构建通过，内联脚本可解析，依赖许可齐备。 |
| `npm --prefix packages/issue-hub run verify:stdio` | 从包外启动，恰好 2 个仓库入口、资源可读、非法参数拒绝；desktopVerified=false。 |
| `git diff --check` | 通过；没有更改既有 Tokens 源码或产物。 |

新增恢复工具后总工具数为 8；仓库入口为 2、global 项为 3。源码与产物冻结在 0.1.1，主 Agent 负责后续安装和缓存哈希核对。

## 构建产物 SHA-256

- `issue-hub.cjs`：`3A3C869923DC8FB850EEFE11F43F158BEBA7BED15AF278BCD210783B1D47D66D`
- `host-proof.html`：`573C3E57F90FB3BCA9A749A380F0A7C6228135033A6E51AAD38AE778A40DB0A9`
- `THIRD-PARTY-LICENSES.txt`：`8D5E11BCE493EF95A0813190B12A3A3DE92E9B55B82F2229800B7E7179C5A73D`
