# 框架上游选择性同步规范

本规范约束本项目从原作者框架选择性同步的基线、内容融合与 Harness 分流。它不授权提交、推送、部署或归档。

## 场景：选择性同步与同步基线

### 1. Scope / Trigger

- 触发：检查 `.framework-sync.json` 记录的 `upstream` 基线之后的框架提交，或用户明确要求同步上游更新。
- 目标是融合经核验的业务/框架内容，保留 `aoy_erp`、奥芸品牌、端口 5505、PostgreSQL/Flyway 与双移动端事实；不是 `git pull`、merge 或整目录复制。

### 2. Signatures

```json
{
  "upstream": { "url": "...", "branch": "workflow", "remote": "upstream" },
  "lastCommit": "40 位已处理上游提交 SHA",
  "lastSync": "Asia/Shanghai ISO-8601 时间",
  "syncs": [{ "fromCommit": "...", "toCommit": "...", "totalCommits": 0 }]
}
```

- `.framework-sync.json` 是唯一同步基线权威；台账位于当前同步任务的 `research/sync-ledger.md`。

### 3. Contracts

- 每个候选提交必须恰有一个结论：内容融合、Harness 提炼、Harness 忽略或明确跳过；台账记录落点、验证证据及未验证边界。
- 内容按提交意图增量融合，数据库仅新增有序 PostgreSQL Flyway，禁止把 MySQL 初始化/备份脚本混入。
- Harness 只能提炼为项目既有 `.trellis/spec/` 的事实规则；禁止复制上游 Hook、Agent、Command、Skill、`AGENTS.md` 或建立第二套同步入口。
- 他者占用区（尤其 `.agents/skills/` 的既有改动）只读保留。

### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| 候选未逐项结论或验证证据不完整 | 不推进 `lastCommit` |
| 与奥芸标识、端口、PostgreSQL/Flyway、双移动端冲突 | 内容适配或明确跳过，并记录理由 |
| Harness 可复用但依赖能力未落地 | 条件提炼，能力完成前不写成已生效规则 |
| 编译/测试通过但真实 DB、Redis、浏览器或部署未跑 | 可记录分层通过，但必须标明未验证，不得写成全量验收 |
| JSON/链接/台账计数校验失败 | 修正记录，基线保持旧值 |

### 5. Good / Base / Bad Cases

- Good：53 个代码提交按本地架构融合，15 个 Harness 只转成 规则或忽略理由，3 个不兼容提交明确跳过；所有 71 项唯一、可追溯后才推进基线。
- Base：只完成静态/聚焦测试时，`syncs` 如实写明真实运行环境未验证。
- Bad：把上游 `.agents/` 或 `.claude/` 整体复制、以未跑 Flyway/浏览器的结果宣称生产验收、或先推进基线再补台账。

### 6. Tests Required

- JSON：`ConvertFrom-Json .framework-sync.json` 成功，`lastCommit` 为 40 位 SHA，`upstream.remote` 存在。
- 台账：候选数量、SHA 唯一性、四类结论与实际范围相符；Spec 内链可解析，`git diff --check` 通过。
- 代码按影响层分别验证编译/聚焦测试/构建；PostgreSQL Flyway、Redis、多节点、浏览器角色、HBuilderX 和部署必须单列结果，不能由静态检查代替。

### 7. Wrong vs Correct

```text
Wrong: 看到上游新 HEAD 就更新 lastCommit，随后再决定哪些提交要不要用。
Correct: 逐提交融合或记录 Harness/跳过结论 -> 汇总真实验证 -> 校验 71 项唯一 -> 最后更新 lastCommit。
```

## Harness 分流速查

| 类别 | 本项目动作 |
|---|---|
| WD、Redis、自动导入、Shell、E2E、字段权限等已核验规则 | 融入相应 Spec，并保留可执行示例与测试点 |
| 依赖本项目尚未实现的能力 | 条件提炼，待能力落地再生效 |
| 上游协作入口、外部 Agent、平台专属 CLI、错误品牌/数据库脚本 | 仅在台账记录忽略/跳过理由 |
