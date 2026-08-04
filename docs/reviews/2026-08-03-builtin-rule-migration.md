# Built-in rule migration audit

- Date: 2026-08-03
- Status: internal review; no implementation decision is made here
- Scope: `src/validate/{access,envelope,light,runs,site,index}.ts`, the callers and executable documentation that constrain them

## Executive finding

The old validation surface contains exactly fifteen failure-only rules. They are not fifteen independent calculations. They are five scans plus the column collision scan embedded in `access.ts`, all invoked by `validate(model)` in a fixed chapter order.

None of the fifteen reads external context. The current source infers every population and applicability decision from `.muro`, free type words, interpreted attributes, hard-coded constants, and the existence or absence of declarations. Even the two rules whose comments cite Japanese law (`daylight.ratio` and `site.frontage`) do not receive jurisdiction, effective date, occupancy/applicability, exceptions, or authority-supplied limits.

For a behaviour-preserving 0.18.0 cutover, the smallest neutral analysis catalog has six providers:

1. envelope facts,
2. daylight facts,
3. vertical-run facts,
4. access/reachability facts,
5. door/column collision facts, and
6. site facts.

The fifteen old finding names then become fifteen Rules over those artifacts. The parity catalog needs no `ContextKey` values; it still requires an explicit profile and a valid `ContextSnapshot` header (`schema`, `asOf`, and an empty `values` object). Adding contextual applicability now would be a rule change, not a mechanical migration.

Every old rule already has an executable triggering source under `docs/reference/validate/`. `test/guide.test.ts` discovers the fifteen sections and asserts that the first `muro-fail` or `muro-caution` block in each section is core-consistent and produces exactly one finding of its own old ID. These blocks are the primary parity fixtures. They should be reused, not transcribed.

