---
title: Model と構成型
mode: reference
---

# Model と構成型

`Model` は `.muro` を読んで合成した結果である。**書かれた構成がそのまま入っていて、形はほとんど入っていない** — 壁の位置も、床も、屋根も、柱の座標も、ここには無く、[`derive`](derive.md) が規則から起こす。

型はすべて `@kensnzk/koyu` から出ている。値を持たない純粋な型なので `import type` で引ける。

```ts
import type { Model, Space, Boundary, Opening, Pt } from "@kensnzk/koyu";
```

## Model

```ts
interface Model {
  version: string;
  name?: string;
  unit: "mm";
  grid: { X: GridAxis; Y: GridAxis };
  levels: Record<string, Level>;
  spaces: Map<string, Space>;
  zones: Map<string, Zone>;
  assets: Map<string, Asset>;
  boundaries: Boundary[];
  polygons: Map<string, SitePolygon>;
  columns: ColumnDecl[];
  layers: string[];
  attrSrc: Map<string, number>;
  versionDeclared?: boolean;
  compositionEdits: CompositionEdit[];
}
```

**単位は mm の一つだけである。**`unit` は常に `"mm"` で、他の値を取らない。座標も寸法もすべて mm の数で、面積を返す関数だけが ㎡ を返す。

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log({
  version: m.version, name: m.name, unit: m.unit,
  levels: Object.keys(m.levels),
  spaces: m.spaces.size, zones: m.zones.size, assets: m.assets.size,
  boundaries: m.boundaries.length, polygons: m.polygons.size,
  columns: m.columns.length, layers: m.layers.length,
});
```

```text
{
  version: '1.0',
  name: '小さな戸建住宅',
  unit: 'mm',
  levels: [ 'L1', 'L2', 'R' ],
  spaces: 13,
  zones: 2,
  assets: 6,
  boundaries: 31,
  polygons: 0,
  columns: 0,
  layers: 5
}
```

`version` は言語版で、宣言が無ければ既定 (`1.0`) が入る。**宣言されたかどうかは `versionDeclared` が別に持つ** — [正準JSON](canonical.md) はこれを見て `koyu` キーを出すか決める。受理される版の一覧は [言語版](versions.md)。

### layers — 層の強度順序

`layers` は合成に参加したレイヤーの一覧である。**この並びが層の強度順序である** — 添字0の entry が最も弱く、**後の層ほど強い。**並びは `import` 行を深さ優先で平坦化した順で、同じ層が二度現れれば最初の位置を保つ。単一ソースの `parse` では空になる。

```ts
const m = parseFile("examples/house/main.muro");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")));
```

```text
[
  'examples/house/main.muro',
  'examples/house/assets.muro',
  'examples/house/site.muro',
  'examples/house/L1.muro',
  'examples/house/L2.muro'
]
```

入るのは**解決済みの絶対パス**である (上の出力は見やすさのために cwd を削っている)。診断の `file` フィールドもこの値である。

### attrSrc — 属性ごとの出所

`attrSrc` のキーは `<種別>:<対象>:<属性キー>`、値は `layers` の添字である。**最終的な値をどの層が与えたかを言えるようにするためにある。**強い層の意見だけを通す `over` はここを読む — 走査の順ではなく強度で決まる。

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 name:居室 floor:オーク
import ./finish.muro`,
  "finish.muro": `over /L1/a floor:タイル`,
}, "main.muro");

