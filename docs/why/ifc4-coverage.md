---
title: IFC4 coverage
mode: explanation
---

# IFC4 coverage

A table that uses the IFC4 schema as a mirror to lay out **what koyu can write, what it cannot yet, and what it deliberately will not**. It is for reference, not a contract — the contract is held by [Scope](../reference/scope.md) and [What koyu does not hold](../reference/not-held.md).

If the terminology is unfamiliar, read [BIM, IFC and USD basics](bim-ifc-usd.md) first.

| Symbol | Meaning |
|---|---|
| **●** | covered — writable, or derived |
| **◐** | partial — writable but shallowly interpreted |
| **○** | not yet — planned |
| **—** | deliberately out of scope (reason given) |

## The shape of the schema

Of the roughly 1,140 entities in the IFC schema (2x3, 4 and 4x3 combined), about 250 are geometry and shape representation, 45 structural analysis, 150 building services, 50 infrastructure, and 60 are the `IfcRel*` relationships.

**The geometry layer — the bulk of IFC's mass — is evicted from the source wholesale by the rule that form is generated.** That is the skeleton of why koyu is small. What remains, the architectural core (spatial structure, building elements, attributes, quantities), is the battleground of this table.

## A. Spatial structure

| IFC | State | In koyu |
|---|---|---|
| `IfcProject` / `IfcBuilding` / `IfcBuildingStorey` | ● | the `name` declaration, the path hierarchy, [`level`](../reference/muro/level.md) (z / h / slab, level spans). The section stack-up is `koyu levels` |
| `IfcSpace` | ● | [`space`](../reference/muro/space.md) — **promoting this from secondary to primary is the whole subject** |
| `IfcSpatialZone` / `IfcZone` | ● | [`zone`](../reference/muro/zone.md) (counted aggregation). Groupings across storeys use the `level:` attribute |
| `IfcSite` | ◐ | `zone … site:1` plus exterior spaces at grade plus [`polygon`](../reference/muro/polygon.md) (given geometry). Frontage, coverage ratio and floor area ratio are derived by `koyu site`. Remaining: geodetic coordinates and true north, the finer rules of footprint measurement |
| `IfcExternalSpatialElement` | ● | `/out` may be split into several `exterior` spaces by orientation or character (roads carry a width in `road:`). Granularity is free; a monolith works too |
| `IfcRelAggregates` | ● | the path hierarchy itself ([Paths and area aggregation](paths.md)) |

## B. Space boundaries

| IFC | State | In koyu |
|---|---|---|
| `IfcRelSpaceBoundary` (PHYSICAL / VIRTUAL) | ● | the `kind` of a [`boundary`](../reference/muro/boundary.md), `wall` or `open`. **What IFC treats as an incidental relation is here a first-class graph edge** |
| the same (INTERNAL / EXTERNAL) | ● | derived, not declared (is the other end `exterior`). Semi-outdoor is likewise derived from `open` / `air:1` |
| 2nd-level boundaries (thermal granularity) | — | energy-calculation granularity is out of scope. If it is ever needed, derive it on the generated side |

## C. Building elements

| IFC | State | In koyu |
|---|---|---|
| `IfcWall` / `IfcWallStandardCase` | ● | a wall is attributes on a boundary (`t` / `spec` / `fire` / `sound`). **There is no operation that places a wall** |
| `IfcRailing` | ● | a free word in `spec` plus `air:1`. Object names do not go into `kind` |
| `IfcSlab` (floor) | ● | not written — the `slab` of a `level` is the default. Its absence is a `void` boundary |
| `IfcSlab.ROOF` / `IfcRoof` | ◐ | **flat roofs are derived** — laid over whatever has no space above it, at the upper level's `slab` thickness or the default. Voids get roofs too. Remaining: pitched roofs, eaves, parapets |
| `IfcDoor` / `IfcWindow` | ● | [`door`](../reference/muro/door.md) / [`window`](../reference/muro/window.md) (`w` / `h` / `at` / `edge`), hand and swing (`hinge` / `swing`), explicit position `at:X2+450` (overruns and overlaps are checked). Door and window types are [`asset`](../reference/muro/asset.md); operation is `style:hinged/sliding/auto`. The sill height `sill` is carried, not interpreted. Remaining: folding leaves, fire-rated sets (`fire` is carried and not interpreted), frames and junctions |
| `IfcOpeningElement` / `IfcRelVoids` / `IfcRelFills` | ● | an opening is an indented line under a boundary. **There is no boolean** — a wall is a run of intervals divided by openings from the start ([How plans are generated](plan-is-not-a-section.md)) |
| `IfcStair` / `IfcStairFlight` / `IfcRamp` | ● | attributes on a space (`stair:N` / `ramp:N` / `escalator:N` / `lift:1`) plus a vertical boundary. **Riser count, rise, tread, landings and slope are all derived** from the region, the storey height and the direction of ascent alone. Crampedness and slope are judged by `koyu.schematic.stair.proportion` / `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` ([vertical circulation](../reference/muro/vertical-circulation.md)) |
| `IfcColumn` | ● | [`column`](../reference/muro/column.md) — **an element whose position is never written.** It appears where a grid crossing meets a floor. It does not stand on semi-outdoor space that supports only sky (a roof terrace with nothing above it). Overlap with a door is judged by `koyu.schematic.column.blocksdoor` |
| `IfcBeam` / `IfcMember` | — | structure is a separate layer of things. A beam has no seat in a space-primary model |
| `IfcCurtainWall` | ◐ | writable as a free word in `spec` (uninterpreted). A large opening can also be written as a `window` |
| `IfcCovering` (finishes) | ◐ | floors via the `floor` attribute plus [`area`](../reference/muro/area.md) (uncounted subdivision). Ceilings only as far as `ceiling:0`, "do not build one". Dropped-ceiling maps and finish schedules are absent |
| `IfcBuildingElementProxy` | ◐ | carried by the open vocabulary (type / `spec`) |

