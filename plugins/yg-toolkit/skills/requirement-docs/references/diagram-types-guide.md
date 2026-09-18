# 需求文档图表类型指南

本文档定义需求文档中各类图表的使用规范，确保文档表达清晰、专业。

## 图表类型总览

| 图表类型 | Mermaid语法 | 适用场景 | 主要用途 |
|---------|------------|---------|---------|
| 流程图 | `flowchart` / `graph` | 业务流程、功能流程、操作步骤 | 展示流程走向和决策分支 |
| 架构图 | `flowchart` / 自定义 | 系统架构、功能架构、技术架构 | 展示系统组成和层次关系 |
| 时序图 | `sequenceDiagram` | 接口调用、系统交互、操作序列 | 展示对象间的时序交互 |
| 状态图 | `stateDiagram-v2` | 状态流转、生命周期 | 展示对象状态变化 |
| ER图 | `erDiagram` | 数据模型、数据库设计 | 展示实体关系 |
| 甘特图 | `gantt` | 项目计划、时间线 | 展示任务时间安排 |
| 思维导图 | `mindmap` | 信息架构、需求分解 | 展示层次结构 |
| 网络拓扑 | `flowchart` | 部署架构、网络结构 | 展示网络节点连接 |

---

## 1. 流程图（Flowchart）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 3.1 功能流程 | 推荐 |
| PRD | 5.1 交互流程 | 必须 |
| TRD | 9.2 部署流程 | 推荐 |
| SRS | 3.2 业务流程 | 必须 |
| SRS | 4.2 功能流程 | 必须 |

### Mermaid语法

```mermaid
flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[执行操作A]
    B -->|否| D[执行操作B]
    C --> E[处理结果]
    D --> E
    E --> F[结束]
```

### 节点类型

| 语法 | 形状 | 用途 |
|------|------|------|
| `A[文本]` | 矩形 | 普通步骤 |
| `A{文本}` | 菱形 | 判断/决策 |
| `A([文本])` | 圆角矩形 | 开始/结束 |
| `A((文本))` | 圆形 | 连接点 |
| `A[[文本]]` | 子程序 | 子流程 |
| `A[(文本)]` | 圆柱 | 数据库 |
| `A>文本]` | 旗帜 | 事件 |

### 流程线类型

| 语法 | 含义 |
|------|------|
| `-->` | 实线箭头 |
| `---` | 实线无箭头 |
| `-.->` | 虚线箭头 |
| `==>` | 粗线箭头 |
| `--文本-->` | 带标签的线 |

### 最佳实践

```mermaid
flowchart TD
    subgraph 用户操作
        A([用户登录]) --> B{验证成功?}
    end

    subgraph 系统处理
        B -->|是| C[加载用户信息]
        B -->|否| D[返回错误提示]
        C --> E[跳转首页]
    end

    subgraph 异常处理
        D --> F[记录登录日志]
        F --> G[允许重试]
    end

    E --> H([流程结束])
    G --> A
```

---

## 2. 架构图（Architecture Diagram）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 4.2 功能架构 | 必须 |
| TRD | 2.1 整体架构 | 必须 |
| TRD | 2.3 服务划分 | 推荐 |

### Mermaid语法示例

```mermaid
flowchart TB
    subgraph 客户端层
        A1[Web端]
        A2[移动端]
        A3[小程序]
    end

    subgraph 网关层
        B1[API网关]
        B2[负载均衡]
    end

    subgraph 应用层
        C1[用户服务]
        C2[订单服务]
        C3[商品服务]
    end

    subgraph 数据层
        D1[(MySQL)]
        D2[(Redis)]
        D3[(MongoDB)]
    end

    A1 & A2 & A3 --> B1
    B1 --> B2
    B2 --> C1 & C2 & C3
    C1 & C2 & C3 --> D1 & D2 & D3
```

### 架构图层次

```
┌─────────────────────────────────────────────┐
│                  展示层                      │
├─────────────────────────────────────────────┤
│                  网关层                      │
├─────────────────────────────────────────────┤
│                  服务层                      │
├─────────────────────────────────────────────┤
│                  数据层                      │
└─────────────────────────────────────────────┘
```

### 功能架构示例

```mermaid
flowchart LR
    subgraph 用户中心
        A1[用户注册]
        A2[用户登录]
        A3[个人信息]
    end

    subgraph 订单中心
        B1[订单创建]
        B2[订单查询]
        B3[订单管理]
    end

    subgraph 商品中心
        C1[商品展示]
        C2[商品搜索]
        C3[库存管理]
    end

    A2 --> B1
    B1 --> C3
```

---

