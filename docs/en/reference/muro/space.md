---
title: space — spaces
mode: reference
---

# space — spaces

```muro-part
space /L5/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK floor:オーク
space /out/road-s exterior name:南側道路 road:12000
```

`space <path> <type> [regions...] [attributes...]` declares a space. **Space is the primary element** — a wall is not a possession of a space but a relation between two of them ([boundary](boundary.md)), and plans, areas and circulation are all derived from how spaces are laid out.

## Path — identity

The first positional is a path beginning with `/`, and that is the space's identity in the model.

```muro-part
space /L5/A/ldk ldk X1..X2 Y1..Y2
```

- **A path is also the hierarchy of aggregation.** Grouping by prefix is the job of a [zone](zone.md): the zone `/L5/A` has every space whose path begins `/L5/A/` beneath it.
- **If the first segment is a declared [level](level.md) name, the space belongs to that level.** `/L5/A/ldk` sits on L5. If it is not a level name (`/site/bldg`, say), the level is undetermined and must be stated with `level:`.
- A duplicate path is an error. Under composition, the provenance of both is shown.

```text
Duplicate space path: /L1/a (first seen in floors/L1.muro at line 12)
```

Paths change when things are renamed. To join against an external register across a rename, use `uid:`.

## Type — an open vocabulary

The second positional is the type, and it is **required**. Omit it and the first region is read as the type, which surfaces as a complaint about the region instead.

```text
✖ t1.muro:line 4: A region is given as two ranges, X?..X? and Y?..Y?
```

A line with neither a type nor a region (`space /L1/a` alone) is stopped more directly, by `space /L1/a requires a type (a word from the vocabulary)`.

The vocabulary of types is open: `room`, `ldk`, `厨房`, `tenant` are all fine. **Exactly two words are interpreted structurally.**

| Type | Interpretation |
|---|---|
| `exterior` | Outside. May have no region. Splits into several (`/out/road-s`) |
| `void` | A void through the floor. Not counted in floor area, not passable, and neither floor nor ceiling is generated |

Every other type is merely carried and is never the entrance to a verdict. Whether the daylight check applies is in particular not inferred from the type — `light` looks at the spaces that wrote `daylight:1`.

The two structural words are guarded against **misspelling**. A word one edit away from either is refused, because the moment `exteriorr` parses, that space stops being outside and the gross floor area silently doubles.

```text
✖ s2.muro:line 4: The type exteriorr looks like a misspelling of exterior (exterior is read structurally — if a different word was meant, spell it further away)
```

Words further away (`room`, `yard`, `ldk`) draw no comment.

## Regions — a union of rectangles

A region is **two tokens**, `X?..X? Y?..Y?`: one range on X and one on Y. A `+` written as its own token joins several rectangles into a union (an L shape, for instance).

```muro-part
space /L1/L ldk X1..X3 Y1..Y2 + X1..X2 Y2..Y3 name:L字
```

- A descending spelling (`X2..X1`) is another way of writing the same rectangle and is normalized to ascending order.
- A zero-width region is an error.
- **Rectangles overlapping within one space is [GEO01](../diagnostics/geo.md); spaces on the same level overlapping is [GEO02](../diagnostics/geo.md)**, both errors.
- The region may be omitted. `exterior` spaces, and spaces that exist only to be aggregated, are written without one. A space with no region cannot carry a [subdivision](area.md).

A space with a region needs a [level](level.md) and a ceiling height. Without either, not one solid can be produced, which is the error [SUF02](../diagnostics/suf.md) or [SUF01](../diagnostics/suf.md).

How grid references and offsets are spelled is in [positions and regions](positions.md).

## Writing by dimension — band members

To divide by dimension and order rather than position, use [band](band.md). A `space` line indented under a band carries `w:` in place of a region.

```muro-part
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

`w:` may not be written on an unindented `space`. That refusal is what stops a member whose indentation was lost from passing silently as "a space with no region".

```text
✖ b5.muro:line 4: w: may not be written on space (a space written by width sits indented under band)
```

## The indented subdivision — area

An `area` indented under a `space` is an uncounted subdivision of the room: a change of floor finish, say, that appears in no area total, no room count and no graph. See [area](area.md).

## Level spans

If the **first segment** of the path has the form `L3..L10`, the line expands over the declared levels in ascending z. This is how a typical floor is written once.

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:Bタイプ use:exclusive
```

