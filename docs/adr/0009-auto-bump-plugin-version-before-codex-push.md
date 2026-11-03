# Codex 推送前自动升级插件版本

日期：2026-10-29。

## 背景

YG Toolkit 原来使用 `plugins/yg-toolkit/.codex-plugin/plugin.json` 的 `version` 作为插件版本号。Codex 0.163 的便携插件发现还需要根目录 `plugins/yg-toolkit/plugin.json`，两份清单须保持相同版本。发布相关变更推送时，容易漏掉版本更新，导致仓库内容已变化而插件版本未变。

## 决策

- 在项目级 `.codex/hooks.json` 注册 `PreToolUse` 钩子，只检查 Codex 发起的 Shell 工具中直接执行的 `git push`。
- 每次真实推送前，比较当前提交中的插件版本与远端跟踪分支版本。当前提交未提高版本时，自动将补丁号加一，并创建独立的中文版本提交，然后继续原推送命令。
- 当前提交已有更高版本时保留该版本；`--dry-run` 不触发版本修改。
- 推送失败时自动版本提交留在本地，下次推送继续使用该版本，不重复增加版本号。
- 分支没有上游、插件版本格式无效、或两份清单版本不同步时阻止推送，并给出可操作原因。只有旧清单的仓库继续按原规则处理；远端还没有根清单时，使用其旧清单版本比较。
- 自动递增同时更新旧清单和已存在的根清单。仓库存在 `packages/token-usage/scripts/build.mjs` 时，使用本机 Node 重新构建用量服务与页面，使 MCP `serverInfo.version` 与插件版本一致；不联网或自动安装依赖。
- 自动版本提交只允许包含两份插件清单及三个明确的用量产物：`dist/token-usage.cjs`、`dist/token-usage.html`、`dist/THIRD-PARTY-LICENSES.txt`，产物均位于 `plugins/yg-toolkit/`。这些目标已有暂存、工作区或未跟踪改动时，先阻止自动升级，不覆盖现有内容。
- 其他文件的暂存和未暂存内容保持原样。构建或提交失败时，仅恢复本钩子预检干净的版本目标，并阻止原推送。不改 DataPull 的 NPM 包版本，也不提交其他插件文件。

## 范围

Codex 项目钩子仅覆盖 Codex 通过受支持 Shell 工具发起的 Git 推送。Codex 首次运行前须在 `/hooks` 页面审阅并信任该项目钩子；被跳过或绕过的钩子不会执行。直接使用 Codex 之外的 Git 客户端不受项目级 Codex 生命周期钩子覆盖。

该钩子沿用用户明确发起推送时的自动版本提交授权；普通开发、构建和测试不会触发它，也不会自行推送。验证命令为 `python -m unittest discover -s .codex/hooks -p test_bump_plugin_version.py`，测试只在临时仓库与本地 bare 远端运行。
