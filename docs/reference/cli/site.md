---
title: koyu site
mode: reference
---

# koyu site

Gives site area, road frontage, building coverage ratio and floor area ratio. They are derived from the composition rather than declared — the volume-study numbers of schematic design.

## Arguments

```text
koyu site <entry.muro>
```

Takes one entry path.

## Flags

None.

## The two declarations it needs

| Element | How it is written |
|---|---|
| The site | A **zone** carrying `site:1` |
| A road | An `exterior` **space** carrying `road:<width in mm>` |

Without both, no site report comes out.

## Output

```sh
npx tsx src/cli.ts site examples/house/main.muro
```

```text
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

| Line | Contents |
|---|---|
| `Frame` | Only when [`origin`](../muro/origin.md) is declared. The EPSG code, the easting and northing **in metres**, and the height of `z = 0` if written |
| `Bearing` | Only when [`azimuth`](../muro/azimuth.md) is declared. **The bearing in figures and again in words** |
| `Site` | The site zone's path and display name |
| `Site shape` | Only when a `polygon` is declared. The vertex count |
| `Site area` | Both figures as `declared … / derived …` when `area:` is written; otherwise one figure as `Site area (derived):` |
| `Road` | One line per road: width and frontage |
| `Building footprint` | Building footprint (horizontal projection, rough) and coverage ratio |
| `Total floor area` | Total floor area and floor area ratio |

The denominator of the ratios is the declared value when `area:` is written, and the derived value otherwise.

**The two frame lines are the only ones on this page that are not derived** — they are read straight back from what was written, and they are printed even when there is no site to report on. The bearing is repeated in words on purpose. `352.4` and `7.6° west of true north` are the same fact, but a value copied off a drawing that showed magnetic north is a well-formed number in range, and Japan's declination runs from about 5° to 9.5° west. Reading it aloud once is the only check there is.

## When the site shape is declared

Writing the site shape as a `polygon` makes the area come from that polygon. The reconciliation against the zone's `area:` (the surveyed figure) is simply the two numbers side by side.

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
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

**When the declared and derived figures disagree, `site` silently prints both.** Calling the disagreement a problem is [`koyu validate`](validate.md)'s `koyu.schematic.site.area` (caution). A building that leaves the site polygon is `koyu.schematic.site.escape` (violation); frontage under 2m is `koyu.schematic.site.frontage` (violation).

## How frontage is counted

Frontage is the total length of the boundary segments **between spaces under the site zone and the road**. A building wall that faces the road directly is not counted. Write only the building and no exterior works, and the frontage comes out as zero.

## When there is no site

```sh
npx tsx src/cli.ts site examples/mansion.muro
```

```text
There is no site (write site:1 on a zone and road:<width> on the road)
```

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | The site report came out |
| 1 | There is no site (no zone with `site:1` and no exterior with `road:`), or the input could not be read |
| 2 | No file path was given (usage is printed) |

**`site` only produces numbers; it never passes judgement.** Whether a coverage ratio of 51.9% exceeds the permitted figure is not information this surface holds.

## About the coarseness

The rules for what counts toward the building footprint are rough. Overhangs, the treatment of basements and garage relief are all ignored. Total floor area is the same figure as [`koyu stats`](stats.md)'s indoor floor area, so semi-outdoor and outdoor are not in it.

## See also

- [koyu validate](validate.md) — `koyu.schematic.site.area` / `koyu.schematic.site.escape` / `koyu.schematic.site.frontage`
- [koyu stats](stats.md) — the total floor area broken down
- [.muro reference](../muro/index.md) — a `zone`'s `site:` and how to write `polygon`
- [The koyu command](index.md) — the shared promises about exit codes
