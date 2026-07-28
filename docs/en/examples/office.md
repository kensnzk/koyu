---
title: office — storeys and a void
mode: explanation
---

# office — storeys and a void

`examples/office.muro`. 110 lines / 17 spaces / 43 boundaries / 419.84 m² of interior floor area. A small office of two floors plus a roof level. It is written at the resolution of a scheme design: no bulkheads, no door hardware — **an abstraction chosen, not detail omitted**.

![office L1](../../img/office-L1.svg)

![office L2](../../img/office-L2.svg)

## What it shows first

- **Several [levels](../reference/muro/level.md)** — `level L1`, `level L2`, and a `level R` that holds no spaces. The roof level exists only to give the height check on L2 an upper bound.
- **A void** — `space /L2/void void …` together with the vertical `boundary /L1/hall /L2/void type:void`. **The absence of a floor is written as a boundary too.**
- **Vertical boundaries** — `type:stair` (passable) and `type:shaft` (continuous but not passable). Floors are never written. Only the exceptions are.
- **`type:open`** — a boundary with nothing in it. Always passable.
- **`air:1`** — something is there but it blocks neither outside air nor light (the dwarf wall and railing facing the void).
- **[Uncounted subdivisions](../reference/muro/area.md)** — the indented `area` (a change of floor finish) and [`seg`](../reference/muro/seg.md) (a change of wall finish). Neither appears in area, room count, or the graph.
- **Per-space ceiling height** — `h:6700` makes the hall two storeys tall. `levels` reports it separately.
- **Ratio positions for openings** — `at:0.8`, `at:0.25`. A ratio in 0..1, clamped within the segment.

## Excerpts

The vertical direction takes exactly three lines. Every other floor is the default.

```muro-part
boundary /L1/stair /L2/stair type:stair
boundary /L1/ev /L2/ev type:shaft
boundary /L1/hall /L2/void type:void
```

`stair` means "connected above and below, and a person can walk it". `shaft` means "connected, but nobody walks it". `void` means "there is no floor". Those three words are enough to distinguish a stair enclosure, a lift shaft and a double-height void.

An uncounted subdivision changes the material without dividing the room.

```muro-part
space /L1/hall     hall     X1..X2 Y1..Y2       name:エントランスホール use:common floor:フローリング h:6700
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
space /L1/office   office   X2..X4 Y1..Y2       name:事務室 use:rentable
boundary /L1/office /L1/corridor t:120 spec:LGS
  door w:900
  seg at:0.75 w:3600 spec:ガラスパーティション
```

Adding the `area` leaves the hall at 40.96 m² and the room count at one. Adding the `seg` leaves the boundary a single boundary, and adds no edge to the graph. **Dividing and counting are separate things.**

## Questions worth putting to it

### How many doors from the second-floor office to the outside

The lift is a shaft and cannot be walked, so the route goes through the stair.

```sh
npx tsx src/cli.ts doors examples/office.muro /L2/office /out
```

```text
4 doors — /L2/office → /L2/corridor → /L2/stair → /L1/stair → /L1/corridor → /L1/hall → /out
```

`/L2/stair → /L1/stair` is the vertical boundary of the stair, and `type:stair` is always passable, so it adds no door.

### How do the heights stack up

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ storey height 4000 = ceiling 2700 + slab 1300
L1	z:0	h:2700	slab:600
  ↑ storey height 4000 = ceiling 2700 + slab 1300
Per-space ceiling height: /L1/hall h:6700
```

The line under each level is the section stack-up. `check` verifies the invariant **ceiling height + the slab above ≤ the floor-to-floor height** on every level, and here 2700 + 1300 = 4000 fits exactly. Only the hall, with its `h:6700`, is reported separately as a per-space ceiling height.

### Does the void count as floor area

It does not.

```sh
npx tsx src/cli.ts stats examples/office.muro
```

```text
L1
  /L1/hall	エントランスホール	hall	40.96 m2
  /L1/office	事務室	office	81.92 m2
  /L1/corridor	廊下	corridor	30.72 m2
  /L1/stair	階段室	stair	12.80 m2
  /L1/ev	EV	ev	12.80 m2
  /L1/wc-m	男子WC	wc	12.00 m2
  /L1/wc-w	女子WC	wc	13.60 m2
  /L1/machine	機械室	machine	25.60 m2
  Subtotal 230.40 m2
L2
  /L2/void	エントランス吹抜け	void (not counted as floor area)
  /L2/office	執務室	office	102.40 m2
  /L2/corridor	廊下	corridor	10.24 m2
  /L2/stair	階段室	stair	12.80 m2
  /L2/ev	EV	ev	12.80 m2
  /L2/wc-m	男子WC	wc	12.00 m2
  /L2/wc-w	女子WC	wc	13.60 m2
  /L2/machine	倉庫	machine	25.60 m2
  Subtotal 189.44 m2
Total 419.84 m2 (indoor floor area)
  hall: 40.96 m2
  office: 184.32 m2
  corridor: 40.96 m2
  stair: 25.60 m2
  ev: 25.60 m2
  wc: 51.20 m2
  machine: 51.20 m2
By use: common 235.52 m2 (56.1%) / rentable 184.32 m2 (43.9%)
```

Only the `void` row carries `(not counted as floor area)`. The rentable ratio of 43.9% comes out of the `use:` aggregation; it is written nowhere.

## Read next

- Site, landscape and semi-outdoor — [house](house.md)
- Writing the typical floor once — [mansion](mansion.md)
