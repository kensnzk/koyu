---
title: Geometry helpers
mode: reference
---

# Geometry helpers

Five functions over polygons and rectangles. Coordinates are millimetres; areas come back in m².

```ts
import { envelopeGaps, pointInPolygon, polyBounds, polygonAreaM2, rectToPoly } from "@kensnzk/koyu";
```

**Not one judgement lives here.** Neither "does the building run off the site?" nor "is there a hole in the envelope?" is answered here — those are `site.escape` and `envelope.gap` in [`validate`](validate.md). What is here is only the numbers and shapes those judgements read.

## polygonAreaM2

```ts
function polygonAreaM2(points: Pt[]): number
```

The shoelace area of a polygon, in m². **Winding does not matter** — it is the absolute value of the signed area, so clockwise and counter-clockwise give the same number.

## pointInPolygon

```ts
function pointInPolygon(p: Pt, poly: Pt[], eps?: number): boolean
```

Whether a point is inside a polygon. **On the boundary counts as inside.** `eps` is how wide a band counts as "on an edge"; the default is 1 mm.

## polyBounds

```ts
function polyBounds(poly: Pt[]): Rect
```

The bounding rectangle of a vertex list.

## rectToPoly

```ts
function rectToPoly(r: Rect): Pt[]
```

A rectangle as a vertex list, **counter-clockwise**, in the order `(x1,y1) → (x2,y1) → (x2,y2) → (x1,y2)`.

**That winding is a promise.** The derivation that reads a compass direction from an edge's direction — an edge running +x faces south, +y east, −x north, −y west — depends on it.

```ts
import { pointInPolygon, polyBounds, polygonAreaM2, rectToPoly } from "@kensnzk/koyu";

const poly = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }];
console.log(polygonAreaM2(poly), pointInPolygon({ x: 5000, y: 5000 }, poly),
  pointInPolygon({ x: 12000, y: 0 }, poly), pointInPolygon({ x: 0, y: 5000 }, poly), polyBounds(poly));
console.log(polygonAreaM2([...poly].reverse()));
console.log(rectToPoly({ x1: 0, y1: 0, x2: 3600, y2: 4000 }));
```

```text
100 true false true { x1: 0, x2: 10000, y1: 0, y2: 10000 }
100
[
  { x: 0, y: 0 },
  { x: 3600, y: 0 },
  { x: 3600, y: 4000 },
  { x: 0, y: 4000 }
]
```

The third `pointInPolygon` sits exactly on an edge and comes back **true**. Reversing the winding leaves the area unchanged.

## envelopeGaps

```ts
function envelopeGaps(model: Model, s: Space): Segment[]
```

Returns the stretches of a space's perimeter that **face nothing at all** — edges opposite neither another space nor a declared boundary to the exterior. **Holes in the envelope.**

Default boundaries are never derived against a space with no region, so **forgetting a boundary to the exterior is silently the absence of a wall.** This derivation exists to put that into words.

Stretches shorter than `SPAN_EPS` (1 mm) are dropped. A space with no region, or with no settled level, gives an empty array.

```ts
import { envelopeGaps, parse } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W`);

for (const s of ["/L1/a", "/L1/b"]) {
  console.log(s, envelopeGaps(g, g.spaces.get(s)!).map((x) => `${x.edgeOfA} ${x.x1},${x.y1}→${x.x2},${x.y2}`));
}
```

```text
/L1/a [ 'S 0,0→3600,0', 'N 0,4000→3600,4000' ]
/L1/b [ 'S 3600,0→7200,0', 'E 7200,0→7200,4000', 'N 3600,4000→7200,4000' ]
```

The W side of `/L1/a` is covered by `boundary /L1/a /out edge:W`, and its E side faces `/L1/b`, so what remains — S and N — comes back as holes.

What you get is a [`Segment`](derive.md#segmentsfor): endpoints, whether it is horizontal, and which side of the a-space it belongs to. **It carries no length**, so measure from the endpoints if you need one.

## Geometric tolerances

**The numbers that decide how different two things must be to be different things live in one place**: see [`TOLERANCES`](derive.md#tolerances). Both the default width for "on an edge" (`POINT_EPS` = 1 mm) and the minimum length of an envelope gap (`SPAN_EPS` = 1 mm) are there.

## See also

- [Deriving form](derive.md) — `Segment` and the tolerance ledger
- [Questions about a model](queries.md) — areas and site numbers
- [Validation](validate.md) — the surface that judges these shapes
