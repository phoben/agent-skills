# 主题与图标增量检查

2026-11-04，独立 trellis-check。仅检查 `theme-023.md` 指定的配色、主题控制器、接入与独立图标，不重新审查既有业务/性能，不修改 Tokens。正式源码未作修正，检查时双清单与包仍为0.2.2，主会话随后统一升0.2.3、构建和安装。

## 检查结果

- `ui/theme.mjs`：显式宿主light/dark优先于OS；无显式宿主时使用系统偏好。主题变化清除此前应用的宿主变量，同主题增量保留未覆盖项；空变量对象可清除，reset清遗留，dispose移除系统监听。
- 主题只接SDK语义变量，拒绝覆盖页面accent、surface和列宽等自有变量。页面主表面、文字、边框映射SDK变量；普通主按钮、选中、hover、分割线和图标保持中性回退。错误/警告仍走独立danger/warning语义，不统一变灰而失去提示用途。
- `ui/app.mjs`：初次连接使用hostContext，onhostcontextchanged可同时处理主题与styles增量，onclose释放监听。改动没有替换布局、拖动、草稿、选择或数据服务逻辑。
- 双票据与连接箭头的图形结构明显不同于旧圆圈感叹号；插件SVG声明32×32，页面brand使用同一内部路径和currentColor。favicon解码后与插件SVG内容一致，双清单composerIcon/logo均引用 `./assets/icon.svg`。

## 验证

- `node --test test/product-ui-theme.test.mjs`：4项通过。
- `npm test`：141项全部通过，0失败、0跳过。
- `npm run check`：39个JavaScript模块语法通过。项目没有独立lint或TypeScript检查命令，不冒称二者已通过。
- `node .trellis/tasks/11-04-issue-hub-product/research/check-theme-assets-023.mjs`：favicon与SVG一致、双清单路径一致、独立票据轮廓检查通过。初次内联Python检查因PowerShell引号解析失败，改用只读文件脚本后通过，未因此改产品文件。

没有发现阻断本次构建/安装的代码问题。源码已冻结。主会话负责新产物实际浅深截图、运行时host主题/变量切换、32/16尺寸观感以及安装缓存核对；本报告未渲染图标，不能把静态结构检查写成实际小尺寸视觉验收。

## 0.2.4 MCP主入口图标接入补核

按主会话限定范围，只读核查 `src/icons.mjs`、`src/main.mjs`、`src/server.mjs`、`scripts/preview.mjs`、新增server协议回归及包外图标断言；没有展开旧业务、修改冻结源码或重复运行已通过的完整检查。

- main从安装产物相邻的 `assets/icon.svg` 读取实际资产，preview读取同一源码资产。`createIssueHubIcons` 将完整SVG以UTF-8编码为data URI，提供light/dark两项、SVG MIME和可伸缩尺寸声明，协议图标没有额外一套失同步绘制源。
- 正式服务通过公开MCP serverInfo的icons构造参数提供图标，主global工具声明同源icons；没有改写SDK私有注册表或装饰请求处理器。当前SDK会省略可选Tool.icons，不能据此宣称该字段必定可读，实际依赖的是公开服务图标路径。
- 新回归要求serverInfo存在两项主题图标并将base64解码结果与实际资产逐字比较；Tool.icons仅在SDK确有输出时核对一致。包外脚本同样读取复制后的安装资产核验，不依赖工作区路径。
- 主会话已提供当前宿主源码中CA读取serverInfo.icons、h1r用于global入口的实际调用证据，以及0.2.4最终142测试、40模块语法、包外两项图标/资产一致、安装8文件哈希和独立AppServer两项图标通过记录。此为主会话执行证据，本次补核未重复API或整包检查。

补核未发现阻断。服务图标协议、资产来源和测试边界一致；真实桌面是否已经刷新入口图像仍以主会话实际观察为准，不能只凭serverInfo读取结果推定桌面缓存已更新。
