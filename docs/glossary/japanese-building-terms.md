---
title: Japanese building and regulatory terms
mode: reference
---

# Japanese building and regulatory terms

The output of koyu and the bundled examples use **terms from Japanese architectural practice and the Building Standards Act**. This page is for looking them up. The words of koyu itself are in the [glossary](../glossary.md).

**What is written here is not an explanation of the regulation but of how koyu treats the term.** Which areas count, which are exempt, and where relaxations apply differ by jurisdiction, and koyu does not go there.

## Area and ratios

| Term | Definition | How koyu treats it |
|---|---|---|
| 延床面積 gross floor area | The sum of the floor areas of every storey | The `Total` from `stats` and `Total floor area` from `site`. Derived as the wall-centerline area of spaces that have a region and a level and are neither `void`, `exterior`, nor semi-outdoor |
| 建築面積 building footprint area | The horizontal projected area of the building seen from directly above | `Building footprint` from `site`, derived as the union of the horizontal projections of the interior spaces. Canopies and balconies are handled roughly |
| 敷地面積 site area | The horizontal projected area of the site | `Site area` from `site`. Derived by the shoelace formula if a `polygon` exists, otherwise as the union of the spaces within the site and the building projection. Write a survey figure in `zone /site … area:` and the two are reconciled |
| 建蔽率 building coverage ratio | Building footprint ÷ site area. A term of Article 53 of the Japanese Building Standards Act | `site` derives it as `building coverage ratio`. It is never checked against a permitted limit |
| 容積率 floor area ratio (FAR) | Gross floor area ÷ site area. A term of Article 52 | `site` derives it as `floor area ratio`. Neither the restriction by front-road width nor the exemptions (parking, common corridors) are applied |
| 専有面積 net (exclusive) floor area | The part a unit owner uses alone | The aggregation of `use:exclusive`. Bundle it in a zone and a dwelling divided into rooms counts as one dwelling alongside one that is not |
| 共用部 common area | Corridors, stairs, lift lobbies — what everyone uses | The aggregation of `use:common` |
| レンタブル比 rentable ratio | Lettable area as a share of gross floor area | The percentage for `use:rentable` in the `By use:` line of `stats` |
| 壁芯 wall centerline | The middle of the wall thickness. Japanese area measurement is based on it | Areas and wall segments are all centerline-based. The thickness `t` is split evenly to either side |

## Height and section

| Term | Definition | How koyu treats it |
|---|---|---|
| FL floor level | The finished floor height of a storey | The second positional of `level L2 4000` |
| 階高 floor-to-floor height | From the FL of one storey to the FL of the one above | Never declared. Derived as the difference in z between levels, and printed by `levels` as `storey height` |
| 天井高 ceiling height | From finished floor to finished ceiling | `h:` on a `level`. It can be overridden per space |
| 床組み厚 slab thickness | The floor structure with its finishes and plenum | `slab:` on a `level`. `check` verifies that it plus the ceiling height fits inside the floor-to-floor height |
| 懐 plenum | The space above the ceiling | Never written. Floor-to-floor minus ceiling height minus the slab above appears in `levels` as `left over` |
| 矩計 section stack-up | The drawing that cuts the building vertically and traces the heights of each part | The textual section that `levels` prints |
| 基準階 typical floor | A storey whose plan repeats | Begin the path `/L3..L10/` and write it once |
| 例外階 exception floor | A storey that differs from the typical floor | Write only the difference, in a separate layer |
| 地下階 basement storey | A storey below ground level | `level B1 -3700 … underground:1`. **Never inferred from a negative z** — it is a declaration |

## Site and landscape

| Term | Definition | How koyu treats it |
|---|---|---|
| 接道 road frontage | The length over which a site adjoins a road. Article 43 requires at least 2 m | Derived as the sum of boundary segment lengths between spaces under the site zone and exterior spaces carrying `road:<width>`. **An external wall of the building facing the road is not frontage** |
| 前面道路 front road | The road the site adjoins | `space /road-s exterior road:22000`. The width is written in millimetres |
| 隣地境界 neighbouring boundary | The line between this site and the next | An edge of the `polygon`, or a boundary between a space within the site and an exterior such as `/out/n` |
| 隅切り corner cut | Cutting the corner off a site at an intersection | Write a `line` indented under the boundary |
| 歩道状空地 pedestrian setback | Part of the site used as though it were a pavement | Placed as a real `exterior` space on L1 |
| 塀・フェンス wall, fence | A structure enclosing the site | A value in the boundary's `spec` vocabulary. Add `air:1`, since it blocks neither air nor light |

