---
name: claude-to-kimi
description: 当需要把 `.claude`、`.claude-plugin`、`.codex-plugin` 或共享 `.agents` 资源迁移到 Kimi 的 `.kimi-code` 或 `kimi.plugin.json` 时使用此技能。
when_to_use: 当用户要求迁移 Claude Code Plugin 到 Kimi、比较 Claude 与 Kimi 的插件或工作区差异、生成 `kimi.plugin.json`、迁移 skills/commands/hooks/MCP，或处理 agents 在 Kimi 中的替代落点时。
---

# Claude Code / Plugin -> Kimi 迁移指南

## 概述

这个技能用于把 Claude Code 的工作区资源与 Plugin 资源迁移到 Kimi Code CLI。目标不是简单复制文件，而是在尽量保留原始语义、目录边界和复用方式的前提下，改写成 Kimi 官方支持的结构。

优先支持以下来源：

- `.claude/`
- `.claude-plugin/`
- `.codex-plugin/`
- `.agents/skills/`

优先输出以下目标：

- `.kimi-code/skills/<name>/SKILL.md`
- `.kimi-code/mcp.json`
- `.kimi-code/AGENTS.md`
- `AGENTS.md`
- `.agents/skills/<name>/SKILL.md`
- `kimi.plugin.json`
- `.kimi-plugin/plugin.json`
- plugin root 下的 `skills/`
- plugin root 下的 `commands/`

## 本技能的边界

- `管`：资源盘点、差异分析、结构映射、manifest 生成、协议改写、迁移校验、风险说明
- `不管`：业务代码迁移、模型切换、第三方平台账号配置、未公开能力的臆造实现

如果用户混合提出“插件迁移 + 业务功能改造”，先完成 Kimi 迁移设计与落盘，再处理业务改造。

## 无损迁移的定义

这里的“无损”采用**最大保真**原则，而不是承诺所有字段都能 1:1 原样落地：

1. 优先保留源能力的用途、触发方式、命名和目录边界。
2. 对 Kimi 已有官方对等能力的资源，尽量保持结构接近。
3. 对 Kimi 没有公开对等组件的资源，不编造目标字段，而是落到最接近的官方位置，并明确标记风险。
4. 所有无法自动判定的项，都进入“人工确认”而不是静默改写。

迁移动作分为四类：

- `copy`：可直接复制或极小改动
- `transform`：需要改目录、frontmatter、manifest 或配置结构
- `rewrite`：需要按 Kimi 协议重写，例如 hooks
- `manual-review`：缺少官方对等能力或语义无法自动判断

## Kimi 目标结构总览

```text
.kimi-code/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── mcp.json
└── AGENTS.md

.agents/
└── skills/
    └── <skill-name>/
        └── SKILL.md

AGENTS.md

plugin-root/
├── kimi.plugin.json
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── commands/
│   └── *.md
├── hooks/
│   └── *
└── scripts/
    └── *
```

配套资源：

- 迁移映射：`references/claude-plugin-to-kimi-map.md`
- Kimi plugin 制式：`references/kimi-plugin-spec.md`
- Kimi 工作区制式：`references/kimi-workspace-spec.md`
- Plugin 模板：`templates/kimi.plugin.json`
- MCP 模板：`templates/mcp.json`
- Hooks 模板：`templates/config.toml.hooks.example`
- 来源盘点脚本：`scripts/inventory-kimi-sources.js`
- 差异分析脚本：`scripts/analyze-kimi-migration-diff.js`

## 先做检测，不要先复制

开始迁移前，先确认当前项目中存在什么来源与什么目标。

### 必查来源

- `.claude/`
- `.claude-plugin/`
- `.codex-plugin/`
- `.agents/skills/`

### 必查目标

- `.kimi-code/`
- `.kimi-code/skills/`
- `.kimi-code/mcp.json`
- `.kimi-code/AGENTS.md`
- `AGENTS.md`
- `kimi.plugin.json`
- `.kimi-plugin/plugin.json`
- plugin root 下现有 `skills/`、`commands/`、`hooks/`、`scripts/`

优先使用：

```powershell
node .\skills\claude-to-kimi\scripts\inventory-kimi-sources.js .
```

如果无法运行脚本，也必须手工输出以下结论：