Several paths on one line must name the same span. Indented `area` lines are attached to every expanded space.

## The attributes

The keys writable on a space are the ones listed here plus any namespaced key containing a dot (`acme.sensor:23`). **A key that is in neither category is the error [ATT03](../diagnostics/att.md)** — the point is to stop `heigh:2400` from being read past in silence while `check` stays green.

```text
✖ s1.muro:line 4: /L1/a carries heigh:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.heigh:2400)
```

They fall into three tiers. **Structure** is lifted into typed fields by the parser, **interpreted** is read for its value by core, and **carry** is never looked at and only transported. The tiers are set out in [the three tiers of attributes](attributes.md).

### Structure

| Key | Value | Meaning |
|---|---|---|
| `level:` | a declared level name | States the level. The default is the first path segment. Needed for a grouping that spans levels (a maisonette) and whenever the path does not start with a level name (`/site/bldg`). An undeclared level stops with `Undeclared level: level:L9` |
| `w:` | positive integer mm / `rest` | The dimension of a [band](band.md) member. Not writable on a `space` outside a band |

### Interpreted

| Key | Value | Meaning |
|---|---|---|
| `h:` | positive number, mm | Ceiling height. Defaults to the level's `h:`. Read by the height invariant and the section stack-up |
| `use:` | free word | The aggregation axis (`rentable`, `exclusive`, `common`, …). Inherited from a [zone](zone.md); a declaration on the space wins |
| `road:` | positive number, mm | The width of an `exterior` space — the mark of a road. `site` derives frontage from it |
| `daylight:` | `0` / `1` | Declares that the daylight check applies. Only a space with `1` gets `light`'s 1/7 test. Out of scope by default. Not inherited |
| `ceiling:` | `0` / `1` | `0` hangs no ceiling (an exposed soffit). One is hung by default |
| `uid:` | opaque token | Persistent identity across renames. Digits alone, or whitespace, is an error. Unique across the whole model, spanning space and zone |
| `name:` | free word | Display name, shown in drawings and listings. Without it, the last path segment is used |
| `stair:` `ramp:` `escalator:` | `N` / `E` / `S` / `W` | A vertical-circulation declaration. The key names the device, the value the direction of ascent |
| `lift:` | `1` | A lift declaration (it has no direction) |
| `form:` | `straight` / `return` | Whether the run turns back. Default `straight` |
| `turn:` | `R` / `L` | Which way it turns back. Default `R` |
| `entry:` | positive number, mm | The depth of the boarding floor. Default 1100 |
| `landing:` | positive number, mm | The depth of an intermediate landing. Derived by default (the remainder from the target going) |
| `riser:` | positive number, mm | The maximum riser. Default 180 |
| `tread:` | positive number, mm | The target going. Default 300 |
| `lane:` | positive number, mm | The width of one unit or lane. 1200 by default for an escalator |
| `slope:` | positive number | The denominator of the permitted ramp gradient (`slope:6` = up to 1/6). A limit for the check, not a gradient to build |

**Values are checked too.** A non-number is [ATT01](../diagnostics/att.md) and a word outside the ledger's set is [ATT02](../diagnostics/att.md) (`daylight` is guarded by [DAY01](../diagnostics/day.md), and `form` and the directions of ascent by the [RUN](../diagnostics/run.md) family). What you wrote and the tool failed to interpret does not fall silently back to the default.

```text
$ npx tsx src/cli.ts check s3.muro --json
  "code": "DAY01",
  "message": "daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes",
  "code": "ATT02",
  "message": "ceiling on /L1/a is one of 0 / 1: ceiling:2",
  "code": "ATT02",
  "message": "turn on /L1/a is one of R / L: turn:X",
```

### Carry

| Key | Meaning |
|---|---|
| `floor:` | Floor finish. An [area](area.md) may override it over an interval |
| `spec:` | The name of the thing. Carried, never interpreted |
| `<namespace>.<key>:` | Anyone may write a dotted key, and core gives its content no meaning at all (`acme.sensor:23`, `bems.temp:22.5`) |

### Keys a space may not carry

Three worth naming.

