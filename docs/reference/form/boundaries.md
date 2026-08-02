---
title: Boundary segments — where a wall stands
mode: reference
---

# Boundary segments — where a wall stands

There is no operation that places a wall. **A wall's position emerges from the relation between the [convex pieces](regions.md) of two spaces.** The `boundary` line says what lies between those two, not where a line runs.

```ts
form.boundaries[0].segment
// { x1: 3600, y1: 0, x2: 3600, y2: 4500, horizontal: false, edgeOfA: "E" }
```

One boundary can produce **several segments**. `Form` holds one `FormBoundary` per segment, all sharing the same `ref`.

## Edge orientation

Walk the counter-clockwise vertex list of a piece and read only the axis-parallel edges.

| Travelling | Face |
|---|---|
| +x | **S** |
| −x | **N** |
| +y | **E** |
| −y | **W** |

So **N = +Y, S = −Y, E = +X, W = −X**. A diagonal edge has no orientation.

Two edges "face each other" when their orientations are opposite (N↔S / E↔W) and their fixed coordinates differ by at most `EPS`.

`edgeOfA` is the orientation **seen from `a`**, the space written first. `boundary /L1/a /L1/b` and `boundary /L1/b /L1/a` are two spellings of the same relation, but `edge:` names opposite faces in them.

## Deriving the segments — the order matters

Segments are decided in this order. **The first branch that applies settles it.**

1. If either end space does not exist, there is no segment
2. If `type` is `stair` / `shaft` / `void`, there is no segment (**a vertical boundary has no wall**)
3. **If there is a drawn line, that line is the realisation of the boundary.** Neither collinear merging nor `edge:` filtering applies
4. If both sides have regions, take the **shared edges**. Different levels means no segment (no wall stands between levels)
5. If only one side has a region, take the **outline**. The counterpart is "every space on the same level other than these two"
6. If neither side has a region, there is no segment

Results from 4 and 5 go through collinear merging, and finally `edge:` narrows them by "the face as seen from a".

### Shared edges

Take the axis-parallel edges of A's pieces and B's pieces that **face each other and share an overlapping interval**. An overlap at or below `EPS` is not a shared edge — **touching at a point is not touching**. Segments run in ascending coordinate order and carry the orientation seen from `a`.

### Outline

For each edge of each piece, subtract the intervals covered by facing edges of the counterpart. **Other pieces of the same space count as counterparts too**, so an L written as two rectangles grows no wall along its internal seam. The order of subtraction does not affect the result.

An outline splits into several faces. That is why placing an opening onto the exterior needs `edge:N/E/S/W` ([OPN05](../diagnostics/opn.md)).

## Collinear merging

Segments lying on the same line are joined into one. The grouping key is **(orientation, fixed coordinate, face as seen from a)**, and **the fixed coordinate must match exactly**. Within a group, segments are sorted ascending; a gap at or below `EPS` extends the run, a larger one breaks it.

**Back-to-back edges are never merged.** An N face and an S face on the same line have different orientations, so they stay separate segments.

Merging is what lets a single window span several rectangles and still sit on one segment.

## The interval a drawn line realises

**One design line is shared by several boundaries.** The wall of a through-passage has as many boundaries as there are units along it. If every boundary realised the full length of the line, the plan would carry the same wall several times over.

To prevent that, the line is cut at the edges of both spaces' pieces; from the midpoint of each interval two points are taken `PROBE` (5mm) away along the normal, and **only the intervals where left and right are exactly a and b** are kept. If one side has no region, the side that does being alone there makes it a boundary. The test is symmetric in a and b.

`PROBE` is **the lower bound on the resolution of shape** — a space narrower than that can be assigned to neither side, and the boundary produces no segment at all.

Output segments keep the **canonical endpoint order** (ascending resolved coordinate) and carry no face seen from `a`. Therefore **`edge:` on a boundary that has a `line` has no effect**.

## Passability

Whether a segment exists and whether a person can pass are different questions.

| `type` | Passable |
|---|---|
| `wall` | **only if there is a door.** A `window` does not pass |
| `open` | always |
| `stair` | always (vertical passage) |
| `shaft` | no — continuous as space, but people do not go through |
| `void` | no — there is no floor |

`air:1` is **about enclosure, not about passage**. A rail wall is `wall` + `air:1` with no door, so it is impassable automatically.

`passable(boundary)` returns this. It says nothing about pass or fail — "can you get out" is answered separately by the [judgement face](../validate/access.md).

## Holes in the envelope

Parts of a space's outline face **neither another space nor a declared exterior boundary**. Those are holes in the envelope, and `envelopeGaps(model, space)` returns them as segments.

Touching spaces default to a wall, but **no default is derived against a space with no region** (the exterior) — naming the counterpart is itself information, so it is declared. A forgotten `boundary` to the outside therefore becomes a silent absence of wall. `check` does not say so. The [judgement face](../validate/envelope.md) does, as `envelope.gap`.

## Neighbouring pages

- [Regions](regions.md) — where the edges come from
- [Matter](bodies.md) — thickness and z land on the segment
- [boundary](../muro/boundary.md) — how to write one
- [orientation](../muro/orientation.md) — the N/E/S/W convention
- [BND diagnostics](../diagnostics/bnd.md) — when no segment can be derived
- [envelope judgement](../validate/envelope.md) — holes in the envelope
