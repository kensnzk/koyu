---
title: complex — a very large mixed-use building
mode: explanation
---

# complex — a very large mixed-use building

`examples/complex/`. 646 lines / 10 files / 425 spaces / 1,364 boundaries / 31,606.24 m² of interior floor area. Two basement levels and nineteen above, twenty-two levels in all, mixing retail, plant, offices and a hotel. One order of magnitude above [tower](tower.md), and **the example that exists to find out whether scale itself is the wall**.

![complex L1](../../img/complex-L1.svg)

The composition:

| Band | Floors | Content |
|---|---|---|
| Podium | 1–5F | Retail and food. 4,800 floor-to-floor, 3,300 ceiling |
| Plant | 6F | A whole level of plant between podium and tower |
| Mid-rise | 7–13F | Offices. A rectangular typical floor written once |
| High-rise | 14–19F | Hotel. Guest rooms divided by bands |
| Basement | B1–B2 | Parking, plant, loading. One scissor ramp |
| Core | B2–L19 | Two stairs and two lift banks. **Nine lines** |

## What it shows first

- **[Lines](../reference/muro/line.md) — writing a diagonal.** The corner cuts of the podium are written `line X1,Y5+2000 X2,Y6`. There are no vertex coordinates anywhere — a line is drawn in the language of grid references, and the boundary is cut along it.
- **[Columns](../reference/muro/column.md) — an element with no written position.** `column 900 B2..L6` says only a size and a range of levels. Columns stand at grid intersections that have a floor on that level. **It is the same rule that makes walls emerge from boundaries, applied to a point element.**
- **Escalators** — a space with `escalator:N`, plus `stack es L1..L5 type:stair`.
- **An atrium** — `stack atrium L1..L5 type:void` raises a five-storey void in two lines.
- **That the daylight population is declared, not typed** — the hotel rooms carry `daylight:0`, the offices are out of scope too, and only residential uses are in.
- **That a core across ten-odd storeys folds** into level spans.

## Excerpts

The core layer. **Twenty-one levels of core in nine lines.**

```muro-part
space /B2..L19/ps shaft X4..X4+1400 Y4..Y5 name:PS・EPS use:common
space /B2..L19/st1 stair X4+1400..X4+4100 Y4..Y5 name:階段1 use:common stair:N form:return
space /B2..L19/ev1 shaft X4+4100..X4+8900 Y4..Y5 name:EVバンク1 use:common lift:1
space /B2..L19/ev2 shaft X4+8900..X4+13700 Y4..Y5 name:EVバンク2 use:common lift:1
space /B2..L19/wcm service X4+13700..X4+16900 Y4..Y5 name:男子便所 use:common
space /B2..L19/wcw service X4+16900..X4+19900 Y4..Y5 name:女子便所 use:common
space /B2..L19/tea service X4+19900..X4+21300 Y4..Y5 name:給湯室 use:common
space /B2..L19/st2 stair X4+21300..X7 Y4..Y5 name:階段2 use:common stair:N form:return
space /B2..L19/hall corridor X4..X7 Y4-3200..Y4 name:EVホール use:common
```

**The lift lobby runs the full width, and the stairs, lavatories, tea point and risers all open directly off it.** Entering the lavatories through the tea point, or the stair through a riser, closes as a plan and fails as a building — and it was the derived drawing that made that visible.

Diagonals appear only where the line is given (the site boundary).

```muro-part
boundary /L1/w04 /out t:300 spec:カーテンウォール
  line X1,Y5+2000 X2,Y6
boundary /L1/bohE /out t:300 spec:カーテンウォール
  line X7+4000,Y6 X8,Y5+2000
```

A designed diagonal — a passage cutting through the mall — was written once and thrown away. Running a diagonal through a mall of regular tenancies was something done because the notation could, not because it was a design decision. **The number of lines should equal the number of design decisions, and the only diagonals left in this example follow given lines.**

Columns carry a size and a range of levels, nothing more.

```muro-part
column 900 B2..L6
column 800 L7..L13
column 700 L14..L19
```

They taper as they rise. No position is written anywhere.

Hotel rooms are divided by bands. **Six levels × thirteen rooms = seventy-eight rooms expand from thirteen lines of band declaration.**

```muro-part
band X X2..X8 Y2..Y2+9000
  space /L14..L19/r01 room w:6000 name:客室01 use:rentable daylight:0
  space /L14..L19/r02 room w:6000 name:客室02 use:rentable daylight:0
  space /L14..L19/r03 room w:6000 name:客室03 use:rentable daylight:0
  space /L14..L19/r08 room w:rest name:客室08 use:rentable daylight:0
```

