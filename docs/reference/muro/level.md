---
title: level — levels
mode: reference
---

# level — levels

```muro-part
level L1 0 h:3600 slab:600
level L4..L10 11000 pitch:3000 h:2500 slab:450
level R 30200 slab:500
```

`level <name> <z> [h:] [slab:] [pitch:] [underground:]` gives a name to a floor height. **This is the only place in the notation where z is written**: a [space](space.md) has no height of its own and takes it from the level it belongs to.

## Positionals

| Position | Meaning |
|---|---|
| name | The level's name. Used as the first segment of a space path (`/L1/hall`) |
| z | The floor level in mm. May be negative |

The name is a free word, but **a range declaration is distinguished from a single one by its spelling** — a name containing `..` is read as a range.

z is a number in the same coordinate system as the [grid](grid.md), and where the origin sits is your choice. The order of levels is the order of their z, not of their names.

## Attributes

Four keys may be written on a level, and that list is closed.

| Key | Value | Meaning |
|---|---|---|
| `h:` | positive number, mm | The base ceiling height — the default for spaces on this storey |
| `slab:` | positive number, mm | Slab thickness. The floor slab is generated downward from this level's FL |
| `pitch:` | positive number, mm | The storey height of a range declaration. Only on a range |
| `underground:` | `0` / `1` | Declares that the level is below ground |

**A key outside the ledger is a syntax error rather than a diagnostic.** A level carries no attribute bag — all four keys are lifted into typed fields, and a leftover key has nowhere to live. Dropping it silently would let a storey spelled `undergound:1` become an above-ground storey without a word.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150 undergound:1
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ levelkey.muro:line 3: level carries undergound:, which is not in the ledger (level reads h / slab / pitch / underground)
```

On every other element an unknown key becomes the diagnostic [ATT03](../diagnostics/att.md); the level alone stops earlier, in the parse.

## h: — the base ceiling height

`h:` is the **default** ceiling height for spaces on this storey. A space's own `h:` wins over it.

With neither, the ceiling height cannot be determined, and there is no height to extrude a ceiling or a roof to. That is an error, not a warning.

```text
The ceiling height of /L2/a cannot be determined (neither the space's h: nor level L2's h: is there)
```

[SUF01](../diagnostics/suf.md) reports the spaces whose ceiling height is undetermined. Voids (`void`), the outside (`exterior`) and semi-outdoor spaces have no ceiling, so they are not subject to it.

## slab: — the slab thickness

`slab:` is the thickness of the floor slab, and **there is no operation that places a floor** — declaring the thickness is declaring the floor. The slab is generated from `z - slab` up to `z`.

Omit it and not one floor is generated on that storey. The form is still determined, so this is a warning.

```text
Level L2 has no slab:, so not one floor is generated on this storey
```

Nothing is said about a level carrying no space that could have a floor — there is no missing floor to report.

`slab:` eats into the headroom of the storey **below** it, as the floor of the storey above. The storey height is shared out between the lower storey's ceiling height and the upper storey's slab.

```text
$ npx tsx src/cli.ts levels lv.muro
R	z:15000	slab:500
L4	z:11200	h:2700	slab:400
  ↑ storey height 3800 = ceiling 2700 + slab 500 + 600 left over
L3	z:7800	h:2700	slab:400
  ↑ storey height 3400 = ceiling 2700 + slab 400 + 300 left over
L2	z:4400	h:2700	slab:400
  ↑ storey height 3400 = ceiling 2700 + slab 400 + 300 left over
L1	z:0	h:3600	slab:600
  ↑ storey height 4400 = ceiling 3600 + slab 400 + 400 left over
B1	z:-4200	h:3600	slab:600
  ↑ storey height 4200 = ceiling 3600 + slab 600
