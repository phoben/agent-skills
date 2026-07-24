# Kimi Plugin 规范与迁移限制

这份文档只聚焦把 Claude Plugin 迁移到 Kimi Plugin 时必须遵守的规则。

## 1. Manifest 位置

Kimi 官方支持以下两个位置：

```text
<plugin_root>/kimi.plugin.json
<plugin_root>/.kimi-plugin/plugin.json
```

两个文件同时存在时，以 `kimi.plugin.json` 为准。

迁移目标优先统一到：

```text
kimi.plugin.json
```

## 2. `kimi.plugin.json` 最小要求

必填：

- `name`

推荐填写：

- `version`
- `description`
- `skills`
- `commands`
- `mcpServers`

按需要填写：

- `sessionStart.skill`
- `skillInstructions`
- `hooks`
- `interface`

## 3. `name` 规则

plugin id 必须匹配：

```text
[a-z0-9][a-z0-9_-]{0,63}
```

不要使用：

- 大写字母
- 空格
- 超长名称
- 逃逸路径含义的特殊字符

## 4. 官方公开支持的核心组件

当前公开文档明确支持以下运行时字段：

- `skills`
- `sessionStart.skill`
- `skillInstructions`
- `mcpServers`
- `hooks`
- `commands`

这些字段是 Claude Plugin 迁移到 Kimi Plugin 时的主要承载点。

## 5. 不是 plugin manifest 字段的内容

以下内容不应被迁移程序写入 `kimi.plugin.json`：

- 自定义 `agents`
- `tools`
- `apps`
- `inject`
- `configFile`

对这些字段的处理原则：

- `agents` 若来源是 Agent 文件，优先迁移到 `.agents/agents/` 或 `.kimi-code/agents/`
- 其他无法映射到 Skill、MCP、hooks 或 `AGENTS.md` 的字段，输出 diagnostics 风险说明

## 6. `skills` 字段

- 可填写单个 `./` 路径或路径数组
- 路径必须位于 plugin root 内
- 若省略 `skills`，根目录的 `SKILL.md` 会被当作单个 Skill root

适合迁移的来源：

- `.claude-plugin/skills/*`
- `.agents/skills/*`
- Claude agent 中已经具备 Skill 语义的内容

## 7. `sessionStart.skill` 与 `skillInstructions`

这两个字段适合承载“原始 plugin 的初始化意图”：

- `sessionStart.skill`：在新会话或恢复会话时自动加载指定 Skill
- `skillInstructions`：给 plugin Skill 追加统一说明

适用场景：

- 术语映射
- 初始化规则
- 原本写在 plugin 总说明中的常驻提示

不适用场景：

- 需要真正执行代码的逻辑
- Claude agent 的完整运行时替身

## 8. `commands` 字段

- 指向 plugin root 内的目录或 `.md` 文件
- 指向目录时，会递归收集其中所有 `.md`
- 指向不存在或非 `.md` 路径时，会产生 diagnostics 并被忽略

命令文件规则：

- markdown 正文是实际提示词
- 可选 frontmatter：`name`、`description`
- 调用时自动带 plugin 命名空间，形如 `/plugin-id:command-name`
- 支持 `$ARGUMENTS`

## 9. `mcpServers` 字段

- 复用 Kimi MCP 的官方 schema
- 支持 stdio、HTTP、SSE
- stdio server 可用 `command`、`args`、`env`、`cwd`
- HTTP / SSE server 可用 `url`、`headers`、`bearerTokenEnvVar`

关键迁移约束：

- stdio 的 `./` 相对路径必须位于 plugin root 内
- 敏感配置不要硬编码为真实凭证

## 10. `hooks` 字段

plugin 可以声明 hooks，并且：

- 只在 plugin 启用期间生效
- hook 工作目录是 plugin root
- 可使用相对 plugin root 的 `./` 路径
- 插件安装本身不会主动执行 hooks，只有命中事件时才触发

与 Claude hook 的差异：

- Kimi hooks 使用 stdin 读取事件 JSON
- 返回值由退出码和可选 stdout JSON 决定
- 不能直接照搬 Claude 的 hook 配置和阻断语义

## 11. 安装与作用域

- Kimi plugin 当前按用户安装，对所有项目生效
- 暂不支持项目级安装范围
- 如需当前项目私有生效，优先考虑 `.kimi-code/skills`、`.kimi-code/mcp.json` 与 `AGENTS.md`

## 12. 最小示例

```json
{
  "name": "example-kimi-plugin",
  "version": "0.1.0",
  "description": "用于演示 Claude Plugin 迁移后的 Kimi 插件清单",
  "skills": "./skills/",
  "commands": "./commands/",
  "sessionStart": {
    "skill": "using-example-kimi-plugin"
  },
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": [
        "./scripts/example-mcp.js"
      ]
    }
  }
}
```

## 13. 迁移结论模板

把来源 plugin 迁移到 Kimi 时，结论应明确写成以下三类之一：

- **已完成插件化**：`skills`、`commands`、`mcpServers`、`hooks` 已完成合法迁移
- **部分插件化**：核心能力已迁移，但来源 `agents` 需落到 `.agents/agents`、`.kimi-code/agents` 或说明文档
- **待人工确认**：manifest 字段、路径、hooks 语义、Agent frontmatter 或目标落点仍存在风险
