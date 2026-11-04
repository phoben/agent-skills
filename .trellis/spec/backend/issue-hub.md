# Issue Hub 服务与宿主契约

## 1. 适用范围

修改 `packages/issue-hub/`、`plugins/issue-hub/` 或其市场入口时读取。0.3.4本机验收完成，原生工作区、草稿与聊天往返已获用户确认；第二台Windows暂缓。正式交接见[需求](../../../docs/issue-hub/requirements.md)、[架构](../../../docs/issue-hub/architecture.md)及[验收](../../../docs/issue-hub/acceptance.md)。原任务11-03-github-issue-plugin、11-04-issue-hub-product的本机历史材料留在本地，不属于插件分发。下方P0接口保留兼容测试，正式契约优先见本节。

## 正式管理契约（0.2.0）

- `createIssueServer` 只有 `issue-hub-open` 一个 global，资源为 `ui://issue-hub/app.html`。query/mutate/task 仅 app 可见；模型只有固定只读仓库目录、Issue 与评论入口，不暴露远端写或任意 shell/URL/API 路径。
- `createGithubClient` 通过无 shell 的 gh 执行固定 github.com REST，写入 JSON 走 stdin。身份使用远端稳定用户 ID；凭据仅在进程内求指纹。每个写请求必须携带页面 expectedIdentity，并在真实上下文前后复核；不能把旧页面输入应用到新账号。
- SQLite 位于独立 IssueHub/data，schema 迁移、忙超时和较新版本拒绝由 `createStorage` 负责；事务同步，不跨 await。缓存/草稿/回执/偏好按 gh scope 隔离，任务另绑定 Codex 身份，不保存 token 或聊天正文。P0 JSON 请求不自动迁移成正式任务。
- 已验证凭据不变时，网络失败可读对应离线缓存并存草稿；未知身份、凭据变化或401不可回退。资源403/404须撤销该仓库读取缓存，保留未发草稿；资源401同样撤销离线身份资格。`cached` 表示来源，不能据此推断离线，使用明确 `offline` 状态。
- 目录有界检查 roots 下子仓库，默认深度5、1500目录，跳过依赖/构建及链接；partial保留真实覆盖。`snapshot({raw:true})` 返回原始发现，`remap(mapping)` 只归一已发现项。由当前gh身份确认稳定仓库ID，key为sha256(`github.com:id:<id>`)前20位，旧/新名同ID合并工作区；resolve复核工作区自身原remote别名，不接受任意路径映射。
- Issue/评论/活动的分页覆盖与nextCursor明确，PR从Issue集合排除；详情默认最多10×100，超限继续读取，不称全部。候选按仓库验证，禁止借标签输入创建定义；本人评论与Issue管理权限分开。仅提交变化字段，负责人数组不能因编辑标题被截为单人。
- 写前比较基线，冲突返回输入与远端；不宣称GitHub原子CAS。SQLite先原子claim operationId与输入摘要，未知创建同ID或换ID均不自动重投；人工核对not-created仅解除回执，用户再次提交才写。远端接受但读回失败只重读，Issue核对提交字段；评论必须按真实ID/父Issue/正文核对，不能只重读Issue就宣布成功。
- `createIssueTasks.execute(latest/bind/open/check)` 使用服务器目录键和双身份；打开前先持久claim，单工作区一次预填不发送，多路径明确选择。requested/pending/ambiguous/open-unconfirmed与linked不同，只有完整唯一首条nonce且候选覆盖完整才可认领。返回已关联前复核真实thread工作区，另建保留历史，未知打开不盲重开。
- `test/check/build/verify:stdio` 分别验证隔离边界、JavaScript语法、自包含产物和包外协议；`verify:live` 只读项目及真实非空GitHub详情，禁止打印正文/凭据或写远端。浏览器联调不代替Codex真机点检/第二台Windows验收。正式产物是CJS、app.html及许可，双清单、包版本及构建标记一致。

## 2. 签名

### 0.2.1 加载与宿主增量

