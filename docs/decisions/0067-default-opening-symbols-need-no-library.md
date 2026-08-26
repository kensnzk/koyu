# ADR-0067: Default opening symbols need no library

Date: 2026-08-24 / Status: adopted (koyu 0.29.0) / Origin: the repository owner — "First make the standard appearance of hinged doors, sliding doors and windows beautiful without assets."

## Context

The plan already had marks for a door leaf, its swing arc, a sliding panel and a window. Their
rendering did not carry enough distinction. A hinged door used a dashed swing arc even though the
Japanese public-building convention draws it as a thin solid line. A window was one centre line,
so a large opening could not be distinguished from an open boundary. A sliding leaf was parked
almost entirely under the black wall band, leaving only a short line visible.

An asset-specific symbol system is planned, but making the basic plan depend on that system would
leave every ordinary opening and every missing symbol with the weak representation. It would also
make a presentation library a prerequisite for reading the building.

## Decision

**1. Every opening has a complete default mark.** A hinged door uses the leaf and swing already in
`Form`, with a solid arc. A sliding or automatic door uses a solid panel offset beyond the wall face, a
short perpendicular line at its centre, and a thin dashed continuation over its pocket. A window
continues the two wall faces through the opening as unfilled lines. It does not close those lines
at the jambs or add a centre line; either would make it read as a boxed door opening.

**2. The marks add no building geometry.** The renderer does not decide the opening width, the
wall thickness, the hinge, the side into which the door opens or the cut classification. It only
chooses line weight, line style and which supplied edges to show. A window outside the cut plane is
faint and dashed; its position is unchanged.

**3. Asset symbols are a later presentation override, not the base.** A missing, unsupported or
unavailable asset symbol falls back to the same marks. The source remains readable without an
asset library.

**4. One asset-free fixture holds the population.** It places each symbol on north, east, south
and west walls. The test checks the SVG structure, while the generated sheet is the visual review
surface.

## Alternatives

**Wait for the asset-symbol resolver.** Rejected because it couples a small drawing correction to
the acquisition, licensing, conversion and placement of a whole external library.

**Infer a detailed fitting from its name or width.** Rejected because a default symbol must not
invent leaf count, sliding arrangement, automation or window operation. ADR-0068 adds explicit
source values for the distinctions a plan can show.

**Keep the window as one line and rely on labels.** Rejected because the plan should distinguish a
window by geometry before a reader finds a schedule or annotation.

## Consequences

The SVG bytes change, which is allowed on the drawing surface. `Form`, canonical JSON, circulation,
daylight and every structural diagnostic remain unchanged. The window mark carries the opening
polygon that `Form` already provided, so another renderer may select the same two wall-face edges.
