# YG整合：升版、交接包与安装实现

仅在干净worktree `issue-hub-in-yg-20261104` 修改指定文件；没有修改真实用户插件、配置或业务库，没有创建/发送聊天或Git提交推送。源码已冻结，可交独立check。

## 变更

- `.codex/hooks/bump_plugin_version_before_push.py`：生产注册项合为YG，两个源码模块归同一版本，目标为双清单和六产物；四个运行文件逐个校验版本header。构建显式固定目标版本，外部YG_TOKEN_BUILD_VERSION不能改目标。脏输入、原索引、首次入库、失败整体恢复与重试规则保留。
- 对应unittest改用统一两模块夹具，覆盖Issue改动升级YG、四header/六产物、外部版本覆盖、首次入库、缺失便携/产物、脏目标与Issue源码、部分构建/成功退出但Issue旧版本/提交失败回退，以及未暂存其他文件保护。
- `scripts/package-windows.mjs`：原命令现在打完整YG包，含10个工程技能、原图标、两套六产物和独立许可；打包前拒绝脏/未跟踪skills，避免混入原root另一个EdgeOne任务。当前中间包158个插件文件，另5个安装/说明文件。
- `scripts/install-toolkit.mjs`：Node便携安装器，打包时bundle成ZIP根CJS。只用官方固定API安装YG、读取配置及停用两个明确旧Issue ID，不扩展业务bridge白名单。已有yg源保留指针，首次无源才注册当前包。成功确认新YG后停旧入口，旧cache及业务目录不删除；报告说明旧源未来手动安装可能回退。
- CheckOnly只检查文件和Node24/Git/Codex，缺gh仅Issue warning，不安装/注册/停用。验证全文件哈希、路径、schema、双服务入口、四版本头和非空许可；同版cache不符拒绝覆盖，YG较新版本不自动降级，不跨插件比较旧Issue0.3.5。
- `install-windows-review.ps1`改为PS5兼容薄包装，使用已解压包的Node助手；新增YG/LICENSE（与repo根MIT相同）。
- ADR0009已同步统一YG升版语义。

## 回归与真实隔离验证

- `python -m unittest discover -s .codex/hooks -p test_bump_plugin_version.py`：最终19项通过。差分红反馈用HEAD旧hook运行新的Issue组件变更用例，准确报缺失旧plugins/issue-hub清单；新hook同用例及其余规则转绿。旧源码/失败仅保留research，不改业务源。
- `node --test test/toolkit-install.test.mjs`：最终11项通过，0跳过；包括实际创建文件symlink拒绝、遍历/哈希/旧header、CheckOnly无写入、保源安装顺序、隐藏旧ID按config停用、安装失败不先停旧、同版cache复用与拒绝、可选gh。
- 两个新安装/打包脚本node --check通过，所改范围git diff --check通过。
- 已实际从完整YG包解压，使用fresh临时CODEX_HOME运行PS CheckOnly、确认无源/安装变化，再完整安装、重启独立AppServer。确认一个YG插件加载Issue8工具和Tokens3工具，两服务均0.3.0且toolsError=null。自有临时目录清理，真实用户配置未改。
- 证据：`toolkit-bundle-smoke-030.json`、`toolkit-bundle-smoke-final-030.json`。第二份覆盖config/read安装前核对与新包实际安装；随后仅增强静态版本头/许可和报告字段，11项测试通过，最终归并包由root在rebase新main后重新打包。

## 当前包与基线说明

这些ZIP和smoke针对最初d3bbc3a基线的中间构建，不作为最终成员包。root已发现origin/main新增f9afd50的已发布EdgeOne内容，后续会独立rebase并重新打完整包；不能拿中间包旧技能当成最终YG技能集。

当前源码不会修改/迁移IssueHub/data路径或schema；setup进程可能正常启动MCP，因此报告只写业务目录未改/旧cache未删，不宣称SQLite文件字节或mtime从未被宿主打开。真实旧数据行与会话恢复验证由root负责。

## 待root

独立质量检查、rebase新main、最终包隔离安装与真实安装后双服务发现。已有本地yg源必须同步整合后的提交，或用户选择新持久源；一次override安装不等于源永久升级。旧独立缓存锁定时保留停用，不强删。另一台真实Windows仍按用户安排暂缓。
