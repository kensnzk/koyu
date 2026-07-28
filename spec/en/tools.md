**English** · [日本語](../tools.md)

# Tool reference — CLI, MCP, public API

As of koyu v1.0.0-rc.1. Every tool is a different entrance to the same derivations (semantics.md) — the CLI for hands, MCP for agents, the API for programs.

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md); for the CLI worked through with real output, see [guide/en/cli.md](../../guide/en/cli.md).

## CLI (`koyu` / `npm run koyu --`)

```
koyu <check|validate|layers|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [引数...]
```

| Command | Arguments | Output | Exit code |
|---|---|---|---|
| `check` | `--json` (emit Diagnostic[] as JSON — a syntax or composition error is copied into a single SYN01 so the JSON stays valid), `--strict` (exit 1 if there are warnings) | Whether the composition is structurally consistent; errors and warnings with provenance. The ledger of diagnostic codes is semantics.md §5. **It says nothing about architectural validity** (scope.md §3) | 0 = green / 1 = errors (with --strict, warnings too) |
| `validate` | `--json` (emit Finding[] as JSON) | The architectural judgement (the ledger in validation.md). **This is not what check guarantees** — the type and the spelling of the codes both differ; only the exit-code convention is shared | 0 = no violation / 1 = violations |
| `layers` | `--attrs` (the provenance of each attribute's final value) | The layers that took part in composition, weakest first. The face on which you can see with your own eyes that **there is no implicit resolution anywhere** (composition.md, rules 1 and 6) | 0 |
| `diff` | `<b.muro>` (the target — the entry is the source), `--json` (emit ModelDiff as JSON) | The difference in the language of composition (ADR-0018): grid moves, renames (uid matches, path differs), field changes on spaces, boundaries, and openings. Line order, formatting, and the difference between a bare wall declaration and its omission (the default wall) are not differences | 0 = no difference / 1 = differences / 2 = the input is broken |
| `plan` | `-l <level>` (default: the first level), `-o <out.svg>` (default: `<entry>-<level>.svg`) | Generates a plan as SVG | 0 / 2 (an undeclared level name — a question of how it was called. ADR-0028) |
| `axo` | `-o <out.svg>` (default `out/axo.svg`), `-d NE\|NW\|SE\|SW` (default SE), `-l L1..L5` or `-l L1,L3`, `-s <scale>`, `--no-walls`, `--ceilings` | Generates an axonometric as SVG — floors, roofs, walls, columns and vertical circulation, projected (ADR-0026). It needs no runtime and no WebGL, so a solid can be checked with the same generate-and-look loop as a plan | 0 / 2 (an undeclared level name, an unreadable scale, an unknown direction — it never silently writes an empty SVG, nor one full of `NaN`. ADR-0028) |
| `doors` | `/pathA /pathB` | The door count and the intermediate list; 1 if unreachable | 0/1/2 |
| `graph` | — | The neighbors of each space (boundary kind, door count) | 0 |
| `stats` | — | Area by level, semi-outdoor reported separately, by zone, by type, by use | 0 |
| `levels` | — | The section stack-up as text (how the heights add up) | 0 / 1 |
| `runs` | — | The vertical circulations — device, rise, whether it folds, and the derived slope and going length (ADR-0021). Riser counts and goings are checked by `check`'s RUN06 | 0 |
| `light` | — | The 1/7 daylight verdict for **each room declared `daylight:1`** (scope is never inferred from the type — ADR-0020) | 0 = all pass / 1 / 1 = nothing in scope |
| `site` | — | Site area (declared vs derived), road frontage, building coverage ratio, floor area ratio | 0 / 1 = no site |
| `json` | — | The canonical JSON (canonical-json.md) | 0 |

The entry is always a file path, and imports are composed automatically.

## The MCP server (`koyu-mcp` — ADR-0012)

MCP over stdio (JSON-RPC 2.0, newline-delimited JSON). Zero dependencies and stateless (every tool takes `file` = the entry path and composes afresh each time). To register: `claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp`.

| Tool | Arguments | Returns |
|---|---|---|
| `model_summary` | file | Name, levels, layer composition, zones, assets, area, check counts — **call this first** |
| `check` | file | ok; errors and warnings (with layer:line provenance); diagnostics (the structured form — ADR-0016; the same items in the same order as the strings) — **the gate; call it after every edit** |
| `layers` | file | The {file, source} of every layer that took part in composition — to read the authored source |
| `write_layer` | file, layer, content | Checks, then replaces wholesale (content that would not compose is never written — the source is left untouched; check errors are returned but saving an intermediate state is allowed). Writes are atomic. `.muro` only, and only beneath the entry's directory (verified on the relative path and on the symlink's real path; the content of files that do not take part in composition is not validated) |
| `doors` | file, from, to | The path of fewest doors, or {unreachable} |
| `validate` | file | The architectural verdicts (`findings` carry `rule`/`level`). **Not the check guarantee** — a surface that grows |
| `spaces` | file, [level] | The list of spaces (path, type, area, semi-outdoor, provenance) |
| `light` | file | The daylight verdict for each habitable room |
| `site` | file | The site report (area reconciliation `areaMatch`, road frontage, coverage ratio, floor area ratio) |
| `new_uids` | file, [count] | Mints persistent identity tokens (uid) that collide with nothing already composed into the model. **Nothing assigns one on its own**, so call it only when something has to be pointed at across renames |
| `plan_svg` | file, level | The plan as an SVG string |
| `canonical_json` | file | The canonical JSON |

