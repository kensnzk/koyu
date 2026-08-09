---
title: What to read next
mode: explanation
---

# What to read next

Having worked through [the tutorial](index.md), you have a two-storey house, its plans, and the answers about circulation and daylight. From here the road forks by reader. **Pick one and read that one page** — this is not a book to work down in order.

## I want to write a bit more of the notation

→ **[Every construct in .muro](../reference/muro/index.md)**

The 16 words that can begin a line and the 9 kinds of indented line, laid out on one page. The ones the tutorial did not use — `zone` (the unit of aggregation), `asset` (door and window types), `import` (layering files), `stack` and `band` (vertical stacking and strip layouts), `polygon` (the shape of a site), `column` (columns whose position is never written), `over` and `drop` (override and delete) — are the words for when the scale grows.

This is the page to keep beside you while writing.

## I already know what I want to do

→ the how-to volume, starting at **[Add a storey](../howto/add-a-storey.md)**

[Add a storey](../howto/add-a-storey.md) · [Connect storeys](../howto/connect-storeys.md) · [Subdivide a dwelling into rooms](../howto/subdivide-a-unit.md) · [Lay measurements over the plan](../howto/write-as-built.md) · [Embed koyu in a program](../howto/embed-in-a-program.md) · [The standard loop for letting an agent write](../howto/agent-loop.md). Procedures arranged by goal. Where the tutorial was a single road, this is the volume you dip into.

## Why it is written this way has not settled yet

→ **[What koyu is](../why/index.md)**

[The space-centred model](../why/space-is-primary.md) · [Walls as boundaries](../why/boundary-is-a-relation.md) · [Default boundaries](../why/silence.md) · [Paths and area aggregation](../why/paths.md) · [Derived information](../why/source-and-derived.md) · [Extending attributes](../why/open-vocabulary.md) — the thinking behind the shape of the notation, without the implementation in the way.

If you only want the trap from stage 5 looked at straight on, **[What check guarantees](../why/green-is-not-a-building.md)** answers it in one page.

## An error has stopped me

→ **[The diagnostic code index](../reference/diagnostics/index.md)**

Add `--json` to `koyu check` and you get diagnostic codes. All 65 of them have what they are saying, how you got there, and how to fix it.

If you want "why is this way of writing rejected at all?" before the codes, start at **[How to read a diagnostic](../reference/diagnostics/reading.md)**.

## check is green but the building looks wrong

→ **[koyu validate — architectural judgement](../reference/validate/index.md)**

What `check` says stops at "what is written does not contradict itself as data". A room that cannot reach the outside, a hole in the envelope, a cramped stair, a ramp that is too steep, a column standing in a doorway, a building that spills off its site — a separate surface. **A judgement is not a guarantee.** That line itself is drawn in **[Scope — what a green check means](../reference/scope.md)**.

## I want more commands

→ **[The koyu command](../reference/cli/index.md)**

All 14 subcommands, with real output. The ones the tutorial did not use are here: `graph` (space adjacency), `stats` (areas and efficiency), `site` (site area, coverage, FAR), `runs` (vertical circulation), `layers` (which layers took part in composition, and where each attribute came from), `diff` (differences in the language of composition), `axo` (axonometrics).

## I want to drive it from a program

→ **[Reading a building from a program](first-program.md)**

Twenty lines from parse through diagnostics to canonical JSON. The published surface beyond that is laid out in **[TypeScript API](../reference/api/index.md)**.

## I want an LLM agent to read and write it

→ **[koyu-mcp](../reference/mcp/index.md)**

A zero-dependency stdio MCP server whose 12 tools expose the same derivations. Registration is one line; no auth, no environment variables. The agent reads with `layers`, writes with `write_layer`, and `check` is the gate — errors come back with layer and line provenance.

**Commit before you let it write.** `write_layer` writes by full replacement and has no undo.

## I want to know what this tool does not hold

→ **[What koyu does not hold](../reference/not-held.md)**

No geometry in the source, no placement mechanism, no architectural judgement in the source's contract, no chase after construction-document resolution, no round-trip compatibility — everything deliberately left out, with why. What will not break, conversely, is in **[Stability — what will not break](../reference/stability.md)**.
