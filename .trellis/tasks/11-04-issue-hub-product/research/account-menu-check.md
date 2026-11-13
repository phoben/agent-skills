# 账号上拉菜单与连接入口：独立检查

2026-11-05，trellis-check。代码工作区唯一为 `.worktrees/issue-hub-account-menu-20261105`，基线a00f11c。按account-menu-plan和现有前端/overlay规范核查；没有修改原root源码、真实配置/数据库、GitHub或聊天，没有安装、提交、推送或自动操作Codex原生UI。

## 已检查的范围

- 项目栏底部只保留账号触发器，上拉菜单复用discover/reset-layout；没有新增登录、退出或凭据操作。账号未读取用本机用户占位，不能展示旧login，账号文字转义，不加载外部头像。
- 完整、待核对、部分覆盖、不可用分别保留真实状态。折叠时保留警示点及可读提示，打开后可见覆盖状态，不把发现不完整藏成成功。
- 连接检查位于底部连接状态旁，按钮有aria-label和title；账号或初次页面读取失败不阻断该入口。窄窗有独立紧凑账号触发器，隐藏项目栏时仍能操作。
- 菜单使用既有overlay、动作和焦点规则。重复点击关闭，外点/Escape退出，方向键/Home/End及Tab路径沿用菜单处理；菜单在触发器上方并受窗口边界约束。
- renderNav/status重画后更新overlayReturn到新触发器，仅更新菜单状态头，不替换当前菜单项；关闭时能返回新的锚点。底部诊断按钮被状态重绘时同样保留焦点。
- 窗口resize仍关闭菜单并重新同步窄窗结构；图片、三栏/分割线、草稿及业务读写流程没有新增权限或接口。

## 发现并修复

### 后台列表scroll误关账号菜单

主会话在亮色初始化中观察到菜单自行关闭。代码路径与之吻合：新增的全局scroll捕获会对任何菜单外滚动调用closeOverlay(false)，包括renderQueue恢复issue-list.scrollTop产生的程序性事件。

先执行实际事件监听器回归，账号菜单在issue-list滚动后关闭次数为1，预期0，准确变红。经主会话同意，局部修改为账号菜单忽略这种无关滚动，因为锚点固定在底部；普通操作菜单的滚动关闭保持，窗口resize仍关闭账号菜单。没有引入通用菜单重构。

### complete同时checking被显示为成功

缓存/元信息复用可以提供complete与checking=true组合。原discoveryStatus先判断complete，会省略待核对警示。

新增回归先得到warning=false而预期true，随后将checking判断放在complete之前；unavailable继续优先显示不可用。常规complete仍无警示，partial/loading及未知账号提示保持。

本检查新增业务改动仅app.mjs的scroll判断及account-menu.mjs的状态顺序；测试追加两条。其他实现者文件没有回退，manifest/dist/docs由主会话管理。

## 实际验证

- 初始冻结候选独立完整测试289项、语法60模块通过。
- 两条本审查回归先红后绿。
- 定向 `node --test test/product-ui-account-menu.test.mjs test/product-ui-tasks.test.mjs test/product-ui-experience.test.mjs`：38项通过。
- 最后完整 `npm test`：291项通过，0失败/跳过/取消。
- 最后 `npm run check`：60个JavaScript模块语法通过。项目没有独立lint或TypeScript配置，不冒称通过。

测试执行实际菜单绘制、锚点恢复与window事件监听器，不通过另写一套菜单逻辑来验证自身。既有账号隔离、私有图片、草稿、宽度、快速切换与加载失败诊断回归保持。

## 真实验收层与后续

主会话已报告实际Ego亮暗/窄窗截图的层级、比例和主题正常；暗色Home/End/Escape、重复开关、外点、诊断及返回焦点通过。那是主会话的浏览器观察，不是本检查自动操作过Codex原生UI。

两处审查修复后源码已冻结。主会话最终回报YG0.3.3重新构建及verify:toolkit通过，Issue9工具＋Tokens3工具、2个global保持；同一Ego空间27的三轮交互全部通过，包括程序性列表scroll不关账号菜单、诊断、键盘及重置，1120亮暗和960窄窗最终截图无溢出，空间已结束。

主会话另完成0.3.3本机安装，159文件SHA及实际App Server的9＋3工具/2入口核对通过，业务保护行摘要一致。上述属于主会话的真实浏览器/安装层证据，本检查未重复操作profile，也未将其描述为原生Codex UI自动验收。最终仅本地收尾，不推送远端。

没有遗留需要扩展业务代码的阻断项。另一台真实Windows仍按用户安排暂缓，不将原型、受控DOM、Ego或包外协议称为全场景原生验收。
