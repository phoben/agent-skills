# Issue Hub

YG Toolkit内的Windows Issue管理模块，用于浏览本机项目对应的GitHub仓库。统一安装YG Toolkit，Tokens与Issue Hub保留各自页面入口；Issue Hub只有一个global，打开后在页面内切仓库。界面沿用已确认的A连读队列。

页面跟随桌面宿主的亮暗模式与基础颜色变量；宿主未提供颜色时使用中性白灰/炭黑，不再使用绿色暗色板。插件入口、页面标志和favicon统一为双票据连接图标。

## 安装与使用

Issue管理使用Node 24、Git、Codex和成员自己的gh登录（`gh auth login --hostname github.com`）。gh缺失只限制Issue Hub，不阻止Tokens与工程技能。复用既有权限，不建设团队账号或后台。只支持github.com，暂不支持Enterprise Server和macOS。

确认yg源已更新到整合版并使用干净构建后运行：

```powershell
codex plugin add yg-toolkit@yg
```

不再新增独立`issue-hub@yg`。旧插件应保持停用，确认整合版后可通过官方卸载入口移除其插件缓存，原业务目录不删除。已有yg源若仍指旧源码，手动安装可能装回旧包；先同步源，或按交接说明从干净包安装。源码包私有版本不作为插件安装版本，统一版本来自YG双清单。

打开 Issue Hub 后，插件通过 Codex 项目接口与 Git remote 自动发现仓库。父目录内的嵌套仓库也会有界检查，不扫描全盘。默认最多深入 5 层、检查 1500 个目录；跳过依赖、构建目录和链接，触限或目录失效会显示发现不完整。仓库旧名称和新名称在当前 gh 身份确认指向同一 GitHub ID 后合并，多个工作区仍保留。

列表可搜索及筛选，详情可查看正文、属性、评论和活动；后续页保留继续加载入口，已加载数量不冒充总数。远端正文安全显示，图片与附件以链接提供。Projects、子 Issue 和依赖关系的完整管理保留 GitHub 入口。

项目和 Issue 单击切换。拖动两栏右边缘的分割线可调宽：项目栏164–420px、Issue队列280–640px，同时给详情保留至少360px。窄窗继续使用项目抽屉。分割线可用方向键、Home/End调节，Enter或双击恢复该栏默认，也可用“恢复默认列宽”重置两栏。列宽与上次仓库按当前账号保存在本机，拖动不重绘编辑表单。

再次打开时，插件可先显示同一已验证凭据的缓存目录、列表和正文，再在后台核对最新数据。缓存和待检查状态明确标注，不当作新的成功时间。无缓存首次仍需读取真实项目和GitHub；正文先显示，评论、活动、编辑候选和会话随后加载，不用空评论冒充没有讨论。

支持新增、标题正文编辑、关闭重开、新增评论和编辑本人评论，以及现有标签、负责人和里程碑调整。仓库标签定义维护、Issue/评论删除在 GitHub 操作。权限不足时不提供相应管理动作。

前台当前仓库每 60 秒检查，打开页面、手动刷新和写入后会读取最新数据。离线可看已经缓存的内容并存草稿；恢复网络后仍由成员点击提交。已有远端修改会提示比较，保留输入。GitHub 不提供通用原子条件写入，检查后到实际写入之间仍有竞争窗口。

创建或评论响应丢失时显示结果未知，不能靠重复点击重发。先到 GitHub 核对；明确确认未创建后，可解除本次回执，再主动提交。远端已经接受但读取失败时，只重新读回，不再提交。

“创建任务”在正确工作区打开可编辑提示词，不自动发送。单路径直接使用，多路径首次选择并记住，失效时重新选；已有确认关联时优先返回聊天，另建入口保留历史。只有首条用户消息中的唯一任务引用完整匹配且候选覆盖完整，才显示已确认关联；请求发出不能当作聊天已创建。

0.3.0 增加“修改工作区”和会话历史入口。修改绑定只影响后续新任务，已有聊天仍使用原工作区。历史中只有已经核实的聊天可以返回；存在多个匹配候选时，页面列出已核验的候选，成员明确选择后再次核对，不默认选中某个聊天。

0.3.2修复重新打开页面后“创建任务”停在工作区检查的问题。缓存目录尚待核对时，这次点击会主动完成核对并显示进度，成功后继续打开草稿；检查失败保留输入并说明原因。目录检查与GitHub联网状态分开，只有实际读取成功才解除离线提示。

0.3.3修复已发送但检查后仍待关联的问题：支持深链新聊天暂缺项目编号及宿主新版消息包装。依然核对当前工作区、身份和首条完整任务引用，只有完整唯一匹配才关联；无需重新创建已经发送的聊天。

0.3.4补齐附件与关联PR的状态说明，区分暂无、活动尚未读完和暂不可用。活动初批或后续页读到PR后，来源链接及时更新并去重，保留评论草稿与编辑表单。

0.3.5为首次入库的分发修订，清理HTML空白并同步构建版本，功能沿用已验收的0.3.4。

