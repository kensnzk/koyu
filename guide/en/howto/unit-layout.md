**English** · [日本語](../../howto/unit-layout.md)

# Subdivide a dwelling into rooms

Take a dwelling written as a single room and split it into an LDK, bedrooms, a wet area, and so on — without breaking the area figure for the dwelling as a whole.

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- The dwelling is written as one `space` and `check` passes with zero errors.
- You know that dwelling's region (the union of `X?..X? Y?..Y?`).

## A parent with a region cannot hold children with regions

This is the first trap. Leave the dwelling's `space` in place and add child `space` lines, and the parent's region overlaps the children's.

```muro-bad
koyu 0.3
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450

space /L3/A unit X1..X2 Y1..Y2 + X2..X3 Y1..Y1+2400 name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
```

```text
✖ 空間の領域が重なっています: /L3/A と /L3/A/ldk
✖ 空間の領域が重なっています: /L3/A と /L3/A/bed1
```

("The regions of these spaces overlap.")

A parent–child relation in the path does not exempt anything from being counted twice. `/L3/A` and `/L3/A/ldk` are, whatever their relation in the path, two overlapping spaces in plan.

## Steps

### 1. Replace the parent with a `zone`

Change the dwelling's line from `space` to `zone`. A `zone` has no geometry; it is an aggregation that bundles the spaces beneath it by path prefix. Write neither region nor type.

```muro-part
zone /L3/A name:Aタイプ use:exclusive
```

Forget to remove the `space` line and a space sharing the zone's path remains, which is a warning.

```text
⚠ unit.muro:9行目: ゾーンと同じパスの空間があります (どちらかに寄せます): /L3/A
```

("There is a space with the same path as a zone — settle on one of them.")

### 2. Tile the dwelling's region with the child spaces

Write them so that the union of the children's regions matches the original dwelling's region. Tile to wall centerlines and the zone's derived area matches the original dwelling's area.

```muro-part
space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
```

An L-shaped room is written as a union of rectangles with `+` ([ADR-0005](../../../docs/decisions/0005-zones-and-unions.md)).

### 3. Write doors between the rooms

The default between touching spaces is a wall. The partition itself need not be written, but a door will not exist unless you write it.

```muro-part
boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
```

When the same two rooms touch on two sides in an L, select the side with `edge:`.

### 4. Connect outward at the entrance

Once a dwelling is subdivided, what touches the outside (an interior corridor, the exterior) is no longer the dwelling but each individual room. Move the entrance door onto the boundary between the entrance hall and the corridor.

```muro-part
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

## Confirming it

```muro
koyu 0.3
name 住戸を割る
unit mm

grid X 0 9600 12800
grid Y 0 5600 7600
level L3 8000 h:2500 slab:450

zone /L3/A name:Aタイプ use:exclusive

space /L3/A/ldk  ldk     X1+3200..X2 Y1..Y1+4000 + X2..X3 Y1..Y1+2400 name:LDK
space /L3/A/bed1 bedroom X1..X1+3200 Y1+2400..Y2 name:洋室1
space /L3/A/bed2 bedroom X1..X1+3200 Y1..Y1+2400 name:洋室2
space /L3/A/wet  wet     X1+3200..X1+8000 Y1+4000..Y2 name:水回り
space /L3/A/hall hall    X1+8000..X2 Y1+4000..Y2 name:玄関
space /L3/corridor corridor X1..X3 Y2..Y3 name:内廊下 use:common

boundary /L3/A/ldk /L3/A/bed1 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/bed2 t:120 spec:LGS
  door w:800
boundary /L3/A/ldk /L3/A/hall t:120 spec:LGS
  door w:800
boundary /L3/A/hall /L3/A/wet t:120 spec:LGS
  door w:700
boundary /L3/A/hall /L3/corridor t:180 spec:RC
  door w:900 name:A玄関