The standard agent loop: `model_summary` → `layers` → `write_layer` → (fix whatever check returns) → confirm the consequences with `doors`/`light`/`site`. History is git's job.

## The public API (`@kensnzk/koyu`)

**The root entry is browser-safe** (it does not pull in node:fs). Only the entry points that use fs are split out into `@kensnzk/koyu/node`. The runtime it is declared to run on is Node 22 or newer (`engines`).

| Entry | What is in it | Frozen |
|---|---|---|
| `@kensnzk/koyu` | everything listed below | the core part freezes (scope.md §8) |
| `@kensnzk/koyu/node` | `parseFile(path)` / `parseFileWith(path, overlay)` — only the two that compose from fs | frozen |
| `@kensnzk/koyu/validate` | the architectural judgement (validation.md) | **not frozen** — a face that grows |
| `@kensnzk/koyu/draw` | SVG generation | **not frozen** — how it is called freezes, what is in the SVG does not |
| `@kensnzk/koyu/examples/*` | the bundled buildings | — |
| `@kensnzk/koyu/spec/*` | this specification itself (shipped in the package) | — |

```ts
import { parse, check, doorsBetween, siteReport, svgPlan, toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
```

### The face, written down

**This table and the implementation's exports agree as sets** — if they disagree, a test fails (ADR-0037). `export *` is not used: the moment an export is added to a module, a promise nobody declared has been added to a face that freezes. **A face that freezes has to be written down.**

<!-- api-surface -->

| Face | Values | Types |
|---|---|---|
| Parsing and composition | `parse` `parseFiles` `parseWith` `tokenize` | `LayerLoader` |
| The vocabulary of the model | — | `Model` `Space` `Zone` `Boundary` `Opening` `Seg` `Area` `Asset` `Level` `Rect` `Pt` `GridAxis` `GridRef` `SitePolygon` `Column` `ColumnDecl` `DrawnLine` `Edge` `BoundaryKind` `Attrs` `AttrValue` |
| Queries, derivation, machine form | `areaM2` `zoneAreaM2` `unionAreaM2` `polygonAreaM2` `pointInPolygon` `polyBounds` `rectToPoly` `columnsFor` `displayName` `effectiveUse` `heff` `isIndoor` `isSemiOutdoor` `isCoveredAbove` `levelsSorted` `newUids` `toCanonical` `srcRef` `SourceError` `SUPPORTED_LANGUAGE_VERSIONS` `DEFAULT_LANGUAGE_VERSION` | — |
| Structural diagnostics | `check` `checkDiagnostics` `DIAGNOSTIC_CODES` | `Diagnostic` `DiagnosticCode` `CheckResult` |
| The spatial graph | `doorsBetween` `neighbors` `passable` `segmentsFor` `envelopeGaps` `deriveDefaultBoundaries` `placeOpening` `placeBand` | `Segment` `Route` `NeighborInfo` `Band` `PlacedBand` `BandError` `BandCode` |
| The reference implementation of shape | `derive` `levelPitch` `DERIVATION_CONSTANTS` `TOLERANCES` `thicken` `bandLine` `band` `columnRect` `runPrism` | `Form` `FormInput` `FormLevel` `FormSpace` `FormBoundary` `FormPanel` `FormOpening` `FormSwing` `FormSeg` `FormColumn` `FormRun` `FormSite` `FormPlan` `FormPrism` `PlanEntity` `PlanClass` `PlanSubject` `PlanRole` `DeriveOptions` |
| Floors, ceilings, roofs | `slabs` | `Slab` `SlabKind` |
| Daylight | `daylightInputs` | `DaylightInput` |
| Vertical circulation | `verticalRuns` `runSolids` `runDrawsForLevel` `slopeText` | `VerticalRun` `RunPart` `RunSolid` `RunDraw` `RunArrow` `RunDevice` `RunForm` `Seg2` |
| The site | `siteReport` | `SiteReport` `RoadFrontage` |
| Diffs | `semanticDiff` `renderDiff` | `ModelDiff` `FieldChange` `ChangedItem` `RenamedItem` `GridChange` `SpaceItem` `BoundaryItem` `BoundaryChange` `ColumnItem` |
| Generation (not frozen) | `svgPlan` `svgAxo` | `PlanOptions` `AxoOptions` |
| Validation (not frozen) | `validate` `VALIDATION_RULES` | `Finding` `ValidationRule` |

