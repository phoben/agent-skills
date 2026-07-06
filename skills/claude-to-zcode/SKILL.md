---
name: claude-to-zcode
description: |
  当需要把 Claude Code 的工程化配置（skills/commands/hooks/agents/templates/config）迁移或适配到 ZCode 时使用此 Skill。适用于任何项目。

  触发场景：
  - 需要把 .claude/skills 迁移到 .zcode/skills（任何项目通用）
  - 需要把 Claude hooks 适配为 ZCode 的严格 JSON 协议
  - 需要为 ZCode 配置 .zcode/config.json（hooks/mcp 等）
  - 现有 .zcode 配置不生效、hook 失败、需要诊断
  - 从零搭建 ZCode 工程化目录结构
  - 需要理解 Claude Code 与 ZCode 的协议差异

  触发词：claude转zcode、迁移到zcode、zcode迁移、适配zcode、.claude转.zcode、ZCode配置、hook协议不兼容、ZCode hooks失败、additionalContext、工具配置迁移、Claude Code to ZCode、zcode hooks不触发
---

# Claude Code → ZCode 工程化迁移指南

## 概述

把一个项目从 Claude Code 切到 ZCode（或同时支持两者），需要把 `.claude/` 下的工程化配置迁移到 `.zcode/`，并**适配协议差异**——不是简单复制目录就能跑通。

ZCode 与 Claude Code 的**资源类型相同**（都是 skills/commands/hooks/agents/templates 五种），但**协议不同**：

- skills/commands/agents/templates：格式基本一致，直接复制可用
- **hooks：协议差异巨大**，是最容易踩坑的地方（Claude 的纯文本 stdout 在 ZCode 会全部失败）

本技能覆盖**全部 5 种资源**的迁移规则、配置文件转换、标准流程、诊断验证和 12 个常见陷阱。

### 与官方技能的关系

| 官方技能 | 关系 | 用途 |
|---------|------|------|
| `zcode-guide:zcode-configuration-guide` | 互补 | 提供 ZCode 配置地图（资源位置、合并规则、优先级） |
| `zcode-guide:diagnosing-hooks` | 互补 | 提供深度 hook 诊断流程（本技能引用其 12 个陷阱） |
| `skill-creator` | 互补 | 教你**创建**新技能；本技能教**迁移**已有配置 |

### 本技能的边界

- ✅ **管**：工具配置迁移（`.claude/*` → `.zcode/*` 协议适配）
- ❌ **不管**：业务代码迁移（如包名重构、框架切换）——那是项目特定任务

---

## 核心差异速查表

### 5 种资源 × 3 个工具的格式差异

| 资源 | Claude Code | Codex | ZCode | 迁移难度 |
|------|-------------|-------|-------|---------|
| **Skills** | `.claude/skills/foo/SKILL.md`（YAML frontmatter） | `.codex/skills/foo/SKILL.md`（同） | `.zcode/skills/foo/SKILL.md`（同） | 🟢 低（直接复制） |
| **Commands** | `.claude/commands/foo.md`（裸 md，无 frontmatter） | `.codex/skills/foo/SKILL.md`（**必须加** frontmatter，Codex 不支持项目级 prompts） | `.zcode/commands/foo.md`（裸 md，**与 Claude 相同**） | 🟢 低（直接复制） |
| **Agents** | `.claude/agents/foo.md`（+ frontmatter） | `.codex/agents/foo.toml`（TOML 格式） | `.zcode/agents/foo.md`（**与 Claude 相同**） | 🟢 低（直接复制） |
| **Templates** | `.claude/templates/foo.md`（纯文本） | （通常不同步） | `.zcode/templates/foo.md`（同） | 🟢 低（直接复制） |
| **Hooks** | `.claude/hooks/*.cjs` + `.claude/settings.json` | `.codex/hooks/*.cjs` + `.codex/hooks.json` | `.zcode/hooks/*.cjs` + `.zcode/config.json` | 🔴 **高**（协议差异大） |

### Hook 协议差异（最关键，必读）

