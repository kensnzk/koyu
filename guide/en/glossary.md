**English** · [日本語](../glossary.md)

# Glossary

A table for looking up the words of koyu. Each row is a one-sentence definition, the place that defines the word normatively, and a place it is actually used.

**The norm for a definition is in spec/.** The sentence here is a summary for looking things up, not a contract. Where they disagree, [spec/](../../spec/en/README.md) is right. Why a word has the shape it has is held by the [ADRs](../../docs/decisions/) (in Japanese), and the relations between words are held by [concepts.md](concepts.md).

The terms are in five groups — the skeleton, the elements, derived properties, files and versions, and checking and queries. The Japanese term is given alongside each English one, because the tool's output and the bundled examples use it. The full translation contract is [docs/terminology.md](../../docs/terminology.md).

## The skeleton — what fixes position

| Term | One-sentence definition | Norm | Used in |
|---|---|---|---|
| grid line, 通り芯 (grid) | The list of coordinates declared once per axis. `X1`, `X2`, … are named automatically | [language.md §2](../../spec/en/language.md) | [two-rooms](../../examples/two-rooms.muro) |
| grid reference, 通り参照 | How position is written. `X2`, `X2+600`, `Y3-150` — always in words measured from a grid line. Coordinates are never written directly | [language.md §2](../../spec/en/language.md) | [tower/typical](../../examples/tower/typical.muro) |
| level, レベル (level) | A storey. It has a name and a floor level z, and optionally a base ceiling height `h` and a slab thickness `slab` | [language.md §2](../../spec/en/language.md) | [house/main](../../examples/house/main.muro) |
| range declaration, 範囲宣言 | `level L4..L10 11000 pitch:3000` — the form that declares levels in arithmetic progression on one line | [language.md §2](../../spec/en/language.md) | [tower/main](../../examples/tower/main.muro) |
| span expansion, スパン展開 | That when the **first segment** of a space path has the form `L3..L10`, it expands across the declared levels in z order. The mechanism for writing a typical floor once | [language.md §3](../../spec/en/language.md), [ADR-0004](../../docs/decisions/0004-typical-floors.md) | [tower/typical](../../examples/tower/typical.muro) |
| stack, 積層 (stack) | `stack ev L1..L11 type:shaft` — one declaration drawing vertical boundaries across every consecutive level pair | [language.md §4](../../spec/en/language.md) | [tower/main](../../examples/tower/main.muro) |
| band, 帯 (band) | `band X X1..X3 Y1..Y2` plus indented `space` lines — the notation that writes dimension and order rather than position, and lets position be derived. Expanded into ordinary spaces at parse time, surviving neither in the model nor in the canonical JSON | [language.md §3 band](../../spec/en/language.md), [ADR-0019](../../docs/decisions/0019-position-and-lines.md) | [tower/typical](../../examples/tower/typical.muro) |
| closed band, 閉じた帯 | A band where every member carries a dimension and their sum equals the width of the band. Using no `w:rest` is the default, and reconciling the sum catches a mistyped dimension | [language.md §3 band](../../spec/en/language.md) | [tower/typical](../../examples/tower/typical.muro) |
| compass, 方位 (N/E/S/W) | X is east-positive and Y is north-positive, so N=+Y, S=-Y, E=+X, W=-X. `edge` points in this compass **as seen from the rectangle of the a side, the space written first** | [language.md §1, §4](../../spec/en/language.md) | [concepts.md §2](concepts.md) |
| wall centerline, 壁芯 | The basis for measuring area and for wall segments. The thickness `t` is split from the centerline to either side | [language.md §1, §9](../../spec/en/language.md) | [concepts.md §5](concepts.md) |

## The elements — what is written

