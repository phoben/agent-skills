# 图片预览本机结论（YG 0.3.2）

## 根因与改动

用户截图中的HTML img被安全渲染器转义；原Markdown图片也只提供链接。目标私有仓库的四个现代附件匿名请求均404，不能只开放浏览器远程img解决。现使用受限HTML/Markdown解析、app专用只读媒体工具、最新Issue/评论归属与访问核对、gh二进制读取，像素仅在私有_meta返回当前页面。

只支持现代github.com/user-attachments/assets/UUID的认证预览，限5 MiB和四种栅格格式。旧图片域/外部来源保留原链接。前台懒加载2并发、有界内存缓存，换账号/Issue清除旧像素，局部图片失败不污染整页联网状态。app-v2避免旧宿主资源键缓存，原app.html同内容别名兼容；实际contents元数据与内页CSP分别声明。

## 已通过

- Trellis implement双责任实现及独立check；check修正实际派发微任务前换号竞态，新增红回归转绿。最终283项Issue测试、58语法模块、35 Tokens测试通过，verify:stdio及verify:toolkit通过（12工具/2global）。没有重跑无变更的19项Hook历史结果。
- 候选和实际安装CJS分别读回四图，PNG字节尺寸与SHA一致；structured/text不含base64。仅元数据证据见image-service-live.json和image-installed-live.json。
- Ego同一空间26：首轮等待解码超时，检查时首两图已加载，剩余屏外图仍等待；第二轮依次滚动接近四图后均loaded/naturalWidth、Height正确。只凭首轮超时不能归因生产故障。最终image-browser-final.json通过，实际截图已view_image观察，比例和布局正确，无横向溢出。私人截图不提交Git。
- 完整Windows包159插件文件、10技能、5安装说明文件；CheckOnly与安装成功。实际AppServer发现YG0.3.2下Issue9/Tokens3、新URI与CSP可读，无旧独立Issue服务。
- 真实业务库升级前后schema1、受保护行8条、摘要一致（image-preview-data-before/after.json），无GitHub写入、聊天创建/发送或业务库迁移。
- Ego空间26已finish({keep:[]})关闭。当前自动验证不操作Codex原生UI，原生图片像素仍由用户打开页面观察；不重复索要已通过的会话和项目验收。第二台真实Windows按用户安排暂缓。

## 交付

本机已装YG0.3.2，关闭重开Issue Hub可读取新页面；附件加载失败仍可重试或打开原图。干净交接包与公开源分开，包及私人验收材料不提交。最终Git收据另存image-preview-receipt.json。
