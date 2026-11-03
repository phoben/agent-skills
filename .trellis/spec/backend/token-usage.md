# Tokens 服务规范

开发前读任务prd/design/implement。Node24 ESM源码位于packages/token-usage，node:test验证；代码注释、错误描述与文档使用中文。

- Codex源SQLite只读；仅允许用户目录sessions/archived_sessions内真实路径。
- 当前账号以App Server的accountId确认，未知归属不得混入，身份切换清除缓存视图。
- 独立统计缓存不保存正文、base_instructions、授权头或凭据。
- 累计差分、重复、继承边界、子代理、跨日和分项守恒必须有业务边界测试。
- 外部结构在边界归一化，MCP参数严格校验；安全错误不回显私有载荷。
- stdout只用于stdio协议；服务和UI独立构建进插件目录，不依赖原型或工作区node_modules。
- 自动测试、包外stdio、真实读取和宿主实际UI分别记录，不能互相替代。
- 历史日志可能为.jsonl.zst，索引可能仍指向.jsonl；仅在允许目录内尝试原路径加.zst，使用内置流解压。
- subagent_history_start_ordinal是第一条新增记录，跳过ordinal小于边界的继承内容；边界记录自身必须计入。
- 便携plugin.json与兼容清单均须存在、同名同版本；Codex0.163仅兼容清单会导致PLUGIN_ROOT未展开的握手失败。
- HTML内联脚本必须通过替换回调写入，防止SDK的美元替换序列被解释；构建产物需语法解析验证。
- 账号管道error、启动中关闭与异步缓存关闭需要回归测试，不能仅处理stdin.write回调。

## 1. 适用范围

修改packages/token-usage/src、插件清单、构建或本地数据边界时使用。本规范是实现契约，历史研究不能覆盖它。

## 2. 签名

`createCollector({codexHome,cacheDir})`提供dashboard、sessions、close；`createCodexBridge({codexHome})`只提供snapshot、identity、close。MCP工具为token_usage_open、token_usage_dashboard、token_usage_sessions，资源ui://yg-toolkit/token-usage.html。

## 3. 契约

查询参数startDate/endDate/timeZone，sessions额外projectId/date/search/sort/page/pageSize。totals字段为inputTokens、cachedInputTokens、cacheWriteInputTokens、uncachedInputTokens、outputTokens、reasoningOutputTokens、totalTokens。local.status仅ok/partial/unavailable，unavailable时totals=null。sessions.lastActivityAt必须位于所选范围，单日查询限制到当天。

合并会话可提供projectIds（1–1000个唯一非空标识），与projectId严格互斥。所有成员均须存在于当前账号和所选区间；未知或其他账号成员整体拒绝，不返回部分成员。合并后统一搜索、排序和分页，响应project.id为group:other，含memberCount；totals和totalCount保持搜索前的成员范围。

CODEX_HOME可选，默认用户.codex；YG_TOKEN_CODEX_BIN可选，指定真实Codex可执行文件；预览端口由YG_TOKEN_PREVIEW_PORT覆盖。MCP不接受路径参数。

## 4. 校验与错误

| 条件 | 结果 |
| --- | --- |
| 日期无效、范围超过366天、时区或分页错误 | INVALID_ARGUMENT |
| 查询期间账号变化 | ACCOUNT_CHANGED，不返回旧数据 |
| 无法确认当前账号 | IDENTITY_UNAVAILABLE，不读本机历史 |
| 源索引缺失或不可用 | local.unavailable；会话查询失败 |
| 日志损坏、继承或计数异常 | 计覆盖警告，保守统计可确认增量 |
| 写端关闭、启动中停止 | 安全错误并回收进程，不抛未处理流异常 |

## 5. 正常、基础与失败场景

正常：当前账号可确认，官方日桶与本机明细分别返回。基础：全部记录完整时local.status=ok，缺日官方status=partial。失败：其他账号和未知归属排除，缺失记录不冒充零。

## 6. 必需断言

采集测试覆盖跨账号、ordinal边界、重复/重置、跨日、Zstandard、worktree、显式项目名与历史范围时间。服务测试断言身份切换拒绝、未知账号不读源、关闭等待缓存释放。包级验证断言global入口、资源MIME、包外启动、非法参数和内联脚本语法。

## 7. 错误与正确做法

错误：将所有累计快照求和，或把等于继承边界的第一条新记录丢弃。

正确：按累计增量统计，跳过ordinal小于边界的继承内容，分项相加守恒；先构建和验证脚本，再在Codex宿主验证清单展开。
