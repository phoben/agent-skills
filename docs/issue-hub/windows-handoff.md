# Issue Hub Windows 交接

本机 0.3.4 已通过，另一台电脑按用户安排暂缓。设备到位后复用本清单，无需重做需求或原型。

## 准备包

从仓库根目录执行：

```powershell
npm --prefix packages/issue-hub ci
npm --prefix packages/issue-hub run build
node packages/issue-hub/scripts/package-windows.mjs --out E:/IssueHubReview
```

将输出 ZIP 和对应 SHA256 一起交给成员。包包含自包含插件、许可、文件哈希、独立 review 源及 PS5 兼容安装器；不包含个人配置、缓存或凭据。

## 成员验收

1. 准备 Windows、Node 24、Git、gh、Codex，使用自己的 `gh auth login --hostname github.com` 登录。
2. 解压 ZIP，在解压目录运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly`；按结果处理缺失依赖和连接问题。
3. 通过后运行 `powershell -ExecutionPolicy Bypass -File .\install.ps1`。已有正式 Issue Hub 时拒绝并装，先回报现有版本，不盲目卸载或删除数据。
4. 打开插件，确认单入口、自己的项目与有权访问的仓库；切两个仓库核对列表和详情。
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

独立 `issue-hub-review` 源用于转交验收。源码推送不等于已安装到所有成员电脑，也不等于发布到官方插件目录。后续正式发布由用户另行决定。

卸载不删除本机草稿；需要降级先备份独立数据，不强写较新 schema，不用清空缓存解决文件占用。
