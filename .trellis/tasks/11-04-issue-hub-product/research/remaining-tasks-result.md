# 任务与会话剩余功能实施结果

2026-11-04，按 root 明确范围实施审计五项；本记录覆盖服务与测试，前端接入、构建、安装及真实桌面结果由主会话统一记录。未打开/发送真实聊天，未读取真实聊天正文，未执行远端写入或提交推送。

## 实现与契约

- `src/host/bridge.mjs` 的持久身份改为带 v2 域标识的规范 codexHome 与可信 RPC accountId 散列。auth/config size/mtime 仍用于连接重建和拒绝旧在途/迟到结果，不再改变同账号的持久归属。`identity()` 返回稳定字符串；新增内部 `identityDetails()` 返回 `{identity,legacyIdentity,version:2}`，不返回 accountId、凭据或路径。
- 同文件导出 `resolveCodexCommand({codexBin=env,resolver?}={})`，复用显式绝对可执行路径验证和默认 Codex 查找。bridge 原 `commandResolver` 测试注入继续有效；root 诊断服务可调用相同入口，不必重复解析逻辑。
- `src/services/issue-tasks.mjs` 只在当前可信身份可精确重建的 legacy scope 内兼容请求、索引和绑定。事务核对归属、索引及请求一致性，保留旧记录，已有新当前请求优先，旧请求追加到历史；迁移回执保证幂等。旧 draft/prepared 导入为 open-unconfirmed，requested 保持 requested，不因升级再次打开。
- `bind` 仍只更新后续新任务的默认绑定；已有请求保留原路径，返回已关联会话仍复核原工作区。前端可独立调用 bind 修改有效绑定，无需生成新任务。
- 新动作 `open-history` 参数 `{repositoryKey,number,requestId,expectedIdentity}`。requestId 必须属于当前 Issue、当前双身份的历史索引且已经 linked；服务复核已发现工作区和真实 thread 的 cwd/projectId 后，打开不带 prompt 的 threads 深链，不改当前任务索引。任意 UUID 或其他 Issue 请求在读取会话前即被拒绝。
- 新动作 `resolve` 参数 `{requestId,threadId,confirmed:true,expectedIdentity}`。threadId 只能来自此自有请求上由 check 持久保存的完整 nonce 候选。选择时再读真实 thread 及初始用户项，核对 cwd/projectId、首条完整引用和当前双身份；事务内重验候选与已有绑定，避免两个窗口选择不同候选互相覆盖。只持久关联，不自动打开/发送，来源标为 user-confirmed。
- check 的自动关联仍要求完整覆盖且唯一匹配。多匹配为 ambiguous；部分覆盖中已有完整 nonce 候选时保持 pending，可供成员明确核对，不自动认领。候选仅含 threadId/title/createdAt/workspaceKey/path/projectName，不存用户消息正文。
- current 新增 `reference`（实际 `taskMarker(nonce)` 完整首行）、`associationSource`（automatic/user-confirmed/null）与 `candidates`；历史项也有 reference。正常 data 仍为 `{current,history,binding,workspaces}`，open-history 可加 navigation 字段。新动作已通知 root 和前端加入固定枚举及交互。

## 兼容边界

旧 0.2.4 只保存不可逆指纹身份，没有可据以认领任意历史 scope 的稳定账户证据。本轮不列举其他 scope、不按相同项目或 GitHub 账号猜认、不删除旧资料。配置已在兼容发生前变化而导致 legacy hash 漂移的记录，无法保证自动恢复；仍保留原数据。格式损坏、索引不完整或身份冲突时事务回滚并明确拒绝，不以另建掩盖。

本机数据表结构没有变化，新增身份版本和迁移回执存于现有受作用域保护的 KV 条目，不修改 Codex 私有数据库。

## 验证

先修改桥接回归，实际观察旧实现对同 accountId 的 config mtime 变化返回不同身份，测试失败；再实现稳定持久身份后同项通过，旧在途拒绝及迟到结果隔离仍通过。

最终执行：

```text
node --test packages/issue-hub/test/bridge.test.mjs packages/issue-hub/test/product-tasks.test.mjs packages/issue-hub/test/tasks.test.mjs
node --check packages/issue-hub/src/host/bridge.mjs
node --check packages/issue-hub/src/services/issue-tasks.mjs
```

33 项测试全部通过，两个模块语法通过。核心新增场景：

- 同账号 config/auth 更新及服务重建持久身份不变，accountId/home 改变仍隔离。
- 精确 legacy 的 draft/prepared/requested 恢复后不再次打开，旧值保留、重复兼容只有一份记录；真实 SQLite 关闭重开后结果一致。
- 未知漂移 scope 不被查询，其他 GitHub 身份不可认领；坏索引导致完整回滚，新作用域已有当前任务不被旧记录覆盖。
- 修改有效绑定后，旧关联仍回原工作区，另建使用新绑定，历史返回不切 current。
- 歧义候选展示不含正文；未知候选或缺少确认在读聊天前被拒绝；nonce/工作区变化、账号切换与两个窗口冲突均不产生错误关联。
- reference 精确等于预填提示词第一行，区别于 requestId；核对 resolve 不增加打开次数。