- 发现了哪些来源目录
- 发现了哪些 Kimi 目标目录
- 每类资源的数量
- 哪些资源可直接迁移
- 哪些资源需要协议改写
- 哪些资源需要人工确认

## 目标分流策略

### 1. 优先迁移到 `.kimi-code/*`

满足以下任一情况时，优先迁移到项目级目录：

- 目标是让当前仓库直接生效
- 资源本质是项目内工作流或项目约束
- 需要保留项目私有技能，而不是分发插件
- 只需要迁移技能与 MCP，不需要安装型 plugin 包

### 2. 优先迁移到 `kimi.plugin.json`

满足以下任一情况时，优先整理为 Kimi plugin：

- 需要跨项目共享
- 需要通过 `/plugins install` 安装
- 来源本身就是 `.claude-plugin` 或 `.codex-plugin`
- 希望统一携带 `skills`、`commands`、`hooks`、`mcpServers`

### 3. 双轨输出

以下情况建议工作区与 plugin 同时产出：

- 项目内要立即落地，同时要沉淀成团队插件
- 需要把项目约束写入 `AGENTS.md`，但通用技能与命令打包成 plugin
- 来源 plugin 同时含项目特定配置与可复用资产

## 资源映射总规则

详细矩阵见 `references/claude-plugin-to-kimi-map.md`。这里给执行级规则。

### 1. Skills

- Claude Skill 与 Kimi Skill 的目录形态高度兼容
- 工作区目标：`.kimi-code/skills/<name>/SKILL.md`
- 共享目标：`.agents/skills/<name>/SKILL.md`
- Plugin 目标：plugin root 下 `skills/`，由 `kimi.plugin.json -> skills` 声明

### 2. Commands

- Claude 命令类 markdown 资源优先迁移到 plugin `commands/`
- Kimi plugin 命令自动带 plugin 命名空间，最终形如 `/plugin-id:command-name`
- 若来源是项目内部操作说明而不是分发型命令，更适合改写为 Skill

### 3. Hooks

- Kimi hooks 不能照搬 Claude 的配置结构
- 项目级常规 hooks 位于 `~/.kimi-code/config.toml` 的 `[[hooks]]`
- Plugin 级 hooks 通过 `kimi.plugin.json -> hooks` 声明
- hook 逻辑仍可复用，但事件名、stdin 输入和阻断方式必须按 Kimi 协议重写

### 4. MCP

- 项目级目标：`.kimi-code/mcp.json`
- Plugin 级目标：`kimi.plugin.json -> mcpServers`
- `mcpServers` 是 Kimi 的标准字段；支持 stdio、HTTP、SSE 三种接入方式

### 5. Agents

这是最高风险项。

- Kimi 官方文档支持主 Agent、内置子 Agent 与 `AGENTS.md` 指令文件
- 当前公开 plugin manifest 没有 Claude Plugin 那种“自定义 agents 组件”的官方对等字段
- 因此 Claude 的 `agents` 不应直接承诺原样插件化

推荐分流：

- 更像长期规则、术语映射、工作方式约束 -> `.kimi-code/AGENTS.md` 或 `AGENTS.md`
- 更像可复用工作流 -> `.kimi-code/skills/` 或 plugin `skills/`
- 无法自动判断 -> 输出人工确认清单

## 高自动化执行流程

### 阶段 1：扫描来源与目标

输出至少包含：

- 来源目录
- 目标目录
- manifest 存在情况
- 同名资源
- 风险资源

### 阶段 2：建立迁移清单

按以下资源分类：

- `skills`
- `commands`
- `hooks`
- `mcp`
- `agents`
- `templates`
- `scripts`
- `instructions`

每项标记动作：

- `copy`
- `transform`
- `rewrite`
- `manual-review`

### 阶段 3：先做差异分析

优先使用：

```powershell
node .\skills\claude-to-kimi\scripts\analyze-kimi-migration-diff.js .
```

如果同名目标已存在，按以下规则处理：

- 完全一致：跳过
- 仅源端更新：可迁移
- 两端都改过：停止覆盖并输出冲突说明
- 协议敏感资源：转为 `rewrite`

### 阶段 4：按类型迁移

推荐顺序：