- 主服务先connect再按需发现目录。`bootstrap`仅在当前凭据指纹曾验证绑定稳定gh账号时读取账号内快照；冷目录可先检查注册roots直接仓库（4并发），明确partial/checking与DEEP_SCAN_PENDING，完整嵌套扫描由`refresh`后台完成。模型仓库目录走完整`refresh`，不把UI快照语义套到模型读取。
- app-only新增`read-summary`，正文/属性先返回，讨论未获取的coverage不可标完整；`list/read-summary`的`cacheFirst:true`才优先可信缓存，默认仍严格读取，模型`issue-read`完整最新语义保留。
- `checking`是待查状态对象；`cached`不是离线，`networkChecked`才是本次GitHub联网证据。缓存/本机视图写入不能提升最后GitHub成功时间。fast请求结束仍复核身份映射有效，401在途撤销不能被旧缓存响应复活。
- `view-state-save`参数为`{value:{navigationWidth?,queueWidth?,repositoryKey?},expectedIdentity}`，宽度164–420/280–640，存当前scope的view/layout。raw仓库键按已验证alias归一为stable key；旧记忆按sourceKeys兼容，不能因后台规范名/键变化丢掉当前选择或草稿。
- 同scope同路径的在途只读可以合并，不缓存完成后的严格远端身份查询，不合并写入或不同凭据请求。
- host的auth/config指纹变化只关闭自有旧child并重连，旧pending和迟到结果拒绝为HOST_CONTEXT_CHANGED。Codex不可用/身份变化使用HOST_*，不能冒充GH账号变化。持久identity在0.3.0改为下述v2规则，未知旧域不猜测迁移。
- 目录刷新失败时，service返回当前scope可信仓库/已读内容及catalog unavailable/checking与安全错误分类，不能吞成成功空目录；快照不当成新鲜发现，未重新核对的工作区仍拒绝任务打开。GH401/403实际失权仍按原规则清数据。
- 必需回归覆盖受控未决身份/元信息不阻塞可信首页、摘要不等评论、冷quick/full竞态、同仓库归一迁移、配置mtime变化重连/旧帧拒绝，以及实际service目录失败后的非空保留与任务阻断。

- `createStorage({directory})` 返回同步 get/set/remove/list/transaction/close，键为 scope/kind/key；`createGithubClient().identity/request/fingerprint` 不返回令牌原文。
- `createIssueService({github,storage,catalog}).execute(action,payload)` 返回 `{schemaVersion:1,identity,data,sampledAt,offline,cached}`；mutate payload 附 expectedIdentity。动作和字段见产品任务 design.md，服务拒绝未知字段。
- `createIssueTasks({catalog,bridge,storage,issues}).execute(action,payload)` 返回同类 envelope，latest/open/check 的 data 为 `{current,history,binding,workspaces}`；open/bind/check 必须 expectedIdentity。
- `createIssueServer({html,issues,tasks,...})` 注册正式一个 global；下面 createProofServer/createTaskProof 是P0兼容接口，不用于正式main。
- `createHostBridge({...})` 返回 `request(method, params)`、`identity()`、`close()`；方法白名单以 `src/host/bridge.mjs` 为准，不接受任意宿主 RPC。
- `createCatalog({bridge,...})` 返回 `refresh()`、`snapshot()`、`resolveWorkspace(repositoryKey, workspaceKey)`。
- `createTaskProof({...})` 的 `prepare/open/check/latest` 只处理本插件记录，按已确认目录键和当前 Codex 身份访问；`latest({repositoryKey, workspaceKey})` 不读取聊天。
- `createProofServer({...})` 只注册一个 global 主入口；仓库诊断工具为 app-only、非 global，共用 `ui://issue-hub/host-proof.html`。不能把多个 global 入口当原生浮层子项。

## 3. 请求、响应与环境

### 0.3.0 写入、会话与连接检查

0.3.2补充：缓存restore/quick目录中的checking是尚待核对，不能指望另一页面后台请求一定会完成。显式任务操作在需要时先通过 `issues.execute('refresh')` 完成本轮真实发现及稳定仓库映射，再复核GitHub/Codex身份，最后继续原操作。原catalog.resolveWorkspace的checking、项目范围和remote验证仍保留；刷新失败、项目移除或身份变化不得调用openUri。latest保持只恢复投影，不搜索聊天。reuseOnly必须先找到当前双身份下精确请求，再进行目录核对，不能因刷新退化成新建。

