# Kimi 工作区资源规范

这份文档用于说明不做 plugin 打包时，Claude 资源应如何迁移到 Kimi 的工作区级结构。

## 1. 项目级 Skill 目录

Kimi 项目级 Skill 目录包括：

```text
.kimi-code/skills/
.agents/skills/
```

优先级上，项目级目录高于用户级目录。

建议用法：

- 当前仓库专属能力 -> `.kimi-code/skills/`
- 需要跨工具共享的通用能力 -> `.agents/skills/`

## 2. Skill 文件格式

Kimi Skill 支持目录型与扁平型两种形式，推荐目录型：

```text
.kimi-code/skills/<skill-name>/SKILL.md
```

`SKILL.md` 中建议显式填写：

- `name`
- `description`
- `whenToUse`
- 需要时填写 `arguments`

对于目录型 Skill，`name` 与 `description` 必须显式存在。

## 3. 项目级 MCP

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

## 4. 用户级 Hooks 与项目脚本

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
- 但被调用的脚本仍可以保存在当前仓库中
- 若需要迁移 Claude hook，通常是“脚本保留在仓库里，配置写入用户级 `config.toml`”

## 5. `AGENTS.md` 与指令文件

Kimi 官方文档说明可通过以下文件注入指令：

- `$KIMI_CODE_HOME/AGENTS.md`
- `~/.agents/AGENTS.md`
- `.kimi-code/AGENTS.md`
- `AGENTS.md`

项目迁移时最常见的两个目标是：

- `.kimi-code/AGENTS.md`
- `AGENTS.md`

适合迁移进去的内容：

- 长期行为约束
- 术语映射
- 团队规则
- 角色边界

不适合直接写进去的内容：

- 大量一次性操作步骤
- 更适合作为单独 Skill 的专业流程

## 6. 项目级资源与 plugin 的分工

### 优先走项目级的场景

- 只为当前仓库生效
- 包含项目私有路径或私有流程
- 用户不希望通过 `/plugins` 安装
- 资源更像项目约束而不是分发型组件

### 优先走 plugin 的场景

- 希望跨项目共享
- 需要安装、启用、禁用能力包
- 需要提供 `commands` 或 plugin 级 `hooks`

## 7. 推荐迁移分流

| 来源内容 | 推荐工作区目标 |
|---|---|
| `.claude/skills/*` | `.kimi-code/skills/*` |
| `.agents/skills/*` | 继续保留 `.agents/skills/*` |
| Claude 项目约束 | `.kimi-code/AGENTS.md` 或 `AGENTS.md` |
| 项目私有 MCP | `.kimi-code/mcp.json` |
| Claude hook 脚本 | 保留在仓库脚本目录，由用户级 hooks 调用 |

## 8. 高风险项

以下内容在项目级迁移中也需要人工确认：

- Claude `agents`：需判断落到 Skill 还是 `AGENTS.md`
- Claude hooks：需重写协议，而不是复制配置
- Claude plugin manifest：不属于项目级资源，需改走 plugin 迁移路线

## 9. 最小示例

```text
.kimi-code/
├── skills/
│   └── my-workflow/
│       └── SKILL.md
├── mcp.json
└── AGENTS.md

.agents/
└── skills/
    └── shared-workflow/
        └── SKILL.md
```
