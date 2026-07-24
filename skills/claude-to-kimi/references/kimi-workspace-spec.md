# Kimi 工作区资源规范

这份文档用于说明不做 plugin 打包时，Claude 资源应如何迁移到 Kimi 的工作区级结构。

## 1. Shared 与 Workspace Skill 目录

Kimi / 通用工作区里的 Skill 目录包括：

```text
.agents/skills/
.kimi-code/skills/
```

建议用法：

- 默认共享目录：`.agents/skills/`
- 条件性项目目录：`.kimi-code/skills/`

适用原则：

- 需要跨项目共享的通用能力 -> `.agents/skills/`
- 只想在当前仓库启用的 Kimi 专属能力 -> `.kimi-code/skills/`

## 2. 自定义 Agent 目录

Kimi 官方支持自定义 Agent 文件，常见工作区目录包括：

```text
.agents/agents/
.kimi-code/agents/
```

建议用法：

- 默认共享目录：`.agents/agents/`
- 条件性项目目录：`.kimi-code/agents/`

Agent 文件是带 frontmatter 的 Markdown，正文即系统提示词。常见字段包括：

- `name`
- `description`
- `whenToUse`
- `override`
- `tools`
- `disallowedTools`
- `subagents`

## 3. Skill 文件格式

Kimi Skill 支持目录型与扁平型两种形式，推荐目录型：

```text
.agents/skills/<skill-name>/SKILL.md
```

`SKILL.md` 中建议显式填写：

- `name`
- `description`
- `whenToUse`
- 需要时填写 `arguments`

对于目录型 Skill，`name` 与 `description` 必须显式存在。

## 4. 项目级 MCP

项目级 MCP 配置位于：

```text
.kimi-code/mcp.json
```

顶层结构：

```json
{
  "mcpServers": {}
}
```

适用场景：

- 当前项目私有的本地 server
- 只希望在当前仓库中启用的外部工具

## 5. 用户级 Hooks 与项目脚本

Kimi 常规 hooks 写在：

```text
~/.kimi-code/config.toml
```

结构为：

```toml
[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node path/to/script.js"
timeout = 5
```

这意味着：

- hooks 配置本身不是项目级独立 JSON 文件
- 被调用的脚本仍可以保存在当前仓库中
- 若需要迁移 Claude hook，通常是“脚本保留在仓库里，配置写入用户级 `config.toml`”

## 6. `AGENTS.md` 与 Agent 文件的分工

Kimi 官方文档说明可通过以下文件注入指令：

- `$KIMI_CODE_HOME/AGENTS.md`
- `~/.agents/AGENTS.md`
- `.kimi-code/AGENTS.md`
- `AGENTS.md`

分工建议：

- `AGENTS.md`：长期行为约束、术语映射、团队规则、角色边界
- `agents/*.md`：可被选择或委派的 Agent 定义
- `skills/*`：可复用工作流与专业流程

不适合直接写进 `AGENTS.md` 的内容：

- 大量一次性操作步骤
- 更适合作为单独 Skill 的专业流程
- 需要 `tools`、`subagents` 等 Agent frontmatter 的可执行角色定义

## 7. 项目级资源与 plugin 的分工

### 优先走工作区的场景

- 只为当前仓库生效
- 包含项目私有路径或私有流程
- 用户不希望通过 `/plugins` 安装
- 资源更像项目约束或项目专属 Agent / Skill

### 优先走 plugin 的场景

- 希望跨项目共享
- 需要安装、启用、禁用能力包
- 需要提供 `commands` 或 plugin 级 `hooks`

## 8. 推荐迁移分流

| 来源内容 | 推荐工作区目标 |
|---|---|
| `.claude/skills/*` | 默认 `.agents/skills/*`，必要时 `.kimi-code/skills/*` |
| `.claude/agents/*` | 默认 `.agents/agents/*`，必要时 `.kimi-code/agents/*` |
| `.agents/skills/*` | 继续保留 `.agents/skills/*` |
| `.agents/agents/*` | 继续保留 `.agents/agents/*` |
| Claude 项目约束 | `.kimi-code/AGENTS.md` 或 `AGENTS.md` |
| 项目私有 MCP | `.kimi-code/mcp.json` |
| Claude hook 脚本 | 保留在仓库脚本目录，由用户级 hooks 调用 |

## 9. 高风险项

以下内容在工作区迁移中也需要人工确认：

- Claude `agents` 的 frontmatter 不完整，或 `tools` / `subagents` 语义不清
- Claude hooks：需重写协议，而不是复制配置
- Claude plugin manifest：不属于工作区资源，需改走 plugin 迁移路线

## 10. 最小示例

```text
.agents/
├── skills/
│   └── shared-workflow/
│       └── SKILL.md
└── agents/
    └── reviewer.md

.kimi-code/
├── skills/
│   └── project-workflow/
│       └── SKILL.md
├── agents/
│   └── project-reviewer.md
├── mcp.json
└── AGENTS.md
```
