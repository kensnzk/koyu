---
title: What is left before 1.0
mode: explanation
---

# What is left before 1.0

**1.0.0 is not the completion of features. It is the settling of the surfaces we promise not to break.** So this road is cut by "what can be frozen", not by "what will be built".

The present state is **koyu 0.24.0 / muro 1.3**.

## There are two version lines

**The version of the language and the version of the implementation are kept apart.**

| Line | Now | What it means |
|---|---|---|
| Language (muro) | **1.3** | The grammar and semantics of the source. Written `muro 1.3` — `koyu 1.1` and earlier keep the old word, and keep reading. This is settled |
| Implementation (the npm package) | **0.24.0** | The library, the CLI and the MCP server. While it is 0.x, **nothing that changes is a breaking change** |

They were separated so that the implementation can keep moving after the language has settled. A file that says `muro 1.3` reads the same whether the implementation is 0.23, 1.0 or 2.0.

**Omitting the version in the source reads the file as the latest.** The accepted language versions are `0.1`, `0.2`, `0.3`, `0.4`, `0.5`, `1.0`, `1.1`, `1.2` and `1.3`, and a file written in an older version is checked under the acceptance conditions of that version.

## The eight surfaces to be frozen

These are the eight things 1.0.0 promises not to break. **All eight now stand in a state where they can be frozen.**

| Surface | What is promised | State |
|---|---|---|
| The grammar and semantics of muro 1.0 | That the reading of the source does not change | ✅ Language version `1.0` was cut. Attribute namespaces and the composition rules were the last breaking changes |
| The composition rules | How layers stack — strength, collision, idempotence, and the resolution of `over` / `drop` | ✅ All six implemented |
| Identity | `uid` closed to spaces and zones, generated at random. Openings and contained items are identified by "what contains them plus a unique name", and duplicates are stopped by a diagnostic | ✅ |
| The three attribute tiers and namespaces | The distinction between structural, interpreted and carry tiers, and the rule that a key containing a dot lands in the carry tier | ✅ The ledger is the single source for the implementation |
| The machine format | The spelling of the canonical JSON — format version, key collation (ascending code point), NFC normalisation | ✅ |
| The derivation rules | The definition of what is uniquely determined by the authored composition (wall segments, areas, adjacency, passability) | ✅ A reference implementation stands, and uniqueness became a predicate a machine can hold |
| Structural-consistency diagnostics | 69 codes, with severity as an invariant property of the code | ✅ Verdicts were moved to a separate domain, and the meaning of green now matches the definition |
| The public API and CLI | The TypeScript names and the contract of the CLI subcommands | ✅ The surface was written down, and tests hold it in set-equality with the implementation |

## What is left — looking at it end to end

**A surface standing and a surface being looked at are different things.** That the tests are green says something only about what the tests hold. 1.0.0 cannot be walked back, so **a person looks end to end at what the tests do not hold**. The 0.1x line is where that looking happens.

There are four.

| Surface | What to look at | Why tests do not suffice |
|---|---|---|
| **MCP** | Drive all 14 tools over stdio for real; watch the inputs, the outputs and the failure behaviour | It is a surface exposed outward, and there is no record of it having been driven end to end |
| **Documentation** | Whether this body of writing describes **the present**, and whether the pasted output is real | The truth of a sentence is not machine-readable |
| **Drawing** | What is actually drawn in a browser — plans, axonometrics, themes, editing | The agreement of form can be held; **appearance** is not (that is by design) |
| **The public surface** | What goes into `npm pack`, and whether all 16 subcommands really run | The contents of a package and its execution live outside the tests |

**What gets found and fixed ships as 0.16.x, and when it comes through clean, 1.0.0 is cut.**

## Recently closed — four inconsistencies around drawn lines

**Writing the rules down showed where the rules broke.** In the course of writing out the derivation rules, four routes were found by which one source produced two different forms, and they were folded shut under one principle: **form is a function of the canonical form.**

| # | The route | Before → after |
|---|---|---|
| 1 | On a line cutting the envelope, swapping the a/b of the `boundary` **reversed which side was kept** | 16.00 m² ↔ 14.00 m² → **agree** |
| 2 | The **order in which the endpoints of a line were written** fixed the origin of an opening's `at:`, but the canonical JSON discards that order | Byte-identical canonical JSON, door at (750, 2500) ↔ (2250, 3500) → **agree** |
| 3 | The **declaration order** of boundaries carrying a `line` changed the derived area | Byte-identical canonical JSON, 27.00 m² ↔ 22.50 m² → **agree** |
| 4 | Diagnostics recomputed the effect of a line, so the population diverged and a line that really did cut was falsely reported as "cut nothing" | LIN03 on a line that removed 4.5 m² → **gone** |

The tests hold the implication itself — they **confirm the canonical forms are equal as a precondition** before asserting the forms agree, so if the precondition collapses the test fails with "this pair proves nothing".

## After 1.0 — where growth happens

**The core no longer moves.** What grows is verdicts and expression.

- **Verdicts** — compartments, travel distance, smoke control, area ratios by use. When a second jurisdiction arrives, it gets its own chapter. Adding a rule costs one line in the ledger and one section of prose, and **the language version does not move**.
- **Expression** — dimension lines, door and window drafting conventions, scale, pitched roofs. The [section and the elevation](reference/form/section.md) landed, and grid bubbles with them. **Drawing accuracy is not among the things being frozen.**
- **External connections** — RDF/BOT output, geodesy, one-way import from IFC. **These stay outside the core.**

## What is not being taken on

- Geometry in the source (the exception is given input — the site shape)
- A placement mechanism (containment grants no seat)
- Folding architectural verdicts into the contract of the source
- Chasing the resolution of practice — **coverage is not a value**
- Round-trip compatibility
- Curved and freeform surfaces
- An authoring tool

The whole of what is and is not promised is in [the scope of the promise](reference/scope.md). Where the freeze starts and stops is in [stability](reference/stability.md), and what is deliberately not held is in [what is not held](reference/not-held.md).
