---
title: koyu check
mode: reference
---

# koyu check

Checks that what is written holds together as data. It is the gate to pass after every edit, and it is what you put in CI.

## Arguments

```text
koyu check <entry.muro> [--json] [--strict]
```

Takes one entry path. For a building split with `import`, pass the base layer's file.

## Flags

| Flag | Effect |
|---|---|
| `--json` | Writes the diagnostics to stdout as `Diagnostic[]` JSON. **This is the only time the codes appear** |
| `--strict` | Makes the exit code 1 even when there are only warnings |

They combine. `--json --strict` writes the JSON and still returns 1 for warnings alone.

## Output

With no errors you get the green line, plus a line saying what that green means.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

The boundaries counted are the boundaries **after derivation**. The default between touching spaces is a wall, so boundaries appear even when you wrote no `boundary` line at all. For the count on the written side, use [`koyu json`](json.md).

Warnings keep the green line and add a count; each warning comes out first, marked `⚠`.

```sh
npx tsx src/cli.ts check warn.muro
```

```text
⚠ <absolute path>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey
✔ Consistent — 3 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

With errors only the `✖` lines appear; the green line does not. The position prefixes the body as `<resolved absolute path>:line <n>:`.

```sh
npx tsx src/cli.ts check bad.muro
```

```text
✖ <absolute path>/bad.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

**Codes never appear in the human output.** To look one up, add `--json`.

## The shape of --json

With no diagnostics it is an empty array.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro --json
```

```text
[]
```

Otherwise it is one object per diagnostic. `message` carries the body only; the position is carried separately by `line` and `file`, and `file` is the resolved absolute path.

```sh
npx tsx src/cli.ts check bad.muro --json
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

`code`, `severity` and `message` are always present; `line`, `file`, `path` and `related` appear only when the diagnostic has them.

**`severity` is a property of the code.** The same code is never an error one time and a warning another.

A file that **never composed into a model** — a syntax or composition error — still returns valid JSON under `--json`. It is copied into a single `SYN01`.

```sh
npx tsx src/cli.ts check broken.muro --json
```

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: Y1",
  "line": 2,
  "file": "<absolute path>/broken.muro"
 }
]
```

An unreadable file takes the same path. There is no position, so neither `line` nor `file` appears.

```text
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Cannot read file: <absolute path>/nope.muro"
 }
]
```

Without `--json` the same file produces a single `✖` line instead of JSON. Either way the exit code is 1.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | No errors (and, under `--strict`, no warnings either) |
| 1 | There are errors / there are warnings under `--strict` / it could not be read because of a syntax or composition error |
| 2 | No file path was given (usage is printed) |

`--json` does not change the exit code. It writes the diagnostics as JSON and still returns 0 or 1 on the same test.

## What check does not say

What `check` guarantees stops at "what is written holds together as data". **It says nothing whatsoever about whether the building is usable.**

The default between touching spaces is a wall, and a wall is impassable without a door. So a building with no doors at all comes out green while perfectly sealed. The same goes for windows: none at all is still green.

```muro
muro 1.4
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /out
boundary /L1/b /out
```

```sh
npx tsx src/cli.ts check sealed.muro
```

```text
✔ Consistent — 3 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Hand the same file to [`koyu validate`](validate.md) and three violations come out. **Never claim it works on the strength of the green.**

## See also

- [koyu validate](validate.md) — the architectural judgement `check` does not make
- [Diagnostics](../diagnostics/index.md) — cause and fix for every code
- [Gating CI](ci.md) — why you add `--strict`
- [koyu json](json.md) — the boundary count on the written side
- [The koyu command](index.md) — the shared promises about entry and exit codes