| 维度 | Claude Code | ZCode |
|------|-------------|-------|
| **配置位置** | `.claude/settings.json` 的 `hooks` 键 | `.zcode/config.json` → `hooks.events.<Event>` |
| **启用开关** | 无需 | **必须 `hooks.enabled: true`**（默认禁用！） |
| **支持事件** | 较多（含 Notification/SubagentStop/PreCompact 等） | **仅 7 个**：`SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PermissionRequest`、`PostToolUse`、`PostToolUseFailure`、`Stop` |
| **stdout 协议** | **纯文本自动注入** | **严格 JSON**（非 JSON 直接判失败） |
| **模板变量** | `$CLAUDE_PROJECT_DIR` | `${ZCODE_PROJECT_DIR}`、`${ZCODE_SESSION_ID}` |
| **Matcher** | 工具名 | 工具名（**大小写敏感正则**），`Task↔Agent`、`Write/Edit←ApplyPatch` 有别名 |
| **超时** | 毫秒 | 秒（command 类型）/ 毫秒（process 类型） |

> **⚠️ 最致命的差异**：Claude 的 `console.log(markdownText)` 在 ZCode 会直接失败——ZCode 把 stdout 按严格 JSON Schema 校验，非 JSON 输出会被丢弃并标记 `hook.run.failed`。这是迁移中最常踩的坑。

---

## 资源迁移规则

### 3.1 Skills 迁移

Skills 的格式在 Claude 和 ZCode 间完全一致（都是 `SKILL.md` + YAML frontmatter），**直接复制目录**即可。

```bash
cp -r .claude/skills/foo .zcode/skills/foo
```

**注意事项**：

- **软链 vs 独立文件**：`.zcode/skills/` 可以是软链指向 `.claude/skills/`（省空间、自动同步），或独立文件复制（跨机稳定、可独立提交 git）。**推荐独立文件**，便于版本控制和团队协作。
- **软链陷阱**：如果你的 `.claude/skills/foo` 本身是指向 `.agents/skills/foo` 的软链，复制时要用 `cp -rL`（跟随软链）或 `cp -r --dereference`，否则 `.zcode` 下会得到无效软链。
- **跨工具共享层**：如果想 skills 在 Claude/Codex/ZCode 三端共享，放到 `.agents/skills/`（标准跨工具位置），各工具会自动发现。但同名 skill 在 `.zcode/skills/` 优先级更高，可用来覆盖。

**检查清单**：
- [ ] 每个 skill 目录都有 `SKILL.md`
- [ ] YAML frontmatter 含 `name`（kebab-case，与目录名一致）和 `description`
- [ ] 无软链残留（`find .zcode/skills -type l` 应为空）

### 3.2 Commands 迁移

ZCode 原生支持项目级 `.zcode/commands/*.md`，格式与 Claude Code 完全相同（裸 markdown，**无 frontmatter**）。

```bash
cp .claude/commands/foo.md .zcode/commands/foo.md
```

**注意**：Codex 不支持项目级 prompts，所以 Codex 把 command 包装成带 frontmatter 的 skill（`.codex/skills/foo/SKILL.md`）。ZCode 不需要这套变通，直接用裸 md。

**检查清单**：
- [ ] `.zcode/commands/` 下的 .md 文件与 `.claude/commands/` 一致
- [ ] 文件名即为命令名（`foo.md` → `/foo`）
- [ ] 嵌套目录用冒号（`review/code.md` → `/review:code`）

### 3.3 Hooks 迁移（最复杂）

Hooks 是迁移工作的核心。**业务逻辑保留，仅改输出协议**。下面是关键转换规则：

#### 规则 1：纯文本输出 → JSON 包装

```javascript
// ❌ Claude 写法（ZCode 会失败）
console.log('## 提醒\n注意分支保护');
process.exit(0);

// ✅ ZCode 写法
process.stdout.write(JSON.stringify({
  additionalContext: '## 提醒\n注意分支保护'
}));
process.exit(0);
```

#### 规则 2：字段名映射

