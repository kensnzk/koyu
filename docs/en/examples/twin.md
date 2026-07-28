---
title: twin — a twin-tower redevelopment
mode: explanation
---

# twin — a twin-tower redevelopment

`examples/twin/`. 1,220 lines / 11 files / 1,808 spaces / 5,973 boundaries / 141,448.56 m² of interior floor area / 6,534.08 m² semi-outdoor. Two basement levels and thirty-four above; thirty-nine levels declared. **One building that splits into two towers while sharing its levels** — the largest example in this notation.

![twin L1](../../img/twin-L1.svg)

The composition:

| Band | Floors | Content |
|---|---|---|
| Podium | L1–L4 | Retail and food, stepping back as it rises; the setback roofs become planted terraces |
| L5 | L5 | Hotel entrance, banqueting, roof garden on the podium |
| Tower A | L6–L34 | Offices. A 67.2 m × 33.6 m plate with a 12.6 m central core band |
| Tower B | L6–L18 | Hotel below (L6–L12), residences above (L13–L18). A 42.0 m × 25.2 m plate |
| Plant | M1 / M2 | **Absent from the floor numbers the public sees.** Above the banqueting hall, and at mid-height |
| Basement | B1–B2 | Parking, heat source, substation, control room, MDF, waste |

98 hotel rooms and 36 residential units — both real counts, obtained from the band expansion.

## What it shows first

- **Two towers on one level.** `level L6..L20 …` is declared once, and the offices of tower A and the hotel of tower B sit on the same levels as different plates. **There is no "tower" element** — only the path prefixes (`/L8/aoff1` versus `/L8/hs01`) and the fact that the plates are apart in plan say so.
- **Floors absent from the public numbering.** `level M1` and `level M2` are inserted between L5 and L6, and between L20 and L21. A level that appears on no lift button nonetheless exists in the height stack-up.
- **Lift zoning written as the presence or absence of a lobby.** The guest shafts of tower B (`bev1..3`) run B1..L18, but the lift lobbies (`bhall1` / `bhall2`) exist only on B1..L1 and L5..L18. **Passing through the three podium levels is expressed as the absence of a lobby space.**
- **The same plate, core and floor-to-floor with only the use changing.** L6–L12 of tower B is hotel, L13–L18 residential. What changes is the division and the `daylight:` declaration.
- **A fourteen-vertex site** with frontage on three roads.

## Excerpts

The level declarations in the base layer. Plant levels are wedged outside the public numbering.

```muro-part
level L5 21300 h:5500 slab:900
level M1 28200 h:3200 slab:900
level L6..L20 32800 h:2800 slab:1400 pitch:4200
level M2 95800 h:2800 slab:1400
level L21..L34 100000 h:2800 slab:1400 pitch:4200
level R1 158800 h:3000 slab:900
```

The topology of vertical circulation. Twenty-nine lines raise every shaft in both towers.

```muro-part
stack aevLs1 B1..L20 type:shaft
stack aevHs1 L1..L34 type:shaft
stack ast1 B2..L34 type:stair
stack bev1 B1..L18 type:shaft
stack bst1 B2..L18 type:stair
stack ramp B2..L1 type:stair
```

The low-rise bank of tower A (`aevL…`) runs B1..L20 and the high-rise bank (`aevH…`) runs L1..L34, **passing through the podium and the low-rise band**. Passing is written as "the shaft is there but no lift lobby is" — not as an operating plan for the equipment, but as the presence or absence of a space.

The hotel floors and the residential floors of tower B carry different judgements in the same shape of band.

```muro-part
band X X14..X19 Y6..Y7
  space /L6..L12/hs01 room w:4200 name:客室S01 use:rentable daylight:0
  space /L6..L12/hs02 room w:4200 name:客室S02 use:rentable daylight:0
```

```muro-part
band X X14..X19 Y6..Y7
  space /L13..L18/rs01 unit w:8400 name:住戸S01 use:exclusive daylight:1
  space /L13..L18/rs02 unit w:8400 name:住戸S02 use:exclusive daylight:1
```

The same five-bay band: ten hotel rooms above, five dwellings below. **The `daylight:` values are opposite because whether a room is in scope for daylight changes with its use.**

