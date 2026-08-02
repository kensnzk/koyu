---
title: Glossary
mode: reference
---

# Glossary

A table for looking up the words of koyu. **The sentence written here is the definition of the word.** When you need more than a sentence, follow the link on the right.

The terms fall into six groups — the skeleton, the elements, attributes, derived properties, files and versions, and checking and questions — followed by the words that live outside koyu. The Japanese term is given alongside each English one, because the bundled examples are written in Japanese.

## The skeleton — what fixes position

| Term | Definition | More |
|---|---|---|
| grid line, 通り芯 | The ascending list of coordinates declared once per axis. `X1`, `X2`, … are named automatically, and every position afterwards is written in those names | [grid](reference/muro/grid.md) |
| grid reference, 通り参照 | How position is written. `X2`, `X2+600`, `Y3-150` — always in words measured from a grid line. **Coordinates are never written directly** | [positions](reference/muro/positions.md) |
| level, レベル | A storey. It has a name and a floor level z, and optionally a base ceiling height `h` and a slab thickness `slab` | [level](reference/muro/level.md) |
| range declaration, 範囲宣言 | `level L4..L10 11000 pitch:3000` — levels in arithmetic progression declared on one line | [level](reference/muro/level.md) |
| span expansion, スパン展開 | That when the **first segment** of a space path has the form `L3..L10`, it expands across the declared levels in z order. The mechanism for writing a typical floor once: `space`, `zone` and `boundary` all expand, and indented openings come along to every expansion | [level](reference/muro/level.md) |
| stack, 積層 | `stack ev L1..L11 type:shaft` — one declaration drawing a vertical boundary between the like-named spaces of every consecutive level pair | [stack](reference/muro/stack.md) |
| band, 帯 | `band X X1..X3 Y1..Y2` plus indented `space` lines — the notation that writes dimension and order rather than position, and lets position be derived. Expanded into ordinary spaces at parse time, surviving neither in the model nor in the canonical JSON | [band](reference/muro/band.md) |
| closed band, 閉じた帯 | A band where every member carries a dimension and their sum equals the width of the band. Using no `w:rest` is the default, and reconciling the sum catches a mistyped dimension | [band](reference/muro/band.md) |
| compass, 方位 (N/E/S/W) | X is east-positive and Y is north-positive, so N=+Y, S=-Y, E=+X, W=-X. `edge` points in this compass **as seen from the rectangle of the a side, the space written first** | [orientation](reference/muro/orientation.md) |
| wall centerline, 壁芯 | The line that area measurement and wall segments are based on. The thickness `t` is split evenly from the centerline to either side | [boundary](reference/muro/boundary.md) |

## The elements — what is written

