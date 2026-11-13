# Codex 宿主能力调查

日期：2026-11-03。只读检查，不修改安装、不创建会话、不读取凭据。源码证据只适用于所核查版本，不是稳定 SDK 承诺。

## 版本与来源

- 桌面安装包：`OpenAI.Codex_26.1027.3384.0_x64`。
- 本机 CLI：`codex-cli 0.163.0`。
- 桌面源码容器：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0/app/resources/app.asar`。子代理只读解析容器内指定 JS，未解包写入或修改程序。
- 本仓库 `@modelcontextprotocol/ext-apps` 为 1.2.2，标准类型未定义 OpenAI 专有的草稿选项。

## 原生仓库侧栏

`app.asar::webview/assets/app-initial-4267e52fe5b0.js`：

- 第 463 行 global schema 接受 type、header 和 quickAction，没有发现 items 或仓库数组参数。
- 第 466 行从各 MCP 工具提取入口。
- 第 1045 行 `h1r/_1r` 遍历工具和 global 入口；`o1r` 将结果转为侧栏项。身份包含 server/connector、工具名和入口类型，标题来自工具标题，路径按 server 与工具名生成。

结论：当前源码允许一个服务通过多个入口工具生成多个原生项。候选方案为一仓库一只读入口工具，共享页面资源。此前“只有一个插件入口”的推断不足，不应将其作为限制。

尚未证明：工具变更通知是否实时刷新侧栏、重连缓存、app-only 工具的入口可见性、仓库项排序及数量较多时的表现。

最小实验：两个受控仓库工具直接出现在原生侧栏，各自打开正确数据；运行中新增或移除第三项，观察工具变更通知与重连行为；重启验证身份稳定。此实验属于后续实施验证，当前未执行或改变插件安装。

## 桌面项目读取

CLI 0.163.0 的实验 schema 提供 `project/list`、`project/read`，Project 包含 roots.path。非实验 ClientRequest 不包含这两个方法。

只读探测：另启 App Server，初始化 `capabilities.experimentalApi=true`，发送项目列表请求，返回一页、22 项、25 个 root，无后续 cursor。仅输出计数，不打印名称和路径。

结论：有独立于线程历史的项目读取路径。尚需将结果与桌面注册项目对照，并验证无历史项目、增删和成员电脑兼容性。不得以内部 `workspaceRoots.read` 等宿主调用冒充插件公开桥接方法。

## 新聊天草稿

- `app-initial-4267e52fe5b0.js:3118` 定义严格 `openai/message` 对象，只接受 target（active/new）与 send。
- `app.asar::webview/assets/widget-9db463e435db.js:6`：send=false 走草稿分支，target=new 走新草稿；宿主按条件声明 `experimental['openai/message'].draft` 能力。
- 同文件第 2 行：新草稿传 freshDraft、selectChat、prefillPrompt 和附件，未传 cwd 或工作区。

结论：当前宿主实现新聊天草稿，需初始化后探测权限和能力。该消息 API 的指定工作区组合未证实；不能向严格消息参数中自行塞 cwd。以下 OS 深链是另一条有源码证据的候选路径。

最小实验：从两个不同工作区发起，确认新聊天、预填、未发送和目标工作区四项同时成立。若不成立，继续找有公开证据的路径；生成深链或独立线程不能代替桌面验收。

## 工作区深链的真实处理器

同一安装包内：

- `.vite/build/early-bootstrap-339-096ec1020e8592e0.js:135`：URL 分发的 new 路由调用解析器，读取 path、projectId、mode、originUrl 和 prompt。
- `.vite/build/early-bootstrap-491-e75c34fa1b2c0832.js:1632`：newThread 分支优先解析项目 ID，否则验证 path 是目录，再查找或创建该目录对应项目、更新选中项目，导航时传 prefillPrompt 和 project；未发现此分支发送 turn。
- 同分支的目录检查失败可能继续导航并令 project 未定义，所以插件必须先验证路径，防止错误落入当前项目。
- `webview/assets/new-thread-feb56d3afa56.js:2` 的 createMcpAppThread 本地路径使用 projectless 和用户主目录，不能据此满足仓库工作区绑定。

结论：`codex://new?mode=codex&path=<编码目录>&prompt=<编码提示词>` 具备当前版本的真实路由处理证据，不只是 Branchkite 生成链接。但它未被本轮证明是官方稳定 API，也未证明插件可打开、草稿可独立保留或未发送时有持久聊天 ID。

候选调用路径：本地 MCP 服务从已验证仓库映射取得目录，核验存在及身份，构造并交给 Windows 系统打开；不调用宿主内部函数，不自动发送。真实 PoC 必须覆盖两个项目、中文多行、提示词长度、重复点击和已有草稿；仅返回打开请求成功不能宣布聊天已创建。

## 已知聊天导航与可靠关联

后续只读核查没有打开聊天、读取真实聊天内容或修改配置。

- `app.asar::.vite/build/early-bootstrap-339-096ec1020e8592e0.js:135` 的 threads 路由校验 UUID，产生 localConversation，接受 `codex://threads/<UUID>`。
- `early-bootstrap-491-e75c34fa1b2c0832.js:1632` 的对应分支只导航，可选 prompt 仅作预填、不发送；复用已有聊天不加 prompt。宿主不替插件核验仓库或工作区。
- 新建深链未提供已证实的自定义 requestId/metadata 透传；ui/message 成功只返回空对象；hostContext 未见 thread ID。内部适配器知道 ID，不代表第三方 handler 可获得它。

以下行号基于前述临时实验 schema，不代表真实聊天验证：

- `v2/ThreadListParams.json:71` 的 cwd 精确匹配；第 128–133 行 projectId 为实验字段；第 24–30、149–169 行支持 created_at 等排序。
- 同文件第 135–140 行 searchTerm 只搜提取标题；第 181–183 行 useStateDbOnly 避免扫描 JSONL 修复元数据。
- `v2/ThreadListResponse.json:1270` 的 preview 没有完整性或长度保证；第 1227–1229 行为 thread ID，第 1274–1279 行为项目，第 1159 行为 cwd。
- `v2/ThreadItemsListParams.json:60` 支持小页与升序；`v2/ThreadItemsListResponse.json:782` 为 userMessage，第 1689 行起有文本结构，真实是否原样保留待验证。
- `v2/ThreadMetadataUpdateParams.json:31` 无通用任务 metadata map；userMessage.clientId 没有深链赋值回执契约。

可验证方案是在提示词首行带唯一任务引用，发送后按精确工作区与发起时间缩小候选，再核对初始用户项。只认唯一匹配；无或多匹配保持未确认，不按标题、时间或 preview 绑定。

完整验证包含：目标工作区保存、引用原样可读、独立 App Server 可见桌面新线程、真实 ID 可导航、已有草稿不丢失。当前未执行任何真实聊天读取来验证这些条件。

## 团队版本边界

现有 Tokens 需要 Node >=24；Branchkite 需要 Node >=24 且 <25，两者均不自带 Node。Git、gh 和 Codex 也不是 JS 自包含产物的一部分。现有验收只覆盖 Windows 与特定版本，不能据此承诺 macOS。

团队方案应明确支持版本、能力探测与升级提示，既不能将实验接口当长期稳定契约，也不应因其尚未稳定而否认本机已成功读取的事实。
