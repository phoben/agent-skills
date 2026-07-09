---
name: claude-to-trae
description: |
  当需要把 Claude Code、Codex、ZCode 等工程化配置迁移为 Trae 标准目录时使用此 Skill。适用于新建迁移、增量适配、结构规范化与迁移诊断。

  触发场景：
  - 需要把 `.claude/`、`.codex/`、`.zcode/` 的 skills、commands、hooks、agents、MCP 等迁移到 `.trae/`
  - 需要扫描项目中的多套工程化配置，并生成 `.trae/skills`、`.trae/rules`、`.trae/commands`、`.trae/hooks.json`、`.trae/mcp.json`
  - 需要判断源 `agents` 应转为 `.trae/skills/` 还是 `.agents/skills/`
  - 需要把已有非标准 Trae 配置重组为官方推荐结构
  - 需要诊断迁移后 Trae 的 rules、hooks、commands、skills、MCP 不生效的问题

  触发词：claude转trae、codex转trae、zcode转trae、迁移到trae、Trae工程化迁移、Trae规则迁移、Trae hooks迁移、Trae命令迁移、Trae skills迁移、Trae MCP迁移、agents 转 trae
---

# Claude Code / Codex / ZCode -> Trae 工程化迁移指南

## 概述

这个技能用于把常见 AI 工程化目录迁移为 Trae 标准结构。目标不是简单复制文件，而是把源配置按 Trae 的目录、协议和职责重新落位，最终得到一套可直接被 Trae 识别和维护的工程文件。

本技能优先支持以下来源：

- `.claude/`
- `.codex/`
- `.zcode/`
- `.agents/skills/`

本技能输出的目标结构至少包括：

- `.trae/skills/<name>/SKILL.md`
- `.trae/rules/**/*.md`
- `.trae/commands/**/*.md`
- `.trae/hooks.json`
- `.trae/mcp.json`
- `.agents/skills/<name>/SKILL.md`

## 本技能的边界

- `管`：工程化配置迁移、结构重组、协议转换、模板生成、校验清单、迁移诊断
- `不管`：业务代码迁移、框架升级、依赖重构、功能重写

如果用户混合提出“配置迁移 + 业务改造”，先完成配置迁移规划，再把业务改造留给独立任务。

## 迁移策略

默认采用“混合策略”：

1. 先尽量保留源目录的命名、语义和边界。
2. 仅在 Trae 规范要求或明显更利于维护时，才做结构转换或语义重写。
3. 所有主动优化都要给出原因，不能默默改写。

迁移动作分为三类：

- `复制`：格式与语义都可直接复用
- `转换`：结构相近，但需要改目录、frontmatter、配置层级或调用方式
- `优化`：在不改变原始意图的前提下，重组为更符合 Trae 的形式

## 目标目录总览

```text
.trae/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── rules/
│   └── *.md
├── commands/
│   └── *.md
├── hooks.json
└── mcp.json

.agents/
└── skills/
    └── <skill-name>/
        └── SKILL.md
```

额外参考：

- 资源映射矩阵：`references/source-to-trae-map.md`
- Trae 目标制式：`references/trae-target-spec.md`
- 规则模板：`templates/trae-rule-template.md`
- Hook 模板：`templates/trae-hooks-template.json`
- MCP 模板：`templates/trae-mcp-template.json`
- 扫描脚本模板：`scripts/inventory-source-configs.js`
- 校验脚本模板：`scripts/validate-trae-migration.js`

## 源目录识别与优先级

### 扫描模式

优先支持两种模式：

1. `指定目录扫描`
   - 用户明确给出源目录时，只扫描指定路径。
2. `默认常见目录扫描`
   - 用户未指定时，按以下顺序扫描项目根：
   - `.claude/`
   - `.codex/`
   - `.zcode/`
   - `.agents/skills/`

### 优先级规则

如果同一能力在多个来源同时存在，优先级建议如下：

1. 用户明确指定的目录
2. 已被当前项目实际使用的目录
3. `.claude/`
4. `.codex/`
5. `.zcode/`
6. `.agents/skills/`

如果存在同名冲突，必须输出冲突清单，并说明：

- 哪些是完全重复
- 哪些是版本差异
- 哪些语义冲突需要用户确认

## 资源映射总规则

### 1. Skills

- 源 `skills` 优先迁移到 `.trae/skills/`
- 若目标希望跨工具共享，或源技能本身已经是通用 open-skill 结构，可改落到 `.agents/skills/`