| Term | One-sentence definition | Norm | Used in |
|---|---|---|---|
| space, 空間 (space) | The primary element. It has a path, a type, and a region (a union of rectangles). A room, a portion within a zone, or an exterior region is one of these | [language.md §3](../../spec/en/language.md) | [two-rooms](../../examples/two-rooms.muro), [concepts.md §1](concepts.md) |
| path, パス | `/L1/A/ldk` — the identity of a space or zone, and at the same time the aggregation hierarchy. The first segment becomes a level if a `level` of that name has been declared | [language.md §3](../../spec/en/language.md) | [concepts.md §4](concepts.md) |
| type, 型 (type) | The second positional of `space` (required). An open vocabulary; only `exterior` and `void` are interpreted structurally, and only `unit`, `room`, `ldk`, `bedroom`, `living` are subjects of the daylight check | [language.md §3](../../spec/en/language.md), [vocabulary.md](../../spec/en/vocabulary.md) | [concepts.md §6](concepts.md) |
| exterior, 外部 (exterior) | The type denoting a region outside the building. It need not have a region. Adding `road:<width>` makes it a subject of road frontage | [vocabulary.md](../../spec/en/vocabulary.md), [ADR-0009](../../docs/decisions/0009-site-and-exterior.md) | [house/site](../../examples/house/site.muro) |
| void, 吹抜け (void) | The absence of a floor. As a space type it is excluded from floor area and is not passable; as a boundary kind it says there is no floor between the levels | [language.md §4](../../spec/en/language.md), [ADR-0006](../../docs/decisions/0006-voids-and-light.md) | [house/main](../../examples/house/main.muro) |
| boundary, 境界 (boundary) | A first-class **relation** joining two spaces. The wall centerline segment is not written; it is derived from the rectangles of the two spaces | [language.md §4](../../spec/en/language.md), [semantics.md §2](../../spec/en/semantics.md) | [concepts.md §2](concepts.md) |
| kind (of a boundary) | The word that states only the topology of the relation. Horizontally `wall` / `open`; vertically `stair` / `shaft` / `void` | [language.md §4](../../spec/en/language.md), [vocabulary.md](../../spec/en/vocabulary.md) | [tower/main](../../examples/tower/main.muro) |
| the `spec` vocabulary | The name of a thing (RC, LGS, railing, curtain wall…). Tools do not interpret it, only carry it. What IFC makes an element class is an attribute value here | [vocabulary.md rule 2](../../spec/en/vocabulary.md) | [two-rooms](../../examples/two-rooms.muro) |
| `air` | `air:1` = something is there but it does not block outside air or light (a railing, a fence, a balustrade). It affects the derivation of semi-outdoor, the daylight coefficient, and thin-line drawing | [vocabulary.md](../../spec/en/vocabulary.md), [ADR-0007](../../docs/decisions/0007-semi-outdoor-air.md) | [house/site](../../examples/house/site.muro) |
| `edge` | The attribute restricting a boundary's segment to a particular side (N/E/S/W) of the a-side rectangle. Needed when placing an opening on an envelope whose segment splits in several | [language.md §4](../../spec/en/language.md) | [two-rooms](../../examples/two-rooms.muro) |
| opening, 開口 (opening) | A `door` or `window` subordinate to a boundary by indentation. `door` is for passage, `window` for daylight (it does not admit passage). The width `w` is required | [language.md §4 openings](../../spec/en/language.md) | [house/L1](../../examples/house/L1.muro) |
| asset, アセット (asset) | `asset SD1 door w:800 …` — a bundle of defaults referenced by openings. Not a fourth element; it only puts the source of attributes in one place | [language.md §6](../../spec/en/language.md), [ADR-0010](../../docs/decisions/0010-assets-and-composition.md) | [house/assets](../../examples/house/assets.muro) |
| zone, ゾーン (zone) | A **counted** aggregation with no geometry, bundling the spaces beneath it by path prefix. Make the parent one of these when you want children that have regions | [language.md §5](../../spec/en/language.md), [ADR-0005](../../docs/decisions/0005-zones-and-unions.md) | [tower/typical](../../examples/tower/typical.muro) |
| uncounted subdivision, 数えない分節 (area / seg) | A division that affects neither area, room count, graph, nor passage. `area` is a region inside a space and `seg` an interval along a boundary; both carry only attribute overrides | [language.md §3, §4](../../spec/en/language.md), [ADR-0003](../../docs/decisions/0003-uncounted-divisions.md) | [tower/L1](../../examples/tower/L1.muro) |
| site shape, 敷地形状 (polygon) | `polygon /site x,y x,y …` — the one shape in this notation written with free vertices off the grid. Admitted as an exception, being surveyed input | [language.md §7](../../spec/en/language.md), [ADR-0011](../../docs/decisions/0011-site-polygon.md) | [tower/site-geometry](../../examples/tower/site-geometry.muro) |
| `uid` | An opaque persistent identity token attached to a space or zone. Unique across the whole model and never derived from the path. It exists for external joins across renames; references inside the repository stay on paths | [vocabulary.md](../../spec/en/vocabulary.md), [ADR-0015](../../docs/decisions/0015-identity-uid.md) | [concepts.md §4](concepts.md) |

## Derived properties — what is not written

