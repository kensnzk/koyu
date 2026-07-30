---
title: polygon — the shape of the site
mode: reference
---

# polygon — the shape of the site

```text
polygon /zone-path x,y x,y x,y …
```

`polygon` writes the shape of the site directly, as a list of vertices in mm. **It is the one place in the notation where a shape is written out of free vertices that do not ride the grid.**

In koyu a shape is normally something generated — the region of a space is written as rectangles of grid references, and walls, columns and roofs all follow from it. But **the shape of a site is a given, coming from survey**, not something the design produces. So it is admitted as the exception.

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

Three or more `x,y` pairs. The coordinate system is the grid's: millimetres, X east-positive, Y north-positive. Negative values are fine.

## It corresponds to a zone with site:1

The first positional argument is the path of a [zone](zone.md). Where that zone carries `site:1`, the polygon becomes the subject of the `koyu site` question. Where no such zone exists, you get a warning.

```text
⚠ No zone corresponds to polygon /siteX
```

```muro
koyu 1.0
name 敷地の最小例
unit mm
grid X 0 8000
grid Y 0 6000
level L1 0 h:2700 slab:200

zone /site name:敷地 site:1 area:154.00
space /site/house room X1..X2 Y1..Y2 level:L1 name:建物
space /out/road exterior name:前面道路 road:6000

polygon /site -2000,-2000 12000,-2000 12000,9000 -2000,9000

boundary /site/house /out/road edge:S t:150
  door w:900 name:玄関
boundary /site/house /out/road edge:N t:150
boundary /site/house /out/road edge:E t:150
boundary /site/house /out/road edge:W t:150
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (前面道路) width 6000mm / frontage 28000mm
  Building footprint (horizontal projection, rough): 48.00 m2 → building coverage ratio 31.2%
  Total floor area: 48.00 m2 → floor area ratio 31.2%
```

## What comes out of it

| Derivation | What it feeds |
|---|---|
| area (shoelace) | site area, reconciled against the zone's `area:` (the surveyed figure in m2) |
| the outline | the check for a building escaping the site |
| the site boundary line | the site plan — drawn on the lowest storey's plan as a chain line |

The `site` question still answers without a `polygon` — the site area is then derived from the union of the spaces inside the site and the indoor footprint. A `polygon` replaces that with the surveyed shape.

## check speaks for the shape, validate for its relation to the building

**A broken shape cannot produce a form**, so that much belongs to reading the source, and `check` sees it.

| Code | Severity | What it says |
|---|---|---|
| SIT01 | error | a duplicate vertex in the site shape |
| SIT02 | error | the site shape is self-intersecting |
| SIT04 | warning | a `polygon` with no corresponding zone |

```text
✖ The site shape has a duplicate vertex (12000,-2000)
✖ The site shape is self-intersecting (near 5000,3500)
```

**Judgements about the building's relation to the site** live on the other side, as two rules of `koyu validate`.

| Rule | Level | What it says |
|---|---|---|
| `site.escape` | violation | the building escapes the site shape |
| `site.area` | caution | the declared and derived areas disagree (tolerance ±0.05 m2) |

```text
✖ [site.escape] esc.muro:line 8: /L1/house escapes the site shape (near 0,0)
⚠ [site.area] site.muro:line 8: Declared and derived site areas disagree: declared 150 m2 / derived 154.00 m2
```

The escape test reads the **derived region**, not the written allocation. So an outline cut back to follow the site with a [drawn line](line.md) passes here. Spaces of `type:exterior`, and spaces beneath that polygon's own zone path, are left out of the test.

## Keep it in its own layer

The standard practice is to put the site shape in its own file and stack it with `import`. Survey givens and design decisions are easier to follow through history when they are separate layers.

```muro-part
import ./site-geometry.muro
```

Writing `polygon` twice for one path is a build error, across composed layers as well as within one file.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [zone](zone.md) — what a `polygon` corresponds to
- [space](space.md) — what is placed inside the site
- [line](line.md) — the other written shape
- [koyu site](../cli/site.md) — answers the site question
- [koyu validate](../cli/validate.md) — speaks about escapes and area disagreements
