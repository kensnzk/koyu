---
title: asset — a door and window type
mode: reference
---

# asset — a door and window type

```text
asset <name> door|window [key:value...]
```

An `asset` is **a bundle of defaults to be referenced**. It is not a fourth element — not something standing beside spaces, boundaries and zones, but a device for putting the source of an [opening](door.md)'s attributes in one place.

```muro-part
asset SD1 door   w:800  h:2000 style:sliding name:片引き戸
asset W1  window w:2600 h:2200 sill:0        name:掃き出し窓
```

The first positional argument is the name, the second is `door` or `window`. The rest are attributes, and they become the defaults on the referencing side.

## The reference is the first token of the opening

The **first token on the opening line that is not a `key:value`** is read as an asset name.

```muro-part
boundary /home/ldk /home/hall1 t:120 spec:LGS
  door SD1 edge:E hinge:S swing:b
```

The asset's attributes become the defaults, and **the instance's attributes override them**.

```muro
koyu 1.0
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
asset D1 door w:900 h:2100 style:hinged name:玄関ドア
space /L1/a room X1..X2 Y1..Y2 name:室
space /out name:外部 outside:1
boundary /L1/a /out t:150
  door D1 w:1200 edge:S name:大扉
```

The composed opening comes out like this. `h` and `style` flowed in from the asset; `w` and `name` were replaced by the instance.

```json
{
  "kind": "door",
  "ref": "D1",
  "w": 1200,
  "h": 2100,
  "at": 0.5,
  "edge": "S",
  "attrs": {
    "name": "大扉",
    "style": "hinged"
  }
}
```

The reference itself (`ref`) survives into the canonical JSON, and so does the asset definition, under `assets`. **Assets do not disappear in composition** — their values are baked into the opening and their provenance is kept.

## The writable attributes are the opening's

An asset uses [the opening ledger](door.md) unchanged. There is no attribute writable on an asset but not on an opening, nor the other way round.

| Attribute | Tier |
|---|---|
| `w` `h` `at` `edge` `hinge` `swing` | structure |
| `style` `name` | interpreted |
| `sill` `spec` `fire` | carried |

A key outside the ledger needs a namespace containing a dot.

```text
✖ asset D1 carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:塗装)
```

## Three errors

**A mismatched kind stops.** A window asset cannot be used as a door.

```text
✖ The asset W1 is a window (it cannot be used as a door)
```

**An undefined reference stops.** A misspelling never slips through as "a leading token that happens not to be an asset name".

```text
✖ Undefined opening asset: SD9
```

**A duplicate name stops** — within one file and across layers stacked by `import` alike. The message reads `Duplicate asset name: D1`, followed by the provenance (file and line) of the one already seen.

## An asset's name is the name of a type

The `name` in `asset W1 window … name:掃き出し窓` is **the name of a type of leaf**, not of an individual. So hanging the same asset twice on one wall does not collide.

```muro
koyu 1.0
unit mm
grid X 0 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
asset D1 door w:900 h:2100 name:片開き戸
space /L1/a room X1..X2 Y1..Y2 name:室
space /out name:外部 outside:1
boundary /L1/a /out t:150 edge:S
  door D1 at:0.25
  door D1 at:0.75
```

`check` comes back green. An opening's identity comes from a `name` unique inside its boundary, but **only a name written on the opening's own line counts as a claim** — the same value inherited from a referenced asset is not one. Write `name:D9` on both and it collides then, and only then.

```text
✖ Duplicate opening name within boundary /L1/a | /out: D9 — the name is what identifies it inside its container
```

## Keep them in their own file

The standard practice is to keep the asset set in its own layer and stack it with `import`.

```muro-part
import ./assets.muro
```

A layer is composed once, so a double `import` and a cycle are both idempotent.

## Neighbouring pages

- [door](door.md) / [window](window.md) — the side that references an asset
- [boundary](boundary.md) — the relation openings sit on
- [koyu check](../cli/check.md)
