# skills/ — agent skills for koyu

An [agent skill](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
is a folder of instructions an AI client loads locally — the frontmatter
`description` decides when it triggers, the body is read on demand, and nothing
travels over a tool call. The knowledge for *writing* muro belongs here; the
deterministic judgement (`check`, the derivations) stays in the processor, which
agents reach through the CLI or `koyu-mcp`.

One skill ships today:

| Skill | Teaches |
|---|---|
| [koyu-design/](koyu-design/SKILL.md) | Designing buildings in muro — band-first authoring, circulation before rooms, the checker loop, worked examples that check green |

## Installing

**Claude Code** — copy or symlink into your skills directory:

```bash
ln -s "$(pwd)/skills/koyu-design" ~/.claude/skills/koyu-design
```

(or `.claude/skills/` inside a project, to share it with that project's agents.)

**Claude.ai and Claude Desktop** — zip the folder and upload it under
Settings → Skills:

```bash
cd skills && zip -r koyu-design.zip koyu-design
```

## Discipline

- The examples under `koyu-design/examples/` are gated by `npm run check:examples`
  — the same gate as [examples/](../examples/).
- `koyu-design/REFERENCE.md` is a working subset of the notation. The norm lives
  in [docs/reference/muro](../docs/reference/muro/index.md); if behaviour
  changes, fix both in the same change.
- This directory is deliberately **outside the npm package** (`files` in
  package.json does not list it): a skill is installed by copy or zip, versioned
  with the language here, and is not needed at runtime.
