**English** · [日本語](../derivation.md)

# Derivation — from what is written to a single shape

koyu v1.0.0-rc.1 / muro 1.0. **This document is the norm for what shape comes out of a written composition.**

The source holds no geometry ([policy.md](../../docs/policy.md) §2). Plans, areas and circulation are not written; they are derived. If the rules of derivation differ from consumer to consumer, the same source yields different buildings — **and then it is not a source** ([scope.md](scope.md) §6). So the rules live here, and the implementation follows as a reference implementation.

The reference implementation is `derive(model): Form` ([tools.md](tools.md)). `Form` **carries no appearance at all** — no colours, no typefaces, no line weights, no annotation strings, no symbols, no scale, no page margins. It returns coordinates, thicknesses, z ranges, orientations, and the identity of what each shape belongs to. `src/draw/` and ugatsu only draw that `Form`; what may legitimately differ is the **appearance**, never the shape.

The norm for scope is [scope.md](scope.md), semantics is [semantics.md](semantics.md), and the ranges of attribute values are in [vocabulary.md](vocabulary.md).

---

## 0. Three promises

**1. There is one entrance to the shape.** The shape of a space is its `pieces` (the derived convex parts), never its `rects` (the written allotment). The allotment is the spelling of cells, not a shape. Areas, shared edges, outlines, coverage, where columns land, projections — every derivation that reads shape goes through that one entrance.

**2. No default is invented.** If a value that is needed is not written, no default is quietly supplied: **the element is not made**. Sufficiency (SUF01-04) puts "it cannot be made" into words. The derivation defaults listed in §5 are the exception — those are rules the specification sets, not inventions.

**3. Convex parts run counter-clockwise.** Every outline `Form` returns is counter-clockwise (its signed area is positive), and reading the orientation of an edge (N/E/S/W) assumes that winding.

---

## 1. Regions — the shape of a space

### 1.1 From allotment to convex parts

A region is written as a union of rectangles. Derivation first maps each rectangle to four counter-clockwise vertices `[(x1,y1),(x2,y1),(x2,y2),(x1,y2)]`, and then, if a boundary carries a **drawn line** (`line`), cuts it again by that half-plane.

```
pieces = rects                                  # 線が無ければ割付の写し
pieces = outside(window) + halfplane(inside)    # 線があれば窓の中だけを切り直す
```

The recut happens **exactly once**, at the exit of `parse`, in declaration order. It is not idempotent — a region shrunk by an earlier line shrinks the window of a later one.

### 1.2 The window a line reaches

A line is not an infinite line. **Along the line it cuts a limited interval; across the line it cuts a range that includes the other side.** That asymmetry is the crux — treated as an infinite line it drags in a distant wing and a room disappears; treated as the bounding box of the segment it degenerates on an axis-parallel line and cuts nothing.

A line counts as **vertical** when `|Δy| >= |Δx|` (exactly 45 degrees, and a degenerate point, count as vertical). For a vertical line the axis "along" is y and the axis "across" is x; for a horizontal line it is the other way round.

| Case | Along | Across |
|---|---|---|
| Re-dividing two spaces (both hold a region) | the **intersection** of the two bounding boxes | the **union** of the two bounding boxes |
| Cutting the envelope (one side holds no region) | **the interval of the segment itself** | the **whole** bounding box of the side that holds a region |

Unless both sides of the window exceed the tolerance (`EPS` in §6) it has no substance, and the line cuts nothing (LIN01).

### 1.3 Which side is kept

Which side of the line is kept is decided by **measuring, whole, the convex parts the window touches**. Touching is judged by overlap of bounding boxes. Each part is halved by the line; the total area on the left is compared with the total on the right, and if the difference is under the tolerance (`AREA_EPS` in §6) there is "no bias".

**Only what is inside the window is cut; what decides is the whole of each part.** Measure every convex part and a wing the line never reaches dominates the sign and the room disappears; measure only inside the window and a corner-to-corner line looks like a bisection.

