# DataPull 数据库 Provider/Registry 架构规格

## Problem Statement

DataPull 当前支持 MySQL、PostgreSQL 和 SQL Server。虽然三个数据库已经通过统一 exporter interface 提供列库、连接测试和对象导出能力，但数据库定义仍散落在连接配置、默认端口、URL 协议、对象类型、工具依赖、交互选择、CLI 参数、doctor、错误恢复和 CI 验收等多个位置。

这导致新增一种数据库时必须修改多个核心 module，容易遗漏帮助文档、对象范围、工具诊断或 CI，并使连接校验、重试、进度和错误上下文在不同数据库间逐渐产生不一致。近期出现的“连接验证成功但正式拉取失败”问题也表明，当前 interface 只统一了方法名称，没有统一验证深度、执行策略和错误语义。

用户需要 DataPull 在保持现有命令、配置和结构文件兼容的前提下，将数据库差异集中到单一 Provider seam。未来新增数据库时，维护者应主要实现并登记一个 Provider，而不需要理解或修改完整拉取流程。

## Solution

引入内置数据库 Provider/Registry 架构。

每个 Provider 通过一个声明式 manifest 描述数据库身份、显示名称、认证方式、默认端口、连接 URL 协议、对象类型、默认对象范围、TLS 能力和所需工具，并通过 adapter 实现目标数据库特有的连接探测、数据库枚举、导出就绪校验、DDL 读取和错误分类。

Registry 成为数据库能力的唯一事实来源。CLI、交互向导、连接校验、对象选择、doctor、工具检查和 CI 从 Registry 获取数据库列表及能力，不再维护各自的硬编码分支。

公共执行引擎继续负责工具准备、凭证解析、拉取事务、对象写入、失败回滚和结果生成，并新增统一的操作上下文、进度、超时、有限重试、错误脱敏及取消清理策略。Provider 只描述数据库差异，不接管文件事务或用户配置存储。

现有 MySQL、PostgreSQL、SQL Server exporter 将按行为等价原则迁移为三个内置 Provider。本次重构不新增数据库类型，不改变公开 CLI、结构文件布局或现有连接配置的用户可观察语义。

## User Stories

1. As a DataPull user, I want existing MySQL connections to continue working after the refactor, so that upgrading does not interrupt my workflow.
2. As a DataPull user, I want existing PostgreSQL connections to continue working after the refactor, so that upgrading does not require re-registering credentials.
3. As a DataPull user, I want existing SQL Server password and integrated-authentication connections to continue working, so that platform-specific authentication remains available.
4. As a DataPull user, I want existing CLI commands and options to remain compatible, so that scripts and documentation do not break.
5. As a DataPull user, I want the same object-selection experience for all registered databases, so that I do not need to learn engine-specific command flows.
6. As a DataPull user, I want object names, categories and default selections to come from the selected database Provider, so that the UI never offers unsupported objects.
7. As a DataPull user, I want connection validation to distinguish basic connectivity from export readiness, so that a successful check has clear meaning.
8. As a DataPull user, I want export readiness to use the same credentials and toolchain as the real export, so that failures are discovered before a long-running pull.
9. As a DataPull user, I want progress to identify the current database operation and object count, so that large exports do not appear stalled.
10. As a DataPull user, I want transient read failures to be retried safely, so that brief network interruptions do not fail an otherwise valid pull.
11. As a DataPull user, I want authentication, permission, syntax and unsupported-feature errors not to be retried, so that permanent failures return quickly and clearly.
12. As a DataPull user, I want client error details to remain redacted, so that credentials and connection URLs are not exposed in terminal or JSON output.
13. As a DataPull user, I want selected object types to update atomically, so that partial provider failures never leave a mixed schema snapshot.
14. As a DataPull user, I want unselected object types to remain untouched, so that custom pull scopes preserve existing files.
15. As a DataPull user, I want JSON error codes and result fields to remain stable, so that automation can upgrade without parsing changes.
16. As a DataPull user, I want doctor to report every registered database and its tools automatically, so that environment diagnostics stay complete.
17. As a CLI maintainer, I want one registry to drive engine choices, help text and interactive prompts, so that adding a Provider cannot leave the UI inconsistent.
18. As a CLI maintainer, I want each Provider to declare its own object capabilities and tool requirements, so that engine knowledge remains local.
19. As a CLI maintainer, I want Provider registration to reject duplicate IDs, duplicate object types and invalid manifests at startup or test time, so that configuration mistakes fail early.
20. As a CLI maintainer, I want common retry, timeout, concurrency and process execution policies to be injected into Providers, so that fixes apply across databases.
21. As a CLI maintainer, I want database-specific transient-error recognition to remain inside the relevant Provider, so that common code does not accumulate vendor message patterns.
22. As a CLI maintainer, I want exports to stream objects through the common transaction seam, so that large databases do not require retaining all DDL in memory.
23. As a CLI maintainer, I want each bundled Provider to pass the same contract suite, so that support claims mean the same thing across databases.
24. As a CLI maintainer, I want CI to fail when a registered Provider lacks a compatibility fixture, so that new database support cannot bypass live acceptance.
25. As a future Provider author, I want to add a database by implementing one Provider package, registering it once and supplying acceptance fixtures, so that core orchestration remains unchanged.
26. As a future Provider author, I want a typed runtime for process execution, secrets, progress and retry, so that I do not reimplement cross-cutting behavior.
27. As a release maintainer, I want compatibility evidence to identify the Provider manifest and implementation fingerprint, so that stale platform evidence cannot approve changed database behavior.
28. As a security reviewer, I want Provider installation requirements and trust exceptions to be declared and auditable, so that adding a database cannot silently weaken TLS or install arbitrary software.

