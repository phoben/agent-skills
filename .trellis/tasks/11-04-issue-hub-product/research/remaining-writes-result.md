# 已确认写入的同请求重放

本轮范围仅 Issue 服务与回执回归。修复前运行：

`node --test --test-name-pattern='已确认Issue编辑|已确认本人评论编辑|已确认状态变更' packages/issue-hub/test/issues-product.test.mjs`

三项均因 CONFLICT 失败：Issue 编辑与关闭状态命中旧 revision，评论编辑命中旧 expectedText。第一次真实服务替身写入和读回已成功，第二次尚未走到 confirmed 回执判断。这准确复现用户已确认操作误报冲突，不涉及真实 GitHub 写入。

根因是回执摘要依赖写前计算的 PATCH 差异，且查询位于基线比较之后。拟将原始受校验请求的摘要与远端 PATCH 摘要分开，已确认的相同请求在当前身份、仓库与对象权限核验后、旧基线比较前恢复回执。不同内容继续拒绝；未知与在途状态不重投。旧回执只在已有摘要与确认投影足以证明同一请求时兼容，无法证明时保留拒绝。

## 实现结果

仅修改 `src/services/issues.mjs` 与 `test/issues-product.test.mjs`。新增 requestSignature 保存原始请求摘要（对象字段排序后散列），保留原 signature 作为实际 PATCH 与未知写入去重摘要。新字段与所有 pending/unknown/rejected/readback-failed/confirmed 状态一同保存，不保存请求内容原文。

confirmed 重放依次经过现有严格 gh 身份、expectedIdentity、当前发现仓库绑定、最新仓库权限、Issue 编辑权限或评论父 Issue/本人作者检查；只有同仓库、同动作、同原始输入摘要才在旧 revision/expectedText 比较前恢复原确认。响应额外 `data.replayed:true`，原 `operation` 是历史回执；经下方真实验收修订，`issue` 必须重新只读取得最新投影，不能用历史快照回退后续写入基线。新请求仍比较当前基线；不相同的已确认请求返回 OPERATION_REUSED。

0.2.4 已存在的旧回执不含 requestSignature。评论可用原 signature 直接证明原 number/commentId/正文/expectedText；Issue 则以 verification 修改字段、原 revision、原 signature 与确认投影核对所有本次提交字段。连原本未变化的字段也不能借旧回执偷偷更改；无法证明一致则拒绝，未猜测补齐旧请求。

账号隔离继续使用现有 scope，并拒绝旧页面 expectedIdentity 到新账号，不跨 scope 读取或返回别人的回执。没有增加全局跨账号 UUID 索引，也未改变原有每账号 operationId 命名空间。

## 验证

- 原始三项复现从 CONFLICT 三红变为三绿。
- 同一原始请求不同对象属性顺序可重放；同 ID 不同内容、不同 Issue、不同仓库仍拒绝，新的 operationId 携带旧基线仍冲突。
- 匹配的回执也不能跳过当前 Issue 编辑权限或评论本人作者核对；旧账号预期身份不能带入新账号。
- 去掉 requestSignature 模拟旧版确认回执，Issue/评论相同请求可兼容，修改原先未变化的正文会拒绝。
- `node --test packages/issue-hub/test/issues-product.test.mjs`：32 项通过，包含既有未知创建、并发在途、读回失败、人工解除、离线草稿和身份隔离回归。
- `npm --prefix packages/issue-hub run check`：40 个 JavaScript 模块语法检查通过；不称完整 lint 或类型检查。

本轮没有真实 GitHub 写入、聊天打开、提交或推送。R4/R8/R9 的授权测试仓库真实写后读回、真实远端并发及断网后主动发布仍须按现有验收计划另行完成；本次隔离回归不替代它们。

## 真实验收后的状态冲突诊断

主会话随后获得“本项目仓库”真实写入授权，通过 LiveStore→MCP→gh 在 phoben/agent-skills 的 Issue #5 跑通新增、编辑与同操作重放、本人评论新增/编辑/重放。关闭阶段返回 CONFLICT，主会话读取新 revision 后清理关闭成功。真实结果见 [live-write-report-030.json](live-write-report-030.json)，本子代理没有再次发起真实请求。

只读本次验收 SQLite，使用 [inspect-live-state-030.mjs](inspect-live-state-030.mjs) 只输出时间/状态/字段摘要：编辑确认 revision 为06:26:26；评论新增为06:26:46；评论编辑回执创建于06:27:02.818，但其 Issue revision 仍为06:26:46，而评论自身 updatedAt 为06:27:02。编辑、评论新增、评论编辑和最终清理关闭的非状态可编辑字段摘要均为 e36e3630db8c。失败请求未保存 remote 投影，因此不能仅凭现有日志唯一断言是 GitHub 异步推进更新时间还是旧回执替换了新投影；源码确认已确认评论重放会在读取当前 raw 后返回旧 prior.issue，确实存在后者的数据流。

修复前新增并运行 `node --test --test-name-pattern='评论仅推进|关闭仅改state|confirmed重放保留历史' packages/issue-hub/test/issues-product.test.mjs`，三项准确变红：评论只推进 updatedAt 即使 state 未变也阻止关闭/重开；其他字段变化被状态操作的全局 revision 拦截；confirmed 重放仍返回旧 revision。先向主会话报告证据与最小方案，尚未扩大为通用字段合并策略。

主会话随后明确批准以下最小修复，已完成：

- 只有 `change-state` 专用入口用“目标状态的相反状态”作为隐式基线。当前 state 未变即可只 PATCH state，保留其他成员最新标题/正文/标签等字段；当前状态已不等于基线则返回 CONFLICT。先识别 confirmed 同请求再比较状态，避免已成功关闭的同 ID 重放被当前 closed 错拦。普通 `save-issue` 的 revision 比较保持严格，不扩大为通用字段合并。
- confirmed 重放保留原历史 operation，执行完整的最新只读 read 后返回 `issue` 与 `projectionFresh:true`。网络等读取失败返回 `issue:null`、原 operation 仍 confirmed、`replayed:true`、`projectionFresh:false` 与安全 readbackWarning；不会降为 unknown，不重新发布。身份变化、401、403、404仍按原安全错误拒绝，不借回执输出旧投影。
- `operation-resolve` 的 readback 允许 confirmed：只读获取当前 Issue，不再要求后续合法编辑符合历史 verification。原先 readback-failed 的首次真实字段/评论 ID 核验完全保留。

原三红已绿，新增读回失败保留 confirmed、后续合法编辑的纯只读恢复、刷新在途身份变化回归。最终 `node --test packages/issue-hub/test/issues-product.test.mjs` 37项通过，`npm --prefix packages/issue-hub run check` 45模块语法检查通过。源码已冻结给独立检查代理；主会话只复用 Issue #5 补验状态和属性清理，本代理没有发送真实 GitHub 请求或打开聊天。

此状态基线比较仍不等于 GitHub 原子 CAS，也不判断 UI 读取后是否发生过关闭再重开的状态往返；本次按主会话批准范围只拦当前 state 已不同的情况，不扩展时间线并发协议。
