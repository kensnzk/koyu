# ADR-0069: Stair arrows point towards increasing elevation on a plan

## Context

`FormPlan` carries direction-of-travel arrows for the ascending and descending faces of a run. The
SVG renderer copied both directions, so a general floor showed one UP arrow leaving the floor and
one DN arrow leaving it towards the floor below. Japanese plan convention reads a stair arrow as
increasing elevation instead: the flight arriving from below points into the current landing.

A boundary with `air:1` was already represented as a thin axis, but a short railing could be
mistaken for an incidental construction line.

## Decision

`Form` remains unchanged. When `planMarks` turns a stair's descending-face arrow into a presentation
mark, it reverses the line and marks it as up. An ascending stair arrow is unchanged. Escalators
retain their operating direction because an adjacent down unit is a different machine, not the
same stair viewed from another storey.

The SVG renderer uses a light open arrowhead and adds no `UP` or `DN` word. It draws an `air:1`
boundary as a light axis with a small filled post at each end. It introduces no railing type, post
spacing or component library.

Each departing stair arrow starts with an open circle at the exact boundary of its flight, centred
on a full-width first riser line. An arriving arrow starts at the preceding floor's cut without a
circle. A return stair remains one bent path across the intermediate landing. The SVG cut symbol
scales the supplied 10 by 40 glyph to the flight width and rotates it 30 degrees. Its position remains the
`FormPlan` cut at FL + 1200mm.

The return path enters the landing by half a flight width before crossing to the other flight. The
offset is capped at half the landing depth.

The renderer omits the generic room label over spaces connected by the stair's vertical boundaries.
It omits the stair's derived riser and tread note. Other vertical-circulation devices retain their
existing labels.

The top floor repeats the preceding floor's cut symbol, omits treads below it, and retains the
boundary lines at the visible flight ends.

## Consequences

The lowest floor has an arrow leaving it towards the floor above. A general floor has that arrow
and a second arrow arriving from the preceding floor's cut. A top floor shows that arriving arrow.
It passes continuously across a return landing. Every stair arrow therefore points towards
increasing elevation.

The canonical model, `Form`, vertical-run geometry, graph and language version do not change. The
new behaviour belongs only to the non-frozen drawing marks and SVG appearance.
