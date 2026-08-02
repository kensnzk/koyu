---
title: koyu measured against IFC
mode: explanation
---

# koyu measured against IFC

The same two rooms — two 3.6 m × 4.5 m rooms, one door in the party wall, one entrance door — written in `.muro`, in IFC4 (SPF) and in IFCX (IFC5 alpha), all under `examples/comparison/`. **This is not a contest between formats.** It measures, in lines, bytes and tokens, what happens when the subject of the description changes from "a building (a thing)" to "architecture (space)".

## What the measurements say

Measured in the units an LLM reads and writes (o200k_base).

| Format | Subject | Lines | Bytes | Tokens | vs `.muro` |
|---|---|---:|---:|---:|---:|
| `.muro` (the source) | space and boundary | 18 | 394 | **178** | 1.0x |
| koyu canonical JSON | same | 116 | 1,696 | 587 | 3.3x |
| IFC4 (idealised minimum) | building elements | 152 | 7,291 | **3,379** | **19.0x** |
| IFCX (alpha) | elements plus embedded mesh | 1,030 | 20,111 | **6,034** | **33.9x** |

The `.muro` row measures a file **trimmed to the same scene** as the IFC versions. The bundled `examples/two-rooms.muro` additionally carries two windows and `daylight:1`, which brings it to 26 lines / 916 bytes / 359 tokens; the IFC versions carry none of that. **It carries more and is still one ninth the size.**

### Where the tokens go

- **57% of IFC4** is geometry and placement entities. Profile → extrusion → shape representation → placement has to be climbed once per element, for five walls, two openings and two doors.
- **44% of IFCX** is lines containing nothing but a number. Those are the mesh coordinate arrays; measured in bytes they are over 70% (JSON structural keys cost more per token, so the token share is lower).

In other words, **in both formats the majority of the tokens go to the layer that "form is a generated artifact" removes from the source.**

## They can answer different questions

Asking IFC4 "how many doors does a pass from a to the outside go through" means walking Space → RelSpaceBoundary → Wall → RelVoids → Opening → RelFills → Door, five relations deep, and then inferring from geometry which two spaces the door actually connects, because that is not in the data.

In `.muro` it is one line.

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

**This is not a matter of one format being better; it follows from the change of subject.** IFC4 and IFCX have form as their source, so they can carry any shape, but composition — which space connects to which — has to be dug out of a web of relations or inferred from geometry. koyu has composition as its source, so graph questions, diffs and generated drawings come free, while **form can only be produced within reach of the orthogonal-grid generation rules**. The trade is not symmetric.

## What is inside the IFC4 version

The 152 lines of `examples/comparison/two-rooms.ifc` are a thoroughly cheated idealised minimum. Property sets, materials, styles, OwnerHistory and joint processing are all dropped; shapes are rectangular extrusions only; names are ASCII only. Two spaces are included as IfcSpace and eight IfcRelSpaceBoundary were drawn by hand, but the connection geometry of the boundaries was omitted — **that is precisely what most often goes missing in real exports**, and it is not unusual for IfcSpace itself never to be written out at all.

It has been verified as readable: IfcWall × 5, IfcSpace × 2, IfcDoor × 2, IfcOpeningElement × 2 and IfcRelSpaceBoundary × 8 come back out, and seven meshes assemble including the booleans.

For reference, the hello-wall of IFC5-development — one wall and two windows — is 79 KB as `.ifc` and 43 KB as `.ifcx` (realistic output through an authoring tool). A production model runs to tens of megabytes.

## What is inside the IFCX version

`examples/comparison/two-rooms.ifcx` was generated in the manner of hello-wall.ifcx: UUID paths, hierarchy through `children`, classification through `bsi::ifc::class`, and `usd::usdgeom::mesh` embedded. The format becomes JSON and gains a powerful layer-composition mechanism, but **the structure in which the source of a scene bloats by carrying a build artifact (the mesh) is unchanged**. The subject is still IfcWall. The opening booleans are omitted and the doors placed as boxes parented to the wall, so strict conformance to the alpha specification is not claimed.

## It still fits an order of magnitude up

The same measure on the larger examples.

| Example | Interior floor area | Spaces | Boundaries | Source tokens | Canonical JSON tokens |
|---|---:|---:|---:|---:|---:|
| [tower](tower.md) | 4,785.92 m² | 178 | 543 | **8,574** | 74,704 |
| [complex](complex.md) | 31,606.24 m² | 425 | 1,364 | **12,685** | 137,913 |
| [twin](twin.md) | 141,448.56 m² | 1,808 | 5,973 | **26,630** | 450,040 |

**The floor area goes up 6.6 times and the source goes up 1.48 times** (tower to complex). The size of the source is proportional to **the number of design decisions**, not to the size of the building, because a mixed-use building is made of repetition — and level spans, [bands](../reference/muro/band.md) and [`stack`](../reference/muro/stack.md) fold that repetition whole.

Apply the ratios directly and a building the size of complex would be roughly 130,000 tokens in IFC4 and 240,000 in IFCX. And those ratios are against a thoroughly cheated idealised minimum: **the IFC an authoring tool actually exports at this scale (tens of megabytes) fits in no context at all.**

**Whether one building can be placed in a single LLM context changes by orders of magnitude with that change of subject** — and with the whole building in context, rewriting one floor still touches only one layer.

## Reproducing it

```sh
npx tsx examples/comparison/gen-ifc4.ts > examples/comparison/two-rooms.ifc
npx tsx examples/comparison/gen-ifcx.ts > examples/comparison/two-rooms.ifcx
npx tsx examples/comparison/validate-ifc.ts examples/comparison/two-rooms.ifc
```

UUIDs and GUIDs are derived deterministically from names, so regenerating produces no diff. Token counts were measured with o200k_base (the GPT-4o family tokenizer); cl100k_base gives near-identical figures.

## Terms

Definitions of the words outside koyu — IFC, IfcSpace, IFC5 / IFCX, OpenUSD, BIM — are at the end of the [glossary](../glossary.md), along with what it means that Japanese distinguishes 建築 (architecture) from 建築物 (a building as a legal object).
