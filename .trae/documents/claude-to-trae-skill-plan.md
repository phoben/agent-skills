# `claude-to-trae` 技能实施计划

## Summary

目标是在当前技能仓库中新增一个完整的 `claude-to-trae` 技能包，用于指导智能体将常见源工程化目录（优先支持 `.claude/`、`.codex/`、`.zcode/`，并识别 `.agents/skills/`）扫描、分类、复制、转换并优化为 Trae 标准结构。首版同时更新仓库 `README.md`，并采用“混合策略”：默认尽量保留源结构与命名，仅在 Trae 规范要求或最佳实践明显更优时才做 Trae 原生化改写。

## Current State Analysis

* 当前仓库根目录为 `e:\Develop\Develop\agent-skills`，结构极简，仅包含 `README.md` 与一个现有技能目录 `skills/claude-to-zcode/`。

* 现有技能 `skills/claude-to-zcode/SKILL.md` 已形成可复用范式：长篇主文档、完整迁移流程、差异速查表、检查清单、诊断与验证章节。

* `README.md` 当前仅展示 `claude-to-zcode`，并说明该仓库采用 `skills/<skill-name>/SKILL.md` 的通用 Skill 组织方式，可附带 `references/`、`scripts/`、`assets/templates` 等配套资源。

* 当前仓库尚不存在 `.trae/` 目录，也没有现成的计划文档或其他技能资源目录。

* 根据 Trae 官方资料，本次技能需要覆盖的目标落点至少包括：

  * `项目技能`：`.trae/skills/<name>/SKILL.md`

  * `共享技能`：`.agents/skills/<name>/SKILL.md`

  * `项目规则`：`.trae/rules/**/*.md`

  * `项目命令`：`.trae/commands/**/*.md`

  * `项目 Hook`：`.trae/hooks.json`

  * `项目 MCP`：`.trae/mcp.json`

* 根据 Trae 官方资料，规则文件需使用 markdown frontmatter，且项目规则支持 `alwaysApply`、`description`、`globs` 等属性；结合用户自定义约束，凡涉及 `.trae/rules/*.md` 示例或模板，文件开头必须保留：

```md
---
alwaysApply: false
description: ...
---
```

* 根据 Trae Hook 官方资料：

  * 项目级 Hook 配置落在 `.trae/hooks.json`

  * Windows 环境下 Hook 使用 PowerShell

  * `SessionStart` 与 `UserPromptSubmit` 支持纯文本 stdout 注入上下文

  * Trae 还能读取 Claude Code Hook 配置，但本技能目标是“迁移为 Trae 标准文件”，因此不能只给“直接兼容读取”的捷径，仍需优先产出 `.trae/hooks.json`

* 用户已确认的关键偏好：

  * 首版交付为“技能包 + README”

  * `agents` 采用“双轨策略”

  * 自动化程度为“高自动化”

  * 迁移策略采用“混合策略”

## Proposed Changes

### 1. 新增主技能文档

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\SKILL.md`

变更内容：

* 新建主技能文档，沿用现有仓库技能风格，采用 YAML frontmatter + 中文正文。

* 在 frontmatter 中明确：

  * `name: claude-to-trae`

  * `description` 同时覆盖“做什么”和“何时触发”，重点强调以下触发场景：

    * 用户想把 `.claude/`、`.codex/`、`.zcode/` 工程化配置迁移到 Trae

    * 用户想规范化已有 `.trae/` 目录

    * 用户需要从源配置扫描并生成 Trae 的 `skills/rules/hooks/commands/mcp/.agents` 目录

    * 用户遇到 Trae 迁移后配置不生效、目录结构混乱、规则/hook/命令失效等问题

* 正文结构采用“从概述到细则”的方式，建议至少包含：

  * 概述与边界

  * 源目录识别与优先级

  * Trae 目标结构总览

  * 资源映射矩阵

  * 各资源详细迁移规则

  * 高自动化执行工作流

  * 失败策略与人工介入点

  * 验证清单

  * 触发示例

实现重点：

* 不能只覆盖 `.claude -> .trae`，必须同时覆盖 `.codex`、`.zcode` 两类源目录。

* 必须明确“扫描指定目录”和“按需扫描默认常见目录”两种模式。

* 必须将“复制”“转换”“优化”拆分成显式阶段，避免模型直接粗暴复制。

### 2. 新增资源映射参考文档

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\references\source-to-trae-map.md`

