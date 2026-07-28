---
title: koyu validate — architectural judgement
mode: reference
---

# koyu validate — architectural judgement

[`koyu check`](../cli/check.md) says only that what is written is not self-contradictory as data. Whether the daylight is sufficient, whether the envelope closes, whether the stair can be climbed, whether a car can leave the garage, whether the building fits on its site — none of that is in there. **`koyu validate` says it, and this volume documents it.**

```sh
koyu validate examples/tower/main.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

Every bundled building (`two-rooms`, `office`, `house`, `mansion`, `tower`, `basement`, `complex`, `twin`) currently comes back with nothing caught.

## The two greens cannot be spoken of in the same words

So that a judgement is never read as a guarantee about the composition, **the two are different types**.

| | structural diagnostic | architectural finding |
|---|---|---|
| type | `Diagnostic` | `Finding` |
| identifier | `code: "BND04"` | `rule: "daylight.ratio"` |
| weight | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| entry point | `checkDiagnostics(model)` / [`koyu check`](../cli/check.md) | `validate(model)` / [`koyu validate`](../cli/validate.md) |
| spelling | four capitals plus two digits | a chapter and a subject joined by `.` |
| version | frozen | **not frozen** — rules are added, sharpened, dropped |

The field names differ, so the two arrays cannot be confused; concatenate them and the type collapses. Nobody mistakes `ENV01` for `envelope.gap` — that is exactly why the spellings were split.

**`level` is an invariant property of the rule.** The same rule is never a `violation` in one model and a `caution` in another. Changing the weight means minting a new rule name.

## Levels and exit codes

| level | meaning | `koyu validate` exit code |
|---|---|---|
| `violation` | the rule is not met | 1 |
| `caution` | suspicious, or not fully counted | 0 |

This is **a different axis** from `check`'s `error` / `warning`. Validation can be green while the composition is broken, and the other way round. `--json` does not change the exit rule.

## The ledger — fifteen rules

The order below is the order of the scan, and the order the output comes out in.

| rule | level | what it says |
|---|---|---|
| [`envelope.gap`](envelope.md#envelope-gap) | caution | part of the outline faces nothing — a hole in the envelope |
| [`daylight.ratio`](daylight.md#daylight-ratio) | violation | effective window area is below one seventh of the floor area |
| [`daylight.unknown`](daylight.md#daylight-unknown) | caution | a window without `h:` means the window area is not fully counted |
| [`stair.proportion`](runs.md#stair-proportion) | caution | the derived step is cramped (going under 240mm, or 2×riser+going outside 550–700mm) |
| [`run.slope`](runs.md#run-slope) | caution | the derived slope is steeper than the declared `slope:`, or outside the usual escalator band |
| [`run.disconnected`](runs.md#run-disconnected) | caution | the vertical run has a shape but no vertical boundary joining the levels |
| [`access.unreachable`](access.md#access-unreachable) | violation | a space with a region cannot reach the outside |
| [`access.voidonly`](access.md#access-voidonly) | violation | the doors open only onto a void, where there is no floor |
| [`access.throughtenant`](access.md#access-throughtenant) | caution | escape from a stair necessarily passes through a tenancy |
| [`access.parking`](access.md#access-parking) | violation | a car cannot get out of the parking |
| [`access.backofhouse`](access.md#access-backofhouse) | caution | a vertical run is not reachable from a common corridor without crossing back-of-house |
| [`column.blocksdoor`](column.md#column-blocksdoor) | violation | a derived column overlaps a derived door |
| [`site.escape`](site.md#site-escape) | violation | the building escapes the site outline |
| [`site.area`](site.md#site-area) | caution | the declared and derived site areas disagree |
| [`site.frontage`](site.md#site-frontage) | violation | the road frontage is under 2 m |

The chapters (`envelope`, `daylight`, `stair`, `run`, `access`, `column`, `site`) name **subjects, not jurisdictions**. When a second jurisdiction arrives — Japanese building law and somebody else's — it is added underneath a chapter.

## Thresholds

The thresholds are **numbers on the architectural side**, not invariants the written composition must satisfy. That is why they are gathered in one place.

| constant | value | which rule reads it |
|---|---|---|
| `DAYLIGHT_DIVISOR` | 7 | [`daylight.ratio`](daylight.md#daylight-ratio) |
| `TREAD_MIN` | 240mm | [`stair.proportion`](runs.md#stair-proportion) |
| `STEP_RULE` | 550–700mm | [`stair.proportion`](runs.md#stair-proportion) |
| `ESCALATOR_SLOPE` | 1/2.3 – 1/1.4 | [`run.slope`](runs.md#run-slope) |
| `CAR_WIDTH_MIN` | 2400mm | [`access.parking`](access.md#access-parking) |
| `FRONTAGE_MIN` | 2000mm | [`site.frontage`](site.md#site-frontage) |
| site area tolerance | ±0.05 m² | [`site.area`](site.md#site-area) |
| site shape tolerance | 1mm (on the line counts as inside) | [`site.escape`](site.md#site-escape) |

The 0.7 semi-outdoor daylight factor is not in this table. It is **a factor, not a threshold** — it belongs to the derivation of what a window faces. See [daylight](daylight.md).

## Three entry points

```sh
koyu validate <file.muro>          # for people. 0 = no violations / 1 = violations
koyu validate <file.muro> --json   # Finding[] as JSON
```

```ts
import { validate, VALIDATION_RULES, type Finding } from "@kensnzk/koyu";
// there is also a subpath entry: import { validate } from "@kensnzk/koyu/validate";

const findings: Finding[] = validate(model);
const violations = findings.filter((f) => f.level === "violation");
```

One finding out of `--json` has this shape.

```json
{
 "rule": "daylight.unknown",
 "level": "caution",
 "message": "Window area is not fully counted: /L1/a has a window without h: (write h: on it)",
 "line": 6,
 "file": "/path/to/main.muro",
 "path": [
  "/L1/a"
 ]
}
```

`line` is the source line, `file` is the composed layer that wrote the value, and `path` is the space or zone concerned. Some judgements have no position, so `line` and `file` can be absent.

In the `koyu-mcp` server the `validate` tool returns the same `Finding[]` alongside the `violations` and `cautions` counts. **Every judgement is callable over MCP** — a judgement a machine cannot call does not exist as far as the machine is concerned.

## If you arrived here holding a retired diagnostic code

Some codes that `check` once emitted were architectural judgements, and moved to this surface. **The spellings are never reused**, because that would make old output unreadable.

| old code | rule today |
|---|---|
| `ENV01` | [`envelope.gap`](envelope.md#envelope-gap) |
| `RUN06` | [`stair.proportion`](runs.md#stair-proportion) |
| `RUN07` | [`run.slope`](runs.md#run-slope) |
| `RUN08` | [`run.disconnected`](runs.md#run-disconnected) |
| `SIT03` | [`site.escape`](site.md#site-escape) |
| `SIT05` | [`site.area`](site.md#site-area) |

The full list of retired numbers is at [retired diagnostic codes](../diagnostics/retired.md).

## This surface does not freeze

The rules may be coarse, the jurisdiction may be a single country, the precision may be short — this surface can still grow, and rules can still be dropped. **It is cheap precisely because it does not freeze.** Adding a judgement does not move the language version: one line in the ledger, one section in this volume.

There is exactly one condition on being allowed to be untidy here. **A judgement must never be confused with a guarantee about the composition.** That is why the types are separate, the spellings are separate, and this volume stands apart from the `check` volume.
