# Agent Skills by Shamus.Xia

> Open-source agent skills following the [SKILL.md](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) standard. Compatible with Claude Code, Codex CLI, ZCode, ChatGPT, and any agent that supports the open skill format.

## Available Skills

### [`claude-to-zcode`](./skills/claude-to-zcode/SKILL.md)

Migrate engineering configs (skills / commands / hooks / agents / templates / config) from Claude Code to ZCode. Covers protocol adaptation (especially hook stdout JSON protocol), config file conversion, diagnostics, and 12 common pitfalls.

**Install:**

```bash
# Via npx skills (recommended, indexed by skills.sh)
npx skills add phoben/agent-skills

# Or manually: copy skills/claude-to-zcode/ to your agent's skills directory
```

**Trigger examples:**
- "How do I migrate my `.claude/` config to `.zcode/`?"
- "My ZCode hooks keep failing"
- "Adapt this Claude hook to ZCode's JSON protocol"

See the [skill's SKILL.md](./skills/claude-to-zcode/SKILL.md) for full documentation.

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