| Term | Definition | More |
|---|---|---|
| space, 空間 | The primary element. It has a path, a type, and a region (a union of rectangles). A room, a portion within a zone, or an exterior region is one of these | [space](reference/muro/space.md) |
| path, パス | `/L1/A/ldk` — the identity of a space or zone, and at the same time the hierarchy of aggregation. The first segment becomes a level if a `level` of that name has been declared | [space](reference/muro/space.md) |
| type, 型 | The second positional of `space` (**optional**). An open vocabulary that **core never reads** — a free label appearing only in aggregation and in the lettering on a plan. Facts of composition (outside, void, daylight) live in the declarations `outside:` `void:` `daylight:` | [space](reference/muro/space.md) |
| exterior, 外部 | The type denoting a region outside the building. It need not have a region. Adding `road:<width>` makes it a subject of road frontage | [space](reference/muro/space.md) |
| void, 吹抜け | The absence of a floor. As a space type it is excluded from floor area and is not passable; as a boundary kind it says there is no floor between the levels | [boundary](reference/muro/boundary.md) |
| boundary, 境界 | A first-class **relation** joining two spaces. The wall centerline segment is not written; it is derived from the rectangles of the two spaces. A wall is this, not a thing | [boundary](reference/muro/boundary.md) |
| kind (of a boundary) | The word that states only the topology of the relation. Horizontally `wall` / `open`; vertically `stair` / `shaft` / `void` | [boundary](reference/muro/boundary.md) |
| opening, 開口 | A `door` or `window` subordinate to a boundary by indentation. `door` is for passage, `window` for daylight (it does not admit passage). The width `w` is required | [door](reference/muro/door.md) / [window](reference/muro/window.md) |
| asset, アセット | `asset SD1 door w:800 …` — a bundle of defaults referenced by name from openings. Not a fourth element; it only puts the source of attributes in one place, and instance attributes override | [asset](reference/muro/asset.md) |
| zone, ゾーン | A **counted** aggregation with no geometry, bundling the spaces beneath it by path prefix. Make the parent one of these when you want children that have regions | [zone](reference/muro/zone.md) |
| uncounted subdivision, 数えない分節 | A division that affects neither area, room count, graph, nor passage. `area` is a region inside a space and `seg` an interval along a boundary; both carry only attribute overrides | [area](reference/muro/area.md) / [seg](reference/muro/seg.md) |
| site polygon, 敷地形状 | `polygon /site x,y x,y …` — the one shape in this notation written with free vertices off the grid. Admitted as an exception, being surveyed input | [polygon](reference/muro/polygon.md) |
| line, 線 | A declaration subordinate to a boundary that makes it follow a straight line drawn in grid references. Diagonals are written this way, and no vertex coordinate appears in the source | [line](reference/muro/line.md) |
| column, 柱 | `column 900 B2..L6` — an element that carries only a size and a range of levels. No position is written; columns stand at grid intersections that have a floor on that level | [column](reference/muro/column.md) |
| uid | An opaque persistent identity token attached to a space or a zone. Unique across the whole model and never derived from the path. **It exists for joining against an external register across a rename**; references inside the repository stay on paths. Those two are the closed list of what can carry one, and generation is random | [identity](reference/identity.md) |

## Attributes — the three tiers

**Every attribute key is either in the ledger or carries a namespace.** A key that is in neither is diagnostic ATT03 (an error). The boundary exists to keep "not looked at" distinct from "looked at and fine".

| Term | Definition | More |
|---|---|---|
| structural tier, 構造層 | Attributes that change meaning. Rewrite one and area, passage or the population of a verdict moves (`level`, `air`, `road`, `site`, `daylight`, …) | [attributes](reference/muro/attributes.md) |
| interpreted tier, 解釈層 | Attributes that are read and affect numbers or display (`w`, `h`, `t`, `sill`, `use`, `name`, `at`, …). Their value form is checked, and a value written but not interpreted becomes a diagnostic | [attributes](reference/muro/attributes.md) |
| carry tier, 運搬層 | Attributes the tools never interpret, only carry (`spec`, `fire`, `sound`, `floor`, …). What IFC makes an element class is an attribute value here | [attributes](reference/muro/attributes.md) |
| namespace, 名前空間 | The spelling that opens the carry tier to free extension. Any key containing a dot (`acme.sensor`, `bems.temp`) counts as namespaced and may be written without being in the ledger | [attributes](reference/muro/attributes.md) |
| the `spec` vocabulary | The carry-tier key holding the name of a thing (RC, LGS, railing, curtain wall…). The tools do not interpret it | [attributes](reference/muro/attributes.md) |
| `air` | `air:1` = something is there but it blocks neither outside air nor light (a railing, a fence, a balustrade). It affects the derivation of semi-outdoor, the daylight coefficient, and thin-line drawing | [attributes](reference/muro/attributes.md) |
| `edge` | The attribute restricting a boundary's segment to a particular side (N/E/S/W) of the a-side rectangle. Needed when placing an opening on an envelope whose segment splits in several | [boundary](reference/muro/boundary.md) |
| `daylight` | The declaration of whether a space joins the daylight population. `daylight:1` is in scope, `daylight:0` is out. **It is never inferred from the type** | [daylight](reference/validate/daylight.md) |

## Derived properties — what is not written