- **Cutting the envelope**: the bias of the side that holds a region is the side kept. No bias means no cut (LIN01)
- **Two spaces**: take the bias on both sides; if exactly one is zero, give it the opposite of the other. Both zero, or the same side, means no cut (LIN01)

### 1.4 The re-division itself

The parts are split into inside and outside of the window, and **the allotments inside the window are merged and then re-divided to the two sides of the line**. So re-dividing two spaces conserves total area (the triangle one loses, the other gains). Cutting the envelope only shrinks the side that holds a region; the other side gains nothing.

If a half-plane cut leaves fewer than three vertices, or an area at or below the tolerance, that part never existed. Without that threshold a hair-thin sliver survives at the end of a clipped corner, gets read as an edge, and grows a ghost wall.

---

## 2. Boundaries — where walls are

### 2.1 The orientation of an edge

Walk the counter-clockwise vertices of a convex part and read only the axis-parallel edges. An edge running +x is the **S** face, −x is **N**, +y is **E** and −y is **W**. So N=+Y, S=−Y, E=+X, W=−X. A diagonal edge has no orientation.

Two edges "face each other" when their orientations are opposite (N↔S / E↔W) and the difference of their fixed coordinates is at or under the tolerance.

### 2.2 Deriving the segments

The segments of a boundary are decided in this order. **The order carries meaning.**

1. If either end space does not exist, there is no segment
2. If `kind` is `stair` / `shaft` / `void` there is no segment (a vertical boundary holds no wall)
3. **If a line is drawn, that is the realisation of the boundary** (§2.4). Neither collinear merging nor the `edge:` filter applies
4. If both sides hold a region, the **shared edge**. Different levels means no segment (no wall stands between levels)
5. If only one side holds a region, the **outline**. The others are "the regions of every space on the same level except these two"
6. If neither holds a region, there is no segment

The results of 4 and 5 are collinear-merged (§2.3), and finally filtered by `edge:` if present, read as "the edge seen from the a side".

**Shared edge** — take the axis-parallel edges of every convex part of A and of B that face each other and share an interval. An overlap at or under the tolerance is not a shared edge (touching at a point is not touching). The segment runs in ascending coordinate order and carries the orientation seen from `a`.

**Outline** — from each edge of each convex part, subtract the intervals covered by facing edges. **The other convex parts of the same space count as others too**, so writing an L as two rectangles grows no wall along the internal seam. The order in which others are subtracted does not affect the result.

### 2.3 Collinear merging

Segments lying on the same line are merged into one. The grouping key is (orientation, fixed coordinate, the edge seen from a), and **the fixed coordinate must match exactly**. Within a group, sort by ascending coordinate; extend across a gap at or under the tolerance, and cut where it exceeds it.

Back-to-back edges (an N edge and an S edge on the same line) differ in orientation and are not merged.

### 2.4 The interval a drawn line realises

**One drawn line is shared by several boundaries.** The wall of a through passage has as many boundaries as there are units fronting it. If every boundary realised the full length of the line, the plan would carry the same wall several times over.

Cut the line at the edges of the convex parts of both spaces, take two points offset from the midpoint of each interval along the normal by the probe distance (`PROBE` in §6), and keep only the intervals where the left and the right are exactly a and b. Against a side that holds no region, the side that does holds one flank and that is enough. The test is symmetric in a and b.

The output segment keeps **the order of the written endpoints** (p→q) and carries no orientation seen from `a`. So writing `edge:` on a boundary that carries a `line` has no effect.

---

## 3. Substance — walls, openings, columns, surfaces

### 3.1 Wall thickness and z range

A boundary stands on the level of "a if a holds a region, otherwise b". The foot of the wall is the FL of that level.

| | Thickness | Top |
|---|---|---|
| Wall (`kind:wall`) | `t:` if written, otherwise the default (§5) | FL + storey height |
| Non-enclosing boundary (`air:1`) | `t:` if written, capped at the maximum | FL + the boundary's `h:`, or the default |

