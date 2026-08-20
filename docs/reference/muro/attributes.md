---
title: The three tiers of attribute
mode: reference
---

# The three tiers of attribute

**Attributes are written `key:value`. But the key is not free.**

Which keys may be written is set by a ledger. A key that is not in the ledger and carries no namespace is the error `ATT03`.

```text
/L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if
the value is only carried — e.g. acme.nmae:居室)
```

**That line exists to keep "not looked at" distinguishable from "looked at and fine".** With keys unguarded, `heigh:2400` silences the height invariant, `sit:1` silences the site check and `stiar:N` silences the vertical circulation — each of them while `check` stays green. koyu does not keep a state in which what you wrote does not take effect and the file is green.

How a line is spelled (where the `:` falls, how values are typed, what a repeat does) is in [how a line is read](lines.md). This page is about which keys go where, and what happens to the values.

## The three tiers

| Tier | Examples | How core treats it |
|---|---|---|
| **Structure** | the path, the region, the level, the other end of a relation, `type` `t` `air` `edge` `w` `at` `hinge` `swing` `d` `x` `y` | **Always read.** If it is broken the file is not read at all — it stops on the spot |
| **Interpreted** | `outside` `void` `h` `road` `daylight` `site` `area` `style` `ceiling` `uid` `name` `stair` `riser` … | **Read.** The ledger defines the range of values, and a value outside it produces a diagnostic |
| — | the **type** of a space (the second positional) | **Not read.** The room's purpose, written as a free word, appearing only in aggregation and in lettering |
| **Carried** | `spec` `fire` `sound` `floor` `sill`, and any namespaced key | **Not read.** Carried, nothing more |

**Structure keys do not survive as attributes.** `type:`, `t:`, `air:`, `edge:`, `w:`, `at:`, `hinge:`, `swing:`, `d:`, `x:` and `y:` are lifted into fields of the element as the file is read, and their values are checked right there. So they never appear as `ATT01` or `ATT02` — a non-numeric `t:` stops earlier, with `The attribute t is written as a number`.

**Carried values cannot be looked at.** `spec:RC`, `fire:60` and `sill:800` are carried and given no meaning. What a wall is made of is a value of the thing-name key (`spec`); it is not a reason to add a boundary type.

## The ledger lists what may be written, not what core reads

**Being in the ledger does not mean core reads the key.** `spec`, `fire`, `sound`, `floor` and `sill` are carried-tier words that are in the ledger — they are listed so that a settled meaning does not get two spellings, and their values are not interpreted.

Conversely, a key that is not in the ledger **may still be written if it carries a namespace.**

```muro-part
space /L1/a room X1..X2 Y1..Y2 acme.sensor:23 bems.temp:22.5 survey.measured:2026-03-11
```

A namespace is spelled **starting with a lowercase letter and containing at least one dot-separated segment** (`[a-z][a-z0-9_-]*` followed by one or more `.[a-z0-9_-]+`).

| Written | Result |
|---|---|
| `acme.sensor:23` | carried. core gives the content no meaning whatever |
| `bems.temp:22.5` | the same |
| `Acme.sensor:23` | `ATT03` — a key starting with a capital is not read as a namespace |
| `acme.Sensor:23` | `ATT03` — segments take no capitals |
| `sensor:23` | `ATT03` — no dot |
| `nmae:居室` | `ATT03` — a misspelling of `name`. **This is the case the rule exists for** |

core holds no rule about the inside of a namespace, not even how to split it. **One dot anywhere makes it carried** — that is the whole rule.

**Being able to write anything with a namespace is not the same as it meaning something.** `acme.uid:` can be written, but it is carried, and it does not give the space an identity.

## The three shapes a value check takes

Interpreted values that do not match the type the ledger sets become diagnostics. **A value that was written and not interpreted is never quietly dropped to a default.**

| Code | What it says | Example |
|---|---|---|
| `ATT01` | a key requiring a positive number got a non-number, zero, or a negative | `h on /L1/a is written as a positive number: h:0` |
| `ATT02` | a value outside a fixed vocabulary | `ceiling on /L1/a is one of 0 / 1: ceiling:2` |
| `ATT03` | a key not in the ledger and not namespaced | see above |

A few keys are guarded by their own diagnostics — `daylight` by `DAY01`, the direction of a vertical circulation by `RUN02`, `form` by `RUN05`.

```text
daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/b carries daylight:yes
site on zone /L1 is one of 0 / 1: site:yes
style on door (/L1/a | /L1/b) is one of hinged / sliding / auto: style:swing
turn on /L1/b is one of R / L: turn:X
```

