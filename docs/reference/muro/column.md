---
title: column — the element whose position is not written
mode: reference
---

# column — the element whose position is not written

```text
column <size mm> <level range|level name> [d:depth] [x:grid,…] [y:grid,…] [attributes…]
```

**A column's position is written nowhere.** What is written is which storeys, at what size, on which grid lines. A column stands **at the grid intersections that have a floor on that level** — the same shape of rule that puts a wall where two spaces touch.

```muro-part
column 800 L1..L6
column 900 B2..L6 x:X2,X3 y:Y2 d:1200 spec:SRC
```

The first positional argument is the side in mm (a positive number), the second a level range or a level name. Write three lines splitting the storeys and you get a column that thins as it rises.

## What counts as a floor

The population of "floors" a column stands on is every space on that level satisfying all of the following.

- it has a region
- it is not `outside:1`
- it is not `void:1`
- it is **not** the case that it is semi-outdoor **and** no floor on any level lies above it

That last clause is the rule that **a floor holding up nothing but sky gets no column**. An open terrace or a roof garden takes no columns — there is nothing for a column to hold up. Under a balcony with a storey cantilevered over it, columns do stand.

Whether a space is semi-outdoor is derived, not declared (a space with a region meeting the outside across an `open` or `air:1` boundary). Whether it is covered from above is derived too (does any space on any level above overlap it in plan).

```muro
koyu 1.1
unit mm
grid X 0 6000 12000
grid Y 0 6000
level L1 0 h:3000 slab:200
level L2 3200 h:3000 slab:200

space /L1/room room X1..X2 Y1..Y2 name:室
space /L1/terrace terrace X2..X3 Y1..Y2 name:テラス
space /L2/room room X1..X2 Y1..Y2 name:上階の室
space /out name:外部 outside:1

boundary /L1/terrace /out type:open

column 800 L1
```

The terrace meets the outside across an `open` boundary, so it is semi-outdoor, and no L2 space overlaps it. So no column stands on grid line X3.

```ts
import { parseFile } from "@kensnzk/koyu/node";
import { columnsFor } from "@kensnzk/koyu";

const model = parseFile("col.muro");
for (const c of columnsFor(model, "L1")) console.log(c.grid, c.w, c.d);
```

```text
X1/Y1 800 800
X1/Y2 800 800
X2/Y1 800 800
X2/Y2 800 800
```

Widen `/L2/room` to `X1..X3` so it covers the terrace and the same declaration yields six.

```text
X1/Y1 800 800
X1/Y2 800 800
X2/Y1 800 800
X2/Y2 800 800
X3/Y1 800 800
X3/Y2 800 800
```

The floor test reads the **derived form** too. Where an intersection falls on the side cut away by a [drawn line](line.md), no column stands there. An intersection lying on an edge of the form counts as inside.

## Attributes

| Attribute | Tier | Meaning |
|---|---|---|
| `d` | structure | a positive number, mm — the depth of a rectangular section. Defaults to the side (a square column) |
| `x` / `y` | structure | restrict which grid lines to stand on, comma separated. Unwritten means all of them |
| `name` | interpreted | display name, and what `drop column` points at |
| `spec` | carried | the name of the thing — carried and nothing more |

A key outside the ledger needs a namespace containing a dot or it is ATT03. An undeclared grid name in `x:` / `y:` stops parse there and then.

A list of grid names has no order — `x:X2,X1` and `x:X1,X2` are the same composition, and the canonical JSON sorts them into grid order.

## Declaration order is meaning

**Two columns never stand at one intersection; the earlier declaration wins.** So reordering the column declarations gives a different building. The canonical JSON does not reorder them — reordering would let two different buildings produce byte-identical canonical JSON.

A declaration that stands nowhere is reported with its reason split in two. Either **the intersections it aims at have no floor**, or there is a floor but **an earlier declaration took it** — and the two want opposite fixes.

```text
⚠ Not one column stands for this declaration (the grid intersections have no floor): L1 800mm square
⚠ This column declaration (L1 700mm square) stands nowhere because an earlier declaration took the same intersections (at the same intersection the earlier declaration wins)
```

`drop column <name>` removes a declaration. **It refuses when the name is not unique** — it will not delete one of two and leave you guessing which.

```text
✖ The column name C1 is not unique
```

## A column is neither a space nor a boundary

So a column appears **neither in area nor in the graph `koyu doors` walks**. Floor area is the sum of the centerline areas of spaces, and column sections are not deducted. Circulation is a web of spaces and boundaries, and a column is neither a node nor an edge in it.

A column shows up only on the side of form — the section in plan, the prism in three dimensions, and the validation rule `koyu.schematic.column.blocksdoor` (violation), which speaks when a derived column overlaps a derived door.

A column's z range runs from the FL of its level to FL plus the storey height. Storey height is the difference to the level above, or, where there is none, the greatest ceiling height on that storey plus the roof slab thickness. **If no ceiling height can be determined, neither can the storey height, and that level gets neither columns nor walls** — SUF01 says so as an error.

## Diagnostics

| Code | Severity | What it says |
|---|---|---|
| COL01 | warning | not one column stands for this declaration — the intersections have no floor |
| COL02 | warning | not one column stands for this declaration — an earlier one took the same intersections |
| ATT03 | error | an attribute key outside the ledger |

The population is **the declaration**. The question is not "how many stood on this level" but "how many stood from this declaration" — count the former and a declaration that stands nowhere passes in silence the moment some other declaration on the same storey stands even once.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [space](space.md) — what gives a column its floor
- [grid](grid.md) — what gives it its intersections
- [boundary](boundary.md) — `open` and `air:1`, which derive semi-outdoor space
- [line](line.md) — what cuts the shape of the floor
- [koyu validate](../cli/validate.md) — says whether a column blocks a door