1. `skills`
2. `commands`
3. `mcp`
4. `hooks`
5. `agents`
6. `AGENTS.md` / instructions

### 阶段 5：生成清单与模板

至少输出：

- `kimi.plugin.json` 或 `.kimi-plugin/plugin.json`
- `.kimi-code/mcp.json`
- 需要时补充 `AGENTS.md`
- 迁移报告

### 阶段 6：校验结果

至少检查：

- `SKILL.md` frontmatter 是否完整
- plugin manifest 是否位于官方支持的位置
- `commands` 路径是否位于 plugin root 内
- `mcpServers` 结构是否合法
- hooks 是否仍引用了 Claude 专属字段
- `agents` 是否被错误宣称为 Kimi plugin 原生组件

## Hook 迁移注意事项

Kimi hooks 的核心规则：

- 通过标准输入接收事件 JSON
- 退出码 `0` 放行，`2` 阻断，其他非零值默认 fail-open
- `UserPromptSubmit`、`PreToolUse`、`Stop` 属于可阻断事件
- Plugin hooks 只在插件启用期间生效

迁移要求：

- 不直接复制 Claude 的 hook 配置文件
- 保留脚本业务逻辑，但重写入参、返回值和事件名
- 如需阻断，优先使用 Kimi 官方支持的退出码或 stdout JSON 结构

## MCP 迁移注意事项

- Kimi 项目级文件为 `.kimi-code/mcp.json`
- 顶层字段是 `mcpServers`
- stdio server 可用 `command` + `args`
- HTTP / SSE server 用 `url`，旧式 SSE 需显式写 `transport: "sse"`
- 敏感信息改为占位符，提醒用户后补

## Agents 迁移注意事项

不要把 Claude `agents` 机械映射到 Kimi plugin manifest。

当来源是 agent 时，必须先判断它更接近哪一类：

- 项目级长期约束 -> `.kimi-code/AGENTS.md`
- 跨项目共享约束 -> `~/.agents/AGENTS.md` 或项目内 `AGENTS.md`
- 可复用工作流 -> Skill
- 结构复杂且包含工具契约假设 -> `manual-review`

## 失败策略

### 1. 发现同名资源冲突

输出冲突矩阵：

- 源路径
- 目标路径
- 差异类型
- 推荐保留方案

### 2. `agents` 缺少明确落点

必须说明：

- 为什么 Kimi 中没有公开对等 plugin 组件
- 建议落到 `AGENTS.md` 还是 Skill
- 哪些内容需要用户确认

### 3. hooks 依赖 Claude 专属协议

保留脚本逻辑，但不要编造 Kimi 未公开字段。优先输出最小可运行版本与风险说明。

### 4. 来源 plugin 含未支持字段

如 `tools`、`apps`、`inject`、`configFile` 等，标记为 diagnostics 风险，不直接迁入 Kimi runtime 字段。

## 产出要求

执行本技能时，最终结果至少包括：

1. 来源与目标扫描结果
2. 资源映射表
3. 迁移分流方案
4. 已迁移项
5. 需协议改写项
6. 需人工确认项
7. 后续建议

## 快速检查清单

- [ ] 已扫描 `.claude`、`.claude-plugin`、`.codex-plugin`、`.agents/skills`
- [ ] 已扫描 `.kimi-code`、`AGENTS.md`、`kimi.plugin.json`、`.kimi-plugin/plugin.json`
- [ ] 每类资源都已标记为 `copy`、`transform`、`rewrite` 或 `manual-review`
- [ ] hooks 已改为 Kimi 协议
- [ ] MCP 已改为 Kimi 的 `mcpServers`
- [ ] `agents` 没有被误判为 Kimi plugin 官方组件
- [ ] 已输出冲突与风险说明

## 触发示例

- “把这个 `.claude-plugin` 无损迁移到 Kimi”
- “帮我把 Claude Code Plugin 改成 `kimi.plugin.json`”
- “扫描 `.claude-plugin` 和现有 `.kimi-code`，先做差异分析再迁移”
- “这些 Claude agents 在 Kimi 里该落到 Skill 还是 `AGENTS.md`”
- “帮我把 Claude 的 hooks 和 mcp 配置改写成 Kimi 官方格式”