## 3. 时序图（Sequence Diagram）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 5.1 交互流程 | 推荐 |
| TRD | 3.2 核心接口 | 推荐 |
| SRS | 8.2 内部接口 | 推荐 |

### Mermaid语法

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant C as 客户端
    participant S as 服务端
    participant D as 数据库

    U->>C: 发起登录请求
    C->>S: POST /api/login
    S->>D: 查询用户信息
    D-->>S: 返回用户数据
    S->>S: 验证密码
    alt 验证成功
        S->>S: 生成Token
        S-->>C: 返回Token
        C-->>U: 登录成功
    else 验证失败
        S-->>C: 返回错误信息
        C-->>U: 显示错误提示
    end
```

### 语法说明

| 语法 | 含义 |
|------|------|
| `->>` | 实线箭头（请求） |
| `-->>` | 虚线箭头（响应） |
| `--)` | 异步消息 |
| `--x` | 失败返回 |
| `loop` | 循环 |
| `alt/else` | 条件分支 |
| `opt` | 可选操作 |
| `par` | 并行操作 |

### 复杂时序图示例

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户
    participant App as 应用
    participant Auth as 认证服务
    participant Order as 订单服务
    participant Pay as 支付服务

    User->>App: 选择商品下单
    App->>Auth: 验证用户Token
    Auth-->>App: Token有效

    par 并行处理
        App->>Order: 创建订单
        App->>Pay: 生成支付单
    end

    Order-->>App: 订单创建成功
    Pay-->>App: 支付单创建成功

    App-->>User: 显示支付页面

    User->>App: 完成支付
    App->>Pay: 支付回调
    Pay->>Order: 更新订单状态
    Order-->>Pay: 更新成功
    Pay-->>App: 支付成功通知
    App-->>User: 显示支付成功
```

---

## 4. 状态图（State Diagram）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 5.2 状态转换 | 必须 |
| TRD | 业务对象状态 | 推荐 |
| SRS | 功能状态流转 | 推荐 |

### Mermaid语法

```mermaid
stateDiagram-v2
    [*] --> 待支付: 创建订单

    待支付 --> 已支付: 支付成功
    待支付 --> 已取消: 超时/用户取消

    已支付 --> 已发货: 商家发货
    已支付 --> 已退款: 申请退款

    已发货 --> 已完成: 确认收货
    已发货 --> 已退款: 退货退款

    已完成 --> 已评价: 用户评价
    已评价 --> [*]

    已取消 --> [*]
    已退款 --> [*]
```

### 状态图语法

| 语法 | 含义 |
|------|------|
| `[*]` | 初始/终止状态 |
| `-->` | 状态转换 |
| `: 文本` | 转换条件 |

### 复合状态示例

```mermaid
stateDiagram-v2
    state "订单处理中" as Processing {
        state "支付处理" as Payment
        state "库存检查" as Stock
        state "订单确认" as Confirm

        [*] --> Payment
        Payment --> Stock: 支付成功
        Stock --> Confirm: 库存充足
        Confirm --> [*]
    }

    [*] --> Processing
    Processing --> 已发货
    已发货 --> 已完成
    已完成 --> [*]
```

---

## 5. ER图（Entity-Relationship Diagram）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 6.2 数据ER图 | 必须 |
| TRD | 4.4 数据ER图 | 必须 |
| SRS | 5.4 数据ER图 | 必须 |

详细规范请参考 [er-diagram-guide.md](./er-diagram-guide.md)。

### 快速示例

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        bigint id PK "用户ID"
        varchar username "用户名"
        varchar email UK "邮箱"
    }

    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        bigint id PK "订单ID"
        bigint user_id FK "用户ID"
        varchar order_no UK "订单号"
        decimal total_amount "总金额"
    }

    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    PRODUCT {
        bigint id PK "商品ID"
        varchar name "商品名称"
        decimal price "单价"
    }

    ORDER_ITEM {
        bigint id PK "明细ID"
        bigint order_id FK "订单ID"
        bigint product_id FK "商品ID"
        int quantity "数量"
    }
```

---

## 6. 甘特图（Gantt Chart）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 10.1 版本规划 | 推荐 |
| SRS | 11.1 时间约束 | 推荐 |
| SRS | 13.1 实施计划 | 必须 |

### Mermaid语法

```mermaid
gantt
    title 项目开发计划
    dateFormat YYYY-MM-DD

    section 准备阶段
    需求确认           :a1, 2024-01-01, 7d
    技术方案           :a2, after a1, 5d
    环境准备           :a3, after a2, 3d

    section 开发阶段
    系统设计           :b1, after a3, 7d
    前端开发           :b2, after b1, 14d
    后端开发           :b3, after b1, 14d
    接口联调           :b4, after b2, 5d

    section 测试阶段
    集成测试           :c1, after b4, 7d
    性能测试           :c2, after c1, 5d
    UAT测试            :c3, after c2, 5d

    section 上线阶段
    预发布验证         :d1, after c3, 3d
    正式上线           :milestone, after d1, 0d
