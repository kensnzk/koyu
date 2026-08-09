---
title: Describe a site and get coverage and plot ratio
mode: howto
---

# Describe a site and get coverage and plot ratio

Add the site to the description and let [`koyu site`](../reference/cli/site.md) report site area, road frontage, footprint, building coverage and floor area ratio.

**koyu does not hold the site as declared numbers.** Coverage and plot ratio are derived from the site you wrote and the building you wrote. Only two things may be declared, both of them survey facts — site area (`area:`) and site outline (`polygon`) — and both are reconciled against the derived value.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- The building passes [`koyu check`](../reference/cli/check.md) with zero errors.
- You can read the site area (m²) and the outline's vertex coordinates (mm) off the survey.
- You know the width of the road (mm).

## 1. Split the outside by direction and character

Do not make `/out` one space. Split it into an `exterior` per road and per neighbour. **Give roads their width with `road:` (mm)** — that is the mark `site` looks for when it hunts for frontage.

```muro-part
space /out/road name:South-road road:6000 outside:1
space /out/n name:North-neighbour outside:1
space /out/e name:East-neighbour outside:1
space /out/w name:West-neighbour outside:1
```

## 2. Declare the site zone

A site is a `zone` carrying `site:1`. The surveyed area goes in `area:` (m²).

```muro-part
zone /site name:Site site:1 area:154.00
```

## 3. Tile the ground around the building with outdoor spaces

Under the site zone, put the garden, the paths and the parking down as **real spaces**. Say which level they sit on (`level:L1`). Cover the site without gaps, together with the building, and the derived area comes out right even without a `polygon`.

```muro-part
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:South-garden
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:West-path
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:East-path
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:North-path
```

## 4. Write boundaries from those spaces out to the roads and neighbours

**Skip this step and the garden counts as building footprint.** Gardens and paths are spaces with regions whose type is not `exterior`. A space is judged outdoor **only when it has an `open` or `air:1` boundary to the exterior**, and that is derived, not declared. Walls and fences are written with `air:1`.

```muro-part
boundary /site/garden /out/road edge:S t:120 spec:Block-wall air:1 h:1200
  door w:900 name:Gate
boundary /site/garden /out/w edge:W t:120 spec:Block-wall air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:Block-wall air:1 h:1200
```

No default boundary is derived against a space that has no region, which is what the `exterior` spaces under `/out` usually are. **Which piece of outside you face is information, and information is named**, so write one line per perimeter space. Where the perimeter breaks into several sides, pick one with `edge:` — `N`=+Y, `S`=−Y, `E`=+X, `W`=−X.

Outdoor spaces inside the site are continuous with one another, so join them with `type:open`.

```muro-part
boundary /site/garden /site/west type:open
boundary /site/west /site/north type:open
```

## 5. Write the outline as a polygon

When the surveyed shape matters, write a `polygon`. **It is the one line in the notation where a shape is written with free vertices off the grid** — the shape of a site is a survey fact, not a product of the design. Give three or more `x,y` millimetre coordinates in the same coordinate system as the grid, against the path of the `site:1` zone.

```muro-part
polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

Keep the polygon in a layer of its own. That keeps given geometry from mixing with designed description; the bundled tower does exactly this — `examples/tower/site-geometry.muro` is a layer whose only declaration is one `polygon` line. The grammar is in [polygon](../reference/muro/polygon.md).

## Check it

```muro
muro 1.2
name A house with its site
unit mm

grid X 0 7000
grid Y 0 8000
level L1 0 h:2400 slab:150
level R 2700 slab:150

# Outside the site — split by direction and character. Roads carry road:width (mm)
space /out/road name:South-road road:6000 outside:1
space /out/n name:North-neighbour outside:1
space /out/e name:East-neighbour outside:1
space /out/w name:West-neighbour outside:1

# The site — a zone with site:1, and the ground-level outdoor spaces under it
zone /site name:Site site:1 area:154.00
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:South-garden
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:West-path
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:East-path
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:North-path

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK

boundary /L1/ldk /site/garden t:150 spec:EW
  door w:900 name:Garden-door

# Outdoor spaces inside the site are continuous with one another
boundary /site/garden /site/west type:open
boundary /site/garden /site/east type:open
boundary /site/west /site/north type:open
boundary /site/east /site/north type:open

