---
title: koyu against IFC4, IFCX, BOT and USD
mode: explanation
---

# koyu against IFC4, IFCX, BOT and USD

A model with spaces as nodes and boundaries as relations is not new. W3C BOT's `bot:Space` and `bot:Interface`, IndoorGML's cellular space and its dual graph, IFC's `IfcSpace` and `IfcRelSpaceBoundary` all have a similar shape. The composition mechanism belongs to USD.

**The closeness is not a weakness to hide but the design intent.** It is because the shapes are close that projections onto them are trivial. The novelty is not in any single element but in **holding them all at once**.

If the terminology is unfamiliar, read [Background: BIM, IFC, IfcSpace, USD](bim-ifc-usd.md) first.

## Where each one stands

| | Existing formats | koyu |
|---|---|---|
| **Standing** | projections and exchange formats derived from component models or CAD | **a source written directly by humans and machines.** It has nothing upstream |
| **Size** | a whole building does not fit in a machine's field of view | **a whole building fits** |
| **Composition** | formats with architectural semantics have no composition; formats with composition have no architectural semantics | **it has both** |
| **Identity** | identifiers within a file; guarantees across time live outside the format | **immutable identity is first class** |

## The same two rooms in three worlds

The same scene — two rooms of 3.6 m × 4.5 m, a door in the party wall, an entrance door, sill windows — written also in IFC4 (SPF) and IFCX (IFC5 alpha). All three are bundled.

Tokens were measured with o200k_base. **Measuring in the unit an LLM reads and writes is the point of this table.**

| Format | Bytes | Lines | Tokens | vs DSL |
|---|---:|---:|---:|---:|
| koyu DSL (source, with comments) | 916 | 26 | **359** | 1.0x |
| koyu DSL (body, comments removed) | 496 | 16 | 220 | 0.6x |
| koyu canonical JSON (machine format) | 2,164 | 140 | 729 | 2.0x |
| IFC4 (idealised minimum, hand-written) | 7,291 | 152 | **3,379** | **9.4x** |
| IFCX (IFC5 alpha) | 20,111 | 1,030 | **6,034** | **16.8x** |

**The 152 lines of IFC4 are a thoroughly cheated idealised minimum.** Property sets, materials, styles, owner history and junction handling are all dropped, the geometry is rectangular extrusions only, and names are ASCII only. It still comes to this much because five walls, two openings and two doors are each placed as things, and each one has to climb the ladder of **profile → extrusion → shape representation → placement**. Two `IfcSpace` entities are present and eight `IfcRelSpaceBoundary` relations were strung by hand, but the connection geometry of those boundaries was omitted — which is exactly the thing most often missing from real exports.

**Most of IFCX's 1,030 lines are mesh coordinates.** The format has become JSON and has gained a powerful layering mechanism, but **the structure in which the source of a scene bloats by carrying its own build output is unchanged.** The subject is still `IfcWall`.

**In both cases the majority of the tokens go to the layer that "form is generated" evicts from the source.**

For reference, hello-wall in buildingSMART's IFC5 development repository — one wall and two windows — is 79 KB as `.ifc` and 43 KB as `.ifcx` (realistic output through an authoring tool). A production model runs to tens of megabytes.

### Can it answer the question?

To answer "how many doors from a to the outside" in IFC you walk `IfcSpace` → `IfcRelSpaceBoundary` → `IfcWall` → `IfcRelVoidsElement` → `IfcOpeningElement` → `IfcRelFillsElement` → `IfcDoor`, five or more hops, and **then still infer from geometry which two spaces that door connects, because the data does not say.**

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

**Because composition is the source, graph queries, diffs and generation come for free.** In exchange, form can only be produced as far as the orthogonal-grid generation rules reach. **This is not a symmetric trade-off** — the bet is that design decisions are made on the composition side, and that form is a consequence of the decisions.

## Measuring an order of magnitude up

The bundled showcases, on the same yardstick.

