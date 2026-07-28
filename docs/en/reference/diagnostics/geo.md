---
title: GEO — overlapping-region diagnostics
mode: reference
---

# GEO — overlapping-region diagnostics

A space says which part of the plan it occupies as rectangles of grid references. When two rectangles occupy the same place, floor area is counted twice and the wall centerline segment is no longer determined. The two GEO codes catch overlap — inside one space, and between two spaces.

| Code | severity | One line |
|---|---|---|
| [GEO01](#geo01) | error | The regions of one space overlap each other |
| [GEO02](#geo02) | error | The regions of two spaces overlap |

Overlap in section — a ceiling below colliding into the floor above — is the same idea in a different family, and [HGT](hgt.md) says it. How to get a code is on [Reading a diagnostic](reading.md).

Both wrong examples below exit 1 under `koyu check`, producing **exactly one** instance of that code.

## GEO01 — the regions of one space overlap each other {#geo01}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2 + X2..X3 Y1..Y2
```

`Regions within /L1/a overlap: X1..X3 Y1..Y2 and X2..X3 Y1..Y2`

**Cause** — the rectangles one space bundles with `+` overlap each other. It appears when you meant to write an L and got the start of the second rectangle wrong. The overlapping part would be counted twice in the area, so it is not let through.

**Fix** — split the rectangles you add with `+` so that they **do not overlap each other**. For an L, take one tall rectangle plus one that covers only what is missing beside it.

**Note — the message names the pair in the words you wrote.** On a space where three rectangles overlap each other, each pair comes out separately as `X1..X3 Y1..Y2 and X2..X3 Y1..Y2`. You never get identical bodies stacked up.

## GEO02 — the regions of two spaces overlap {#geo02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

`Space regions overlap: /L1/a and /L1/b`

**Cause** — two spaces on the same level occupy the same place. The diagnostic's `related` carries the position of the one written later.

**Note** — the check is confined to **spaces on the same level**. Spaces on different storeys overlapping in plan is the ordinary case; that is not overlap but vertical adjacency.

**Fix** — correct the layout. However, **if this appeared while trying to subdivide a dwelling or a department into rooms, the fix is not the layout.** Make the larger thing a `zone` rather than a `space`. A `zone` has no geometry; it is an aggregation that bundles the spaces beneath it by path prefix and totals their area, and it is the tool for writing "the whole and its parts".

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

Writing the dwelling itself as a `space` and nesting further `space`s inside it does not stand up. **Spaces do not overlap** is the rule of the plan, and hierarchy is carried by the path, not by geometry. Zone diagnostics are on [ZON](zon.md).
