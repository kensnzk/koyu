---
title: モデルへの問い
mode: reference
---

# モデルへの問い

同じ記述を違う読み方で読む関数群である。**どれも合否を言わない。**数と形と経路を返すところまでで、「足りているか」を言うのは [`validate`](validate.md) である。

```ts
import {
  areaM2, columnsFor, daylightInputs, displayName, doorsBetween, effectiveUse,
  heff, isCoveredAbove, isIndoor, isSemiOutdoor, levelsSorted, neighbors,
  passable, siteReport, unionAreaM2, zoneAreaM2,
} from "@kensnzk/koyu";
```

この頁の出力はすべて `examples/house/main.muro` を読んだ模型に対して実行したものである。

```ts
import { parseFile } from "@kensnzk/koyu/node";
const m = parseFile("examples/house/main.muro");
```

## 空間グラフ

節点が空間、辺が境界である。**「この室とこの室は繋がっているか」がそのままグラフへの問いになる** — 変換は要らない。

### doorsBetween

```ts
function doorsBetween(model: Model, from: string, to: string): Route | undefined

interface Route { doors: number; path: string[] }
```

最少の扉数で結ぶ経路を返す。`open` 境界と階段は費用0、扉のある `wall` 境界は費用1、それ以外は通れない。

**到達できないときも、パスが存在しないときも `undefined` が返る。**区別したいなら `model.spaces.has(path)` を先に見る。

```ts
console.log(doorsBetween(m, "/home/bed1", "/out/road"));
console.log(doorsBetween(m, "/home/bed1", "/home/nope"));
```

```text
{
  doors: 3,
  path: [
    '/home/bed1',
    '/home/hall2',
    '/home/hall1',
    '/site/east',
    '/site/garden',
    '/out/road'
  ]
}
undefined
```

`path` は節点の列で、`doors` はその上で通る扉の数である。**節点の数と扉の数は一致しない** — 階段と `open` 境界は費用を持たないからである。

### neighbors

```ts
function neighbors(model: Model, path: string): NeighborInfo[]

interface NeighborInfo {
  space: Space;
  boundary: Boundary;
  passable: boolean;
  doors: number;      // その境界に載る door の数
}
```

**導出された既定境界も含めて返る。**「隣に何があるか」の答えは、宣言された境界だけではないからである。

```ts
import { displayName, neighbors } from "@kensnzk/koyu";

for (const n of neighbors(m, "/home/hall1")) {
  console.log(`${n.space.path}\t${displayName(n.space)}\t${n.boundary.kind}\tpassable=${n.passable}\tdoors=${n.doors}`);
}
```

```text
/home/ldk	LDK	wall	passable=true	doors=1
/site/east	東側通路	wall	passable=true	doors=1
/site/north	北側通路	wall	passable=false	doors=0
/home/hall2	2階ホール	stair	passable=true	doors=0
```

最後の一件は階段である。**垂直の隣も同じ配列に出る** — グラフは平面のものではない。

### passable

```ts
function passable(b: Boundary): boolean
```

境界一つの通行可能性を言う。

| kind | 通れるか |
|---|---|
| `open` | 常に通れる |
| `stair` | 常に通れる |
| `wall` | `door` の開口があるときだけ |
| `shaft` | 通れない |
| `void` | 通れない |

`air:1` は**遮蔽の話であって通行の話ではない。**扉の無い手すり壁は `air:1` でも通れない。

```ts
console.log(passable(m.boundaries.find((b) => b.kind === "stair")!));
```

```text
true
```

## 面積

### areaM2

```ts
function areaM2(s: Space): number | undefined
```

空間の壁芯面積を ㎡ で返す。**導出された凸片の合計である** — 線で切られていればその形の面積になる。領域を持たない空間 (`exterior` など) では `undefined`。

小数第2位で丸められる。

### zoneAreaM2

```ts
function zoneAreaM2(model: Model, zonePath: string): number
```

パス接頭辞で束ねた空間の面積の合計である。**吹抜けと半屋外は数えない** — 専有面積の言葉だからである。

### unionAreaM2

```ts
function unionAreaM2(rects: Rect[]): number
```

矩形集合の合併面積である。**重なりを一度だけ数える** — 座標圧縮による厳密計算で、水平投影 (建築面積の導出) に使う。

