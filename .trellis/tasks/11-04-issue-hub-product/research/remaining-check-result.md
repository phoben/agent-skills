# 剩余功能独立检查

2026-11-04，trellis-check，范围以 `remaining-030.md` 为准。审查当前确认写入重放、稳定Codex身份及精确legacy兼容、绑定/历史/歧义确认、连接检查与其UI/MCP接入。未重复执行真实GitHub写入或打开聊天，未操作Codex原生UI，未提交推送。

## 已检查

- 稳定Codex身份由规范home和可信accountId计算，auth/config文件指纹仅控制连接和在途结果。同账号配置或凭据刷新保持持久身份，换账号或home继续隔离。真实R6遇到额度接口阻断后，任务实现者追加当前home受信任auth.json的明确ChatGPT身份读取；无本机ID才走官方account/read(refreshToken:false)，不以额度网络作为身份前置条件。读取前后指纹守卫、APIkey/损坏文件拒绝和无敏感字段输出已核对。
- legacy兼容服务只访问可信读取精确重建的旧作用域，不枚举其他作用域。请求、索引、双身份、nonce及归属在同步事务内验证，异常回滚，原库不删除；prepared导入为待核查，不重新打开未发送草稿。最新生产bridge对本机身份与旧额度身份的同义性没有证明，因此legacyIdentity返回null，不进行猜测迁移；服务兼容路径由可信精确身份注入回归验证，不把它写成所有旧记录已实际迁移。
- bind只更新后续工作区偏好，不改当前或历史请求的原路径。历史可展示未确认本机记录并禁用返回；open-history仅接受当前Issue、当前双身份自有且已linked的请求ID，服务再次复核真实thread工作区，不接收任意threadId，不替换current。
- check保存通过完整首行nonce与路径核验的候选；自动关联要求完整唯一。resolve只接受当前已保存候选，再读thread/首条nonce/工作区和双身份，事务内复查候选与既有关联；并发不同选择不能相互覆盖，不自动打开或发送。
- reference来自实际nonce生成的完整任务引用；UI保留原会话路径与后续绑定的区别，候选无默认勾选。异步绑定、历史、候选及诊断弹层通过身份/对象/弹层代次避免迟到覆盖。
- 诊断不依赖成功bootstrap或GitHub登录；固定空参数app-only只读工具，无任意命令参数和自动安装。版本探测不用shell，原始stderr、存储错误、token、聊天正文及本机私有路径不进入返回。SQLite只创建/清理本检查自己的临时文件。
- 服务discovery.warnings最终为中文string[]，与前端读取一致；状态转换中文，checking明确。早先对象/字符串的交接差异已由主会话修正，本检查没有再并发改同一UI文件。

## 已修复

`src/diagnostics.mjs` 的快速扫描覆盖解释只匹配旧DEEP_SCAN_PENDING，实际目录输出CATALOG_DEEP_SCAN_PENDING时退为泛化原因。已补同义映射并增加实际警告码回归，未扩大诊断能力。

## 确认写入重放与界面恢复

- confirmed回执须匹配当前稳定账号、仓库ID、动作和规范请求摘要，Issue权限和评论作者仍按当前远端核验。同ID不同请求/对象拒绝，新请求旧基线照常冲突；旧无requestSignature回执只在既有摘要可证明一致时保守兼容。unknown/readback-failed不因重试自动再投。
- 评论更新时间单独推进时，关闭/重开只比较目标相反状态并仅PATCH state，不用整条updatedAt误判状态冲突；普通标题/正文/属性编辑的revision保护未放宽。真正状态变化仍报冲突，不覆盖其他成员字段。
- confirmed重放保留operation的历史成功快照，同时只读取得最新Issue投影供后续写入。读取失败返回issue:null/projectionFresh:false，成功回执不降为unknown；恢复检查只读，首次readback-failed的一致性核验保留。身份/401/403/404错误继续拒绝。
- 审查识别的新跨层缺口已交原前端实现者修复并交叉复核：三保存路径都携带成功operation；confirmed只显示“仅重新读取”，连续空投影保留回执、输入与恢复入口，不邀请再次提交。状态修改catch同样接恢复条。新增回归直接运行实际控制器。

## 最终验证与交接

