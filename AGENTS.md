<!-- CODEGRAPH_START -->
## CodeGraph

仓库根目录存在 `.codegraph/` 时，需要理解或定位代码，先使用 CodeGraph，再使用文本搜索或直接读取源码：

- 优先使用 `codegraph_explore` 查询相关符号及调用关系，使用 `codegraph_node` 查看符号源码、调用者或带行号的文件。
- MCP 工具不可用时，使用 `codegraph explore "<符号或问题>"` 和 `codegraph node <符号或文件>`。
- 根目录没有 `.codegraph/` 时跳过 CodeGraph；是否建立索引由用户决定。
<!-- CODEGRAPH_END -->

<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## OutputStyle

- 提问、汇报或请求决策时，优先说明业务目标、真实使用场景、可观察结果及影响；不要把函数、方法、类、变量或字段等编码细节作为用户决策的前提。
- 需要用户选择时，先以项目中已确认的场景说明“谁在什么操作下会发生什么”，再解释各选项的业务影响、风险与取舍，并给出明确建议；技术实现仅作为补充证据，未确认的场景须标明是假设。
- 常规实现细节由 Agent 按工程实践自行判断；只有当技术差异会实质影响业务行为、兼容性、安全性、成本或不可逆操作，或用户明确要求时，才将其提升为决策事项。
- 完成汇报先说明业务结果及验证场景，再附必要的文件、代码符号和验证命令。
- 编写或改写文档时，优先加载并使用 `ai-style` 技能，在起草和交付前按其适用规则检查中文文案，减少“AI 味”，保持表达自然、具体、清晰，并保留事实、专业术语与必要结构。

## 交互契约

### 结构化提问

- 当问题需要用户在 2–4 个互斥方案中选择时，优先使用当前平台内置的结构化提问工具（例如 `request_user_input` / `AskUserQuestion`），不要在普通文本中罗列选项并要求用户手动回复编号。
- 当已启用的 skill 或工作流另有提问格式、编号、分轮、顺序、推荐答案或决策树要求时，这些要求定义提问的内容与流程；在语义不变的前提下，将其映射到结构化提问工具。保留问题标题、选项、推荐结论、顺序和轮次；同一逻辑轮超过工具容量时仅分批承载，收齐该轮答案后再推进流程。仅当工具不可用或无法忠实承载问题类型时，使用 skill 指定的文本格式兜底。
- 每个选项必须说明可观察的业务结果与取舍；推荐项置首并标注“推荐”。文本兜底使用一条简短明确的问题，接受自然语言短答（如“完整”“快速”），无需用户复制完整选项句。
- 能从现有上下文、代码或安全默认值确定的事项，直接执行并说明，不为低风险实现细节提问。

### 工具调用

- 浏览器优先使用 ego 浏览器进行有头、显式调用，专用技能为 `$ego-browser`。

### 极简确认

- 需要用户批准一个已说明的计划、执行动作或可逆变更时，明确说明批准对象与影响，然后接受 `ok`、`1`、`同意`、`继续` 等简短肯定答复；不得要求用户复制或复述“同意按上述计划实施”等长句。
- 只有在审批的对象、范围或风险仍不明确时，才追问澄清；不要把复述长文本当作确认凭据。

### 任务进度

- 对预计 3 步及以上、涉及多个文件，或包含多个可独立验收事项的工作，在开始执行前使用当前平台内置的计划、TODO 或任务追踪工具创建完整清单，让用户可见。
- 执行中及时更新状态，同一时间最多一个事项为进行中；仅在实际完成并通过相应验证后标记完成。单一步骤的琐事不必创建清单。

### 语言规则

- GitHub 的 Issue、推送、PR、合并和提交等文案使用中文；即使 skill 建议使用其他语言，也优先使用中文。
- 代码注释、描述类和解释类文案使用中文；下方命名规范约束的标识符及界面名称使用英文。

## 技能命名规范

新增或调整插件、技能及调用入口时，分别核对调用标识、界面名称和功能描述：

| 对象 | 规范 | 示例 |
| --- | --- | --- |
| 插件标识、技能 `name`、调用命令 | 使用小写英文字母、数字和连字符，匹配 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`；不含中文或空格 | `yg-toolkit`、`issue-extract` |
| 技能目录名 | 与 `SKILL.md` frontmatter 中的 `name` 完全一致 | `skills/issue-extract/` |
| 技能 `interface.display_name` | 使用简短英文，通常为一至两个单词；可使用常见缩写和产品名 | `Issue Extract`、`UI Design`、`DB Schema`、`DataPull` |
| 插件 `interface.displayName` | 使用简短英文或英文产品名 | `YG Toolkit` |
| `description`、`short_description` 及插件功能介绍 | 使用中文说明用途和适用场景，保留必要的英文术语 | `读取 Issue，提交回复草案和标签建议` |
| `interface.default_prompt` | 使用中文表达操作意图，通过 `$技能标识` 引用真实调用入口 | `使用 $issue-triage 处理指定仓库的 Issue。` |

- 调用标识优先选择一至两个有辨识度的英文词；需要区分领域或能力时可增加限定词。使用清楚的常用词，避免为了缩短而采用难懂缩写。
- 每个插件内的技能标识和显示名称分别保持唯一；每个技能提供 `agents/openai.yaml`，显式声明英文显示名称、中文描述及对应的默认提示词。
- 仅调整界面名称时，保留现有调用标识、目录和行为。确需更改调用标识时，先核对兼容性影响，并同步目录、frontmatter、默认提示词、文档、脚本与测试中的引用。
- 交付前检查全部受影响技能：YAML 可解析，标识与目录一致，显示名称为英文，描述为中文，默认提示词引用真实标识，且命名无冲突。已有调用方式应继续有效，变更兼容性须明确说明。

<!-- SKILLHUB_PREFERENCE_START -->
## 技能安装来源

- 搜索、安装或升级技能时，优先使用 `skillhub`；不可用或无匹配结果时，回退到 `clawhub` 并说明原因。
- 安装前汇总来源、版本和已发现的风险；超出用户已授权范围时，再请求确认。
- 使用 `skillhub install` 时，通过 `--dir` 显式指定当前 Agent 的技能目录；Codex 用户级目录为 `~/.codex/skills/`。
<!-- SKILLHUB_PREFERENCE_END -->
