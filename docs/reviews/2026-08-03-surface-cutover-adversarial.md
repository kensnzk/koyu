# 0.18.0 surface cutover adversarial review

- Date: 2026-08-03
- Scope: the twelve entry points, the deletion of the legacy validation surface, the CLI and MCP migration, and the published documentation
- Decisions under review: ADR-0053, ADR-0055, ADR-0056
- Status: reviewed and corrected; the findings below were reproduced before being fixed

## Verdict

No P0 issue survives. The cutover changes behaviour in three places on purpose, and every one of those changes is now visible in a test and in the published documentation rather than only in the implementation.

This verdict is narrower than "0.18.0 is ready to promote". It covers the surface, the built-in pack and the three transports. Promotion to 1.0.0 needs the observation period ADR-0052 asks for, which no test can stand in for.

## Behaviour that changed on purpose

These are not defects, but a reader of the diff would be right to stop at each one.

### An inconsistent model no longer gets judged

Every built-in analysis declares `model: "consistent"`, so a composition with a core error now leaves every rule `indeterminate` instead of producing verdicts. The legacy `validate(model)` ran regardless.

This is the correct reading of ADR-0054, and it is what the exit code exists to express: `koyu validate` returns 1 for an indeterminate rule, because being unable to judge is not passing. It surfaced as two test failures whose fixtures happened to carry an unrelated core error — a stair with no storey height, and a `room` under `koyu 0.2` that trips `VER02`. Both fixtures were made consistent; neither had anything to do with what the test was checking.

**A caller upgrading from 0.17.0 will see this.** A file that was quietly judged while structurally broken now reports nothing and exits 1.

### `koyu light` no longer draws the line

`light` used to apply `1/7` itself and print a verdict per room, which meant the threshold existed twice — once in the rule and once in the adapter. It now reports floor area, effective window area and their ratio, and exits 0 whenever it can answer.

The duplication was real, not theoretical: the CLI wrote `d.floor / 7` directly. `test/package-surface.test.ts` now fails if any threshold reappears in `src/cli.ts` or `src/mcp.ts`.

### The MCP `site` tool stopped answering `areaMatch`

`areaMatch` was `Math.abs(declared - derived) < 0.05` computed in the adapter — the same comparison `koyu.schematic.site.area` makes, with the tolerance written a second time. It is gone; the rule answers it.

The coverage and floor-area ratios had the same problem in three places (the CLI, the MCP adapter, and the site analysis each divided and rounded). They now come from `siteReport` in core, which is the one place that computes them.

## Findings reproduced and corrected

### Rule messages had silently lost their information

The migration preserved level, subject and source — the parity ADR-0055 asked for — but not the message, which was not in the parity contract. Six messages came out materially worse:

| Rule | Before the fix |
|---|---|
| `stair.proportion` | "has a derived tread or pace outside the schematic band" — no numbers, no remedy |
| `ramp.declared-slope` | "is steeper than its declared 1/12 limit" — no derived slope |
| `escalator.usual-slope` | "is outside the schematic escalator slope band" — no slope, no band |
| `run.disconnected` | "is not an endpoint of a vertical boundary" — the reader is not told to write `stack` |
| `envelope.gap` | a total length, with the per-edge breakdown dropped |
| `site.escape` | a tolerance restatement instead of the coordinate where it escapes |

Every one now carries the derived numbers and, where the old message had one, the remedy. The machine-readable comparison in the evidence was always correct; this was the human line only, which is the most-read surface there is.

### Documented output did not match the implementation

Seventeen documented fixtures were re-run against the new CLI and every verdict block replaced with real output. Four pages also had `koyu light` blocks showing a verdict the command no longer produces, and the whole `why/` and `howto/` set carried bare rule ids.

One case had to be reconstructed rather than transformed: `docs/why/silence.md` and `two-kinds-of-green.md` share a `gap.muro` that is not written out in full on either page. The fixture was rebuilt until it reproduced the documented line number and subject, then re-run.

