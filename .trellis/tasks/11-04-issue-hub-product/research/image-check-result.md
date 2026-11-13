# Issue图片预览：独立检查

2026-11-05，trellis-check。唯一代码工作区为 `.worktrees/issue-hub-images-20261105`，分支codex/issue-hub-images，基线80848c2。已读取image-preview-plan、image-auth-research、image-csp-research及前后端实现报告。

本检查没有认证下载真实图片、操作真实用户配置/数据库/聊天、自动操作Codex UI、写GitHub、提交或推送。真实四张私有PNG的读取与Ego像素验收由主会话执行，不能用本检查的替身或包外协议代替。

## 后端权限与运输

- 新工具issue-hub-image仅app可见、readOnlyHint=true，严格参数，不接受任意API路径、命令或额外字段；模型侧固定只读Issue工具没有新增媒体写权限。
- 先严格联网读取当前仓库/Issue，不接受离线或缓存快照作为新媒体权限证明；expectedIdentity、凭据fingerprint及当前身份在下载前后复核。
- 正文图片须来自当前实际正文的受限解析结果；评论图片另取指定评论，核对真实comment ID与issue_url父归属，不能用其他Issue的评论授权。
- 单个附件403/404、大小、格式或运输错误只降级为局部IMAGE错误；重新核对Issue后，真正AUTH_REQUIRED、仓库失权继续走撤销规则，不把媒体失败当全局离线。
- 认证下载只接受现代 `https://github.com/user-attachments/assets/<uuid>`，无userinfo、非默认端口、参数或片段。历史Githubusercontent与外域不进入认证运输，前端只给原图链接；dummy企业凭据反例确认旧域没有运输调用。
- 通用JSON REST路径白名单未放宽。媒体走固定gh参数、Buffer stdout、默认20秒超时、5MiB payload上限及最多64KiB响应头余量；stdout在子进程层先受限。
- 返回前检查HTTP200、MIME与PNG/JPEG/GIF/WebP魔数，SVG/HTML/未知内容拒绝。令牌、stderr、原始响应头和签名跳转地址不返回前端。

## 私有数据与页面策略

- base64仅在工具结果 `_meta['issue-hub/image']`。structuredContent只保留schema、当前身份、MIME、大小和地址散列，文本固定简短；前端只在本地副本合并私有_meta，不把它写回model文本或Store持久投影。
- 未新增图片SQLite/blob存储。控制器仅当前账号/仓库/Issue范围内复用，缓存最多12项且合计16MiB编码字符串；此限制是缓存额度，不冒称浏览器全部解码内存仅16MiB。
- 资源实际contents._meta.ui.csp显式为connectDomains[]、resourceDomains[data:]、frameDomains[]，不依赖SDK自动复制descriptor。
- HTML额外meta CSP形成交集：只允data图片与既有内联脚本/样式，connect/frame/object/base/form均禁止；未开放GitHub/CDN远程域、任意HTML或data脚本。
- 当前资源键为ui://issue-hub/app-v2.html，旧app.html返回同内容及CSP作兼容别名，不增加global入口。

## 渲染与交互

- HTML img与Markdown图片只重建固定元素及src标识/alt/有界width、height；不透传事件、style、srcset或任意原HTML。其他HTML继续转义，行内及围栏代码保留文字。
- img真实src仅由已验证raster数据构造；用户原data/blob/javascript URL不作为可执行图片。原URL只作来源标识和显式原图入口。
- 懒加载、当前范围去重、评论归属分开、局部失败重试；单图失败不覆盖正文或未发草稿。CSS使用contain和响应式尺寸，不以固定裁切代替完整图片。
- 切账号、仓库失权、切Issue或关闭时清空控制器缓存与已知节点像素；旧范围或已脱离节点的迟到结果不回填。常规局部摘要/讨论刷新挂载新节点，不重建编辑器。
- Store媒体请求复用身份/仓库撤销保护，但不改变全局online或最后GitHub成功时间。既有读取恢复、草稿、焦点/选区及正常分页回归保持。

## 审查发现并修复

控制器原先在pump排队时校验范围，随后通过Promise微任务调用loadImage；实际派发前没有再核对。scan后立即切账号并clear时，旧entry仍进入真实Store.loadImage，Store会以新身份发出旧Issue图片请求。旧像素虽被结果valid挡住，也不应产生这次请求。

先用真实控制器加Store建立红回归，明确观察到1次请求而预期0；经主会话同意，只在微任务实际派发前重验范围/节点/来源，并在处理结果前再次退出失效entry。没有改身份协议、后端权限或网络设置。

红回归转绿；另补跨scope旧在途仍占并发槽的用例，确认active没有被clear重置，总峰值为2，新范围等待空槽，旧图不回填。未扩展其他重构。

本审查新增修改仅ui/images.mjs和product-ui-images.test.mjs，之后源码再次冻结。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 冻结候选完整测试 | 281项通过、58模块语法通过；Tokens35项通过。 |
| 审查修复后图片定向 | images-product＋product-ui-images共28项通过，0失败/跳过。 |
| 最后完整Issue测试 | 283项通过，0失败、0跳过、0取消。 |
| 最后语法检查 | 58个JavaScript模块通过；无独立lint/TypeScript配置。 |
| 最终0.3.2包外协议 | verify:toolkit通过：Issue9工具＋Tokens3工具，共12工具/2global；当前app-v2资源、旧别名与实际CSP断言通过，缺gh故障不阻断Tokens，skills仍可用。 |
| 范围 | git diff --check通过；host业务bridge、storage/schema、任务服务、Tokens业务、Hook与YG技能无本轮差异。 |

协议检查使用临时CODEX_HOME与脚本自有Issue数据目录，不查询真实Tokens统计或聊天，也不下载私有图片。主会话在本审查修复后统一重建YG0.3.2，协议检查针对该最终构建。

## 未修复项与真实验收边界

没有发现仍需修改本轮业务源码的阻断项。当前安全结论限定已研究的gh2.85.0、SDK1.2.2及当前桌面CSP契约，不把静态宿主normalizer接受data声明写成原生像素已实测。

主会话另报告四张真实附件MCP读取成功、PNG尺寸/SHA与认证探针一致、私有_meta及实际contents CSP正确；这些属于主会话真实服务层证据。本报告完成时，最终Ego四图naturalWidth/naturalHeight、实际画面、0.3.2本机安装/数据摘要与Git整合仍由主会话记录。

浏览器成功只证明正式HTML及当前预览CSP/Bridge链路，不是自动操作Codex原生UI。私有图片字节、真实截图和认证研究材料保留本机，不应随源码或插件公开提交。另一台真实Windows继续按用户安排暂缓。
