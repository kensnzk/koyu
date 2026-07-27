**English** · [日本語](../tools.md)

# Tool reference — CLI, MCP, public API

As of koyu v0.14.0. Every tool is a different entrance to the same derivations (semantics.md) — the CLI for hands, MCP for agents, the API for programs.

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md); for the CLI worked through with real output, see [guide/en/cli.md](../../guide/en/cli.md).

## CLI (`koyu` / `npm run koyu --`)

```
koyu <check|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [引数...]
```

| Command | Arguments | Output | Exit code |
|---|---|---|---|
| `check` | `--json` (emit Diagnostic[] as JSON — a syntax or composition error is copied into a single SYN01 so the JSON stays valid), `--strict` (exit 1 if there are warnings) | Whether the composition is consistent; errors and warnings with provenance. The ledger of diagnostic codes is semantics.md §5 | 0 = green / 1 = errors (with --strict, warnings too) |
| `diff` | `<b.muro>` (the target — the entry is the source), `--json` (emit ModelDiff as JSON) | The difference in the language of composition (ADR-0018): grid moves, renames (uid matches, path differs), field changes on spaces, boundaries, and openings. Line order, formatting, and the difference between a bare wall declaration and its omission (the default wall) are not differences | 0 = no difference / 1 = differences / 2 = the input is broken |
| `plan` | `-l <level>` (default: the first level), `-o <out.svg>` (default: `<entry>-<level>.svg`) | Generates a plan as SVG | 0 / 2 (an undeclared level name — a question of how it was called. ADR-0028) |
| `axo` | `-o <out.svg>` (default `out/axo.svg`), `-d NE\|NW\|SE\|SW` (default SE), `-l L1..L5` or `-l L1,L3`, `-s <scale>`, `--no-walls`, `--ceilings` | Generates an axonometric as SVG — floors, roofs, walls, columns and vertical circulation, projected (ADR-0026). It needs no runtime and no WebGL, so a solid can be checked with the same generate-and-look loop as a plan | 0 / 2 (an undeclared level name — it never silently writes an empty SVG. ADR-0028) |
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
| `spaces` | file, [level] | The list of spaces (path, type, area, semi-outdoor, provenance) |
| `light` | file | The daylight verdict for each habitable room |
| `site` | file | The site report (area reconciliation `areaMatch`, road frontage, coverage ratio, floor area ratio) |
| `plan_svg` | file, level | The plan as an SVG string |
| `canonical_json` | file | The canonical JSON |

The standard agent loop: `model_summary` → `layers` → `write_layer` → (fix whatever check returns) → confirm the consequences with `doors`/`light`/`site`. History is git's job.

## The public API (`@kensnzk/koyu`)

**The root entry is browser-safe** (it does not pull in node:fs). Only the entry points that use fs are split out into `@kensnzk/koyu/node`.

```ts
import { parse, parseFiles, parseWith, check, doorsBetween, daylight, siteReport,
         svgPlan, toCanonical, areaM2, zoneAreaM2, isSemiOutdoor, /* … */ } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
```

- **Composition entry points**: `parse(source)` (a single source — import is an error) / `parseFiles(files, entry)` (a set of virtual files — imports are resolved within that key space; for the browser) / `parseFile(path)` (fs) / `parseFileWith(path, overlay)` (fs plus a substitution — for the gate before writing) / `parseWith(loader, entry)` (your own loader). Every layer that took part is in `model.layers`, in composition order.
- **Checking and queries**: `checkDiagnostics(model)` → `Diagnostic[]` (the primary form — code/severity/message/provenance/path/related. The ledger is `DIAGNOSTIC_CODES` and the code table is semantics.md §5. ADR-0016) / `check(model)` → {errors, warnings} (the compatible string form — the same items in the same order). `doorsBetween` / `daylight` / `siteReport` / `zoneAreaM2` / `neighbors` / `passable`.
- **The parts of derivation**: `segmentsFor` / `sharedSegment` / `deriveDefaultBoundaries` (default boundaries — already applied by the parse family; use it when giving meaning to a model that came from canonical JSON) / `placeOpening` / `placeBand` (this "band" is an interval along a boundary segment — an opening or a seg — and is a different layer from the notation keyword `band` ⟨language.md §3⟩) / `mergeCollinear` / `heff` / `isSemiOutdoor` / `isCoveredAbove` / `levelsSorted` / `polygonAreaM2` / `pointInPolygon` / `rectEscapesPolygon` / `polygonSelfIntersection`.
- **Generation**: `svgPlan(model, {level, scale?})` / `toCanonical(model)`.
- **Diffs**: `semanticDiff(a, b)` → `ModelDiff` (the difference in the language of composition — renames are detected by uid, and boundaries are compared as effective sets. Empty whenever `toCanonical` is identical. ADR-0018) / `renderDiff(d)` → lines of Japanese (an empty array means no difference).
- **Errors**: a syntax or composition error is a `SourceError` (line / raw / file — the message is `layer:line: body`). check never throws; it returns arrays.
- Subpaths: `@kensnzk/koyu/examples/*` lets the bundled examples be referenced from the distributed package.

A worked consumer is the viewer ugatsu (github.com/kensnzk/ugatsu) — every derivation is a call into this API, and it holds no answers of its own.
