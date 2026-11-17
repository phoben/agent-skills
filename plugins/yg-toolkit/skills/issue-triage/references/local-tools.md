# 本地辅助工具

同包工具 `scripts/issue-tools.mjs` 使用 Node 标准库。显式提供目标 `--root`，不能从本工具安装位置推断仓库。它不创建或激活任务，不调用 GitHub 写接口，不推断“review 就是 PR评审”。

```text
node <本技能>/scripts/issue-tools.mjs doctor --root <目标项目>
node <本技能>/scripts/issue-tools.mjs doctor --root <目标项目> --workflow trellis --platform codex --remote
node <本技能>/scripts/issue-tools.mjs inspect --root <目标项目> --issue '#123'
node <本技能>/scripts/issue-tools.mjs inspect --root <目标项目> --issue <完整Issue链接> --task <明确档案路径> --no-templates
node <本技能>/scripts/issue-tools.mjs plan-init --root <目标项目> --contract <已审核合同JSON>
node <本技能>/scripts/issue-tools.mjs apply-init --root <目标项目> --plan <已审核plan文件> --approved
```

`doctor` 用于 issue-init 的环境盘点，不需要 Issue、合同、Git 或 Trellis。`--workflow auto|existing|trellis` 决定检查范围，`--platform codex|claude` 指当前平台；默认不联网，`--remote` 仅用已有 gh 做只读检查。有效诊断即使有缺项也返回退出码 0，检查 `status`、`checks` 和 `readiness`，不能把命令成功当完整接入。它始终返回 `complete:false`，远端未核实项和新会话行为由主会话补证。详细处理见 [环境补齐与完成标准](../../issue-init/references/environment-readiness.md)。

PowerShell 引用含 # 的参数。plan 命令仅输出 JSON，使用当前 shell 的 UTF-8 文件方式保存到已允许的位置；不要把 shell 显示日志当成有效 plan。`--approved` 只记录调用者已取得具体差异批准，不能把命令里的标志当作用户自动授权。

inspect 返回规范 Issue 身份、目标是否冲突、活跃／归档来源匹配、关联记录缺项、活动任务保护和动态 workflow 摘要。原生默认解析通过项目已有 Python 模块执行；使用前应核对这些项目脚本是当前可信版本。模块或工具缺失时保留候选并报告 warning，不猜测默认。`--task` 只指定读取哪个原合同，不改变真实会话活动任务。

默认调用真实 `trellis workflow --list`；目录不可用时说明限制，不用静态缓存补齐。离线 fixture 可用 `--no-templates`，这不证明真实模板目录已验证。模板元数据只证明可发现，不等于正文已读或变体已就绪。

`workflows.current` 是原生 resolver 实际生效路径；`requested` 和 `selection_requests` 列出原生诊断接口读到的任务／个人／团队选值。原生 stderr 即使退出码为 0 仍进入 warnings；缺失选值导致 `selection_mismatch=true`，实际回落候选标记 `ready=false`、`selection_fallback=true`，不能报告原 pin 或默认已经就绪。旧原生模块缺少诊断接口时明确列限制，不在工具中另造一套选择解析器。

阶段同步由 Agent 读取实际工件、批准、代码／测试／PR／环境证据后判断，再使用可用连接器或 CLI 按权限增删受管标签。工具返回 `evidence_required`，不会提供虚假的完成结论；`task_lookup_complete=false` 时不能宣称已排除全部已有工作。

tasks 根目录或嵌套链接、损坏记录和不可读目录会安全跳过并进入 task_scan_warnings，使查询覆盖不完整。需要读取链接存储时先核实真实位置和授权，再明确指定合适项目范围；不能因返回 tasks=[] 就建议重复创建。

接入 plan 只允许项目合同、AGENTS、全局 workflow 和原生本地变体。先检查全部 before-SHA、路径边界及受管块内容校验再写；手改受管块、链接越界或未知文件拒绝。重跑已应用 plan 不重写，重生成相同 plan 无变化；部分 I/O 失败会报告已写列表，复读后恢复。不会写 hook、内置技能、管理哈希、Git 配置或远端对象。
