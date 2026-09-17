# Incremental Update and Versioning

Use this workflow whenever a manual already exists, when adopting legacy documentation, or when recording a completed initial generation.

## Canonical directory

Keep the manual and its lifecycle metadata together:

```text
docs/user-manual/
|-- README.md                         Manual entry and navigation
|-- sections/                         Task-oriented manual chapters
|-- images/                           Real screenshots used by the manual
|-- CHANGELOG.md                      User-facing manual version history
`-- .repo-user-manual/
    |-- coverage.json                 Section-to-source evidence map
    |-- state.json                    Current generation baseline
    `-- runs/                         Append-only baseline records
```

Do not duplicate complete manual copies for each version. Git owns content history; `CHANGELOG.md` explains user-relevant changes, while `runs/` records reproducible generation metadata.

The metadata directory is maintained by the skill and is not linked from the public manual navigation. It stores paths, hashes, role/language scope, and Git identifiers, never source contents, credentials, tokens, or customer data.

## Coverage map

Create `.repo-user-manual/coverage.json` before the first snapshot. Use repository-relative POSIX paths and keep patterns narrow enough to explain why a section is affected.

```json
{
  "schemaVersion": 1,
  "globalSources": [
    "apps/web/src/router/**",
    "apps/web/src/permissions/**",
    "apps/web/src/locales/**"
  ],
  "sections": [
    {
      "id": "receiving",
      "documents": ["sections/receiving.md"],
      "sources": [
        "apps/web/src/views/receiving/**",
        "services/inventory/src/receiving/**",
        "tests/e2e/receiving/**"
      ]
    }
  ]
}
```

Each `id` is stable across renames. `documents` are relative to `docs/user-manual/`. `sources` and `globalSources` are relative to the repository root and may name files, directories, or glob patterns.

- Put shared navigation, permission, terminology, and application-shell sources in `globalSources`; changing one triggers review of every section.
- Map a source to every section whose user-visible contract depends on it.
- Update the map when a section or source area is added, removed, split, or renamed.
- Do not use catch-all patterns such as `**/*` merely to make coverage appear complete.

## Lifecycle helper

Use `scripts/manual_state.py` from this skill. Resolve both the skill directory and repository root to absolute paths.

Before an incremental edit, calculate the change plan without modifying metadata:

```text
python <skill-dir>/scripts/manual_state.py plan --repo <project-root>
```

When the user requests a different edition scope, pass it to the plan, for example `--language en --role warehouse-manager`. Use `--role '*'` to switch a role-specific manual back to the all-role edition. A changed language, role set, or product scope triggers a full reconciliation.

The plan combines:

- committed changes since the recorded baseline when the commit is still an ancestor;
- staged, unstaged, and untracked workspace changes;
- current hashes of mapped source evidence;
- manual-file changes since the last successful run;
- coverage patterns that map changed sources to affected section IDs.

Review `affectedSections`, `globalImpact`, `coverageChanged`, `scopeChanged`, `unmappedChangedPaths`, and `manualChangedPaths`. Unmapped paths are triage candidates, not proof of no impact. Follow imports, routes, callers, permission consumers, shared components, and business-state dependencies around each changed area. Expand the review when a supposedly local change alters global navigation, permissions, terminology, or shared workflows.

After documentation work and validation are complete, save the new baseline:

```text
python <skill-dir>/scripts/manual_state.py snapshot --repo <project-root> --version <manual-version> --language <language> --summary "<short result>" [--role <role> ...]
```

The helper defaults to `docs/user-manual/`. Use `--manual-dir` only when the user explicitly keeps a different path. It creates or replaces `state.json` and adds one immutable record under `runs/`.

Never run `snapshot` before the manual and coverage map are coherent. A snapshot means “this repository/workspace state has been reviewed for this manual scope,” not merely “the command ran.”

## Update workflow

1. Read the current manual, coverage map, state, recent changelog entry, and requested scope.
2. Run `plan` before changing documentation.
3. Classify each changed path as user-visible, permission-related, dependency-adjacent, documentation-only, or no manual impact.
4. Perform targeted repository and UI research for affected sections. A changed file is a lead; observable behavior remains the publication standard.
5. Preserve unrelated manual sections and human edits. Update navigation, cross-links, screenshots, terminology, and coverage mappings when needed.
6. Check for removed or newly unreachable features as well as additions.
7. Validate the updated manual using the main skill's completion standard.
8. Select the manual version, update `CHANGELOG.md` when user-facing content changed, and run `snapshot` last.

If `plan` reports that the recorded commit is missing or not an ancestor, do not guess a Git range. Use the saved file hashes and current coverage as leads, widen the review, and disclose the degraded baseline. If confidence is insufficient, perform a full reconciliation and establish a new baseline.

## Legacy adoption

For an existing manual without metadata:

1. Locate all related manual pages and assets, including files outside the canonical directory.
2. Reconcile the complete manual against current routes, permissions, visible UI, and business behavior.
3. Preserve useful human-authored explanations; correct only unsupported or obsolete claims.
4. Establish the canonical directory and navigation without silently changing published URLs.
5. Create `coverage.json` and `CHANGELOG.md`.
6. Use version `1.0.0` unless the manual already has a credible product-facing version.
7. Run `snapshot` with a summary that states the legacy manual was adopted and fully reconciled.

The first adoption snapshot is the start of reliable incremental tracking. Earlier differences may be discussed as findings, but must not be presented as complete change detection.

## Version policy

Track two values:

- `manualVersion`: a user-facing semantic version recorded in `CHANGELOG.md` and state metadata.
- `revision`: an automatically increasing generation/review count recorded only in metadata.

The manual version describes documentation compatibility and coverage; it is not automatically the same as the product release version. Record the product version separately only when the repository provides a confirmed user-visible release identifier.

Use semantic versions as follows:

- Patch (`1.0.1`): corrections, clearer wording, screenshot refreshes, link fixes, or troubleshooting improvements without changing the documented capability set.
- Minor (`1.1.0`): added, removed, or materially changed user-visible functions, workflows, permissions, or prerequisites.
- Major (`2.0.0`): a deliberately approved manual/product generation change that makes the prior manual structure or audience contract substantially incompatible. Do not choose a major bump merely because many files changed.

When a reviewed repository change has no manual impact, retain `manualVersion`, do not add a user-facing changelog entry, and take a new snapshot with a no-impact summary so the baseline advances.

Each `CHANGELOG.md` entry includes the version, date, affected user tasks, and whether the change added, changed, fixed, or removed behavior. Do not include commit hashes, internal source paths, ticket IDs, or implementation vocabulary in this user-facing file.

## Corrections and optimization

An update request may be driven by repository changes or by manual quality:

- **Correct:** verify the disputed behavior, fix unsupported claims, review dependent sections, bump patch or minor according to user-visible impact, and record the correction.
- **Optimize:** improve task ordering, navigation, terminology, accessibility, screenshots, or recovery guidance while preserving verified behavior; normally bump patch.
- **Update:** investigate Git/workspace deltas and revise only affected content plus necessary shared sections.
- **Full refresh:** rerun complete discovery when the baseline is degraded, coverage is incomplete, roles or product scope changed, or the user requests full reconciliation.

Changing language or switching between all-role and role-scoped manuals changes the coverage contract. Treat it as a full refresh unless separate language/role editions are stored in explicitly requested subdirectories.