```

```text
$ npx tsx src/cli.ts check unit.muro
✔ 整合 — 空間 6 / 境界 10
```

Five boundaries were declared, yet it says `境界 10` ("10 boundaries"). Default walls have been derived for the pairs that touch without a declaration (bedroom 1 and bedroom 2, the wet area and the corridor, and so on) ([ADR-0014](../../../docs/decisions/0014-default-boundaries.md)).

Confirm that `stats` still returns area in the language of the dwelling after subdividing.

```text
$ npx tsx src/cli.ts stats unit.muro
L3
  /L3/A/ldk	LDK	ldk	33.28㎡
  /L3/A/bed1	洋室1	bedroom	10.24㎡
  /L3/A/bed2	洋室2	bedroom	7.68㎡
  /L3/A/wet	水回り	wet	7.68㎡
  /L3/A/hall	玄関	hall	2.56㎡
  /L3/corridor	内廊下	corridor	25.60㎡
  小計 87.04㎡
合計 87.04㎡ (屋内床面積)
ゾーン別 (数える集約):
  /L3/A	Aタイプ	61.44㎡
  ldk: 33.28㎡
  bedroom: 17.92㎡
  wet: 7.68㎡
  hall: 2.56㎡
  corridor: 25.60㎡
use別: exclusive 61.44㎡ (70.6%) / common 25.60㎡ (29.4%)
```

(`ゾーン別 (数える集約)` is "by zone (counted aggregation)"; `use別` is "by use", here exclusive versus common.)

The `ゾーン別` line is the dwelling's area, and the exclusive-to-common ratio comes out without a single extra line written. `use:exclusive` is inherited from the zone by the rooms beneath it.

Whether each room can be reached from the entrance is answered by `doors`.

```text
$ npx tsx src/cli.ts doors unit.muro /L3/A/bed1 /L3/corridor
3枚 — /L3/A/bed1 → /L3/A/ldk → /L3/A/hall → /L3/corridor
```

## What changes when you subdivide

- **The subjects of `light` become the rooms.** Before subdividing, the dwelling itself (type `unit`) was the subject. After, `ldk` and `bedroom` are, while `wet` and `hall` fall out of scope. Run `light` on the example above and three rooms are listed.
- **The by-type breakdown in `stats` becomes finer.** Where one dwelling was counted as `unit`, it now splits into `ldk`, `bedroom`, `wet`, and `hall`. Only the by-zone line absorbs the change of granularity.
- **Granularity may be mixed.** You can subdivide only some dwellings and leave the rest as one room each. `examples/tower/typical.muro` subdivides only type A down to its rooms, leaving B through F as a single `unit` each.

## Subdividing a typical floor all at once

When the same layout sits on several storeys, write the first path segment as a span. It expands across the declared levels in z order. A zone takes the same form.

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
space /L3..L10/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK
```

A worked example is in `examples/tower/typical.muro` — the dwellings and their layouts across eight storeys, L3 through L10, written once.

## Subdividing by dimension and order

When what is settled is not the position of the rooms but their **dimension and order**, you can write a `band` instead of regions. A band is expanded into ordinary spaces at parse time, so nothing about the following steps (the `zone` parent, the boundaries, the openings, how you confirm it) changes.

```muro-part
band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

The wet area and entrance in `examples/tower/typical.muro` are written this way. Write a dimension on every member and the parser reconciles their sum against the width of the band. The grammar is in [the cheat sheet, band](../cheatsheet.md); the norm is [spec/language.md §3, band](../../../spec/en/language.md).

## Related

- [The how-to index](README.md)
- [Cut windows and pass the daylight test](daylight.md) — cutting windows into the rooms you split out
- [Doors and egress](doors-and-escape.md) — counting whether each room can be reached from the entrance
- [Six ideas](../concepts.md) — that a path is identity, and that the default is a wall
- [The diagnostic index](../diagnostics.md) — causes and fixes for GEO01 / GEO02 / ZON01 / ZON02
- [spec/language.md](../../../spec/en/language.md) §3 space, §5 zone — the grammar of region unions and zones
- [spec/semantics.md](../../../spec/en/semantics.md) §6 stats — the definitions of the aggregation axes
- [ADR-0005](../../../docs/decisions/0005-zones-and-unions.md) — why mixed granularity was allowed
