---
title: koyu validate
mode: reference
---

# koyu validate

Runs the judgements that belong to architecture — daylight, reachability, envelope continuity, stair proportions, the site numbers. **It says, under a different name and a different type, what `koyu check` does not guarantee.**

## Arguments

```text
koyu validate <entry.muro> --profile <id> --as-of <YYYY-MM-DD> [--json]
```

Takes one entry path. **The profile and the date are required.** Neither is inferred from the filename, the locale, the environment or the clock: a judgement whose grounds were guessed cannot be reproduced, and one that quietly picked a default is worse than one that refused to start.

koyu ships one profile, `koyu.profile.schematic-screen`. It is design lint, not code compliance — see [the validation reference](../validate/index.md).

## Flags

| Flag | Effect |
|---|---|
| `--profile <id>` | **Required.** Which rule profile to run. An unknown id is a usage error |
| `--as-of <YYYY-MM-DD>` | **Required.** The effective date the judgement is made against |
| `--json` | Writes the whole `AssessmentReport` to stdout as JSON |

## Output

When nothing is caught, one line comes out.

```sh
npx tsx src/cli.ts validate examples/house/main.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
  koyu.profile.schematic-screen@1 — 7 evaluated / 9 not applicable / 0 indeterminate / 0 error
```

The second line is the accounting. **A rule that never applied and a rule that could not run are not passes**, so they are counted separately rather than folded into the silence.

Otherwise each finding gets a line and a count follows. `✖` is a violation, `⚠` is a caution.

```sh
npx tsx src/cli.ts validate sealed.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
✖ [koyu.schematic.daylight.ratio] <absolute path>/sealed.muro:line 6: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [koyu.schematic.access.unreachable] <absolute path>/sealed.muro:line 6: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [koyu.schematic.access.unreachable] <absolute path>/sealed.muro:line 7: Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)
Validation — 3 violations / 0 cautions
  koyu.profile.schematic-screen@1 — 4 evaluated / 12 not applicable / 0 indeterminate / 0 error
```

That `sealed.muro` is a file [`koyu check`](check.md) returns green for. The two commands look at different things.

Inside the square brackets is the rule name; what follows, `<resolved absolute path>:line <n>:`, is the provenance. Findings without a position carry no prefix.

## The shape of --json

`--json` writes the whole `AssessmentReport`, not a bare list. The report names the profile and every rule set it applied, keeps one entry per rule with its state, and projects the failures into `findings`.

```json
{
 "schema": "koyu-assessment",
 "profile": { "id": "koyu.profile.schematic-screen", "revision": "1" },
 "ruleSets": [ { "id": "koyu.ruleset.schematic-screen", "revision": "1" } ],
 "model": { "languageVersion": "koyu 1.1", "state": "consistent", "diagnostics": [] },
 "context": { "schema": "koyu-context/1", "asOf": "2026-08-03", "values": {} },
 "analyses": [ "…" ],
 "rules": [ "…" ],
 "findings": [
  {
   "rule": { "id": "koyu.schematic.envelope.gap", "revision": "1" },
   "ruleSet": { "id": "koyu.ruleset.schematic-screen", "revision": "1" },
   "level": "caution",
   "outcome": {
    "id": "/L1/a",
    "status": "fail",
    "subjects": [ { "kind": "space", "ref": "/L1/a" } ],
    "message": "Perimeter not faced by any envelope: /L1/a — N 3600mm / S 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior",
    "evidence": [ "…" ]
   }
  }
 ],
 "summary": {
  "state": "complete",
  "rules": { "evaluated": 4, "notApplicable": 12, "indeterminate": 0, "error": 0 },
  "outcomes": { "pass": 3, "fail": 1, "indeterminate": 0 }
 }
}
```

Every outcome carries the evidence it rests on, and that evidence names the analysis that produced it and the source line it came from — so a verdict can always be walked back to the declaration that caused it.

**`level` is an invariant property of the rule.** The same rule is never a violation one time and a caution another.

## The rules

