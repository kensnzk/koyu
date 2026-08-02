---
title: slab — the floor build-up
mode: reference
---

# slab — the floor build-up

```text
level <name> <z> [h:ceiling height] [slab:floor build-up] [underground:1]
```

`slab:` is an attribute of a [level](level.md). It gives **the thickness of that storey's floor build-up in mm** — the structural slab, the void and the finishes that together fill the distance from the ceiling below to this storey's FL.

**There is no line that places a floor.** Writing `slab:` has already declared the floor, and the surface is derived from it. It is the same posture that has a wall appear out of a boundary and a [column](column.md) appear out of a grid intersection. There is no operation for laying a floor, none for hanging a ceiling, none for putting on a roof.

## When a floor is generated

A floor is laid over every space on that level satisfying all of the following.

- it has a region
- it is not `type:void` — **the absence of a floor is what a void is**
- it is not `type:exterior` — the outside is ground
- its level carries `slab:`

The floor's z range runs **from FL − slab to FL**. Its outline is the derived convex piece, so a floor cut by a [drawn line](line.md) comes out cut.

```muro
koyu 1.1
name 床組みの例
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200
level L2 3200 h:2700 slab:250
level R 6400 slab:250

space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

Those two rooms generate these surfaces.

| Surface | Space | z range |
|---|---|---|
| floor | /L1/a | −200 … 0 |
| ceiling | /L1/a | 2670 … 2700 |
| floor | /L2/a | 2950 … 3200 |
| ceiling | /L2/a | 5870 … 5900 |
| roof | /L2/a | 6150 … 6400 |

`/L1/a` has no roof because `/L2/a` overlaps it. A roof is laid only over the part **not covered by a space above**.

## Without slab, not one floor appears

**No default is fabricated.** Where a needed value is not written, the element is not built rather than given an invented default. So a level with no `slab:` generates no floors at all, and that gets said.

```muro-warn
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200
level L2 3200 h:2700
level R 6400 slab:250
space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

```text
⚠ Level L2 has no slab:, so not one floor is generated on this storey
```

The form is still determinate, so this is a warning (SUF03). All that disappears above is the one floor of `/L2/a`; its ceiling and its roof are generated exactly as before.

## The height invariant reads the slab of the storey above

For each space, **ceiling height + the slab of the level above ≤ storey height** is checked, where storey height is the difference to the next level's z. Exceed it and the space collides into the floor above — an error.

```muro-bad
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 4000
level L1 0 h:3100 slab:200
level L2 3200 h:2700 slab:250
level R 6400 slab:250
space /L1/a room X1..X2 Y1..Y2 name:1階
space /L2/a room X1..X2 Y1..Y2 name:2階
```

```text
✖ /L1/a collides into the floor above: ceiling height 3100 + L2's slab 250 = 3350 > storey height 3200
```

**A storey's own `slab:` has no bearing on its own ceiling height.** The one that bears is the slab above — it is the build-up sitting on top of the ceiling below. `koyu levels` shows the stack as a section in text.

```text
R	z:6400	slab:250
L2	z:3200	h:2700	slab:250
  ↑ storey height 3200 = ceiling 2700 + slab 250 + 250 left over
L1	z:0	h:2700	slab:200
  ↑ storey height 3200 = ceiling 2700 + slab 250 + 250 left over
```

The leftover is the plenum above the ceiling. It never goes negative — the collision error stands before it could.

## Roof thickness comes from slab too

The apex and the thickness of a roof switch formula on whether there is a level above.

| | Apex | Thickness |
|---|---|---|
| a level above | that level's z | that level's `slab`, or 200mm |
| no level above | FL + ceiling height + 200mm | 200mm |

**Where there is a level above, ceiling height is not read.** So a roof is generated even when no ceiling height can be determined. The roof of `/L2/a` above sits at 6150 … 6400 because level `R` carries z:6400 and slab:250.

This is what declaring a level with no spaces in it (a roof level `R`, say) is for — it becomes the ceiling of the top storey's height check, and it supplies the roof slab thickness.

## Floor finish is a different vocabulary

`slab:` is a structural thickness, not the name of a finish. Floor finish is carried by `floor:` on the [space](space.md) (a carried attribute), and an indented `area` overrides it over part of the room.

## Diagnostics

| Code | Severity | What it says |
|---|---|---|
| SUF03 | warning | the level has no `slab:`, so not one floor is generated on this storey |
| HGT01 | error | the height invariant is broken — ceiling height plus the slab above exceeds the storey height |
| HGT02 | error | a partial void does not cover enough — below 99% coverage no ceiling height may span storeys |

A `level` line accepts only `h`, `slab`, `pitch` and `underground`; any other key stops parse there and then.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [level](level.md) — the line `slab:` is written on
- [space](space.md) — what a floor is laid over
- [line](line.md) — what cuts a floor's outline
- [koyu levels](../cli/levels.md) — shows the stack as a section
- [koyu check](../cli/check.md)