变更内容：

* 单独维护一份“源目录 -> Trae 目标目录”的映射矩阵，避免主技能文档过长。

* 逐项说明 `.claude`、`.codex`、`.zcode`、`.agents/skills` 中常见资源如何映射到：

  * `.trae/skills/`

  * `.trae/rules/`

  * `.trae/commands/`

  * `.trae/hooks.json`

  * `.trae/mcp.json`

  * `.agents/skills/`

* 显式标明每类映射属于：

  * 直接复制

  * 结构转换

  * 语义重写

  * 不建议自动迁移

实现重点：

* 对 `agents` 使用双轨判定：

  * 若源 `agent` 更像“可复用能力模块/任务说明书”，转为 `.trae/skills/<name>/SKILL.md`

  * 若源 `agent` 更适合作为跨工具共享能力，落到 `.agents/skills/<name>/SKILL.md`

  * 若无法可靠自动判定，则要求智能体输出判定理由并请求用户确认

* 对 `.zcode`、`.codex` 的命令/agent 差异要给出专门说明，不能简单套用 Claude 规则。

### 3. 新增 Trae 目标文件规范参考

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\references\trae-target-spec.md`

变更内容：

* 汇总 Trae 官方结构要求，作为技能内部“目标制式参考”。

* 至少覆盖以下内容：

  * `.trae/skills/<name>/SKILL.md` 的格式与触发语义

  * `.trae/rules/**/*.md` 的 frontmatter 要求与嵌套限制

  * `.trae/commands/**/*.md` 的目录规则与最大嵌套

  * `.trae/hooks.json` 的位置、事件与 I/O 特性

  * `.trae/mcp.json` 的作用与项目级加载方式

  * `.agents/skills/` 的适用场景与与 `.trae/skills/` 的优先级关系

实现重点：

* 这一文件主要承担“规范底座”作用，减少 `SKILL.md` 内重复铺陈。

* 凡出现 `.trae/rules/*.md` 示例，统一满足用户自定义 frontmatter 约束。

### 4. 新增规则模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\templates\trae-rule-template.md`

变更内容：

* 提供 Trae 项目规则模板，给迁移时无法 1:1 自动映射的源说明文件/项目约定使用。

* 模板内容必须保留以下头部格式：

```md
---
alwaysApply: false
description: 当需要迁移并应用对应项目约束时
---
```

* 正文中预留：

  * 规则目标

  * 适用场景

  * 明确约束

  * 示例

实现重点：

* 用于承接以下“半结构化源文件”：

  * Claude/Codex/ZCode 中不属于 command/skill/hook 的工程约定

  * 原本写在 `AGENTS.md`、说明文档、模板中的项目规则性内容

### 5. 新增 Hook 配置模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\templates\trae-hooks-template.json`

变更内容：

* 提供 `.trae/hooks.json` 的最小可迁移模板，帮助技能在迁移 Hook 时快速落盘。

* 模板中体现：

  * 顶层 hooks 结构

  * 常见事件示例（如 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`）

  * 适合 Windows PowerShell 的命令调用示例

实现重点：

* 说明 Trae 的 `SessionStart` / `UserPromptSubmit` 支持纯文本上下文注入，这与 `claude-to-zcode` 中“必须 JSON 包装”的逻辑不同，技能中要明确对比，避免错误继承旧规则。

* 模板只提供安全最小样例，不硬编码用户项目私有路径。

### 6. 新增 MCP 配置模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\templates\trae-mcp-template.json`

变更内容：

* 提供 `.trae/mcp.json` 的标准模板。

* 说明从源 `mcpServers`、`.zcode/config.json` 中的 MCP 配置迁移到 Trae 项目级 MCP 的方式。

* 对敏感字段（API Key、Token）使用占位值，不写真实密钥。

实现重点：

* 技能中要求智能体复制服务器定义时保留 `command` / `args` / `env` 等结构，但必须提醒用户替换敏感配置。

### 7. 新增扫描脚本模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\scripts\inventory-source-configs.js`

变更内容：

* 提供一个跨平台 Node.js 扫描脚本模板，用于盘点目标项目下的源工程化目录与资源清单。

* 扫描范围默认包含：

  * `.claude`

  * `.codex`

  * `.zcode`

  * `.agents/skills`

* 输出建议为 JSON 或结构化文本，至少列出：

  * 发现的源目录

  * 每类资源数量

  * 可直接迁移项

  * 需要转换项

  * 存在冲突或人工确认项

实现重点：

* 这是“高自动化”要求的第一步支撑资源。

* 脚本作为模板/参考实现存在，技能正文需说明：若目标环境不能直接运行脚本，智能体可按同样逻辑手工完成扫描。

### 8. 新增校验脚本模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-trae\scripts\validate-trae-migration.js`

变更内容：

* 提供迁移完成后的结构校验脚本模板，检查 `.trae` 目录完整性与关键文件是否存在。

* 至少校验：

  * `.trae/skills/*/SKILL.md`

  * `.trae/rules/**/*.md`

  * `.trae/commands/**/*.md`

  * `.trae/hooks.json`

  * `.trae/mcp.json`

  * `.agents/skills/*/SKILL.md`

* 输出“通过项 / 缺失项 / 警告项”，便于技能执行后的自检。

实现重点：

* 只做结构与基础格式校验，不尝试理解业务语义。

* 与主技能里的“验证清单”保持一致。

### 9. 更新仓库 README

文件：`e:\Develop\Develop\agent-skills\README.md`

变更内容：

* 在 `Available Skills` 中新增 `claude-to-trae` 条目。

* 补充该技能的功能简介、安装说明与触发示例。

* 风格与现有 `claude-to-zcode` 条目保持一致，确保仓库展示统一。

实现重点：

* 简介要突出：

  * 支持 `.claude/.codex/.zcode/.agents`

  * 目标是 Trae 标准目录

  * 支持扫描、转换、优化、校验

  * 覆盖 skills / rules / hooks / commands / mcp / agents 双轨映射

## Assumptions & Decisions

* 决策：`claude-to-trae` 作为仓库内新技能，落点使用 `skills/claude-to-trae/`，而不是直接在本仓库根目录创建 `.trae/skills/` 示例工程。

* 决策：首版交付包含主技能文档、2 份参考文档、3 份模板、2 份脚本模板，以及 `README.md` 更新。

* 决策：脚本模板采用 Node.js，而不是 PowerShell。原因是当前仓库定位为跨工具通用技能仓库，Node.js 更利于跨平台复用；但技能正文需补充 Windows/PowerShell 下的调用示例。

* 决策：对 `agents` 使用双轨迁移策略，并把“何时进入 `.trae/skills`、何时进入 `.agents/skills`”写成显式判定规则。

* 决策：对 Hook 迁移，优先产出 `.trae/hooks.json`，不以“Trae 可直接读取 Claude Hook”替代标准化迁移。

* 决策：对规则迁移，统一产出符合 Trae 规范且满足用户自定义头部要求的 markdown 文件模板与示例。

* 假设：当前仓库没有既有 `claude-to-trae` 目录，可直接新增，不涉及与已有文件合并。

* 假设：首版重点是“技能包可指导 AI 完成迁移”，不是构建一个完整 CLI 工具，因此脚本模板作为辅助资源，而非唯一执行入口。

## Verification Steps

实施后需要验证以下内容：

1. 结构验证

* `skills/claude-to-trae/` 目录存在

* `SKILL.md`、`references/`、`templates/`、`scripts/` 均按计划落位

* `README.md` 成功新增技能介绍

1. 文档验证

* `SKILL.md` frontmatter 正确，且 `description` 同时说明“做什么 + 何时触发”

* 正文明确覆盖 `.claude/.codex/.zcode/.agents` 四类来源

* 正文明确覆盖 `.trae/skills`、`.trae/rules`、`.trae/commands`、`.trae/hooks.json`、`.trae/mcp.json`、`.agents/skills`

1. 规则模板验证

* `templates/trae-rule-template.md` 的头部严格保留：

  * `alwaysApply`

  * `description`

* 示例符合 `.trae/rules` 的 markdown 规范

1. 自动化资源验证

* 两个脚本模板的路径、用途、输入输出在文档中均有说明

* 脚本代码采用 ASCII，注释与日志为中文

* 脚本名称与文档引用一致

1. 内容一致性验证

* `README.md` 的功能描述与 `SKILL.md` 中的能力边界保持一致

* 参考文档、模板、脚本之间的目录命名与示例路径完全一致

* 对 Trae Hook/Rules/Commands/MCP 的描述不与官方资料冲突

