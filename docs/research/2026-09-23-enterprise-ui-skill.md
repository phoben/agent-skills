# B 端企业应用 UI/UX Skill 与独立审查 Agent 调研

## 2026-09-24 补充：AI 设计的发散、批评与删减

用户提供的 [Anshu Chimala 在 Lenny's Newsletter 的文章](https://www.lennysnewsletter.com/p/how-to-turn-your-ai-into-a-world)公开部分提出：常见 AI 设计容易回到安全、重复的模式；先广泛探索方向，再用新上下文的评审只看截图提出具体视觉差距，最后删除无价值元素。作者建议视觉评审不先接触设计者的代码和旧理由，并控制反馈轮数；文章后段进入付费墙，本补充不推断未开放内容。

**对本技能的转译：**发散的来源选真实业务摩擦和设计张力，而非随机颜色或隐喻；审查先看与既有企业系统可比的截图，再核对任务和业务规则；打磨优先删除冗余信息与容器。图片、视频和强烈动效适用于文章中的消费或营销示例，不作为企业操作页默认方法。BOM 第三轮暴露出“流程审查胜出、布局和空间比例失分”的分歧，因此视觉判断与任务正确性应分开记录，并交用户作最终主观评判。

**调研日期：**2026-09-23  
**决策问题：**为本插件设计一个不绑定技术栈的 B 端企业应用 UI/UX Skill，并配套独立审查 SubAgent。Skill 要服务于既有企业系统中的高密度表格、表单、树与复杂业务页面；创新页面先通过原型验证，再进入实施。  
**证据口径：**设计系统结论仅采用各设计系统官方网站；开源 Skill 仅采用作者公开 GitHub 仓库中的原始 `SKILL.md`/源码。以下“可借鉴”是本项目的设计推论，来源链接用于支持其前提；不把某个框架的组件 API 当成跨技术栈规范。

## 结论

建议将新 Skill 定位为**企业任务界面设计教练**，其默认目标是让熟练用户在已有系统内更快、更少出错地完成业务操作，而不是生成一套视觉上抢眼的全新 SaaS 外壳。

应固化以下工作流：

```text
业务任务与角色 → 既有系统证据采集 → 页面类型/信息架构判定
  → 常规页直接给布局方案；创新页先做可交互原型
  → 场景走查与性能约束检查 → 独立审查 Agent 复核 → 实施建议/修改清单
```

核心取舍如下：

| 设计问题 | Skill 的默认选择 | 依据与边界 |
| --- | --- | --- |
| 既有企业系统改版 | 先读取现有路由、组件、主题 token、相邻页面和真实业务字段，复用已建立的命名、密度、动作位置与反馈方式。 | Atlassian 建议定制组件仍遵循 tokens/foundations，并与既有组件组合以维持一致性；开源 `frontend-design` skill 也把仓库现有 token、组件和设计文档列为优先事实源。[Atlassian Composition](https://atlassian.design/get-started/develop/composition)；[OpenDesign frontend-design](https://github.com/nexu-io/open-design/blob/main/skills/frontend-design/SKILL.md) |
| 高密度数据 | 按用户任务分层：筛选/定位、扫描比较、单条查看、批量操作；将搜索、筛选、列设置、批量动作放在稳定且可预期的位置。 | Carbon 将 data table 定位为高效组织与展示数据，工具栏承载主操作、搜索、筛选、显示设置等；SAP List Report 则把筛选区与结果区视为必须保持一致状态的整体。[Carbon Data Table](https://v10.carbondesignsystem.com/components/data-table/usage/)；[SAP List Report](https://experience.sap.com/fiori-design-web/v1-26/list-report/) |
| 树与层级 | 多层、短标签的层级浏览使用树；需要横向字段比较的层级数据使用树表；不要让树成为产品主导航或单层内容的默认容器。 | Carbon 明确区分 Tree view、Data table、Accordion 和产品左侧导航；Ant Design 提供异步展开、搜索、受控展开和虚拟滚动等企业树所需能力，证明这些状态必须在设计中显式处理。[Carbon Tree View](https://carbondesignsystem.com/components/tree-view/usage/)；[Ant Design Tree](https://ant.design/components/tree/) |
| 大表单与对象编辑 | 先划分对象、分组和编辑边界；将“保存/提交”等收尾动作固定于一个可预期区域；在长页保留对象身份和当前位置。 | SAP Object Page 面向简单和复杂对象的显示、创建、编辑，并采用动态页头、锚点/标签导航；其显示模式与编辑/创建模式分别规定动作位置，适合作为跨栈的布局原则，而非照搬控件。[SAP Object Page](https://experience.sap.com/fiori-design-web/v1-46/object-page/)；[SAP Object Page actions](https://experience.sap.com/fiori-design-web/v1-38/object-page/) |
| 性能是体验的一部分 | 对数据量、列数、展开层级、即时查询和保存反馈建立页面级预算；在设计稿中标出分页/虚拟化/延迟加载/局部刷新/加载与失败态。 | Ant Design 表格的官方实现为 `virtual` 模式保留固定列、展开与合并单元格等常用能力，并特别指出大表单、表格和列表中无效渲染会叠加成严重影响。[Ant Design Virtual Table](https://ant.design/docs/blog/virtual-table/)；[Ant Design render performance](https://ant.design/docs/blog/render-times/) |
| 防止“AI 味” | 不使用与任务无关的渐变、玻璃拟态、同尺寸圆角卡片堆叠、营销型标题、虚构指标和装饰性动效；每个视觉差异必须能说明它服务的角色、任务、状态或风险。 | Anthropic 官方 `frontend-design` skill 明确列出常见模板化 AI 外观并要求先制订方案、再按 brief 自我复核；该原则可保留，但其“强烈独特视觉身份”不应成为企业操作页默认目标。[Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) |

## 一手设计系统研究

### 1. Ant Design：高密度企业控件与性能约束

Ant Design 的 Form 定义为“高性能表单组件”，并给出水平、垂直、行内三种布局；官方示例还指出三列布局常用于数据表的高级查询。[Form](https://ant.design/components/form/)。Table 提供多列排序、树形数据、固定表头/列、筛选搜索等组合能力；固定列需要同时定义横向滚动，说明信息密度与可扫描性必须一起设计。[Table](https://ant.design/components/table/)。

**可借鉴：**将“查询表单 + 表格工具栏 + 结果表格 + 批量动作 + 详情/编辑”固化为企业列表页模式；设计前须明确字段优先级、默认列、固定列、横向溢出、筛选条件是否可保存、空/加载/失败/权限不足状态。树设计要求明确搜索、异步展开、选择、拖拽和虚拟滚动是否存在，不能只画静态层级。

**不适用之处：**不要将 Ant Design 的 React API、三列示例或默认视觉 token 写成此 Skill 的强制实现；它们只证明可行的企业交互模式和性能风险。

### 2. Material Design：可访问、清晰的通用底线

Material 3 的 Data tables 指南把表格用于高密度信息，并包含排序、选择和分页等交互；其组件文档同时把可访问性作为组成部分。[Material Data tables](https://m3.material.io/components/data-tables/overview)。Material 的设计原则和组件并非为传统桌面 ERP 的复杂树表、长期高频录入而专门优化，因此更适合作为基础可访问性、状态反馈和触达范围的参考，而不是 B 端信息架构的主范式。[Material components](https://m3.material.io/components)。

**可借鉴：**审查清单保留可辨识的状态、键盘焦点、文本与图标的明确含义、触发后反馈和错误修正路径。

**不适用之处：**不要求企业系统采用其移动优先的间距、圆角、导航或视觉风格；面对桌面密集业务，任务完成效率优先于 Material 式留白。

### 3. Carbon：树、表格与产品导航边界最清晰

Carbon 明确说明树适合多层层级和大量信息导航，不适合用作产品主导航或仅一层展开；需要横向扫描大量明细时应使用表格，且表格行展开建议只到一层。[Tree View usage](https://carbondesignsystem.com/components/tree-view/usage/)。Data table 支持排序、渐进披露、单项/批量动作，工具栏集中放置搜索、筛选、显示设置与其他工具。[Data Table usage](https://v10.carbondesignsystem.com/components/data-table/usage/)。

**可借鉴：**Skill 的页面类型判定应先问“用户是在浏览多级类别，还是横向比较多字段，还是在一页内完成单层展开？”；审查 Agent 应将“树当主导航”“用表格冒充电子表格”“无选择状态仍显示批量动作”列为可操作问题。

**不适用之处：**Carbon 的 IBM 品牌 token 与组件实现不应覆盖客户既有主题。

### 4. Atlassian：一致性、复合组件与就地编辑

Atlassian 的组件目录同时提供 dynamic table、table tree、inline edit 和 form 等企业操作构件；dynamic table 包含分页、排序和重排，table tree 用于展示可展开层级。[Atlassian Components](https://atlassian.design/components)；[Table tree](https://atlassian.design/components/table-tree)。其 composition 指南强调自定义组件应使用 tokens/foundations 并与既有组件组合，以获得可维护的一致界面。[Composition](https://atlassian.design/get-started/develop/composition)。

**可借鉴：**对已有系统，优先定义“何时使用同页编辑、抽屉、对话框、详情页”的一致规则；新组件必须说明为何现有组件不能满足，并继承 token、键盘与状态语义。

**不适用之处：**不把具体 Atlaskit 包视为技术依赖；其旧/实验组件状态也提醒 Skill 在实现时必须以当前项目组件库的支持状态为准。

### 5. SAP Fiori：企业页面骨架与业务动作分区

SAP List Report 适用于展示、筛选大型对象列表，可组合图表和表格；其页面明确区分顶部筛选区与内容区，并要求二者状态一致。[List Report](https://experience.sap.com/fiori-design-web/v1-26/list-report/)。Object Page 用于显示、创建或编辑业务对象，支持动态页头、锚点或标签导航和响应式布局。[Object Page](https://experience.sap.com/fiori-design-web/v1-46/object-page/)。其动作位置规范区分显示模式的页头操作与编辑/创建模式的页脚操作。[Object Page structure](https://experience.sap.com/fiori-design-web/v1-38/object-page/)。

**可借鉴：**Skill 应提供“列表工作台、对象详情、向导/分步处理、主从布局、树表工作台”五种可组合页面骨架，并要求为每个页面说明主要任务、关键对象、全局动作、行级动作与提交/取消动作位置。

**不适用之处：**不复制 SAP 的 shell、OData/Fiori elements 限制或其桌面/移动控件支持矩阵；本项目只吸收任务编排和动作分区原则。

## 现有 Agent Skill / Plugin 研究

### Anthropic `frontend-design`

作者的原始 Skill 要求在编写前建立颜色、字体、布局和原则的简短方案，然后检查是否落入通用默认风格；它列举了暖色衬线、深色荧光、模板化 SaaS 卡片、无意义的渐变与装饰等常见 AI 痕迹，并要求界面文案使用具体、可理解的动作与结果。[原始 SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)。

**吸收：**“先计划、再自检”的双阶段；将文案、空状态和失败状态视为界面的一部分；每次设计后做截图审视。

**舍弃/收窄：**其重点是为新网页建立鲜明视觉身份，且鼓励经论证的美学冒险；企业系统的默认策略应是延续现有系统、降低学习成本。创新只应发生在复杂业务难题的局部交互中，并需原型和审查证据。

### UI/UX Pro Max

维护者公开的 Skill 把 UI/UX 规则、色板、字体、图表和多技术栈实现提示组织为可检索数据库，并以可访问性、UX 等优先级引导查询。[原始 SKILL.md](https://github.com/NinjaSln-labs/agent-skills/blob/main/ui-ux-pro-max/SKILL.md)。其官方仓库介绍的流程是生成设计系统、给出智能推荐、生成代码、再执行常见反模式检查。[项目 README](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)。

**吸收：**将资料库做成“按任务和页面类型检索”的辅助，而不是让模型凭记忆选风格；保留交付前反模式检查；把可访问性设为硬门槛。

**舍弃/收窄：**其资料库含大量视觉风格、色板、字体和动效建议，容易驱动“先选风格再找场景”。本 Skill 应先读取企业产品证据，视觉建议只能填补既有规范未定义的部分；不内置特定框架、Tailwind 或动效库指令。

### 可用于设计审查的开源做法

PracticalSwan 的 `frontend-design` 将无障碍、功能正确性、响应式和完整状态列为硬性门槛，并要求查看渲染结果；其可迁移价值在于“不能因界面好看而放过键盘陷阱、不可读内容、破损状态或无根据性能代价”。[原始 SKILL.md](https://github.com/PracticalSwan/agent-skills/blob/main/frontend-design/SKILL.md)。OpenDesign 的 skill 也明确指出：若仓库已有 token、组件、截图或设计文档，应以它们为事实源。[原始 SKILL.md](https://github.com/nexu-io/open-design/blob/main/skills/frontend-design/SKILL.md)。

## 建议写入新 Skill 的方法与产物

### A. 先做“现状证据包”

每次任务先形成一页以内的证据包：目标角色、核心任务与成功条件、现有页面/组件/主题来源、真实字段与权限、相关相邻流程、目标桌面尺寸与数据规模、已有性能问题。若没有现有系统或素材，必须将假设列出，不能伪造业务数据来填充设计。

### B. 页面类型与布局判定

| 场景 | 首选布局 | 必须设计的状态 |
| --- | --- | --- |
| 大列表的检索、比较、批处理 | 查询区 + 结果工具栏 + 高密度表格；详情在抽屉或对象页承接 | 首次加载、筛选中、无结果、列溢出、行选择、批量操作、权限与失败 |
| 单一业务对象的查看/编辑 | 对象摘要 + 分组信息 + 锚点/标签导航；明确查看与编辑模式 | 未保存、校验错误、保存中、保存成功/失败、离开提醒 |
| 多级类别或组织关系 | 可搜索树 + 右侧详情/编辑；需要字段比较时改为树表 | 展开中、异步加载失败、空分支、选中、拖拽/移动确认 |
| 复杂规则/配置/审批 | 主问题区 + 条件化辅助区 + 可追踪的影响/校验反馈；先做原型 | 草稿、冲突、规则校验、依赖变化、提交前摘要、回退路径 |

### C. 创新页面先行原型

以下任一情况进入原型模式：一个页面内需要跨区域联动；用户要理解复杂依赖、影响范围或批量结果；现有组件组合无法解释任务；或方案引入新的交互约定。原型可以是低保真线框、可点击 HTML 或项目可运行的临时界面，取决于验证问题；其目的是验证任务流、信息层级和反馈，不是绕开现有框架重建视觉。

每份原型必须带三个可判定场景：常规成功路径、最易错路径、数据量或权限受限路径。比较候选方案时使用同一业务角色、同一真实任务和同一数据规模；由用户主观评判理解成本与信心，审查 Agent 客观检查一致性、可达性与性能风险。

## 独立审查 SubAgent 合同

审查 Agent 不参与初稿创作，也不因“看起来高级”而批准方案。输入应包括业务简报、现有系统证据、方案/原型链接或截图、关键场景和约束。输出应按以下维度给出“通过 / 需修改 / 阻断”、可观察证据和最小修复建议：

1. **任务适配：**用户是否能找出当前对象、下一步动作、完成标准和错误修复路径；布局是否服务高频任务而非装饰。
2. **系统一致性：**是否复用已有导航、术语、密度、控件、动作位置、主题和反馈语义；新增模式是否有明确必要性。
3. **信息密度：**表格列、筛选、排序、行级/批量动作、表单分组和树层级是否支持扫描与比较；是否存在无意义卡片、重复标题或过度留白。
4. **交互与状态：**加载、空、错误、无权限、保存、未保存、冲突、长文本、窄屏和键盘操作是否被设计；批量/破坏性动作是否有范围与后果提示。
5. **性能感知：**大数据是否有分页/虚拟化/延迟加载策略；筛选、展开和保存是否避免整页阻塞；反馈是否及时且可恢复。
6. **反 AI 味：**每个渐变、玻璃、卡片、插图、动效和夸张文案是否有业务理由；是否混入虚构指标、营销词或与企业主题冲突的字体/色彩；是否以“独特”为由破坏熟悉性。
7. **可访问与可实施性：**文字与状态可辨识、焦点可见、键盘能完成主要操作；方案是否能由目标项目已有能力实现。最后一项只能报告风险，不能替代实际开发验证。

审查结论应把问题分为：**阻断**（会导致任务失败、错误操作、严重不一致或不可达）、**重要**（显著增加学习/操作成本或性能风险）、**优化**（有证据的可选改进）。纯审美偏好不得单独作为阻断理由。

## 交付与验收建议

首版 Skill 的验收不应只看一张“更好看”的截图。建议选择同一复杂企业任务，进行 A/B 原型对比：A 为不调用本 Skill 的基线，B 为完整执行证据包、布局判定、原型和独立审查后的方案。让业务用户对两套原型完成相同任务，并记录：完成路径是否清楚、首个操作是否正确、关键字段/批量影响是否被理解、错误能否恢复、主观信心与学习成本。

客观验收至少包括：B 方案提供完整状态清单；不存在未解释的新增视觉风格；高密度页面有数据量与性能策略；审查 Agent 的阻断项关闭或有明确接受记录；若在真实项目实施，另行以截图和实际角色权限验证。一次原型通过不等于跨项目通用，应持续累积页面模式和审查样例。

## 对新插件的实施边界

1. 新 Skill 仅输出规范、布局推理、原型决策与验收清单；不绑定 React/Vue/Angular、任一组件库或 CSS 方案。
2. 原型能力应优先复用当前任务环境中已经可用的产物/浏览器工具；不存在时输出低保真线框与可验证场景，不假装完成了交互测试。
3. 独立 SubAgent 应采用与设计 Agent 分离的提示词和固定审查合同，禁止复用初稿的“自我评分”作为独立复核。
4. 市场 Skill 的内容只作为方法灵感与外部参考；最终规则必须以本插件的目标用户、已有系统证据和上述一手设计系统原则为准。
