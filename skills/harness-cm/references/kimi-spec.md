# Kimi 平台规范

## 1. 适用说明

这份文档用于指导把工程化配置迁移到 Kimi 的共享目录、项目目录与插件目录。内容以本仓库现有 Kimi 迁移技能和参考文档为基础，适合作为 `harness-cm` 的目标平台参考。

## 2. 作用域与目录

### 项目级

- 共享目录：`<repo>/.agents/`
- Kimi 项目目录：`<repo>/.kimi-code/`
- 项目规则文件：`<repo>/AGENTS.md`
- 插件目录：`<repo>/.kimi-plugin/` 或根目录 `kimi.plugin.json`

### 用户级

- 用户共享目录：`~/.agents/`
- 用户级 Kimi 目录：`~/.kimi-code/`

## 3. 资源能力矩阵

| 资源类型 | 是否支持 | 项目级位置 | 用户级位置 | 说明 |
|---|---|---|---|---|
| `skills` | 支持 | `.agents/skills/<name>/SKILL.md` 或 `.kimi-code/skills/<name>/SKILL.md` | `~/.agents/skills/<name>/SKILL.md` | 默认共享层优先 |
| `rules` | 通过指令文件支持 | `AGENTS.md` 或 `.kimi-code/AGENTS.md` | `~/.agents/AGENTS.md` | 长期规则通常不走独立 rules 目录 |
| `commands` | 主要走 plugin | `kimi.plugin.json` 对应的 `commands/` | 用户安装插件后生效 | 项目级无稳定独立 commands 目录 |
| `hooks` | 支持，但多为用户级配置 | 脚本可在仓库中，配置通常写入 `~/.kimi-code/config.toml` | `~/.kimi-code/config.toml` | 迁移时往往是“保留脚本 + 改写配置” |
| `mcp` | 支持 | `.kimi-code/mcp.json` | `~/.kimi-code/mcp.json` | 顶层常见字段是 `mcpServers` |
| `agents` | 支持 | `.agents/agents/*.md` 或 `.kimi-code/agents/*.md` | `~/.agents/agents/*.md` | Kimi 原生支持自定义 Agent 文件 |
| `scripts` | 间接支持 | 插件目录或仓库脚本目录 | 用户脚本目录 | 由 hooks、skills、commands 调用 |
| `templates/docs` | 间接支持 | 任意受控目录 | 任意受控目录 | 作为辅助资产保留 |

## 4. 最小目录示例

```text
.agents/
├── skills/
│   └── shared-reviewer/
│       └── SKILL.md
└── agents/
    └── reviewer.md

.kimi-code/
├── skills/
│   └── project-reviewer/
│       └── SKILL.md
├── agents/
│   └── project-reviewer.md
├── mcp.json
└── AGENTS.md

kimi.plugin.json
```

## 5. 迁移注意事项

- `skills` 与 `agents` 在 Kimi 里都有原生落点，迁移前要先区分“可复用工作流”与“可委派角色”。
- `rules` 更适合改写到 `AGENTS.md`，而不是臆造独立 rules 目录。
- `hooks` 的配置通常是用户级的 `config.toml`，因此项目迁移时经常只能保留脚本并生成配置建议，而不是完整项目级落盘。
- 如果用户明确要求做可分发能力包，应优先考虑 `kimi.plugin.json` 路线。