console.log(m.layers);
console.log(m.spaces.get("/L1/a")!.attrs);
console.log([...m.attrSrc.entries()]);
console.log(m.compositionEdits);
```

```text
[ 'main.muro', 'finish.muro' ]
{ name: '居室', floor: 'タイル' }
[ [ 'space:/L1/a:floor', 1 ] ]
[
  {
    word: 'over',
    subject: '/L1/a floor:タイル',
    line: 1,
    file: 'finish.muro'
  }
]
```

`compositionEdits` は `over` / `drop` / 集合編集 (`+` `-` `=`) が書かれた箇所の列である。**上書きの跡は合成後のモデルにも正準JSONにも残らない**ので、旧い言語版のファイルが新しい語を使っているのを診断が捕まえるために、ここだけが宣言の出所を走査の順に持つ。導出も正準形もこれを読まない。

## GridAxis / GridRef / Rect / Pt / Edge

```ts
interface GridAxis { names: string[]; coords: number[] }  // 通り名と座標 mm (同順)
interface GridRef { xa: string; xb: string; ya: string; yb: string }
interface Rect { x1: number; y1: number; x2: number; y2: number }  // x1<x2, y1<y2
interface Pt { x: number; y: number }
type Edge = "N" | "E" | "S" | "W";
```

通り名は宣言順に `X1` `X2` … と振られる。**名は位置から読まれる**ので、座標を途中に挿すと以降の名が付け替わる。

```ts
console.log(m.grid);
```

```text
{
  X: { names: [ 'X1', 'X2', 'X3' ], coords: [ 0, 3640, 7280 ] },
  Y: { names: [ 'Y1', 'Y2', 'Y3' ], coords: [ 0, 3640, 7280 ] }
}
```

`Edge` の方角は **N=+Y・S=−Y・E=+X・W=−X** である。X は東が正、Y は北が正。`edge` を書いた要素は「最初に書いた空間の矩形から見た辺」を指す。

## Attrs / AttrValue

```ts
type AttrValue = string | number;
type Attrs = Record<string, AttrValue>;
```

属性の値は文字列か数である。**数に見える綴りは数として入る** — `h:2400` は `2400` であって `"2400"` ではない。真偽値は無く、`daylight:1` のように `0` / `1` で書く。

どの鍵を書いてよいかは台帳が定める。台帳に無く名前空間も持たない鍵は `ATT03` のエラーになる — [属性の三層](../muro/attributes.md)。

## Level

```ts
interface Level {
  name: string;
  z: number;          // FL の高さ mm
  h?: number;         // 階の基準天井高 mm
  slab?: number;      // 床組み厚 mm (下階の天井面から自階FLまで)
  underground?: boolean;
  line: number;
  file?: string;
}
```

**地下は `z` の負値から推定しない。**地盤面は敷地の事実であって座標系の原点の事実ではないので、`underground` は宣言である。地上/地下の床面積の集計と矩計の表示がこれを読む。

```ts
console.log(m.levels["L1"]);
```

```text
{
  name: 'L1',
  z: 0,
  line: 14,
  file: '/Users/…/examples/house/main.muro',
  h: 2400,
  slab: 400
}
```

`line` と `file` はどの要素にも付いている。**出所を持たない宣言は無い** — 診断が位置を言えるようにするためである。

(この頁に貼った出力の `/Users/…/` は、解決済みの絶対パスを紙面のために縮めた表記である。実際には省略の無いフルパスが入る。)

## Space

```ts
interface Space {
  path: string;
  type: string;
  level?: string;
  grids: GridRef[];
  rects: Rect[];
  pieces: Pt[][];
  areas: Area[];
  attrs: Attrs;
  line: number;
  file?: string;
}
```

**パスが同一性である。**`/L1/a` のように人間が読める階層で名指し、パスの第一義は集計の階層である。レベルは既定でパスの先頭セグメントから読むが、階を跨ぐくくり (メゾネット) は `level:` 属性で明示する。

`type` は開かれた語彙である (`room` `corridor` `exterior` `void` …)。構造的に解釈されるのは `exterior` (外部) と `void` (床面積に算入しない) の二語だけで、残りは書き手の言葉として運ばれる。

**`rects` と `pieces` は別のものである。**

- `rects` は**書かれた割付** — グリッド参照 (`grids`) を解決した mm 矩形の列。L字などは複数の矩形の合併として書かれる。
- `pieces` は**導出された領域** — 凸片の集合。既定は `rects` を写したものだが、境界に線が描かれていればその半平面で切り分けた結果になる。

**面積・平面図・立体はすべて `pieces` を読む。**`rects` は「書かれた綴り」として正準JSONに残る。領域を持たない空間 (`exterior` など) では両方とも空になる。

```ts
console.log(m.spaces.get("/home/ldk"));
```

```text
{
  path: '/home/ldk',
  type: 'ldk',
  level: 'L1',
  grids: [
    { xa: 'X1', xb: 'X2', ya: 'Y1', yb: 'Y3' },
    { xa: 'X2', xb: 'X3', ya: 'Y1', yb: 'Y2' }
  ],
  rects: [
    { x1: 0, x2: 3640, y1: 0, y2: 7280 },
    { x1: 3640, x2: 7280, y1: 0, y2: 3640 }
  ],
  pieces: [
    [ [Object], [Object], [Object], [Object] ],
    [ [Object], [Object], [Object], [Object] ]
  ],
  areas: [],
  attrs: { name: 'LDK', floor: 'オーク', daylight: 1 },
  line: 3,
  file: '/Users/…/examples/house/L1.muro'
}
```

## Area

```ts
interface Area {
  grid: { xa: string; xb: string; ya: string; yb: string };
  rect: Rect;
  attrs: Attrs;
  line: number;
}
```

**数えない分節である。**室に従属する領域 (床材の切替など) を表し、面積にも室数にも空間グラフにも一切現れない。運ぶのは属性の上書きだけである。

```ts
import { parseFile } from "@kensnzk/koyu/node";
const o = parseFile("examples/office.muro");
const s = [...o.spaces.values()].find((x) => x.areas.length > 0)!;
console.log(s.path, s.areas[0]);
```

```text
/L1/hall {
  grid: { xa: 'X1', xb: 'X1+1800', ya: 'Y1', yb: 'Y2' },
  rect: { x1: 0, x2: 1800, y1: 0, y2: 6400 },
  attrs: { name: '土間', floor: 'モルタル' },
  line: 20
}
```

## Zone

```ts
interface Zone {
  path: string;
  attrs: Attrs;
  line: number;
  file?: string;
}
```

**数える集約である。**住戸・部門といった空間の上位のくくりで、**幾何を持たない** — 面積はパス接頭辞で束ねた空間の合計として [`zoneAreaM2`](queries.md#zoneaream2) が導く。

```ts
console.log(m.zones.get("/home"));
```

```text
{
  path: '/home',
  attrs: { name: '住戸', use: 'exclusive' },
  line: 23,
  file: '/Users/…/examples/house/main.muro'
}
```

## Asset

```ts
interface Asset {
  name: string;
  kind: "door" | "window";
  attrs: Attrs;
  line: number;
  file?: string;
}
```

建具の**型の宣言**である。`asset SD1 door w:800 style:sliding` と宣言し、開口が `door SD1 …` で参照する。インスタンス側の属性が上書きする。別ファイル (アセット集) に置いて `import` できる。

```ts
console.log([...m.assets.values()][0]);
```

```text
{
  name: 'D1',
  kind: 'door',
  attrs: { w: 900, h: 2100, style: 'hinged', name: '玄関ドア' },
  line: 4,
  file: '/Users/…/examples/house/assets.muro'
}
```

## BoundaryKind

```ts
type BoundaryKind = "wall" | "open" | "stair" | "shaft" | "void";
```

**kind が言うのは関係のトポロジーだけである。**手すり・カーテンウォールといった「実現する物」は kind に入らない — それは属性の言葉である。

| kind | 向き | 意味 | 通れるか |
|---|---|---|---|
| `wall` | 水平 | 物がある | 扉があるときだけ |
| `open` | 水平 | 何もない | 通れる |
| `stair` | 垂直 | 階段 | 通れる |
| `shaft` | 垂直 | EV等 — 空間として連続するが人は通れない | 通れない |
| `void` | 垂直 | 吹抜け — 床の不在 | 通れない |

**垂直の既定は床 (slab) であり、書かない。**レベルの `slab` 宣言が一括で与える。水平の既定は壁で、これも書かない — 接する空間の組に宣言が一つも無ければ `kind:"wall"` の境界が導出される。

## Boundary

```ts
interface Boundary {
  a: string;
  b: string;
  kind: BoundaryKind;
  drawn?: DrawnLine;
  t?: number;          // 壁厚 mm (芯振り分け)
  air?: boolean;       // 遮蔽しない (手すり・柵)
  edge?: Edge;
  attrs: Attrs;
  openings: Opening[];
  segs: Seg[];
  line: number;
  file?: string;
  derived?: boolean;
}
```

**境界はどちらの空間にも属さない。**二つの空間パスを結ぶ第一級の関係である。壁の位置は書かれない — 空間の割付から導出される ([`segmentsFor`](derive.md#segmentsfor))。

`air:1` は**遮蔽しないこと**を言う。手すり・柵のように物はあるが外気と光を遮らないもので、通行可能性とは別の軸である (扉の無い `wall` は `air:1` でも通れない)。**外部に対して `open` または `air:1` の境界を持つ空間が半屋外と導出される。**

`derived: true` は接触から導かれた既定境界の印である。**正準JSONには出ない** — 書かれた構成ではないからである。

```ts
console.log(m.boundaries.find((b) => b.openings.length > 0));
```

```text
{
  a: '/site/garden',
  b: '/out/road',
  kind: 'wall',
  t: 120,
  air: true,
  edge: 'S',
  attrs: { spec: 'ブロック塀+フェンス', h: 1200 },
  openings: [
    {
      kind: 'door',
      ref: 'GT1',
      w: 900,
      h: 1200,
      at: 0.5,
      atRef: 'X2',
      atAbs: 3640,
      atAxis: 'X',
      attrs: [Object],
      line: 24
    }
  ],
  segs: [],
  line: 23,
  file: '/Users/…/examples/house/site.muro'
}
```

`a` と `b` の向きが意味を持つのは `edge` と `swing` だけである。**形はそれに従わない** — 二空間のどちらを先に書いても、導出される凸片も壁線分も同じである。

## Opening

```ts
interface Opening {
  kind: "door" | "window";
  ref?: string;        // 参照した建具アセット名
  w: number;           // 幅 mm
  h?: number;          // 高さ mm
  at: number;          // 区間上の位置 0..1 (既定 0.5)
  atRef?: string;      // 明示位置の綴り (at:X2+450)
  atAbs?: number;      // その解決値 mm
  atAxis?: "X" | "Y";
  edge?: Edge;
  hinge?: Edge;        // 吊元の側
  swing?: "a" | "b";   // 開く側
  attrs: Attrs;
  line: number;
}
```

**比率の `at` は線分に収まるようクランプされる。**通り参照 (`atAbs`) はクランプされず、はみ出しはエラーになる — 書いた位置が黙って動くことは無い。

`hinge` は線分の向きで許される値が決まる (水平線分なら `W`/`E`、垂直線分なら `S`/`N`)。既定は始端側。`swing` は境界の a 側 / b 側で、既定は領域を持つ方 (a を先に見る)。

## Seg

```ts
interface Seg {
  w: number;
  at: number;
  atRef?: string;
  atAbs?: number;
  atAxis?: "X" | "Y";
  edge?: Edge;
  attrs: Attrs;
  line: number;
}
```

**境界上の数えない分節である。**壁材が途中から変わる区間など。位置の書き方は開口と同じだが、**通行にも接続にも一切影響しない。**

```ts
const b = o.boundaries.find((x) => x.segs.length > 0)!;
console.log(b.a, b.b, b.segs[0]);
```

```text
/L1/office /L1/corridor { w: 3600, at: 0.75, attrs: { spec: 'ガラスパーティション' }, line: 34 }
```

## DrawnLine

```ts
interface DrawnLine {
  aRef: string;    // 書かれた綴り
  bRef: string;
  a: Pt;           // 解決座標 mm
  b: Pt;
  line: number;
  effect?: "cut" | "nothing" | "undetermined";
}
```

**空間を区切る設計の行為そのものである。**端点は通り語 (`X3,Y1` / `X3+600,Y2-900`) で書く — 生座標も角度も無い。境界が既定で持つ「隣接から導かれる線分」を、この線が置き換える。

**線分は向きを持たない。**同じ二点を結ぶ線はどちらの端から書いても同じ線なので、解析の出口で端点は解決座標の昇順 (x, then y) に揃えられる。`aRef` / `bRef` も一緒に入れ替わるので、診断が引用する綴りは書かれたとおりのまま並び替わる。揃えないと、開口の `at:` の起点が書き順で決まってしまい、**正準JSONがバイト同一のまま扉が別の位置に出る。**

`effect` は**切り分けの帰結**で、導出したその場で記録される。

| `effect` | 意味 |
|---|---|
| `"cut"` | 実際に形を切った |
| `"nothing"` | 何も切らなかった (`LIN03` の警告になる) |
| `"undetermined"` | 残す側が決まらない (`LIN01` のエラーになる) |

**正準JSONには出ない** — 書かれた構成ではなく導出の帰結だからである。後から計算し直すと、既に切られた形を相手に見ることになって母集団が食い違うので、判定と操作が同じ場所で同じ母集団を見るようになっている。

```ts
const c = parseFile("examples/complex/main.muro");
const dl = c.boundaries.find((b) => b.drawn)!;
console.log({ a: dl.a, b: dl.b, kind: dl.kind, drawn: dl.drawn });
```

```text
{
  a: '/L1/w04',
  b: '/out',
  kind: 'wall',
  drawn: {
    aRef: 'X1,Y5+2000',
    bRef: 'X2,Y6',
    a: { x: 0, y: 34000 },
    b: { x: 8000, y: 40000 },
    line: 44,
    effect: 'cut'
  }
}
```

## ColumnDecl / Column

```ts
interface ColumnDecl {
  size: number;        // 一辺 mm
  depth?: number;      // 矩形断面の奥行 mm
  levels: string[];    // 展開済みレベル名 (z 昇順)
  xNames?: string[];   // 限定する通り名。未指定は全通り
  yNames?: string[];
  attrs: Attrs;
  line: number;
  file?: string;
}

