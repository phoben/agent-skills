# 原生悬浮侧栏纠正与调查

日期：2026-11-03。用户明确指出，目标是首页、资料空间、定时任务、代码审查等内置项悬停或点击后展开的原生左侧浮层。不是 Codex 主导航中多个插件图标，也不是插件页面自行绘制的列表。

## 已确认错误

0.1.2 注册了状态页和两个仓库共三个 global 工具。每个工具可生成一个主导航入口，与用户实际看到三个图标一致。旧测试断言两个仓库 global，验证了错误的交互目标，不能作为需求验收。

当前修复只消除多主入口，将诊断仓库工具降为 app-only、非 global。保留一个 Issue Hub 主入口，不宣称已经完成原生悬浮仓库树，也不将替代布局视为用户同意。

## 官方公开证据

- [官方 Extensions 概览](https://developers.openai.com/plugins/build/extensions) 将 global 定义为打开全屏应用的主导航入口，没有定义通用悬浮子项数据源。
- [官方完整规范](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md) 当前只定义 global、thread、file 入口及 deep link 等能力。核查的该文件 blob SHA 为 `513ebdabc7285bb5c1f5509d6f41ad743f1b7f34`，不能把 blob SHA 当提交号。
- [TypeScript global schema](https://github.com/openai/mcp-extensions/blob/9e6d418439cca0790bece62f6cd886ad4c04f133/typescript/src/shared/ui.ts#L6-L29) 是 strictObject，只接受 type 与可选 quickAction；没有 children、navigation、flyout 或动态树回调。
- [Python 对应类型](https://github.com/openai/mcp-extensions/blob/9e6d418439cca0790bece62f6cd886ad4c04f133/python/src/openai_mcp_extensions/ui.py#L15-L42) 一致。quickAction 是一个工具快捷操作，不是仓库项数组。
- [官方示例](https://github.com/openai/mcp-extensions/blob/9e6d418439cca0790bece62f6cd886ad4c04f133/plugins/bits-and-bolts/src/server/register.ts#L204-L235) 用快捷操作打开零件表单，不提供原生浮层树。

上述 SDK/示例固定到实际提交 `9e6d418439cca0790bece62f6cd886ad4c04f133`。仓库目录、patterns 和 changelog 也未找到通用 sidebar 子系统；这是当前公开范围的结论，不推断未来或私有 API。

## 本机实现

版本：`OpenAI.Codex_26.1027.3384.0_x64`，只读核查安装包，不修改或自动操作桌面。

- `app.asar::webview/assets/app-primary-998934e837fc.js:156` 的 `gEn` 从固定 `$O` 查 destination 的 sidebar area，另特判 Meetings 和 Codex Security，写入 `data-slate-sidebar-peek-area`。
- `app-initial-4267e52fe5b0.js:1045` 的 `k0r` 固定注册 home、scheduled、code-review、space 等，与用户举例一致。
- 普通 MCP `phn` 路径为每个 global 工具创建 destination、点击导航和快捷操作；没有第三方 children provider 或原生浮层装载契约。
- `sidebar-children-a9ad8f844caf.js` 导出 PageArtifactSidebarChildren，来自 Page 文档产物订阅，不是第三方 MCP 的 sidebar/list。
- Codex Security 的 setSidebar 属于固定 first-party bridge，不能据此向 Issue Hub 声明同名私有方法或冒用身份。

## 能力边界与后续

目标交互已理解并写入 R1/A1/V3。当前尚未找到普通第三方 MCP 插件可调用的子项注册字段、请求/响应 schema、更新通知或导航 capability；不编造接口，也不把源码内部存在的能力当作可用公开能力。

需要官方提供通用契约或可核验的第三方成功实例，才能继续按原生浮层目标实施。用户尚未同意页面内导航作为替代。P0 的该门槛保持未通过，旧协议和安装数据作为历史证据保留。