The typical office floor of tower A is written twice — the low band and the high band are separated by M2.

```muro-part
space /L6..L20/aoff1 room X3..X11 Y6..Y7 name:貸室南 use:rentable
space /L21..L34/aoff1 room X3..X11 Y6..Y7 name:貸室南 use:rentable
```

![twin L8](../../img/twin-L8.svg)

## Questions worth putting to it

### From a thirtieth-floor office to the south road

```sh
npx tsx src/cli.ts doors examples/twin/main.muro /L30/aoff1 /road-s
```

```text
5 doors — /L30/aoff1 → /L30/aoffW → /L30/ahall → /L30/ast1 → /L29/ast1 → /L28/ast1 → /L27/ast1 → /L26/ast1 → /L25/ast1 → /L24/ast1 → /L23/ast1 → /L22/ast1 → /L21/ast1 → /M2/ast1 → /L20/ast1 → /L19/ast1 → /L18/ast1 → /L17/ast1 → /L16/ast1 → /L15/ast1 → /L14/ast1 → /L13/ast1 → /L12/ast1 → /L11/ast1 → /L10/ast1 → /L9/ast1 → /L8/ast1 → /L7/ast1 → /L6/ast1 → /M1/ast1 → /L5/ast1 → /L4/ast1 → /L3/ast1 → /L2/ast1 → /L1/ast1 → /L1/ahall → /L1/alobby → /site/plazaW → /road-s
```

**`/M2/ast1` and `/M1/ast1` appear on the route.** The plant levels are absent from the public floor numbers, but the escape stair naturally passes through them. Nothing is derived that was not written — the stairs on the plant levels were written, so they show up on the route.

### How much of the floor area earns

```sh
npx tsx src/cli.ts stats examples/twin/main.muro
```

```text
Total 141448.56 m2 (indoor floor area)
Semi-outdoor 6534.08 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By use: common 60487.47 m2 (42.8%) / parking 14868.00 m2 (10.5%) / rentable 63462.21 m2 (44.9%) / exclusive 2630.88 m2 (1.9%)
```

(The last three lines.)

`rentable` 44.9% plus `exclusive` 1.9% gives 46.7% earning floor area. **A very large mixed-use building has its floor eaten by cores, plant levels, halls and planted terraces.** That figure is not declared; it falls out of the `use:` aggregation. Draw a thinner core and it rises — and then the lavatories and the risers no longer fit.

### How is the site read

```sh
npx tsx src/cli.ts site examples/twin/main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 14 vertices (a polygon declaration — given geometry)
  Site area: declared 23167.40 m2 / derived 23167.40 m2
  Road: /road-s (南側道路) width 25000mm / frontage 168000mm
  Road: /road-e (東側道路) width 18000mm / frontage 151200mm
  Road: /road-n (北側道路) width 16000mm / frontage 168000mm
  Building footprint (horizontal projection, rough): 9596.16 m2 → building coverage ratio 41.4%
  Total floor area: 141448.56 m2 → floor area ratio 610.5%
```

Frontage on three roads, and the declared survey figure of 23,167.40 m² matches the shoelace area of the fourteen vertices.

### Does it pass the architectural verdicts

```sh
npx tsx src/cli.ts validate examples/twin/main.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

Fifteen rules — unreachability, gaps in the envelope, columns fouling doors, ramp slope, road frontage among them — ran across all 1,808 spaces and 5,973 boundaries. **It still does not say the building works.** [`validate`](../reference/cli/validate.md) delivers judgements, not guarantees.

## What the order of magnitude means

The eleven source files total 26,630 tokens (o200k_base). **A single building of 141,449 m² and thirty-four storeys fits whole into any model's context** — and rewriting one floor touches exactly one layer.

The expanded [canonical JSON](../reference/json/index.md) is 450,040 tokens. **There is a seventeen-fold gap between the source and the machine format, and that gap is what "folding the repetition" actually is.**

IFC4 and IFCX measured on the same scale are in [koyu measured against IFC](vs-ifc.md).

## Read next

- One order of magnitude down — [complex](complex.md)
- Find the example that has the feature you need — [Look it up by what you want to write](by-pattern.md)
