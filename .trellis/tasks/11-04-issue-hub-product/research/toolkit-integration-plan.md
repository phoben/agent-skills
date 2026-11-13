# 将 Issue Hub 纳入 YG Toolkit

用户明确要求整合。本轮在干净工作区 `.worktrees/issue-hub-in-yg-20261104`、分支 `codex/issue-hub-in-yg` 实施，原工作区的 EdgeOne 和本机历史材料保留。方案直接承接用户选择，不重复要求开工或任务创建批准。

## 当前清单

- [x] 核对打包、数据身份与当前安装；旧独立Issue Hub已停用，YG仍启用，已装EdgeOne等于HEAD而非原工作区脏改。
- [x] YG0.3.0单包双MCP，统一六产物/独立许可/升版归属，独立源码条目退役。
- [x] 完整159文件/10技能Windows包及官方安装器通过；本机已安装YG，旧独立插件官方卸载，数据目录未改。
- [x] 独立Issue237/Tokens35/53语法/19Hook、11工具2入口、隔离安装及真实已有聊天恢复通过；持久行摘要一致。
- [x] 便携说明与规范同步，5569276已推送整合分支并快进main；原源指针保持，原root安全同步已提交内容且保留EdgeOne字节。
- [ ] 另一台真实Windows由用户明确暂缓；未将本机隔离profile冒称第二机，也未自动操作CodexUI。

## 已确定的行为

只需安装和升级YG Toolkit；Tokens和Issue Hub各自保留页面入口。两个MCP进程仍独立，一个Issue管理故障不能阻断Tokens。缺gh只限制Issue管理，不能阻止只用Tokens/工程技能的成员安装YG。

插件统一版本为YG Toolkit的0.3.0（原YG0.2.5新增模块）；旧独立IssueHub0.3.5属于不同插件ID，不据此判成数据降级。私有源码包版本不作为安装版本，显示/构建从YG双清单确定。

IssueHub业务数据目录、SQLite schema、工具名、UI URI和Codex/GitHub身份算法保持，缓存/草稿/回执/已关联聊天无需搬动。数据不随旧插件缓存卸载删除。旧独立插件在新YG确认后保持停用或用官方卸载入口退役，不能重复启用。

## 最小代码边界

- YG双清单、mcp.json、图标和marketplace：只保留YG安装条目，新增issue-hub服务。
- 保留Tokens既有build入口，串行构建两服务；Issue单独输出YG dist内issue-hub.cjs、issue-hub.html、issue-hub-THIRD-PARTY-LICENSES.txt。Tokens三个原产物及许可不被覆盖，准备依赖时安装两个源码包。
- Issue main/preview/verify与VERSION适配新的文件名和YG版本；产品行为不重写，不扩展MCP权限。
- 升版注册表生产归属合为YG，两个源码模块和六产物一起检查/重建；仍禁止脏构建输入，失败整体恢复。
- Windows包保留完整YG skills、图标、双服务及许可。迁移脚本用固定官方plugin/install接口，不改任意配置或复制其他任务脏内容。
- 独立源码插件退役，保留Git历史及用户缓存回滚，不把旧目录作为第二套可安装插件继续维护。

## 安装研究约束

官方plugin/install接受marketplacePath，但必须指向 `.agents/plugins/marketplace.json` 文件。使用clean工作区同名yg源可以避免复制原root脏YG目录，真实源指针暂不改；仍需验证新AppServer不回退及长期源一致性。当前CLI同名marketplace add拒绝覆盖，禁止先盲删真实源。

后续临时profile已验证：API覆盖安装后重启不会自动回退，保留原yg源指针；零源安装也可运行双MCP，但CLI管理不枚举，所以首次成员先注册包源。原yg是指向原root的本地源，长期需在相关提交交付后用非重叠fast-forward同步该root当前分支，保持分支名和EdgeOne内容；Git若发现覆盖风险就停止，不强制、不reset/stash。实际安装始终使用干净worktree，禁止从脏root复制YG技能。该同步使原source最终也只有新的YG条目，避免以后手动add装回旧版。

迁移前后只核对当前账号的存储元数据与自有请求投影，不打印token、账号标识或聊天正文，不自动新建/发送聊天。原生Codex UI仍不自动操作。

## 分工

打包实现者负责manifest/MCP/核心build/main/preview/协议回归；安装实现者负责Windows包/迁移脚本/升版钩子与测试。root负责文档、干净构建依赖、真实安装与状态核验、Git整合；独立trellis-check最后核查两模块和迁移边界。各自不回退他人修改，不触原root EdgeOne脏文件。
