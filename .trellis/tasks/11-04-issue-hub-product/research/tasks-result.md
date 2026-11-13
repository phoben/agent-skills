# 项目发现与 Issue 任务实施结果

2026-11-04，trellis-implement 负责范围已实现，未提交、推送或执行真实桌面/远端写入。

## 文件与接口

- `packages/issue-hub/src/catalog.mjs`：保留原公开接口，新增 `discoverGitRepositories`；仅在注册根内扫描实际目录，默认深度 5、目录 1500，跳过依赖/构建/元数据目录与链接，不扫描全盘。发现嵌套 clone 和 .git 文件 worktree，读取每个命名 remote 的全部 fetch URL；同仓库保留多个项目/路径。目录/深度触限及访问失败为 partial，重新打开前复核授权范围及 Git 远端。
- `packages/issue-hub/src/services/issue-tasks.mjs`：导出 `createIssueTasks({catalog,bridge,storage,issues,openUri?,now?,maxCandidates?,maxCandidatePages?})` 和纯 `issueTaskPrompt`。execute 支持 latest/bind/open/check，参数严格限制服务端仓库/工作区键及合法 UUID。
- `packages/issue-hub/test/product-tasks.test.mjs`、`product-catalog.test.mjs`：新增业务和真实 Git/SQLite 测试。

任务 envelope `{schemaVersion:1,identity,data,sampledAt}`；latest/open/check data 为 `{current,history,binding,workspaces}`。bind 返回 `{binding}`。current `id=requestId`，含 status/title/prompt/threadId/workspaceKey/path/coverage/checkedCandidates/navigation。workspaces 同时保留 key/cwd/projectId 并提供 id/path/name/valid 给 A 页面。状态使用 requested/pending/linked/ambiguous/open-unconfirmed，不伪造用户已发送。

前端接入后补充身份契约：open/bind/check 必须提供 `expectedIdentity`（当前页面的 GitHub 稳定 ID 字符串），服务取得当前身份后比较，不符直接拒绝；latest 可选传入并同样校验。防止旧页面在 gh 切换后的首次操作被解释为新账号请求。对应 9 项任务测试再次通过。

gh 稳定身份作用域再绑定 Codex 身份散列；返回前重新核验双身份。同步 SQLite 事务只做 claim 和结果更新，不在事务跨 await。打开前持久化，跨窗口/连接同一 Issue 默认复用既有请求；another 明确另建并保留历史，1500ms 误点不重复。单有效路径直接打开，多路径先选择并记住；失效时拒绝而不落入当前工作区。OS 结果未知持久保存 open-unconfirmed，后续不盲目重开。

任务提示词第一行为唯一 nonce，含受控 GitHub Issue URL、定位信息、最新正文/全评论、AGENTS/规范、实施验证和额外提交/推送/远端写入授权边界，不复制远端正文为执行指令。深链只预填，服务不发送消息。关联按 cwd/projectId/时间和完整首条 nonce；多匹配、分页/格式缺失或截断均不能唯一认领，不保存读取到的聊天正文。已关联返回先 thread/read 复核工作区，再打开不带 prompt 的 threads 深链。

## 已执行验证

- `node --test packages/issue-hub/test/product-tasks.test.mjs packages/issue-hub/test/product-catalog.test.mjs packages/issue-hub/test/catalog.test.mjs packages/issue-hub/test/tasks.test.mjs`：24 项通过（新增真实 worktree 测试前）。
- `node --test packages/issue-hub/test/product-catalog.test.mjs`：补充真实 worktree/.git 文件及多个 fetch URL 后 4 项通过。
- `node --check packages/issue-hub/src/catalog.mjs`、`node --check packages/issue-hub/src/services/issue-tasks.mjs`：通过。
- 任务测试覆盖并发误点、重建恢复、多路径/失效绑定、OS 回执丢失、双身份切换、完整唯一/歧义/部分覆盖、另建历史、非法路径参数和两个独立 SQLite 连接 claim/readback。

## 保留限制

真实 Codex 新草稿的工作区、已有未发送草稿是否被宿主保留、发送后 nonce 可见性及导航仍需桌面点检；没有自动操作 Codex UI，没有打开实际新聊天。当前深链有特定宿主版本源码证据，不能声称为长期稳定公开 SDK。扫描有界且明确 partial，不能以自动测试推定桌面项目全覆盖。SQLite 事务并发与业务测试不替代第二台 Windows 安装验收。