interface Column {
  x: number; y: number;
  w: number; d: number;
  level: string;
  grid: string;        // 立っている通りの組 (X3/Y2)
  decl: number;        // どの宣言から立ったか (model.columns の添字)
  attrs: Attrs;
}
```

**位置は書かれない。**宣言が言うのは「どの通りに、どの階に、どの寸法で」だけで、柱は通り芯の交点のうちその階の床のある所に立つ。壁が境界から現れるのと同じ構えを、点の要素に適用したものである。

`model.columns` に入るのは宣言 (`ColumnDecl`) であり、立った柱 (`Column`) は [`columnsFor`](queries.md#columnsfor) が導く。

**宣言の順は意味である。**同じ交点に二本は立たず、先の宣言が勝つ。だから正準JSONも差分も宣言順を保つ — 二行を入れ替えると実際に立つ柱が変わる。

```ts
const c = parseFile("examples/complex/main.muro");
console.log(c.columns[0]);
```

```text
{
  size: 900,
  levels: [
    'B2', 'B1', 'L1',
    'L2', 'L3', 'L4',
    'L5', 'L6'
  ],
  attrs: {},
  line: 45,
  file: '/Users/…/examples/complex/main.muro'
}
```

## SitePolygon

```ts
interface SitePolygon {
  path: string;
  points: Pt[];
  line: number;
  file?: string;
}
```

測量に由来する所与の多角形である。**モデルの中で唯一の自由頂点列** — 空間の領域はグリッド参照の矩形として書かれるので、頂点を直接並べられるのはここだけである。`site:1` を持つゾーンに対応させる。

```ts
const p = [...c.polygons.values()][0]!;
console.log({ path: p.path, points: p.points.length, first: p.points[0], line: p.line });
```

```text
{ path: '/site', points: 10, first: { x: -6000, y: -8000 }, line: 7 }
```

## 関連

- [解析と合成](parsing.md) — この型を作る五つの入口
- [形の導出](derive.md) — この型から形を起こす
- [正準JSON](canonical.md) — この型を機械形式へ落とす
- [記法リファレンス](../muro/index.md) — 同じ構成を `.muro` の側から見る
