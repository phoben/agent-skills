# Trae 平台规范

## 1. 适用说明

这份文档用于指导把工程化配置迁移到 Trae 的标准项目结构。它总结了本仓库现有迁移技能与 Trae 规则中的稳定结论，适合作为 `harness-cm` 在规划和实施时的目标规范。

## 2. 作用域与目录

### 项目级

- 工作区目录：`<repo>/.trae/`
- 共享技能目录：`<repo>/.agents/skills/`

### 用户级

- 用户目录：`~/.trae/`
- 用户级共享技能目录：`~/.agents/skills/`

## 3. 资源能力矩阵

| 资源类型 | 是否支持 | 项目级位置 | 用户级位置 | 说明 |
|---|---|---|---|---|
| `skills` | 支持 | `.trae/skills/<name>/SKILL.md` | `~/.trae/skills/<name>/SKILL.md` | 项目专用技能优先落这里 |
| `rules` | 支持 | `.trae/rules/**/*.md` | `~/.trae/rules/**/*.md` | 规则文件保留 `alwaysApply` 与 `description` |
| `commands` | 支持 | `.trae/commands/**/*.md` | `~/.trae/commands/**/*.md` | 目录层级建议不超过 3 层 |
| `hooks` | 支持 | `.trae/hooks.json` | `~/.trae/hooks.json` | 运行命令通常在 PowerShell 环境中执行 |
| `mcp` | 支持 | `.trae/mcp.json` | `~/.trae/mcp.json` | 常见目标为项目级或用户级 MCP 集合 |
| `agents` | 无独立稳定目录 | 视语义改写为 `.trae/skills/` 或 `.agents/skills/` | 同左 | Trae 更常把任务型能力沉淀为 skill |
| `scripts` | 间接支持 | 仓库脚本目录 | 用户脚本目录 | 被 hooks、commands、skills 调用 |
| `templates/docs` | 间接支持 | 任意受控目录 | 任意受控目录 | 作为 skill 或 command 的配套资产存在 |

## 4. 最小目录示例

```text
.trae/
├── skills/
│   └── reviewer/
│       └── SKILL.md
├── rules/
│   └── engineering.md
├── commands/
│   └── summarize-pr.md
├── hooks.json
└── mcp.json

.agents/
└── skills/
    └── shared-reviewer/
        └── SKILL.md
```

## 5. 迁移注意事项

- `rules` 是 Trae 的强项，长期约束优先迁移到 `.trae/rules/`。
- `agents` 没有统一独立落点时，通常改写为 `.trae/skills/` 或共享 `.agents/skills/`。
- `hooks` 与 `mcp` 都有明确项目级文件，适合做结构化迁移。
- 如果来源平台的 hooks 协议与 Trae 不同，不要直接复制原始配置。
