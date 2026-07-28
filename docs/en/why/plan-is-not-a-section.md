---
title: A plan is not a horizontal section
mode: explanation
---

# A plan is not a horizontal section

"A plan is the building cut horizontally at a fixed height above the floor" — that is half right. **Cutting a solid does not give you a plan.**

This page lists the four things that cutting never produces, and explains how they shape the design of derivation. What derivation returns is catalogued in [Plan form](../reference/form/plan.md).

## The cut is an input, not part of derivation

First, the cut itself. A plan is "the section at this level", and the cut plane sits at **a fixed height above FL** (1200 mm by default).

**That height is an input to derivation, not something derivation decides.** Change it and a sill window is cut or not cut. **Give the same cut height and the same plan comes out** — the promise in [The same source must yield the same form](form-must-be-unique.md) is a promise given that input.

## The four things a cut cannot produce

### 1. Door swings

A door's swing arc is **a symbol of movement; there is no thing there.** Cut as precisely as you like and you have cut air, not an arc.

Counted across the bundled examples, plans carry **1,516** swing entities. Every one of them is a symbol, not a section.

### 2. The projection of voids above

Things above the cut plane fall onto the plan of the storey below. The outline of a void is the archetype.

**This actually got dropped.** The bundled examples contain **29** such projections, and for a while not one of them appeared in a viewer's plans. The instruction handed over was "cut the solid", so of course everything above the cut plane vanished.

What is projected is **the derived form**. Project the authored rectangles instead and a void that has been re-cut by a diagonal line comes out **in its uncut shape**.

### 3. The cut line

The line drawn where a stair crosses the cut plane. It marks **the fact of being cut**, not a thing.

Drawing convention puts two parallel oblique strokes there, but **being two strokes is appearance.** Derivation returns a single segment spanning the full width of the run; whether to draw it as two strokes or some other symbol is the drawing side's call.

### 4. The descending run

What is visible below the cut plane. A downward stair is under the cut, so it is not in the section. It is nonetheless drawn on the plan.

koyu produces it as **what its twin upward run left unhidden**, the two sharing the same frame. To be twins, the four coordinates of the rectangle must match, and direction, form, device and part count must all agree. **Matching by position alone yields mirror images.**

## Which is why form is a classified 2D set

Leave those four to be "invented by each consumer" and you get a different plan per consumer, which contradicts [Form must be unique](form-must-be-unique.md).

So derivation returns the plan as **a set of 2D entities with classifications**, each carrying geometry, a class, and the identity of what it is the form of.

| Class | What it is | Count across the bundled examples |
|---|---|---|
| `cut` | what the cut plane sliced | 20,782 |
| `above` | projection of what is above the cut | 2,460 |
| `below` | what is visible below the cut | 845 |
| `swing` | the arc of movement | 1,516 |
| `anchor` | the seat where a symbol goes | 179 |

**The essential point is that the classification lives on the form side.** "This is a section, this is a projection" is decided by comparing the cut height with a z range — that is derivation's job. Leave it to the drawing side and the comparison thresholds differ per implementation, and the same source yields different drawings.

`anchor` occupies an interesting position. **The symbol is appearance, but the seat the symbol goes in is form.** "An up/down annotation is needed here" is decided by derivation; "write `UP` or draw an arrow" is decided by drawing.

## A wall is a run of intervals with holes in it from the start

An old trick in plan drawing is to **paint over the black band of a wall with the paper colour so it reads as an opening**. koyu has no such operation.

A wall appears as **the run of intervals into which openings divide it**. Openings on the segment are ordered, full-height intervals sit between them, and at each opening a spandrel below and a head above remain.

**In plan as in three dimensions, a wall is a run of intervals with holes in it from the start.** With no painting-over operation, there is no failure to paint over.

And that the black bands really are the `Form`'s cut intervals is checked: the similarity transform from world to page is solved from the bounding box, and the two are matched as sets of quadrilaterals.

## Do not confuse what cannot be drawn with what cannot be written

The drawing surface does not freeze. **Dimension lines, grid bubbles, door and window conventions, scale, pitched roofs — the precision can be raised a bit at a time.**

With one condition. **What cannot be drawn must never be mistaken for what cannot be written.** Without an enumeration of what is drawn and what is not, the limits of the drawing side get imported as limits of the description side, and **the source starts being dragged around by its presentation.**

Because of that condition, a poor plan is never a reason to change the notation. **What may change is the appearance, not the form.**

## Next

- [Plan form](../reference/form/plan.md) — the classes and the entities
- [Form — what derivation returns](../reference/form/index.md)
- [The same source must yield the same form](form-must-be-unique.md)
- [koyu plan](../reference/cli/plan.md)
