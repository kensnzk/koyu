---
title: zone — the counted aggregation
mode: reference
---

# zone — the counted aggregation

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
zone /site name:敷地 site:1 area:1097.80
```

`zone <path> [attributes...]` is **an aggregation with no geometry**. It groups the [spaces](space.md) beneath it by path prefix, sums their area, and hands attributes down. A dwelling, a department, a site — anything that is counted but has no form of its own — belongs here.

Because a zone has no form, it appears in no plan and no axonometric, and it cannot be an end of a [boundary](boundary.md).

## The path prefix decides what is beneath

Beneath the zone `/L1/A` is every space whose path begins `/L1/A/`. A space at the zone's own path is not beneath it.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ use:exclusive
space /L1/A/ldk ldk X1..X2 Y1..Y2
space /L1/A/room room X2..X3 Y1..Y2 use:common
```

```text
$ npx tsx src/cli.ts stats z2.muro
L1
  /L1/A/ldk	ldk	ldk	14.40 m2
  /L1/A/room	room	room	14.40 m2
  Subtotal 28.80 m2
Total 28.80 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/A	Aタイプ	28.80 m2
  ldk: 14.40 m2
  room: 14.40 m2
By use: exclusive 14.40 m2 (50.0%) / common 14.40 m2 (50.0%)
```

`use:` is inherited by everything beneath, and **a declaration on the space wins**. Above, `/L1/A/ldk` inherits `exclusive` from the zone while `/L1/A/room` keeps the `common` it wrote itself. Where zones nest, the deepest zone is the source of inheritance.

## To divide into rooms, make the parent a zone

When splitting a dwelling into rooms, **the parent must not be a `space`.** Putting a space with a region beneath a space with a region makes the two regions overlap, which is the error [GEO02](../diagnostics/geo.md).

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

Rewrite `space /L1/A unit X1..X3 Y1..Y2` as `zone /L1/A name:Aタイプ` and it passes. The dwelling's area is summed from beneath, so it is never written.

## The attributes

Five keys may be written on a zone, plus any namespaced key containing a dot. A key in neither category is the error [ATT03](../diagnostics/att.md).

| Key | Value | Meaning |
|---|---|---|
| `name:` | free word | Display name, shown in listings and totals |
| `use:` | free word | The aggregation axis. Inherited by the spaces beneath; a declaration on the space wins |
| `site:` | `0` / `1` | The mark of the site. The zone with `1` is what `site` asks about. One per model |
| `area:` | positive number, m² | The declared site area (a survey figure). Reconciled against the derived area |
| `uid:` | opaque token | Persistent identity across renames. Digits alone, or whitespace, is an error. Unique across the whole model, spanning space and zone |

`road:` belongs to the `exterior` space that is the road, not to a zone. On a zone it is stopped.

```text
✖ z7.muro:line 4: zone /L1/A carries road:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.road:12000)
```

## The site zone

The zone carrying `site:1` is the site. Site area, road frontage, building coverage and floor area ratio are all derived starting from it.

```muro
koyu 1.1
grid X 0 12000
grid Y 0 10000
level L1 0 h:3000 slab:200
zone /site name:敷地 site:1 area:120.00
space /site/bldg office X1..X2 Y1..Y2 level:L1 name:事務所
space /road road:6000 name:前面道路 outside:1
boundary /site/bldg /road edge:S t:200
polygon /site 0,0 12000,0 12000,10000 0,10000
```

```text
$ npx tsx src/cli.ts site site.muro
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 120.00 m2 / derived 120.00 m2
  Road: /road (前面道路) width 6000mm / frontage 12000mm
  Building footprint (horizontal projection, rough): 120.00 m2 → building coverage ratio 100%
  Total floor area: 120.00 m2 → floor area ratio 100%
```

Three things to read in that.

- **`area:` is a declared survey figure, reconciled against the derived area.** A disagreement is reported not by `koyu check` but by `koyu validate` as `koyu.schematic.site.area` — nothing about the composition is broken; a given and a form disagree, which is an architectural matter.
- The shape of the site is written separately, by [polygon](polygon.md). Without a polygon for the `site:1` zone, the derived area comes from the union of the spaces on the site and the building's horizontal projection. A polygon with no corresponding zone is the warning [SIT04](../diagnostics/sit.md).
- **`/site` is not a level name, so the spaces beneath it inherit no level.** Drop the `level:L1` above and it becomes the error [SUF02](../diagnostics/suf.md).

## Level spans

If the first segment of the path has the form `L3..L10`, it expands over the declared levels in ascending z, exactly as for a [space](space.md). This is how the same zone is placed on every typical floor.

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
```

## Diagnostics

| Situation | What comes out |
|---|---|
| The same zone path declared twice | a parse error (`Duplicate zone path: /L1/A`) |
| No space beneath it | [ZON01](../diagnostics/zon.md) — warning |
| A space and a zone at the same path | [ZON02](../diagnostics/zon.md) — warning |
| `uid:` all digits / containing whitespace / duplicated | [UID01 / UID02 / UID03](../diagnostics/uid.md) — errors |

```text
$ npx tsx src/cli.ts check z3.muro --json
[
 {
  "code": "ZON01",
  "severity": "warning",
  "message": "There are no spaces beneath zone /L2/A",
```

ZON01 stays a warning because a file split into layers may legitimately be read before the layer holding its spaces. If it is still empty after composition, the path is almost always misspelled.

## Canonical JSON

A zone holds its path and its attributes. Area is derived, so it is not stored.

```text
  "zones": {
    "/site": {
      "attrs": {
        "area": 120,
        "name": "敷地",
        "site": 1
      }
    }
  },
```
