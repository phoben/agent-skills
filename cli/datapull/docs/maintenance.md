# DataPull 维护者指南

本文面向后续功能开发、数据库适配、Agent Skill 扩展和版本升级。用户安装与命令用法见
[README](../README.md)，跨平台环境与发布操作见 [兼容性与发布 CI](release-ci.md)。

## 不可破坏的产品约束

- 交互流程优先服务人类；完整子命令、稳定退出码和 `--json` 同时服务 Agent。
- 连接为用户级全局配置，一个连接可对应多个数据库；数据库收藏和最近使用项不能与连接耦合。
- 非秘密信息写入 `config.json`，密码和完整含秘密 URL 写入权限受限的 `credentials.env`。秘密不得进入命令参数、日志、Git 或兼容性证据。
- 输出固定写入当前项目的 `.database-schema/`。只替换本次选择的对象类型，未选择类型必须保留。
- 同一次拉取是文件事务：任一所选类型失败时不得留下半套新文件；异常退出后必须能够恢复。
- DataPull 独立于旧 `database-schema` 技能运行，不承担旧配置、脚本或输出兼容。
- Agent Skill 的验收标准是写入预期目录，并回验元数据、版本和内容哈希；不安装、不启动也不登录 Agent 工具。
- 数据库工具自动安装前必须展示工具、来源、命令、权限和下载影响，并获得用户确认；Agent 只能给出安装命令，由用户执行。

## 代码导航

| 变更场景 | 主要入口 | 需要同步检查 |
|---|---|---|
| 新增或修改命令 | `src/cli/program.ts` | `src/interactive/`、`src/core/output.ts`、`tests/cli.test.ts` |
| 修改连接与凭证 | `src/config/`、`src/connections/service.ts` | 配置版本、脱敏输出、文件权限、`tests/config-*.test.ts` |
| 修改拉取流程 | `src/pull/service.ts` | `src/output/transaction.ts`、退出码、事务测试 |
| 新增数据库或对象类型 | `src/exporters/`、`src/exporters/factory.ts` | `src/types.ts`、`src/tools/`、种子脚本、兼容矩阵 |
| 修改三方工具安装 | `src/tools/catalog.ts`、`src/tools/manager.ts` | `INSTALL_ADAPTER_VERSION`、权限提示、跨平台测试 |
| 新增 Agent 或安装位置 | `src/skills/agents.ts`、`src/skills/targets.ts`、`src/skills/installer.ts` | 向导、平台注册表测试、CI 目标、兼容矩阵 |
| 修改内置 Skill | `skill/` | `npm run skill:sync`、`npm run skill:check`、Plugin 副本 |
| 修改发布门 | `scripts/check-release-matrix.mjs` | `resources/compatibility-matrix.json`、两个 GitHub Actions 工作流 |

`cli/datapull/skill/` 是 DataPull Skill 的唯一源码；Plugin 中的副本是同步产物，禁止两处分别编辑。

## 常见扩展清单

### 新增命令或选项

1. 在 `program.ts` 提供完整非交互命令，不把关键能力只放进向导。
2. 对会修改连接、安装工具、覆盖文件的操作保留预览和明确确认；`--yes` 只跳过确认，不改变校验。
3. 人类输出使用中文；`--json` 保持字段稳定，不混入进度动画或普通日志。
4. 为成功、输入错误、配置错误、依赖缺失和部分失败定义可观察结果与退出码。
5. 增加 CLI 测试，并覆盖至少一个 JSON 成功响应和一个失败响应。

### 新增数据库引擎

1. 扩展 `Engine`、配置 schema、连接校验和脱敏逻辑。
2. 实现 `DatabaseExporter` 并在 `exporters/factory.ts` 注册。
3. 在 `tools/catalog.ts` 声明官方客户端和每个平台的安装计划；安装规则发生变化时递增 `INSTALL_ADAPTER_VERSION`。
4. 增加不含真实业务数据的 CI 种子脚本，并保留“哨兵业务数据不得出现在 DDL”检查。
5. 扩展远程 CI Secrets、兼容性执行器、矩阵必选引擎和五个平台记录。
6. 只有真实数据库和目标平台回验完成后才能宣称支持，单元测试不能替代兼容性证据。

### 新增对象类型

