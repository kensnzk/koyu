---
title: Orientation and the a side
mode: reference
---

# Orientation and the a side

**`N`, `E`, `S` and `W` are words about axes.**

| Word | Axis | Direction |
|---|---|---|
| `N` | +Y | north |
| `S` | −Y | south |
| `E` | +X | east |
| `W` | −X | west |

They are not a compass needle. If the building is not oriented to true north, these four words still mean +X / −X / +Y / −Y in the coordinate system that `grid X` and `grid Y` set up. How coordinates are spelled is in [positions and regions](positions.md).

```muro
koyu 1.0
name 方位の例
unit mm

grid X 0 6400
grid Y 0 5600

level L1 0 h:2700 slab:200

space /L1/room room X1..X2 Y1..Y2 name:居室 daylight:1
space /out name:外部 outside:1

boundary /L1/room /out t:150
  window w:2400 h:1500 edge:S name:南窓
  window w:1200 h:1500 edge:E name:東窓
  door   w:900  h:2100 edge:N name:勝手口
```

The room above is a single rectangle `X1..X2 Y1..Y2`, so its boundary with the exterior falls into four segments. `edge:S` is the `Y1` side (y = 0), `edge:N` is the `Y2` side (y = 5600), `edge:W` is the `X1` side and `edge:E` is the `X2` side.

## Why the mapping is what it is

The outline of a derived region runs counter-clockwise. Walking that vertex list and reading only the axis-parallel edges, **an edge running +x is the `S` face, −x is `N`, +y is `E`, and −y is `W`.** So `N` names the +Y face, `S` the −Y face, `E` the +X face and `W` the −X face.

**A diagonal edge has no compass direction.** Writing `edge:` on a boundary realised by a `line` narrows nothing — the segments of a boundary that carries a drawn line are not filtered by `edge:` at all.

## What `edge:` selects

`edge:` **narrows the segments of a boundary to those facing that way.** It can be written in three places.

| Where | Effect |
|---|---|
| on the `boundary` line | limits that boundary to one face from the start |
| on a `door` / `window` line | picks which face the opening sits on |
| on a `seg` line | the same |

**A boundary with the exterior normally has several segments.** What is left of a room's perimeter after removing the stretches that face other spaces becomes the segments — four of them if all four sides are open. Placing an opening there without choosing a face stops.

```text
There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)
```

That is `OPN05` for openings and `SEG05` for `seg`. Conversely, if there is no segment facing that way at all, it is `OPN04` / `SEG04`.

## The a side — whose face is being named

**The compass word in `edge:` is read from the shape of the space written first on the boundary line (the a side).**

```muro-part
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2

boundary /L1/a /L1/b edge:E     # a's east face — the wall between the two rooms
```

Write the same wall the other way round and the word flips.

```text
No shared edge on edge:E: /L1/b | /L1/a (they actually touch on W)
```

With `/L1/b` first, the wall between the rooms lies to b's west, so it is `edge:W`. **The order of `a` and `b` matters for exactly two things — `edge` and `swing`.** Everything else (where the segments fall, how area is split, which side a drawn line keeps) is independent of the order.

**When the a side has no region, the word is read from the side that does.** In `boundary /out /L1/room edge:N` the `N` is the north face of `/L1/room`, because the exterior has no shape to read a face from.

## Which way the door opens — `hinge` and `swing`

Two words decide it. **One is a word about axes, the other about the relation.**

**`hinge` is the jamb — which end of the segment the hinge sits on.**

| Segment | Accepted values | If omitted |
|---|---|---|
| horizontal (an `N` / `S` face) | `W` / `E` | the west end (the lower coordinate) |
| vertical (an `E` / `W` face) | `S` / `N` | the south end (the lower coordinate) |
| diagonal | — | pinned to the start end |

Getting the axis wrong is `OPN01` — `hinge:N` cannot go on a horizontal segment. Segments always run in ascending coordinate order, so "the start" is the west or south end.

**`swing` is which side the leaf opens toward — `a` or `b`.** It is not a compass word. Omitted, the door opens toward `a` if a has a region, otherwise toward `b`. The actual sense of rotation is taken from the component pointing at the centre of the nearest part of the shape on the side it opens toward.

Openings with `style:sliding` or `style:auto` have no arc — they slide toward the hinge side.

## The axis of `at:` follows the face

**On a horizontal segment (`N` / `S`) an absolute position is an X grid reference; on a vertical one (`E` / `W`) it is a Y reference.**

```text
The door position X1+1000 is on the wrong axis: a vertical segment takes a Y grid line
```

That is `OPN07` / `SEG07`. A ratio (`at:0.3`) works on either.

## Vertical circulation uses the same four words

The value of `stair:`, `ramp:` and `escalator:` is **the direction of travel going up**, spelled with the same four words.

```muro-part
space /B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 stair:N form:return
```

`stair:N` means "rises toward +Y". Riser count, tread depth and slope are never written — they are derived from the region and the storey height. A lift has no direction, so it is written `lift:1`. A value that is none of the four is `RUN02`.