```ts
import { areaM2, unionAreaM2, zoneAreaM2 } from "@kensnzk/koyu";

console.log(areaM2(m.spaces.get("/home/ldk")!), zoneAreaM2(m, "/home"),
  unionAreaM2([...m.spaces.get("/home/ldk")!.rects, ...m.spaces.get("/home/hall1")!.rects]));
```

```text
39.75 92.75 53
```

## 屋内・半屋外・被覆

**どれも宣言ではなく導出である。**

### isIndoor

```ts
function isIndoor(model: Model, s: Space): boolean
```

屋内の床面積に数えるか。領域を持ち、`exterior` でも `void` でもなく、半屋外でもない空間が真になる。

**「延べ面積」を問う場所はすべてこの一つの答えを使う。**母集団を場所ごとに決めることはしない。

### isSemiOutdoor

```ts
function isSemiOutdoor(model: Model, s: Space): boolean
```

半屋外か。**`type:exterior` の空間に対して `open` または `air:1` の境界を持つ、領域つきの空間**が半屋外である。バルコニー・テラス・庭がこれになる。

### isCoveredAbove

```ts
function isCoveredAbove(model: Model, s: Space): boolean
```

上に (どのレベルであれ) 空間が重なっているか。**屋根の有無すら宣言ではない。**採光の半屋外係数 (庇下 0.7 / 上が開いていれば 1.0) がこの二つを読む。

```ts
import { isCoveredAbove, isIndoor, isSemiOutdoor } from "@kensnzk/koyu";

for (const p of ["/home/ldk", "/site/garden", "/out/road"]) {
  const s = m.spaces.get(p)!;
  console.log(`${p}\tindoor=${isIndoor(m, s)}\tsemi=${isSemiOutdoor(m, s)}\tcovered=${isCoveredAbove(m, s)}`);
}
```

```text
/home/ldk	indoor=true	semi=false	covered=true
/site/garden	indoor=false	semi=true	covered=false
/out/road	indoor=false	semi=false	covered=false
```

`/home/ldk` が `covered=true` なのは、上に2階の空間が重なっているからである。`/site/garden` は空に開いているので偽になる。

## 高さとレベル

### heff

```ts
function heff(model: Model, s: Space): number | undefined
```

空間の有効天井高 mm。**空間自身の `h:` があればそれ、無ければ所属レベルの `h`。**どちらも無ければ `undefined` で、そのとき天井も屋根も生成されない (`SUF01` が error として言う)。

### levelsSorted

```ts
function levelsSorted(model: Model): Level[]
```

レベルを `z` の昇順で返す。`model.levels` は `Record` なので順序を約束しない — 階の並びが要るときは必ずこれを通す。

```ts
import { heff, levelsSorted } from "@kensnzk/koyu";
console.log(heff(m, m.spaces.get("/home/ldk")!), levelsSorted(m).map((l) => `${l.name}@${l.z}`));
```

```text
2400 [ 'L1@0', 'L2@2900', 'R@5800' ]
```

## 採光の入力

### daylightInputs

```ts
function daylightInputs(model: Model): DaylightInput[]

interface DaylightInput {
  space: Space;
  floor: number;      // 床面積 m²
  window: number;     // 有効窓面積 m² (係数適用後)
  missingH: boolean;  // h 未指定で数えられなかった窓があるか
}
```

**対象は `daylight:1` を書いた空間だけで、型は見ない。**「どの室に採光の問いを掛けるか」は書き手の宣言である。

係数は「窓の先が何か」の導出である。外部に直接面すれば 1.0、庇下の半屋外 (上に空間がある) 越しなら 0.7、上が開いた半屋外越しなら 1.0、それ以外は 0 (数えない)。**この係数は形の導出であって判定ではない。**

**返るのは数だけで、`ok` も `need` も無い。**1/7 という線を引くのは建築の側の判断であり、[`validate`](validate.md) の `daylight.ratio` が言う。

```ts
import { daylightInputs } from "@kensnzk/koyu";

for (const d of daylightInputs(m)) {
  console.log(`${d.space.path} floor=${d.floor} window=${d.window.toFixed(2)} missingH=${d.missingH}`);
}
```

```text
/home/ldk floor=39.75 window=7.54 missingH=false
/home/bed1 floor=26.5 window=5.72 missingH=false
```

