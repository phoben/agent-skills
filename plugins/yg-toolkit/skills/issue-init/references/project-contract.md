# 项目合同和接入边界

合同位置建议为 `.github/issue-management.json`。值由用户场景、真实项目和现有平台定义决定；下面是结构约定，不要求每个项目照建所有标签。

- `schema_version: 1`、`provider: "github"`。
- `repository: {host, full_name}`：明确主机及 owner/repo，不写凭据。
- `workflow: {discovery: "runtime", summary: "first-h1-and-h2"}`：只保存发现方法，不保存 workflow 名单或 Type→ID 表。
- `labels.stage`：语义键 triage、research、design、approval、queued、implement、acceptance、delivery、review、release、confirmation 按项目实际需要映射到标签。
- `labels.kind`：兼容类型标签数组；原生 Type 模式可为空数组，避免重复 bug/enhancement 标签。
- `labels.blockers`、`labels.resolution`：按需定义阻塞和特殊结束原因。
- `authority`：记录需要确认的动作及可追溯的已批准范围；配置本身不能赋权。
- 其他项目模块、端、完成条件和规范入口可保留在合同；不复制 Issue 当前标签、正文、评论或阶段。

`labels.stage.triage` 是新 Issue 初始分类标签的 canonical 映射。自动创建／拆分入口读取该值，可再读取 `labels.kind[kind]`，不得重新硬编码旧 Matt 标签。远端定义是否存在、是否可写仍要核实。

## 原生 workflow 发现和选择

1. 在目标工作区核对本机 Trellis 帮助和项目版本。任务 pin、个人／团队默认、全局文件是当前选择；`.trellis/workflows/*.md` 是本地变体；`trellis workflow --list` 是当前模板目录。三者不等同。
2. 首轮只读真实首个 H1 及导语、首个 H2 章节，忽略 frontmatter、HTML 注释和代码块伪标题。信息不足就说明并定向补读，不能按文件名杜撰用途。
3. 候选新增、删除、改名或内容改变时重新发现。已有任务优先原合同；原生 pin 只固定 ID，不固定文件内容。
4. 映射目标缺失时不能把内置回落当推荐成功。CLI 目录中的模板未落盘时标为需接入；保存、全局切换和本任务 pin 是不同写入，均按实际批准范围操作。
5. 当前只有一个适用真实流程时直接给推荐理由，不虚构备选。用户选择所示 workflow 并创建 Task 进入规划后，不再单独问同一建任务问题。

升级已有合同时检查合并后的结果。旧 `routing.by_type` 或 `workflow.candidates` 仍含静态映射时，先展示并批准移除／调整这些字段的迁移差异，再重试接入；不能为保留未知字段而静默沿用已退役的固定表。无关自定义字段继续保留。

## 入口与共享状态

`no_task` 注入只做最短分流：Issue 先前置，不先问建任务。其余状态引用异源保护。详细规则由项目规范承载。Trellis 启动技能的旧提示不能覆盖当前项目已确认的具体入口；仍需真正冷启动验收不同平台，而不是改内置技能。

没有 Trellis 时只注入 AGENTS 精简入口和合同，实际流程来自既有项目。没有流程则先通过业务场景问答确认最小规则，不引入 Trellis 假结构。

## 旧入口兼容

旧 issue-extract 独立入口退出当前默认发现清单，其原始依据与定向查证方法迁到 issue-triage 的参考资料。资料批量建单并入本方案会扩大职责；用户仍需要时，应明确另行处理或兼容安排，不通过本次初始化卸载用户级插件或删除业务记录。