### A test can stop covering what it claims to cover

`test/docs-ledger.test.ts` and `scripts/gate.mjs` carried comments naming `VALIDATION_RULES` and `validate(model)` after both were deleted. Harmless in themselves, but the scan that found them is now a test: `package-surface.test.ts` fails if any deleted name appears anywhere under `src/`, `test/`, `eval/` or `scripts/`.

Writing that scan immediately found its own false positives, which are worth recording because they are the shape of scans that lie:

- a `1/7` inside an MCP tool *description* is prose about the rules, not a threshold — the scan now skips description strings;
- the scan's own list of forbidden names matched itself — it now skips its own file.

A scan that matches its own vocabulary is a scan that can only pass.

### The parity oracle could not survive its own subject

Four suites compared the new rules against the legacy validator. Once the legacy validator was deleted, those comparisons would have compared the implementation with itself, which proves nothing.

They now compare against **the documented verdict**: `test/helpers/docs.ts` parses each rule section's fixture and the verdict line beneath it, and the test asserts the rule produces exactly that rule id, level, line and message. Since `docs/` is authoritative in this repository, this is a stronger binding than the one it replaced — the implementation and the published contract can no longer drift apart in either direction.

### The external-pack fixture found three contract mistakes in itself

Writing a rule pack using only the published entry points is the test of whether those entry points are sufficient. On the first attempt it did not compile, for reasons that are the point of the exercise:

- `ContextKey` requires a `description`, and rejection carries `message`, not `reason`;
- `ContextRequirement` spells presence as `presence: "required"`, not `required: true`;
- `JurisdictionRef` is `{ country, region?, locality?, authority? }`.

All three are the protocol being stricter than a newcomer assumes, which is the intended direction. Two runtime expectations were also wrong and were corrected against the implementation rather than the other way round: a decoder **rejection** surfaces to the rule as `ContextRead { state: "invalid" }` and leaves the rule indeterminate, while a **malformed** entry is an `AssessmentConfigError` thrown before anything runs. Those are different failures and the protocol is right to separate them.

## Evidence executed

| Check | Result |
|---|---|
| `npm test` | 716 tests, 716 pass, 0 fail |
| `npm run typecheck` | success |
| `npm run conformance` | 136 tests, 136 pass, 0 fail |
| `npm run check:examples` | 17 targets `Consistent` |
| `npm run gate:examples` | all examples passed |
| `npm run gate:docs` | 153 pages, all reachable |
| `npm pack` → empty project | 12/12 entry points import by package name |
| canonical + `Form` fingerprints | all 15 bundled examples unchanged from `v0.17.0` |

The packed tarball was installed into a project containing nothing but a `package.json`. All twelve entries resolved; `@kensnzk/koyu/dist/index.js`, `@kensnzk/koyu/src/index.js` and `@kensnzk/koyu/validate/light` did not resolve; and `validate`, `VALIDATION_RULES`, `areaM2`, `derive`, `svgPlan` and `siteReport` were all absent from the root. The shipped `koyu` binary ran `validate` against a bundled example from inside that project.

## What this review does not cover

- **Promotion to 1.0.0.** ADR-0052 makes that conditional on observing the published 0.18.0 surface, which is a matter of elapsed time and real consumers.
- **Whether the sixteen rules are architecturally right.** They are a coarse schematic screen, they are documented as one, and this review checked that they say what they claim — not that the thresholds are the correct thresholds.
- **The `--as-of` ergonomics.** Requiring an explicit date on every `validate` call follows from "no input is inferred", but the built-in profile declares no effective range, so the date it takes is inert today. That is a deliberate cost, and it is the kind of decision worth revisiting once a jurisdictional pack actually exists.
- **Locale and module-import-order behaviour across processes**, which remains distribution evidence rather than unit evidence.
