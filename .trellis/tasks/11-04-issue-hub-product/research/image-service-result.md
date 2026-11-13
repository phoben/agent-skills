# Issue 图片后端实现与定向验收

日期：2026-11-05

代码工作区：`E:/Develop/agent-skills/.worktrees/issue-hub-images-20261105`，分支 `codex/issue-hub-images`。本记录按 `ai-style` 检查中文表述。

## 已实现行为

新增仅页面可见的只读工具 `issue-hub-image`。页面提供仓库键、Issue 编号、图片地址、当前身份，可选评论编号。服务先联网核对该 Issue 的当前读取资格，再从正文或已核对父 Issue 的评论中查找精确图片引用。离线缓存、旧账号、未知来源地址及代码块中的图片标签均不能作为图片读取证明。

图片下载前后检查当前凭据散列及 GitHub 身份。下载失败后重新读取当前 Issue，区分单个附件失败与真实账号或仓库失权。单个图片的 403、404、格式或大小错误只返回 `IMAGE_*`，不把整个 Issue 标记为离线。评论 API 明确返回登录失效时保留 `AUTH_REQUIRED`。

认证媒体运输仅接受 `https://github.com/user-attachments/assets/<标准 UUID>`，使用固定参数的 `gh api`、Buffer stdout、20 秒超时和 5 MiB 内容上限。历史 `user-images.githubusercontent.com`、`private-user-images.githubusercontent.com` 保留原链接回退，不进入 gh。这样可避免 gh 按初始主机选择企业凭据后向历史图片域附加授权。JSON API 的原有路径白名单没有放宽。

服务核对 HTTP 状态、MIME 与 PNG、JPEG、GIF、WebP 魔数。SVG、HTML、未知内容、畸形响应和超限内容均拒绝预览。不会向前端返回令牌、原始 HTTP 头、重定向签名地址或子进程 stderr。

私有字节仅返回在工具结果 `_meta['issue-hub/image']` 中。`structuredContent` 只有 schema、身份、安全状态和 MIME、字节长度、地址散列；文本内容固定简短。没有新建持久图片缓存，也没有迁移业务存储。

正式资源的实际 `contents[0]._meta.ui.csp` 显式声明 `resourceDomains: ['data:']`，网络与 frame 域为空。只读预览组装同一图片服务，保持完整工具 `_meta` 和 HTTP `img-src data:`，没有放开远程图片或浏览器直连。

正式入口切换为版本化资源键 `ui://issue-hub/app-v2.html`，避免宿主沿用旧 HTML 缓存。旧 `ui://issue-hub/app.html` 继续作为同 HTML、同 CSP 的只读资源别名；全局工具仍只有一个，P0 资源保持原有地址和行为。

## 修改范围

- `packages/issue-hub/src/github/client.mjs`：受限认证二进制图片读取。
- `packages/issue-hub/src/services/images.mjs`：身份、权限、正文及评论归属核对。
- `packages/issue-hub/src/server.mjs`：新增 app-only 工具与实际资源 CSP。
- `packages/issue-hub/src/main.mjs`：正式运行组装图片服务。
- `packages/issue-hub/scripts/preview.mjs`：只读预览组装及工具白名单。
- `packages/issue-hub/scripts/verify-stdio.mjs`：9 个 Issue 工具、图片可见性和资源 CSP 断言。
- `packages/issue-hub/scripts/verify-toolkit.mjs`：整包 12 个工具及资源 CSP 断言。
- `packages/issue-hub/test/images-product.test.mjs`：11 项媒体和协议回归。

共享图片策略、渲染器、页面控制器和 UI 测试由另一实施代理维护，本代理未修改这些文件。

## 实际验证

先运行新增正向回归，分别观察到 `readImage is not a function` 和缺少 `issue-hub-image` 工具的准确失败，再补实现。依赖未安装时的加载失败没有计为功能红测。

资源版本切换先增加协议断言，观察旧 `app.html` 与预期 `app-v2.html` 不同的准确失败，再改注册。回归同时核对旧地址可读、内容与 CSP 相同且没有增加全局入口。

最终运行：

```text
node --test test/images-product.test.mjs test/github-product.test.mjs test/product-server.test.mjs
tests 17 / pass 17 / fail 0 / skipped 0
```

覆盖正文及评论合法图片、跨 Issue 评论拒绝、来源不在文档中拒绝、缓存或离线拒绝、身份与凭据变化、授权撤销、局部附件失败、MIME 与魔数、5 MiB/子进程输出限制、工具 app-only 可见性、字节仅在私有 `_meta` 以及实际资源 CSP。

企业凭据回归在隔离 Node 子进程中只注入 dummy 环境变量，不读取或继承本机真实凭据。断言两类历史图片域完全不调用传输，现代附件只使用固定 github.com 主机。

`npm run check` 通过，当次检查 58 个 JavaScript 模块。`git diff --check` 通过。stdio 和 Toolkit 脚本已更新断言；本代理未重建产物或运行旧产物的协议检查，由主会话后续统一构建和完整复核。

## 验收边界

本代理使用假 GitHub 客户端和内存 MCP 链路验证，没有访问真实仓库、生产配置、业务数据库或聊天，没有安装插件、提交或推送。四张真实私有附件的页面解码验证、完整套件与正式宿主验收由主会话继续。浏览器预览通过也不能代替真实 Codex 页面验收。

每张图片都会重新核对当前读取资格，优先保证失权和换号时不返回旧字节。没有持久媒体缓存；历史图片域当前只提供原链接。
