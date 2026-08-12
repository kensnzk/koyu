---
title: Choose dimensions before you write
mode: howto
---

# Choose dimensions before you write

Settle the grid, the core section and the tenancy depth first, then write the spaces. Do it the other way round and `check` will pass something that is not a building.

**This page is not koyu semantics.** The numbers below are **design knowledge**, taken from real product catalogues and from Japanese design practice. They are not rules of the notation and not guarantees of the implementation. [`koyu check`](../reference/cli/check.md) protects consistency and **says nothing about whether a dimension is realistic** — a 2m-wide lift and a 30m-deep tenancy both come out green. If you design against a different set of conventions, replace this whole table.

## The order

1. **Pick the grid.** For offices and retail, 8,400 is the default.
2. **Lay out the core section.** Read it as three bands: shaft 2,400 + service zone 1,800 + lift lobby 4,200.
3. **Settle the tenancy depth.** Core to window, 8.4–12.6m.
4. **Settle the storey height.** A typical office floor is 4,200 = ceiling 2,800 + service void 1,400.
5. **Only now write `space`.**

## Structural grid

| Item | Value | Why |
|---|---|---|
| Basic bay, office and retail | **8,400** | the modal bay in large Japanese offices (the middle of 6.4–9.6m); also divides into three 2,800 parking bays |
| Long span (banqueting, column-free) | 16,800–25,200 | two or three basic bays keeps the beam depth realistic |
| Column size | 1,000 low, tapering to 700 square high | narrowed as the building rises |

The bundled `examples/twin/` sits entirely on an 8,400 grid.

## Vertical circulation

| Item | Value | Why |
|---|---|---|
| 1600kg lift car | 2,150W × 1,600D | the standard size of a real passenger machine |
| Its shaft, one car | 2,800W × 2,400D | car + counterweight + structural tolerance |
| **Three side by side = 8,400 = one bay** | 2,800 × 3 | the traffic calculation lands straight on the grid |
| Lift lobby, facing banks | 4,200 wide | a single bank wants 2,700–3,500 |
| Service band behind the shafts | 1,800 | holds the electrical, plumbing and duct risers |
| Rule of thumb for car count | office 3,000–4,000 m²/car, hotel 100 rooms/car | starting values for traffic analysis |
| Escalator | 1,200 wide; length ≈ storey height × √3 (12,000 for a 6,900 storey) | 30° pitch; add 2,000 at each landing |
| Vehicle ramp | 6,000 wide for two-way, up to 1:6 | a 4,200 rise wants 25,200 of run — three bays |

**Write one shaft per car, one car per space.** Bundle them and the plan loses what a lift room actually is.

## The size of the stair enclosure decides the step

You do not write riser counts or treads. You write the size of the enclosure, and [`koyu runs`](../reference/cli/runs.md) derives the step from it. **The tread is derived towards a target of 300mm, and the landing absorbs whatever is left over.** Too short an enclosure never reaches the target, and the tread starves.

For a 4,200 rise in a 2,800-wide return stair, varying only the depth in the direction of climb:

```text
4000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 164mm	going 3600mm	/L1/s
4600	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 218mm	going 4800mm	/L1/s
5000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 255mm	going 5600mm	/L1/s
5600	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
6000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
7000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
```

[`koyu validate`](../reference/cli/validate.md) flags a cramped step as `koyu.schematic.stair.proportion` (a caution). Of those six, 4,000 and 4,600 are caught; 5,000 and above pass.

```text
⚠ [koyu.schematic.stair.proportion] s4000.muro:line 11: Cramped step: /L1/s — derived tread 164mm, 2×riser+tread 514mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
⚠ [koyu.schematic.stair.proportion] s4600.muro:line 11: Cramped step: /L1/s — derived tread 218mm, 2×riser+tread 568mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
```

**A taller storey needs a deeper enclosure.** Keep the width at 2,800 and raise the storey to 6,900 — a ground-floor entrance — and 7,000 of depth is what it takes to reach a 253mm tread.

```text
L1→L2	stair	S	rise 6900mm	return	39 risers of 177mm, tread 253mm	going 9600mm	/L1/s
```

**2,800 × 7,000 is the workable block for a protected escape stair** — the stairs in `examples/twin/core.muro` are written at exactly that size.

## Section (storey heights)

| Item | Storey height | Made of |
|---|---|---|
| Typical office floor | **4,200** | ceiling 2,800 + service void 1,400 (write `slab:1400`) |
| Retail | 4,800–6,900 | ceiling from 3,000; the ground-floor entrance at 6,900 (ceiling 6,000) |
| Hotel room, dwelling | 3,200–4,200 | keep 4,200 if it shares a slab with offices |
| Plant floor | 4,600–6,000 | the installation height of the machinery. **It does not appear in the storey numbering the public sees** — name them M1, M2 |
| Basement car park | 3,300 (2,300+ under the beams) | `slab:900` |