| Rule | Level | What it says |
|---|---|---|
| `koyu.schematic.envelope.gap` | caution | A hole in the envelope — perimeter that faces nothing |
| `koyu.schematic.daylight.ratio` | violation | Effective window area is below one seventh of the floor |
| `koyu.schematic.daylight.unknown` | caution | A window has no `h`, so the window area was not fully counted |
| `koyu.schematic.stair.proportion` | caution | The derived steps are cramped (tread under 240mm, or 2R+T outside 550–700) |
| `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` | caution | The derived slope is steeper than declared, or outside normal use |
| `koyu.schematic.run.disconnected` | caution | A vertical run exists in form, but no vertical boundary joins the two levels |
| `koyu.schematic.access.unreachable` | violation | A room with a region cannot reach the exterior |
| `koyu.schematic.access.voidonly` | violation | The only doors open onto a void, where there is no floor |
| `koyu.schematic.access.throughtenant` | caution | Escape from a stair core passes through a leased tenancy |
| `koyu.schematic.access.parking` | violation | A car cannot get out of the parking |
| `koyu.schematic.access.backofhouse` | caution | A vertical run is unreachable from the public corridor without crossing back-of-house |
| `koyu.schematic.column.blocksdoor` | violation | A derived column overlaps a derived door |
| `koyu.schematic.site.escape` | violation | The building leaves the site polygon |
| `koyu.schematic.site.area` | caution | The declared and derived site areas disagree |
| `koyu.schematic.site.frontage` | violation | Road frontage is under 2m |

A rule id is `koyu.schematic.` plus a chapter (`envelope` / `daylight` / `stair` / `ramp` / `escalator` / `run` / `access` / `column` / `site`) and a name inside it. The chapter is a subject, not a jurisdiction, and the namespace is there so nobody reads a design-lint result as a statement about the law.

Findings come out in rule-set declaration order, and within a rule in scan order.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | The whole set ran and nothing was violated — **cautions alone still give 0** |
| 1 | A violation, an inconsistent model, a rule left indeterminate, or a rule that errored |
| 2 | A missing or unknown profile, a missing date, no file path, or malformed context |

**Being unable to judge is not passing.** A rule whose input was missing, or that failed to run, exits 1 rather than disappearing into the silence — that is the whole reason the summary distinguishes `indeterminate` and `error` from `not-applicable`.

Configuration problems exit 2, off the 0/1 axis, so no script can read "could not run" as "nothing was violated".

```sh
npx tsx src/cli.ts validate main.muro
```

```text
validate needs an explicit profile: --profile <id>
  koyu ships one: koyu.profile.schematic-screen
```

A file that could not be read exits 1, with a single `✖` on stderr. `--json` does not produce valid JSON on that path — the `SYN01` trick that `check --json` uses does not exist in `validate`.

Here is the cautions-only exit code for real.

```sh
npx tsx src/cli.ts validate caution.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
⚠ [koyu.schematic.envelope.gap] <absolute path>/caution.muro:line 6: Perimeter not faced by any envelope: /L1/a — N 3600mm / S 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 4 evaluated / 12 not applicable / 0 indeterminate / 0 error
```

The exit code is 0. **To fail CI on cautions too, read `--json` and count them yourself.** There is no `validate` equivalent of `check --strict`.

## How it differs from check

| | `koyu check` | `koyu validate` |
|---|---|---|
| Returned type | `Diagnostic` | `AssessmentReport` |
| Name | `code` (`BND04` — three letters and two digits) | `rule` (`koyu.schematic.envelope.gap` — a namespaced id) |
| Weight | `severity`: `error` / `warning` | `level`: `violation` / `caution` |
| Count | 68 codes | 16 rules |
| Grounds | none needed | a profile and a date, always explicit |
| What it guarantees | That what is written holds together as data | **Nothing — it is a judgement** |
| Nature of the surface | Frozen. Adding or removing moves the language version | Not frozen. May grow, may be discarded |

The field names differ, so the two arrays cannot be confused; try to concatenate them and the types fail. **Making it impossible to describe "check's green" and "validate's green" with the same words is the point of the split.**

Adding a judgement does not move the language version. The `validate` surface is allowed to be coarse, to cover one jurisdiction only, and to be imprecise — it is cheap because it is not frozen.

## See also

- [koyu check](check.md) — the structural-consistency gate
- [Validation rules](../validate/index.md) — thresholds and fixes for all 16
- [koyu light](light.md) — the daylight inputs as numbers (the 1/7 test lives here, not there)
- [koyu doors](doors.md) — checking reachability as a route
- [Gating CI](ci.md) — what a check-only CI stops looking at