## Rooms and use

| Term | Definition | How koyu treats it |
|---|---|---|
| 居室 habitable room | A room used continuously for living, working or leisure. A term of Article 2(4) | **Never inferred from the type.** Whether it is in scope for daylight is written as `daylight:1` or `daylight:0`, because a change of use changes the judgement for a room of identical dimensions |
| 採光 daylighting | The effective opening area a habitable room requires. Article 28 asks for at least 1/7 of the floor area (Order Article 19 lists what is in scope) | `light` roughly checks that effective window area ≥ floor area / 7. No correction factors are used |
| 半屋外 semi-outdoor | A part open to the air but roofed or enclosed (a balcony, an external stair, a terrace) | **Derived, not declared.** A space with a region carrying an `open` or `air:1` boundary with the outside becomes one, drops out of the interior floor area, and is reported separately |
| 戸境壁 party wall | The wall between two dwellings | Written with the boundary's `spec` and `sound:` (acoustic grade) |
| 内廊下 interior corridor | A common corridor running inside the building | A `corridor`-typed space. It does not become semi-outdoor unless it faces the outside |
| 防火区画 fire compartment | A range subdivided to contain a fire | Carried by `fire:` (a fire rating) on the boundary and by the door assets (`fire:特定防火設備` and the like). Whether a compartment is properly formed is not judged |
| バックヤード back of house | The operational part the public does not see | A `backyard`-typed space. Whether a common corridor can reach vertical circulation without passing through one is what `validate` looks at |

## Vertical circulation

| Term | Definition | How koyu treats it |
|---|---|---|
| 蹴上 riser | The height of one step | Never written. Derived from the level difference and the usual range; `runs` prints `risers of 176mm` |
| 踏面 tread | The depth of one step | Never written. Derived |
| 踊り場 landing | The flat part along a stair | Never written. It appears on the form side as the remainder of the step division |
| 折返し階段 return stair | A stair that turns through 180° | `form:return` on the space |
| 直進階段 straight stair | A stair rising in one direction | Write no `form:` (the default) |
| 斜路 ramp | A sloped route, such as for vehicles | `ramp:E form:return slope:6` on the space. `slope:` **declares a limit**; the actual slope comes from the level difference over the derived going |
| エスカレーター escalator | A moving stair | `escalator:N` on the space. The connecting boundary is `type:stair` (passable) |
| 昇降機 lift | An elevator | `lift:1` on the space. The connecting boundary is `type:shaft` (not passable) — nobody walks a shaft, so as circulation it is a different question |
| コア core | The zone gathering stairs, lifts, lavatories and risers | A run of spaces. Begin the path `/B2..L19/` and every storey of it is written once |
| PS / EPS pipe and electrical risers | Vertical service shafts | `shaft`-typed spaces |

## Doors and openings

| Term | Definition | How koyu treats it |
|---|---|---|
| 建具 door or window as a product | The opening parts | The opening (`door` / `window`) and the `asset` holding its type |
| 掃き出し窓 full-height window | A window reaching the floor | `window w:2600 h:2200 sill:0`. If it is walked through as well, write a separate `door` |
| 腰窓 sill window | A window starting at waist height | `window … sill:900` |
| 開き勝手 hand of a door | The hinge side and the direction of swing | `hinge:` and `swing:` |
| 引き戸 sliding door | A door that slides sideways | `style:sliding` |
| 自動ドア automatic door | A door that opens by itself | `style:auto` |
| 防火戸 fire door | A door that closes to contain a fire | Written as `fire:` on the asset, and carried |

## Reading the numbers

Take the output of `site`.

```text
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42.0%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

- `declared` is the survey figure the writer put in `area:`; `derived` is what came out of the composition. If they disagree, the finding `koyu.schematic.site.area` says so.
- `width` is the width written in `road:`; `frontage` is the derived length of adjacency.
- The word `rough` is a disclaimer: the treatment of canopies and balconies does not reach the resolution of practice.

**All of this is judgement, not guarantee.** koyu checks nothing against a permitted limit and applies no relaxation.

## Beyond this page

- The words of koyu — [glossary](../glossary.md)
- The list of validation rules — [validation](../reference/validate/index.md)
- The site question in detail — [koyu site](../reference/cli/site.md)
