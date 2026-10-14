# ADR-0076 — Prototype spatial models with explicit unresolved boundaries

## Status

Experimental. No change to the accepted Muro language or the published npm API.

## Context

Space allocation can be inspected before wall construction, openings, ceiling heights and slab
thicknesses are decided. Ordinary Muro gives omitted boundaries a physical meaning: a wall.
Omitting a declaration therefore cannot express an undecided boundary in that reading.

## Decision

The repository experiment reads a `.spatial` entry beginning with `mode spatial`, followed by
ordinary Muro declarations and imports. The marker is required and is not accepted by the normal
Muro parser. The adapter replaces only that line with a blank before composition, preserving line
locations and source files. Imported layers continue to follow normal composition rules.

The experiment projects composed spaces into a tagged spatial report. It removes automatically
derived boundaries from the intermediate model, keeps written boundaries, and checks the remaining
declarations. Ceiling-height and slab-thickness sufficiency checks do not apply to this projection;
all other diagnostics remain. It returns plan area, level elevation, geometric adjacency and
overlap in plan across levels. A missing physical boundary yields `unresolved` and `unknown`
passage. A declared face resolves only the segments it reaches.

The report is a projection, not canonical Muro, a physical Form or a source serialization. Source
files remain the editable artifact. The diagram consumes the report and displays allocation
polygons, unresolved segments and declared relations. It does not draw physical wall thicknesses,
door swings or construction. Circulation, daylight and egress assessments remain not evaluated.

## Consequences

- The same space paths and UIDs survive adding boundary declarations.
- Unknown boundaries cannot be mistaken for either walls or open passages.
- Ordinary Muro, canonical JSON, Form and public CLI/API outputs retain their contracts.
- The experiment is run from a repository checkout and is not an npm package entrance.
- Drawn boundary lines are explicitly rejected until the spatial perimeter contract includes
  diagonal cuts. Physical validation and a supported language-level mode require later work.
- No language or package version is raised for this repository-only experiment. Promotion must
  decide the source syntax, composition, canonical representation and consumer contracts together.
