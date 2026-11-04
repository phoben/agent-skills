# Issue Hub Windows 交接

当前交付为YG Toolkit 0.3.0，包含完整工程技能、Tokens与Issue Hub。原Issue功能已完成本机验收；另一台真实Windows仍按用户安排暂缓，设备到位后复用本清单。

## 准备包

从仓库根目录执行：

```powershell
npm --prefix packages/token-usage ci
npm --prefix packages/issue-hub ci
npm --prefix packages/token-usage run build
node packages/issue-hub/scripts/package-windows.mjs --out E:/YGToolkitTransfer
```

从干净工作区生成包，技能目录有未提交修改时会拒绝打包。将输出ZIP和SHA256一起交给成员；包包含完整YG技能、两套自包含MCP/页面/许可、文件哈希和PS5安装器，不包含个人配置、缓存或凭据。

## 成员验收

1. 准备Windows、Node 24、Git、Codex。Issue管理另需gh及自己的 `gh auth login --hostname github.com` 登录；缺gh只限制Issue功能。
2. 解压 ZIP，在解压目录运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly`；按结果处理缺失依赖和连接问题。
3. 通过后运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1`。安装完整YG；已有同版只有文件匹配才复用，已装更高YG不自动降级。不要将旧独立Issue版本号与YG版本比较。
4. 分别打开Tokens和Issue Hub。插件安装项只有YG，两个模块各保留页面入口；Issue页面内切仓库并核对列表/详情。
5. 仅在明确获准的临时 Issue 验证写入，完成后关闭清理，不向业务 Issue 随意发测试评论。
6. 核对工作区和未发送提示词。保留首行引用，将其余内容改为“仅回复验收收到，不读写项目、不运行命令、不操作 GitHub”，手动发送后检查关联并返回同一聊天。
7. 如需切账号，先保存输入；新账号不能显示上一账号私有缓存或发布其草稿。失败时回报连接检查状态，不提交 token 或完整日志。

```text
Windows / Codex / Node 版本：
CheckOnly / 安装：通过或停止位置
自己的项目及仓库读取：通过或现象
临时 Issue 管理：通过 / 未测 / 现象
工作区、草稿保护及返回同一聊天：通过或现象
账号切换：通过 / 未测 / 现象
```

首次成员没有yg源时注册解压目录，保持目录稳定；已有yg源保留原指针，用官方安装API指定本次干净包的marketplace文件。已有源也要同步整合代码，否则以后手动从旧源安装可回退旧包。不要盲删源或把多任务脏工作区当成发布内容。

新YG确认后安装器只停用已知旧独立Issue入口，不删除其缓存和业务数据。原IssueHub/data、schema、稳定身份和工具/URI不变，既有草稿、偏好及聊天关联原地读取；确认正常后可用官方插件卸载命令移除旧停用缓存。工具自身不新建或发送聊天。

源码推送不等于成员全部升级，也不等于官方插件目录发布。第二台Windows及成员授权仍独立验收。

卸载不删除本机草稿；需要降级先备份独立数据，不强写较新 schema，不用清空缓存解决文件占用。