| Term | One-sentence definition | Norm | Used in |
|---|---|---|---|
| derivation, 導出 | Something determined mechanically and uniquely from the authored composition (wall segments, areas, adjacency, semi-outdoor, passability). Absent from the source | [semantics.md, opening](../../spec/en/semantics.md) | [concepts.md §5](concepts.md) |
| generation, 生成 | Something *not* uniquely determined. The plan drawing is one, and that several forms come from one composition is not a defect | [semantics.md §7](../../spec/en/semantics.md) | [gallery.md](gallery.md) |
| shared edge, 共有辺 | The interval where the rectangle unions of two spaces overlap on the same line. A boundary's wall centerline segment is derived as this, and collinear intervals are merged into one | [semantics.md §2](../../spec/en/semantics.md) | [concepts.md §2](concepts.md) |
| default boundary, 既定境界 | The `wall` boundary derived after composition where a pair of touching spaces with regions on the same level has no declaration at all. It carries no door, so it is not passable | [semantics.md §2](../../spec/en/semantics.md), [ADR-0014](../../docs/decisions/0014-default-boundaries.md) | [concepts.md §3](concepts.md) |
| vertical adjacency, 垂直の隣接 | The relation between spaces overlapping in plan on consecutive levels. Never declared; the default reading is "there is a floor". Only the exceptions (`stair`/`shaft`/`void`) are written | [semantics.md §3](../../spec/en/semantics.md), [ADR-0002](../../docs/decisions/0002-height-and-offsets.md) | [house/main](../../examples/house/main.muro) |
| semi-outdoor, 半屋外 | A space with a region that carries an `open` or `air:1` boundary with the outside. Derived rather than declared; not counted as interior floor area but reported separately | [semantics.md §4](../../spec/en/semantics.md), [ADR-0007](../../docs/decisions/0007-semi-outdoor-air.md) | [house/site](../../examples/house/site.muro) |
| covered above, 庇下 (isCoveredAbove) | Whether a space is overlapped from above by a space on any level. Even the presence of a roof is derived rather than declared, and the 0.7 semi-outdoor daylight coefficient reads it | [semantics.md §4](../../spec/en/semantics.md) | [tower/typical](../../examples/tower/typical.muro) |
| passability, 通行可能性 (passable) | A `wall` is passable only with a door, `open` and `stair` are always passable, and `shaft` and `void` never are. `air:1` is about shielding, not passage | [semantics.md §4](../../spec/en/semantics.md) | [concepts.md, closing](concepts.md) |
| height invariant, 高さの不変量 | That for every space, ceiling height + the slab above ≤ the floor-to-floor height. Breaking it is HGT01 | [semantics.md §3](../../spec/en/semantics.md) | [tower/main](../../examples/tower/main.muro) |
| interior floor area, 屋内床面積 | The sum of the wall-centerline areas of spaces that have a region and a level and are neither `void`, `exterior`, nor semi-outdoor | [semantics.md §6](../../spec/en/semantics.md) | [gallery.md](gallery.md) |

## Files and versions

| Term | One-sentence definition | Norm | Used in |
|---|---|---|---|
| the authored form (.muro) | The text form of the source that people and LLMs read and write. One line is one statement | [language.md §1](../../spec/en/language.md) | [two-rooms](../../examples/two-rooms.muro) |
| composition, 合成 (import) | `import ./L1.muro` — loads a layer by a path relative to the file it is written in and composes it **additively**. A double import, or a cycle, is idempotent | [language.md §8](../../spec/en/language.md), [ADR-0010](../../docs/decisions/0010-assets-and-composition.md) | [house/main](../../examples/house/main.muro) |
| layer, 層 (レイヤー) | One file taking part in composition. It is the unit of divided work, and a collision (a duplicate path, asset name, or grid) is a build error carrying provenance. There is no silent override | [language.md §8](../../spec/en/language.md) | [tower/](../../examples/tower/main.muro) |
| base layer (entry) | The file that is the entrance to composition. It is the only place where `koyu` / `name` / `unit` / `grid` / `level` may be declared, once each | [language.md §2, §8](../../spec/en/language.md) | [tower/main](../../examples/tower/main.muro) |
| provenance, 出所 (file:line) | The position a diagnostic points at, expressed as the name of the layer that took part in composition plus a line number | [semantics.md §1](../../spec/en/semantics.md) | [diagnostics.md (日本語)](../diagnostics.md) |
| language version, 言語版 | `koyu 0.3` — the version of the notation's semantics. `0.1, 0.2, 0.3` are accepted, and omitting the declaration reads the file as the newest. It may be written once, in the base layer | [language.md §2, the version norm](../../spec/en/language.md), [ADR-0017](../../docs/decisions/0017-language-versioning.md) | [two-rooms](../../examples/two-rooms.muro) |
| canonical JSON, 正準JSON | The machine format emitted by `koyu json`. Always byte-identical for the same composition, and holding **only the authored composition** (default boundaries do not appear). The footing for diffs, hashes, and external connections | [canonical-json.md](../../spec/en/canonical-json.md), [ADR-0013](../../docs/decisions/0013-semantic-guarantees.md) | [two-rooms.canonical.json](../../examples/two-rooms.canonical.json) |
| semantic diff, 意味差分 | The difference in the language of composition, emitted by `koyu diff`. Line order, formatting, and the difference between a bare wall declaration and its omission are not differences, and a rename is detected by a matching `uid` | [tools.md](../../spec/en/tools.md), [ADR-0018](../../docs/decisions/0018-semantic-diff.md) | [cli.md](cli.md) |