- `site:` and `area:` belong to a [zone](zone.md). On a space they are ATT03.
- `underground:` belongs to a [level](level.md). On a space it is ATT03.
- `type:` belongs to a [boundary](boundary.md). A space's type is the second positional, not an attribute.

## daylight — the scope is declared

```muro
koyu 1.0
grid X 0 4000
grid Y 0 5000
level L1 0 h:2400 slab:150
space /L1/living living X1..X2 Y1..Y2 daylight:1 name:居間
space /out exterior name:外部
boundary /L1/living /out edge:S t:120
  window w:2400 h:1800
```

```text
$ npx tsx src/cli.ts light d1.muro
✔ /L1/living	居間	window 4.32 m2 / floor 20.00 m2 = 1/4.6 (needs 1/7 ≈ 2.86 m2)
✔ Every room meets 1/7 — 1 room in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

A room without `daylight:` is outside the test. **The attribute names what the tool does, not a legal category** — what the 1/7 applies to is the author's call.

## ceiling — the ceiling is an approximation

The ceiling surface is derived as the room's outline at the height `h:` fixes.

**That outline does not necessarily match the real ceiling.** A coffered ceiling, a bulkhead under a beam, a ceiling running continuously across several rooms, a shadow gap in front of a curtain wall — all of these are outside this resolution. The derivation is an approximation at the resolution of scheme design, not a drawn ceiling.

Only the absence of a ceiling — an exposed soffit — can be declared.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2 ceiling:0
```

The surfaces this model generates are these; `/L1/b` has no ceiling.

```text
floor /L1/a -150 0
ceiling /L1/a 2370 2400
roof /L1/a 2400 2600
floor /L1/b -150 0
roof /L1/b 2400 2600
```

Voids, the outside, semi-outdoor spaces and vertical circulation never get a ceiling in the first place, so `ceiling:0` is unnecessary there.

## Vertical circulation

Stairs, ramps, escalators and lifts are declared with the key that names the device and the direction of ascent. **No riser count, going, landing or gradient is written** — they are derived from the region and the storey height.

```muro-part
space /B2..B1/ramp ramp X3..X5 Y1..Y2 name:車路 use:parking ramp:E form:return slope:6
space /B2..B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 use:common stair:N form:return
space /B2..B1/ev shaft X3+2600..X3+5200 Y2..Y2+5400 name:EV use:common lift:1
```

```text
$ npx tsx src/cli.ts runs examples/basement/main.muro
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B2/ramp
B2→B1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B2/st
```

One space carries one device (two is [RUN01](../diagnostics/run.md)), and its region must be a single rectangle. **Which storeys it connects belongs to the vertical [boundary](boundary.md), not to the space** — the device declaration is a rule for generating form, not a topology. The whole set of rules is in [vertical circulation](vertical-circulation.md).

## What a space produces

Writing a `space` produces things you did not write.

- **Area** — measured to wall centerlines; `void` and `exterior` are outside the gross floor area.
- **Boundaries** — spaces on the same level whose regions touch get a `wall` boundary derived for them unless one was declared.
- **Semi-outdoor** — a space touching an `exterior` across an `open` or `air:1` boundary is treated as semi-outdoor, and neither ceiling nor roof is laid over it.
- **Columns** — they stand at grid intersections that fall inside a space with floor.
- **Floors, ceilings, roofs** — generated from the level's `slab:` and `h:`.

```text
$ npx tsx src/cli.ts stats v1.muro
L1
  /L1/hall	ホール	hall	14.40 m2
  /L1/r	r	room	14.40 m2
  Subtotal 28.80 m2
L2
  /L2/void	吹抜け	void (not counted as floor area)
  /L2/r	r	room	14.40 m2
  Subtotal 14.40 m2
Total 43.20 m2 (indoor floor area)
  hall: 14.40 m2
  room: 28.80 m2
```

## To subdivide, make the parent a zone

Putting a `space` with a region beneath a `space` with a region makes their regions overlap, which is [GEO02](../diagnostics/geo.md).

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/A unit X1..X3 Y1..Y2
space /L1/A/ldk ldk X1..X2 Y1..Y2
```

```text
✖ z1.muro:line 4: Space regions overlap: /L1/A and /L1/A/ldk
```

To divide a dwelling into rooms, make the parent a [zone](zone.md). A zone has no geometry; it only groups by path prefix.
