# AGENTS.md — for agents working on koyu

**muro is the notation** written in `.muro` files; **koyu is the processor that reads it**, and the name of this undertaking. The two carry separate version lines ([docs/reference/stability.md](docs/reference/stability.md)). Space is the primary element, a wall is not a thing but the relation "the boundary between two spaces", and plans, areas and circulation are not written but derived.

This page is a **map and a body of law**, not a copy of the explanations. The same fact is never written twice — when in doubt, read the link rather than this page.

**The published documentation (`docs/`) is authoritative.** What is promised and what is not is in [docs/reference/scope.md](docs/reference/scope.md); the faces that freeze are in [docs/reference/stability.md](docs/reference/stability.md). If you change behaviour, fix those pages in the same change.

> **There is one canon.** There used to be two books — `spec/` (normative) and `guide/` (the book to learn from) — with "if they disagree, `spec/` is right". On 2026-07-28 the governance inverted and the published documentation became authoritative; on 2026-07-30 the two old books were folded away and deleted. **The norm exists only in `docs/`.**

**ADRs are not published.** They remain in the repository as history, but no page under `docs/` may reference them — an ADR records a decision at a point in time and is never edited afterwards, so the older it gets the further it drifts from what is currently true. `npm run gate:docs` enforces this by machine. Nor do we cite ADR numbers as grounds for a law (this page cites none) — citing one delivers stale context to the reader.

## Map of the files

