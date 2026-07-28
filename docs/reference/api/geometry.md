---
title: 幾何の小物
mode: reference
---

# 幾何の小物

多角形と矩形を扱う五つの関数である。座標は mm、面積は ㎡ で返る。

```ts
import { envelopeGaps, pointInPolygon, polyBounds, polygonAreaM2, rectToPoly } from "@kensnzk/koyu";
```

**ここに判定は一つも無い。**「建物が敷地からはみ出しているか」も「外皮に穴があるか」も、ここには答えが無い — それは [`validate`](validate.md) の `site.escape` と `envelope.gap` が言う。ここにあるのは、その判定が読む数と形だけである。

## polygonAreaM2

```ts
function polygonAreaM2(points: Pt[]): number
```

シューレース公式による多角形の面積を ㎡ で返す。**巻き方向を問わない** — 符号付き面積の絶対値なので、時計回りでも反時計回りでも同じ値になる。

## pointInPolygon

```ts
function pointInPolygon(p: Pt, poly: Pt[], eps?: number): boolean
```

点が多角形の内側にあるか。**境界の上は内側扱いである。**`eps` は「辺の上にあるとみなす幅」で、既定は 1mm。

## polyBounds

```ts
function polyBounds(poly: Pt[]): Rect
```

頂点列の外接矩形。

## rectToPoly

```ts
function rectToPoly(r: Rect): Pt[]
```

矩形を頂点列へ。**反時計回り**で、`(x1,y1) → (x2,y1) → (x2,y2) → (x1,y2)` の順である。

**この巻き方向は約束である。**辺の向きから方角を読む導出 (+x へ進む辺が南、+y が東、−x が北、−y が西) がこの順に依存している。

```ts
import { pointInPolygon, polyBounds, polygonAreaM2, rectToPoly } from "@kensnzk/koyu";

const poly = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }];
console.log(polygonAreaM2(poly), pointInPolygon({ x: 5000, y: 5000 }, poly),
  pointInPolygon({ x: 12000, y: 0 }, poly), pointInPolygon({ x: 0, y: 5000 }, poly), polyBounds(poly));
console.log(polygonAreaM2([...poly].reverse()));
console.log(rectToPoly({ x1: 0, y1: 0, x2: 3600, y2: 4000 }));
```

```text
100 true false true { x1: 0, x2: 10000, y1: 0, y2: 10000 }
100
[
  { x: 0, y: 0 },
  { x: 3600, y: 0 },
  { x: 3600, y: 4000 },
  { x: 0, y: 4000 }
]
```

三つ目の `pointInPolygon` は辺のちょうど上の点で、**真が返っている。**巻き方向を逆にしても面積は変わらない。

## envelopeGaps

```ts
function envelopeGaps(model: Model, s: Space): Segment[]
```

空間の外周のうち、**何にも面していない区間**を返す。他の空間とも、宣言された外部境界とも向かい合っていない縁 — **外皮の穴**である。

既定境界は領域を持たない空間との間には導かれないので、**外部への境界の書き忘れは黙って壁の不在になる。**これを言葉にするための導出である。

長さが `SPAN_EPS` (1mm) 以下の区間は落とされる。領域を持たない空間、レベルの決まらない空間では空配列が返る。

```ts
import { envelopeGaps, parse } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W`);

for (const s of ["/L1/a", "/L1/b"]) {
  console.log(s, envelopeGaps(g, g.spaces.get(s)!).map((x) => `${x.edgeOfA} ${x.x1},${x.y1}→${x.x2},${x.y2}`));
}
```

```text
/L1/a [ 'S 0,0→3600,0', 'N 0,4000→3600,4000' ]
/L1/b [ 'S 3600,0→7200,0', 'E 7200,0→7200,4000', 'N 3600,4000→7200,4000' ]
```

`/L1/a` の W 辺は `boundary /L1/a /out edge:W` が覆い、E 辺は `/L1/b` が向かい合っているので、残った S と N が穴として出ている。

返るのは [`Segment`](derive.md#segmentsfor) — 端点と、水平かどうかと、`a` 側から見た辺の方角である。**長さは持たない**ので、要るなら端点から測る。

## 幾何の許容値

**「どれだけ違えば別のものか」を決める数は一箇所に集めてある。**[`TOLERANCES`](derive.md#tolerances) を見る。点が辺の上にあるとみなす幅の既定 (`POINT_EPS` = 1mm) も、外皮の穴の長さの下限 (`SPAN_EPS` = 1mm) もそこにある。

## 関連

- [形の導出](derive.md) — `Segment` と許容値の台帳
- [モデルへの問い](queries.md) — 面積と敷地の数
- [検証](validate.md) — この形に判定を掛ける面
