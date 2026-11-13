---
name: requirement-precheck
description: 需求预审核规则，评估原始需求文档质量并分类处理
---

# 需求预审核规则

## 审核维度

| 维度 | 说明 | 通过标准 | 不通过示例 |
|------|------|----------|------------|
| **清晰度** | 需求点是否明确、具体 | 每个需求可理解、无歧义 | "系统要好用"、"用户体验要好" |
| **结构化程度** | 需求是否有组织、有条理 | 有分层结构或分类 | 一大段无分段的文字 |
| **完整性** | 需求信息是否完整 | 包含核心要素（角色、功能、场景等） | 只说"要一个登录功能"无其他描述 |

## 问题分类标准

| 问题类型 | 判断条件 | 处理策略 |
|----------|----------|----------|
| **通过** | 综合评分 ≥ 60 | 直接进入类型确认 |
| **结构问题** | 完整性 ≥ 50，但清晰度或结构化 < 60 | 自动派发SubAgent调用 `yg-requirement-extraction` |
| **内容问题** | 完整性 < 50，或存在大量矛盾 | 引导使用 `yg-brainstorming` 收集信息 |

## 评分计算公式

### 基准分
每个维度基准分为 50 分。

### 清晰度评分

```python
def calculate_clarity(requirement_doc):
    score = 50  # 基准分

    # 需求表述
    if has_specific_requirements(requirement_doc):
        score += 20  # 具体、可操作
    elif has_vague_requirements(requirement_doc):
        score -= 10  # 模糊、抽象

    # 量化指标
    if has_quantitative_metrics(requirement_doc):
        score += 15  # 有明确数值

    # 场景描述
    if has_scenario_description(requirement_doc):
        score += 15  # 包含使用场景
    else:
        score -= 5

    # 约束条件
    if has_constraints(requirement_doc):
        score += 10

    return max(0, min(100, score))  # 限制在 0-100
```

### 结构化程度评分

```python
def calculate_structure(requirement_doc):
    score = 50  # 基准分

    # 分层结构
    if has_hierarchy(requirement_doc):
        score += 20
    else:
        score -= 15

    # 编号体系
    if has_numbering(requirement_doc):
        score += 15
    else:
        score -= 5

    # 分类组织
    if has_categorization(requirement_doc):
        score += 15
    else:
        score -= 10

    # 标题层级
    if has_clear_headings(requirement_doc):
        score += 10
    else:
        score -= 5

    return max(0, min(100, score))
```

### 完整性评分

```python
def calculate_completeness(requirement_doc):
    score = 50  # 基准分

    # 用户角色
    if defines_user_roles(requirement_doc):
        score += 15
    else:
        score -= 10

    # 功能需求
    if has_feature_list(requirement_doc):
        score += 20
    else:
        score -= 15

    # 业务场景
    if has_business_scenarios(requirement_doc):
        score += 15
    else:
        score -= 10

    # 数据需求
    if has_data_requirements(requirement_doc):
        score += 10
    else:
        score -= 5

    # 非功能需求
    if has_non_functional_requirements(requirement_doc):
        score += 10

    return max(0, min(100, score))
```

### 综合评分

```python
def calculate_overall_score(scores):
    return (scores["clarity"] + scores["structure"] + scores["completeness"]) / 3
```

## 评分机制

```python
# 预审核评分伪代码
def evaluate_requirements(requirement_doc):
    score = {
        "clarity": calculate_clarity(requirement_doc),
        "structure": calculate_structure(requirement_doc),
        "completeness": calculate_completeness(requirement_doc)
    }

    overall = calculate_overall_score(score)

    return {
        "passed": overall >= 60,
        "problem_type": classify_problem(score),
        "score": score
    }

def classify_problem(score):
    if score["completeness"] < 50:
        return "content_issue"
    elif score["clarity"] < 60 or score["structure"] < 60:
        return "structure_issue"
    else:
        return "passed"
```

## 清晰度评估要点

| 评估项 | 得分因素 |
|--------|----------|
| 需求表述 | 具体、可操作 +20分；模糊、抽象 -10分 |
| 量化指标 | 有明确数值/范围 +15分；仅有定性描述 0分 |
| 场景描述 | 包含使用场景 +15分；无场景 -5分 |
| 约束条件 | 有明确约束 +10分；无约束 0分 |

## 结构化程度评估要点

| 评估项 | 得分因素 |
|--------|----------|
| 分层结构 | 有清晰的章节/模块划分 +20分；无结构 -15分 |
| 编号体系 | 有编号管理 +15分；无编号 -5分 |
| 分类组织 | 按功能/模块分类 +15分；混合堆放 -10分 |
| 标题层级 | 标题层级清晰 +10分；层级混乱 -5分 |

## 完整性评估要点

| 评估项 | 得分因素 |
|--------|----------|
| 用户角色 | 定义了目标用户 +15分；未定义 -10分 |
| 功能需求 | 列出功能清单 +20分；功能不清 -15分 |
| 业务场景 | 描述使用场景 +15分；无场景 -10分 |
| 数据需求 | 提及数据实体 +10分；未提及 -5分 |
| 非功能需求 | 提及性能/安全等 +10分；未提及 0分 |

## 处理流程

```
需求预审核
    │
    ├─ 通过（综合≥60）
    │       → 进入类型确认
    │
    ├─ 结构问题（完整性≥50，但清晰度/结构化<60）
    │       → 自动派发SubAgent调用 yg-requirement-extraction
    │       → 返回整理后的需求文档地址
    │       → 继续后续流程
    │
    └─ 内容问题（完整性<50 或 大量矛盾）
            → 显示问题清单
            → 询问用户处理方式：
               ├─ 开始对话收集信息 → 调用 yg-brainstorming
               └─ 直接继续 → 记录风险提示
```

## 输出格式

### 结构问题输出

```
**审核结果：⚠️ 结构问题**

| 维度 | 评分 | 状态 |
|------|------|------|
| 清晰度 | XX/100 | 需整理 |
| 结构化程度 | XX/100 | 需整理 |
| 完整性 | XX/100 | ✅ 通过 |

需求内容完整，但结构较为杂乱。正在自动整理...
```

### 内容问题输出

```
**审核结果：❌ 内容问题**

| 维度 | 评分 | 问题 |
|------|------|------|
| 清晰度 | XX/100 | [具体问题] |
| 结构化程度 | XX/100 | [具体问题] |
| 完整性 | XX/100 | [具体问题] |

**检测到的具体问题**：
- [问题1]
- [问题2]

请问您想如何处理？
- [ ] 开始对话收集信息（推荐）
- [ ] 直接使用现有需求继续（可能影响文档质量）
```