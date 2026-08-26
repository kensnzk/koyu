---
title: Orientation and the a side
mode: reference
---

# Orientation and the a side

**`x+`, `x-`, `y+` and `y-` are the four faces, named by the axis they look along.**

| Word | Axis |
|---|---|
| `y+` | +Y |
| `y-` | −Y |
| `x+` | +X |
| `x-` | −X |

There is no compass in them. The axes are the ones `grid X` and `grid Y` set up, and nothing about the building's bearing enters here. How coordinates are spelled is in [positions and regions](positions.md).

**Which way the model actually faces is one line of its own.** [`azimuth`](azimuth.md) gives the true bearing of the +Y axis, and it is the only place in koyu that holds a compass direction. It changes nothing on this page — `edge:y+` picks the +Y face at any bearing. Given `azimuth Y a`, the true bearings of the four faces are *a* for `y+`, *a*+90 for `x+`, *a*+180 for `y-` and *a*+270 for `x-`.

```muro
muro 1.6
name 軸の語の例
unit mm

grid X 0 6400
grid Y 0 5600

level L1 0 h:2700 slab:200

space /L1/room room X1..X2 Y1..Y2 name:居室 daylight:1
space /out name:外部 outside:1

boundary /L1/room /out t:150
  window w:2400 h:1500 edge:y- name:南窓
  window w:1200 h:1500 edge:x+ name:東窓
  door   w:900  h:2100 edge:y+ name:勝手口
```

The room above is a single rectangle `X1..X2 Y1..Y2`, so its boundary with the exterior falls into four segments. `edge:y-` is the `Y1` side (y = 0), `edge:y+` is the `Y2` side (y = 5600), `edge:x-` is the `X1` side and `edge:x+` is the `X2` side.

## Why the mapping is what it is

The outline of a derived region runs counter-clockwise. Walking that vertex list and reading only the axis-parallel edges, **an edge running +x is the `y-` face, −x is `y+`, +y is `x+`, and −y is `x-`.** The word always names the axis the face looks along, never the direction the edge runs.

**A diagonal edge faces no axis.** Writing `edge:` on a boundary realised by a `line` narrows nothing — the segments of a boundary that carries a drawn line are not filtered by `edge:` at all.

## What `edge:` selects

`edge:` **narrows the segments of a boundary to those facing that way.** It can be written in three places.

| Where | Effect |
|---|---|
| on the `boundary` line | limits that boundary to one face from the start |
| on a `door` / `window` line | picks which face the opening sits on |
| on a `seg` line | the same |

**A boundary with the exterior normally has several segments.** What is left of a room's perimeter after removing the stretches that face other spaces becomes the segments — four of them if all four sides are open. Placing an opening there without choosing a face stops.

```text
There is more than one boundary segment; pick an edge with edge:x+/x-/y+/y- (/L1/a | /out)
```

That is `OPN05` for openings and `SEG05` for `seg`. Conversely, if there is no segment facing that way at all, it is `OPN04` / `SEG04`.

## The a side — whose face is being named

**The face named by `edge:` is read from the shape of the space written first on the boundary line (the a side).**

```muro-part
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2

boundary /L1/a /L1/b edge:x+     # a's +X face — the wall between the two rooms
```

Write the same wall the other way round and the word flips.

```text
No shared edge on edge:x+: /L1/b | /L1/a (they actually touch on x-)
```

With `/L1/b` first, the wall between the rooms lies on b's −X side, so it is `edge:x-`. **The order of `a` and `b` matters for exactly two things — `edge` and `swing`.** Everything else (where the segments fall, how area is split, which side a drawn line keeps) is independent of the order.

**When the a side has no region, the word is read from the side that does.** In `boundary /out /L1/room edge:y+` the `y+` is the +Y face of `/L1/room`, because the exterior has no shape to read a face from.

## Which way the door opens — `hinge` and `swing`

Two words decide it. **One is a word about axes, the other about the relation.**

**`hinge` is the jamb — which end of the segment the hinge sits on.**

| Segment | Accepted values | If omitted |
|---|---|---|
| horizontal (a `y+` / `y-` face) | `x-` / `x+` | the −X end (the lower coordinate) |
| vertical (an `x+` / `x-` face) | `y-` / `y+` | the −Y end (the lower coordinate) |
| diagonal | — | pinned to the start end |

Getting the axis wrong is `OPN01` — `hinge:y+` cannot go on a horizontal segment. Segments always run in ascending coordinate order, so "the start" is the lower-coordinate end.

**`swing` is which side the leaf opens toward — `a` or `b`.** It names the relation, not an axis. Omitted, the door opens toward `a` if a has a region, otherwise toward `b`. The actual sense of rotation is taken from the component pointing at the centre of the nearest part of the shape on the side it opens toward.

Sliding, automatic, entrance and sliding-gate styles have no swing arc. They use the hinge side as
their retraction or orientation side. Hinged door and window styles use the same `hinge:` and
`swing:` pair for their arcs.

## The axis of `at:` follows the face

**On a horizontal segment (a `y+` / `y-` face) an absolute position is an X grid reference; on a vertical one (an `x+` / `x-` face) it is a Y reference.**

```text
The door position X1+1000 is on the wrong axis: a vertical segment takes a Y grid line
```

That is `OPN07` / `SEG07`. A ratio (`at:0.3`) works on either.

## Vertical circulation uses the same four words

The value of `stair:`, `ramp:` and `escalator:` is **the direction of travel going up**, spelled with the same four axis words.

```muro-part
space /B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 stair:y+ form:return
```

`stair:y+` means "rises toward +Y". Riser count, tread depth and slope are never written — they are derived from the region and the storey height. A lift has no direction, so it is written `lift:1`. A value that is none of the four is `RUN02`.
