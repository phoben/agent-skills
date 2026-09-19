# Vercel `skills` 的 Agent 平台选择与交互设计调研

**调研日期：**2026-09-19

**上游快照：**[`vercel-labs/skills` `7407f3893ad4dceab546ac002c3ef806e4000c73`（v1.7.0）](https://github.com/vercel-labs/skills/tree/7407f3893ad4dceab546ac002c3ef806e4000c73)

**调研范围：**只查阅上游官方 GitHub 仓库的源码、测试和 README；本文不代表各 Agent 厂商的官方兼容承诺。
**调研开始前的项目对照：**DataPull 当时只注册 `codex`、`claude`、`cursor`、`trae` 四个目标，且向导默认 Codex、始终要求单选一个目标、明确不探测本机安装情况。[注册表实现](../../cli/datapull/src/skills/agents.ts)；[向导实现](../../cli/datapull/src/interactive/wizard.ts)

**本次实施口径：**完整登记上游快照的平台 ID 与路径契约，便于显式选择和后续增量验证；项目共享组、旧 ID 别名、检测和 UI 已落地。发布兼容矩阵仍只代表已有真实回验组合，不把“已登记”扩大表述为“已完成运行时验收”。

## 结论

可借鉴的不是把上游约 80 个名称原样复制进 DataPull，而是其三层模型：**平台注册表 → 共享目录分组 → 面向人的选择界面**。其中，项目级 `.agents/skills` 兼容组可让一次写入同时被多个 Agent 读取；专属目录平台仍按平台写入。安装检测只用于减少人类选择成本，不能成为正确写入路径、CLI 自动化或安全验收的前提。

DataPull 首版建议支持一个经过验证的“常用平台集合”，并将上游剩余平台作为可增量验证的注册项。不要把“上游写了路径”直接承诺为 DataPull 的兼容性；DataPull 的发布契约要求安装元数据与实际落盘回验、且其兼容矩阵必须有真实通过记录，[维护者指南](../../cli/datapull/docs/maintenance.md)也规定新增目标要同步更新向导、测试、CI 和兼容矩阵。

## 上游的平台注册与分类

### 注册表是唯一事实源

上游将 `AgentType`（包含 79 个具名平台加 `universal`）和每个平台的 `AgentConfig` 分开：每项都有内部名、展示名、项目级目录、可选用户级目录、异步安装检测函数，以及两个影响通用组展示的开关。[类型枚举](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/types.ts#L1-L80)；[配置契约](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/types.ts#L93-L106)。

注册项不是只有静态路径：Codex 允许 `CODEX_HOME` 覆盖默认用户目录；Claude、Vibe、Grok 等也支持各自环境变量；OpenCode/Amp/Goose 使用 XDG 配置目录。[路径根的计算](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L1-L31)。因此，DataPull 的注册表也应支持“平台/范围/当前操作系统/环境变量”共同决定路径，而不是把目录常量散落在分支中。

上游把平台按**项目级 skill 目录是否等于 `.agents/skills`**划分：`getUniversalAgents()` 返回共享项目目录的平台，`getNonUniversalAgents()` 返回专属目录的平台；`showInUniversalList` 可将内部 `universal` 占位符排除，`showInUniversalPrompt` 只缩短交互界面，并不会改变实际安装集合。[分类函数](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L869-L912)。

在该快照中，公开显示的共享项目目录平台有 20 个：`amp`、`antigravity`、`antigravity-cli`、`cline`、`codex`、`cursor`、`deepagents`、`dexto`、`droid`、`firebender`、`gemini-cli`、`github-copilot`、`kilo`、`kimi-code-cli`、`loaf`、`opencode`、`sarvam-code`、`warp`、`zed`、`promptscript`。它们的共同点仅是**项目级**写入 `.agents/skills`，不意味着用户级目录也相同：例如 Codex 是 `~/.codex/skills`、Cursor 是 `~/.cursor/skills`、OpenCode 是 XDG 的 `opencode/skills`。[Codex 注册项](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L224-L232)；[Cursor 注册项](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L269-L277)；[OpenCode 注册项](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L552-L560)。

专属目录平台包括 Claude Code（`.claude/skills`）、Trae（`.trae/skills`）、Trae CN（项目仍是 `.trae/skills`，用户级为 `~/.trae-cn/skills`）以及大量其他平台。Trae 与 Trae CN 被明确拆成两个 ID，说明“项目目录相同”也不等于“用户级目录和产品分发相同”。[Trae/Trae CN 注册项](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L698-L715)。

### 检测与默认选择逻辑

每个注册项自行以配置目录、项目标志、应用目录或 `package.json` 依赖等信号实现 `detectInstalled()`；`detectInstalledAgents()` 并行执行全部检测并返回命中的 ID。[并行检测](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/agents.ts#L825-L833)。这是一种 UX 优化，不是该工具唯一的执行入口：显式 `--agent` 会先做白名单校验后直接使用，不依赖检测。[显式目标与检测分支](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L755-L806)。

默认分支如下：

| 观察到的状态 | 上游行为 | 对 DataPull 的可移植含义 |
| --- | --- | --- |
| 用户传入 `--agent` | 只选择这些有效 ID；`*` 选择全部。 | 保留显式命令的确定性，不能因检测结果覆盖用户选择。 |
| 未检测到平台、普通交互 | 显示可搜索的完整选择器；另一个通用 prompt 函数会优先恢复上次选择，否则预选 Claude Code、OpenCode、Codex。 | 第一次使用可引导选择；不要把 Codex 硬编码为唯一默认。 |
| 检测到一个平台 | 自动选择该平台，并补入共享目录平台。 | 仅在“安装到共享项目目录”时补入兼容组；用户级不能机械照搬。 |
| 检测到多个平台、普通交互 | 显示“共享目录（固定包含）+ 其他平台（可选）”的多选器。 | 避免让用户为同一项目路径逐个勾选兼容平台。 |
| `--yes` 且未显式目标 | 上游选择所有平台；这是上游的语义。 | DataPull 不建议沿用：会造成大量目标写入，宜要求显式 `--target` 或仅选安全的项目共享组。 |

上述“补入共享目录平台”的实际实现是把所有 `getUniversalAgents()` 加进目标数组；选择器把共享组锁定、其他平台可选。[补全逻辑](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L353-L368)；[交互选择组装](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L494-L557)。

上游还区分“CLI 运行在 Agent 内”和普通终端：使用 `@vercel/detect-agent`，同时对 Cursor 的宽泛环境变量加了更强信号校验，以免把普通 Cursor 集成终端误判为 Agent。[运行环境检测与 Cursor 修正](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/detect-agent.ts#L1-L92)；[入口读取检测结果](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/cli.ts#L303-L309)。DataPull 可以在第二阶段评估这种“自动减少交互”的能力，但数据库访问/工具安装的显式确认规则不应由此放宽。

## 上游安装策略与 UI 信息架构

### 安装去重

上游对项目安装采用 canonical `.agents/skills`：共享项目目录平台直接使用该路径，专属目录平台在 symlink 模式下连接至 canonical 副本，链接失败时可退化为 copy；其注释明确目标是避免重复链接和重复列举。[canonical 路径及解析](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/installer.ts#L128-L165)；[全局共享目录跳过重复链接](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/installer.ts#L392-L404)。结果摘要按 `universal`、`symlinked`、`copied`、`skipped` 分组，让使用者能区分“一次实体写入”与“可见性链接”。[结果摘要](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L371-L417)。

DataPull 当前的安全模型是**每个目标写入自己的内容、拒绝经符号链接写入**；这与上游的“创建符号链接减少副本”不是同一授权模型。将来若采纳 canonical+symlink，必须单独设计链接创建、所有权、路径穿越、防覆盖和卸载/升级的安全契约，不能直接改掉现有防链接写入保护。[DataPull 现有安装器测试](../../cli/datapull/tests/skill-installer.test.ts)。

### 终端 UI

上游 UI 的有效信息结构是：

1. 先用 spinner 告知“正在加载 Agent”，再根据检测结果自动进入或解释选择动作。[检测阶段呈现](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L773-L809)。
2. 多选器顶部显示固定包含的 `Universal (.agents/skills)`，只显示可读的子集和“另有 N 个”；随后是 `Additional agents`，避免长列表掩盖兼容组的业务含义。[锁定分区渲染](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/prompts/search-multiselect.ts#L346-L373)。
3. 其他平台每项显示安装目录提示；搜索可按显示名或 ID 过滤；底部汇总已选内容。选择器还具备分组、全选和固定高度详情面板等通用能力。[组件输入模型](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/prompts/search-multiselect.ts#L13-L50)；[搜索、选择摘要与详情](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/prompts/search-multiselect.ts#L317-L435)；[键盘操作](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/prompts/search-multiselect.ts#L608-L687)。
4. 非 TTY 取消不报告成功，而是提示显式参数并以非零退出，防止 CI/脚本误把“未安装”认定为完成。[非 TTY 保护](https://github.com/vercel-labs/skills/blob/7407f3893ad4dceab546ac002c3ef806e4000c73/src/add.ts#L420-L438)。

对 DataPull，建议借鉴其“为什么会写入这些位置”的可见性，但继续使用中文、保留 DataPull 的最终二次确认、保持 `--json` 无 ANSI 且稳定。推荐向导文案为“兼容共享目录（一次安装，以下工具可读取）”和“单独目录（按需安装）”，每项附用户级/项目级实际路径；确认页必须明确“将创建/更新的目录数、是否已存在、覆盖策略”。

## 建议的 DataPull 落地范围

### 第一阶段：先重构为可验证注册表

1. 以 `AgentTargetDefinition` 取代 `AGENTS` 与 `parts` 的平行维护：字段至少包含稳定 ID、中文展示名、别名（兼容 `claude`）、项目/用户路径解析器、是否支持各范围、项目共享组 ID、可选检测器和状态说明。
2. 把项目级 `.agents/skills` 作为**一个写入目标组**而不是 20 个副本目标。用户在选择 Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode 等已验证兼容成员时，UI 应显示“共享目录”，最终只向 `.agents/skills/datapull` 写一次。
3. 保持 `claude`、`trae` 的已有 CLI 值可用，新增规范 ID `claude-code`、`trae`、`trae-cn` 应通过别名兼容层解析；命令输出可同时显示展示名与稳定 ID。
4. 用户级路径必须按每个平台独立解析：不可把项目 `.agents/skills` 推演为用户 `~/.agents/skills`。这点与当前 DataPull 的 Codex 用户路径实现不同，须先修正并添加回归用例。
5. 增加每一平台/范围的路径快照测试、别名测试、共享组去重测试和“显式目标优先于检测”测试；CI 与兼容矩阵只有在真实平台验证后才能把状态标为支持。

### 第二阶段：改善交互但不扩大风险

1. 在交互向导用带搜索的多选替代单选，默认先选检测到的平台；无检测时可预选“常用三项”或上次选择，但仍由用户确认。
2. 将共享组放在不可取消的已选区，专属平台放在可选区，显示每项实际路径和安装范围；确认页显示按“实体写入 / 可见平台 / 跳过原因”分组的收据。
3. 非交互模式只接受明确的 `--target`/`--agent` 组合，不因为 `--yes` 盲写全部平台注册项；在非 TTY 缺少目标时失败并给出可复制命令。
4. 检测器只检查低成本、无副作用的本地痕迹，结果标注为“检测到配置痕迹”；不将其描述为“已安装且可用”，也不读取凭证或调用 Agent。

### 首批候选与风险

| 候选 | 项目级落点 | 用户级落点/处理 | 建议状态 | 主要风险 |
| --- | --- | --- | --- | --- |
| Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode | `.agents/skills/datapull` | 各自独立；不能共享推导 | 优先验证 | 共享目录只说明项目级兼容；用户级规则不同。 |
| Claude Code | `.claude/skills/datapull` | `CLAUDE_CONFIG_DIR` 或 `~/.claude/skills` | 优先验证 | 需兼容现有 `claude` CLI 名称。 |
| Trae、Trae CN | `.trae/skills/datapull` | 分别 `~/.trae/skills`、`~/.trae-cn/skills` | 先拆分再验证 | 当前 DataPull 把两者合并为一个 `trae` 且用户级固定 `.trae-cn`，会误导国际版用户。 |
| Cline、Kilo、Kimi Code、Windsurf、Zed 等 | 部分可共用 `.agents/skills/datapull`，部分为专属 | 必须逐项验证 | 后续扩展 | 上游路径是其实现事实，不是 DataPull 的跨版本验收证据。 |

## 不应直接移植的行为

- 不应照搬“`--yes` 且无检测即安装全部平台”。DataPull 写入用户目录/项目目录有明确文件系统影响，安全默认应是目标明确、范围明确。
- 不应在未完成 DataPull 真实验证前，把上游 79 个 ID 全部写进 README、CI 矩阵或发布声明。
- 不应在没有专门安全设计的情况下引入 symlink 作为默认安装方式；它与 DataPull 当前拒绝经链接写入的防护目标相冲突。
- 不应因为检测到某个编辑器目录就跳过 DataPull 的工具下载确认、数据库 TLS 风险提示或最终写入确认。

## 验收建议

完成实现后，至少应验证：

1. 旧命令 `datapull skill install --target claude:user`、`codex:user`、`cursor:project`、`trae:project` 的结果保持兼容或给出明确迁移提示。
2. 所有首批平台注册项在 Windows/macOS/Linux 的项目级、用户级路径解析可重复测试；环境变量覆盖仅影响对应平台。
3. 共享项目组多选后实体目录只安装一次，状态/哈希回验不重复计数；专属平台不被错误并入共享组。
4. TTY 和非 TTY 都有可观察、稳定的行为；无目标的非交互调用失败，`--json` 输出不夹杂进度 UI 或 ANSI。
5. 真实 Agent 侧的 skill 发现、启动以及 DataPull 操作仍应作为独立验收层；仅“路径存在”不能替代运行时验证。