```

### 甘特图语法

| 语法 | 含义 |
|------|------|
| `title` | 图表标题 |
| `dateFormat` | 日期格式 |
| `section` | 分组 |
| `任务名 :id, 开始日期, 持续时间` | 任务定义 |
| `after id` | 依赖关系 |
| `:milestone` | 里程碑 |

---

## 7. 思维导图（Mindmap）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| PRD | 4.1 信息架构 | 必须 |
| SRS | 2.1 项目范围 | 推荐 |

### Mermaid语法

```mermaid
mindmap
  root((电商平台))
    用户中心
      用户注册
      用户登录
      个人信息
      收货地址
    商品中心
      商品列表
      商品详情
      商品搜索
      商品分类
    订单中心
      购物车
      订单创建
      订单查询
      订单管理
    营销中心
      优惠券
      秒杀活动
      积分商城
```

### 思维导图语法

| 语法 | 含义 |
|------|------|
| `root((标题))` | 根节点 |
| 缩进 | 层级关系 |
| `---` | 分隔符（可选） |

---

## 8. 网络拓扑图（Network Topology）

### 适用章节

| 文档类型 | 章节 | 必须性 |
|---------|------|--------|
| TRD | 2.1 整体架构 | 推荐 |
| TRD | 9.1 环境规划 | 必须 |
| SRS | 9. 系统环境 | 推荐 |

### Mermaid语法示例

```mermaid
flowchart TB
    subgraph 互联网
        User[用户]
    end

    subgraph DMZ区
        LB[负载均衡<br/>Nginx]
        FW[防火墙]
    end

    subgraph 应用区
        App1[应用服务器1]
        App2[应用服务器2]
    end

    subgraph 数据区
        Master[(主数据库)]
        Slave[(从数据库)]
        Redis[(Redis缓存)]
    end

    User --> FW
    FW --> LB
    LB --> App1 & App2
    App1 & App2 --> Master & Redis
    Master --> Slave
```

### 部署架构示例

```mermaid
flowchart TB
    subgraph 生产环境
        subgraph Web层
            Nginx[Nginx集群]
        end

        subgraph 应用层
            App1[App Server 1]
            App2[App Server 2]
            App3[App Server 3]
        end

        subgraph 数据层
            MySQL[(MySQL主从)]
            Redis[(Redis集群)]
            ES[(ElasticSearch)]
        end

        subgraph 基础设施
            OSS[对象存储]
            CDN[CDN加速]
            MQ[消息队列]
        end
    end

    Nginx --> App1 & App2 & App3
    App1 & App2 & App3 --> MySQL & Redis & ES & MQ
    App1 & App2 & App3 --> OSS
    OSS --> CDN
```

---

## 图表选择决策树

```
需要表达什么？
│
├─ 流程/步骤 → 流程图
│   ├─ 有判断分支 → flowchart TD
│   └─ 顺序执行 → flowchart LR
│
├─ 系统结构 → 架构图
│   ├─ 功能模块 → flowchart TB
│   └─ 技术组件 → flowchart TB + subgraph
│
├─ 对象交互 → 时序图
│   └─ sequenceDiagram
│
├─ 状态变化 → 状态图
│   └─ stateDiagram-v2
│
├─ 数据关系 → ER图
│   └─ erDiagram
│
├─ 时间计划 → 甘特图
│   └─ gantt
│
├─ 层次结构 → 思维导图
│   └─ mindmap
│
└─ 网络部署 → 网络拓扑
    └─ flowchart TB + subgraph
```

---

## 检查清单

### 文档图表完整性检查

**PRD文档：**
- [ ] 4.1 信息架构 → 思维导图
- [ ] 4.2 功能架构 → 架构图
- [ ] 5.1 交互流程 → 流程图/时序图
- [ ] 5.2 状态转换 → 状态图
- [ ] 6.2 数据ER图 → ER图

**TRD文档：**
- [ ] 2.1 整体架构 → 架构图
- [ ] 3.2 核心接口 → 时序图（可选）
- [ ] 4.4 数据ER图 → ER图
- [ ] 9.1 环境规划 → 网络拓扑图

**SRS文档：**
- [ ] 3.2 业务流程 → 流程图
- [ ] 4.2 功能流程 → 流程图
- [ ] 5.4 数据ER图 → ER图
- [ ] 13.1 实施计划 → 甘特图