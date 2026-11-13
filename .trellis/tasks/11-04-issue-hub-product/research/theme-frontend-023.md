# 桌面主题与独立图标接入

2026-11-04，按用户明确改法完成。仅修改 Issue Hub 的颜色、主题接入和品牌标记；保留 A 布局、列宽拖拽、单击、数据、草稿和会话流程。

## 主题

先读取已有 Tokens `ui/theme.mjs`，再核对本地 `@modelcontextprotocol/ext-apps` 的 `styles.d.ts` 与 `spec.types.d.ts`。新增 Issue Hub 自己的 `ui/theme.mjs`，使用官方 `applyHostStyleVariables` 接收宿主 `theme` 和 `styles.variables`。

宿主明确亮暗时优先于 Windows 系统；无宿主主题时使用系统并跟随变化。切换主题会清掉前一模式的宿主变量，随后使用新变量或当前模式回退。相同主题的局部变量更新保留其他值，明确传空变量集合或 undefined 可清理；控制器销毁会移除系统监听。只接收 SDK 语义变量，宿主扩展字段不能直接覆盖页面的主色、表面或列宽变量。

页面的 surface、text、border 和语义告警映射官方变量。没有变量时使用中性白灰和炭黑，暗色基础为 `#212121`、侧栏 `#171717`、次级表面 `#2f2f2f`。普通主按钮、选择、焦点和分割线使用明确的中性色，不引用 success 或绿色强调。弹层遮罩也去掉原有绿色。红色错误和暖色告警继续承担原语义。

## 图标

新标记由两个错位 Issue 票据和连接箭头组成，不使用圆圈感叹号或 ChatGPT 结形标记。插件 SVG 为中性深底白线，页面品牌为相同轮廓的 currentColor；favicon 由同一 SVG 源编码生成。Issue 列表和正文的状态圆圈继续作为状态图标，品牌替换不影响其语义。

修改文件：`ui/theme.mjs`、`app.mjs` 的主题接入、`style.css`、`ui.mjs` 的 brandMark、`index.html` 的 favicon、`plugins/issue-hub/assets/icon.svg`。同步辅助脚本留在任务 research，不进入产品依赖。双清单仍引用同一 icon.svg，未改插件标识或显示名。

## 检查与交接

- 新增主题生命周期回归 4 项，覆盖宿主与系统明暗相反、宿主变量覆盖和切换清理、局部更新及显式清理、无宿主回退与监听销毁。
- 连同既有体验和 Store 回归，定向测试 53 项通过。
- `npm --prefix packages/issue-hub run check`：39 个 JavaScript 模块语法通过；不称类型或完整 lint 检查。
- SVG XML 可解析，受影响源文件的 diff 空白检查通过，旧绿色主题值与绿色遮罩已移除。

源码已冻结并交 root 进行真实浅深截图、宿主运行时主题切换和小尺寸图标视觉检查。本子代理没有用生命周期测试声称真实桌面视觉已通过，也未升版、构建、安装、提交或推送。

## 原生入口图标协议补齐

后续核对 Tokens 实践发现，仅替换插件 SVG 不能保证 MCP 服务入口获得品牌图标。补充纯 `src/icons.mjs` 工厂，由正式 main 和只读 preview 读取实际插件 `assets/icon.svg`，生成同源 base64 的 light/dark 两项标准 Icon，并传给 `createIssueServer` 的公开 serverInfo.icons。

global 工具配置也声明同源 icons，但当前 SDK 1.32.2 会省略可选 Tool.icons。按 root 明确取舍保留 SDK 原工具列表和处理器，不读取私有注册表、不复制业务 schema、不装饰或覆盖工具请求处理器；服务品牌通过已验证的 serverInfo 公开路径提供。

新增协议回归读取真实 SVG 文件，经过实际 MCP 初始化和工具发现，再将 serverInfo 两项 data URI 解码与源文件逐字比较；Tool.icons 若被 SDK 提供，也必须同源。该测试能抓住服务品牌仍使用默认图标的接入缺失，而非仅检查资产文件存在。正式/P0 两组协议测试共 4 项通过，40 模块语法通过。P0 server 未改，只读预览的主题辅助和写入限制未改。最终升版至 0.2.4、构建和安装由 root 执行。
