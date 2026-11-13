# Research: Issue Hub 纳入 YG Toolkit 的打包边界

- Query: 将已验收的独立 Issue Hub 收进 YG Toolkit，保持现有功能、数据及会话关联，避免重复安装与版本漂移。
- Scope: internal；只读研究干净工作区 `E:/Develop/agent-skills/.worktrees/issue-hub-in-yg-20261104`。
- Date: 2026-11-04。

## Findings

### 1. 目标应是一个插件包、两个独立 MCP 服务

现有 `plugins/yg-toolkit/mcp.json:2` 仅声明 `yg-token-usage`；`plugins/issue-hub/mcp.json:3` 单独声明 `issue-hub`。迁移可在 YG 的 mcpServers 增加现有 Issue 服务，保持两个服务进程与各自页面，不合并业务控制器。Token 服务继续3工具/1global；Issue 服务继续8工具/1global。一个插件安装不等于全桌面只剩一个 global 页面入口，不应承诺新原生浮层。

统一版本应以YG双清单为唯一发布来源。YG当前0.2.5，新增能力可升0.3.0；独立Issue Hub 0.3.5属于另一个旧插件ID，不能把跨插件的数值变化当作业务数据库降级。组件的私有NPM版本属于开发元数据，若保留则不能再作为安装包/MCP/UI版本来源。

### 2. 持久数据不需要因插件归并改作用域

- `packages/issue-hub/src/main.mjs:21` 默认使用 `%LOCALAPPDATA%/IssueHub/data`，不是PLUGIN_ROOT缓存目录；`ISSUE_HUB_DATA_DIR`覆盖仍保留。
- `src/storage/database.mjs:6` 的schema版本为1；同文件10行固定库名`issue-hub.sqlite`，拒绝较新schema的逻辑与插件semver无关。
- `src/host/bridge.mjs:144` 的持久身份hash规范Codex home和可信账号ID，不包含插件ID、发布版本或授权文件mtime。
- `src/services/issue-tasks.mjs:51`以GitHub scope及Codex身份派生任务scope；匹配/历史/首行引用规则无须修改。

因此保持默认数据目录、schema、身份算法、工具名和`ui://issue-hub/app.html` URI，即可读取既有草稿/偏好/回执/会话关联。不要迁移或删除Token源SQLite、旧账号scope、未知legacy域；也不要因YG0.3.0小于独立Issue0.3.5就拒绝迁移。

### 3. 现有文件路径绑定必须同步修改

| 文件 | 当前绑定与必要变化 |
| --- | --- |
| `packages/issue-hub/scripts/build.mjs:8-14` | 当前从旧插件双清单取版本，写旧插件dist；应读取YG双清单，写YG dist，并让服务/UI共享同一版本。 |
| `scripts/build.mjs:23,43` | 当前输出`app.html`及通用许可文件；应改为`issue-hub.html`和`issue-hub-THIRD-PARTY-LICENSES.txt`。 |
| `src/main.mjs:27-28` | 当前从二进制同目录读取`app.html`、从`../assets/icon.svg`读图标；必须与新布局一起改，URI本身保持不变。 |
| `scripts/preview.mjs:25-26` | 两个磁盘路径指向旧插件目录，须改新YG HTML和Issue图标；只读预览的操作白名单保留。 |
| `scripts/verify-stdio.mjs:9-25` | 当前复制整个旧插件并读`icon.svg`；须改为从统一YG包启动Issue服务，仍校验8工具/1global和app-only写。 |
| `packages/issue-hub/package.json:15` | doctor仍指向旧CJS；要改YG输出。package:windows可保留旧命令名作兼容转发，但不能再产生独立Issue插件包。 |
| `test/product-server.test.mjs:43` | 图标测试硬编码旧资产路径，应指向YG `assets/issue-hub.svg`。 |
| `.agents/plugins/marketplace.json:24` | 删除新安装用的独立issue-hub条目，保留YG条目；已有安装记录由迁移流程处理，不靠删除业务数据解决。 |

建议最终Issue输出为`plugins/yg-toolkit/dist/issue-hub.cjs`、`issue-hub.html`、`issue-hub-THIRD-PARTY-LICENSES.txt`，资产为`plugins/yg-toolkit/assets/issue-hub.svg`。旧`plugins/issue-hub`源目录可以退休，已经安装的旧版本缓存由官方CLI迁移流程管理，不能对用户目录直接递归删库。

### 4. Tokens 的许可不能被 Issue 构建覆盖

`packages/token-usage/scripts/build.mjs:9,53`固定写YG dist与`THIRD-PARTY-LICENSES.txt`；Issue构建当前也写同名许可。若只改输出根目录，两个构建会互相覆盖许可。Token原有CJS/HTML/许可三文件保持，Issue改独立三文件；完整YG包必须同时带两份许可。

Token业务源码不需要因为归并改动。它的构建目前支持`YG_TOKEN_BUILD_VERSION`（build.mjs:14），Issue构建却直接从清单取版本；任何统一构建的目标版本覆盖都应同时传给两个构建器，不能出现一新一旧。正常构建读取同一YG清单即可。

### 5. 必须有统一构建入口及统一 pre-push 归属

现有YG hook注册表 `.codex/hooks/bump_plugin_version_before_push.py:25-42`仍把两个包当独立插件，YG build仅运行Tokens脚本。若只删旧市场条目、加MCP配置，后续自动升版将漏掉Issue产物，或因旧manifest被删而失败。

最小可靠边界：

