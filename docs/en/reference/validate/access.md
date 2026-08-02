---
title: Reachability — access.*
mode: reference
---

# Reachability — access.*

| rule | level |
|---|---|
| [`access.unreachable`](#access-unreachable) | violation |
| [`access.voidonly`](#access-voidonly) | violation |
| [`access.throughtenant`](#access-throughtenant) | caution |
| [`access.parking`](#access-parking) | violation |
| [`access.backofhouse`](#access-backofhouse) | caution |

**A green `check` does not mean the building works.** The default between two touching spaces is a wall, so a two-storey building that declares not one door is completely sealed while contradicting nothing.

This chapter was written when that prophecy came true in the flagship example. With `check` green it was carrying "twenty units whose only doors open onto a floorless void", "an escape route driven through somebody else's shop", "two storeys of parking with no way out for a car", and "an escalator stranded behind the back of house". **The prophecy was walked into by the one who made it.** Fixing them and stopping them recurring are different things, so the five became rules.

## What counts as passable

Every rule here stands on one definition.

**Passable by a person** — a `type:open` boundary, a `type:stair` boundary joining levels, and a wall with a `door` written on it. `type:shaft` and `type:void` are not passable. Windows are not passable.

**Spaces you cannot pass through** — a space declaring `void:1`, and a space whose type is `shaft`. They may be continuous as space, but nobody walks through them to somewhere else.

> **Note that the spelling is guarded on one side only.** `void:1` is a key in the [ledger](../muro/attributes.md), so `voi:1` stops at [ATT03](../diagnostics/att.md#att03). `shaft` is **a free word in the type position**, so `shaftt` makes this rule quietly stop applying. Core reads no type at all; the judging face does — and that face [does not freeze](../scope.md).

**Passable by a car** (used only by [`access.parking`](#access-parking)) — a `type:open` boundary, a `door` at least 2400mm wide, and the vertical link of a space carrying `ramp:`. **The vertical link of a stair is, to a car, merely a step.**

## `access.unreachable` — the outside cannot be reached {#access-unreachable}

`violation`

A space with a region cannot reach a `type:exterior` space along passable boundaries.

```muro-fail
koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
```

```text
✖ [access.unreachable] main.muro:line 6: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
Validation — 1 violation / 0 cautions
```

The wall to the outside was written. There is no opening in it. **What is asked is reachability, not the presence of a door** — a door into a dead end still leads nowhere.

Out of scope: spaces with no region, an `outside:1` space itself, a space whose type is `shaft`, and a `void:1` space. And **a model with no exterior space at all is never asked** — telling it that it cannot reach an outside it never described would mean nothing.

It is a violation because there is no reading of architecture in which a room you cannot leave is fine.

**Fix** — write a `door` somewhere along the route out. A boundary to the outside has several segments, so pick one with `edge:N/E/S/W`.

```muro
koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
  door w:900 edge:S
```

To find where the chain breaks, [`koyu doors`](../cli/doors.md) answers with the route of fewest doors.

## `access.voidonly` — the doors open only onto a void {#access-voidonly}

`violation`

The space has passable boundaries, and every one of them leads to a `type:void`.

```muro-fail
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/v X1..X2 Y1..Y2 void:1
space /L1/a room X2..X3 Y1..Y2
boundary /L1/a /L1/v type:open
```

```text
✖ [access.voidonly] main.muro:line 6: Doors open only onto a void: /L1/a (they open where there is no floor, so nobody can pass)
Validation — 1 violation / 0 cautions
```

A void is continuous as space but **has no floor**. The door opens onto a hole: you go through it and arrive nowhere. It happens when units are lined up facing an atrium and the boundary to the corridor is forgotten. The flagship example carried twenty of them while green.

This rule does not care whether an exterior exists. It also does not fire on a space with no passable boundary at all — that is [`access.unreachable`](#access-unreachable)'s job.

**Fix** — write a door to a neighbour that has a floor (a corridor, a stair). If the edge onto the void really is open, it is a place to **look down from**, not to walk through: make it an `air:1` wall (a railing) rather than `type:open`.

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/v X1..X2 Y1..Y2 void:1
space /L1/a room X2..X3 Y1..Y2
boundary /L1/a /L1/v air:1 h:1100
```

## `access.throughtenant` — the escape runs through a tenancy {#access-throughtenant}

`caution`

Every route out of a space whose type is `stair` passes through a `use:rentable` space.

```muro-caution
koyu 1.1
grid X 0 3000 9000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/s stair X1..X2 Y1..Y2
space /L1/t room X2..X3 Y1..Y2 use:rentable
boundary /L1/s /L1/t
  door w:900
boundary /L1/t /out
  door w:1800 edge:S
boundary /L1/s /out t:150
```

```text
⚠ [access.throughtenant] main.muro:line 6: Escape from /L1/s passes through rentable space (if the tenant locks up, there is no way out)
Validation — 0 violations / 1 caution
```

**The moment the tenant locks up, that stair stops being an escape.** `use:` is inherited from the zone, so the judgement applies even when the individual units do not carry it, as long as a parent zone says `use:rentable`.

**Why this is a caution** — whether it may pass through is a fact on the side of the lease and the jurisdiction, and it is not in what was written. Designs that run a dedicated passage through a tenancy do exist. It is worth doubting, but there is nothing here on which to rule.

**Fix** — write a route out that avoids the tenancy (a common corridor, a lobby). If the stair discharges directly, write a `door` on that boundary.

## `access.parking` — a car cannot get out {#access-parking}

`violation`

A `use:parking` space cannot reach the outside along car-passable boundaries.

```muro-fail
koyu 1.1
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:900 edge:S
```

```text
✖ [access.parking] main.muro:line 6: No vehicle route to the exterior: /L1/p (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
Validation — 1 violation / 0 cautions
```

**People get out through a 900mm door and a stair, so [`access.unreachable`](#access-unreachable) never sees this.** That is why parking is asked with a different traveller.

**Fix** — make the vehicle opening `door w:2400` or wider, or make the boundary `type:open`. For parking above or below grade, write `ramp:` on the ramp space and join the levels with `stack` — that vertical link is the only way a car changes level.

```muro
koyu 1.1
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:2400 edge:S
```

## `access.backofhouse` — unreachable from a common corridor without crossing the back of house {#access-backofhouse}

`caution`

A `use:common` space declaring a vertical run (`stair:` / `escalator:`) cannot be reached from a common corridor without crossing a space whose type is `backyard`.

```muro-caution
koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/c corridor X1..X2 Y1..Y2 use:common
space /L1/b backyard X2..X3 Y1..Y2
space /L1/e room X3..X4 Y1..Y2 use:common escalator:N
space /L2/e room X3..X4 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /L1/c /L1/b
  door w:900
boundary /L1/b /L1/e
  door w:900
```

```text
⚠ [access.backofhouse] main.muro:line 8: /L1/e cannot be reached from a common corridor without passing through back-of-house (visitors cannot use this vertical circulation)
Validation — 0 violations / 1 caution
```

A common vertical run belongs to the customer's route. If reaching its foot means crossing the back of house, no customer rides it.

**Entry to the space itself must be horizontal.** Allow its own vertical link and the circle "come down that escalator from the floor above and you arrive at its foot" closes, letting a stranded run pass unnoticed. So the check only considers routes that do not use a `type:stair` boundary incident to the space in question.

**A building with no common corridor (type `corridor` and `use:common`) is never asked.** A house draws no customer/staff distinction, and its stair should not be reported as stranded.

**Why this is a caution** — "every common vertical run is for customers" is a coarse inference. A common stair meant for staff can be misread as a customer's.

**Fix** — move it where the common corridor reaches it directly, or write a door between it and the corridor. If it really is for staff, drop `use:common`.

```muro
koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/b backyard X1..X2 Y1..Y2
space /L1/c corridor X2..X3 Y1..Y2 use:common
space /L1/e room X3..X4 Y1..Y2 use:common escalator:N
space /L2/e room X3..X4 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /L1/b /L1/c
  door w:900
boundary /L1/c /L1/e
  door w:900
```

## See also

- [`koyu doors`](../cli/doors.md) — the route between two spaces that passes fewest doors
- [Columns](column.md) — the other reason a door does not work: something stands in it
- [The envelope](envelope.md) — a hole in the outline means the relation to the outside was never written
- [The validation ledger](index.md) — all fifteen rules, and why `Finding` is not `Diagnostic`