- host、任务、UI任务/诊断、诊断服务与server定向41项通过。
- 诊断小映射增量4项定向通过。
- confirmed及状态最小修复后服务与空投影UI定向40项通过；本检查未与原后端/前端实现者并发修改其文件。
- confirmed/UI/身份冻结阶段 `npm test`：185项通过。纳入reuseOnly后188项通过；随后真实R8暴露的绘制修复纳入后，最后一次实际 `npm test`：195项全部通过，0失败、0跳过。`npm run check`：49个JavaScript模块语法通过。检查时仍为0.2.4候选，主会话随后统一0.3.0构建安装。
- 主会话负责已授权仓库的真实写入、构建/安装及Windows可转交材料。Fixture、孤立SQLite和协议结果不冒充真实桌面草稿/会话或另一台Windows验收。

项目未配置独立lint或TypeScript检查，二者不冒称通过。检查代码已冻结，本轮没有遗留阻断构建的已知问题。GitHub非原子更新的竞争窗口及未取得的真实桌面/第二台电脑证据仍按验收矩阵保留；Windows材料脚本可单独增量核查，不因此重复已通过的整包检查。

## 最后小增量：返回复用与Windows材料

- `reuseOnly`：前端存在current且非另建时明确发送true。服务必须在当前双身份作用域找到精确requestId并匹配仓库/Issue，前于Issue/thread读取和新claim；缺失时REQUEST_UNKNOWN，不回退当前请求或新建草稿。false默认创建流程保持，true与another冲突拒绝；未引入全局expectedCodexId协议。对应跨Codex账号旧返回、未知ID、同账号配置更新、精确legacy与UI开关回归已纳入188项最终结果。
- Windows打包入口只复制8个明确插件文件并生成独立review市场、安装器、manifest及README。输入为普通文件，双清单版本与CJS/HTML构建标记核对；fresh临时stage以绝对目录前缀守卫清理。压缩/列举使用Windows .NET Zip标准库，没有跨shell拼接用户路径，也未修改正式YG源或钩子产物。
- 安装器带UTF-8 BOM支持PS5，SHA256用.NET流并释放资源。CheckOnly仅核对本机依赖、文件和doctor结果，不注册安装；同版直接返回，较新版本阻止降级，已有正式Issue Hub拒绝并装。注册只指向明确独立的issue-hub-review源，依赖缺失给提示，不自动安装工具。
- doctor复用正式 `--doctor` 分支，返回安全检查字段，不发布Issue或发送聊天。安装日志展示版本检查与操作结果，未主动读取或打印凭据/原始认证文件；包不携带用户配置、缓存或本机登录数据。
- 已读取主会话 `bundle-provisional-check-02.json`：隔离profile的CheckOnly及真实review安装成功，actualUserProfileModified=false、cleaned=true、secondMachineVerified=false。它证明材料与隔离安装流程可运行，不能冒充第二台真实Windows验收。

最后一次完整检查后不再修改冻结业务或重复真实接口。主会话提供的Issue#5 original/resume闭环、清理结果、doctor和真实身份检查按其各自记录归档；本检查未争用当前真实前台轮询Page或GitHub写入。

## 真实R8：自动刷新详情绘制

主会话用真实前台轮询复现列表行标题已更新、详情H1仍旧。前端实现者用该触发条件先建红回归，增加 `ui/summary.mjs` 局部只读摘要绘制。本检查仅复核这条实际链，没有重开既有业务或视觉方向。

- 自动strict摘要到达后直接更新当前标题、正文、属性和来源链接，不再依赖manual=true或cached=true。H1程序焦点不会阻止只读摘要更新。
- 不重建评论输入区域、H1或属性按钮对象；滚动位置、评论value/选择范围/焦点保留。未变化正文不替换；正在使用的正文或链接控件只延后对应区域，标题仍可更新，离开控件后续绘制。
- Issue表单编辑不覆盖，远端版本变化提示输入保留。审查补充 `state.saving` 早退，覆盖“轮询先开始、随后才进入写入”的在途竞态，写入结束后仍可正常局部更新。
- 原前端poll回归与体验回归加审查pending写入回归，17项定向通过。最终完整195项及49模块语法检查通过。

源码已冻结。主会话在18296复用授权Issue#5进行真实60秒第二波验证并负责恢复标题；本检查没有争用该Page、发布额外评论或修改远端内容。实际计时、读回、构建/包外/安装及最终Windows包以主会话最后记录为准。
