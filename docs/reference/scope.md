---
title: Scope — what a green check means
mode: reference
---

# Scope — what a green check means

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

What that one line promises, and what it does not. **That is this page.**

## The definition of green

> **For the structural tier and the interpreted tier, the declared invariants hold. About the carried tier it says nothing. About architectural validity it says nothing.**

This is not a judgement but **part of reading** — the same layer at which a JSON parser rejects broken JSON.

## Three domains

koyu is made of three domains. **They are kept apart because the quality demanded of each is different.**

| Domain | What it holds | Size | Quality | Version |
|---|---|---|---|---|
| **core** | the language, its semantics, composition, identity, [derivation](form/index.md), structural diagnostics, questions, [canonical JSON](json/index.md) | small | **must be clean** | **freezes** |
| **validation** | [architectural judgement](validate/index.md) — sixteen rules, under a profile you name | grows | may be messy | does not freeze |
| **presentation and build** | SVG generation and outside viewers | grows | may be messy | does not freeze |

**The dependency runs one way.** Validation and presentation depend on core; core depends on neither. Core runs complete on its own. That one-wayness is enforced by a test, not by prose.

Not separating them makes two things happen at once — **mess seeps into core and freezes there, and core's caution stops validation and presentation from growing**. The separation itself is what makes it acceptable for the other two to be messy. Mess in a domain that does not freeze can be rewritten at any time, so it is cheap. Mess in a domain that freezes is permanent.

Even the types are separate. Core returns `Diagnostic { code, severity }`; validation returns an `AssessmentReport` whose findings carry `{ rule, level }` around outcomes carrying `{ status }`. **Adding a judgement never moves the language version.**

## What is guaranteed

| Guarantee | Diagnostics |
|---|---|
| Uniqueness of paths and identity | [UID01–04](diagnostics/uid.md) / [ZON02](diagnostics/zon.md) / duplicate-path errors during composition |
| Existence of referents | [REF01](diagnostics/ref.md) / undefined asset / the zone a `polygon` belongs to ([SIT04](diagnostics/sit.md)) |
| Levels are defined | [LVL01](diagnostics/lvl.md) / [VRT02](diagnostics/vrt.md) |
| Overlapping regions (in plan) | [GEO01 / GEO02](diagnostics/geo.md) |
| Overlapping regions (in section) | [HGT01 / HGT02](diagnostics/hgt.md) |
| Composition resolves | composition errors |
| **Sufficiency of what shape needs** | [SUF01–04](diagnostics/suf.md) |
| Soundness of relations | [BND01–06](diagnostics/bnd.md) / [VRT01–06](diagnostics/vrt.md) |
| Uniqueness of derivation (openings, `seg`s, lines, columns, run shapes) | [OPN01–08](diagnostics/opn.md) / [SEG01–08](diagnostics/seg.md) / [LIN01–03](diagnostics/lin.md) / [COL01–02](diagnostics/col.md) / [RUN01–03 / RUN05](diagnostics/run.md) |
| Value domains of interpreted attributes | [ATT01–03](diagnostics/att.md) / [DAY01](diagnostics/day.md) |
| Soundness of the givens | [SIT01 / SIT02](diagnostics/sit.md) |

**Overlap in section belongs to core because it is the sectional case of overlap in plan.** A ceiling below and a floor above occupying the same z is the same kind of contradiction as two space regions overlapping, and no single shape can be made from it. Architectural judgements about height — storey height, eaves height, setback envelopes — are not guaranteed; those are the validation face.

## What is not guaranteed

**Daylight, area ratios, floor area ratio, envelope continuity, whether a stair is climbable, whether a door can physically be installed, means of escape, street frontage — and every other question of architectural validity.** Plus **the meaning of [carried-tier](muro/attributes.md) attributes**.

None of these are absent. They are **on another face** — [`koyu validate`](cli/validate.md) holds them.

```sh
npx tsx src/cli.ts validate examples/two-rooms.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

The output says so itself.

## Do not claim "it works" because it is green

Green does not mean the building is usable.

**Touching spaces default to a wall, so a two-storey building that declares not one door stays green and is completely sealed.** The envelope does not grow by itself either — no default is derived against a space with no region (the exterior), so a forgotten `boundary` to the outside becomes a silent absence of wall.

Circulation is answered by [`koyu doors`](cli/doors.md); judgement by `koyu validate`.

## Questions do not say pass or fail

Core holds the questions of quantity and graph. **It just never says pass or fail.**

| Question | What core returns | What validation says |
|---|---|---|
| Daylight | floor area and effective window area | whether it meets 1/7 (`koyu.schematic.daylight.ratio`) |
| Site | site area, frontage length, building area, total floor area and their ratios | 2m of frontage (`koyu.schematic.site.frontage`), escape beyond the line (`koyu.schematic.site.escape`) |
| Vertical runs | riser count, riser, going, slope | whether it is cramped (`koyu.schematic.stair.proportion`), whether the slope is acceptable (`koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope`) |
| Envelope | outline segments facing nothing | whether that is a hole (`koyu.schematic.envelope.gap`) |
| Circulation | the minimum-door route and passability | whether you can reach the outside (`access.*`) |
| Columns and openings | columns standing on grid intersections, openings on a segment | whether they collide (`koyu.schematic.column.blocksdoor`) |

**Thresholds belong to architecture.** Neither 1/7 nor 2m nor 240mm is an invariant a composition must satisfy. **Core returns numbers; validation draws lines through them.**

## The three attribute tiers

| Tier | Examples | How core treats it |
|---|---|---|
| **Structural** | path, region, level, the other end of a relation, `kind` | **always read.** If it is broken, nothing is read |
| **Interpreted** | `h` `use` `daylight` `road` `site` `style` … | the ledger defines the value domain, and core **reads it** |
| **Carried** | `acme.sensor` `bems.temp` `survey.measured` … | **not read.** Open, with a namespace |

**The carried tier carries a namespace** (dot-separated). An unknown key without one is **an error** ([ATT03](diagnostics/att.md)) — so that a one-letter slip like `heigh:2400` cannot silently do nothing. That is the only shape in which "not looked at" and "looked at and fine" can be told apart.

Without the declaration, they cannot be told apart, and **"nothing wrong" in that state means nothing. Being able to carry something without judging it is a legitimate state, and saying so explicitly is the condition of that freedom.**

## Neighbouring pages

- [Stability](stability.md) — what is promised not to break
- [Identity](identity.md) — how far a uid guarantees anything
- [What koyu does not hold](not-held.md) — the resolution of this description
- [koyu check](cli/check.md) — using the gatekeeper
- [koyu validate](cli/validate.md) — the judgement face
- [Diagnostics](diagnostics/index.md) — 65 codes
- [Judgements](validate/index.md) — 16 rules
