---
name: issue-manager
description: |
  当需要处理、挑选、评估(Triage)或管理 GitHub Issues 时自动使用此 Skill。负责从 GitHub 拉取 Issue、进行智能分类（Bug/需求/提问等）、尝试复现 Bug、拟定回复与标签，并在得到开发者确认后执行状态变更，最后引导进入开发闭环。

  触发场景：
  - 用户输入 `/issues`
  - 用户说"看看有什么 issue"、"挑几个 issue 处理"、"处理一下 bug"
  - 指定特定 issue 时："处理 issue #123"、"评估一下 issue 123"

  触发词：/issues、处理 issue、挑选 issue、管理 issue、bug 分配、看看有什么 issue、评估 issue、triage
---

# issue-manager 技能指南

## 概述
本技能是团队 Issues 处理工程化流程的“入口”与“分类枢纽(Triage)”。它依托 `gh` CLI 与 GitHub 交互，能够智能获取 Issue、评估分类（Bug/Feature/Question/Duplicate/Invalid）、检查缺失信息、动态尝试自我复现 Bug，并拟定回复。所有向 GitHub 写入的操作（评论、打标签、关闭、认领）在执行前都**必须经由开发者确认**，确认后方可执行，并引导进入后续开发流程。

## 前置检查 (必须)
执行任何操作前，请先确保 `gh` 命令可用：
```bash
gh auth status
```
若未登录，请提示用户运行 `gh auth login` 进行授权。

## 参数解析
本技能允许用户在触发时携带参数：
- **无参数** (如 `/issues`): 走**自动挑选与评估模式**（拉取最新未分配的开放 Issues）。
- **带编号** (如 `/issues 123`): 走**定向评估模式**，直接获取并处理指定的 Issue。
- **带 URL**: 解析出 Issue 编号，同上。

---

## 核心工作流 (六步法)

### 第一步：获取与阅读 Issue
- **自动模式**：按创建时间从旧到新拉取最新的开放 Issues（默认限制 30 条）：
  ```bash
  gh issue list --state open --sort created --direction asc --json number,title,body,labels,assignees --limit 30
  ```
  忽略已被分配（`assignees` 非空）或已带有 `status: in-progress` 标签的 Issue。挑选 1~3 个强相关的 Issue 作为本次处理批次。
- **定向模式**：直接获取指定 Issue 的详细信息：
  ```bash
  gh issue view <ID> --json number,title,body,labels,state,assignees,comments
  ```

### 第二步：评估与分类 (Triage)
根据 Issue 的标题、描述和现有标签，将其智能判定为以下五类之一：
1. **Bug**：代码缺陷或运行异常。
2. **Feature**：新功能需求或优化建议（包含 `feat`, `suggestion`）。
3. **Question**：常规提问或使用疑惑。
4. **Duplicate**：与已有 Issue 重复（可使用 `gh issue list --search "关键字" --state all` 进行查重）。
5. **Invalid**：无效信息或不可操作的反馈。

### 第三步：差异化处理与自我复现
根据分类结果，Agent 需在控制台输出分析意见：
- **Question / Duplicate / Invalid**：无需复现，直接拟定解答、指出重复项链接或解释无效原因。
- **Feature**：评估其在本项目架构下的可行性和影响范围，拟定初步设计意见。
- **Bug**：
  1. **信息检查**：检查是否包含复现步骤、系统环境、报错日志等。如严重缺失，拟定要求补充信息的回复，并准备打 `needs info` 标签。
  2. **自我复现 (智能动态选择)**：若信息基本完整，Agent 需尝试复现或定位 Bug。
     - **轻量排查**：通过静态代码分析（Grep、Read）排查报错位置。
     - **单测验证**：对于工具类或后端逻辑，可编写临时单元测试运行验证。
     - **真实复现**：必要时提示开发者启动本地服务，或建议激活 `e2e-test-pc`/`e2e-test-mobile` 技能进行端到端验证。
     - *注意：将复现或排查的结果记录下来，作为回复内容的一部分。*

### 第四步：方案展示与开发者确认 (🚨 核心安全机制)
在完成分析后，**Agent 必须停止并向开发者展示拟定的操作清单，等待开发者输入确认指令（如“同意”、“执行”）后，才能继续下一步。**
展示内容需包括：
- **分类结果**：识别为哪种类型的 Issue。
- **拟打标签**：准备添加的标签（如 `bug`, `question`, `needs info`）。
- **拟定回复**：准备发表的评论正文。
- **后续动作**：准备“关闭 Issue”还是“认领并保留开放”。

### 第五步：状态变更与互动 (确认后执行)
在开发者明确回复同意后，Agent 执行对应的 `gh` 命令：
- **回复评论**：`gh issue comment <ID> --body "拟定的回复内容"`
- **标签管理**：`gh issue edit <ID> --add-label "标签名"`（如有需要移除的旧标签使用 `--remove-label`）
- **关闭非开发项**：针对 `Question`、`Invalid`、`Duplicate` 类，执行关闭操作并结束流程：
  ```bash
  gh issue close <ID> --reason "not planned" # 或 "completed"
  ```

### 第六步：认领、存档与下游引导 (仅限 Bug / Feature)
对于确认需要进行代码开发的 Issue（且未被关闭的）：
1. **锁定认领**：分配给自己防止冲突：
   ```bash
   gh issue edit <ID> --add-assignee @me
   ```
2. **本地存档**：将 Issue 的详细内容保存到本地文件，防遗忘：
   - 确保存档目录存在：`docs/issues`
   - 保存路径：`docs/issues/issue-<ID>.md`
3. **动态输出下游引导指引**：
   根据当前项目可用的技能和规范，灵活引导进入开发阶段。向用户输出类似如下的建议：
   ```markdown
   ✅ **Issues 认领与处理成功**：已为您锁定 #<ID>，并在 `docs/issues/` 下完成存档。
   
   💡 **下一步建议 (标准开发流程)**：
   1. **需求澄清与设计**：若项目配置了相关的方案讨论或头脑风暴技能，建议激活以完成设计；否则直接进入常规的技术方案分析。
   2. **任务拆解**：若项目有计划规划或任务追踪类技能，建议使用其生成任务台账并关联 Issue #<ID>；若无，请手动列出 TODO 列表。
   3. **分支开发**：请按照团队规范创建对应的功能分支开始编码。
   4. **闭环交付**：开发完成后提交 PR，并在提交信息或 PR 描述中附加 `Resolves #<ID>` 以实现自动关闭 Issue。
   ```

---

## 与体系衔接 / 关联流程边界

本技能作为流程入口，在向下游推进时遵循“动态适配”原则：

| 阶段 | 边界说明 |
|---------|------|
| **方案设计** | 下游：根据认领的 Bug/Feature 展开方案讨论。若项目存在专门的方案设计技能则引导使用，否则进行常规分析。 |
| **任务规划** | 下游：生成任务拆解台账，**必须带上关联 Issue ID**。若有专门的任务规划技能则引导使用，否则通过 TODO 列表管理。 |

**全局约束**：
1. 本技能作为入口枢纽，**绝不**在此阶段直接生成业务代码或修改代码库，严守流程层级。
2. **绝对禁止**在未获得开发者确认的情况下，自动执行 `gh issue comment`、`edit` 或 `close` 命令。