| | tower | complex | twin |
|---|---:|---:|---:|
| Indoor floor area | 4,785.92 m² | 31,606.24 m² | 141,448.56 m² |
| Spaces | 178 | 425 | 1,808 |
| Boundaries | 543 | 1,364 | 5,973 |
| Source lines | 453 | 646 | 1,220 |
| Source bytes | 21,227 | 33,284 | 64,961 |
| **Source tokens (o200k)** | **8,574** | **12,685** | **26,630** |
| Canonical JSON tokens | 74,704 | 137,913 | — |

**Floor area goes up 6.6×; the source goes up 1.48×.**

The reason lies in architecture itself. A mixed-use complex is **made of repetition**, and level spans (`/B2..L19/`) and bands (`band`) fold repetition away wholesale. In `complex`, the core (two stairs, two lift banks, WCs, risers, pantries) covers 21 levels from B2 to L19 in **9 `space` lines**; the hotel's 84 spaces come from **13 band members**; the podium's 92 spaces from **16 band members**; and the 21 spaces of seven office storeys from **3 lines**.

> **The size of a source is proportional not to the size of the building but to the number of design decisions.**

That is not a property of the notation. **A large building is large not because there are many different things but because there are many of the same thing.**

Apply the ratios above and something the size of `complex` would be about 120,000 tokens as IFC4 and about 210,000 as IFCX. **And those ratios are against a thoroughly cheated idealised minimum IFC.** The IFC a production authoring tool exports at this scale (tens of megabytes) fits in no context at all.

## BOT — the shape is close, so the projection is trivial

The W3C Building Topology Ontology has the same shape as koyu: `bot:Space`, `bot:adjacentZone`, and **`bot:Interface` — the interface between two zones**.

**koyu's `boundary` can fairly be described as an authorable surface notation for `bot:Interface`.** Spaces map to `bot:Space`, the vertical hierarchy to `bot:Storey`, boundaries to `bot:Interface`, adjacency to `bot:adjacentZone` — a one-way projection out of canonical JSON.

**This is not about migrating but about being explained.** Letting an established W3C vocabulary describe you *is* your ontological position.

## USD — borrow the mechanism only

From OpenUSD, **the mechanism only** is borrowed.

| Borrowed | Not borrowed |
|---|---|
| non-destructive layering on a path-namespace backbone | identity keyed on UUIDs (koyu uses human-readable paths) |
| namespaced vocabulary | shipping meshes inside the source (form is generated) |
| the idea of referencing external layers | variants (branching options belong to git branches) |

And **USD has no architectural semantics.** Space, boundary, use and storey cannot be supplied from the USD side.

> **Formats with architectural semantics have no composition; formats with composition have no architectural semantics.**

koyu's claim is that **you can have both** ([Composition is for time, not for size](composition-is-for-time.md)).

## The interoperability policy — build an exit, not a round trip

**Built** — a stable versioned machine format, identity as a key for external references, graph output, read-only projections.

**Not built** — round-trip fidelity, complete import of external formats, coverage claims, or the pursuit of size comparisons against other formats. **What is needed is the absolute fact that a whole building fits, not a comparison.**

**Kept outside** — import from existing assets is a one-way conversion living outside the core.

**IFC grew as it did because it was required to give back whatever any tool emitted, losing nothing.** The policy here is to decline that requirement.

## Reproducing this

The comparison files are bundled.

```sh
npx tsx examples/comparison/gen-ifc4.ts > examples/comparison/two-rooms.ifc
npx tsx examples/comparison/gen-ifcx.ts > examples/comparison/two-rooms.ifcx
npx tsx examples/comparison/validate-ifc.ts examples/comparison/two-rooms.ifc
```

UUIDs and GUIDs are derived deterministically from names, so regenerating produces no diff.

## Next

- [IFC4 entity coverage](ifc4-coverage.md) — what can be written, and what is deliberately not
- [The resolution of this data](resolution.md)
- [Why the authored format is a DSL](dsl-not-yaml.md)
- [Canonical JSON](../reference/json/index.md)
