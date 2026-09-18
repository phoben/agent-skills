# Claude 平台规范

## 1. 适用说明

这份文档用于指导把工程化配置迁移到 Claude Code 常见结构。内容以当前公开能力、本仓库既有迁移经验和 open skill 兼容实践为准；若 Claude 官方后续调整目录或字段，应以最新官方文档和本地实际行为为准。

## 2. 作用域与目录

### 项目级

- 工作区目录：`<repo>/.claude/`
- 项目指令文件：`<repo>/CLAUDE.md`

### 用户级

- 用户目录：`~/.claude/`
- 用户级指令文件：`~/.claude/CLAUDE.md`

### 常见附加目录

- 兼容共享层：`<repo>/.agents/skills/`、`~/.agents/skills/`
- 插件包目录：`.claude-plugin/`

## 3. 资源能力矩阵

| 资源类型 | 是否支持 | 项目级位置 | 用户级位置 | 说明 |
|---|---|---|---|---|
| `skills` | 支持 | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | 标准目录型 skill 可直接复用 |
| `rules` | 无独立目录 | `CLAUDE.md` | `~/.claude/CLAUDE.md` | 长期规则通常改写到指令文件，而不是单独 rules 目录 |
| `commands` | 支持 | `.claude/commands/**/*.md` | `~/.claude/commands/**/*.md` | 适合 slash command 或固定操作模版 |
| `hooks` | 支持 | `.claude/settings.json` + `.claude/hooks/*` | `~/.claude/settings.json` + `~/.claude/hooks/*` | 以配置文件和脚本共同组成 |
| `mcp` | 支持 | `.claude/settings.json` 中的 `mcpServers` | `~/.claude/settings.json` 中的 `mcpServers` | 项目级与用户级都常见 |
| `agents` | 支持 | `.claude/agents/*.md` | `~/.claude/agents/*.md` | 常用于专用角色或可委派能力 |
| `scripts` | 间接支持 | 仓库脚本目录 | 用户脚本目录 | 通常被 hooks / commands / skills 引用 |
| `templates/docs` | 间接支持 | 任意受控目录 | 任意受控目录 | 作为 skill/command 的参考资产存在 |

## 4. 最小目录示例

```text
.claude/
├── skills/
│   └── reviewer/
│       └── SKILL.md
├── commands/
│   └── summarize-pr.md
├── agents/
│   └── reviewer.md
├── hooks/
│   └── guard.js
└── settings.json

CLAUDE.md
```

## 5. 迁移注意事项

- `rules` 没有独立官方目录时，优先改写为 `CLAUDE.md` 中的长期约束。
- `hooks` 与 `mcp` 往往共存在 `settings.json` 中，迁移时不要只搬脚本不搬配置。
- `skills`、`commands`、`agents` 可以分别落入各自目录，不要互相混放。
- 若来源资源本身是跨工具共享能力，也可以保留在 `.agents/skills/` 作为共享层，再由 Claude 侧按需覆盖。