| Claude 字段 | ZCode 字段 | 说明 |
|------------|-----------|------|
| `{ continue: true, systemMessage: '...' }` | `{ additionalContext: '...' }` | 警告类注入 |
| `{ systemMessage: '...' }` | `{ additionalContext: '...' }` | 同上 |
| `{ decision: 'block', reason: '...' }` | `{ decision: 'deny', reason: '...' }` | 阻断工具调用 |
| `{ continue: true }`（无消息） | `{}` 或空输出 | 通过且不注入 |

#### 规则 3：PreToolUse 的 decision 取值

ZCode 的 PreToolUse 支持 `decision: 'allow' | 'ask' | 'deny'`：

```javascript
// 放行
process.stdout.write(JSON.stringify({}));           // 空 = 通过
// 或
process.stdout.write(JSON.stringify({ decision: 'allow' }));

// 阻断
process.stdout.write(JSON.stringify({
  decision: 'deny',
  reason: '🚫 危险命令被阻止：rm -rf /'
}));

// 交由用户确认
process.stdout.write(JSON.stringify({
  decision: 'ask',
  reason: '即将执行 force push，是否继续？'
}));
```

#### 规则 4：副作用类 hook（无输出）

纯副作用的 hook（如清理临时文件、写状态文件）**保持空输出**即可：

```javascript
// ✅ ZCode 完全兼容：空 stdout + exit 0 = 通过且不注入
function doCleanup() { /* ... */ }
doCleanup();
process.exit(0);
```

#### 规则 5：模板变量替换

```bash
# Claude
node $CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs

# ZCode（注意 ${} 而非 $，且变量名不同）
node "${ZCODE_PROJECT_DIR}/.zcode/hooks/foo.cjs"
```

#### 规则 6：stdin 字段名兼容

ZCode 的 stdin JSON 可能用驼峰（`toolName`/`toolInput`），Claude 用下划线（`tool_name`/`tool_input`）。**脚本应同时兼容两种**：

```javascript
const toolName = input.toolName || input.tool_name || '';
const toolInput = input.toolInput || input.tool_input || {};
```

#### 规则 7：matcher 必须正确

ZCode 的 matcher 是**大小写敏感正则**，匹配工具名：

```json
// ❌ 错误：小写不匹配（工具名是 Bash，大写 B）
"matcher": "bash"

// ✅ 正确
"matcher": "Bash"
"matcher": "Bash|Write|Edit|ApplyPatch"
```

省略 matcher = 匹配所有工具（适用于 UserPromptSubmit 等）。

#### 规则 8：严格 JSON Schema（陷阱最高频）

ZCode 对 stdout 按**严格 schema** 校验，多余 key 也会失败：

```javascript
// ❌ 错误：含未知 key
process.stdout.write(JSON.stringify({ foo: 'bar' }));

// ❌ 错误：混合 Claude 和 ZCode key
process.stdout.write(JSON.stringify({ continue: true, additionalContext: '...' }));

// ✅ 正确：只用 ZCode 认可的 key
process.stdout.write(JSON.stringify({ additionalContext: '...' }));
```

各事件认可的有效 key：

| 事件 | 注入类 key | 决策类 key |
|------|-----------|-----------|
| SessionStart | `additionalContext` | — |
| UserPromptSubmit | `additionalContext` | — |
| PreToolUse | `additionalContext` | `decision` (allow/ask/deny) + `reason` |
| PermissionRequest | `additionalContext` | `decision` + `reason` |
| PostToolUse | `additionalContext` | — |
| PostToolUseFailure | `additionalContext` | — |
| Stop | `additionalContext` | 可请求继续（最多 3 次） |

**检查清单**：
- [ ] 所有 `console.log(text)` 改为 `process.stdout.write(JSON.stringify({additionalContext: text}))`
- [ ] 移除 Claude 专属 key（`continue`、`systemMessage`、`decision:'block'`）
- [ ] stdin 解析同时兼容驼峰和下划线字段名
- [ ] 路径用 `${ZCODE_PROJECT_DIR}` 而非 `$CLAUDE_PROJECT_DIR`

