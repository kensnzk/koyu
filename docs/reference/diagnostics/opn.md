---
title: OPN — opening diagnostics
mode: reference
---

# OPN — opening diagnostics

An opening (`door`, `window` and the rest) rides **on a segment** of a boundary. The segment is derived from the layout of the spaces, so with no segment there is nowhere to put it, and with several segments there is no telling which. These eight catch the placement, and the consistency of what was placed.

There are two idioms for position.

- **A ratio** — `at:0.5` is a proportion of the segment length. It is **clamped automatically** to fit the segment.
- **A grid reference** — `at:X2+450` is an absolute position. It means "put it *there*", so it is **not clamped**, and errors if it does not fit.

Omitted, it is `at:0.5` (the middle). `at` points at the opening's **center**.

| Code | severity | One line |
|---|---|---|
| [OPN01](#opn01) | error | The wrong axis for `hinge` |
| [OPN02](#opn02) | error | The openings overlap |
| [OPN03](#opn03) | warning | An opening on an open boundary has no effect on passage |
| [OPN04](#opn04) | error | There is no boundary segment on which to place the opening |
| [OPN05](#opn05) | error | There is more than one boundary segment — ambiguous |
| [OPN06](#opn06) | error | The opening is wider than the boundary segment |
| [OPN07](#opn07) | error | The wrong axis for an explicit opening position |
| [OPN08](#opn08) | error | An explicit opening position runs off the segment |

A `seg` follows the same placement rules, and [SEG04–SEG08](seg.md) correspond one to one with OPN04–OPN08. An opening on a vertical boundary (`stair`, `shaft`, `void`) is not interpreted, which [VRT05](vrt.md#vrt05) says. How to get a code is on [Reading a diagnostic](reading.md).

**An opening that could not be placed receives no further check.** One that failed on any of OPN04–OPN08 is not examined for its `hinge` axis (OPN01), and drops out of the population for overlap (OPN02). You cannot ask the direction or the distance of something that has no position.

Every wrong example below exits 1 under `koyu check --strict`, producing **exactly one** instance of that code.

## OPN01 — the wrong axis for hinge {#opn01}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:800 hinge:E
boundary /L1/a /out
boundary /L1/b /out
```

`hinge:E: a vertical segment takes N/S`

**Cause** — `hinge` says which **end** the hinge is at. It only means something as a compass along the segment. The two rooms here sit east and west, so the edge they share is a **vertical segment running north–south**, whose ends are N and S.

**Fix** — for a vertical segment (running north–south) use `hinge:N` or `hinge:S`; for a horizontal one (running east–west) use `hinge:W` or `hinge:E`. Omitted, it takes the starting end of the segment.

## OPN02 — the openings overlap {#opn02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:2000 at:0.4
  door w:2000 at:0.6
boundary /L1/a /out
boundary /L1/b /out
```

`Openings overlap (door and door — center to center 800mm < the required 2000mm)`

**Cause** — two openings on the same segment cut into each other. The required center-to-center distance is `(w₁ + w₂) / 2`, and the message prints both the measured and the required value.

**Fix** — look at the numbers in the message and move the `at`s apart, or narrow the widths. A ratio `at` is a proportion of the segment length, so the shorter the segment the smaller the real distance for the same difference in ratio. To be certain, write an absolute position with a grid reference (`at:X2+900`).

**Note** — what is checked is **openings riding on the same segment**. Openings on different edges (separated by `edge:`) are never compared, however close their coordinates.

## OPN03 — an opening on an open boundary has no effect on passage {#opn03}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b type:open
  door w:800
boundary /L1/a /out
boundary /L1/b /out
```

`A door on an open boundary has no effect on passage (it is always passable)`

**Cause** — `open` declares that there is nothing there. It is always passable to begin with, so adding a door changes nothing about passability. It is not counted by `koyu doors` either.

**Fix** — if you want the door counted (that is, a real door exists), make the boundary a `wall` (the default — write no `type:`) and put the door on it. If it is merely an opening, delete the `door` line.

**Note** — the warning does not stop the opening being checked for placement and overlap. A door on an `open` boundary that is wider than the segment produces OPN03 and [OPN06](#opn06) side by side.

## OPN04 — there is no boundary segment on which to place the opening {#opn04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:800 edge:N
boundary /L1/a /out
boundary /L1/b /out
```

`No boundary segment can hold the door (/L1/a | /L1/b)`

**Cause** — there is no segment where the opening's `edge:` narrowed to. The two rooms here sit east and west, so their shared edge is on E (seen from the a side) and there is nothing on N. The same code also appears when the boundary itself has no segment — **arriving together with [BND04](bnd.md#bnd04) / [BND06](bnd.md#bnd06)**.

**Fix** — correct the compass of `edge:`. It is read **from the rectangle of the space written first**: **N=+Y, S=−Y, E=+X, W=−X**. X is east-positive and Y is north-positive. On a boundary with only one segment, `edge:` is unnecessary.

## OPN05 — there is more than one boundary segment {#opn05}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  door w:800
boundary /L1/b /out t:150
```

`There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)`

**Cause** — a boundary with the outside (`/out` and other spaces with no region) is **all that remains** of the room's perimeter not touching another room, and it usually splits across several edges. Where on that boundary the door goes is not settled. You may as well remember it as: **placing an opening on an external wall always needs `edge:`**.

**Fix** — select the side with `edge:`. The compass is read **from the rectangle of the space written first (here `/L1/a`): N=+Y, S=−Y, E=+X, W=−X**. To put the entrance on the south, `door w:900 edge:S`.

**Note** — the same happens between two interior rooms when an L-shaped space splits their shared edge in two. Faced with ambiguity, this check **refuses rather than guesses**.

## OPN06 — the opening is wider than the boundary segment {#opn06}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:5000
boundary /L1/a /out
boundary /L1/b /out
```

`The door width 5000 exceeds the boundary segment length 4000`

**Cause** — the width is longer than the wall. The message prints the segment's real length, so you can reconcile it against the layout right there. When using an asset reference (`door SD1`), the width may be coming from the asset.

**Fix** — narrow the `w`, or widen the layout. To override an asset's width for one instance, write `w:` on the instance — the instance beats the asset.

## OPN07 — the wrong axis for an explicit opening position {#opn07}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:800 at:Y1+2000
boundary /L1/a /out
boundary /L1/b /out
```

`The door position Y1+2000 is on the wrong axis: a horizontal segment takes an X grid line`

**Cause** — when writing a position as a grid reference, it is only a position if it is on the axis along the segment. The two rooms here sit north and south, so their shared edge is a **horizontal segment running east–west**, and a position on it is measured on the X axis.

**Fix** — a horizontal segment (running east–west) takes `at:X…`; a vertical one (running north–south) takes `at:Y…`. When unsure: two rooms side by side east–west share a vertical segment (Y axis); two rooms north and south share a horizontal one (X axis).

**The message names the expected axis**, not the one you wrote — this branch is only reached when the two disagree, so the written axis is always the opposite of the expected one.

**Note — a grid reference cannot be used on a diagonal segment.** On a boundary drawn with `line` at an angle, a grid reference does not fix a position uniquely. The same OPN07 comes out with the body `The door position X2+450 cannot be used on a diagonal segment (write it as a ratio, at:0..1)`. Write a ratio.

## OPN08 — an explicit opening position runs off the segment {#opn08}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
boundary /L1/a /out
boundary /L1/b /out
```

`At Y1+200 the door (width 900) runs off the boundary segment (segment 0-4000mm, center allowed 450-3550mm)`

**Cause** — when `at` is a grid reference it is **not clamped**. A ratio (`at:0.5` and the like) is pushed back automatically to fit the segment, but a grid reference is an instruction to put it *there*, so if it does not fit it errors rather than moving silently. `at` points at the opening's **center**, so it must be at least `w/2` inside from the end.

**Fix** — bring `at` within the "center allowed" range in the message. Here that is `at:Y1+450` or more. If you only want it flush to one end, write the ratio `at:0` and it is clamped hard against the end.
