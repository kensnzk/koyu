---
title: The site — site.escape / site.area / site.frontage
mode: reference
---

# The site — site.escape / site.area / site.frontage

| rule | level |
|---|---|
| [`koyu.schematic.site.escape`](#site-escape) | violation |
| [`koyu.schematic.site.area`](#site-area) | caution |
| [`koyu.schematic.site.frontage`](#site-frontage) | violation |

The site is the zone carrying `site:1`, and its shape is given by the `polygon` at the same path. **The soundness of the shape itself** — duplicate vertices, self-intersection, a polygon with no corresponding zone — is what [`koyu check`](../cli/check.md) says. Broken given data yields no shape at all, so that belongs to reading the source.

What this chapter holds are **judgements about the relation between the building and the site**.

Coverage and floor-area ratios are numbers, so [`koyu site`](../cli/site.md) returns them. Comparing them against a limit needs a fact that was never written — which zoning district this is — so there is no judgement for it.

## `koyu.schematic.site.escape` — it escapes the site outline {#site-escape}

`violation`

A space with a region lies outside the site polygon.

```muro-fail
koyu 1.1
grid X 0 10000 14000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

```text
✖ [koyu.schematic.site.escape] main.muro:line 8: /L1/a escapes the site shape (near 14000,0)
Validation — 1 violation / 0 cautions
  koyu.profile.schematic-screen@1 — 1 evaluated / 15 not applicable / 0 indeterminate / 0 error
```

The polygon stops at X = 10000, while `/L1/a` occupies X2..X3 = 10000..14000.

**The test is not just corner containment.** It also looks for polygon vertices intruding into the space and for edges crossing, so it is correct on a concave site — a flag lot, or one with a cut corner. Sitting on the line counts as inside, with a 1mm tolerance.

What is compared is not the written layout but **the derived region**, so an outline cut to follow the site passes as written.

Two kinds of space are never counted: **spaces under the site zone (`/site/…`)** and **`type:exterior` spaces**. The landscape tiles and the roads are supposed to be out there.

The message prints the coordinates of the first escaping point found. One space yields at most one finding.

**Fix** — bring the layout inside the site, or correct the surveyed values in the `polygon`. Above, if the polygon is right, shrink the space; if the space is right, correct the vertices to `0,0 14000,0 14000,10000 0,10000`.

## `koyu.schematic.site.area` — the declared and derived site areas disagree {#site-area}

`caution`

The zone's `area:` (a transcription of the survey) and the area computed from the `polygon` differ by **0.05 m² or more**.

```muro-caution
koyu 1.1
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
⚠ [koyu.schematic.site.area] main.muro:line 5: Declared and derived site areas disagree: declared 120 m2 / derived 100.00 m2 (/site)
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 1 evaluated / 15 not applicable / 0 indeterminate / 0 error
```

A 10 m square polygon is 100 m², but `area:` says 120.00. **One fact is written in two places, and the two disagree.** Either a mistyped vertex, a transcription error in `area:`, or a survey update that reached only one of them.

A site with no `area:` is not checked. With only one number there is nothing to disagree with.

**Fix** — decide which is right and correct the other. Since `area:` is a transcription of the survey result, the thing to suspect is usually the `polygon`'s vertices. [`koyu site`](../cli/site.md) prints both figures side by side.

```sh
koyu site main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 120.00 m2 / derived 100.00 m2
  Building footprint (horizontal projection, rough): 100.00 m2 → building coverage ratio 83.3%
  Total floor area: 100.00 m2 → floor area ratio 83.3%
```

## `koyu.schematic.site.frontage` — the road frontage is too short {#site-frontage}

`violation`

The boundary segments between an exterior space carrying `road:` (its width in mm) and the spaces under the site zone total less than **2000mm**.

```muro-fail
koyu 1.1
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n type:open
```

```text
✖ [koyu.schematic.site.frontage] main.muro:line 8: Road frontage is 1500mm, under the 2000mm this pack screens for: /out/road-n (widen the frontage onto the road)
Validation — 1 violation / 0 cautions
  koyu.profile.schematic-screen@1 — 3 evaluated / 13 not applicable / 0 indeterminate / 0 error
```

The road meets the site over X1..X2 = 0..1500 only. What is measured is the length of the boundary segments, not the road's own width (`road:4000`).

**Only the boundary between the site and the road counts as frontage.** A building wall facing the road does not — the only lengths summed are those on boundaries written between a road and a space under the `site:1` zone (the landscape tiles).

**With no site declared, the rule does not run.** In a model with no `site:1` zone the frontage derives as 0, but that is "not derivable", not "no frontage". Models that write a road and no site genuinely exist — a basement section, for instance. Draw a line under a number that could not be derived, and not writing something becomes a violation.

The 2 m floor is a rule on the architectural side. The frontage length itself is derived as a number, and [`koyu site`](../cli/site.md) lists it road by road.

**Fix** — write the boundary that faces the road. In the example, correct the width over which the site meets the road (X1..X2) to the real one.

```muro
koyu 1.1
grid X 0 4000 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n type:open
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area (derived): 100.00 m2
  Road: /out/road-n (北側道路) width 4000mm / frontage 4000mm
  Building footprint (horizontal projection, rough): 0.00 m2 → building coverage ratio 0.0%
  Total floor area: 0.00 m2 → floor area ratio 0.0%
```

## See also

- [`koyu site`](../cli/site.md) — site area, frontage, footprint, coverage and floor-area ratios as numbers
- [The validation ledger](index.md) — all sixteen rules, and why a judgement is not a diagnostic
