---
title: mode — spatial models
mode: reference
---

# mode — spatial models

```muro
muro 1.6
mode spatial
grid X 0 4000 8000
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:space-a
space /L1/b room X2..X3 Y1..Y2 uid:space-b
```

`mode spatial` makes space allocation a complete structural model before walls and openings
are decided. It requires muro 1.6. An omitted mode retains the building reading, including
its default walls. `mode building` is not a declaration; remove `mode spatial` to select that reading.

## Declaration and composition

Exactly two tokens, once in the entry file. Imported layers cannot declare or override the
mode. The declaration applies to the entire composed model, regardless of where it appears
in the entry. The version is checked after composition, so putting the version line later
does not change the result. An older or undeclared language version is rejected with
[VER10](../diagnostics/ver.md#ver10).

Space paths, `uid`, grids, levels, regions, bands, stacks, imports and edits keep their usual
meaning. Switching the mode does not rename or replace any space.

## Unwritten boundaries

No default interior or exterior walls are derived. A shared face with no declared boundary is
**unresolved**, not open and not blocked. The uncovered outer perimeter is unresolved too.
Explicit boundaries, openings and drawn `line` cuts retain their usual meaning. An `edge:`
declaration resolves only that edge; other shared faces remain unresolved.

`Model.boundaries` contains the declared boundaries. `Form.mode` is `"spatial"` and
`Form.unresolved` lists the unresolved planar faces as `{ a, b, level, segment }`. An unnamed
outer face uses the reserved exterior reference `outside` as `b`. These entries are not
passability edges or physical elements. Overlap between levels does not create a connection.

The ordinary [plan command](../cli/plan.md) draws unresolved faces with a dashed line and labels
the drawing as a spatial plan. Declared boundaries use the ordinary drawing rules. The drawing
reads the face coordinates from Form; it does not decide where walls exist.

Use `plan` to inspect allocation. Axonometric and section drawings still depict physical
elements; they do not invent space volumes from missing heights. A model with no physical
elements has nothing for the axonometric renderer to draw.

## Heights, floors and consistency

A space with a region still needs a determinable level. Missing ceiling height (`SUF01`) and
missing floor thickness (`SUF03`) do not produce diagnostics in spatial mode. Overlaps, duplicate
identities, invalid references, and contradictions in written values are still checked.

No missing height or floor thickness is invented. Explicit `h:` and `slab:` still derive
ceilings and floors under their ordinary rules; boundaries with enough vertical information
can produce material. Spatial mode does not infer roofs. On the top level, a known height
ends at that height, without an inferred roof thickness. Space areas describe allocation;
they do not establish enclosed or legally countable floor area.

## Questions and assessment

`check`, `json`, `stats`, `layers`, `diff` and `plan` remain available. `graph` describes only
written relations and labels its output accordingly. The API `neighbors` likewise reports
only declared relations; an absent neighbor is not proof that passage is blocked.

`doorsBetween` and `daylightInputs` reject a spatial model with a not-evaluated error; their CLI
and MCP callers report that error rather than reporting unreachable or zero daylight.
Architectural assessment returns an **incomplete** report, with rules **indeterminate** and
analysis artifacts **unavailable**, using the issue kind `koyu.spatial-model`. No analysis
provider or rule evaluator is executed, including third-party ones. The same applies to
`runAnalysis`; there is no opt-in to architectural assessment while this mode remains set.

Canonical JSON carries `"mode": "spatial"` immediately after `muro` in format
`koyu-canonical/2.1`. Consumers must preserve this field and must not apply building defaults.
The bundled IFC exporter rejects spatial models explicitly. Other exporters and viewers must
implement this mode before accepting it.

## Continue as a building

Add the boundaries and openings you know, retaining the same paths and uids. When ready for
the building reading, remove `mode spatial`. At that point omitted boundaries become default
walls, and height and slab sufficiency checks apply. `diff` reports the mode change as well as
its boundary consequences. Run `check` and `validate` again; a previously consistent spatial
model is not evidence that the building passes either check.
