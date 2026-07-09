# 源目录到 Trae 的映射矩阵

本文档用于配合 `claude-to-trae` 主技能，把常见源工程化资源映射到 Trae 标准结构。

## 目标落点

```text
.trae/skills/<name>/SKILL.md
.trae/rules/**/*.md
.trae/commands/**/*.md
.trae/hooks.json
.trae/mcp.json
.agents/skills/<name>/SKILL.md
```

## 动作标记

- `直接复制`：文件格式和语义都可保留
- `结构转换`：目标格式接近，但目录或配置层级不同
- `语义重写`：不能直接复制，需按 Trae 语义重组
- `不建议自动迁移`：需要人工判断或用户确认

## `.claude` -> Trae

| 源路径 | 目标路径 | 动作 | 说明 |
|---|---|---|---|
| `.claude/skills/<name>/SKILL.md` | `.trae/skills/<name>/SKILL.md` | 结构转换 | 通常保留内容，改到 Trae 项目技能目录。 |
| `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` | 结构转换 | 当用户希望跨工具共享时使用。 |
| `.claude/commands/**/*.md` | `.trae/commands/**/*.md` | 结构转换 | 迁移为 Trae 项目命令，保留层级但不超过 3 层。 |
| `.claude/hooks/*.js|*.cjs|*.mjs` | 项目脚本目录 + `.trae/hooks.json` | 语义重写 | 脚本与配置要一起迁移，不能只复制脚本。 |
| `.claude/settings.json` 的 `hooks` | `.trae/hooks.json` | 语义重写 | 需拆分为 Trae 的 hook 配置结构。 |
| `.claude/settings.json` 的 `mcpServers` | `.trae/mcp.json` | 结构转换 | 保留 server 定义，敏感字段改占位值。 |
| `.claude/agents/*.md` | `.trae/skills/<name>/SKILL.md` | 不建议自动迁移 | 适用于任务型、触发型、能力型 agent。 |
| `.claude/agents/*.md` | `.agents/skills/<name>/SKILL.md` | 不建议自动迁移 | 适用于跨工具共享型 agent。 |
| `AGENTS.md` | `.trae/rules/*.md` | 语义重写 | 抽取长期稳定规则，不直接原样复制。 |

## `.codex` -> Trae

| 源路径 | 目标路径 | 动作 | 说明 |
|---|---|---|---|
| `.codex/skills/<name>/SKILL.md` | `.trae/skills/<name>/SKILL.md` | 结构转换 | 先判断它是通用技能还是命令包装。 |
| `.codex/skills/<name>/SKILL.md` | `.trae/commands/<name>.md` | 不建议自动迁移 | 如果内容本质是一次性命令模板，应改为 command。 |
| `.codex/hooks.json` | `.trae/hooks.json` | 语义重写 | 配置协议不同，需要重组。 |
| `.codex/hooks/*` | 项目脚本目录 + `.trae/hooks.json` | 语义重写 | 检查命令、stdin、stdout 与平台兼容性。 |
| `.codex/agents/*` | `.trae/skills/` 或 `.agents/skills/` | 不建议自动迁移 | 先看格式，再判断双轨落点。 |

## `.zcode` -> Trae

| 源路径 | 目标路径 | 动作 | 说明 |
|---|---|---|---|
| `.zcode/skills/<name>/SKILL.md` | `.trae/skills/<name>/SKILL.md` | 结构转换 | 内容可复用，目录需改。 |
| `.zcode/commands/**/*.md` | `.trae/commands/**/*.md` | 结构转换 | 保留命令语义，按 Trae 目录落位。 |
| `.zcode/agents/*.md` | `.trae/skills/` 或 `.agents/skills/` | 不建议自动迁移 | 需要双轨判断。 |
| `.zcode/hooks/*` | 项目脚本目录 + `.trae/hooks.json` | 语义重写 | ZCode hook 不等于 Trae hook，不能直接套用。 |
| `.zcode/config.json` 的 `hooks` | `.trae/hooks.json` | 语义重写 | 需要按 Trae 的 hook 事件与输出规则拆解。 |
| `.zcode/config.json` 的 `mcp` | `.trae/mcp.json` | 结构转换 | 保留 server 定义，清理敏感值。 |

## `.agents/skills` -> Trae

| 源路径 | 目标路径 | 动作 | 说明 |
|---|---|---|---|
| `.agents/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` | 直接复制 | 保持跨工具共享层不动。 |
| `.agents/skills/<name>/SKILL.md` | `.trae/skills/<name>/SKILL.md` | 结构转换 | 当项目需要 Trae 专用覆盖版时使用。 |

## `agents` 双轨判定规则

### 判到 `.trae/skills/` 的情况

满足以下信号越多，越应转为 `.trae/skills/`：

- 文档主体是“在什么情况下触发”
- 主要目标是指导 Trae 智能体执行任务
- 强依赖项目上下文
- 需要与项目规则、项目命令、项目 hooks 联动

### 判到 `.agents/skills/` 的情况

满足以下信号越多，越应转为 `.agents/skills/`：

- 内容明显设计为跨工具共享
- 不依赖 Trae 特有目录或协议
- 本质是通用能力说明书，而不是项目本地策略
- 用户明确希望 Claude、Trae、其他工具共用同一套定义

### 必须请求用户确认的情况

- 同一 agent 同时具备共享性和项目定制性
- 源文件不止一个版本
- 文件没有明确触发条件，但带有明显执行指令
- 自动转换后会改变能力边界

## `AGENTS.md` / 说明文档的处理建议

| 源内容特征 | 目标建议 |
|---|---|
| 长期稳定的项目约束 | `.trae/rules/*.md` |
| 可复用的专业能力流程 | `.trae/skills/<name>/SKILL.md` |
| 明确命令式输出模板 | `.trae/commands/*.md` |
| 初始化或守卫逻辑 | `.trae/hooks.json` + 配套脚本 |

## 不建议自动迁移的内容

- 含敏感凭据的真实配置
- 只适用于单次任务的临时 prompt
- 与业务代码强耦合的路径硬编码
- 无法判断落点的 agent 复合定义
- 明显依赖 POSIX shell、但目标环境是 Windows PowerShell 的 hook 命令

## 最终报告建议结构

迁移完成后，报告建议分为五段：

1. `扫描结果`
2. `映射决策`
3. `已完成迁移`
4. `待确认项`
5. `校验结果`
