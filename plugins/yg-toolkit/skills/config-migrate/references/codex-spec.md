# Codex 平台规范

## 1. 适用说明

这份文档用于指导把工程化配置迁移到 Codex CLI 常见结构。Codex 在不同版本中可能存在目录和协议差异，因此迁移时应优先遵循当前环境中的实际行为；若与本规范冲突，以用户本地真实目录和最新官方说明为准。

## 2. 作用域与目录

### 项目级

- 工作区目录：`<repo>/.codex/`
- 项目指令文件：`<repo>/AGENTS.md`

### 用户级

- 用户目录：`~/.codex/`
- 用户级共享目录：`~/.agents/skills/`

## 3. 资源能力矩阵

| 资源类型 | 是否支持 | 项目级位置 | 用户级位置 | 说明 |
|---|---|---|---|---|
| `skills` | 支持 | `.codex/skills/<name>/SKILL.md` | `~/.codex/skills/<name>/SKILL.md` | 多数 open skill 结构可直接适配 |
| `rules` | 无独立目录 | `AGENTS.md` | 用户级说明文件或共享指令目录 | 长期规则通常通过指令文件表达 |
| `commands` | 无稳定独立目录 | 视具体实现而定 | 视具体实现而定 | 常被包装为 skill、agent 或固定 prompt，不建议假定存在独立 commands 目录 |
| `hooks` | 支持 | `.codex/hooks.json` + `.codex/hooks/*` | `~/.codex/hooks.json` + `~/.codex/hooks/*` | 协议与其他平台不同，迁移时通常需要转换 |
| `mcp` | 支持 | `.codex/config.*` 或工作区配置片段 | 用户级配置文件 | 需按当前版本的配置结构核对字段 |
| `agents` | 支持 | `.codex/agents/*` | `~/.codex/agents/*` | 有些环境可能使用非 Markdown 结构，迁移前先识别格式 |
| `scripts` | 间接支持 | 仓库脚本目录 | 用户脚本目录 | 由 hooks、skills 或 agents 调用 |
| `templates/docs` | 间接支持 | 任意受控目录 | 任意受控目录 | 作为参考资产保留 |

## 4. 最小目录示例

```text
.codex/
├── skills/
│   └── reviewer/
│       └── SKILL.md
├── agents/
│   └── reviewer.toml
├── hooks/
│   └── guard.js
└── hooks.json

AGENTS.md
```

## 5. 迁移注意事项

- `commands` 在 Codex 侧常缺少稳定的独立目录规范，迁移时先判断源资源本质更像 skill、agent 还是提示词模版。
- `agents` 可能不是标准 Markdown skill 结构，实施前要先识别是否需要改写 frontmatter 或文件格式。
- `hooks` 与 `mcp` 的具体字段不宜臆造，若盘点时发现本地结构与这份规范不同，应以实际配置为准。
- 跨工具共享的通用技能优先考虑保留在 `.agents/skills/`，仅在需要 Codex 专属覆盖时再落到 `.codex/skills/`。
