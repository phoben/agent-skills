# 发送后未关联

2026-11-04，用户确认已发送新聊天消息并完整保留首行任务引用，点击检查后仍pending，没有返回会话入口。当前0.3.2，继续已授权任务，不重建聊天、不发送消息或操作GitHub。

- [x] 当前双身份下指定nonce的真实只读对照：projectId查询0候选，同cwd查询有唯一新候选；官方items有turnId/item包装，内部首条用户首行精确匹配。
- [x] 两处实际接口差异修复，新增6条回归，29项任务测试通过；精确工作区、身份、nonce、唯一及完整覆盖要求保留。
- [x] 独立215测试/49语法通过，0.3.3构建安装、8文件哈希和包外stdio通过；真实既有请求check得到linked/complete/唯一候选，返回目标元信息已复核，记录见task-association-verification-033.md。
- [ ] 用户在原生页面点击“返回会话”确认回到刚才同一聊天；API关联不替代原生导航结果。

root只读探针限制在用户指定nonce、当前身份和同工作区的有界近期候选；不输出正文、凭据、账号标识或其他聊天标题。实现代理负责服务/bridge及测试；独立核查最后进行。原生UI仍由用户观察。

两个准确红回归已执行：`node --test --test-name-pattern="桌面深链聊天未写projectId" test/product-tasks.test.mjs`及`node --test --test-name-pattern="关联检查读取官方turnId" test/product-tasks.test.mjs`，均实际pending/预期linked。真实旧0.3.2 stdio对该自有请求check也返回pending/checkedCandidates:0，记录task-association-live-check-033-before.json。该调用只更新本机自有请求状态，没有打开、发送或另建聊天。

时间窗未造成排除，首条消息没有被上下文占据；这两项原假设已由真实探针排除。修复针对远端项目过滤与一层官方包装，不扩展成任意消息内搜索nonce。
