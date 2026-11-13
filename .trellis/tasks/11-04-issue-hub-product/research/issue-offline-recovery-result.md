# Issue读取恢复状态：实现记录

当前用户已回报恢复；主会话真实对照中，login、no-profile及删除代理环境后，身份/仓库/Issue185均HTTP200，实际注册插件读取也成功。最初网络失败原因未捕获。本轮不修改代理、网络、登录或后端缓存策略，只修已确定的界面恢复与迟到状态缺口。

代码工作区为 `.worktrees/issue-hub-read-recovery-20261105`，基于main 5569276。仅修改四个分配文件，没有触原root业务文件、真实数据库、插件安装、GitHub或聊天。

## 先红反馈

原临时脚本 `issue-offline-recovery-feedback.mjs` 执行3项全部失败：手动/后台读取成功后错误页和detailError仍在；较早options失败把更新摘要成功后的online改回false。

转为正式回归后，执行：

```text
node --test --test-name-pattern='刷新取得摘要|错误页恢复|列表更新没有|恢复在途|较早网络|晚加入旧|旧成功不能' test/product-ui-poll.test.mjs test/product-ui-store.test.mjs
tests 8 / pass 2 / fail 6
```

失败点包括旧错误状态未清、已存草稿未恢复、迟到网络失败盖新成功、晚join旧物理请求，以及旧成功回退最后成功时间。两个原有安全边界先绿：没有详情读取证据不恢复、切对象或编辑/保存期间不重建。

## 最小实现

- `ui/store.mjs`为真实inflight Promise记录单调序号；join继承原序号。只有明确网络结果才推进证据序号，旧失败或成功不改较新online/lastSuccess。缓存、本机调用和任务成功不伪造联网；最新实际失败仍显示离线。
- 身份错误和仓库失权处理保持原先顺序与行为，不被网络时序忽略。账号清理重置证据与读取映射，物理请求号在Store生命周期单调。
- 成功结果只在内部WeakMap关联请求号，同Issue应用读取序号防旧首次成功覆盖新严格摘要。没有改变request返回数据、MCP schema、列表归属或后端缓存。
- `LiveStore.refresh()`新增内部布尔收据detailLoaded，仅在实际调用详情读取并完成后为true。列表更新或失败不会伪造该收据。
- `ui/app.mjs`同账号/仓库/Issue且未编辑保存时，取得详情收据才退出旧错误/加载屏；正常详情继续局部paint，不重建输入。恢复时复用初次打开的草稿恢复逻辑，带回已有正文及评论草稿。
- 恢复错误/加载屏递增详情代次，旧首次读取迟到失败不再画错误页；配合Store读取序号，旧首次成功也不把数据换回旧正文。后续讨论hydrate使用新的详情代次。

## 验证

```text
node --test test/product-ui-poll.test.mjs test/product-ui-store.test.mjs test/product-ui-experience.test.mjs
tests 79 / pass 79 / fail 0 / skipped 0
```

本轮新增13项，覆盖两种刷新恢复、正文/评论草稿、无详情证据不伪造、切Issue/账号及编辑保存保护、实际openIssue与LiveStore的旧成功/失败组合、晚join、最新网络失败、成功时间不回退、缓存/本机/任务非网络证据，以及旧授权/403继续撤销。

现有正常详情的评论节点、选区、焦点、滚动和表单保护回归仍通过。没有自动重投写入或新增网络重试。

## 变更与交接

仅变更 `ui/app.mjs`、`ui/store.mjs`、`test/product-ui-poll.test.mjs`、`test/product-ui-store.test.mjs`。业务源码已冻结，交主会话及独立trellis-check执行完整两包/语法/统一包外验证、YG0.3.1构建安装和实际只读验证。项目无独立lint/TypeScript配置，不冒称通过。

本补丁证明恢复状态的防复发行为，不证明最初真实网络错误已经定位或被修复。原生Codex UI没有自动操作，真实环境网络配置未动。