**対象が一つも無ければ空配列が返る。**「全部合格」と区別が付かないので、`length` を見ること。`missingH` が真なら窓面積は数え切れていない — その数を判定に使ってはならない。

## 敷地

### siteReport

```ts
function siteReport(model: Model): SiteReport

interface SiteReport {
  siteZone?: Zone;
  polygon?: SitePolygon;
  declaredArea?: number;  // ゾーンの area: (測量値) m²
  derivedArea: number;    // 導出 m²
  footprint: number;      // 建築面積 (水平投影) m²
  totalFloor: number;     // 延べ面積 m²
  roads: RoadFrontage[];
}

interface RoadFrontage {
  road: Space;
  width: number;      // 幅員 mm (road: 属性)
  frontage: number;   // 接道長 mm (導出)
}
```

敷地は **`site:1` を持つゾーン**、道路は **`road:<幅員mm>` を持つ `exterior` の空間**である。

`derivedArea` は敷地形状 (`polygon`) があればその多角形の面積、無ければ敷地内空間と屋内空間の水平投影の合併である。`footprint` は屋内空間の**導出された形**の水平投影の合併 — 割付から数えると、隅切りで落とした分まで数えてしまう。

**接道長は敷地と道路の境界線分の長さの合計である。**建物の外壁が道路に面していても、それは接道ではない。

**建蔽率も容積率も返らない。**それらはこの数の商であり、分母をどう取るかは制度の側の話だからである。

```ts
import { siteReport } from "@kensnzk/koyu";

const r = siteReport(m);
console.log({ zone: r.siteZone?.path, declared: r.declaredArea, derived: r.derivedArea,
  footprint: r.footprint, totalFloor: r.totalFloor,
  roads: r.roads.map((x) => ({ path: x.road.path, width: x.width, frontage: x.frontage })) });
```

```text
{
  zone: '/site',
  declared: 126.24,
  derived: 126.24,
  footprint: 53,
  totalFloor: 92.75,
  roads: [ { path: '/out/road', width: 6000, frontage: 10280 } ]
}
```

`declaredArea` と `derivedArea` の食い違いを咎めるのは判定の側 (`site.area`) である。ここは二つの数を並べるだけである。

## 柱

### columnsFor

```ts
function columnsFor(model: Model, level: string): Column[]
```

そのレベルに立つ柱を導く。**位置はどこにも書かれていない** — 通り芯の交点のうち、床のある空間 (`exterior` と `void` を除く) の内側にあるものへ柱が置かれる。

**空しか支えない床には柱を立てない。**半屋外で、かつ上に床も無い空間 — 屋上庭園やテラス — は母集団から外れる。柱が持ち上げるものを持たないからである。

**同じ交点に二本は立たない。**複数の宣言が同じ交点を狙ったら、先の宣言が勝つ。

```ts
import { columnsFor } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const c = parseFile("examples/complex/main.muro");
const cols = columnsFor(c, "L1");
console.log(cols.length, cols[0]);
```

```text
46 {
  x: 0,
  y: 0,
  w: 900,
  d: 900,
  level: 'L1',
  grid: 'X1/Y1',
  decl: 0,
  attrs: {}
}
```

`grid` は立っている通りの組で、図面の言葉そのままである。`decl` は `model.columns` の添字で、**どの宣言から立ったか**を言う — これがあるので「この宣言に対して一本も立たない」を問える。

## 表示のための小物

### effectiveUse

```ts
function effectiveUse(model: Model, s: Space): string | undefined
```

実効の `use` 属性。空間自身に無ければ、**最も深いゾーンの祖先**から継承する。

### displayName

```ts
function displayName(s: Space): string
```

`name:` 属性、無ければパスの末尾セグメントを返す。**必ず文字列が返る。**

```ts
import { displayName, effectiveUse } from "@kensnzk/koyu";
console.log(effectiveUse(m, m.spaces.get("/home/ldk")!), displayName(m.spaces.get("/home/ldk")!));
```

```text
exclusive LDK
```

## 関連

- [Model と構成型](model.md) — 問いが読んでいる型
- [検証](validate.md) — この数に閾値を掛ける面
- [形の導出](derive.md) — 数ではなく形が要るとき
- [`koyu doors`](../cli/doors.md) / [`koyu light`](../cli/light.md) / [`koyu site`](../cli/site.md) — 同じ問いをコマンドラインから
