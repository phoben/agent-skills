# Research: Issue图片的MCP App CSP与安全渲染

- Query: 私有GitHub图片通过后端受限字节返回后，使用data URI或Blob的最小CSP与安全渲染方式；验证当前preview是否真正执行策略。
- Scope: mixed；本机SDK1.2.2、Codex桌面26.1027.3384.0静态代码、当前仓库及官方OpenAI文档。
- Date: 2026-11-05

## Findings

### 1. 当前不显示首先是渲染规则，后续还有鉴权与CSP

`packages/issue-hub/ui/ui.mjs:35-71`的inlineMarkup将Markdown图片输出为链接，普通HTML经esc转义，故HTML img不会成为DOM图片。正文`ui/app.mjs:207`与评论`:245`均用bodyMarkup，两个位置都受影响。根会话另已对用户指定191确认私有附件匿名404，不能仅新增远程img来修复。

### 2. 资源CSP必须出现在resources/read实际内容上

`packages/issue-hub/src/server.mjs:25`当前把csp放registerAppResource的config._meta，但contents只返回uri/mimeType/text。

本机SDK `node_modules/@modelcontextprotocol/ext-apps/dist/src/server/index.js`的registerAppResource（函数fZ）只直接调用registerResource，不将config._meta复制给read callback结果。格式化只读副本见research/image-sdk-server-readable.js:224-227。

官方说明将 `_meta.ui.csp` 放在resource contents；新实现应在返回contents条目中显式声明，也可保留descriptor配置一致。必须用实际resources/read断言contents._meta，而不是只检查源代码常量或listResources。

### 3. 官方约定没有每指令的图片专用资源白名单

SDK `dist/src/spec.types.d.ts:438-472`说明resourceDomains映射img-src、script-src、style-src、font-src、media-src。只为了图片加入data或blob会同时扩大宿主的这些静态资源指令，因此不能把resourceDomains理解为仅img allowlist。

官方文档只说明域声明与映射，没有保证每个宿主在resourceDomains=[]时默认允许data或blob。本机SDK类型仅限制string[]，不能据此证明实际沙箱行为。

### 4. 当前Codex客户端明确接受data/blob，但不是原生图片成功证据

只读检查本机app.asar内`webview/assets/resource-104414a99f7e.js`：

- le函数读取 `_meta.ui.csp.resourceDomains`，传递到resourceDomains，includeDefaultDomains=false；它还将resourceDomains并入connectDomains。
- U函数显式接受`data:`和`blob:`，而普通域限制HTTPS/WSS及无userinfo。这是当前26.1027.3384.0客户端对声明这两种scheme的正面证据。
- MCP widget包装器`public-mcp-widget-3c827f6d4229.js`继续把上述resourceDomains传给沙箱，不自行加默认data源。

局部探针保存在image-csp-asar-probe.json、image-csp-host-probe.json、image-csp-targets.json；这些是本机静态代码研究材料，不应随插件或公开提交。

静态客户端接受声明并不等于已证明Codex实际iframe按该声明加载私有图片。本研究没有操作Codex原生UI，也没有读取私有数据库。

### 5. 推荐data URI承载，并用文档CSP收紧宿主通用资源授权

优先后端完成认证读取、尺寸限制及PNG/JPEG/GIF/WebP MIME和magic校验，返回受限raster字节。前端只将经验证的后端结果组成data URI；用户正文自己写入的data:、blob:或javascript:地址不直接渲染。

推荐资源contents显式声明 `connectDomains: []`、`resourceDomains: ["data:"]`、`frameDomains: []`。当前客户端可以接受data声明；无需放GitHub/CDN远程域，不需要blob生命周期管理。

在正式APP HTML head再添加更窄的CSP meta，利用多策略交集，让data能力仅用于图片：

```text
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data:;
connect-src 'none';
frame-src 'none';
object-src 'none';
base-uri 'none';
form-action 'none'
```

脚本/样式是现有内联bundle，Bridge用postMessage，不需要组件自身fetch。该文档策略没有给script/font/media增加data或blob；即使宿主通用resourceDomains授权更广，文档交集仍收紧。前端无需fetch数据再造Blob，直接img.src=dataURI即可。

若选择Blob，要另外允许img-src blob并在切Issue/账号/卸载时revokeObjectURL；没有当前需求上的优势。禁止为了图片放开https:*、任意iframe或任意HTML。

### 6. preview当前确实有CSP，但它不是原生Codex策略

`packages/issue-hub/scripts/preview.mjs:75-77`对父页和/app都设置HTTP CSP：default none、script/style unsafe-inline、connect self、frame self、img-src data。故它已经能测试data图片，不必加入远程GitHub域。

preview不是从resource._meta动态构造策略。因此浏览器成功只能证明当前HTTP策略下的正式HTML/Bridge/后端链路，不能替代宿主metadata或原生UI验收。应同时做resources/read元信息断言、HTML meta策略断言，以及真实浏览器自然尺寸验证。

