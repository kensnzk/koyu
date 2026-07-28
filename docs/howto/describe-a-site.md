---
title: 敷地と外構を書いて建蔽率・容積率を出す
mode: howto
---

# 敷地と外構を書いて建蔽率・容積率を出す

敷地を記述に加え、[`koyu site`](../reference/cli/site.md) で敷地面積・接道・建築面積・建蔽率・容積率を出す。

**koyu は敷地を宣言された数値としては持たない。**建蔽率も容積率も、書かれた敷地と書かれた建物から導かれる。宣言できるのは測量由来の二つ — 敷地面積 (`area:`) と敷地形状 (`polygon`) — だけで、どちらも導出値と照合される。

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためファイル名だけに縮めてある。

## 前提

- 建物側が [`koyu check`](../reference/cli/check.md) エラー0で通っていること。
- 測量図から、敷地面積 (㎡) と敷地形状の頂点座標 (mm) が読めること。
- 道路の幅員 (mm) が分かっていること。

## 1. 敷地の外を方角・性格ごとに割る

`/out` を一つの空間にせず、道路・隣地ごとの `exterior` に割る。**道路には幅員を `road:` (mm) で付ける** — `site` はこの印を見て接道を探す。

```muro-part
space /out/road exterior name:南側道路 road:6000
space /out/n exterior name:北側隣地
space /out/e exterior name:東側隣地
space /out/w exterior name:西側隣地
```

## 2. 敷地ゾーンを宣言する

敷地は `site:1` を持つ `zone` である。測量値の敷地面積は `area:` (㎡) に書く。

```muro-part
zone /site name:敷地 site:1 area:154.00
```

## 3. 地上の外部空間で建物の周りをタイルする

敷地ゾーンの配下に、庭・通路・駐車場を**実在の空間として**置く。レベルは地上階を明示する (`level:L1`)。建物と合わせて敷地を隙間なく覆えば、`polygon` が無くても導出面積が正しく出る。

```muro-part
space /site/garden garden X1-2000..X2+2000 Y1-3000..Y1 level:L1 name:南庭
space /site/west yard X1-2000..X1 Y1..Y2+3000 level:L1 name:西側通路
space /site/east yard X2..X2+2000 Y1..Y2+3000 level:L1 name:東側通路
space /site/north yard X1..X2 Y2..Y2+3000 level:L1 name:北側通路
```

## 4. 敷地内の外部空間から隣地・道路へ境界を書く

**この手順を飛ばすと庭が建築面積に算入される。**庭も通路も、型が `exterior` ではない領域つき空間である。屋外だと判定されるのは**外部に対して `open` か `air:1` の境界を持つときだけ**で、これは宣言ではなく導出である。塀・フェンスは `air:1` で書く。

```muro-part
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀 air:1 h:1200
  door w:900 name:門扉
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
boundary /site/west /out/n edge:N t:120 spec:ブロック塀 air:1 h:1200
```

領域を持たない空間 (`/out` 配下の `exterior` はふつうそう) との組には既定境界が導かれない。**どの外部に面しているかは名指しが情報だから**で、外周の空間から一本ずつ書く。外周が複数の辺に分かれるときは `edge:` で辺を選ぶ — `N`=+Y・`S`=−Y・`E`=+X・`W`=−X。

敷地内の外部空間どうしは連続しているので `type:open` で結ぶ。

```muro-part
boundary /site/garden /site/west type:open
boundary /site/west /site/north type:open
```

## 5. 敷地形状を polygon で書く

測量図の実形が要るときは `polygon` を書く。**この記法で唯一、格子に載らない自由頂点で形を書ける行**である — 敷地の形は測量由来の所与であって、設計の生成物ではない。頂点は `x,y` の mm 座標をグリッドと同じ座標系で3つ以上、`site:1` のゾーンパスに対応させる。

```muro-part
polygon /site -2000,-3000 9000,-3000 9000,11000 -2000,11000
```

