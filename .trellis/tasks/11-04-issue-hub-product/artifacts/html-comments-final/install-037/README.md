# YG Toolkit 0.3.7 Windows交接包

一个YG安装包含原有工程技能、Tokens与Issue Hub两个页面。准备Windows、Node 24、Git和Codex；gh缺失只限制Issue管理，可在安装后单独准备并登录。

保持解压目录稳定；先运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly`，再运行不带CheckOnly的命令安装。CheckOnly仅检查文件与核心依赖，不注册、安装或停用插件。

首次没有yg源时注册本解压目录；已有yg源保留原指针，官方安装API仅为本次安装指定当前干净包。既有源也需同步到整合版本，否则今后手动从旧源安装可能回退。新YG确认成功后仅停用已知旧Issue独立入口，不删除其缓存、草稿或聊天关联。业务数据仍在原IssueHub/data，插件版本号不决定数据库schema。

已经安装同版且文件不同则拒绝覆盖，请使用新修订。已有更高YG版本不自动降级。不要把另一插件的旧Issue版本号与YG版本作比较。

安装后分别打开Tokens与Issue Hub，核对原草稿和聊天关联；不自动创建或发送聊天。本机隔离配置测试不替代另一台真实Windows及成员授权验收。
