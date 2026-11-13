# A 连读队列交互原型

本目录只供界面与交互评审。所有仓库、账号、评论、路径和会话状态都是独立演示数据，不读取真实账号、Git remote、文件或 Token，不请求 GitHub，也不打开或发送真实 Codex 聊天。保存只写入浏览器的独立 localStorage 命名空间；保存后会重新读取，刷新页面后仍可找回。

模块和 fixture 从同一静态服务读取，不需要 npm、框架或生产构建。不要直接通过 `file://` 打开。当前预览入口为 `http://127.0.0.1:18286/`。

Windows 的普通静态服务可能把 `.mjs` 识别成 `text/plain`，导致页面停在读取状态。请从仓库根运行本任务的独立预览脚本，它仅绑定本机并显式声明模块 MIME，不修改系统映射：

```powershell
python .trellis/tasks/11-03-issue-hub-ui-prototype/research/serve-prototype.py --directory .trellis/tasks/11-03-github-issue-plugin/ui/prototype/a-v1 --port 18286
```

## 操作入口

首次进入是列表。点击 #184 打开详情，关闭后回原行和原滚动位置。1120×880 使用 164px 仓库导航、316px 队列和详情余宽；960×680 仓库退到页面内抽屉，队列 280px；低于 900px 只显示当前详情，可返回列表。界面跟随系统主题，`theme=light` 或 `theme=dark` 可单独检查。

列表支持输入即搜索、状态/标签/负责人筛选、清除条件、切换仓库、新建 Issue。`team/platform-api` 有独立内容，`team/docs-site` 为空仓库。详情的“更多”可编辑或关闭/重开；属性也能进入同一编辑表单。讨论支持分页、新增评论和编辑当前账号的评论。切换对象、仓库或离开详情前先保存本机草稿，保存失败时阻止导航并给重试、放弃或继续编辑。

“返回会话”打开关联上下文与本机引用；不会打开真正的聊天。“创建任务”在单一有效工作区或有效已记绑定下直接准备并显示未发送草稿，只有首次多工作区或失效绑定才选择路径。“另建任务”保留旧记录与关联。草稿中的“标记已发送”只推进本机演示记录，之后“检查关联”依次展示请求已发送、关联待确认和确认结果；不创建 thread。多匹配时须明确核对，不自动选中。

关联 PR 保留来源 URL，但点击只打开本地来源说明，不访问 GitHub；附件可直接下载本目录数据生成的文本。原型的真实来源链接跳转与宿主握手仍须正式集成验证。

## 隔离与场景

用 `run=任意名称` 为每轮检查建立独立存储空间。相同 run 刷新后复用数据、草稿和故障消费记录，便于核对保存后读回；换一个 run 可重新触发一次性故障。`issue=184` 可在读取完成后打开该条，截图可用，正常首次入口不带此参数。

| 参数 | 从实际操作进入的结果 |
| --- | --- |
| `scenario=offline` | 显示缓存；编辑/评论只能存本机草稿。“重新连接”后仍须手动提交，不自动发布。 |
| `scenario=save-error` | 首次实际提交 Issue 或评论失败并保留输入，重试后保存并读回；刷新同 run 不重新注入故障。 |
| `scenario=conflict` | 首次保存现有 Issue 时加入独立远端版本，保留本机输入，显示比较与采用远端/保留本机入口。 |
| `scenario=draft-error` | 首次切对象或离开前保存草稿失败，阻止离开；重试可恢复。该场景将故障留给明确导航，不提前由自动保存消费。 |
| `scenario=read-only` | 可浏览，界面说明读取权限，不提供 Issue 和评论写入入口。 |
| `scenario=account-change` | 点击手动刷新后切换到第二个演示账号，立即清旧视图和在途结果；只显示新账号支持工具仓库。旧草稿留在原账号空间。 |
| `scenario=loading` | 首次读取延迟并显示对象行骨架，不补零或误写空仓库。 |
| `scenario=unavailable` | 首次读取失败，点击重试后正常加载。 |
| `scenario=ambiguous` | 请求经过待确认后检查关联，显示多个可能关联，须明确核对当前任务。可打开 #182，或创建/另建后标记发送并检查。 |
| `scenario=invalid-workspace` | 旧绑定失效；#181 的“创建任务”或 #184 的“另建任务”要求重新选路径，取消不会生成新请求。 |

例如：`?run=save-01&scenario=save-error`、`?run=dark-01&theme=dark&issue=184`、`?run=narrow-01&scenario=offline`。不要将本机原型的保存、检查或关联结果当成真实 GitHub、gh 身份或 Codex 验收。

## 稳定定位

| 对象 | 选择器 |
| --- | --- |
| 仓库与仓库搜索 | `[data-action="repository"][data-repo="team/platform-api"]`、`#repository-search`、`#drawer-search` |
| Issue 与搜索 | `[data-action="open-issue"][data-number="184"]`、`#issue-search` |
| 筛选 | `#filter-label`、`#filter-assignee`、`[data-action="filter-state"][data-state="closed"]` |
| 新增与管理 | `[data-action="new-issue"]`、`#issue-more`、`[data-action="edit-issue"]`、`[data-action="change-state"]` |
| Issue 表单 | `#issue-form`、`#issue-title`、`#issue-body`、`input[name="labels"]`、`#issue-assignee`、`#issue-milestone`、`#save-issue` |
| 评论与分页 | `#comment-form`、`#comment-body`、`#save-comment`、`[data-action="more-comments"]`、`[data-action="edit-comment"][data-comment-id="c-1"]` |
| 会话与工作区 | `#task-primary`、`#task-more`、`[data-action="another-task"]`、`input[name="workspace"]`、`[data-action="confirm-workspace"]` |
| 任务状态 | `[data-action="task-sent"]`、`[data-action="task-check"]`、`[data-action="task-resolve"]` |
| 冲突与草稿恢复 | `[data-action="use-remote"]`、`[data-action="force-save"]`、`[data-action="retry-leave"]`、`[data-action="discard-leave"]`、`[data-action="stay"]` |
| 详情返回、抽屉与刷新 | `#close-detail`、`#repository-drawer`、`[data-action="refresh"]` |

箭头键只移动仓库/Issue 行的焦点，Enter/Space 打开对象。菜单方向键选择、Esc 关闭并回触发器；弹层限制焦点，关闭回原入口。多行编辑器 Enter 只换行。三处反馈为详情进入、菜单/弹层出现、提交结果；减少动态效果时直接显示。

## 本地检查

`node --check app.mjs`、`node --check store.mjs`、`node --check ui.mjs` 核对模块语法，`node self-check.mjs` 用隔离内存存储核对保存后重新读取、失败重试、冲突、离线、身份与在途请求隔离及会话状态。它们不能证明浏览器视觉、真实服务或宿主集成通过。真实浏览器操作、两档画布与浅深主题、独立视觉及 UX 评审由主会话另行记录。
