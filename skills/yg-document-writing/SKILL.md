---
name: yg-document-writing
description: 编写各类需求文档（BRD/PRD/TRD/SRS）。当用户提及"生成需求文档"、"编写需求文档"、"撰写需求文档"时触发。
---

# 文档编写

## 触发条件

TRIGGER when: 用户提及以下关键词：
- "生成需求文档"
- "编写需求文档"
- "撰写需求文档"
- "输出需求文档"
- "需求文档编写"

## 适用场景

- 编写商业需求文档（BRD）
- 编写产品需求文档（PRD）
- 编写技术需求文档（TRD）
- 编写软件需求规格说明书（SRS）

## 支持文档类型

| 类型 | 全称 | 适用场景 |
|-----|------|---------|
| BRD | Business Requirements Document | 商业层面需求，项目立项 |
| PRD | Product Requirements Document | 产品功能需求，详细设计 |
| TRD | Technical Requirements Document | 技术实现需求 |
| SRS | Software Requirements Specification | 软件需求规格说明 |

## 超出范围处理

当用户请求的文档类型不在上述支持列表中时：

1. **告知用户**：说明当前技能不支持的文档类型
2. **引导创建**：建议用户调用 `/yg-create-document-template` 技能创建新的文档模板
3. **示例话术**：
   > "当前技能暂不支持「XXX」类型的文档。您可以使用 `/yg-create-document-template` 技能创建新的文档模板，或选择以下已支持的类型：BRD、PRD、TRD、SRS。"

## 场景模板

| 模板 | 说明 |
|-----|------|
| Automation | 自动化流程类需求 |
| Permission | 权限管理类需求 |
| Dashboard | 数据仪表盘类需求 |

## 使用方式

```bash
# 交互式选择文档类型
/yg-document-writing

# 直接指定文档类型
/yg-document-writing prd
/yg-document-writing brd
```

## 执行流程

### 流程模式选择

根据需求规模自动选择流程模式：

| 模式 | 触发条件 | 流程步骤 |
|------|----------|----------|
| **完整模式** | 预估文档 > 8000字 | 完整9步流程 |
| **快速模式** | 预估文档 ≤ 8000字 | 简化5步流程 |

**规模判断方法：** 需求字数 × 3 = 预估文档字数

### 完整模式流程

```
1. 需求预审核（新增）
       │
       ├─ 通过 → 2. 类型确认
       │
       ├─ 结构问题 → 自动派发SubAgent
       │              调用 yg-requirement-extraction
       │              返回整理后的文档 → 2. 类型确认
       │
       └─ 内容问题 → 引导用户选择
                      │
                      ├─ 开始对话 → 调用 yg-brainstorming
                      │             → 调用 yg-requirement-extraction
                      │             → 返回整理后的文档 → 2. 类型确认
                      │
                      └─ 直接继续 → 记录风险 → 2. 类型确认

2. 类型确认 → 3. 模板加载 → 4. 信息收集
                                ↓
                         5. 生成大纲（新增）
                           • 章节结构
                           • 术语表
                           • 需求映射表
                                ↓
                          用户确认大纲
                                ↓
               6. 文档生成（SubAgent + 上下文注入）
                           • 注入相关原始需求
                           • 注入术语表
                           • 智能注入前序章节
                                ↓
                    7. 质量检查（审查SubAgent）
                                ↓
                         8. 优化环节
                      （迭代修复，最多3次）
                                ↓
                    9. 交付完整文档地址
```

### 快速模式流程

```
1. 需求预审核 → 通过
       ↓
2. 类型确认
       ↓
3. 直接生成文档（跳过大纲确认）
       ↓
4. 简化质量检查（仅检查格式和需求覆盖）
       ↓
5. 交付文档
```

---

## 需求预审核

在流程开始时评估原始需求文档的质量，根据问题类型采取相应的处理策略。

**参考规则：** `${CLAUDE_SKILL_DIR}/rules/requirement-precheck.md`

### 审核维度

| 维度 | 说明 | 通过标准 |
|------|------|----------|
| **清晰度** | 需求点是否明确、具体 | 每个需求可理解、无歧义 |
| **结构化程度** | 需求是否有组织、有条理 | 有分层结构或分类 |
| **完整性** | 需求信息是否完整 | 包含核心要素（角色、功能、场景等） |