| Place | Contents | Discipline when touching it |
|---|---|---|
| `src/core/` | **The frozen region** — `parse.ts` (composition) `model.ts` (the model, the version ledger `MURO_SUPPORT`, the canonical form) `vocabulary.ts` (the attribute ledger) `poly.ts` (the single slab of geometry) `tolerance.ts` `diagnose.ts` (diagnostics for structural consistency; `checkDiagnostics` is a sequence of clauses whose granularity is **one scan**) `derive.ts` (form) `graph.ts` `vertical.ts` (vertical circulation) `fabric.ts` (floors, ceilings, roofs) `light.ts` `site.ts` `diff.ts` | **It must be clean.** Zero runtime dependencies. If you change behaviour, fix the published documentation and the tests in the same change. |
| `src/validate/` | **The region that does not freeze** — the rule interface and the runner (`contracts.ts` `assessment.ts` `index.ts`). Returns `Finding { rule, level }`. | **It may be dirty.** Add to it freely, throw parts away freely. One condition only — it must never be confused with what core guarantees. |
| `src/validate/builtin/` | The rules koyu itself ships, as a **value** rather than a registration — `access.ts` `daylight.ts` `door-column-collisions.ts` `envelope.ts` `freeze.ts` `site.ts` `vertical-runs.ts`. | Adding a judgement happens here and under [docs/reference/validate/](docs/reference/validate/index.md), and nowhere else. **The language version does not move.** |
| `src/analysis/` | The analysis protocol — `contracts.ts` holds `koyu-context/1`, the input contract `assessment.ts` checks on arrival. | The one versioned contract in the tree that something actually verifies. Keep it that way. |
| `src/draw/` | **The region that does not freeze** — `plan.ts` `axo.ts` (SVG generation). Outside the freeze ([docs/reference/stability.md](docs/reference/stability.md)). | Appearance may change freely. **The shape may not.** |
| directly under `src/` | `index.ts` (the public surface) `cli.ts` `mcp.ts` `parse-file.ts`, and the **subpath entry points** that re-export a domain: `model.ts` `diagnostics.ts` `graph.ts` `form.ts` `diff.ts` `vocabulary.ts`. | `test/domains.test.ts` enforces the one-way dependency by machine; `test/public-api-subpaths.test.ts` holds each subpath's exports against an approved list. |
| `docs/` | **The published documentation. This is authoritative.** One tree, in English (`npm run gate:docs` counts the pages and checks every one is reachable). `start/` (tutorial) `why/` (explanation) `howto/` (procedures) `reference/` (normative — `muro/` `diagnostics/` `validate/` `cli/` `mcp/` `api/` `form/` `json/`) `examples/` `glossary/` `glossary.md` `img/` | **One page, one job.** Keep each page self-contained — never delegate to an ADR. If you change behaviour, fix the relevant page in the same change. |
| `docs/decisions/` | **ADRs** — why it was decided this way and what was rejected. **Not published.** | Decisions are append-only. **Never edited afterwards** (editing destroys the point of the record). To reverse one, write a new ADR. |
| `docs/log/` `docs/reviews/` `docs/notes/` | Work records, design reviews and working notes. **Not published.** | |
| `docs/policy.md` and the other loose .md files | `checklists.md` (what a rippling change must touch, and which gate already holds each part) `policy.md` `writing-architecture.md` `modules.md` `horizon.md` `roadmap.md` `ifc-coverage.md` `ifcx-notes.md` `terminology.md`. **Unpublished** raw material. | |
| `examples/` | The bundled buildings — `two-rooms` `office` `mansion` `house.muro` `house/` `tower/` `basement/` (the minimal example of vertical circulation) `complex/` (31,606 m2 gross) `twin/` (a twin-tower redevelopment of 141,449 m2 gross) `comparison/`. `steps/` holds where each stage of the [tutorial](docs/start/index.md) lands. | Once touched, `npm run check:examples` is the gatekeeper. |
| `conformance/` | **The substance of muro's definition.** Each case is complete with inputs and expectations alone and references not a single function of the processor — an implementation in another language can sit the exam. Expectations come in four kinds (the canonical form as bytes; diagnostics and the shape structurally; one point of the shape by JSON Pointer). Judgements from `validate` are excluded (that face does not freeze). | **Keep cases minimal.** An expectation may start as the implementation's output, but confirm one at a time that the norm actually says so — an expectation that is merely a copy turns misbehaviour into canon. Pin equivalences with pairs (a single case is no more than a copy of the implementation). |
| `test/` | `node --test`. `domains.test.ts` (separation of the regions) `composition.test.ts` (the six rules of composition) `diagnostics.test.ts` (the diagnostics contract) and others. | Guarantees are fixed by tests. Prose in a specification has not landed anything. |
| `eval/` | The harness for agent-editing evals (`run.ts` `score.ts` `tasks/` `fixtures/` `control/`). | |
| `skills/` | Agent skills, one per question the processor answers — [koyu-design](skills/koyu-design/SKILL.md) writes a building (`check`), [koyu-validate](skills/koyu-validate/SKILL.md) judges and repairs one (`validate`), [koyu-revise](skills/koyu-revise/SKILL.md) changes one without breaking the rest (`diff`). Installed by copy or zip ([skills/README.md](skills/README.md)); deliberately outside the npm package. | Its examples sit under `check:examples`. The notation subset and the rule table are restatements — if behaviour changes, fix the skill and the page under [docs/reference/](docs/reference/index.md) in the same change. **Every muro fragment in a skill must check green**; it is the most-copied text we ship. |
| `website/` | The Docusaurus site. It reads `docs/` through `website/scripts/prepare-content.mjs` and the sidebar is **derived from the published tree, never hand-listed**. | `npm run gate:docs` generates the content first, then checks every page is reachable. |
| `export/ifc/` | IFC export, in Python (`koyu_ifc/`) on its own toolchain — `export-ifc.yml` runs it, deliberately apart from `ci.yml`. | It reads canonical JSON from `dist/`, so **it reads what ships, not what is in `src/`**. |
| `scripts/` | `gate.mjs` — the example gatekeeper behind `npm run gate:examples`. | |
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

`--version` (or `-v`) takes no file and exits 0 — it prints which implementation you are running and which muro it reads and writes, which are separate versions. There is no dedicated `--help`. A call missing its arguments (including `--help`) prints the usage and returns **exit code 2**. The usage lines omit `plan`'s `-l/-o` and `doors`'s two path arguments, so for those read [docs/reference/cli/plan.md](docs/reference/cli/plan.md) and [doors.md](docs/reference/cli/doors.md).

