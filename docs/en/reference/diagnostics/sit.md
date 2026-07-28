---
title: SIT — the site shape
mode: reference
---

# SIT — the site shape

Three SIT codes are live. SIT03 and SIT05 are **retired numbers**.

| Code | Severity | What it says |
|---|---|---|
| SIT01 | error | The site shape has a duplicate vertex |
| SIT02 | error | The site shape is self-intersecting |
| SIT03 | — | **retired** |
| SIT04 | warning | No zone corresponds to the `polygon` |
| SIT05 | — | **retired** |

**The site is the one thing in koyu whose shape is written.** Every building shape is derived from allocations and relations, but a site outline comes from a survey — it is a **given** — so `polygon` carries its vertices directly.

`polygon` has exactly one form.

```text
polygon /zone-path x,y x,y x,y ...
```

Coordinates are in mm and there must be three or more vertices. **The polygon is treated as closed**, so never repeat the first point at the end. An unreadable vertex or fewer than three points is a syntax error, stopped by the parser on the spot.

The three live codes look only at **the soundness of the given** — whether it holds together as a shape, and whether a zone corresponds to it. Judgements about the **relation** between building and site are not in `koyu check` at all (see "retired numbers" below).

## SIT01 — the site shape has a duplicate vertex

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
The site shape has a duplicate vertex (0,0)
```

**Cause** — two consecutive vertices sit at the same point. The test is whether the distance between neighbours is **1mm or less**, so `0,0` followed by `0,0.5` counts as a duplicate too.

Nearly always this is survey data pasted in with the last point repeating the first. A zero-length edge makes both the area and the inside/outside test untrustworthy.

**Fix** — delete the duplicate vertex. No repetition is needed to close the shape.

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

## SIT02 — the site shape is self-intersecting

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 0,10000 10000,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

```text
The site shape is self-intersecting (near 5000,5000)
```

**Cause** — the edges cross each other: a bow tie. The reason is nearly always that the vertices are in **the wrong order**. The example jumps bottom-right, top-left, top-right.

**Everything after this is abandoned.** Neither area nor containment is definable, so for this polygon the zone correspondence and every judgement about the site stop there. The message gives the coordinates of the crossing, so look at the two edges near it.

**Fix** — reorder the vertices along the perimeter. Clockwise or counter-clockwise, either is fine — the winding only signs the area, and koyu takes the absolute value.

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

## SIT04 — no zone corresponds to the polygon

`warning`

```muro-warn
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
polygon /site 0,0 10000,0 10000,10000 0,10000
space /L1/a room X1..X2 Y1..Y2
```

```text
No zone corresponds to polygon /site
```

**Cause** — a `polygon` is written **against a zone's path**. With no zone at that path, this shape is used by nothing: no area, no frontage, no containment, and no site boundary drawn on the lowest storey of `koyu plan`. Either the zone was forgotten or the path is spelled differently.

**Fix** — declare the zone at the same path.

```muro
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

**Do not forget `site:1`.** With a zone present but `site:1` missing, `koyu site` has no subject and not one site judgement runs. Writing the zone while dropping `site:1` makes SIT04 disappear while the answers stay missing — the most confusing state of the three.

## Retired numbers — SIT03 and SIT05

These two numbers are **never reused**. A spelling that comes to mean something else makes past output unreadable.

SIT03 once meant "the building escapes the site shape" and SIT05 "the declared and derived site areas disagree". Both are **judgements about the relation between building and site**, not about whether what was written holds together as data. So both left `check` and became validation rules.

| Was | Now | Level |
|---|---|---|
| SIT03 | `site.escape` | violation |
| SIT05 | `site.area` | caution |

`check` stays green; only `validate` speaks.

```muro
grid X 0 10000 12000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1 area:120
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

```sh
koyu check bad.muro --strict
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```sh
koyu validate bad.muro
```

```text
⚠ [site.area] <absolute path>/bad.muro:line 4: Declared and derived site areas disagree: declared 120 m2 / derived 100.00 m2
✖ [site.escape] <absolute path>/bad.muro:line 7: /L1/a escapes the site shape (near 12000,0)
Validation — 1 violation / 1 caution
```

The area comparison tolerates **±0.05 m²**. The containment test looks at the **derived region** rather than the allocation, so an outline cut to follow the site passes as written. Spaces beneath the site zone (`/site/…`) are excluded from the test — a yard or a path is part of the site.

`koyu validate` also carries a minimum road frontage (`site.frontage` — 2000mm). It asks nothing of a model where no site is declared: drawing a line under a number that could not be derived would turn "not written" into "in violation".

## Related

- [ZON — zones](./zon.md) — the checks on the zone a `polygon` pairs with
- [ATT — attributes](./att.md) — how writing `site:yes` erases every site judgement (ATT02)
- [koyu validate](../cli/validate.md) — `site.escape` / `site.area` / `site.frontage`
- [koyu check](../cli/check.md)
