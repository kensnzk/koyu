---
title: Columns — column.blocksdoor
mode: reference
---

# Columns — column.blocksdoor

| rule | level |
|---|---|
| [`koyu.schematic.column.blocksdoor`](#column-blocksdoor) | violation |

**When two elements both refuse to write their position, the collision shows up only in the derivation.**

A column carries no coordinate. You write its section, its levels, and — if you want to narrow it — the names of the grid lines; where it stands comes from **the grid intersections**. A door carries no coordinate either. You write its width and where to put it (a ratio in `at:`, or a grid reference); the actual point lands on the boundary segment.

Since neither is written, **nobody can tell whether the two collide until something is drawn**. This rule puts it into words.

## Where columns stand

One column stands at each grid intersection **that has a floor on that level**. A floor means a space on that level, with a region, that is neither `outside:1` nor `void:1`.

There is one exception. **A space that is semi-outdoor and has nothing above it does not count as a floor.** A roof garden or a top-floor terrace gives a column nothing to hold up. Being semi-outdoor is derived: a space that meets an exterior across a `type:open` or `air:1` boundary is semi-outdoor.

No intersection carries two columns. When declarations overlap, **the earlier declaration wins**. If a declaration raises no column at all, [`koyu check`](../cli/check.md) warns.

`x:` and `y:` take **grid line names** and restrict which lines carry columns. They are not offsets.

## `koyu.schematic.column.blocksdoor` — a column blocks a door {#column-blocksdoor}

`violation`

```muro-fail
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1
boundary /L1/a /L1/b
  door w:900 at:X2
```

```text
✖ [koyu.schematic.column.blocksdoor] main.muro:line 8: /L1/a|/L1/b@0/0 intersects the derived column at X2/Y2
Validation — 1 violation / 0 cautions
  koyu.profile.schematic-screen@1 — 2 evaluated / 14 not applicable / 0 indeterminate / 0 error
```

The boundary between `/L1/a` and `/L1/b` runs along Y2. A 600mm column stands at the X2/Y2 intersection. The door was placed at `at:X2` — directly on the X2 line — so its centre and the column's centre are the same point. **A grid intersection also sits on the boundary segment.** Push a door towards a grid line and it always collides.

The test is a plain rectangle overlap. The door has width `w` along the segment and no thickness across it; the column is a `size × size` rectangle centred on the intersection (`size × d` if `d:` is written). A collision is **overlap along the segment together with the segment passing through the column's interior**.

Openings that cannot be placed at all — a door whose `at:` does not land on the boundary, say — are out of scope. That is an error in the composition, and [`koyu check`](../cli/check.md) has already said so.

It is a violation because two physical things occupy one place. No reading permits it.

### There are two fixes

**Shift the door off the line.** Add an offset in `at:`.

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1
boundary /L1/a /L1/b
  door w:900 at:X2+1500
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

**Or keep columns off that line.** Name the grid lines in `x:` / `y:` and narrow the column declaration instead.

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1 x:X1,X3
boundary /L1/a /L1/b
  door w:900 at:X2
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

A third is to move the wall, but that is re-deciding the plan. Either way, [`koyu plan`](../cli/plan.md) shows the result — **a collision visible only in the derivation is quickest to settle by drawing the derivation.**

## See also

- [Reachability](access.md) — when the door is open but there is nowhere to go
- [The validation ledger](index.md) — all fifteen rules, and why `Finding` is not `Diagnostic`
