---
name: koyu-design
description: Design buildings by writing muro, the text notation where space is the primary element and walls, floors and openings are derived rather than drawn. Use this skill whenever the user asks for a building, a floor plan, a spatial programme or a change to one — "間取りを考えて", "design a floor plan", "lay out a 1LDK", "この敷地に平屋を", "add a room to this plan", "make the corridor wider" — and whenever .muro files, koyu or ugatsu are mentioned. Use it even when the request names no notation: producing muro and letting koyu check it is how a plan gets made here. Do NOT use it for website or UI layout, garden and landscape plans, PCB or mechanical layout, seating charts, or arranging furniture inside a room that already exists.
---

# Designing in muro

muro describes a building by its **spaces** and the **relations between them**.
A wall is not drawn: it is the boundary between two spaces, derived from where
they touch. Floors and ceilings come from `slab:` and `h:`. Openings are cut
into boundaries. You write the spatial configuration; the geometry is generated.

Speed is the point. The architect judges a plan at a glance and asks for the
next version, so the first one should reach them in a couple of minutes.

| What you were asked for | Where to go |
|---|---|
| A single-storey building, or a change to one | This file is enough. Start below. |
| Two or more storeys | This file — see *More than one storey*. |
| Sites, zones, courtyards, L-shaped rooms, level ranges, assets | [REFERENCE.md](REFERENCE.md), the section by that name |
| A check error naming syntax you do not recognise | [REFERENCE.md](REFERENCE.md) |

Two rules decide whether a plan works:

- **Two touching spaces with nothing declared between them = a wall.** Never
  write walls → declare a `boundary` only to open it, to put a door or window
  in it, or to give it thickness.
- **A derived wall has no door, so nobody can pass it.** Decide circulation
  first — entrance → living space or corridor → everything else — then hang the
  rooms off it, and walk the route in your head before writing it down.

## A whole small building

```muro
koyu 1.1
name Flat on a tight site
unit mm

grid X 0 7000
grid Y 0 1800 5100

level L1 0 h:2400 slab:150

band X X1..X2 Y1..Y2
  space /L1/entry hall w:1500 name:Entrance
  space /L1/wc    wc   w:900  name:WC
  space /L1/wash  wash w:1500 name:Washroom
  space /L1/bath  bath w:rest name:Bathroom

band X X1..X2 Y2..Y3
  space /L1/ldk ldk  w:rest name:LDK daylight:1
  space /L1/bed room w:2800 name:Bedroom daylight:1

space /out name:Outside outside:1

boundary /L1/entry /out t:120
  door w:900 edge:S name:Front
boundary /L1/entry /L1/ldk type:open
boundary /L1/ldk /L1/wc t:100
  door w:700
boundary /L1/ldk /L1/wash t:100
  door w:750
boundary /L1/wash /L1/bath t:100
  door w:750
boundary /L1/ldk /L1/bed t:100
  door w:900
boundary /L1/ldk /out t:120
  window w:2400 edge:N sill:400 h:2000
boundary /L1/bed /out t:120
  window w:1600 edge:N sill:800 h:1400
```

A room marked `daylight:1` is a habitable room, so give it a window — which is
why the bedroom has one. Everything else above generalises:

- **`band` is the move.** `band <X|Y> <Xrange> <Yrange>` divides a strip into
  spaces by width — members carry `w:<mm>`, one may carry `w:rest`, and the
  widths fill the strip exactly. "Corridor 1500, the rest is the dwelling" is a
  decision; coordinates are arithmetic. A band is **one-dimensional**: a member
  touches its two strip-neighbours plus whatever lies across the long edge — so
  a hall mid-band serves only the two rooms beside it. Run circulation in its
  own band the other way, or let it span the width.
- Grid lines are auto-named X1, X2… west→east and Y1, Y2… south→north. Offsets
  like `Y2+1800` are legal wherever a grid reference is.
- The path `/L1/name` binds the space to that level. The type word (`room`,
  `ldk`, `hall`, `wc`…) is free vocabulary and **optional** — koyu never reads
  it. Facts of composition are declared: `outside:1` (outside the building; may
  have no region) and `void:1` (no floor, no area, impassable).
- Openings sit indented under a boundary and need `w:`. Against `/out` the
  boundary always has several segments, so give `edge:N|E|S|W`. Two openings on
  one boundary both default to the centre — separate them with `at:0.3` (a
  ratio) or `at:X2+450` (a grid reference).
- Quote names containing spaces: `name:"Waiting room"`.

Values worth reusing rather than re-deriving: `t:100` between rooms, `t:120`–`180`
to the outside; doors `w:700` wc, `w:750` bath and washroom, `w:900` rooms and
the front door; `h:2400` dwelling, `h:2700` office; `slab:150`.

## More than one storey

One layer per level, composed by the entry file. The roof is a level with no
`h:`, and the storeys are joined by a boundary between the stair spaces.

```muro-part
# main.muro — the entry holds the grid, the levels, and the imports
level L1 0 h:2700 slab:150
level L2 3000 h:2700 slab:150
level R  6000 slab:200
import ./L1.muro
import ./L2.muro
```
```muro-part
# L2.muro — its last line joins the cores; /out is declared once, in L1.muro
boundary /L1/stair /L2/stair type:stair
```

The stair spaces must overlap in plan. Write all the layers before checking —
composition is resolved at parse time, so there is nothing to gain from checking
them one at a time.

## Check, then hand over

```sh
# In the koyu repository:
node dist/cli.js check main.muro
# Anywhere else (npx cannot resolve the bin from inside the package's own tree):
npx -p @kensnzk/koyu koyu check main.muro
```

It runs in well under a second. If the `koyu` MCP server is connected instead of
a shell, its `check` tool is the same judge.

Green means one form derives from the description — that the building is
*consistent*, not that it is good. Whether it is good is the architect's call,
made by looking at the plan, which is why getting it in front of them beats
polishing it.

Check, fix everything listed in one edit, check again, and stop. If the second
pass is green, hand over rather than re-reading the file for improvements. If a
third pass still fails, the plan is wrong rather than the syntax — say so.

The deliverable is **the `.muro` files themselves**; they open at
[ugatsu.dev](https://ugatsu.dev) by drag and drop (plan, 3D, areas, space
graph). Do not run `stats`, `light`, `doors` or `site` unless the question is
actually about areas, daylight, circulation or the site.

## When it complains

| What it prints | What happened | Fix |
|---|---|---|
| `BND04 … do not touch` | a boundary between spaces with no shared edge — usually a band member reaching past its neighbour | check the widths sum to the strip; only one member may carry `w:rest` |
| `OPN05 … edge` | the boundary has several segments, so the opening has nowhere definite to go | add `edge:N\|E\|S\|W`, seen from the first path |
| `OPN04 … no boundary segment` | two openings landed on the same default centre | position them with `at:0.3` or `at:X2+450` |
| `GEO02` | two spaces overlap on one level | bands do not overlap by construction; a hand-written region does |
| `SUF01` / `SUF02` | no ceiling height or level for a space that has a region | give the level an `h:`, or the space one |
| `REF01` | a boundary names a space that does not exist | a typo in a path, or the layer declaring it was never imported |

Worked examples that check green:
[examples/flat-1ldk.muro](examples/flat-1ldk.muro) (two bands, 33.62 m²) and
[examples/office/](examples/office/main.muro) (three layers, stair-joined,
138.24 m²).
