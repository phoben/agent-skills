# Issue 技能恢复与合并记录

日期：2026-11-18，东八区。

## 原稿位置与缺失原因

原稿写在分支 `codex/issue-management-toolkit`，基于 `fc76c60`，工作区为 `D:/Develop/orca/workspaces/agent-skills/issue-management-toolkit`。

2026-11-17 的会话记录明确说明：项目实现合入业务仓库 `develop` 后，插件改动仍在独立工作区，尚未提交、未合入 agent-skills 的 `main`，也没有更新安装缓存。当前原分支和工作区均已不存在；现存 refs、reflog 及不可达提交没有包含新版技能的提交，不能直接对原分支执行 merge。

本次从原始工具调用中恢复文件，未执行历史 shell 脚本。主要依据为会话 `01a1e9d8-7dfc-7251-9114-97dc17b8846a` 的写入补丁和 Python 字面量，以及 `01a1e9d8-b617-70f0-b7eb-12de4aac56d0` 的 Issue Hub 配套补丁。按原执行顺序恢复，排除业务仓库文件和本轮临时脚本。

恢复分支为 `codex/issue-skills-recovery`，从当前 `main` 的 `3194f37` 创建。合并目标为本地 `main`，不推送、不安装或改写插件缓存。

## 恢复范围

- 新增 [issue-init](../../plugins/yg-toolkit/skills/issue-init/SKILL.md)：调研项目和必要问答、设计并接入 Issue 管理规则、配合实际工作流。
- 恢复新版 [issue-triage](../../plugins/yg-toolkit/skills/issue-triage/SKILL.md)：编号／链接前置查证、关联活跃及归档 Task、按证据及授权同步阶段、推荐实时 workflow、保护当前活动任务。
- 恢复共享本地工具及参考资料：不创建 Task 或调用 GitHub 写接口；复用目标原生解析器，只读首个真实 H1 导语与首个 H2 章节；不固定候选名单或 Type→ID 表；无 Trellis 时发现已有项目入口。
- 退役旧 `issue-extract` 独立入口，其来源、取证和定向核验方法并入参考资料，保持两个管理入口。不卸载用户现有缓存或删除业务资料。
- 恢复 Issue Hub 交接提示：先前置与推荐，用户批准后再交给真实项目流程，不直接跳到实施；保留原会话身份和 nonce 规则。
- 同步 README、两入口打包检查和 Issue Hub 构建产物。

## 恢复后的修正

独立审查发现并复现两处原稿问题，已补充行为回归：H1 前的导航 H2 不再抢占摘要；校验合并后的合同，拒绝静默保留旧静态路由，其他未知字段继续保留。接入规范同步说明旧字段迁移需先展示并批准差异。

随后在真实项目只读集成检查中发现 Windows CRLF 会让未变化的受管块产生重复初始化差异。现对内容和哈希均一致的受管块保留原字节，增加 CRLF 重跑测试；不通过改写项目文件消除差异。

## 本轮验证

| 检查 | 结果 |
|---|---|
| 辅助工具行为测试 | 38/38，通过真实原生解析器、动态候选、来源、任务保护、无 Trellis、幂等、并发预检及新增回归 |
| Issue Hub 回归 | 328/328 |
| Tokens 回归 | 36/36 |
| 技能格式和界面元数据 | 9 个全部通过；目录／标识一致、英文显示名、中文说明、默认提示词和唯一性有效 |
| JavaScript 语法 | Issue Hub 60 模块通过；辅助工具由 Node 实际加载测试 |
| 统一构建 | Tokens 和 Issue Hub 同一 YG 版本构建通过 |
| 双 stdio 与包外验证 | 通过；两服务共 12 工具、模型可见工具为 0、2 个页面入口、两个 Issue 管理技能完整，Issue 依赖故障隔离有效 |
| 目标项目原生集成 | 使用 clue 当前规则与恢复工具，5/5、0 跳过，62 次原生进程；重复初始化计划为空，96 个保护文件匹配已审核基线 |
| 独立复核 | 两项审查发现修复后通过；新增行为回归通过 |
| 项目绑定及引用检查 | 两个技能未发现项目名、技术栈或本机工程路径绑定；参考链接全部可达 |

单元测试共 402 项；目标项目集成另计 5 项。首次恢复回归因旧入口空目录残留失败，清理确认无文件的空目录后通过。首次目标项目集成因 CRLF 重复差异失败，保留日志并修复工具后通过。

原始补丁、文件 SHA、恢复顺序及验证日志保存在本机忽略目录 `.tmp/issue-skill-recovery-20261118/` 和恢复工作区 `.tmp/issue-skill-recovery-tests/`。未将私人会话原文或真实业务内容复制进分发包。

本轮没有执行真实 GitHub 写入、打开业务会话、安装插件、推送或部署。没有重新做模型冷启动或桌面验收，不用原生 hook 和单元测试代替这些结论。插件发布版本仍由既有发布流程管理，本地源码合并不代表当前会话已加载新版技能。

## 复验入口

```powershell
node --test plugins/yg-toolkit/skills/issue-triage/scripts/issue-tools.test.mjs
npm --prefix packages/issue-hub test
npm --prefix packages/token-usage test
npm --prefix packages/issue-hub run check
npm --prefix packages/token-usage run build
npm --prefix packages/issue-hub run verify:stdio
npm --prefix packages/token-usage run verify:stdio
npm --prefix packages/issue-hub run verify:toolkit
git diff --check
```

原生解析用例需本机实际安装的 Trellis，或通过 `TRELLIS_TEST_COMMON` 指定已核实的原生 common 目录；缺少时明确跳过，不模拟通过。目标项目集成使用本次已审核源 workflow 和保护基线，仅在临时夹具内写 Task／runtime；读取真实项目不执行初始化写入。
