# Research: Issue Hub 迁入 YG Toolkit 的本机安装与数据兼容

- Query: 如何从干净整合工作区安装同一个 `yg-toolkit@yg`，保留旧 Issue Hub 数据、原插件源语义，并避免把另一任务的脏技能文件带入新包。
- Scope: internal；官方本机 CLI/API schema 与仅限自有 research profile 的实验证据。
- Date: 2026-11-04
- CLI: codex-cli 0.163.0；Windows，Node 24。

## Findings

### 1. 真实安装状态与源（只读采样）

研究开始时 `codex plugin list --marketplace yg --json` 显示：

| 安装项 | 版本 | enabled |
| --- | --- | --- |
| yg-toolkit@yg | 0.2.5 | true |
| issue-hub@yg | 0.3.5 | false |

所以会话中的 Issue Hub 工具 namespace 消失对应独立插件已停用，不能据此称已卸载。真实配置只核对了这两个 `plugins` 表的 enabled 字段，未改写配置、读取聊天正文或输出认证文件。

`codex plugin marketplace list --json` 中 `yg.root` 为原仓库 `E:/Develop/agent-skills`，是本地源。它没有自动指向干净 worktree 或 GitHub main。源根目录里存在另一任务尚未提交的 EdgeOne 修改，因此直接从原根目录整体打包/更新 YG 会有混入风险。

安装缓存中 YG 0.2.5 的 EdgeOne `SKILL.md` 哈希等于干净 worktree 的提交副本，不等于原仓库 dirty 副本。干净新包沿用提交中的技能，不会丢失当前已安装的 EdgeOne 更改；dirty 源文件仍须原样保留。

### 2. 官方安装 API 可以直接指定干净 marketplace 文件

本机运行以下只读生成命令，产物均在本任务 research 下：

```text
codex app-server generate-json-schema --experimental --out <research>/toolkit-protocol
```

`toolkit-protocol/v2/PluginInstallParams.json:17` 定义 `marketplacePath`，`:27` 定义 `pluginName`，`:37-39` 只有 pluginName 必填。实际可调用：

```json
{
  "method": "plugin/install",
  "params": {
    "marketplacePath": "<clean-worktree>/.agents/plugins/marketplace.json",
    "pluginName": "yg-toolkit"
  }
}
```

路径必须指向 marketplace JSON 文件。把目录作为 `marketplacePath` 传给 `plugin/read`，实际报读取 marketplace 文件拒绝访问；改成 JSON 文件后成功。安装无需临时改真实源指针，也不需要猜 `-c` 配置键。

CLI `codex plugin add` 没有路径参数，只接受 `PLUGIN@MARKETPLACE` 或 `PLUGIN --marketplace NAME`。`marketplace add` 的名字由源 JSON 决定，没有任意 `--name` 选项。

### 3. 已有 yg 源时，安装覆盖路径不会引发重启自动回退

实验全部使用自有 research 下新建的 CODEX_HOME 和两个同名 `yg` 极简源：first/0.2.5 与 second/0.3.0，真实用户配置未动。

已验证顺序：

1. CLI 注册 first 源，确认 yg.root 仍指 first。
2. 官方 API 从 second 的 marketplace JSON 安装 yg-toolkit。
3. CLI list 显示已安装 0.3.0 enabled=true，yg.root 仍指 first。
4. 关闭并重新启动独立 App Server，MCP 活体 serverInfo.version 是 0.3.0，无 toolsError；实际运行路径指新 cache/yg/yg-toolkit/0.3.0。
5. 再次 CLI list 仍是 0.3.0。

双服务夹具也通过：同一 `yg-toolkit@yg` 同时发现 `yg-token-usage` 与 `issue-hub` 两个 MCP，两个活体版本均为 0.3.0。见 `toolkit-install-fixture-probe-complete.json`、`toolkit-install-fixture-probe-legacy-add.json`。

这是安装和重启证据，不等于已验证真实 Tokens/Issue Hub 页面功能；最终真实包仍需主会话的资源、工具、数据及桌面观察。

### 4. 旧源不更新时，未来手动 CLI add 确会装回旧版

该风险已实际复现：覆盖安装 0.3.0 且新宿主双服务都正常后，再执行 `codex plugin add yg-toolkit@yg`。由于注册源仍是旧 first/0.2.5，CLI 安装项和再次启动的两个 MCP 全部变成 0.2.5。

因此“安装时 override 文件”能保持本次新 cache 和重启可用，却不能永久替代源更新。长期应让原注册源包含整合后的提交，或由用户明确选择持久干净 worktree/远端源；不能宣称更新 cache 后原源已经升级。

同名不同 source 的 `codex plugin marketplace add` 明确拒绝，提示应先 remove。不能把这条命令当作无损覆盖指针的操作。本研究没有移除或重加真实 yg 源。

原源含其他任务脏改，研究没有切换它的分支、覆盖其目录或执行 Git 更新。后续维护原源应继续遵循工作区保护，不以强制 reset/checkout 替代。

### 5. 无已注册源的首次安装

在零 yg marketplace 的新 CODEX_HOME 中，直接从 JSON API 安装也成功，重启 App Server 实际发现同一个 YG 插件下两 MCP，活体版本都是 0.3.0。

但 `codex plugin list --marketplace yg --json` 的 installed 是空数组：尚未注册源时，CLI 不枚举这项，不能拿它作为安装失败判据。后来 `marketplace add second` 可以正常注册 yg。

所以团队新机器建议先注册交接包/源码源，再常规安装，便于 CLI 管理与未来更新；已有同名 yg 源时直接使用官方 API 安装覆盖路径，并明确处理未来源版本。

