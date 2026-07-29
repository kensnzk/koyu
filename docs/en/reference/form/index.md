---
title: Form — derive(model)
mode: reference
---

# Form — derive(model)

The source has no shape. The plan, the areas, the circulation — none of it is written. All of it is **derived**. And there is exactly one function that does the deriving.

```ts
import { derive } from "@kensnzk/koyu";

const form = derive(model);           // cut height defaults to 1200mm
const low  = derive(model, { cut: 900 });
```

`derive(model, {cut?}) → Form` is **the one entry point to shape**. Measuring an area, locating a wall, getting the elements of a plan, assembling a solid — every one of them comes out of this single return value.

## Four promises

### 1. Shape is a function of the canonical form

```text
toCanonical(a) === toCanonical(b)  ⟹  derive(a) ≡ derive(b)
```

[Canonical JSON](../json/index.md) is the definition of "what makes two buildings the same". Therefore **information the canonical form discards must not change the shape** — not the order the endpoints of a line were written in, not the declaration order of boundaries, not the declaration order of spaces, not the order the parts of a `+` region union were written in, not the order of the lines in the file.

This implication is not a promise made in prose; it is a predicate a machine can enforce. Variants are built with the endpoints of a line swapped, with the boundaries reordered, with the spaces reordered, with a region union swapped, and with `a`/`b` written the other way round. The test **first establishes that the canonical forms are equal**, then asserts that the shapes match. If the premise fails, the pair is reported as proving nothing.

**So that discarded information is never read, the shape fixes three orderings canonically.** Spaces (`spaces`, `slabs`) go in path collation order, boundaries (and the indices of `openings` and `segs`) in [canonical content order](../api/derive.md), and the convex pieces of a space in the canonical order of their written spelling. Each is the same rule canonical JSON uses — **never declaration order.**

Two rules follow. **A drawn line has no direction** ([Regions](regions.md)). **Cutting happens in canonical boundary order** (same page).

### 2. There is one way in to the shape

The shape of a space is `pieces` (the derived convex pieces), not `rects` (the written allocation). An allocation is a spelling of cells; it is not a shape. **Areas, shared edges, outlines, coverage, where columns stand, projections — every derivation that reads shape goes through this one door.**

`FormSpace.outline` is always the derived pieces. The written allocation never appears in `Form`.

### 3. No invented defaults

If a value that is needed was not written, the derivation does not quietly supply one — **it does not build the element**. With no ceiling height there is no ceiling and no roof; with no `slab:` not a single floor is generated. A shape that came out thin must never come out thin in silence, so the [SUF diagnostics](../diagnostics/suf.md) say so as errors.

The exception is the [derivation constants](constants.md). Wall thickness 100mm, head height 2000mm, maximum riser 180mm — these are rules the specification fixes, not defaults invented on the spot.

### 4. Pieces run counter-clockwise

Every outline `Form` returns is counter-clockwise (positive signed area), and reading the [edge orientations](boundaries.md) N/E/S/W assumes it.

## Form carries no appearance

| What `Form` holds | What `Form` does not hold |
|---|---|
| **Coordinates** — pieces of a region, boundary segments, opening centres, column sections, tread rectangles | **Colour, typeface, text size, line weight, line style** |
| **Thickness** — walls, rails, slabs | **Words of annotation** — neither `UP` nor `12 risers @175 / 300 going` |
| **z ranges** — walls, openings, columns, slabs, solids | **Drafting symbols** — the diagonal of a void, the two slashes of a break line, the circle of a grid bubble, the head of an arrow |
| **Direction** — edge orientation, direction of rise, hinge and swing side, whether an arrow goes up | **Scale, page margin, viewBox** |
| **Identity of the subject** — which space, which boundary, which opening this shape belongs to | **Draw order, stacking, shading** |
| **[Plan classification](plan.md)** — cut / below / above / swing / anchor | **The judgement of what to draw and what to leave out** |

`svgPlan`, `svgAxo` and any outside viewer only draw this `Form`. **What may legitimately differ is the appearance, not the shape.** Two shapes out of one composition is a defect.

