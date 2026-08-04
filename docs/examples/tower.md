---
title: tower — site polygon, exception floors, bands
mode: explanation
---

# tower — site polygon, exception floors, bands

`examples/tower/`. 453 lines / 9 files / 178 spaces / 543 boundaries / 4,785.92 m² of interior floor area / 941.16 m² semi-outdoor. An eleven-storey mixed-use building — retail below, housing above — on a corner site that is not rectangular. This is the example where **layers written separately are built as one building**.

`main.muro` is the base layer; the other eight are `assets`, `site-geometry`, `site`, `L1`, `L2`, `typical`, `L3` and `L11`.

![tower L1](../img/tower-L1.svg)

## What it shows first

- **[`polygon`](../reference/muro/polygon.md) — the site shape.** The one shape in this notation written with free vertices off the grid. A site is not a product of design but survey input, so it is admitted as an exception. The convention is to isolate it in its own layer — `site-geometry.muro` is effectively one line.
- **Writing an exception floor as a difference.** `typical.muro` supplies the dwellings on L3..L10 and the core on L3..L11; `L3.muro` writes **only the difference** — a terrace on the podium roof in place of the south balconies — in 31 lines.
- **Different spans per element.** Dwellings are `/L3..L10/`, the core `/L3..L11/`, balconies `/L4..L10/`. All three used within one file.
- **Frontage on two roads** — a corner site with a 12 m road south and a 6 m road east. Frontage is derived as the sum of boundary segment lengths.
- **Deriving what is above.** There is nowhere to write a roof or a canopy; it is read from the overlap of spaces on the levels above.
- **[`band`](../reference/muro/band.md) — dividing by dimension and order.** The two bedrooms, the wet core and the entrance hall of type A are written as a sequence of widths, not as regions.
- **`style:auto`** — an automatic door, which changes how the leaf is drawn in plan.

## Excerpts

The site-shape layer. Strip the comments and the body is one line.

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

Bands on the typical floor. Write dimension and order; let position be derived.

```muro-part
band Y X1..X1+3200 Y1..Y2
  space /L3..L10/A/bed2 bedroom w:2400 name:洋室2 daylight:1
  space /L3..L10/A/bed1 bedroom w:3200 name:洋室1 daylight:1

band X X1+3200..X2+3200 Y1+4000..Y2
  space /L3..L10/A/wet  wet  w:4800 name:水回り
  space /L3..L10/A/hall hall w:1600 name:玄関
```

Both are **closed bands** — no `w:rest`, so the sum of the widths is reconciled against the width of the band at parse time, which catches a mistyped dimension. A band expands into ordinary spaces and survives neither in the model nor in the [canonical JSON](../reference/json/index.md). **It yields byte-identical canonical JSON to the version written with positions.**

The exception-floor layer (the opening of `L3.muro`). It never touches the typical dwellings; it adds terraces and reglazes.

```muro-part
space /L3/tA terrace X1..X3 Y1-4600..Y1 name:テラスA
space /L3/tB terrace X3..X4+3200 Y1-4600..Y1 name:テラスB
space /L3/tC terrace X4+3200..X6 Y1-4600..Y1 name:テラスC

boundary /L3/A/ldk /L3/tA t:100 spec:サッシ
  door BD1 at:X2+2400 name:掃き出し引違い
  window W1 at:X2 name:掃き出し
  window W3 at:X2+4800
boundary /L3/tA /L3/tB t:60 spec:隔て板 air:1
boundary /L3/tA /out/road-s edge:S t:120 spec:パラペット+手すり air:1 h:1200
```

The consequence shows up in the drawings.

![tower L3](../img/tower-L3.svg)

![tower L5](../img/tower-L5.svg)

L3 and L5 both come to 422.40 m² of interior floor area, but the semi-outdoor breakdown differs.

```text
  /L3/tA	テラスA	terrace	58.88 m2 (semi-outdoor, reported separately)
  /L3/tB	テラスB	terrace	44.16 m2 (semi-outdoor, reported separately)
  /L3/tC	テラスC	terrace	44.16 m2 (semi-outdoor, reported separately)
  Subtotal 422.40 m2
```

```text
  /L5/bA	バルコニーA	balcony	19.20 m2 (semi-outdoor, reported separately)
  /L5/bB	バルコニーB	balcony	14.40 m2 (semi-outdoor, reported separately)
  /L5/bC	バルコニーC	balcony	14.40 m2 (semi-outdoor, reported separately)
  Subtotal 422.40 m2
```

147.20 m² of terrace against 48.00 m² of balcony. **Thirty-one lines of difference layer produce that.**

The penthouses and the shared roof terrace on the top floor.

![tower L11](../img/tower-L11.svg)

## Questions worth putting to it

### From the ninth-floor LDK to the south road

The route runs out of the tower, through the podium, across the landscape and onto the road as one continuous path across storeys.

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L9/A/ldk /out/road-s
```

```text
4 doors — /L9/A/ldk → /L9/A/hall → /L9/corridor → /L9/st2 → /L8/st2 → /L7/st2 → /L6/st2 → /L5/st2 → /L4/st2 → /L3/st2 → /L2/st2 → /L1/st2 → /site/west → /site/walk → /out/road-s
```

### Do the site figures agree

The declared survey figure matches the shoelace area of the polygon.

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

### Where does "under a canopy" come from

The L3 terraces are 4600 mm deep, and the strip nearest the building falls under the L4 balconies. So they are judged covered, and the daylight coefficient stays at 0.7. The result: the LDK window area on L3 and on L5 both come out at 6.01 m².

```sh
npx tsx src/cli.ts light examples/tower/main.muro
```

```text
  /L3/A/ldk	LDK	window 6.01 m2 / floor 33.28 m2 = 1/5.5
  /L5/A/ldk	LDK	window 6.01 m2 / floor 33.28 m2 = 1/5.5
  /L11/PA	ペントハウスA	window 15.07 m2 / floor 89.60 m2 = 1/5.9
  /L11/PB	ペントハウスB	window 15.07 m2 / floor 89.60 m2 = 1/5.9
```

(Four lines out of verdicts on 66 rooms. The output ends in `66 rooms in daylight scope`.)

**Even the presence of a roof is not declared.** What sits above a terrace is settled by whether the horizontal projection of a space on a level above overlaps it.

## Read next

- One order of magnitude up — [complex](complex.md)
- The minimal example of vertical circulation — [basement](basement.md)
