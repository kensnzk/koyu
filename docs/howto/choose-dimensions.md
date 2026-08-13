---
title: What koyu derives from the dimensions you write
mode: howto
---

# What koyu derives from the dimensions you write

**`check` says nothing about whether a dimension is realistic.** A 2m-wide lift and a 30m-deep tenancy both come out green, because neither contradicts anything else in the composition ([What check guarantees](../reference/cli/check.md)).

What the dimensions do decide is everything koyu derives from them, and that is not always the thing you wrote. A stair enclosure decides the step. A floor depth decides whether glazing can reach the daylight ratio. A `lease.category:` decides what `stats` can count. This page shows those three, so that a dimension can be chosen against what it actually produces.

**Which dimensions are right is not koyu's question.** They follow from the regulations and the building conventions you design under, and this repository has no view on them.

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

[`koyu validate`](../reference/cli/validate.md) flags a cramped step as `koyu.schematic.stair.proportion` (a caution). Of those six, 4,000 and 4,600 are caught; 5,000 and above pass. The thresholds it applies are Japanese practice, and the rule page says so.

```text
⚠ [koyu.schematic.stair.proportion] s4000.muro:line 11: Cramped step: /L1/s — derived tread 164mm, 2×riser+tread 514mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
⚠ [koyu.schematic.stair.proportion] s4600.muro:line 11: Cramped step: /L1/s — derived tread 218mm, 2×riser+tread 568mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
```

**A taller storey needs a deeper enclosure to reach the same tread.** Keep the width at 2,800 and raise the storey to 6,900 — a ground-floor entrance — and 7,000 of depth is what it takes to reach a 253mm tread.

```text
L1→L2	stair	S	rise 6900mm	return	39 risers of 177mm, tread 253mm	going 9600mm	/L1/s
```

[`koyu levels`](../reference/cli/levels.md) prints the stack of storey heights as a section. If a ceiling plus the slab above it exceeds the storey height, `check` stops you.

## Depth decides whether daylight can be reached

**One-seventh is a ratio of areas, so past a certain depth no amount of glazing reaches it.** Put a single 5,600 × 2,600 curtain wall panel into an 8,400-wide plate and vary only the depth — 10.2m and 16.8m — then run [`koyu light`](../reference/cli/light.md):

```text
  /L1/shallow	Depth-10200	window 14.56 m2 / floor 85.68 m2 = 1/5.9
  /L1/deep	Depth-16800	window 14.56 m2 / floor 141.12 m2 = 1/9.7
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

Widening the window cannot close that gap on its own, because the floor grows with the depth as well. The procedure for the openings themselves is in [Open windows and pass the daylight check](windows-and-daylight.md).

**The edge carrying `air:1` is what makes a space semi-outdoor.** The daylight coefficient and the outdoor test both follow from it.

## What you write on a space decides what can be counted

The proportion of a building that is let is not a figure koyu keeps. Write which spaces are let and which are common as a `lease.category:` on the space or on the zone above it, then ask [`koyu stats`](../reference/cli/stats.md) to count by that key.

```text
$ npx tsx src/cli.ts stats examples/twin/main.muro --by lease.category
Total 141448.56 m2 (indoor floor area)
Outdoor 24911.04 m2 (plazas, open ground and the like — not counted as floor area)
Semi-outdoor 6534.08 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By lease.category: common 60487.47 m2 (42.8%) / (unspecified) 14868.00 m2 (10.5%) / rentable 63462.21 m2 (44.9%) / exclusive 2630.88 m2 (1.9%)
```

(The breakdown by type between those lines is left out.)

**A space carrying no `lease.category` is not dropped.** The car park in that model is neither let nor common, so it carries none and lands in `(unspecified)` — which is why the parts still add up to Total. Nothing is grouped unless you name the key, and nothing silently leaves the total when you do.

The site is the same shape of fact: [`koyu site`](../reference/cli/site.md) reports the ratios it can derive and declines the ones it cannot, because which zoning district this is was never written.

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

## Next

- [Connect storeys](connect-storeys.md) — writing the stairs and shafts themselves
- [Open windows and pass the daylight check](windows-and-daylight.md) — the window arithmetic
- [Write a typical floor once](typical-floors.md) — writing a repeated storey once
