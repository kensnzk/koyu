---
title: Extending attributes
mode: explanation
---

# Extending attributes

There are two ways to give meaning: **a large class hierarchy**, or **a few interpreted words plus an open vocabulary**. koyu takes the second. Extension is adding a word, not revising a schema, and that is where connections to outside classification systems — city data, property identifiers, sensors, network data — can land.

But **the openness has a shape.** Being open and being trustworthy are compatible provided the boundary is declared. **Without that declaration you cannot tell "not looked at" from "looked at and fine".** An "all clear" in that state means nothing.

## Types are free words

The second positional argument of `space` (the type) is required, but any value passes.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a wumbo X1..X2 Y1..Y2
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

The bundled examples actually use **32 distinct types** across 469 `space` lines. By frequency: `shop` (85), `corridor` (66), `room` (41), `shaft` (39), `exterior` (34), `service` (33), `unit` (20), `stair` (19), `hall` (15), and so on. That is **de facto usage**, not a ledger and not a contract.

## The two words that are not open

Of all types, exactly two are read structurally by the tools.

| Type | Interpretation |
|---|---|
| `exterior` | the exterior; may have no region. Add `road:` and it counts towards frontage |
| `void` | a void; excluded from floor area, not passable |

**Every other type, however meaningful it looks, is a free word as far as the tools are concerned.** `stair`, `shaft` and `ldk` are not interpreted as space types.

And these two words alone have **their spelling protected**.

```text
✖ near.muro:line 5: The type exteriorr looks like a misspelling of exterior (exterior is read structurally — if a different word was meant, spell it further away)
```

If `exteriorr` passed silently, that space would stop being the exterior and the gross floor area would double. **The cost of a one-character slip is too high, so near misses — and only near misses — are refused.** Distant words (`room`, `yard`, `wumbo`) draw no comment.

## Attributes come in three tiers

| Tier | Examples | What core does |
|---|---|---|
| **structural** | path, type, region, level, the other end of a relation, `kind` | **always read.** If it is broken, nothing is read |
| **interpreted** | `h`, `w`, `at`, `edge`, `daylight`, `road`, `site`, `style` … | the ledger defines the value range, and it **is read** |
| **carried** | `acme.sensor`, `bems.temp`, `survey.measured` … | **not read.** Open, with a namespace |

The carried tier takes a **dot-separated namespace**.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居間 acme.sensor:23 bems.temp:22.5
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
```

```text
✖ att.muro:line 5: /L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:居間)
```

**This used to pass silently.** The reasoning was that a word not in the ledger is not wrong, merely uninterpreted, so it went straight into the canonical JSON. The reasoning was consistent and the price was too high — by the same reasoning `heigh:2400` silenced the height invariant check, `sit:1` silenced site judgement, and `stiar:N` silenced vertical circulation entirely, **all of them staying green**.

The namespace is how that boundary is spelled. **Carrying without judging is a legitimate state, and saying so explicitly is the condition of the freedom.** The attribute ledger is [Attributes](../reference/muro/attributes.md); the error is detailed in [ATT](../reference/diagnostics/att.md).

## Judgement is entered by declaration, not by type

Where free types pay off is in seeing where judgement is entered.

To bring a windowless bathroom into daylight scope, do not change the type — write `daylight:1`.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
space /out exterior
boundary /L1/bath /out edge:S t:150
```

```text
✖ /L1/bath	浴室	window 0.00 m2 / floor 4.00 m2 = no window (needs 1/7 ≈ 0.57 m2)
✖ Short of 1/7: 1 of 1 room (this is a validation judgement)
```

Change the type from `wet` to `bedroom` and nothing about the judgement moves. **Whether a judgement applies is something the author declares; it is not inferred from a room's name.**

This matches practice. Under Japan's Building Standards Act a habitable room is decided by how the room is actually used, not by its label. Note also that the attribute names **a behaviour of the tool**, not the legal concept — the two are not the same set.

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
