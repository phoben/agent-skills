# ZCode 插件规范与限制

这份文档只聚焦插件迁移时必须遵守的 ZCode 规则。

## 1. Manifest 位置

ZCode 插件 manifest 的首选位置是：

```text
.zcode-plugin/plugin.json
```

兼容探测顺序还会识别：

* `.claude-plugin/plugin.json`
* `.codex-plugin/plugin.json`

但迁移目标建议统一到 `.zcode-plugin/plugin.json`。

## 2. `plugin.json` 最小要求

必填：

* `name`

推荐填写：

* `version`
* `description`
* `skills`
* `commands`
* `hooks`
* `mcpServers`

## 3. `name` 规则

插件名必须匹配：

```text
^[a-z0-9][a-z0-9._-]{0,127}$
```

不要使用：

* 空格
* 大写字母开头
* 非法路径字符

## 4. 默认可执行组件

ZCode 插件真正执行的主要组件是：

* `skills`
* `commands`
* `hooks`
* `mcpServers`

## 5. 记录但不应当默认视为可执行的字段

以下字段即使出现在 manifest 中，也不要把它们理解成“插件安装后就会自动运行”：

* `agents`
* `channels`
* `lspServers`
* `outputStyles`
* `settings`

迁移时要特别注意：

* 如果 agent 需要在项目里真实可用，优先迁移到 `.zcode/agents/*.md`

## 6. 路径约束

组件路径必须：

* 是相对路径
* 位于 plugin root 内部

以下写法应判定为非法：

* 绝对路径
* `..\..\` 逃逸 plugin root

## 7. `userConfig` 适用场景

`userConfig` 适合描述插件配置项，例如：

* 路径
* 标志位
* 非敏感字符串

注意：

* 敏感字段当前不适合作为默认持久化方案
* 真实密钥更适合通过环境变量或其他安全方式注入

## 8. MCP 与 hooks 的插件化要点

### MCP

* 写在 `plugin.json -> mcpServers`
* 适合提供跨项目复用的 MCP 服务器

### Hooks

* 写在 `plugin.json -> hooks`
* 仍然需要遵守 ZCode hook 事件名、matcher、stdout JSON schema 等约束

## 9. 最小示例

```json
{
  "name": "sample-zcode-plugin",
  "version": "0.1.0",
  "description": "ZCode 插件示例",
  "skills": "skills",
  "commands": "commands",
  "hooks": "hooks",
  "mcpServers": {
    "demo": {
      "type": "stdio",
      "command": "node",
      "args": ["scripts/demo-mcp.js"]
    }
  }
}
```

## 10. 迁移时的结论模板

当你把源 plugin 迁移到 ZCode 时，结论要明确写成下面三类之一：

* **已完成插件化**：`skills` / `commands` / `hooks` / `mcpServers` 已合法迁移
* **部分插件化**：组件已迁移，但 `agents` / `templates` / `scripts` 仅作为辅助资产保留
* **待人工确认**：manifest 名称、路径、依赖或 agent 语义仍有风险
