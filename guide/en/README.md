**English** · [日本語](../README.md)

# guide/ — learning koyu

koyu is a notation for writing architecture as text. Space is the primary element; a wall is not a thing but **the boundary relation between two spaces**; and a plan drawing is not drawn but generated from the layout of spaces. A whole building fits in a few hundred lines of `.muro`, and `koyu check` is the gate on its consistency.

This folder is **the book for learning**. What is true is held by [spec/](../../spec/en/README.md); guide/ holds **what order to learn it in** and **how to do things**. The two are companions, and whenever guide/ states a normative fact it links to the section of spec/ that owns it. Where they disagree, spec/ is right.

## If this is your first time

Work through [start.md](start.md) from the top, writing exactly what it says. It takes 30–45 minutes. What you will have at the end is one 30-line `.muro` file, a plan drawing (SVG) for each level, and answers to "how many doors from the upstairs bedroom to the street?" and "do the habitable rooms get enough daylight?". No choices appear — it is built so you can pass through once without hesitating.

Each stage's endpoint is kept as a working file under [examples/steps/](../../examples/steps/), so if things stop matching you can compare against them.

**A note for English readers.** The tool's own output — `✔ 整合 — 空間 3 / 境界 3`, the diagnostic messages — is in Japanese, and this guide pastes it exactly as it appears rather than translating it, with a gloss alongside. Reading the output is part of using the tool, so it would not help you to be shown something the terminal never prints.

## The map of the documents

**For learning** — read these through, in order.

| Document | Contents | Reader |
|---|---|---|
| [start.md](start.md) | **The tutorial** — one room to a two-storey house, on a single track. Instructions only, no choices (30–45 min) | Anyone new to koyu. **Start here** |
| [concepts.md](concepts.md) | **Explanation** — the six ideas you need before the syntax reads. What it means that something is *not* written (10 min) | Anyone who has written one file; anyone who wants the reasons behind the shape |
| [gallery.md](gallery.md) | **Worked examples** — the five bundled buildings in order of difficulty, with generated drawings and measured figures. What each one is the first to demonstrate | People who prefer to start from pictures; people wondering what to write next (optional) |

**For looking things up** — open only the part you need. Not to be read through.

| Document | Contents | Reader |
|---|---|---|
| [cheatsheet.md](cheatsheet.md) | Every construct on one page. Each heading jumps to the owning section of spec/ | Anyone who needs reminding how something is written |
| [howto/](howto/README.md) | Eight recipes, indexed by goal — add a level, subdivide a dwelling, daylight, doors and egress, site and floor area ratio, splitting into files, connecting an agent, and getting unstuck | Anyone whose hands have stopped |
| [diagnostics.md](diagnostics.md) | All 51 diagnostic codes with the **cause**, the **fix**, and a minimal reproduction. Looked up from the error text | Anyone `check` has told off |
| [glossary.md](glossary.md) | A one-sentence definition per term, plus where it is normatively defined and where it is actually used | Anyone who has lost the thread of a word |
| [cli.md](cli.md) | Every `koyu` subcommand, from "what does it answer?". With real output | Anyone at the command line |
| [api.md](api.md) | The public TypeScript API, from the side of what you want to do. All 49 exports | Anyone writing a program that embeds koyu (optional) |

**Outside these two books** — what guide/ does not cover.

| Document | Contents | Reader |
|---|---|---|
| [spec/](../../spec/en/README.md) | **The normative reference** — grammar, semantics, the vocabulary ledger, canonical JSON, tool contracts. Present tense only; no reasons | Implementers; anyone who needs an exact definition |
| [docs/decisions/](../../docs/decisions/) | **The ADRs** — why each decision was made and what was rejected (19 of them, in Japanese) | Anyone who wants the reasoning behind the design (optional) |
| [docs/writing-architecture.md](../../docs/writing-architecture.md) | **The argument** — what this notation is for (in Japanese) | Anyone who prefers to start from the motivation (optional) |
| [AGENTS.md](../../AGENTS.md) | The entry point for LLM agents — the file map, the commands, and the laws of this undertaking | Agents working in the koyu repository |

## Reading orders

There are three ways to arrive. Pick yours and read in that order.

### If you want to write (describe a building in .muro)

1. [start.md](start.md) — get your hands moving. **Skipping this makes the rest unreadable**
2. [concepts.md](concepts.md) — grasp what it was that you just wrote
3. Keep [cheatsheet.md](cheatsheet.md) beside you; when you get stuck, look up [howto/](howto/README.md) by goal
4. When `check` gives you an error, [diagnostics.md](diagnostics.md)
5. For what you could write next, [gallery.md](gallery.md)

### If you are building a tool (a program that reads or writes koyu)

1. [start.md](start.md) — write the language once yourself. Reading only the specification leaves the vocabulary without footing
2. [concepts.md](concepts.md) — especially §2 "a boundary is a relation, not a thing" and §5 "the authored source and what is derived"
3. [spec/language.md](../../spec/en/language.md) → [spec/semantics.md](../../spec/en/semantics.md) — the norms: the grammar, and the definitions of derivation, checking, and the queries
4. [spec/canonical-json.md](../../spec/en/canonical-json.md) and [spec/tools.md](../../spec/en/tools.md) — the machine format and the CLI/MCP/API contracts
5. [api.md](api.md) / [cli.md](cli.md) — how to call them, and what actually comes back
6. If you are connecting an agent, [howto/agent-mcp.md](howto/agent-mcp.md)

### If you want the argument (why a notation like this at all)

1. [docs/writing-architecture.md](../../docs/writing-architecture.md) — the essay
2. [concepts.md](concepts.md) — how the argument took shape as a notation
3. [gallery.md](gallery.md) — measured, how far one building can be taken
4. [docs/decisions/](../../docs/decisions/) — the reasons for each judgement, and the alternatives that were rejected
5. [spec/notation-v0.md](../../spec/en/notation-v0.md) — the record of how the notation was chosen out of a DSL/YAML/JSON comparison

## The promises this guide makes

- **Normative facts are owned by spec/.** Whenever guide/ states one, it links to the section that owns it. If you find an assertion here with no link, that is a defect in guide/.
- **What guide/ owns is order, worked examples, and procedure** — plus the cause and the fix for each diagnostic, which the spec deliberately does not carry.
- **The pasted output and drawings are real, from running the thing.** Nothing has been touched up by hand.
- There are four kinds of code fence. <code>```muro</code> is **a complete file that passes as written**; <code>```muro-part</code> is **a fragment** lifted out of context (it will not pass on its own); <code>```muro-bad</code> is **deliberately wrong** and `check` rejects it with an error; <code>```muro-warn</code> **does not error but produces a warning** (`check` passes, `check --strict` does not). After a wrong example, the prose immediately quotes the real diagnostic.
- **Those four marks are verified by running them, in `test/guide.test.ts`.** A <code>```muro</code> really does pass, a <code>```muro-bad</code> really does fail, and a <code>```muro-warn</code> really does produce only a warning. A block whose mark is misspelled — and which would therefore have escaped validation — fails there too. `test/i18n.test.ts` additionally holds this page and its Japanese original to the same code, the same structure, and the same output.