0.3.3补充：桌面深链新聊天的thread元数据可能没有projectId，远端thread/list附projectId会将它排除。候选查询只按精确cwd列举，仍在本地拒绝显式不同projectId、不同cwd及不合时间窗的项；关联前继续由catalog复核当前注册项目/真实remote及双身份，不靠缺省项目号放行任意路径。

`thread/items/list.data`当前返回 `{turnId:string,item:ThreadItem,startedAtMs?,completedAtMs?}[]`。任务解析只解这一层官方包装，并兼容旧裸ThreadItem；外层同时自带type、缺失turnId、损坏item或未知无类型对象均HOST_PROTOCOL，不能当空且完整的页。自动检查与人工resolve共用firstUserLine，只匹配首条userMessage完整首行，不搜索代理消息、后续用户消息或任意正文内nonce。包装分页仍保留完整覆盖和重复游标保护。

- confirmed 操作保存规范原请求的 `requestSignature`，与最终PATCH差量摘要分开。相同 operationId 在当前身份、仓库、对象、权限及请求内容匹配后重放成功回执，先于旧revision冲突；换对象或内容仍拒绝。旧回执无新摘要时只允许既有数据足以证明相同请求的兼容路径。
- 成功回执是历史事实，页面投影须另取最新详情。读回失败返回 `issue:null, operation.status:'confirmed', replayed:true, projectionFresh:false, readbackWarning`，不降级unknown、不重投。confirmed的operation-resolve/readback只读当前投影；首次readback-failed仍须核对真实写入字段。身份、401/403/404拒绝规则不变。
- 关闭/重开只PATCH state，以目标相反状态作为隐含基线；其他成员仅新增评论导致updatedAt变化时不误报状态冲突。标题/正文/属性修改仍检查原revision，不能借状态接口绕过编辑保护。
- `createHostBridge().identityDetails()` 返回 `{identity,legacyIdentity,version:2}`。identity由规范Codex home与可信账号ID计算；auth/config指纹只守卫连接和在途结果。同账号授权刷新稳定，账号或home变化继续隔离。
- 身份优先读取当前home受信任auth.json：仅明确ChatGPT模式、无API key、非空account_id，读取前后核对指纹；没有可信本机ID时可用官方account/read(refreshToken:false)。额度查询不是身份前置条件。API key、损坏或未知身份报HOST_IDENTITY_UNAVAILABLE，不打印认证内容，不猜账号。
- 当前bridge无法证明本机账号ID与旧额度身份ID同义，`legacyIdentity:null`；旧关联不删除、不枚举猜认。服务仅在注入了可信精确旧域证明时同步验证并兼容旧索引、请求与双身份，prepared转待核查，不能再次打开未发草稿。
- `tasks.execute('open', {repositoryKey,number,requestId?,another?,reuseOnly?,expectedIdentity})`：已有请求的“返回”明确reuseOnly=true，必须先在当前双身份域找到精确requestId，失败REQUEST_UNKNOWN；不能回退其他current或新claim。true与another冲突。首次/另建保持false，准备时strict read-summary，不为标题加载完整讨论。
- `bind`只改变未来任务绑定，历史保留原工作区。`open-history`参数为 `{repositoryKey,number,requestId,expectedIdentity}`，只打开当前Issue、当前双身份自有linked记录，再验真实thread/cwd/project，深链不带prompt，不改当前优先记录。
- `check`保存同请求完整首行nonce与路径验证过的候选；`resolve`参数为 `{requestId,threadId,confirmed:true,expectedIdentity}`，仅接受已保存候选，再核对身份/路径/首条引用并在事务内复查。自动关联仍要求完整唯一，人工关联记录source，不自动发送。投影reference取实际nonce生成的taskMarker，不用requestId替代。
- `issue-hub-diagnostics`为空严格参数、app-only、readOnlyHint=true，不依赖成功bootstrap；返回 `{schemaVersion:1,data:{status,checks,discovery,sampledAt}}`。checks使用固定id/label/status/message/version?/action?，discovery.warnings为中文string[]；不回传原始stderr、私有路径、token或聊天正文。
- `--doctor`在创建业务存储前使用同一诊断模块，检查Windows/Node24/Git/gh/Codex/GitHub/项目接口/会话身份/SQLite，输出JSON，核心错误退出1。固定命令无shell，SQLite只创建并清理自有临时库。Windows验收包只含8个明确插件文件及review源/哈希/安装器/说明；不能改YG正式源或附带个人配置。隔离profile安装不能称第二台Windows验收。

