---
title: boundary — the boundary between two spaces
mode: reference
---

# boundary — the boundary between two spaces

```text
boundary /pathA /pathB [key:value...]
  door … / window … / seg … / line …      # one level of indentation
```

`boundary` is not a line that places a wall. It is **a line declaring that a boundary relation exists between two spaces**. The wall centerline is written nowhere — it is derived from the allocations of the two spaces.

So a boundary belongs to neither space. It is not owned by `/L1/a` or by `/L1/b`; it is a first-class relation joining the two.

## Segments are derived, not written

How the segments are found depends on whether each side has a region.

| Case | Segments |
|---|---|
| Both sides have a region | the **shared edge** — the interval where two collinear edges overlap. An overlap of no length is not a boundary (a single corner point is not contact) |
| Only one side has a region | the **remaining perimeter** — the outline of the side that has a region, minus every interval facing another space on the same level |
| Neither side has a region | no segment |
| A vertical kind (`stair` / `shaft` / `void`) | no segment — vertical boundaries carry no wall |

Collinear segments are merged into one, but only when direction, fixed coordinate and the compass point as seen from the a side all agree. That is why an opening can sit on a single segment even where the wall spans several rectangles.

**One relation can split into several segments.** A boundary with a space that has no region — the outside, typically — usually splits across all four sides of the room, so placing an opening means picking a side with `edge:`.

Writing a `wall` boundary to a space on a different level is an error (BND03). Relations that cross storeys are carried by the vertical kinds.

## The five kinds

`type:` says nothing but topology. **No name of a thing goes in it** — a railing, a curtain wall and reinforced concrete are all values of `spec:`.

| type | Direction | Passable | Meaning |
|---|---|---|---|
| `wall` | horizontal (default) | only where there is a door | there is something there |
| `open` | horizontal | always | there is nothing there — a nominal seam in one continuous space |
| `stair` | vertical | yes | the topology shared by stairs, ramps and escalators |
| `shaft` | vertical | no | continuous but not passable (a lift shaft, a pipe space) |
| `void` | vertical | no | the absence of a floor |

**Vertical passability is carried by the single word `stair`.** A stair, a ramp and an escalator are all the same relation — "you can pass between these levels" — so the type list does not grow. The difference between the devices is declared on the space (`stair:` `ramp:` `escalator:` `lift:`), where it acts as a rule for generating form.

Floors are not written. Spaces on consecutive levels are vertically adjacent wherever they overlap in plan, and the default reading of that adjacency is "there is a floor". Only the exceptions are declared, with `stair` / `shaft` / `void`.

```muro
koyu 1.1
name 五つの kind
unit mm

grid X 0 4000 8000 11000 13500
grid Y 0 6000
level L1 0 h:2700 slab:200
level L2 3000 h:2700 slab:250

space /L1/hall   hall   X1..X2 Y1..Y2 name:ホール
space /L1/lounge lounge X2..X3 Y1..Y2 name:ラウンジ
space /L1/st     stair  X3..X4 Y1..Y2 name:階段室 stair:E
space /L1/ev     shaft  X4..X5 Y1..Y2 name:EV1F lift:1
space /L2/void          X1..X2 Y1..Y2 name:吹抜け void:1
space /L2/office office X2..X3 Y1..Y2 name:事務室
space /L2/st     stair  X3..X4 Y1..Y2 name:階段室2F
space /L2/ev     shaft  X4..X5 Y1..Y2 name:EV2F lift:1
space /out name:外部 outside:1

boundary /L1/hall /L1/lounge type:open
boundary /L1/lounge /L1/st t:150 spec:RC
  door w:900 h:2000 name:階段扉
boundary /L1/hall /out t:180 spec:EW
  door w:1200 h:2100 edge:S name:玄関
boundary /L2/void /L2/office t:150 spec:手すり air:1 h:1100

boundary /L1/hall /L2/void type:void
boundary /L1/st /L2/st type:stair
boundary /L1/ev /L2/ev type:shaft
```

`koyu graph` reads the web of relations back to you.

```text
/L1/hall (ホール)
  〰 open → /L1/lounge
  — 1 door → /out  (spec:EW)
  ↕ void → /L2/void
/L1/lounge (ラウンジ)
  〰 open → /L1/hall
  — 1 door → /L1/st  (spec:RC)
/L1/st (階段室)
  — 1 door → /L1/lounge  (spec:RC)
  ↕ stair → /L2/st
```

## Touching spaces default to a wall

You need not write a boundary at all. **Wherever two spaces with regions touch in plan on the same level and no boundary has been declared for that pair, a `wall` boundary is derived.** This is the horizontal counterpart of the vertical "default is a floor".

