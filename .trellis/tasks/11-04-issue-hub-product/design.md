# 产品接入设计

最小差距：现有插件只有 P0 诊断页面，已确认 A 仍用演示存储。本阶段在真实数据所属服务层实现 gh 与 SQLite，以 MCP 工具接到 A 的控制器，复用既有项目读取、Git 检查、线程定位和深链能力。

变更边界：`packages/issue-hub/src/github/`、`src/storage/`、`src/services/` 新增真实业务；`src/catalog.mjs` 增加有界子仓库发现；`ui/` 采用已确认 A；`src/server.mjs`/`main.mjs` 和 scripts 负责组装包。插件清单升级到 0.2.0。不改 Tokens，不修改 Codex 私有数据，不引入团队后台。P0 接口和测试可保留作兼容，但不再作为主页面。

## 共享契约（各实现者遵循）

### 存储

`createStorage({directory})` 从 `src/storage/database.mjs` 导出，Node24 SQLite。同步方法：`get(scope,kind,key)` 返回值或 null、`set(scope,kind,key,value)`、`remove(scope,kind,key)`、`list(scope,kind)` 返回 `[{key,value}]`、`transaction(fn)` 同步原子回调、`close()`。作用域由服务端身份构造，页面不可指定；禁止跨 await 持有事务。迁移版本/备份/忙超时与跨进程验证由存储实现负责。缓存和回执不保存 token 或聊天正文。

### Issue 服务

`createGithubClient(options?)` 从 `src/github/client.mjs` 导出。`createIssueService({github,storage,catalog})` 从 `src/services/issues.mjs` 导出，提供 `execute(action,payload={})` 和 `context()`。`context()` 返回 `{scope,account}`，必须重新确认 gh 当前用户稳定 ID；凭据不可用时拒绝身份未知的缓存。execute 返回 `{schemaVersion:1,identity:account.id,data,sampledAt,...}`。account `{id,login,name,initials}`。

动作：`bootstrap` 返回 `{account,repositories,catalog,preferences,drafts}`；`list` 参数 `{repositoryKey,state?,cursor?}` 返回 `{repository,issues,pageInfo}`；`read` 参数 `{repositoryKey,number}` 返回 `{issue}`；`comments`/`activity` 参数同 read 加 cursor 返回 `{items,pageInfo}`；`options` 返回 `{labels,assignees,milestones}`；`refresh` 可刷新目录。`save-issue` 参数 `{repositoryKey,values,force?,operationId}`，`change-state` 参数 `{repositoryKey,number,state,revision,operationId}`，`save-comment` 参数 `{repositoryKey,number,text,commentId?,expectedText?,operationId}`，均返回 `{issue,operation}`。草稿 `draft-save` `{repositoryKey,number,kind,value}`；偏好 `preference-save` `{repositoryKey,value}`，读取支持 `local-state`。参数由服务边界严格校验，不接受任意 API 路径。

repository 保留目录 `key/fullName/workspaces`，并添 owner/name；Issue 供 UI 字段 `{id,number,title,body,state,labels:string[],assignee,assignees,author,authorLogin,created,updated,updatedAt,revision,milestone,commentItems,comments,activities,url,relatedPr,attachments,coverage,permissions}`。revision 为真实 updated_at；里程碑和负责人编辑值由 options 识别，保留 ID 映射。评论 `{id,login,author,initials,time,text,updatedAt}`。不把第一页当全部，read 可以完整抓取有界分页并标 coverage，超限提供继续加载；PR 排除。远端 Markdown 仅安全渲染，附件和 PR 使用真实受校验链接。

业务错误使用 `ProofError` 的子类/扩展，`code/message` 加可选 `remote/operation/retryAt`；MCP 仅输出安全字段。创建/评论操作先保存 operationId 与摘要，响应丢失进入 unknown，不盲重试；同 ID 不可换内容。比较冲突仅保证已发现冲突不静默覆盖，不能声称 GitHub CAS。读回失败与写入失败分开。

### 任务服务

`createIssueTasks({catalog,bridge,storage,issues,openUri?})` 从 `src/services/issue-tasks.mjs` 导出，提供 `execute(action,payload)`。issues.context() 确认 gh 作用域，另绑定 bridge.identity()。动作 `latest` `{repositoryKey,number}` 返回 `{current,history,binding,workspaces}`；`bind` `{repositoryKey,workspaceKey}`；`open` `{repositoryKey,number,workspaceKey?,requestId,another?:boolean}` 优先已有关联或未发送请求，仅明确 another 新建；`check` `{requestId}`。返回 envelope 与 Issue 服务一致。current `{id,requestId,status,title,prompt?,threadId,workspaceKey,path,coverage,...}`，status `draft/requested/pending/linked/ambiguous/open-unconfirmed`。`open` 单击准备与打开；`check` 不伪造 sent，唯一完整 nonce 才关联；模型不能调用。

任务引用默认第一行，正文包含 GitHub URL、仓库、编号和开发工作指令，要求读取最新 Issue 与所有评论及仓库规范，实施验证但无额外授权不得提交/推送或远端写入。避免把整个远端不可信正文当指令。生成深链不发送。保存请求后再开链接，重入不重复。真实会话无法确认则保持待确认，不显示假成功。

### MCP 与页面

主 global 仅 `issue-hub-open`；所有应用共享 `ui://issue-hub/app.html`。`issue-hub-query` 只读 app-only，`issue-hub-mutate` 写 app-only，`issue-hub-task` app-only；每个 action 用枚举并在服务严格验证 payload。模型可用固定只读 `issue-read`/评论读取入口；不暴露写入。

前端 `LiveStore` 适配原型同步投影和异步保存，但不复制演示 Store/fixture 或场景开关进正式包。通过 MCP 读取；缓存/草稿最终由后端持久化。加载详情、分页与候选来自服务；每次异步关联身份、仓库、Issue 代次。账号变更清旧页面，在途旧写入不覆盖新身份。MCP ontoolresult 接启动结果，宿主主题走 hostContext。离线本机草稿可调用后端，身份未确认不读旧私有缓存。前台 visibility+60s 当前仓库刷新，写后立即读回。
