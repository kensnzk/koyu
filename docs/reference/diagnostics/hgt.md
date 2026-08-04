---
title: HGT — the height invariant
mode: reference
---

# HGT — the height invariant

There are two HGT codes. Both say that **written values contradict each other**.

| Code | Severity | What it says |
|---|---|---|
| HGT01 | error | Ceiling height plus the slab above exceeds the storey height — it eats into the floor above |
| HGT02 | error | A ceiling height that pierces a storey is declared under a partial void |

**This is the sectional counterpart of overlapping in plan.** `check` calls two regions overlapping on one level a contradiction ([GEO02](./geo.md)); on exactly the same footing it calls a lower ceiling punching through the floor above a contradiction. Both are about written data failing to hold together, not about whether the building is any good. That is why HGT stays on the `check` side.

## The invariant

For every space:

```text
effective ceiling height + the slab of the level above ≤ storey height
```

- The **effective ceiling height** is the space's own `h:` if it has one, otherwise the `h:` of the level it sits on. A space's `h` beats its level's.
- The **slab above** is the next level's `slab:` (floor-construction thickness — structural slab, plenum and finish).
- The **storey height** is the difference between the next level's `z` and this level's `z`. Storey height is never written; it is derived from the levels' `z`.
- The tolerance is 0.5mm, so rounding never trips this.

`koyu levels` shows the stack-up as a section in text.

```sh
koyu levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:400
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

## Who gets checked

The invariant is asked only of spaces that satisfy all of the following.

- **There is a level above.** The top storey has no floor above it to collide with.
- **Something above overlaps it.** A space with storeys above it but nothing directly over its own footprint is not asked. A level above that carries no spaces at all counts as covering everything.
- **It is not semi-outdoor.** A space meeting the exterior across `type:open` or `air:1` — a balcony, a terrace, an external stair — has no ceiling.
- **It carries no vertical circulation declaration.** The ceiling over a space with `stair:`, `ramp:`, `escalator:` or `lift:` follows the flight above it and cannot be stated as one number. This is a declarative exemption.
- **Both the slab above and the effective ceiling height are determined.** Without either, the inequality cannot be formed. **That state is missing information, not a broken invariant**, so [SUF01 and SUF03](./suf.md) say it instead and HGT stays quiet.

That last point bites. Forget `slab:` on the level above and the storey below **goes unchecked and stays green**. Run `--strict` so SUF03 is caught.

## HGT01 — it collides with the storey above {#hgt01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

```text
/L1/a collides into the floor above: ceiling height 2800 + L2's slab 400 = 3200 > storey height 3000
```

**Cause** — a ceiling height of 2800 plus a floor construction of 400 exceeds the storey height of 3000. The message prints all three numbers, so which one to move is settled on the spot.

**Fix** — move one of the three.

- Lower the ceiling height — `level L1 0 h:2400 slab:400`
- Thin the floor construction — `level L2 3000 h:2400 slab:200`
- Raise the storey — `level L2 3400 h:2400 slab:400`

To lower the ceiling of one room only, write it on the space rather than on the level.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2 h:2400
space /L2/a room X1..X2 Y1..Y2
```

If you meant to pierce the storey, that is a void — see HGT02 below.

## HGT02 — insufficient coverage under a partial void {#hgt02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:5400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v X1..X2 Y1..Y2 void:1
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

```text
/L1/a collides into the floor above: ceiling height 5400 + L2's slab 400 = 5800 > storey height 3000. The void covers only 50.0% — under a partial void keep the ceiling height within the storey height (the height of the void part is derived)
```

**Cause** — a `type:void` boundary is a **declarative exemption** from the height invariant, but the exemption reaches only as far as the void covers the lower storey's plan. The example voids half the lower storey yet declares a ceiling height of 5400, piercing the storey. Over the other half there is a floor, and that part cannot be 5400.

The exemption is total only at a **coverage ratio of 99% or more**. The message prints the coverage to one decimal — a grain that cannot collide with the threshold.

**Fix** — bring the lower storey's ceiling height inside the storey.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v X1..X2 Y1..Y2 void:1
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

**The height of the void part is never declared.** It is derived from the `void` relation. The lower storey's ceiling height is the ceiling height where there *is* a floor above, not the height of the void.

To make the whole thing a void, give the `void` space the same region as the storey below. Coverage is then 100% and the storey-piercing ceiling height passes.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:5400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/v X1..X2 Y1..Y2 void:1
boundary /L1/a /L2/v type:void
```

## What HGT does not say

**There is not one architectural judgement about height anywhere in koyu.** Eaves height, maximum height, road setback lines, north-side setback, shadow studies, minimum ceiling heights — none of these exist in `check` or in `koyu validate`. About height, koyu says only whether the written numbers add up.

The two height-adjacent judgements `koyu validate` does carry are the proportion of a derived stair's tread and riser (`koyu.schematic.stair.proportion`) and a derived ramp's slope (`koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope`). Both are cautions about a **derived shape**, not statutory height limits.

## Related

- [SUF — sufficiency](./suf.md) — for when a ceiling height or a `slab` is **not written at all**
- [VRT — vertical boundaries](./vrt.md) — the checks on the `type:void` boundary itself
- [GEO — overlapping regions](./geo.md) — the same story in plan
- [koyu check](../cli/check.md) / [koyu validate](../cli/validate.md)
