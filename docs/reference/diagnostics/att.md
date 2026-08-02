---
title: ATT — attributes
mode: reference
---

# ATT — attributes

There are three ATT codes. All are errors.

| Code | Severity | What it says |
|---|---|---|
| ATT01 | error | An interpreted attribute's value is not a positive number |
| ATT02 | error | An interpreted attribute's value is outside its fixed set |
| ATT03 | error | A key not in the ledger was written without a namespace |

**What you wrote but koyu could not interpret is never dropped in silence.** That is the one claim behind all three.

The silence costs most when the attribute is **the entrance to another check**. Write `site:yes` and every judgement about the site stops running; write `h:35OO` and the height invariant ([HGT01](./hgt.md)) disappears; write `heigh:2400` and one wrong letter does the same. In each case only the answer goes missing.

## The three tiers

Attributes come in three tiers. **Which tier a key belongs to is decided by the ledger for that element** — the same spelling in a different place can be a different tier.

| Tier | koyu | Examples |
|---|---|---|
| **Structure** | always reads it; `parse` lifts it into a typed field | `space`'s `level:` `w:`; `boundary`'s `type:` `t:` `air:` `edge:`; an opening's `w:` `h:` `at:` `edge:` `hinge:` `swing:`; `column`'s `d:` `x:` `y:` |
| **Interpreted** | reads it, and the value domain is fixed | `space`'s `h:` `use:` `road:` `daylight:` `ceiling:` `uid:` `name:` and the vertical-circulation set; `zone`'s `name:` `use:` `site:` `area:` `uid:`; `boundary`'s `h:` `name:`; an opening's `style:` `name:` |
| **Carry** | **never reads it.** It is only transported | `space`'s `floor:` `spec:`; `boundary`'s `spec:` `fire:` `sound:`; an opening's `sill:` `spec:` `fire:`; `area`'s `floor:` `spec:`; `seg`'s `spec:` `fire:` `sound:`; `column`'s `spec:` |

The structure and interpreted tiers are read by koyu, so the ledger is the contract. The carry tier is only transported, so anyone may write anything.

**Then which tier is an unknown key?** Without an answer visible on the page, "not looked at" and "looked at and fine" cannot be told apart. So the carry tier is required to carry a **namespace**.

```text
spec:RC              a key in the ledger. No namespace needed. koyu only carries it
acme.sensor:23       namespaced. Anyone may write it. koyu never looks inside
heigh:2400           not in the ledger and not namespaced → ATT03
```

A namespace is **dot-separated**, matching `^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$`: it starts lowercase and contains at least one dot. `acme.sensor`, `bems.temp`, `survey.measured` and `acme.sub.key` all pass; `Acme.sensor`, `acme.Sensor` and `acme_x` do not. koyu gives the contents no meaning at all — it does not even have a rule for splitting them.

## ATT01 — the attribute takes a positive number {#att01}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2 h:35OO
space /L2/a room X1..X2 Y1..Y2
```

```text
h on /L1/a is written as a positive number: h:35OO
```

**Cause** — a value meant as a number does not read as one. `35OO` (letter O instead of digit 0), `3500mm` (with a unit) and `1/12` (a fraction) are all carried as strings, and the reader treats them as unwritten. Zero and negatives are refused as well.

The keys that require a positive number are these.

| Element | Keys |
|---|---|
| `space` | `h` (ceiling height, mm), `road` (carriageway width, mm), `entry`, `landing`, `riser`, `tread`, `lane`, `slope` |
| `zone` | `area` (the site's declared area, m²) |
| `boundary` | `h` (top height of an `air:1` boundary, mm) |

**Fix** — write a positive number with no unit. Every length is in mm, so units are never written. A ramp's `slope:` takes **the denominator only** — `slope:12` means 1/12.

## ATT02 — the value is not in the vocabulary {#att02}

`error`

```muro-bad
grid X 0 5000
grid Y 0 5000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:yes
polygon /site 0,0 5000,0 5000,5000 0,5000
space /site/a room X1..X2 Y1..Y2 level:L1
```

```text
site on zone /site is one of 0 / 1: site:yes
```

**Cause** — an attribute whose value set is fixed was given a spelling outside that set. Only four keys are like this.

| Element | Key | Values |
|---|---|---|
| `zone` | `site` | `0` / `1` |
| `space` | `ceiling` | `0` / `1` (0 = no ceiling is built) |
| `space` | `turn` | `R` / `L` |
| Opening, `asset` | `style` | `hinged` / `sliding` / `auto` |

**Case matters.** `turn:l` is not `turn:L`.

**Fix** — use the ledger's spelling. `site:1` declares that this zone is the site, and it is the entrance to the site's area, frontage and containment judgements as well as to `koyu site`. Write `site:yes` and that entrance stays shut while `check` goes green.

`daylight` is not in this table; its value domain is guarded separately by [DAY01](./day.md).

## ATT03 — the attribute is not in the ledger {#att03}

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 heigh:2200
```