### What the face promises

- **Composition entry points**: `parse(source)` (a single source — import is an error) / `parseFiles(files, entry)` (a set of virtual files — imports are resolved within that key space; for the browser) / `parseFile(path)` (fs) / `parseFileWith(path, overlay)` (fs plus a substitution — for the gate before writing) / `parseWith(loader, entry)` (your own loader). Every layer that took part is in `model.layers`, in composition order.
- **Checking and queries**: `checkDiagnostics(model)` → `Diagnostic[]` (the primary form — code/severity/message/provenance/path/related. The ledger is `DIAGNOSTIC_CODES` and the code table is semantics.md §5. ADR-0016) / `check(model)` → {errors, warnings} (the compatible string form — the same items in the same order). The queries are `doorsBetween` / `daylightInputs` / `siteReport` / `zoneAreaM2` / `neighbors` / `passable` / `envelopeGaps` — **not one of them returns a verdict** (scope.md §4).
- **The parts of derivation**: `segmentsFor` / `deriveDefaultBoundaries` (default boundaries — already applied by the parse family; use it when giving meaning to a model that came from canonical JSON) / `placeOpening` / `placeBand` (this "band" is an interval along a boundary segment — an opening or a seg — and is a different layer from the notation keyword `band` ⟨language.md §3⟩) / `columnsFor` / `heff` / `isSemiOutdoor` / `isCoveredAbove` / `levelsSorted`.
- **The one entrance to shape**: `derive(model, {cut?})` → `Form` (ADR-0040). **The rules are held by [derivation.md](derivation.md), and this is its reference implementation.** `Form` carries no appearance at all — no colours, no typefaces, no line weights, no annotation strings, no symbols, no scale (scope.md §6). The ledger of constants is `DERIVATION_CONSTANTS` and the ledger of tolerances is `TOLERANCES`; the tables in derivation.md §5 and §6 are copies of them. `levelPitch(model, level)` answers the storey height (how far walls and columns rise) on its own.
- **What is generated** (the parts `Form` assembles; each can also be called directly): `slabs(model)` (floors, ceilings and roofs — ADR-0024) / `verticalRuns(model)` (the shape of the vertical circulation — ADR-0021) / `runSolids(run)` (its solids) / `runDrawsForLevel(model, level)` (the drawing cut at that level). **None of them carries an appearance** — no colours, no line weights, no annotation strings. A viewer only maps them into geometry (scope.md §6).
- **Drawing**: `svgPlan(model, {level, scale?})` / `svgAxo(model, {dir?, levels?, scale?, ceilings?, walls?})` / `toCanonical(model)`.
- **Diffs**: `semanticDiff(a, b)` → `ModelDiff` (the difference in the language of composition — renames are detected by uid, and boundaries are compared as effective sets. Empty whenever `toCanonical` is identical. ADR-0018) / `renderDiff(d)` → lines of Japanese (an empty array means no difference).
- **Identity**: `newUids(model, count?)` → a list of fresh uids (ADR-0039). **They collide with nothing already composed into that model**, while non-collision with layers not composed here is a probabilistic guarantee resting on 80 bits of randomness — only UID03 under `check` proves it ([scope.md §5](scope.md)). **Until it is called, no tool writes a uid.**
- **Errors**: a syntax or composition error is a `SourceError` (line / raw / file — the message is `layer:line: body`). check never throws; it returns arrays.

A worked consumer is the viewer ugatsu (github.com/kensnzk/ugatsu) — every derivation is a call into this API, and it holds no answers of its own.