## Implementation Decisions

1. The architecture will use a Provider interface and composition. A shared abstract base class may offer optional default helpers, but inheritance will not be required and will not define the public extension contract.
2. Registry will be the only source of truth for bundled database IDs. Adding a bundled Provider requires one explicit registration; automatic filesystem discovery and third-party runtime loading are not part of this work.
3. Each Provider will expose one manifest containing its stable ID, display name, aliases where required for compatibility, default port, supported URL protocols, supported authentication modes, TLS capabilities, object definitions and tool requirements.
4. Each object definition will contain a stable object ID, Chinese display name, selection category, default-selection flag and output identity rules. The existing “全部、常用、高级、自定义” interaction will derive its options from these definitions.
5. Existing custom-selection defaults remain table, view and function. A Provider may omit an unsupported type but may not silently substitute another type.
6. Each Provider adapter will implement basic connection probing, database enumeration, export-readiness probing and DDL export. The adapter will also classify database-specific failures into the common DataPull error taxonomy.
7. Basic connection probing verifies transport, authentication, TLS and server identity/version. Export-readiness probing verifies the target database and selected object metadata using the same credentials and runtime stack used by export.
8. Export-readiness probing must be read-only and bounded. It must not promise that every later network operation cannot fail, but it must detect missing tools, incompatible client versions and obvious metadata or object-definition permission failures before bulk export.
9. The common runtime owns process execution, secret redaction, timeout enforcement, bounded concurrency, progress delivery and retry scheduling. Providers receive this runtime instead of directly creating process dependencies.
10. Only idempotent read operations classified as transient may be retried. The default maximum is three attempts with bounded backoff. Authentication, authorization, TLS policy, SQL syntax, unsupported object and deterministic parsing failures are never retried.
11. Existing DataPull error codes and JSON fields remain compatible. Operation name, attempt count, provider ID, client command and redacted detail may be added as structured diagnostic metadata.
12. DDL export will expose an asynchronous object stream or equivalent pull-based interface. The output transaction consumes the stream, validates each object and commits only after all selected types succeed.
13. The common execution flow remains responsible for project-root discovery, output locking, staging, validation, commit, abort, recent-database recording and final result construction. Providers cannot write directly into the project output directory.
14. Connection configuration keeps existing persisted fields readable without user migration. Core validation will parse the common connection envelope, then delegate Provider-specific validation and normalization to the selected Provider.
15. Unknown or unavailable Provider IDs will produce a specific configuration/provider error without deleting or rewriting the stored connection.
16. SQL Server trust-server-certificate and integrated authentication remain Provider capabilities rather than hard-coded core branches. Unsupported Providers must reject these options consistently.
17. Tool requirements are declared by Providers and resolved through the existing controlled installer mechanism. Provider packages may contribute tool detection and platform installation definitions, but automatic installation continues to require explicit confirmation.
18. Registry validation will reject duplicate Provider IDs, aliases, object IDs and incompatible authentication/tool declarations. The validation runs in tests and before CLI command construction.
19. CLI engine choices, interactive connection fields, object prompts, doctor checks, help summaries and compatibility CI will enumerate Registry entries instead of maintaining separate engine arrays.
20. Compatibility CI retains explicit per-Provider credentials and fixture setup, but adds a completeness assertion requiring every registered Provider to have a live acceptance definition.
21. Compatibility fingerprints include Provider manifests, adapters, shared runtime policies, database fixtures and compatibility runner code.
22. MySQL, PostgreSQL and SQL Server migrate one at a time behind the same interface. Each migration must pass contract and live compatibility gates before the old factory or hard-coded branch is removed.
23. The final implementation removes superseded engine maps and factories rather than leaving parallel sources of truth.
24. The Provider contract is internal to the packaged CLI in this version. It is designed for future extension but is not yet a semver-stable third-party plugin interface.

