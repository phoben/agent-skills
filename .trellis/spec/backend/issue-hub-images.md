# Issue图片预览契约（YG 0.3.2）

## 1. 范围与触发

修改正文/评论图片解析、二进制读取、app工具结果、缓存或CSP时读取。HTML img不显示与私有附件匿名404是两层问题，不能只取消HTML转义。入口不增加global，不开放通用下载代理。

## 2. 签名

- app专用只读工具`issue-hub-image({repositoryKey,number,url,commentId?,expectedIdentity})`。
- `createIssueImages({github,issues}).execute(payload)`返回`{envelope,image}`；`github.readImage(url)`返回`{mimeType,bytes:Buffer}`。
- `createImageController({getContext,loadImage})`提供`scan/clear/retry/close`，上下文包含identity、repositoryKey、number及store.generation；详情切换由clear递增控制器内部代次保护。

## 3. 请求、响应及环境契约

- repositoryKey为20位十六进制，Issue/评论号为正安全整数，expectedIdentity必填。后端读取当前非离线、非缓存的read-summary，要求networkChecked；图片必须来自此正文或已校验父Issue的指定评论。
- 身份与凭据指纹在下载前后复核。仅`https://github.com/user-attachments/assets/<uuid>`可认证预览；拒绝userinfo、非默认端口、查询、fragment和其他初始主机，旧图片域及外部图源保留原链接。
- 固定gh api二进制GET走github.com，沿用gh跨主机重定向不转交初始凭据的行为。限5 MiB、20秒、有界头部，MIME与PNG/JPEG/GIF/WebP文件签名一致；禁止SVG/HTML。
- `structuredContent`沿用schemaVersion、identity、sampledAt、offline、cached封装，data仅含mimeType、byteLength、assetKey。像素只在`result._meta['issue-hub/image']={mimeType,byteLength,base64}`，text不含字节、凭据或签名URL，SQLite不存图片。
- 当前URI为app-v2，app.html仅同内容别名。CSP必须显式写入实际`resources/read.contents[0]._meta.ui.csp`，不能只写注册config。resourceDomains仅data:，connectDomains为空；HTML内页另限img-src data:、script-src unsafe-inline、connect-src none，不能放行data脚本。
- 页面按原位置和比例懒加载，最多2个在途，跨scope旧请求仍占槽。内存缓存限12项/16 MiB字符，清除身份、仓库、Issue、详情代次的旧像素。队列出队和微任务实际派发前均复核范围，响应及image事件再次复核。

## 4. 校验与错误矩阵

| 条件 | 结果 |
| --- | --- |
| 页面身份不匹配、凭据变化 | IDENTITY_CHANGED，丢弃旧结果并清除旧像素 |
| 登录缺失或失效 | 保留AUTH_REQUIRED等真实身份错误，沿用撤销读取资格规则 |
| 图片不在当前正文/评论或父Issue不符 | IMAGE_SOURCE_REJECTED，不下载 |
| Issue离线或只取得缓存 | IMAGE_UNAVAILABLE，不用缓存替代当前权限 |
| 超限、非栅格、MIME不符 | IMAGE_TOO_LARGE或IMAGE_UNSUPPORTED，提供原链接 |
| 单附件403/404或下载失败 | 重新核对Issue权限，局部图片错误，不将整页假标离线 |
| 旧scope结果迟到 | 不派发或不回填，不恢复旧账号像素 |

## 5. 正常、基础与失败场景

正常：当前可访问Issue的HTML或Markdown现代附件在原位置显示；评论图片先验证评论父Issue。基础：旧图片域或外部图源保留安全链接，不调用图片工具。失败：下载中切账号，旧字节即使返回也不能绘制；离线仍可查看已缓存正文并保存草稿，私有图片不新读取。

## 6. 必须验证

`images-product.test.mjs`验证权限、归属、父Issue、指纹、URL限制、二进制/MIME/大小及私有_meta；`product-ui-images.test.mjs`验证安全解析、懒加载、缓存、并发、清除、派发前竞态和失败回退。verify:toolkit核对12工具/2入口、app-v2和旧别名实际CSP。真实只读服务核对字节摘要，浏览器逐图滚动核对naturalWidth/Height与比例；浏览器与协议不能冒充Codex原生像素观察或第二台Windows验收。私有像素、截图和研究凭据不得公开提交。

## 7. 错误与正确做法

错误：将远端HTML直接innerHTML、把任意URL交gh认证下载、只在注册config声明CSP，或将base64放进structuredContent。

正确：受限解析为固定容器，最新Issue证明访问和来源，专用二进制链路返回私有_meta；实际资源和内页同时限制CSP，所有异步阶段复核当前范围，失败保留原链接。