That `Form` carries no appearance is machine-enforced: the `Form` of every bundled example is serialised to JSON and checked to contain no colour spelling, no Japanese, and no `UP`/`DN`.

## What is inside Form

```ts
interface Form {
  input: FormInput;           // the argument the derivation was given (cut height)
  levels: FormLevel[];        // levels and storey pitch
  spaces: FormSpace[];        // derived pieces, area, volume, indoor / semi-outdoor / covered
  boundaries: FormBoundary[]; // centre segment, and if there is matter, its panels
  openings: FormOpening[];    // centre, width, z range, leaf thickness, door swing
  segs: FormSeg[];            // where the uncounted segments sit
  slabs: Slab[];              // floors, ceilings, roofs
  columns: FormColumn[];      // columns standing on grid intersections
  runs: FormRun[];            // vertical circulation: step division and solids
  site: FormSite[];           // the given site polygon and its area
  plans: FormPlan[];          // per level: a classified set of 2D entities
}
```

Each entry of `levels` carries `pitch` — the storey height, i.e. how far walls and columns rise. It is the difference to the level above if there is one, and otherwise **the tallest ceiling height on that storey plus the roof slab thickness**. `levelPitch(model, level)` answers it on its own.

```text
levels: [ { name: "L1", z: 0, h: 2400, slab: 150, pitch: 2600 } ]
```

(`examples/two-rooms.muro`. There is no level above, so `2400 + 200`.)

## Identity of the subject

Every element of `Form` carries a `ref`. A boundary is `<a>|<b>@<i>`, an opening is `<boundary ref>/<index>`, a `seg` is `<boundary ref>~<index>`, a column is `<level>/<X grid>/<Y grid>`, and a run is the path of the space that declared it.

```text
"/L1/a|/L1/b@0"        a boundary
"/L1/b|/out@2/0"       opening 0 of that boundary
"L1/X2/Y3"             a column
```

**The index `@i` is an index into canonical boundary order, not declaration order.** Declaration order is information the canonical form discards, so indexing by it would produce different spellings from the same canonical form. `canonicalBoundaryOrder(model)` is public precisely so consumers never index `model.boundaries[i]`.

## Constructors of matter

`Form` holds centre lines, thicknesses and z. Raising matter from those is itself part of the derivation, so there is exactly one implementation. If each consumer rewrote it, the parts would be shared but **the rules of assembly would not**, and the door to "two shapes from one `Form`" would open again.

| Constructor | What it raises |
|---|---|
| `thicken(x1, y1, x2, y2, t)` | a centre line into a thick quadrilateral — one formula, diagonal segments included |
| `bandLine(seg, cx, cy, w)` | the interval a band (opening or `seg`) occupies along a segment |
| `band(seg, cx, cy, w, t)` | that interval as a thick quadrilateral — `bandLine` run through `thicken` |
| `columnRect(c)` | the section of a column |
| `runPrism(s)` | a vertical-circulation solid as a prism (base outline plus per-vertex top/bottom z) |

**The vertices of the quadrilateral run start+n → end+n → end−n → start−n**, so joining the midpoints of the two opposing sides gives the centre line back. Plan entities carry **both the footprint (the quadrilateral) and the centre line** — whether to draw something as thick or as a single line (a rail or a fence that does not enclose) is a judgement about appearance, so consumers never have to recover the axis from the footprint.

## Neighbouring pages

- [Regions](regions.md) — from allocation to region, and re-cutting by a drawn line
- [Boundary segments](boundaries.md) — where a wall stands
- [Matter](bodies.md) — walls, openings, columns, floors, ceilings, roofs
- [Vertical runs](vertical-runs.md) — the arithmetic of step division and slope
- [Constants and tolerances](constants.md) — seventeen and seven
- [The plan](plan.md) — a classified set of 2D entities
- [Scope](../scope.md) — what a green `check` means
- [Stability](../stability.md) — `Form` freezes; the SVG does not
