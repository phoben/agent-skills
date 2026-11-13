# YG Toolkit 0.3.1 详情恢复

用户报告列表有缓存但详情失败/离线，随后明确“已经恢复了”。当前终端（login、无profile、移除proxy变量）及已注册插件合法读取流程均取得目标Issue最新正文；插件完整只读结果为6条评论、21条活动、offline=false/cached=false。最初底层失败没有捕获，不认定代理、权限或整合是原因。

列表页与详情分别缓存，有列表不代表该条详情已有可用缓存。一次详情读取失败可以出现截图组合；本次不清缓存、不重登录、不改系统网络。

## 已复现并修复的恢复问题

原临时实际控制器/Store反馈3项均失败；正式回归先8项6红/2绿，修后转绿：

- 成功摘要只局部paint，错误页无详情节点，旧错误屏未退出。
- 旧物理请求晚失败覆盖更新的online/lastSuccess；晚join旧Promise不能算新请求。
- 相邻初次加载旧成功/失败可能覆盖已恢复的正文或画面。
- 切Issue/账号后旧刷新catch可把旧错误提示写到新页。

修复使用实际详情读取收据，同对象且未编辑保存时退出错误/加载屏、恢复本机草稿；正常详情仍局部更新。序号绑定物理Promise及已应用详情，最新真失败仍离线、缓存/本机/task成功不伪造联网，401/403与身份撤销保留。没有新增网络重试或自动重投写入。raw→stable额外探针被既有accessVersion拒绝为stale，按安全回归保留，没有误作新业务漏洞。

## 验证

- 最终255项Issue测试、84项UI定向、53模块语法通过。Tokens35和Hook19源码未变，保留既有实际通过结果。
- 同一YG0.3.1包外11工具/2入口、双资源/同版本及缺gh隔离通过。
- 实际本机安装0.3.1，159缓存文件SHA与包相同，双服务均0.3.1且资源可读，旧独立活动服务为0。
- 从实际新缓存对用户目标Issue只读取得最新正文，offline=false/cached=false；没有写GitHub或操作聊天。
- 使用新的issue-recovery-data前后记录，schema和8条保护持久行摘要一致；旧整合版快照未覆盖。
- 已提交并推送main：80848c280133219e454c7f7884e0ac200d5482e0，原源工作区正常快进、其他本机历史材料仍未提交，临时工作区已移除。

记录见issue-offline-registered-read.json、issue-offline-recovery-result.md、issue-offline-recovery-check.md、issue-recovery-real-install.json及issue-recovery-installed-read.json。原始失败根因仍未知，补丁只针对已证实的恢复状态，不宣称修复所有真实网络故障，也未自动操作Codex桌面UI。
