# AGENTS.md — for agents working on koyu

koyu is a notation for writing architecture as text (`.muro`) and its processor. Space is the primary element, a wall is not a thing but the relation "the boundary between two spaces", and plans, areas and circulation are not written but derived.

This page is a **map and a body of law**, not a copy of the explanations. The same fact is never written twice — when in doubt, read the link rather than this page.

**The published documentation (`docs/`) is authoritative.** What is promised and what is not is in [docs/reference/scope.md](docs/reference/scope.md); the faces that freeze are in [docs/reference/stability.md](docs/reference/stability.md). If you change behaviour, fix those pages in the same change.

> **There is one canon.** There used to be two books — `spec/` (normative) and `guide/` (the book to learn from) — with "if they disagree, `spec/` is right". On 2026-07-28 the governance inverted and the published documentation became authoritative; on 2026-07-30 the two old books were folded away and deleted. **The norm exists only in `docs/`.**

**ADRs are not published.** They remain in the repository as history, but no page under `docs/` may reference them — an ADR records a decision at a point in time and is never edited afterwards, so the older it gets the further it drifts from what is currently true. `npm run gate:docs` enforces this by machine. Nor do we cite ADR numbers as grounds for a law (this page cites none) — citing one delivers stale context to the reader.

## Map of the files

| Place | Contents | Discipline when touching it |
|---|---|---|
| `src/core/` | **The frozen region** — `parse.ts` (composition) `model.ts` `vocabulary.ts` (the attribute ledger) `poly.ts` (the single slab of geometry) `diagnose.ts` (diagnostics for structural consistency; `checkDiagnostics` is a sequence of clauses whose granularity is **one scan**) `graph.ts` `vertical.ts` (vertical circulation) `fabric.ts` (floors, ceilings, roofs) `light.ts` `site.ts` `diff.ts` | **It must be clean.** Zero runtime dependencies. If you change behaviour, fix the published documentation and the tests in the same change. |
| `src/validate/` | **The region that does not freeze** — architectural judgement (`access.ts` `envelope.ts` `light.ts` `runs.ts` `site.ts`). Returns `Finding { rule, level }`. | **It may be dirty.** Add to it freely, throw parts away freely. One condition only — it must never be confused with what core guarantees. |
| `src/draw/` | **The region that does not freeze** — `plan.ts` `axo.ts` (SVG generation). Outside the freeze ([docs/reference/stability.md](docs/reference/stability.md)). | Appearance may change freely. **The shape may not.** |
| directly under `src/` | `index.ts` (the public surface) `cli.ts` `mcp.ts` `parse-file.ts` | `test/domains.test.ts` enforces the one-way dependency by machine. |
| `docs/` | **The published documentation. This is authoritative.** One tree, in English (`npm run gate:docs` counts the pages and checks every one is reachable). `start/` (tutorial) `why/` (explanation) `howto/` (procedures) `reference/` (normative — `muro/` `diagnostics/` `validate/` `cli/` `mcp/` `api/` `form/` `json/`) `examples/` `glossary.md` | **One page, one job.** Keep each page self-contained — never delegate to an ADR. If you change behaviour, fix the relevant page in the same change. |
| `docs/decisions/` | **ADRs** — why it was decided this way and what was rejected. **Not published.** | Decisions are append-only. **Never edited afterwards** (editing destroys the point of the record). To reverse one, write a new ADR. |
| `docs/log/` `docs/reviews/` | Work records and design reviews. **Not published.** | |
| `docs/policy.md` and the other loose .md files | `policy.md` `writing-architecture.md` `modules.md` `horizon.md` `ifc-coverage.md` `terminology.md`. **Unpublished** raw material. | |
| `examples/` | The bundled buildings — `two-rooms` `office` `mansion` `house.muro` `house/` `tower/` `basement/` (the minimal example of vertical circulation) `complex/` (31,606 m2 gross) `twin/` (a twin-tower redevelopment of 141,449 m2 gross) `comparison/`. `steps/` holds where each stage of the [tutorial](docs/start/index.md) lands. | Once touched, `npm run check:examples` is the gatekeeper. |
| `conformance/` | **The substance of muro's definition.** Each case is complete with inputs and expectations alone and references not a single function of the processor — an implementation in another language can sit the exam. 128 cases, 103 normative statements. Expectations come in four kinds (the canonical form as bytes; diagnostics and the shape structurally; one point of the shape by JSON Pointer). Judgements from `validate` are excluded (that face does not freeze). | **Keep cases minimal.** An expectation may start as the implementation's output, but confirm one at a time that the norm actually says so — an expectation that is merely a copy turns misbehaviour into canon. Pin equivalences with pairs (a single case is no more than a copy of the implementation). |
| `test/` | `node --test`. `domains.test.ts` (separation of the regions) `composition.test.ts` (the six rules of composition) `diagnostics.test.ts` (the diagnostics contract) and others. | Guarantees are fixed by tests. Prose in a specification has not landed anything. |
| `eval/` | The harness for agent-editing evals (`run.ts` `score.ts` `tasks/` `fixtures/` `control/`). | |
| `skills/` | Agent skills, one per question the processor answers — [koyu-design](skills/koyu-design/SKILL.md) writes a building (`check`), [koyu-validate](skills/koyu-validate/SKILL.md) judges and repairs one (`validate`), [koyu-revise](skills/koyu-revise/SKILL.md) changes one without breaking the rest (`diff`). Installed by copy or zip ([skills/README.md](skills/README.md)); deliberately outside the npm package. | Its examples sit under `check:examples`. The notation subset and the rule table are restatements — if behaviour changes, fix the skill and the page under [docs/reference/](docs/reference/index.md) in the same change. **Every muro fragment in a skill must check green**; it is the most-copied text we ship. |
| `editors/vscode/` | Editor support ([docs/reference/cli/editor.md](docs/reference/cli/editor.md)) — `syntaxes/koyu.tmLanguage.json` is **the one grammar** (shared by VS Code and Shiki/Docusaurus); `extension.js` only relays `koyu check --json`. | Add a word and fix the grammar too. `test/grammar.test.ts` binds it to the implementation and the ledger. |

