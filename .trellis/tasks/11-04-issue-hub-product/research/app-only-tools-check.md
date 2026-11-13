# 页面专用工具可见性：独立检查

2026-11-05，trellis-check。唯一代码工作区为 `.worktrees/issue-hub-app-only-20261105`，基线bbf1e07。已读app-only-tools-plan与新增mcp-app-visibility七节规范；用户明确要求覆盖旧的模型三个只读入口约定，保留页面与侧栏入口。

本检查未改业务代码，没有访问真实Tokens统计、GitHub数据或聊天，没有安装、修改用户配置、提交或推送。

## 范围核查

- 生产源码差异仅四项注册元数据：token_usage_open补visibility app；issue-repositories、issue-read、issue-comments补已有appMeta。
- 名称、参数schema、handler及安全错误处理不变。两个global仍为token_usage_open与issue-hub-open；资源仍分别为Tokens原URI和Issue app-v2，Issue旧app.html别名不变。
- 其他八项工具原本已app-only。现在两服务全部12项显式 `_meta.ui.visibility=['app']`，各关联自己的resourceUri，没有删除实现或将visibility缺省误判为隐藏。
- raw tools/list仍为Issue9＋Tokens3，按visibility缺省或含model的规则推导model集合为0。raw工具总数不是模型可见数，不将这12项误报为仍暴露给模型。
- 页面、统计算法、Issue查询/分页、身份/权限、写入、图片、存储和任务规则没有变化。可见性变化不构成新的业务权限，也不禁止相关技能使用其他连接器或gh。

## handler与调用验证

- 新Tokens内存协议使用fake service，实际执行open、dashboard、sessions：global与资源仍在，合法日期参数及projectId正确进入原handler并返回结果，没有读取真实统计库。
- Issue内存协议保留目录refresh、issue-read与issue-comments调用，cursor=2继续进入评论handler。只改元数据没有使原参数或分页能力失效。
- 包外协议在同一复制YG包分别启动两服务，原资源、图标、Issue CSP及旧URI兼容断言保留；缺gh仅影响Issue，Tokens入口仍能调用。

## 实际执行

| 检查 | 独立结果 |
| --- | --- |
| Issue npm test | 298项通过，0失败、0跳过、0取消。 |
| Issue npm run check | 60个JavaScript模块语法通过。 |
| Tokens npm test | 36项通过，含新增server内存协议；0失败/跳过。 |
| 最终YG0.3.5 verify:toolkit | 12 raw、0 model、2 global；Tokens3及Issue9项全部app-only，两原资源可读，依赖故障隔离通过。 |

项目没有独立lint/TypeScript配置，不将语法检查冒称两者通过。私有源码package版本不是插件安装版本，协议核对的是YG双清单及serverInfo的0.3.5。

本检查的包外执行使用临时CODEX_HOME和脚本自有Issue数据目录，没有读取真实统计或调用真实GitHub。主会话另报告Tokens/Issue单服stdio也已通过；真实安装后inventory、159文件哈希及保护数据摘要由主会话记录，不在本检查中冒称已完成。

## 发现与未修复项

未发现确需修复的问题，未改代码，也未扩大为页面或统计重构。新增Tokens/test/server.test.mjs及对应Issue协议断言属于必要回归，应随本轮源码提交，不能只保留在本机。

两个global与资源在原始协议目录中保留，是侧栏/页面继续工作的接口证据；本检查没有自动操作Codex原生UI，不能将其写成原生侧栏实际点击已经重新验收。

历史对话中的工具描述不会追溯消失；0 model仅指本版YG这两服务的发现集合，不是所有已连接插件都没有模型工具。没有实际测量token节省比例，不作量化承诺。

源码保持冻结，可继续主会话的0.3.5本机安装与本地交付，不推送远端。
