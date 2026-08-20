# ADR-0066: An arbitrary section is named by a directed line

Date: 2026-08-21 / Status: adopted / Origin: a section used to check an external geometric limit must follow that limit's measuring direction rather than an approximate grid axis

Ships in koyu 0.27.0. **The language version does not move**: no source word or derived building shape changes, and every existing axis-section call returns the same entities and SVG bytes.

## Context

ADR-0064 put vertical-section classification in core and limited the plane to X or Y. That was enough for the four named elevations and for a command whose cut is named by a muro grid reference. It was not enough for a consumer that receives a measuring line in world coordinates. A site edge, survey line or other external datum can be oblique, and substituting the nearer grid axis changes both what the plane cuts and the distance shown across the sheet.

The missing choice was how an arbitrary plane states its origin, direction and facing without adding another convention in each caller.

## Decision

**1. `sectionForm` accepts either the existing axis spec or `LineSectionSpec { cut }`.**

`cut` is a directed plan line `(x1,y1) → (x2,y2)`. It names an infinite vertical plane. The endpoints establish its coordinate frame rather than clipping the result: `u = 0` is the first point, positive `u` follows the line, and the viewer looks toward the line's left side. The direction is therefore left-to-right on the section sheet. Reversing the endpoints deliberately mirrors the section and changes which half of the model is behind the plane.

The existing `SectionSpec`, `FormSection`, defaults and return bytes remain unchanged. A directed-line call returns `LineFormSection`; its entities use the same `cut` / `beyond`, `(u,z)` and `depth` contract.

**2. An oblique body intersection uses the existing axis intersection in a local orthonormal frame.**

Each plan point is expressed as distance along the line and signed distance behind it. The signed distance becomes local X, and the existing `crossing` operation cuts it at zero. Heights are still interpolated from the original body edge and parameter. This keeps one tolerance and one rule for a plane grazing a convex body.

**3. `svgSection` accepts the same directed line.**

The renderer receives the classified entities from `sectionForm`; it performs no building geometry. Grid bubbles remain an axis-section annotation and are omitted for an arbitrary line because neither grid axis runs along that sheet.

**4. A section drawing may carry caller-supplied `guides` in `(u,z)`.**

A guide is a reference polyline, not a `Form` entity. The renderer includes it in the sheet extent and maps it with the same transform as the building section. This lets a consumer place a datum or geometric limit over the building without copying the private page margins and scale into another renderer. The guide carries no rule or threshold; those points come entirely from the caller.

**5. The CLI and the four named elevations do not change.**

`koyu section --at` continues to require a grid reference, because direct coordinates are not muro notation. `elevationForm` continues to return N, E, S and W. Arbitrary cuts are an API input for consumers that already hold world coordinates.

## Alternatives

**Choose the closer X or Y axis.** Rejected because it silently changes the section. The approximation is most misleading when a limit is measured perpendicular to an oblique datum.

**Let the product intersect `Form` itself.** Rejected for the same reason ADR-0064 rejected geometry in the drawing: consumers would acquire separate tolerances and could return different sections from one `Form`.

**Give the line an independent `look`.** Rejected because a line plus an arbitrary look has invalid combinations and two spellings for the same frame. Direction already distinguishes the two possible facings.

**Add arbitrary coordinates to the CLI.** Rejected because the CLI names a cut from the source's grid. A consumer holding survey or regulatory coordinates already uses the API and does not need those coordinates to become notation.

## Consequences and costs

An external measuring line now produces an exact building section in the same metric frame: a profile distance from its first point is the section's `u` coordinate. Axis calls stay byte-compatible.

The directed line has an order. A caller that swaps its endpoints asks for the opposite view and must also reverse any guide coordinates it supplies. This is explicit in the input rather than inferred from the building.

Only the building classification belongs to core. The meaning of a guide remains outside it; core can place a limit line but cannot say whether the building satisfies it.
