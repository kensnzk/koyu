---
title: Positions and regions
mode: reference
---

# Positions and regions

**Coordinates are never written directly.** A position is always spelled in the language of grid lines — `X2`, `X2+600`, `Y3-150`. The only place raw millimetres are allowed is the site shape (`polygon`), because a site outline is survey data, not a design product.

This page covers grid references, offsets, ranges, regions and points. Compass words (`N` `E` `S` `W`) are in [orientation and the a side](orientation.md); how a line is tokenised is in [how a line is read](lines.md).

```muro
koyu 1.0
name 位置の例
unit mm

grid X 0 6400 12800
grid Y 0 5600 11200

level L1 0 h:2700 slab:200

space /L1/ldk  ldk  X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2800 name:LDK
space /L1/hall hall X2..X3 Y1+2800..Y2 name:廊下
space /L1/room room X1..X3 Y2..Y3 name:寝室
space /out     exterior name:外部
```

## Grid lines

**`grid` gives the coordinate system.** Once per axis, two or more millimetre coordinates in ascending order. The names are assigned automatically — `X1`, `X2`, … and `Y1`, `Y2`, … — never by the author.

```muro-part
grid X 0 6400 12800 19200
grid Y 0 5600 7600 13200
```

- Out of order is an error (`grid coordinates are written in ascending order`)
- Fewer than two is an error
- Declaring an axis twice is an error — when layers are composed, any layer may declare it, but only once across all of them
- **It must come before any line that uses it.** A grid name referenced above its `grid` line gives `Undefined grid line name`

X is positive east, Y is positive north, z is positive up. Lengths are millimetres, a ratio along a segment is `0..1`, and areas are reported in m² measured to wall centrelines.

## Grid references and offsets

| Spelling | Meaning |
|---|---|
| `X2` | the coordinate of grid line `X2` |
| `X2+600` | 600 mm east of `X2` |
| `Y3-150` | 150 mm south of `Y3` |

The spelling is strict: **axis letter, grid number, and an optional signed integer.** Nothing else passes.

| Written | Result |
|---|---|
| `X2+600` | 6400 + 600 |
| `X2 + 600` | three tokens; unreadable |
| `X2+600.5` | `Undefined grid line name: X2+600.5` — **offsets are whole millimetres** |
| `X2+600-100` | the same — there is exactly one offset |
| `X9` | `Undefined grid line name: X9` — no such grid line |

**An offset may run past the next grid line.** `X1..X2+6000` is fine even if it reaches beyond `X3` — a grid line is a name for a coordinate, not the edge of a bay.

## Ranges

A range is `A..B`, and **both ends must be grid lines on the same axis.**

| Written | Result |
|---|---|
| `X1..X2+3200` | the X interval from 0 to 9600 |
| `X1..Y2` | `Both ends of a range are grid lines on the same axis` |
| `X2..X2` | `The region has zero width` |
| `X2..X1` | the same rectangle as `X1..X2`. **Stored normalised to ascending order** |

A reversed range folds into the ascending spelling because it is the same shape. Only the ascending spelling appears in the machine format and in diffs.

**There is one exception: a `band` range must be written ascending.** Inside a band the order of the members carries meaning, so a reversed range is not another spelling but a mistake (`A band range is written in ascending order`).

## Regions

**A region is exactly two tokens: one X range and one Y range.** Their order is free, so `Y1..Y2 X1..X2` is the same rectangle.

```muro-part
space /L1/room room X1..X3 Y2..Y3 name:寝室
```

Give three, or one, and you get `A region is given as two ranges, X?..X? and Y?..Y?`.

### Unions of rectangles

**`+` is a token of its own** — put whitespace around it. L shapes, U shapes, any number of rectangles.

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2800 name:LDK
```

Each side of `+` is its own pair of X and Y ranges. **Rectangles that overlap inside one space are an error** (`GEO01`), and so is an overlap with another space on the same level (`GEO02`). No wall stands on the internal seam of a union — an L written as two rectangles behaves as one room.

**A space may have no region at all.** `space /out exterior name:外部` is how exteriors and aggregation-only spaces are written. But a space that does have a region must have a determinable level and ceiling height (`SUF02` / `SUF01`).

## Points

Only the endpoints of a `line` are written as **points** — an X reference and a Y reference joined by a comma.

```muro-part
boundary /L1/a /L1/b
  line X3,Y1 X3+600,Y2-900
```

- **X first, then Y.** The other order gives `A point is written X grid line first, then Y`
- Both ends at the same point is an error
- **Neither raw coordinates nor angles can be written.** The endpoints of a line are always grid language

## Deciding a position without writing a region

Two constructs give dimensions and let the position follow.

**`band` supplies the extent, and its members carry only a width `w:`.** The cut positions are derived by addition, and the widths must sum to the extent of the band or the file stops.

```muro
koyu 1.0
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/a room w:2000
  space /L1/b room w:rest
```

A derived cut is spelled as **an offset from the largest grid line at or below that coordinate** (the floor rule). The cut at 2000 above becomes `X1+2000`, never `X3-3400`. The two ends of the band, and both ends across it, keep the spelling that was written.

**`column` writes no position at all.** A column stands at each grid intersection that has floor on that level; `x:` and `y:` only narrow which intersections by grid name.

## The one place raw coordinates are allowed

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

**`polygon` is the only line that writes a shape from free vertices off the grid.** A site outline is given by survey, not produced by design, so it is admitted as an exception. Three or more `x,y` vertices in millimetres, in the same coordinate system as the grid.

## Attributes that point at a position

The `at:` of an opening or a `seg` can be written either way.

| Spelling | Meaning |
|---|---|
| `at:0.3` | a ratio along the segment. **Clamped to fit** (no diagnostic) |
| `at:X2+450` | an absolute position. **Not clamped** |

An absolute position must be on the segment's axis — X references on horizontal segments, Y references on vertical ones. The wrong axis is `OPN07` / `SEG07`; running off the end is `OPN08` / `SEG08`.

```text
At X1+200 the door (width 900) runs off the boundary segment (segment 0-6400mm, center allowed 450-5950mm)
```

The difference between the two spellings is **whether it moves silently or stops.** If the position was decided as a dimension on a drawing, write it as a grid reference.
