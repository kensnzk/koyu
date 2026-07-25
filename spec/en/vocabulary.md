**English** · [日本語](../vocabulary.md)

# The vocabulary ledger

This document puts the essay's position — "meaning is given by a vocabulary, not by a vast class hierarchy" — into practice. It is the contract for what may be attached to each element and which words the tools interpret, and it is the rule for *how* an open vocabulary is opened (ADR-0007 / ADR-0008).

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).

## Five rules

**1. A kind states only the topology of a relation.** A boundary's type (wall/open/stair/shaft/void) is a word that the graph, the derivations, and the checks interpret structurally, and adding to that set is the last resort. This is the same stance IFC takes in letting a space boundary (IfcRelSpaceBoundary) say only Physical or Virtual.

**2. The name of a thing belongs to the `spec` vocabulary.** Railing, RC, LGS, EW, glass partition… the value of `spec` is a free word, and tools do not interpret it (they only carry it). What IFC would make an element class (IfcRailing, IfcCurtainWall) is a value of `spec` here — the consequence of the turn by which a thing is an attribute of a relation.

**3. An interpreted attribute goes in the ledger.** The attributes a tool reads (marked ★ below) are a contract; changing one means writing an ADR. Any other `k:v` is free, but so that one meaning does not acquire two words, a word whose meaning has settled is added to this ledger and grown there. There is one ledger.

**4. Units and formats.** Lengths are in mm, a position along a segment is 0..1, and areas are reported in m². Attribute keys are lowercase Latin letters; values are free (Japanese is fine), while the values of core words are Latin.

**5. Inheritance and overriding.** `use` is inherited from zone to space, and a declaration on the space wins. `floor` is overridden over an interval by space→area. `spec` is overridden over an interval by boundary→seg. An uncounted subdivision (area/seg) carries only overrides and does not affect the composition (ADR-0003).

## The ledger, by element

