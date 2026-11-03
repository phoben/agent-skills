# 技术设计与接口

## 边界

新增独立Node24 ESM包`packages/token-usage/`，node:test、Node内置SQLite、MCP SDK与esbuild。构建产物位于`plugins/yg-toolkit/dist/`，现有清单增加mcpServers引用mcp.json，最终交付版本0.2.3。运行时不引用prototypes或.oil-ui。

模块：src/collector.mjs（只读采集与缓存）；src/codex-bridge.mjs（受限App Server）；src/service.mjs（账号+本机组合）；src/server.mjs（MCP）；ui/（已确认页面）；scripts/（构建及验收）。

## 身份与读取

- 不解析auth令牌、不创建API Key，沿用Codex认证；Windows直接启动可执行文件或已安装Node入口，禁止shell字符串。
- App Server只允许initialize/account/read/account/usage/read/account/rateLimits/read。以额度结果accountId确认身份，认证文件仅检查元数据变化以重建连接，查询前后核对身份。
- 源SQLite readOnly，动态检查列；仅接受Codex目录内sessions/archived_sessions经realpath校验的日志，MCP不接收任意文件路径。
- 仅匹配creator_account_id，未知身份仅计排除条数。显式project_id优先，否则按cwd的Git共同目录合并worktree，最后以普通cwd归类；项目ID不包含原始路径。
- 独立缓存位于Codex用户目录yg-toolkit/token-usage.sqlite，按账号隔离、文件size/mtime缓存。禁止保存正文、提示词、base_instructions、凭据。

## 计数

- 累计快照取相邻增量，重复快照0；首次累计大于last时保守取last并标部分覆盖。
- 按subagent_history_start_ordinal跳过继承事件，使用record.ordinal（兼容行号回退要标记）；只使用目标线程自己的session_meta，不让复制的父meta覆盖。
- turn_context提供模型/cwd，token_count时间按请求时区分日。当前账号可验证父子合为一会话，未知父保持独立。
- totals包含inputTokens/cachedInputTokens/cacheWriteInputTokens/uncachedInputTokens/outputTokens/reasoningOutputTokens/totalTokens。uncached=input-cached（包括cacheWrite）；total=input+output；reasoning已包含在output。拒绝负数、非安全整数和子项越界，不猜测异常计数。
- 官方日期桶按服务日期展示；覆盖不足返回partial及起止日，无桶总量为null，不与本机强行对账。

## MCP

资源ui://yg-toolkit/token-usage.html，MIME text/html;profile=mcp-app。入口token_usage_open注册global；只读app-only工具token_usage_dashboard和token_usage_sessions。

参数：startDate/endDate为YYYY-MM-DD且最多366天，timeZone为有效IANA；sessions必须且只能提供projectId或projectIds之一。projectIds为1–1000个唯一的非空标识，所有成员均须属于当前账号和范围；先合并会话，再统一搜索、排序和分页。其他可选参数为date、search<=200字、sort=tokens/recent/output、page>=1、pageSize1–100。schema严格校验。

### dashboard响应

`{schemaVersion:1,range:{startDate,endDate,timeZone},account,quota,local,sampledAt}`。

account：`{status,planType,lifetimeTokens,rangeTokens,daily:[{date,tokens}],coverage,message}`。
quota：`{status,windows:[{kind,usedPercent,windowMinutes,resetsAt}],message}`。
local：`{status,totals,projects,coverage,warnings}`。
projects：`[{id,name,sessionCount,...totals,daily:[{date,...totals}]}]`。
coverage至少有scannedThreads/attributedThreads/unassignedAccountThreads/excludedAccountThreads/failedThreads/partialRollouts/indexedAt。

### sessions响应

`{schemaVersion:1,project:{id,name},range,date,totalCount,filteredCount,totals,page,pageSize,totalPages,sessions}`。
sessions：`[{id,title,model,lastActivityAt,subagentCount,...totals}]`。totalCount与totals为搜索前范围，filteredCount为搜索后，服务端排序分页。

### collector内部接口（并行实现的固定边界）

`createCollector({codexHome,cacheDir,...测试注入})`返回：
- `dashboard({accountId,startDate,endDate,timeZone,refresh})`，返回local结构。
- `sessions({accountId,startDate,endDate,timeZone,refresh,projectId,projectIds,date,search,sort,page,pageSize})`，返回上述sessions响应；合并查询的project包含memberCount。
- `close()`可选。

错误抛带code的安全错误，不回显原始路径或记录载荷。

## 页面

App.connect之后callServerTool，读取structuredContent，兼容text JSON但不解析展示文案。生产不含模拟成功与虚构数据。无宿主桥接显示不可用；开发预览经本机HTTP只读适配器调用同一service。请求序号丢弃过期响应，身份变化清空旧数据与弹窗。

## 验收与回滚

先验证计数隔离与守恒，再真实账号/本机读取，最后包外stdio与本地安装发现。撤销mcpServers即可停用新功能，原Skills继续工作；不自动清理用户历史或统计缓存。