# The site boundary — a wall that is solid but does not enclose air is air:1
boundary /site/garden /out/road edge:S t:120 spec:Block-wall air:1 h:1200
  door w:900 name:Gate
boundary /site/garden /out/w edge:W t:120 spec:Block-wall air:1 h:1200
boundary /site/garden /out/e edge:E t:120 spec:Block-wall air:1 h:1200
boundary /site/west /out/w edge:W t:120 spec:Block-wall air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:Block-wall air:1 h:1200
boundary /site/east /out/e edge:E t:120 spec:Block-wall air:1 h:1200
boundary /site/east /out/n edge:N t:120 spec:Block-wall air:1 h:1200
boundary /site/north /out/n edge:N t:120 spec:Block-wall air:1 h:1200

polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

```text
$ npx tsx src/cli.ts check site.muro
✔ Consistent — 9 spaces / 16 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```text
$ npx tsx src/cli.ts site site.muro
Site /site (Site)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (South-road) width 6000mm / frontage 11000mm
  Building footprint (horizontal projection, rough): 56.00 m2 → building coverage ratio 36.4%
  Total floor area: 56.00 m2 → floor area ratio 36.4%
```

How to read it:

| Line | Where it comes from |
|---|---|
| Site shape | the polygon's vertex count; absent when there is no polygon |
| Site area — declared | `area:` on `zone /site`, the surveyed figure |
| Site area — derived | the shoelace formula on the polygon, or the union of the horizontal projections of the site's spaces and the indoor spaces |
| Road | total length of boundary segments between spaces under the site zone and an `exterior` carrying `road:`. **An external wall of the building facing the road is not frontage** |
| Building footprint | the union of the horizontal projections of the indoor spaces |
| ratios | footprint ÷ site area, and total floor area ÷ site area |

`site` exits 0 when there is a site zone and 1 when there is not.

## Skip step 4 and the footprint doubles

Delete the seven boundary walls to the neighbours and `check` stays green while the footprint more than doubles.

```text
$ npx tsx src/cli.ts check site-nofence.muro
✔ Consistent — 9 spaces / 9 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ npx tsx src/cli.ts site site-nofence.muro
Site /site (Site)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (South-road) width 6000mm / frontage 11000mm
  Building footprint (horizontal projection, rough): 121.00 m2 → building coverage ratio 78.6%
  Total floor area: 121.00 m2 → floor area ratio 78.6%
```

**A garden with no boundary to the exterior is not derived as semi-outdoor, so it is counted as indoors.**

## When declared and derived disagree

Change `area:` to 160.40 and `check` stays green. **Nothing about the composition is broken** — a survey figure disagreeing with a polygon is an architectural judgement, and [`koyu validate`](../reference/cli/validate.md) is what says it (the two are compared only when a polygon exists).

```text
⚠ [koyu.schematic.site.area] site-mismatch.muro:line 17: Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2 (/site)
Validation — 0 violations / 1 caution
```

The rule is `koyu.schematic.site.area`, a caution. `validate --json` gives it structured.

```json
[
 {
  "rule": "site.area",
  "level": "caution",
  "message": "Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2",
  "line": 17,
  "file": "site-mismatch.muro",
  "path": [
   "/site"
  ]
 }
]
```

**Violations are what stop CI** — `validate` exits 1 only when there are violations. On the site side those are `koyu.schematic.site.escape`, the building spilling outside the outline, and `koyu.schematic.site.frontage`, less than 2m of road frontage. Both are in [the site rules](../reference/validate/site.md).

## On the bundled examples

```text
$ npx tsx src/cli.ts site examples/house.muro
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

`examples/house.muro` has no polygon, so the derived site area comes from the union of the garden, the paths and the building.

```text
$ npx tsx src/cli.ts site examples/tower/main.muro
Frame: EPSG 6677 / easting -6250.48 m / northing -35720.115 m / elevation 3.85 m of z=0 (vertical CRS 6695)
Bearing: +Y bears 352.4° true — 7.6° west of true north
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436%
```

## Next

- [Split a building into layers](split-into-layers.md) — keeping the polygon in its own layer
- [Open windows and pass the daylight check](windows-and-daylight.md) — a garden open to the sky sets the coefficient
- [Find spaces you cannot reach](find-unreachable.md) — is there a route from the gate to the front door
