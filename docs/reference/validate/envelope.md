---
title: The envelope — envelope.gap
mode: reference
---

# The envelope — envelope.gap

| rule | level |
|---|---|
| [`koyu.schematic.envelope.gap`](#envelope-gap) | caution |

**Between two spaces that touch, a wall is derived whether or not you write one.** Forget it and the wall still stands. **But a boundary to the outside is never derived** — no default boundary is drawn against a space with no region, because naming the other side is itself information.

The consequence of that asymmetry is that a forgotten boundary to the outside becomes **a silently missing wall**. You only notice by looking at the drawing. This rule puts it into words.

## `koyu.schematic.envelope.gap` — part of the outline faces nothing {#envelope-gap}

`caution`

```muro-caution
muro 1.2
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:W t:200
  door w:900
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /out t:150
```

```text
⚠ [koyu.schematic.envelope.gap] main.muro:line 6: Perimeter not faced by any envelope: /L1/a — N 4000mm / S 4000mm (8000mm over 2 run(s)). Write a boundary to the exterior
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 4 evaluated / 12 not applicable / 0 indeterminate / 0 error
```

`/L1/a` has four sides. The east side meets `/L1/b`, so it has a counterpart. One boundary was written on the west. **The north and the south face neither another space nor a declared boundary.** No wall stands there.

The message **names the sides**. A total length alone would not tell you which edge to fix in a drawing that writes its edges separately. Runs covered by a boundary that does not name an edge come out grouped as `N/S` or `E/W`.

### What is checked

A stretch of the outline is a hole unless it is one of these:

1. facing another space on the same level, or
2. covered by a boundary declared for that space — `type:open` and `air:1` both cover it, and **all of them differ from writing nothing**.

Boundaries that join levels (`type:stair`, `type:shaft`, `type:void`) do not cover a horizontal outline, so they do not count as cover.

### What is checked is "finish what you started", not completeness

**A level with no boundary to the outside at all says nothing.** That level has simply not modelled its envelope yet, and nagging a two-room example would be pointless.

The test for "has started its envelope" is concrete: **somewhere on that level, a boundary is declared against a space with no region** — the kind of exterior written as `space /out outside:1`, with no extent. Which means that a model whose outside is written **with a region**, tiling the site as `space /out/n exterior X1..X3 Y2..Y3`, has boundaries between two spaces that both have regions, and its levels are never taken to have started an envelope.

Some spaces are never reported:

- spaces with no region (the outside itself)
- `outside:1` spaces
- semi-outdoor spaces (derived from meeting an exterior across `type:open` or `air:1`)
- the site tiles under a zone carrying `site:1`

Not being enclosed is normal for all of them.

### Fix

Write boundaries for the remaining edges. Pick them with `edge:N/E/S/W`, or catch the whole remainder with one boundary that names no edge.

```muro
muro 1.2
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:W t:200
  door w:900
boundary /L1/a /out edge:N t:200
boundary /L1/a /out edge:S t:200
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /out t:150
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

If an edge is genuinely open, write `type:open`; if it is a railing, write `air:1`. **The hole closes not because you wrote a wall, but because you named the other side.**

## See also

- [Reachability](access.md) — close the envelope and the next problem is getting out. Doors live there
- [The validation ledger](index.md) — every rule, and why a judgement is not a diagnostic
