---
title: LIN — drawn lines
mode: reference
---

# LIN — drawn lines

There are three LIN codes.

| Code | Severity | What it says |
|---|---|---|
| LIN01 | error | The drawn line does not separate the two spaces |
| LIN02 | error | A line is drawn on a vertical boundary |
| LIN03 | warning | The drawn line cuts nothing |

**`line` gives a boundary its realisation as an act of design rather than as a derivation from adjacency.** Normally a boundary's segment is derived as the shared edge of two allocations. Write a `line` and **the written line itself** becomes the boundary instead, and the allocations on both sides are re-divided across it. Angled walls, cut corners and trapezoidal rooms are written this way.

A `line` is written indented under its boundary, and **one boundary carries one line**. Its endpoints are written in grid-reference words — neither raw coordinates nor angles are introduced.

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2+900,Y1 X2-900,Y2
```

## How a diagnostic quotes a line

**The spelling is as written; the order is canonical.**

A segment has no direction: the same two points joined either way are the same line. So the pair of endpoints is sorted into **ascending resolved coordinates** (x first, then y). The spellings — grid references such as `X1+300` — travel with the swap, so what a diagnostic quotes is **your grid words exactly, in canonical order**.

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1+300,Y2 X1+300,Y1
```

```text
Line X1+300,Y1..X1+300,Y2 does not separate /L1/a and /L1/b (draw it so the two allocations fall on opposite sides)
```

What was written is `X1+300,Y2 X1+300,Y1`; what is quoted is `X1+300,Y1..X1+300,Y2`. `X1+300` is not flattened into `300` — it stays a grid word.

**Why canonicalise.** An opening's `at:` is a ratio measured from the segment's start. If the start depended on writing order, one shape would have two readings: `line X1,Y1+2000 X2,Y1+4000` and `line X2,Y1+4000 X1,Y1+2000` would be byte-identical as canonical JSON while placing the door in different places. So the direction is settled at the exit of composition, which makes **the shape a function of the canonical form**.

## LIN01 — the line does not separate the two spaces

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1,Y1 X1,Y2
```

```text
Line X1,Y1..X1,Y2 does not separate /L1/a and /L1/b (draw it so the two allocations fall on opposite sides)
```

**Cause** — a drawn line re-divides the union of two allocations across itself. With both allocations on the same side of the line, there is nothing to re-divide.

Which side each space takes is decided by where its area leans. A space with no lean — one the line bisects exactly — takes whatever side is opposite its partner. **If neither leans, nothing is settled.**

**Fix** — draw the line between the two allocations. Check that what you want to move is the boundary's realisation, not the allocations themselves.

LIN01 also covers two more states under the same code.

```text
Line X2,Y1..X2,Y2 bisects the allocation exactly, so which side to keep is undetermined
```

This is the body when one side is a space with no region (an `exterior`, typically). There is no partner to take the opposite side from, so a line that bisects the other allocation exactly leaves the kept side undetermined.

```text
A line cannot be drawn between spaces that have no region: /out | /out2
```

Neither side has a region. There is nothing to divide.

## LIN02 — a vertical boundary cannot carry a line

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/a void X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
  line X1,Y1 X2,Y2
```

```text
A line cannot be drawn on a vertical boundary (drawing a line is an act of dividing a plan): /L1/a | /L2/a
```

**Cause** — drawing a line is an act of dividing a plan. A vertical boundary (`type:stair` / `shaft` / `void`) is a relation between storeys and holds no segment in plan.

**Fix** — if you want an angled edge to a void, the line belongs on **that storey's horizontal boundary** — the one between the void and the room next to it. Move the line to a boundary on the same level.

## LIN03 — the line cuts nothing

`warning`

```muro-warn
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2,Y1 X2,Y2
```

```text
Line X2,Y1..X2,Y2 cuts nothing (it is the same as the default adjacency line, or falls outside the allocation)
```

**Cause** — two possibilities.

- The line sits exactly where the default adjacency line would be derived. That is the example above: `X2` is where the two rooms already touch. Harmless, but **a line that does nothing ought to be reported**.
- No allocation falls within the line's reach. This is where a mistyped endpoint on an intended diagonal shows up.

**Fix** — redraw the line where you meant it, or delete the row.

## The outcome is recorded where the derivation happens

What a line did is settled while the shape is being raised, and recorded at that moment. There are three values.

| Outcome | Meaning | Diagnostic |
|---|---|---|
| `cut` | It actually divided the allocations | none |
| `nothing` | It cut nothing | LIN03 |
| `undetermined` | The side to keep could not be settled | LIN01 |

The diagnostics read that record; they do not redo the cut. Redoing it would build the test against **a shape that has already been cut**, and the populations would diverge — that is exactly the path by which a line that really did cut was told it had cut nothing. From the API this value is `DrawnLine`'s `effect`. It does not appear in canonical JSON, because it is a consequence of derivation rather than part of what was written.

## One line per boundary

Writing a second `line` under the same boundary is not a diagnostic but a syntax error.

```text
One boundary carries one line: /L1/a | /L1/b
```

If the same pair of spaces needs two cut corners, write two boundaries. A boundary that carries a line takes the line's spelling into its identity, so two of them on the same pair are not [BND02](./bnd.md).

## Related

- [BND — boundaries](./bnd.md) — identity and segments for boundaries without lines
- [VRT — vertical boundaries](./vrt.md) — the boundaries that cannot carry a line
- [VER — the language version](./ver.md) — `line` is 0.5 vocabulary (VER03)
- [SYN — syntax and composition](./syn.md) — a second `line`, indentation mistakes
- [koyu check](../cli/check.md)
