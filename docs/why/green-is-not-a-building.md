---
title: What check guarantees
mode: explanation
---

# What check guarantees

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

That line says one thing only: **what is written does not contradict itself as data.** It sits at the same layer at which a JSON parser rejects broken JSON. **It is not a judgement but part of reading.**

This page draws that line with a worked example. The exact list of promises is in [Scope](../reference/scope.md).

## A sealed two-storey house

These eleven lines are green.

```muro
muro 1.2
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/hall hall X1..X2 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2
space /out outside:1
boundary /L1/hall /out t:150
boundary /L2/bed /out t:150
boundary /L1/hall /L2/bed type:stair
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

There are external walls, there is a stair, the levels line up, and the height invariant holds. **And there is no way out.**

```sh
npx tsx src/cli.ts doors sealed.muro /L2/bed /out
```

```text
Cannot reach /out from /L2/bed
```

The reason is simple. **The default between touching spaces is a wall, and a wall without a door cannot be passed.** Declare not one door and a two-storey house is perfectly sealed while staying green ([Default boundaries](silence.md)).

There used to be a warning for "these touch but no boundary is declared". Once the default became a wall it had no work left to do and was retired. **In a system where silence means a default wall, silence is not an omission.**

## Judgement is said by a different command

The seal is not overlooked. **A different surface catches it.**

```sh
npx tsx src/cli.ts validate sealed.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
✖ [koyu.schematic.access.unreachable] sealed.muro:line 6: Cannot reach the exterior: /L1/hall (no passable boundary leads out — write a door)
✖ [koyu.schematic.access.unreachable] sealed.muro:line 7: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
Validation — 2 violations / 0 cautions
```

`check` and `validate` are **different commands, returning different types, in different states of freeze**. That split is itself a design decision, and [check and validate](two-kinds-of-green.md) takes it up.

## An empty file is green too

At the extreme, `check` passes an empty file.

```text
✔ Consistent — 0 spaces / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Exit code 0. **There is no composition that fails to hold, so this is correct.**

`check` tests that what is written contains no contradiction; it does not test that what is needed has been written. **That asymmetry is not a defect but the definition.**

## What green does and does not guarantee

**Guaranteed** — uniqueness of paths and identity, existence of referents, definition of levels, overlap of regions in plan and in section, that composition resolves, sufficiency of the information needed to make a form, soundness of relations, uniqueness of derivation, value ranges of interpreted attributes, soundness of the given.

**Not guaranteed** — daylight, coverage ratio, floor area ratio, continuity of the envelope, whether a stair is climbable, whether a door can physically be installed, egress, road frontage, and every other kind of architectural validity. Plus the meaning of carried-tier attributes.

The line is drawn consistently. **`check` goes as far as "can a unique form be made from this"; "is that form architecturally valid" is `validate`.**

That is why overlap in section — a ceiling below and a floor above occupying the same z — is in `check`: it is the same kind of contradiction as two regions overlapping in plan, and no unique form comes out of it. Whereas height judgements like storey height, eaves height and setback envelopes are not in `check`.

The full list, mapped to diagnostic codes, is in [Scope](../reference/scope.md).

## What green entitles you to claim

| Claim | Can green support it? |
|---|---|
| This file can be read | **yes** |
| A unique form can be made from this file | **yes** |
| This file's canonical JSON is stable | **yes** |
| You can get out of the building | no → `doors` / `validate` |
| The envelope is closed | no → `validate`'s `koyu.schematic.envelope.gap` |
| There is enough daylight | no → `light` / `validate` |
| The stair is climbable | no → `runs` / `validate` |
| It works as a building | **no** |

**Never claim "it works" on the strength of green.** That is not an expression of caution; it is the definition of what `check` means.

## Next

- [check and validate](two-kinds-of-green.md) — why there are two
- [Scope](../reference/scope.md) — the complete list of guarantees
- [Judgement — koyu validate](../reference/validate/index.md)
- [koyu doors](../reference/cli/doors.md)
