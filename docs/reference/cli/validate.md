---
title: koyu validate
mode: reference
---

# koyu validate

Runs the judgements that belong to architecture — daylight, reachability, envelope continuity, stair proportions, the site numbers. **It says, under a different name and a different type, what `koyu check` does not guarantee.**

## Arguments

```text
koyu validate <entry.muro> [--json]
```

Takes one entry path.

## Flags

| Flag | Effect |
|---|---|
| `--json` | Writes the findings to stdout as `Finding[]` JSON |

## Output

When nothing is caught, one line comes out.

```sh
npx tsx src/cli.ts validate examples/house/main.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

Otherwise each finding gets a line and a count follows. `✖` is a violation, `⚠` is a caution.

```sh
npx tsx src/cli.ts validate sealed.muro
```

```text
✖ [daylight.ratio] <absolute path>/sealed.muro:line 7: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [access.unreachable] <absolute path>/sealed.muro:line 7: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [access.unreachable] <absolute path>/sealed.muro:line 8: Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)
Validation — 3 violations / 0 cautions
```

That `sealed.muro` is a file [`koyu check`](check.md) returns green for. The two commands look at different things.

Inside the square brackets is the rule name; what follows, `<resolved absolute path>:line <n>:`, is the provenance. Findings without a position carry no prefix.

## The shape of --json

```sh
npx tsx src/cli.ts validate caution.muro --json
```

```text
[
 {
  "rule": "envelope.gap",
  "level": "caution",
  "message": "Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior",
  "line": 7,
  "file": "<absolute path>/caution.muro",
  "path": [
   "/L1/a"
  ]
 }
]
```

`rule`, `level` and `message` are always present; `line`, `file` and `path` appear only when the finding has them.

**`level` is an invariant property of the rule.** The same rule is never a violation one time and a caution another.

## The 15 rules

| Rule | Level | What it says |
|---|---|---|
| `envelope.gap` | caution | A hole in the envelope — perimeter that faces nothing |
| `daylight.ratio` | violation | Effective window area is below one seventh of the floor |
| `daylight.unknown` | caution | A window has no `h`, so the window area was not fully counted |
| `stair.proportion` | caution | The derived steps are cramped (tread under 240mm, or 2R+T outside 550–700) |
| `run.slope` | caution | The derived slope is steeper than declared, or outside normal use |
| `run.disconnected` | caution | A vertical run exists in form, but no vertical boundary joins the two levels |
| `access.unreachable` | violation | A room with a region cannot reach the exterior |
| `access.voidonly` | violation | The only doors open onto a void, where there is no floor |
| `access.throughtenant` | caution | Escape from a stair core passes through a leased tenancy |
| `access.parking` | violation | A car cannot get out of the parking |
| `access.backofhouse` | caution | A vertical run is unreachable from the public corridor without crossing back-of-house |
| `column.blocksdoor` | violation | A derived column overlaps a derived door |
| `site.escape` | violation | The building leaves the site polygon |
| `site.area` | caution | The declared and derived site areas disagree |
| `site.frontage` | violation | Road frontage is under 2m |

A rule name is a chapter (`envelope` / `daylight` / `stair` / `run` / `access` / `column` / `site`) plus a name inside it. The chapter is a subject, not a jurisdiction.

Findings come out in chapter order, and within a chapter in scan order.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | No violations — **cautions alone still give 0** |
| 1 | One or more violations |
| 2 | No file path was given (usage is printed) |

A file that could not be read exits 1, with a single `✖` on stderr. `--json` does not produce valid JSON on that path — the `SYN01` trick that `check --json` uses does not exist in `validate`.

Here is the cautions-only exit code for real.

```sh
npx tsx src/cli.ts validate caution.muro
```

```text
⚠ [envelope.gap] <absolute path>/caution.muro:line 7: Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior
Validation — 0 violations / 1 caution
```

The exit code is 0. **To fail CI on cautions too, read `--json` and count them yourself.** There is no `validate` equivalent of `check --strict`.

## How it differs from check

| | `koyu check` | `koyu validate` |
|---|---|---|
| Returned type | `Diagnostic` | `Finding` |
| Name | `code` (`BND04` — four letters and two digits) | `rule` (`envelope.gap` — chapter and name) |
| Weight | `severity`: `error` / `warning` | `level`: `violation` / `caution` |
| Count | 65 codes | 15 rules |
| What it guarantees | That what is written holds together as data | **Nothing — it is a judgement** |
| Nature of the surface | Frozen. Adding or removing moves the language version | Not frozen. May grow, may be discarded |

The field names differ, so the two arrays cannot be confused; try to concatenate them and the types fail. **Making it impossible to describe "check's green" and "validate's green" with the same words is the point of the split.**

Adding a judgement does not move the language version. The `validate` surface is allowed to be coarse, to cover one jurisdiction only, and to be imprecise — it is cheap because it is not frozen.

## See also

- [koyu check](check.md) — the structural-consistency gate
- [Validation rules](../validate/index.md) — thresholds and fixes for all 15
- [koyu light](light.md) — the daylight inputs and the 1/7 test as a list
- [koyu doors](doors.md) — checking reachability as a route
- [Gating CI](ci.md) — what a check-only CI stops looking at
