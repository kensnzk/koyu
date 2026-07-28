---
title: Retired diagnostic codes
mode: reference
---

# Retired diagnostic codes

Eleven spellings are retired. **Numbers are never reused.** If one spelling came to mean something else, past output and past logs would stop being readable. These keys are not in the ledger (`DIAGNOSTIC_CODES`), and looking one up from a program returns `undefined`.

```ts
DIAGNOSTIC_CODES["BND04"]; // "error"
DIAGNOSTIC_CODES["BND07"]; // undefined
```

They were retired for three different reasons.

| Reason | Retired numbers |
|---|---|
| **They were judgements, so they moved to `koyu validate`** — they carry thresholds and decide architecture, not the consistency of the composition | ENV01 RUN06 RUN07 RUN08 SIT03 SIT05 |
| **They were all one story — "the information needed is missing" — so they folded into the SUF family** | HGT03 HGT04 HGT05 RUN04 |
| **The job itself disappeared** | BND07 |

## The list

| Retired | Severity then | What it said then | What says it now |
|---|---|---|---|
| BND07 | warning | These touch, but no boundary is declared | Nothing — an undeclared contact is a wall by default |
| ENV01 | warning | A hole in the envelope — a stretch of perimeter facing nothing | `envelope.gap` (caution) |
| HGT03 | warning | The storey above has no `slab`, so the height check cannot run | [SUF03](suf.md) (warning) |
| HGT04 | warning | The ceiling height is unknown, so the height check cannot run | [SUF01](suf.md) (error) |
| HGT05 | warning | A space with a region whose level cannot be determined | [SUF02](suf.md) (error) |
| RUN04 | warning | No level above, so the run's shape cannot be generated | [SUF04](suf.md) (warning) |
| RUN06 | warning | The derived steps are cramped (a narrow going, or 2R+T outside the comfortable band) | `stair.proportion` (caution) |
| RUN07 | warning | The derived slope departs from the declaration or the usual band | `run.slope` (caution) |
| RUN08 | warning | The run has a shape but no vertical boundary connecting the storeys | `run.disconnected` (caution) |
| SIT03 | error | The building escapes the site outline | `site.escape` (violation) |
| SIT05 | warning | The declared site area and the derived one disagree | `site.area` (caution) |

Everything from `envelope.gap` down in the right-hand column is not a `koyu check` diagnostic but a **`koyu validate` rule**. They are different types: `check` returns `Diagnostic { code, severity }` and `validate` returns `Finding { rule, level }`. `level` is `violation` (not met) or `caution` (suspect), an axis of its own — it measures architectural weight, where `severity` measures how the composition is broken.

## Why the judgements left the core

`check` used to say two kinds of thing at once. "References an undefined space" (REF01) and "there is a hole in the envelope" (ENV01) sat in one array with the same `severity`. The first is a failure of reading — **the composition is broken**. The second is a judgement — **this is architecturally suspect**.

Two problems forced the split.

**First, green could not be defined in one sentence.** Writing down what "`check` is green" meant produced: "the composition is not self-contradictory, except that the envelope, stairs, daylight and site are also judged architecturally, but roughly." That is not a definition. It can be said in one sentence now: **the composition is self-consistent as data, and a single shape can be made from what is written. Nothing is claimed about architectural validity.**

**Second, every new judgement stretched the frozen surface.** Every time compartmentation, escape distance, smoke extraction or an area ratio by occupancy wanted adding, the ledger of diagnostic codes grew — and all of it looked like surface that had been promised not to break. Judgements now live on their own surface, where adding or dropping one moves no language version.

**Nothing was thrown away; it was moved.** Run `koyu validate` and those six rules still say the same things.

```sh
koyu validate examples/tower/main.muro
```

## Why sufficiency became one family

HGT03, HGT04, HGT05 and RUN04 were split across the height and vertical-circulation families by name, but they said one thing: **the information needed to make a shape is not written**.

| Retired | Its body then | What it was actually saying |
|---|---|---|
| HGT03 | The level above has no `slab`, so the height check with this storey cannot run | A value the formula needs is not written |
| HGT04 | The ceiling height is unknown, so the height check cannot run | The same |
| HGT05 | Its level cannot be determined | The z is not written |
| RUN04 | No level above, so no shape is generated | Not one shape comes out |

None of them reports a broken invariant. Where HGT01 / HGT02 say **the written values contradict each other**, these four said **the values are not written**. Different family.

Two of them changed weight when they were folded in. HGT04 (warning) became SUF01 (error), and HGT05 (warning) became SUF02 (error). With no ceiling height there is no height to extrude; with no level there is no z. Either way not one solid comes out, which is not *suspect* — **no shape can be made**. Severity is an invariant property of a code, so a change of weight demands a new spelling. That is the other reason these four are retired numbers.

The height check now looks only at whether the written values contradict; when a value is absent it moves on in silence, and saying so is the sufficiency check's job.

## BND07 alone has no replacement

`BND07` was once the warning "these touch, but no boundary is declared". Making a wall the default between two touching spaces ended its job. An undeclared contact no longer means "undefined" but "wall", and the declaration the warning was pressing for was replaced by the derivation itself.

So a `boundary` is written only to carry an exception (`type:open`, `air:1`) or to hang an attribute or an opening on it. Write nothing and a wall is derived.

**And since a wall is impassable without a door, a building with not one door written is green and sealed.** The instrument for looking at circulation is not `check` but `koyu doors`, and `koyu validate`'s `access.unreachable`.

## Back to the index

The 65 live codes are on [The diagnostic code index](index.md).
