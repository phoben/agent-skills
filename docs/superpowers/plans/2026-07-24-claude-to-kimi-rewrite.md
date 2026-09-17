# Claude-to-Kimi Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 `skills/claude-to-kimi/` 的文档、脚本和模板，使其与 Kimi 官方关于自定义 Agent、插件斜杠命令、hooks 和共享 Skill 目录的规则一致。

**Architecture:** 先统一文档口径，再修改两个脚本的扫描与差异分析行为，最后校正文档依赖的模板并用脚本命令回归验证。整次实现只触达 `skills/claude-to-kimi/` 及其配套文件，不扩散到仓库其他技能。

**Tech Stack:** Markdown, Node.js, PowerShell, Git

---

### Task 1: 重写技能正文与参考文档

**Files:**
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\SKILL.md`
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\references\claude-plugin-to-kimi-map.md`
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\references\kimi-plugin-spec.md`
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\references\kimi-workspace-spec.md`

- [ ] **Step 1: 先写一个失败校验，确认旧结论仍然存在**

Run:

```bash
rg -n "没有官方对等组件|\\.kimi-code/skills/<name>/SKILL.md|优先改写到 \\.kimi-code/AGENTS\\.md" skills/claude-to-kimi/SKILL.md skills/claude-to-kimi/references
```

Expected: 能命中当前旧规则，说明这些文件确实需要重写。

- [ ] **Step 2: 重写 `SKILL.md` 的目标结构、映射规则与 agents 章节**

将以下片段写入或改写到 `skills/claude-to-kimi/SKILL.md` 对应章节：

```md
## Kimi 目标结构总览

```text
.agents/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
└── agents/
    └── <agent-name>.md

.kimi-code/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── agents/
│   └── <agent-name>.md
├── mcp.json
└── AGENTS.md

plugin-root/
├── kimi.plugin.json
├── commands/
│   └── *.md
├── hooks/
│   └── *
└── scripts/
    └── *
```

### 1. Skills

- 默认工作区目标：`.agents/skills/<name>/SKILL.md`
- 若需要 Kimi 专属项目作用域，可落到 `.kimi-code/skills/<name>/SKILL.md`
- Plugin 内的 Skill 仍通过 `kimi.plugin.json -> skills` 声明

### 5. Agents

- Kimi 官方支持自定义 Agent 文件
- 默认目标：`.agents/agents/<name>.md` 或 `.kimi-code/agents/<name>.md`
- `agents` 不是 `kimi.plugin.json` 的 manifest 字段
- `AGENTS.md` 只承载长期规则与仓库级指令，不作为 Agent 文件的默认替代
```

- [ ] **Step 3: 重写 `claude-plugin-to-kimi-map.md` 的映射矩阵**

把 `agents`、`skills`、`commands` 三类核心映射调整成如下结构：

```md
| 资源类型 | 常见来源 | Shared 目标 | Workspace 目标 | Plugin 目标 | 默认方式 | 备注 |
|---|---|---|---|---|---|---|
| `skills` | `.claude/skills`、`.claude-plugin/skills`、`.agents/skills` | `.agents/skills/<name>/SKILL.md` | `.kimi-code/skills/<name>/SKILL.md` | plugin root 下 `skills/` + `kimi.plugin.json.skills` | 直接复制 | 默认优先 shared 目录 |
| `commands` | `.claude/commands`、`.claude-plugin/commands` | 无 | 一般改写为 Skill | plugin root 下 `commands/` + `kimi.plugin.json.commands` | 直接复制或轻改 | 对应 Kimi 插件斜杠命令 |
| `agents` | `.claude/agents`、`.claude-plugin/agents`、`.codex-plugin/agents` | `.agents/agents/<name>.md` | `.kimi-code/agents/<name>.md` | 无 | 直接复制或轻改 | 不是 plugin manifest 字段 |
```

- [ ] **Step 4: 重写 `kimi-plugin-spec.md` 的非支持字段与命令/hooks 描述**

将以下内容更新到 `skills/claude-to-kimi/references/kimi-plugin-spec.md`：

