# `claude-to-zcode` 技能升级计划

## Summary

目标是在现有 `e:\Develop\Develop\agent-skills\skills\claude-to-zcode\SKILL.md` 基础上，升级为一套同时覆盖“工作区 `.zcode/*` 迁移”和“插件包 `.zcode-plugin/plugin.json` 迁移”的完整技能包。升级后的技能需要能自动指导智能体完成三件事：

1. 扫描并识别项目中的 `.claude`、`.zcode`、`.claude-plugin`、`.codex-plugin`、`.zcode-plugin` 等工程化配置来源。
2. 对比现有 `.zcode` 与源配置差异，输出“可直接迁移 / 需要转换 / 存在冲突 / 不建议自动迁移”的结论。
3. 按 ZCode 规范完成插件迁移，明确 `skills`、`commands`、`hooks`、`mcpServers`、`agents`、`scripts`、`templates` 等资源各自该落到哪里、哪些能被 plugin manifest 真正执行、哪些只能作为辅助资产或工作区资源。

交付形态采用“主文档 + 参考文档 + 模板 + 脚本”的结构，而不是继续把所有内容堆在单个 `SKILL.md` 中。

## Current State Analysis

* 当前目标技能目录 `e:\Develop\Develop\agent-skills\skills\claude-to-zcode\` 只有一个文件：`SKILL.md`。

* 现有 `SKILL.md` 已具备较完整的 Claude Code → ZCode 工作区迁移说明，重点覆盖：

  * `.claude/*` → `.zcode/*`
  * hooks JSON 协议转换
  * `.claude/settings.json` → `.zcode/config.json`
  * 5 步迁移法、验证方式、常见陷阱

* 现有版本的明显缺口：

  * 基本只讨论 `.claude` 作为单一来源，未形成“多来源自动检测”工作流。
  * 仅把 `.zcode` 当目标目录处理，没有把“已有 `.zcode` 要先比对差异、避免重复覆盖”作为一等能力。
  * 没有系统覆盖 `.claude-plugin` / `.codex-plugin` / `.zcode-plugin` 的 plugin manifest 迁移。
  * 文中大量示例命令是 POSIX 风格（`cp`、`mkdir -p`、`find`），与当前用户环境 `Windows 11 + PowerShell` 不一致。
  * 目录级辅助资源缺失，导致“扫描、差异分析、模板生成、插件清单参考”都只能塞在正文里，复用性差。

* 仓库内已有可借鉴的组织方式：

  * `README.md` 已采用“技能入口 + 简述”的清晰索引结构。
  * `.trae/documents/claude-to-trae-skill-plan.md` 展示了“主文档 + references/templates/scripts”这种更适合复杂迁移技能的拆分方式。

* 来自已读取 ZCode 诊断技能的关键约束，必须反映到升级方案中：

  * `diagnosing-skills`：`SKILL.md` frontmatter 的 `description` 过长会导致技能被丢弃；描述前 250 字左右是主要触发窗口。
  * `zcode-configuration-guide`：工作区资源发现顺序、`.zcode` 与 `.agents` 的优先级、`AGENTS.md` 的注入顺序都需要准确说明。
  * `diagnosing-hooks`：工作区 hooks 必须 `hooks.enabled: true`；stdout 必须符合严格 JSON schema；事件名只有 7 个。
  * `diagnosing-commands`：命令发现与重名覆盖遵循“first match wins”；嵌套目录映射为 `:`
  * `diagnosing-mcp`：`mcp.servers` 配置 schema 严格，配置文件内不展开 `${...}` 模板变量。
  * `diagnosing-plugins`：plugin manifest 首选 `.zcode-plugin/plugin.json`；真正执行的组件是 `commands` / `skills` / `hooks` / `mcpServers`；`agents` 只是“recorded but not executed”，不能把它们当作 plugin manifest 中可直接运行的能力。

* 用户已明确的高影响决策：

  * 目标形态：同时支持工作区 `.zcode` 迁移与插件包迁移。
  * 交付结构：主文档 + 参考资源。
  * 自动检测范围：工作区目录与插件目录都纳入检测。

## Proposed Changes

### 1. 重写主技能文档

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\SKILL.md`

变更内容：

* 重写 frontmatter `description`，把触发语义前置，确保在较短描述里就明确说明以下场景：

  * 扫描 `.claude` / `.zcode` / `.claude-plugin` / `.codex-plugin` / `.zcode-plugin`
  * 对比现有 `.zcode` 差异
  * 迁移工作区资源与插件资源
  * 诊断 ZCode plugin / hooks / commands / mcp 配置问题

* 重组正文结构，至少包含以下章节：

  * 概述与边界
  * 源配置自动检测规则
  * “工作区迁移”与“插件迁移”的分流决策树
  * 现有 `.zcode` 差异分析流程
  * 资源映射总览
  * 工作区迁移规则
  * 插件迁移规则
  * 兼容性限制与人工确认点
  * 验证清单
  * 与 `diagnosing-*` 技能的协作路由

实现重点：

* 不再把任务简化成“`.claude` 复制到 `.zcode`”，而是先盘点来源、再比较现状、最后决定迁移目标。
* 将“已有 `.zcode` 不可盲目覆盖”写成显式原则。
* 明确区分两类输出：

  * 工作区输出：`.zcode/skills`、`.zcode/commands`、`.zcode/agents`、`.zcode/templates`、`.zcode/hooks`、`.zcode/config.json`
  * 插件输出：`.zcode-plugin/plugin.json` + plugin 内部组件目录

* 将示例命令优先改为 PowerShell，必要时同时给跨平台 Node.js 方式。

### 2. 新增“源检测与差异分析”参考文档

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\references\source-discovery-and-diff.md`

变更内容：

* 单独定义自动检测的扫描顺序、判定逻辑和差异分类标准。

* 明确扫描对象至少包括：

  * `.claude/`
  * `.zcode/`
  * `.claude-plugin/`
  * `.codex-plugin/`
  * `.zcode-plugin/`
  * `.agents/skills/`（若与源 skill 或目标 skill 发生共享/覆盖关系）

* 规定差异输出分级：

  * 可直接迁移
  * 需要协议转换
  * 已存在同名目标，需三方比对
  * 仅可保留为辅助资产
  * 不建议自动迁移

实现重点：

* 该文档要把“先扫描、后迁移”的流程固定下来，供主技能引用，避免智能体直接跳过比对阶段。
* 必须写清“同名目标已存在时的处理规则”，包括：

  * 与现有 `.zcode` 完全一致：可跳过
  * 仅源端更新：可迁移
  * 两端都改过：必须输出冲突说明并请求确认

### 3. 新增“工作区与插件双轨映射矩阵”

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\references\workspace-and-plugin-mapping.md`

变更内容：

* 以矩阵形式说明每类源资源迁移到 ZCode 时的目标位置、迁移方式和限制。

* 至少覆盖以下资源类型：

  * `skills`
  * `commands`
  * `hooks`
  * `mcp`
  * `agents`
  * `templates`
  * `scripts`

* 每类资源需要同时说明：

  * 目标是工作区 `.zcode/*`
  * 目标是插件包 `.zcode-plugin/plugin.json` + plugin 组件目录
  * 是否支持直接复制
  * 是否需要结构/协议转换
  * 是否只能作为辅助资产保留

实现重点：

* 必须明确下面这几个关键兼容规则：

  * `skills` / `commands` / `hooks` / `mcpServers` 可作为 plugin 组件进入 `plugin.json`
  * `agents` 在 plugin manifest 中目前只是记录字段，不作为可执行组件；迁移时应优先落到工作区 `.zcode/agents/`，或在文档中标注为“仅文档化资产”
  * `templates` 与 `scripts` 不是 plugin manifest 的顶级可执行组件，迁移时应作为 plugin 根目录下的辅助文件，由 commands/hooks/skills 通过相对路径引用

### 4. 新增“ZCode 插件规范与限制”参考文档

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\references\zcode-plugin-spec.md`

变更内容：

* 汇总与插件迁移直接相关的 ZCode 规范，作为技能内部规范底座。

* 至少覆盖：

  * `.zcode-plugin/plugin.json` 的位置和优先级
  * `name` 命名规则
  * 支持的组件字段
  * 路径必须位于 plugin root 内部
  * `userConfig` 字段能力与限制
  * marketplace / 启用状态 / 依赖的诊断入口

实现重点：

* 把 `diagnosing-plugins` 中“recorded but not executed”的限制写成显式迁移约束，避免执行阶段误把 `agents` 当成已成功插件化。
* 对 `mcpServers`、`hooks`、`commands`、`skills` 的 manifest 写法给出最小正确示例。

### 5. 新增工作区配置模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\templates\zcode-config.example.json`

变更内容：

* 提供一个可作为 `.zcode/config.json` 迁移模板的最小示例。

* 模板中至少体现：

  * `hooks.enabled: true`
  * `hooks.events.*` 的嵌套结构
  * `mcp.servers` 的 canonical 字段
  * `${ZCODE_PROJECT_DIR}` 的正确使用边界

实现重点：

* 模板必须遵守 `diagnosing-hooks` 与 `diagnosing-mcp` 中的字段约束，避免继续传播旧文档中的模糊写法。
* 不写真实敏感信息，仅保留占位值。

### 6. 新增插件 manifest 模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\templates\zcode-plugin.plugin.json`

变更内容：

* 提供 `.zcode-plugin/plugin.json` 的最小正确模板。

* 模板要展示：

  * `name`
  * `description`
  * `version`
  * `skills`
  * `commands`
  * `hooks`
  * `mcpServers`
  * `userConfig` 示例

实现重点：

* 不把 `agents` 当作默认推荐的可执行组件字段示例；如保留说明，必须明确标注“记录但不执行”。
* 路径全部写成 plugin root 内相对路径，示例不允许越界路径。

### 7. 新增源配置盘点脚本模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\scripts\inventory-zcode-sources.js`

变更内容：

* 提供 Node.js 参考脚本，用于自动盘点待迁移项目中的来源配置。

* 默认扫描：

  * `.claude`
  * `.zcode`
  * `.claude-plugin`
  * `.codex-plugin`
  * `.zcode-plugin`

* 输出至少包含：

  * 发现的目录
  * 每类资源数量
  * 工作区资源清单
  * 插件资源清单
  * 后续建议动作

实现重点：

* 注释、日志和帮助文本全部使用中文。
* 作为“辅助自动化模板”，不是仓库 CLI 产品；主技能需要说明如果不能运行脚本，也必须按相同逻辑手工盘点。

### 8. 新增差异分析脚本模板

文件：`e:\Develop\Develop\agent-skills\skills\claude-to-zcode\scripts\analyze-zcode-diff.js`

变更内容：

* 提供对比脚本，用于比较：

  * `.claude/*` 与 `.zcode/*`
  * `.claude-plugin` / `.codex-plugin` 与 `.zcode-plugin`
  * 同名资源在源端和目标端的状态

* 输出分组至少包含：

  * 可新增
  * 目标缺失
  * 内容一致
  * 内容冲突
  * 需协议转换
  * 需人工确认

实现重点：

* 先做结构与文本层比对，不试图自动理解业务语义。
* 需要把 `hooks` / `mcp` / `plugin.json` 这类“结构变换型资源”单独标为“需协议转换”，而不是简单显示文本不同。

### 9. 视情况同步更新仓库 README

文件：`e:\Develop\Develop\agent-skills\README.md`

变更内容：

* 若执行阶段新增了 `references/`、`templates/`、`scripts/`，同步更新 `claude-to-zcode` 的简介，使其体现：

  * 多来源自动检测
  * `.zcode` 差异分析
  * plugin 迁移支持
  * 工作区与插件双轨输出

实现重点：

* 只更新 `claude-to-zcode` 条目，不扩大到其他技能说明。

## Assumptions & Decisions

* 决策：保留现有技能名与目录 `skills/claude-to-zcode/`，不新建平行技能，避免分裂入口。

* 决策：升级目标同时覆盖两条路径：

  * 工作区迁移：`.claude/*` / 现有 `.zcode/*` 的检测、比对、迁移、验证
  * 插件迁移：`.claude-plugin` / `.codex-plugin` / `.zcode-plugin` 的检测、映射与规范化

* 决策：主文档负责流程与决策，细节规范下沉到 `references/`，模板与脚本下沉到 `templates/` 和 `scripts/`。

* 决策：考虑当前用户环境，文档命令示例优先写 PowerShell；辅助脚本使用 Node.js 以便跨平台复用。

* 决策：插件迁移不承诺把所有资源都“插件化可执行”。其中：

  * `skills` / `commands` / `hooks` / `mcpServers` 走 plugin manifest 正常路径
  * `agents` 明确按“工作区资源优先，plugin 仅记录不执行”处理
  * `templates` / `scripts` 作为插件辅助资产保留，由其他组件引用

* 决策：已有 `.zcode` 或 `.zcode-plugin` 存在时，默认先做差异分析，不在技能说明中鼓励覆盖式迁移。

* 假设：本次升级只修改 `claude-to-zcode` 技能自身及必要的 README 索引，不改动 `.trae/skills` 下的诊断技能。

* 假设：首版重点是“让智能体更会迁移”，不是在仓库里交付一个独立 CLI 工具，因此脚本以模板/参考实现为准。

## Verification Steps

实施后按以下顺序验证：

1. 结构验证

* `skills/claude-to-zcode/` 下存在：

  * `SKILL.md`
  * `references/`
  * `templates/`
  * `scripts/`

* 新增文件的命名与 `SKILL.md` 中的引用一致。

2. 技能触发与格式验证

* `SKILL.md` frontmatter 至少包含 `name` 与 `description`。
* `description` 长度控制在 ZCode 技能加载限制内，不写成长篇正文。
* `description` 前段即可覆盖“检测 `.claude/.zcode`、比较差异、迁移插件”这几个关键意图。

3. 内容覆盖验证

* 主文档明确包含：

  * 自动检测 `.claude`、`.zcode`、`.claude-plugin`、`.codex-plugin`、`.zcode-plugin`
  * 现有 `.zcode` 差异分析流程
  * 工作区迁移与插件迁移双轨决策
  * 对 `agents` / `templates` / `scripts` 的插件迁移限制说明

* 参考文档与模板中的规则不与已读取的 `diagnosing-*` / `zcode-configuration-guide` 相冲突。

4. 模板与脚本验证

* JSON 模板能被标准 JSON 解析器读取。
* Node.js 脚本能通过基本语法检查。
* 脚本输出字段与主文档中的“盘点 / 差异分析”章节保持一致。

5. 一致性验证

* `SKILL.md`、参考文档、模板、脚本对同一资源的命名和落点保持一致。
* 若 README 被更新，其简介与 `SKILL.md` 能力边界一致，不夸大 plugin `agents` 可执行性。
