# Grid-referenced roofs and structural members

Muro 1.7 adds explicit roof and canopy surfaces, continuous grid-relative column centres with storey-specific sections, horizontal beams and foundations. Each declaration states the editable defining dimensions. Form supplies the resolved geometry to plans, vertical cuts, elevations, scenes and physical takeoffs. A roof outline remains meaningful before its height has been chosen. Sketch geometry keeps the assumptions used to construct its faces in the derived record. An explicit section or a surveyed panel then replaces the corresponding approximation.

Use optional records in canonical format 2.0. Existing sources use their declared edition; omitting a version keeps the frozen 1.1 reading. Producers that write the new declarations must declare 1.7 and use a processor that supports that edition. A consumer pinned to an earlier processor can continue reading and writing the editions it supports.

The geometric scope is per-member. Member intersections do not change room allocations, and their volumes are reported without connection deductions. The geometry places the materials specified by the source; it does not size structures or select a jurisdiction's area treatment.

## Reading the 0.31.0 changes

| Design task | Source of the contract |
|---|---|
| Trace a roof or canopy, enter surveyed faces, or generate a roof from its type and dimensions | [Roof outlines, surveyed panels and sketch assumptions](../reference/muro/roof.md) |
| Keep a column centre fixed across storeys and change its section on selected levels | [Explicit continuous column centre](../reference/muro/column.md#explicit-continuous-centre) |
| Place a horizontal beam, pad footing, strip footing or mat by its dimensions | [Beam and foundation declarations](../reference/muro/members.md) |
| Read the same geometry in a plan, section, elevation or 3D scene | [Plan cuts](../reference/form/plan.md), [vertical projections](../reference/form/section.md) and [scene bodies](../reference/form/scene.md) |
| Compare storey areas, roof projections and surfaces, or beam and foundation quantities | [Area and member quantities](../reference/form/index.md#area-and-member-quantities) and [CLI geometry output](../reference/cli/stats.md) |
| Exchange authored parameters between processors | [Muro editions](../reference/muro/version.md), [canonical format](../reference/json/schema.md) and [processor stability](../reference/stability.md) |

The existing [floor slab](../reference/muro/slab.md) is generated down from its [level](../reference/muro/level.md) under the eligible space outlines. A pit bottom slab can use that declaration. A separately measured footing uses `foundation`, and a measured ground beam uses `beam`. Thickness on the level does not supply the pit's vertical enclosure.
