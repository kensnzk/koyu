---
title: grid — grid lines
mode: reference
---

# grid — grid lines

```muro-part
grid X 0 6400 12800 19200
grid Y 0 5600 7600 13200
```

`grid <axis> <coordinate mm> <coordinate mm> ...` lists the coordinates of the grid lines on one axis. **Nothing in this notation is written as a bare coordinate** — position is always written in the language of the grid, so without a grid there is no way to write a region, a drawn line, or the position of an opening.

There are two axes, `X` and `Y`. X is positive to the east and Y is positive to the north; the vertical direction (z) is not an axis but belongs to [level](level.md).

## Grid lines are named for you

You write only coordinates; you do not name them. The coordinates of `grid X` become `X1` `X2` `X3` … from west to east, and those of `grid Y` become `Y1` `Y2` `Y3` … from south to north.

```muro-part
grid X 0 6400 12800 19200
#      X1 X2   X3    X4
```

A grid name is therefore **an axis and an ordinal**, not the gridline mark of a drawing (grid A, grid 1). If you want to carry the mark, write it as an attribute on a space or a boundary.

A name beginning with `X` is read on the X axis and one beginning with `Y` on the Y axis, so a reference never has to say which axis it means. Ordinals start at 1; there is no `X0`.

## Declare it before you use it

**A `grid` line has no effect on lines above it.** A grid reference is resolved into a coordinate as its own line is read, so a `grid` placed further down arrives too late.

```muro-bad
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
grid X 0 3600
grid Y 0 4000
```

```text
✖ gridlate.muro:line 2: Undefined grid line name: X1
```

This contrasts with [boundary](boundary.md), which may forward-reference its spaces. A boundary joins two names; a grid reference points at a coordinate.

## Once per axis

`grid X` and `grid Y` may each be declared once. When composing, that is once across all layers, and a second line is an error even with identical coordinates — the grid is one coordinate system for the whole building, not something later layers extend or replace.

```text
✖ n5.muro:line 2: grid X is declared once (in the base layer when composing)
```

## Rules for the coordinates

| Rule | Error |
|---|---|
| The axis is `X` or `Y` | `A grid axis is X or Y: Z` |
| Two or more coordinates | `grid takes two or more coordinates` |
| Written in ascending order | `grid coordinates are written in ascending order` (equal values are rejected too) |

Coordinates are numbers in mm and may be negative. Where the origin sits is your choice; the vertices of a [polygon](polygon.md) and the positions of [columns](column.md) are read in this same coordinate system.

## Grid references — how position is spelled

A declared grid name is itself the word for a position.

| Spelling | Meaning |
|---|---|
| `X2` | the coordinate of grid line X2 |
| `X2+600` | 600mm east of X2 |
| `Y3-150` | 150mm south of Y3 |
| `X1..X2+3200` | a range (both ends are grid references) |

An offset is **an integer only**. `X2+600.5` is not readable as a grid name and is an error.

```text
✖ g1.muro:line 4: Undefined grid line name: X2+600.5
```

Referring to a grid line that was never declared is an error too (`Undefined grid line name: Y3`). Ranges, regions, the endpoints of a drawn line, and the absolute position of an opening are all collected in [positions and regions](positions.md).

## A grid line is not a drawn line

`grid` places coordinates; they have neither length nor endpoints. A grid line divides nothing by itself — what divides is a [space](space.md)'s region and a [boundary](boundary.md).

There is exactly one place where the grid produces form: a [column](column.md) stands at its intersections. A column's `x:` / `y:` restriction is written with grid names (`x:X2,X3`).

## Canonical JSON

The grid is an array of coordinates per axis. Names follow from the ordinals, so they are not stored.

```text
$ npx tsx src/cli.ts json lv.muro
  "grid": {
    "X": [
      0,
      6000
    ],
    "Y": [
      0,
      8000
    ]
  },
```

## The smallest file

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

```text
$ npx tsx src/cli.ts check min.muro
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```