**Storey height** is "the difference to the level above, or — with no level above — the greatest ceiling height on that level plus the roof slab thickness". Aligning to the apex of the roof when nothing is above is required because `slabs()` hangs the roof by the same formula; without that, the wall pierces the roof or a gap opens under it. If no ceiling height is determined, the storey height is not either, and **neither walls nor columns stand on that level** (SUF01 already says so as an error).

Thickness is split evenly to both sides of the centreline. The same holds for a diagonal segment: a quadrilateral offset ±t/2 along the unit normal.

### 3.2 Where a band (an opening, a seg) sits

An opening and a `seg` are both "an interval along a boundary segment", and both are placed by the same rule. **The order carries meaning.**

1. Take the segments of the boundary (`edge:` is already applied). If the band carries `edge:` too, narrow further
2. No segment at all means it cannot be placed (OPN04 / SEG04)
3. Two or more segments means an edge must be chosen (OPN05 / SEG05)
4. A band wider than the segment cannot be placed (OPN06 / SEG06). Equal fits
5. With a **grid reference** (`at:X2+450`), it cannot sit on a diagonal segment (OPN07 / SEG07), a horizontal segment takes an X line and a vertical one takes a Y line (OPN07 / SEG07), and running off the end cannot be placed (OPN08 / SEG08)
6. With a **ratio** (`at:0.2`, default 0.5), the centre is **clamped** into the range where it fits (no diagnostic is raised)

The centre is taken as a parameter from the start of the segment to its end — one formula, axis-parallel or diagonal. **So if the direction of the segment changes, the same `at:` points somewhere else.** Derived segments always run in ascending coordinate order and so do not depend on the order a and b were written, but the segment of a drawn line keeps the order of the written endpoints.

### 3.3 The z range of an opening, and the wall being split

**The head of an opening aligns to the lintel height.** A door rises from the floor to the lintel height; any other opening hangs down from the lintel height by its own height. The height is the opening's `h:`, or the default in §5.

```
door   : z0 = FL                              ; z1 = FL + (h ?? OPENING_HEAD)
opening: z0 = FL + OPENING_HEAD - (h ?? OPENING_H) ; z1 = FL + OPENING_HEAD
```

The sill (`sill`) is in the **carry tier**, so core never reads it ([scope.md](scope.md) §7). The sill height falls out of aligning the head.

A wall appears as **a list of intervals split by its openings**. The openings sitting on a segment are ordered by distance from its start; between openings a full-height interval remains, and at an opening a spandrel below (floor to the underside) and a head panel above (the top of the opening to the top of the wall). Intervals whose length or height is at or under the tolerance are not made.

**With that rule, "painting the black band of the wall over in the paper colour so it looks like a hole" does not exist.** In plan and in solid alike, a wall is a list of intervals with the holes already in it.

### 3.4 Which way a door opens, and its arc

Which space it opens into is `swing:a/b`, or, unwritten, "a if a holds a region, otherwise b". The direction is decided by the component pointing at the centre of the bounding box of the convex part of **the derived shape** of that space nearest the opening (the shape, not the allotment — in a space cut by a drawn line, the centre of the nearest allotment can fall on the far side of the line).

The hinge is: on a horizontal segment, the east end with `hinge:E` and otherwise the west end; on a vertical segment, the north end with `hinge:N` and otherwise the south end. **On a diagonal segment the hinge is fixed at the start end** — the N/E/S/W of `hinge` are the words of the axes and do not apply to a diagonal.

The arc is a quarter circle centred on the hinge with a radius equal to the opening width, running from the tip of the leaf (the hinge offset by the width towards the opening side) to the far jamb (the hinge offset by the width along the segment). The sweep is decided by the sign of the cross product of those two points about the hinge.

An opening with `style:sliding` / `style:auto` has no arc — it is drawn back past the hinge side.

### 3.5 Columns

