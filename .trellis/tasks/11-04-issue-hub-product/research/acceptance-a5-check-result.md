# A5 来源信息与分页：独立最终检查

2026-11-04，trellis-check。承接acceptance-gap-audit-033审计及acceptance-a5-fix-result实现冻结。范围仅ui/app.mjs、ui/store.mjs及product-ui-poll/product-ui-store测试；本检查未追加修改业务源码，也没有访问真实业务库、聊天、原生Codex UI或GitHub写入。

## 已核查

- 来源区域区分附件正文未读/暂无/不可用链接，以及关联PR活动未读/部分覆盖/不可用/完整无结果。有效链接继续显示，按URL去重，标题转义，危险协议拒绝，不虚构来源。
- hydrateIssue首批活动完成后按当前仓库/Issue/账号代次，使用既有summaryPainter局部绘制来源区域。正文未变化不替换，评论节点、文字、选区、焦点与滚动保留；Issue编辑或保存期间不重建表单。
- 首批与后续活动页统一派生relatedPr，第二页独有PR不会遗漏，同URL不重复；coverage.loaded使用合并后的实际累计条数，comments的累计计数也维持一致。
- 显式“加载更多活动”只更新讨论与来源，正在聚焦的分页按钮允许替换，焦点返回新按钮或活动标签；其他正在使用的讨论控件仍保留。没有改为整页renderDetail。
- 分页等待期间切换Issue、仓库或账号，旧结果不绘制到新详情。Store原有revision、写入代次、账号失权和在途保护继续保留。
- 没有修改API、缓存或数据库schema、summary模块、CSS或其他插件。此前聊天关联、身份、预填不发送及历史回归继续通过。

## 真实传输QA脚本的防写审计

仅阅读offline-transport-acceptance-033.mjs及proxy-preserved结果，没有再次执行真实探针。

- 使用mkdtemp自有临时数据目录，子进程设置ISSUE_HUB_DATA_DIR，清理前验证绝对路径前缀，不接触正式业务库。
- 工具调用只允许query的bootstrap/refresh/list/read-summary和mutate的draft-save；任务操作、创建Issue、发布评论及其他远端写入全部拒绝。
- 独立GitHub核验仅固定Issue#5的GET前后比较，未调用POST/PATCH/DELETE。
- 在线进程保留原env；断连仅向测试子进程注入本地拒绝连接代理，不修改系统代理、网卡或用户正式配置。首轮helper误移除原代理的失败按历史保留，修正没有改变业务代码。
- 成功记录四阶段：在线种缓存→真实gh连接被阻断仍读正文且保存两类草稿→离线进程重启恢复→恢复联网只读且草稿保留、远端更新时间/正文/评论数不变。只有两次draft-save，deniedConnections=2，临时目录清理完成。

该结果可关闭A9受控传输数据层验收，不能冒称操作系统断网或原生UI断网画面已经验证。

## 发现与未修复项

没有发现本轮仍需业务修复的问题，源码保持冻结。主会话负责统一升0.3.4构建、立即安装、新包隔离安装及Ego真实只读页面抽查；本检查不以受控DOM断言替代最终画面。

用户最新已明确确认新聊天工作区、手动发送、原草稿保留及返回同一聊天，且核对含无聊天项目的清单暂未发现缺少。对应本机功能可闭合。另一台Windows按用户明确要求暂缓，仅准备交接，不作为本轮本机交付阻断；真实原生多路径、系统断网等未测分支仍保留注记。最新矩阵见acceptance-gap-audit-033.md。

## 最终验证

- 实现定向66项通过后冻结；原三条准确红回归及分页焦点红回归已转绿，共新增6条。
- 独立最终 `npm test`：221项通过，0失败、0跳过、0取消。
- `npm run check`：49个JavaScript模块语法通过。
- 项目没有独立lint或TypeScript配置，不将语法检查称为lint/type-check。
- 核查时包元数据为0.3.3候选，最终0.3.4构建与安装以主会话记录为准。

检查后不再修改业务或重复整套测试，保留其他会话EdgeOne技能dirty文件不动，没有提交、推送或正式发布。
