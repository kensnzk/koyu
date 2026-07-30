---
title: DAY — the daylight scope
mode: reference
---

# DAY — the daylight scope

There is only one DAY code.

| Code | Severity | What it says |
|---|---|---|
| DAY01 | error | `daylight` carries a value that is neither 0 nor 1 |

`daylight` is a **binary declaration** — whether the daylight test applies to this space — and it is the **sole entrance** to `koyu light`. Nothing is inferred from the type: write `bedroom` or write `room`, and without `daylight:1` the space is not in scope.

So a wobble in the spelling of the value is **a total loss of the verdict**. Let `daylight:yes` through as a free attribute and the space drops silently out of scope, and `light` returns output indistinguishable from "every room passes". DAY01 exists for that one reason.

## DAY01 — daylight is either 1 or 0

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:yes
```

```text
daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes
```

**Cause** — `daylight` carries something that is neither `1` nor `0`. `yes`, `true` and `on` all fail.

What is read is the value, not the spelling. A spelling that reads as a number becomes one, so `1.0`, `01` and `1.00` are treated exactly as `daylight:1` and draw no diagnostic; `0.0` is likewise `0`.

**Fix** — write `daylight:1` (test it) or `daylight:0` (do not).

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:1
```

**Writing nothing is also a choice.** With no `daylight`, the space is out of scope. DAY01 only looks at values that were written, so leaving it out never fires. Writing `daylight:0` explicitly says "considered, and deliberately out of scope".

## The type is irrelevant

**The daylight scope is declared, never inferred.**

- Write `daylight:1` on a `wet` and the washroom is tested.
- Write nothing on a `bedroom` and the bedroom is not.

This also hands the granularity to the writer. If a dwelling is written as one space, put `daylight:1` on the dwelling; if it is split into rooms, put it on each room. **Where you write `daylight:1` is where you decide the denominator of the test.**

## What being in scope produces

`koyu light` reports, per space, the ratio of effective window area to floor area.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2 daylight:1
space /out exterior
boundary /L1/a /out t:150
  window w:1800 h:1500 edge:S
boundary /L1/b /out t:150
  window w:400 h:400 edge:S
```

```sh
koyu light house.muro
```

```text
✔ /L1/a	a	window 2.70 m2 / floor 14.40 m2 = 1/5.3 (needs 1/7 ≈ 2.06 m2)
✖ /L1/b	b	window 0.16 m2 / floor 14.40 m2 = 1/90.0 (needs 1/7 ≈ 2.06 m2)
✖ Short of 1/7: 1 of 2 rooms (this is a validation judgement)
```

The window area is the sum of `w × h` over the `window`s on that space's boundaries **that carry an `h:`**. A window with no `h:` cannot be counted — that the count is incomplete is reported by `koyu validate` as `daylight.unknown`. If the far side of a window is semi-outdoor and that semi-outdoor space has something above it (under a balcony, under an eave), a factor of 0.7 applies; if the sky is open above it, 1.0.

The verdict itself — whether 1/7 is met — is an architectural judgement, so it lives in `koyu validate` as `daylight.ratio`, not in `check`. `check` says only whether the declaration can be read.

## Related

- [ATT — attributes](./att.md) — the key and value checks for every other attribute
- [VER — the language version](./ver.md) — up to 0.3 the daylight scope was inferred from the type (VER02)
- [koyu validate](../cli/validate.md) — `daylight.ratio` / `daylight.unknown`
- [koyu check](../cli/check.md)