独立分发0.3.5现已退休，功能纳入YG Toolkit 0.3.0。两者属于不同插件ID，旧业务schema和身份保持，不是数据降级；已有草稿、回执和会话关联原地恢复。

项目栏的“连接检查”在首页加载失败时也可打开，检查运行环境、GitHub 登录、桌面项目接口、会话身份和本机存储。它只报告结果和处理建议，不安装工具或修改配置。确认写入成功但最新内容读取失败时，页面保留成功回执，只提供重新读取，避免重复发布。

## 数据、兼容与回滚

业务缓存、草稿、偏好与操作回执使用 Node 24 内置 SQLite，默认目录为 `%LOCALAPPDATA%/IssueHub/data`。任务关联另外绑定 Codex 身份。数据库不保存 token 或聊天正文；凭据只在进程内取散列，用于确认离线缓存仍属于同一登录。401、凭据变化或已确认失权会清除相应读取资格；未发布草稿保留在原账号下。

0.3.0 的会话身份由当前 Codex 配置目录和可信 ChatGPT 账号标识共同确定。配置时间变化或同账号授权刷新不会再改变持久身份。API Key 模式或身份未知时，Issue 管理仍可使用，会话关联会提示受限。旧版本身份域无法证明归属的记录继续保留，不猜测迁移到当前账号。

P0 的 `%LOCALAPPDATA%/IssueHub/host-proof/requests.json` 是独立诊断数据，正式产品不导入其中的验证提示词和聊天关联。升级前可备份独立数据目录。数据库拒绝打开比程序更新的 schema，避免降级覆盖；卸载插件不等于删除草稿数据。

本机已调查 Codex CLI 0.163.0 与 Windows 桌面 26.1027.3384.0 的项目/深链接口。部分宿主接口属实验能力，缺失时明确报不可用，不读写 Codex 私有数据库。本机正确工作区、手动发送、旧草稿保护与返回同一聊天已获用户实测确认；另一台Windows按用户安排暂缓。隔离配置安装、真实API和浏览器结果分别记录，不能代替第二台电脑。

## 开发与检查

先在两个源码包分别安装依赖。整包构建沿用Tokens入口：

```powershell
npm --prefix packages/token-usage ci
npm --prefix packages/issue-hub ci
npm --prefix packages/token-usage run build
```

在本模块目录进行回归与协议检查：

```powershell
npm test
npm run check
npm run build
npm run verify:stdio
npm run verify:toolkit
npm run verify:live
npm run doctor
```

`check`是JavaScript语法检查，无独立类型检查或lint。`verify:stdio`检查YG包里的Issue单服；`verify:toolkit`从同一复制YG包分别启动两MCP，确认11工具、2个global、统一版本、双资源/许可/完整技能，并验证Issue缺gh时Tokens仍可打开。`verify:live`仅只读核对，不创建Issue或发送聊天。

`doctor`使用构建产物执行Issue只读环境检查，返回JSON；也可从仓库根运行`node plugins/yg-toolkit/dist/issue-hub.cjs --doctor`。Issue诊断失败不等于Tokens或其他技能不可用。先统一构建再检查，避免运行旧产物。

需要转交Windows时，可从仓库根目录生成完整YG包：

```powershell
node packages/issue-hub/scripts/package-windows.mjs --out E:/IssueHubReview
```

将ZIP交给Windows成员，解压后先执行`powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly`，再不带CheckOnly安装。包包含完整YG技能、双MCP、许可及哈希，不含个人登录或业务数据。已有源保留指针，用官方API指定干净包的marketplace文件安装；首次成员注册包源以便CLI管理。源目录要长期保留并更新，具体迁移和旧插件处理见[交接](../../docs/issue-hub/windows-handoff.md)。第二台真实Windows仍须独立验收。

Issue输出位于`plugins/yg-toolkit/dist/`：`issue-hub.cjs`、`issue-hub.html`、`issue-hub-THIRD-PARTY-LICENSES.txt`。Tokens原三产物和许可独立保留。统一build与推送钩子按YG一份版本重建两模块，页面无外部依赖。构建、源码推送、成员安装及正式发布分别执行。

浏览器联调可在构建后运行 `node scripts/preview.mjs`，默认 `http://127.0.0.1:18287/`。它使用正式 MCP 路由读取真实数据，允许保存本机草稿、偏好与工作区绑定；会话操作仅开放 latest/bind，拒绝 GitHub 写入及聊天打开、扫描和人工关联，不作为真实宿主验收。关闭由本次启动进程处理，勿清理其他会话的预览服务。

可选环境变量：`ISSUE_HUB_DATA_DIR` 指定绝对数据目录；`ISSUE_HUB_CODEX_BIN` 指定绝对 Codex exe；`CODEX_HOME` 沿用 Codex 自身配置；`ISSUE_HUB_PREVIEW_PORT` 指定只读联调端口。插件不会自动安装依赖或修改成员代理/系统设置。