| Term | Definition | More |
|---|---|---|
| derivation, 導出 | Something determined mechanically and **uniquely** from the authored composition (wall segments, areas, adjacency, semi-outdoor, passability). Absent from the source | [form](reference/form/index.md) |
| generation, 生成 | Something *not* uniquely determined. The plan drawing is one, and that several drawings come from one composition is not a defect | [plan](reference/form/plan.md) |
| shared edge, 共有辺 | The interval where the rectangle unions of two spaces overlap on the same line. A boundary's wall centerline segment is derived as this, and collinear intervals are merged into one | [boundaries](reference/form/boundaries.md) |
| default boundary, 既定境界 | The `wall` boundary **derived after composition** where a pair of touching spaces with regions on the same level carries no boundary declaration at all. It has no door, so it is not passable. It never appears in the canonical JSON, because it is not part of what was written | [defaults](reference/muro/defaults.md) |
| vertical adjacency, 垂直の隣接 | The relation between spaces overlapping in plan on consecutive levels. Never declared; the default reading is "there is a floor". Only the exceptions (`stair` / `shaft` / `void`) are written | [vertical runs](reference/form/vertical-runs.md) |
| semi-outdoor, 半屋外 | A space with a region that carries an `open` or `air:1` boundary with the outside. **Derived rather than declared**; not counted in the interior floor area but reported separately. Balconies, external stairs and terraces become this | [regions](reference/form/regions.md) |
| covered above, 庇下 | Whether a space is overlapped from above by a space on any level. Even the presence of a roof is derived rather than declared, and the 0.7 semi-outdoor daylight coefficient reads it | [regions](reference/form/regions.md) |
| passability, 通行可能性 | A `wall` is passable only with a door, `open` and `stair` are always passable, and `shaft` and `void` never are. `air:1` is about shielding, not passage | [boundaries](reference/form/boundaries.md) |
| height invariant, 高さの不変量 | That for every space, ceiling height + the slab above ≤ the floor-to-floor height. Breaking it is diagnostic HGT01 | [height diagnostics](reference/diagnostics/hgt.md) |
| interior floor area, 屋内床面積 | The sum of the wall-centerline areas of spaces that have a region and a level and are neither `void`, `exterior`, nor semi-outdoor | [stats](reference/cli/stats.md) |
| the effect of a drawn line | For a boundary carrying a `line`, what that line actually did. `"cut"` means it cut the region, `"nothing"` means it cut nothing, `"undetermined"` means it could not be settled | [boundaries](reference/form/boundaries.md) |

## Files and versions

| Term | Definition | More |
|---|---|---|
| author format (.muro) | The textual source format that people and LLMs read and write. One line is one sentence, and indentation expresses subordination | [notation](reference/muro/index.md) |
| composition, 合成 (import) | `import ./L1.muro` — loading a layer by a path relative to the file that wrote it. Double imports and cycles are idempotent | [import](reference/muro/import.md) |
| layer, レイヤー | One file taking part in composition. It is the unit of division of labour, and **layers have strength** — a layer read later is stronger. Collisions (duplicate paths, asset names or grids) become build errors carrying provenance. Nothing is ever silently overwritten | [composition](reference/muro/composition.md) |
| base layer, base層 (entry) | The file that is the entry point of composition. It is the only place `koyu` / `name` / `unit` / `grid` / `level` may be declared | [composition](reference/muro/composition.md) |
| `over` / `drop` | The forms by which a stronger layer overrides (`over`) or withdraws (`drop`) a declaration from a weaker one. Refused when the name does not resolve to exactly one target | [over / drop](reference/muro/over-drop.md) |
| provenance, 出所 (file:line) | The position a diagnostic points at, expressed as the name of a layer that took part in composition and a line number | [reading diagnostics](reference/diagnostics/reading.md) |
| language version, 言語版 | `koyu 1.0` — the version of the semantics of the notation. The accepted versions are `0.1`, `0.2`, `0.3`, `0.4`, `0.5` and `1.0`, and **omitting the declaration reads the file as the latest**. It may be written once, in the base layer | [version](reference/muro/version.md) |
| format version, 形式版 | The version of the spelling of the canonical JSON (the `format` field). It moves independently of the language version | [machine format](reference/json/index.md) |
| canonical JSON, 正準JSON | The machine format emitted by `koyu json`. **Byte-identical for the same composition every time**, with keys in ascending code-point order and text NFC-normalised. It holds **only what was written** — derived artifacts such as default boundaries never appear. It is the ground for diffs, hashes and external connections | [machine format](reference/json/index.md) |
| semantic diff, 意味差分 | The difference `koyu diff` reports, in the language of composition. **Line order, formatting, and the difference between a bare `wall` declaration and its omission are not differences**, and renames are detected by matching `uid`. Splitting a file is not itself a difference | [diff](reference/cli/diff.md) |

