# muro — the notation, the working subset

The normative reference is [docs/reference/muro](../../docs/reference/muro/index.md)
in the koyu repository; this file is the subset an agent needs to write a
building, self-contained so the skill works detached from the repository.

muro describes architecture with SPACE as the primary element. A wall is not a
thing you draw: it is the boundary relation between two spaces, and it is
DERIVED. Two spaces that touch with nothing declared between them means "wall",
not "undefined". Form is generated, never authored. Write the spatial
configuration; let koyu produce the geometry.

## The line model

One line, one statement: `keyword positional-args… key:value…`. Tokens are
whitespace-separated. No brackets, no terminators, no line continuation.
`#` starts a comment. Blank lines are ignored. All lengths are millimetres.

Indentation is one level deep and attaches a line to the one above it:
`boundary` takes indented `door` / `window` / `seg` / `line`; `space` takes
`area`; `band` takes `space`.

Declaration order matters for exactly three things: `grid` before anything that
names a grid line, `level` before anything that names a level, and `asset`
before the opening that references it. Boundaries may name spaces declared later.

## The version line

```muro
koyu 1.1
```

Optional. If you write it, it goes in the ENTRY layer only, exactly once — never
in an imported layer. Accepted versions: 0.1 0.2 0.3 0.4 0.5 1.0 1.1. Write `koyu 1.1`.

## grid — the reference lines

```muro
grid X 0 6400 12800 19200
grid Y 0 5600 7600 13200
```

Coordinates only; names are automatic. X coordinates become X1 X2 X3… west to
east, Y coordinates become Y1 Y2… south to north. Indices start at 1; there is
no X0.

- Two or more coordinates per axis. One is an error.
- Strictly ascending. Equal values are an error. Negatives are fine.
- Once per axis across ALL layers. Re-declaring `grid X` anywhere is an error.
- A grid reference is `X2`, or `X2+600` / `Y3-150` — one signed INTEGER offset,
  no spaces, no decimals. `X2 + 600` and `X2+600.5` are both errors.

## level — the storeys

```muro
level L1 0 h:3600 slab:600
level B1 -4200 h:3600 slab:600 underground:1
level L4..L10 11000 pitch:3000 h:2500 slab:450
level R 30200 slab:500
```

`level <name> <z-mm> [h:] [slab:] [pitch:] [underground:]`. `z` is the floor
level, and may be negative. `h` is the default ceiling height for spaces on the
level; without it (and without `h` on the space) a space with a region is a
SUF01 error. `slab` is the floor build-up above; omitting it is a SUF03 warning
and generates no floor. `underground` is declared, never inferred from a
negative z.

A range name (`L4..L10`) requires `pitch:` (the storey height) and forbids it
on single levels. Two levels at the same z is an LVL01 error. A level with no
spaces is legal and idiomatic for a roof.

## space — the primary element

```muro-part
space /L1/entry room X1..X2 Y1..Y2 name:Entrance
space /L1/hall hall X2..X4 Y1..Y2 name:"Entrance hall" daylight:1
space /L1/big ldk X1..X3 Y1..Y2 + X1..X2 Y2..Y3 name:L-shaped
space /out name:Outside outside:1
```

`space <path> <type> [region] [attrs]`.

- The PATH is identity. `/L1/entry` — the first segment binds the space to the
  declared level `L1`. Segments are single tokens: use [a-z0-9-] (Japanese is
  also fine). Never put `..` or `:` or whitespace in a segment.
- The TYPE is OPTIONAL and the vocabulary is OPEN: room, ldk, corridor, hall,
  stair, ev, shaft, wc, office, unit, balcony, garden — any word, or none.
  **koyu reads no type word at all**: it is a label for aggregation and for the
  lettering on a plan. Facts of composition are attributes instead — `outside:1`
  (outside the building; may be split, e.g. /out/road) and `void:1` (an atrium:
  no floor, no area, impassable). Misspell one of those and it is an error
  (ATT03), which is the point of putting them there.
- The REGION is exactly two range tokens, one X and one Y, in either order.
  Offsets are allowed (`X1-1500..X3+1500`). Unions for L-shapes use `+` as a
  standalone token between rectangle pairs. Ranges may be written descending but
  emit them ascending. A region is optional (an `outside:1` space needs none).
- Never nest two spaces with regions — overlapping regions are a GEO02 error.
  To subdivide, make the parent a `zone` (which has no geometry).
- Attributes: `name:` `h:` `use:` `daylight:`(0/1) `ceiling:`(0/1) `level:`
  `uid:` `floor:` `spec:` `stair:`(N/E/S/W) `lift:`(1) and a few more. Any key
  outside the ledger is an ATT03 error unless it is namespaced (`acme.note:x`).

Minimum useful file — four lines, one room, and it checks green:

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

Add one more space and a wall appears between them. You did not draw it.

## band — a strip divided by width

```muro-part
band X X1..X2 Y1..Y2
  space /L1/entry hall w:1500 name:Entrance
  space /L1/wc    wc   w:900  name:WC
  space /L1/wash  wash w:1500 name:Washroom
  space /L1/bath  bath w:rest name:Bathroom
```