```

When the ceiling height plus the slab above exceeds the storey height, [HGT01](../diagnostics/hgt.md) is an error.

## Range declarations — level L4..L10

```muro-part
level L2..L4 4400 pitch:3400 h:2700 slab:400
```

A name of the form `<prefix><digits>..<prefix><digits>` expands into an arithmetic run of levels, at `z + pitch × k`.

| Rule | Error |
|---|---|
| The prefix is the same at both ends | `Cannot read the level range: L1..M3` |
| The numbers ascend | `Cannot read the level range: L3..L1` |
| `pitch:` is required | `A level range requires pitch: (the storey height in mm): L1..L3` |
| `pitch:` only on a range | `pitch is available only on a level range declaration (L?..L?)` |

`h:`, `slab:` and `underground:` are applied identically to every level in the expansion. Where the storey height changes, cut the range and write several lines.

## Duplicates and equal z

Declaring the same level name twice is an error.

```text
✖ lvdup.muro:line 4: Duplicate level: L1
```

Two differently-named levels at the same z are the error [LVL01](../diagnostics/lvl.md) — which one is above the other is undetermined, and the storey height between them is zero.

## underground: — being below ground is declared

```muro-part
level B1 -4200 h:3600 slab:600 underground:1
```

`underground:1` declares that the level is below ground; the value is `0` or `1`.

**It is never inferred from the sign of z.** Ground level is a fact about the site; a negative z is a fact about where the origin of the coordinate system was put. Put the origin on the second basement floor and the basements have positive z; put it on the pre-cut ground and above-ground storeys can be negative. Two different facts, written separately.

A wall against earth is carried by neither the boundary's type nor an attribute of it, but by the [boundary](boundary.md)'s `spec:` (`spec:RC土圧壁`). The topology of a boundary is the same above and below ground.

`underground` is emitted into the canonical JSON only when true.

```text
$ npx tsx src/cli.ts json lv.muro
  "levels": {
    "B1": {
      "z": -4200,
      "h": 3600,
      "slab": 600,
      "underground": 1
    },
    "L1": {
      "z": 0,
      "h": 3600,
      "slab": 600
    },
```

## A level with no spaces

A level that carries no space at all is a legitimate declaration. The roof is the usual case, and it acts as **the upper bound of the topmost storey's height check**.

```muro-bad
grid X 0 6000
grid Y 0 8000
level L1 0 h:3600 slab:600
level R 3800 slab:500
space /L1/hall hall X1..X2 Y1..Y2
```

```text
✖ roof.muro:line 5: /L1/hall collides into the floor above: ceiling height 3600 + R's slab 500 = 4100 > storey height 3800
```

Delete `level R` and the same file turns green — a ceiling height with nothing above it has nothing to be reconciled against. **Declaring the roof is putting the top storey's height into the arithmetic.**

## Declare it before you use it

A level has no effect on lines above it. The first segment of a space path is matched against the levels declared *so far*, so a `level` written further down arrives too late and the space is left with no level.

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/a room X1..X2 Y1..Y2
level L1 0 h:2400 slab:150
```

```text
$ npx tsx src/cli.ts check levellate.muro --json
[
 {
  "code": "SUF02",
  "severity": "error",
  "message": "/L1/a has a region, but its level cannot be determined (give it at the head of the path or with level:)",
```

The same holds for the `level:` attribute, a [column](column.md)'s level range, [stack](stack.md), and a level span in a path: only a declared level can be named. An undeclared one stops with `Undeclared level: level:L9`.

## Order is z order

Everything about above and below is decided by z, and the spelling of the name plays no part. A level span in a path, `/B1..M2/a`, expands over **the declared levels between the two z values, in ascending z** — prefixes need not agree.

```muro
grid X 0 3600
grid Y 0 4000
level B1 -3000 h:2400 slab:150
level L1 0 h:2400 slab:150
level M2 3000 h:2400 slab:150
space /B1..M2/a room X1..X2 Y1..Y2
```

```text
$ npx tsx src/cli.ts stats sp2.muro
B1
  /B1/a	a	room	14.40 m2
  Subtotal 14.40 m2
L1
  /L1/a	a	room	14.40 m2
  Subtotal 14.40 m2
M2
  /M2/a	a	room	14.40 m2
  Subtotal 14.40 m2
Total 43.20 m2 (indoor floor area)
  room: 43.20 m2
```

## Overriding under composition

A level is defined once across all layers. Changing a declared level's values from another layer is `over level`, and only `h` / `slab` / `underground` can be rewritten (`pitch` is an input to the expansion, so after expansion there is nothing to point at). The strength rules are in [over / drop](over-drop.md).

## Surfaces come from the level

Floors, ceilings and roofs have no vocabulary of their own, because `slab:` **already declares** the floor and `h:` already declares the ceiling.

- **Floor** — generated under every space on a storey that carries `slab:`, except voids and the outside.
- **Ceiling** — hung at the height that `h:` fixes. Not in voids, the outside, semi-outdoor spaces, or vertical circulation.
- **Roof** — laid over whatever is not covered by a space on any level above. Put a penthouse on a podium and the podium roof appears without being written.

A room with no ceiling — an exposed soffit — is declared space-side with `ceiling:0`. See [space](space.md).
