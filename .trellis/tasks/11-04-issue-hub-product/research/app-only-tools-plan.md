# MCP工具仅页面可见

用户明确同意将token_usage_open、issue-repositories、issue-read、issue-comments全部设为仅页面可见，并保留侧边栏入口和页面功能。当前在途产品增量直接实施，无需重新批准。

- [x] 仅调整4个注册项的visibility，保留工具名/参数/处理函数和两个global资源入口；回归及包外协议确认所有12个工具仅app可见。
- [x] 独立Issue298/60语法及Tokens36通过，三个协议检查0model/12raw/2global。实际安装宿主元数据及当前会话工具目录均确认模型集合为0，两个global及原资源/调用保留。
- [x] YG0.3.5已安装159文件哈希一致，保护11行摘要保持，原源目录同步，本地代码提交ab47758及最终宿主刷新说明e0e5fb0；未推送，临时worktree已移除。

边界：仅server.mjs的元数据、对应测试/验证脚本与说明、统一版本/构建产物。不删除实现，不改页面、仓库/GitHub/统计算法、身份/存储/任务规则；不创建聊天、不执行真实写入、不承诺未经测量的上下文节省量。总工具仍12（Issue9/Tokens3），侧栏入口仍2。App-only不是工具被移除；宿主status/raw tools/list应保留它们，但按visibility推导的模型工具集合应为空。

唯一代码工作区.worktrees/issue-hub-app-only-20261105，基线bbf1e07。实现者负责两server及必要测试/协议，root负责版本/docs/集成/真实安装；测试禁止把raw tools/list的12个误认为仍向模型暴露12个。