既有 P0 任务测试同时通过；这不构成真实桌面草稿、原未发送草稿保护或手动发送后准确返回的验收。对应点检仍须按当前版本单独记录。

## 修改文件

- `packages/issue-hub/src/host/bridge.mjs`
- `packages/issue-hub/src/services/issue-tasks.mjs`
- `packages/issue-hub/test/bridge.test.mjs`
- `packages/issue-hub/test/product-tasks.test.mjs`

本代理未修改冻结的 hook/catalog、前端或其他服务。

## 真实环境后续修正：身份不再依赖额度网络

主会话的真实连接检查发现，当前 account/read 因 workspace routing discovery 失败，account/rateLimits/read 因 usage 地址连接失败，导致项目接口虽可读，任务身份仍不可用。该真实阻断不能用前述隔离测试通过来替代。主会话只记录了 auth store 的字段形状，确认当前 `auth_mode=chatgpt`、`tokens.account_id` 存在且没有 API key，并明确授权本进程读取身份字段。

已将身份读取改为：

1. 只读当前受信任 codexHome 的 auth.json。仅明确 chatgpt 模式、无 API key、非空 tokens.account_id 才直接确认。原文仅在进程内解析，不输出或持久化 token、accountId 或登录内容；读取前后 auth/config 指纹必须一致。此路径不启动 AppServer、不调用额度接口。
2. 文件不存在或无法直接确认 ID 时，可调用当前 CLI 官方 schema 定义的 `account/read`，参数 `refreshToken:false`，只接受 account.type=chatgpt 且 workspaceRouting.chatgptAccountId 非空。明确 API key 或损坏文件直接拒绝；RPC 失败返回 HOST_IDENTITY_UNAVAILABLE，不伪造 API-key 账户身份。
3. 本机与官方账户路径仍使用同一个 v2 home/accountID 哈希域；读取来源不参与持久 scope。`identityDetails()` 现在额外返回 source=auth-store/account-rpc，legacyIdentity 为 null。

兼容边界随之明确：本机账户 ID 与旧额度快照 accountId 的同义性尚未被证明，不能为了恢复 0.2.4 旧 scope 再引入额度网络或枚举历史作用域。因此本路径不提供自动 legacy 认领。服务中仅精确、可信 legacy 证明才兼容的代码和回归仍保留；同 v2 home/accountID 的已存记录不因读取来源变化而换 scope。

三个新增有效回归先失败，分别暴露额度错误仍阻断身份、缺少官方账户读取路径、API key/损坏状态错误分类；实施后以下命令 29 项全部通过：

```text
node --test packages/issue-hub/test/bridge.test.mjs packages/issue-hub/test/product-tasks.test.mjs
```

同时模块语法及限定差异检查通过。新增测试验证本机身份无需 AppServer/额度请求、不同账户不串、读取期间 auth 改动拒绝旧结果、本机与官方路径身份一致，返回和错误不含测试 secret/accountId。

真实只读探针 `research/task-identity-local-probe-030.mjs` 已执行，结果 `research/task-identity-local-probe-030.json` 仅记录 `{readOnly:true,ok:true,version:2}`，标准输出仅 `{ok:true,version:2}`。没有打开/发送聊天。root 可重建包再运行完整 doctor；此成功只证明真实身份可取得，仍不替代桌面草稿与发送后往返验收。

## 返回请求不能退化为创建

按 root 最后明确的 R6 边界，为 open 增加可选 `reuseOnly:boolean`。成员在旧页面点击返回时，即使 GitHub 身份没变、Codex 账号已变，也必须按新当前双身份 scope 查找精确 requestId；找不到或不属于该 Issue 则 REQUEST_UNKNOWN，不回退其他 current、不读取 Issue/thread、不 claim 新请求，也不开草稿。默认 false 保留首次创建与明确另建的既有行为。前端已对 current 存在且非 another 的操作发送 true；首次/另建发送 false。

先只加入字段解析并执行两个回归，实际复现了新 scope 下旧 ID 被静默创建，以及未知 ID 回退当前关联的缺陷，均因缺少拒绝而失败。随后在 open 的既有请求读取处增加作用域归属与精确 ID 约束，两个场景转绿。补充验证同账号配置变化后稳定 ID 仍可返回，精确 legacy 兼容后的 draft/prepared/requested 也可按 reuseOnly 恢复且不再打开。

最终再次执行 bridge 与 product-tasks 两文件测试：31 项全部通过；issue-tasks 模块语法通过。该增量只改服务和对应测试，没有新增全局 Codex 身份协议，也没有实际打开聊天。

## 创建任务只取严格摘要

按 root 明确的同作用域优化，新建任务将 `issues.execute('read')` 换为 `read-summary`，不传 cacheFirst。任务只使用返回标题构造受控 Issue URL 和开发提示词，仍经过当前身份、仓库读取权限及返回身份核验；提示词继续要求成员发送后读取最新全文、全部评论及活动。模型完整 read 接口未改。

新增有效回归先令完整详情分页抛错，原路径确实因此阻断创建；改用摘要后能够准备并通过 mock 打开，断言仅调用一次 read-summary、不传缓存优先参数且不调用完整 read。随后 product-tasks 全部 22 项通过，模块语法及限定差异检查通过。本优化没有执行真实新聊天打开。
