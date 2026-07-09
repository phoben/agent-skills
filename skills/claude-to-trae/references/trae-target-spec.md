# Trae 目标文件制式参考

本文档汇总 `claude-to-trae` 迁移时需要对齐的 Trae 目标结构。它不是官方文档替代品，而是迁移时的落地参考。

## 1. `.trae/skills/<name>/SKILL.md`

### 基本结构

```md
---
name: skill-name
description: 当需要执行某类任务时使用此 Skill。
---

# Skill 标题
```

### 迁移要求

- `name` 保持唯一，建议使用 kebab-case
- `description` 必须同时说明：
  - 做什么
  - 什么时候触发
- 如果源文件本身就是标准 skill，可优先保留正文结构

### 适合迁入的内容

- 可复用能力说明书
- 具备明确触发条件和执行步骤的任务指引
- 项目内长期使用的专业化流程

## 2. `.trae/rules/**/*.md`

### 规则文件头部

凡是迁移出的 Trae 项目规则示例或模板，统一使用以下开头：

```md
---
alwaysApply: false
description: 当需要迁移并应用对应项目约束时
---
```

### 规则特点

- 使用 markdown 编写
- 支持 `alwaysApply`、`description`、`globs`
- 最多支持 3 层目录嵌套
- 可以在子目录下单独放置 `.trae/rules/`，形成模块级规则

### 迁移建议

- 长期稳定约束 -> rule
- 单次任务说明 -> 不要迁成 rule
- 若不确定是否应始终生效，优先生成 `alwaysApply: false` 的智能生效规则

## 3. `.trae/commands/**/*.md`

### 目录规则

- 命令放在 `.trae/commands/`
- 支持最多 3 层嵌套
- 文件名和目录结构共同决定命令路径

### 迁移建议

- 源内容是清晰命令模板或标准输出要求时，优先转为 command
- 源内容若是长篇能力手册，不要强行转 command，应改为 skill

## 4. `.trae/hooks.json`

### 位置

- 项目级 hook：`<project>/.trae/hooks.json`

### 迁移注意事项

- Hook 命令通过 stdin 接收 JSON
- Hook 可通过 stdout 输出 JSON 控制流程
- `SessionStart` 与 `UserPromptSubmit` 支持纯文本上下文注入
- Windows 下默认 shell 是 PowerShell

### 与其他工具的关键差异

- Claude / ZCode 的 hook 配置结构不能直接照搬
- ZCode 常见的“必须严格 JSON 输出”思路，不能无脑套在 Trae 的 `SessionStart` / `UserPromptSubmit`
- 迁移时要同时校验：
  - 事件名
  - matcher
  - 命令语法
  - 平台兼容性

## 5. `.trae/mcp.json`

### 位置

- 项目级 MCP：`<project>/.trae/mcp.json`

### 迁移建议

- 从源 `mcpServers` 或等价配置抽取 server 定义
- 保留 `command`、`args`、`env` 等结构
- 将所有敏感值替换为占位符
- 提醒用户在真实环境中补齐密钥

## 6. `.agents/skills/`

### 用途

- 作为跨工具共享技能目录
- 适合保留通用、可跨 Claude / Trae / 其他 agent 复用的 skill

### 与 `.trae/skills/` 的关系

- `.trae/skills/` 更偏项目内、Trae 原生能力
- `.agents/skills/` 更偏共享层
- 同名时，项目内专用版本通常应放在 `.trae/skills/` 作为覆盖

## 7. 推荐迁移判断表

| 资源特征 | 目标落点 |
|---|---|
| 明确触发条件 + 可复用能力 | `.trae/skills/` |
| 通用共享型 open skill | `.agents/skills/` |
| 项目长期约束 | `.trae/rules/` |
| 命令模板 / 固定输出格式 | `.trae/commands/` |
| 会话事件拦截 / 注入 / 守卫 | `.trae/hooks.json` |
| 外部工具服务器定义 | `.trae/mcp.json` |

## 8. 最小目标结构示例

```text
.trae/
├── skills/
│   └── reviewer/
│       └── SKILL.md
├── rules/
│   └── coding-style.md
├── commands/
│   └── summarize-pr.md
├── hooks.json
└── mcp.json

.agents/
└── skills/
    └── shared-reviewer/
        └── SKILL.md
```

## 9. 迁移时的最低校验要求

- skill 必须有合法 frontmatter
- rule 必须保留 `alwaysApply` 与 `description`
- command 目录层级不超限
- hooks 与 mcp 配置文件存在且结构完整
- `agents` 的双轨落点有明确理由
