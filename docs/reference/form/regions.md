---
title: Regions — from allocation to shape
mode: reference
---

# Regions — from allocation to shape

The region of a space is written as a union of rectangles. **The written allocation is not the shape.** The shape is a list of **convex pieces** derived from it.

```ts
form.spaces[0].outline
// [ [ {x:0,y:0}, {x:3600,y:0}, {x:3600,y:4500}, {x:0,y:4500} ] ]
```

Areas, wall positions, roof outlines, where columns stand, projections — [every derivation that reads shape](index.md) goes through this one door.

## From allocation to pieces

Each rectangle is first mapped to four counter-clockwise vertices.

```text
{x1,y1,x2,y2}  →  [(x1,y1), (x2,y1), (x2,y2), (x1,y2)]
```

Then, if a boundary carries a [drawn line](../muro/line.md), the pieces are re-cut by its half-plane.

```text
no line  :  pieces = a copy of the allocation
a line   :  pieces = outside the window + the inside re-cut by the half-plane
```

Cutting happens **exactly once**, at the exit of composition. It **is not idempotent** — a region shrunk by an earlier line shrinks the window of a later one.

## The order of cutting is not declaration order

Lines cut in **canonical boundary order**: the lexicographic order of `between`, with equal `between` broken by serialised content. Composition may insert boundaries in the middle; the order does not move.

Cutting in declaration order is forbidden because [the canonical form discards declaration order](../json/index.md). Cutting by information that is discarded means the same canonical form yields different areas — measured, two crossing lines gave 27.00 m² and 22.50 m² from byte-identical models. **Shape must be a function of the canonical form.**

## The window a line reaches

A line is not an infinite line. **Along itself it cuts a limited interval; across itself it cuts a range that contains the other side.** The asymmetry is the point — treated as an infinite line it swallows a distant wing and the room vanishes; treated as the bounding box of the segment it degenerates for an axis-parallel line and cuts nothing. Both failures actually happened.

A line is **vertical** when `|Δy| ≥ |Δx|` (exactly 45° and a degenerate point count as vertical). For a vertical line the "along" axis is y and the "across" axis is x; for a horizontal line it is the other way round.

| Case | Along | Across |
|---|---|---|
| Re-dividing two spaces (both sides have a region) | the **intersection** of the two bounding boxes | the **union** of the two bounding boxes |
| Cutting the envelope (one side has no region) | **the interval of the segment itself** | the **whole** bounding box of the side that has a region |

If either side of the window is not greater than the [tolerance](constants.md) `EPS`, the window has no substance and the line cuts nothing ([LIN01](../diagnostics/lin.md)).

## Which side is kept

Which side of the line survives is not written. It is decided by **measuring, whole, the pieces the window touches**. Whether a piece is touched is read from bounding-box overlap. Each piece is split by the line, the total area on the left is compared with the total on the right, and a difference below `AREA_EPS` counts as "no bias".

**Cut inside the window only; decide from the whole piece.** Measuring every piece lets a wing the line never reaches dominate the sign and the room disappears; measuring only inside the window makes a corner-to-corner line look like a bisection.

- **Cutting the envelope** — the bias of the side that has a region is the side kept. No bias, no cut
- **Two spaces** — take the bias of both sides; if exactly one is 0, give it the opposite of the other. If both are 0, or if both point the same way, no cut

**Which of `a` and `b` was written first has no effect on which side is kept.** `boundary /L1/room /out` and `boundary /out /L1/room` are two spellings of the same relation, and the side kept is decided by **the side that has a region**. The direction of a/b matters only for `edge` and `swing` — the two things that need "seen from which side". Before this rule existed, reversing the order gave 26 m² and 34 m², and `check` stayed green.

## The operation

The pieces are split into inside and outside the window, and **the allocation inside the window is merged before being re-divided across the line**.

- **Re-dividing two spaces preserves total area** — the triangle one loses, the other gains
- **Cutting the envelope only shrinks the side with a region** — the other side gains nothing

If a half-plane cut leaves fewer than three vertices, or an area at or below `AREA_EPS`, the piece is treated as never having existed. Without that threshold, hair-thin slivers survive at the end of a chamfer, get read as edges, and grow ghost walls.

## A line has no direction

**The same two points joined in either order are the same line.** Before cutting, the endpoints of every line are ordered by **resolved coordinate, ascending in (x, then y)** — the same rule canonical JSON uses for the endpoint pair. The spelling (the grid reference) travels with the swap, so a diagnostic quotes exactly what was written, only in the other order.

**That canonical start point is the origin for the `at:` of any opening carried by the line.** Without the ordering, canonical JSON stays byte-identical while the door moves — measured, `line X1,Y1+2000 X2,Y1+4000` and `line X2,Y1+4000 X1,Y1+2000` hashed identically while placing the door at (1500, 2500) and (4500, 3500).

## What the cut actually did

What a line did is recorded at the moment it does it. The public type `DrawnLine` carries it as `effect`.

| Value | Meaning | Diagnostic |
|---|---|---|
| `"cut"` | it really cut the shape | — |
| `"nothing"` | it cut nothing — same as the default adjacency line, or the allocation lies outside its reach | [LIN03](../diagnostics/lin.md) (warning) |
| `"undetermined"` | which side to keep is undecidable — equal bias on both sides, or an exact bisection | [LIN01](../diagnostics/lin.md) (error) |

It is not recomputed later, because by then the counterpart is **the already-cut shape** and the population no longer matches. `effect` is a consequence of derivation, not written composition, so it does not appear in canonical JSON.

## Write one

```muro
muro 1.3
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:隅切りの室
space /out name:外部 outside:1

boundary /L1/a /out t:150 spec:RC
  line X1,Y2-3000 X1+3000,Y2
```

The north-west triangle (3000 × 3000 ÷ 2 = 4.5 m²) falls off a 6000 × 6000 allocation.

```sh
npx tsx src/cli.ts stats corner.muro
```

```text
L1
  /L1/a	隅切りの室	room	31.50 m2
  Subtotal 31.50 m2
Total 31.50 m2 (indoor floor area)
  room: 31.50 m2
```

The allocation is still 36 m². **The area comes from the pieces.**

## Neighbouring pages

- [Form](index.md) — `derive(model)` and the four promises
- [Boundary segments](boundaries.md) — walls stand on the edges of pieces
- [line](../muro/line.md) — how to write a line
- [space](../muro/space.md) — how to write an allocation
- [LIN diagnostics](../diagnostics/lin.md) — what comes out when a cut fails
