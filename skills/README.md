# skills/ — agent skills for koyu

An [agent skill](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
is a folder of instructions an AI client loads locally — the frontmatter
`description` decides when it triggers, the body is read on demand, and nothing
travels over a tool call. The knowledge for *working in muro* belongs here; the
deterministic judgement stays in the processor, which agents reach through the
CLI or `koyu-mcp`.

| Skill | The job | The command it leans on |
|---|---|---|
| [koyu-design/](koyu-design/SKILL.md) | Write a building from a brief — band-first authoring, circulation before rooms, worked examples that check green | `check` |
| [koyu-validate/](koyu-validate/SKILL.md) | Judge a building and repair it — unreachable rooms, daylight, the envelope, stairs, the site | `validate` |
| [koyu-revise/](koyu-revise/SKILL.md) | Change a description without breaking the rest of it — add, subdivide, add a storey, rename, as-built | `diff` |

The split follows the one already in the source. `check` freezes and says
nothing about whether a building is any good; `validate` does not freeze and
says exactly that; `diff` speaks in the language of composition. One skill per
question, so none of them has to hedge.

## Installing

**Claude Code** — copy or symlink into a skills directory:

```bash
for s in koyu-design koyu-validate koyu-revise; do ln -s "$(pwd)/skills/$s" ~/.claude/skills/$s; done
```

(or `.claude/skills/` inside a project, to share them with that project's agents.)

**Claude.ai and Claude Desktop** — zip each folder and upload it under
Settings → Skills:

```bash
cd skills && for s in koyu-design koyu-validate koyu-revise; do zip -r $s.zip $s; done
```

## Discipline

- The examples under `koyu-design/examples/` are gated by `npm run check:examples`
  — the same gate as [examples/](../examples/).
- `koyu-design/REFERENCE.md` is a working subset of the notation. The norm lives
  in [docs/reference/muro](../docs/reference/muro/index.md); if behaviour
  changes, fix both in the same change. The same applies to the rule table in
  `koyu-validate` against [docs/reference/validate](../docs/reference/validate/index.md).
- Every muro fragment shown in a skill must be one that actually checks green.
  A worked example is the most-copied thing in a skill, so a defect in one
  propagates into every building an agent writes.
- This directory is deliberately **outside the npm package** (`files` in
  package.json does not list it): a skill is installed by copy or zip, versioned
  with the language here, and is not needed at runtime.
