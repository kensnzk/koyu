---
title: The same source must yield the same form
mode: explanation
---

# The same source must yield the same form

Not making form and not being able to make form are different things. **A unique form must be derivable from this description.**

If the rules of derivation differ per consumer, the same source yields different buildings. **Then it is not a source of truth.** So the rules are set out explicitly and a reference implementation is offered as an API.

**"The same composition yielding several forms" is a defect.** What may be plural is the **appearance**, not the form.

## Uniqueness is a predicate, not a sentence

"It is unique" is a weak promise, because nobody can check it. koyu writes it instead as **an implication a machine can enforce**.

```text
toCanonical(a) === toCanonical(b)  ⟹  derive(a) ≡ derive(b)
```

**Form is a function of canonical form.**

Canonical form is the definition of "the same building". Therefore **information that canonical form discards must not change the form.**

- the order in which a line's endpoints were written
- the declaration order of boundaries
- the order of lines in the file
- the direction of `boundary /L1/a /out` versus `boundary /out /L1/a`

Change any of those and the canonical JSON is byte-identical. So the form must be identical too. **If it is not, then either something discardable was not discarded, or something essential was.**

The implication is enforced by tests. They **first confirm that the canonical forms are equal** and only then assert that the forms match, so if the premise fails the test fails with "this pair proves nothing".

## Structure carries the guarantee first

Before any rules are listed, the structure itself carries uniqueness.

**The given grants coordinates, a relation grants the seat of a shared surface, and substance sits on that seat. Substance is born with a seat.**

Three places where this pays off.

**Walls.** A wall is not *placed*; it appears as the shared edge of two regions. With no placing operation, there is no ambiguity about where it was placed ([A wall is a relation](boundary-is-a-relation.md)).

**Columns.** A column's position is written nowhere. It appears where a grid crossing meets a floor. **Two columns never stand at the same crossing** — a deterministic rule says the earlier declaration wins.

**Vertical circulation.** Riser count, tread and slope are never written. They are derived from the region, the storey height and a declaration of which way is up. The same-sized stair enclosure takes 37 risers or 24 depending on the height — **both deterministically.**

## Derivation rules carry order too

Structure alone is not always enough. Where it is not, **order itself becomes part of the norm.**

An example. When a boundary carries a "drawn line" (a diagonal splitting line), regions are re-cut. Several lines apply in sequence, so **the order in which they apply could change the result.**

So the rule says: **cutting applies in canonical boundary order, not declaration order.**

Canonical JSON discards the declaration order of boundaries. Had cutting followed declaration order, the same canonical form could yield different areas — which contradicts the implication above. **The requirement that discarded information must not affect form is what fixes the scan order in the implementation.**

For the same reason, **a segment has no direction.** A line between the same two points is the same line whichever end it was written from. Derivation sorts the endpoints into ascending order before cutting. Without that, canonical JSON stays byte-identical while **a door comes out somewhere else.**

## No invented defaults

If a needed value is not written, no default is quietly supplied — **the element is simply not made.**

If no ceiling height can be determined, no storey height can be either, and no wall and no column stands on that level. **The sufficiency diagnostic then puts that into words** (SUF01). It does not quietly assume 2400 and emit a drawing.

The exception is the derivation defaults laid down by the specification — 100 mm wall thickness, 2000 mm head height, a 180 mm maximum riser, and so on. **Those are rules, not inventions.** A written value always wins. The list is [Derivation constants](../reference/form/constants.md).

**The distinction matters.** A default laid down as a rule is written down and reproducible; a default made up on the spot differs per implementation. Permit the latter and uniqueness evaporates.

## Form carries no appearance

The `Form` returned by the reference implementation `derive(model)` **holds not one item of appearance.**

**It holds** — coordinates (convex pieces of regions, boundary segments, opening centres, column sections, tread rectangles), thicknesses, z ranges, orientations, the identity of the object, and the plan classification.

**It does not hold** — colour, typeface, text size, line weight, line style, annotation wording (neither `UP` nor "12 risers at 175, 300 tread"), drawing symbols (void diagonals, the paired oblique cut marks, grid bubbles, arrowheads), scale and page margins, draw order and stacking and shading, or the judgement of what to draw and what to omit.

**That line is what lets "there may be several appearances" and "there must be exactly one form" hold together.** Drawing only draws the `Form`, and the contents of the SVG may change at any time. **What must not change is not the SVG but the `Form`.**

This too is machine-enforced: the drawing code is checked to import none of the form-assembling parts, the derivation constants are checked not to be spelled out on the drawing side, and the black bands that come out in plan are checked to be exactly the `Form`'s cut intervals.

## "Several forms may come out" is wrong

This position was once the opposite. There was a time when it read **"generation is not unique; the same composition yields several forms; that is not a defect."**

The reason for abandoning it is simple. **If several forms come out, the source has not determined the building.** Areas differ per consumer, wall positions differ per implementation, plans differ per release. That does not hold up even as an exchange format.

**What survives is only "there may be several appearances."** And that is not a statement about form.

## Next

- [Form — what derivation returns](../reference/form/index.md)
- [Derivation constants](../reference/form/constants.md)
- [A plan is not a horizontal section](plan-is-not-a-section.md)
- [Canonical JSON](../reference/json/index.md)
