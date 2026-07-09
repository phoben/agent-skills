# Agent Skills by Shamus.Xia

> Open-source agent skills following the [SKILL.md](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) standard. Compatible with Claude Code, Codex CLI, ZCode, ChatGPT, and any agent that supports the open skill format.

## Available Skills

### [`claude-to-zcode`](./skills/claude-to-zcode/SKILL.md)

Migrate engineering configs from `.claude` and existing `.zcode`, or normalize `.claude-plugin/.codex-plugin/.zcode-plugin` into ZCode workspace resources and plugin packages. Covers source detection, `.zcode` diff analysis, hook JSON protocol adaptation, config/plugin manifest conversion, and plugin compatibility limits such as non-executable `agents`.

**Install:**

```bash
# Via npx skills (recommended, indexed by skills.sh)
npx skills add phoben/agent-skills

# Or manually: copy skills/claude-to-zcode/ to your agent's skills directory
```

**Trigger examples:**
- "How do I compare `.claude` and existing `.zcode` before migrating?"
- "Help me migrate `.claude-plugin` to `.zcode-plugin/plugin.json`"
- "My ZCode hooks keep failing"
- "Adapt this Claude hook to ZCode's JSON protocol"

See the [skill's SKILL.md](./skills/claude-to-zcode/SKILL.md) for full documentation.

### [`claude-to-trae`](./skills/claude-to-trae/SKILL.md)

Migrate engineering configs from Claude Code, Codex, ZCode, or shared `.agents` resources into Trae's standard project structure. Covers scanning, mapping, transforming, validating, and deciding whether `agents` should become `.trae/skills` or `.agents/skills`.

**Install:**

```bash
# Via npx skills (recommended, indexed by skills.sh)
npx skills add phoben/agent-skills

# Or manually: copy skills/claude-to-trae/ to your agent's skills directory
```

**Trigger examples:**
- "Migrate this project's `.claude/` engineering config to Trae"
- "Scan `.claude`, `.codex`, and `.zcode`, then generate a standard `.trae/` structure"
- "Help me decide whether these agents should go to `.trae/skills` or `.agents/skills`"

See the [skill's SKILL.md](./skills/claude-to-trae/SKILL.md) for full documentation.

## Skill Format

Each skill is a directory containing a `SKILL.md` with YAML frontmatter:

```text
skills/
└── skill-name/
    ├── SKILL.md          (required: name + description frontmatter, markdown body)
    └── (optional)
        ├── references/   (extra docs)
        ├── scripts/      (helper scripts)
        └── assets/       (templates, fixtures)
```

## License

[MIT](./LICENSE) — free for any use, including commercial.
