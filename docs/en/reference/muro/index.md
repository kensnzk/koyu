---
title: Every construct in .muro
mode: reference
---

# Every construct in .muro

**One line, one statement.** These are all the lines `.muro` has — no brackets, no terminators, no nesting. Each line's own page holds the detail.

```text
keyword positional… key:value…
```

## Lines with no indentation

A line that starts flush is a declaration in its own right.

| Line | What it declares |
|---|---|
| [`koyu 1.0`](version.md) | the language version this file is read under. Base layer only, once |
| [`name 街角の複合ビル`](name.md) | the name of the building. The rest of the line is the value. Once |
| [`unit mm`](name.md) | the unit of length. v0 is mm only |
| [`grid X 0 6400 12800`](grid.md) | grid line coordinates. Once per axis; named `X1`, `X2`, … automatically |
| [`level L1 0 h:3600 slab:600`](level.md) | a level — name, z, ceiling height, slab thickness. A range such as `L4..L10` requires `pitch:` |
| [`space /L5/A/ldk ldk X1..X2 Y1..Y2`](space.md) | **a space** — path, type, region. The primary element |
| [`band X X1..X3 Y1..Y2`](band.md) | a band — divides by dimension and order rather than by position. Members are indented `space` lines |
| [`boundary /L5/A/hall /L5/corridor`](boundary.md) | **a boundary** — the relation joining two spaces. A wall is a relation, not a thing |
| [`stack ev L1..L11 type:shaft`](stack.md) | a vertical stack, declared at once. Puts a vertical boundary on each consecutive pair of levels |
| [`zone /L3..L10/A use:exclusive`](zone.md) | a counted aggregation. No geometry; gathers the spaces under a path prefix |
| [`asset SD1 door w:800 h:2000`](asset.md) | a door asset — the bundle of defaults an opening refers to |
| [`polygon /site -2600,-7000 …`](polygon.md) | the site shape. **The only line that writes a shape from free vertices off the grid** |
| [`column 800 B2..L1`](column.md) | a column. **No position is written** — it stands where a grid intersection has floor |
| [`import ./assets.muro`](import.md) | layers another file on. **The order is the declaration of strength**; later layers are stronger |
| [`over /L5/A/ldk h:2600`](over-drop.md) | an override. An error if the target does not exist |
| [`drop /L5/A/store`](over-drop.md) | a removal — of a space, a boundary, or a column declaration |

## Indented lines

A line beginning with whitespace is subordinate to the non-indented line above it. **One level only; no nesting.**

| Line | Parent | What it declares |
|---|---|---|
| [`door w:900 at:X4`](door.md) | `boundary` / `stack` | an opening that is passed through |
| [`window w:1800 h:1200 edge:S`](window.md) | `boundary` / `stack` | an opening that admits light. Not passed through |
| [`seg w:1800 at:X5 spec:ガラス`](seg.md) | `boundary` / `stack` | an uncounted segmentation of a boundary |
| [`line X3,Y1 X3+600,Y2-900`](line.md) | `boundary` | a drawn line — the boundary realised as an act of design. One per boundary |
| [`area X1..X2 Y1..Y2 floor:タイル`](area.md) | `space` | an uncounted segmentation inside a room. Affects no area, no room count, no graph |
| [`space /L1/wet wet w:4800`](band.md) | `band` | a band member. Carries a width `w:` instead of a region |
| [`+ window w:600 name:W1`](over-drop.md) | `over` | adds to a set. `name:` is required |
| [`- door D2`](over-drop.md) | `over` | removes from a set, by name |
| [`= door D1 w:1000`](over-drop.md) | `over` | replaces in a set — only the attributes written are swapped |

## Rules that cut across every line

Six rules apply to every line alike.

| Page | What it covers |
|---|---|
| [How a line is read](lines.md) | tokens, comments, quotes, indentation, `key:value`, value types |
| [Positions and regions](positions.md) | grid references `X1`, offsets `X2+600`, ranges `X1..X3`, unions of rectangles |
| [Orientation and the a side](orientation.md) | `N`=+Y, `S`=−Y, `E`=+X, `W`=−X, and which face `edge:` picks |
| [The three tiers of attribute](attributes.md) | structure, interpreted and carried, the namespace rule, and the ledger per element |
| [What happens when you write nothing](defaults.md) | the one table of defaults |
| [koyu — the version line](version.md) | which versions are accepted, and when an older one is |

## Order of declaration

**Most lines may refer forward, but three must be declared before use.**

| Must come first | Otherwise |
|---|---|
| `grid` | `Undefined grid line name: X1` |
| `level` (when a path or a span names it) | the level is undetermined — `SUF02`; for a span, `The range includes an undeclared level` |
| `asset` (when an opening refers to it) | `Undefined opening asset: SD1` |

By contrast, **a boundary may refer to its spaces before they are written.** `boundary /L1/a /L1/b` above the space declarations passes — whether the referents exist is settled after composition, by `REF01`.

`over` and `drop` are the exception: **the target must already exist when the line is reached.** An override is not a definition, so an opinion cannot be added to something that is not there.

## Declared once

`koyu`, `name`, `grid X` and `grid Y` are written **in the base layer, once**. Writing the same value twice is still an error — it forbids a silent override decided by composition order — except that `name` accepts a re-declaration of the identical string.

Duplicate space paths, zone paths, asset names, site shapes and level names are errors too, and both provenances are reported.

## Defining and overriding are different statements

| | Statement | When the target exists | When it does not |
|---|---|---|---|
| **Definition** | `space` `boundary` `zone` `asset` `level` `polygon` | **error** (duplicate) | defines it |
| **Override** | `over` | overrides it | **error** |

The kind is legible from the way the line is written, so neither a reader nor a machine has to guess. How layers stack, and whose opinion wins, is in [composition](composition.md).