```muro
koyu 1.1
unit mm
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:A
space /L1/b room X2..X3 Y1..Y2 name:B
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

"1 boundary" appears although no boundary was written, because of that derivation. **And a derived wall has no door, so it cannot be passed.**

```text
Cannot reach /L1/b from /L1/a
```

Declarations exist for the exceptions: to make it `open`, to make it `air:1`, to attach attributes, and to hang openings. One declaration anywhere for that pair — even an edge-restricted one — suppresses the derivation. Derived boundaries never appear in the canonical JSON. Green is not grounds for claiming the building can be walked through.

## Attributes

| Attribute | Tier | Meaning |
|---|---|---|
| `type` | structure | one of the five words above. Default `wall` |
| `t` | structure | wall thickness in mm, split evenly either side of the centerline. Left out, drawing uses 100mm — or 60mm on an `air:1` boundary |
| `air` | structure | `1` = there is something there, but it blocks neither air nor light (a railing, a fence). **Not a statement about passage** — a parapet wall is still not passable. The thickness is capped at 80mm |
| `edge` | structure | restrict the segments to one compass side N/E/S/W as seen from the a side |
| `h` | interpreted | top height in mm of an `air:1` boundary. Default 1100. Anything other than a positive number is ATT01 |
| `name` | interpreted | display name |
| `spec` `fire` `sound` | carried | carried and nothing more. `spec` is the name of the thing, and no tool interprets it |

**Structure attributes are lifted straight into typed fields by parse**, so they no longer sit among the free attributes of the composed model. Interpreted attributes have their values checked. Carried attributes are never read.

A key that is not in the ledger cannot be written — writing it is ATT03 (error). A value you only want carried takes **a namespace containing a dot**.

```text
✖ seg (/L1/a | /out) carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:タイル)
```

`acme.finish:tile` passes. The core never looks at a namespaced key. That boundary is what lets "not looked at" be told apart from "looked at and fine".

`air:1` feeds the derivation of semi-outdoor space. A space with a region that meets the outside across an `open` or `air:1` boundary is derived as **semi-outdoor**, and that reaches at once into the separate line for floor area, the daylight coefficient, where [columns](column.md) stand, and the absence of ceilings and roofs.

## Only two things read the a side

`boundary /L1/a /out` and `boundary /out /L1/a` are two spellings of the same relation. **Area, shape and the position of the segments do not depend on the order.**

```muro
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:隅切りの室
space /out name:外部 outside:1

boundary /out /L1/a t:150 spec:RC
  line X1,Y2-3000 X1+3000,Y2
```

Rewrite this boundary as `boundary /L1/a /out` and the area stays at 31.50 m2. The only thing that changes in the canonical JSON is the value of `a`.

Exactly **two** things read the order.

- **`edge`** — it means "the side as seen from the form of a", so swapping a and b flips the compass point
- **[which way a door opens](door.md#swing--which-side-it-opens-into)** — without `swing:`, a door opens into "a if a has a region, otherwise b"

Get `edge` the wrong way round and the tool says so on the spot.

```muro-bad
koyu 1.1
unit mm
grid X 0 6000
grid Y 0 4000 8000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2 name:南の室
space /L1/b room X1..X2 Y2..Y3 name:北の室
boundary /L1/b /L1/a t:120 edge:N
```

```text
✖ No shared edge on edge:N: /L1/b | /L1/a (they actually touch on S)
```

Write `/L1/a` first and `edge:N` is right; write `/L1/b` first and it is `edge:S`. The compass is N=+Y, S=−Y, E=+X, W=−X.

To throw a vertical boundary from storey to storey in one breath, rather than a line at a time, there is [stack](stack.md).

## Diagnostics

| Code | Severity | What it says |
|---|---|---|
| REF01 | error | references an undefined space path |
| BND01 | error | a boundary between a space and itself |
| BND02 | error | duplicate boundary for the same pair (identical down to the edge restriction). A `wall` / `open` contradiction is caught here too |
| BND03 | error | a `wall` boundary to a space on a different level |
| BND04 | error | the spaces do not touch — not one segment can be derived |
| BND05 | warning | the same pair carries both an edge-restricted and an unrestricted boundary (the segments overlap) |
| BND06 | warning | the segment has zero length — no edge remains on the perimeter |
| VRT01 | error | a vertical boundary not written between spaces that have both a region and a level |
| VRT02 | error | a vertical boundary between non-adjacent levels |
| VRT03 | error | a vertical boundary between spaces that do not overlap in plan |
| VRT04 | warning | the space above a `void` boundary is not `type:void` |
| VRT05 | warning | an opening on a vertical boundary (not interpreted) |
| VRT06 | warning | a `seg` on a vertical boundary (not interpreted) |
| ATT01 / ATT02 / ATT03 | error | an attribute value is not a number / not in the ledger's vocabulary / the key itself is not in the ledger |

Codes do not appear in the human-readable output of `check`. Add `--json` and they do.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [space](space.md) — what a boundary joins
- [door](door.md) / [window](window.md) — the openings that sit on a boundary
- [seg](seg.md) — the uncounted segmentation along a boundary
- [line](line.md) — realising a boundary with a drawn line instead of deriving it from adjacency
- [koyu check](../cli/check.md) — the gate on structural consistency
