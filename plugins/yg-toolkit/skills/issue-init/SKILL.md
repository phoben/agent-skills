---
name: issue-init
description: 检测项目 Issue 管理与工作流环境，通过调研和必要问答设计规则，按授权补齐依赖及接入，复检并验收；支持空白项目、现有流程和可选 Trellis，不处理具体 Issue 的实施。
---

# Issue 项目接入

帮助用户从当前环境走到已选择方案的完整接入状态。按“检测现状 → 确认方案 → 补齐环境和规则 → 复检 → 行为验收”推进。本技能拥有 Issue 规则和项目接入入口。配置 Trellis 的工作交给 [trellis-setup](../trellis-setup/SKILL.md)，收到具体 Issue 时交给 [issue-triage](../issue-triage/SKILL.md)。

## 执行流程

1. 确认目标项目并只读诊断。默认不联网、不安装、不改文件。检查环境、仓库、权限、现有 Issue 规则和研发流程，按 [检测与环境补齐](references/environment-readiness.md) 报告缺项。
2. 调研后用业务场景确认必要决定。GitHub 配置按 [三档规模、语言和旧对象处理](references/github-configuration.md) 提问。已有 Trellis 时按 [流程发现规则](../trellis-setup/references/workflow-design.md) 查找真实流程，配置工作交给 trellis-setup。
3. 按 [接入详细流程](references/initialization-workflow.md) 设计合同、入口和完整实施清单。提问结束后集中展示方案，请用户确认。改名、删除及远端写入须明确列入获批清单。
4. 按批准范围补齐环境并应用方案。批准本地接入不自动批准远端写入、建任务、提交、推送或部署。先复读对象，部分失败时保留已完成项并恢复缺项。
5. 按 [接入详细流程](references/initialization-workflow.md) 和 [完成标准](references/environment-readiness.md) 回读配置、复检并验收。真实冷启动单独验证。仅在必要环境、远端配置和约定行为均已核实后报告完整接入。

编号或链接始终先交给 issue-triage 前置处理，已有任务按来源找回，活动任务不被异源事项抢切。前置处理和规划不自动批准实施。
