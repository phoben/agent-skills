# ZCode 平台规范

## 1. 适用说明

这份文档用于指导把工程化配置迁移到 ZCode 的工作区资源或共享资源。内容主要基于本仓库现有 ZCode 技能与规则整理，适合作为 `config-migrate` 的目标平台参考。

## 2. 作用域与目录

### 项目级

- 工作区目录：`<repo>/.zcode/`
- 兼容共享目录：`<repo>/.agents/skills/`
- 插件包目录：`<repo>/.zcode-plugin/`

### 用户级

- 用户目录：`~/.zcode/`
- 用户级共享目录：`~/.agents/skills/`

## 3. 资源能力矩阵

| 资源类型 | 是否支持 | 项目级位置 | 用户级位置 | 说明 |
|---|---|---|---|---|
| `skills` | 支持 | `.zcode/skills/<name>/SKILL.md` | `~/.zcode/skills/<name>/SKILL.md` | 同名共享 skill 可由 `.zcode/skills` 覆盖 |
| `rules` | 无独立 rules 目录 | `AGENTS.md` 或 skill 内约束 | `~/.zcode/AGENTS.md` | 规则常通过指令文件表达 |
| `commands` | 支持 | `.zcode/commands/**/*.md` | `~/.zcode/commands/**/*.md` | 裸 markdown 命令，路径映射到命令名 |
| `hooks` | 支持 | `.zcode/hooks/*` + `.zcode/config.json` | `~/.zcode/hooks/*` + `~/.zcode/config.json` | 需 `hooks.enabled: true` |
| `mcp` | 支持 | `.zcode/config.json -> mcp.servers` | `~/.zcode/config.json -> mcp.servers` | schema 较严格 |
| `agents` | 支持 | `.zcode/agents/*.md` | `~/.zcode/agents/*.md` | 是工作区内可执行的原生角色定义 |
| `scripts` | 间接支持 | `.zcode/scripts/*` 或仓库脚本目录 | 用户脚本目录 | 通常被 hooks / commands / skills 调用 |
| `templates/docs` | 间接支持 | `.zcode/templates/*` 或仓库其他目录 | 任意受控目录 | 多作为辅助资产存在 |

## 4. 最小目录示例

```text
.zcode/
├── skills/
│   └── reviewer/
│       └── SKILL.md
├── commands/
│   └── summarize-pr.md
├── agents/
│   └── reviewer.md
├── hooks/
│   └── guard.js
└── config.json

.zcode-plugin/
└── plugin.json
```

## 5. 迁移注意事项

- `hooks` 的配置落在 `.zcode/config.json` 中，不是独立 `hooks.json`。
- `hooks` 的标准输出协议要求严格，迁移时经常需要重写返回结构。
- `mcp` 配置使用 `mcp.servers`，字段错误可能直接导致 server 被加载器丢弃。
- ZCode 既支持工作区资源，也支持插件包；若用户要求“迁到 ZCode”，要先确认是工作区模式、插件模式，还是双轨并行。
