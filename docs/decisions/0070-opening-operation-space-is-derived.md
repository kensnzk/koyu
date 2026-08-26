# ADR-0070 — Opening operation space is derived independently of its drawing symbol

Date: 2026-08-24 / Status: adopted / Origin: sliding leaves could be drawn beyond the space that
owned the opening, while no reusable fact described the occupied length

## Context

An opening width describes the interval removed from a boundary. It does not describe the space a
moving leaf uses while opening or where that leaf sits when open. The plan renderer had enough
direction to draw a sliding guide, but the guide included a 60mm presentation gap from the wall.
Using that SVG or its bounding box for coordination would make a drawing option change a design
judgement.

Assets do not introduce another geometry contract. They provide defaults for the same opening
attributes an instance may write, and the instance may override them. The effective width, style,
hinge and operation side are therefore available after composition without reading an asset name
or a display symbol.

The first implementation also exposed two distinctions hidden by the original three style values.
An automatic door parks moving leaves behind fixed sidelights inside its wall opening; it does not
need another half-opening at each end. A vehicle or loading shutter commonly moves vertically and
must not be treated as a horizontal sliding leaf.

## Decision

1. `koyu.analysis.opening-operations@1` returns placed operation geometry as facts. Its first value
   is the fully open storage segment of each horizontal sliding leaf, the intended space, the
   length outside that space and any other modelled spaces crossed by the segment.
2. The geometry uses the wall face and the common 5mm shape probe. It never reads `SLIDE_GAP` or
   any other presentation option.
3. `koyu.schematic.opening.storage-leaves-space@1` is a built-in design-lint rule. It reports a
   violation when the parked segment leaves the selected operation space. This is not an OPN
   diagnostic: the source is structurally consistent, and another product operation may be a
   legitimate revision.
4. A single sliding leaf stores one opening width at the hinge jamb. A double sliding opening
   stores half an opening width at each jamb. `sliding-bypass`, `auto`, `auto-single` and
   `auto-double` need no horizontal storage beyond the aperture.
5. `rolling-shutter` and `overhead` are explicit muro 1.5 door styles. The first coils above the
   opening; the second is a sectional door that rises above it. Their plan marks claim no
   horizontal storage. Their vertical operation geometry belongs in a later section view.
6. An Asset and the same attributes written on an opening produce identical observations. No
   operation is inferred from an asset name, opening name or SVG.

## Consequences

Existing assets that used `sliding` only because no vertical or bypass value existed must select
the operation they actually describe. A full-height bypass sash uses `sliding-bypass`; a coiling
vehicle shutter uses `rolling-shutter`.

The analysis is outside the frozen Form. It can grow with new design observations without changing
canonical JSON or muro semantics. If a future manufacturer asset writes physical values that the
current attributes cannot derive, those values need a versioned language change rather than an
unrecorded external SVG convention.
