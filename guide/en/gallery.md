**English** · [日本語](../gallery.md)

# The gallery

The way in for people who start from pictures. In a notation where being able to read the generated drawing means you can write it, a gallery is not an appendix.

The five bundled examples are in order of difficulty, and each broadly builds on the one before. Each section gives what that example is the **first** to demonstrate, a representative excerpt, and the questions worth asking with the answers they actually return. **Every drawing, figure, and output was generated from the files in this repository** — nothing was retouched by hand when pasting.

| Example | Size | First to demonstrate |
|---|---|---|
| [two-rooms](#examplestwo-roomsmuro) | 22 lines / 3 spaces / 3 boundaries / 32.40 m² | Space, boundary, door, the outside. The smallest unit of the notation |
| [office](#examplesofficemuro) | 110 / 17 / 43 / 419.84 m² | Several levels, a void, vertical boundaries, uncounted subdivisions, open boundaries |
| [house](#exampleshousemuro-and-exampleshouse) | 89 (single) / 102 in 5 files (composed) / 13 / 31 / 92.75 m² | The site and its exterior works, semi-outdoor, an L-shaped union, assets, layer composition |
| [mansion](#examplesmansionmuro) | 187 / 122 / 332 / 2366.40 m² | Span expansion of a typical floor, stack, mixed granularity |
| [tower](#examplestower) | 438 in 9 files / 178 / 542 / 4785.92 m² | The site shape as a polygon, an exception floor as a diff layer, several roads |

`npm run check:examples` confirms the consistency of every example at once.

## examples/two-rooms.muro

![two-rooms L1](../../docs/img/two-rooms.svg)

22 lines / 3 spaces / 3 boundaries / 32.40 m². Two rooms side by side, one door between them and one door out. The smallest units of the notation all appear once here.

**What it is first to demonstrate**

- `space` — that the path is identity, and the type is the second positional.
- `boundary` — that a wall is a **relation** joining two spaces. The wall centerline segment is not written; it is derived from the two rooms' rectangles.
- The indented `door` — a door belongs to a wall (a boundary), not to a space.
- `/out` — the outside is a space too. Because it has no region, the envelope boundaries are **written explicitly**.
- `edge:S` — an opening onto the outside must select an edge, because `/L1/b`'s perimeter splits into three.

**Excerpt** — the second half of the file is itself a demonstration of "a wall is a relation".

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000

boundary /L1/a /out t:150 spec:EW1 fire:60
boundary /L1/b /out t:150 spec:EW1 fire:60
  door w:900 h:2100 edge:S name:玄関
```

**Questions to ask**

How many doors to get outside. Room A has no door to the outside, so the answer goes by way of room B.

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2枚 — /L1/a → /L1/b → /out
```

("2 doors.")

Look at the adjacencies as a whole. The distinction between `壁` (wall) and `扉1` (1 door) is exactly the weight of an edge in the graph.

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 扉1 → /L1/b  (spec:PW1)
  | 壁 → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 扉1 → /L1/a  (spec:PW1)
  — 扉1 → /out  (spec:EW1 fire:60)
/out (外部)
  | 壁 → /L1/a  (spec:EW1 fire:60)
  — 扉1 → /L1/b  (spec:EW1 fire:60)
```

What the same scene looks like written in IFC4 / IFCX is at the end of this page, [examples/comparison/](#examplescomparison).

## examples/office.muro

![office L1](../../docs/img/office-L1.svg)

![office L2](../../docs/img/office-L2.svg)

110 lines / 17 spaces / 43 boundaries / 419.84 m². A small office of two floors plus a roof level. It is written at schematic-design resolution and expresses neither downstand walls nor door detail — a chosen level of abstraction, not an omission.

**What it is first to demonstrate**

- **Several levels** — `level L1`, `level L2`, and a `level R` holding no space. The roof level is declared solely to give L2's height check an upper bound.
- **A void** — `space /L2/void void …` plus the vertical `boundary /L1/hall /L2/void type:void`. Even the absence of a floor is written as a boundary.
- **Vertical boundaries** — `type:stair` (passable) and `type:shaft` (continuous but impassable). Floors are not written; only the exceptions are.
- **`type:open`** — a boundary with nothing there. Always passable.
- **`air:1`** — something is there but it does not block outside air or light (the low wall and railing facing the void).
- **Uncounted subdivisions** — the indented `area` (a change of floor finish) and `seg` (a change of wall finish). Neither appears in area, room counts, or the graph.
- **A per-space ceiling height** — `h:6700` makes the hall alone two storeys tall. `levels` reports it separately as an individual ceiling height.
- **Ratio positions for openings** — `at:0.8`, `at:0.25`. A ratio 0..1, clamped within the segment.

**Excerpt** — the vertical direction is written in these three lines only. Every other floor is a default.

```muro-part
# ---- 垂直: 床は書かない (levelのslabが既定)。例外 — 繋がる場所と抜ける場所 — だけ書く ----
boundary /L1/stair /L2/stair type:stair
boundary /L1/ev /L2/ev type:shaft
boundary /L1/hall /L2/void type:void   # エントランスは2層吹抜け — 床の不在も境界で書く
```

An uncounted subdivision changes only the material, without splitting the room.

```muro-part
space /L1/hall     hall     X1..X2 Y1..Y2       name:エントランスホール use:common floor:フローリング h:6700   # 吹抜けで2層分
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル   # 数えない分節: 室は割れない。面積はホールのまま
space /L1/office   office   X2..X4 Y1..Y2       name:事務室 use:rentable
boundary /L1/office /L1/corridor t:120 spec:LGS
  door w:900
  seg at:0.75 w:3600 spec:ガラスパーティション   # 数えない分節: 同じ境界のまま壁材だけ変わる
```

**Questions to ask**

From the first-floor office to the outside. The lift is a shaft (impassable), so the route goes through the stair.

```sh
npx tsx src/cli.ts doors examples/office.muro /L2/office /out
```

```text
4枚 — /L2/office → /L2/corridor → /L2/stair → /L1/stair → /L1/corridor → /L1/hall → /out
```

Look at how the heights stack up. The hall's `h:6700` appears at the end as an individual ceiling height.

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ 階高 4000 = 天井2700 + slab1300
L1	z:0	h:2700
  ↑ 階高 4000 = 天井2700 + slab1300
個別天井高: /L1/hall h:6700
```

(`個別天井高` is "individual ceiling height".)

In the areas you can read that a void is not counted into floor area.

```sh
npx tsx src/cli.ts stats examples/office.muro
```

```text
L2
  /L2/void	エントランス吹抜け	吹抜け (床面積不算入)
  /L2/office	執務室	office	102.40㎡
  …
合計 419.84㎡ (屋内床面積)
use別: common 235.52㎡ (56.1%) / rentable 184.32㎡ (43.9%)
```

(`吹抜け (床面積不算入)` is "void (not counted in floor area)".)

## examples/house.muro and examples/house/

![house L1](../../docs/img/house-L1.svg)

![house L2](../../docs/img/house-L2.svg)

An 89-line single file, and a composed version of 102 lines in 5 files. **The same building written two ways** (both 13 spaces / 31 boundaries / 92.75 m²).

**What it is first to demonstrate**

- **The `level:` attribute** — because the paths are `/home/…`, the level cannot be read from the first segment. The storey is stated as an attribute. A consequence of the path being first of all an aggregation hierarchy rather than a storey.
- **`zone`** — `/home` (the dwelling) and `/site`. No geometry; they bundle by path prefix.
- **The site** — `zone /site … site:1 area:126.24` and `space /out/road exterior … road:6000`. `/out` splits into several exteriors by direction and character.
- **Exterior spaces at ground level** — the garden and paths tile around the building as real spaces on L1. The L1 plan doubles as the site plan.
- **Semi-outdoor by derivation** — the garden becomes semi-outdoor without being declared so, because it carries an `air:1` boundary (a block wall) with the outside.
- **An L-shaped union** — `X1..X2 Y1..Y3 + X2..X3 Y1..Y2`.
- **`hinge:` / `swing:`** — the swing of a door.
- **A partial void** — `boundary /home/ldk /home/void type:void`. Because coverage is under 99%, the LDK's ceiling height stays within its own storey.

What the composed version (`examples/house/`) additionally demonstrates:

- **`import`** — `main.muro` as the base layer declares `koyu`/`name`/`unit`/`grid`/`level` once and stacks `assets` / `site` / `L1` / `L2`. The boundaries that span levels (the stair, the void) are held by the base layer.
- **`asset`** — opening types declared in one place and referenced by name from the openings. The instance's attributes override.
- **Explicit positions against the grid** — `at:X2`, `at:Y2+1820`. Unlike a ratio these are not clamped, and overrunning is an error.

**Excerpt** — the wall is `spec` vocabulary on a boundary, and the gate is a door on that boundary. The turn by which a thing (a wall, a fence) becomes an attribute of a relation rather than an element shows up right here.

```muro-part
# ---- 敷地境界: 塀は境界のspec語彙 (外気は遮らない air:1)。門扉はアセット参照+明示位置 ----
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀+フェンス air:1 h:1200
  door GT1 at:X2 name:門扉   # 位置は通り芯基準の明示 — はみ出せばエラーになる
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
```

The base layer of the composed version. This is what holds the consistency, and the layers add to it.

```muro-part
grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R 5800 slab:500

import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

**Questions to ask**

The site's figures come from the composition rather than from a declaration. `area:126.24` is the declared surveyed value, reconciled against the derived one.

```sh
npx tsx src/cli.ts site examples/house.muro
```

```text
敷地 /site (敷地)
  敷地面積: 宣言 126.24㎡ / 導出 126.24㎡ ✔ 一致
  接道: /out/road (南側道路) 幅員6000mm ・ 接道長 10280mm ✔ 2m以上
  建築面積 (水平投影・粗): 53.00㎡ → 建蔽率 42.0%
  延べ面積: 92.75㎡ → 容積率 73.5%
```

Daylight. The LDK's window area of 7.54 m² is the sum of the full-height window (2.6×2.2 = 5.72 m²) and the sill window (1.65×1.1 = 1.815 m²) — the garden is open above, so the coefficient is 1.0.

```sh
npx tsx src/cli.ts light examples/house.muro
```

```text
✔ /home/ldk	LDK	窓 7.54㎡ / 床 39.75㎡ = 1/5.3 (必要 1/7 ≈ 5.68㎡)
✔ /home/bed1	主寝室	窓 5.72㎡ / 床 26.50㎡ = 1/4.6 (必要 1/7 ≈ 3.79㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

**How do the two ways of writing differ?** The output of `stats`, `light`, and `site` is identical. What differs is only how the openings are written, and `diff` says so in the language of composition.

```sh
npx tsx src/cli.ts diff examples/house.muro examples/house/main.muro
```

```text
+ asset D1
+ asset GT1
+ asset SD1
+ asset W1
+ asset W2
+ asset W3
± 境界 /home/bed1 | /home/hall2: + door at:0.5 ref SD1 / + door at:0.5 h 2000 / + door at:0.5 name 寝室引き戸 / + door at:0.5 style sliding
…
± 境界 /home/hall1 | /site/east: + door at:Y2+1820 D1 w:900 h:2100 style:hinged name:玄関 / − door at:0.5 (w:900 name:玄関)
± 境界 /home/ldk | /site/garden: + window at:X2 W1 w:2600 h:2200 sill:0 name:掃き出し窓 / − window at:0.5 (w:2600 h:2200 sill:0 name:掃き出し窓)
…
```

(The output is 14 lines in all; five boundary lines are elided. `境界` is "boundary".)

What appears in the diff is that assets were added and that the doors' positions moved from ratios to grid references — not the order of the lines or their formatting. **That the file was split up is not itself a difference.**

## examples/mansion.muro

![mansion L1](../../docs/img/mansion-L1.svg)

![mansion L5](../../docs/img/mansion-L5.svg)

![mansion L10](../../docs/img/mansion-L10.svg)

187 lines / 122 spaces / 332 boundaries / 2366.40 m². A ten-storey, 43-unit apartment building with an interior corridor. **122 spaces fit in 187 lines** because the typical floor is written only once.

**What it is first to demonstrate**

- **A range declaration for levels** — `level L3..L9 6700 pitch:2900 h:2400 slab:500`. Seven levels in arithmetic progression, in one line.
- **Span expansion of paths** — when the first segment is `L2..L9`, it expands across the declared levels in z order. `space`, `zone`, and `boundary` all expand, and **the indented doors ride on every expansion**.
- **`stack`** — `stack ev L1..L10 type:shaft` draws vertical boundaries across every consecutive level pair. Nine lift boundaries and nine stair boundaries in two lines.
- **Mixed granularity** — only type A is subdivided into rooms; B through E stay whole dwellings. Because `zone /L2..L9/A` keeps the language of net area, subdivided and unsubdivided dwellings are counted on the same footing.
- **Daylight across a balcony** — the coefficient is 0.7 if there is a space above the balcony and 1.0 if not. The full-height window (2.6×2.2 = 5.72 m²) counts as `窓 4.00㎡` on floors 2 through 8, and as `窓 5.72㎡` only on the ninth, where nothing sits above. **One line yields a different answer per storey.**
- **An exterior stair** — a `spec:手すり air:1` boundary alone makes it semi-outdoor, moving the stair out of interior floor area and into the separate report.

**Excerpt** — the description of eight typical floors begins here. `/L2..L9/` expands eight times.

```muro-part
# ============ 基準階 (2〜9F) — 一度だけ書く ============
zone /L2..L9/A name:Aタイプ use:exclusive
space /L2..L9/A/ldk     ldk     X1+2600..X2 Y1..Y2-1800 + X1..X1+2600 Y1..Y1+1400 name:LDK
space /L2..L9/A/bedroom bedroom X1..X1+2600 Y1+1400..Y2-1800 name:洋室
space /L2..L9/A/balcony balcony X1..X2 Y1-1400..Y1 name:バルコニー   # 半屋外 — 専有面積に数えない
space /L2..L9/B unit X2..X3 Y1..Y2               name:Bタイプ use:exclusive
```

The vertical direction is these last two lines only.

```muro-part
# ============ 垂直 — 積層するものだけ書く。床は既定 (levelのslab) ============
stack ev L1..L10 type:shaft        # EVシャフト: 連続するが人は通れない
stack stair L1..L10 type:stair     # 屋外階段: 扉0枚で階をまたぐ
```

**Questions to ask**

From a fifth-floor LDK to the outside. The exterior stair is `type:stair` and therefore passable, and since it carries no doors, descending ten storeys adds none.

```sh
npx tsx src/cli.ts doors examples/mansion.muro /L5/A/ldk /out
```

```text
3枚 — /L5/A/ldk → /L5/A/hall → /L5/corridor → /L5/stair → /L4/stair → /L3/stair → /L2/stair → /L1/stair → /out
```

Daylight. The typical floor's windows are written once, but the verdict comes out for all 51 rooms after expansion. The eighth and ninth floors' LDKs give different answers because nothing sits above the ninth floor's balcony.

```sh
npx tsx src/cli.ts light examples/mansion.muro
```

```text
✔ /L2/A/ldk	LDK	窓 4.00㎡ / 床 17.08㎡ = 1/4.3 (必要 1/7 ≈ 2.44㎡)
…
✔ /L8/A/ldk	LDK	窓 4.00㎡ / 床 17.08㎡ = 1/4.3 (必要 1/7 ≈ 2.44㎡)
✔ /L9/A/ldk	LDK	窓 5.72㎡ / 床 17.08㎡ = 1/3.0 (必要 1/7 ≈ 2.44㎡)
…
✔ 全51室が 1/7 を満たします (補正係数なしの粗い判定)
```

The by-zone aggregation counts a subdivided dwelling as one unit.

```sh
npx tsx src/cli.ts stats examples/mansion.muro
```

```text
合計 2366.40㎡ (屋内床面積)
半屋外 162.16㎡ (バルコニー・屋外階段等 — 算入条件は法規細部のため別掲)
ゾーン別 (数える集約):
  /L2/A	Aタイプ	34.80㎡
  /L3/A	Aタイプ	34.80㎡
  …
use別: common 662.40㎡ (28.0%) / exclusive 1704.00㎡ (72.0%)
```

## examples/tower/

![tower L1](../img/tower-L1.svg)

438 lines in 9 files / 178 spaces / 542 boundaries / 4785.92 m². An eleven-storey mixed-use building (retail below, housing above) on a corner site of irregular shape. It is the showcase for this notation, and an example of layers written by divided work being built as one building.

The composition is `main.muro` as the base layer plus eight layers: `assets`, `site-geometry`, `site`, `L1`, `L2`, `typical`, `L3`, `L11`.

**What it is first to demonstrate**

- **`polygon` — the site shape.** The one written shape in this notation that does not sit on the grid. It is admitted as an exception because a site is surveyed input rather than designed form. The standard practice is a quarantined layer (`site-geometry.muro` is effectively one line).
- **Writing an exception floor as a diff layer.** `typical.muro` supplies the dwellings on L3..L10 and the core on L3..L11, and `L3.muro` writes **only the difference** — "instead of the balcony to the south there is a terrace on the low-rise roof" — in 28 lines.
- **A different span per element.** Dwellings are `/L3..L10/`, the core `/L3..L11/`, the balconies `/L4..L10/`. They are used side by side within one file.
- **Frontage on several roads** — a corner site with 12 m to the south and 6 m to the east. Frontage length is derived as the sum of boundary segment lengths.
- **Deriving "what is above".** There is nowhere to write a roof or an eave; it is read from the overlap of the spaces above. The L3 terrace (4600 mm deep) has its innermost 1500 mm under the L4 balcony, so it is judged covered and the daylight coefficient stays at 0.7. As a result the L3 and L5 LDKs both report a window area of 6.01 m².
- **`band` — dividing by dimension and order.** The two bedrooms of type A, and its wet area and entrance, are written as a run of widths `w:` rather than as regions. Both are closed bands using no `w:rest`, so the parser reconciles their sums against the band widths. A band is expanded and does not survive into the model, so it gives the same canonical JSON as the version written with positions ([ADR-0019](../../docs/decisions/0019-position-and-lines.md), [the cheat sheet, band](cheatsheet.md)).
- **`style:auto`** — an automatic door. It changes how the door is drawn in plan.

**Excerpt** — the site-shape layer. Excluding comments, the body is one line.

```muro-part
# 敷地形状 — 所与のジオメトリの隔離レイヤー (ADR-0011)
# 頂点はmm、グリッド原点と同じ座標系。南西から反時計回り。
# 北側隣地境界が斜め (2点で振れる) の五角形 — シューレースで 1,097.80㎡。

polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

The exception floor's diff layer (the head of `L3.muro`). It does not touch the typical floor's dwellings at all; it adds the terraces and re-hangs the windows.

```muro-part
space /L3/tA terrace X1..X3 Y1-4600..Y1 name:テラスA
space /L3/tB terrace X3..X4+3200 Y1-4600..Y1 name:テラスB
space /L3/tC terrace X4+3200..X6 Y1-4600..Y1 name:テラスC

boundary /L3/A/ldk /L3/tA t:100 spec:サッシ
  window W1 at:X2 name:掃き出し
  window W3 at:X2+4800
boundary /L3/tA /L3/tB t:60 spec:隔て板 air:1
boundary /L3/tA /out/road-s edge:S t:120 spec:パラペット+手すり air:1 h:1200
```

The consequence shows in the drawings. L3 and L5 have the same interior floor area of 422.40 m², yet their semi-outdoor space divides into 147.20 m² of terrace and 48.00 m² of balcony respectively.

![tower L3](../img/tower-L3.svg)

![tower L5](../img/tower-L5.svg)

The penthouse floor and the shared roof terrace at the top.

![tower L11](../img/tower-L11.svg)

**Questions to ask**

From a ninth-floor LDK to the road on the south. The route out of the tower, through the low-rise part, across the exterior works and onto the road connects as one line across the storeys.

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L9/A/ldk /out/road-s
```

```text
4枚 — /L9/A/ldk → /L9/A/hall → /L9/corridor → /L9/st2 → /L8/st2 → /L7/st2 → /L6/st2 → /L5/st2 → /L4/st2 → /L3/st2 → /L2/st2 → /L1/st2 → /site/west → /site/walk → /out/road-s
```

The site's figures. The declared surveyed value of 1,097.80 m² agrees with the polygon's shoelace area.

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
敷地 /site (敷地)
  敷地形状: 多角形 5頂点 (polygon宣言 — 所与のジオメトリ)
  敷地面積: 宣言 1097.80㎡ / 導出 1097.80㎡ ✔ 一致
  接道: /out/road-s (南側道路) 幅員12000mm ・ 接道長 40600mm ✔ 2m以上
  接道: /out/road-e (東側道路) 幅員6000mm ・ 接道長 20200mm ✔ 2m以上
  建築面積 (水平投影・粗): 569.60㎡ → 建蔽率 51.9%
  延べ面積: 4785.92㎡ → 容積率 436.0%
```

The daylight verdict for 66 rooms comes out at once from 432 lines of description.

```sh
npx tsx src/cli.ts light examples/tower/main.muro
```

```text
✔ /L3/A/ldk	LDK	窓 6.01㎡ / 床 33.28㎡ = 1/5.5 (必要 1/7 ≈ 4.75㎡)
…
✔ /L11/PA	ペントハウスA	窓 15.07㎡ / 床 89.60㎡ = 1/5.9 (必要 1/7 ≈ 12.80㎡)
✔ /L11/PB	ペントハウスB	窓 15.07㎡ / 床 89.60㎡ = 1/5.9 (必要 1/7 ≈ 12.80㎡)
✔ 全66室が 1/7 を満たします (補正係数なしの粗い判定)
```

## examples/comparison/

The same two rooms — the same scene as [two-rooms](#examplestwo-roomsmuro) — written also in IFC4 (SPF) and IFCX (IFC5 alpha) sits in `examples/comparison/`. The comparison is not about which format is better but about measuring **what happens when the subject of the description is swapped from the building-as-object to architecture-as-space**.

Measured in the unit an LLM reads and writes (o200k_base):

| Format | Subject | Tokens | vs the DSL |
|---|---|---:|---:|
| koyu DSL (the source) | Spaces and boundaries | 241 | 1.0x |
| koyu canonical JSON | The same | 541 | 2.2x |
| IFC4 (idealized minimum) | Components | 3,379 | 14.0x |
| IFCX (alpha) | Components plus embedded mesh | 6,030 | 25.0x |

57% of IFC4's tokens go to geometry and placement lines, and 26% of IFCX's to mesh coordinate arrays. Both spend a substantial amount on exactly the layer that "form is a generated artifact" banished from the source.

Measured on the same scale, [tower](#examplestower) comes to **432 lines and 8,099 tokens across nine source files** — an eleven-storey building of 4,786 m², 178 spaces, and 542 boundaries that fits in any LLM's context.

The breakdown, what actually happens in the IFC4 version, and how to reproduce it are held by [examples/comparison/README.md](../../examples/comparison/README.md) (in Japanese). The figures on this page are quoted from there.