[`koyu levels`](../reference/cli/levels.md) prints the stack of storey heights as a section. If ceiling plus the slab above exceeds the storey height, `check` stops you.

## Grain of the plan

| Item | Value | Why |
|---|---|---|
| Office tenancy depth, core to window | **8.4–12.6m** | standard is 9–13m; past 18m both the workplace and the structure fall apart |
| Hotel room | 4,200 wide × 8,400 deep ≈ 35 m² | **width = half a bay** divides cleanly |
| Apartment | 8,400 wide (one bay) × 10–12m deep | a 70–90 m² family unit |
| Double-loaded corridor | 2,400 | 2,400–4,200 inside an office core |
| Retail mall | 8,400 wide including the void | walking zone on both sides plus dwell space |
| Toilet block | half a bay (4,200 × 8,400); one bay for both sexes | standard on a typical office floor |

## Deep floor plates fail on daylight

**One-seventh is a ratio of areas, so past a certain depth no amount of glazing reaches it.** Put a single 5,600 × 2,600 curtain wall panel into an 8,400-wide plate and vary only the depth — 10.2m and 16.8m — then run [`koyu light`](../reference/cli/light.md):

```text
  /L1/shallow	Depth-10200	window 14.56 m2 / floor 85.68 m2 = 1/5.9
  /L1/deep	Depth-16800	window 14.56 m2 / floor 141.12 m2 = 1/9.7
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

**Do the window arithmetic before you commit to the unit layout.** A zone that cannot make it is a candidate for a lounge or a store rather than a dwelling. The procedure is in [Open windows and pass the daylight check](windows-and-daylight.md).

## Envelope

| Item | Value |
|---|---|
| Curtain wall | one bay wide (8,400) × full storey height as a `window` says "that face is glass" |
| Grand entrance | two four-leaf automatic doors = 7,200 × 5,000 |
| Dwelling sliding door | 5,600 × 2,600 with `sill:200` |
| Parapet and balustrade | `h:1200` with `air:1` — the edge of a terrace or roof garden |

**The edge carrying `air:1` is what makes the space semi-outdoor.** The daylight coefficient and the outdoor test both follow from it.

## What the rentable ratio really is

- A single-use office **typical floor** runs 70–80% rentable. **Across the whole building it falls to 60–70%** — the ground-floor lobby and the plant floors eat it.
- A large mixed-use scheme falls further. The bundled `examples/twin/` measures as follows: against 141,448.56 m² of floor area, rentable plus exclusive is 46.7%, and 52.2% of the above-ground part once the car park is set aside.

The ratio is not a figure koyu keeps. Write which spaces are let and which are common as a `lease.category:` on the space or on the zone above it, then ask [`koyu stats`](../reference/cli/stats.md) to count by that key.

```text
$ npx tsx src/cli.ts stats examples/twin/main.muro --by lease.category
Total 141448.56 m2 (indoor floor area)
Outdoor 24911.04 m2 (plazas, open ground and the like — not counted as floor area)
Semi-outdoor 6534.08 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By lease.category: common 60487.47 m2 (42.8%) / (unspecified) 14868.00 m2 (10.5%) / rentable 63462.21 m2 (44.9%) / exclusive 2630.88 m2 (1.9%)
```

(The breakdown by type between those lines is left out.)

That is an honest number with two cores, two plant floors, a hall, banqueting and planted roof terraces all piled into `common`. The car park is neither let nor common, so it carries no `lease.category` and lands in `(unspecified)` rather than being dropped — which is why the areas still add up to Total.

```text
$ npx tsx src/cli.ts site examples/twin/main.muro
Site /site (敷地)
  Site shape: polygon with 14 vertices (a polygon declaration — given geometry)
  Site area: declared 23167.40 m2 / derived 23167.40 m2
  Road: /road-s (南側道路) width 25000mm / frontage 168000mm
  Road: /road-e (東側道路) width 18000mm / frontage 151200mm
  Road: /road-n (北側道路) width 16000mm / frontage 168000mm
  Building footprint (horizontal projection, rough): 9596.16 m2 → building coverage ratio 41.4%
  Total floor area: 141448.56 m2 → floor area ratio 610.5%
```

**To raise the rentable ratio, narrow the core — do not deepen the plate.** Depth only adds floor without a window.

## Next

- [Connect storeys](connect-storeys.md) — placing stairs and shafts at the sizes you chose
- [Open windows and pass the daylight check](windows-and-daylight.md) — the window arithmetic
- [Write a typical floor once](typical-floors.md) — writing the floor you just sized, once
