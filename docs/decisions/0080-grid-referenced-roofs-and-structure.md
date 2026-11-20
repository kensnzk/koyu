# Grid-referenced roofs and structural members

Muro 1.7 adds explicit roof and canopy surfaces, continuous grid-relative column centres with storey-specific sections, horizontal beams and foundations. Each declaration states the editable defining dimensions. Form supplies the resolved geometry to plans, vertical cuts, elevations, scenes and physical takeoffs. A roof outline remains meaningful before its height has been chosen. Sketch geometry keeps the assumptions used to construct its faces in the derived record. An explicit section or a surveyed panel then replaces the corresponding approximation.

Use optional records in canonical format 2.0. Existing sources use their declared edition; omitting a version keeps the frozen 1.1 reading. Producers that write the new declarations must declare 1.7 and use a processor that supports that edition. A consumer pinned to an earlier processor can continue reading and writing the editions it supports.

The geometric scope is per-member. Member intersections do not change room allocations, and their volumes are reported without connection deductions. The geometry places the materials specified by the source; it does not size structures or select a jurisdiction's area treatment.
