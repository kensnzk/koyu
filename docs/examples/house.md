---
title: house — 敷地・半屋外・レイヤー合成
mode: explanation
---

# house — 敷地・半屋外・レイヤー合成

小さな戸建住宅を**二通りに書いた**同じ一棟である。`examples/house.muro` が89行の単一ファイル版、`examples/house/` が102行5ファイルの合成版。どちらも空間13 / 境界31 / 屋内床面積 92.75㎡ / 半屋外 73.24㎡ で、`stats` も `light` も `site` も出力が完全に一致する。

![house L1](../img/house-L1.svg)

![house L2](../img/house-L2.svg)

## 初めて示すもの

- **`level:` 属性** — パスが `/home/…` なので階はパスの先頭から読めない。階を属性で明示する。**パスの第一義は集計の階層であって階ではない**、という帰結がここに出る。
- **[`zone`](../reference/muro/zone.md)** — `/home` (住戸) と `/site` (敷地)。幾何を持たず、パス接頭辞で束ねる。
- **敷地** — `zone /site … site:1 area:126.24` と `space /out/road exterior … road:6000`。`/out` が方角・性格ごとの複数の exterior に割れる。
- **地上の外部空間** — 庭・通路が L1 上の実在の空間として建物の周りをタイルする。**L1 の平面図がそのまま配置図を兼ねる。**
- **半屋外の導出** — 庭は宣言していないのに半屋外になる。外部に対して `air:1` (ブロック塀) の境界を持つからである。
- **L字の合併** — `X1..X2 Y1..Y3 + X2..X3 Y1..Y2`。
- **`hinge:` / `swing:`** — 扉の開き勝手。
- **部分吹抜け** — `boundary /home/ldk /home/void type:void`。被覆が小さいので LDK の天井高は階高内のままに保たれる。

合成版が加えて示すもの:

- **[`import`](../reference/muro/import.md)** — `main.muro` が base 層として `koyu` / `name` / `unit` / `grid` / `level` を一度だけ宣言し、`assets` / `site` / `L1` / `L2` を重ねる。階を跨ぐ境界 (階段・吹抜け) は base 層が持つ。
- **[`asset`](../reference/muro/asset.md)** — 建具の型を一箇所に宣言し、開口が名前で参照する。インスタンス側の属性が上書きする。
- **通り芯基準の明示位置** — `at:X2` `at:Y2+1820`。比率と違ってクランプされず、はみ出せばエラーになる。

## 抜粋

塀は境界の `spec` 語彙であり、門扉はその境界の扉である。**物 (塀・フェンス) が要素ではなく関係の属性になる**、という転回がここに出る。

```muro-part
boundary /site/garden /out/road edge:S t:120 spec:ブロック塀+フェンス air:1 h:1200
  door w:900 name:門扉
boundary /site/garden /out/w edge:W t:120 spec:ブロック塀 air:1 h:1200
```

`air:1` は「物はあるが外気と光を遮らない」。この一語のせいで庭は**半屋外**として導出され、屋内床面積から外れて別掲される。同時に、庭越しの窓には採光の減衰がかからない。

合成版の base 層。ここが一貫性を持ち、層が重なる。

```muro-part
grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400 slab:400
level L2 2900 h:2400 slab:500
level R 5800 slab:500

import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

アセットの層は9行しかない。

```muro-part
asset D1  door   w:900  h:2100 style:hinged  name:玄関ドア
asset SD1 door   w:800  h:2000 style:sliding name:片引き戸
asset GT1 door   w:900  h:1200 style:hinged  name:門扉
asset W1  window w:2600 h:2200 sill:0        name:掃き出し窓
asset W2  window w:1650 h:1100 sill:900      name:腰窓
asset W3  window w:2600 h:1100 sill:1100     name:高窓
```

1階の層はこれを名前で引く。`window W1 at:X2` は「掃き出し窓を X2 通り芯の位置に」としか言っていない。

```muro-part
boundary /home/ldk /site/garden t:150 spec:EW
  window W1 at:X2 name:掃き出し窓
boundary /home/hall1 /site/east t:150 spec:EW
  door D1 at:Y2+1820 name:玄関
```

## 投げる問い

### 敷地の数字は合っているか

`area:126.24` は測量値の宣言である。導出値と突き合わされる。

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

接道長 10280mm は、敷地ゾーン配下の空間と `road:` を持つ外部空間との境界線分長の合計である。**建物の外壁が道路に面していても接道ではない。**建蔽率・容積率の意味は[日本の建築・法規の用語](../glossary/japanese-building-terms.md)にある。

### 採光は足りているか

```sh
npx tsx src/cli.ts light examples/house.muro
```

```text
✔ /home/ldk	LDK	window 7.54 m2 / floor 39.75 m2 = 1/5.3 (needs 1/7 ≈ 5.68 m2)
✔ /home/bed1	主寝室	window 5.72 m2 / floor 26.50 m2 = 1/4.6 (needs 1/7 ≈ 3.79 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

LDK の 7.54㎡ は掃き出し窓 (2.6×2.2 = 5.72㎡) と腰窓 (1.65×1.1 = 1.815㎡) の和である。庭は上が開いているので係数 1.0 がかかった。

### 二つの書き方はどう違うか

`stats` / `light` / `site` の出力は完全に一致する。違うのは開口の書き方だけで、それを [`diff`](../reference/cli/diff.md) が構成の言葉で言う。

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
± boundary /home/bed1 | /home/hall2: + door 寝室引き戸 SD1 w:800 h:2000 style:sliding name:寝室引き戸 / − door at:0.5 (w:800)
± boundary /home/bed1 | /out/road edge:S: + window at:0.5 ref W1 / + window at:0.5 name 掃き出し窓
± boundary /home/hall1 | /home/ldk: + door edge:E at:0.5 ref SD1 / + door edge:E at:0.5 h 2000 / + door edge:E at:0.5 name 片引き戸 / + door edge:E at:0.5 style sliding
± boundary /home/hall1 | /site/east: door 玄関 at 0.5 → Y2+1820 / + door 玄関 ref D1 / + door 玄関 h 2100 / + door 玄関 style hinged
± boundary /home/ldk | /site/garden: + window at:X2 W1 w:2600 h:2200 sill:0 name:掃き出し窓 / − window 掃き出し窓 (w:2600 h:2200 sill:0 name:掃き出し窓)
± boundary /home/ldk | /site/west: + window at:0.5 ref W2 / + window at:0.5 name 腰窓
± boundary /home/void | /out/road edge:S: + window 吹抜けの高窓 ref W3
± boundary /out/road | /site/garden edge:S: + door at:X2 GT1 w:900 h:1200 style:hinged name:門扉 / − door 門扉 (w:900 name:門扉)
```

差分に出るのは「アセットが増えたこと」と「開口の位置が比率から通り芯基準になったこと」であって、行の順序でも書式でもない。**ファイルを五つに分けたこと自体は差分ではない。**

## 次に読む

- 基準階を一度だけ書く — [mansion](mansion.md)
- 分担して書いたレイヤーを一棟としてビルドする — [tower](tower.md)
