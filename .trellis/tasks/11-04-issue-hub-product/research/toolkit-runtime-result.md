# YG Toolkit 双运行模块实现

代码只修改干净工作区 `.worktrees/issue-hub-in-yg-20261104`。原root业务文件、用户安装配置、缓存、SQLite、聊天和GitHub均未操作，未提交或推送。当前业务源码已冻结，交独立check与root安装验证。

## 最小实现

- YG双清单统一0.3.0，描述包含Tokens和Issue管理；YG mcp.json保留yg-token-usage并增加issue-hub，marketplace删除旧独立Issue安装条目。
- Issue图标复制到YG assets/issue-hub.svg；旧plugins/issue-hub的8个tracked文件逐个退休，没有递归删除目录或访问已安装缓存。
- Issue main改读issue-hub.html/issue-hub.svg，UI URI和业务工具名、数据目录、schema及身份算法不变。
- Issue源码VERSION fallback读取YG manifest，bundle继续define目标版本；组件私有NPM版本保留0.3.5，不作为插件显示版本。
- Tokens原build入口串行构建两服务。Tokens保留原三产物并加稳定版本头；Issue单独写issue-hub.cjs、issue-hub.html和issue-hub-THIRD-PARTY-LICENSES.txt，不覆盖Tokens许可，不反向调用Tokens。
- YG_TOKEN_BUILD_VERSION同时控制两模块；缺依赖仍整体构建失败，由版本hook负责原子恢复。
- Issue preview/单服stdio/图标测试切到YG新布局；doctor脚本新路径，新增verify:toolkit命令；Tokens单服验证新增YG版本断言及自有临时目录清理保护。
- 新的统一包外验证复制一个完整YG目录，分别启动两CJS，校验两资源、同版本、11工具/2global及完整skills/独立许可。

## 先红后绿

`node --test test/toolkit-packaging.test.mjs`初次3失败：市场仍有独立Issue、VERSION与YG不一致、YG目录缺Issue产物。修复并统一构建后3项全部通过，另与product-server两项合计5项通过。

新增结构回归固定市场不再注册独立Issue、两服务MCP配置、源码版本来源、六产物/四版本标记和旧插件退休。它不禁止未来其他无关插件条目。

## 实际检查

- Issue Hub完整 `npm test`：224项通过，0失败/跳过；含原221项与3项统一打包回归。
- Tokens完整 `npm test`：35项通过，0失败/跳过。
- `npm --prefix packages/token-usage run build`：两模块0.3.0构建成功。
- Issue `npm run check`：51模块语法通过；两个新增验证文件包括在内。
- Issue `npm run verify:stdio`：YG包内Issue8工具/1global、图标、资源与strict参数通过。
- Tokens `npm run verify:stdio`：版本、3工具/1global、资源与失败路径通过。
- `npm run verify:toolkit`：单个复制YG包的Tokens3/Issue8工具，各1global，同0.3.0及两个URI可读；Issue子进程找不到gh时返回GH_UNAVAILABLE，Tokens入口仍可打开。没有调用Tokens统计读取或聊天动作。
- `toolkit-build-version-probe.mjs`：YG_TOKEN_BUILD_VERSION=0.3.1时两serverInfo与四个版本头全部0.3.1，源清单仍0.3.0；探针完成后已正常build恢复0.3.0。结果为toolkit-build-version-probe.json。
- `git diff --check`无空白错误，仅既有Windows换行提示。

统一故障隔离探针初次试图仅给Issue设置空GH_CONFIG_DIR来模拟无授权，实际gh仍能取到认证，因此该夹具不能确定性制造失败。改为只清理Issue子进程PATH并指向自有空目录，真实gh程序缺失后得到预期错误。未更改系统PATH、真实gh登录或任何用户配置。

## 所有权与后续

本实现未修改Windows package/install脚本及hook；它们由另一实现者处理。现有package:windows入口在对方完成前尚未可用，不能把单服验证当完整安装迁移通过。YG缺gh警告/旧插件停用、真实插件发现与已有草稿/关联读取由root负责，第二台Windows仍按原约定暂缓。

文件范围：市场、YG双清单/MCP/icon与六产物；旧插件8文件退休；Issue main/version、build/preview/verify脚本、package scripts和两个测试；Tokens build/verify脚本。未改Issue业务服务或Tokens采集逻辑。
