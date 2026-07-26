**English** · [日本語](../../howto/site-and-far.md)

# Give the site its shape and produce coverage and floor area ratios

Add the site to the description and use `koyu site` to produce the site area, road frontage, building footprint, building coverage ratio, and floor area ratio.

koyu does not hold the site as declared numbers. Both the coverage ratio and the floor area ratio are derived from the written site and the written building ([spec/semantics.md §6, site](../../../spec/en/semantics.md)). Only two things may be declared, both from a survey — the site area (`area:`) and the site shape (`polygon`) — and both are reconciled against the derived values. The coverage ratio and floor area ratio are terms of the Japanese Building Standards Act.

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- The building side passes `check` with zero errors.
- You can read the site area (m²) and the vertices of the site shape (mm) off a survey drawing.
- You know the widths of the roads (mm).

## Steps

### 1. Divide what is outside the site by direction and character

Rather than making `/out` a single space, split it into an `exterior` per road and per neighbor. Give each road its width with `road:` (mm) — `site` looks for this mark when finding frontage.

```muro-part
space /out/road exterior name:南側道路 road:6000
space /out/n exterior name:北側隣地
space /out/e exterior name:東側隣地
space /out/w exterior name:西側隣地
```

### 2. Declare the site zone

The site is a `zone` carrying `site:1`. Write the surveyed site area into `area:` (m²).

```muro-part
zone /site name:敷地 site:1 area:154.00
```

### 3. Tile around the building with exterior spaces at ground level

Beneath the site zone, place the garden, the paths, and the parking as real spaces. State the ground level explicitly (`level:L1`). Cover the site without gaps, together with the building, and the derived area comes out right even without a `polygon`.

```muro-part
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:南庭
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:西側通路
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:東側通路
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:北側通路
```

### 4. Write boundaries from the site's exterior spaces to the neighbors and roads

**Skip this step and the garden is counted into the building footprint.** The garden and the paths are spaces that have regions and whose type is not `exterior`. What makes something judged as outdoors is having an `open` or `air:1` boundary with the outside, and that is derived rather than declared ([spec/semantics.md §4, semi-outdoor](../../../spec/en/semantics.md)). Walls and fences are written with `air:1`.

```muro-part
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀 air:1 h:1200
  door w:900 name:門扉
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200
```

No default boundary is derived for a pair involving a space with no region (which the `exterior`s under `/out` normally are). Naming *which* outside something faces is the information, so write one line from each perimeter space. When the perimeter splits into several edges, select one with `edge:` — `N`=+Y (north), `S`=−Y (south), `E`=+X (east), `W`=−X (west).

The site's exterior spaces are continuous with each other, so join them with `type:open`.

```muro-part
boundary /site/garden /site/west type:open
boundary /site/west /site/north type:open
```

### 5. Write the site shape as a polygon

When you need the surveyed shape, write a `polygon`. It is the one line in this notation that writes a shape with free vertices off the grid — a site's shape is surveyed input, not designed form ([spec/language.md §7](../../../spec/en/language.md) / [ADR-0011](../../../docs/decisions/0011-site-polygon.md)). Give three or more vertices as `x,y` in mm, in the same coordinate system as the grid, and associate it with a `site:1` zone path.

```muro-part
polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

Put the polygon in a quarantined layer. This is the practice that keeps given geometry from mixing with the description of the design, and the bundled tower takes this form (`examples/tower/site-geometry.muro`).

```muro-part
# main.muro
import ./site-geometry.muro
```

### 6. Run site

```sh
npx tsx src/cli.ts site site.muro
```

## Confirming it

Steps 1 through 5 gathered into one file give the following.

```muro
koyu 0.4
name 敷地つきの平屋
unit mm

grid X 0 7000
grid Y 0 8000
level L1 0 h:2400

# 敷地の外 — 方角・性格ごとに割る。道路は road:幅員 (mm)
space /out/road exterior name:南側道路 road:6000
space /out/n exterior name:北側隣地
space /out/e exterior name:東側隣地
space /out/w exterior name:西側隣地

# 敷地 — site:1 のゾーンと、その配下の地上の外部空間
zone /site name:敷地 site:1 area:154.00
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:南庭
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:西側通路
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:東側通路
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:北側通路

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK

boundary /L1/ldk /site/garden t:150 spec:EW
  door w:900 name:掃き出し

# 敷地内の外部空間どうしは連続している
boundary /site/garden /site/west type:open
boundary /site/garden /site/east type:open
boundary /site/west /site/north type:open
boundary /site/east /site/north type:open

# 敷地境界 — 塀は air:1 (物はあるが外気を遮らない)
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀 air:1 h:1200
  door w:900 name:門扉
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
boundary /site/garden /out/e edge:E t:120 spec:ブロック塀 air:1 h:1200
boundary /site/west /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200
boundary /site/east /out/e edge:E t:120 spec:ブロック塀 air:1 h:1200
boundary /site/east /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200
boundary /site/north /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200

polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

```text
✔ 整合 — 空間 9 / 境界 16
```

```text
敷地 /site (敷地)
  敷地形状: 多角形 4頂点 (polygon宣言 — 所与のジオメトリ)
  敷地面積: 宣言 154.00㎡ / 導出 154.00㎡ ✔ 一致
  接道: /out/road (南側道路) 幅員6000mm ・ 接道長 11000mm ✔ 2m以上
  建築面積 (水平投影・粗): 56.00㎡ → 建蔽率 36.4%
  延べ面積: 56.00㎡ → 容積率 36.4%
```

Reading it: `敷地形状` is the site shape, `敷地面積` the site area with `宣言` (declared) and `導出` (derived) and `✔ 一致` ("they agree"), `接道` the road frontage with its width and length and a check that it is at least 2 m, `建築面積` the building footprint giving `建蔽率` (the coverage ratio), and `延べ面積` the gross floor area giving `容積率` (the floor area ratio).

| Line | Where it comes from |
|---|---|
| Site shape | The vertex count of the `polygon`. Without one, this line does not appear |
| Site area, declared | The `area:` on `zone /site` (the surveyed value) |
| Site area, derived | The shoelace formula over the polygon if there is one; otherwise the union of the spaces beneath the site and the interior footprint |
| Road frontage | The total length of boundary segments between spaces beneath the site zone and exteriors carrying `road:`. **The building's own outer wall facing a road is not frontage** |
| Building footprint | The union of the horizontal projections of the interior spaces (the inclusion rules are coarse) |
| Coverage ratio / floor area ratio | Footprint ÷ site area / gross floor area ÷ site area |

### If you skip step 4

Drop the wall boundaries to the neighbors (the seven to `/out/n`, `/out/e`, and `/out/w`) and `check` stays green while the building footprint more than doubles.

```text
✔ 整合 — 空間 9 / 境界 9
敷地 /site (敷地)
  敷地形状: 多角形 4頂点 (polygon宣言 — 所与のジオメトリ)
  敷地面積: 宣言 154.00㎡ / 導出 154.00㎡ ✔ 一致
  接道: /out/road (南側道路) 幅員6000mm ・ 接道長 11000mm ✔ 2m以上
  建築面積 (水平投影・粗): 121.00㎡ → 建蔽率 78.6%
  延べ面積: 121.00㎡ → 容積率 78.6%
```

A garden with no boundary to the outside is not derived as semi-outdoor and is counted as interior.

### When the declared and derived values disagree

Change `area:` to 160.40 and `check` warns (the reconciliation runs only when a polygon is present).

```text
⚠ site.muro:16行目: 敷地面積の宣言と導出が食い違います: 宣言 160.4㎡ / 導出 154.00㎡
✔ 整合 — 空間 9 / 境界 16 (警告 1)
```

```text
  敷地面積: 宣言 160.40㎡ / 導出 154.00㎡ ⚠ 不一致 (測量値と多角形の食い違い)
```

("The declared and derived site areas disagree" / "mismatch between the surveyed value and the polygon.")

The diagnostic code is SIT05 (a warning). The tolerance is ±0.05 m². `check --json` emits the structured diagnostic with its code.

```text
[
 {
  "code": "SIT05",
  "severity": "warning",
  "message": "敷地面積の宣言と導出が食い違います: 宣言 160.4㎡ / 導出 154.00㎡",
  "line": 16,
  "file": "site.muro",
  "path": [
   "/site"
  ]
 }
]
```

To stop on warnings in CI, use `koyu check <file> --strict` (exit code 1).

### On the bundled examples

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

`examples/house.muro` has no polygon, so the derived site area comes from the union of the garden, the paths, and the building.

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

The exit code of `site` is 0 when there is a site zone and 1 when there is not.

## Related

- [The how-to index](README.md)
- [Split across several files](split-into-files.md) — putting the polygon in a quarantined layer
- [Cut windows and pass the daylight test](daylight.md) — a garden being open above matters to the daylight coefficient
- [Getting unstuck](troubleshooting.md)
- [The diagnostic index](../diagnostics.md) — causes and fixes for SIT01–SIT05
- [The command reference](../cli.md) — the arguments and exit codes of `site`
- [spec/semantics.md](../../../spec/en/semantics.md) §6 site — the normative definitions of area, frontage, and coverage
- [spec/language.md](../../../spec/en/language.md) §5 zone, §7 polygon — the grammar
- [spec/vocabulary.md](../../../spec/en/vocabulary.md) — the contract for `site` / `area` / `road` / `air`
- [ADR-0009](../../../docs/decisions/0009-site-and-exterior.md) — the decision to write the site and the outside as spaces
- [ADR-0011](../../../docs/decisions/0011-site-polygon.md) — why the site shape alone is written with free vertices