## Testing Decisions

1. The primary high-level test seam is the pull execution interface. Tests invoke a complete pull with injected connections, tools, Registry and Provider dependencies, then assert returned results, emitted stages and committed or preserved files.
2. Tests assert observable behavior through the pull seam rather than inspecting Provider private methods, internal maps or inheritance structure.
3. A reusable Provider contract suite verifies manifest validity, basic probe behavior, export-readiness behavior, selected-type enforcement, progress, error classification, retry eligibility, secret redaction and clean resource release.
4. Provider contract tests use an injected fake runtime for deterministic process results, timeouts and transient failures. They do not invoke real client binaries.
5. Registry tests verify unique identities, aliases, object definitions and tool declarations and prove that CLI choices, doctor enumeration and object selection are derived from the same Registry.
6. Backward-compatibility tests load existing version-1 connection configurations for all three databases and assert equivalent resolved connections, security warnings and CLI behavior.
7. Existing output transaction tests remain the prior art for atomic commit, preservation of unselected types, collision handling, dangerous-DDL rejection and rollback.
8. Existing process-runner and human/JSON output tests remain the prior art for timeout metadata, exit codes and secret redaction.
9. Retry tests cover transient success after retry, retry exhaustion, non-retryable permission/authentication/TLS failures and preservation of operation/attempt metadata.
10. Streaming tests cover empty exports, large object counts, a failure after partial streaming and cleanup after consumer or provider failure.
11. Selection tests verify all, common, advanced and custom scopes for each Provider and preserve table/view/function as the custom default where supported.
12. Live compatibility CI runs packaged CLI pulls against MySQL, PostgreSQL and SQL Server with at least one supported object of every declared type and validates that no business-data sentinel or secret appears in output.
13. Live acceptance includes a restricted-read account case so a basic connection can succeed while export-readiness correctly reports missing metadata or object-definition permissions.
14. Live or deterministic fault-injection acceptance covers transient connection loss during metadata and object export, confirming bounded retry and atomic rollback.
15. Large-schema acceptance records object counts, duration, concurrency ceiling and progress monotonicity so small fixtures cannot be the only evidence for release.
16. Windows SQL Server acceptance covers password authentication, integrated authentication where infrastructure permits, trusted and untrusted certificate behavior, localized stderr and PowerShell/SMO dependency checks.
17. Release checking rejects compatibility evidence produced before a Provider or shared runtime fingerprint changed.
18. A migration step is complete only when legacy and Provider-backed implementations produce equivalent object identities, counts and normalized DDL for the same fixture, or when an intentional difference is documented and accepted.

## Out of Scope

- Adding Oracle, SQLite, MariaDB or any other new database Provider.
- Replacing native database exporters with `sqldef`, Liquibase, Atlas, SchemaCrawler or an ORM.
- Publishing a third-party Provider SDK or dynamically loading external Provider packages.
- Changing the public CLI command hierarchy, existing option names or exit-code contract.
- Exporting business data, users, passwords or mutable server configuration.
- Changing the existing structure-file directory layout or naming contract except where required to preserve an already-supported object identity.
- Redesigning the terminal UI beyond deriving existing choices and labels from Provider manifests.
- Automatically trusting unverified TLS certificates or broadening installation permissions.
- Releasing, publishing to npm, committing or pushing the implementation as part of this specification task.

## Further Notes

- The preceding open-source evaluation found no library that can safely replace all DataPull exporters. `sqldef` remains a possible future read-only backend POC, but the Provider/Registry seam must exist independently of that decision.
- The current implementation already has a small exporter interface and a common pull transaction. This work deepens that existing seam instead of introducing a second orchestration path.
- The design deliberately keeps database-specific DDL knowledge local while centralizing lifecycle policy. A future Provider should not need to know output-directory locking, configuration persistence or interactive UI details.
- Implementation should preserve the dirty shared worktree and isolate this refactor from the pending PostgreSQL reliability and release changes.