### 2. Rules

- 源项目约束、规范说明、风格文档、团队约定，优先整理为 `.trae/rules/**/*.md`
- 规则文件必须保留 frontmatter，并满足 Trae 规则格式

### 3. Commands

- 源命令类 markdown 或 prompt 文件，迁移到 `.trae/commands/**/*.md`
- 目录嵌套不超过 3 层

### 4. Hooks

- 源 hook 脚本与配置不能只复制，必须一起迁移到 `.trae/hooks.json` 的结构
- 如需保留配套脚本，脚本路径和调用方式必须与目标工程一致

### 5. MCP

- 源 `mcpServers`、MCP 配置片段或工具服务器定义，迁移到 `.trae/mcp.json`
- 敏感信息统一改为占位值，并提示用户补全

### 6. Agents

采用双轨策略：

- 如果源 agent 更像“任务说明书 / 专业能力模块 / 触发型复用单元”，转为 `.trae/skills/<name>/SKILL.md`
- 如果源 agent 更像“跨工具共享技能”，转为 `.agents/skills/<name>/SKILL.md`

判定标准：

- 有明确的触发条件、能力边界、步骤说明，更像 skill -> `.trae/skills/`
- 主要目的是跨 Claude、Trae、Codex 等多工具共享 -> `.agents/skills/`
- 如果难以判断，先给出候选落点与判定理由，再请用户确认

## 各资源迁移规则

### 3.1 `.claude`

常见来源：

- `.claude/skills/`
- `.claude/commands/`
- `.claude/hooks/`
- `.claude/settings.json`
- `.claude/agents/`

迁移原则：

- `skills`：优先进入 `.trae/skills/`，必要时进入 `.agents/skills/`
- `commands`：迁移到 `.trae/commands/`
- `hooks` + `settings.json`：重组为 `.trae/hooks.json`
- `mcpServers`：迁移到 `.trae/mcp.json`
- `agents`：按双轨策略判断

### 3.2 `.codex`

常见来源：

- `.codex/skills/`
- `.codex/hooks.json`
- `.codex/hooks/`
- `.codex/agents/`

迁移原则：

- Codex 中部分命令可能被包装成 skill，不能机械复制到 `.trae/skills/`
- 需要先判断该文件本质是“命令”还是“技能”
- `.codex/agents` 若不是 markdown skill 结构，需要先做格式转换，再进入目标落点

### 3.3 `.zcode`

常见来源：

- `.zcode/skills/`
- `.zcode/commands/`
- `.zcode/agents/`
- `.zcode/hooks/`
- `.zcode/config.json`

迁移原则：

- 静态资源可以复用语义，但目录需改为 Trae 结构
- ZCode 的 hook 输出协议不能直接套进 Trae；Trae 的 `SessionStart` 和 `UserPromptSubmit` 支持纯文本输出，要按 Trae 规则改写
- `.zcode/config.json` 中的 MCP 与 hooks 配置要拆解后分别落入 `.trae/mcp.json` 和 `.trae/hooks.json`

### 3.4 `.agents/skills`

`.agents/skills/` 本身就是跨工具共享层：

- 如果用户目标是“让 Trae 原生接管并做项目内定制”，可复制到 `.trae/skills/`
- 如果用户目标是“保留跨工具共享”，可保持在 `.agents/skills/`
- 如果需要同时保留共享版和 Trae 定制版，优先将原版保留在 `.agents/skills/`，再在 `.trae/skills/` 放置覆盖版

## 高自动化执行流程

执行时按以下 6 步进行：

### 步骤 1：扫描资源清单

优先使用 `scripts/inventory-source-configs.js` 的逻辑，输出：

- 检测到的源目录
- 每类资源数量
- 同名冲突
- 可以直接复制的项目
- 需要转换的项目
- 需要人工确认的项目

### 步骤 2：建立迁移清单

按资源类型形成清单：

- `skills`
- `rules`
- `commands`
- `hooks`
- `mcp`
- `agents`
- `templates/scripts`

每一项都要标记迁移动作：

- `copy`
- `transform`
- `optimize`
- `manual-review`

### 步骤 3：创建目标目录骨架

按需要创建：

```text
.trae/skills/
.trae/rules/
.trae/commands/
.trae/hooks.json
.trae/mcp.json
.agents/skills/
```

### 步骤 4：按类型迁移

迁移顺序建议：