## Commands

```sh
npm test                    # every test (node --test, run directly through tsx)
npm run typecheck           # tsc --noEmit
npm run check:examples      # whether every bundled example passes check — changing the notation breaks this
npm run conformance         # the conformance suite — muro's definition itself (conformance/README.md)
npm run build               # emit dist/

npx tsx src/cli.ts check    examples/two-rooms.muro         # the gatekeeper for structural consistency (it says nothing about architectural validity)
npx tsx src/cli.ts validate examples/tower/main.muro        # architectural judgement (not a guarantee of check)
npx tsx src/cli.ts layers   examples/house/main.muro --attrs # the strength order of the layers, and the provenance of each attribute
npx tsx src/cli.ts check bad.muro --json                    # with diagnostic codes (the human-facing output carries no codes)
npx tsx src/cli.ts check bad.muro --strict                  # warnings also exit 1
npx tsx src/cli.ts plan  examples/office.muro -l L2 -o out/office-L2.svg
npx tsx src/cli.ts axo   examples/complex/main.muro -o out/axo.svg   # solids come out as SVG too
npx tsx src/cli.ts doors examples/mansion.muro /L9/A/ldk /out
npx tsx src/cli.ts json  examples/two-rooms.muro            # canonical JSON
```

The subcommands are `check` `validate` `layers` `diff` `plan` `axo` `doors` `graph` `stats` `levels` `runs` `light` `site` `json`. The contract and the actual output for each has its own page under [docs/reference/cli/](docs/reference/cli/index.md).

There is no dedicated `--help`. A call missing its arguments (including `--help`) prints the usage and returns **exit code 2**. The usage lines omit `plan`'s `-l/-o` and `doors`'s two path arguments, so for those read [docs/reference/cli/plan.md](docs/reference/cli/plan.md) and [doors.md](docs/reference/cli/doors.md).

## The MCP server

`koyu-mcp` is a dependency-free stdio MCP server ([docs/reference/mcp/](docs/reference/mcp/index.md)). It is stateless: every tool takes the entry `.muro` path as `file` and composes from scratch each time. The source of truth is the filesystem and the history belongs to git.

There are 12 tools — `model_summary` `check` `layers` `write_layer` `new_uids` `doors` `spaces` `light` `validate` `site` `plan_svg` `canonical_json`.

The standard loop is this.

```text
model_summary → layers → write_layer → check ──error──→ fix it and go back to write_layer
                                         └───green───→ confirm the consequences with doors / light / site
```

`write_layer` writes by whole replacement and has no undo. **Commit before letting anything write.** Registration is in [docs/howto/install-mcp.md](docs/howto/install-mcp.md), a worked example of the loop is in [agent-loop.md](docs/howto/agent-loop.md), and if you get stuck see [debug-mcp.md](docs/howto/debug-mcp.md). The tool contracts are in [docs/reference/mcp/](docs/reference/mcp/index.md).

## The laws of this undertaking

