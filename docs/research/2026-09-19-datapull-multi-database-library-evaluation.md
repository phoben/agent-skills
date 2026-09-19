# DataPull 多数据库开源库/工具评估

**调研日期：**2026-09-19

**决策问题：**DataPull 需要连接 MySQL、PostgreSQL、SQL Server，列出数据库并将“无业务数据的完整 DDL”按对象安全、可回滚地输出。本文只采用候选项目的官方文档、官方仓库源码、许可证和官方 CI；“支持数据库”与“可无损导出该数据库全部对象”分开判断。

**判定口径：**“完整”至少包含表/列/约束/索引、视图、函数、存储过程、触发器和可用的类型/序列等数据库本有对象；还原性、授权/用户、扩展、事件、作业、分区、全文/空间索引、加密与平台专有对象须逐引擎、逐版本实测，不能因某个工具有 `--export` 就自动宣称全覆盖。

## 执行摘要

**推荐继续以 DataPull 自己的逐数据库 exporter 和官方客户端为产品边界；可将 `sqldef` 作为优先 POC 候选，而非立即替换。**

`sqldef` 是本轮唯一同时公开提供 MySQL、PostgreSQL、SQL Server 独立 CLI、`--export` 以及持续三引擎 CI 的轻量候选；其源码/测试还可见部分触发器、视图、PostgreSQL enum/type 等导出覆盖。[官方 README](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/README.md#L1-L50)；[三引擎 CI](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/.github/workflows/sqldef.yml#L1-L140)。但它是单体 schema-management 工具，输出并不天然匹配 DataPull 的“分对象文件事务、仅更新被选类型、稳定 JSON、Windows 安全与错误分类”契约；且源码中已有明确跳过某些 PostgreSQL event trigger/function 场景的测试，不能承诺“任意对象完整导出”。[跳过用例](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/database/database_test.go#L1-L55)。

Liquibase、SchemaCrawler、JDBC/jOOQ 能带来跨数据库元数据/变更管理能力，但不适合作为 DataPull 的直接“无损 SQL DDL 导出器”；其中当前 Liquibase 5 和部分高级能力还存在非开源或商业许可边界。Node ORM/查询构建器则更不适合承担备份式 schema 导出。它们可以被用于未来的可选元数据层或开发者生态集成，不应接管正式导出路径。

## 候选对照

| 候选 | MySQL / PostgreSQL / SQL Server 连接与列库 | 无数据 DDL 导出能力 | Node/CLI 集成 | 许可与活跃证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| **sqldef** | 可连接指定数据库；`mysqldef`、`psqldef`、`mssqldef` 三个 CLI，但没有统一列库接口。[README](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/README.md#L1-L80) | 是，`--export` 输出当前 schema；有表、索引、FK、视图、触发器等源码测试，但需 POC 量化对象遗漏。 | 独立二进制，适合由现有 `execa` 调用；不是 Node SDK。 | 主体 MIT、解析器 Apache-2.0。[LICENSE](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/LICENSE)；上游提交快照为 2026-09-18，CI 覆盖三库。 | **POC shortlist #1**。 |
| **Liquibase Community / Secure** | 是；官方 `generate-changelog` 的对象输出选项列明 PostgreSQL、SQL Server、MySQL 等。 | 生成的是 Liquibase changelog/对象文件，不是原始数据库的完整 SQL dump；官方明确要求人工检查，因为部分对象和依赖无法自动表示。 | Java CLI/Java 库；Node 只能子进程封装，增加 JRE 运维。 | Liquibase 5 Community 改用 [FSL](https://github.com/liquibase/liquibase/blob/main/LICENSE.txt)，不是 OSI 开源许可；Liquibase 4 仍为 Apache-2.0，Secure 另有商业边界。 | **不作为 exporter 核心**；可评估企业 migration/diff 集成。 |
| **SchemaCrawler** | 是，官方列出 SQL Server 连接参数，并支持大量 JDBC 数据库。 | 侧重 schema discovery/documentation；`schema` 命令可输出结构信息，但不是以还原完整 SQL 为目标的 dump 契约。 | Java CLI/JDBC；Node 需进程桥接。 | 官方说明采用[多种许可证](https://github.com/schemacrawler/SchemaCrawler/blob/main/LICENSE.md)，源码常见 EPL-2.0 标识，打包分发仍需逐组件核对。 | **排除为正式导出器**，可作只读诊断/文档候选。 |
| **JDBC DatabaseMetaData** | 由 JDBC 驱动实现；标准 API 可取得 catalogs、tables、procedures、functions 等。 | 无 `getCreateDDL()` 标准 API；触发器、对象正文、平台专有属性不能靠通用元数据无损还原。 | Java API，Node 无直接嵌入。 | Java SE 规范/API，不是独立导出器。 | **元数据补充层**，不单独采用。 |
| **jOOQ** | 元数据/codegen 可连三库；但 SQL Server 等支持有商业 edition 约束。 | schema crawler/codegen 产物为 Java/元模型，不是 schema dump；过程/函数/触发器等也有商业功能边界。 | Java/Maven/Gradle，Node 需 subprocess。 | OSS edition [Apache-2.0](https://github.com/jOOQ/jOOQ/blob/main/LICENSE)；三库完整覆盖需商业许可核实。 | **排除**：许可与产物不匹配。 |
| **Knex / Kysely** | Node 侧可连接三库（Knex 客户端包含 `pg`、`mysql`/`mysql2`、`mssql`；Kysely 提供各 dialect）。 | schema builder/migration 是“从应用定义建表”，没有全库 stored logic/trigger/type DDL 反向导出承诺。 | 原生 TypeScript/Node，集成容易。 | 均 MIT；官方仓库活跃。 | **排除**：不是反向 schema 导出器。 |
| **Sequelize / TypeORM** | ORM 支持 MySQL、PostgreSQL、MSSQL。 | `sync` / migration 从实体定义生成差异，不会把现存完整数据库对象导出为 DDL；模型覆盖有限。 | 原生 TypeScript/Node。 | 均 MIT。 | **排除**：ORM 模型不是数据库真实 schema。 |
| **Prisma ORM 7** | 官方支持三库；`prisma db pull` 读库生成 Prisma data model。 | introspection 生成 Prisma schema（表/列/索引/约束映射），不是 SQL DDL，也不等于函数、过程、触发器等完整对象导出；ORM 8 的 MySQL/SQL Server 仍非当前 GA 路径。 | Node CLI/库。 | [Apache-2.0](https://github.com/prisma/prisma/blob/main/LICENSE)；版本迁移节奏本身也是稳定性风险。 | **排除**：输出语义与产品目标不符。 |
| **dbmate** | MySQL、PostgreSQL 等可用，但无 SQL Server 支持。 | migration 工具，非三库 dump。 | 单文件 Go CLI，Node 可调。 | [MIT](https://github.com/amacneil/dbmate/blob/main/LICENSE)。 | **排除**：缺 SQL Server。 |
| **Skeema** | 只面向 MySQL/MariaDB。 | 可管理/拉取 MySQL schema，不覆盖 PostgreSQL/SQL Server。 | Go CLI，Node 可调。 | [Apache-2.0](https://github.com/skeema/skeema/blob/main/LICENSE)。 | **排除**：单引擎。 |
| **Apache Calcite** | JDBC adapter 可读取关系数据库并做查询/规划。 | 是查询优化/联邦 SQL 框架，不是数据库 DDL 逆向导出工具。 | Java；Node 需桥接。 | [Apache-2.0](https://github.com/apache/calcite/blob/main/LICENSE)。 | **排除**：问题域不匹配。 |
| **Atlas** | 数据库/版本支持需按 edition 细分；不能把迁移/diff 能力等同完整 dump。 | Community 默认只检查 schema、table、index、constraint；view、function、procedure、trigger 等高级对象属于 Pro。 | Go CLI；Node 可调。 | 社区源码采用 [Apache-2.0](https://github.com/ariga/atlas/blob/master/LICENSE)，默认发行二进制和高级能力另有 EULA/Pro 边界。 | **不进入本次 POC**：免费版对象范围不足。 |

## 关键证据与逐项判断

### 1. `sqldef`：唯一值得先做兼容性 POC 的开源外部 exporter

官方 README 明确将 `mysqldef`、`psqldef`、`mssqldef` 分别对应 MySQL/MariaDB/TiDB、PostgreSQL、SQL Server，且统一以 `--export` 输出当前 schema。[支持列表与导出用法](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/README.md#L21-L50)。SQL Server 子命令还公开提供 host/port、Windows integrated authentication、instance、TLS 信任选项及 `--export`。[`mssqldef` 官方命令文档](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/cmd-mssqldef.md#L1-L70)。

它确有超出“仅建表”的覆盖证据：MySQL exporter 查询/拼装 trigger、event；PostgreSQL exporter 测试覆盖 function、enum/type、view 排序；SQL Server 测试覆盖 view 与 trigger。[MySQL 实现](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/database/mysql/database.go#L75-L215)；[PostgreSQL 导出排序测试](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/cmd/psqldef/psqldef_test.go#L892-L930)；[SQL Server 导出测试](https://github.com/sqldef/sqldef/blob/f1e3a54c008cdd051acf26d65c152a343f76236a/cmd/mssqldef/mssqldef_test.go#L1487-L1545)。

仍不能直接纳入生产：它的接口输出是一个 schema 字符串，而 DataPull 要求按对象类型写文件、所选类型整体事务、失败恢复和敏感信息脱敏；错误只以进程退出码/stdout/stderr 暴露，没有能直接复用为 DataPull 稳定错误码与重试分类的公开契约。建议将其封装在“可选、只读、实验性 backend”之后：捕获原始输出，按 DataPull 的连接瞬态/权限/语法/对象权限规则重新分类，绝不把 `--apply` 或 `--enable-drop` 接入 DataPull。

### 2. Liquibase：对象级 changelog 有价值，但不是无损 dump

Liquibase 的 `generate-changelog` 可按 `diff-types` 生成 catalog、table、view、trigger、function、sequence、stored procedure、package、constraint 等类型；Secure 的 `object-changelogs` 还公开支持对 PostgreSQL、SQL Server、MySQL 等产出分对象 changelog。[Community `diff-types`](https://docs.liquibase.com/community/user-guide-5-0-3/generate-a-changelog-with-diff-types)；[Secure 对象 changelog 参数](https://docs.liquibase.com/secure/reference-guide-5-2/database-inspection-change-tracking-and-utility-commands/generate-changelog?entryId=gcPage52secure)。

这不等于可将其结果作为 DataPull 的“完整 DDL”：官方 Community 文档直接提示，有些对象及依赖不能自动表示，生成结果部署前必须检查/补写；MySQL secure-context 文档也要求人工补充生成结果遗漏的函数、过程、触发器、视图安全上下文。[完整性警示](https://docs.liquibase.com/community/user-guide-5-0-3/generate-a-changelog-with-diff-types)；[MySQL 安全上下文限制](https://docs.liquibase.com/secure/integration-guide-5-2-1/what-to-know-about-mysql-security-contexts-and-liquibase-secure)。同时，涉及较完整 stored logic 输出的参数出现在 Secure 文档，必须在产品/许可评估中单独处理。因此它适合作为“生成 migration 基线/比对报告”的可选集成，非 DataPull 基础依赖。

### 3. SchemaCrawler、JDBC 与 jOOQ：能观察 schema，不等于能重建 schema

SchemaCrawler 官方定位为 schema discovery/comprehension，并在支持页给出 SQL Server 的连接和 `-command=schema` 示例。[官方支持页](https://www.schemacrawler.com/database-support.html)。它可帮助 DataPull 做只读发现或生成诊断文档，但没有给出“跨三库、全对象、可还原 SQL DDL”承诺，因此不应把其展示型 schema 输出当作导出结果。

JDBC `DatabaseMetaData` 标准化了 `getCatalogs`、`getTables`、`getProcedures`、`getFunctions` 等发现 API，却没有通用的获取对象 `CREATE` 语句接口；这说明 Java 层能补充列库/对象清单，仍须为正文和厂商属性写三套查询。[JDBC API：catalog](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/DatabaseMetaData.html#getCatalogs())；[tables](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/DatabaseMetaData.html#getTables(java.lang.String,java.lang.String,java.lang.String,java.lang.String%5B%5D))；[procedures](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/DatabaseMetaData.html#getProcedures(java.lang.String,java.lang.String,java.lang.String))；[functions](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/DatabaseMetaData.html#getFunctions(java.lang.String,java.lang.String,java.lang.String))。

jOOQ 的 `jooq-meta` 可以充当 schema crawler，并可配置 MySQL/PostgreSQL/SQL Server 元数据库类；但其核心产物是 code generation/schema model，且官方说明商业 edition 才有部分数据库驱动和 procedure/function/trigger 等能力。[codegen 配置](https://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/)；[商业功能边界](https://www.jooq.org/doc/latest/manual/reference/commercial-only-features/)。这与 DataPull 的 MIT Node CLI、无额外商业依赖和 SQL 文件交付不匹配。

### 4. Node ORM/查询构建器：连接能力可复用，导出职责不可复用

Knex 的官方配置列出 PostgreSQL、MySQL/MySQL2、MSSQL client，并将 schema API定位为 schema builder/migration。[Knex 文档](https://knexjs.org/guide/#installation)；[schema builder](https://knexjs.org/guide/schema-builder.html)。Kysely 同样提供 dialect 层，但其 schema module 是 DDL builder，非反向 DDL exporter。[Kysely schema API](https://kysely.dev/docs/category/schema-module)。

Sequelize v7 将 dialect 拆为独立包，官方升级文档明确提到 MySQL 和 MS SQL Server 驱动适配；TypeORM 的支持矩阵涵盖 MySQL、PostgreSQL、MS SQL Server，但其 `synchronize` 明确是把实体同步至数据库。二者都将应用模型作为真相源，天然遗漏未映射的视图、过程、触发器、扩展和 DBA 创建对象。[Sequelize dialect](https://sequelize.org/docs/v7/other-topics/upgrade/)；[TypeORM 支持数据库](https://typeorm.io/docs/drivers/database-types/)；[TypeORM synchronize](https://typeorm.io/docs/help/faq/#how-do-i-update-a-database-schema)。

Prisma ORM 7 三库连接与 `db pull` 可用，但官方将 introspection 定义为写入 Prisma data model，涵盖 tables、columns、indexes、constraints 的映射；这不是 SQL DDL export，也未给出 stored logic 全覆盖承诺。更重要的是，Prisma ORM 8 的官方页面将 MySQL 和 SQL Server标为尚未具备对应库，故不能假设其主版本升级稳定延续本任务所需三库能力。[Prisma 7 支持矩阵](https://docs.prisma.io/docs/orm/reference/supported-databases)；[`db pull` 语义](https://www.prisma.io/docs/orm/v7/prisma-schema/introspection)；[Prisma 8 状态](https://www.prisma.io/docs/orm/supported-databases)。

### 5. 单数据库/错误问题域候选

dbmate 官方 README 的 database drivers 只列 PostgreSQL、MySQL、SQLite、ClickHouse，没有 SQL Server；Skeema README 明确服务 MySQL/MariaDB。二者可作为单引擎迁移生态参考，不能满足 DataPull 三库统一 exporter 目标。[dbmate README](https://github.com/amacneil/dbmate/blob/main/README.md)；[Skeema README](https://github.com/skeema/skeema/blob/main/README.md)。

Apache Calcite 的 JDBC adapter 是把 JDBC 数据源暴露给 Calcite 查询/规划的 adapter，不是 schema 反向导出器；Atlas 的 schema inspect/diff 是有吸引力的迁移技术路线，但其免费检查默认只覆盖 schema、table、index、constraint，DataPull 需要的 view、function、procedure、trigger 等属于 Pro，不能替代已有三 exporter。[Calcite JDBC adapter](https://calcite.apache.org/docs/adapter.html#jdbc-adapter)；[Atlas schema inspect](https://atlasgo.io/inspect)。

## Shortlist 与推荐边界

### Shortlist

1. **现有 DataPull exporter + 官方数据库客户端（首选、生产路径）**：保留每个引擎的原生 DDL 获取策略和 DataPull 事务/脱敏/退出码模型。其优势是能针对真实对象遗漏、权限、TLS 和错误语义做精确修补。
2. **`sqldef`（实验性 POC）**：只验证 `--export` 能否减少各引擎 table/view/function/procedure/trigger/type 的实现成本；在容器种子库与真实目标平台做“导出 → 空库重建 → catalog/对象正文逐项比对”后再决定是否局部采用。
3. **Liquibase（非默认的企业 migration/diff 适配器）**：仅当用户需要 Liquibase changelog 工作流、且许可和人工复核流程可接受时提供，不将其 changelog 伪装为完整 SQL dump。

### 明确排除理由

- ORM/Query Builder：强在应用读写和正向迁移，不负责遗留数据库完整对象逆向。
- JDBC/SchemaCrawler/jOOQ：强在跨库元数据和代码生成，无法提供无损、统一、Node 友好的 DDL 交付；jOOQ 另有商业 edition 约束。
- dbmate/Skeema：少于三种目标引擎。
- Calcite：查询/联邦问题域，不是导出问题。

### 若实施 `sqldef` POC 的边界

1. **只读**：DataPull 只允许 `--export`，禁止透传 `--apply`、`--enable-drop`、`--dry-run` 等改变 schema 的选项。
2. **进程适配而非源码嵌入**：下载/校验官方 release 二进制、记录版本/哈希；由 DataPull 用现有受控进程层启动，连接秘密仍放 `credentials.env`，不拼接到日志或命令展示。
3. **统一错误分类由 DataPull 拥有**：外部进程的 exit code/stderr 只作为原始证据，映射为连接瞬态、认证/授权、TLS、对象读取、语法/兼容和未知失败；仅连接瞬态错误可有限重试。
4. **转换层不可省略**：单体 SQL 必须解析/分割到 DataPull 的对象类型与文件事务中；无法可靠归类的语句应完整保留在诊断/原始附件，不得静默丢弃或混入错误对象类别。
5. **验收先于支持声明**：为 MySQL、PostgreSQL、SQL Server 分别构造 table、view、function、procedure、trigger、type/sequence 及平台专有对象种子；验证无业务数据、失败回滚、Windows TLS、权限不足、网络中断、并发和空库还原后再改变公开兼容声明。

## 结论

没有发现一个可无条件替换 DataPull 三套 exporter 的开源 Node 库。`sqldef` 值得以外部只读 CLI 做最小 POC；Liquibase 值得作为企业变更管理可选项；其余候选最多作为元数据、ORM 或开发生态参考。正式产品应继续把“对象完整性、错误分类、重试、安全和文件事务”保留在 DataPull 自己的跨引擎适配层中。