## The MCP server

`koyu-mcp` is a dependency-free stdio MCP server ([docs/reference/mcp/](docs/reference/mcp/index.md)). It is stateless: every tool takes the entry `.muro` path as `file` and composes from scratch each time. The source of truth is the filesystem and the history belongs to git.

The tools are `model_summary` `check` `layers` `write_layer` `new_uids` `doors` `spaces` `light` `validate` `site` `plan_svg` `canonical_json`.

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
3b. **Never hand-count a ledger that has a machine source.** The counts and spellings of diagnostic codes, validation rules, subcommands, MCP tools and public exports are cross-checked against the documentation by `test/docs-ledger.test.ts`. That is what killed sentences like "all 49 exports" and "51 diagnostics". `test/restatements.test.ts` holds the other half — that the *values* written into the prose of `docs/` and `skills/` still equal the ones in `src/`. **Before a change that ripples (a language version, a code, a subcommand, the attribute ledger), read [docs/checklists.md](docs/checklists.md)**: it names which parts a gate already holds, so the only work left is the part no test can reach.
4. **The published documentation is written in the present tense and rewritten in place.** Do not accumulate dates, "addenda", or "in v0.9 this was…". Versions belong to git.
5. **A diagnostic always carries a code, and severity is an attribute of the code** ([docs/reference/diagnostics/index.md](docs/reference/diagnostics/index.md)). The same code is never an error in one case and a warning in another. Add a code and add a section to the right family under [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) (`test/docs-ledger.test.ts` catches omissions).
   **The population is the written declarations, provenance is always present, and the order is the order of the scan** ([docs/reference/diagnostics/reading.md](docs/reference/diagnostics/reading.md)). Check the values of interpreted attributes (the starred ones in the ledger) — never let a value that was written but not interpreted fall silently to a default. When touching `checkDiagnostics`, keep the granularity of the clauses at one scan (splitting by code family breaks the order).
6. **A change to the semantics of the language raises the language version** ([docs/reference/muro/version.md](docs/reference/muro/version.md)). The current one is `muro 1.2`. **muro names the language; koyu names this implementation** — the version line is spelled `muro` from 1.2 and `koyu` at 1.1 and earlier, one spelling per version. What counts as meaning-preserving is defined by [docs/reference/stability.md](docs/reference/stability.md). Write the migration in an ADR and bring the examples up to the newest version. **Work through [docs/checklists.md](docs/checklists.md) → *Raising the language version*** — the version guards in `diagnose.ts`, the conformance cases deliberately pinned to old versions, and any vendored copy downstream are the parts no gate reaches.
7. **The ledger is the contract for vocabulary** (the three tiers of attributes in [docs/reference/scope.md](docs/reference/scope.md)). The single source in the implementation is `ATTR_LEDGER` in `src/core/vocabulary.ts`, and [docs/reference/muro/attributes.md](docs/reference/muro/attributes.md) is its copy. **A key absent from the ledger cannot be written unless it carries a namespace (`acme.sensor`)** — the boundary exists to distinguish "we have not looked at this" from "we looked and it is fine".
8. **Zero runtime dependencies.** Add nothing outside devDependencies.
9. **Examples are written in the newest language version.** Introduce new notation and bring the examples along — the release test checks this.
10. **When writing a document, paste only output you actually ran.** Never paste guessed output.
11. **Everything written into this repository is English.** Code — comments, identifiers, test names, assertion messages, the `description` fields of a JSON Schema. The published documentation. The ADRs. The working notes. Commit messages and pull request bodies. Japanese belongs in conversation, and nowhere in the tree.
    **The reason is not consistency, it is plainness.** Written in Japanese, an explanation reaches for a compressed word, and the compression is usually a figure of speech — a gatekeeper, a door that opens, a ledger. The reader then has to unpack the figure before reading the point. English pulls the same sentence towards saying the thing outright. (It is not a cure: see law 12.) The second reason is that writing in one language and translating into another produces worse prose than writing in the target language from the start, and drafting in Japanese made that happen repeatedly.
    **Files still in Japanese are records, not a standing exception.** The ADRs under `docs/decisions/` are append-only and are never edited, so the older ones stay as they were written. The working notes at the top of `docs/` are rewritten into English when they are next touched, not in a sweep.
