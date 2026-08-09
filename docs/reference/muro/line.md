---
title: line — a drawn line
mode: reference
---

# line — a drawn line

```text
boundary /pathA /pathB …
  line <start> <end>
```

A `line` is written **one level of indentation** under a [boundary](boundary.md). It is the one line that gives a boundary its realisation as **an act of design**, rather than deriving it from adjacency.

Position in koyu is normally not written — a wall appears where two spaces touch, a [column](column.md) appears at a grid intersection. But a given diagonal is not derived from anything. A corner cut following a site boundary, the kink of an existing retaining wall, a setback under a height envelope — these are **the line the designer drew**, and nothing else produces them. That is what `line` is for.

One boundary carries one line.

## The endpoints are pairs of grid words

```muro-part
boundary /L1/w04 /out t:300 spec:カーテンウォール
  line X1,Y5+2000 X2,Y6
```

Each endpoint is a pair `<X grid line>,<Y grid line>`. Either may carry an offset such as `+600` or `-900`. **Neither raw coordinates nor angles can be written** — position is always fixed by a line, and the ends of a line are grid lines. The X grid line comes first, the Y grid line second.

If both ends resolve to the same point, parse stops there and then.

## A line has no direction

**The line joining two points is the same line from whichever end it is written.** At the exit of parse, the endpoints are ordered by **resolved coordinate, ascending in x then y**. The spelling (the grid references) swaps with them, so a diagnostic quotes the spelling exactly as written, only in the other order.

Write

```muro-part
  line X1+3000,Y2 X1,Y2-3000
```

and both the model and the canonical JSON hold it as `X1,Y2-3000` then `X1+3000,Y2`.

This is not tidying. **That canonical start point is the origin of `at:` for openings on the line.** Without it, the canonical JSON stays byte-identical while a door moves — measured, `line X1,Y1+2000 X2,Y1+4000` and `line X2,Y1+4000 X1,Y1+2000` hashed the same and put the door at (1500, 2500) and at (4500, 3500).

On a diagonal segment, an opening's `at:` **can only be a ratio 0..1**, because a grid reference does not fix a unique point on a diagonal. The hinge is fixed at the start end too — `hinge`'s N/E/S/W are words of the axes and do not reach a diagonal. And `edge:` has no effect, because the line is the segment.

## What it cuts

A line is not an infinite line. **Along itself it cuts a limited interval; across itself it cuts a range that contains the other side.** A line counts as vertical when `|Δy| ≥ |Δx|` (exactly 45 degrees, and the degenerate point, count as vertical), and for a vertical line the "along" axis is y and the "across" axis is x.

| Case | Along | Across |
|---|---|---|
| dividing two spaces (both sides have a region) | the **intersection** of the two bounding boxes | the **union** of the two bounding boxes |
| cutting the envelope (one side has no region) | **the interval of the segment itself** | the **whole** bounding box of the side that has a region |

That asymmetry is the crux. Treated as an infinite line it swallows a distant wing and a room vanishes; treated as the bounding box of the segment it degenerates on an axis-parallel line and cuts nothing.

The cut merges the allocations inside the window and then redivides them across the line, so **dividing two spaces preserves total area** — the triangle one loses, the other gains. Cutting the envelope shrinks only the side that has a region; the other side gains nothing.

**Which side to keep is not written.** Every convex piece touching the window is measured whole, and the side with the greater area is kept. For an envelope cut, the bias of the side that has a region is the side kept. For two spaces, both biases are taken, and if exactly one of them is zero, the opposite of the other is used.

```muro
muro 1.2
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:隅切りの室
space /out name:外部 outside:1

boundary /L1/a /out t:150 spec:RC
  line X1,Y2-3000 X1+3000,Y2
```

The north-west triangle (3000 × 3000 ÷ 2 = 4.5 m2) falls off the 6000 × 6000 allocation.

```text
  /L1/a	隅切りの室	room	31.50 m2
  Subtotal 31.50 m2
Total 31.50 m2 (indoor floor area)
```

Area, wall positions and roof outlines all come out of that cut form. **There is one door into the form**, and it is the derived convex pieces, not the written allocation.

## What the cut did — effect

What a line actually did is recorded **at the moment of the derivation**. The public type `DrawnLine` carries it as `effect`.

| Value | Meaning | Diagnostic |
|---|---|---|
| `"cut"` | it really cut the form | — |
| `"nothing"` | it cut nothing — it coincides with the default adjacency line, or no allocation lies within its reach | LIN03 (warning) |
| `"undetermined"` | which side to keep cannot be decided — the two sides are equally biased, or the allocation is bisected exactly | LIN01 (error) |

It is not recomputed later because by then the form has **already been cut**, and the population would no longer agree. `effect` is a consequence of the derivation rather than part of the written composition, so it does not appear in the canonical JSON.

A line tracing the default adjacency line cuts nothing.

```muro-warn
muro 1.2
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:室
space /out name:外部 outside:1
boundary /L1/a /out t:150
  line X1,Y1 X2,Y1
```

```text
⚠ Line X1,Y1..X2,Y1 cuts nothing (it is the same as the default adjacency line, or falls outside the allocation)
```

A line across the diagonal of a square leaves equal areas either side, so no side can be chosen.

```muro-bad
muro 1.2
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:室
space /out name:外部 outside:1
boundary /L1/a /out t:150
  line X1,Y1 X2,Y2
```

```text
✖ Line X1,Y1..X2,Y2 bisects the allocation exactly, so which side to keep is undetermined
```

The fix is to redraw the line so it is visible which side you meant to keep. No default is chosen and nothing proceeds in silence.

## One line is shared by several boundaries

The wall of a through-passage has as many boundaries as there are tenancies fronting it. If each boundary realised the full length of the line, the plan would carry the same wall several times over.

To stop that, the line is cut by the edges of the convex pieces of both spaces, and **only the intervals whose two sides are exactly a and b** survive. The test is symmetric in a and b. So the same `line` spelling may be written on several boundaries, and each realises only the stretch it is responsible for.

## The order of the cuts

Cutting happens **once**, at the exit of parse, **in canonical boundary order**. It is not idempotent — a region shrunk by an earlier line shrinks the window of a later one.

The order is not declaration order. The canonical JSON discards the declaration order of boundaries, so cutting in declaration order would let one canonical form yield different areas. The ordering rule is the canonical JSON's own: the lexical order of `between`, and for equal `between`, serialisation order. Composition inserting boundaries between others does not disturb it.

## Diagnostics

| Code | Severity | What it says |
|---|---|---|
| LIN01 | error | the line does not separate the two spaces — the two sides are equally biased, or the allocation is bisected exactly |
| LIN02 | error | a line drawn on a vertical boundary — drawing a line is an act of dividing a plan |
| LIN03 | warning | the line cuts nothing |

No line may be drawn on a boundary between two spaces that both lack a region (LIN01). **Two** lines on the same pair of spaces is not a contradiction, though — two corner cuts are two different lines, and the spelling of the line is part of a boundary's identity.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [boundary](boundary.md) — the relation a line realises
- [space](space.md) — the allocation a line cuts
- [door](door.md) — `at:` and the hinge on a diagonal segment
- [polygon](polygon.md) — the other written shape
- [koyu check](../cli/check.md)
