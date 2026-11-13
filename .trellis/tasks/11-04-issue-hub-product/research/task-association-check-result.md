# 已发送仍待关联：独立检查

2026-11-04，trellis-check，范围task-association-plan.md。实现代理冻结后核查services/issue-tasks.mjs及product-tasks.test.mjs；本检查没有修改业务源码，没有访问真实业务SQLite或读取真实聊天，也没有打开、发送消息或操作GitHub。

## 已核查

- 真实探针显示按projectId远端筛选返回0，而同cwd列表包含本次候选且该候选没有projectId。修复仅移除远端projectId参数，仍按精确cwd、有界近期候选获取，不改成全局聊天扫描。
- 本地候选继续排除明确的其他projectId与其他cwd；缺省projectId不等于任意项目可认领。进入check前，ensureWorkspace仍通过当前catalog复核请求所绑定的registered工作区、项目ID、目录范围和真实Git remote。GitHub/Codex双身份守卫保留。
- 官方wire shape只解一层 `{turnId,item,...}`：要求非空turnId、有效typed item且外层不混type。旧宿主直接返回typed ThreadItem仍兼容；损坏包装、任意嵌套、null项会拒绝HOST_PROTOCOL，不能静默当作完整空页。
- firstUserLine只认首条userMessage的第一行；代理回复、后续用户引用不代替首条。完整nonce必须精确匹配，不按标题、时间或包含文本猜测。
- 候选分页的重复游标、超限、损坏候选与初始消息页截断继续标partial或拒绝；只在完整覆盖且唯一匹配时自动linked，多匹配保持ambiguous。
- 人工resolve复用同一firstUserLine包装解析，重验候选归属、真实thread/cwd/project与首条nonce，事务内再次复查候选；不自动打开或发送。
- 原有账号隔离、reuseOnly精确请求、不盲重投open-unconfirmed及未知请求不读聊天的回归未退化。没有修改bridge白名单、UI、公共参数或持久协议。

## 发现并修复

没有发现需要追加业务修改的问题，本检查未改业务文件。

## 未修复项与验收边界

- 本机真实自有请求的MCP check与保存关联由主会话负责，本检查仅运行隔离测试，不争用真实数据库或聊天。
- linked表示当前请求已取得可靠标识，不能当作原生“返回会话”深链导航成功；实际返回同一聊天仍由用户观察。
- 主会话需将当前宿主候选筛选与分页包装契约写入backend规范，并以0.3.3重建安装。旧夹具忽略projectId及直接裸项掩盖了实际wire shape，后续回归必须维持真实参数过滤与包装。

## 验证

- 实现者两条准确红回归已转绿；新增6条覆盖缺省项目、官方包装、明确错项目/cwd排除、首条消息约束、损坏包装及分页人工确认，定向29项通过。
- 独立最终 `npm test`：215项通过，0失败、0跳过、0取消。
- `npm run check`：49个JavaScript模块语法通过。
- 项目没有独立lint或TypeScript配置；不将语法检查冒称lint/type-check。

核查时包元数据仍为0.3.2候选；主会话随后统一升0.3.3构建安装。本检查源码已冻结，不再重复全套或运行真实聊天探针。