`band <X|Y> <Xrange> <Yrange>` plus indented `space` members. The axis letter is
the direction the members run along; the two ranges are the strip. Each member
carries `w:<positive integer mm>` and at most one carries `w:rest`. The widths
must sum exactly to the strip width, or it is a parse error.

- Band ranges must be written ascending — unlike a space region, a reversed range
  is rejected.
- No `key:value` on the band line itself, no `+` unions, no `level:` or
  `area` on members.
- Bands vanish at parse time: they expand into ordinary spaces, and the derived
  cut positions are spelled against the nearest grid line below.
- **One-dimensional.** A member touches its two neighbours in the strip, and
  whatever lies across the strip's long edge. Circulation in the middle of a band
  serves only the two rooms beside it.

Prefer bands to hand-computed regions. `w:1500` and `w:rest` are decisions;
`X2+1600` is arithmetic.

## boundary — the relation, and the only way through

```muro-part
boundary /L1/entry /L1/hall t:120 spec:PW1
  door w:900 h:2000
boundary /L1/hall /L1/corridor type:open
boundary /L1/hall /out t:180 spec:EW1 fire:60
  door w:1800 edge:S name:Entrance
  window w:2400 edge:W sill:800
boundary /L1/stair /L2/stair type:stair
boundary /L1/void /L2/void type:void
```

`boundary /pathA /pathB [attrs]` + indented openings. The wall segment is
derived from where the two spaces touch; you never give it coordinates.

- `type:` is one of wall (the default) / open / stair / shaft / void. `stair`,
  `shaft` and `void` join spaces on ADJACENT LEVELS whose plans overlap.
- **You do not write walls.** Every touching pair with no declared boundary
  becomes a wall automatically. Write a boundary line only to make it `open`, to
  hang a door or window, to set thickness (`t:`) or spec, or to make it a railing
  (`air:1`).
- **A derived wall has no door, so it cannot be walked through.** If a room must
  be reachable, declare the boundary and give it a door.
- Other attributes: `t:`(mm) `air:1`(railing) `edge:`(N/E/S/W, seen from the
  first path) `h:` `spec:` `fire:` `sound:`.
- Errors to avoid: the same pair declared twice (BND02), a boundary between
  spaces that do not touch (BND04), a boundary naming a space that does not
  exist (REF01).

## Openings

`door` and `window`, indented under a boundary. `w:` is required (in mm, or
supplied by an asset). A door without `h:` reaches 2000. Position with
`at:0.4` (a ratio along the segment, default 0.5) or `at:X2+450` (a grid
reference on the segment's own axis). Use `edge:N|E|S|W` when the boundary has
more than one segment — against an `outside:1` space it is effectively required,
and omitting it is an OPN05 error.

```muro-part
asset SD1 door w:800 h:2000 style:sliding name:Sliding
asset W1 window w:2600 h:2200 sill:0

boundary /home/ldk /home/hall t:120
  door SD1 edge:E
```

The first bare token after `door` is an ASSET NAME, not a label — labels go in
`name:`. Declare the asset before it is referenced.

## zone — aggregation without geometry

```muro
zone /home name:Dwelling use:exclusive
zone /site name:Site site:1 area:126.24
```

A zone gathers every space whose path starts with its own. It has no region and
cannot appear in a boundary. Keys: `name:` `use:` `site:`(0/1, one per model)
`area:`(declared site area in m²) `uid:`.

## import — composition, one file per concern

```muro-part
# main.muro — the entry
koyu 1.1
name Corner building
unit mm
grid X 0 6400 12800
grid Y 0 5600 11200
level L1 0 h:3600 slab:600
level L2 3600 h:2900 slab:450

import ./assets.muro
import ./L1.muro
import ./L2.muro
```

`import <relative-path>` with the extension written out. One file is one layer.
Put the version line, the grid and the levels in the entry; put spaces and
boundaries in per-level layers. Rejected as conflicts, with both sources cited:
duplicate space or zone paths, duplicate asset or level names, a re-declared
grid axis, a version line outside the entry.

A layer is not independently checkable — always check the entry.

## What NOT to write

- Walls between touching spaces (derived). Floors, ceilings and roofs (from
  `slab:` and `h:`). Any coordinate for a wall, door or room shape.
- The same definition twice: re-declaring a space, boundary, level or asset is a
  duplicate error, not an update.
- Digits-only values where you meant text: `name:0123` becomes the number 123,
  and quoting does not prevent it. Quote any value containing a space or `#`
  (`name:"Living and dining"`). The building-wide `name` STATEMENT takes the
  whole rest of the line and needs no quotes.
- The same key twice on one line (an error — there is no last-wins).

## The site, when you need one

A site is not a rectangle attribute. It is a `zone` marked `site:1`, the
outside split into named `outside:1` spaces (a road carries `road:<mm>`), and —
optionally — real outdoor spaces under `/site` which need an explicit
`level:` because `/site` is not a level name:

```muro-part
space /out/road name:South-road road:6000 outside:1
space /out/n name:North-neighbour outside:1
zone /site name:Site site:1 area:48.00
space /site/approach yard X1..X3 Y1-1200..Y1 level:L1 name:Approach
boundary /site/approach /out/road edge:S t:120 spec:Fence air:1 h:1200
```

Only then does `koyu site` have coverage and floor-area ratio to report. If the
brief does not turn on the site, leave all of this out — the building alone
checks green.

