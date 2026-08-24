# ADR-0075 — Components use named areas and external plan SVG

## Status

Accepted.

## Context

Furniture, sanitary fixtures and equipment need fixed physical dimensions, repeatable symbols and
placement that remains attached to the space allocation. An absolute point would duplicate
position already expressed by an area and would drift when that allocation moved. Compass words
would also be unstable: the model can rotate on the site while its local X/Y frame remains the
same.

The symbol itself changes more freely than physical placement. Putting SVG bytes into `Model` or
`Form` would make a presentation change alter canonical data or derived shape. Rewriting imported
SVG into the plan's root would also allow IDs in `defs`, masks and clip paths to collide.

## Decision

An asset may have kind `component`. It requires physical `w:` and `d:` dimensions and a relative
`plan-svg:` reference. Classification such as `category:` is carried and never selects behaviour
or appearance.

A named `area` is the only component placement frame. `asset:` names the component definition.
`align-x:` and `align-y:` take `min`, `center` or `max`; `offset-x:` and `offset-y:` are applied in
model axes; `rotate:` is counter-clockwise from +X. The defaults are centred alignment, zero
offset and zero rotation. koyu does not resize or rotate a component to make it fit its host; the
renderer only scales the SVG uniformly from its `viewBox` to the declared physical dimensions.

The rotated footprint must stay inside the host area. A component definition or placement that
cannot be resolved is CMP01. A footprint outside the host is CMP02. The feature is gated to muro
1.5 by VER09.

`FormComponent` carries the resolved physical footprint and source identities, but no SVG path or
bytes. SVG files are read only by the drawing entry. The drawing validates the SVG and embeds it
as an isolated image. Canonical JSON keeps the reference string, not the file content.

The first library is shipped as original plan SVG files and a `.muro` asset layer. A consumer may
replace an SVG without changing the component footprint or canonical building data.

## Consequences

- Moving or resizing a host area moves its component without a second position to update.
- Model rotation does not change placement vocabulary.
- The same component definition can be placed in many spaces with independent X/Y constraints.
- A missing or unsafe SVG stops drawing, not structural analysis.
- Plan artwork cannot be inferred as section or elevation artwork. Those need a later vertical
  contract rather than reuse of the plan SVG.
