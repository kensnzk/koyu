**English** · [日本語](../semantics.md)

# Semantics reference — derivation, checking, queries

As of koyu v0.15.0. For the grammar see [language.md](language.md). What is written here is what is derived from what was authored, what is checked, and what the queries answer — form, quantity, and the inside/outside distinction are all absent from the authored source, and all defined here as derivations.

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).

## 1. The model

The composed model consists of: `spaces` (path → space: type, level, rectangle union, areas, attributes, provenance), `boundaries` (a list of relations: a/b paths, kind, t/air/edge, openings, segs, provenance), `zones` (path → aggregation), `assets` (name → opening type), `polygons` (path → site shape), `columns` (column declarations, in declared order — ADR-0023/0029), `grid`, and `levels`. The provenance (`file`) is **the key the loader gave**, used in the position prefix of errors and warnings (`file:line`). The CLI and MCP read files, so what lands there is **a resolved absolute path** (when `parseFiles` is handed a dictionary of strings, it is that key).

## 2. Derivation in plan

**Shared edges.** The wall centerline segment between two spaces is derived as the shared edge of their rectangle unions — the interval where they overlap on the same line. Collinear intervals are merged into one, so an opening can be placed on a single segment even when it spans several rectangles.

**Exterior boundaries.** A boundary with a space that has no region (an `exterior`, say) is what remains of the room's perimeter once the intervals shared with other spaces are removed. Because that remainder is split across several edges, placing an opening requires selecting one with `edge:`. The compass direction of `edge` is read from the rectangle of the a side (the space written first).

**Default boundaries (ADR-0014).** Where two spaces with regions touch in plan on the same level (including two spaces whose level is undetermined) and not one boundary is declared for that pair, a `wall` default boundary is derived after composition (`derived`). This is the horizontal "default is a wall", symmetric with the vertical "default is a floor" — an undeclared contact means "wall", not "undefined". A default wall carries no door and so is not passable, and it is drawn identically to a bare declared wall. If even one boundary is declared for that pair (including an edge-restricted one), nothing is derived. Contact with an `exterior` that has a region also derives one (and counts toward road frontage). Default boundaries do not appear in the canonical JSON — the canonical JSON is the authored composition, and the meaning, after derivation, lives in the Model.

**Placing openings.** A ratio `at` is the center position along the segment, clamped so that the opening stays within it. An explicit grid-reference position is not clamped — if center ± w/2 leaves the segment it is an error (within a tolerance), as is using a Y reference on a horizontal segment or an X reference on a vertical one. Openings on the same segment must satisfy center-to-center distance ≥ (w₁+w₂)/2.

## 3. Vertical derivation and the height invariant

**Vertical adjacency is not declared.** Spaces on consecutive levels are vertically adjacent where they overlap in plan. The default reading is "there is a floor". Only the exceptions are declared as boundaries: `stair` (passable), `shaft` (continuous but not passable), or `void` (the absence of a floor).

**The height invariant (the floor-height check).** For each space, `ceiling height (heff) + the slab above ≤ the floor-to-floor height (to the next level's z)` is checked, and exceeding it is a collision error. `levels` displays this stack-up as a textual section. **Void exemption**: a lower space joined by a void boundary is declaratively exempted from the invariant. Only at a coverage ratio ≥99% (a full-height void) may a ceiling height that spans levels be declared — under a partial void the lower ceiling height stays within its own floor. The space above a void is expected to be `type:void` (otherwise a warning — the implementation and its tests are the norm here, and the spec was brought into line with them; ADR-0013).

## 4. Derived properties

**Semi-outdoor (isSemiOutdoor).** Derived rather than declared: a space that has a region and carries an `open` or `air:1` boundary with the outside (`type:exterior`). Balconies, terraces, exterior stairs, and gardens become this. It is reported separately in the area table (not counted as interior floor area), given a coefficient in the daylight check, and drawn in a paler tone with thinner lines in plan.

**Covered above (isCoveredAbove).** Whether a space is overlapped from above by a space on any level. Even the presence of a roof is derived rather than declared — the semi-outdoor coefficient in the daylight check (below) reads it.

**Passability (passable).** A wall is passable only when it carries a door. `open` and `stair` are always passable. `shaft` and `void` are never passable. `air:1` is about shielding, not about passage (a railing wall cannot be walked through).

## 5. The checks (check), in one table

