---
title: The plan — classified 2D entities
mode: reference
---

# The plan — classified 2D entities

**A plan is not a horizontal section.** Slicing a solid does not give you a plan. Four things never come out of it, however accurately you cut.

- **The swing of a door** — a symbol of movement; there is no matter there
- **The look-up into a void above** — what is above the cut, dropped onto the storey below
- **The break line itself** — the position of the fact that something was cut
- **The descending run** — what is visible below the cut

Tell consumers to "slice the solid" and each of them will invent those four. The projection of an upper void really did fall out this way: the bundled examples are full of them, and a viewer's plans showed none.

So `Form` holds the plan as a **classified set of 2D entities**.

```ts
form.plans   // one per level
// { level: "L1", cut: 1200, cutZ: 1200, entities: [ … ] }
```

## Entities

```ts
interface PlanEntity {
  class: "cut" | "below" | "above" | "swing" | "anchor";
  of: "space" | "boundary" | "opening" | "column" | "run";
  ref: string;                 // identity of the subject
  role?: "outline" | "tread" | "break" | "arrow";
  polygon?: Pt[];
  lines?: Seg2[];
  arc?: { cx, cy, r, from, to, ccw };
  anchor?: { x, y, up? };
}
```

| Class | Meaning |
|---|---|
| `cut` | what the cut plane cut |
| `below` | what is visible below the cut |
| `above` | the projection of what is above the cut |
| `swing` | the trace of movement (a door) |
| `anchor` | a seat for a symbol |

`role` says **what kind of line** a vertical-circulation entity is in drafting terms — the side lines of a run (`outline`), nosings or step marks (`tread`), the break line (`break`), the direction-of-travel arrow (`arrow`).

L1 of `examples/two-rooms.muro` holds 25 entities.

```text
cut/space 2   cut/boundary 11   above/boundary 4   below/boundary 2
cut/opening 4   swing/opening 2
```

You can read the wall intervals splitting across three classes. Intervals spanning the cut (z = 1200) are `cut`; head walls are `above`; sill walls are `below`.

## The cut height is an input to Form, not part of it

```ts
derive(model)              // cut = 1200 (CUT_HEIGHT)
derive(model, { cut: 900 })
```

`FormPlan.cut` is the height above FL and `cutZ` the height in world coordinates. Changing the cut height changes the classification — that is a different slice of the same shape, not a different shape.

## Walls and openings

If a boundary has matter, each of [the intervals it was split into by openings](bodies.md) becomes one entity. Its z range is compared with the cut plane: spanning it gives `cut`, a top below it gives `below`, otherwise `above`. A boundary with no matter (`type:open`) carries only its centre segment.

**An interval carries both the footprint and the centre line.** The footprint is the body with [its junctions settled](bodies.md), so at a corner it is not the centre line thickened and the axis cannot be recovered from it. Drawing the interval as thick or as a single line (a rail or fence that does not enclose) is a judgement about appearance; **repairing a corner is not one, and there is nothing left on the drawing side to repair.**

An opening carries the band of the leaf itself, and a door is followed by a `swing` entity. Sliding and automatic doors have no arc — only the segment from hinge to leaf tip.

The black band in a plan **is the "cut interval" of `Form` itself**. There is nowhere an operation that paints over it in the paper colour.

## Ascending and descending runs

One plan shows two runs — the one **ascending** from this level and the one **descending** to it. That is why a stair appears differently on every storey, and it is the fact that a plan is a section cut at that level.

**The ascending run** has, per part, a visible interval decided by comparing its z range with the cut plane. If the cut is at or above the top of the part it is wholly visible; at or below the bottom, wholly hidden; spanning, it breaks where it crosses. The test is purely geometric and never keys on the index of the part — parallel units are cut at the same height, and only this way does the second unit get a window.

**The descending run** appears in **what its twin ascending run left uncovered**. To be a twin, the four coordinates of the rectangle must match within `SPAN_EPS`, and direction, form, device and part count must all agree. Matching on position alone produces mirror images. With no twin, the descending run is wholly visible.

Ascending runs land in `cut`, descending runs in `below`.

Nosings are laid out from the part's t0 at the going interval, and anything outside the visible interval is dropped. Escalator step marks are laid out from **the start of the visible interval** at a constant `STEP_MARK` (400mm) pitch.

Arrows are drawn per unit for an escalator, and for a stair or ramp one per departing flight (on the ascending face) or arriving flight (on the descending face). **The direction is decided by the way people travel and nothing else.** An escalator points the same way on both faces; a stair or ramp reverses on the descending face — the machine's direction is fixed, a person's changes with the face. A visible interval that does not **exceed** `ARROW_SPAN_MIN` (900mm) gets no arrow — an interval of exactly 900mm gets none either ([derivation constants](constants.md)).

`anchor` returns only the seat for the annotation. The riser count and the slope live on the [vertical run](vertical-runs.md); turning them into words is the drawing side's job.

**The break line** is a single segment crossing the full width of the run at the position where it spans the cut plane. The conventional pair of parallel slashes is appearance, and the drawing side adds it.

## The projection of an upper void

For the two spaces joined by a `void` boundary, **the derived shape of the upper space** drops onto the lower plan as `above`. Dropping the allocation instead would show a void cut by a drawn line in its uncut form.

## Site boundaries appear on the lowest storey

`Form.site` carries the given site polygon regardless of level.

**`koyu plan` treats the lowest storey's plan as a site plan too, and draws the site boundary there — and only there — as a dash-double-dot line** (grid lines are dash-dot, so the two are told apart by style). That is a judgement about the composition of the sheet, not shape. Neither which level it lands on nor the line style is inside [what freezes](../stability.md).

## Neighbouring pages

- [Form](index.md) — what `Form` holds and does not hold
- [The section](section.md) — the vertical plane, and why it needs two classes where this needs five
- [Matter](bodies.md) — walls, openings, columns and slabs before the cut
- [The arithmetic of vertical runs](vertical-runs.md) — how a run is divided
- [Constants and tolerances](constants.md) — `CUT_HEIGHT` and `STEP_MARK`
- [koyu plan](../cli/plan.md) — turning this set into SVG
- [koyu axo](../cli/axo.md) — the same `Form` seen as a solid
