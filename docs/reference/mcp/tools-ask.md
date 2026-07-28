---
title: 問う — doors / light / site / plan_svg
mode: reference
---

# 問う — doors / light / site / plan_svg

同じ記述に別の問いを掛ける四つ。**どれも合否を言わない。**返るのは数か形であって、判定ではない。

判定が欲しいなら [`validate`](tools-verify.md#validate) を呼ぶ — 1/7 に届いているか、外へ出られるか、敷地からはみ出していないかは、あちらが言う。

この四つは、`check` が緑になったあとに**帰結を確かめる**ために呼ぶ。間仕切りを一枚動かせば動線と採光が変わり、面積が変われば建蔽率が変わる。**`check` はそれを一つも見ていない。**

この頁の出力はすべて実際に走らせて得たものである。絶対パスは `<abs>` に縮めてある。

---

## doors

> Circulation query: how many doors lie between space A and space B (the path with the fewest doors)

| 引数 | 必須 | 中身 |
|---|---|---|
| `file` | ○ | entry の `.muro` パス |
| `from` | ○ | 出発点の空間のパス |
| `to` | ○ | 到達点の空間のパス |

```json
{"name": "doors", "arguments": {"file": "<abs>/examples/two-rooms.muro", "from": "/L1/a", "to": "/out"}}
```

```text
{
 "doors": 2,
 "path": [
  "/L1/a",
  "/L1/b",
  "/out"
 ]
}
```

`doors` は**扉の枚数**、`path` は経由した空間の列である。**最短距離ではなく、扉が最も少ない経路**が選ばれる。

階を跨ぐ経路も同じ問いで出る。縦動線の境界は扉を持たないので、階段を十階ぶん降りても枚数は増えない。

```text
{
 "doors": 3,
 "path": [
  "/L9/A/ldk",
  "/L9/A/hall",
  "/L9/corridor",
  "/L9/stair",
  "/L8/stair",
  "/L7/stair",
  "/L6/stair",
  "/L5/stair",
  "/L4/stair",
  "/L3/stair",
  "/L2/stair",
  "/L1/stair",
  "/out"
 ]
}
```

(`examples/mansion.muro` に `{"from": "/L9/A/ldk", "to": "/out"}` を掛けた返り。)

### 到達できないとき

```text
{
 "unreachable": true
}
```

**存在しないパスを渡したときも同じ返りになる。**エラーにはならない。`{"to": "/nope"}` と `{"to": "/L1/x"}` (書き忘れた空間) と、本当に密封された空間は、この返りでは区別できない。**パスの綴りは [`spaces`](tools-read.md#spaces) で確かめてから渡す。**

`doors` は「外へ出られるか」の判定ではない。避難の可否を問うなら `validate` の `access.unreachable` を見る。

---

## light

> Daylight inputs: floor area and effective window area for every space written with daylight:1 (a 0.7 factor applies through a covered semi-outdoor space). **It delivers no verdict** — the 1/7 judgement comes from the validate tool

`file` のみ、必須。

```text
[
 {
  "path": "/L1/a",
  "name": "居室A",
  "windowM2": 2.86,
  "floorM2": 16.2,
  "missingH": false
 },
 {
  "path": "/L1/b",
  "name": "居室B",
  "windowM2": 2.86,
  "floorM2": 16.2,
  "missingH": false
 }
]
```

| フィールド | 中身 |
|---|---|
| `path` | 空間のパス |
| `name` | `name:` の値、無ければパスの最終要素 |
| `windowM2` | 外部に面する窓の**有効**面積 (㎡) |
| `floorM2` | 床面積 (㎡) |
| `missingH` | `h:` を持たない窓があって、窓面積を数え切れていないか |

### 母集団は宣言である

**返るのは `daylight:1` と書かれた空間だけである。**型からは推定しない。「この室に採光の問いを掛ける」は書き手の宣言であって、処理系の推量ではない。

だから `daylight:1` を一つも書いていない建物では、空の配列が返る。**それは「採光が足りている」ではなく「誰も問うていない」である。**

```text
[]
```

### 係数は形から導かれる

`windowM2` は窓の `w × h` をそのまま足したものではない。窓の先が何かで係数が掛かる。

| 窓の先 | 係数 |
|---|---|
| `exterior` — 直接外部に面する | 1 |
| 上が空いた半屋外 (庭・最上階のバルコニー) 越し | 1 |
| **上に空間がある半屋外** (庇下・下階のバルコニー) 越し | **0.7** |
| 屋内 | 0 — 数えない |

`h:` を書かなかった窓は**数に入らず**、`missingH` が `true` になる。**数が小さく出ていることの印である** — `windowM2` を信用する前にここを見る。

### 判定はしない

`floorM2 / 7` と較べる仕事はここに無い。**1/7 の判定は [`validate`](tools-verify.md#validate) の `daylight.ratio` が言う。**`missingH` に対応するのは `daylight.unknown` である。

---

## site

> Site query: site area (declared against derived), road frontage, footprint, and the coverage and floor-area ratios

`file` のみ、必須。

```text
{
 "siteZone": "/site",
 "polygonVertices": 5,
 "declaredAreaM2": 1097.8,
 "derivedAreaM2": 1097.8,
 "areaMatch": true,
 "footprintM2": 569.6,
 "totalFloorM2": 4785.92,
 "coverageRatio": 51.9,
 "floorAreaRatio": 436,
 "roads": [
  {
   "path": "/out/road-s",
   "name": "南側道路",
   "widthMm": 12000,
   "frontageMm": 40600
  },
  {
   "path": "/out/road-e",
   "name": "東側道路",
   "widthMm": 6000,
   "frontageMm": 20200
  }
 ]
}
```

(`examples/tower/main.muro` の返り。)

| フィールド | いつ出るか | 中身 |
|---|---|---|
| `siteZone` | `site:1` のゾーンがあるとき | そのゾーンのパス |
| `polygonVertices` | 敷地形状が書かれているとき | 多角形の頂点数 |
| `declaredAreaM2` | ゾーンに `area:` があるとき | 書かれた測量値 (㎡) |
| `derivedAreaM2` | 導けたとき | 形から導いた面積 (㎡) |
| `areaMatch` | 宣言と導出の**両方**があるとき | 差が 0.05 ㎡ 未満か |
| `footprintM2` | 常に | 建築面積 (㎡) |
| `totalFloorM2` | 常に | 延べ床面積 (㎡) |
| `coverageRatio` | 敷地面積が判るとき | 建蔽率 (%、小数第一位まで) |
| `floorAreaRatio` | 敷地面積が判るとき | 容積率 (%、小数第一位まで) |
| `roads` | 常に (無ければ空配列) | 接する道路の `path` / `name` / `widthMm` / `frontageMm` |

**`coverageRatio` と `floorAreaRatio` の分母は、宣言された面積があればそれ、無ければ導出された面積である。**

### 敷地を書いていない建物でも返る

```text
{
 "derivedAreaM2": 32.4,
 "footprintM2": 32.4,
 "totalFloorM2": 32.4,
 "coverageRatio": 100,
 "floorAreaRatio": 100,
 "roads": []
}
```

(`examples/two-rooms.muro` の返り。敷地ゾーンが無いので `siteZone` も `declaredAreaM2` も出ず、`derivedAreaM2` は建物の外形から導かれている。)

**この `coverageRatio: 100` は「建蔽率 100%」ではない。**敷地が書かれていないので、建物そのものを敷地として数えているだけである。**敷地を書いていない建物にこの二つの数を読ませない。**

### 上限とは較べない

用途地域ごとの建蔽率・容積率の上限は原本の外の事実なので、このツールも `validate` も持っていない。**返るのは数だけである。**

`validate` が敷地について言うのは三つ — 建物が敷地形状からはみ出していないか (`site.escape`)、宣言面積と導出面積が食い違っていないか (`site.area`)、接道長が 2m を切っていないか (`site.frontage`) である。

---

## plan_svg

> Generates and returns the plan SVG for a level (form is generated, not written — the lowest level doubles as the site plan)

| 引数 | 必須 | 中身 |
|---|---|---|
| `file` | ○ | entry の `.muro` パス |
| `level` | ○ | レベル名 (`L1` など) |

**返るのは JSON ではなく、SVG の文字列そのものである。**サーバーの他のツールがすべて JSON を返すなかで、これだけが例外である。

```text
<svg xmlns="http://www.w3.org/2000/svg" width="682" height="782" viewBox="0 0 682 782" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
<rect width="682" height="782" fill="#faf8f4"/>
<path d="M 84 698 L 598 698 L 598 498 L 84 498 Z" fill="#f8f5ec"/>
<path d="M 84 498 L 159 498 L 159 84 L 84 84 Z" fill="#f8f5ec"/>
<path d="M 523 498 L 598 498 L 598 84 L 523 84 Z" fill="#f8f5ec"/>
<path d="M 159 134 L 523 134 L 523 84 L 159 84 Z" fill="#f8f5ec"/>
<path d="M 159 498 L 341 498 L 341 134 L 159 134 Z" fill="#f1ebdd"/>
<path d="M 341 498 L 523 498 L 523 316 L 341 316 Z" fill="#f1ebdd"/>
```

(`examples/house/main.muro` の `L1` の先頭 8 行。全体は 7,311 バイトで、最後は次の二行で終わる。)

```text
<text x="660" y="764" text-anchor="end" font-size="9" fill="#a49b8a">koyu — generated from spaces (wall centrelines, mm)</text>
</svg>
```

**ファイルは書かれない。**返るのは文字列だけで、ディスクには何も落ちない。保存するのは呼び手の仕事である。

**最も低いレベルは配置図を兼ねる。**敷地・庭・道路が書かれていれば、そのレベルの図に一緒に出る。

### 未宣言のレベルは失敗する

```text
There is no space with a region on level L9
```

`isError: true` が付いて返る。**空の SVG は書かない。**レベル名は [`model_summary`](tools-read.md#model_summary) の `levels` で確かめる。

領域を持つ空間が一つも無いレベル (屋根だけの `R` など) も同じ経路を通る。

```text
There is no space with a region on level R
```

### 形は生成物であって記述ではない

平面図は `.muro` のどこにも書かれていない。**空間と境界から毎回導出される。**だから同じ記述からは常に同じ図が出るし、図を直接編集する手段は無い — 直すのは記述のほうである。

見た目 (色・線幅・書体) は凍っていない。版が変われば SVG の中身は変わりうる。**同じ図が返り続けることを前提にしない。**

## 関連

- [確かめる — check / validate](tools-verify.md) — この四つが言わない合否
- [読む — model_summary / layers / spaces / canonical_json](tools-read.md) — パスとレベル名を確かめる
- [koyu doors](../cli/doors.md) / [koyu light](../cli/light.md) / [koyu site](../cli/site.md) — 同じ問いを人向けに
- [koyu plan](../cli/plan.md) — 同じ図をファイルに書く
- [koyu axo](../cli/axo.md) — 軸測図。**MCP には無い**
- [判定 — koyu validate](../validate/index.md) — 採光・避難・敷地の判定
