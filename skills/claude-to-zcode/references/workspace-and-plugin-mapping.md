# 工作区与插件双轨映射矩阵

## 映射总览

| 资源类型 | 常见来源 | 工作区目标 | 插件目标 | 默认方式 | 备注 |
|---|---|---|---|---|---|
| `skills` | `.claude/skills`、`.agents/skills`、plugin 内 skills | `.zcode/skills/<name>/SKILL.md` | plugin root 下 `skills/` + `plugin.json.skills` | 直接复制 | 需检查 frontmatter |
| `commands` | `.claude/commands`、plugin 内 commands | `.zcode/commands/**/*.md` | plugin root 下 `commands/` + `plugin.json.commands` | 直接复制 | 路径名映射到 `:` |
| `hooks` | `.claude/hooks` + `.claude/settings.json`、plugin hooks | `.zcode/hooks/*` + `.zcode/config.json` | plugin root 下 `hooks/` + `plugin.json.hooks` | 协议转换 | stdout 必须改为严格 JSON |
| `mcp` | `.claude/settings.json`、workspace config、plugin manifest | `.zcode/config.json -> mcp.servers` | `plugin.json.mcpServers` | 结构转换 | schema 严格 |
| `agents` | `.claude/agents`、`.codex/agents` | `.zcode/agents/*.md` | plugin 中仅记录，不视为可执行组件 | 条件转换 | Codex TOML 需转 markdown |
| `templates` | `.claude/templates`、plugin 辅助目录 | `.zcode/templates/*` | plugin 根目录辅助文件 | 直接复制 | 不是 plugin manifest 一等组件 |
| `scripts` | `.claude/hooks` 辅助脚本、plugin scripts | `.zcode/scripts/*` | plugin 根目录辅助脚本 | 直接复制或轻改 | 需要被 hooks/commands/skills 调用 |

## 分项规则

### 1. Skills

工作区：

* 放到 `.zcode/skills/<name>/SKILL.md`
* 若同名 skill 已存在，先按发现顺序判断是否已被更高优先级版本覆盖

插件：

* 放到 plugin root 下 `skills/`
* 在 `plugin.json` 中声明该目录

### 2. Commands

工作区：

* 放到 `.zcode/commands/`
* 保持裸 markdown，不要新增 frontmatter

插件：

* 放到 plugin root 下 `commands/`
* 在 `plugin.json` 中声明

### 3. Hooks

工作区：

* 脚本放到 `.zcode/hooks/`
* 注册放到 `.zcode/config.json -> hooks.events`

插件：

* hook 文件放到 plugin root 下 `hooks/`
* 在 `plugin.json` 中声明 `hooks`

关键差异：

* 工作区 hook 需要 `hooks.enabled: true`
* stdout 必须是严格 JSON
* 事件名只能是 7 个 ZCode 合法值

### 4. MCP

工作区：

* 放到 `.zcode/config.json -> mcp.servers`

插件：

* 放到 `plugin.json -> mcpServers`

注意：

* 工作区配置文件不展开模板变量
* plugin 提供的 MCP 才适合使用 plugin root 相关模板变量

### 5. Agents

工作区：

* 需要真实运行时，放到 `.zcode/agents/*.md`

插件：

* 可在 plugin manifest 中记录，但当前不是默认可执行组件
* 不要把“manifest 里写了 agents”当成迁移完成

### 6. Templates

工作区：

* 放到 `.zcode/templates/`

插件：

* 作为 plugin 根目录内辅助文件保留
* 由 skill / command / hook 用相对路径引用

### 7. Scripts

工作区：

* 如项目需要，放到 `.zcode/scripts/`

插件：

* 放到 plugin 根目录 `scripts/` 或等效目录
* 由 hooks / commands / skills 调用

## 不建议自动迁移的情况

以下场景默认进入“需人工确认”：

* `.codex/agents/*.toml` 中含复杂字段映射，无法稳定转成 ZCode agent frontmatter
* plugin 内部存在越界路径或绝对路径
* hooks 同时依赖 Claude 专属事件和 Claude 专属 stdout 语义
* `templates` / `scripts` 的引用路径无法静态解析
