# Repository Discovery

Use this guide to reconstruct the product's user-visible contract before writing. Keep the evidence inventory internal unless the user asks for it.

## Evidence order

Prefer stronger and more user-proximate evidence:

1. Explicit user instructions and confirmed business rules.
2. Existing customer-facing manuals, product copy, release notes, and approved screenshots.
3. A running application and end-to-end tests that exercise the visible flow.
4. Navigation, routes, page components, dialogs, forms, UI validation, and localization files.
5. Role definitions, menu permissions, button-level access checks, workflow guards, seed data, and permission tests.
6. Backend authorization and business rules used to verify visible behavior.
7. Internal names, comments, or unfinished code, which are discovery leads only.

When evidence conflicts, prefer the currently observable product over stale documentation, but report the conflict. Do not silently reconcile behavior that changes access, money, inventory, deletion, approval, or other consequential outcomes.

## Repository pass

Establish the actual project root and look for repository instructions first. If `.codegraph/` or another repository-maintained code index exists, use it before broad text searches. Then locate, as applicable:

- application packages and startup documentation;
- router and menu definitions;
- page/view components and user-visible strings;
- localization resources;
- authentication, role, policy, and permission declarations;
- workflow states and guards;
- end-to-end, browser, integration, and permission tests;
- existing `docs`, help, manual, guide, onboarding, FAQ, and screenshot assets.

Ignore generated bundles, dependencies, build outputs, vendored code, migrations that no longer represent current behavior, and developer-only tools unless they provide evidence required to interpret the user experience.

## Internal feature inventory

For every candidate function, record enough information to support or reject it:

| Item | Required evidence |
|---|---|
| User goal | The business outcome the user is trying to achieve |
| Entry point | Visible menu, page, link, notification, or preceding action |
| Applicable roles | Explicit role/permission evidence or `待确认` |
| Other access limits | Organization, tenant, ownership, state, plan, or feature availability |
| Preconditions | Data or prior actions required before the function is usable |
| Steps | Visible controls and sequence of user actions |
| Success result | Observable page, status, message, record, download, or notification |
| Failure/recovery | User-visible validation and safe next action |
| Evidence | Files, tests, or live states used internally for traceability |
| Confidence | Confirmed in UI, confirmed by multiple sources, source-only, or unresolved |

Group duplicate routes and components by user goal. Do not turn every page, endpoint, tab, or button into a separate manual chapter when they are part of one continuous task.

## Inclusion decisions

Include a function when it has a user-visible entry point and its behavior is supported by reliable evidence. Include state-dependent actions with their state prerequisites. Include read-only views when they answer a real user question.

Exclude:

- unreachable, disabled, experimental, or developer-only surfaces unless the user explicitly includes them;
- backend capabilities without a confirmed user-facing entry point;
- maintenance jobs, internal administration, diagnostics, test fixtures, and implementation mechanisms;
- speculative behavior derived only from names or comments.

When the repository contains multiple user-facing applications, cover each one that is within the requested scope and explain how users enter it. Do not mix separate products into one navigation hierarchy.

## Role filtering

Trace access through menu visibility, route guards, page guards, action-level checks, backend authorization, workflow state, ownership, and organization boundaries. A visible page does not prove that every action on it is available.

For a specified role, include only confirmed accessible functions. If the role name supplied by the user does not exactly match the code, use product labels and documented mappings where available. Ask only when multiple plausible mappings would materially change the manual; otherwise record the assumption in the handoff.

