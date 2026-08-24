---
title: What is left before 1.0
mode: explanation
---

# What is left before 1.0

**1.0.0 is not the completion of features. It is the settling of the surfaces we promise not to break.** So this road is cut by "what can be frozen", not by "what will be built".

The present state is named by the package version and the newest row in the language ledger.

## There are two version lines

**The version of the language and the version of the implementation are kept apart.**

| Line | Now | What it means |
|---|---|---|
| Language (muro) | The newest row in the language ledger | The grammar and semantics of the source; older files keep their declared reading |
| Implementation (the npm package) | The package version | The library, the CLI and the MCP server. While it is 0.x, its public surfaces have not frozen |

They are separated so the implementation can move without silently reinterpreting a source file.
A file that declares a muro version keeps the meaning defined for that language version.

**Omitting the version reads the file as 1.1, permanently.** The accepted language versions are
listed on [the version page](reference/muro/version.md), and a file written in an older version is
checked under the acceptance conditions of that version.

## The eight surfaces to be frozen

These are the eight things 1.0.0 promises not to break. **All eight now stand in a state where they can be frozen.**

| Surface | What is promised | State |
|---|---|---|
| The grammar and semantics of muro | That the reading of the source does not change | ✅ Every semantic change cuts a language version and older readings remain guarded |
| The composition rules | How layers stack — strength, collision, idempotence, and the resolution of `over` / `drop` | ✅ All six implemented |
| Identity | `uid` closed to spaces and zones, generated at random. Openings and contained items are identified by "what contains them plus a unique name", and duplicates are stopped by a diagnostic | ✅ |
| The three attribute tiers and namespaces | The distinction between structural, interpreted and carry tiers, and the rule that a key containing a dot lands in the carry tier | ✅ The ledger is the single source for the implementation |
| The machine format | The spelling of the canonical JSON — format version, key collation (ascending code point), NFC normalisation | ✅ |
| The derivation rules | The definition of what is uniquely determined by the authored composition (wall segments, areas, adjacency, passability) | ✅ A reference implementation stands, and uniqueness became a predicate a machine can hold |
| Structural-consistency diagnostics | Codes with severity as an invariant property of each code | ✅ Verdicts were moved to a separate domain, and the meaning of green now matches the definition |
| The public API and CLI | The TypeScript names and the contract of the CLI subcommands | ✅ The surface was written down, and tests hold it in set-equality with the implementation |

## What is left — looking at it end to end

**A surface standing and a surface being looked at are different things.** That the tests are green says something only about what the tests hold. 1.0.0 cannot be walked back, so **a person looks end to end at what the tests do not hold**. The 0.1x line is where that looking happens.

The review covers these surfaces.

| Surface | What to look at | Why tests do not suffice |
|---|---|---|
| **MCP** | Drive every tool over stdio for real; watch the inputs, the outputs and the failure behaviour | It is a surface exposed outward, and there is no record of it having been driven end to end |
| **Documentation** | Whether this body of writing describes **the present**, and whether the pasted output is real | The truth of a sentence is not machine-readable |
| **Drawing** | What is actually drawn in a browser — plans, axonometrics, themes, editing | The agreement of form can be held; **appearance** is not (that is by design) |
| **The public surface** | What goes into `npm pack`, and whether every subcommand really runs | The contents of a package and its execution live outside the tests |

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
