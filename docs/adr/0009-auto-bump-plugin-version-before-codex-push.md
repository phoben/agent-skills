# Codex 推送前自动升级插件版本

日期：2026-10-29；2026-11-04扩展插件隔离，随后按用户要求将Issue Hub归入YG Toolkit。

## 背景

YG Toolkit 原来使用 `plugins/yg-toolkit/.codex-plugin/plugin.json` 的 `version` 作为插件版本号。Codex 0.163 的便携插件发现还需要根目录 `plugins/yg-toolkit/plugin.json`，两份清单须保持相同版本。发布相关变更推送时，容易漏掉版本更新，导致仓库内容已变化而插件版本未变。

## 决策

- 在项目级 `.codex/hooks.json` 注册 `PreToolUse` 钩子，只检查 Codex 发起的 Shell 工具中直接执行的 `git push`。
- 每次真实推送前，根据远端跟踪分支到当前提交的文件差异确定受影响插件，再比较该插件版本。当前提交未提高版本时，自动将补丁号加一，并创建独立的中文版本提交，然后继续原推送命令。无插件差异的推送不升版。
- 当前提交已有更高版本时保留该版本；`--dry-run` 不触发版本修改。
- 推送失败时自动版本提交留在本地，下次推送继续使用该版本，不重复增加版本号。
- 分支没有上游、插件版本格式无效、或两份清单版本不同步时阻止推送，并给出可操作原因。只有旧清单的仓库继续按原规则处理；远端还没有根清单时，使用其旧清单版本比较。
- 自动递增同时更新旧清单和已存在的根清单。仓库存在 `packages/token-usage/scripts/build.mjs` 时，使用本机 Node 重新构建用量服务与页面，使 MCP `serverInfo.version` 与插件版本一致；不联网或自动安装依赖。
- 使用明确插件注册表：生产安装项只保留YG Toolkit，归属 `plugins/yg-toolkit/`、`packages/token-usage/` 和 `packages/issue-hub/`。Issue组件修改现在升级同一个YG版本，不再维护独立Issue插件版本；共享marketplace仍按条目内容比较。
- 自动版本提交只包含YG双清单及六个明确产物：`token-usage.cjs`、`token-usage.html`、`THIRD-PARTY-LICENSES.txt`、`issue-hub.cjs`、`issue-hub.html`、`issue-hub-THIRD-PARTY-LICENSES.txt`，全部位于YG的dist。两个服务的许可各自保留，四份服务/页面版本头逐项校验；旧P0与旧独立插件产物不发布。
- 所有受影响插件先完成干净目标、符号链接和构建输入检查，再改任何文件。目标已有暂存、工作区、未跟踪或被忽略的改动时阻止自动升级；构建输入未提交时也阻止重建，避免把另一会话的代码打入版本产物。其他不被构建读取的文件保持原样。
- 既有Tokens构建入口串行构建两个模块；钩子显式把目标版本传给构建，外部`YG_TOKEN_BUILD_VERSION`不能改变实际升版目标。两个源码包依赖须预先准备，钩子不临时联网安装。任一模块构建、版本核验或提交失败，恢复全部八个版本目标及原索引，不留下只有Tokens升级的状态。
- upstream首次没有插件时保留已提交初始版本；校验双清单和已提交构建入口/六产物。Tokens与Issue的CJS/HTML首行版本标记都须与YG清单一致，缺失、旧版或未提交产物阻止推送。当前版本低于远端时拒绝自动补救。旧Issue插件的0.3.5不与新的YG0.3.0跨插件比较，业务schema和身份保持原规则。
- 其他文件的暂存和未暂存内容保持原样。构建或提交失败时，仅恢复本钩子预检干净的版本目标，并阻止原推送。不改 DataPull 的 NPM 包版本，也不提交未受影响插件的文件。

## 范围

Codex 项目钩子仅覆盖 Codex 通过受支持 Shell 工具发起的 Git 推送。Codex 首次运行前须在 `/hooks` 页面审阅并信任该项目钩子；被跳过或绕过的钩子不会执行。直接使用 Codex 之外的 Git 客户端不受项目级 Codex 生命周期钩子覆盖。

该钩子沿用用户明确发起推送时的自动版本提交授权；普通开发、构建和测试不会触发它，也不会自行推送。验证命令为 `python -m unittest discover -s .codex/hooks -p test_bump_plugin_version.py`，测试只在临时仓库与本地 bare 远端运行。
