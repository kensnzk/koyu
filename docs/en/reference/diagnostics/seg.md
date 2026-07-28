---
title: SEG — uncounted-subdivision diagnostics
mode: reference
---

# SEG — uncounted-subdivision diagnostics

An **uncounted subdivision** records a difference inside something without touching area, room counts or the circulation graph. There are two of them.

- **`area`** — a patch inside a space: the stretch where the floor finish changes, say. Written indented under its parent `space`.
- **`seg`** — an interval along a boundary: the stretch where the wall specification changes. Written indented under its parent `boundary`.

The SEG family carries both. SEG01–SEG02 are about `area`; SEG03–SEG08 are about `seg`.

| Code | severity | Subject | One line |
|---|---|---|---|
| [SEG01](#seg01) | error | `area` | An `area` on a space with no region |
| [SEG02](#seg02) | warning | `area` | An `area` spills outside the region |
| [SEG03](#seg03) | warning | `seg` | A `seg` on an open boundary is not interpreted |
| [SEG04](#seg04) | error | `seg` | There is no boundary segment on which to place the `seg` |
| [SEG05](#seg05) | error | `seg` | There is more than one boundary segment — ambiguous |
| [SEG06](#seg06) | error | `seg` | The `seg` is wider than the boundary segment |
| [SEG07](#seg07) | error | `seg` | The wrong axis for an explicit `seg` position |
| [SEG08](#seg08) | error | `seg` | An explicit `seg` position runs off the segment |

Placement of a `seg` follows exactly the rules of an opening, and SEG04–SEG08 correspond one to one with [OPN04–OPN08](opn.md). A `seg` on a vertical boundary is not interpreted, which [VRT06](vrt.md#vrt06) says. How to get a code is on [Reading a diagnostic](reading.md).

Every wrong example below exits 1 under `koyu check --strict`, producing **exactly one** instance of that code.

## SEG01 — an area on a space with no region {#seg01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
  area X1..X2 Y1..Y2 floor:タイル
```

`An area cannot be written on /out, which has no region`

**Cause** — an `area` is a subdivision inside a room, pointing at part of the parent's region. With no region on the parent there is nothing to point at. Often the indentation has landed under the wrong `space`, one below the intended one — here the `area` hangs off `/out`, not `/L1/a`.

**Fix** — move the `area` directly under a `space` that has a region.

## SEG02 — an area spills outside the region {#seg02}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:タイル
```

`The area spills outside the region of /L1/a`

**Cause** — the `area`'s rectangle does not fit within the parent's region. Because an `area` affects neither area, room counts, nor the graph, this is a warning rather than an error.

**Fix** — bring the `area`'s grid references within the parent's extent.

**Note — containment is judged against the derived region**, not the allocated rectangles: the shape after any `line` has cut it. A floor finish laid on the side that was cut away does not pass.

**Note — on a parent with several rectangles joined by `+`, an `area` must fit within one of them.** A subdivision spanning two rectangles is split into two `area` lines.

## SEG03 — a seg on an open boundary is not interpreted {#seg03}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:800 spec:X
```

`A seg on an open boundary (there is no wall) is not interpreted`

**Cause** — a `seg` switches the specification of part of a wall. An `open` has no wall, so there is nothing to switch.

**Fix** — if there is a wall, remove `type:open` (the default is `wall`). If there is not, delete the `seg` line.

**Note** — unlike [OPN03](opn.md#opn03) for openings, a `seg` that draws this warning **stops there**. It receives none of the placement checks, SEG04–SEG08.

## SEG04 — there is no boundary segment on which to place the seg {#seg04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:800 edge:N spec:X
```

`No boundary segment can hold the seg (/L1/a | /L1/b)`

**Cause** — there is no segment where the `seg`'s `edge:` narrowed to. The two rooms here sit east and west, so their shared edge is on E (seen from the a side) and there is nothing on N. The same code appears when the boundary itself has no segment, arriving together with [BND04](bnd.md#bnd04) / [BND06](bnd.md#bnd06).

**Fix** — correct the compass of `edge:`. It is read **from the rectangle of the space written first**: **N=+Y, S=−Y, E=+X, W=−X**. On a boundary with only one segment, `edge:` is unnecessary.

## SEG05 — there is more than one boundary segment for the seg {#seg05}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  seg w:800 spec:X
boundary /L1/b /out t:150
```

`There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)`

**Cause** — a boundary with the outside (a space with no region) is **all that remains** of the room's perimeter not touching another room, and it usually splits across several edges. Which edge is meant is not settled. **A `seg` on an external wall always needs `edge:`.**

**Fix** — select the side with `edge:`. The compass is read from the rectangle of the space written first (here `/L1/a`): **N=+Y, S=−Y, E=+X, W=−X**.

## SEG06 — the seg is wider than the boundary segment {#seg06}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:5000 spec:X
```

`The seg width 5000 exceeds the boundary segment length 4000`

**Cause** — the `seg` is wider than the wall. The message prints the segment's real length, so you can reconcile it against the layout right there.

**Fix** — narrow the `w`. **For a specification that runs the whole length of the wall, make it an attribute of the boundary itself rather than a `seg`.** A `seg` is the tool for writing "it changes partway", not for stating the whole.

## SEG07 — the wrong axis for an explicit seg position {#seg07}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  seg w:800 at:Y1+2000 spec:X
```

`The seg position Y1+2000 is on the wrong axis: a horizontal segment takes an X grid line`

**Cause** — when writing a position as a grid reference, it is only a position if it is on the axis along the segment. The two rooms here sit north and south, so their shared edge is a **horizontal segment running east–west**, and a position on it is measured on the X axis.

**Fix** — a horizontal segment (running east–west) takes `at:X…`; a vertical one (running north–south) takes `at:Y…`. The message names **the expected axis**, not the one you wrote.

**Note — a grid reference cannot be used on a diagonal segment.** On a boundary drawn with `line` at an angle, the same SEG07 comes out with the body `The seg position X2+450 cannot be used on a diagonal segment (write it as a ratio, at:0..1)`. Write a ratio.

## SEG08 — an explicit seg position runs off the segment {#seg08}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:900 at:Y1+200 spec:X
```

`At Y1+200 the seg (width 900) runs off the boundary segment (segment 0-4000mm, center allowed 450-3550mm)`

**Cause** — when `at` is a grid reference it is **not clamped**. A ratio (`at:0.5` and the like) is pushed back automatically to fit the segment, but a grid reference is an instruction to put it *there*, so if it does not fit it errors rather than moving silently. `at` points at the `seg`'s **center**, so it must be at least `w/2` inside from the end.

**Fix** — bring `at` within the "center allowed" range in the message. Here that is `at:Y1+450` or more. If you only want it flush to one end, write the ratio `at:0` and it is clamped hard against the end.
