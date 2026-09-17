---
name: repo-user-manual
display_name: 仓库用户手册生成器
display_name_en: Repository User Manual
description: 从现有代码仓库创建、增量更新、优化或校正面向最终用户的操作手册（用户手册 / 使用说明 / 帮助文档），内容以代码、路由、权限、测试与 Git 变更为证据，可按语言与角色裁剪，默认简体中文、全角色；触发词：生成用户手册、写操作手册、更新使用说明、按角色生成手册、仓库使用文档、产品帮助文档。不触发：API 文档、接口文档、部署文档、架构设计说明。
description_zh: 把代码仓库变成能直接交付给最终用户的中文操作手册。自动盘点页面、入口、菜单、按钮、权限与操作路径，按角色裁剪内容，输出 docs/user-manual/ 标准目录；后续可依据 Git 与工作区变更做增量更新，只重写受影响章节，并维护覆盖率映射与版本基线。适合产品交付验收、客户培训、内部操作人员手册。
description_en: Turn a code repository into an end-user operation manual. It inventories pages, entry points, menus, buttons, permissions and action paths, scopes content by language and role, and writes a structured manual under docs/user-manual/. Later runs detect Git and workspace changes, update only affected sections, and maintain section-to-source coverage mapping plus a reviewable version baseline.
category: productivity
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
version: 1.0.0
disable-model-invocation: false
user-invocable: true
author: Shamus.Xia
---

# Repository User Manual

> 中文简要：本技能基于仓库真实代码生成并持续维护「最终用户操作手册」，不写开发者文档（API / 部署 / 架构）。输出目录默认为 `docs/user-manual/`，默认语言简体中文，默认覆盖所有可发现的最终用户角色。

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
- If a manual and `.repo-user-manual/state.json` exist, use incremental-update mode: read @references/incremental-update.md, calculate changes before editing, and research only the affected and dependency-adjacent product areas.
- If a manual exists without state metadata, use adoption mode: preserve its useful content, perform one full reconciliation against the current repository, create coverage metadata, and establish a baseline. Do not pretend that changes before this baseline were detected reliably.
- If the existing manual is outside the canonical directory, do not silently break published URLs. Plan a move to `docs/user-manual/`, update inbound links and publishing configuration, and ask before proceeding when the move changes externally visible URLs.

Incremental mode narrows discovery; it does not lower evidence or quality requirements. Permission, navigation, shared terminology, or global workflow changes can affect many sections and require a wider review.

## Discover before writing

Read @references/repository-discovery.md and build an internal feature inventory before drafting. Inspect the project root and use a repository-native code index when one exists. Otherwise search the repository directly.

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

Capture real screenshots for action steps when practical. Place each screenshot directly after the step it illustrates and exclude developer tools, internal identifiers, secrets, or unrelated account data. Never fabricate screenshots. If the UI cannot be reached, write precise text from the strongest available evidence, mark screenshots as pending, and disclose that limitation at handoff.

If authentication blocks validation, use credentials only when the user has supplied or explicitly authorized access to them. Do not guess credentials or save secrets in the manual or repository.

## Write for end users

Read @references/manual-structure.md when creating or substantially reorganizing a manual.

- Use plain business language and describe screens, labels, actions, outcomes, and recovery steps.
- Use one user action per numbered step, in the order the user performs it.
- Preserve exact visible labels for menus, buttons, tabs, fields, statuses, and messages.
- Explain prerequisites, consequences, restrictions, and how the reader confirms success.
- Separate confirmed behavior from assumptions. Use a visible “待确认” note rather than inventing missing behavior.
- Never expose ticket numbers, feature-flag names, source paths, commits, classes, methods, APIs, tables, queues, infrastructure, or other internal implementation details.
- Do not copy internal comments or engineering notes into the manual. Translate relevant facts into user-observable behavior.

If an existing manual contains deliberate product writing, preserve it unless evidence shows it is obsolete. Update affected sections and navigation rather than replacing unrelated material.

## Record the result

For creation, adoption, and every reviewed update, follow @references/incremental-update.md. Keep user-facing content and machine metadata separate:

- `CHANGELOG.md` explains manual versions in user-facing language without commits or internal source paths.
- `.repo-user-manual/coverage.json` maps manual sections to source evidence.
- `.repo-user-manual/state.json` records the latest Git baseline, source and manual hashes, scope, and revision.
- `.repo-user-manual/runs/` keeps append-only generation records.

Use `scripts/manual_state.py` for the mechanical parts:

```bash
# 计算自上次基线以来的变更影响（增量更新前必做）
python scripts/manual_state.py plan --repo <仓库根目录> --manual-dir docs/user-manual

# 人工复核通过后再写入新基线（版本号必须递增）
python scripts/manual_state.py snapshot --repo <仓库根目录> --manual-dir docs/user-manual \
  --version 1.1.0 --summary "新增导出功能章节，更新权限说明"
```

Do not rewrite the baseline until research, manual edits, links, permissions, and screenshots have been reviewed. If repository changes do not affect the manual, record a no-impact run with the same manual version so those changes are not investigated again.

## Completion standard

Before finishing, verify that:

- the requested or default language and role policy were applied consistently;
- every documented function has an entry point, prerequisites, steps, expected result, and relevant restrictions;
- all-role manuals include a permission statement for every function;
- role-scoped manuals contain no known inaccessible features;
- dangerous or irreversible operations include a clear impact and confirmation step;
- no internal identifiers or fabricated screenshots remain;
- links and image paths resolve, and the manual's contents match its section navigation;
- coverage metadata maps every maintained manual section to its current source evidence;
- `CHANGELOG.md`, the manual version, and the saved baseline agree;
- the handoff distinguishes source-derived coverage from flows actually validated in the UI and lists remaining evidence gaps.