1. skills
2. rules
3. commands
4. hooks
5. mcp
6. agents

原因：

- 先迁移静态结构
- 再迁移协议敏感项
- 最后处理需要判定的 agent 双轨落点

### 步骤 5：做结构校验

优先使用 `scripts/validate-trae-migration.js` 的逻辑检查：

- 目录是否完整
- 关键文件是否存在
- rules frontmatter 是否齐全
- hooks / mcp 配置文件是否存在
- agent 双轨结果是否都有明确说明

### 步骤 6：输出迁移报告

报告中至少包括：

- 已迁移项
- 已转换项
- 被优化项
- 需要用户确认项
- 无法自动迁移项
- 后续建议

## Hook 迁移注意事项

这是最容易误迁移的部分。

### 必须记住的差异

- Trae 的 hook 配置文件是 `.trae/hooks.json`
- Windows 下 hook 默认在 PowerShell 环境中执行
- `SessionStart` 与 `UserPromptSubmit` 可以直接输出纯文本作为附加上下文
- 其他事件如果需要流程控制，应按 Trae 支持的 JSON 输出与退出码约定处理

### 迁移要求

- 不能把 `.claude/settings.json` 或 `.zcode/config.json` 原样复制为 `.trae/hooks.json`
- 必须拆出事件、matcher、命令、运行方式、输入输出预期
- 必须检查 shell 语法是否兼容 Windows PowerShell

## Rules 迁移注意事项

### 规则来源

可从以下内容抽取规则：

- AGENTS.md
- 项目规范文档
- Hook 中的固定约束
- Skill 中长期稳定的项目要求

### 规则落地方式

- 全局长期约束 -> `.trae/rules/*.md`
- 模块级约束 -> 子目录下 `.trae/rules/*.md`
- 无法判断是否应长期生效 -> 先生成智能生效规则

### 规则模板约束

所有示例规则文件都必须保留：

```md
---
alwaysApply: false
description: 当需要迁移并应用对应项目约束时
---
```

## Commands 迁移注意事项

- Trae 项目命令目录为 `.trae/commands`
- 最多支持 3 层嵌套
- 命令文件应保留明确的用途与输出要求
- 若源文件本质是长篇操作指南，不要强行放进 commands，应考虑迁移为 skill 或 rule

## MCP 迁移注意事项

- 项目级 MCP 配置应放入 `.trae/mcp.json`
- 源 `mcpServers`、server 定义、脚本启动命令需保留结构
- 所有密钥、Token、Access Key 都改为占位值
- 迁移完成后明确提醒用户替换真实配置

## 失败策略

遇到以下情况时，不要盲目继续：

### 1. 同名资源冲突

输出冲突矩阵，说明：

- 源路径
- 目标路径
- 差异类型
- 推荐保留方案

### 2. Agent 落点不明确

列出两种候选：

- `.trae/skills/...`
- `.agents/skills/...`

并说明为什么难以自动判断。

### 3. Hook 运行协议不明确

先保留最小安全版本：

- 事件
- matcher
- 命令
- 注释或说明

不要编造未验证的字段。

### 4. 源目录格式非标准

先做资源清点与分类，输出“无法自动迁移项”，再请求用户确认。

## 产出要求

执行本技能时，最终产出应包含：

1. 迁移前扫描结果
2. 资源映射表
3. 目标目录方案
4. 迁移执行结果
5. 校验结果
6. 未解决问题与后续建议

## 快速检查清单

- [ ] 已确认扫描范围是指定目录还是默认常见目录
- [ ] 已识别 `.claude`、`.codex`、`.zcode`、`.agents/skills` 中实际存在的来源
- [ ] 每类资源都已标记为复制、转换、优化或人工确认
- [ ] `agents` 已按双轨策略判断
- [ ] rules 已转换为符合 Trae 规范的 markdown 文件
- [ ] hooks 已重组成 `.trae/hooks.json`
- [ ] mcp 已重组成 `.trae/mcp.json`
- [ ] 已输出迁移报告与校验结果

## 触发示例

- “把这个项目的 `.claude` 工程化配置迁移到 Trae”
- “扫描 `.claude` 和 `.codex`，帮我生成 `.trae` 标准目录”
- “把 ZCode 的 hooks 和 mcp 配置改成 Trae 的标准文件”
- “帮我判断这些 agents 应该进 `.trae/skills` 还是 `.agents/skills`”
- “现有 Trae 配置很乱，按官方结构重组一下”