### 3.4 Agents 迁移

ZCode 的 agents 格式与 Claude Code 完全相同（`.md` + frontmatter），**直接复制**：

```bash
cp .claude/agents/*.md .zcode/agents/
```

**注意**：Codex 用 `.toml` 格式，不能直接复制到 ZCode。从 Codex 迁移 agents 需要把 TOML 转回 markdown frontmatter。

**frontmatter 字段**（Claude/ZCode 通用）：
- `name`：agent 名称
- `description`：何时触发
- `model`：使用的模型（如 `opus`、`sonnet`）
- `tools`：可用工具列表（逗号分隔）

### 3.5 Templates 迁移

纯文本模板，直接复制：

```bash
cp -r .claude/templates/* .zcode/templates/
```

---

## 配置文件转换

### `.claude/settings.json` → `.zcode/config.json`

#### 关键差异

| 维度 | Claude Code | ZCode |
|------|-------------|-------|
| 文件 | `.claude/settings.json` | `.zcode/config.json` |
| hooks 启用 | 无需 | **必须 `hooks.enabled: true`** |
| hooks 结构 | 顶层 `hooks.UserPromptSubmit` 等 | **嵌套 `hooks.events.UserPromptSubmit`** |
| MCP 结构 | 顶层 `mcpServers` | **嵌套 `mcp.servers`** |
| 模板变量 | `$CLAUDE_PROJECT_DIR` | `${ZCODE_PROJECT_DIR}` |

#### 转换示例