### space
| Attribute | Interpreted | Meaning |
|---|---|---|
| type | ★ in part | An open vocabulary. Interpreted structurally: `exterior` (outside — may split into several: /out/road etc.) and `void` (a void through the floor). Subjects of the daylight check: `unit` `room` `ldk` `bedroom` `living` |
| road | ★ | The width in mm of an exterior space — the mark of a road. The site command derives road frontage from it (ADR-0009) |
| region | ★ | `X?..X? Y?..Y?`, joined with `+` (for an L shape). Offsets such as `X2+600` are allowed |
| level: | ★ | States the level explicitly. The default is the first path segment. Used for a grouping that spans levels (a maisonette) |
| h | ★ | Ceiling height in mm (default: the level's h). The height invariant and `levels` read it |
| use | ★ | An aggregation axis for stats (rentable/exclusive/common…). Inherited from the zone |
| hab | ★ | Controls the subjects of the daylight check (1 to add, 0 to exclude) |
| uid | ★ | An optional persistent identity token (ADR-0015). Opaque, unique across the whole model (spanning space and zone), and never derived from the path. Digits alone, or whitespace, is an error. It exists for external joins across renames (sensors, registers) — references inside the repository stay on paths |
| w | ★ (band members only) | The dimension along the band's direction, in mm. `w:rest` marks the member that absorbs the remainder (at most one per band). It may not be written on a `space` outside a band |
| name / floor / … | — | Free. `floor` may be overridden by an `area` |

### boundary
| Attribute | Interpreted | Meaning |
|---|---|---|
| type | ★ | wall / open (horizontal); stair / shaft / void (vertical). The default is wall |
| t | ★ | Wall thickness in mm (split about the centerline). Used in drawing; defaults to 100 there |
| air | ★ | 1 = a thing that does not shield (a railing, a fence). It affects the derivation of semi-outdoor, thin-line drawing, and the 0.7 daylight coefficient |
| edge | ★ | Restricts the segment to a particular side of the a-side rectangle (N/E/S/W) |
| spec / fire / sound / h / … | — | Free (`spec` is the name of the thing; `fire`/`sound` are earmarked for interpretation by the M2 compartment query) |

### opening (indented under boundary)
| Attribute | Interpreted | Meaning |
|---|---|---|
| kind | ★ | door (passage) / window (daylight; no passage) |
| (leading token) | ★ | A reference to an opening asset (`door SD1 …` — a Reference). The asset's attributes become defaults and the instance overrides them (ADR-0010) |
| w / h | ★ | Width and height in mm. A window's h is read by the daylight check |
| at | ★ | Position. A ratio 0..1 (default 0.5, clamped within the segment) or a grid reference `at:X2+450` (absolute — not clamped; overrunning, the wrong axis, or overlapping another opening is an error) |
| edge | ★ | Selects the side when there are several segments |
| hinge | ★ | Swing: the hinge side (W/E on a horizontal segment, N/S on a vertical one; the default is the starting end) |
| swing | ★ | Swing: the side it opens toward (a/b; the default is a, the side that has a region) |
| style | ★ | The type of the door: hinged (the default) / sliding / auto. It changes how the door is drawn in plan |
| sill / name / … | — | Free |

### band (ADR-0019)
`band <axis> <X?..X?> <Y?..Y?>` plus indented `space` lines. It is the notation that writes dimension and order rather than position — the horizontal counterpart of the vertical section stack-up.

| Positional | Interpreted | Meaning |
|---|---|---|
| axis | ★ | The direction of division: `X` (west to east) / `Y` (south to north). The first positional |
| region | ★ | Two tokens, `X?..X? Y?..Y?`. Must be ascending (because the order of members carries meaning). A `+` union is not allowed |

No `key:value` may be written — a band does not survive into the model, so there is nowhere for an attribute to live (attributes go on the member `space` lines). A band is expanded into ordinary spaces at parse time and does not survive in the canonical JSON either.

### asset (an opening asset — ADR-0010)
`asset <name> door|window <attributes…>` — a bundle of defaults to be referenced (Revit's Family, USD's Reference). It is not a fourth element; it only puts the source of an opening's attributes in one place. The kind must match the opening that references it. A duplicate name is an error, including across composition.

### polygon (the site shape — ADR-0011)
`polygon /<zone path> x,y x,y x,y ...` — given geometry, from a survey. It is the one written shape in this notation, and it corresponds to a `site:1` zone (its absence is a warning). Tools interpret (★) the derived area (by the shoelace formula), the containment check for the building, and the site boundary line on the site plan. The standard practice is a quarantined layer of its own, brought in by import.

### import (composition — ADR-0010)
`import ./L1.muro` — a path relative to the file it is written in. The base layer declares the foundation (koyu/name/unit/grid/level) once, and layers add spaces, boundaries, zones, and assets. A collision (a duplicate space path or asset name, a re-declared grid or name) is a build error with provenance. Importing the same file twice is idempotent.

### level
`z` (positional), `h` (the base ceiling height), `slab` (slab thickness), `pitch` (range declarations only) — all ★.

### zone
`name` (free), `use` (★, the source of inheritance), `site` (★ 1 = the site aggregation — the subject of the site command), `area` (★ the declared site area in m² — reconciled against the derived area), `uid` (★ a persistent identity token — the same uniqueness rule as space). A zone has no geometry.

### area / seg (uncounted subdivisions)
A position (a region for `area`; at/w/edge for `seg` — ★; a seg's `at` may also be a grid reference) plus optional overriding attributes (—).

## Correspondence with IFC (informative)

boundary wall/open ↔ IfcRelSpaceBoundary's PHYSICAL/VIRTUAL. The inside/outside distinction ↔ InternalOrExternalBoundary (here it is derived rather than declared). spec:railing ↔ IfcRailing (the element class becomes a value in the vocabulary). opening ↔ IfcOpeningElement + IfcDoor/IfcWindow. asset ↔ IfcDoorType/IfcWindowType (type and occurrence — Revit's Family), and style ↔ a coarse projection of IfcDoorTypeOperationEnum (SINGLE_SWING/SLIDING…). zone ↔ IfcZone. The vertical boundaries stair/shaft/void, and the default slab, have no direct counterpart in IFC because space is primary here. Composition by import has no counterpart in IFC4 (a single file is the rule) and corresponds instead to layer composition in IFCX/USD.