1. 在对象类型模型和各引擎 exporter 中统一定义名称与文件布局。
2. 覆盖“默认全选”“自定义多选”和 `--include` 校验。
3. 验证只选择新类型时，其他类型的旧文件保持不变。
4. 验证同批任一对象失败时，所有所选类型回滚到旧版本。
5. 在三个种子库中至少创建一个可拉取对象，并更新兼容性断言。

### 新增 Agent Skill 目标

1. 在 `src/skills/agents.ts` 的单一注册表中增加稳定 ID、展示名、项目级目录、可选用户级目录和无副作用的配置痕迹；不要把路径分支散落到向导。
2. 项目目录为 `.agents/skills` 时归入兼容共享组；用户级目录仍逐平台解析，不得由项目共享关系推导。
3. 旧 ID 必须通过别名层继续解析。环境变量覆盖和不支持用户级安装的平台都要有路径测试。
4. 安装和更新后回验目标路径、安装元数据、Skill 版本和目录内容哈希；多个平台解析到同一目录时只执行一次实体写入。
5. 上游平台注册项只表示“路径契约已登记”。只有完成真实目标平台回验后，才能更新 `requiredSkillTargets` 和公开兼容声明。
6. CI 的 Skill 层只验证文件安装结果；真实 Agent 发现并加载 Skill 属于更高一层运行时验收，二者必须分别报告。

### 修改配置格式

- 配置 schema 必须显式版本化；无法安全迁移时应失败并给出备份/修复指引，不能静默丢字段。
- 用户必须仍可手工修改 `credentials.env` 更新密钥；下次运行应稳定读取最新值。
- `host` 与 `port` 始终分字段保存。SQL Server 地址示例 `db.example.internal:37697` 应拆成主机 `db.example.internal` 和端口 `37697`。
- SQL Server 始终加密；`trustServerCertificate` 仅跳过服务器身份验证，必须由用户显式选择，不能作为生产默认值。
- Windows 版 ODBC `sqlcmd` 的错误流可能使用系统 ANSI 代码页，即使查询输出已指定 UTF-8；进程执行层必须先保留原始字节，优先按 UTF-8 解码，失败后再按系统语言对应代码页解码，否则证书错误会乱码并退化为通用失败。
- SQL Server TLS 回归验收必须同时覆盖两个结果：严格验证时稳定返回 `SQLSERVER_TLS_CERTIFICATE_UNTRUSTED`；用户明确确认仅本次信任后能够连接，但结果必须携带安全警告。

## 验证分层

不同层级不能互相替代，完成声明必须说明实际通过了哪一层。

```bash
cd cli/datapull
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm run skill:check
npm run release:check
```

1. `check`：TypeScript 静态检查。
2. `test`：命令、配置、导出器、事务、工具和 Skill 单元/集成测试。
3. `build`：生成可发布的 `dist/`。
4. `skill:check`：唯一 Skill 源与 Plugin 副本内容哈希一致。
5. 兼容性 CI：真实数据库、官方客户端、五个平台、NPM 安装和八个 Skill 目标。
6. `release:check`：兼容矩阵完整性门禁。
7. 发布 CI：OIDC 身份、打包、provenance 和 registry 接收结果。
8. 公开验收：registry 的 `latest` 与指定版本一致，并从空目录通过 `npx` 执行 `datapull --version`。

## 发布与升级经验

- `npm login` 只证明当前终端已登录；开启发布 2FA 后，手工 `npm publish` 仍可能要求逐次认证。
- CLI 输出的 `/auth/cli/` 链接与当次进程绑定，进程退出后再打开可能返回 404。不要把它设计成发布流程。
- 正常发布只使用 `.github/workflows/datapull-publish.yml` 的 GitHub OIDC。禁止新增长期写入 `NPM_TOKEN`。
- 发布标签必须为 `datapull-v<package.json 版本>`；工作流会在发布前拒绝不一致的标签。
- npm 返回成功后可能提示包仍在处理。此时先检查工作流日志中的 `+ 包名@版本` 和 provenance，再轮询 registry；不要立即重复发布。
- Trusted Publisher 绑定依赖仓库、工作流文件名和可选 Environment 的精确匹配。重命名工作流后必须先更新 npm 设置，否则发布会报认证失败。

完整发布步骤、首次绑定值、失败恢复和安全加固见 [兼容性与发布 CI](release-ci.md)。