**Claude 的 `settings.json`**：

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/foo.cjs" }
        ]
      }
    ]
  },
  "mcpServers": {
    "postgres": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres"] }
  }
}
```

**ZCode 的 `config.json`（转换后）**：

```json
{
  "hooks": {
    "enabled": true,
    "events": {
      "UserPromptSubmit": [
        {
          "matcher": "",
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/foo.cjs\"" }
          ]
        }
      ]
    }
  },
  "mcp": {
    "servers": {
      "postgres": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres"], "type": "stdio" }
    }
  }
}
```

#### 完整 config.json 模板

```json
{
  "hooks": {
    "enabled": true,
    "events": {
      "SessionStart": [
        {
          "matcher": "startup",
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/session-start.cjs\"", "timeout": 10 }
          ]
        }
      ],
      "UserPromptSubmit": [
        {
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/skill-eval.cjs\"" }
          ]
        }
      ],
      "PreToolUse": [
        {
          "matcher": "Bash|Write|Edit|ApplyPatch",
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/pre-tool.cjs\"", "timeout": 5 }
          ]
        }
      ],
      "PostToolUse": [
        {
          "matcher": "Write|Edit|ApplyPatch",
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/post-tool.cjs\"", "timeout": 5 }
          ]
        }
      ],
      "Stop": [
        {
          "hooks": [
            { "type": "command", "command": "node \"${ZCODE_PROJECT_DIR}/.zcode/hooks/stop.cjs\"", "timeout": 10 }
          ]
        }
      ]
    }
  },
  "mcp": {
    "servers": {}
  }
}
```

> **关于 timeout 单位**：`type: "command"` 时 `timeout` 是**秒**；`type: "process"` 时 `timeoutMs` 是**毫秒**。容易混淆，务必注意。

---

## 标准迁移流程（5 步法）

### 步骤 1：扫描源 `.claude/` 资源清单

```bash
echo "=== 资源清点 ==="
echo "skills: $(ls .claude/skills 2>/dev/null | wc -l) 个"
echo "commands: $(ls .claude/commands 2>/dev/null | wc -l) 个"
echo "agents: $(ls .claude/agents 2>/dev/null | wc -l) 个"
echo "templates: $(ls .claude/templates 2>/dev/null | wc -l) 个"
echo "hooks: $(ls .claude/hooks/*.cjs 2>/dev/null | wc -l) 个"
echo ""
echo "=== settings.json 的 hooks 配置 ==="
cat .claude/settings.json | grep -E '"(UserPromptSubmit|PreToolUse|PostToolUse|Stop|SessionStart)"' 
```

记录清单，决定哪些资源要迁移、哪些要丢弃。

### 步骤 2：创建 `.zcode/` 目录骨架 + 配置 `.gitignore`

```bash
mkdir -p .zcode/{skills,commands,agents,templates,hooks,scripts}
```

**`.gitignore` 放行规则**（关键，否则团队拉不到配置）：

```gitignore
# ZCode 目录：放行共享配置，忽略含密钥的 config.json
/.zcode/*
!/.zcode/skills/
!/.zcode/commands/
!/.zcode/agents/
!/.zcode/templates/
!/.zcode/hooks/
!/.zcode/scripts/
!/.zcode/config.example.json
/.zcode/config.json
```

> `config.json` 通常含 MCP 数据库口令，必须忽略；同时提供 `config.example.json` 模板进 git。

### 步骤 3：复制静态资源

skills / commands / agents / templates 直接复制：

```bash
cp -rL .claude/skills/* .zcode/skills/    # -L 跟随软链，避免无效软链
cp .claude/commands/*.md .zcode/commands/
cp .claude/agents/*.md .zcode/agents/
cp -r .claude/templates/* .zcode/templates/ 2>/dev/null
```

### 步骤 4：重写 hooks + 生成 config.json

这一步按"资源迁移规则 → 3.3 Hooks 迁移"逐个改写脚本，并按"配置文件转换"生成 `.zcode/config.json`。

**建议**：把 `.zcode/config.example.json`（模板，进 git）和 `.zcode/config.json`（真实，忽略）分别维护，让别人 clone 后 `cp config.example.json config.json` 即可。

### 步骤 5：逐个手测 hook + 查日志验证

见下一章"诊断与验证"。

---

## 诊断与验证

### 手测脚本（最重要）

每个 hook 都要单独手测，确认输出是有效 JSON：

```bash
# UserPromptSubmit 类 hook
echo '{"prompt":"测试开发功能","cwd":"'$(pwd)'"}' | node .zcode/hooks/skill-eval.cjs
# 期望：{"additionalContext":"..."}
# 退出码：0

# PreToolUse 类 hook（安全命令应空输出或 {decision:"allow"}）
echo '{"toolName":"Bash","toolInput":{"command":"ls -la"}}' | node .zcode/hooks/pre-tool.cjs
# 期望：空输出（通过）或 {}

# PreToolUse 类 hook（危险命令应 deny）
echo '{"toolName":"Bash","toolInput":{"command":"rm -rf /"}}' | node .zcode/hooks/pre-tool.cjs
# 期望：{"decision":"deny","reason":"..."}

# Stop 类 hook（副作用类，应空输出）
echo '{"cwd":"'$(pwd)'"}' | node .zcode/hooks/stop.cjs
# 期望：空输出 + exit 0
```

**JSON 有效性验证**（Python 一行）：

```bash
echo "$output" | python -c "import sys,json; json.loads(sys.stdin.read()); print('✓ 有效 JSON')" 2>/dev/null \
  || echo "✗ 无效 JSON"
```

### 查 ZCode 日志

ZCode 把 hook 执行记录写到 `~/.zcode/cli/log/zcode-YYYY-MM-DD.jsonl`。统计失败：

```bash
python -c "
import json, os, glob
from collections import Counter
path = sorted(glob.glob(os.path.expanduser('~/.zcode/cli/log/*.jsonl')))[-1]
c = Counter()
with open(path, encoding='utf-8') as f:
    for line in f:
        try:
            d = json.loads(line)
            if d.get('module') == 'core.hooks':
                c[d.get('event','?')] += 1
        except Exception:
            pass
print('今日 hook 事件统计:')
for k, v in c.most_common():
    print(f'  {v}x  {k}')
print('（hook.run.failed 应为 0 或仅来自修复前的历史会话）')
"
```

**查最新失败详情**：

```bash
python -c "
import json, os, glob
path = sorted(glob.glob(os.path.expanduser('~/.zcode/cli/log/*.jsonl')))[-1]
with open(path, encoding='utf-8') as f:
    for line in f:
        try:
            d = json.loads(line)
            if d.get('event') == 'hook.run.failed':
                ctx = d.get('context', {})
                print(d.get('timestamp',''), ctx.get('hookEventName',''), '#'+str(ctx.get('hookIndex',-1)), ctx.get('source',''))
        except Exception:
            pass
"
```

### 12 个常见陷阱（按优先级）

> 来自官方 `zcode-guide:diagnosing-hooks` + 实战经验总结。

#### 陷阱 1：未设 `hooks.enabled: true`（最高频）

**症状**：所有 hook 都不触发
**原因**：ZCode 默认禁用配置文件 hooks，必须显式启用
**修复**：在 `.zcode/config.json` 加 `"hooks": { "enabled": true, ... }`

#### 陷阱 2：stdout 非 JSON（最致命）

**症状**：hook 执行了但效果被丢弃，日志标记 `hook.run.failed`
**原因**：脚本用 `console.log(markdownText)` 输出纯文本，ZCode 按严格 JSON 校验直接判失败
**修复**：改为 `process.stdout.write(JSON.stringify({additionalContext: text}))`

#### 陷阱 3：JSON 含未知 key

**症状**：同陷阱 2
**原因**：输出 `{continue: true, systemMessage: '...'}` 等 Claude 专属字段，ZCode schema 不认
**修复**：只用 ZCode 认可的 key（见"规则 8"）

#### 陷阱 4：事件名拼错

**症状**：hook 永不触发
**原因**：用了 ZCode 不支持的事件名（如 `Notification`、`SubagentStop`、`PreCompact`）
**修复**：只使用 7 个合法事件之一

#### 陷阱 5：matcher 不匹配

**症状**：hook 注册了但对该工具永不触发
**原因**：matcher 是**大小写敏感正则**，`"bash"` 不匹配 `Bash`
**修复**：用正确大小写，或省略 matcher 匹配所有

#### 陷阱 6：模板变量未替换

**症状**：命令行里出现字面 `${...}` 或空路径
**原因**：用了 Claude 变量 `$CLAUDE_PROJECT_DIR`，ZCode 不识别
**修复**：改用 `${ZCODE_PROJECT_DIR}`

#### 陷阱 7：超时单位混淆

**症状**：hook 被杀，日志显示 timed-out
**原因**：`type:"command"` 的 `timeout` 是**秒**，`type:"process"` 的 `timeoutMs` 是**毫秒**，写错单位
**修复**：command 用秒、process 用毫秒

#### 陷阱 8：command/process 字段混用

**症状**：hook 被丢弃
**原因**：process 类型用了 `timeout`（应为 `timeoutMs`），或 command 类型用了 `args`
**修复**：核对字段——command 接受 `command`/`shell`/`timeout`/`timeoutMs`；process 接受 `command`/`args`/`timeoutMs`

#### 陷阱 9：脚本无执行权限（Linux/macOS）

**症状**：permission denied
**原因**：脚本没有可执行位
**修复**：`chmod +x script.cjs`，或通过 `node script.cjs` 调用（绕过执行位）

#### 陷阱 10：跨平台失败

**症状**：在 macOS 正常，Windows 失败
**原因**：command 类型走 shell，POSIX 语法在 Windows 失败
**修复**：优先用 `type:"process"`（参数数组，不走 shell），或写跨平台 wrapper

#### 陷阱 11：hook 误阻断会话

**症状**：工具被拒绝或会话卡住
**原因**：hook 返回了 `decision:"deny"` 或退出码 2
**修复**：检查退出码——0 通过、2 阻断、其他错误。只在确需拦截时返回 deny

#### 陷阱 12：配置改动后旧会话不生效

**症状**：改了 config.json 但 hook 还是老行为
**原因**：ZCode 进程在启动时缓存 config，旧会话不会重载
**修复**：**新开 ZCode 会话**才会用新配置。诊断时注意区分"修复前会话"和"修复后会话"

---

## 同步脚本模板

下面是一个通用版 `sync-from-claude.cjs`，复制到 `.zcode/scripts/` 即可使用。支持全量同步、单技能同步、一致性检查三种模式。

```javascript
#!/usr/bin/env node
/**
 * 通用 Claude → ZCode skills 同步脚本
 *
 * 用法：
 *   node sync-from-claude.cjs              # 同步全部 skills
 *   node sync-from-claude.cjs foo bar      # 只同步指定 skills
 *   node sync-from-claude.cjs --check      # 只检查一致性
 *   node sync-from-claude.cjs --help       # 帮助
 */