Three policy choices remain open and are listed under [Unresolved decisions](#unresolved-decisions). Until they are answered, the tables below use the parity-only provisional namespace `koyu.schematic.<old-id>` and preserve one `run.slope` Rule.

## Current implementation topology

| Source | Current rules | Neutral computation it already uses | Current hidden coupling |
|---|---|---|---|
| `src/validate/envelope.ts` | `envelope.gap` | `envelopeGaps`, segment lengths, space classifications | the Rule also decides when a level has “started” its envelope |
| `src/validate/light.ts` | `daylight.ratio`, `daylight.unknown` | `daylightInputs` | the Rule owns 1/7; the analysis already embeds the covered-semi-outdoor factor 0.7 |
| `src/validate/runs.ts` | `stair.proportion`, `run.slope`, `run.disconnected` | `verticalRuns`, vertical-boundary endpoints | one function interleaves topology and dimensional judgements one run at a time |
| `src/validate/access.ts` | five `access.*` rules | passability, several BFS variants, `effectiveUse` and free type words | traveller assumptions, population inference, and verdict emission are in one file |
| `src/validate/access.ts` | `column.blocksdoor` | `columnsFor` and `placeOpening` | unrelated collision analysis is appended to the access scan |
| `src/validate/site.ts` | three `site.*` rules | `siteReport`, polygon area/containment | raw facts and the 2m/0.05m² thresholds share a function |
| `src/validate/index.ts` | closed ledger and `validate(model)` | concatenation only | implicit built-in selection, no profile/context, and failure-only `Finding[]` |

The current execution order is:

```text
envelopeFindings
→ daylightFindings
→ runFindings
→ accessFindings (including column.blocksdoor)
→ siteFindings
```

Within `runFindings`, findings for one run are interleaved (`run.disconnected` before the dimensional rule for that same run). Within `siteFindings`, frontage is scanned first, then area and escape per polygon. Separate Rules in the new protocol are grouped by rule-set declaration order, so old cross-rule interleaving cannot and need not be byte-preserved. Trigger population, subject, level, observed/required values, and evidence are the parity contract.

## Proposed parity analysis catalog

All identities below use revision `"1"`. All six definitions should declare `model: "consistent"`: every authoritative old rule fixture is explicitly required to have zero core errors, and the assessment protocol must not turn a broken model into a completed pass.

| Analysis ID | Existing sources | Artifact required for parity | Dependencies | Required ContextKeys |
|---|---|---|---|---|
| `koyu.analysis.envelope` | `envelopeGaps`, `segmentLength`, `isOutside`, `isSemiOutdoor` | envelope-started levels; eligible spaces; gap runs with edge, length and source; total gap length | none | `[]` |
| `koyu.analysis.daylight` | `daylightInputs`, `COVERED_SEMI_FACTOR` | each `daylight:1` space; floor m²; effective window m²; qualifying windows; factor and exposure provenance; missing-height opening refs | none | `[]` |
| `koyu.analysis.vertical-runs` | `verticalRuns`, boundary kinds, source `slope:` | device, run dimensions, risers, riser/tread, slope, declared slope limit, and whether its path is an endpoint of a stair/shaft boundary | none | `[]` |
| `koyu.analysis.access` | `passable`, `effectiveUse`, `isOutside`, `isVoid`, the four BFS variants in `access.ts` | explicit populations and route observations for person, void-neighbour, rentable-avoiding stair, vehicle, and common-corridor/backyard-avoiding travel | none | `[]` |
| `koyu.analysis.door-column-collisions` | `columnsFor`, `placeOpening` | each placeable door, its placed segment/span, derived columns, strict overlap pairs, source refs | none | `[]` |
| `koyu.analysis.site` | `siteReport`, `polygonAreaM2`, `regionOf`, `shapeEscapesPolygon` | selected site/roads, raw and displayed areas, rounded frontage, eligible spaces, first escape point and tolerances | none | `[]` |

The analysis artifacts must expose facts, not old verdict names. For example, access analysis may say that no vehicle route exists under the named traveller profile; it must not say that a parking space violates a rule. The Rule chooses the population and turns the observation into pass/fail.

The access provider must preserve five distinct traversal definitions. Folding them into one generic `reachable` boolean would lose current behaviour:

- person-passable: open or stair boundary, or any wall with a door;
- an intermediate `void:1` or type `shaft` is avoided by `reachableAvoiding`;
- the specialised `reachableFromExterior` used by `access.unreachable` does **not** perform that intermediate-space check;
- vehicle-passable: open, a wall door at least 2400mm, or a stair-kind vertical boundary incident to a space carrying `ramp:`;
- back-of-house travel additionally removes the target run's own incident stair-kind boundary.

The site provider must retain two area representations. `siteReport.derivedArea` is rounded to 0.01m², while `site.area` currently compares the declared value against raw `polygonAreaM2`. Reusing only the rounded report number would change values near the 0.05m² tolerance.

## Complete old-rule mapping

The new IDs in this table are **provisional parity IDs**, pending the jurisdiction naming decision. Revision is `"1"` throughout. `context []` means no value key; an explicit profile and `ContextSnapshot.asOf` are still mandatory.

| Old ID → provisional Rule ID | Level | Required analysis | Applicable population and exact fail condition | Current threshold / source | Context | Existing triggering fixture |
|---|---|---|---|---|---|---|
| `envelope.gap` → `koyu.schematic.envelope.gap` | caution | `koyu.analysis.envelope` complete | Regioned spaces on a level with at least one declared boundary to **any regionless space**, excluding outside, semi-outdoor and children of every `site:1` zone. Fail when one or more `envelopeGaps` remain. | No architectural threshold. Core drops gap runs `<= SPAN_EPS` where `SPAN_EPS=1mm` (`src/core/graph.ts`, `src/core/tolerance.ts`). | `[]` | `docs/reference/validate/envelope.md:20` |
| `daylight.ratio` → `koyu.schematic.daylight.ratio` | violation | `koyu.analysis.daylight` complete | Every regioned space declaring `daylight:1`. Fail when `effectiveWindowM2 + 1e-9 < floorM2 / 7`; otherwise pass. | `DAYLIGHT_DIVISOR=7` in `src/validate/light.ts`, described as a coarse copy of Building Standards Act Art. 28(1). Exposure factor 0.7 is in core, not this threshold. | `[]` | direct fixture `docs/reference/validate/daylight.md:44`; covered-0.7 fixture `:71` |
| `daylight.unknown` → `koyu.schematic.daylight.unknown` | caution | `koyu.analysis.daylight` accepts partial | Same daylight population. Fail when at least one window on a non-zero-factor boundary lacks `h:`; indoor-facing windows are ignored. | No numeric threshold. Missingness is `DaylightInput.missingH`; qualifying exposure factors are 1/0.7/0 in `src/core/light.ts`. | `[]` | `docs/reference/validate/daylight.md:103` |
| `stair.proportion` → `koyu.schematic.stair.proportion` | caution | `koyu.analysis.vertical-runs` complete | Derived runs whose device is `stair`. Round tread and riser independently; fail if rounded tread `<240`, or `2×roundedRiser+roundedTread <550` or `>700`. | `TREAD_MIN=240`; `STEP_RULE=550..700` in `src/validate/runs.ts`. Comment cites a rough general Art. 23 lower bound and an uncited pace rule. | `[]` | `docs/reference/validate/runs.md:34` |
| `run.slope` → `koyu.schematic.run.slope` | caution | `koyu.analysis.vertical-runs` complete | (a) ramp with positive numeric `slope:`: fail if derived slope `>1/declared + 1e-9`; a ramp without it is outside the population. (b) escalator: fail if derived slope `<1/2.3` or `>1/1.4`. Stair/lift excluded. | Ramp limit is project-authored `slope:` in `.muro`; escalator band `1/2.3..1/1.4` is a local “usual 30°” heuristic in `src/validate/runs.ts`. | `[]` | ramp `docs/reference/validate/runs.md:104`; escalator `:130` |
| `run.disconnected` → `koyu.schematic.run.disconnected` | caution | `koyu.analysis.vertical-runs` complete | Every derived run except lift. Fail when its space path is not an endpoint of any boundary whose kind is `stair` or `shaft`; the destination level is not checked. | No numeric threshold; current topology predicate in `src/validate/runs.ts`. | `[]` | `docs/reference/validate/runs.md:154` |
| `access.unreachable` → `koyu.schematic.access.unreachable` | violation | `koyu.analysis.access` complete | Applicable only if at least one `outside:1` space exists. Population: regioned spaces excluding outside, `void:1`, and type `shaft`. Fail when absent from the component reached from all outside spaces using `passable`. | No numeric threshold. Person passability is `src/core/graph.ts#passable`. Current exterior BFS does not call `impassable` for intermediate nodes; preserve this quirk for parity. | `[]` | `docs/reference/validate/access.md:38` |
| `access.voidonly` → `koyu.schematic.access.voidonly` | violation | `koyu.analysis.access` complete | Regioned non-outside/non-void/non-shaft spaces with at least one incident passable boundary. Fail if every passable neighbour exists and declares `void:1`. A variable named `doors` also counts open/stair boundaries. | No numeric threshold; `passable` and `isVoid` from model/graph. | `[]` | `docs/reference/validate/access.md:80` |
| `access.throughtenant` → `koyu.schematic.access.throughtenant` | caution | `koyu.analysis.access` complete | Applicable only with outside. Population: regioned spaces whose free type word is exactly `stair`. Fail if no route to outside exists while avoiding spaces whose effective use is `rentable`. It does **not** first prove that a route through rentable space exists, so a wholly unreachable stair also fails. | No numeric threshold. `stair` free type and inherited `use:rentable` are the entire current basis; no lease permission context is read. | `[]` | `docs/reference/validate/access.md:117` |
| `access.parking` → `koyu.schematic.access.parking` | violation | `koyu.analysis.access` complete | Applicable only with outside. Population: regioned non-outside/non-void/non-shaft spaces with effective use `parking`. Fail if no vehicle-passable route reaches outside. | `CAR_WIDTH_MIN=2400mm` in `src/validate/access.ts`; no cited authority. Open boundaries pass; stair-kind links pass only when either endpoint carries `ramp:`. | `[]` | `docs/reference/validate/access.md:149` |
| `access.backofhouse` → `koyu.schematic.access.backofhouse` | caution | `koyu.analysis.access` complete | Applicable only when some regioned type `corridor` has effective use `common`. Population: regioned, non-`shaft` spaces carrying `stair:` or `escalator:` and effective use `common`. Fail if no horizontal-entry route from any common corridor avoids free type `backyard`. | No numeric threshold. Public/staff intent is inferred solely from free type and `use:common`; no operating context is read. | `[]` | `docs/reference/validate/access.md:186` |
| `column.blocksdoor` → `koyu.schematic.column.blocksdoor` | violation | `koyu.analysis.door-column-collisions` complete | Every placeable door on a boundary with a resolvable level. Fail if the open interval along its placed span overlaps a derived column and the segment passes through the column interior. Emit at most the first column per door. Unplaceable doors are excluded because core diagnoses them. | No tolerance: both `along` and `across` use strict `<`; edge-touch is not overlap. Door width and derived column `w/d` are observations. | `[]` | `docs/reference/validate/column.md:32` |
| `site.escape` → `koyu.schematic.site.escape` | violation | `koyu.analysis.site` complete | For every polygon whose same-path zone declares `site:1`, evaluate every regioned space except outside and paths below that polygon path. Fail once per space/polygon at the first derived piece escaping. | `EPS_SITE=1mm` in `src/validate/site.ts`; line counts inside. This is an internal geometry tolerance, not an authority threshold. | `[]` | `docs/reference/validate/site.md:26` |
| `site.area` → `koyu.schematic.site.area` | caution | `koyu.analysis.site` complete | Polygon/site-zone pairs whose zone has numeric `area:`. Fail when `abs(declared - rawPolygonArea) >= 0.05m²`; absent `area:` is not-applicable. | `AREA_TOLERANCE=0.05m²` private constant in `src/validate/site.ts`; internal reconciliation tolerance, no cited authority. | `[]` | `docs/reference/validate/site.md:60` |
| `site.frontage` → `koyu.schematic.site.frontage` | violation | `koyu.analysis.site` complete | Applicable only when `siteReport` selected a `site:1` zone. Population: each outside space with numeric `road:` returned by `siteReport`. Fail when its **rounded integer-mm** frontage is `<2000`; no road means no population, not pass. | `FRONTAGE_MIN=2000mm` in `src/validate/site.ts`, described as a coarse copy of Building Standards Act Art. 43. Applicability/exceptions are not modelled. | `[]` | `docs/reference/validate/site.md:99` |

### Rule applicability and outcome conversion

Old functions emit only failures. The new protocol cannot infer pass from silence, so each Rule must explicitly return:

- `not-applicable` when the population/guard in the table is empty;
- `applicable` with one pass or fail outcome per population subject when inputs are complete;
- `indeterminate` when a required analysis/context value is partial or unavailable under the Rule's declared acceptance;
- `error` only for an exception or malformed provider/rule result.

An old `violation` or `caution` becomes the immutable Rule `level`. Every old finding on a core-consistent model becomes one fail outcome for the mapped Rule with the same subject(s). Messages are presentation; numeric observed/required evidence and source refs are the parity target.

For provisional packaging, the full fifteen-rule set can be:

```text
koyu.ruleset.schematic-screen@1       purpose: design-lint
koyu.profile.schematic-screen@1       analyses: the six IDs above
                                      ruleSets: [koyu.ruleset.schematic-screen@1]
```

The RuleSet should retain the old ledger/document order. The new deterministic report will group outcomes by Rule; it will not preserve the old per-run and per-polygon cross-rule interleaving.

## Threshold and provenance audit

| Value | Current owner | Actual origin recorded in repository | Migration treatment |
|---|---|---|---|
| `SPAN_EPS=1mm` | core envelope gap derivation | general geometry/form tolerance | analysis evidence/profile revision; not a Rule threshold |
| covered-semi factor `0.7` | core daylight derivation | “rough engawa correction”; no authority citation | analysis evidence/profile revision; do not duplicate in Rule/CLI/MCP |
| daylight divisor `7` | validation Rule | coarse Art. 28(1) copy | Rule constant and comparison evidence for parity; legal namespace/applicability unresolved |
| daylight comparison epsilon `1e-9m²` | validation Rule | floating-point guard, undocumented in threshold table | Rule implementation detail pinned by boundary test |
| tread `240mm` | validation Rule | comment says rough general Art. 23 lower bound | Rule constant/evidence; it is not a complete statutory stair classifier |
| pace band `550..700mm` | validation Rule | local ergonomic pace rule, no cited source | Rule constant/evidence |
| ramp `1/slope:` | `.muro` | author-declared acceptable limit | analysis observation plus Rule comparison; not ContextSnapshot |
| ramp epsilon `1e-9` | validation Rule | floating-point guard | Rule implementation detail |
| escalator `1/2.3..1/1.4` | validation Rule | local “usual 30°” band, no cited source | Rule constant/evidence |
| vehicle door `2400mm` | access traversal | local heuristic, no cited source | named access-analysis traveller profile and evidence; changing it changes route facts |
| site containment `1mm` | site analysis/judgement mix | internal geometry tolerance | analysis evidence/profile revision |
| site area `0.05m²` | validation Rule and MCP `areaMatch` | internal reconciliation tolerance | Rule constant/evidence; remove MCP duplicate |
| frontage `2000mm` | validation Rule | coarse Art. 43 copy | Rule constant/evidence for parity; legal namespace/applicability unresolved |

There is a published contradiction around daylight. `src/core/light.ts`, MCP `light`, `docs/reference/validate/daylight.md`, and the executable 0.7 fixture all apply the covered-semi factor. The comments in `src/validate/light.ts`, the CLI summary, and `docs/reference/cli/light.md` say “no correction factor”. The calculation and tested fixture are the parity evidence; those sentences must be rewritten rather than changing the 0.7 result during migration.

## Existing parity fixtures

### Primary fixture matrix

`test/guide.test.ts:430` is the only existing mechanism that covers all fifteen Rules uniformly. It discovers the first triggering block after every Rule heading and asserts:

1. parsing succeeds,
2. core emits no error,
3. the named old Rule appears exactly once.

The complete block map is:

| Rule | Triggering block |
|---|---|
| `envelope.gap` | `docs/reference/validate/envelope.md:20` |
| `daylight.ratio` | `docs/reference/validate/daylight.md:44` (plus the 0.7 case at `:71`) |
| `daylight.unknown` | `docs/reference/validate/daylight.md:103` |
| `stair.proportion` | `docs/reference/validate/runs.md:34` |
| `run.slope` | `docs/reference/validate/runs.md:104` ramp; `:130` escalator |
| `run.disconnected` | `docs/reference/validate/runs.md:154` |
| `access.unreachable` | `docs/reference/validate/access.md:38` |
| `access.voidonly` | `docs/reference/validate/access.md:80` |
| `access.throughtenant` | `docs/reference/validate/access.md:117` |
| `access.parking` | `docs/reference/validate/access.md:149` |
| `access.backofhouse` | `docs/reference/validate/access.md:186` |
| `column.blocksdoor` | `docs/reference/validate/column.md:32` |
| `site.escape` | `docs/reference/validate/site.md:26` |
| `site.area` | `docs/reference/validate/site.md:60` |
| `site.frontage` | `docs/reference/validate/site.md:99` |

The migrated harness should run the same source through the explicit registry/profile/context and assert one fail outcome for the mapped Rule, matching level, subject and numeric evidence. It must not merely look for any failure of the same level.

### Supplemental executable evidence

| Behaviour | Existing test |
|---|---|
| daylight failure at 0.36m² and passing 51-room corpus with 0.7 factor | `test/design2.test.ts:78-105` |
| `daylight:1` alone selects the population | `test/design2.test.ts:116-132` |
| ramp declared-slope failure | `test/runs.test.ts:187-200` |
| disconnected form/topology mismatch | `test/runs.test.ts:202-211` |
| concave-site escape, boundary-line pass, area mismatch/pass | `test/guarantees.test.ts:90-132` |
| site escape excludes site tiles and reports first point | `test/polygon.test.ts:57-72` |
| misspelled `site:` cannot silently disable `site.escape` | `test/diagnostics.test.ts:98-114` |
| source/subject shape of a `site.escape` Finding | `test/diagnostics.test.ts:319-337` |
| frontage fixture and Diagnostic/Finding separation | `test/domains.test.ts:74-103` |
| CLI violation exit and JSON old ID | `test/cli.test.ts:199-223` |
| example gate consumes eight selected old IDs | `scripts/gate.mjs:45-53,104-114` |

The audit command actually run was:

```sh
node --import tsx --test test/guide.test.ts test/design2.test.ts test/runs.test.ts test/guarantees.test.ts test/polygon.test.ts test/domains.test.ts test/cli.test.ts
```

It completed with **133 tests, 133 pass, 0 fail**.

### Missing boundary fixtures

The triggering examples are intentionally obvious failures. They do not fix every inclusive/exclusive edge. Migration needs additional tests at:

- daylight exactly `floor/7` and either side of the `1e-9` guard;
- stair tread exactly 240 and pace exactly 550/700;
- ramp exactly declared slope and either side of its epsilon;
- escalator exactly `1/2.3` and `1/1.4`;
- car doors at 2399/2400mm;
- strict door/column edge-touch versus positive overlap;
- envelope gap lengths at 1mm and just above;
- site escape on/just beyond the 1mm tolerance;
- site area deltas just below/exactly/above 0.05m² using the raw polygon value;
- frontage after rounding at 1999/2000mm.

These are new tests of existing semantics, not new thresholds.

## CLI, MCP, scripts and documentation migration

| Consumer | Current behaviour | Required migration |
|---|---|---|
| CLI `validate` (`src/cli.ts:212-235`) | implicit all-builtins `validate(model)`; `Finding[]`; no profile/context | require explicit profile/context, call shared assessment operation, emit `AssessmentReport`; derive human lines and exit policy from it |
| CLI `light` (`src/cli.ts:383-408`) | calls `daylightInputs`, calls `validate` again, and hard-codes `/7` in presentation | call the shared analysis operation with explicit profile/context; make it analysis-only, or present the daylight Rule from the assessment report—never recompute either |
| CLI `site` (`src/cli.ts:409-446`) | calls raw `siteReport`; no profile/context | call `runAnalysis(koyu.analysis.site, profile, context)` and format `AnalysisReport` only |
| MCP `validate` (`src/mcp.ts:313-327`) | file-only schema; custom `{findings, violations, cautions, note}` | require profile/context and return the same `AssessmentReport` DTO as TS/CLI |
| MCP `light` (`src/mcp.ts:298-312`) | raw custom DTO, correctly no verdict, but no profile/context | use shared analysis operation; same `AnalysisReport` DTO as TS/CLI |
| MCP `site` (`src/mcp.ts:328-355`) | raw custom DTO; privately recomputes `areaMatch <0.05` | use shared site analysis; remove the duplicate comparison from the adapter |
| `scripts/gate.mjs` | implicit validate and eight old IDs | build/pass explicit builtin registry/profile/context; map gates to new IDs and fail outcomes |
| `eval/score.ts` | filters old `daylight.ratio` Findings | consume the explicit profile's mapped Rule outcomes |
| `test/guide.test.ts` | imports closed ledger and old validate | use builtin rule metadata and explicit assessment operation; preserve the source-block discovery oracle |
| `test/domains.test.ts` / `test/docs-ledger.test.ts` | closed `VALIDATION_RULES` set and two-part ID regex | bind builtin catalog, profile selection and namespaced identity instead |
| `test/cli.test.ts` | old Finding JSON and file-only call | require missing-profile exit 2 and deep-equal CLI JSON/TS report fixtures |
| `test/mcp.test.ts` | tool list and general smoke; no validate equivalence | add missing-profile error and direct/CLI/MCP deep-equality fixtures for assess and analysis |

Published material that embeds the old contract includes:

- `docs/reference/validate/index.md` and all six family pages;
- `docs/reference/cli/validate.md`, `light.md`, `site.md`, `ci.md`, and `index.md`;
- `docs/reference/mcp/tools-verify.md` and `tools-ask.md`;
- `docs/reference/api/index.md`;
- `docs/reference/scope.md`, `docs/why/two-kinds-of-green.md`, and the embedding/agent-loop/site how-tos.

The family-page `.muro` sources should remain the parity fixtures while the surrounding IDs, DTO examples, profile/context invocation and explanation are rewritten. Published pages must explain the current contract directly and must not cite this review.

## Unresolved decisions

These choices cannot be derived from the old implementation. They were reported immediately and must be answered before the provisional IDs/catalog become implementation constants.

### 1. Schematic namespace or Japanese-law namespace

| Option | IDs | Code impact | Fixture impact |
|---|---|---|---|
| A — parity/schematic (used provisionally above) | all fifteen remain `koyu.schematic.<old-id>` | one non-jurisdictional design-lint RuleSet; current constants preserved as coarse screening evidence | all existing triggering blocks work with empty context values |
| B — legal names for cited rules | at minimum `jp.bsl.article-28.daylight-ratio` and `jp.bsl.article-43.frontage`; the other thirteen remain schematic | split RuleSets/profile; add authority/effective/jurisdiction metadata and decide whether incomplete statutory applicability can use those names | fixtures need a Japan jurisdiction and dated context; they still only prove numeric screening, not full applicability |

The current code is insufficient to claim compliance. It never checks the applicability and exceptions of either article. A `jp.bsl.*` ID therefore needs an explicit decision that it means “early code screen”, or additional context/logic.

### 2. Preserve type/use heuristics or require external route intent

| Option | ContextKeys | Code impact | Fixture impact |
|---|---|---|---|
| A — exact parity (used above) | none | keep `stair`/`corridor`/`backyard` free-type and `use:` inference inside access analysis | existing access fixtures continue to fail |
| B — explicit operational facts | candidate, not approved: `koyu.context.access.route-permissions@1`, `koyu.context.access.public-circulation@1` | `access.throughtenant` and/or `access.backofhouse` require context and no longer infer all intent from type/use | the current blocks become `indeterminate` until each supplies provenanced permission/public-use data; expected outcomes must be rewritten |

Option B is architecturally stronger but is not behaviour-preserving. It also requires defining the JSON value schemas and whether the keys identify spaces, boundaries, or routes.

### 3. Keep or split `run.slope`

| Option | IDs | Code impact | Fixture impact |
|---|---|---|---|
| A — one Rule (used above) | `koyu.schematic.run.slope` | one Rule with ramp and escalator populations; same level, two evidence shapes | current section and both blocks remain one Rule oracle; total remains 15 |
| B — split by meaning | `koyu.schematic.ramp.declared-slope` and `koyu.schematic.escalator.usual-slope` | two Rules and sixteen total; cleaner authority/revision evolution | `docs/reference/validate/runs.md` needs two Rule sections; `test/guide` expects sixteen; old `run.slope` has a one-to-many migration |

The old shared ID is not forced by a shared threshold: one compares against a project declaration and one against an embedded practice band.

## Acceptance evidence for the implementation phase

The migration is equivalent only when all of the following hold.

1. The fifteen old reference blocks produce one fail outcome for their mapped Rule, with the same immutable level and subject population, under an explicit registry/profile/fixed `ContextSnapshot`.
2. The two extra daylight and slope variants exercise the covered-0.7, ramp, and escalator branches separately.
3. A normalized old/new oracle compares old finding count and subjects against new fail outcomes before the old implementation is deleted. The oracle intentionally ignores message text and old cross-rule ordering, and explicitly compares observed/required numbers and units.
4. Every applicable non-failing subject produces an explicit pass outcome; empty population produces `not-applicable`, never a synthetic pass.
5. Missing analysis/context becomes `indeterminate`; provider/rule failures become `error`; neither becomes pass or an architectural fail.
6. The boundary tests listed above pin all inclusive/exclusive comparisons and rounding points.
7. The six analysis artifacts contain no `pass`, `fail`, `level`, compliance summary, or old Rule ID.
8. Rule code receives no `Model`; only its declared analysis/context readers.
9. The provisional/approved builtin profile lists all six analyses and the RuleSet explicitly; no import-time or global registration exists.
10. Direct TypeScript operation, CLI JSON, and MCP structured result are deep-equal for one complete failing assessment, one complete passing assessment, one not-applicable assessment, and one incomplete assessment.
11. `light` and `site` adapters contain no 1/7, 0.7, 0.05, 2m, area-inclusion or route calculation.
12. Repository-wide scans find no old `validate(model)`, `VALIDATION_RULES`, old ID filter, old Finding JSON shape, or compatibility alias after every consumer has moved.
13. The bundled examples retain their current canonical JSON and Form; this is an API/rule migration, not a muro semantic change.

The implementation should not “fix” the behavioural quirks identified here inside the parity revision. A later Rule/Analysis revision can correct them with a dedicated fixture and present-tense documentation once the policy choices are explicit.
