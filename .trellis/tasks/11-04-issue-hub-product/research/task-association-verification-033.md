# 已发送聊天未关联：0.3.3

2026-11-04，用户确认已发送消息，并完整保留首行任务引用，点击“检查关联”仍pending。本轮已修复两处实际接口差异，0.3.3已安装，用户这次既有聊天已取得完整唯一关联。没有重新创建、打开或发送聊天，没有写GitHub、提交或推送。

## 真实根因

探针只访问当前GitHub/Codex双身份下用户指定nonce及同工作区的有界候选，不打印或保存聊天正文、认证信息、账号标识或其他聊天标题。

| 对照 | 实际结果 |
| --- | --- |
| 原thread/list同时传cwd/projectId | 0个候选。 |
| 同一cwd移除远端projectId过滤 | state-only返回4个，时间窗内1个；该新聊天暂时没有projectId。 |
| thread/items/list真实数据 | data行含turnId/item/startedAtMs/completedAtMs，原解析错误地在外层找type。 |
| 新聊天内部首条消息 | item.type为userMessage，第一行完整任务引用精确匹配；下一项是agentMessage。 |
| 时间与注入假设 | 时间窗没有误排除，首条消息没有被宿主上下文占据。这两项不是本次原因。 |

证据为task-association-probe-033.json、task-association-shape-033.json。旧0.3.2对该真实请求执行MCP check也返回pending、checkedCandidates=0，见task-association-live-check-033-before.json。

## 修复与约束

- 候选仅按精确cwd列举；本地仍拒绝显式不同projectId和不同cwd。当前注册项目、Git remote、时间窗和双身份复核保留。
- 严格解析一层官方turnId/item包装，并兼容旧裸ThreadItem。损坏、混合或任意未知嵌套拒绝HOST_PROTOCOL，不当成空且完整的页。
- 自动检查和人工resolve共用首条用户消息解析。代理文本、后续用户引用或正文任意位置出现nonce都不认领。
- 自动关联仍要求唯一匹配及完整候选/初始项覆盖，partial与歧义规则不放宽。

仅修改services/issue-tasks.mjs和对应product-tasks测试，未改界面布局、bridge白名单、认证或数据库schema。

## 验证与安装

两条准确红回归先返回pending，再分别修至linked；6条新增边界回归，任务定向29项通过。独立最终215测试通过、0失败/跳过，49模块语法通过。没有独立lint/TypeScript配置。见task-association-fix-result.md与task-association-check-result.md。

0.3.3已构建并成功安装到issue-hub@yg的新缓存。8文件SHA256一致；安装后App Server发现8工具、1global和正式UI可读。见installed-hashes-0.3.3.json和installed-product-0.3.3.json。

包外stdio功能断言通过。首轮临时目录清理遇一次Windows EBUSY，单独重跑退出0；这不是聊天关联失败，不隐去首轮清理异常。Windows ZIP已生成，路径和哈希见artifacts/final/package-0.3.3.json；第二台真实Windows仍未验收。

尝试清理首轮遗留的自有临时目录issue-hub-stdio-Cal5Cv时，自动审批返回“blocked by policy”并拒绝执行，未提供更具体原因。没有改用其他工具绕过删除，原目录保留；第二次检查的成功不代表首轮目录已经清除。此项不影响插件和已确认的关联。

## 用户这次请求的真实结果

对同一自有请求使用0.3.3执行check，没有另建请求或聊天，返回：

```json
{
  "status": "linked",
  "coverage": "complete",
  "checkedCandidates": 1,
  "candidates": 1,
  "hasThread": true,
  "referenceMatches": true,
  "returnTargetVerified": true
}
```

结果已保存到当前双身份作用域的本机SQLite。随后通过官方thread/read(includeTurns:false)再次确认真实聊天标识与原工作区，不读取完整对话；见task-association-live-check-033-after.json。API核验成功不等于原生深链返回已通过。

后续用户已明确确认“能看到返回会话，点击后回到刚才会话”，再确认实际工作区、手动发送及原未发送草稿保留；该真实闭环已通过。又核对当前含无聊天项目的仓库清单暂未发现缺少。Windows Computer Use技能禁止自动操作Codex桌面UI，实际点击来自用户，Agent没有代替操作；第二台Windows按用户明确要求暂缓，仍不标通过。

## 回归缺口与预防

根因属于宿主接口与测试夹具不一致：旧列表替身忽略projectId过滤，消息替身直接返回裸ThreadItem，所以两处实际差异都没有变红。此前原生端到端关联一直未验收，不能把隔离测试通过理解为真实关联通过。

本次将真实过滤行为、官方包装及其反例固定为回归，并补入backend规范。后续宿主升级同时检查请求筛选语义和返回wire shape，保持真实桌面、API关联与实际导航三个验收结果分开。
