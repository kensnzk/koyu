---
title: Validation
mode: reference
---

# Validation

The surface that passes architectural judgement. Is there enough daylight, is the envelope closed, can the stair be climbed, can a car get out of the car park, does the building fit on the site — everything [`checkDiagnostics`](diagnostics.md) says nothing about is said here.

```ts
import { validate, VALIDATION_RULES } from "@kensnzk/koyu";
import type { Finding, ValidationRule } from "@kensnzk/koyu";
```

There is also a domain entrance at `@kensnzk/koyu/validate`. **It is another door to the same function.**

```ts
import { validate, VALIDATION_RULES } from "@kensnzk/koyu/validate";
```

## This surface is not frozen

core is frozen: a change of meaning raises the language version. **This surface is not.** A rule may be coarse, may cover one jurisdiction only, may lack precision — it can still be added, and it can be dropped. It is cheap precisely because it is not frozen.

In exchange, **its results are kept from being mistaken for guarantees about the composition.** The types themselves are separated.

| | Composition diagnostic | Architectural judgement |
|---|---|---|
| Type | `Diagnostic` | `Finding` |
| Identifier | `code: "BND04"` | `rule: "daylight.ratio"` |
| Weight | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| Entrance | `checkDiagnostics(model)` | `validate(model)` |

The field names differ, so the two arrays cannot be confused; concatenating them loses the type. **The point of the split is that "core is green" and "the judgement is green" cannot be said in the same words.**

## validate

```ts
function validate(model: Model): Finding[]
```

Runs every rule. The order is chapter order, and within a chapter it is scan order.

**No verdict comes back.** What comes back is a list of things not upheld — not a conclusion about whether the building works. An empty array means "nothing was caught", not "it passed".

```ts
import { validate } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

console.log(validate(parseFile("examples/tower/main.muro")));
```

```text
[]
```

And one that is caught.

```ts
import { parse, validate } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W`);
for (const f of validate(m)) console.log(JSON.stringify(f));
```

```text
{"rule":"envelope.gap","level":"caution","message":"Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior","line":4,"path":["/L1/a"]}
{"rule":"envelope.gap","level":"caution","message":"Perimeter not faced by any envelope: /L1/b — S 3600mm / E 4000mm / N 3600mm (11200mm over 3 run(s)). Write a boundary to the exterior","line":5,"path":["/L1/b"]}
{"rule":"daylight.ratio","level":"violation","message":"Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.06 m2 (1/7 of the 14.40 m2 floor)","line":4,"path":["/L1/a"]}
{"rule":"access.unreachable","level":"violation","message":"Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)","line":4,"path":["/L1/a"]}
{"rule":"access.unreachable","level":"violation","message":"Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)","line":5,"path":["/L1/b"]}
```

**That model passes `checkDiagnostics`.** Nothing about the composition is broken: an external wall was simply never written, no window was written, no door was written. The example is where you can see the two surfaces saying different things.

## Finding

```ts
interface Finding {
  rule: ValidationRule;
  level: "violation" | "caution";
  message: string;
  line?: number;
  file?: string;
  path?: string[];
}
```

| Field | Contents |
|---|---|
| `rule` | the ledger rule name — chapter and subject joined by `.` |
| `level` | `"violation"` (not upheld) or `"caution"` (suspect) |
| `message` | the body. **No position prefix**, same as a diagnostic |
| `line` | the source line |
| `file` | the source layer under composition |
| `path` | the space or zone concerned |

**`level` is an invariant property of the rule.** The same rule is never a violation one time and a caution the next; when the weight has to change, a new rule name is cut. That is why you can read `level` off `VALIDATION_RULES` in advance.

`level` is **a different axis** from a diagnostic's `severity`. The judgement can be green while the composition is broken, and the reverse.

## VALIDATION_RULES

```ts
const VALIDATION_RULES: Record<ValidationRule, "violation" | "caution">

type ValidationRule = keyof typeof VALIDATION_RULES;
```

The ledger of judgements. **The spelling deliberately differs from a diagnostic code**, so that nobody mistakes `ENV01` for `envelope.gap`.

```ts
import { VALIDATION_RULES } from "@kensnzk/koyu";
console.log(Object.keys(VALIDATION_RULES).length);
for (const [k, v] of Object.entries(VALIDATION_RULES)) console.log(`${k}\t${v}`);
```

```text
15
envelope.gap	caution
daylight.ratio	violation
daylight.unknown	caution
stair.proportion	caution
run.slope	caution
run.disconnected	caution
access.unreachable	violation
access.voidonly	violation
access.throughtenant	caution
access.parking	violation
access.backofhouse	caution
column.blocksdoor	violation
site.escape	violation
site.area	caution
site.frontage	violation
```

**There are 15 rules, and this order is also the order `validate` returns them in.**

The chapters (`envelope`, `daylight`, `stair`, `run`, `access`, `column`, `site`) are subjects, not jurisdictions. When a second jurisdiction arrives (another country's code), it goes underneath a chapter.

What each rule looks at and says is in the [validation reference](../validate/index.md).

## Turning it into an exit code

`koyu validate` exits 1 when there is a `violation`, and 0 when there are only `caution`s.

```ts
import { validate } from "@kensnzk/koyu";

const findings = validate(model);
const code = findings.some((f) => f.level === "violation") ? 1 : 0;
```

`ValidationRule` is the union of rule names, so a spelling absent from the ledger will not compile.

```ts
import type { Finding, ValidationRule } from "@kensnzk/koyu";

const BLOCKING: ValidationRule[] = ["access.unreachable", "site.escape"];
const blocking = (fs: Finding[]) => fs.filter((f) => BLOCKING.includes(f.rule));
```

## See also

- [Validation reference](../validate/index.md) — what the 15 rules do
- [`koyu validate`](../cli/validate.md) — the same judgements from the command line
- [Diagnostics](diagnostics.md) — the other surface, on consistency
- [Questions about a model](queries.md) — the numbers and shapes the judgements read
