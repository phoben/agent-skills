# Claude-to-Kimi Skill Rewrite Design

## 背景

当前 `skills/claude-to-kimi/` 的首版实现基于不完整的 Kimi 规则认知，存在三类核心偏差：

1. 把 `agents` 视为 Kimi 中没有官方对等组件的资源，默认建议降级到 `AGENTS.md` 或 Skill。
2. 把工作区 Skill 的首选落点写成 `.kimi-code/skills/`，与当前确认的共享目录策略不一致。
3. 对插件斜杠命令、hooks 事件模型和工作区 / plugin / shared 三类资源的边界说明仍然偏粗。

用户已确认需要进行一次全面重写，目标是让 `claude-to-kimi` 技能与 Kimi 官方文档在 `agents`、`commands`、hooks、skills 存放位置上的规则保持一致，并让配套脚本也输出相同结论。

## 目标

本次设计只覆盖 `skills/claude-to-kimi/` 这组迁移技能及其配套文档、脚本、模板，不涉及仓库中其他技能的行为变化。

本次重写目标如下：

- 让 `agents` 成为正式迁移目标，而不是默认进入“无官方对等组件”的保守结论。
- 让工作区 Skill 的默认落点改为 `.agents/skills/`。
- 让插件命令与 hooks 的规则与 Kimi 官方文档保持一致。
- 让文档、脚本、模板三层口径统一，避免“文档说能迁、脚本却报 manual-review”的冲突。

## 不做的事

- 不新增独立的 Agent 模板文件。
- 不扩展到业务代码迁移、第三方平台鉴权或模型切换。
- 不重构仓库内其他技能的结构。
- 不为 Kimi 未公开支持的运行时字段发明新的 manifest 字段。

## 官方规则结论

### 1. Agents

Kimi 官方支持自定义 Agent 文件，并按以下目录发现：

- 项目级：`.kimi-code/agents/`
- 共享级：`.agents/agents/`
- 用户级：`~/.kimi-code/agents/`、`~/.agents/agents/`

Agent 文件是带 Frontmatter 的 Markdown 文件，正文为系统提示词。常见关注字段包括：

- `name`
- `description`
- `whenToUse`
- `override`
- `tools`
- `disallowedTools`
- `subagents`

因此：

- Claude / Codex 的 `agents` 不应再被笼统描述为“没有官方对等组件”。
- 但 `agents` 也不属于 `kimi.plugin.json` 的 manifest 字段，不能被写进 plugin 清单中。
- 对来源 `agents` 的默认判断应是“优先迁到 Agent 目录”，而不是“优先落到 `AGENTS.md` 或 Skill”。

### 2. Skills

本次重写采用用户确认过的目录策略：

- 工作区 / 共享默认目标：`.agents/skills/`
- 仅在确有 Kimi 专属项目作用域需求时，才建议落到 `.kimi-code/skills/`

因此后续文档与脚本都要把 `.agents/skills/` 作为默认工作区 Skill 目标。

### 3. Commands

Kimi 官方支持插件斜杠命令，命令应通过 `kimi.plugin.json.commands` 声明，并落在 plugin root 内的 Markdown 文件或目录中。

因此：

- Claude / Codex 的命令类 Markdown 资源默认迁往 plugin `commands/`
- 工作区侧不再把“项目级命令目录”当作一等结构，而是需要时改写为 Skill

### 4. Hooks

Kimi hooks 的配置位于 `~/.kimi-code/config.toml` 或 plugin manifest 的 `hooks` 字段中。hook 通过 stdin 接收事件 JSON，靠退出码或 stdout JSON 影响主流程。

关键结论：

- hook 仍然属于协议改写型资源，不能直接复制 Claude 配置。
- 事件模型应按 Kimi 官方事件表书写，包括 `SubagentStart`、`SubagentStop` 等观察型事件。
- 文档和模板都要强调阻断型事件与观察型事件的区别。

## 设计决策

### 决策 1：重写 `agents` 的总体表述

所有文档中涉及 `agents` 的旧结论都改为：

- `agents` 在 Kimi 中有官方对等能力，但目标位置是 Agent 目录，而不是 plugin manifest 字段。
- `AGENTS.md` 仅承载长期规则、团队约束、角色边界或术语约定。
- Skill 仅承载更像工作流、提示模板或能力说明的内容。

只有在以下场景中，来源 `agents` 才进入 `manual-review`：

- 文件不是合法的 Agent Markdown
- Frontmatter 缺失关键字段或命名不合法
- `override`、`tools`、`disallowedTools`、`subagents` 的语义无法稳定映射
- 内容实质上是仓库说明文档，而不是 Agent 定义

### 决策 2：重写目录分流规则

将资源映射统一成三条主线：

- shared：`.agents/skills/`、`.agents/agents/`
- workspace：`.kimi-code/skills/`、`.kimi-code/agents/`、`.kimi-code/mcp.json`
- plugin：`kimi.plugin.json`、plugin root 下的 `commands/`、`hooks/`、`scripts/`

其中：

- Skills 默认走 shared 目录
- Agents 默认先判断走 `.agents/agents/` 或 `.kimi-code/agents/`
- Commands 默认走 plugin
- Hooks 默认走重写

### 决策 3：让脚本与文档结论一致

`inventory-kimi-sources.js` 与 `analyze-kimi-migration-diff.js` 都要同步重写，不允许继续输出旧口径。

具体要求：

