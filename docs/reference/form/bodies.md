---
title: Matter — walls, openings, columns, slabs
mode: reference
---

# Matter — walls, openings, columns, slabs

A [boundary segment](boundaries.md) is a centre line. Thickness and z land on it and it becomes a wall; openings split the wall; columns rise where a grid intersection meets a floor; floors, ceilings and roofs appear out of what the levels already declared. **None of it has a "place it" operation.**

## Storey pitch — how far walls and columns rise

The level a boundary stands on is that of "a if a has a region, otherwise b". The bottom of the wall is that level's FL.

**Storey pitch** is decided like this.

```text
there is a level above : pitch = z of the level above − z of this level
there is none          : pitch = the tallest ceiling height on this storey + ROOF_T (200mm)
```

Aligning to the apex of the roof when nothing is above is required because the roof is pitched by the same formula. Without it the wall either punches through the roof or leaves a gap beneath it.

**If no ceiling height can be determined, neither can the pitch, and no wall and no column stands on that level.** [SUF01](../diagnostics/suf.md) already says so as an error.

`levelPitch(model, level)` answers this on its own.

## Wall thickness and z range

| | Thickness | Top |
|---|---|---|
| Wall (`type:wall`) | `t:` if written, otherwise `WALL_T` (100mm) | FL + pitch |
| Non-enclosing boundary (`air:1`) | `t:` if written, capped at `RAIL_T_MAX` (80mm); otherwise `RAIL_T` (60mm) | FL + the boundary's `h:`, otherwise `RAIL_H` (1100mm) |

Thickness is distributed **half to each side of the centre line**. The same holds for a diagonal segment: the quadrilateral is the centre line offset by ±t/2 along the unit normal (`thicken`).

An `type:open` boundary has a segment but **no matter** — `FormBoundary.material` is absent.

## Placing a band — openings and segs

An opening and a `seg` are both "an interval on a boundary segment", and both are placed by the same rule. **The order matters.**

1. Take the boundary's segments (the boundary's own `edge:` is already applied). If the band carries `edge:`, narrow further
2. No segment at all: it cannot be placed ([OPN04](../diagnostics/opn.md) / [SEG04](../diagnostics/seg.md))
3. Two or more segments: a face must be chosen (OPN05 / SEG05)
4. Band wider than the segment: it cannot be placed (OPN06 / SEG06). Equal is fine
5. **A grid reference** (`at:X2+450`) cannot be used on a diagonal segment; a horizontal segment takes an X grid and a vertical one takes a Y grid (OPN07 / SEG07); running off the end fails (OPN08 / SEG08)
6. **A ratio** (`at:0.2`, default 0.5) is **clamped** so the centre fits at both ends. No diagnostic is emitted

The centre is taken parametrically from the start of the segment to its end — one formula for axis-parallel and diagonal alike. **So if the direction of the segment changed, the same `at:` would point somewhere else.** Segments — derived and drawn alike — **always run in ascending coordinate order**, so the result depends on neither the a/b order nor the order the line's endpoints were written in.

## The z range of an opening

**The head of an opening aligns with the lintel.** A door rises from the floor to the head; anything else drops from the head by its own height.

```text
door    : z0 = FL                                     ; z1 = FL + (h ?? OPENING_HEAD)
opening : z0 = FL + OPENING_HEAD − (h ?? OPENING_H)   ; z1 = FL + OPENING_HEAD
```

`OPENING_HEAD` is 2000mm, `OPENING_H` is 1200mm.

**Sill height is never written. It falls out of aligning the head.** `sill` is a [carried attribute](../muro/attributes.md), so core does not read it. `window w:2600 h:1100` on a level at FL 0 lands at z 900 to 2000.

```text
{ kind: "window", w: 2600, z0: 900, z1: 2000, t: 150 }
```

The leaf thickness `t` **equals the wall thickness**.

## A wall is a list of intervals split by openings

Openings on a segment are ordered by distance from its start. Between openings a full-height interval remains; at an opening a sill wall (floor up to the bottom of the opening) and a head wall (top of the opening up to the head of the wall) remain. Intervals whose length or height is at or below `SPAN_EPS` are not produced.

The partition in `examples/two-rooms.muro` (`t:120`, `door w:780 h:2000`, pitch 2600) really splits like this.

```text
panels:
  (3600,0)    → (3600,1860)   z 0 … 2600     full height
  (3600,1860) → (3600,2640)   z 2000 … 2600  head wall
  (3600,2640) → (3600,4500)   z 0 … 2600     full height
```

A door rises from the floor, so no sill wall appears. A window would produce both.

**With this rule, "paint the black band of the wall in the paper colour so it reads as a hole" simply does not exist as an operation.** In plan and in solid alike, the wall is a list of intervals that already has the hole in it.

Each interval carries **`footprint`** — its body, with the junctions at both of its ends already settled. That is what the next section is about, and it is the reason the interval carries a body at all rather than leaving the reader to thicken the centre line: at a junction, the body is no longer the centre line thickened.

## Where two walls meet

A centre line thickened about itself stops at its own end, so two walls meeting at a right angle leave the square of t/2 by t/2 outside the point they share belonging to neither of them. **The junction is derived, so nothing downstream has a corner to repair.**

**Nothing is merged.** A wall stays one body per interval, with its own identity, its own thickness and its own z range. What the junction decides is which of the walls meeting at a point runs through it, and where the others stop.

> **The winner runs through, and every wall that ends at the node is cut back to the winner's face.**

The election is a total order, so one model always gives one shape ([promise 1](index.md)).

