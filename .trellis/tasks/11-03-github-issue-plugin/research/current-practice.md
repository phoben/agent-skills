# 当前实践与事实边界

核查日期：2026-11-03。源码和历史验收不等于本轮重新完成真实桌面验收。本轮只读，无 GitHub 写操作或会话创建。

## Tokens

- `packages/token-usage/src/server.mjs:7` 绑定 UI，第 12–16 行注册 global 入口。
- `packages/token-usage/ui/app.mjs:36` 使用 MCP Apps，第 42、48 行接入宿主主题。
- `packages/token-usage/src/main.mjs:7`、`plugins/yg-toolkit/mcp.json:1`、`packages/token-usage/scripts/build.mjs:17`：stdio、插件产物和内联页面。
- `packages/token-usage/src/collector.mjs:71`、第 99–115 行：读取线程索引并归组，不是完整桌面项目源。
- `packages/token-usage/package.json:6`：Node >=24；产物不包含 Node 运行时。
- `.trellis/tasks/archive/2026-11/11-03-token-usage-dark-palette/verification.md:20`：0.2.5 App Server 发现及资源读取记录；浏览器与桌面截图不可互替。

## Branchkite

来源为 `E:/Develop/Branchkite` 当前本机源码；存在未提交改动，不视作已发布版本。

- `plugins/branchkite/README.md:9`：受限目录发现、GitHub 只读分页、缓存、草稿及页面存续轮询，真实写入与会话绑定尚未启用。
- `packages/host/src/app-server.ts:30`、第 58–67 行：MCP roots 检测与复核；`docs/local-plugin-development.md:25` 标明完整桌面项目目录待实测。
- `packages/runtime/src/read-only.ts:120`：固定 GraphQL 经 gh 执行；`bound-read.ts:54` 每页核对身份与仓库。
- `packages/runtime/src/set-operation.ts:15`：注入 fixture，不代表 GitHub 原子条件写入。
- `packages/runtime/src/session-prefill.ts:13`、第 38 行：生成 codex 链接，仅标记请求未确认。
- `.trellis/tasks/10-31-readonly-browse/verification.md:8`：模拟详情和评论；第 10 行真实仓库当时为 0 Issue。
- `.trellis/tasks/10-31-worktree-session/verification.md:7`：独立 App Server 线程不能证明目标桌面导航。

## 本轮只读项目接口探测

Codex CLI 0.163.0：`generate-json-schema --experimental` 包含 `project/list`、`project/read`；不带实验选项的请求 schema 不包含这两个方法。项目有独立 id、name 和 roots，不依赖线程归组。

子代理另启 App Server stdio，初始化 `experimentalApi: true`，只调用项目列表。返回 1 页、22 个项目、25 个 root、没有空 root 项目、无 nextCursor。未输出项目名、路径、会话正文或凭据；未修改桌面设置。结果尚未与桌面逐项对照，因此不能据此宣布完整发现通过。

临时 schema：`C:/Users/NINGMEI/AppData/Local/Temp/codex-issue-project-schema-b9803c7a2b45433f95cc8cab209fcc5e/ClientRequest.json:9261`、`v2/ProjectListResponse.json:8`。临时文件不是持久规范；实施前应使用受支持版本重新生成并验证。

## 官方文档

- [Plugin Extensions](https://developers.openai.com/plugins/build/extensions)：global 入口及 UI 绑定、新对话消息能力目录；不足以证明全部桌面组合行为。
- [MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui)：页面经 MCP Apps 调工具，服务端负责权限校验。
- [桌面插件](https://developers.openai.com/plugins/deploy/desktop-only)：服务启动 cwd 与新聊天工作区不同。
- [Issues](https://docs.github.com/en/rest/issues/issues)：列表可能包含 PR。
- [评论](https://docs.github.com/en/rest/issues/comments#list-issue-comments)、[Timeline](https://docs.github.com/en/rest/issues/timeline)：独立分页，单页最多 100。
- [标签](https://docs.github.com/en/rest/issues/labels)：集合替换与增量增删的差异。
- [API 最佳实践](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)：条件读取、写入限制及退避。
- [创建 Issue](https://docs.github.com/en/rest/issues/issues#create-an-issue)、[创建评论](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment)：未声明通用客户端幂等键。
- [GitHub App 用户授权](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user)：权限为用户与 App 及已安装仓库范围的交集。具体用户 device flow 见下一项。
- [GitHub App device flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-device-flow-to-generate-a-user-access-token)：桌面用户授权可不设云端服务。

## 待验证

原生动态仓库项的实际渲染和增删、项目列表与桌面覆盖一致、真实插件触发工作区预填，以及另一台电脑的分发与安装。当前宿主的多个入口及工作区深链具备源码基础，具体证据见 [宿主能力调查](host-capabilities.md)。