- 仓库/工作区使用服务端发现的哈希键；请求 ID 和 thread ID 使用合法 UUID，不让页面传任意路径。
- 目录响应包含 `schemaVersion/status/projects/roots/repositories/warnings/sampledAt`；`partial` 与 `unavailable` 不得冒充完整或零数据。有界嵌套发现与稳定ID归一由catalog/service分层完成，触限仍partial。
- MCP 页面响应使用 `structuredContent`；错误带 `isError` 和安全错误码，不输出原始宿主载荷、凭据或私有错误路径。
- `ISSUE_HUB_P0_MAX_ENTRIES` 若保留，为 1–10、默认 2，只限制诊断仓库工具，不改变主图标数、不截断发现计数。状态页是唯一 global 入口。
- 插件主入口、原生悬浮栏、iframe 内导航必须分别建模。当前 SDK global 的 quickAction 仅是单个工具快捷操作，没有公开的原生 children provider；内置 first-party 桥接不能直接供第三方 MCP 调用。详见任务专项调查，原生浮层保持未满足。
- `ISSUE_HUB_DATA_DIR` 为请求状态目录，默认 LOCALAPPDATA 的 `IssueHub/host-proof`；`CODEX_HOME` 沿用本机配置；`ISSUE_HUB_CODEX_BIN` 显式指定绝对程序，Windows 要求 exe。
- 请求绑定 Codex 身份、仓库、工作区和唯一 nonce；深链打开前复核身份与 Git 关系。准备/已发请求/待发送/已关联分开，只有可信 thread 才能返回已有聊天。
- `issue-proof-task-latest` 为 app-only、只读工具，参数为当前仓库/工作区键，返回 `{request: null | 请求投影}`；只有身份、cwd、项目和绑定全部一致才恢复，不能按一个 UUID 任意提取其他请求。
- 关联仅扫描当前 pending 请求的精确 cwd、发起时段和有限初始项；完整引用唯一匹配且候选覆盖完整才关联，不保存聊天正文。不得以 `searchTerm` 搜提示词，该参数只搜提取标题。
- `codex://new` 预填不发送，`codex://threads/<UUID>` 不附新 prompt。Windows 打开采用固定可执行程序与参数，不能拼 shell 命令。
- P0 JSON 状态并非生产共享存储：仅用于单实例技术点检，不能宣称跨进程事务安全；正式阶段按总体方案迁移 SQLite 后验证并发。

## 4. 校验与错误

| 条件 | 处理 |
| --- | --- |
| RPC 超时、损坏帧、启动或流关闭 | 拒绝 pending 并回收连接，不在 stdout 打诊断文本。 |
| 身份/配置变化或身份未知 | 拒绝旧请求，不恢复或打开其他身份记录。 |
| 项目分页截断、游标重复或 Git 读取失败 | 明确失败或 partial，保留安全分类，不伪造已覆盖全部。 |
| 目录失效、工作区不属于仓库、remote 改变 | 拒绝打开，不让宿主回退到当前项目。 |
| 一条匹配但候选覆盖不完整 | 保持待确认，不能宣布唯一关联。 |
| 多条完整 nonce 匹配 | ambiguous，不选择最近一条。 |
| OS 打开结果不确定 | OPEN_UNCONFIRMED，保留已发请求，避免盲目重复打开。 |
| 仓库403/404或资源401 | 清对应读取缓存/离线身份资格，原账号未发草稿保留，不显示旧私有详情。 |
| 评论读回ID/父Issue/正文不符 | readback-failed，不能确认成功；重试只读取，不再次发布。 |
| 新增响应丢失 | unknown阻止相同提交，人工核对后显式解除，下一次主动提交新ID。 |
| confirmed回执对应的最新投影不可读 | 保留成功事实，issue:null，只允许重新读取，不重新发布。 |
| 旧页面返回请求在当前Codex身份域不存在 | REQUEST_UNKNOWN，不创建新草稿、不跨域搜索。 |
| 人工选择不在已核验候选内或已变化 | 拒绝关联，保留待核查，不按时间选择其他线程。 |
| 本机草稿保存遇当前仓库失权 | 验证当前stableID/expectedIdentity和已发现仓库键后仍可保存草稿，不借机读取旧缓存。 |

