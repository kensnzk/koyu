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

```sh
for s in koyu-design koyu-validate koyu-revise; do ln -s "$(pwd)/skills/$s" ~/.claude/skills/$s; done
```

(or `.claude/skills/` inside a project, to share them with that project's agents.)

**Claude.ai and Claude Desktop** — zip each folder and upload it under
Settings → Skills:

```sh
cd skills && for s in koyu-design koyu-validate koyu-revise; do zip -r $s.zip $s; done
```

## What holds this directory

A skill is a restatement of things the implementation owns, and a restatement
is a copy that drifts. These rules used to be written here as discipline; each
one now names the gate that keeps it, because a rule nothing checks is a rule
that has already been broken somewhere you have not looked.

- **Every muro block says what it is, and is held to it** — `npm test`, via
  `test/guide.test.ts`, the same gatekeeper as `docs/`. Tag a block that is a
  whole file ` ```muro ` and it must compose and check green; tag a fragment
  ` ```muro-part `. There are also ` ```muro-bad ` (must fail), ` ```muro-warn `
  (warns and nothing more), and ` ```muro-fail ` / ` ```muro-caution ` (produce
  that verdict from `validate`). The tags themselves come from a ledger, so a
  misspelled one cannot let a block slip past unchecked.
- **Every attribute key is in the ledger** — `test/restatements.test.ts`,
  against `ATTR_LEDGER`. This is the one check a fragment can be held to: a
  fragment cannot be parsed, but a misspelling is lexical.
- **Every ledger a skill restates agrees with its source** —
  `test/restatements.test.ts`. The accepted language versions, the diagnostic
  codes, the names of the validation rules. It reads `src/`, so a skill cannot
  go on teaching a version list, a code or a spelling the implementation has
  moved past.
- **The examples under `koyu-design/examples/`** — `npm run check:examples`,
  the same gate as [examples/](../examples/).
- **The norm still lives elsewhere.** `koyu-design/REFERENCE.md` is a working
  subset of [docs/reference/muro](../docs/reference/muro/index.md), and the
  rule table in `koyu-validate` a subset of
  [docs/reference/validate](../docs/reference/validate/index.md). If behaviour
  changes, fix both in the same change — the gates above catch a stale
  spelling, not a stale explanation.

A worked example is the most-copied thing in a skill, so a defect in one
propagates into every building an agent writes. That is why the checking is
machine work now.

This directory is deliberately **outside the npm package** (`files` in
package.json does not list it): a skill is installed by copy or zip, versioned
with the language here, and is not needed at runtime.
