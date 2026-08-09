---
title: window — the opening that brings in light
mode: reference
---

# window — the opening that brings in light

```text
boundary /pathA /pathB …
  window [AssetName] w:1650 h:1100 [at:…] [edge:…] [name:…] [sill:…]
```

A `window` is written **one level of indentation** under a [boundary](boundary.md). How its position is written — the ratio and grid-reference forms of `at`, choosing a side with `edge` — follows exactly the same rules as a [door](door.md).

Two things differ. **A window is not passable**, so it adds no edge to the graph `koyu doors` walks; a wall with nothing but windows is still a wall you cannot get through. And **a window counts toward daylight**.

## Write both w and h

| Attribute | Required | Meaning |
|---|---|---|
| `w` | **yes** | width in mm along the segment. A referenced [asset](asset.md) may supply it |
| `h` | optional for form / **required** for daylight | height in mm |

Without `w`, parse stops. Without `h`, `check` still comes back green — but the window **drops out of the daylight count entirely**, because window area is the sum of `w × h` over the windows that have an `h`.

```muro
muro 1.2
name 窓の書き方
unit mm

grid X 0 6000
grid Y 0 4000
level L1 0 h:2700 slab:200

space /L1/a room X1..X2 Y1..Y2 name:居室 daylight:1
space /out name:外部 outside:1

boundary /L1/a /out t:150 edge:S
  window w:1650 h:1100 sill:900 name:腰窓
boundary /L1/a /out t:150 edge:N
  window w:2600 h:2200 name:掃き出し窓
boundary /L1/a /out t:150 edge:E
  door w:900 h:2100 name:出口
boundary /L1/a /out t:150 edge:W
```

```text
  /L1/a	居室	window 7.54 m2 / floor 24.00 m2 = 1/3.2
```

Drop `h:1100` from the low window and the number falls from 7.54 to 5.72.

```text
  /L1/a	居室	window 5.72 m2 / floor 24.00 m2 = 1/4.2 ⚠ windows without h: are not counted
```

`koyu check` stays green. What puts it into words is validation, under the rule **`koyu.schematic.daylight.unknown`** (caution).

```text
⚠ [koyu.schematic.daylight.unknown] win.muro:line 9: Window area is not fully counted: /L1/a has a window without h: (write h: on it)
```

**It does not say "there is not enough window"; it says "the count is not complete".** The report is that the source does not carry enough to answer the question either way.

## Sill height is not written — it is what aligning the head leaves behind

**The head of an opening sits at the lintel height of 2000mm.** A door rises from the floor to meet it; every other opening drops from it by its own height.

| Written | z range of the opening (above FL) |
|---|---|
| `window w:1650 h:1100` | 900 … 2000 |
| `window w:2600 h:2200` | −200 … 2000 |
| `window w:1650` (no `h`) | 800 … 2000 (default height 1200) |

The 900mm sill on the first line is written nowhere. **It is what 2000 − 1100 leaves.** And as the second line shows, take `h` above the lintel height and the bottom of the opening falls below the floor. If you want a full-height window, choose `h` knowing that the difference from the lintel height is what does the work.

`sill:` is a **carried** attribute — it is in the ledger, but the core never reads it once. Write it and it travels into the canonical JSON for another tool to use. It moves no geometry. Change `sill:900` to `sill:400` in the example above and the window still runs 900 … 2000.

## The daylight coefficient

`light` looks only at **spaces with a region that carry `daylight:1`**. Nothing is inferred from the type — write `room` or write `bedroom`, and without the declaration the space is out of scope.

Effective window area is discounted by **what lies beyond the window**.

| What the window faces | Coefficient |
|---|---|
| the outside (`outside:1`) | 1.0 |
| semi-outdoor with a space above it (under a balcony, under an eave) | 0.7 |
| semi-outdoor open to the sky (a garden, a top-floor balcony) | 1.0 |
| anything else (indoors to indoors) | 0 — not counted |

Whether a space is semi-outdoor, and whether it is covered from above, are both derived rather than declared. A space with a region that meets the outside across an `open` or `air:1` boundary is semi-outdoor.

The judgement itself — effective window area ≥ floor area ÷ 7 — is passed by `koyu validate` under **`koyu.schematic.daylight.ratio`** (violation), not by `check`. It is a rough early warning with no correction factor applied, and it looks at neither use-class proportions nor which buildings the rule applies to. Where the 1/7 lands is decided by the author, in choosing where to write `daylight:1`.

## Attribute tiers

| Attribute | Tier |
|---|---|
| `w` `h` `at` `edge` `hinge` `swing` | structure |
| `style` `name` | interpreted |
| `sill` `spec` `fire` | carried |

A window uses the same ledger as a door. `hinge`, `swing` and `style` may all be written, but as a window is not passable no arc is drawn. A key outside the ledger needs a namespace containing a dot (`acme.glazing:low-e`) or it is ATT03.

## Diagnostics

The diagnostics are shared with the door: OPN01 through OPN08, VRT05, UID04. OPN03 (an opening on an `open` boundary) says the same thing it says for a door — no effect on passage — which for a window was never in question.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [boundary](boundary.md) — the relation a window sits on
- [door](door.md) — same rules for position; only this one is passable
- [asset](asset.md) — putting the defaults of a window in one place
- [koyu light](../cli/light.md) — returns the daylight numbers
- [koyu validate](../cli/validate.md) — passes the 1/7 judgement