### 问题分类与处理

| 问题类型 | 判断条件 | 处理策略 |
|----------|----------|----------|
| **通过** | 综合评分 ≥ 60 | 直接进入类型确认 |
| **结构问题** | 完整性 ≥ 50，但清晰度或结构化 < 60 | 自动派发SubAgent调用 `yg-requirement-extraction` |
| **内容问题** | 完整性 < 50，或存在大量矛盾 | 引导使用 `yg-brainstorming` 收集信息 |

### 结构问题处理

```
Agent tool (general-purpose):
  description: "整理需求文档结构"
  prompt: |
    请对以下原始需求进行结构化整理。

    ## 原始需求文档
    [原始需求内容]

    ## 整理要求
    1. 提取所有需求点，编号管理
    2. 按功能模块/业务领域分类组织
    3. 消除重复内容
    4. 标注不明确的需求点

    ## 输出
    将整理后的需求保存到：[输出路径]
```

---

## 信息收集

在类型确认和模板加载后，收集编写文档所需的完整信息。

### 收集来源

| 来源 | 说明 |
|------|------|
| 项目上下文 | 读取 `.yg-pm/projects/{project-id}/` 下的已有文档 |
| 用户输入 | 通过 AskUserQuestion 收集缺失信息 |
| 原始需求 | 用户提供的原始需求文档 |

### 收集内容

| 信息类型 | 必要性 | 来源 |
|----------|--------|------|
| 项目背景 | 必须 | 项目上下文/用户输入 |
| 目标用户 | 必须 | 原始需求/用户输入 |
| 功能清单 | 必须 | 原始需求 |
| 数据需求 | 可选 | 原始需求/用户输入 |
| 非功能需求 | 可选 | 原始需求/用户输入 |

### 执行流程

```
1. 读取项目上下文
   ↓
2. 解析原始需求文档
   ↓
3. 识别缺失信息
   ↓
4. 如有缺失 → 使用 AskUserQuestion 收集
   ↓
5. 整合所有信息，准备生成大纲
```

### 信息完整性检查

在信息收集完成后，确认以下内容已齐全：

- [ ] 项目名称和背景
- [ ] 目标用户定义
- [ ] 核心功能列表
- [ ] 业务场景描述

---

## 生成大纲

生成文档大纲，包含章节结构、术语表和需求映射表，供用户确认。

**大纲文件路径：**
```
.yg-pm/projects/{project-id}/drafts/outline-{timestamp}.md
```

**输出格式：**

```markdown
# 文档大纲

## 章节结构

1. 概述
   1.1 项目背景
   1.2 项目目标
2. 功能需求
   2.1 功能模块A
   2.2 功能模块B
...

## 术语表

| 术语 | 定义 |
|------|------|
| 用户 | 系统的最终使用者 |
...

## 需求映射表

| 章节 | 关联需求ID | 需求摘要 |
|------|------------|----------|
| 2.1 功能模块A | REQ-001, REQ-002 | 用户登录、权限验证 |
...
```

**确认机制：** 使用 AskUserQuestion 工具让用户确认大纲，支持修改建议。

**大纲与文档合并机制：**

大纲确认后，按以下流程合并为最终文档：

```
1. 大纲作为文档头部（目录部分）
2. 章节内容按顺序追加到大纲后面
3. 最终文档保存到用户指定路径
```

**合并后的文档结构示例：**

```markdown
# [文档标题]

## 目录
1. 产品概述
   1.1 项目背景
   1.2 产品定位
2. 功能需求
   2.1 功能模块A
   ...

---

## 1. 产品概述

### 1.1 项目背景
[章节内容...]

### 1.2 产品定位
[章节内容...]

## 2. 功能需求

### 2.1 功能模块A
[章节内容...]
```

**参考规则：**
- `${CLAUDE_SKILL_DIR}/rules/requirement-mapping.md`
- `${CLAUDE_SKILL_DIR}/rules/terminology-enforcement.md`

---

## 文档生成

采用 SubAgent + 上下文注入模式生成章节。

**参考规则：** `${CLAUDE_SKILL_DIR}/rules/context-injection.md`

### SubAgent 派发

