---
title: Derivation constants and tolerances
mode: reference
---

# Derivation constants and tolerances

**Derivation constants are not defaults of the attribute ledger.** The [ledger](../muro/attributes.md) fixes what may be written; these fix **what is derived when nothing was written**. Write a value and the written value always wins.

Tolerances are the numbers that decide how different two things must be to be different things. Coordinates are integer millimetres by default, so a length tolerance sits at half the integer step.

Both are published as `DERIVATION_CONSTANTS` and `TOLERANCES`, and a test binds the two tables on this page to the implementation.

## Derivation constants — seventeen

| Constant | Value | Unit | What it decides |
|---|---|---|---|
| `WALL_T` | 100 | mm | default [wall thickness](bodies.md) (`t:` overrides), distributed half to each side of the centre line |
| `RAIL_T` | 60 | mm | default thickness of a non-enclosing boundary (`air:1`); `t:` overrides |
| `RAIL_T_MAX` | 80 | mm | cap on the thickness of a non-enclosing boundary; whatever `t:` says, it stops here |
| `RAIL_H` | 1100 | mm | default top height of a non-enclosing boundary; the boundary's `h:` overrides |
| `OPENING_HEAD` | 2000 | mm | [lintel height](bodies.md). A door rises to it; everything else drops from it |
| `OPENING_H` | 1200 | mm | default height of an opening that is not a door; the opening's `h:` overrides |
| `CEILING_T` | 30 | mm | face thickness of a ceiling |
| `ROOF_T` | 200 | mm | default roof slab thickness, and the amount stacked above the ceiling height on a top storey |
| `CUT_HEIGHT` | 1200 | mm | height of the [plan cut](plan.md) above FL (the default input to `derive`) |
| `DEFAULT_RISER_MAX` | 180 | mm | [maximum riser](vertical-runs.md) (`riser:` overrides). It decides the riser count |
| `TREAD_TARGET` | 300 | mm | target going used when the landing of a turning run is solved as the remainder (`tread:` overrides) |
| `LANDING_MIN` | 1100 | mm | minimum depth of an intermediate landing; a written `landing:` is raised to it too |
| `ENTRY_LANDING` | 1100 | mm | default depth of the entry floor band (`entry:` overrides) |
| `LANE_ESCALATOR` | 1200 | mm | default nominal width of one escalator unit (`lane:` overrides). It decides the unit count |
| `TREAD_SOLID` | 200 | mm | face thickness of a tread board (solids) |
| `SLAB_T` | 200 | mm | thickness of a landing slab and of the inclined slab of a ramp or escalator |
| `STEP_MARK` | 400 | mm | pitch of the escalator step marks in plan |

Three dimensions are solved on the spot rather than held as constants. **The lift car** is inset `min(300, side ÷ 6)` on all four sides and stands from FL + 60 to FL + 2400. **The escalator balustrade** is `min(140, unit width ÷ 8)` wide and 100mm thick, raised 900mm above the tread surface. Each is defined relative to another value, so none of them is a constant of its own.

## Tolerances — seven

**No question may have two tolerances.**

| Tolerance | Value | Unit | What it permits |
|---|---|---|---|
| `EPS` | 0.5 | mm | [edge](boundaries.md) axis-parallelism, facing, interval coincidence, gap in collinear merging, grid-reference overrun, opening overlap |
| `AREA_EPS` | 1 | mm² | whether what a cut leaves disappears; whether the left/right area difference counts as "no bias"; whether a roof tile survives |
| `PROBE` | 5 | mm | how far to probe either side of a drawn line. **The lower bound on the resolution of shape** |
| `SPAN_EPS` | 1 | mm | comparing the cut plane with a part's z; minimum length of a visible interval; matching twin frames; minimum length of an envelope hole; minimum length of a wall interval |
| `CROSS_EPS` | 1e-6 | — | the sign (cross product = twice the area) when cutting by a half-plane |
| `PARALLEL_EPS` | 1e-9 | — | parallelism between an infinite line and a segment; the range of the segment-side parameter |
| `POINT_EPS` | 1 | mm | the width within which a point counts as lying on a polygon edge (on the boundary counts as inside). Where a column stands is read this way |

`EPS` is 0.5mm because that is **half the integer millimetre step**. `AREA_EPS` at 1mm² is a 1mm × 1mm sliver: if a half-plane cut leaves that or less, it is not counted as shape.

`PROBE` at 5mm is different in kind from the other six. It is not a rounding allowance but a floor on shape itself: **a space narrower than 5mm can be assigned to neither side of the line, and its boundary yields no segment at all.**

## Why they live in one place

While these values sat module by module, the same 0.5 was written twice independently, a `1` appeared as a literal in four places, and the axis-parallel test used a literal 0.5 rather than the shared value. All the same numbers, so nothing broke. What was broken was that **nobody could say what would move if one of them moved.**

The same had happened to the wall thickness of 100mm — four separate literals, and fixing one left the other three untouched. Tolerances and constants are part of [the rules of derivation](index.md), and rules that differ per consumer mean different buildings out of the same source.

## Neighbouring pages

- [Form](index.md) — `derive(model)` and the four promises
- [Matter](bodies.md) — where the constants actually bite
- [The arithmetic of vertical runs](vertical-runs.md) — the step-division constants
- [attributes](../muro/attributes.md) — the side that says what may be written
- [defaults](../muro/defaults.md) — the defaults of the notation itself