证据：`toolkit-install-fixture-probe-unregistered.json`。

### 6. 官方停用路径不删除缓存

schema `toolkit-protocol/v2/ConfigValueWriteParams.json:19-37` 明确定义 filePath（可省略默认用户配置）、keyPath、mergeStrategy 与 value。

仅在 fresh profile 夹具测试了：

```json
{
  "method": "config/value/write",
  "params": {
    "keyPath": "plugins.\"yg-toolkit@yg\".enabled",
    "value": false,
    "mergeStrategy": "replace"
  }
}
```

实际配置写为 enabled=false，重启后加载服务数为 0，cache 文件仍存在。无源 profile 的 CLI 仍不枚举该项，因此报告同时给出 configDisabled=true 和 loadedServices=0，不将 cliListedAsDisabled=false 误读为停用失败。

旧独立 `issue-hub@yg` 在真实用户配置已经 false，无需重复写入。新 YG 两服务验证通过后可使用官方 `codex plugin remove issue-hub@yg` 退休旧安装；该命令 CLI 说明是删除插件安装与缓存，不是业务数据目录。若 Windows 占用导致 remove 失败，保留 disabled 并如实报告，不能强删或宣称卸载成功。本研究没有执行真实卸载。

### 7. 数据与会话身份无需换域

`packages/issue-hub/src/main.mjs:21` 的默认数据库仍是 `%LOCALAPPDATA%/IssueHub/data`，独立于插件名称和安装 cache 路径。`ISSUE_HUB_DATA_DIR` 显式覆盖时也须沿用原值，不自动搬到 YG cache。

`packages/issue-hub/src/host/bridge.mjs:21` 的 CODEX_HOME 默认仍是用户 Codex 目录；`:144-146` 的 v2 身份只由规范 home 和可信 accountId 派生，不含 pluginId、版本、token mtime 或包目录。

因此保留这些契约就能直接复用草稿、偏好、操作回执与已确认聊天；不应为了“纳入工具箱”新建 identity 域、复制 auth、清空数据或按名称猜认旧聊天。最终应以当前双身份的只读 latest/数据库摘要验证，不能打印正文或任意扫描其他 scope。

### 8. 建议执行顺序

1. 在 clean worktree 构建统一 YG 版本，保留两份清单及 mcp.json 的 schema 声明，排除 EdgeOne dirty 副本。
2. 在隔离 CODEX_HOME 用实际新包验证两个 MCP、资源、工具及版本，再决定真实安装。
3. 对真实用户数据只做当前 scope 的只读摘要，保持路径和身份不变；已有独立插件保持停用。
4. 官方 `plugin/install` 指向干净 marketplace 文件，安装同一 `yg-toolkit@yg` 新版本，不改真实 yg 源指针。
5. 重启独立 App Server，验证两个服务都属于 YG，且旧独立服务不加载；读取原草稿/关联的摘要，不创建或发送聊天。
6. 通过后官方退休旧插件，无法删缓存时保留停用状态，并明确未来手动 CLI add 的旧源回退风险。
7. 原源版本的长期更新必须作为单独明确的源维护动作处理，不把一次 override 安装等同源永久升级。

## Files Found

- `packages/issue-hub/src/main.mjs`：业务目录、doctor 与页面/资产读取；迁移后的文件名不应改变数据目录。
- `packages/issue-hub/src/host/bridge.mjs`：Codex 连接指纹和独立稳定身份。
- `plugins/yg-toolkit/mcp.json`：同一个插件的 MCP map，可承载 Tokens 与 Issue Hub。
- `toolkit-protocol/v2/PluginInstallParams.json`：本机官方安装参数 schema。
- `toolkit-protocol/v2/ConfigValueWriteParams.json`：本机官方配置写入参数 schema。
- `toolkit-install-fixture-probe.mjs`：只在 research 自有 profile 的安装/重启/手动回退/停用实验。
- `toolkit-install-fixture-probe-complete.json`：已注册旧源，API 新源安装及新宿主版本验证。
- `toolkit-install-fixture-probe-legacy-add.json`：双服务新版本与显式旧源 CLI add 回退的实际证据。
- `toolkit-install-fixture-probe-unregistered.json`：未注册源双服务安装和官方停用路径证据。

## External References

未进行互联网调研。事实来自本机 codex-cli 0.163.0 的 `--help`、官方生成 app-server schema 与隔离实测；不以其他版本文档推断当前 CLI 参数。

## Related Specs

- `.trellis/spec/backend/issue-hub.md`：数据/身份/工作区/nonce 边界。
- `.trellis/spec/backend/token-usage.md`：双清单与可分发内联产物。
- `.trellis/spec/guides/cross-layer-thinking-guide.md`：安装、服务发现与真实页面结果分开验收。

## Caveats / Not Found

- 两份 fixture 早期出现 CJS 换行生成错误和未实现 resources/templates/list；失败记录保留。修正后有明确 serverInfo 和 toolsError=null 才算活体通过。
- 缺少 schema 的极简 fixture 曾把 `${PLUGIN_ROOT}` 原样传出，同时加入 root plugin/mcp schema 后才展开。未分别隔离两份 schema 的单独因果，不能断言单个字段独立充分；实际包应保留两者。
- 所有安装、停用、源注册实验只在 research 内自有 CODEX_HOME，未修改真实用户配置、正式业务库、Git 状态或工作区。
- research 夹具目录与生成 schemas 留作证据，不应作为插件分发或提交整个 research 树。
- 没有验证官方 remove 在当前真实 Windows 锁定缓存下的结果；只能如实使用其实际返回，不能承诺删除一定成功。