12. **Do not write in figures of speech.** A directory, a heading, an acceptance condition and an explanation all name what the thing does. Where a short coined phrase is tempting, write out what is being compared instead. The words this project already owns — the gatekeeper, the ledger, the frozen surfaces, the source — are its own vocabulary and stay; the rule is against importing new ones.
13. **Write the least that does the job.** A sentence the reader does not need is not free: it has to stay true, and when it stops being true it contradicts the page it sits on. `README.md` said "167 pages in Japanese and English" three lines below this page's "one tree, in English", and called the verdict ledger fifteen where it holds sixteen. **Neither could have been wrong if it had not been written.**
    - **Do not restate a count.** Name the thing and link to the ledger; the ledger says how many. A count is worth writing only where something reads it.
    - **Every link is a claim that the target still says what you think.** Carry the reader, then stop.
    - Law 3b is the same rule where a machine source exists, and law 12 is the same rule for coined phrases. This one covers what is merely surplus.

## How a change ships

**Work on a branch. Never edit in the working tree of `main`** — cut the branch before the first edit, not after the last one.

| # | Step | What runs |
|---|---|---|
| 1 | Open the PR | `ci.yml` on push and pull_request — typecheck, test, `check:examples`, `gate:examples` |
| 2 | **Raise the version, inside the PR** | `test/release.test.ts` holds `package.json`, `package-lock.json`, `CITATION.cff` and `KOYU_VERSION`; and, when the language version moves, the `MURO_SUPPORT` row naming the release it ships in |
| 3 | Merge into `main` | `ci.yml` again on `main` |
| 4 | The release `v<version>` is published | `publish.yml` re-runs the fast checks, verifies the tag against `package.json`, builds, and publishes to npm |

`publish.yml` fires on `release: published` and on `workflow_dispatch`, and **checks the release tag against `package.json` before publishing** — a mismatch stops it rather than shipping the wrong version. What creates the release is configured outside this repository, so do not describe that step from memory: read the workflows, or say you do not know.

**Verify rather than assume that a raised version reached the registry.** The failure that matters is `main` carrying a new version while npm still serves the old one, and nobody notices until an install comes back stale.

Publishing needs no token: npm Trusted Publishing (OIDC) trusts `publish.yml` itself as the identity.

## When you hit an error

The human-facing output of `check` carries no diagnostic codes. Add `--json` and the codes appear. To go from a code to the cause and the fix, use [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) — every code has a section in its family page carrying its severity and how to fix it. To go from a symptom, use [docs/howto/by-symptom.md](docs/howto/by-symptom.md).

There are three traps people hit often. `grid` and `level` have no effect unless declared **before** use (`boundary` may forward-reference). To divide a space into a plan, make the parent a `zone` rather than a `space`. An opening onto the outside has several boundary segments, so select the edge with `edge:N/E/S/W` (N=+Y, S=-Y, E=+X, W=-X). Details are in [docs/howto/troubleshooting.md](docs/howto/troubleshooting.md).

## If you do not know the notation itself

Work through [docs/start/](docs/start/index.md). In 30–45 minutes it reaches a two-storey building and its plan. The reasons behind the shape of the notation are in [docs/why/](docs/why/index.md), and the list of syntax is in [docs/reference/muro/](docs/reference/muro/index.md) (one page per declaration, with an index holding all the syntax on one sheet).