The position of a column is written nowhere. **It appears where a grid intersection meets a floor.**

The floors it may stand on are the spaces "on that level, neither exterior nor void, holding a region, and **not a semi-outdoor space that carries only sky**" ([ADR-0030](../../docs/decisions/0030-columns-hold-something.md)). If the declaration names grid lines, only those are considered; otherwise all of them. The scan runs X on the outside and Y on the inside. If the intersection falls inside any convex part of a floor (a point on an edge counts as inside), a column stands there.

No two columns stand on the same intersection — **the declaration written first wins** ([ADR-0029](../../docs/decisions/0029-order-as-meaning.md)). The z range of a column is the FL of that level to FL + storey height (§3.1).

### 3.6 Surfaces (floors, ceilings, roofs)

The scan runs levels in ascending z, spaces within a level in declaration order, and within a space floor → ceiling → roof. Every outline is a derived convex part.

| Surface | Condition | z range |
|---|---|---|
| **Floor** | neither void nor exterior, and the level carries `slab` | FL − slab … FL |
| **Ceiling** | not `ceiling:0`, and not void / exterior / semi-outdoor / vertical circulation, and the ceiling height is determined | FL + h − ceiling thickness … FL + h |
| **Roof** | neither exterior nor semi-outdoor. **Only where no space sits above** | apex − thickness … apex |

**The absence of a floor is not the absence of a roof** — a void gets a roof too. Conversely **a void and a semi-outdoor space both count as cover**. Cover is taken from **every level above**, not only the one directly above, and is subtracted as the derived shape.

The apex and the thickness of the roof switch on whether a level sits above.

```
upper level    : top = upper.z          ; t = upper.slab ?? ROOF_T
no upper level : top = FL + h + ROOF_T  ; t = ROOF_T
```

With a level above, **the ceiling height is not read**. So a roof is generated even where no ceiling height is determined. With no level above and no ceiling height either, the shape goes thin — but SUF01 already blocks that state as an error.

A tile left over with an area at or under the tolerance is not made into a roof.

---

## 4. Vertical circulation

Neither the number of steps, nor the going, nor the slope is written. **All of it is derived from the region, the storey height, and the declared direction of ascent.**

### 4.1 Local coordinates, and every condition under which no shape is generated

The local coordinates of a run are t (from 0 in the direction of travel) and s (from the **left of the direction of travel**). `turn:` is L only when `L` is written; unwritten and invalid values are both R.

Any one of the following means **no shape at all is generated** — check puts it into words as RUN01-05 / SUF04.

Zero declarations or two or more / the region is not a single rectangle / the level cannot be determined / a value other than N/E/S/W on anything but a lift / a value other than 1 on a lift / `form:` other than straight or return / `form:return` on anything but a stair or a ramp / no level above (except a lift) / the entry landing consumes the whole length / no flight length is left in a turn.

**A lift has a shape even with no level above** — the car closes on its own level.

### 4.2 Entry landing and step division

A run does not start at the edge of the region. An **entry landing** remains at the near end, and that is where the door opens. A straight stair keeps one at the far end too.

```
usable = length - entry       # form:return
usable = length - entry * 2   # form:straight
risers = max(2, ceil(rise / (riser ?? DEFAULT_RISER_MAX)))
riser  = rise / risers
tread  = usable / max(1, risers - 1)
```

### 4.3 Turning back

The width is halved and an intermediate landing is placed at the far end. With `turn:R` the first flight is on the left of the direction of travel; with `turn:L`, on the right. The two flights occupy the same interval of t and differ only in s.

The steps divide at `k = min(risers−1, max(1, round(risers÷2)))`, and the landing sits at FL + k×riser. **Since round rounds a half up, an odd number of steps gives the lower flight one more.** The second flight is reversed as geometry too: the low-t side is the high one. A ramp turning back puts its landing at exactly half the rise.

