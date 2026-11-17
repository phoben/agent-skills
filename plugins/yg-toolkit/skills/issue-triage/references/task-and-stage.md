# Task 关联、阶段核验和交接

关联复用 `task.json.meta.source_kind === "github_issue"`，以及 `github_repo`、`github_issue`、`github_issue_url`。匹配 URL 主机、仓库及编号，字段矛盾列为缺项；标题和分支中的 #编号不算关联。活跃和 archive 都查；明确父子组可以是一个 Issue 的正常实现集合，不随意借用其他会话任务。

三种关系分开：meta 保存诉求来源，原生 task.json.workflow 保存实际流程选择，会话 runtime 只保存当前 Task 指针。当前 no_task 不代表 Issue 没有任务。Task 的元数据不保存远端最新标签、正文、评论、关闭状态。

## 判断阶段

- planning：核实际需求工件及最新批准，区分调研、设计、待批准；文件存在不等于获批。
- in_progress／review：核实际实施、自检、自动化及真实角色验收；不凭 review 贴 PR评审。
- completed／已归档：核提交、反馈、归档、最终远端 HEAD、PR 检查、发布和接受；归档不等于 Issue 完成。
- 父子组：按整体范围及集成关卡判断，不取最快子项或把部分完成变成父单完成。

证据不足时说明阶段待核实，给差异草案或保留适当现有标签，不补造成功。核验必须对应当前方案／代码版本，旧 CI 或旧接受无效。

## 活动任务保护

相同来源仍核对范围是否改变；另一独立 Issue 只做获准前置处理，建议匹配既有 worktree 或新建隔离环境，不自动切分支、创建、结束或替换当前 Task。真实属于当前交付目标的子项，经批准调整父计划和整体验收，分别维护 GitHub Sub-issue、Trellis parent／children；子 Task 来源指向自己的 Issue，不冒用父来源。

GitHub 和 Trellis 两侧关系不是一个事务。部分成功先回读，不能整批重建。当前 Task 没有父 Issue 时不为凑结构擅自创建父单；纯依赖也不能自动改成父子。登记子 Task 使用已有 create --parent／add-subtask，暂不切换时使用 --no-start，避免 create 默认激活抢占当前指针。

## 推荐继续

有任务推荐目标项目实际 trellis-continue 及未完成步骤；无任务在实时候选中推荐并展示选择，可合并批准“采用流程并创建关联 Task 进入规划”。已有档案待交付则携带原档案及分支，使用其真实交付入口，不重新 create／start／archive。当前平台无该技能时指向实际文档，不伪造命令。
