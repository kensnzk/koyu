---
title: COL — columns
mode: reference
---

# COL — columns

There are two COL codes, and both are warnings.

| Code | Severity | What it says |
|---|---|---|
| COL01 | warning | Not one column stands for this declaration — the intersections have no floor |
| COL02 | warning | Not one column stands for this declaration — an earlier one took the same intersections |

**A column's position is never written.** You write a size, storeys and grid lines; where it stands is derived. It is the same stance that makes walls emerge from boundaries, applied to a point element.

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1..L3 0 pitch:3000 h:2700 slab:300
level R 9000 slab:300
space /L1/a room X1..X3 Y1..Y2
space /L2/a room X1..X3 Y1..Y2
space /L3/a room X1..X3 Y1..Y2
column 800 L1..L2 d:600 name:C1
column 600 L3 x:X1,X2 name:C2
```

The form is `column <side, mm> <level name or L?..L?> [x:grid,…] [y:grid,…]`. `d:` gives the depth (square if omitted); `name:` and `spec:` may be written too. Leave out `x:` / `y:` and every grid line on that axis is in play.

## Where a column stands

At **a grid intersection that has a floor on that storey**. "Has a floor" means the intersection falls inside the derived region of a space on that level, within a 1mm tolerance. Three things do not count as floor.

- `outside:1` — it is the ground
- `void:1` — having no floor is what a void is
- **A semi-outdoor space with nothing above it** — a roof garden or a top-storey terrace. There is nothing for a column to hold up

The third is easy to forget. **No column stands under a balcony** — unless a floor overlaps it from above, in which case there is something to hold up and it does stand.

**Two columns never share an intersection.** Where several declarations aim at the same intersection on the same level, **the earlier declaration wins**. There is no implicit rule such as "take the larger one".

**The population is the declaration.** COL01 and COL02 both ask not "how many stood on this level" but "how many stood **for this declaration**". Counting the former would let a declaration producing nothing pass in silence the moment any other declaration on that storey stood a single column.

## COL01 — the declaration produces no columns {#col01}

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
column 600 L2
```

```text
Not one column stands for this declaration (the grid intersections have no floor): L2 600mm square
```

**Cause** — the intersections aimed at have no floor on that storey. Usually one of these.

- **The wrong storey.** The example: the floor is on `L1` and the declaration points at `L2`.
- **A mistyped grid restriction (`x:` / `y:`).** There is no floor where you restricted it to.
- **That storey is not written yet.** This shows up when the frame is written first.
- **The floor is semi-outdoor with nothing above.** Trying to put columns on a roof terrace.

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level R 3000 slab:300
space /L1/t terrace X1..X2 Y1..Y2
space /out outside:1
boundary /L1/t /out type:open
column 600 L1
```

This file produces COL01 with the same body. The terrace meets the exterior across `type:open`, which makes it semi-outdoor, and nothing overlaps it from above.

**Fix** — correct the storey, or drop the restriction. If all you wanted was thinner columns higher up, check that the storey range matches floors that actually exist.

## COL02 — overlapping column declarations {#col02}

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
column 600 L1
column 800 L1
```

```text
This column declaration (L1 800mm square) stands nowhere because an earlier declaration took the same intersections (at the same intersection the earlier declaration wins)
```

**Cause** — two declarations aim at the same intersections on the same level, and the earlier one took them all. The `800` written later stands nowhere.

**It is kept separate from COL01 because the fix is somewhere else.** COL01 means "no floor" — fix the floor or the storey. COL02 means "there is a floor, but it is taken" — fix the declaration. Emitting COL01's body here would tell you there is no floor at a place where there demonstrably is one, and leave you nothing to correct.

`related` carries the line of the earlier declaration that **actually stood** at those intersections.

**Fix** — restrict the grid lines with `x:` / `y:` so they do not overlap, or consolidate into one declaration.

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
column 600 L1 x:X1
column 800 L1 x:X2,X3
```

## When nothing stands and COL says nothing

**On a level whose storey height is undetermined, columns never reach the derivation at all.** A column rises from the floor to the full storey height, so with no storey height there is no solid to make. With a level above, the storey height is the difference in `z`; for the top storey it is fixed by "the tallest of the level's own `h:` and the effective ceiling heights of the spaces on it, plus 200mm". If not one ceiling height is determined, that number does not exist.

What speaks in that state is not COL01 but [SUF01](./suf.md) — the column declaration is catching its intersections correctly, so COL has nothing to say. If a building comes out with neither columns nor walls, suspect SUF01 first.

## Related

- [SUF — sufficiency](./suf.md) — the state where no storey height means no columns and no walls (SUF01)
- [UID — identity](./uid.md) — a column's `name` is unique across the whole model (UID04)
- [VER — the language version](./ver.md) — `column` is 0.5 vocabulary (VER03)
- [koyu validate](../cli/validate.md) — `koyu.schematic.column.blocksdoor`, a derived column landing on a derived door
- [koyu check](../cli/check.md)
