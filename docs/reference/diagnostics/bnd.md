---
title: BND — boundary diagnostics
mode: reference
---

# BND — boundary diagnostics

A boundary is not a thing but **a relation between two spaces**. The wall centerline segment is derived from that relation and the layout of both spaces, so a way of writing under which the relation does not stand produces no segment at all. These seven catch that.

A boundary between two touching spaces **is derived as a wall whether or not you write it**, and so is the boundary between a space and the outside. You write a `boundary` to declare an exception (`type:open`, `air:1`), to hang an attribute, an opening or a `seg` on it, or — outside — to say *which* outside a face looks at.

| Code | severity | One line |
|---|---|---|
| [BND01](#bnd01) | error | A boundary between a space and itself |
| [BND02](#bnd02) | error | A duplicate boundary |
| [BND03](#bnd03) | error | A wall boundary to a space on a different level |
| [BND04](#bnd04) | error | The spaces do not touch, so no boundary can be derived |
| [BND05](#bnd05) | warning | Edge-restricted and unrestricted boundaries coexist on one pair |
| [BND06](#bnd06) | warning | No edge remains on the perimeter, so the segment is of zero length |
| [BND08](#bnd08) | warning | A face onto the outside got a default wall, because no boundary says what it looks at |

`BND07` is a [retired number](retired.md). How to get a code is on [Reading a diagnostic](reading.md).

Every wrong example below exits 1 under `koyu check --strict`, producing **exactly one** instance of that code. Paste them and confirm.

## BND01 — a boundary between a space and itself {#bnd01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /out /out
boundary /L1/a /out
```

`A boundary between a space and itself cannot be written: /out`

**Cause** — a boundary is a relation joining two **different** spaces. The same path was written twice. Copying a line and forgetting to fix one side is almost the whole of it.

**Fix** — correct the second path to its intended partner.

## BND02 — a duplicate boundary {#bnd02}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
boundary /L1/a /out
boundary /L1/b /out
```

`Duplicate boundary: /L1/a | /L1/b (first seen at <absolute path>/bad.muro:line 6)`

**Cause** — there are two boundaries on the same pair of spaces, identical down to the `edge` restriction. Since the order carries no meaning, neither can be said to win. Even when `wall` and `open` contradict as they do here, the later one is not silently taken. The diagnostic's `related` carries the position of the earlier one.

**Fix** — consolidate into one. To give different specifications per edge, put `edge:` on both and restrict them to different edges — differing `edge`s are not a duplicate.

**Note** — for a boundary carrying a `line`, the spelling of the line is part of its identity. Drawing two lines on the same pair of spaces — two splayed corners, say — is not a duplicate.

## BND03 — a wall boundary to a space on a different level {#bnd03}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /L2/a t:120
boundary /L1/a /out
boundary /L2/a /out
```

`A wall boundary cannot be written to a space on a different level (vertical takes type:stair/shaft/void): /L1/a | /L2/a`

**Cause** — a wall does not stand across storeys. A `boundary` was written meaning to connect two storeys, but `type:` was omitted so it defaulted to `wall`.

**Fix** — to write a relation between storeys, add `type:stair` (a stair), `type:shaft` (a lift and the like) or `type:void` (a void). **Floors are not written** — adjacency between storeys is derived automatically from overlap in plan, and the default is a floor. The diagnostics for vertical boundaries themselves are on [VRT](vrt.md).

## BND04 — the spaces do not touch, so no boundary can be derived {#bnd04}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
space /out outside:1
boundary /L1/a /L1/b t:120
boundary /L1/a /out
boundary /L1/b /out
```

`The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b`

**Cause** — the wall centerline segment is derived from the layout of the two spaces. Unless they touch in a way from which it can be derived, the boundary relation does not stand up. The commonest case is **touching only at a corner**. Here `/L1/a` is `X1..X2 Y1..Y2` and `/L1/b` is `X2..X3 Y2..Y3`; they share only the point (X2, Y2) and no edge of any length. **Without a shared edge of nonzero length, they are not "touching".** Coordinates that are simply off — writing `Y3..Y4` where `Y2..Y3` was meant — give the same symptom.

**Fix** — draw the two rectangles on paper and confirm whether they share an edge. If not, correct the layout. If you really want to connect two rooms that are apart, declare the space between them (a corridor, a hall) and split it into two boundaries.

**With `edge:` the body changes.** When the pair does touch once the restriction is lifted, the message names the edge on which they actually touch.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b edge:N t:120
boundary /L1/a /out
boundary /L1/b /out
```

`No shared edge on edge:N: /L1/a | /L1/b (they actually touch on E)`

Here the mistake is not the layout but **one word of compass**. `edge:` is read from the rectangle of the space written first: **N=+Y, S=−Y, E=+X, W=−X**. X is east-positive and Y is north-positive.

## BND05 — edge-restricted and unrestricted boundaries coexist on one pair {#bnd05}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b edge:E t:150
boundary /L1/a /out
boundary /L1/b /out
```

`The same pair of spaces carries both an edge-restricted and an unrestricted boundary (the segments overlap): /L1/a | /L1/b`

**Cause** — a boundary with no `edge` points at **all** the segments of that pair; one with `edge:E` points at the E side among them. Write both and two boundaries ride on the E side, doubling both the thickness (`t`) and the specification. It slips past the [BND02](#bnd02) duplicate error, but is almost never the intended state.

**Fix** — if the specification is common to every side, consolidate into the one without `edge`. To vary per side, write **every** one with `edge:`.

**Note** — the diagnostic's `line` points at one of the declarations that made the set (the unrestricted one for preference), with the rest in `related`. Being told only that something coexists *somewhere* leaves nowhere to go and fix it.

## BND06 — no edge remains on the perimeter, so the segment is of zero length {#bnd06}

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out edge:E t:150
boundary /L1/a /out edge:N t:150
boundary /L1/a /out edge:S t:150
boundary /L1/a /out edge:W t:150
boundary /L1/b /out t:150
```

`No edge remains on the perimeter for edge:E, so the boundary segment is of zero length: /L1/a | /out`

**Cause** — a boundary with a space that has no region (an `exterior`, say) is **what remains of the room's perimeter after removing the intervals that touch other spaces**. Here `/L1/a`'s E side is occupied entirely by `/L1/b`, so nothing remains facing `/out`. The boundary you wrote points at nothing.

**Fix** — the edge was mistaken. The compass of `edge:` is **read from the rectangle of the space written first (the a side)**: **N=+Y (north), S=−Y (south), E=+X (east), W=−X (west)**. Here `edge:W` is correct. Remove the compass entirely and the boundary points at all three remaining sides.

**Note** — if that boundary carries an opening or a `seg`, there is no segment to place it on, so [OPN04](opn.md#opn04) / [SEG04](seg.md#seg04) come out alongside.

## BND08 — a face onto the outside got a default wall {#bnd08}

`warning`

```muro-warn
muro 1.4
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /road outside:1 road:6000
boundary /L1/a /road edge:S
boundary /L1/a /road edge:N
boundary /L1/a /road edge:W
boundary /L1/b /road edge:S
```

`A default wall was derived where /L1/b faces the outside: E 4000mm / N 3600mm (7600mm over 2 runs) — write a boundary to say which outside it faces`

**This is not a hole.** The wall is there — `/L1/b` is enclosed on all four sides, and the plan and the solids show it. What is missing is the *name* of what those two faces look at. Whether the east side is a road, a neighbour's wall or a garden is information nobody can derive, and it decides the frontage, the daylight and the specification.

**Cause** — the space has perimeter that no declared `boundary` reaches. `/L1/b` said only that its south side faces `/road`; east and north went unwritten, and the default filled them.

**Fix** — write the boundary. One line per counterpart, and `edge:` where the sides differ.

```muro-part
boundary /L1/b /road edge:E
boundary /L1/b /neighbour edge:N
```

**Suppression is by run, not by pair.** Everywhere else one declaration on a pair suppresses the whole derivation ([defaults](../muro/defaults.md)); the outside is not a pair — it is "whatever the rest faces" — so there is nothing to suppress as a unit. Each declared boundary takes the runs it reaches, and the default takes what is left. That is why `/L1/a`, which wrote three of its four sides, draws nothing: the fourth is its shared edge with `/L1/b`.

**Why it is a warning and not an error** — because the file is not wrong. A plan being worked out before the site is settled is a legitimate state, and the shape it produces is determinate. What the warning says is that a decision has been left to the default.

**Population and order** — one per space, in the order the spaces are declared; not one per run. What you write to fix it is a `boundary` line, not one line per face.
