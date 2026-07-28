---
title: VRT — vertical-boundary diagnostics
mode: reference
---

# VRT — vertical-boundary diagnostics

Adjacency between storeys is **not declared**. It is derived from overlap in plan, and the default is a floor. Only the exceptions are written, and there are three.

| `type:` | Meaning | Passage |
|---|---|---|
| `stair` | A stair — the storeys are joined by steps | Passable without a door |
| `shaft` | A lift or services shaft — the space is continuous | Impassable to people |
| `void` | A void — there is no floor here | Impassable to people |

A boundary carrying one of these is a **vertical boundary**. It has no segment in plan, so it **receives none of the horizontal checks** — segments, openings, `seg`s. Instead these six ask whether it stands up as a relation between storeys.

| Code | severity | One line |
|---|---|---|
| [VRT01](#vrt01) | error | A vertical boundary needs a region and a level on both sides |
| [VRT02](#vrt02) | error | A vertical boundary spans one step between adjacent levels |
| [VRT03](#vrt03) | error | The spaces of a vertical boundary do not overlap in plan |
| [VRT04](#vrt04) | warning | The space above a void boundary is not `type:void` |
| [VRT05](#vrt05) | warning | An opening on a vertical boundary is not interpreted |
| [VRT06](#vrt06) | warning | A `seg` on a vertical boundary is not interpreted |

A boundary across storeys that forgot its `type:` is not a vertical boundary at all, and [BND03](bnd.md#bnd03) says so. How to get a code is on [Reading a diagnostic](reading.md).

Every wrong example below exits 1 under `koyu check --strict`, producing **exactly one** instance of that code.

## VRT01 — a vertical boundary needs a region and a level on both sides {#vrt01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out type:stair
```

`A stair boundary is written between spaces that have both a region and a level`

**Cause** — a vertical relation says "this part of the plan connects up and down", so unless both sides have a region and a level the position is undetermined. The partner is an `exterior` (no region), or a space whose level could not be determined.

**Fix** — make both sides real spaces with a region and a level. To write an exterior stair, stand up a stair space on each storey — one facing an `exterior` with `open` / `air:1` if it is semi-outdoor — and draw `type:stair` between them.

**Note — a boundary that drew this diagnostic receives no further check.** With the premise gone, neither level adjacency (VRT02) nor overlap in plan (VRT03) can be asked.

## VRT02 — a vertical boundary spans one step between adjacent levels {#vrt02}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L3/a room X1..X2 Y1..Y2
boundary /L1/a /L3/a type:stair
```

`A stair boundary is written between adjacent levels: /L1/a | /L3/a`

**Cause** — one vertical boundary spans exactly one step between levels **adjacent in z order**. The example is L1 and L3, skipping L2 in between. Adjacency is decided by z, not by the order of names.

**Fix** — write one per step (`/L1/a | /L2/a` and `/L2/a | /L3/a`). A shaft or stair enclosure running the whole height can be declared at once with a single `stack` line.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/ev shaft X1..X2 Y1..Y2
space /L2/ev shaft X1..X2 Y1..Y2
space /L3/ev shaft X1..X2 Y1..Y2
stack ev L1..L3 type:shaft
```

`stack` expands into one vertical boundary per step, so the line stays a single line however many storeys there are.

## VRT03 — the spaces of a vertical boundary do not overlap in plan {#vrt03}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
```

`The spaces of a stair boundary do not overlap in plan: /L1/a | /L2/b`

**Cause** — to connect up and down they must overlap in plan. The layouts of the stair or shaft differ between the storeys.

**Fix** — align the rectangles on both storeys. If the design shifts the stair per storey, insert a landing space in the range where they overlap.

## VRT04 — the space above a void boundary is not type:void {#vrt04}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
```

`The space above a void boundary is expected to be type:void: /L2/a`

**Cause** — a `type:void` boundary says "there is no floor here". If the space sitting above it stays an ordinary room, it is counted as floor area despite having no floor.

**Fix** — make the type of the space above `void`.

```muro-part
space /L2/a void X1..X2 Y1..Y2 name:リビング上部
```

A `void` space is not counted in floor area and shows in `koyu stats` as `void (not counted as floor area)`.

**Note — above and below are decided by z.** Whichever side you write first on the `boundary`, the one that is higher is the one checked.

## VRT05 — an opening on a vertical boundary is not interpreted {#vrt05}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  door w:800
```

`A door on a vertical boundary is not interpreted`

**Cause** — an opening rides on a wall centerline segment, and a vertical boundary has no segment. Written, it affects neither daylight nor passage nor the drawing. A `stair` is passable without a door, and adding one does not raise the count in `koyu doors`.

**Fix** — delete the opening line. If there really is a door at the entrance to the stair, it is a door on the **horizontal** boundary between the stair space and the adjoining room.

**Note — what is reproached is the opening's own line.** The diagnostic's `line` points at the `door` line, not at the `boundary` line, and three openings produce three diagnostics.

## VRT06 — a seg on a vertical boundary is not interpreted {#vrt06}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  seg w:800 spec:X
```

`A seg on a vertical boundary is not interpreted`

**Cause** — a `seg` names an interval of a boundary segment, and a vertical boundary has none. Neither a change of wall specification nor anything in `koyu plan` follows from it.

**Fix** — delete the `seg` line. To write the specification of a shaft's wall, that is a `seg` on the **horizontal** boundary between the shaft space and the adjoining room.

**Note** — as with [VRT05](#vrt05), the diagnostic points at the `seg`'s own line, and several declarations produce several diagnostics.
