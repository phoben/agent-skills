---
name: project-upstream-sync
description: "检查或选择性同步原作者框架更新到本项目，并按 Trellis 规则处理上游 Harness 文件；用于框架更新检查、分析和实施，不用于普通 git pull。"
---

# 子项目上游框架同步

这是本项目同步原作者框架的唯一项目级入口。保留本项目业务、标识符、配置与 Harness 定制；检查更新不等于授权写文件，选择同步也不等于授权提交或推送。

1. 读取 [发现与基线](references/discovery.md)，确认工作区、`.framework-sync.json`、实际远端名称、分支和候选范围。完成标准：候选范围可追溯，且没有覆盖并发改动的风险。
2. 读取 [提交分析](references/analysis.md)，逐提交、逐文件判断适用性。若涉及任何 AI/Harness 路径，同时读取 [Harness 分流](references/harness.md) 和项目 [框架同步 Harness 规范](../../../.trellis/spec/config/framework-upstream-sync-guidelines.md)。完成标准：每个候选都有合并、跳过、提炼规范或待决结论。
3. 向用户展示候选、影响、验证与风险。上游 `.agents` 中的 Hook、Agent、Command 及 `AGENTS.md` 必须单独形成 Harness 决策报告，由用户决定下一步；通常是“吸纳到项目 Harness”或“忽略”，也可采用用户另行指定的方案。选择整个提交或变更组不能代替这项决策。只有相关待决策略全部明确后，才读取 [内容融合](references/merge.md) 并修改文件。
4. 读取 [验证与记录](references/verify.md)，按受影响层验证并记录实际结果。更新同步基线、提交、推送、部署和归档分别遵守各自授权边界。

## 硬门禁

- 上游任何承担“框架同步、上游同步、模板同步”职责的 Skill、Command、Hook 或 Agent 都是冲突能力：记录为跳过，不引入、不改名移植，也不覆盖本技能。
- `.claude/`、`.agents/`、`.codex/`、`.trellis/`、`AGENTS.md` 和其他平台 Harness 是已定制区域，不能目录镜像或整套覆盖。上游 `.agents` 中的 Hook、Agent、Command 及 `AGENTS.md` 在用户看过分析报告并明确选择前不得写入；吸纳时融入现有 Harness 架构，不直接同步覆盖。
- 规范型上游内容先核对本项目事实，再经 `trellis-update-spec` 合并到已有 Spec；工具型能力只有在证明兼容、无重复且可验证后才可选择性引入 Skill。
- 不用 `git merge`、`cherry-pick`、`reset`、`checkout <file>`、`stash` 或整文件覆盖绕过内容融合。
