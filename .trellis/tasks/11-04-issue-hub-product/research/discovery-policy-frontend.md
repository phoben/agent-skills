# 固定项目范围：前端与诊断

基线3a777eb，唯一代码工作区`E:/Develop/agent-skills/.worktrees/issue-hub-discovery-policy-20261105`。本轮用户明确取消项目扫描覆盖提示，覆盖旧菜单partial提示规范；实现沿用该明确要求。

## 改动

- `ui/account-menu.mjs`移除发现状态计算及账号组件对catalog的依赖。菜单保留“项目与布局”标题及原两项操作，账号按钮不再输出状态行、提示点或aria/title覆盖说明。未知账号占位保留。
- `ui/app.mjs`同步调用，静态菜单标题不在后台刷新时重画；原锚点重绑、菜单焦点、键盘、诊断入口和窄窗账号入口保持。无仓库时提示“当前项目中未找到GitHub仓库”；读取中和实际不可用有各自明确文案，不将它们改成成功。
- `ui/style.css`删除已无对应元素的发现状态/提示点样式，其他菜单和布局样式保持。
- `src/diagnostics.mjs`仅将明确ROOT/GIT/桌面读取错误映射为安全说明。固定深度/数量边界、链接排除和旧缓存检查进度不映射为问题；未知字符串或私人路径不回显。真实项目错误令总体诊断为warning，具体版本、身份、存储检查仍各自报告。
- 尚未扫描的初态（无采样、warning、error且非loading/checking）仍为not-scanned；真实失败即使尚无采样时间也保留unavailable。该细节由主会话复核后补充回归，避免将初次未读取误标成故障。
- `ui/diagnostics.mjs`区块改为“项目读取”，complete/partial都描述在既定项目范围已检查。未读、加载、后台检查和不可用仍明确。兼容过滤旧版正常边界代码及已翻译说明，实际目录/Git错误继续展示。
- 对应`product-ui-account-menu.test.mjs`、`diagnostics.test.mjs`与`product-ui-tasks.test.mjs`已更新，旧覆盖警告断言由新固定范围契约替换。

Issue列表、评论、活动的分页范围未改；没有改catalog/services、业务库、身份、任务打开、版本或dist。backend和root在共享工作区的其他变更未回退。

## 验证

运行`node --test test/product-ui-account-menu.test.mjs test/diagnostics.test.mjs test/product-ui-tasks.test.mjs`：最终33项通过，0失败、0跳过。

`npm run check`：60个JavaScript模块语法检查通过。`git diff --check`通过。项目没有独立lint或TypeScript配置，不将语法检查称作类型检查。

生产源与测试均已冻结。主会话负责独立检查、完整回归、Ego视觉与真实只读项目发现、统一构建及安装。本代理没有操作Codex原生UI、安装、GitHub写入、Git提交或推送。
