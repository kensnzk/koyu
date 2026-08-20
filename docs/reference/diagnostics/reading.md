---
title: Reading a diagnostic
mode: reference
---

# Reading a diagnostic

**The human-facing `check` does not display diagnostic codes.** What comes out is the message body alone; a code like `BND04` appears nowhere. To use [the index](index.md) or a family page, first get the code.

## Getting the code

Check this file — two rooms touching only at a corner.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
space /out outside:1
boundary /L1/a /L1/b t:120
boundary /L1/a /out
boundary /L1/b /out
```

The human output looks like this.

```text
✖ <absolute path>/bad.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

The provenance at the head of the line is the **resolved absolute path** (elided here as `<absolute path>`). In a composed model it names not the entry but **the layer where the declaration that produced the diagnostic is written**.

Add `--json` and the same diagnostic comes out with its code.

```sh
koyu check bad.muro --json
```

```json
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

With the code in hand, look it up in [the index](index.md).

## The shape of a Diagnostic

`--json` emits an array of `Diagnostic`.

```ts
interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning";
  message: string;
  line?: number;
  file?: string;
  path?: string[];
  related?: Array<{ line: number; file?: string }>;
}
```

| Field | Always present | Contents |
|---|---|---|
| `code` | yes | One of the ledger's 70 codes: three letters for the area plus a two-digit serial |
| `severity` | yes | `"error"` or `"warning"`. **An invariant property of the code**, never varying with the case |
| `message` | yes | **The body only.** It does not include the position prefix (`file:line N: `) |
| `line` | when the diagnostic has a position | The 1-based line of its provenance. Diagnostics with no written line — a derived default boundary, say — omit it |
| `file` | when `line` is present and the layer is known | That layer's resolved absolute path |
| `path` | when the subject has a path | The path of the space, zone or `polygon` concerned. A diagnostic about a boundary carries **both** paths |
| `related` | when there are related positions | The earlier of a duplicate, the other side of an overlap, the declaration that cast the shadow |

`message` carries no position because other fields carry it. Editors and CI read `line` / `file` mechanically; the human-facing `check` assembles `<file>:line <N>: ` and pastes it in front of the body. **The two share one body.**

An example with `related`. For a duplicate boundary (BND02) the later declaration is the diagnostic's provenance and the earlier one goes into `related`.

```json
[
 {
  "code": "BND02",
  "severity": "error",
  "message": "Duplicate boundary: /L1/a | /L1/b (first seen at <absolute path>/bad.muro:line 6)",
  "line": 7,
  "file": "<absolute path>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ],
  "related": [
   {
    "line": 6,
    "file": "<absolute path>/bad.muro"
   }
  ]
 }
]
```

**A diagnostic about a set still returns the positions of the declarations that made the set** — being told that something contradicts *somewhere* leaves nowhere to go and fix it. It does so in one of two ways.

- **`line` points at one of them and the rest go in `related`** — BND02 (a duplicate boundary), BND05 (`edge` and no `edge` at once), GEO02 (overlapping regions), COL02 (a column standing in an earlier declaration's shadow), UID04 (a duplicate name inside one container).
- **All of them go in `related` and there is no `line`** — UID03 (a duplicate `uid`). The collision is symmetric, with no first declaration to name, so none is singled out; the body spells out every provenance as well.

**Some diagnostics carry no position at all.** A default boundary (a derived wall) has no written line, so a diagnostic about one returns neither `line` nor `file` nor `related` — VER01, which reports that a `koyu 0.1` file derived a default boundary, is that case. The human-facing output carries no `<file>:line N: ` prefix either; you reach the fix through the two spaces `path` names.

## Severity and exit codes

| severity | Meaning | `check` | `check --json` | `check --strict` |
|---|---|---|---|---|
| `error` | The composition does not stand up | 1 | 1 | 1 |
| `warning` | Suspect (it does stand up) | 0 | 0 | 1 |
| (no diagnostics) | Green | 0 | 0 | 0 |

**To fail on warnings too, add `--strict`.** That is what belongs in a CI gate. `--json` and `--strict` compose.

With no errors, the human-facing `check` prints the counts and says what green means.

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

With warnings only it looks like this (exit code 0; 1 under `--strict`).

```text
⚠ <absolute path>/warn.muro:line 6: The same pair of spaces carries both an edge-restricted and an unrestricted boundary (the segments overlap): /L1/a | /L1/b
✔ Consistent — 2 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

In the human output **warnings come first and errors after**. `--json` does not sort by severity; it returns them in the scan order described below.

## The order is the scan order

The order of diagnostics is decided by **the order things are scanned**, not by code family. The check is a fixed sequence of sections, and **the grain of a section is a scan, not a family of codes.** When one section, walking its declarations once, emits several codes, they come out next to each other right where the scan is. The section that checks boundary validity goes boundary by boundary, and says everything it has to say about that boundary's segments, openings and `seg`s in one place.

Check two external-wall boundaries each carrying a door and a `seg`, and the output groups by boundary, not by family.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  door w:800
  seg w:800 spec:X
boundary /L1/b /out t:150
  door w:800
  seg w:800 spec:X
```

The codes and lines come out in this order.

```text
OPN05  line 8
SEG05  line 9
OPN05  line 11
SEG05  line 12
```

**This is deliberate.** Everything to be said about one boundary lands in one place, so you can fix from the top down. Grouping by code family would split one boundary's story across opposite ends of the output.

## The population is what is written

What the diagnostics enumerate is **the written declarations**, not the derived results. A column declaration that stands no columns is not silently excused because a different declaration on the same storey happened to stand one. The same holds for attributes: **the values of interpreted attributes are checked** — a value you wrote is never quietly dropped to a default because it went uninterpreted.

## A syntax error is copied into SYN01

When the file never became a model, not one semantic check has run. Only under `--json`, in order to return valid JSON, is that exception copied into a single `SYN01`.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X9 Y1..Y2
```

```sh
koyu check broken.muro --json
```

```json
[
 {
  "code": "SYN01",
  "severity": "error",
  "message": "Undefined grid line name: X9",
  "line": 4,
  "file": "<absolute path>/broken.muro"
 }
]
```

`check` without `--json`, and every other subcommand, print the exception as it stands — `✖ <provenance>:line N: <body>` — and exit 1. **One syntax error makes the whole of `check --json` a single SYN01.**

## Reading them from a program

`checkDiagnostics(model)` returns `Diagnostic[]`. `check(model)` is the compatibility layer and returns a pair of **string** arrays, `{ errors, warnings }` — those strings do carry the position prefix. When you need codes, use `checkDiagnostics`.

`DIAGNOSTIC_CODES` is the ledger itself, and looks a code's severity up.

```ts
import { checkDiagnostics, DIAGNOSTIC_CODES } from "koyu";

for (const d of checkDiagnostics(model)) {
  console.log(d.code, d.severity, d.line, d.message);
}

DIAGNOSTIC_CODES["BND04"]; // "error"
```

**A retired spelling is rejected by the type.** The ledger is `as const`, so a key that is not in it stops the type checker — `DIAGNOSTIC_CODES["BND07"]` is a TS2551. Being unable to handle an unregistered code is the contract. To see what a retired spelling does at run time, widen the type first.

```ts
const ledger = DIAGNOSTIC_CODES as Record<string, "error" | "warning" | undefined>;
ledger["BND07"]; // undefined — retired
```

The retired numbers are listed on [Retired diagnostic codes](retired.md).
