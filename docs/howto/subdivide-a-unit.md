---
title: Subdivide a dwelling into rooms
mode: howto
---

# Subdivide a dwelling into rooms

Break a dwelling written as one space into living room, bedrooms and wet block — without breaking the area figure for the dwelling as a whole.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- The dwelling exists as a single `space` and [`koyu check`](../reference/cli/check.md) passes with zero errors.
- You know the dwelling's region (the union of its `X?..X? Y?..Y?` rectangles).

## The first trap — a parent with a region cannot hold children with regions

Keep the dwelling's `space` line and add child spaces, and parent and children overlap.

```muro-bad
muro 1.2
name Subdividing a dwelling
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450
level L4 11000 slab:450

space /L3/A unit X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2400 name:Type-A use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:Bedroom-1
```

```text
✖ unit.muro:line 10: Space regions overlap: /L3/A and /L3/A/ldk
✖ unit.muro:line 10: Space regions overlap: /L3/A and /L3/A/bed1
```

**Being a parent in the path does not excuse counting the area twice.** `/L3/A` and `/L3/A/ldk` are parent and child in the path, and two overlapping spaces in the plan.

## 1. Replace the parent with a `zone`

Change the dwelling's line from `space` to `zone`. A zone carries no geometry: it is an **aggregation that gathers the spaces under a path prefix**. It takes neither a region nor a type.

```muro-part
zone /L3/A name:Type-A use:exclusive
```

Forget to delete the `space` line and a space sits at the same path as a zone — ZON02, a warning.

```text
⚠ unit-clash.muro:line 10: A space shares its path with a zone (settle on one of them): /L3/A
```

What a zone gathers, which attributes it passes down and how it is totalled are in [zone](../reference/muro/zone.md).

## 2. Tile the dwelling's region with the children

Write the children so that the union of their regions equals the dwelling's original region. Tile to wall centrelines and the zone's derived area comes out identical to the dwelling's old area.

```muro-part
space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:Bedroom-1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:Bedroom-2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:Bathroom-block
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:Entry
```

L-shaped rooms are unions of rectangles, written with `+`.

## 3. Write doors between the rooms

The default between two spaces that touch is a wall with no door. You need not write the partitions themselves, but **without a door nobody passes**.

```muro-part
boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
```

Where the same two rooms meet along two edges of an L, pick the edge with `edge:N/E/S/W`.

## 4. Reconnect to the outside through the entry

Once the dwelling is subdivided, what touches the corridor or the outside is no longer the dwelling but **the individual rooms**. Move the front door onto the boundary between the entry hall and the corridor.

```muro-part
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A-front-door
```

## Check it

```muro
muro 1.2
name Subdividing a dwelling
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450
level L4 11000 slab:450

zone /L3/A name:Type-A use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:Bedroom-1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:Bedroom-2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:Bathroom-block
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:Entry
space /L3/corridor corridor X1..X3 Y2..Y3 name:Internal-corridor use:common

boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/bed2 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/hall t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A-front-door
```

```text
$ npx tsx src/cli.ts check unit.muro
✔ Consistent — 6 spaces / 10 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Five boundaries are declared; ten are reported. **The other five are default walls, derived for the pairs that touch and were never written about.**

[`koyu stats`](../reference/cli/stats.md) still speaks in the language of the dwelling after the subdivision.

```text
$ npx tsx src/cli.ts stats unit.muro
L3
  /L3/A/ldk	LDK	ldk	33.28 m2
  /L3/A/bed1	Bedroom-1	bedroom	10.24 m2
  /L3/A/bed2	Bedroom-2	bedroom	7.68 m2
  /L3/A/wet	Bathroom-block	wet	7.68 m2
  /L3/A/hall	Entry	hall	2.56 m2
  /L3/corridor	Internal-corridor	corridor	25.60 m2
  Subtotal 87.04 m2
Total 87.04 m2 (indoor floor area)
By zone (counted aggregation):
  /L3/A	Type-A	61.44 m2
  ldk: 33.28 m2
  bedroom: 17.92 m2
  wet: 7.68 m2
  hall: 2.56 m2
  corridor: 25.60 m2
By use: exclusive 61.44 m2 (70.6%) / common 25.60 m2 (29.4%)
```

The `By zone` line is the dwelling's area, and the exclusive/common split falls out without another line of source. `use:exclusive` is inherited by every space under the zone.

Whether you can walk from the corridor to each room is [`koyu doors`](../reference/cli/doors.md)'s answer.

```text
$ npx tsx src/cli.ts doors unit.muro /L3/A/bed1 /L3/corridor
3 doors — /L3/A/bed1 → /L3/A/ldk → /L3/A/hall → /L3/corridor
```

## What changes when you subdivide

- **Daylight scope does not follow the type.** Only `daylight:1` decides what is judged. If the dwelling carried `daylight:1` before the split, **move that declaration onto the rooms** — otherwise the daylight judgement disappears the moment you subdivide. Which rooms are in scope is the designer's decision, not something the words `ldk` or `bedroom` settle. The procedure is in [Open windows and pass the daylight check](windows-and-daylight.md).
- **The by-type breakdown in `stats` gets finer.** What was one `unit` becomes `ldk`, `bedroom`, `wet` and `hall`. Only the by-zone line absorbs the change of grain.
- **Grains may be mixed.** Subdivide some dwellings and leave others whole. The bundled `examples/tower/typical.muro` takes type A down to rooms and leaves B through F as single `unit` spaces.

## When the sizes and the order are what you know

If what is settled is the **size and the order** of the rooms rather than their positions, write a `band` instead of regions. A band expands into ordinary spaces at read time, so everything after this — the zone parent, the boundaries, the openings, the checks — is unchanged.

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:Bathroom-block
  space /L3..L10/A/hall hall w:1600 name:Entry
```

Give every member a size and the total is reconciled against the band's width at read time — a free arithmetic check on your typing. The grammar is in [band](../reference/muro/band.md).

## Next

- [Open windows and pass the daylight check](windows-and-daylight.md) — glazing the rooms you just made
- [Find spaces you cannot reach](find-unreachable.md) — confirm every room is reachable from the entry
- [Write a typical floor once](typical-floors.md) — when the same plan repeats up the building
