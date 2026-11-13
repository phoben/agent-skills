# 0.2.1 后端加载诊断

## 反馈与旧版基线

修复前已运行 `node --test packages/issue-hub/test/performance-product.test.mjs`：三项失败。前两项分别把远端用户查询和仓库元信息置于可控未释放 Promise 后，首屏 bootstrap 仍未返回，准确复现多等无关远端请求；第三项确认原版没有 read-summary，必须走完整详情。该反馈无需真实网络、百毫秒级，可确定变红。

用户旧版真实信号由主会话取得：0.2.0 已安装模型 `issue-repositories` 单次 8761ms、12 仓库。它是完整目录读取，不能直接与新快速快照动作比较并宣称等语义提速。新旧主界面完整加载路径的真实时间另由主会话测量。

## 排序假设与预测

1. 目录扫描阻塞协议初始化。若把全扫描从 server.connect 前移到有界按需后台，则即使扫描 Promise 延迟，MCP 也能先连接和发现工具。
2. bootstrap 等待远端身份和所有仓库 metadata。若只对同凭据已验证稳定身份读取可信缓存并明确 checking，则延迟用户/其他仓库的请求不会阻止已缓存目录出现；未知凭据仍必须确认真实账号。
3. 正文读取和全部评论/活动/候选串行。若新增只取正文/属性的 read-summary，则延迟评论与活动不会阻止正文，模型完整 read 仍访问讨论分页。
4. 并发读重复身份和同一路径请求。若只合并当前凭据/当前身份作用域内的在途只读请求，则同时切入相同对象不会重复发起相同 API；写入与不同凭据不合并。

## 修复与契约

- `main.mjs` 先连接 MCP，取消连接前全量 Git 扫描。`bootstrap` 在无目录缓存时只检查注册 roots 的直接 Git 仓库，四并发，明确 partial/checking 与子仓库尚待扫描；有当前 GitHub scope 的目录快照则恢复先显示。工作区实际打开在完整复核前返回 CATALOG_CHECKING，不将失效缓存当成功。
- `bootstrap` 先核验当前本机凭据散列。仅散列绑定过稳定用户 ID 才可快速读当前 scope 缓存；未知或变化凭据仍验证用户接口。快照含 `checking`、`refreshNeeded:true`，前端后台调用严格 `refresh`。完整模型目录入口使用 refresh。
- `list`、`read-summary` 可显式传 `cacheFirst:true` 先返回当前 scope 缓存 Issue 列表/正文；默认不启用，模型读取及远端写仍严格验证身份和最新服务数据。`read-summary` 不请求评论、活动或候选，coverage 明确尚未加载；完整 `read` 保持全部分页语义。
- `view-state-save` 仅保存当前账号本机的项目列宽、Issue 列宽和选中仓库；范围分别 164–420 与 280–640，选仓键必须在当前 scope 已验证且仍属于发现目录。bootstrap 返回 viewState。
- `networkChecked:false` 表示快照或纯本机动作尚未核对网络，不可凭 `offline:false` 把已知离线状态改成在线。缓存读取明确 cached/checking；401 撤销凭据绑定、403/404 撤销仓库读取缓存保持不变。
- 相同凭据、相同参数的在途只读服务请求合并；gh 用户身份查询也只合并同凭据的在途调用，完成后不保留远端身份 TTL。写入不合并。目录的源修订号和投影修订号分离，缓存归一不能覆盖期间完成的新全量发现或新鲜归一。

## 确定性结果

同一反馈从三项失败变成三项通过。扩展后性能文件九项通过：已验证身份无需等待用户接口、目录无需等待全仓元信息、正文不取讨论、缓存列表与正文额外远端调用为零、凭据变化和401撤销、相同在途读取合并、列宽作用域和边界、冷直接根发现不等待深扫描、目录快照复核前禁止打开。

`node --test packages/issue-hub/test/performance-product.test.mjs packages/issue-hub/test/issues-product.test.mjs packages/issue-hub/test/github-product.test.mjs` 共38项通过；全包37模块语法检查通过。既有四项失权/401/写后比较回归保留。原先要求“bootstrap必须直接新鲜归一”的测试已改为调用明确完整语义的 refresh，另用独立性能回归验证 bootstrap 的 checking 缓存语义，没有删掉权限和改名断言。

## 实际时间

主会话独立临时 dataDir、连续两次开进程的旧版报告 [entry-before-021.json](entry-before-021.json)：cold connect 3919ms、bootstrap 6439ms、list 5009ms、完整正文 read 7747ms，进程开始到可用列表15374ms、正文23122ms；warm connect3989ms、bootstrap1845ms、list4823ms、正文7372ms，到列表10660ms、正文18032ms。此处 warm 指同临时数据第二次进程，不冒充多机统计。

主会话统一构建后实测见 [entry-final-021.json](entry-final-021.json)：冷连接146.3ms，进程开始到可用列表6783.1ms、正文8546.3ms；热连接115.8ms，到可信缓存列表581.7ms、正文751.2ms。两次真实正文均16965字节。热读之后完整刷新10206.8ms独立完成，未把它说成最新数据已同步。新read-summary只先显示正文，完整讨论后续加载，模型完整read仍保留。

本机真实网络、独立临时目录的冷/热各一次样本不代表所有网络。初轮entry-after-021.json记录器曾错用checking===true而字段为对象，时间计数仍有效；已改Boolean并得到最终checking=true样本。不把loading空目录算可用首屏，也不把快照动作与模型完整读取直接比较。没有远端写入或聊天打开。

后续真实浏览器复现了Codex配置mtime变化使长连接永久拒绝读取，目录失败曾被投影为空。主会话已取得同连接的IDENTITY_CHANGED及新连接正常读取证据，正在单独修复宿主自动重连与目录失败保留显示；因此上述时间样本是提速路径结果，不冒充当前整体验收已完成。