**The depth of the intermediate landing falls out as the remainder.** Flight length, going and landing are bound by one equation, and at most two of them can be written. What a designer wants to hold is the comfort of the going, so by default the remainder goes to the landing ([ADR-0021](../../docs/decisions/0021-vertical-circulation.md)). Write `landing:` and the going becomes the remainder instead. Derived or written, a value below the minimum depth is raised to the minimum depth.

### 4.4 Units in parallel (escalators)

The nominal width of one unit is `lane:`, or the default. The number of units is `floor(width ÷ nominal)` with a minimum of one; one unit is the smaller of the nominal and width÷units, and the remainder is split evenly at both ends. **Consecutive units run in alternating directions** — next to one going up is one coming down. `lane:` has no effect on a stair, a ramp or a lift (the count is always one).

### 4.5 Aggregates

The total horizontal length of the flights counts **only the first unit** (both flights of a turn are counted). The going is represented by **the tightest flight** and the slope by **the steepest**. That asymmetry is what validation (RUN06/RUN07) rests on.

### 4.6 Solids

| Part | Shape |
|---|---|
| Landing | a slab. Its top is the landing height, its thickness the slab thickness |
| Stair flight | for k risers there are **k−1 treads** (the top step is carried by the floor above). The top of step i is the bottom + i×riser, and its depth is the riser plus the tread thickness |
| Ramp, escalator | one inclined slab. **The incline is decided by the z values** — never by the direction of travel |
| Escalator balustrade | two per unit. Inclined thin slabs raised above the tread surface |
| Lift car | a box inset from all four sides. **A fixed height independent of the storey height**, rising from the FL of that level |

### 4.7 In plan — the cut

A plan is "a section cut at that level". The height of the cut plane is a **height above FL**, and it is an **input** to `derive`, not part of what is derived (the default is in §5).

For an **ascending run**, each part's visible interval is decided by comparing its z range with the cut plane. At or above the part's top it is wholly visible; at or below its bottom it is wholly hidden; crossing it, it is cut where it crosses. The test is purely geometric and never uses the number of the part — parallel units are cut at the same height, and only written this way does the second unit get a window at all.

A **descending run** appears in what the twin ascending run **left behind**. To be a twin, the four coordinates of the rectangle must agree within tolerance and the direction, the form, the device and the number of parts must all agree. Matching by position alone produces a mirror image. With no twin, the descending run is wholly visible.

Nosings are laid out from the part's t0 at the pitch of the going, and any falling outside the visible interval are dropped. The step marks of an escalator are laid out from **the start of the visible interval** at a fixed pitch.

An arrow is drawn per unit on an escalator, and on a stair or a ramp on the departing flight (the ascending face) / the arriving flight (the descending face). Its direction follows only the direction of travel, so **an escalator points the same way on both faces while a stair and a ramp reverse on the descending face** (the machine is fixed; the person turns with the face). Too short a visible interval draws no arrow.

The break is **one segment crossing the full width of the run** at the position where it crosses the cut plane. The two parallel oblique lines of drawing convention are appearance, and the drawing side draws them.

---

## 5. The constants of derivation

**These are not ledger defaults.** [vocabulary.md](vocabulary.md) settles what may be written; this settles what is derived when nothing is written. A written value always wins.

<!-- derivation-constants -->

