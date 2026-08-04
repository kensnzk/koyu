---
title: koyu validate — architectural judgement
mode: reference
---

# koyu validate — architectural judgement

[`koyu check`](../cli/check.md) says only that what is written is not self-contradictory as data. Whether the daylight is sufficient, whether the envelope closes, whether the stair can be climbed, whether a car can leave the garage, whether the building fits on its site — none of that is in there. **`koyu validate` says it, and this volume documents it.**

```sh
koyu validate examples/tower/main.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
  koyu.profile.schematic-screen@1 — 10 evaluated / 6 not applicable / 0 indeterminate / 0 error
```

Every bundled building (`two-rooms`, `office`, `house`, `mansion`, `tower`, `basement`, `complex`, `twin`) currently comes back with nothing caught.

## Nothing runs that you did not name

**There is no default profile, and no rule runs because it was imported.** A rule pack is a value: you compose a registry, name one profile and one context, and pass them in. Leave the profile out and the run stops before it starts — a judgement whose grounds were guessed cannot be reproduced, and one that quietly picked a jurisdiction is worse than one that refused.

The date is explicit for the same reason. koyu never reads the clock to fill it in, so the same file judges the same way twice.

```sh
koyu validate main.muro                                          # exit 2 — no profile
koyu validate main.muro --profile koyu.profile.schematic-screen  # exit 2 — no date
```

## This pack is design lint, not code compliance

koyu ships exactly one profile and one rule set.

| | |
|---|---|
| rule set | `koyu.ruleset.schematic-screen@1` |
| profile | `koyu.profile.schematic-screen@1` |
| purpose | `design-lint` |
| jurisdiction | none |

The names say what they are worth. Some of the constants below recall statute or custom, but **nothing here reads a jurisdiction, an effective date, a use-class condition, an exception or an administrative interpretation** — so no rule is named after a law, and none of them cites an authority. What this pack is good for is an early, reproducible screen at the resolution of a scheme design.

A pack that does apply a law is somebody's to write, and it uses the same public SPI these rules use. See [the API reference](../api/index.md).

## The two greens cannot be spoken of in the same words

So that a judgement is never read as a guarantee about the composition, **the two are different types**.

| | structural diagnostic | architectural finding |
|---|---|---|
| type | `Diagnostic` | `AssessmentFinding` wrapping a `RuleOutcome` |
| identifier | `code: "BND04"` | `rule: { id: "koyu.schematic.daylight.ratio", revision: "1" }` |
| weight | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| per subject | — | `status: "pass" \| "fail" \| "indeterminate"` |
| entry point | `checkDiagnostics(model)` / [`koyu check`](../cli/check.md) | `assess(model, …)` / [`koyu validate`](../cli/validate.md) |
| spelling | three capitals plus two digits | a dotted, namespaced identifier |
| version | frozen | **not frozen** — rules are added, sharpened, dropped |

The field names differ, so the two arrays cannot be confused; concatenate them and the type collapses. Nobody mistakes `ENV01` for `koyu.schematic.envelope.gap` — that is exactly why the spellings were split.

**`level` is an invariant property of the rule.** The same rule is never a `violation` in one model and a `caution` in another. Changing the weight means minting a new rule identity.

## Silence is not a pass

A bare list of failures cannot tell you whether a rule passed, never applied, or could not run at all. The report keeps them apart, and so does the exit code.

| rule state | meaning |
|---|---|
| `evaluated` | the rule had subjects and reached a verdict on each |
| `not-applicable` | nothing in this building is the kind of thing the rule is about |
| `indeterminate` | an input was missing, so no verdict was reached |
| `error` | the rule or its analysis failed to run |

| outcome status | meaning |
|---|---|
| `pass` | this subject meets the rule |
| `fail` | it does not — this is what becomes a finding |
| `indeterminate` | this subject could not be decided |

## Levels and exit codes

| level | meaning | exit code |
|---|---|---|
| `violation` | the rule is not met | 1 |
| `caution` | suspicious, or not fully counted | 0 |

