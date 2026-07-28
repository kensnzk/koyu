---
title: Background — BIM, IFC, IfcSpace, USD
mode: explanation
---

# Background — BIM, IFC, IfcSpace, USD

Any statement of where koyu sits assumes the vocabulary of this field. **This page explains only that vocabulary.** Readers at home in building-information practice can skip to [koyu against IFC4, IFCX, BOT and USD](vs-ifc.md).

## BIM

**Building Information Modeling** — handling a building's three-dimensional geometry and its attribute information together.

In practice the centre of gravity is an authoring tool such as Revit or Archicad, and **the model itself lives inside each tool's proprietary database.**

That is the first divergence from koyu. As long as the source lives in a tool's proprietary database, what can be done with the model is bounded by **what that tool's UI and API permit.** A text source has no such bound.

## IFC

**Industry Foundation Classes** — the open exchange standard published by buildingSMART. The common language for passing models between BIM tools.

Its standard serialisation is **SPF** (STEP Physical File, extension `.ifc`), which looks like this.

```text
#42=IFCWALLSTANDARDCASE('1a2b3c...',#5,'Wall-001',$,$,#43,#51,$);
#43=IFCLOCALPLACEMENT(#12,#44);
```

**Entities cross-reference each other by line number.** That single fact governs version control — re-export the same model and the line numbers are reassigned, so **the diff of the whole file is destroyed.** Which file counts as current is then decided by human process, not by the data. A practice's CDE (common data environment) is, at bottom, a vessel for that process.

For a sense of scale: the IFC schema (2x3, 4 and 4x3 combined) holds about 1,140 entities. Of those roughly 250 are geometry and shape representation, 45 structural analysis, 150 building services, 50 infrastructure, and 60 are the `IfcRel*` relationship entities.

## IfcSpace

**The IFC entity for a room or region.** It exists in the schema.

On many projects, though, it is treated as **secondary information derived from what the components enclose**, and it is not unusual for it not to be exported at all. `IfcRelSpaceBoundary` exists for space boundaries, but the connection geometry of those boundaries is one of the most commonly omitted things in the format.

**koyu's whole subject is promoting this to a primary element.** That `IfcSpace` remains a second-class citizen is not a flaw in the standard but **a consequence of making form the source** ([Space is the primary element](space-is-primary.md)).

## IFC5 and IFCX

The next-generation standard under development is **IFC5**, and its file format is **IFCX**.

IFCX is plain JSON. A node is a small structure — `{ path, children?, inherits?, attributes? }` — where `children` builds the hierarchy as a name-to-UUID dictionary and `inherits` references a prototype (a window instance pointing at a window type), the equivalent of USD's reference. Attribute vocabularies are namespaced, in the form `bsi::ifc::prop::FireRating`.

And **it has composition.** Write several nodes at the same path and they overlay; the same mechanism works across files. That a difference layer can be written in a few hundred bytes is the whole value of that mechanism.

**The format problem is being solved on the standards side.** It has become text, its diffs have become readable, and its layers overlay.

**But what that format carries is still an ontology of the building as a thing.** The subject of the scene is still `IfcWall`, and most of the file is vertex coordinates — that is, build output shipped inside the source. **Renewing the format is not changing the subject.**

## OpenUSD

**Universal Scene Description** — a scene-description framework built originally for film production. At its core is a mechanism called **composition**.

Layers stack, and an upper layer overrides a lower layer's values **non-destructively**. A path namespace (`/World/Building/Room`) is the backbone.

**There is no equivalent concept in current IFC.** And USD has no architectural semantics of its own.

> **Formats with architectural semantics have no composition; formats with composition have no architectural semantics.**

koyu is aimed at that gap. But what it borrows from USD is **the mechanism only** — non-destructive layering on a path-namespace backbone, namespaced vocabulary, and the idea of referencing external layers. What it does not borrow: identity keyed on UUIDs (koyu uses human-readable paths), shipping meshes inside the source (form is generated), and the ontology of the building as a thing.

## Ontology

**A formal definition of what exists in a domain and how those things relate.**

koyu's subject is exactly that question — **what architecture counts as "a thing that exists".** IFC counts components. koyu counts spaces and the relations between them.

Several existing systems have a similar shape.

- **W3C BOT** (Building Topology Ontology) — has `bot:Space` and `bot:Interface` (the interface between two zones). koyu's boundary is, in effect, an authorable surface notation for `bot:Interface`
- **IndoorGML** — cellular space and its dual graph
- **CityGML / PLATEAU** — three-dimensional city models at urban scale

**The closeness is not a weakness to hide but the design intent.** It is precisely because the shapes are close that projections onto them are trivial.

## Architecture and the building

Japanese distinguishes 建築 (*architecture*) from 建築物 (*the building as a thing*).

**The building** is a category of the Building Standards Act — an object, a thing. IFC and CityGML are, as their names say (`IfcBuilding`), ontologies of that side.

**Architecture** — how space is divided, connected and ordered — is not in them. **That is the side that is empty.**

## Next

- [koyu against IFC4, IFCX, BOT and USD](vs-ifc.md) — comparison with measured token counts
- [IFC4 entity coverage](ifc4-coverage.md)
- [Space is the primary element](space-is-primary.md)
- [Composition is for time, not for size](composition-is-for-time.md)
