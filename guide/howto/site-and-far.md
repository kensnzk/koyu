[English](../en/howto/site-and-far.md) · **日本語**

# 敷地を書いて建蔽率・容積率を出す

敷地を記述に加え、`koyu site` で敷地面積・接道・建築面積・建蔽率・容積率を出す。

koyu は敷地を宣言された数値としては持たない。建蔽率も容積率も、書かれた敷地と書かれた建物から導かれる ([spec/semantics.md §6 site](../../spec/semantics.md))。宣言できるのは測量由来の二つ — 敷地面積 (`area:`) と敷地形状 (`polygon`) — だけで、どちらも導出値と照合される。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 建物側が `check` エラー0で通っていること。
- 測量図から、敷地面積 (㎡) と敷地形状の頂点座標 (mm) が読めること。
- 道路の幅員 (mm) が分かっていること。

## 手順

### 1. 敷地の外を方角・性格ごとに割る

`/out` を一つの空間にせず、道路・隣地ごとの `exterior` に割る。道路には幅員を `road:` (mm) で付ける — `site` はこの印を見て接道を探す。

```muro-part
space /out/road exterior name:南側道路 road:6000
space /out/n exterior name:北側隣地
space /out/e exterior name:東側隣地
space /out/w exterior name:西側隣地
```

### 2. 敷地ゾーンを宣言する

敷地は `site:1` を持つ `zone` である。測量値の敷地面積は `area:` (㎡) に書く。

```muro-part
zone /site name:敷地 site:1 area:154.00
```

### 3. 地上の外部空間で建物の周りをタイルする

敷地ゾーンの配下に、庭・通路・駐車場を実在の空間として置く。レベルは地上階を明示する (`level:L1`)。建物と合わせて敷地を隙間なく覆うと、`polygon` が無くても導出面積が正しく出る。

```muro-part
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:南庭
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:西側通路
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:東側通路
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:北側通路
```

### 4. 敷地内の外部空間から隣地・道路へ境界を書く

**この手順を飛ばすと庭が建築面積に算入される。** 庭も通路も、型が `exterior` ではない領域つき空間である。屋外だと判定されるのは、外部に対して `open` か `air:1` の境界を持つときだけで、これは宣言ではなく導出である ([spec/semantics.md §4 半屋外](../../spec/semantics.md))。塀・フェンスは `air:1` で書く。

```muro-part
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀 air:1 h:1200
  door w:900 name:門扉
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200
```

領域を持たない空間 (`/out` 配下の `exterior` はふつうそう) との組には既定境界が導かれない。どの外部に面しているかは名指しが情報だからで、外周の空間から1本ずつ書く。外周が複数の辺に分かれるときは `edge:` で辺を選ぶ — `N`=+Y (北)・`S`=−Y (南)・`E`=+X (東)・`W`=−X (西)。

敷地内の外部空間どうしは連続しているので `type:open` で結ぶ。

```muro-part
boundary /site/garden /site/west type:open
boundary /site/west /site/north type:open
```

### 5. 敷地形状を polygon で書く

測量図の実形が要るときは `polygon` を書く。この記法で唯一、格子に載らない自由頂点で形を書ける行である — 敷地の形は測量由来の所与であって設計の生成物ではない ([spec/language.md §7](../../spec/language.md) / [ADR-0011](../../docs/decisions/0011-site-polygon.md))。頂点は `x,y` の mm 座標をグリッドと同じ座標系で3つ以上、`site:1` のゾーンパスに対応させる。

```muro-part
polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

polygon は隔離レイヤーに置く。所与のジオメトリと設計の記述を混ぜないための運用で、同梱の tower はこの形をとっている (`examples/tower/site-geometry.muro`)。

```muro-part
# main.muro
import ./site-geometry.muro
```

### 6. site を走らせる

```sh
npx tsx src/cli.ts site site.muro
```

## 確かめる

手順1〜5を一つのファイルにまとめると次になる。

```muro
koyu 0.4
name 敷地つきの平屋
unit mm

