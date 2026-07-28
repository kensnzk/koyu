---
title: What koyu does not hold
mode: reference
---

# What koyu does not hold

**The resolution of this data is that of a schematic design.** Not for lack of ambition — that is where it is placed. What follows is the list of things deliberately left out.

## Geometry in the source

**The plan, the areas, the circulation are not written. They are [derived](form/index.md).** What a space holds is a reference to grid lines, not coordinates. A wall's position emerges from the relation between two spaces, a column from a grid intersection meeting a floor, a step division from a region and a storey pitch.

There are exactly two exceptions, both **givens**: the site [`polygon`](muro/polygon.md) and a [drawn line](muro/line.md). The first is given rather than designed; the second is the line the designer drew, and nothing else produces it.

**Why not hold it.** Geometry is increasingly obtainable from reality. Scanning, SLAM, photogrammetry — the ways to acquire form keep getting cheaper. There is no reason to write into the source what will simply be available.

And there are things a point cloud never yields. **What kind of space this is. Whose boundary this is. Whether this door may be used. Since when.** Meaning, relation and identity cannot be observed. They have to be written.

So the source holds what has to be written. **Not holding shape in the source is not a compromise; it is the definition of the role.** And holding only what has to be written makes it light. Light enough that one whole building fits in a machine's field of view. **Lightness is not the goal; it is what falls out of the role.**

## A placement mechanism

**Containment gives no seat.** A column or a piece of equipment carries only "which space contains it", and no shape can be made from that.

Add a placement mechanism and coordinates come back into the source. A column has shape because the given (a grid) crosses a derivation (a floor), not because somebody wrote "put it here".

## Architectural judgement as part of the source contract

Neither the 1/7 of daylight, nor the 2m of frontage, nor a lower bound on a stair's going is **an invariant the composition must satisfy**.

Judgement lives on [another face](validate/index.md). That face does not freeze, and it grows. Core returns numbers; validation draws lines through them. Break that division of labour and every added regulation or convention moves the language version.

What a green `check` means is defined by [Scope](scope.md), and architectural validity is not in it.

## Chasing production-level resolution

**Coverage is not a value.**

The more that is added, the further it drifts out of the machine's field of view, and the goal breaks. Cases where a ceiling does not follow the outline of the room — a coffer, a bulkhead, a continuous ceiling spanning several rooms, a pelmet in front of a curtain wall — are outside the resolution of a schematic design. The only escape hatch is `ceiling:0` (an exposed soffit); there is no word for handing over a drafted ceiling.

For the same reason, **there are no curves.** A spiral stair is written as a succession of turns.

## Round-tripping

**There is an exit but no round trip.** [Canonical JSON](json/index.md) is the exit for programs that have no `.muro` parser, but there is no function that reads it back. **The only way into the system is `parse`.**

That is a choice for one original. Build a reader and there are two.

## Where it is nonetheless open

Not holding something is not the same as forbidding it.

**The [carried tier](scope.md) is open, with a namespace.** `acme.sensor:23`, `bems.temp:24.5`, `survey.measured:2026-03-11` — anything can be written and is carried through. Core declares that it **does not read** it.

Being open and being trustworthy coexist as long as the boundary is declared. Without the declaration, **"not looked at" cannot be told apart from "looked at and fine"**, and "nothing wrong" in that state means nothing.

That is why an unknown key without a namespace is an error ([ATT03](diagnostics/att.md)). **Being able to carry something without judging it is a legitimate state, and saying so explicitly is the condition of that freedom.**

## Neighbouring pages

- [Scope](scope.md) — what is and is not guaranteed
- [Stability](stability.md) — the list of surfaces that do not freeze
- [Form](form/index.md) — the side that is derived
- [attributes](muro/attributes.md) — the three tiers and namespaces
- [polygon](muro/polygon.md) / [line](muro/line.md) — the two exceptions
