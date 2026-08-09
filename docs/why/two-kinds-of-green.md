---
title: check and validate
mode: explanation
---

# check and validate

koyu splits "correct" in two.

| | Structural diagnostics | Architectural judgement |
|---|---|---|
| Command | `koyu check` | `koyu validate` |
| Return type | `Diagnostic { code, severity }` | `Finding { rule, level }` |
| Identifier | `BND04`, `SUF01` — three letters plus two digits | `koyu.schematic.envelope.gap`, `koyu.schematic.access.unreachable` — chapter.rule |
| Weight | `error` / `warning` | `violation` / `caution` |
| Count | **68 codes** | **16 rules** |
| Version | **freezes** | does not freeze; grows |
| What it says | what is written does not contradict itself as data | this is (probably) architecturally sound |

**They are spelled differently on purpose.** No reader will confuse `ENV01` with `koyu.schematic.envelope.gap`.

## Even the types are separate

Add `--json` and the fact that these two are not the same shape is visible directly.

```sh
npx tsx src/cli.ts check b1.muro --json
```

```json
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "file": "b1.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

```sh
npx tsx src/cli.ts validate gap.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03 --json
```

```json
{
 "schema": "koyu-assessment/1",
 "profile": { "id": "koyu.profile.schematic-screen", "revision": "1" },
 "findings": [
  {
   "rule": { "id": "koyu.schematic.envelope.gap", "revision": "1" },
   "level": "caution",
   "outcome": {
    "id": "/L1/b",
    "status": "fail",
    "message": "Perimeter not faced by any envelope: /L1/b — E 4000mm / N 3600mm / S 3600mm (11200mm over 3 run(s)). Write a boundary to the exterior"
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

**Being unmixable is the job of these types.** For a downstream tool to pour both into one array, it must first flatten the types — and that flattening is visible at the moment it happens.

## Why split — the quality demanded is different

**Judgement is a domain where what is correct is not settled yet.** How to treat daylight correction factors, where to cut off a cramped stair, how to count egress routes — every one of these varies by jurisdiction, by era and by building use. Freeze before they settle and **you freeze the mistake.**

Structural diagnostics, by contrast, are settled. Is the path unique? Does the referent exist? Do two regions overlap? **These are part of reading, and admit no opinion.**

So they are treated differently.

| | Structural diagnostics | Architectural judgement |
|---|---|---|
| Cost of adding | **high** — parsing, composition, machine format, spec and docs all at once | **low** — one ledger line and one page section |
| Cost of being wrong | **very high** — the error sits on a frozen surface | low — rewrite it |
| Precision | must be complete | **may be coarse** |
| Can it be thrown away? | no | **yes** |

**There is one condition on being allowed to be messy: the result of a judgement must never be mistaken for a guarantee about the source.** Spelling, type and output wording all defend that condition.

```text
Validation — 2 violations / 0 cautions
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

Green judgement means only that judgement is green.

## Coarseness in practice

`koyu.schematic.envelope.gap` reports holes in the envelope. Its population is **only those levels where at least one boundary to the exterior has been written**.

It will not call a storey whose envelope has not been modelled yet "full of holes". **It demands "if you started, finish"; it does not demand completeness.**

This is not a precise rule. A scheme-stage model with the envelope written for one storey hears nothing about the others. **That is fine** — the rule can afford to be this coarse because fixing the coarseness is cheap. Were this rule in core, it could not have shipped this coarse.

## core returns numbers; judgement draws lines

Aggregate and graph queries live in core. **They never say pass or fail.**

| Question | What core returns | What judgement says |
|---|---|---|
| Daylight | floor area and effective window area | does it meet 1/7 (`koyu.schematic.daylight.ratio`) |
| Site | site area, frontage, footprint, gross floor area and their ratios | 2 m of frontage (`koyu.schematic.site.frontage`), escaping the site (`koyu.schematic.site.escape`) |
| Vertical circulation | riser count, rise, tread, slope | crampedness (`koyu.schematic.stair.proportion`), slope (`koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope`) |
| Envelope | perimeter segments faced by nothing | is that a hole (`koyu.schematic.envelope.gap`) |
| Circulation | fewest-door routes and passability | can you get out (`koyu.schematic.access.unreachable` and the rest) |
| Columns and openings | columns standing on grid crossings, openings on segments | do they overlap (`koyu.schematic.column.blocksdoor`) |

**The thresholds belong to architecture.** 1/7, 2 m and 240 mm are not invariants the composition must satisfy. core goes as far as returning the number; judgement draws the line on it.

Because of that split, **adding a judgement for another jurisdiction touches not one line of core.** Add a rule to the ledger, write a page, and you are done; the language version does not move.

## Judgement is a surface that grows

Fifteen rules is not a finished set. Fire compartmentation, shadow studies, setback envelopes, travel distances, accessibility, whether services can be made to work — there is a great deal left that could be written as judgement.

**All of it goes onto this surface.** Adding it does not change what `.muro` means, existing files still read, and canonical JSON still emits the same bytes.

**Adding to the language is expensive; adding to judgement is cheap.** Creating that asymmetry is precisely why the two are kept apart.

## Next

- [Separating language, checks and drawing](three-domains.md) — the whole picture of this split
- [Diagnostics — koyu check](../reference/diagnostics/index.md) — 68 codes
- [Judgement — koyu validate](../reference/validate/index.md) — 16 rules
- [Scope](../reference/scope.md)