1. **check is the gatekeeper.** Do not say you are done until `npm test`, `npm run check:examples`, `npm run gate:examples`, `npm run gate:docs`, `npm run conformance` and `check` on the file in question are all green.
2. **Green from check does not mean the building works.** All `check` says is "what is written is not self-contradictory as data" ([docs/reference/scope.md](docs/reference/scope.md)). Architectural validity is what `koyu validate` says, separately. Because the default between touching spaces is a wall ([docs/reference/muro/defaults.md](docs/reference/muro/defaults.md)), a two-storey building that declares no door at all is **completely sealed while staying green**. Never claim "it works" on the grounds that it is green.
2b. **Do not mix the regions** ([docs/why/three-domains.md](docs/why/three-domains.md)). Do not add judgement to core. core returns `Diagnostic { code, severity }` and validation returns `Finding { rule, level }` — different from the type up. Adding a judgement takes one line in `VALIDATION_RULES` and one section under [docs/reference/validate/](docs/reference/validate/index.md), nothing more. **The language version does not move.**
3. **A change lands as a set of three — the ADR (why) + a test (the guarantee) + the published documentation (present tense).** A change missing any of them is unfinished.
3b. **Never hand-count a ledger that has a machine source.** The counts and spellings of diagnostic codes, validation rules, subcommands, MCP tools and public exports are cross-checked against the documentation by `test/docs-ledger.test.ts`. That is what killed sentences like "all 49 exports" and "51 diagnostics".
4. **The published documentation is written in the present tense and rewritten in place.** Do not accumulate dates, "addenda", or "in v0.9 this was…". Versions belong to git.
5. **A diagnostic always carries a code, and severity is an attribute of the code** ([docs/reference/diagnostics/index.md](docs/reference/diagnostics/index.md)). The same code is never an error in one case and a warning in another. Add a code and add a section to the right family under [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) (`test/docs-ledger.test.ts` catches omissions).
   **The population is the written declarations, provenance is always present, and the order is the order of the scan** ([docs/reference/diagnostics/reading.md](docs/reference/diagnostics/reading.md)). Check the values of interpreted attributes (the starred ones in the ledger) — never let a value that was written but not interpreted fall silently to a default. When touching `checkDiagnostics`, keep the granularity of the clauses at one scan (splitting by code family breaks the order).
6. **A change to the semantics of the language raises the language version** ([docs/reference/muro/version.md](docs/reference/muro/version.md)). The current one is `koyu 1.0`. What counts as meaning-preserving is defined by [docs/reference/stability.md](docs/reference/stability.md). Write the migration in an ADR and bring the examples up to the newest version.
7. **The ledger is the contract for vocabulary** (the three tiers of attributes in [docs/reference/scope.md](docs/reference/scope.md)). The single source in the implementation is `ATTR_LEDGER` in `src/core/vocabulary.ts`, and [docs/reference/muro/attributes.md](docs/reference/muro/attributes.md) is its copy. **A key absent from the ledger cannot be written unless it carries a namespace (`acme.sensor`)** — the boundary exists to distinguish "we have not looked at this" from "we looked and it is fine".
8. **Zero runtime dependencies.** Add nothing outside devDependencies.
9. **Examples are written in the newest language version.** Introduce new notation and bring the examples along — the release test checks this.
10. **When writing a document, paste only output you actually ran.** Never paste guessed output.
11. **Everything inside code is written in English** — comments, identifiers, test names, assertion messages, and the `description` fields of a JSON Schema. **The published documentation is English too** — its reader is a machine, and the processor already answers in English everywhere it speaks. Japanese survives only where the reader is a person and the page is not published: the ADRs under `docs/decisions/`, and the working notes at the top of `docs/`.

## When you hit an error

The human-facing output of `check` carries no diagnostic codes. Add `--json` and the codes appear. To go from a code to the cause and the fix, use [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) — all 65 codes have a page per family carrying the code, its severity, and how to fix it. To go from a symptom, use [docs/howto/by-symptom.md](docs/howto/by-symptom.md).

There are three traps people hit often. `grid` and `level` have no effect unless declared **before** use (`boundary` may forward-reference). To divide a space into a plan, make the parent a `zone` rather than a `space`. An opening onto the outside has several boundary segments, so select the edge with `edge:N/E/S/W` (N=+Y, S=-Y, E=+X, W=-X). Details are in [docs/howto/troubleshooting.md](docs/howto/troubleshooting.md).

## If you do not know the notation itself

Work through [docs/start/](docs/start/index.md). In 30–45 minutes it reaches a two-storey building and its plan. The reasons behind the shape of the notation are in [docs/why/](docs/why/index.md), and the list of syntax is in [docs/reference/muro/](docs/reference/muro/index.md) (one page per declaration, with an index holding all the syntax on one sheet).