## 5. 正常、基础与失败场景

正常：插件只有一个 global 主入口，两个仓库诊断工具可分别返回绑定上下文但不产生主图标；用户发送验证草稿后唯一匹配才用真实 ID 返回。原生浮层另外验收，不能靠上述工具证明。

基础：没有 GitHub remote 的目录或非仓库 root 可产生部分覆盖诊断；页面仍可查看已确认数据。模型不因未发现可访问仓库而获得任意路径能力。

失败：身份切换、页面销毁后丢失内存状态、索引延迟或多匹配均不能被“最新一个线程”掩盖。页面恢复只读取自有请求，不顺带搜索聊天。

## 6. 必须验证

- `npm --prefix packages/issue-hub test`：RPC 生命周期、目录分页/归一化/复核、多工具上下文与清单变更、nonce 完整/歧义/部分覆盖、身份隔离与页面恢复。
- `npm --prefix packages/issue-hub run check` 是 JavaScript 语法检查，不称类型检查或完整 lint。
- `build` 验证双清单版本、内联脚本可解析、完整第三方许可；`verify:stdio` 从包外启动，恰好一个正式global和app-only query/mutate/task，没有P0诊断工具。刷新后全局入口始终为一，原生浮层不在首版范围。
- `verify:live` 只输出真实项目、仓库和非空详情的计数/覆盖状态，真实安装发现与 UI 资源读取另有记录；不能替代桌面渲染、草稿保护或真实关联。
- 正式回归断言覆盖101评论、PR排除、stableID别名/改名、两进程SQLite、expectedIdentity、失权/401清缓存、未知回执人工解除、提交字段/真实评论读回，以及nonce完整覆盖。
- 改服务或页面后重建，并核对安装缓存与仓库产物。已安装版本发生变更时使用新修订版本，避免拿旧缓存验收新源码。
- 0.3.0回归须覆盖旧基线confirmed重放/最新投影失败保留回执、评论时间变化状态最小写入、同账号配置变化身份稳定/API key拒绝、未知旧域保留、reuseOnly跨账号不新建、历史与人工候选再验证，以及诊断脱敏和无bootstrap可用。
- 任务就绪回归须组合真实createCatalog与createIssueTasks：refresh/remap→restore缓存→显式open应完成核对后只调用一次受控openUri；同条件移除项目或刷新期间切身份必须拒绝。另用真实stdio临时库bind验证同一resolveWorkspace路径，不能只测latest或完整refresh之后的暖目录。
- 任务关联回归须使用真实API形状：无projectId的同cwd候选、官方turnId/item包装及分页、人工resolve再次读取。不同显式project/cwd、代理文本/后续引用、损坏或混合包装、partial覆盖均不能误认领。真实验证只处理当前双身份下用户指定nonce，不将测试候选当真实聊天。

## 7. 错误与正确做法

错误：把多个 global 工具图标当作原生悬浮子项；以代码中内部 setSidebar 的存在宣称第三方可调用；把预览或最近时间当会话回执；页面重开就创建新 nonce。

正确：对主入口数量建立可变红的回归，原生子导航必须另有公开或可验证的第三方契约。请求按当前作用域恢复并验证完整唯一引用，自动测试、安装后协议和真实桌面结果分别记录。
