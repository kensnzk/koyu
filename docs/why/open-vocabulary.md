---
title: Extending attributes
mode: explanation
---

# Extending attributes

There are two ways to give meaning: **a large class hierarchy**, or **a few interpreted words plus an open vocabulary**. koyu takes the second. Extension is adding a word, not revising a schema, and that is where connections to outside classification systems — city data, property identifiers, sensors, network data — can land.

But **the openness has a shape.** Being open and being trustworthy are compatible provided the boundary is declared. **Without that declaration you cannot tell "not looked at" from "looked at and fine".** An "all clear" in that state means nothing.

## Types are free words

The second positional argument of `space` is the type. It is optional, and any value passes.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a wumbo X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

The words the bundled examples reach for most are `shop`, `corridor`, `shaft`, `room`, `service`, `unit`, `stair` and `hall`, and a good many `space` lines write no type at all. That is **de facto usage**, not a ledger and not a contract.

## Not one word is closed

**The type position is open all the way through.** Core never reads it. `stair`, `shaft`, `ldk` and `厨房` are all equally free words to core, and writing none at all is fine.

Two words used to be the exception. `exterior` and `void` — being outside, having no floor — were written in the type position and read structurally. **And that is what made the claim on this page untrue.**

```text
✖ near.muro:line 5: The type exteriorr looks like a misspelling of exterior …
```

That watch was put there after a measurement: one extra character in `exteriorr` stopped a space being outside and took the gross floor area from 16.20 m2 to 32.40 m2, with `check` green throughout. But refusing words one edit away is **a hunch standing in for a rule**, and it could not even be widened to two — two edits from `void` reaches `road` and `wood`, words a person may legitimately write. When the reach of a protection is set by what a heuristic happens to allow, it is not a design.

## The two words moved into the declaration

```muro-part
space /out name:南側道路 road:6000 outside:1
space /L2/hole X1..X2 Y1..Y2 name:吹抜け void:1
```

`outside` and `void` became keys in the [ledger](../reference/muro/attributes.md). The same protection now applies **as a rule**: `outsid:1` is an [ATT03](../reference/diagnostics/att.md#att03) error and `void:2` is [ATT02](../reference/diagnostics/att.md#att02). The watch is gone — what it guarded left the type position, so there was nothing left to guard.

And the author keeps a way out. `acme.outside:1` passes as carrier tier, because that is **the author spelling out "this word is mine and the tool does not read it"**. That is what the three tiers below are for, and it is the exact condition under which being open and being trustworthy hold together.

## Attributes come in three tiers

| Tier | Examples | What core does |
|---|---|---|
| **structural** | path, region, level, the other end of a relation, `kind` | **always read.** If it is broken, nothing is read |
| **interpreted** | `h`, `w`, `at`, `edge`, `daylight`, `road`, `site`, `style` … | the ledger defines the value range, and it **is read** |
| **carried** | `acme.sensor`, `bems.temp`, `survey.measured` … | **not read.** Open, with a namespace |

The carried tier takes a **dot-separated namespace**.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居間 acme.sensor:23 bems.temp:22.5
space /out outside:1
boundary /L1/a /out
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

core gives `acme.sensor` and `bems.temp` **no meaning whatsoever** — it does not check their range and uses them in neither derivation nor judgement. Write anything.

**An unknown key without a namespace is an error.**

```muro-bad
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 nmae:居間
space /out outside:1
boundary /L1/a /out
```

```text
✖ att.muro:line 4: /L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:居間)
```

**This used to pass silently.** The reasoning was that a word not in the ledger is not wrong, merely uninterpreted, so it went straight into the canonical JSON. The reasoning was consistent and the price was too high — by the same reasoning `heigh:2400` silenced the height invariant check, `sit:1` silenced site judgement, and `stiar:N` silenced vertical circulation entirely, **all of them staying green**.

The namespace is how that boundary is spelled. **Carrying without judging is a legitimate state, and saying so explicitly is the condition of the freedom.** The attribute ledger is [Attributes](../reference/muro/attributes.md); the error is detailed in [ATT](../reference/diagnostics/att.md).

## The type is the room's purpose

A key called `use` used to sit beside the type. The two were answering different questions, and **only one of them was a question about the room.**

The type says what the room is for — `office`, `stair`, `parking`, `厨房`. `use` was for every other division of the building: a tenancy, the lettable-versus-common split, a fire compartment, a department. It held **one value per space**, so those competed for it and whichever you wrote shut the others out. A room is in a fire compartment and a tenancy and a department at the same time; one key could hold only one of them.

So the other divisions leave the language. Each is a namespaced key of the author's own, and a space carries as many at once as it needs.

```muro
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200
space /L1/a office X1..X2 Y1..Y2 name:執務室 lease.category:rentable fire.compartment:C1 dept.name:営業
space /out outside:1
boundary /L1/a /out
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Totalling by one of them is [`koyu stats --by lease.category`](../reference/cli/stats.md). **The caller names the key and there is no default**, because a default would be the one privileged grouping again. `use` is retired from muro 1.4 ([VER07](../reference/diagnostics/ver.md#ver07)); a file declaring 1.2 or earlier goes on writing it and goes on meaning by it what it always meant.

**IFC divides it the same way.** `IfcSpace` has no "use" attribute — a room's purpose is a classification reference (OmniClass table 13, Uniclass SL). Grouping is `IfcZone`, and one space may be a member of several at once. The building's own occupancy is somewhere else again: `Pset_BuildingCommon.OccupancyType`, on `IfcBuilding` rather than on any room.

## Where a judgement gets its population

Where free types pay off is in seeing where judgement is entered.

To bring a windowless bathroom into daylight scope, do not change the type — write `daylight:1`.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
space /out outside:1
boundary /L1/bath /out edge:S t:150
boundary /L1/bath /out edge:E
boundary /L1/bath /out edge:N
boundary /L1/bath /out edge:W
```

```text
  /L1/bath	浴室	window 0.00 m2 / floor 4.00 m2 = no window
1 room in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

Change the type from `wet` to `bedroom` and nothing about the judgement moves. **Daylight scope is not what the room is for**, so it is not inferred from the room's name — the author declares it.

This matches practice. Under Japan's Building Standards Act a habitable room is decided by how the room is actually used, not by its label. Note also that the attribute names **a behaviour of the tool**, not the legal concept — the two are not the same set.

Where a judgement's population really is the room's purpose, the type is where it reads: [`koyu.schematic.access.parking`](../reference/validate/access.md) takes the spaces typed `parking` or `ramp`. That is a judgement selecting on a free word — a liberty [the face that does not freeze](three-domains.md) has and the language does not.

## The discipline for adding words

An open vocabulary does not mean anything may be added. Five questions settle whether a word or feature is adopted.

1. **Does it have substance?** If so it takes a seat on a relation or on the given. It does not go on a space.
2. **Is it given?** Coordinates that are not given are not written.
3. **Can several opinions exist at the same seat?** If so it goes onto composition's set editing. No bespoke syntax.
4. **Is it a judgement?** Then it belongs to the validation surface, not to the notation.
5. **Is it form?** Then it belongs to the drawing surface, not to the notation.

**"Would this let real architecture be written?" is not one of the tests.** No decision is recorded with the reservation "we will decide if a real example demands it". A reservation is an entrance for expansion.

## Next

- [Attributes](../reference/muro/attributes.md) — the ledger
- [ATT — attribute diagnostics](../reference/diagnostics/att.md)
- [Judgement — koyu validate](../reference/validate/index.md)
- [check and validate](two-kinds-of-green.md)