1. A wall that does not end at the node beats one that does — it is already running through
2. The **thicker** wall wins
3. The centre line that comes first in ascending coordinate order wins

Nothing in it reads declaration order, and nothing reads which boundary a segment came from — the same three rules answer a corner, a T and a cross.

The winner runs on past the node just far enough that its face carries the whole cut edge of every wall stopping against it: half the loser's thickness at a right angle, further where the loser leans back over it. Two walls running **along** each other are not a junction — they simply butt, and neither moves. A cut that would leave nothing at all does not happen: a wall swallowed whole by the one it runs into keeps the body it had.

The four walls of a rectangular room therefore tile the ring they stand in exactly — no corner hole, and no corner counted twice.

```text
room 4000 × 3000, t 100, walls in ascending coordinate order

  west   runs through both of its corners : body x −50 … 50,   y −50 … 3050
  south  stops against the west wall      : body x  50 … 4050, y −50 … 50
  north  stops against the west wall      : body x  50 … 4050, y 2950 … 3050
  east   stops against both               : body x 3950 … 4050, y 50 … 2950
```

**The centre line is untouched by any of this.** `FormPanel`'s `x1,y1,x2,y2` still runs from one end of the interval to the other, and `FormBoundary.segment` is still the whole segment: the junction moves matter, not relations. So at a junction the centre line is **not** the axis of the body and cannot be recovered from it, which is why both are carried.

## Where a door opens, and its trace

The side it opens into is `swing:a/b`, or, unwritten, "a if a has a region, otherwise b".

The direction is decided by the component pointing at the centre of the bounding box of **the derived piece** nearest the opening, on the side it opens into. It reads shape, not allocation — in a space cut by a drawn line, the centre of the nearest allocation can land on the wrong side of the line.

The hinge is decided like this.

| Segment | Hinge |
|---|---|
| horizontal | east end with `hinge:E`, west end otherwise |
| vertical | north end with `hinge:N`, south end otherwise |
| diagonal | **pinned to the start point.** `hinge`'s N/E/S/W are words about axes and do not apply to a diagonal |

The trace is a quarter circle centred on the hinge with **radius equal to the opening width**, sweeping from the leaf tip (the opening width from the hinge, into the swing side) to the far jamb (the opening width from the hinge, along the segment). The sweep direction is the sign of the cross product of those two points about the hinge.

```ts
swing: { into: "/L1/b", hinge: {...}, leaf: {...}, jamb: {...}, ccw: false }
```

An opening with `style:sliding` or `style:auto` has **no trace** — it retracts towards the hinge side. `FormOpening.sliding` is set.

## Columns

The position of a column is written nowhere. **It emerges where a grid intersection meets a floor.**

The population of floors is: on that level, neither `exterior` nor `void`, has a region, and **is not a semi-outdoor space that holds up nothing but sky**. The last clause excludes roof gardens and terraces — semi-outdoor with no floor above — because a column there has nothing to hold up.

If the declaration names grids, only those are considered; otherwise all of them. The scan runs X outer, Y inner. If the intersection lies inside one of the floors' pieces (points on an edge count as inside, within `POINT_EPS`), a column stands there.

**Two columns never stand on the same intersection — the earlier declaration wins.** That is why declaration order is meaning, and why canonical JSON does not reorder columns.

A column's z range runs from that level's FL to FL + pitch.

## Floors, ceilings and roofs

The scan goes level by level in ascending z, spaces in **path collation order** within a level, and floor → ceiling → roof within a space. Declaration order is information the canonical form discards, so it is never read ([promise 1 of shape](index.md)). Every outline is a derived piece.

| Slab | Condition | z range |
|---|---|---|
| **Floor** | not `void`, not `exterior`, and the level has `slab` | FL − slab … FL |
| **Ceiling** | not `ceiling:0`, not `void` / `exterior` / semi-outdoor / vertical circulation, and a ceiling height is determined | FL + h − `CEILING_T` … FL + h |
| **Roof** | not `exterior`, not semi-outdoor. **Only over the part with no space above** | apex − thickness … apex |

**The absence of a floor is not the absence of a roof** — a void is roofed too. A void with nothing above it is either a shaft closed by a skylight or a courtyard open to the sky, and the latter is derived as semi-outdoor. So only exterior and semi-outdoor are excluded. Conversely, **voids and semi-outdoor spaces count as coverers**. Coverage is taken from **every level above**, not only the one directly above, and subtracted using derived shape. Subtracting allocations would count a slice of an obliquely cut upper storey as "covered" and leave no roof beneath it.

The apex and thickness switch on whether there is a level above.

```text
a level above : apex = z of that level     ; thickness = its slab ?? ROOF_T
none          : apex = FL + h + ROOF_T     ; thickness = ROOF_T
```

**When there is a level above, the ceiling height is never read.** So a roof is generated even where no ceiling height is determined. With nothing above and no ceiling height, the shape comes out thin — but SUF01 already blocks that state as an error.

Tiles whose remaining area is at or below `AREA_EPS` do not become roof.

In a building where a tower sits on a podium, this rule produces **the podium roof** without anyone writing it.

## Neighbouring pages

- [Boundary segments](boundaries.md) — the centre line before thickness
- [Constants and tolerances](constants.md) — where 100 / 2000 / 1200 / 30 / 200 come from
- [The plan](plan.md) — how this matter is classified at the cut
- [door](../muro/door.md) / [window](../muro/window.md) — writing openings
- [column](../muro/column.md) — declaring columns
- [level](../muro/level.md) — `h:` and `slab:`
