# 运行方式与平台边界

在选择服务端运行方式、适配框架产物或配置平台资源时阅读。先根据当前项目确认所需能力，再核对相应官方资料；无需逐项遍历无关运行方式。

以下是 2026-10-28 核对的部署要点，不是完整平台能力清单。版本、地域、配额、套餐可用性和具体配置以现行官方资料及目标账号为准。

## 静态页面与前端应用

HTML、CSS、浏览器 JavaScript、图片字体等资源进入实际构建输出目录。Vue、React 等框架是否需要服务端运行，由构建模式决定，不能只看框架名判断。

文件名大小写、资源引用、动态 import、客户端下载文件和客户端路由都需要在实际基址验证。接收成品时确认哪些目录是生成物，哪些是函数或其他运行入口，避免把服务端代码当作公开静态文件发布。

查阅 [构建指南](https://pages.edgeone.ai/zh/document/build-guide) 与 [edgeone.json](https://pages.edgeone.ai/zh/document/edgeone-json) 确认构建命令、环境和输出配置。

## 平台函数

| 接入方式 | 关键区别 | 官方入口 |
| --- | --- | --- |
| Edge Functions | 使用平台支持的函数处理方式，由根 `edge-functions/` 的目录组织生成路由；依赖需要适配边缘运行环境 | [Edge Functions](https://pages.edgeone.ai/zh/document/edge-functions) |
| Cloud Functions | 当前文档包括 Node.js、Python、Go 等运行时，语言版本、依赖和入口按对应规范确认 | [Cloud Functions](https://pages.edgeone.ai/zh/document/cloud-functions) |

函数代码复制到静态输出目录不会自动成为后端服务。按实际交付模式提供平台约定入口；通过框架适配器生成标准构建输出时，以适配器的规范组织产物。

Node.js 的文件路由使用根 `cloud-functions/`；Express／Koa 接入需导出框架实例，遵循文档中的函数入口组织，不沿用自行监听端口的启动方式。需要读取本地辅助文件或包含原生模块的包时，核对打包包含规则及依赖处理，不能因为开发机装有依赖就假设线上具备。[Node.js 运行规范](https://pages.edgeone.ai/zh/document/node-functions)、[函数打包配置](https://pages.edgeone.ai/zh/document/edgeone-json)

函数与静态资源路径冲突时，官方文档约定静态资源优先；构建方需检查目标路由是否实际触发预期函数。其他语言使用其各自入口和适配规范，不套用 Node.js 的文件约定。

## 服务端渲染与全栈框架

SSR 产物通常同时包含静态资源、服务端入口、依赖和路由信息。依据实际框架版本选择官方支持的适配方式，核对 [构建输出规范](https://pages.edgeone.ai/zh/document/building-output-configuration)，不能把 `.next`、`.output` 等目录一律当成可直接发布的静态成品。

多应用聚合时分别核对资源基址、服务端路由、框架保留路径、运行依赖和配置合并方式。一个框架生成的 `.edgeone` 输出不代表多个应用的同名目录可以直接覆盖合并。没有验证过的聚合方式，交付说明中写清适配需求，并保留现有应用行为。

## 路由与全站配置

`edgeone.json` 可覆盖项目构建及路由设置。来源应用加入聚合站时，应提供需要合并的配置与作用范围，沿用接收方的统一入口。

官方文档对精确的 `/*` → `/index.html` 配置有特殊 SPA fallback 约定：静态资源和函数先匹配，未命中才返回入口页面。不能直接推断 `/{应用名}/*` → `/{应用名}/index.html` 具有相同特殊语义。验证深链时同时检查真实静态文件、缺失资源和接口，不通过强制改成 hash 路由回避用户已确认的 URL 需求。[路由配置说明](https://pages.edgeone.ai/zh/document/edgeone-json)

## 存储与外部服务

应用自行选择 KV、Blob、外部数据库或其他服务。交付时说明资源绑定、环境配置与调用方式；服务器密钥留在受控运行环境，浏览器只接收允许公开的配置。

当前官方 KV 文档限定在 Edge Functions 中使用，并采用最终一致性；namespace 按项目绑定，不按应用子目录自动分配。使用 KV 时核对读写语义是否符合本应用需求；生产、预览、当前版和历史版的数据关系按应用声明配置，不假定平台自动隔离。[KV](https://pages.edgeone.ai/zh/document/kv-storage)

需要长期保存的文件使用应用选定的持久化服务，不能把函数运行时的本地文件写入视为可靠持久化。依赖外部服务时提供真实接入要求和未就绪项；本地 mock 或内存数据不作为持久化已完成的证据。

## 能力与配额核查

只核查当前应用用到的限制：静态文件大小与数量、函数包和依赖大小、请求体、执行时长、运行版本、存储容量及读写语义。附件或任务超出直接托管能力时，在应用需求允许的范围内使用外部存储或服务，说明其部署依赖，不擅自删减功能。

额度不要固化成技能内的永久阈值；查阅 [限制与配额](https://pages.edgeone.ai/zh/document/limits-and-quotas) 和 [价格与套餐](https://pages.edgeone.ai/zh/document/pricing-and-plans)。官方页面冲突时采用保守估计并列出待核实项，不能挑更宽松的数值保证可运行。
