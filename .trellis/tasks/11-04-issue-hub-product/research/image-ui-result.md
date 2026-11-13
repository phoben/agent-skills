# Issue 图片前端实现与验证

日期：2026-11-05。实现目录：`.worktrees/issue-hub-images-20261105`，分支：`codex/issue-hub-images`。

## 可观察结果

正文与评论中的 GitHub 附件图片支持预览，包括用户 #191 提供的 HTML `<img>` 格式及 Markdown 图片。页面保留原有三栏与亮暗主题；图片按可用宽度缩放。每张图片独立显示读取状态、原图入口与失败重试，不让图片错误覆盖整个 Issue 详情。

认证预览只支持 `https://github.com/user-attachments/assets/<uuid>`。旧的 `user-images.githubusercontent.com`、`private-user-images.githubusercontent.com` 图片保留原图链接，不请求媒体工具。其他 HTTPS Markdown 图片也只保留链接。

## 实现范围

- `src/image-policy.mjs`：前后端共享 URL、HTML/Markdown 图片解析、MIME 与 5 MiB 限制；固定附件路径判定。代码块和行内代码保留原文。
- `ui/ui.mjs`：只重建固定的图片容器和受限属性；不透传原 HTML 的事件、style、srcset。图片没有远程 src。
- `ui/images.mjs`：懒加载、最多两个并发请求、同范围去重、最多 12 个且合计 16 MiB 编码字符串的内存缓存。作用域含账号、仓库、Issue 与页面代次；切换或失权时清除像素并拒绝迟到结果。
- `ui/app.mjs`：仅在组件内读取工具返回的私有 `_meta['issue-hub/image']`；正文与评论共用控制器；已有评论节点携带 commentId。
- `ui/store.mjs`：图片请求仍经过身份与仓库失权规则，但不修改页面全局联网状态和最后成功时间；不持久化图片数据。
- `ui/index.html`：额外 meta CSP 只允许 data 图片、内联构建脚本和样式，禁止连接、框架、对象、表单与 base。后端负责 resource contents 的宿主 CSP。
- `ui/style.css`：响应式图片、占位与局部操作样式。
- `test/product-ui-images.test.mjs`：新增 15 项回归；`test/product-ui-poll.test.mjs` 只补充源码抽取测试所需的可选控制器依赖。

## 验证

实现前最小回归出现两个预期失败：HTML 图片被转义成文字、空 alt 的 Markdown 图片未生成预览容器。

本轮最终执行：

- `npm test`：281 项通过，0 失败，0 跳过。包括同期后端媒体测试。
- `npm run check`：58 个 JavaScript 模块语法检查通过。
- `git diff --check`：通过。

新增回归覆盖安全属性、路径白名单、代码原文、旧域链接回退、私有元数据桥、联网状态隔离、账号与仓库失权、并发和重试、去重与评论归属、data URI 限制、缓存复用及迟到结果。

## 待主代理验收

源码与自动测试已完成。本子任务未构建产物、安装插件、操作原生 Codex UI、提交或推送。真实四张附件的认证读取、浏览器自然宽高与 CSP、打包和本机宿主验收由主代理继续。自动测试通过不等同于桌面宿主已展示图片。
