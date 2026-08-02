---
title: Diagnostics
mode: reference
---

# Diagnostics

The surface that checks the consistency of a composition. **It says only that what is written is not self-contradictory as data; it says nothing about whether the result works as architecture.** That judgement is made separately by [`validate`](validate.md).

```ts
import { check, checkDiagnostics, DIAGNOSTIC_CODES } from "@kensnzk/koyu";
import type { CheckResult, Diagnostic, DiagnosticCode } from "@kensnzk/koyu";
```

## checkDiagnostics

```ts
function checkDiagnostics(model: Model): Diagnostic[]
```

**This is the primary form.** Use it whenever you want structure.

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const model = parse(`grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120`);
console.log(JSON.stringify(checkDiagnostics(model), null, 1));
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 },
 {
  "code": "SUF03",
  "severity": "warning",
  "message": "Level L1 has no slab:, so not one floor is generated on this storey",
  "line": 3
 }
]
```

**`checkDiagnostics` never throws.** Syntax and composition errors are thrown by the [parse functions](parsing.md) as a `SourceError`; catch those there.

### Three disciplines

**The population is the written declarations.** One diagnostic per written line, not per derived result.

**Every diagnostic has a source.** A diagnostic without `line` is one that cannot be attributed to any line at all — and there are very few.

**The order is scan order.** Diagnostics are never regrouped by code family. The same input always yields the same order.

## Diagnostic

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

| Field | Contents |
|---|---|
| `code` | the ledger code (2–3 letters of domain plus two digits) |
| `severity` | `"error"` or `"warning"` — **an invariant property of the code** |
| `message` | the body. **It carries no position prefix** |
| `line` | the source line |
| `file` | the source layer under composition (a resolved absolute path) |
| `path` | the space, zone or polygon concerned (both, for a boundary) |
| `related` | related positions — the earlier of a duplicate, the other side of an overlap |

**`severity` belongs to the code and does not vary with circumstance.** The same code is never an error one time and a warning the next. When the weight needs to change, a new code is cut. So you may safely branch on the `DIAGNOSTIC_CODES` table.

`related` answers "and where is the other one?" — the earlier occurrence of a duplicate uid, the space on the other side of an overlap.

```ts
const dup = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 uid:u-aaaaaaaaaaaaaaaa
space /L1/b room X2..X3 Y1..Y2 uid:u-aaaaaaaaaaaaaaaa`);
console.log(JSON.stringify(checkDiagnostics(dup)[0], null, 1));
```

```text
{
 "code": "UID03",
 "severity": "error",
 "message": "Duplicate uid: u-aaaaaaaaaaaaaaaa (space /L1/a — line 4, space /L1/b — line 5)",
 "path": [
  "/L1/a",
  "/L1/b"
 ],
 "related": [
  {
   "line": 4
  },
  {
   "line": 5
  }
 ]
}
```

## check

```ts
function check(model: Model): CheckResult

interface CheckResult {
  errors: string[];
  warnings: string[];
}
```

The compatibility string form. **Same count, same order** as `checkDiagnostics`, with the position prefix (`file:line N: `) assembled into the string. For showing a human directly.

```ts
import { check } from "@kensnzk/koyu";
const { errors, warnings } = check(model);
console.log(errors, warnings);
```

```text
[
  'line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b'
] [
  'line 3: Level L1 has no slab:, so not one floor is generated on this storey'
]
```

This example was read with `parse`, so there is no source file and the prefix is just the line number. Read with `parseFile` it would be `<absolute path>:line 6: `.

**Codes do not appear in the strings.** To branch on a code, use `checkDiagnostics`.

## DIAGNOSTIC_CODES

```ts
const DIAGNOSTIC_CODES: Record<DiagnosticCode, "error" | "warning">

type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;
```

Every code with its severity. **The ledger is the single source, and a code that is not registered will not type-check.**

```ts
import { DIAGNOSTIC_CODES } from "@kensnzk/koyu";
const codes = Object.keys(DIAGNOSTIC_CODES);
console.log(codes.length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "error").length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "warning").length);
console.log(DIAGNOSTIC_CODES["BND04"], DIAGNOSTIC_CODES["BND07"]);
```

```text
65 49 16
error undefined
```

**There are 65 codes: 49 errors and 16 warnings.**

`BND07` returns `undefined` because it is a **retired number**. Retired numbers are never reused, so a number left in an old log or an old configuration cannot come back meaning something else. The retired list, and what is said in their place, is at [retired diagnostics](../diagnostics/retired.md).

Cause and cure for each code is in the [diagnostics reference](../diagnostics/index.md).

## Using DiagnosticCode as a type

`DiagnosticCode` is the union of the codes. A spelling absent from the ledger will not compile.

```ts
import type { Diagnostic, DiagnosticCode } from "@kensnzk/koyu";

const FATAL: DiagnosticCode[] = ["BND04", "GEO02", "SUF02"];
const fatal = (ds: Diagnostic[]) => ds.filter((d) => FATAL.includes(d.code));
```

Put `"BND07"` in that array and it is a type error on the spot.

## Turning it into an exit code

`koyu check` exits 1 when there is an error, and with `--strict` exits 1 on a warning too. Written out, the rule is:

```ts
import { checkDiagnostics } from "@kensnzk/koyu";

function exitCode(model: Model, strict = false): number {
  const ds = checkDiagnostics(model);
  if (ds.some((d) => d.severity === "error")) return 1;
  if (strict && ds.length > 0) return 1;
  return 0;
}
```

**An empty diagnostic list does not mean the building works.** Two touching spaces default to a wall, and a wall without a door cannot be passed. A two-storey house with not one door declared stays sealed shut with an empty list. Whether the circulation connects is [`doorsBetween`](queries.md#doorsbetween); the architectural judgement is [`validate`](validate.md).

## See also

- [Diagnostics reference](../diagnostics/index.md) — cause and cure for all 65 codes
- [Validation](validate.md) — architectural judgement (`Finding`)
- [`koyu check`](../cli/check.md) — the same check from the command line
- [Errors](errors.md) — what parsing, rather than checking, throws
