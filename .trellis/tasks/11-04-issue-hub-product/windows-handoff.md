# Issue Hub Windows 交接

此处旧独立0.3.4包仅保留历史。当前应使用完整YG Toolkit 0.3.0：正式操作见仓库docs/issue-hub/windows-handoff.md；最新包为artifacts/toolkit-final/yg-toolkit-0.3.0-windows-1793809504131.zip，SHA256为03ad7b6bf8531291e3c0a22c5db2c506041634858ac958069cab917f3b273729。已验证159文件/10技能、单YG双MCP、原数据保留；不要再安装下面的旧独立包。

本机0.3.4验收完成；另一台Windows按用户安排暂缓。设备到位后按此清单接手，不用重新做需求、原型或本机聊天验收。

## 材料

- 包：artifacts/final/issue-hub-0.3.4-windows-1793802385238.zip
- SHA256：`83b5dbcaaf6ffbb8b9481538627b7e98fa39ded75954f3d1334c3f3bc4f93e95`
- 包含自包含插件、许可、8文件哈希清单、独立issue-hub-review源、PS5兼容安装器及说明；不包含个人登录、缓存或聊天数据。
- [本机验收结论](research/local-acceptance-034.md)

## 成员操作

1. 准备Windows、Node 24、Git、gh、Codex。使用成员自己的 `gh auth login --hostname github.com` 登录；不要复制其他成员的凭据目录。
2. 解压ZIP。在解压目录运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly`，检查依赖和连接；有错误先按提示处理。
3. 检查通过后运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1`。已有正式Issue Hub时会拒绝并装，先回报现有版本，不盲目卸载或删数据。
4. 在Codex打开Issue Hub，确认只有一个入口；看到自己项目对应的仓库，公开/私有/组织仓库按自己的权限读取。切两个仓库核对列表与详情。
5. 在允许测试的仓库检查正文、评论和来源状态；写入仅对事先同意的临时Issue进行，完成后关闭和清理。不要拿现有业务Issue随意发布评论。
6. 选择一个本机工作区，创建草稿，核对目录与未自动发送。保留首行引用，用“仅回复验收收到，不读写项目、不运行命令、不操作GitHub”手动发送，检查关联并返回同一聊天。
7. 如需切账号验隔离，先保存输入；切换后不能显示上一账号的私有缓存或发布其草稿。失败时打开连接检查，回报状态，不发送token或完整诊断日志。

## 回报模板

```text
Windows / Codex / Node版本：
CheckOnly与安装：通过 / 停止位置
自己的项目与仓库读取：通过 / 现象
有权限仓库的临时Issue管理：通过 / 未测 / 现象
正确工作区、草稿保护与返回同一聊天：通过 / 现象
账号切换：通过 / 未测 / 现象
```

只需回报实际通过项和卡住的位置。不同成员权限或组织SSO授权不足应如实记录，不把它当作空仓库。

## 升级与退出

当前ZIP使用独立review源，正式YG远端源尚未推送本地实现。该包是验收交接，不等于已正式发布或团队已全部升级。正式提交、推送、版本发布由用户另外决定。

缓存、草稿与关联默认在本机IssueHub/data，卸载不等于删除数据。需要降级时先备份独立数据，不能打开较新schema后强写旧格式；保留旧版本和未发送草稿，不用删除缓存解决安装占用。
