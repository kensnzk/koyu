# Muro 1.6: spatial mode in the composed model

## Decision

Promote the local spatial prototype into the ordinary language and processor. `mode spatial`
is a single entry-only declaration in muro 1.6. It applies after composition and is retained in
Model, canonical JSON, Form and assessment reports. Omitting it preserves the building reading.
The experimental adapter and `.spatial` route are removed. Package metadata advances to 0.29.0;
this change prepares local code and does not publish a release.

## Reason

Space allocation needs a consistent state before boundaries are decided. The building reading
turns omitted faces into walls and requires height to derive enclosure; those choices cause an
early allocation to claim physical facts its author has not decided. Making the reading explicit
in the saved model avoids an out-of-band parser flag that disappears on reload or composition.

## Contract

Spatial mode does not derive default boundaries. Unresolved planar faces belong to Form, separate
from declared boundaries and the passage graph. Existing boundary declarations and cuts work,
and resolve only their covered faces. Missing height and slab thickness are permitted; invalid
written data and geometry still fail. No roofs are inferred in spatial mode. Explicit physical
data continues to derive the elements it defines. IDs and composition retain their meanings.

Canonical JSON advances from 2.0 to 2.1 for the optional `mode` key, immediately after `muro`.
This changes every canonical document's format line, including old-language inputs; no existing
key is renamed or reordered. Conformance source versions remain pinned, and old Form expectations
remain unchanged. Existing example sources advance to 1.6; their Form hashes must stay unchanged.
The IFC reader accepts building documents in 2.1 and rejects spatial documents before creating IFC.

Assessment stays incomplete with indeterminate rules and unavailable analyses. No provider or
rule runs in spatial mode. This conservative policy also applies to third-party registries,
including rules with no analysis dependencies. Direct passage and daylight queries reject the
mode instead of returning a negative result that would imply physical certainty.

## Migration and consequences

Existing files require no migration. An author opts in with both `muro 1.6` and `mode spatial`.
An imported layer cannot change the mode. An older version with the mode fails VER10. To resume
building derivation, remove the mode and rerun structural and architectural checks; preserving
space IDs does not make those checks optional.

The local prototype's historical decision remains unchanged. Downstream Product/V3 integration,
vendored readers, deployment and publication are outside this repository change. They must carry
the mode through persistence and rendering before consuming spatial canonical documents.
