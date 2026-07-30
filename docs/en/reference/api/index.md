---
title: TypeScript API
mode: reference
---

# TypeScript API

`@kensnzk/koyu` reads `.muro`, checks it, answers questions about it, derives form from it, and emits drawings. **Everything the CLI answers, this API answers.** The [`koyu` command](../cli/index.md), the `koyu-mcp` server and this API are three entrances to the same derivations; there is no answer that only one of them has.

```sh
npm install @kensnzk/koyu
```

There are no runtime dependencies. The only modules the package pulls are Node built-ins, and those are confined to `@kensnzk/koyu/node`. It needs **Node 22 or later** (`engines.node` is `>=22`).

## Four entrances

```ts
import { parse, checkDiagnostics, derive } from "@kensnzk/koyu";
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";
import { validate, VALIDATION_RULES } from "@kensnzk/koyu/validate";
import { svgPlan, svgAxo } from "@kensnzk/koyu/draw";
```

| Entrance | What is in it | `node:fs` |
|---|---|---|
| `@kensnzk/koyu` | the whole surface — parsing, diagnostics, queries, derivation, drawing, diff, validation | **not pulled** |
| `@kensnzk/koyu/node` | `parseFile` and `parseFileWith`, nothing else | pulled |
| `@kensnzk/koyu/validate` | `validate`, `VALIDATION_RULES`, and the types `Finding` and `ValidationRule` | not pulled |
| `@kensnzk/koyu/draw` | `svgPlan`, `svgAxo`, and the types `PlanOptions` and `AxoOptions` | not pulled |

**The root pulls neither `node:fs` nor `node:path`.** It runs unchanged in a browser, a web worker, or an edge runtime. Only the entrance that touches the filesystem lives under `/node`. The split exists to keep the parser itself pure: composition (resolving `import`) takes a "how do I read a layer" function from outside, and the filesystem is only one implementation of it. A browser passes a virtual file set (`parseFiles`) or its own loader (`parseWith`) — see [Parsing and composition](parsing.md).

`/validate` and `/draw` are also part of what the root re-exports. They are **separate entrances so the domains do not blur**, not separate implementations: calling `validate` from the root and from `@kensnzk/koyu/validate` calls the same function. (The `/validate` module also exposes `finding`, a constructor for a `Finding`; the root does not re-export it, and a name absent from the list below is outside the promise.)

## The surface is written down

The package root does not use `export *`. The moment a module gains an export, a promise nobody declared would join a frozen surface. A promise has to be written out to be a promise.

So **this surface is exactly the set of names spelled out one by one in `src/index.ts`** — **59** runtime values and **77** types. A name that is not there is not a promise, however visible it is in the source.

**The whole promise is this table.** A test binds this table and the set in `src/index.ts` to each other, so adding an export without writing it here fails. Names go in collation order, and the grouping follows which module each name is exported from.

<!-- api-surface -->

| Surface | Values | Types |
|---|---|---|
| [Parsing and composition](parsing.md) | `parse` `parseFiles` `parseWith` `tokenize` | `LayerLoader` |
| [The model and its questions](model.md) | `areaM2` `canonicalBoundaryOrder` `columnsFor` `DEFAULT_LANGUAGE_VERSION` `displayName` `effectiveUse` `heff` `isCoveredAbove` `isIndoor` `isSemiOutdoor` `levelsSorted` `newUids` `pointInPolygon` `polyBounds` `polygonAreaM2` `rectToPoly` `SourceError` `srcRef` `SUPPORTED_LANGUAGE_VERSIONS` `toCanonical` `unionAreaM2` `zoneAreaM2` | `Area` `Asset` `Attrs` `AttrValue` `Boundary` `BoundaryKind` `Column` `ColumnDecl` `DrawnLine` `Edge` `GridAxis` `GridRef` `Level` `Model` `Opening` `Pt` `Rect` `Seg` `SitePolygon` `Space` `Zone` |
| [Diagnostics](diagnostics.md) | `check` `checkDiagnostics` `DIAGNOSTIC_CODES` | `CheckResult` `Diagnostic` `DiagnosticCode` |
| [Graph and segments](queries.md) | `deriveDefaultBoundaries` `doorsBetween` `envelopeGaps` `neighbors` `passable` `placeBand` `placeOpening` `segmentsFor` | `Band` `BandCode` `BandError` `NeighborInfo` `PlacedBand` `Route` `Segment` |
| [Derivation (Form)](derive.md) | `band` `bandLine` `columnRect` `derive` `DERIVATION_CONSTANTS` `levelPitch` `runPrism` `thicken` | `DeriveOptions` `Form` `FormBoundary` `FormColumn` `FormInput` `FormLevel` `FormOpening` `FormPanel` `FormPlan` `FormPrism` `FormRun` `FormSeg` `FormSite` `FormSpace` `FormSwing` `PlanClass` `PlanEntity` `PlanRole` `PlanSubject` |
| [Tolerances](../form/constants.md) | `TOLERANCES` | — |
| [Slabs — floors, ceilings, roofs](solids.md) | `slabs` | `Slab` `SlabKind` |
| [Daylight inputs](queries.md) | `daylightInputs` | `DaylightInput` |
| [Vertical circulation](solids.md) | `runDrawsForLevel` `runSolids` `slopeText` `verticalRuns` | `RunArrow` `RunDevice` `RunDraw` `RunForm` `RunPart` `RunSolid` `Seg2` `VerticalRun` |
| [Site](queries.md) | `siteReport` | `RoadFrontage` `SiteReport` |
| [Diff](diff.md) | `renderDiff` `semanticDiff` | `BoundaryChange` `BoundaryItem` `ChangedItem` `ColumnItem` `FieldChange` `GridChange` `ModelDiff` `RenamedItem` `SpaceItem` |
| [Drawing the plan](draw.md) | `svgPlan` | `PlanOptions` |
| [Drawing the solid](draw.md) | `svgAxo` | `AxoOptions` |
| [Architectural verdicts](validate.md) | `validate` `VALIDATION_RULES` | `Finding` `ValidationRule` |