```md
## 5. 不是 plugin manifest 字段的内容

以下内容不应被迁移程序写入 `kimi.plugin.json`：

- 自定义 `agents`
- `tools`
- `apps`
- `inject`
- `configFile`

对 `agents` 的处理原则：

- 若来源是 Agent 文件，优先迁移到 `.agents/agents/` 或 `.kimi-code/agents/`
- 不要把 Agent 定义硬塞进 plugin manifest

## 8. `commands` 字段

- 指向 plugin root 内的目录或 `.md` 文件
- 调用时自动带 plugin 命名空间，形如 `/plugin-id:command-name`
- Markdown 正文是提示词，可带 `name`、`description` frontmatter
```

- [ ] **Step 5: 重写 `kimi-workspace-spec.md` 的 shared/workspace 分工与 Agent 目录**

将以下内容更新到 `skills/claude-to-kimi/references/kimi-workspace-spec.md`：

```md
## 1. Shared 与 Workspace Skill 目录

- 默认共享目录：`.agents/skills/`
- 条件性项目目录：`.kimi-code/skills/`

## 2. 自定义 Agent 目录

- 共享目录：`.agents/agents/`
- 项目目录：`.kimi-code/agents/`

Agent 文件是带 Frontmatter 的 Markdown，正文为系统提示词。

## 5. `AGENTS.md` 与 Agent 文件的分工

- `AGENTS.md`：长期约束、团队规则、术语映射
- `agents/*.md`：可被选择或委派的 Agent 定义
```

- [ ] **Step 6: 运行文档校验，确认旧结论已消失**

Run:

```bash
rg -n "没有官方对等组件|优先改写到 \\.kimi-code/AGENTS\\.md|\\.kimi-code/skills/<name>/SKILL.md" skills/claude-to-kimi/SKILL.md skills/claude-to-kimi/references
```

Expected: 没有匹配结果，或只剩被明确解释为“旧结论已废弃”的说明。

- [ ] **Step 7: 提交文档改动**

Run:

```bash
git add skills/claude-to-kimi/SKILL.md skills/claude-to-kimi/references/claude-plugin-to-kimi-map.md skills/claude-to-kimi/references/kimi-plugin-spec.md skills/claude-to-kimi/references/kimi-workspace-spec.md
git commit -m "docs: align claude-to-kimi with official kimi rules"
```

Expected: Git 生成仅包含 4 个文档文件的提交。

### Task 2: 更新来源盘点脚本

**Files:**
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\scripts\inventory-kimi-sources.js`

- [ ] **Step 1: 先运行当前脚本，确认它还没有正确覆盖 Agent 目录**

Run:

```bash
node skills/claude-to-kimi/scripts/inventory-kimi-sources.js . --summary
```

Expected: 当前输出没有明确列出 `.kimi-code/agents`、`.agents/agents`，也没有把 Agent 当作正式目标类型。

- [ ] **Step 2: 扩展工作区与 plugin 摘要结构，加入 Agent 目录**

在 `summarizeWorkspace()`、`summarizePlugin()` 与 `summarizeKimiTargets()` 中引入以下结构：

```js
resources: {
  skills: listSkillNames(path.join(baseDir, "skills")),
  commands: relativeList(path.join(baseDir, "commands"), (filePath) => filePath.endsWith(".md")),
  agents: relativeList(path.join(baseDir, "agents"), (filePath) => filePath.endsWith(".md")),
  hooks: relativeList(path.join(baseDir, "hooks"), () => true),
  scripts: relativeList(path.join(baseDir, "scripts"), () => true)
}
```

以及：

```js
function summarizeKimiTargets() {
  return {
    skillsShared: listSkillNames(path.join(rootDir, ".agents", "skills")),
    skillsWorkspace: listSkillNames(path.join(rootDir, ".kimi-code", "skills")),
    agentsShared: relativeList(path.join(rootDir, ".agents", "agents"), (filePath) => filePath.endsWith(".md")),
    agentsWorkspace: relativeList(path.join(rootDir, ".kimi-code", "agents"), (filePath) => filePath.endsWith(".md")),
    mcpJson: exists(path.join(rootDir, ".kimi-code", "mcp.json")),
    pluginManifest: exists(path.join(rootDir, "kimi.plugin.json"))
  };
}
```

- [ ] **Step 3: 调整建议逻辑，把 Skill 默认目标和 Agent 迁移建议改正确**

将 `makeSuggestions()` 改成至少包含以下判断：

```js
if (claudeWorkspace.exists && sharedSkills.exists === false) {
  suggestions.push("发现 Claude skills，但未发现 `.agents/skills`，建议优先规划共享 Skill 迁移。");
}

if (claudeWorkspace.resources.agents.length > 0 || plugins.some((item) => item.resources.agents?.length > 0)) {
  suggestions.push("发现来源 agents，建议优先判断是否可直接迁移到 `.agents/agents` 或 `.kimi-code/agents`。");
}

if (sourcePlugins.some((item) => item.resources.hooks.length > 0)) {
  suggestions.push("发现来源 plugin hooks，迁移时需要按 Kimi hook 协议重写，不建议直接复制。");
}
```

- [ ] **Step 4: 更新脚本的 summary 输出文本**

把 `--summary` 输出扩展为至少包含：

```js
console.log(`.agents/skills: ${sharedSkills.exists ? "存在" : "不存在"}`);
console.log(`.agents/agents: ${kimiTargets.agentsShared.length > 0 ? "存在" : "不存在或为空"}`);
console.log(`.kimi-code/agents: ${kimiTargets.agentsWorkspace.length > 0 ? "存在" : "不存在或为空"}`);
```

- [ ] **Step 5: 运行脚本回归验证**

Run:

```bash
node skills/claude-to-kimi/scripts/inventory-kimi-sources.js . --summary
node skills/claude-to-kimi/scripts/inventory-kimi-sources.js . | Select-Object -First 20
```

Expected: summary 中出现 `.agents/skills`、`.agents/agents`、`.kimi-code/agents` 等目标信息；JSON 输出包含 `agents` 相关字段。

- [ ] **Step 6: 提交脚本改动**

Run:

```bash
git add skills/claude-to-kimi/scripts/inventory-kimi-sources.js
git commit -m "feat: update kimi source inventory rules"
```

Expected: Git 生成仅包含 `inventory-kimi-sources.js` 的提交。

### Task 3: 更新差异分析脚本

**Files:**
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\scripts\analyze-kimi-migration-diff.js`

- [ ] **Step 1: 先运行当前脚本，确认 `agents` 仍被错误归类**

Run:

```bash
node skills/claude-to-kimi/scripts/analyze-kimi-migration-diff.js . --summary
```

Expected: 现有逻辑把 `agents` 放进 `needsManualConfirmation`，而不是参与正常 diff。

- [ ] **Step 2: 为 Agent 文件增加列表与比较逻辑**

新增 Agent 文件列表函数或直接复用通用列表逻辑：

```js
function listAgentFiles(baseDir) {
  return listFiles(baseDir, (filePath) => filePath.endsWith(".md"));
}
```

然后加入 shared / workspace Agent 对比：

```js
compareMaps({
  category: "workspace-agents",
  sourceLabel: ".claude/agents",
  targetLabel: ".agents/agents",
  targetBase: path.join(rootDir, ".agents", "agents"),
  sourceMap: listAgentFiles(path.join(rootDir, ".claude", "agents")),
  targetMap: listAgentFiles(path.join(rootDir, ".agents", "agents")),
  groups,
  forceRewrite: false
});
```

对 plugin 侧来源至少加入：

```js
compareMaps({
  category: `${sourcePlugin}-agents`,
  sourceLabel: `${sourcePlugin}/agents`,
  targetLabel: ".agents/agents",
  targetBase: path.join(rootDir, ".agents", "agents"),
  sourceMap: listAgentFiles(path.join(rootDir, sourcePlugin, "agents")),
  targetMap: listAgentFiles(path.join(rootDir, ".agents", "agents")),
  groups,
  forceRewrite: false
});
```

- [ ] **Step 3: 把 `addAgentWarnings()` 改成只处理真正高风险项**

将这一段：

```js
groups.needsManualConfirmation.push({
  category: "agents",
  source,
  target: ".kimi-code/AGENTS.md or Skill",
  reason: "Kimi 公开 plugin 规范中没有 Claude 风格 agents 的对等组件，需要人工判定落点。"
});
```

改成只在以下场景加入人工确认：

```js
groups.needsManualConfirmation.push({
  category: "agent-review",
  source,
  target: ".agents/agents or .kimi-code/agents",
  reason: "来源 Agent 需要人工确认 frontmatter、工具权限或 override/subagents 语义。"
});
```

并且只对无法解析、命名冲突或语义异常的文件使用该分支。

- [ ] **Step 4: 保留 manifest 风险检查，但删除“agents 无对等能力”的推导**

保留下面这类逻辑：

```js
const unsupportedFields = ["tools", "apps", "inject", "configFile"];
```

但不要再因为来源存在 `agents` 目录就自动输出：

```js
reason: "Kimi 公开 plugin 规范中没有 Claude 风格 agents 的对等组件，需要人工判定落点。"
```

- [ ] **Step 5: 运行脚本回归验证**

Run:

```bash
node skills/claude-to-kimi/scripts/analyze-kimi-migration-diff.js . --summary
node skills/claude-to-kimi/scripts/analyze-kimi-migration-diff.js .
```

Expected: `agents` 参与 `toAdd` / `same` / `conflicts` 计算；只有非法或高风险 Agent 才进入 `needsManualConfirmation`。

- [ ] **Step 6: 提交脚本改动**

Run:

```bash
git add skills/claude-to-kimi/scripts/analyze-kimi-migration-diff.js
git commit -m "feat: analyze kimi agent migration targets"
```

Expected: Git 生成仅包含 `analyze-kimi-migration-diff.js` 的提交。

### Task 4: 调整模板并做整体验证

**Files:**
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\templates\config.toml.hooks.example`
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\templates\kimi.plugin.json`
- Modify: `e:\Develop\agent-skills\skills\claude-to-kimi\templates\mcp.json`

- [ ] **Step 1: 更新 hooks 示例模板**

把 `config.toml.hooks.example` 调整为贴近官方事件模型，例如：

```toml
[[hooks]]
event = "UserPromptSubmit"
matcher = ".*"
command = "node ./hooks/inject-project-context.mjs"
timeout = 5

[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node ./hooks/block-dangerous-bash.mjs"
timeout = 5

[[hooks]]
event = "SubagentStop"
matcher = ".*"
command = "node ./hooks/report-subagent-result.mjs"
timeout = 5
```

- [ ] **Step 2: 校正 `kimi.plugin.json` 示例，只保留官方字段**

示例应接近：

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
  "skillInstructions": "当用户调用本插件提供的 Skill 时，优先遵循插件内的迁移规则与参考资料。",
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["./scripts/example-mcp.js"]
    }
  },
  "hooks": [
    {
      "event": "PreToolUse",
      "matcher": "Bash",
      "command": "node ./hooks/block-dangerous-bash.mjs",
      "timeout": 5
    }
  ]
}
```

- [ ] **Step 3: 校正 `mcp.json` 示例说明**

保留 stdio 与 HTTP 示例，但确保结构保持：

```json
{
  "mcpServers": {
    "example-stdio-server": {
      "command": "node",
      "args": ["./scripts/example-mcp.js"],
      "env": {
        "EXAMPLE_API_KEY": "${EXAMPLE_API_KEY}"
      }
    },
    "example-http-server": {
      "url": "https://example.com/mcp",
      "bearerTokenEnvVar": "EXAMPLE_HTTP_TOKEN",
      "enabled": false
    }
  }
}
```

- [ ] **Step 4: 做整体验证**

Run:

```bash
node skills/claude-to-kimi/scripts/inventory-kimi-sources.js . --summary
node skills/claude-to-kimi/scripts/analyze-kimi-migration-diff.js . --summary
rg -n "没有官方对等组件|AGENTS\\.md or Skill|\\.kimi-code/skills/<name>/SKILL.md" skills/claude-to-kimi
```

Expected:
- 两个脚本都能正常运行；
- summary 输出与新规则一致；
- `rg` 不再命中已废弃的旧结论。

- [ ] **Step 5: 提交模板与最终收尾改动**

Run:

```bash
git add skills/claude-to-kimi/templates/config.toml.hooks.example skills/claude-to-kimi/templates/kimi.plugin.json skills/claude-to-kimi/templates/mcp.json
git commit -m "chore: refresh kimi migration templates"
```

Expected: Git 生成仅包含 3 个模板文件的提交。

- [ ] **Step 6: 输出实现总结并准备验收**

Run:

```bash
git status --short
git log --oneline -n 5
```

Expected: 工作区干净或只剩用户明确保留的改动；最近提交包含文档、脚本、模板三个阶段。