| Constant | Value | Unit | What it settles |
|---|---|---|---|
| `WALL_T` | 100 | mm | the default wall thickness (`t:` overrides). Split evenly to both sides of the centreline |
| `RAIL_T` | 60 | mm | the default thickness of a non-enclosing boundary (`air:1`) (`t:` overrides) |
| `RAIL_T_MAX` | 80 | mm | the cap on the thickness of a non-enclosing boundary. Whatever `t:` says stops here |
| `RAIL_H` | 1100 | mm | the default top height of a non-enclosing boundary (the boundary's `h:` overrides) |
| `OPENING_HEAD` | 2000 | mm | the lintel height. A door rises to it; anything else hangs down from it |
| `OPENING_H` | 1200 | mm | the default height of an opening other than a door (the opening's `h:` overrides) |
| `CEILING_T` | 30 | mm | the face thickness of a ceiling surface |
| `ROOF_T` | 200 | mm | the default roof slab thickness, and how far above the ceiling height it sits on the top level |
| `CUT_HEIGHT` | 1200 | mm | the height of the plan cut above FL (the default input to `derive`) |
| `DEFAULT_RISER_MAX` | 180 | mm | the maximum riser (`riser:` overrides). It settles the number of steps |
| `TREAD_TARGET` | 300 | mm | the target going used when a turn's landing is derived as the remainder (`tread:` overrides) |
| `LANDING_MIN` | 1100 | mm | the minimum depth of an intermediate landing. A written `landing:` is raised to it too |
| `ENTRY_LANDING` | 1100 | mm | the default depth of the entry landing (`entry:` overrides) |
| `LANE_ESCALATOR` | 1200 | mm | the default nominal width of one escalator unit (`lane:` overrides). It settles the count |
| `TREAD_SOLID` | 200 | mm | the face thickness of a tread (in solid) |
| `SLAB_T` | 200 | mm | the thickness of a landing slab, and of the inclined slab of a ramp or an escalator |
| `STEP_MARK` | 400 | mm | the pitch of the escalator step marks in plan |

A lift car is inset by `min(300, side÷6)` on all four sides and stands from FL+60 to FL+2400. An escalator balustrade is `min(140, unit width÷8)` wide and 100 thick, raised 900mm above the tread surface.

---

## 6. Tolerances

**No question may have two tolerances.** Coordinates are integers in mm, so the tolerance on length sits at half of that step.

<!-- tolerances -->

| Tolerance | Value | Unit | What it tolerates |
|---|---|---|---|
| `EPS` | 0.5 | mm | axis-parallel edges, facing edges, matching intervals, the gap in collinear merging, overrun on a grid reference, overlapping openings |
| `AREA_EPS` | 1 | mm² | whether a cut remnant vanishes; whether a left–right area difference is "no bias"; whether a roof tile survives |
| `PROBE` | 5 | mm | the distance probed either side of a drawn line. **It is the lower bound of the resolution of shape** |
| `SPAN_EPS` | 1 | mm | comparing a part's z with the cut plane, the minimum length of a visible interval, matching twin frames, the minimum length of an envelope gap, the minimum length of a wall interval |
| `CROSS_EPS` | 1e-6 | — | the sign (a cross product — twice an area) when clipping by a half-plane |
| `PARALLEL_EPS` | 1e-9 | — | parallelism between an infinite line and a segment, and the range of the segment parameter |
| `POINT_EPS` | 1 | mm | the width within which a point counts as lying on an edge of a polygon (on the boundary counts as inside). Column placement uses it too |

---

## 7. Where shape ends and appearance begins

This is what `Form` holds.

**Coordinates** (the convex parts of a region, boundary segments, opening centres, column sections, tread rectangles) · **thicknesses** (walls, rails, surfaces) · **z ranges** (walls, openings, columns, surfaces, solids) · **orientations** (edge orientation, the direction of ascent, the hinge and the swing side of a door, whether an arrow ascends) · **the identity of the subject** (whose space, whose boundary, whose opening this shape is) · **the classification in plan** (cut section / what shows below the cut / what is projected from above the cut / the arc of a movement / where a symbol is anchored).

This is what `Form` does not hold.

**Colours, typefaces, type sizes, line weights, line styles (dash patterns), the words of an annotation** (neither `UP` nor `12 steps, riser 175 / going 300`) **· drawing symbols** (the diagonals of a void, the two oblique lines of a break, the circle of a grid mark, the head of an arrow, the diagonals of a lift) · **scale, page margin and viewBox** · **drawing order, stacking and shading** · the judgement of **what to draw and what to leave out**.

**"The same composition yielding several shapes" is a defect.** What may legitimately differ is the appearance, never the shape ([scope.md](scope.md) §6).

### 7.1 The constructors of substance

What `Form` holds is centrelines, thicknesses and z. **The rule that raises substance out of those is part of the derivation too, and there must be exactly one implementation of it.** If each consumer rewrites it, the parts are shared but the rule of assembly is not, and the room for one `Form` to yield different shapes opens again.

| Constructor | What it raises |
|---|---|
| `thicken(x1, y1, x2, y2, t)` | A centreline into a thickened quadrilateral (§3.1). The same single expression serves diagonal segments |
| `bandLine(seg, cx, cy, w)` | The interval a band (an opening, a `seg`) occupies on a segment (§3.2) |
| `band(seg, cx, cy, w, t)` | That interval into a thickened quadrilateral — `bandLine` put through `thicken` |
| `columnRect(c)` | The section of a column (§3.5) |
| `runPrism(s)` | A vertical-circulation solid into a prism (a base outline plus a top and bottom z per vertex). The four corners of an inclined slab follow the rule in §4.6 |

**The vertices of the quadrilateral run start+n → end+n → end−n → start−n**, so joining the midpoints of the opposing edges returns the centreline. A plan entity carries **both the footprint (the quadrilateral) and the centreline** of an interval — whether to draw it as something with thickness or as a single line (a rail or a fence that does not enclose) is a judgement of appearance, so a consumer never has to reconstruct the centreline from the footprint.

---

## 8. A plan is not a pure section

Cutting a solid does not by itself make a plan. None of the following comes out, however exactly you cut.

- **The arc of a door** — the sign of a movement; there is no matter there
- **The projection of a void above** — something above the cut plane, dropped onto the plan of the storey below
- **The break** — the position of the very fact of having been cut
- **The descending run** — what shows below the cut plane

So `Form` holds the plan as **a set of classified 2D entities**. Each carries (geometry, classification, the identity of its subject), and the classification splits into `cut` (a cut section) / `below` (what shows below the cut) / `above` (what is projected from above the cut) / `swing` (the arc of a movement) / `anchor` (where a symbol is placed).

Tell a consumer to "cut it out of the solid" and each of them invents those four. The projection of a void above is exactly how it fell: the bundled examples carry eleven, and not one of them came out in the viewer's plan.

What is dropped as the projection of a void above is **the derived shape**. Drop the allotment and a void cut by a drawn line comes out in the shape it had before it was cut.

---

## 9. The implementation, and what checks it

The reference implementation is `derive(model, {cut?})`, returning a `Form` (the table of the public face in [tools.md](tools.md)). The ledger of constants is `DERIVATION_CONSTANTS` and the ledger of tolerances is `TOLERANCES`, and **the tables in §5 and §6 are copies of them** — `test/derive.test.ts` binds the tables to the implementation.

That `Form` carries no appearance is bound by machine too: the `Form` of every bundled example is turned into JSON and checked for the absence of any colour spelling, any Japanese, and any `UP`/`DN`.

`src/draw/` (`svgPlan` / `svgAxo`) only draws the `Form`, and **is not frozen** ([scope.md](scope.md) §8). The contents of the SVG may change at any time. What may not change is the `Form`.

**That it only draws is bound by machine too** (`test/draw.test.ts`).

- The imports of `src/draw/` are actually read, and none of the **parts that build a form** (`segmentsFor`, `placeOpening`, `placeBand`, `slabs`, `runSolids`, `verticalRuns`, `runDrawsForLevel`, `columnsFor`, `regionOf`, `heff`, `levelsSorted` and the rest) may appear
- None of the constants of §5 may be spelled inside `src/draw/`
- Every black band on the plan is a cut interval of the `Form` itself — the similarity that maps the world onto the paper is solved from the bounding boxes, and the two sets of quadrilaterals are matched
- An interval that carries a footprint always carries its centreline too, and that centreline is the axis of the footprint (§7.1)
