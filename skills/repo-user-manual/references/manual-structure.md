# Manual Structure

Adapt the structure to the product. Organize around user goals and real workflows, not source directories or backend domains.

Use `docs/user-manual/README.md` as the stable entry point. Put substantial task groups in `sections/` and keep their filenames stable so external links and coverage IDs survive wording changes. Do not create one file per button or duplicate the same workflow for each menu entry.

## Recommended document

1. Product name and purpose.
   - Show the current manual version and last-updated date near the beginning.
   - Link to `CHANGELOG.md` as “操作手册更新记录” or an equivalent localized label.
2. Intended readers.
   - For role-scoped output, name the requested role or roles.
   - For all-role output, explain that each function carries its own permission statement.
3. Before you begin.
   - Sign-in and environment prerequisites.
   - Required accounts, permissions, or initial business data.
   - Important conventions visible in the product.
4. Navigation or quick start.
5. Task-oriented modules and workflows.
6. Common status meanings or a user-facing glossary, only when needed.
7. Troubleshooting and safe recovery.
8. Known documentation gaps, only for unresolved user-relevant facts.

## Function section

Use a localized equivalent of this pattern for each user goal:

```markdown
## <What the user wants to accomplish>

<One short explanation of the outcome and when to use it.>

**权限说明：** <All applicable roles and access restrictions. Required when no role was specified.>

**开始前：** <Required data, status, permission, or preceding action.>

1. Open **<visible menu or page label>**.
2. Select **<visible control>**.
3. Enter or choose <required information>.
4. Select **<visible confirmation action>**.

**完成结果：** <What the user sees and how to verify success.>

**注意：** <Consequences, limitations, timing, or safe recovery, when relevant.>
```

Omit empty fields rather than adding boilerplate, except that permission information is mandatory in all-role output. For role-scoped output, state role differences only when multiple requested roles behave differently.

## Screenshots

Use screenshots to clarify real actions or state changes. Capture the smallest useful area while keeping enough context to locate the control. Add a concise accessible description. Do not place a gallery at the end or use screenshots as a substitute for written steps.

If a screenshot cannot be captured, use a consistent marker such as `> 待补充真实界面截图` and explain the limitation in the delivery summary. Never generate a simulated product screenshot and present it as evidence.

## Language

Write all explanations, headings, notes, and image descriptions in the selected language. Keep actual UI labels unchanged so the reader can find them. Avoid bilingual duplication unless the user requests it or the UI itself mixes languages.

Use the product's established terminology consistently. Prefer visible names over internal synonyms and avoid translating branded names, account types, or domain terms when the product treats them as fixed labels.