## The ledger, element by element

**The ledger is closed per element.** `uid` may be written on `space` and `zone` and nowhere else — on a `boundary` it is `ATT03`.

### space

| Key | Tier | Value | Meaning |
|---|---|---|---|
| `level` | structure | a level name | states the level explicitly. Defaults to the first path segment |
| `w` | structure | a positive integer in mm, or `rest` | the dimension of a band member. **Cannot be written on a `space` outside a band** |
| `outside` | interpreted | `0` / `1` | outside the building. **May have no region.** Not counted in floor area |
| `void` | interpreted | `0` / `1` | a void. Having no floor it is not counted in floor area, and is not passable |
| `h` | interpreted | positive number, mm | ceiling height. Defaults to the level's `h` |
| `use` | interpreted | free | **Retired after muro 1.2.** A file declaring 1.3 or later that writes it is [VER07](../diagnostics/ver.md#ver07); write a namespaced key of your own instead |
| `road` | interpreted | positive number, mm | the width of an `outside:1` — the mark of a road. Read when frontage is derived |
| `daylight` | interpreted | `0` / `1` | declares whether the daylight question applies |
| `ceiling` | interpreted | `0` / `1` | `0` means no ceiling is built |
| `uid` | interpreted | an opaque token | persistent identity across renames. Not digits alone, no whitespace |
| `name` | interpreted | free | display name |
| `stair` `ramp` `escalator` | interpreted | `N` / `E` / `S` / `W` | a vertical circulation. The value is the direction of travel going up |
| `lift` | interpreted | `1` | a lift. It has no direction |
| `form` | interpreted | `straight` / `return` | whether the run turns back |
| `turn` | interpreted | `R` / `L` | which way it turns |
| `entry` | interpreted | positive number, mm | depth of the boarding floor |
| `landing` | interpreted | positive number, mm | depth of the intermediate landing |
| `riser` | interpreted | positive number, mm | the maximum riser |
| `tread` | interpreted | positive number, mm | the target tread |
| `lane` | interpreted | positive number, mm | the width of one unit or lane |
| `slope` | interpreted | positive number | the denominator of the permitted slope (`slope:6` = up to 1/6) |
| `floor` | carried | free | floor finish |
| `spec` | carried | free | the name of the thing |

### zone

| Key | Tier | Value | Meaning |
|---|---|---|---|
| `name` | interpreted | free | display name |
| `use` | interpreted | free | **Retired after muro 1.2**, as on `space` |
| `site` | interpreted | `0` / `1` | marks the site aggregation |
| `area` | interpreted | positive number, m² | the declared (surveyed) site area, reconciled against the derived one |
| `uid` | interpreted | an opaque token | same rule as space |

### boundary

| Key | Tier | Value | Meaning |
|---|---|---|---|
| `type` | structure | `wall` / `open` / `stair` / `shaft` / `void` | the topology of the relation |
| `t` | structure | positive number, mm | wall thickness, split about the centreline |
| `air` | structure | `0` / `1` | `1` = there is a thing, but it blocks neither air nor light (a railing, a fence) |
| `edge` | structure | `N` / `E` / `S` / `W` | narrows the segments to one face seen from the a side |
| `h` | interpreted | positive number, mm | top height of an `air:1` boundary |
| `name` | interpreted | free | display name |
| `spec` | carried | free | the name of the thing (RC, LGS, curtain wall, railing…) |
| `fire` | carried | free | fire rating |
| `sound` | carried | free | acoustic rating |

### door / window / asset

**A door asset is read against the opening ledger.** That is deliberate: there must be no attribute that an asset can carry and an opening cannot.

| Key | Tier | Value | Meaning |
|---|---|---|---|
| `w` | structure | positive number, mm | width. **Required** (the asset may supply it) |
| `h` | structure | positive number, mm | height |
| `at` | structure | a `0..1` ratio, or a grid reference | position |
| `edge` | structure | `N` / `E` / `S` / `W` | picks a face when there are several segments |
| `hinge` | structure | `N` / `E` / `S` / `W` | the jamb the hinge sits on |
| `swing` | structure | `a` / `b` | which side it opens toward |
| `style` | interpreted | `hinged` / `sliding` / `auto` | the kind of leaf |
| `name` | interpreted | free | **unique within the boundary** — the key to an opening's identity |
| `sill` | carried | free | sill height |
| `spec` `fire` | carried | free | |

### area / seg / column

| Element | Structure | Interpreted | Carried |
|---|---|---|---|
| `area` | (the region is positional) | `name` | `floor` `spec` |
| `seg` | `w` `at` `edge` | `name` | `spec` `fire` `sound` |
| `column` | `d` `x` `y` | `name` | `spec` |

### level holds no attribute dictionary

**`level` takes exactly `h`, `slab`, `pitch` and `underground`; nothing else, not even with a namespace.**

```text
level carries undergound:, which is not in the ledger (level reads h / slab / pitch / underground)
level carries acme.x:, which is not in the ledger (level reads h / slab / pitch / underground)
```

Everything a level holds is a typed field, so there is no attribute dictionary to put a leftover key in. A leftover would vanish without a trace in the machine format — so unless it is refused here, `undergound:1` quietly becomes an above-ground storey.

### origin holds no attribute dictionary either

**[`origin`](origin.md) takes exactly `epsg`, `easting`, `northing`, `elevation` and `vertical`**, for the same reason and with the same consequence.

```text
origin carries eastign:, which is not in the ledger (origin reads epsg / easting / northing / elevation / vertical)
```

| Key | Tier | What it holds |
|---|---|---|
| `epsg` | structure | The EPSG code of a projected coordinate reference system. **Not resolved** — koyu checks only that it is a whole positive number |
| `easting` | structure | The easting of `x = 0`, **in metres**. Written with `northing` |
| `northing` | structure | The northing of `y = 0`, **in metres**. Written with `easting` |
| `elevation` | structure | The height of `z = 0`, **in metres**. Written with `vertical` |
| `vertical` | structure | The EPSG code of the vertical CRS `elevation` is measured in |

Metres are the one exception to millimetres in the whole notation, because these are not lengths inside the model — they are a point in a foreign frame. [`azimuth`](azimuth.md) takes no `key:value` at all, so it has no ledger entry.

## Inheritance and override

**There are exactly three paths along which an attribute travels between elements.**

### A zone hands a key down to the spaces beneath it

The value comes from the **deepest zone** whose path is a prefix of the space's path, and **a declaration on the space wins.**

**Which key travels is chosen by whatever asks for it.** Core hands nothing down of its own accord; the resolution runs when something names a key — [`koyu stats --by`](../cli/stats.md), the MCP `model_summary`, a validation rule reading the key it cares about. A space is therefore grouped along as many divisions at once as it carries.

```muro
muro 1.4
name 継承の例
grid X 0 4000 8000
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ lease.category:exclusive fire.compartment:c3
space /L1/A/ldk  ldk  X1..X2 Y1..Y2 name:LDK
space /L1/A/hall hall X2..X3 Y1..Y2 name:玄関 lease.category:common
space /out outside:1
boundary /L1/A/ldk /out
boundary /L1/A/hall /out
```

Ask for both groupings — `koyu stats --by lease.category --by fire.compartment` — and the last two lines of the totals are these.

```text
By lease.category: exclusive 16.00 m2 (50.0%) / common 16.00 m2 (50.0%)
By fire.compartment: c3 32.00 m2 (100.0%)
```

`/L1/A/ldk` received `exclusive` from the zone without writing it; `/L1/A/hall` overrode it with its own `common`. Neither wrote `fire.compartment`, so both fall in the compartment the zone names.

### `floor` overrides space → area, and `spec` overrides boundary → seg, over an interval

`area` and `seg` are **segmentations that are not counted.** They carry a region or an interval, and the attributes that differ only there.

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 floor:オーク
  area X1..X1+1800 Y1..Y1+1800 name:土間 floor:タイル

boundary /L1/ldk /L1/corridor spec:LGS
  seg w:1800 at:0.5 spec:受付ガラス
```

**This is an override over an interval — not composition, not inheritance.** The value of the segmentation is read for its region or its interval, and the parent's value is read outside it. Segmentations affect neither area nor room count nor the graph; only spaces and boundaries are counted.

### Nothing else travels

The flow from an asset to an opening looks like an exception. **An asset's attributes become the opening's defaults, and attributes written on the opening line override them.** That is not inheritance but a reference — a way to keep a bundle of default values in one place. A `name` inherited from an asset is the name of a type, not a claim about that opening's identity: hanging the same product twice on one wall is ordinary design.

Nor is it inheritance when `h` falls back from a space to its level. That is a rule of derivation: read the space's `h`, and failing that the level's. With neither, no shape can be made, and it is `SUF01` — see [what happens when you write nothing](defaults.md).
