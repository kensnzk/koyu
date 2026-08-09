---
title: Daylight — daylight.ratio / daylight.unknown
mode: reference
---

# Daylight — daylight.ratio / daylight.unknown

| rule | level |
|---|---|
| [`koyu.schematic.daylight.ratio`](#daylight-ratio) | violation |
| [`koyu.schematic.daylight.unknown`](#daylight-unknown) | caution |

**The scope of the daylight question is declared, never inferred.** A `room` is not necessarily a habitable room, and a `storage` may well be required to have a window. The one-seventh judgement applies to the spaces you wrote `daylight:1` on, and nowhere else. At what grain the question is asked — a whole dwelling, or each room it is divided into — is decided by where you write `daylight:1`.

The only values `daylight:` accepts are `1` (in scope) and `0` (out of scope). Write `daylight:yes` and [`koyu check`](../cli/check.md) makes it an error on the spot — a value it cannot interpret must not fall silently back to a default, taking the judgement with it.

## The numbers, and where the threshold enters

Floor area and effective window area are **numbers**, not judgements. [`koyu light`](../cli/light.md) returns those numbers; this volume applies the threshold.

- **Floor area** — the area of the region, measured to wall centrelines (m²).
- **Effective window area** — for every `window` written on a boundary of that space, `w × h × factor`, summed (m²).
- **Required area** — floor area ÷ 7.

The factor depends on **what the window faces**. That is a derivation of form, not an architectural judgement.

| what the window faces | factor |
|---|---|
| an exterior space (`exterior`) | 1.0 |
| a semi-outdoor space with a floor above it — under an eave or an upper balcony | 0.7 |
| a semi-outdoor space open to the sky — a garden, a top-floor balcony | 1.0 |
| an indoor neighbour | 0 (not counted) |

Being semi-outdoor is derived too: a space that meets an exterior across a `type:open` boundary, or across an `air:1` boundary (a railing or anything else that does not screen), is semi-outdoor. "Has a floor above" means some space on any level overlaps it from above.

**The judgement is coarse.** No correction factor is applied, no use-based proportions are considered, and no distinction is drawn between buildings the rule applies to and those it does not. It is an early warning at the resolution of a scheme design, not a compliance verdict.

## `koyu.schematic.daylight.ratio` — insufficient daylight {#daylight-ratio}

`violation`

The effective window area is below one seventh of the floor area.

```muro-fail
muro 1.2
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
  door w:900 edge:N
```

```text
✖ [koyu.schematic.daylight.ratio] main.muro:line 6: Insufficient daylight: /L1/a — effective window 0.36 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
Validation — 1 violation / 0 cautions
  koyu.profile.schematic-screen@1 — 6 evaluated / 10 not applicable / 0 indeterminate / 0 error
```

A 600×600 window is 0.36 m²; the floor is 3600×4500 = 16.20 m², so 2.31 m² is required. **It is short by an order of magnitude.**

**Fix** — enlarge the windows or add more. Check that `h:` has not been forgotten (if it has, the `koyu.schematic.daylight.unknown` below will be there too). If the space does not need the question asked of it, drop `daylight:1`.

[`koyu light`](../cli/light.md) lays the numbers out room by room so you can see how far short you are.

### Under a balcony the factor is 0.7

The same window through a balcony with a floor above it is multiplied by 0.7.

```muro-fail
muro 1.2
grid X 0 3600 5400
grid Y 0 4500
level L1 0 h:2400 slab:150
level L2 2550 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b balcony X2..X3 Y1..Y2
space /L2/a room X2..X3 Y1..Y2
boundary /L1/b /out type:open
boundary /L1/a /L1/b t:150
  window w:2400 h:1200
boundary /L1/a /out t:150
  door w:900 edge:N
boundary /L2/a /out t:150
  door w:900 edge:N
```

```text
✖ [koyu.schematic.daylight.ratio] main.muro:line 7: Insufficient daylight: /L1/a — effective window 2.02 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
Validation — 1 violation / 0 cautions
  koyu.profile.schematic-screen@1 — 6 evaluated / 10 not applicable / 0 indeterminate / 0 error
```

The window is 2400×1200 = 2.88 m², but `/L2/a` sits on top of the balcony, so 2.88 × 0.7 = 2.02 m², short of the 2.31 m² required. Remove `/L2/a` and the same window counts as 2.88 m² and the judgement passes — **what sits above the balcony decides the daylight of the room below it.**

## `koyu.schematic.daylight.unknown` — the window area is not fully counted {#daylight-unknown}

`caution`

A `window` without `h:` has dropped out of the sum.

```muro-caution
muro 1.2
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:2400 h:1200 edge:S
  window w:600 edge:E
  door w:900 edge:N
```

```text
⚠ [koyu.schematic.daylight.unknown] main.muro:line 6: Window area is not fully counted: /L1/a has a window without h: (write h: on it)
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 6 evaluated / 10 not applicable / 0 indeterminate / 0 error
```

A window with no `h:` has no height, therefore no area, and it falls silently out of the sum. **Silence there makes "it is enough" indistinguishable from "it was not counted."** This caution exists solely to keep those two apart.

Here the south window alone (2.88 m²) already clears one seventh, so no `koyu.schematic.daylight.ratio` appears. Both can appear together, and if every window lacks `h:` the effective area is 0.00 m² and `koyu.schematic.daylight.ratio` comes with it.

Only windows on boundaries **whose factor is not zero** are counted. A window facing an indoor neighbour without `h:` says nothing, because it was never going to be counted.

**Fix** — write `h:` on that window. If it has nothing to do with daylight (an inspection hatch in a cupboard, say), drop `daylight:1` from the space instead.

## See also

- [`koyu light`](../cli/light.md) — the floor and effective window areas themselves
- [The validation ledger](index.md) — every rule, and why a judgement is not a diagnostic
