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

For a building with one orthogonal grid, use `grid X` and `grid Y` as shown above. The directions +X and +Y are east and north in the model. If the whole building sits at an angle to true north, keep this grid and record the true bearing of +Y with [`azimuth Y`](azimuth.md). The vertical coordinate z belongs to [level](level.md).

## Grid lines are named for you

You write only coordinates; you do not name them. The coordinates of `grid X` become `X1` `X2` `X3` … from west to east, and those of `grid Y` become `Y1` `Y2` `Y3` … from south to north.

```muro-part
grid X 0 6400 12800 19200
#      X1 X2   X3    X4
```

A grid name is therefore **an axis and an ordinal**, not the gridline mark of a drawing (grid A, grid 1). If you want to carry the mark, write it as an attribute on a space or a boundary.

A primary grid name identifies its family and ordinal. Ordinals start at 1; there is no `X0`.

## Rotated orthogonal frames

When a second building or wing has its own orthogonal grid at an angle to the first, keep the first on X/Y and add a `frame` for the second. Each grid retains its right angles. The frame angle records the rotation between the grids. Give the two family letters, the origin of the local coordinates, the angle and both lists of stations in millimetres.

```muro
muro 1.8
grid X 1000 7000
grid Y 2000 6000
frame AB at:X2,Y2 angle:30 A:0,3000,7000 B:-2000,0,4000
level L1 0 h:2800 slab:200
space /L1/wing room A1..A2 B2..B3
```

The origin is the (0,0) station of the frame. It can be any previously defined grid intersection. The angle is measured counterclockwise in degrees from world +X to the direction of increasing A. Increasing B points 90° counterclockwise from increasing A. Both families use distinct uppercase letters other than X and Y. Each station list has at least two finite values in ascending order. The first station may be negative.

Here `A1,B2` coincides with `X2,Y2`. In `A1+500,B2-200`, the offsets act along the local A and B dimension directions. `X1,B2` locates a unique intersection between the two different grids. The same named line can locate boundaries, openings, structural members and section cuts. The primary X and Y grid keeps its own origin and orientation.

## Inclining the Y grid family

Use `slope:` on `grid Y` only when the plan or its dimensions establish that the X and Y lines within the same grid intersect at an oblique angle. It gives every Y line the same inclination. The signed ratio is the change in world Y divided by the change in world X. A positive or negative decimal or fraction is accepted. The denominator must be positive. The default slope is zero.

```muro-part
grid X 1000 7000
grid Y 2000 6000 slope:1/5
```

The listed Y dimensions are northings measured on X1. At any other station, `worldY = Y dimension + slope × (worldX − X1)`. Here `X1,Y2` is (1000,6000) mm and `X2,Y2` is (7000,7200) mm. `Y2+300` increases the northing by 300 mm at every station. X lines stay at their specified eastings. A room spanning X and Y ranges follows their four intersections.

## Named lines and their intersections

From muro 1.8, `axis <name> <first point> <second point>` adds a straight, infinite reference line. Give each point as a primary X,Y grid pair, with optional integer offsets. The line can cross any number of storeys. Its name stays the same when a defining point moves.

```muro
muro 1.8
grid X 0 6000 12000
grid Y 0 4000 8000
axis D1 X1,Y1 X3,Y1+2400
axis D2 X1,Y2 X3,Y2+2400
level L1 0 h:2600 slab:200
space /L1/bay room cell:X1,D1;X2,D1;X2,D2;X1,D2
```

`X2,D1` is (6000,1200) mm here. `X2+300,D1` moves the X reference by 300 mm and intersects it with the same line. Two nonparallel named axes can also locate a point. Coincident and parallel references cannot locate a point. Offsets on a separately declared `axis` are unsupported. A line in a `frame` takes its offset along its family's local dimension direction. To locate a room from these intersections see [space](space.md#grid-intersection-cells). To cut a section along a named axis see [section](../cli/section.md).

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