const fs = require('fs');
const path = require('path');

// 自动定位项目根：从脚本位置向上找 .claude/skills
const projectRoot = path.resolve(__dirname, '..', '..');
const sourceDir = path.join(projectRoot, '.claude', 'skills');
const targetDir = path.join(projectRoot, '.zcode', 'skills');

const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check');
const specificSkills = args.filter(a => !a.startsWith('--'));

// 读取 skills 列表（兼容软链：用 statSync 而非 isDirectory）
function readSkills(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => {
      if (!e.isDirectory() && !e.isSymbolicLink()) return false;
      try {
        return fs.statSync(path.join(dir, e.name)).isDirectory();
      } catch { return false; }
    })
    .map(e => e.name)
    .filter(n => fs.existsSync(path.join(dir, n, 'SKILL.md')));
}

function filesEqual(a, b) {
  try {
    const ba = fs.readFileSync(a), bb = fs.readFileSync(b);
    return ba.length === bb.length && ba.equals(bb);
  } catch { return false; }
}

function copySkill(name) {
  const src = path.join(sourceDir, name, 'SKILL.md');
  const tgtDir = path.join(targetDir, name);
  if (!fs.existsSync(tgtDir)) fs.mkdirSync(tgtDir, { recursive: true });
  fs.copyFileSync(src, path.join(tgtDir, 'SKILL.md'));
}

