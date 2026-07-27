**English** · [日本語](../validation.md)

# The ledger of verdicts — the validation surface

As of koyu v1.0.0-rc.1. **This surface does not freeze** ([scope.md §8](scope.md#8-the-eight-surfaces-that-100-freezes)).

What `koyu check` says stops at "what is written is not self-contradictory as data" ([scope.md §3](scope.md#3-the-extent-of-the-guarantee--what-the-check-passed-means)). Whether it is sound as architecture is what this surface says. Causes and fixes are in [guide/en/validation.md](../../guide/en/validation.md).

## How it is kept apart from core

So that the output of a verdict is never read as a guarantee about the source, **the types themselves are kept separate**.

| | core's diagnostics | validation's verdicts |
|---|---|---|
| type | `Diagnostic` | `Finding` |
| identifier | `code: "BND04"` | `rule: "daylight.ratio"` |
| weight | `severity: "error" \| "warning"` | `level: "violation" \| "caution"` |
| entrance | `checkDiagnostics(model)` / `koyu check` | `validate(model)` / `koyu validate` |
| version | **freezes** | does not freeze — it grows, sharpens, and drops rules |

Because the field names differ the two arrays cannot be mistaken for one another, and an attempt to concatenate them loses the type. **Making it impossible to speak of "core's green" and "the verdict's green" in the same words** is the purpose of this separation.

`level` is an invariant property of the code — the same rule never comes out `violation` in one case and `caution` in another (the same discipline as core's severity). To change the weight, mint a new rule name.

## The ledger

The implementation's `VALIDATION_RULES` (`src/validate/index.ts`) is the norm; this table is its copy. A test keeps the two sets identical.

| Rule | level | Summary |
|---|---|---|
| `envelope.gap` | caution | A hole in the envelope — a stretch of the outline faces neither another space nor a declared boundary ([ADR-0025](../../docs/decisions/0025-envelope-gaps.md)). **Only a level on which at least one boundary to the outside is written** is checked (this is the consistency of "if you have started, finish", not a demand for completeness) |
| `daylight.ratio` | violation | Effective window area < floor area / 7. The subjects are only the spaces that carry `daylight:1` ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). A coarse test, with no correction factors applied |
| `daylight.unknown` | caution | There is a window without `h`, so the window area could not be fully counted — the mark that distinguishes "it is enough" from "it was not counted" |
| `stair.proportion` | caution | The derived steps are cramped (going < 240mm, or 2×riser + going outside 550-700mm). In a return stair the **tightest flight** stands for the whole |
| `run.slope` | caution | The derived slope is steeper than the declared `slope:`, or it leaves the usual band for an escalator (about 1/1.7) |
| `run.disconnected` | caution | The form of a vertical circulation is there, but no vertical boundary joins the levels (the shape exists, yet the graph cannot pass) |
| `access.unreachable` | violation | A space with a region cannot reach an exterior space along passable boundaries. What is asked is **reachability, not the presence of a door**. Shafts (people cannot pass), voids (no floor) and exteriors are out of scope |
| `access.voidonly` | violation | A space has passable boundaries, but every one of them leads to a `type:void` — the doors open onto a hole with no floor |
| `access.throughtenant` | caution | Every route from a stair to the outside passes through a `use:rentable` space (an escape route that dies the moment the tenant locks up). Some designs do run a dedicated passage through, hence caution |
| `access.parking` | violation | A car cannot get out of a `use:parking` space. A car passes only a `type:open` boundary, a door at least 2400mm wide, or a ramp (the vertical link of a space carrying `ramp:`) |
| `access.backofhouse` | caution | A common space declaring a vertical run cannot be reached from a common corridor without passing through a `type:backyard`. Not asked at all in a building with no common corridor. Entry to the space itself must be **horizontal** (an approximation) |
| `column.blocksdoor` | violation | A derived column overlaps a derived door ([ADR-0023](../../docs/decisions/0023-columns.md)). **Neither carries coordinates in the source**, so the collision only shows up in the derivation |
| `site.escape` | violation | The building escapes the site shape. Beyond the containment of the four corners it looks at vertex intrusion and edge crossing, so it is correct on a concave site too. On the boundary counts as inside; tolerance 1mm. Exterior space tiles are not checked (an approximation) |
| `site.area` | caution | The declaration of the site area (`area:`, the surveyed value) and the derivation from the polygon disagree by more than ±0.05 m² |
| `site.frontage` | violation | The road frontage is under 2000mm (a coarse copy of Article 43 of the Japanese Building Standards Act). The part where the building's outer wall faces the road is not counted. **Not asked in a model with no `site:1` zone** — the 0 that would be derived means "not derivable", not "no frontage" |

## The thresholds

A verdict's thresholds are **numbers on the architecture's side**, not invariants the authored composition must satisfy. They all sit in one place as constants of the implementation, and a section is added below this one when a second jurisdiction appears.

| Constant | Value | Where it lives |
|---|---|---|
| `DAYLIGHT_DIVISOR` | 7 | `src/validate/light.ts` |
| `TREAD_MIN` | 240mm | `src/validate/runs.ts` |
| `STEP_RULE` | 550-700mm | same file |
| `ESCALATOR_SLOPE` | 1/2.3 - 1/1.4 | same file |
| `CAR_WIDTH_MIN` | 2400mm | `src/validate/access.ts` — the narrowest opening a car can pass (a 900mm door for people will not let a car out) |
| `FRONTAGE_MIN` | 2000mm | `src/validate/site.ts` |
| `COVERED_SEMI_FACTOR` | 0.7 | `src/core/light.ts` — this is **a coefficient, not a threshold**, so it lives in core (the derivation of what lies beyond the window) |

## The entrances

```sh
koyu validate <file.muro>          # for people. 0 = no violations / 1 = violations
koyu validate <file.muro> --json   # Finding[]
```

```ts
import { validate, VALIDATION_RULES, type Finding } from "@kensnzk/koyu";
```

In MCP it is the `validate` tool. **Every verdict can be called from MCP** — a verdict that cannot be called is, for a machine, as good as nonexistent.

## The discipline for adding one

Adding a verdict is cheap. It grows one surface, and the language's version does not move. Only two things are to be kept.

1. **Put it in `VALIDATION_RULES`, and write a row in this table and a section in [guide/en/validation.md](../../guide/en/validation.md).** A test keeps the sets identical
2. **Do not touch core.** If you find yourself wanting to add an attribute or a diagnostic to core for the sake of a verdict, then it may not be a verdict but structural consistency — decide by holding it against [scope.md §3](scope.md#3-the-extent-of-the-guarantee--what-the-check-passed-means)
