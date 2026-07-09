# 源检测与差异分析

这份文档负责把“先扫描、后迁移”固定成标准动作，避免智能体一上来就复制目录。

## 1. 检测范围

迁移到 ZCode 时，至少检查以下路径：

### 工作区目录

* `.claude/`
* `.zcode/`
* `.agents/skills/`

### 插件目录

* `.claude-plugin/`
* `.codex-plugin/`
* `.zcode-plugin/`

## 2. 每个目录要识别什么

### `.claude/`

至少盘点：

* `skills/`
* `commands/`
* `agents/`
* `templates/`
* `hooks/`
* `settings.json`

### `.zcode/`

至少盘点：

* `skills/`
* `commands/`
* `agents/`
* `templates/`
* `hooks/`
* `config.json`

### `*.zcode-plugin` / `*.claude-plugin` / `*.codex-plugin`

至少盘点：

* `plugin.json`
* `skills/`
* `commands/`
* `hooks/`
* `scripts/`
* `templates/`
* plugin 内部自定义辅助目录

> 优先级说明：ZCode 插件 manifest 的首选位置是 `.zcode-plugin/plugin.json`。迁移来源是 `.claude-plugin` 或 `.codex-plugin` 时，目标建议统一到 `.zcode-plugin/plugin.json`。

## 3. 差异分类

对每项资源都输出以下之一：

* **可直接迁移**：目标不存在，或只是落后副本
* **内容一致**：跳过
* **需协议转换**：工作区 hooks、MCP、plugin manifest 等结构敏感资源
* **存在冲突**：目标与来源都修改过，不能自动覆盖
* **仅可保留为辅助资产**：如插件中的 `templates`、`scripts`
* **不建议自动迁移**：语义无法可靠推断

## 4. 最小比对顺序

### 工作区

1. `.claude/*` vs `.zcode/*`
2. `.agents/skills/*` vs `.zcode/skills/*`

### 插件

1. `.claude-plugin/*` vs `.zcode-plugin/*`
2. `.codex-plugin/*` vs `.zcode-plugin/*`

## 5. 同名资源处理规则

### 完全一致

* 直接跳过
* 在报告中标记为“内容一致”

### 仅来源更新

* 标记为“可直接迁移”
* 可安全复制或转换

### 仅目标更新

* 标记为“目标领先”
* 默认不回退

### 两端都改过

* 标记为“存在冲突”
* 必须输出冲突路径、来源位置、目标位置和人工确认建议

## 6. 哪些资源默认属于“需协议转换”

以下资源不要按纯文本差异处理：

* `.claude/settings.json` -> `.zcode/config.json`
* `.claude/hooks/*` -> `.zcode/hooks/*`
* `plugin.json` 迁移到 `.zcode-plugin/plugin.json`
* `.claude` / `.codex` 中的 MCP 配置 -> ZCode `mcp.servers` 或 `mcpServers`
* `.codex/agents/*.toml` -> `.zcode/agents/*.md`

## 7. PowerShell 盘点示例

```powershell
$roots = @(
  ".claude",
  ".zcode",
  ".claude-plugin",
  ".codex-plugin",
  ".zcode-plugin",
  ".agents\skills"
)

foreach ($root in $roots) {
  [pscustomobject]@{
    Path = $root
    Exists = Test-Path $root
  }
}
```

## 8. 自动化建议

优先使用：

```powershell
node .\skills\claude-to-zcode\scripts\inventory-zcode-sources.js .
node .\skills\claude-to-zcode\scripts\analyze-zcode-diff.js .
```

脚本的职责分工：

* `inventory-zcode-sources.js`：告诉你“发现了什么”
* `analyze-zcode-diff.js`：告诉你“下一步该迁移什么、哪些不能直接动”