## D. Balconies — an extension of the floor?

IFC4 has no dedicated balcony entity (practice combines `IfcSlab` + `IfcRailing` + an exterior `IfcSpace`).

**koyu's answer: a balcony is not an extension of the floor but a space.** Since floors are not written in the source at all, "is it an extension of the floor" is a question in the language of things. Write it as a space; semi-outdoor is derived; the floor is generated. Railing and upstand heights live in the boundary's `h` (`spec:手すり air:1 h:1100`).

What remains is **the composite vertical profile** — a section like "1200 mm RC upstand with a coping-mounted handrail" cannot be written. A vocabulary unifying the window's `sill` / `h`, spandrels and upstands is needed.

## E. Attributes, classification, materials, quantities

| IFC | State | In koyu |
|---|---|---|
| `IfcPropertySet` / `IfcProperty` | ● | open `key:value` plus [the attribute ledger](../reference/muro/attributes.md). A key not in the ledger needs a namespace ([Extending attributes](open-vocabulary.md)) |
| `IfcTypeObject` / `IfcRelDefinesByType` | ◐ | [`asset`](../reference/muro/asset.md) holds door and window types. Other types (wall types and so on) stay free words in `spec` |
| `IfcElementQuantity` | ◐ | **quantities are derived, never declared** (`koyu stats`, `koyu light`). Fixed to wall centerlines; conventions for internal-face, volumetric and compartment areas are absent |
| `IfcClassification` | ○ | a bridge from the ledger to outside dictionaries (bSDD, Uniclass, room-use codes). Not started |
| `IfcMaterial` / `IfcMaterialLayerSet` | ◐ | `spec` is a name only. Layer build-ups are detailed-design information and a candidate for a later composition layer |
| `IfcGrid` | ● | [`grid`](../reference/muro/grid.md) (grid lines plus offsets) |
| `IfcOwnerHistory` | ● | **absent — git is the history** |

## F. Beyond the site, and the city

| IFC | State | In koyu |
|---|---|---|
| `IfcGeographicElement` (landscape) | ○ | approaches, parking, planting, paving. Subdivision of exterior space plus a landscape vocabulary |
| `IfcMapConversion` / `IfcProjectedCRS` | ○ | true north and geodetic coordinates. A prerequisite for daylight and shadow orientation and for city-data connections |
| IFC4x3 infrastructure (roads, rail, bridges, tunnels — about 50) | — | out of scope (this is about buildings) |

## G. Deliberately out of scope

| IFC area | Reason |
|---|---|
| geometry and shape representation (~250) | **form is generated.** Not holding form in the source *is* the subject |
| structural analysis (`IfcStructural*`, ~45) | structure is a separate layer of things |
| building services (~150) | out of scope. Risers, lifts and plant rooms are already writable as spaces |
| process and cost (`IfcTask`, `IfcCostItem`, …) | outside this enquiry |
| asset management and sensors (`IfcAsset`, `IfcSensor`, …) | dynamic state does not enter the source. The path becomes the foreign key |
| style and presentation (`IfcStyledItem`, …) | drawing is the tool's job. The source is composition |

## The idea behind the mapping

An IFC "entity" lands in one of three places in koyu.

1. **A few words read structurally** — `kind`, and the interpreted attributes in the ledger
2. **Values in an open vocabulary** — types and `spec`. `IfcRailing` and `IfcCurtainWall` both land here
3. **Generated products** — quantities, geometry, the inside/outside distinction, riser counts, columns, roofs

**Widening coverage without adding entities is the bet of this design, and this table is the arithmetic check on it.**

And **coverage percentage is not a value.** Add and you fall out of the machine's field of view, and the goal breaks ([Level of detail](resolution.md)). The ○ rows are not "holes to be filled some day" but **candidates to be judged by the five questions** ([Extending attributes](open-vocabulary.md)).

## Next

- [Comparison with IFC and USD](vs-ifc.md) — comparison with measured token counts
- [Level of detail](resolution.md)
- [What koyu does not hold](../reference/not-held.md)
