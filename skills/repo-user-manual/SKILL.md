---
name: repo-user-manual
description: 基于现有软件仓库及可用运行界面创建、增量更新、优化或纠正最终用户操作手册；适用于需要按语言与角色范围核对路由、权限、真实界面、测试和代码证据的手册任务，不适用于开发、API、部署或架构文档。
---

# Repository User Manual

Produce a source-grounded manual that explains what real users can do and see. Repository code is evidence, not prose to expose to the reader.

## Resolve the request

Apply explicit user choices first. For omitted choices, use these defaults without asking for confirmation:

- Language: Simplified Chinese (`zh-CN`).
- Role scope: all discoverable end-user roles.
- Product scope: the complete user-facing application represented by the repository.
- Output: the canonical manual directory is `docs/user-manual/`.

Do not infer language or role from a machine path, account name, source-code language, or locale of the development environment. When the requested language differs from labels in the actual UI, keep each control label exactly as displayed and explain it in the requested language.

## Choose creation or update mode

Inspect `docs/user-manual/` before researching the product.

- If no manual exists, use creation mode: perform complete discovery, create the manual directory and coverage metadata, then record the first baseline.
- If a manual and `.repo-user-manual/state.json` exist, use incremental-update mode: read [incremental-update.md](references/incremental-update.md), calculate changes before editing, and research only the affected and dependency-adjacent product areas.
- If a manual exists without state metadata, use adoption mode: preserve its useful content, perform one full reconciliation against the current repository, create coverage metadata, and establish a baseline. Do not pretend that changes before this baseline were detected reliably.
- If the existing manual is outside the canonical directory, do not silently break published URLs. Plan a move to `docs/user-manual/`, update inbound links and publishing configuration, and ask before proceeding when the move changes externally visible URLs.

Incremental mode narrows discovery; it does not lower evidence or quality requirements. Permission, navigation, shared terminology, or global workflow changes can affect many sections and require a wider review.

## Discover before writing

Read [repository-discovery.md](references/repository-discovery.md) and build an internal feature inventory before drafting. Inspect the project root and use a repository-native code index when one exists. Otherwise search the repository directly.

Identify:

- user-visible applications, entry points, navigation, pages, dialogs, and actions;
- roles, permissions, organization or tenant boundaries, and state-dependent availability;
- prerequisites, happy paths, validation messages, destructive effects, and observable results;
- existing product language, user documentation, screenshots, tests, and confirmed business rules.

Cross-check evidence. Do not publish a feature solely because a backend endpoint, class, configuration flag, or inactive route exists. Do not claim that a flow was tested when it was only inferred from source.

## Apply role scope

When one or more roles are specified:

- Include only features that evidence shows are visible or usable by at least one requested role.
- Include shared prerequisite steps only when the requested role can perform or observe them.
- Exclude administrator setup and other-role actions unless the reader must request them; in that case, state the prerequisite in business language without documenting the inaccessible procedure.
- If access differs among multiple requested roles, identify the applicable role beside the affected function.

When no role is specified:

- Include all confirmed user-visible functions.
- Add a `权限说明` or equivalent localized field to every function, naming the roles that can use it and any state or organization restrictions.
- Use “所有用户” only when evidence supports unrestricted access. Mark unresolved access as “权限待确认”; never silently treat it as public.

## Validate the user experience

When a runnable local or test environment is already available or can be started safely, inspect the real UI and verify important paths without changing production data. Prefer read-only or disposable test data. Never submit irreversible, financial, inventory, permission, deletion, or external-message actions merely to obtain documentation evidence.

将被检查项目的应用代码视为严格只读。不得为了 UI 验证或截图新增、修改或格式化源代码、测试、夹具、配置、依赖清单、锁文件、构建脚本或页面状态标记，也不得要求项目配合增加可观测钩子。只允许按手册任务本身写入用户文档、手册图片和 `.repo-user-manual/` 元数据；临时浏览器材料应写到仓库外或可安全清理的临时目录。

需要捕获真实界面截图时，先阅读并执行 [ui-screenshot-capture.md](references/ui-screenshot-capture.md)。根据项目现有能力和当前环境选择可观测性最高且不会修改项目代码的工具；不限定技术栈或某一种 E2E 框架。截图只有在页面身份、目标内容、加载结束、业务终态和短时稳定性均得到验证后，才能作为手册素材。

Capture real screenshots for action steps when practical. Place each screenshot directly after the step it illustrates and exclude developer tools, internal identifiers, secrets, or unrelated account data. Never fabricate screenshots. If the UI cannot be reached or screenshot readiness cannot be proven, write precise text from the strongest available evidence, mark screenshots as pending, and disclose that limitation at handoff. A diagnostic capture of a loading, error, or partially rendered state is not manual evidence.

If authentication blocks validation, use credentials only when the user has supplied or explicitly authorized access to them. Do not guess credentials or save secrets in the manual or repository.

## Write for end users

Read [manual-structure.md](references/manual-structure.md) when creating or substantially reorganizing a manual.

- Use plain business language and describe screens, labels, actions, outcomes, and recovery steps.
- Use one user action per numbered step, in the order the user performs it.
- Preserve exact visible labels for menus, buttons, tabs, fields, statuses, and messages.
- Explain prerequisites, consequences, restrictions, and how the reader confirms success.
- Separate confirmed behavior from assumptions. Use a visible “待确认” note rather than inventing missing behavior.
- Never expose ticket numbers, feature-flag names, source paths, commits, classes, methods, APIs, tables, queues, infrastructure, or other internal implementation details.
- Do not copy internal comments or engineering notes into the manual. Translate relevant facts into user-observable behavior.

If an existing manual contains deliberate product writing, preserve it unless evidence shows it is obsolete. Update affected sections and navigation rather than replacing unrelated material.

## Record the result

For creation, adoption, and every reviewed update, follow [incremental-update.md](references/incremental-update.md). Keep user-facing content and machine metadata separate:

- `CHANGELOG.md` explains manual versions in user-facing language without commits or internal source paths.
- `.repo-user-manual/coverage.json` maps manual sections to source evidence.
- `.repo-user-manual/state.json` records the latest Git baseline, source and manual hashes, scope, and revision.
- `.repo-user-manual/runs/` keeps append-only generation records.

Do not rewrite the baseline until research, manual edits, links, permissions, and screenshots have been reviewed. If repository changes do not affect the manual, record a no-impact run with the same manual version so those changes are not investigated again.

## Completion standard

Before finishing, verify that:

- the requested or default language and role policy were applied consistently;
- every documented function has an entry point, prerequisites, steps, expected result, and relevant restrictions;
- all-role manuals include a permission statement for every function;
- role-scoped manuals contain no known inaccessible features;
- dangerous or irreversible operations include a clear impact and confirmation step;
- no internal identifiers or fabricated screenshots remain;
- every retained screenshot passed the readiness gate in `ui-screenshot-capture.md` and contains no unintended loading, skeleton, transition, error, or partially rendered state;
- UI validation and screenshot capture did not modify application code, tests, fixtures, configuration, dependencies, build files, or runtime instrumentation;
- links and image paths resolve, and the manual's contents match its section navigation;
- coverage metadata maps every maintained manual section to its current source evidence;
- `CHANGELOG.md`, the manual version, and the saved baseline agree;
- the handoff distinguishes source-derived coverage from flows actually validated in the UI and lists remaining evidence gaps.