The primary form of `check` is a structured diagnostic (`checkDiagnostics` — ADR-0016): `code` (the ledger below, which is the implementation's `DIAGNOSTIC_CODES`; a test machine-checks that the two agree), `severity` (an invariant property of the code — to change the weight, mint a new code), `message` (the Japanese body — no position prefix), provenance (`line`/`file`), the subject path (`path` — for a boundary, both paths), and a related position (`related` — the earlier of a duplicate pair, and so on). `check` also returns a compatible string form (`file:N行目: body`), with the same items in the same order. An error says the composition does not stand up; a warning says something is suspect.

Diagnostic messages are emitted in Japanese by the implementation. The English gloss in the table is a description, not the message text.

| Code | Severity | Summary |
|---|---|---|
| REF01 | error | A boundary references an undefined space path |
| BND01 | error | A boundary between a space and itself |
| BND02 | error | A duplicate boundary on the same pair of spaces (identical down to the edge restriction — this covers a wall/open contradiction. ADR-0013; related = the earlier one) |
| BND03 | error | A wall boundary to a space on a different level (vertical takes type:stair/shaft/void) |
| BND04 | error | A boundary between spaces that do not touch (no segment can be derived) |
| LVL01 | error | Duplicate level z |
| GEO01 | error | Overlapping regions within one space (the rectangles of the union) |
| GEO02 | error | Overlapping regions between spaces on the same level (related = the later one) |
| VRT01 | error | The premise of a vertical boundary (stair/shaft/void) — it may only join spaces that have both a region and a level |
| VRT02 | error | A vertical boundary between non-adjacent levels |
| VRT03 | error | A vertical boundary between spaces that do not overlap in plan |
| OPN01 | error | Wrong axis for hinge (W/E on a horizontal segment, N/S on a vertical one) |
| OPN02 | error | Openings overlapping on the same segment (center to center < (w₁+w₂)/2) |
| OPN04 | error | There is no boundary segment on which to place the opening |
| OPN05 | error | Several boundary segments — ambiguous (select a side with edge:) |
| OPN06 | error | The opening is wider than the boundary segment |
| OPN07 | error | Wrong axis for an explicit opening position (a Y reference on a horizontal segment, an X reference on a vertical one) |
| OPN08 | error | An explicit opening position overruns the segment (grid references are not clamped — within a tolerance) |
| SEG01 | error | An area on a space that has no region |
| SEG04 | error | There is no boundary segment on which to place the seg (the seg counterpart of OPN04) |
| SEG05 | error | Several boundary segments for the seg — ambiguous (the seg counterpart of OPN05) |
| SEG06 | error | The seg is wider than the boundary segment (the seg counterpart of OPN06) |
| SEG07 | error | Wrong axis for an explicit seg position (the seg counterpart of OPN07) |
| SEG08 | error | An explicit seg position overruns the segment (the seg counterpart of OPN08) |
| HGT01 | error | Height invariant violated — collision into the floor above (ceiling height + the slab above > the floor-to-floor height) |
| HGT02 | error | Insufficient coverage for a partial void (below 99% coverage a ceiling height spanning levels may not be declared) |
| SIT01 | error | Duplicate vertex in the site shape |
| SIT02 | error | The site shape is self-intersecting |
| UID01 | error | A uid made only of digits (the parser's numeric coercion would lose the distinction between tokens — ADR-0015) |
| UID02 | error | A uid containing whitespace |
| ATT01 | error | An interpreted attribute's value is not a positive number (`h` `riser` `tread` `entry` `landing` `lane` `slope` `road` `area` — a value that does not match the ledger's type never quietly falls back to the default. ADR-0028) |
| ATT02 | error | An interpreted attribute's value is not in the ledger's vocabulary (`ceiling` 0/1, `turn` R/L, `site` 0/1, `style` hinged/sliding/auto — ADR-0028) |
| UID03 | error | A duplicate uid (unique across the whole model, spanning space and zone) |
| DAY01 | error | The value of daylight is neither 0 nor 1 (being in scope is a binary declaration — ADR-0020) |
| VER01 | error | A default boundary would be derived in a koyu 0.1 file (an older version is accepted only when meaning is preserved — ADR-0017) |
| VER02 | error | In a koyu 0.3-or-earlier file, a space of a type that used to be inferred in scope (unit/room/ldk/bedroom/living) carries no daylight (in 0.4 it falls out of scope, so the meaning changes — ADR-0020) |
| VER03 | error | A koyu 0.4-or-earlier file uses a 0.5 word (a vertical-circulation declaration, a drawn line, a column, underground) — the older processor does not know the word, so the form is silently never generated (ADR-0017/0021/0022/0023) |
| SYN01 | error | A syntax or composition error (a copy of SourceError — `check --json` only; check does not turn thrown exceptions into diagnostics, the parser throws them) |
| BND05 | warning | A pair of spaces carrying a mix of edge-restricted and unrestricted boundaries (the segments overlap) |
| BND06 | warning | The boundary segment is of zero length (no edge remains on the perimeter) |
| VRT04 | warning | The space above a void boundary is not type:void |
| VRT05 | warning | An opening on a vertical boundary (not interpreted) |
| VRT06 | warning | A seg on a vertical boundary (not interpreted) |
| OPN03 | warning | An opening on an open boundary (it has no effect on passage — it is always passable) |
| SEG02 | warning | An area spills outside its parent region |
| SEG03 | warning | A seg on an open boundary (no wall — not interpreted) |
| ZON01 | warning | An empty zone (no spaces beneath it) |
| ZON02 | warning | A zone sharing a path with a space |
| HGT03 | warning | The slab of the level above is undeclared, so the height check cannot run |
| HGT04 | warning | The ceiling height is unknown, so the height check cannot run |
| HGT05 | warning | A space with a region whose level cannot be determined |
| SIT04 | warning | A polygon with no corresponding zone |
| RUN01 | error | More than one vertical-circulation declaration on one space (stair/ramp/escalator/lift — one per space. ADR-0021) |
| RUN02 | error | The value of a vertical-circulation declaration is not an ascending direction (N/E/S/W; for lift it is 1) |
| RUN03 | error | The region of a vertical circulation is not a single rectangle, or its level cannot be determined (a union gives no step division) |
| RUN05 | error | `form` is not straight/return, or a device that cannot fold declares one, or the flight length comes out at zero or less |
| LIN01 | error | A drawn line does not separate the two spaces (both allocations must fall on opposite sides), or neither space has a region |
| LIN02 | error | A line is drawn on a vertical boundary (drawing a line is an act of dividing a plan) |
| LIN03 | warning | A drawn line cuts nothing (one side comes out empty) |
| COL01 | warning | Not one column stands for a column declaration (the grid intersections have no floor — ADR-0023) |
| COL02 | warning | A column declaration stands nowhere because an earlier declaration took the same intersections (the earlier one wins) |
| RUN04 | warning | No level above, so no form can be generated for the vertical circulation (a stair on the top floor and the like) |
| BND07 | — | Retired — the "these touch but no boundary is declared" warning was abolished by ADR-0014 (an undeclared contact means the default wall) |

## 6. Queries — the same description, read differently

**doors (egress and circulation).** The path of fewest doors over the space graph (edges are drawn by the passability of §4). `doorsBetween(from, to)` → the door count and the list of intermediate paths, or undefined if unreachable.

**stats (area).** Interior floor area = the sum of the wall-centerline areas of spaces that have both a region and a level and are neither void, nor exterior, nor semi-outdoor. Subtotals by level; semi-outdoor reported separately; by zone (the sum over a path prefix — subdividing a dwelling into rooms never loses the language of the unit); by type; and by use (the effective use after zone→space inheritance).

**light (daylighting).** Subjects: **only** the spaces with a region that carry `daylight:1` — being in scope is declared, never inferred from the type (the default is out of scope; ADR-0020). Where the denominator sits — a whole dwelling unit, or each room it is divided into — is chosen by the author, as the place `daylight:1` is written. Window area = the sum of w×h over the windows on that space's boundaries that carry `h`. Coefficient: 0.7 if the semi-outdoor space beyond the window **has a space above it** (under a balcony, under an eave), 1.0 if it is open above. Verdict: effective window area ≥ floor area / 7 (a coarse test, with no correction factors). The 1/7 ratio comes from the Japanese Building Standards Act.

**site (the site).** Subject: zones marked `site:1`. Site area = the shoelace formula over the polygon if there is one, otherwise the union of the spaces on the site and the interior footprint — reconciled against the declaration (`area:`, the surveyed value) to ±0.05 m². A mismatch also becomes a warning in `check` (when a polygon is present — the same test in the CLI, the API, and MCP; ADR-0013). Road frontage = the total length of the boundary segments between spaces beneath the site zone and exteriors carrying `road:width` (the part where the building's own outer wall faces the road is not counted). Building footprint area = the union of the horizontal projections of the interior spaces (the inclusion rules are coarse). Building coverage ratio and floor area ratio are the quotients of these. These are terms of the Japanese Building Standards Act.

**levels (the section stack-up).** Displays the levels in z order, as the stack-up of floor-to-floor height = ceiling height + slab + the remainder.

## 7. The conventions of drawing (plan)

Form is a generated artifact — that several forms come from one composition is not a defect. The conventions of svgPlan: spaces are a pale fill (semi-outdoor paler still); walls are a black band along the derived segment (its weight from `t`); an open boundary is dashed; `air:1` is a thin solid line; a void is a dashed diagonal (with an "open above" projection on the level below); a door is its hinge and the quarter-circle of its swing (sliding/auto get a panel on the pocket side); a window is a centerline; a `seg` is a change of tone; an `area` is a pale fill with a dashed outline. Grid lines and their markers are drawn. The lowest level doubles as the site plan, drawing the site shape as a chain-dotted site boundary line (the polygon is included when reserving the sheet area).
