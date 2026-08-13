---
name: koyu-author
description: Write muro, the text notation where space is the primary element and walls, floors and openings are derived rather than drawn. Use this skill whenever a building has to be written down as `.muro` — "間取りを考えて", "design a floor plan", "lay out a 1LDK", "この敷地に平屋を", "add a room to this plan", "make the corridor wider" — and whenever .muro files, koyu or ugatsu are mentioned. Use it even when the request names no notation: producing muro and letting koyu check it is how a plan gets written here. Do NOT use it for website or UI layout, garden and landscape plans, PCB or mechanical layout, seating charts, or arranging furniture inside a room that already exists.
---

# Writing muro

muro describes a building by its **spaces** and the **relations between them**.
A wall is not drawn: it is the boundary between two spaces, derived from where
they touch. Floors and ceilings come from `slab:` and `h:`. Openings are cut
into boundaries. You write the spatial configuration; the geometry is generated.

**What this skill covers is the notation.** Which rooms a building should have,
how big they should be and what opens onto what are architectural decisions, and
they stay yours — koyu neither supplies them nor checks them, and the answers
depend on where you are building in a way the notation never does. What follows
is how to write a decision down so that koyu accepts it and derives the form you
meant.

| What you were asked for | Where to go |
|---|---|
| A single-storey building, or a change to one | This file is enough. Start below. |
| Two or more storeys | This file — see *More than one storey*. |
| Sites, zones, courtyards, L-shaped rooms, level ranges, assets | [REFERENCE.md](REFERENCE.md), the section by that name |
| A check error naming syntax you do not recognise | [REFERENCE.md](REFERENCE.md) |

Two facts about the notation decide whether what you write means what you meant:

- **Two touching spaces with nothing declared between them are already a wall.**
  Never write walls → declare a `boundary` only to open it, to put a door or
  window in it, or to give it thickness.
- **A derived wall has no door, so nobody can pass it.** Which rooms open onto
  which is your decision; the notation only records it. Declare the boundary and
  put a door on it, or the room is sealed — and `check` will not say a word.

## A whole small building

```muro
muro 1.3
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

A room marked `daylight:1` is a habitable room, so `validate` will ask it for a
window — which is why the bedroom has one. Everything else above generalises:

- **`band` is the move.** `band <X|Y> <Xrange> <Yrange>` divides a strip into
  spaces by width — members carry `w:<mm>`, one may carry `w:rest`, and the
  widths fill the strip exactly. "Corridor 1500, the rest is the dwelling" is a
  decision; coordinates are arithmetic. A band is **one-dimensional**: a member
  touches its two strip-neighbours plus whatever lies across the long edge — so
  a space mid-band adjoins only the two beside it. Anything that has to reach
  further runs in its own band the other way, or spans the width.
- Grid lines are auto-named X1, X2… west→east and Y1, Y2… south→north. Offsets
  like `Y2+1800` are legal wherever a grid reference is.
- The path `/L1/name` binds the space to that level. **The type word is the
  room's purpose** — `room`, `ldk`, `hall`, `wc`, `parking`… — free vocabulary
  and **optional**. `check` reads none of it, though some `validate` rules do: a
  car park is the spaces typed `parking` or `ramp`. `name:` is the individual
  label, not the purpose. Facts of composition are declared instead: `outside:1`
  (outside the building; may have no region) and `void:1` (no floor, no area,
  impassable).
- **Every other division of the building is a namespaced key you choose** —
  `lease.category:common`, `fire.compartment:A`, `dept.name:sales` — on a space,
  or on a `zone` so that everything beneath it inherits the value. A space may
  carry as many as it likes and none of them is privileged, so write one only
  when the brief turns on that division. `koyu stats --by lease.category` totals
  the areas by it.
- Openings sit indented under a boundary and need `w:`. Against `/out` the
  boundary always has several segments, so give `edge:N|E|S|W`. Two openings on
  one boundary both default to the centre — separate them with `at:0.3` (a
  ratio) or `at:X2+450` (a grid reference).
- Quote names containing spaces: `name:"Waiting room"`.

Dimensions are yours to decide. These are only the values that make an example
read as a building rather than as a diagram: `t:100` between rooms, `t:120`–`180`
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

Green means one form derives from the description — that the description is
*consistent*, not that the building is any good. `check` reads no type word, no
dimension and no route: a sealed building with rooms 900mm across is green. What
`validate` judges, and what it does not, is [koyu-validate](../koyu-validate/SKILL.md).

Check, fix everything listed in one edit, check again, and stop. If the second
pass is green, hand over. If a third pass still fails, the notation is not the
problem — say which decision the file cannot express.

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
138.24 m²). They are here to show what the notation does, not what to build.