Four things put a name on the surface.

1. Something outside the package (the viewer, the eval harness, scripts, the editor extension) actually calls it.
2. It is needed so the API can answer what the CLI or MCP answers.
3. It is a derivation promised by name.
4. A test pins it as a contract.

Plumbing that only lets core modules reach each other is not surface. Types are on it only when they are needed to spell out the signature of a value that is on it.

## The first program

Read a file, check it, print areas. That is one full turn of the loop.

```ts
import { checkDiagnostics, areaM2 } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/two-rooms.muro");

const diags = checkDiagnostics(model);
console.log(`${model.name} — spaces ${model.spaces.size} / diagnostics ${diags.length}`);
for (const d of diags) console.log(`${d.severity} ${d.code} ${d.message}`);

for (const s of model.spaces.values()) {
  console.log(`${s.path}\t${s.type}\t${areaM2(s) ?? "-"}`);
}
```

```text
二室 — spaces 3 / diagnostics 0
/L1/a	room	16.2
/L1/b	room	16.2
/out	exterior	-
```

`model.spaces` is a `Map<string, Space>` and `model.boundaries` is a `Boundary[]`. **A path is the identity of a space**, and a boundary belongs to neither space it joins — it is a first-class relation sitting in an array. See [Model and its types](model.md).

**An empty diagnostic list does not mean the building works.** `checkDiagnostics` says only that what is written is not self-contradictory as data. A two-storey house with not one door declared stays sealed shut with an empty list. The architectural judgement is made separately by [`validate`](validate.md).

## Map of the pages

| Page | What you look up |
|---|---|
| [Model and its types](model.md) | `Model` `Space` `Boundary` `Zone` `Level` `Opening` and the rest of the written composition |
| [Parsing and composition](parsing.md) | `parse` `parseFiles` `parseWith` `parseFile` `parseFileWith` `tokenize` `LayerLoader` |
| [Diagnostics](diagnostics.md) | `checkDiagnostics` `check` `DIAGNOSTIC_CODES` `Diagnostic` `CheckResult` |
| [Validation](validate.md) | `validate` `VALIDATION_RULES` `Finding` `ValidationRule` |
| [Questions about a model](queries.md) | `doorsBetween` `neighbors` `areaM2` `siteReport` `daylightInputs` and friends |
| [Deriving form](derive.md) | `derive`, every type in `Form`, `DERIVATION_CONSTANTS`, `TOLERANCES` |
| [Solids and generated fabric](solids.md) | `thicken` `band` `columnRect` `runPrism` `slabs` `verticalRuns` and friends |
| [Drawing](draw.md) | `svgPlan`, `svgAxo` and their options |
| [Canonical JSON](canonical.md) | `toCanonical` |
| [Semantic diff](diff.md) | `semanticDiff` `renderDiff` `ModelDiff` |
| [Generating identity](identity.md) | `newUids` |
| [Geometry helpers](geometry.md) | `polygonAreaM2` `pointInPolygon` `polyBounds` `rectToPoly` `envelopeGaps` |
| [Errors](errors.md) | `SourceError` `srcRef` |
| [Language versions](versions.md) | `SUPPORTED_LANGUAGE_VERSIONS` `DEFAULT_LANGUAGE_VERSION` |

## Three domains

The surface falls into three parts, and **the way it falls is itself part of the promise.**

| Domain | What it says | Frozen? |
|---|---|---|
| core | consistency of the composition, and the numbers and shapes derived from it | **frozen** — a change of meaning raises the language version |
| validation | architectural judgement (`Finding`) | not frozen — rules are added, sharpened, dropped |
| drawing | the content of the SVG | not frozen — looks change freely |

core **never passes judgement.** Areas, segments, convex pieces, solids — that is where core stops. Whether something is *enough*, or *complied with*, is validation's sentence. The split shows up in the types: core returns `Diagnostic { code, severity }` and validation returns `Finding { rule, level }`. The field names differ, so the two arrays cannot be confused for each other.

The bytes of the SVG that `svgPlan` and `svgAxo` return are outside the promise. **The same input yields the same form, but not the same bytes.** Colours, line styles, typefaces and symbols change without notice. To compare drawings mechanically, compare [`toCanonical`](canonical.md) or the value returned by [`derive`](derive.md).
