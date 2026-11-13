# 桌面主题与独立图标验收

2026-11-04。已完成用户指定的配色和图标调整，最终本机安装 **Issue Hub 0.2.4**。沿用A布局、列宽、单击和数据流程，不重新开展方向选择。

## 配色

- 接收宿主初始hostContext及运行时theme/styles.variables；明确的宿主明暗模式优先系统偏好。基本背景、文字、边框与语义警告/错误使用SDK变量。
- 无宿主颜色时，亮色采用白/浅灰，暗色采用#212121/#171717/#2f2f2f；普通主按钮、选中、焦点、分割线为中性颜色，原绿色主色与遮罩已移除。保留错误和警告的语义色。
- 切换明暗清除旧宿主变量，同主题支持增量与显式清空；系统回退和close清理有回归。

主会话通过实际AppBridge通知，在同一真实Issue页面验证暗色→亮色→自定义暗色token→亮色清空→暗色五个状态，选择保持182，无横向溢出。自定义主背景#242424及文字#f2f2f2实际生效；清空后回到当前主题默认值。见 [稳定计算色记录](research/theme-browser-023-settled.json)。初次采样曾落在按钮120ms背景过渡首帧，未把该中间色冒充最终色；改为等待可观察的计算色生效后验证，亮色按钮为黑底白字，暗色反之。

已实际查看：

- [暗色1440×900](research/evidence/theme-dark-023/page.png)
- [亮色1440×900](research/evidence/theme-light-023/page.png)

截图的控制台、横向溢出及图片加载检查通过。这是实际可运行MCP浏览器联调，不冒充自动操作过Codex原生UI。

## 图标

采用双票据与连接箭头的独立轮廓，替代旧圆圈感叹号。插件SVG、页面currentColor标志及favicon同源；两个插件清单保持引用同一个asset。已查看 [16/24/32/64px亮暗底尺寸图](research/evidence/theme-icon-023/page.png)。Issue自身状态图标保留其语义。

除资源文件外，补齐公开MCP `serverInfo.icons` 的light/dark两项内联SVG，从实际asset读取，避免服务入口继续回退默认图标。只读核查本机桌面26.1027源码，`h1r`将`CA(serverInfo)`传入global入口，`CA`解析其icons，采用方式与现有Tokens实践一致。

0.2.3资源阶段的包外回归真实发现服务icons缺失（undefined而非2），因此补齐接入后以新0.2.4目录安装，未覆盖已运行旧缓存。当前SDK省略可选Tool.icons时不强行适配；没有私有注册表或处理器装饰，公开服务图标为必需并回读验证。

## 验证与安装

| 检查 | 结果 |
| --- | --- |
| 最终 `npm test` | 142项通过，0失败/跳过，含4项主题生命周期和实际asset→服务图标协议回归。 |
| `npm run check` | 40模块JavaScript语法通过；项目无独立lint/TypeScript检查。 |
| 构建与包外stdio | 0.2.4通过，一个global、UI可读、app-only写入不变；2项服务图标base64解码与asset逐字一致。 |
| 本机安装 | `codex plugin add issue-hub@yg --json` 安装0.2.4成功。 |
| 缓存 | [8文件SHA-256一致](research/installed-hashes-0.2.4.json)，包含新SVG与最终服务/页面。 |
| 独立宿主发现 | [7工具、1入口、2项服务图标](research/installed-product-0.2.4.json)，图标匹配asset，UI资源535925字节可读。 |

独立核查见 [主题/图标代码检查](research/theme-check-023.md)。本轮未重新测试不变的远端写入或桌面聊天；整体任务原有这些验收边界保留。没有提交、推送、正式发布或修改Tokens包。