const sources = readSkills(sourceDir);
const targets = readSkills(targetDir);
const toProcess = specificSkills.length > 0 ? specificSkills : sources;

if (specificSkills.length > 0) {
  const missing = specificSkills.filter(s => !sources.includes(s));
  if (missing.length > 0) {
    console.error('✗ 在 .claude/skills 中找不到: ' + missing.join(', '));
    process.exit(2);
  }
}

console.log(`源: ${sources.length} 个，目标: ${targets.length} 个，本次处理: ${toProcess.length} 个\n`);

let synced = 0, inSync = 0, missing = 0;
for (const name of toProcess) {
  const tgt = path.join(targetDir, name, 'SKILL.md');
  if (!fs.existsSync(tgt)) {
    if (isCheckOnly) { console.log(`  ✗ ${name}: 缺失`); missing++; }
    else { copySkill(name); console.log(`  + ${name}: 新增`); synced++; }
  } else if (filesEqual(path.join(sourceDir, name, 'SKILL.md'), tgt)) {
    if (!isCheckOnly) console.log(`  ✓ ${name}: 一致`);
    inSync++;
  } else {
    if (isCheckOnly) { console.log(`  ✗ ${name}: 不一致`); missing++; }
    else { copySkill(name); console.log(`  → ${name}: 更新`); synced++; }
  }
}

