# 创建任务目录核对：独立检查

2026-11-04，trellis-check，范围为task-readiness-plan.md。已读取当前任务PRD/设计/实施清单、check.jsonl所列规范及既有体验/主题/剩余功能材料。没有操作Codex原生UI、打开或发送聊天、写GitHub、提交推送；未争用实现代理修改中的文件。

## 已核查

- 原红回归使用真实createCatalog与createIssueTasks，缓存restore后open命中CATALOG_CHECKING；主会话真实stdio临时库bind同样复现，不能用初次完整refresh成功掩盖缓存恢复失败。
- 显式操作在checking/unavailable时主动刷新，复用正常IssueService与query投影。服务重新验证双身份和目录，catalog.resolveWorkspace原checking、项目范围和remote守卫保留；未通过就不打开。
- raw服务调用有后端ensureCatalogReady兜底；reuseOnly先验证精确当前域请求，不能靠目录刷新退化为新建。latest继续仅恢复自有请求，不扫描聊天。
- 前端正常query刷新才能更新GitHub联网状态；未修改离线分类，不把task成功当联网证据。目录核对失败保留本机草稿，身份切换停止旧任务。
- 首次prepare/latest起显示“正在核对工作区…”，按钮disabled与aria-busy同步；重复点击不重复准备，成功自动继续。准备与打开的finally都恢复按钮。
- 现有unknown/open-unconfirmed、已有关联、历史与人工候选规则未放宽。没有新增公共API或改变任务关联协议。

## 发现并修复

### 已就绪目录的异步让出执行窗口

`LiveStore.createTask/bind`新增await prepareTask后，即使目录本来就绪，也会让出一次执行。原prepareTask早退分支无法核对调用方恢复时的身份。已用两个实际Store回归复现：启动旧操作后切到99账号，原实现没有拒绝，并继续调用task。

局部修复：操作入口捕获generation/identity，在prepareTask返回后复核；变化报stale，不能发送task。没有改变公共签名。两条红回归已转绿。

### 打开前保存草稿期间切换对象

实际openTask控制器await flushDrafts后，之前只在createTask完成后核对对象。三条红回归证实，在保存期间切Issue、仓库或账号仍调用旧操作。

局部修复：保存结束、调用store.createTask之前核对overlay、repo、number与identity；变化立即停止，finally仍恢复按钮。三条红回归转绿，草稿保存路径保留。

### 首次草稿保护回调捕获过晚

实际createTask控制器在preserveBefore回调内才捕获对象。保存草稿期间切换后，旧点击会应用到新的Issue或账号。三条实际控制器红回归复现了prepare/latest和打开替身的调用。

局部修复：点击时捕获repo/number/identity，preserveBefore回调进入时先复核，再开始准备；后续原异步守卫继续保留。overlay仍在回调内捕获，避免破坏同一对象的草稿保存失败/重试流程。三条红回归转绿。

## 未修复项与证据边界

- 没有发现仍需修改本轮业务源码的阻断项。源码已冻结，0.3.1最终构建、真实after-bind、安装缓存与包外检查由主会话执行。
- 截图中的离线没有随CATALOG_CHECKING在真实stdio复现，不能宣称已证明是错误提示；当前实现仅按真实query联网结果恢复在线。
- 原生Codex实际新草稿、保留旧草稿及发送后往返仍需用户观察；测试openUri是替身，不能当真实聊天验收。第二台Windows同样尚待真实结果。
- 服务规范和前端规范需由主会话同步本轮主动核对、忙碌与异步身份/对象守卫。没有自行扩展其他历史导航流程或重构接口。

## 验证

- 原实现者定向77项通过后进入独立审查。
- 本审查补充8条先红后绿的回归，覆盖上述两个Store操作及两段实际UI控制器。
- 最后一次实际 `npm test`：209项通过，0失败、0跳过、0取消。
- `npm run check`：49个JavaScript模块语法通过。
- 项目没有独立lint或TypeScript配置；不将语法检查称为lint/type-check通过。版本元数据0.3.1由主会话管理。

冻结后不再修改业务或重复全套测试，后续仅主会话重建并核对最终安装产物。
