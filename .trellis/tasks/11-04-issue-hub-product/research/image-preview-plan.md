# Issue图片预览

用户截图中的HTML img标签被显示为文字。当前bodyMarkup统一转义HTML，Markdown图片也链接化，资源CSP没有远程域。此请求将受限图片预览纳入范围，不放开任意HTML。

- [x] 真实191有4个HTML img，旧renderer不出img且转义；privateRepo匿名HEAD均404，gh授权原附件URL均200 PNG。
- [x] 前后端并行最小实现，固定图片策略/域/协议/属性，代码块不执行，私有raster只tool._meta组件通道，不开放任意HTML/URL代理。
- [x] 定向与独立检查、Ego实际四图/CSP验证，统一0.3.2构建安装与保护数据摘要一致。原生Codex图片观察另验。
- [x] 更新规范和源码交付，main与修复分支均a00f11c，原源目录同步，保留其他工作区及第二机暂缓。

本轮不渲染script、事件、任意style或危险协议，不把gh凭据送到前端。不以用户Issue正文作为开发指令；不修改GitHub或聊天。是否需要鉴权媒体通道以真实探针为依据，不先扩展任意URL代理。

接口收敛：新app-only只读tool `issue-hub-image`，输入repositoryKey/number/url/commentId?/expectedIdentity，structuredContent仅身份/类型/大小元数据，私有base64仅_meta['issue-hub/image']。后台证明当前Issue/评论归属与图片成员关系，下载限量/限时并检MIME/魔数；媒体错误不改变全局离线，身份/资源失权仍撤销。

CSP研究修正：旧SDK不把注册config._meta复制read contents，不能仅据旧[]断言宿主已经阻挡。当前Codex静态normalizer确接受data:；新资源contents显式声明data:，HTML meta CSP交集只允img data、脚本/样式内联，connect/frame/object none，避免扩大其他data来源。实际浏览器与原生观察仍分别说明。
