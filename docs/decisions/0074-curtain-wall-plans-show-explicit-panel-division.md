# 0074 — Curtain-wall plans show explicit panel division

Status: accepted

## Context

A long window opening reads as an empty gap in a plan. That is sufficient for an ordinary window,
but it erases the repeated panel division that makes a curtain wall legible at schematic scale.
Inferring a module from an asset name or dividing every long window at a fixed pitch would invent a
facade layout that the source did not state.

Manufacturer horizontal sections show glass continuing between mullions, with each mullion having
a product-specific profile and depth. General plans at 1:50 reduce that construction to two light
facade lines and short panel-boundary marks. Publication plans at smaller scales reduce it further.
The product profile therefore does not belong in the default schematic mark.

## Decision

`style:curtain-wall` is a window-only plan presentation. `panels:` states an equal panel count; one
is used when it is omitted. No count or pitch is inferred from width, name or asset identity.

The built-in plan keeps the ordinary window's two unfilled face lines and adds one thin line across
the opening thickness at each interior panel boundary. It does not draw a filled mullion profile.
An asset may carry both facts so every instance of a facade type shares one layout.

`panels:` is valid only on a window with `style:curtain-wall` and must be a positive whole number.
OPN10 reports a mismatch or fractional count. Both the style and attribute are version-gated to
muro 1.5 by VER08.

## Consequences

The default plan distinguishes a curtain wall without importing fabrication detail into a
schematic drawing. A future asset display can replace the thin boundary marks with product-specific
SVG geometry, including corner mullions, end conditions and operable inserts, without changing the
source panel count.
