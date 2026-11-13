# MCP工具仅页面可见：实施记录

唯一代码工作区：`E:/Develop/agent-skills/.worktrees/issue-hub-app-only-20261105`，基线bbf1e07。本代理已按最新用户授权覆盖旧“模型保留三个Issue只读工具”的约定；root负责的版本、说明和分发修改未回退。

## 最小实现

- `packages/token-usage/src/server.mjs`：仅为`token_usage_open`现有ui元数据加入`visibility:['app']`。原resourceUri和global entrypoints保留，open处理函数未变。
- `packages/issue-hub/src/server.mjs`：`issue-repositories`、`issue-read`和`issue-comments`复用已有appMeta，增加相同resourceUri与app-only声明，仍用原registerTool和原handler/参数。其他六工具原已app-only，未改变业务实现。
- 两服务共12工具仍可在raw MCP tools/list发现，按visibility推导的模型工具集合为空；两个global入口仍是Tokens和Issue Hub。不能将原始目录的12个工具称作模型仍可见12个。

## 回归与协议

- 更新Issue `product-server.test.mjs`，断言全部9工具app-only且同URI、模型集合0、global仍1、原目录/read/comments调用仍可通过MCP执行，并保留参数校验和错误路径。
- 新增Tokens `test/server.test.mjs`，使用fake service与InMemoryTransport证明全部3工具app-only、global/资源保留，open/dashboard/sessions调用均成功并正确到达原service。没有读取真实统计或创建聊天。
- 两模块`verify-stdio.mjs`及统一`verify-toolkit.mjs`增加所有工具app-only/URI一致与模型集合0断言；统一输出`modelVisibleTools:0`、`totalGlobalEntries:2`，不删除原缺gh隔离、资源、技能或错误路径检查。

## 精确红反馈与最终检查

在生产修改之前运行新测试：Tokens的open工具visibility为undefined，与`['app']`不符；Issue的`issue-repositories`缺少_meta.ui.visibility，准确失败。修改四项元数据后相同测试转绿。首个Issue红用例曾直接访问缺失_meta而TypeError，随后改为可选链和带工具名断言，重新运行旧源，精确得到issue-repositories undefined对比app；不是靠该TypeError认定完成。

最终定向验证：

| 命令 | 结果 |
| --- | --- |
| Issue `node --test test/product-server.test.mjs` | 2通过，0失败/跳过 |
| Tokens `node --test test/server.test.mjs` | 1通过，0失败/跳过 |
| Issue `npm run check` | 60个JavaScript模块语法通过 |
| Tokens `node --check src/server.mjs`及`node --check scripts/verify-stdio.mjs` | 通过 |
| `git diff --check` | 通过 |

项目无独立lint/TypeScript配置，没有冒称lint或类型检查。源码、测试和协议脚本已冻结。本代理未构建、安装、运行真实宿主/GitHub/统计、操作原生Codex、Git提交或推送；root继续完整套件、最终产物协议与实际安装验证。主会话的tool目录可能按宿主生命周期刷新，本报告不冒称当前已运行聊天的模型目录已经热更新，也不估算上下文节省量。
