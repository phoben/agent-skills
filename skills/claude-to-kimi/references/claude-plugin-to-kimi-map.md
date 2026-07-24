# Claude Plugin -> Kimi 资源映射矩阵

## 映射总览

| 资源类型 | 常见来源 | Shared 目标 | Workspace 目标 | Plugin 目标 | 默认方式 | 备注 |
|---|---|---|---|---|---|---|
| `skills` | `.claude/skills`、`.claude-plugin/skills`、`.agents/skills` | `.agents/skills/<name>/SKILL.md` | `.kimi-code/skills/<name>/SKILL.md` | plugin root 下 `skills/` + `kimi.plugin.json.skills` | 直接复制 | 默认优先 shared 目录 |
| `commands` | `.claude/commands`、`.claude-plugin/commands` | 无 | 一般改写为 Skill | plugin root 下 `commands/` + `kimi.plugin.json.commands` | 直接复制或轻改 | 对应 Kimi 插件斜杠命令 |
| `hooks` | `.claude/hooks`、`.claude-plugin/hooks`、Claude settings | 无 | `~/.kimi-code/config.toml` 的 `[[hooks]]`，必要时补仓库脚本 | plugin root 下 `hooks/` + `kimi.plugin.json.hooks` | 协议改写 | 不能直接沿用 Claude 配置 |
| `mcp` | Claude settings、plugin manifest、`mcpServers` 片段 | 无 | `.kimi-code/mcp.json` | `kimi.plugin.json.mcpServers` | 结构转换 | 顶层字段统一为 `mcpServers` |
| `agents` | `.claude/agents`、`.claude-plugin/agents`、`.codex-plugin/agents` | `.agents/agents/<name>.md` | `.kimi-code/agents/<name>.md` | 无 | 直接复制或轻改 | 不是 plugin manifest 字段 |
| `instructions` | `AGENTS.md`、插件说明文档、仓库级规则 | 无 | `.kimi-code/AGENTS.md`、`AGENTS.md` | `sessionStart.skill` 或 `skillInstructions` 间接承载 | 转换 | 需区分长期约束与运行时组件 |
| `templates` | plugin 辅助目录 | 无 | 项目内辅助文件 | plugin 根目录辅助文件 | 直接复制 | 不是 runtime 一等组件 |
| `scripts` | hooks 辅助脚本、plugin scripts | 无 | 项目内辅助脚本 | plugin 根目录 `scripts/` | 直接复制或轻改 | 需被 hooks / commands / skills 调用 |

## 分项规则

## 1. Skills

shared：

- 默认放到 `.agents/skills/<name>/SKILL.md`
- 适合跨项目共享的通用能力

workspace：

- 如需 Kimi 专属项目作用域，再放到 `.kimi-code/skills/<name>/SKILL.md`
- 若同名 Skill 已存在，先比对内容再决定覆盖

plugin：

- 放到 plugin root 下 `skills/`
- 在 `kimi.plugin.json` 中通过 `skills` 声明路径
- 如需会话启动自动注入，可补 `sessionStart.skill`

## 2. Commands

workspace：

- Kimi 工作区没有单独的项目级命令目录规范
- 如果来源命令本质是长提示词，优先改写为 Skill

plugin：

- 放到 plugin root 下 `commands/`
- 在 `kimi.plugin.json` 中通过 `commands` 声明
- 命令文件使用 markdown，可带 `name`、`description` frontmatter

## 3. Hooks

workspace：

- 常规 hooks 配置在 `~/.kimi-code/config.toml`
- 事件通过 stdin 传 JSON，退出码决定是否阻断
- 与项目强绑定的脚本可保留在仓库脚本目录中，再由 hooks 调用

plugin：

- 插件可以在 manifest 中声明 `hooks`
- hook 工作目录是 plugin root
- 可使用相对 plugin root 的 `./` 路径

迁移差异：

- Claude 的 hook 配置结构不能直接复用
- 需要重写事件名、matcher、命令与返回值契约

## 4. MCP

workspace：

- 放到 `.kimi-code/mcp.json`
- 适合当前项目私有的 MCP server

plugin：

- 放到 `kimi.plugin.json -> mcpServers`
- 适合跨项目复用的 MCP server

关键规则：

- 顶层字段统一为 `mcpServers`
- 支持 `command` + `args` 的 stdio server
- 也支持 `url` 的 HTTP / SSE server

## 5. Agents

shared：

- 默认放到 `.agents/agents/<name>.md`
- 适合跨项目共享的可委派 Agent

workspace：

- 需要项目专属行为时，放到 `.kimi-code/agents/<name>.md`
- Agent 文件是带 frontmatter 的 Markdown，正文是系统提示词

plugin：

- 当前 plugin manifest 没有 `agents` 字段
- 不要把“来源里有 agents”解释成“目标 plugin 里也能原样运行”

建议判定：

- 明确的 Agent 定义 -> `.agents/agents` 或 `.kimi-code/agents`
- 长期约束、角色边界、术语映射 -> `AGENTS.md`
- 更像复用工作流或提示模板 -> Skill
- 强依赖 Claude 特定运行时字段 -> `manual-review`

## 6. Instructions

来源可能是：

- `AGENTS.md`
- plugin README
- Claude agent 的系统说明

目标可分为：

- 项目长期约束 -> `.kimi-code/AGENTS.md`
- 仓库通用约束 -> `AGENTS.md`
- 某个专业流程 -> Skill 正文
- 会话启动固定提示 -> `sessionStart.skill` + `skillInstructions`

## 7. Templates 与 Scripts

这两类资源不是 Kimi plugin 的一等运行时组件，但仍然可以保留：

- `templates`：作为 Skill、command、hook 的辅助材料
- `scripts`：由 hooks、commands 或 MCP 启动命令调用

## 不建议自动迁移的情况

以下场景默认进入人工确认：

- 来源 `agents` 缺少稳定 frontmatter，或 `tools`、`subagents` 语义不清
- hooks 同时依赖 Claude 专属事件和 Claude 专属阻断语义
- 来源 plugin manifest 包含 Kimi 文档未支持的运行时字段
- `commands` 与 `skills` 边界不清，无法稳定判定该落到哪一类