console.log(`\n${isCheckOnly ? '检查' : '同步'}完成：${synced} 复制，${inSync} 一致，${missing} 待处理`);
process.exit(isCheckOnly && missing > 0 ? 1 : 0);
```

---

## 完整检查清单

迁移完成后逐项确认：

### 目录结构
- [ ] `.zcode/skills/`、`.zcode/commands/`、`.zcode/agents/`、`.zcode/templates/`、`.zcode/hooks/` 都存在
- [ ] `.zcode/scripts/` 存放同步脚本（可选）

### 配置文件
- [ ] `.zcode/config.json` 含 `"hooks": { "enabled": true, ... }`
- [ ] `.zcode/config.example.json` 作为模板进 git
- [ ] `.zcode/config.json` 被 `.gitignore` 忽略（含密钥）
- [ ] hooks.events 下的事件名都是 7 个合法名之一
- [ ] PreToolUse/PostToolUse 的 matcher 正确（大小写、覆盖工具名）

### 资源完整性
- [ ] skills 数量与 `.claude/skills` 一致（`node .zcode/scripts/sync-from-claude.cjs --check` 全部一致）
- [ ] 无软链残留（`find .zcode -type l` 为空）
- [ ] commands 是裸 md（无 frontmatter）
- [ ] agents 是 .md + frontmatter（不是 .toml）

### Hooks 协议
- [ ] 每个 hook 手测输出有效 JSON（`echo '...' | node xxx.cjs` 通过 `python -c "json.loads(...)"`）
- [ ] 无 `console.log(text)` 纯文本输出（全部改为 `JSON.stringify({additionalContext})`）
- [ ] 无 Claude 专属 key（`continue`、`systemMessage`、`decision:'block'`）
- [ ] stdin 解析兼容驼峰和下划线字段名
- [ ] 路径用 `${ZCODE_PROJECT_DIR}`

### 验证
- [ ] 新开 ZCode 会话后，查 `~/.zcode/cli/log/*.jsonl` 中 `hook.run.failed` = 0
- [ ] 至少一次真实触发验证（如 UserPromptSubmit hook 在提问后确实注入了上下文）

---

## 实战案例参考

本技能的规则来自一次真实迁移实战，关键数据：

- **5 种资源**全部迁移：skills（67 个）、commands（22 个）、agents（3 个）、templates（3 个）、hooks（7 个，含 6 个重写 + 1 个新增）
- **核心陷阱**：迁移后所有 hook 都失败（日志 7 次 `hook.run.failed`），根因是 Claude 的 `console.log(markdown)` 在 ZCode 直接判失败
- **修复后**：本会话期间零新增失败，hook 真实触发并注入上下文
- **配置文件**：补全 matcher（`Bash|Write|Edit|ApplyPatch`）、加 SessionStart 事件、用 `${ZCODE_PROJECT_DIR}`

通用规则如何应用于真实场景：

1. 静态资源（skills/commands/agents/templates）直接 `cp -r` 即可
2. hooks 必须逐个重写输出协议（参考"规则 1-8"）
3. config.json 要补 `hooks.enabled: true` 和嵌套结构
4. gitignore 要放行共享目录、忽略 config.json

---

## 与官方技能的协作

遇到具体问题时，配合官方技能使用：

| 场景 | 用本技能 | 配合官方技能 |
|------|---------|-------------|
| 不知道 ZCode 支持哪些配置 | 先看本技能"核心差异速查表" | 再查 `zcode-guide:zcode-configuration-guide`（配置地图） |
| Hook 失败需要深度诊断 | 看本技能"12 个陷阱" | 加载 `zcode-guide:diagnosing-hooks`（深度诊断流程） |
| 迁移后想新增 ZCode 专属技能 | — | 用 `skill-creator`（官方技能创作指南） |
| MCP 服务器连不上 | 本技能不覆盖 | 加载 `zcode-guide:diagnosing-mcp` |
| `/command` 不生效 | 看本技能"3.2 Commands" | 加载 `zcode-guide:diagnosing-commands` |

---

## 快速参考卡片

```
迁移难度：skills/commands/agents/templates = 🟢 直接复制
         hooks = 🔴 必须改协议
         config.json = 🟡 改结构（enabled:true + events 嵌套 + mcp.servers 嵌套）

Hook 协议转换口诀：
  console.log(text) → JSON.stringify({additionalContext:text})
  {systemMessage} → {additionalContext}
  {decision:'block'} → {decision:'deny',reason}
  {continue:true} → {}（空）
  $CLAUDE_PROJECT_DIR → ${ZCODE_PROJECT_DIR}

5 步迁移法：
  1. 扫描 .claude 资源
  2. 建 .zcode 骨架 + gitignore
  3. 复制静态资源
  4. 重写 hooks + 生成 config.json
  5. 手测 + 查日志验证
```
