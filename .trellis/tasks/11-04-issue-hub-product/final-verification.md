# Issue Hub 0.2.0 实施与验收记录

2026-11-04。用户确认 A 完整原型后直接进入 Trellis 实施。已实现并安装本机 `issue-hub@yg` 0.2.0；任务保持 in_progress，真实远端写入、Codex 桌面聊天往返及第二台 Windows 证据尚未取得。

## 已交付实现

- 单个 Codex 插件主入口，页面内仓库导航和 A 连读队列；正式包移除演示数据与模拟任务推进。
- 真实 Codex 项目/Git remote 发现、有界嵌套仓库扫描、GitHub稳定ID别名合并及多工作区保留。
- gh 当前身份、Issue 列表/详情、分页评论/活动、真实来源链接和编辑候选。
- 新增编辑、关闭重开、本人评论及现有标签/负责人/里程碑；写前比较、写后字段与真实评论读回，未知提交显式核对恢复。
- SQLite 缓存、草稿、偏好与回执；凭据变更/401隔离，403/404失权清读取投影并保留原账号草稿，前台60秒检查且离线不自动发布。
- 工作区绑定、一键预填不发送、持久请求/历史、完整唯一nonce关联及返回真实聊天的服务实现。
- 独立0.2.0双清单、自包含产物/许可和多插件升版隔离；[安装与使用说明](../../../packages/issue-hub/README.md)。

## 自动检查与真实只读

| 项目 | 实际结果 |
| --- | --- |
| 主会话最终 `npm test` | 97项通过，0失败/跳过。覆盖真实SQLite并发/重开、Git/worktree及隔离GitHub边界，不代表真实远端写入。 |
| `npm run check` | 33个JavaScript模块语法通过；项目没有独立lint/TypeScript检查。 |
| build / 包外stdio | 0.2.0产物构建通过；一个global、写入仅app可见、正式UI可读、无效参数拒绝。 |
| 升版钩子 | 23项临时仓库/本地bare测试通过，Issue-only不误升YG、首次发布/双插件失败恢复和暂存保护通过；没有真实push。见 [钩子记录](research/release-hook-result.md)。 |
| 真实GitHub与项目只读 | 22项目、25根、12个已发现/归一仓库；当前项目列表与非空Issue正文读取成功，正文16965字节、活动1项、该条评论0项。见 [只读结果](research/verify-live.json)。101评论及分页截断仅自动化验证。 |
| 本机安装 | `codex plugin add issue-hub@yg --json` 成功，版本0.2.0；[8文件SHA-256全部相同](research/installed-hashes.json)。 |
| 安装后独立宿主发现 | 7个工具、1个global、0个P0仓库工具，UI资源513647字节可读；[结果](research/installed-product.json)保留desktopRenderingVerified=false/chatCreated=false。 |

独立审查修复与最终检查详见 [product-check.md](research/product-check.md)。后端、前端、目录与任务的分工结果分别在本任务research中。

## 正式页面浏览器证据

浏览器联调使用正式 App/LiveStore、AppBridge、同一MCP服务及真实GitHub读取，网关只允许读取、本机草稿/偏好和任务latest。远端变更与打开/检查聊天被明确拦截，不能当成真实Codex界面验收。

主会话实际通过页面内仓库按钮选择 `phoben/agent-skills`，读取 #3 列表及真实长正文、属性。最终版本再次从真实入口读到同一标题和正文，实际窗口2548×1303未发现横向溢出。另由截图工具在目标画布渲染并查看：

- [浅色1120×880完整详情](research/evidence/light-ready/page.png)
- [深色960×680完整详情](research/evidence/dark-ready/page.png)

两张最终截图的控制台/横向溢出/加载图片检查通过。第一次20秒取图只得到加载状态，保留为历史，未冒充详情；最终45秒取图已实际查看非空详情。正常速度动效手感仍未验证，不因此重启已达上限的原型视觉评审。

真实MCP草稿保存/导航/整页重载已连续三轮通过，[最终记录](research/browser-live-drafts-recovery.json) failure=null，验证草稿已清除。首次填充因长正文独立滚动区未滚至底部而失败，未发布内容；后续复用同一任务空间按实际测量位置滚动，不绕过用户控制。该结果验证的是实际前端到MCP到本机SQLite，不是GitHub评论发布。

## 仍待验收与已知限制

- 发现状态为partial：本机存在目录深度/数量触限、根检查与Git读取失败四类诊断。已显示不完整，不能宣称提取了桌面全部仓库；桌面项目逐项对照未完成。
- 没有收到具体真实写测试仓库授权，未执行新增/编辑/评论/标签等远端写验收。可测试实现已交付，不能把替身结果写成真实同步通过。
- 真实新草稿工作区、已有未发送草稿保护、发送后关联和返回同一聊天须按 [桌面点检](desktop-checklist.md) 人工验证。Windows Computer Use技能规定：“Do not automate the Codex desktop app UI or Codex CLI or Codex extensions within Windows apps”。未用UIA、SendKeys或私有CDP绕过。
- 第二台Windows安装/成员授权未验证。本地实现未提交推送到远端源，不宣称团队已能在线更新。
- GitHub写前比较与提交之间存在平台非原子竞争窗口。已confirmed的编辑请求重放可能先返回旧基线CONFLICT，不会重复写；未知和读回失败有明确恢复入口。该保守重放体验保留在独立审查记录中。
- 外部参考截图和正常速度动效观看的原型过程缺口仍记录；用户已明确确认A完整原型，未将其误写成宿主集成通过。

本轮没有提交、推送、正式发布，没有改Tokens页面/统计，没有修改成员代理/系统配置。原有 `.playwright-cli/` 保持不动。Trellis不归档，不运行会自动提交的finish-work。