`daylight:0` is the designer's judgement that the 1/7 rule does not apply to this room. It is not a statement about window size — a room of identical dimensions is in scope as a habitable room in an apartment building and out of scope as a hotel guest room. **The writer makes the judgement and the tool obeys it.**

![complex L14](../../img/complex-L14.svg)

## Questions worth putting to it

### How many risers fit in the same stair enclosure

A different floor-to-floor height means a different number. Neither riser count nor tread appears in the source.

```sh
npx tsx src/cli.ts runs examples/complex/main.muro
```

```text
B2→B1	lift	EVバンク1	/B2/ev1
B2→B1	lift	EVバンク2	/B2/ev2
B2→B1	ramp	車路	rise 4200mm	return	slope 1/9.2	going 38800mm	/B2/ramp
B2→B1	stair	階段1	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/B2/st1
B2→B1	stair	階段2	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/B2/st2
B1→L1	lift	EVバンク1	/B1/ev1
B1→L1	lift	EVバンク2	/B1/ev2
B1→L1	ramp	車路	rise 5100mm	return	slope 1/7.6	going 38800mm	/B1/ramp
B1→L1	stair	階段1	rise 5100mm	return	29 risers of 176mm, tread 300mm	going 8400mm	/B1/st1
B1→L1	stair	階段2	rise 5100mm	return	29 risers of 176mm, tread 300mm	going 8400mm	/B1/st2
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
L1→L2	lift	EVバンク1	/L1/ev1
L1→L2	lift	EVバンク2	/L1/ev2
L1→L2	stair	階段1	rise 6600mm	return	37 risers of 178mm, tread 300mm	going 10800mm	/L1/st1
L1→L2	stair	階段2	rise 6600mm	return	37 risers of 178mm, tread 300mm	going 10800mm	/L1/st2
```

(The first 15 of 90 lines.)

**The same stair enclosure takes 24 risers in the basement and 37 at the entrance level.** The rectangle of `/B2..L19/st1` is written once; all that changed is the z of the levels. Treads settle at 300 mm, and the remainder becomes landing.

### How is the site read

A ten-vertex corner site with roads to the south and east.

```sh
npx tsx src/cli.ts site examples/complex/main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 10 vertices (a polygon declaration — given geometry)
  Site area (derived): 3854.00 m2
  Road: /road-s (南側道路) width 22000mm / frontage 56000mm
  Road: /road-e (東側道路) width 16000mm / frontage 40000mm
  Building footprint (horizontal projection, rough): 2204.00 m2 → building coverage ratio 57.2%
  Total floor area: 31606.24 m2 → floor area ratio 820.1%
```

No site area is declared (`area:`), so only `derived` appears. Declare it and the two are reconciled.

### How does floor area split by use

```sh
npx tsx src/cli.ts stats examples/complex/main.muro
```

```text
Total 31606.24 m2 (indoor floor area)
  ...
  parking: 2049.60 m2
  machine: 1612.80 m2
  backyard: 2615.20 m2
  escalator: 153.60 m2
  shop: 4680.00 m2
  office: 7526.40 m2
  room: 4204.80 m2
By use: common 12809.44 m2 (40.5%) / parking 2385.60 m2 (7.5%) / rentable 16411.20 m2 (51.9%)
```

(The last eight lines.)

A rentable ratio of 51.9% is what you get from carrying the core, the plant level and the back of house honestly.

## Was scale the wall

**The wall was not scale. It was four design decisions.**

- **Vertical circulation** — a stair, a ramp, an escalator and a lift are one relation; the device is only a difference in the rules that generate form.
- **Diagonals** — space is the noun, a line is the verb, and a boundary is where they meet. Read the line and you see the diagonal; no vertex coordinate appears.
- **Underground** — a declaration (`underground:1`), never an inference. Earth-retaining walls are carried by the `spec` vocabulary, so neither boundary kinds nor attributes had to grow.
- **Columns** — an element with no written position, emerging from grid intersections crossed with floors.

What actually broke on scaling up: a stair with no landing to arrive on (a door hit the treads directly), an escalator that stood up as a single 3.2 m-wide unit, a door overlapping a column, and the inertia of "we made it diagonal once, so the void above is diagonal too". Each was found by a person looking at the derived drawing, and each was fixed in the rules. Doors overlapping columns are now caught by [`validate`](../reference/cli/validate.md) as `column.blocksdoor`.

## Read next

- One more order of magnitude — [twin](twin.md)
- The same scale measured against IFC — [koyu measured against IFC](vs-ifc.md)
