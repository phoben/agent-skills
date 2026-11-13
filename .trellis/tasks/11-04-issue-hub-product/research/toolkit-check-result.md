# Issue Hub 纳入 YG Toolkit：独立最终检查

2026-11-05，trellis-check。代码工作区唯一为 `E:/Develop/agent-skills/.worktrees/issue-hub-in-yg-20261104`，分支codex/issue-hub-in-yg。最终检查在本地checkpoint ca72719已rebase到origin/main f9afd50之后执行；此前d3基线的中间ZIP不作为本轮最终材料。

本检查没有操作真实用户插件配置、业务库、聊天或GitHub写入，没有自动操作Codex UI、提交或推送。原工作区EdgeOne与历史材料未修改；仅按主会话授权修复安装器的精确局部边界，并将QA报告写入当前任务research。

## 范围与兼容核查

- marketplace仅保留一个yg-toolkit安装条目。一个YG插件包含yg-token-usage和issue-hub两个独立MCP进程，各自保留页面及一个global，共11工具/2global；不是两个可独立升级的插件条目，也不承诺原生悬浮仓库栏。
- YG双清单统一0.3.0。两个私有源码包的NPM版本仍可分别为0.2.5和0.3.5，它们不作为安装版/MCP/UI版本，不拿旧独立Issue0.3.5与YG0.3.0判断数据降级。
- Tokens统一构建入口串行构建Issue；六份明确产物包含两个CJS、两个HTML与两份独立许可。四份运行产物逐个验证版本头，Issue构建不覆盖Tokens许可、不反向调用形成循环。
- Issue业务改动仅main资源/图标路径与VERSION归属；storage/schema、host身份、Issue/任务业务服务、工具名和UI URI没有差异。IssueHub/data与当前CODEX_HOME身份域不迁移，不复制认证或聊天正文。
- 原独立plugins/issue-hub八文件已退休，已有安装的停用/卸载由官方管理入口处理；不靠删业务数据或重建聊天去重。
- 相对f9afd50，YG skills无业务diff。最终包包含最新已发布EdgeOne副本，不是原root脏内容，也不是d3旧快照。

## 升版与安装边界

- pre-push生产注册表合为YG，归属同时覆盖两个源码模块，目标包含双清单和六产物，四header全部校验；固定目标版本覆盖外部YG_TOKEN_BUILD_VERSION，不能让外部环境把构建改成其他版本。
- 两模块源输入、目标及符号链接/脏文件预检保留；任一构建/提交失败，六产物及清单整体恢复，其他暂存内容不被带入版本提交。Hook不会临时联网安装依赖。
- Windows包遍历完整YG技能与资产，拒绝符号链接、本机敏感文件、未声明分发文件、路径穿越和哈希不符；打包前检查skills干净。旧Issue的八文件改目录不足以通过当前完整包验证。
- 安装助手独立于业务bridge，只使用固定官方initialize/plugin-install/config-read/config-value-write；不新增业务MCP权限。配置写入只针对两个明确旧Issue ID的enabled=false，新YG版本确认后才停旧入口，不删cache/草稿/关联。
- CheckOnly只核对文件及核心依赖，不注册、安装或停用。缺gh只告警Issue受限，Tokens和工程技能仍可安装；缺gh进程故障隔离有整包实际协议证据。
- 已有yg源保留原指针，仅本次安装指定干净marketplace JSON；首次无源才注册当前包。同名旧源日后CLI手动add确会回退，长期源同步仍由主会话完成，不能把override安装当作源永久升级。

## 发现并修复：补注册后隐藏的既有安装

已证实的本机官方行为是：没有注册yg源时，CLI list可能不枚举已经安装的YG。原安装器先保存inventory/existing，再补注册源，随后继续使用旧快照；隐藏的较新版本或同版cache因此可绕过保护。

先新增两条依赖注入红回归：隐藏YG0.4.0和隐藏YG0.3.0，首次list不返回YG，补注册后才可见。原实现两项均报Missing expected rejection，确实没有拒绝覆盖路径。