```
Agent tool (general-purpose):
  description: "编写章节 [章节名称]"
  subagent_type: general-purpose
  prompt: |
    参考 ${CLAUDE_SKILL_DIR}/agents/chapter-writer.md 中的定义
    提供章节信息、大纲、术语表、相关需求
```

### 上下文注入

| 注入项 | 必要性 | 说明 |
|--------|--------|------|
| 大纲 | 必须 | 完整大纲，帮助SubAgent了解全局结构 |
| 术语表 | 必须 | 强制使用统一定义的术语 |
| 相关原始需求 | 必须 | 根据需求映射表注入相关需求片段 |
| 前序章节 | 智能注入 | 根据耦合度决定注入量 |

### 数据库设计章节

检测到数据建模相关内容时，调用 `database-schema-designer` 技能。

### 章节任务管理

使用 TodoWrite 工具管理章节生成进度。

**创建章节任务清单：**

大纲确认后，根据大纲章节创建任务：

```json
{
  "todos": [
    {"activeForm": "编写产品概述章节", "content": "编写 1. 产品概述", "status": "pending"},
    {"activeForm": "编写功能需求章节", "content": "编写 2. 功能需求", "status": "pending"},
    {"activeForm": "编写数据需求章节", "content": "编写 3. 数据需求", "status": "pending"},
    {"activeForm": "编写非功能需求章节", "content": "编写 4. 非功能需求", "status": "pending"}
  ]
}
```

**章节执行与状态更新：**

| 阶段 | 操作 |
|------|------|
| 开始编写章节 | 更新状态为 `in_progress` |
| SubAgent 完成返回 | 更新状态为 `completed` |
| 所有章节完成 | 进入质量检查阶段 |

**执行流程：**

```
1. 创建章节任务清单（全部 pending）
2. 派发 SubAgent 编写第一章
   - 更新第一章状态为 in_progress
3. SubAgent 返回完成
   - 更新第一章状态为 completed
4. 派发 SubAgent 编写第二章
   ...
5. 所有章节 completed → 进入质量检查
```

---

## 质量检查

派发审查SubAgent进行全面的文档质量检查。

**参考规则：** `${CLAUDE_SKILL_DIR}/rules/problem-classification.md`

**SubAgent 派发：**

```
Agent tool (general-purpose):
  description: "文档质量审查"
  subagent_type: general-purpose
  prompt: |
    参考 ${CLAUDE_SKILL_DIR}/agents/quality-reviewer.md 中的定义
    提供文档路径、原始需求路径、模板路径
```

### 检查维度

| 检查项 | 说明 | 检查方法 |
|--------|------|----------|
| 格式规范 | 编号、格式、模板合规性 | 对比模板结构 |
| 需求覆盖 | 与原始需求文档逐一比对 | 需求项清单核对 |
| 边界检查 | 是否过度设计或超出边界 | 对比原始需求范围 |
| 内部一致性 | 章节间矛盾、引用正确性 | 全文扫描分析 |

---

## 优化环节

根据审查结果进行迭代修复。

### 问题分级与处理

| 级别 | 定义 | 处理方式 |
|------|------|----------|
| **轻微** | 格式问题，不影响内容理解 | 自动修复 |
| **一般** | 内容问题，但不阻断交付 | 自动修复 |
| **严重** | 结构性或逻辑问题 | 用户确认后修复 |

### 迭代策略

```
质量检查 → 问题分级
              │
              ├─ 全部轻微/一般 → 自动修复 → 重新检查
              │                         │
              │                         ├─ 通过 → 交付
              │                         └─ 未通过（迭代<3次）→ 继续修复
              │
              └─ 存在严重问题 → 上报用户 → 用户确认后修复 → 重新检查
```

### 迭代限制

- 最多 3 次迭代
- 超过限制后上报用户，由用户决定后续处理

---

## 交互式提问规范

**涉及用户交互时必须使用 AskUserQuestion 工具**，遵循以下原则：

| 原则 | 说明 |
|-----|------|
| **一次一问** | 每次只提出一个问题，等待用户回答后再继续 |
| **提供选项** | 为每个问题提供 2-4 个预设选项 |
| **保留自定义** | 依靠"其他"选项让用户自由表达 |
| **单选为主** | 大多数情况使用单选（multiSelect: false） |