polygon は隔離した層に置くとよい。所与のジオメトリと設計の記述を混ぜないための運用で、同梱の tower はこの形をとっている (`examples/tower/site-geometry.muro` は宣言が `polygon` 1 行だけの層である)。文法は [polygon](../reference/muro/polygon.md) にある。

## 確かめる

```muro
koyu 1.0
name 敷地つきの平屋
unit mm

grid X 0 7000
grid Y 0 8000
level L1 0 h:2400 slab:150
level R 2700 slab:150

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
$ npx tsx src/cli.ts check site.muro
✔ Consistent — 9 spaces / 16 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```text
$ npx tsx src/cli.ts site site.muro
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
| Site shape | `polygon` の頂点数。無いときはこの行が出ない |
| Site area — declared | `zone /site` の `area:` (測量値) |
| Site area — derived | polygon があればシューレース、無ければ敷地配下の空間と屋内の水平投影の合併 |
| Road | 敷地ゾーン配下の空間と `road:` 付き exterior との境界線分長の合計。**建物の外壁が道路に面していても接道ではない** |
| Building footprint | 屋内空間の水平投影の合併 |
| ratios | 建築面積 ÷ 敷地面積、延べ面積 ÷ 敷地面積 |

`site` の終了コードは、敷地ゾーンがあるとき0、無いとき1である。

## 手順4を飛ばすと建築面積が倍になる

隣地への塀の境界7本を落とすと、`check` は緑のまま建築面積が倍以上になる。

```text
$ npx tsx src/cli.ts check site-nofence.muro
✔ Consistent — 9 spaces / 9 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ npx tsx src/cli.ts site site-nofence.muro
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (南側道路) width 6000mm / frontage 11000mm
  Building footprint (horizontal projection, rough): 121.00 m2 → building coverage ratio 78.6%
  Total floor area: 121.00 m2 → floor area ratio 78.6%
```

**外部への境界を持たない庭は半屋外と導出されず、屋内として数えられている。**

## 宣言と導出が食い違うとき

`area:` を 160.40 に変えても `check` は緑のままである。**構成としては何も壊れていない** — 測量値と多角形の食い違いは建築的な判定であり、[`koyu validate`](../reference/cli/validate.md) が言う (polygon があるときだけ照合される)。

```text
⚠ [site.area] site-mismatch.muro:line 17: Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2
Validation — 0 violations / 1 caution
```

規則は `site.area` (caution)。`validate --json` で構造化された結果が出る。

```json
[
 {
  "rule": "site.area",
  "level": "caution",
  "message": "Declared and derived site areas disagree: declared 160.4 m2 / derived 154.00 m2",
  "line": 17,
  "file": "site-mismatch.muro",
  "path": [
   "/site"
  ]
 }
]
```

**CI で止めたいのは violation である** — `validate` の終了コードは violation があるときだけ 1 になる。建物が敷地形状からはみ出す `site.escape` と、接道長が 2m 未満の `site.frontage` がその二つで、どちらも [敷地の判定](../reference/validate/site.md) にある。

## 同梱の例で

```text
$ npx tsx src/cli.ts site examples/house.muro
Site /site (敷地)
  Site area: declared 126.24 m2 / derived 126.24 m2
  Road: /out/road (南側道路) width 6000mm / frontage 10280mm
  Building footprint (horizontal projection, rough): 53.00 m2 → building coverage ratio 42.0%
  Total floor area: 92.75 m2 → floor area ratio 73.5%
```

`examples/house.muro` は polygon を持たないので、敷地面積の導出は庭・通路・建物の合併から出ている。

```text
$ npx tsx src/cli.ts site examples/tower/main.muro
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436.0%
```

## 次に

- [層に割って import で合成する](split-into-layers.md) — polygon を隔離した層に置く
- [窓を開けて採光を通す](windows-and-daylight.md) — 庭が「上が開いている」ことが採光の係数に効く
- [到達できない空間を見つける](find-unreachable.md) — 門扉から玄関まで通れるか