grid X 0 7000
grid Y 0 8000
level L1 0 h:2400 slab:150

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
✔ Consistent — 9 spaces / 16 boundaries
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (南側道路) width 6000mm / frontage 11000mm
  Building footprint (horizontal projection, rough): 56.00 m2 → building coverage ratio 36.4%
  Total floor area: 56.00 m2 → floor area ratio 36.4%
```

読み方は次のとおり。

| 行 | 出所 |
|---|---|
| 敷地形状 | `polygon` の頂点数。無いときはこの行が出ない |
| 敷地面積・宣言 | `zone /site` の `area:` (測量値) |
| 敷地面積・導出 | polygon があればシューレース、無ければ敷地配下の空間+屋内の水平投影の合併 |
| 接道 | 敷地ゾーン配下の空間と `road:` 付き exterior との境界線分長の合計。**建物の外壁が道路に面していても接道ではない** |
| 建築面積 | 屋内空間の水平投影の合併 (算入細則は粗い) |
| 建蔽率 / 容積率 | 建築面積 ÷ 敷地面積 / 延べ面積 ÷ 敷地面積 |

### 手順4を飛ばした場合

隣地への塀の境界 (`/out/n` `/out/e` `/out/w` への7本) を落とすと、`check` は緑のまま建築面積が倍以上になる。

```text
✔ Consistent — 9 spaces / 9 boundaries
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (南側道路) width 6000mm / frontage 11000mm
  Building footprint (horizontal projection, rough): 121.00 m2 → building coverage ratio 78.6%
  Total floor area: 121.00 m2 → floor area ratio 78.6%
```

外部への境界を持たない庭は半屋外と導出されず、屋内として数えられている。

### 宣言と導出が食い違うとき

`area:` を 160.40 に変えても `check` は緑のままである。**構成としては何も壊れていない** — 測量値と多角形の食い違いは建築的な判定であり、`validate` が言う (polygon がある場合のみ照合される)。

```text
⚠ [site.area] site.muro:line 16: Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2
Validation — 0 violations / 1 caution
```

```text
  Site area: declared 160.40 m2 / derived 154.00 m2
```

規則は `site.area` (caution)。許容は ±0.05㎡。`validate --json` で構造化された Finding が出る。

```text
[
 {
  "rule": "site.area",
  "level": "caution",
  "message": "Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2",
  "line": 16,
  "file": "site.muro",
  "path": [
   "/site"
  ]
 }
]
```

CI で止めたいのは違反 (violation) である — `validate` の終了コードは violation があるときだけ 1 になる。

### 同梱の例で

```sh
npx tsx src/cli.ts site examples/house.muro
```

```text
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42.0%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

`examples/house.muro` は polygon を持たないので、敷地面積の導出は庭・通路・建物の合併から出ている。

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436.0%
```

`site` の終了コードは、敷地ゾーンがあるとき0、無いとき1。

## 関連

- [how-to 一覧](README.md)
- [複数ファイルに割る](split-into-files.md) — polygon を隔離レイヤーに置く
- [窓を開けて採光を通す](daylight.md) — 庭が「上が開いている」ことが採光の係数に効く
- [よくある詰まり](troubleshooting.md)
- [診断コード一覧](../diagnostics.md) — SIT01〜SIT05 の原因と直し方
- [コマンド一覧](../cli.md) — `site` の引数と終了コード
- [spec/semantics.md](../../spec/semantics.md) §6 site — 面積・接道・建蔽率の規範の定義
- [spec/language.md](../../spec/language.md) §5 zone・§7 polygon — 文法
- [spec/vocabulary.md](../../spec/vocabulary.md) — `site` / `area` / `road` / `air` の契約
- [ADR-0009](../../docs/decisions/0009-site-and-exterior.md) — 敷地と外部を空間として書く決定
- [ADR-0011](../../docs/decisions/0011-site-polygon.md) — 敷地形状だけを例外的に自由頂点で書く理由