- `inventory-kimi-sources.js` 必须扫描来源和目标中的 `agents` 目录
- `analyze-kimi-migration-diff.js` 必须把 `agents` 当作正式资源类型参与对比
- `agents` 不再一律输出到 `needsManualConfirmation`
- manifest 中的 `tools`、`apps`、`inject`、`configFile` 仍继续保持风险提示

### 决策 4：模板只修正已有口径，不额外扩张

模板层只做必要修订：

- `templates/kimi.plugin.json` 保留 plugin 官方支持字段，不暗示 plugin 可以声明 `agents`
- `templates/config.toml.hooks.example` 对齐官方事件名与示例场景
- `templates/mcp.json` 只做口径校正

不新增 Agent 模板文件，避免把技能设计绑死到单一样例。

## 文件级改动计划

### 1. `skills/claude-to-kimi/SKILL.md`

需要重写以下内容：

- 概述与适用范围
- Kimi 目标结构总览
- 资源映射总规则
- `agents` 迁移注意事项
- 高自动化执行流程
- 失败策略
- 快速检查清单
- 触发示例

重写后必须体现：

- `agents` 可迁移到 `.kimi-code/agents/` 或 `.agents/agents/`
- `.agents/skills/` 是默认 Skill 目标
- `AGENTS.md` 不是 `agents` 的默认落点
- plugin `commands` 与 hooks 的规则贴合官方文档

### 2. `references/claude-plugin-to-kimi-map.md`

映射矩阵改成：

- shared / workspace / plugin 三类目标并列
- `agents` 明确写为 Agent 目录目标
- `instructions` 与 `AGENTS.md` 分开讨论
- `commands` 明确是 plugin 斜杠命令

### 3. `references/kimi-plugin-spec.md`

保留 plugin manifest 规则，但修正：

- `agents` 不是 manifest 字段
- 不再写成“没有官方对等能力”
- 要补充命令文件与 hooks 的官方规则表述

### 4. `references/kimi-workspace-spec.md`

重点重写为：

- `.agents/skills/` 与 `.kimi-code/skills/` 的分工
- `.agents/agents/` 与 `.kimi-code/agents/` 的分工
- `AGENTS.md` 的定位
- Agent 文件格式、优先级与适用范围

### 5. `scripts/inventory-kimi-sources.js`

需要新增或调整：

- 来源与目标 `agents` 目录扫描
- 目标摘要中输出 `.kimi-code/agents`、`.agents/agents`
- 建议动作中加入“优先迁移为 Kimi Agent 文件”的提示
- 默认 Skill 目标判断改为 `.agents/skills`

### 6. `scripts/analyze-kimi-migration-diff.js`

需要新增或调整：

- 对来源 `agents` 与目标 Agent 目录做 diff
- 为 `agents` 提供 `toAdd`、`conflicts`、`same` 的判断
- 只在非法 Agent、语义不清或冲突时进入 `needsManualConfirmation`
- 不再将全部 `agents` 归类为缺少官方对等能力

### 7. 模板文件

`templates/config.toml.hooks.example`

- 对齐官方事件命名
- 至少保留一个观察型事件示例

`templates/kimi.plugin.json`

- 保留合法字段
- 不引入任何 `agents` 相关暗示

`templates/mcp.json`

- 仅做必要说明校正

## 验收标准

完成实现后应满足以下标准：

1. `SKILL.md`、三份 reference 文档、两个脚本、三个模板的口径一致。
2. 文档中不再出现“Claude 风格 agents 在 Kimi 中没有官方对等组件”这一结论。
3. 文档中明确 `.agents/skills/` 是默认 Skill 目标。
4. 文档中明确 `agents` 默认目标是 `.kimi-code/agents/` 或 `.agents/agents/`，而不是 plugin manifest。
5. 两个脚本都能识别和处理 `agents` 目录。
6. hooks 说明与模板符合 Kimi 官方事件模型和返回值语义。
7. plugin 命令说明与模板符合 `commands` 字段和斜杠命令规范。

## 风险与注意事项

- 旧文档中的若干示例是成体系互相引用的，重写时需要避免留下前后矛盾的旧路径。
- `agents` 虽然有官方对等能力，但来源 Agent 是否可直接复用仍取决于 Frontmatter 和系统提示词内容，脚本不能过度乐观。
- 用户明确要求默认 Skill 目标采用 `.agents/skills/`，即使官方还支持 `.kimi-code/skills/`，文档也必须把后者降为条件性选项。

## 实施边界

后续实现阶段只修改以下路径：

- `e:\Develop\agent-skills\skills\claude-to-kimi\SKILL.md`
- `e:\Develop\agent-skills\skills\claude-to-kimi\references\claude-plugin-to-kimi-map.md`
- `e:\Develop\agent-skills\skills\claude-to-kimi\references\kimi-plugin-spec.md`
- `e:\Develop\agent-skills\skills\claude-to-kimi\references\kimi-workspace-spec.md`
- `e:\Develop\agent-skills\skills\claude-to-kimi\scripts\inventory-kimi-sources.js`
- `e:\Develop\agent-skills\skills\claude-to-kimi\scripts\analyze-kimi-migration-diff.js`
- `e:\Develop\agent-skills\skills\claude-to-kimi\templates\config.toml.hooks.example`
- `e:\Develop\agent-skills\skills\claude-to-kimi\templates\kimi.plugin.json`
- `e:\Develop\agent-skills\skills\claude-to-kimi\templates\mcp.json`

## 通过条件

当用户审阅并确认这份 spec 后，再进入实现计划编写阶段；在此之前不修改技能正文、脚本和模板。
