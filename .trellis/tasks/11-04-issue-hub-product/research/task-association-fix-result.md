# 已发送后仍待关联：实现记录

2026-11-04，用户明确确认0.3.2新会话已手动发送，并完整保留首行任务引用，但点击检查仍显示pending。沿用当前已授权任务；本代理没有操作真实聊天、SQLite业务库或GitHub，没有打开/发送消息，也没有提交推送。

## 反馈回路与已证实根因

先向主会话报告三项可证伪假设：远端项目筛选排除深链聊天；初始消息形状或宿主注入影响首行；聊天时间窗误过滤。主会话真实只读probe逐项对照后确认两个具体差异：

1. 带projectId的thread/list返回0；同精确cwd去该筛选能找到新聊天。该新聊天没有projectId，时间在本次请求之后，时间过滤不是根因。
2. thread/items/list.data实际为带turnId、item、startedAtMs、completedAtMs的包装。首个item是userMessage，完整首行精确匹配；原代码在包装外查type，因而读不到。没有宿主注入覆盖首行的问题。

真实探针由主会话保存在task-association-probe-033.json和task-association-shape-033.json，只保存字段、类型与比较结果，不输出聊天正文。

两条修复前实际红回归：

- `node --test --test-name-pattern="桌面深链聊天未写projectId" test/product-tasks.test.mjs`：1失败，actual pending / expected linked。
- `node --test --test-name-pattern="关联检查读取官方turnId" test/product-tasks.test.mjs`：1失败，actual pending / expected linked。

## 最小修改

只改packages/issue-hub/src/services/issue-tasks.mjs与test/product-tasks.test.mjs，不改bridge、UI、参数或持久数据协议。

- 候选列表按精确cwd获取，不再向宿主传projectId筛选。原ensureWorkspace、当前双身份和请求归属校验保留；本地候选只接受相同cwd，明确带其他projectId的聊天继续排除。项目ID缺省时，当前目录及已验证项目成员关系仍由catalog保证。
- 消息只解官方一层turnId/item包装，兼容旧宿主直接返回的裸typed ThreadItem。包装必须有非空turnId、typed item，混合外层type、损坏或任意嵌套报HOST_PROTOCOL，不递归猜测。
- 仍然只读取首条userMessage的第一行，完整精确匹配任务nonce。代理文本或后续用户消息中的引用不能代替首条。多匹配、分页不完整、身份变化等保护未放宽。
- 人工候选确认复用相同firstUserLine，因此也支持官方包装并保持再次读取验证。

## 验证与交接

两条红回归已转绿。新增6条回归覆盖远端项目筛选、官方包装、明确其他项目/工作区排除、代理或后续引用不认领、损坏包装拒绝、包装分页和人工候选再次核对。

`node --test test/product-tasks.test.mjs`：29项全部通过，0失败、0跳过。源码已冻结，交独立trellis-check执行完整检查；主会话负责真实本次请求的安全验证、版本构建安装和用户最终返回同一聊天的观察。替身openUri与关联结果不能冒充原生深链接实际导航成功。

## 先前覆盖缺口

旧夹具的thread/list忽略了传入projectId，且items直接返回裸ThreadItem，未模拟真实官方分页包装。两者恰好掩盖实际桌面接口差异。本次回归让夹具真正执行项目过滤，并按真实wire shape提供包装，防止仅增加理想化测试数量却仍走不到实际路径。