1. 一个YG注册项，源码归属包括`plugins/yg-toolkit/`、`packages/token-usage/`、`packages/issue-hub/`以及新增统一构建脚本目录。
2. 最终推荐保留已有`packages/token-usage/scripts/build.mjs`作为YG统一构建入口：先完成Tokens，再固定串行调用Issuebuild，验证同名同版本双清单、两服务入口和六个明确dist输出。Issuebuild不能反向调用Tokens，避免循环；无需第三包或repo级NPM monorepo。
3. 原子回退/脏输入保护覆盖两套构建输入和所有六个dist输出；清单/输出有任何暂存、未提交或被忽略的修改都不能被自动覆盖。
4. 目前`validate_artifacts`只在marker存在时检查outputs前两个（hook实现约151行），合并后必须验证两套服务/HTML的版本。可使用明确的逐产物marker映射或等价的专用校验，不可只验证Tokens而允许旧Issue二进制随包发布。
5. 退休旧Issue registry项，重写23个现有hook测试中双插件隔离/首次独立发布的夹具，改测Issue组件变更导致YG升版、两套产物共同重建及任一失败整体恢复。保留无关改动不升版、脏输入拒绝、重试幂等、初版及版本倒退保护。

`PLUGIN_MANIFEST/BUILD_SCRIPT/BUILD_OUTPUTS`等旧常量是现有测试与辅助入口使用的YG别名，迁移时要么继续对应统一YG定义，要么同步所有调用者。

两个源码包当前各自import esbuild/SDK；开发或自动升版前应为两个package准备依赖。Hook不应临时联网安装依赖，缺Issue依赖必须使统一构建失败并按既有事务恢复，不能只重建Tokens。Issue源码VERSION的fallback可从YG manifest读取，而bundle继续define canonical版本，避免自动hook升版后静态fallback漂移；组件私有NPM版本可保留旧实现版本，不当作发布版本。

### 6. Windows包要保留整个 YG 工具箱

现`packages/issue-hub/scripts/package-windows.mjs:17-28`只复制旧Issue的8个文件并注册`issue-hub-review`；安装器第28行也运行旧路径。不能机械把这8文件改到YG就交付，因为`plugins/yg-toolkit/.codex-plugin/plugin.json`显式声明`skills: './skills/'`。

统一包必须包含完整已提交YG技能、原有图标/许可、Tokens三文件及Issue三文件。应从干净工作区读取，排除本机日志/cache/凭据/symlink，尤其不能带原root正在修改的EdgeOne技能。转交包的市场/插件名称、哈希清单、CLI安装目标、doctor路径与卸载说明要一起更新。可保留原`package:windows`调用作为统一包入口兼容。

Issue main当前lazy创建gh客户端，缺gh并不天然阻断Token服务启动。现安装器把gh当整包必备，统一后需明确该依赖只服务Issue模块；至少不能因为Issue诊断失败就使已经可用的Tokens失去功能。具体安装器的缺gh处理由实现方案确定。

### 7. 验证与文档

- 两组件原测试全部执行，原业务安全边界不放松；调整路径相关测试，补统一清单/市场/构建/版本/许可完整性回归。
- 一个干净YG目录从包外分别启动2个MCP，校验Tokens3工具/1global、Issue8工具/1global，两个resource URI及同版本。
- Codex安装后inventory应是一个YG插件下的两个MCP；旧独立插件不再同时提供Issue入口。已有SQLite的草稿/关联读取仍属于当前双身份，不因安装包名改变。
- 文档涉及`packages/issue-hub/README.md`、`docs/issue-hub/{requirements,architecture,windows-handoff}.md`、ADR0009及原独立分发决策、前后端spec。建议新增ADR记载本次用户明确要求统一工具箱，保留原型和业务范围，勿重开布局设计。

## Files found

- `plugins/yg-toolkit/{plugin.json,.codex-plugin/plugin.json,mcp.json}`：YG当前0.2.5双清单、技能与单Token MCP定义。
- `plugins/issue-hub/`：独立0.3.5插件资产和分发目录，拟退休。
- `packages/issue-hub/scripts/{build,verify-stdio,preview,package-windows}.mjs`：旧包路径及输出绑定。
- `packages/issue-hub/scripts/install-windows-review.ps1`：旧独立review安装约束。
- `packages/token-usage/scripts/{build,verify-stdio,verify-live}.mjs`：原YG输出与协议检查，注意许可覆盖。
- `.codex/hooks/{bump_plugin_version_before_push,test_bump_plugin_version}.py`：当前双插件独立版本注册表与23项回归。
- `packages/issue-hub/src/{main,host/bridge,storage/database,services/issue-tasks}.mjs`：布局依赖及与插件ID无关的数据/身份边界。

## Related specs

`.trellis/spec/backend/issue-hub.md`、`.trellis/spec/backend/token-usage.md`、`.trellis/spec/frontend/issue-hub.md`、`.trellis/spec/guides/cross-layer-thinking-guide.md`。旧独立插件打包段落将由新用户要求覆盖，业务与数据契约继续有效。

## External references

未开展外部检索；结论基于当前main派生的本机代码，Codex CLI支持与实际安装退役流程由另一研究主题核验。Node24、ext-apps1.2.2、MCP SDK1.32.2、esbuild0.28.2取自当前组件package.json。

## Caveats / Not Found

- 本研究没有执行安装/卸载、写用户配置、真实GitHub写入、聊天操作或Git操作。
- 移除marketplace条目不会等价于已安装旧插件自动退役；安装顺序与官方CLI失败恢复需单独验证。
- 统一插件版本与组件私有NPM版本的展示策略需由实现确定，但数据库降级绝不能按两个旧插件的semver比较。
- 某些旧P0测试/代码可继续兼容保留；它们不能作为新增legacy独立安装入口重新暴露。