### 文档类型确认示例

```json
{
  "questions": [{
    "question": "您需要编写哪种类型的需求文档？",
    "header": "文档类型",
    "multiSelect": false,
    "options": [
      { "label": "PRD（推荐）", "description": "产品需求文档，详细描述产品功能与用户体验" },
      { "label": "BRD", "description": "商业需求文档，阐述商业价值与业务目标" },
      { "label": "TRD", "description": "技术需求文档，描述技术实现方案" },
      { "label": "SRS", "description": "软件需求规格说明书，完整的功能与非功能需求" }
    ]
  }]
}
```

### 场景模板选择示例

```json
{
  "questions": [{
    "question": "检测到您的需求涉及自动化流程，是否使用场景模板？",
    "header": "场景模板",
    "multiSelect": false,
    "options": [
      { "label": "使用自动化模板", "description": "自动填充流程触发条件、执行动作等章节" },
      { "label": "使用通用模板", "description": "使用标准 PRD 模板，不预填内容" },
      { "label": "跳过模板", "description": "完全自定义文档结构" }
    ]
  }]
}
```

---

## 渐进式披露结构

```
yg-document-writing/
├── SKILL.md                    # 主文件
├── agents/                     # SubAgent 定义
│   ├── chapter-writer.md       # 章节编写SubAgent
│   └── quality-reviewer.md     # 质量审查SubAgent
├── rules/                      # 规则文件
│   ├── requirement-precheck.md # 需求预审核规则
│   ├── context-injection.md    # 上下文注入规则
│   ├── requirement-mapping.md  # 需求映射规则
│   ├── problem-classification.md # 问题分级标准
│   └── terminology-enforcement.md # 术语强制规则
└── references/                 # 模板参考文件
    ├── brd-template.md         # BRD模板
    ├── prd-template.md         # PRD模板
    ├── trd-template.md         # TRD模板
    ├── srs-template.md         # SRS模板
    ├── automation-template.md  # 自动化场景模板
    ├── permission-matrix-template.md  # 权限矩阵模板
    └── view-dashboard-template.md    # 视图仪表盘模板
```

## 参考文件

所有模板文件位于技能目录下的 `references/` 文件夹：

| 文件 | 说明 |
|------|------|
| `references/brd-template.md` | BRD 商业需求文档模板 |
| `references/prd-template.md` | PRD 产品需求文档模板 |
| `references/trd-template.md` | TRD 技术需求文档模板 |
| `references/srs-template.md` | SRS 软件需求规格说明模板 |
| `references/er-diagram-guide.md` | ER图设计规范指南 |
| `references/diagram-types-guide.md` | 需求文档图表类型指南 |
| `references/automation-template.md` | 自动化场景设计模板 |
| `references/permission-matrix-template.md` | 权限矩阵设计模板 |
| `references/view-dashboard-template.md` | 视图与仪表盘设计模板 |
| `references/forguncy-project.md` | 活字格类型项目必须先阅读此文档 |

## 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| 原始需求无法读取 | 提示用户重新提供文件路径或内容 |
| SubAgent 执行超时 | 重试1次，失败后上报用户决定 |
| 质量检查3次迭代未通过 | 上报用户，提供问题清单供用户决定后续处理 |
| 大纲用户拒绝确认 | 根据用户反馈修改大纲后重新确认 |
| 文档类型不支持 | 建议用户使用 `/yg-create-document-template` 创建模板 |

## 技能协作

### 前置技能

| 技能 | 协作场景 |
|------|----------|
| `yg-brainstorming` | 需求预审核-内容问题 时调用，收集完整需求信息 |
| `yg-requirement-extraction` | 需求预审核-结构问题 时调用，自动整理需求结构 |

### 后续技能

| 技能 | 协作场景 |
|------|----------|
| `yg-requirement-reviewer` | 文档编写完成后进行深度审查与仿真验证 |
| `yg-visualize` | 将文档转换为可视化原型 |
| `database-schema-designer` | 数据建模章节时自动调用 |

## 下一步建议

文档编写完成后，系统已自动完成质量审查。后续可选：
- `/yg-requirement-reviewer` - 进行深度需求审查与仿真验证
- `/yg-visualize` - 可视化文档生成原型