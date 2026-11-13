# GitHub 与本机数据实现结果

已按共享契约新增 `src/github/client.mjs`、`src/storage/database.mjs`、`src/services/issues.mjs`，扩展 `src/errors.mjs` 的安全业务字段。没有修改 UI、目录发现、server/main 或清单，也没有真实远端写入。

## 可用接口

- `createStorage({directory})`：Node24 SQLite，schema=1，WAL/忙超时、同步事务/回滚、按 scope/kind/key 的 get/set/remove/list、较新 schema 拒绝与迁移备份。禁止跨 await 事务。
- `createGithubClient()`：固定 github.com、gh api --include、写正文走 stdin JSON。内部读取 gh 凭据只用于散列，不输出或保存 token。
- `createIssueService({github,storage,catalog})`：execute/context，返回共享 envelope。全部写入和草稿/偏好/操作恢复需要 expectedIdentity，与真实当前稳定用户 ID 比较。

读取覆盖真实仓库元信息、排除 PR 的 Issue 分页、正文属性、分页评论、活动、附件和关联 PR；默认详情最多 10 页×100，达到上限保留 nextCursor，独立 comments/activity 可继续加载。options 返回字符串候选和带 ID 元数据，标签不允许隐式创建。Projects/子 Issue/依赖管理显式留 GitHub。

日常写入覆盖新增/标题正文/关闭重开/标签负责人里程碑、评论新增和本人评论编辑；写前比较真实 updated_at 或评论正文基线，仅 PATCH 变化字段。GitHub 无通用原子条件更新，保存前比较后的竞争窗口仍存在。

回执在 SQLite 原子认领，pending/unknown/readback-failed 不自动重复；同一创建内容换 ID 也会阻止。显式 `operation-resolve`：not-created 仅人工核对 unknown 并 confirmed:true 后解除，仍须再次主动提交并使用新 ID；readback 只重新读取已接受的结果，不写入。pending 超过两分钟重试时转 unknown，供人工核对而非自动重投。

断网允许同一凭据散列对应的已验证稳定身份读取缓存和保存草稿。凭据变化、未知或 401 不回退其他身份；401 清掉当前凭据的离线映射。查询结束和持久化前再次确认指纹。恢复连接不自动发布草稿。

## 验证

执行 `node --test packages/issue-hub/test/storage-product.test.mjs packages/issue-hub/test/github-product.test.mjs packages/issue-hub/test/issues-product.test.mjs`，20 项全部通过。覆盖 101 评论、分页截断续读、PR 排除、冲突、未知创建、并发误点、人工解除、已接受后读回失败、离线草稿、身份切换/401后离线、在途隔离、本人评论、仓库候选校验及 SQLite 两进程并发/关闭重开/事务回滚/较新版本保护。

全包 `npm --prefix packages/issue-hub run check` 已通过；这是 JavaScript 语法检查，不能称为完整 lint 或类型检查。初次测试失败仅因测试清理先于数据库关闭，已改为先关闭再删临时目录，保留产品行为。真实只读 API 与包外 MCP 由主会话统一验证。

2026-11-04 应主会话要求执行真实只读探针 `backend-live-probe.mjs`：当前 gh 用户与当前仓库元信息均返回 NETWORK_UNAVAILABLE，未进行真实写入。`backend-gh-diagnostic.mjs` 确认 gh 退出 1、无 HTTP 头和响应正文、非超时、连接错误分类命中；不是 JSON 解析错误。进程存在代理环境，未调整用户配置。首装无已验证缓存时不能绕过身份确认显示旧私有内容；真实 GitHub 连通和非空详情须待环境恢复后重验。

## 核对的一手来源

- [GitHub Issue REST](https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28)：Issue 集合可能包含 PR，使用 pull_request 字段排除；创建与更新走仓库 Issue 接口。
- [Issue 评论 REST](https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28)：评论新增/编辑及按 Issue 分页读取。
- [REST 分页](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)：按 Link 的 next 信息判断是否完整，不以已取到 100 条当全量。
- [gh api 手册](https://cli.github.com/manual/gh_api)：--hostname 固定实例、--include 读取状态和头、--input - 从标准输入传 JSON。

当前自动化使用隔离 API 替身和真实 SQLite 文件，不代表真实 GitHub 写入、Codex 界面或团队第二台电脑通过。

## 稳定仓库 ID 增量

父设计要求仓库重命名与多个 Git remote 别名都按 GitHub 稳定 ID 去重。产品 bootstrap/refresh 现从 catalog 原始发现项取元信息，最多四个查询并发，以 `sha256('github.com:id:'+id).slice(0,20)` 为规范导航键。调用 `catalog.remap` 合并相同 ID 的仓库与全部工作区；元信息写入当前账号的规范 ID 键缓存，原 Git 键只作该账号的别名映射。启动可复用同账号一分钟内元信息；手动重新发现强制重验规范名称。

无权限或首次无法确认元信息的仓库仍保留可诊断项，标记 access=unavailable、id=null、diagnostic 安全错误，不填 Issue 数量或读取别人的缓存。当前账号切换会从原始 Git 发现项完整重建映射，不能携带上一账号的规范元信息。首次产品版本尚未安装，无 P0 名称键数据迁移；现有规范 ID 的草稿、偏好和任务键后续随改名保持稳定。

保留综合检查代理新增的仓库失权清缓存、资源401撤销离线映射、Issue读回字段比较与评论真实ID读回四项回归。新增别名合并/多工作区、重命名草稿不变、另一账号失权诊断、元信息在途身份变化、四并发上限五项测试。`issues-product.test.mjs` 23 项通过，联合目录相关检查本次 28 项通过，33 模块语法检查通过。没有真实远端写入。