`koyu validate` exits **0 only when the whole set ran and nothing was violated**. An indeterminate rule, a rule that errored, or an inconsistent model exits 1 — **not being able to judge is not the same as passing.** A missing or unknown profile, a missing date, or malformed context exits 2, like any other usage error. `--json` does not change the exit rule.

This is **a different axis** from `check`'s `error` / `warning`. Validation can be green while the composition is broken, and the other way round.

## The ledger — sixteen rules

The rows follow the order the rule set declares them in. **That is not the order of the output within a chapter** — outcomes come out one scan unit at a time.

| rule | level | what it says |
|---|---|---|
| [`koyu.schematic.envelope.gap`](envelope.md#envelope-gap) | caution | part of the outline faces nothing — a hole in the envelope |
| [`koyu.schematic.daylight.ratio`](daylight.md#daylight-ratio) | violation | effective window area is below one seventh of the floor area |
| [`koyu.schematic.daylight.unknown`](daylight.md#daylight-unknown) | caution | a window without `h:` means the window area is not fully counted |
| [`koyu.schematic.stair.proportion`](runs.md#stair-proportion) | caution | the derived step is cramped (going under 240mm, or 2×riser+going outside 550–700mm) |
| [`koyu.schematic.ramp.declared-slope`](runs.md#ramp-declared-slope) | caution | the derived slope is steeper than the ramp's own declared `slope:` |
| [`koyu.schematic.escalator.usual-slope`](runs.md#escalator-usual-slope) | caution | the derived escalator pitch is outside the usual band |
| [`koyu.schematic.run.disconnected`](runs.md#run-disconnected) | caution | the vertical run has a shape but no vertical boundary joining the levels |
| [`koyu.schematic.access.unreachable`](access.md#access-unreachable) | violation | a space with a region cannot reach the outside |
| [`koyu.schematic.access.voidonly`](access.md#access-voidonly) | violation | the doors open only onto a void, where there is no floor |
| [`koyu.schematic.access.throughtenant`](access.md#access-throughtenant) | caution | escape from a stair necessarily passes through a tenancy |
| [`koyu.schematic.access.parking`](access.md#access-parking) | violation | a car cannot get out of the parking |
| [`koyu.schematic.access.backofhouse`](access.md#access-backofhouse) | caution | a vertical run is not reachable from a common corridor without crossing back-of-house |
| [`koyu.schematic.column.blocksdoor`](column.md#column-blocksdoor) | violation | a derived column overlaps a derived door |
| [`koyu.schematic.site.escape`](site.md#site-escape) | violation | the building escapes the site outline |
| [`koyu.schematic.site.area`](site.md#site-area) | caution | the declared and derived site areas disagree |
| [`koyu.schematic.site.frontage`](site.md#site-frontage) | violation | the road frontage is under 2 m |

The chapters (`envelope`, `daylight`, `stair`, `ramp`, `escalator`, `run`, `access`, `column`, `site`) name **subjects, not jurisdictions**.

**A ramp and an escalator are two rules, not one.** They both leave a slope band, but one band is the limit the designer wrote in the file and the other is a custom this pack carries. Different grounds, so either can be revised without touching the other.

## The six analyses

A rule never reads the model. It reads an **analysis** — a versioned computation that returns facts and no verdict at all.

| analysis | what it observes |
|---|---|
| `koyu.analysis.envelope@1` | perimeter runs facing nothing |
| `koyu.analysis.daylight@1` | floor area, effective window area, windows with no `h:` |
| `koyu.analysis.vertical-runs@1` | derived rise, run, tread, riser, slope, and whether a vertical boundary links the levels |
| `koyu.analysis.access@1` | which spaces reach the exterior, and by what route |
| `koyu.analysis.door-column-collisions@1` | derived door and column geometry, and where they intersect |
| `koyu.analysis.site@1` | site area, footprint, total floor, coverage, floor-area ratio, frontage, containment |

An artifact carries measurements, evidence pointing back at the line that produced them, and whatever input was missing. It carries no `pass`, no `fail` and no level. That separation is what lets somebody else's rule pack reuse koyu's arithmetic and draw its own line.

## Thresholds

The thresholds are **numbers on the architectural side**, not invariants the written composition must satisfy. That is why they are gathered in one place.

| constant | value | which rule reads it |
|---|---|---|
| `DAYLIGHT_DIVISOR` | 7 | [`daylight.ratio`](daylight.md#daylight-ratio) |
| `TREAD_MIN_MM` | 240mm | [`stair.proportion`](runs.md#stair-proportion) |
| `STEP_RULE_MM` | 550–700mm | [`stair.proportion`](runs.md#stair-proportion) |
| `ESCALATOR_SLOPE_BAND` | 1/2.3 – 1/1.4 | [`escalator.usual-slope`](runs.md#escalator-usual-slope) |
| `CAR_WIDTH_MIN` | 2400mm | [`access.parking`](access.md#access-parking) |
| `SITE_FRONTAGE_MIN_MM` | 2000mm | [`site.frontage`](site.md#site-frontage) |
| `SITE_AREA_TOLERANCE_M2` | ±0.05 m² | [`site.area`](site.md#site-area) |
| `SITE_CONTAINMENT_TOLERANCE_MM` | 1mm (on the line counts as inside) | [`site.escape`](site.md#site-escape) |

The 0.7 semi-outdoor daylight factor is not in this table. It is **a factor, not a threshold** — it belongs to the derivation of what a window faces. See [daylight](daylight.md).

## Three entry points

```sh
koyu validate <file.muro> --profile koyu.profile.schematic-screen --as-of 2026-08-03
koyu validate <file.muro> --profile … --as-of … --json    # the whole AssessmentReport as JSON
```

```ts
import { assess } from "@kensnzk/koyu/validate";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "@kensnzk/koyu/validate/builtin";

const report = assess(model, {
  registry: createSchematicRegistry(),
  profile: SCHEMATIC_PROFILE_ID,
  context: { schema: "koyu-context/1", asOf: "2026-08-03", values: {} },
});

const violations = report.findings.filter((f) => f.level === "violation");
```

In the `koyu-mcp` server the `validate` tool takes the same `profile` and `asOf` and returns the same report. **Every judgement is callable over MCP** — a judgement a machine cannot call does not exist as far as the machine is concerned.

One finding out of `--json` has this shape.

```json
{
 "rule": { "id": "koyu.schematic.daylight.unknown", "revision": "1" },
 "ruleSet": { "id": "koyu.ruleset.schematic-screen", "revision": "1" },
 "level": "caution",
 "outcome": {
  "id": "/L1/a",
  "status": "fail",
  "subjects": [ { "kind": "space", "ref": "/L1/a" } ],
  "message": "Window area is not fully counted: /L1/a has a window without h: (write h: on it)"
 }
}
```

The evidence behind each outcome names the analysis that produced it and the source line it came from, so a verdict can always be walked back to the declaration that caused it.

## If you arrived here holding a retired diagnostic code

Some codes that `check` once emitted were architectural judgements, and moved to this surface. **The spellings are never reused**, because that would make old output unreadable.

| old code | rule today |
|---|---|
| `ENV01` | [`koyu.schematic.envelope.gap`](envelope.md#envelope-gap) |
| `RUN06` | [`koyu.schematic.stair.proportion`](runs.md#stair-proportion) |
| `RUN07` | [`koyu.schematic.ramp.declared-slope`](runs.md#ramp-declared-slope) / [`koyu.schematic.escalator.usual-slope`](runs.md#escalator-usual-slope) |
| `RUN08` | [`koyu.schematic.run.disconnected`](runs.md#run-disconnected) |
| `SIT03` | [`koyu.schematic.site.escape`](site.md#site-escape) |
| `SIT05` | [`koyu.schematic.site.area`](site.md#site-area) |

The full list of retired numbers is at [retired diagnostic codes](../diagnostics/retired.md).

## This surface does not freeze

The rules may be coarse, the jurisdiction may be absent, the precision may be short — this surface can still grow, and rules can still be dropped. **It is cheap precisely because it does not freeze.** Adding a judgement does not move the language version.

There is exactly one condition on being allowed to be untidy here. **A judgement must never be confused with a guarantee about the composition.** That is why the types are separate, the spellings are separate, and this volume stands apart from the `check` volume.
