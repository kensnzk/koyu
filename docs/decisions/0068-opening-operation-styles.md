# ADR-0068: Opening operation styles are explicit

Date: 2026-08-24 / Status: adopted (muro 1.5, koyu 0.28.0) / Origin: the standard plan needed to distinguish sliding arrangements, leaf counts, automatic entrances, gates and window operations without an asset library

## Context

The original `style:` values were `hinged`, `sliding` and `auto`. They could not state whether a
door had two equal leaves, unequal leaves, two leaves retracting in opposite directions or two
overlapping leaves. A general entrance, a gate and a fixed or projecting window also had no value
of their own.

Those facts cannot be recovered from an opening's width, name, location or asset identifier. A
renderer that guessed would make the same model draw differently after a label edit. Requiring an
asset library for them would also leave ordinary asset-free models unable to state their operation.

## Decision

**1. Muro 1.5 expands the interpreted values of an opening's `style:`.**

The values are `hinged`, `hinged-double`, `hinged-unequal`, `sliding`, `sliding-double`,
`sliding-bypass`, `auto`, `auto-single`, `auto-double`, `entrance`, `gate-hinged`,
`gate-hinged-double`, `gate-sliding`, `fixed` and `projecting`.

The original three values retain their meanings. `sliding` is a single sliding leaf and `auto`
retains the automatic double-sliding default.

**2. The operation is source data, not an inference.**

The processor and its renderers never choose a style from `name:`, opening width, position or
asset name. An asset may supply `style:` in the same way it supplies width, and an instance may
override it. An opening without a style keeps the existing default.

**3. Form carries the operation needed by a plan.**

Sliding doors, automatic doors, entrances and sliding gates carry the direction already named by
`hinge:` and `swing:` without a swing arc. Hinged and sliding windows may carry the same directional
fact. The shape of the wall opening, its width, wall thickness and side remain derived in core.

**4. The built-in plan maps each explicit operation to asset-free marks.**

A double sliding opening has two leaves and two dashed storage guides. A bypass opening has two
overlapping leaves and no storage guide. Automatic openings add direction marks. Gates add posts.
Every window retains two unfilled wall-face lines and adds its operation marks over that frame.

An asset-specific SVG may later replace this presentation, but its absence never removes the
standard mark.

**5. Older version declarations cannot use the new values.**

VER08 reports a 1.5 style in a file declaring 1.4 or earlier. The three original values remain valid
at every version that already accepted them.

## Alternatives

**Use assets as the only discriminator.** Rejected because an asset reference is identity, not an
operation, and a model must remain legible without its presentation library.

**Infer the symbol from the opening's name.** Rejected because labels are open vocabulary and have
no stable spelling.

**Add separate declaration keywords for every fitting.** Rejected because all of these remain
openings in the model; only their interpreted operation differs.

## Consequences

The language version moves to muro 1.5 and the implementation to koyu 0.28.0. Canonical JSON may
carry the new `style:` values. Existing files using `hinged`, `sliding`, `auto` or no style retain
their meaning.

The plan mark vocabulary grows so consumers compiled exhaustively against `MarkRole` must handle
the new roles. This is allowed on the drawing surface and prevents a newly supported operation
from disappearing silently in a downstream renderer.
