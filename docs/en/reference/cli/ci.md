---
title: Gating CI
mode: howto
---

# Gating CI

If your `.muro` files live in git, you can run koyu on every commit. What this page settles is **which command fails the build, at which exit code**.

## A check-only CI quietly stops looking at the judgement

This is the first thing anyone reaches for.

```sh
koyu check building/main.muro
```

**It is not enough.** What `check` guarantees stops at "what is written holds together as data". It says nothing about whether the building is usable.

The default between touching spaces is a wall, and a wall is impassable without a door. So a building with no doors at all comes out green.

```muro
koyu 1.0
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
```

```sh
npx tsx src/cli.ts check sealed.muro
```

```text
✔ Consistent — 3 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Exit 0. Hand the same file to [`koyu validate`](validate.md):

```sh
npx tsx src/cli.ts validate sealed.muro
```

```text
✖ [daylight.ratio] <absolute path>/sealed.muro:line 7: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [access.unreachable] <absolute path>/sealed.muro:line 7: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [access.unreachable] <absolute path>/sealed.muro:line 8: Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)
Validation — 3 violations / 0 cautions
```

Exit 1. **Put only `check` in CI and those three findings are never seen by anyone.**

## Run the two together

The minimum gate is this.

```sh
koyu check    building/main.muro --strict
koyu validate building/main.muro
```

`--strict` is there because warnings otherwise pass through green. "Not one floor is generated on this storey" and "the vertical run's form is not generated" are warnings, so without it they exit 0.

```sh
npx tsx src/cli.ts check warn.muro
```

```text
⚠ <absolute path>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey
✔ Consistent — 3 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Exit 0; with `--strict` it becomes 1. Same file, same warning, different exit code.

## Which command fails at which exit code

| Command | 0 | 1 | 2 | Put it in CI? |
|---|---|---|---|---|
| [`check`](check.md) | No errors (nor warnings under `--strict`) | Errors / warnings under `--strict` / unreadable | Missing argument | **Always, with `--strict`** |
| [`validate`](validate.md) | No violations (**cautions stay 0**) | Violations / unreadable | Missing argument | **Always** |
| [`doors`](doors.md) | Reachable | Unreachable | Two paths not given | When you want to protect one specific escape route |
| [`light`](light.md) | All rooms meet 1/7 / **nothing in scope** | Some fall short | Missing argument | Redundant if `validate` is there |
| [`site`](site.md) | The site report came out | No site | Missing argument | When the site declaration must exist |
| [`levels`](levels.md) | It came out | No level defined | Missing argument | Rarely useful (`check` fails first) |
| [`diff`](diff.md) | **No differences** | **There are differences** | The input is broken | When you want to freeze a generated file |
| [`plan`](plan.md) / [`axo`](axo.md) | Written | Could not be drawn | Undeclared level name and the like | When the drawings must keep generating |
| [`graph`](graph.md) / [`stats`](stats.md) / [`runs`](runs.md) / [`layers`](layers.md) / [`json`](json.md) | Always 0 | Unreadable | Missing argument | **Not gates** — these commands pass no judgement |

Three traps.

**`diff`'s 0/1 reads the other way round.** `check`'s 0 is "it holds together"; `diff`'s 0 is "they are the same". You put `diff` in CI to protect "this generated file has not changed", and the sense inverts.

**`light` returns 0 with nothing in scope.** Put `light` in CI for a model that writes no `daylight:1` and green comes back having looked at nothing. To protect daylight, `validate` is safer — `daylight.ratio` is a violation and exits 1.

**`validate` does not fail on cautions.** `envelope.gap`, `stair.proportion` and `site.area` are all cautions, so the exit code stays 0. To fail on cautions too, read `--json` and count them yourself.

```sh
koyu validate building/main.muro --json | node -e '
  const f = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (f.length) { console.error(f.map(x => `${x.level} [${x.rule}] ${x.message}`).join("\n")); process.exit(1); }
'
```

## Running several buildings

With several entries, stop as soon as one fails.

```sh
for f in building/*/main.muro; do
  koyu check    "$f" --strict || exit 1
  koyu validate "$f"          || exit 1
done
```

A shell `for` returns only the last command's exit code, so put `|| exit 1` on each line.

## In GitHub Actions

```yaml
name: koyu
on: [push, pull_request]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: |
          for f in building/*/main.muro; do
            npx koyu check    "$f" --strict || exit 1
            npx koyu validate "$f"          || exit 1
          done
```

Node 22 or later is required.

## Getting the codes when it fails

The CI log carries the human-facing output. **Codes never appear in the human output.** To look one up, add `--json`.

```sh
koyu check building/main.muro --json
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "file": "<absolute path>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

A file that could not be read because of a syntax error still returns valid JSON under `--json` (copied into a single `SYN01`), so a machine reader built on top of the CI log does not break.

## See also

- [koyu check](check.md) — `--strict` and `--json`
- [koyu validate](validate.md) — the 15 rules and their levels
- [Diagnostics](../diagnostics/index.md) — cause and fix for all 65 codes
- [The koyu command](index.md) — the shared promises about exit codes