```text
/L1/a carries heigh:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.heigh:2200)
```

**Cause** — a key not in that element's ledger was written without a namespace. **A single wrong letter silently does nothing**: `heigh:2200` is not a ceiling height and it silences the height invariant entirely, `sit:1` erases the site judgements, `stiar:N` erases the vertical circulation.

**Misspelled keys are detected.** `nmae:居室A` and `flooring:tile` are both ATT03. It is not true that an uninterpreted attribute may be written freely and carried through — if you want to write freely, add a namespace.

**Fix** — check the spelling first. If the value really is free (sensor readings, survey data, a third party's ledger), give it a dot-separated namespace.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 h:2200 acme.sensor:23 bems.temp:22.5
```

koyu gives a namespaced attribute no meaning at all: it checks no value domain and uses it in neither derivation nor validation. **It can be carried but is not judged**, said plainly on the page — which is the whole point of the tier.

## The population and the order

What is checked is **the declarations that were written**. The scan follows declaration order, one pass in this sequence.

1. Spaces — the space itself, then its `area`s
2. Zones
3. Boundaries — the boundary itself, then its openings, then its `seg`s
4. `asset`s
5. `column`s

The message names the declaration in a different way for each.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2 ceiling:none
  area X1..X1+1000 Y1..Y1+1000 flooring:tile
zone /L1 name:一階 areaa:100
space /out outside:1
boundary /L1/a /out t:150 h:tall
  window w:1200 h:1100 edge:S at:0.5 styl:sliding
  seg w:900 edge:N at:0.5 sond:D45
column 600 L1 spek:RC
```

```text
ceiling on /L1/a is one of 0 / 1: ceiling:none
area (/L1/a) carries flooring:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.flooring:tile)
zone /L1 carries areaa:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.areaa:100)
h on boundary /L1/a | /out is written as a positive number: h:tall
window (/L1/a | /out) carries styl:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.styl:sliding)
seg (/L1/a | /out) carries sond:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.sond:D45)
column 600mm carries spek:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.spek:RC)
```

An `asset` is read against the opening's ledger. The two are identified deliberately, so that no attribute can be writable on an asset but not on an opening.

## `level` is handled differently

`level` carries no attribute bag. `h:`, `slab:`, `pitch:` and `underground:` are all typed fields, and any other key **is refused by the parser on the spot**. So ATT03 never fires for a `level`.

```text
level carries spec:, which is not in the ledger (level reads h / slab / pitch / underground)
```

Under `check --json` this appears as [SYN01](./syn.md).

## Related

- [DAY — the daylight scope](./day.md) — where `daylight`'s value domain is guarded
- [HGT — the height invariant](./hgt.md) — the check a misspelled `h:` erases
- [SIT — the site shape](./sit.md) — the judgements a misspelled `site:` erases
- [SYN — syntax and composition](./syn.md) — unknown keys on `level`, duplicate keys, quoting
- [koyu check](../cli/check.md)