## Checking and queries

| Term | One-sentence definition | Norm | Used in |
|---|---|---|---|
| diagnostic, 診断 (Diagnostic) | The primary form of `check`. One structured item consisting of `code`, `severity`, `message`, provenance, the subject path, and a related position | [semantics.md §5](../../spec/en/semantics.md), [ADR-0016](../../docs/decisions/0016-diagnostic-contract.md) | [diagnostics.md (日本語)](../diagnostics.md) |
| diagnostic code | An identifier such as `BND04`. The severity is an invariant property of the code, and changing the weight means minting a new one. It never appears in the human output — only in `check --json` | [semantics.md §5](../../spec/en/semantics.md) | [diagnostics.md (日本語)](../diagnostics.md) |
| error / warning | An error says the composition does not stand up; a warning says something is suspect. `--strict` makes even a warning exit 1 | [semantics.md §5](../../spec/en/semantics.md), [tools.md](../../spec/en/tools.md) | [cli.md](cli.md) |
| query, 問い | A different reading of the same description. `doors` (circulation), `stats` (area), `light` (daylight), `site` (the site), `levels` (the section), `graph` (adjacency) | [semantics.md §6](../../spec/en/semantics.md) | [cli.md](cli.md) |
| unreachable, 到達不能 | The state where `doors` finds no route on the space graph. It happens even when `check` is green — a wall with no door cannot be passed | [semantics.md §6](../../spec/en/semantics.md) | [concepts.md, closing](concepts.md) |
| daylight, 採光 (light) | The coarse test "effective window area ≥ floor area / 7" over the habitable rooms in scope. The coefficient is 0.7 when the semi-outdoor space beyond the window is covered above | [semantics.md §6](../../spec/en/semantics.md), [ADR-0006](../../docs/decisions/0006-voids-and-light.md) | [cli.md](cli.md) |
| road frontage, 接道 | The total length of boundary segments between spaces beneath the site zone and exterior spaces carrying `road:<width>`. The part where the building's outer wall faces the road is not counted | [semantics.md §6](../../spec/en/semantics.md), [ADR-0009](../../docs/decisions/0009-site-and-exterior.md) | [tower/site](../../examples/tower/site.muro) |
| the MCP server | `koyu-mcp` — the entrance for agents. `model_summary` → `layers` → `write_layer` → `check` is the standard loop | [tools.md](../../spec/en/tools.md), [ADR-0012](../../docs/decisions/0012-mcp-server.md) | [api.md](api.md) |

## Neighboring words (outside koyu)

| Term | One-sentence definition |
|---|---|
| BIM | The practice of handling a building's three-dimensional form and its attribute information together. The source of record lives inside each authoring tool's own database |
| IFC | buildingSMART's open standard for exchange. Its standard form (SPF) cross-references by line number, so merely re-exporting a model destroys the diff |
| IfcSpace | The entity denoting a room or region in IFC. It exists in the standard, but on many projects it is treated as secondary information derived from what the components enclose |
| IFC5 / IFCX | The next-generation standard under development and its JSON form. It adopts text and composition, but what it carries is still the ontology of the building-as-object |
| OpenUSD | A framework for scene description. koyu borrows only the mechanism from it — the path namespace, and the non-destructive layering of layers |
| 建築 / 建築物 (architecture / building) | Japanese distinguishes these. 建築物 is the category of the thing under the Building Standards Act, and both IFC and CityGML are ontologies of that side. What koyu writes is the other — the subdivision, connection, and ordering of space |

The detail of these positions is in [docs/writing-architecture.md](../../docs/writing-architecture.md) (in Japanese), and the correspondence table with IFC is at the end of [spec/vocabulary.md](../../spec/en/vocabulary.md).
