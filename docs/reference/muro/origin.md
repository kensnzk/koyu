---
title: origin — where the model sits on the earth
mode: reference
---

# origin — where the model sits on the earth

```text
origin epsg:<code> easting:<metres> northing:<metres> [elevation:<metres> vertical:<code>]
```

`origin` says where the model's `(0, 0, 0)` sits in a coordinate reference system. Like the [site shape](polygon.md), it is a **given** — it comes from a survey, and nothing in the design can produce it.

```muro-part
origin epsg:6677 easting:-8000.123 northing:-34000.456 elevation:2.35 vertical:6695
```

It is optional. A model without it is a complete model — it simply does not say where on the earth it is.

## The keys

| Key | Meaning |
|---|---|
| `epsg` | The EPSG code of a **projected** coordinate reference system. Required |
| `easting` | The easting of the model's `x = 0`, **in metres**. Required |
| `northing` | The northing of the model's `y = 0`, **in metres**. Required |
| `elevation` | The height of the model's `z = 0`, **in metres**. Written with `vertical` |
| `vertical` | The EPSG code of the vertical coordinate reference system `elevation` is measured in |

Nothing else may be written. A key outside this list is a syntax error, so a typo cannot slip through as a silently missing origin.

```text
origin carries eastign:, which is not in the ledger (origin reads epsg / easting / northing / elevation / vertical)
```

## Metres, not millimetres

Everywhere else in koyu a number is millimetres. Here it is metres, and the exception is deliberate: **`origin` is not a length inside the model, it is a point inside a foreign frame, and a foreign frame brings its own numbers.**

The practical reason is transcription. A Japanese survey result reads `-8000.123`, and that is what goes on the line, character for character. Written in millimetres the same value is `-8000123`, and the error that follows is not the loud one — a value that is out by a thousand is absurd on sight. The quiet one is a missing zero: `-8000.12` becomes `-800012`, a displacement of 7.2 m, entirely plausible and entirely silent.

## The X column is the northing

**On a Japanese plane rectangular coordinate sheet the X column is the northing and the Y column is the easting** — the reverse of the usual convention, and the reverse of what `grid X` and `grid Y` mean in this notation.

> Write the sheet's **X** into `northing:` and the sheet's **Y** into `easting:`.

The key names are spelled out rather than borrowed from `x` and `y` for exactly this reason: there is no `x:`/`y:` form to reach for by habit. The spelling stops the wrong *name*; it cannot stop the wrong *number*, because a Tokyo northing of −34 km is a perfectly legal easting. Read the line back once against the sheet.

## The code is not interpreted

koyu stores `epsg` and checks that it is a whole positive number. It holds no table of codes, resolves nothing, and projects nothing.

That is not thrift. **The one derivation everyone wants — model millimetres to coordinates on a map — is precisely the one that cannot live here**, because it needs the meridian convergence, and that needs the projection. The line is drawn by what koyu declines to hold, not by taste.

A single EPSG code carries the datum, the projection, the zone, the axis order and the unit in one token, so there is no second spelling to disagree with it. It is also what survives a renaming: each realisation of the Japanese datum gets its own codes, so a file written today keeps its meaning when the datum's *name* changes.

| Code | What it is |
|---|---|
| 6669–6687 | JGD2011 plane rectangular systems I–XIX (6677 is system IX) |
| 6695 | JGD2011 vertical height — the usual value for `vertical` in Japan |

**A compound code is not accepted.** `epsg` is always the horizontal system and `vertical` is always the vertical one: one slot, one meaning. Allowing a compound code would make the meaning of `epsg` depend on a code koyu has promised not to read.

**Geographic coordinates are not accepted either.** A latitude and a longitude pin a location, but they do not pin a *frame* — with no metric axes there is no bearing and no metre-for-metre placement.

## A height needs the datum it is measured from

`elevation` and `vertical` are written together. One without the other is an error.

```text
elevation: and vertical: are written together (a height needs the datum it is measured from)
```

The plane rectangular systems are two-dimensional and have no vertical axis at all, so a height written beside one says nothing about what it was measured from. In Japan that gap is more than a millimetre of pedantry: T.P., A.P., O.P. and Y.P. are all in daily use and differ by more than a metre, and an ellipsoidal height differs from an orthometric one by the geoid separation — thirty to forty metres. A consumer that wants ellipsoidal heights and is handed an unqualified orthometric one buries the building.

**`elevation` is the height of the model's `z = 0`.** It is not the ground level, not 地盤面, and not 平均地盤面. Nothing about a height limit follows from it.

## What follows from it

Nothing, inside koyu. `origin` changes no area, no adjacency, no drawing and no derived form. It is carried into the [canonical JSON](../json/schema.md) for whatever reads the model next.

What reads it next needs one formula, and it is worth writing down because it is easy to leave out. A projected system's axes are aligned to **grid north**, while [`azimuth`](azimuth.md) is measured from **true north**. The two differ by the meridian convergence γ at the origin:

```text
rotation from the model frame to the CRS grid = azimuth − γ(origin)
```

γ is zero on a system's central meridian and grows to roughly 0.87° at a system's edge; in central Tokyo, close to system IX's meridian, it is about 0.05°. Half a degree puts the far corner of a 100 m building 0.87 m out of place.

## Declared once, in the layer that holds the survey

`origin` may be written in any layer, but only once across all of them. A second one is a build error that names where the first was.

```text
Duplicate origin: a model has one frame (first seen in site-geometry.muro at line 4)
```

**A model has one frame.** Two buildings on one site facing different ways cannot be written — that follows from having one grid of axis-parallel rectangles, not from this line.

The standard practice is the same as for the site shape: put the survey givens in their own file and stack it with `import`, so what came from a surveyor stays visibly apart from what was decided.

```muro-part
import ./site-geometry.muro
```

It is neither overridable nor removable. To study the same design at two positions, write two entry files that import the same design layer.

## Write the bearing beside it

`origin` alone gives a position and no bearing, and anything trying to place the model then has to assume one. `koyu check` says so.

```text
⚠ origin is written without azimuth, so the model has a position but no bearing
```

That is [SIT06](../diagnostics/sit.md#sit06). The reverse is not warned about — [`azimuth`](azimuth.md) on its own is a finished statement.

## In full

```muro
koyu 1.1
name 測地の最小例
unit mm
grid X 0 8000
grid Y 0 6000
level L1 0 h:2700 slab:200

zone /site name:敷地 site:1 area:154.00
origin epsg:6677 easting:-8000.123 northing:-34000.456 elevation:2.35 vertical:6695
azimuth Y 347.5

space /site/house room X1..X2 Y1..Y2 level:L1 name:建物
space /out/road name:前面道路 road:6000 outside:1

polygon /site -2000,-2000 12000,-2000 12000,9000 -2000,9000

boundary /site/house /out/road edge:S t:150
  door w:900 name:玄関
boundary /site/house /out/road edge:N t:150
boundary /site/house /out/road edge:E t:150
boundary /site/house /out/road edge:W t:150
```

## Neighbouring pages

- [azimuth](azimuth.md) — the other half of the frame
- [polygon](polygon.md) — the site shape, the other survey given
- [orientation](orientation.md) — why `N` `E` `S` `W` stay axis words
- [import](import.md) — how the survey layer is stacked
- [the canonical JSON](../json/schema.md) — where the frame lands
- [koyu site](../cli/site.md) — reads the frame back to you in words