## Checking and questions

**There are three domains**: `check`, which speaks to the consistency of the composition; `validate`, which delivers architectural verdicts; and drawing, which produces form. They are separate down to the types, and they do not mix.

| Term | Definition | More |
|---|---|---|
| diagnostic, 診断 | The primary form of `check`. One structured item consisting of `code`, `severity`, `message`, provenance, target paths and related positions | [diagnostics](reference/diagnostics/index.md) |
| diagnostic code | An identifier such as `BND04`. There are 65 of them. **Severity is an invariant property of the code** — the same code is never an error in one case and a warning in another. To change the weight, cut a new code. It never appears in output for people, only under `check --json` | [diagnostics](reference/diagnostics/index.md) |
| error / warning | An error says the composition does not stand; a warning says something is suspect. `--strict` makes a warning exit 1 as well | [check](reference/cli/check.md) |
| finding, 判定 | The primary form of `validate`, consisting of `rule`, `level`, `message` and provenance. **It is a different type from a diagnostic** — being impossible to confuse is what this type is for | [validation](reference/validate/index.md) |
| validation rule | A name such as `site.escape`. There are 15, and `level` is one of `violation` (it was not met) or `caution` (it is suspect). **That is architectural weight**, not a way the composition is broken | [validation](reference/validate/index.md) |
| question, 問い | A different reading of the same description. `doors` (circulation) / `stats` (area) / `light` (daylight) / `site` / `levels` (section stack-up) / `runs` (risers and slope) / `graph` (adjacency) | [CLI](reference/cli/index.md) |
| unreachable, 到達不能 | The state where `doors` finds no route through the space graph. **It happens with a green `check`** — a wall with no door cannot be passed, so a building that declares not one door stays green while being perfectly sealed | [access](reference/validate/access.md) |
| daylighting, 採光 | The rough judgement that effective window area ≥ floor area / 7, for rooms in scope. A coefficient of 0.7 applies when the window looks onto covered semi-outdoor space | [daylight](reference/validate/daylight.md) |
| road frontage, 接道 | The sum of the boundary segment lengths between spaces under the site zone and exterior spaces carrying `road:<width>`. **An external wall of the building facing the road does not count** | [site](reference/validate/site.md) |
| MCP server | `koyu-mcp` — the entrance for agents. A dependency-free stdio server with 12 tools. The standard loop is `model_summary` → `layers` → `write_layer` → `check` | [MCP](reference/mcp/index.md) |
| public surface, 公開面 | The set of names written down as the TypeScript API | [API](reference/api/index.md) |

## Neighbouring words (outside koyu)

| Term | Definition |
|---|---|
| BIM | The practice of handling a building's three-dimensional geometry and attribute information together. The source lives inside each authoring tool's proprietary database |
| IFC | buildingSMART's open standard for exchange. Its standard form (SPF) cross-references by line number, so simply re-exporting destroys the diff |
| IfcSpace | The IFC entity for a room or a region. It exists in the standard, but on many projects it is treated as secondary information derived from what the elements happen to enclose |
| IFC5 / IFCX | The next-generation standard under development and its JSON form. It adopts text and composition, but what it carries is still the ontology of a building as an object |
| OpenUSD | A framework for scene description. koyu borrows only mechanism from it — the path namespace, and the non-destructive layering of overrides |
| 建築 / 建築物 | Japanese distinguishes the two. 建築物 is the category of a building as a legal object, and IFC and CityGML are ontologies of that side. **What koyu writes is the other side, 建築** — the articulation, connection and hierarchy of space |

Japanese building and regulatory terms — coverage ratio, floor area ratio, frontage, habitable room, section stack-up — are in [Japanese building and regulatory terms](glossary/japanese-building-terms.md). The measured comparison with IFC is in [koyu measured against IFC](examples/vs-ifc.md).