在主会话确认后，仅修改install-toolkit.mjs：首次注册后重新读取inventory，复用原版本检查，再让已发现同版走现有cache哈希守卫。正常已有yg源路径和调用序列保持；不增加宿主方法或重写配置。两个红回归转绿，旧Issue及其他插件不被提前停用。

修改文件只有该安装器和toolkit-install.test.mjs。Runtime六产物不变；主会话需将两文件纳入其自有未发布提交，不能带原root其他任务。

## 实际执行的检查

| 检查 | 独立结果 |
| --- | --- |
| Issue包最终npm test | 237项通过，0失败/跳过/取消；包含13项安装器测试（原11项加本次2条）。 |
| Tokens包npm test | 35项通过，0失败/跳过。 |
| Issue npm run check | 53个JavaScript模块语法通过；本次安装器小修后又对两改动文件node --check通过。没有独立lint/TypeScript配置。 |
| Hook unittest | 19项通过，39.121秒；只在临时仓库与本地bare远端执行。 |
| verify:toolkit | 同一个复制YG包在包外启动两个服务，Tokens3工具/1global、Issue8工具/1global、两个资源及版本0.3.0一致；缺gh的Issue请求报GH_UNAVAILABLE，Tokens页面仍可打开。 |
| 差异/空白 | f9afd50..checkpoint及本轮未提交局部修复git diff --check通过；YG skills相对origin/main无diff。 |

Tokens35、Hook19、53模块及整包协议在安装器局部修复前已实际通过，修复只改变首次注册后的inventory核对。按主会话要求未无意义重跑这些不变部分；setup定向13项及Issue完整237项在最后修复后执行。

实现者另有统一build版本覆盖0.3.1并恢复0.3.0的验证，本检查未重复改版本或重建覆盖中间态。

## 最终Windows包独立隔离安装

最终包：`yg-toolkit-0.3.0-windows-1793809504131.zip`。

SHA256：`03ad7b6bf8531291e3c0a22c5db2c506041634858ac958069cab917f3b273729`。

使用research/toolkit-bundle-check-final.mjs独立核验，最终结果在toolkit-bundle-check-final.json：

- 159个插件文件、5个安装辅助文件、10个工程技能；146个skill文件路径及SHA逐个等于f9已发布main和当前干净源码，包含新发布EdgeOne资料。
- PS5薄包装CheckOnly通过，前后零源/零安装，确认没有注册、安装或停用副作用。
- 实际安装到fresh自有CODEX_HOME成功，159个缓存文件SHA全部与包清单一致。
- 安装后关闭并重启独立官方App Server：同一yg-toolkit@yg下仅两个MCP，均为0.3.0，Issue8工具/Tokens3工具，toolsError均null。
- 子进程CODEX_HOME、Issue数据、GH配置及Windows用户/应用数据目录均隔离到自有临时目录，移除子进程认证环境变量；没有实际业务调用、聊天打开或发送。
- 自有临时目录清理完成，真实用户配置与业务数据未改；该结果不称第二台真实Windows。

最后补强了QA的Windows用户目录隔离兜底并重跑同一ZIP安装检查，避免依赖宿主是否透传自定义数据目录变量；没有修改产品源码或重复业务测试。

## 主会话继续负责的真实验收

真实YG安装后双服务归属、旧独立插件停用/官方退役、原草稿/回执/已关联聊天的只读摘要及长期本地源同步由主会话记录，不在上述fresh-profile测试中冒称完成。Windows锁定旧cache时保持停用并报告，不强删，不改业务数据。

另一台真实Windows及成员授权仍按用户安排暂缓。归并不要求重新选择UI、重发聊天或复制旧数据；原root脏文件的Git同步若有覆盖风险应停止，不能reset/stash/force解决。

本轮源码再次冻结。除已说明的安装器局部修复外，没有遗留需要业务改动的阻断项；报告与中间夹具保留本地，不提交整个research或临时profile。