### 7. 最小renderer/controller边界

- 只识别HTML img和Markdown图片，不放开完整HTML。固定生成自己的元素；只提取src/alt和有界正整数width/height，丢弃事件、style、srcset、任意id等属性，文本与URL再转义。
- 原图URL只作为被验证来源标识及点击后host.openLink的链接；img的实际src必须来自当前身份/Issue下的后端图片结果，不用用户原始URL自动匿名请求。
- 代码围栏与行内代码保持literal。危险协议、userinfo、非默认端口和非允许GitHub附件域拒绝；外域仅保留安全手动链接。
- 后端图片必须属于指定Issue正文，或指定评论且评论父Issue匹配；不能将接口扩成任意URL代理。调用前后保留当前账号、repo权限、身份指纹保护。
- 图片失败仅显示局部说明与原链接，不应让单个图片404把整个Issue误标离线。令牌/授权头永不送前端，签名跳转URL不进入日志或持久状态。
- 官方reference说明tool result._meta只对组件可见，建议将私图base64放_meta，structuredContent只保留身份、mime/size/assetkey等小元数据；现有app call wrapper只返回structuredContent，需要专门媒体接收路径而不是悄悄忽略_meta。
- controller在渲染/分页后的新节点挂载，使用代次、identity、repo、Issue及节点仍连接的检查拒绝迟到结果；不重建评论或编辑器，不持久保存图片字节。建议data URI省去Blob清理。

## Files Found

| 文件 | 责任 |
| --- | --- |
| packages/issue-hub/ui/ui.mjs:35-71 | 当前HTML转义、MD图片链接化与正文块解析 |
| packages/issue-hub/ui/app.mjs:207,245 | 正文/评论调用点，媒体controller挂载位置 |
| packages/issue-hub/ui/style.css | 响应式图片尺寸、占位和失败说明 |
| packages/issue-hub/src/server.mjs:25 | 实际资源contents CSP与app-only媒体入口 |
| packages/issue-hub/scripts/preview.mjs:75-77 | 真HTTP CSP及只读工具通道 |
| packages/issue-hub/test/product-ui-store.test.mjs:498 | 当前图片不输出的安全断言，需改为仅允许固定占位/可信结果 |
| SDK dist/src/spec.types.d.ts:438-472 | CSP字段含义与映射 |
| SDK dist/src/server/index.js:fZ | 注册helper不自动合并contents元信息 |

## Suggested Verification

1. Renderer：真实img格式、MD/空alt、代码块、属性注入、危险协议/外域、尺寸边界；证明没有复制原始onerror/srcset/style或生成script。
2. Controller：data MIME/base64边界、错误回退链接、切账号/Issue不赋旧src、节点被替换时丢结果、正文和评论分页挂载。
3. Backend：同Issue/评论父属、权限与身份前后、未属于当前内容的URL拒绝、只固定HTTPS附件、重定向与auth边界、MIME/magic/最大字节、私图不在structuredContent或日志。
4. CSP：resources/read的contents._meta与APP meta交集；无远程域/无data-script/blob-script授权。
5. Ego正式页面：在只读后端链路下等待每图complete且naturalWidth/naturalHeight均>0（complete单独不足）；核对响应式无横向溢出、失败状态有原图入口。只保存必要截图/计数，不输出图片base64或授权头。

## External References

- OpenAI官方UI文档：https://developers.openai.com/plugins/build/chatgpt-ui （已搜索并打开；CSP放resource contents、最小声明域、resource URI缓存键）。
- OpenAI官方reference：https://developers.openai.com/plugins/reference （已搜索并打开；_meta.ui.csp、tool result._meta组件私有）。
- 本机SDK版本1.2.2；本机Codex桌面26.1027.3384.0静态包。没有将其他版本行为当当前事实。

## Related Specs

- .trellis/spec/frontend/issue-hub.md：当前图片链接化规则需按新需求更新，Markdown安全、草稿/焦点与异步归属继续保留。
- .trellis/spec/backend/issue-hub.md：身份/权限、私有缓存、固定REST和app-only能力边界；媒体不得成为URL代理。

## Caveats / Not Found

- 未找到官方明确保证resourceDomains=[]时data/blob默认可用的声明；采用显式data声明而不猜默认。
- 当前Codex客户端显式接受data/blob不等于原生iframe已经实际加载图片成功；最终仍需把浏览器与原生观察分开报告。
- 官方建议将资源URI当缓存键，破坏性HTML/JS/CSS更新用新URI。本次CSP新增应特别验证宿主是否取到新的contents元信息，避免旧URI的长期缓存造成假阴性；是否需要URI修订由实现者结合兼容范围决定。
- 未执行任何真实图片认证下载、用户配置、业务DB或插件安装，本话题没有产生媒体像素/凭据。认证GET路径由另一研究代理验证。
