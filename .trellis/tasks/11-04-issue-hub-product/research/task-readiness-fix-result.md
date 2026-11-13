# 创建任务被缓存目录挡住：实现记录

2026-11-04，针对用户0.3.0桌面截图修复。没有操作Codex原生UI、打开或发送聊天、修改GitHub、提交推送。版本元数据由主会话管理。

## 复现与假设

先增加真实createCatalog与createIssueTasks组合回归，refresh/remap后restore模拟新进程首页缓存，openUri只用替身。运行：

`node --test --test-name-pattern="从首页缓存恢复后" test/product-tasks.test.mjs`

修复前1失败，错误CATALOG_CHECKING，文案与截图一致：“正在核对项目和工作区，请稍后再创建任务。”调用链open→chooseWorkspace→catalog.resolveWorkspace。另用实际createTask控制器回归复现首次核对期间按钮没有立即忙碌反馈、重复点击进入多次准备。

假设依次为：缓存/quick目录checking而显式任务动作不主动核对；后台刷新失败导致checking长期保留；独立GitHub网络读取失败同时显示离线。主会话真实stdio的before-bind另证前两项链路：完整刷新后bind成功，重启缓存bootstrap后bind报同一错误，online始终true。因此不能把截图里的离线提示直接归因此目录错误。

## 最小改动

- ui/store.mjs新增prepareTask：缓存目录待查时走正常query.refresh，更新目录和连接状态；核对失败不调用open，身份变化停止旧动作。createTask与bind同样调用，供直接调用者保护。
- ui/app.mjs在显式创建的首次latest之前调用prepareTask。首次准备和打开期间立即显示“正在核对工作区…”，禁用主按钮并设置aria-busy；防连续误点，准备完成自动继续原操作，失败/结束恢复按钮。后台latest仍不触发扫描聊天。
- services/issue-tasks.mjs在显式工作区动作前按需严格refresh，防止页面显示就绪后服务重启、后端恢复缓存的情况。复用IssueService现有刷新去重；原catalog checking及Git remote校验保留。reuseOnly先验证精确当前域请求，不能通过preflight退化为新建。
- 未修改catalog.mjs的缓存/remote安全门，也未更改store中离线错误分类。只允许query成功恢复在线，任务成功不冒充GitHub连接成功。

## 定向验证

`node --test test/product-tasks.test.mjs test/product-ui-tasks.test.mjs test/product-ui-store.test.mjs`

77项通过，0失败、0跳过。新增覆盖：真实目录缓存重建后自动核对并继续；移除桌面项目后拒绝打开；核对中GitHub身份变化拒绝；初始离线但query联网成功才解除；核对失败保留离线与草稿且不open；实际控制器的忙碌/去重/自动继续，以及实际按钮aria-busy文字恢复。

业务源码已冻结交给独立trellis-check。完整检查、0.3.1构建/安装、真实stdio after-bind及用户桌面再次观察由主会话承接。此回归的openUri替身不能当真实新聊天通过。
