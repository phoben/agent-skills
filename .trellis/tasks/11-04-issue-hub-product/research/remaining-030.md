# 剩余功能推进

2026-11-04，用户明确要求继续剩余开发；现基线0.2.4。保留已确认布局、中性主题、独立图标、列宽与加载提速，不重开方向选择。不提交、推送或正式发布。

## 当前清单

- [x] 核对原需求与实现，区分缺功能与外部验收。任务审计见remaining-tasks-audit.md。
- [x] 补齐确认写入重试、会话稳定身份/绑定/历史/歧义核对及连接检查。
- [x] 本项目仓库真实Issue管理闭环通过，关闭并清理验收Issue的临时属性。
- [x] 浏览器和包外检查通过；修复真实自动刷新问题，生成Windows验收包并完成隔离配置安装。
- [x] 独立Trellis核查通过；0.3.0构建安装，8文件哈希一致，验收矩阵及规范已同步。
- [ ] 待真实观察：Codex原生桌面草稿保护/工作区/发送后关联往返、完整项目覆盖，以及另一台Windows成员安装。任务保持in_progress。

最终结果见 [0.3.0验收记录](remaining-030-verification.md)，首轮失败的原始记录继续保留。

## 真实写入授权

用户已明确答复“可以就用本项目仓库”。当前origin已核实为 `https://github.com/phoben/agent-skills.git`。真实写入集中到新建的唯一验收Issue，验证标题/正文、关闭重开、本人评论新增/编辑、现有标签、负责人、里程碑及重复操作回执，最后关闭验收Issue。当前工作流没有issues/labeled自动触发器；仍避开ready-for-agent等业务调度标签，优先复用既有普通标签/里程碑。没有授权修改已有业务Issue或提交推送。

## 明确功能范围与责任

- 后端写入：同一confirmed operationId在当前身份、仓库、对象和请求摘要匹配后，先返回已确认结果，不先用旧基线误报冲突；不同请求仍拒绝，未知/读回失败不重投。所有权services/issues及回归。
- 会话：Codex持久身份使用规范home与可信accountId，连接auth/config指纹只作在途守卫。同一账号配置更新/授权刷新不能丢关联；不同账号仍隔离。仅当前精确legacy作用域能证明归属的记录可保守兼容，未知漂移旧scope保持、不枚举猜认、不删除。迁移/兼容不能重复打开待发草稿。
- 工作区：提供修改后续任务绑定入口；已有聊天仍保留原路径，新绑定用于之后另建。历史只返回当前Issue/当前双身份自有已确认记录，不接受任意threadId导航。
- 歧义：check返回同请求、同工作区、完整nonce验证过的候选；自动只在完整唯一时关联。显式人工确认只接受服务保存的候选，再验当前身份、真实thread/cwd/project和首条nonce后关联，不按标题/时间猜测、不自动发送。返回正确reference而非将requestId误标nonce。
- 诊断：新增app-only只读环境/连接检查，检查Node24、Git、gh/Codex版本、GitHub登录、项目接口/任务身份、本机存储。返回安全状态/修复建议及覆盖原因，不显示token或聊天正文，不自动安装或修改成员配置。

任务代理负责host/bridge、services/issue-tasks及测试；前端代理负责ui与测试；root负责新诊断服务、MCP工具/组装、真实验收脚本、分发材料、版本与安装。共享工作区不回退他人变更。

## 交接接口

会话新动作暂定 `open-history`、`resolve`，由任务/前端对齐字段后报root加入固定task枚举；所有写/打开保持expectedIdentity。历史返回不悄悄替换当前优先聊天。绑定修改仅bind不自动另建。

新工具 `issue-hub-diagnostics`：app-only、readOnlyHint=true、空严格参数；返回 `{schemaVersion:1,data:{status,checks,discovery,sampledAt}}`。checks每项 `{id,label,status,version?,message,action?}`，status `ok/warning/error`。GitHub项可显示当前login，不返回凭据；Codex会话身份不可用允许Issue管理继续但注明任务受限。工具不要求已成功bootstrap，便于授权/连接失败时打开检查。

原生桌面草稿位置/保留/手动发送后往返和第二台真实Windows结果仍需真实证据，不以独立AppServer或另一配置目录冒充另一台机器。继续完成可独立实施部分，再明确保留这些边界。
