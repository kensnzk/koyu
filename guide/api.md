# TypeScript API リファレンス

`@kensnzk/koyu` をプログラムから使うための頁である。**やりたいことの側から並べてある** — 記号の一覧ではなく、読み込む・検査する・問う・導出の部品を借りる・生成する・比べる、という順で引く。契約の要約は [spec/tools.md](../spec/tools.md) が持ち、答えの定義は [spec/semantics.md](../spec/semantics.md) が持つ。ここはその呼び方である。

CLI が答えるものはすべてこのAPIが答える。CLI・MCP・API は同じ導出の別の入口であり、**どれかにしか無い答えというものは無い。**

## 最初のプログラム

読み込み、検査し、面積を出す。これだけで一巡している。

```ts
import { checkDiagnostics, areaM2 } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/two-rooms.muro");

const diags = checkDiagnostics(model);
console.log(`${model.name} — 空間 ${model.spaces.size} / 診断 ${diags.length}件`);
for (const d of diags) console.log(`${d.severity} ${d.code} ${d.message}`);

for (const s of model.spaces.values()) {
  console.log(`${s.path}\t${s.type}\t${areaM2(s) ?? "-"}`);
}
```

```text
二室一扉 — 空間 3 / 診断 0件
/L1/a	room	16.2
/L1/b	room	16.2
/out	exterior	-
```

`model.spaces` は `Map<string, Space>` で、`model.boundaries` は `Boundary[]` である。**パスが空間の同一性**であり、境界はどちらの空間にも属さない第一級の関係として配列に並ぶ。

## 二つの入口

```ts
import { /* … */ } from "@kensnzk/koyu";        // ブラウザ安全
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";  // node:fs を引く
```

**ルートのエントリは `node:fs` を引かない。** ブラウザやワーカーでそのまま動く。ファイルシステムを触る入口だけが `@kensnzk/koyu/node` に分離してある。分けてあるのは、パーサ本体を純粋に保つためである — 合成 (`import` の解決) は「レイヤーをどう読むか」という関数を外から受け取る形になっていて、fs はその実装の一つでしかない。ブラウザは仮想ファイル群 (`parseFiles`) や独自ローダー (`parseWith`) を渡す ([ADR-0010](../docs/decisions/0010-assets-and-composition.md))。

ルートから出ている実行時の値は 47、`/node` から 2 である。以下はその全部を扱う。

## 読み込む・合成する

`.muro` のテキストから `Model` を作る。どれも合成 (`import`) の解決の仕方が違うだけで、出てくる `Model` は同じ形である。**既定境界の導出はどの入口でも出口で適用済みである** ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。

### parse — 単一のソース文字列

```ts
function parse(source: string): Model
```

一枚のテキストを読む。`import` は解決できないのでエラーになる。テスト・スクラッチ・文字列を組み立てる場面向け。

```ts
import { parse } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2`);
console.log(m.spaces.size, m.version, m.layers);
```

```text
1 0.3 []
```

`model.layers` は合成に参加したレイヤーの一覧 (合成順、entry が先頭) である。`parse` は単一ソースなので空になる。

### parseFiles — 仮想ファイル群

```ts
function parseFiles(files: Record<string, string>, entry: string): Model
```

キーと中身の対応表を渡す。`import` はそのキー空間の中で解決される。**ブラウザ向けの標準の入口**である (エディタのバッファをそのまま渡せる)。

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600 7200\ngrid Y 0 4000\nlevel L1 0\nimport ./L1.muro`,
  "L1.muro": `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`,
}, "main.muro");
console.log(m.spaces.size, m.layers);
```

```text
2 [ 'main.muro', 'L1.muro' ]
```

### parseWith — 独自ローダー

```ts
type LayerLoader = (
  fromKey: string | undefined,
  ref: string,
) => { key: string; src: string };

function parseWith(loader: LayerLoader, entry: string): Model
```

レイヤーの読み方そのものを差し替える。`fromKey` が `undefined` のときは entry 自身の解決である。返す `key` が同一性で、同じキーは一度しか合成されない (二重 `import` と循環は冪等)。HTTP から引く、DB から引く、といった入口はここに載る。

```ts
import { parseWith } from "@kensnzk/koyu";

const src: Record<string, string> = {
  e: `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`,
};
const m = parseWith((_from, ref) => ({ key: ref, src: src[ref]! }), "e");
console.log(m.spaces.size, m.layers);
```

```text
1 [ 'e' ]
```

### parseFile — ファイルシステム (node専用)

```ts
function parseFile(filePath: string): Model
```

`import` は**書かれたファイルからの相対**で解決される。CLI が使っているのもこれである。

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log(m.name, m.spaces.size, m.layers.length + "レイヤー");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")).join("\n"));
```

```text
小さな戸建住宅 13 5レイヤー
examples/house/main.muro
examples/house/assets.muro
examples/house/site.muro
examples/house/L1.muro
examples/house/L2.muro
```

`model.layers` に入るのは**解決済みの絶対パス**である (上の例では見やすさのために cwd を削っている)。診断の `file` フィールドもこの値である。

### parseFileWith — 差し替えつきの合成 (node専用)

```ts
function parseFileWith(
  filePath: string,
  overlay?: (absPath: string) => string | undefined,
): Model
```

`overlay` が文字列を返したパスは、ディスクの内容の代わりにそれが合成される。**書き込み前の門番**がこれを使う — 「この内容で保存したら壊れないか」を、保存せずに検査できる。

```ts
import { parseFileWith } from "@kensnzk/koyu/node";

const m = parseFileWith("examples/two-rooms.muro", (abs) =>
  abs.endsWith("two-rooms.muro")
    ? `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:差し替え`
    : undefined);
console.log(m.spaces.get("/L1/a")!.attrs["name"]);
```

```text
差し替え
```

### tokenize — 一行を分解する

```ts
function tokenize(line: string, ln: number): string[]
```

字句だけを取り出す。引用符とコメントを処理する。エディタの補完・シンタックスハイライトの類が使う低レベルの部品である。

```ts
import { tokenize } from "@kensnzk/koyu";
console.log(tokenize('space /L1/a room X1..X2 Y1..Y2 name:"居 室" # コメント', 1));
```

```text
[ 'space', '/L1/a', 'room', 'X1..X2', 'Y1..Y2', 'name:居 室' ]
```

## 検査する

### checkDiagnostics — 一次の形

```ts
function checkDiagnostics(model: Model): Diagnostic[]

interface Diagnostic {
  code: string;                 // 台帳 DIAGNOSTIC_CODES のコード
  severity: "error" | "warning";
  message: string;              // 日本語の本文 (位置接頭辞を含まない)
  line?: number;
  file?: string;                // 合成時の出所レイヤー
  path?: string[];              // 対象の空間/ゾーンのパス (境界は両方)
  related?: Array<{ line: number; file?: string }>;
}
```

**これが `check` の一次形式である。** 構造化して扱うならこちらを使う ([ADR-0016](../docs/decisions/0016-diagnostic-contract.md))。`message` は本文だけで、位置は `line` / `file` が別に持つ。

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const model = parse(`grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120`);
console.log(JSON.stringify(checkDiagnostics(model), null, 1));
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "空間が接していないため境界を導けません: /L1/a | /L1/b",
  "line": 6,
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

**`checkDiagnostics` は投げない。** 構文・合成エラーは `parse` 系が `SourceError` として投げるので、そちらは呼び出し側で捕まえる。診断の一件一件が何を意味し、どう直すかは [diagnostics.md](diagnostics.md)。

### check — 互換の文字列形式

```ts
function check(model: Model): CheckResult

interface CheckResult {
  errors: string[];
  warnings: string[];
}
```

`checkDiagnostics` と**同件・同順**で、位置接頭辞 (`ファイル:N行目: `) を組み立てた文字列を返す。人にそのまま見せる用途向け。

```ts
import { check } from "@kensnzk/koyu";
const { errors, warnings } = check(model);
console.log(errors, warnings);
```

```text
[ '6行目: 空間が接していないため境界を導けません: /L1/a | /L1/b' ] []
```

(この例は `parse` で読んだので出所ファイルが無く、接頭辞が行番号だけになっている。`parseFile` で読めば `<絶対パス>:6行目: ` が付く。)

### DIAGNOSTIC_CODES — コードの台帳

```ts
const DIAGNOSTIC_CODES: Record<string, "error" | "warning">
```

全コードと規範 severity の対応。**severity はコードの不変属性である** — 重さが変わるときは新しいコードが切られるので、この表を持って分岐を書いてよい。

```ts
import { DIAGNOSTIC_CODES } from "@kensnzk/koyu";
const codes = Object.keys(DIAGNOSTIC_CODES);
console.log(codes.length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "error").length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "warning").length);
console.log(DIAGNOSTIC_CODES["BND04"], DIAGNOSTIC_CODES["BND07"]);
```

```text
49 34 15
error undefined
```

`BND07` は欠番なので `undefined` になる ([diagnostics.md](diagnostics.md#bnd07))。

## 問う

同じ記述を、違う読み方で読む。

### doorsBetween — 扉を何枚通るか

```ts
function doorsBetween(model: Model, from: string, to: string): Route | undefined
interface Route { doors: number; path: string[] }
```

空間グラフ上の最少扉数の経路。**到達できないときも、パスが存在しないときも `undefined` を返す。** 区別したいなら `model.spaces.has(path)` を先に見る。

```ts
import { doorsBetween } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
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

**`checkDiagnostics` が空でも、建物が閉じていることはある。** 接する空間の既定は壁で、壁は扉が無ければ通れないので、扉を一枚も書かなくても診断は出ない。動線が繋がっているかはこの関数で確かめる。

### neighbors / passable — 隣は何か

```ts
function neighbors(model: Model, path: string): NeighborInfo[]
interface NeighborInfo {
  space: Space;
  boundary: Boundary;
  passable: boolean;
  doors: number;    // その境界に載る door の数
}

function passable(b: Boundary): boolean
```

`neighbors` は**導出された既定境界も含めて**返す。`passable` は境界一つの通行可能性を言う: `open` と `stair` は常に通れ、`wall` は扉があるときだけ通れ、`shaft` と `void` は通れない。`air:1` は遮蔽の話であって通行の話ではない (手すり壁は通れない)。

```ts
import { displayName, neighbors, passable } from "@kensnzk/koyu";

for (const n of neighbors(m, "/home/hall1")) {
  console.log(`${n.space.path}\t${displayName(n.space)}\t${n.boundary.kind}\tpassable=${n.passable}\tdoors=${n.doors}`);
}
console.log(passable(m.boundaries.find((b) => b.kind === "stair")!));
```

```text
/home/ldk	LDK	wall	passable=true	doors=1
/site/east	東側通路	wall	passable=true	doors=1
/site/north	北側通路	wall	passable=false	doors=0
/home/hall2	2階ホール	stair	passable=true	doors=0
true
```

### daylight — 採光の粗い判定

```ts
function daylight(model: Model): DaylightResult[]
interface DaylightResult {
  space: Space;
  floor: number;      // 床面積 m²
  window: number;     // 有効窓面積 m² (係数適用後)
  need: number;       // 必要面積 m² (床/7)
  ok: boolean;
  missingH: boolean;  // h 未指定で数えられなかった窓があるか
}
```

対象は型が `unit` `room` `ldk` `bedroom` `living` の空間 (`hab:1` で追加、`hab:0` で除外)。**対象が一つも無ければ空配列が返る** — 「全部合格」と区別が付かないので、`length` を見ること。

```ts
import { daylight } from "@kensnzk/koyu";

for (const r of daylight(m)) {
  console.log(`${r.space.path} floor=${r.floor} window=${r.window.toFixed(2)} need=${r.need.toFixed(2)} ok=${r.ok} missingH=${r.missingH}`);
}
```

```text
/home/ldk floor=39.75 window=7.54 need=5.68 ok=true missingH=false
/home/bed1 floor=26.5 window=5.72 need=3.79 ok=true missingH=false
```

### siteReport — 敷地の数字

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
interface RoadFrontage { road: Space; width: number; frontage: number }
```

敷地は `site:1` を持つゾーン、道路は `road:<幅員mm>` を持つ `exterior` の空間である。建蔽率・容積率はこれらの商として自分で計算する。

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

### 面積 — areaM2 / zoneAreaM2 / unionAreaM2

```ts
function areaM2(s: Space): number | undefined        // 壁芯。領域が無ければ undefined
function zoneAreaM2(model: Model, zonePath: string): number  // パス接頭辞で束ねた合計
function unionAreaM2(rects: Rect[]): number          // 矩形集合の合併面積 (重なりを一度だけ数える)
```

`zoneAreaM2` は**吹抜けと半屋外を数えない** (専有面積の言葉)。`unionAreaM2` は水平投影 — 建築面積の導出に使う。

```ts
import { areaM2, unionAreaM2, zoneAreaM2 } from "@kensnzk/koyu";

console.log(areaM2(m.spaces.get("/home/ldk")!), zoneAreaM2(m, "/home"),
  unionAreaM2([...m.spaces.get("/home/ldk")!.rects, ...m.spaces.get("/home/hall1")!.rects]));
```

```text
39.75 92.75 53
```

### effectiveUse / displayName — 表示のための小物

```ts
function effectiveUse(model: Model, s: Space): string | undefined
function displayName(s: Space): string
```

`effectiveUse` は空間自身の `use:` が無ければ**最も深いゾーンの祖先**から継承する。`displayName` は `name:` 属性、無ければパスの末尾セグメントを返す。

```ts
import { displayName, effectiveUse } from "@kensnzk/koyu";
console.log(effectiveUse(m, m.spaces.get("/home/ldk")!), displayName(m.spaces.get("/home/ldk")!));
```

```text
exclusive LDK
```

## 導出の部品

平面図を自前で描く、独自の検査を書く、といったときに借りる関数群である。**壁を置く操作はここにも無い** — 壁は空間の割付から導出される。

### 壁芯線分 — segmentsFor / sharedSegment / segmentLength / mergeCollinear

```ts
interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  horizontal: boolean;      // 水平なら y1===y2、垂直なら x1===x2
  edgeOfA?: Edge;           // boundary.a 側の矩形から見た辺 (N/E/S/W)
}

function segmentsFor(model: Model, b: Boundary): Segment[]
function sharedSegment(a: Rect, b: Rect): Segment | undefined
function segmentLength(s: Segment): number
function mergeCollinear(segs: Segment[]): Segment[]
```

`segmentsFor` が中心である。**両側が領域を持つなら共有辺、片側が領域を持たない (`exterior` など) なら外周の残り**を返す。垂直境界 (`stair` / `shaft` / `void`) は線分を持たないので空配列になる。

`edgeOfA` の方角は **N=+Y・S=−Y・E=+X・W=−X** — X は東が正、Y は北が正である。

```ts
import { parse, segmentLength, segmentsFor, sharedSegment } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:800
boundary /L1/a /out t:150`);

const bIn = g.boundaries.find((b) => b.b === "/L1/b")!;
console.log(segmentsFor(g, bIn), segmentLength(segmentsFor(g, bIn)[0]!));

const bOut = g.boundaries.find((b) => b.b === "/out")!;
for (const s of segmentsFor(g, bOut)) console.log(`edge:${s.edgeOfA} len=${segmentLength(s)}`);
```

```text
[
  {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  }
] 4000
edge:N len=3600
edge:S len=3600
edge:W len=4000
```

外壁が三本しか出ていないのは、`/L1/a` の E 辺を `/L1/b` が占めているからである。**外部との境界が複数の線分に割れるのはこれが理由で、開口を置くには `edge:` で辺を選ぶ必要がある。**

`sharedSegment` は矩形二枚の共有辺を直接求める。`mergeCollinear` は共線で連続する線分を一本にまとめる (L字の外周を一本の壁にするのに使う)。

```ts
import { mergeCollinear, sharedSegment } from "@kensnzk/koyu";

console.log(sharedSegment(g.spaces.get("/L1/a")!.rects[0]!, g.spaces.get("/L1/b")!.rects[0]!));
console.log(mergeCollinear([
  { x1: 0, y1: 0, x2: 1000, y2: 0, horizontal: true, edgeOfA: "S" },
  { x1: 1000, y1: 0, x2: 2500, y2: 0, horizontal: true, edgeOfA: "S" },
]));
```

```text
{
  x1: 3600,
  y1: 0,
  x2: 3600,
  y2: 4000,
  horizontal: false,
  edgeOfA: 'E'
}
[ { x1: 0, y1: 0, x2: 2500, y2: 0, horizontal: true, edgeOfA: 'S' } ]
```

### 既定境界 — deriveDefaultBoundaries

```ts
function deriveDefaultBoundaries(model: Model): void
```

同一レベルで平面が接する領域つき空間の組に、宣言境界が一つも無ければ `kind:"wall"` の境界を導いて `model.boundaries` に加える (`derived: true` の印が付く)。**`parse` 系はすべて出口でこれを適用済みである。** 冪等なので何度呼んでもよい。

**明示的に呼ぶ必要があるのは、正準JSONから `Model` を組み立てたときだけである。** 正準JSONは書かれた構成しか持たないので、意味 (既定の壁) を読むにはこれを通す ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。

```ts
import { deriveDefaultBoundaries } from "@kensnzk/koyu";
const before = g.boundaries.length;
deriveDefaultBoundaries(g);
console.log(before, "→", g.boundaries.length);
```

```text
2 → 2
```

### 開口と分節の配置 — placeOpening / placeBand

```ts
interface Band {
  w: number; at: number;
  atRef?: string; atAbs?: number; atAxis?: "X" | "Y";
  edge?: Edge; line: number;
}
interface PlacedBand { segment: Segment; cx: number; cy: number }
interface BandError { error: string; code: string; line: number; file?: string; message: string }

function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | BandError
function placeBand(model: Model, b: Boundary, band: Band, label: string): PlacedBand | BandError
```

境界線分の上に開口 (または `seg`) を置き、中心の絶対座標を返す。置けないときは投げずに `BandError` を返す — `"error" in result` で判別する。`code` は `OPN04`〜`OPN08` / `SEG04`〜`SEG08` のいずれかで、`label` が `"seg"` なら SEG系になる。

```ts
import { placeBand, placeOpening } from "@kensnzk/koyu";

console.log(placeOpening(g, bIn, bIn.openings[0]!));
console.log(placeOpening(g, bOut, bIn.openings[0]!));   // 線分が複数 — 曖昧
console.log(placeBand(g, bIn, { w: 1000, at: 0.25, line: 0 }, "seg"));
```

```text
{
  segment: {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  },
  cx: 3600,
  cy: 2000
}
{
  error: '8行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)',
  code: 'OPN05',
  line: 8,
  message: '境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)'
}
{
  segment: {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  },
  cx: 3600,
  cy: 1000
}
```

比率の `at` は線分に収まるようクランプされるが、通り参照 (`atAbs`) はクランプされない — はみ出せば `OPN08` / `SEG08` になる。

### 重なり — planOverlap / spacesOverlap

```ts
function planOverlap(a: Rect, b: Rect): Rect | undefined   // 重なりの矩形。触れているだけなら undefined
function spacesOverlap(a: Space, b: Space): boolean        // 矩形合併同士
```

垂直隣接の導出 (上下階が平面で重なるか) と、領域の重なりの検査に使う。**接している (辺を共有する) だけでは重なりではない。**

```ts
import { planOverlap, spacesOverlap } from "@kensnzk/koyu";
console.log(planOverlap({ x1: 0, y1: 0, x2: 100, y2: 100 }, { x1: 50, y1: 50, x2: 200, y2: 200 }));
console.log(spacesOverlap(g.spaces.get("/L1/a")!, g.spaces.get("/L1/b")!));
```

```text
{ x1: 50, y1: 50, x2: 100, y2: 100 }
false
```

### 高さと導出される性質 — heff / levelsSorted / isSemiOutdoor / isCoveredAbove

```ts
function heff(model: Model, s: Space): number | undefined  // 空間の h: → レベルの h の順
function levelsSorted(model: Model): Level[]               // z の昇順
function isSemiOutdoor(model: Model, s: Space): boolean
function isCoveredAbove(model: Model, s: Space): boolean
```

**半屋外は宣言ではなく導出である**: `type:exterior` に対して `open` または `air:1` の境界を持つ、領域つきの空間。バルコニー・テラス・庭がこれになる。`isCoveredAbove` は上に (どのレベルであれ) 空間が重なっているか — 屋根の有無すら宣言ではない。採光の半屋外係数 (庇下 0.7 / 上が開いていれば 1.0) がこの二つを読む。

```ts
import { heff, isCoveredAbove, isSemiOutdoor, levelsSorted } from "@kensnzk/koyu";

console.log(heff(g, g.spaces.get("/L1/a")!), levelsSorted(g));
console.log(isSemiOutdoor(m, m.spaces.get("/site/garden")!), isSemiOutdoor(m, m.spaces.get("/home/ldk")!));
console.log(isCoveredAbove(m, m.spaces.get("/home/ldk")!), isCoveredAbove(m, m.spaces.get("/site/garden")!));
```

```text
2400 [ { name: 'L1', z: 0, h: 2400 } ]
true false
true false
```

### 敷地の幾何 — polygonAreaM2 / pointInPolygon / rectEscapesPolygon / polygonSelfIntersection

```ts
interface Pt { x: number; y: number }

function polygonAreaM2(points: Pt[]): number                              // シューレース公式。頂点は順不同
function pointInPolygon(p: Pt, poly: Pt[], eps?: number): boolean         // 境界上は内側扱い (既定 eps=1mm)
function rectEscapesPolygon(r: Rect, poly: Pt[], eps?: number): Pt | undefined  // はみ出す点
function polygonSelfIntersection(poly: Pt[], eps?: number): Pt | undefined      // 自己交差点
```

`rectEscapesPolygon` は四隅の内包だけでなく、多角形の頂点の矩形内への入り込みと辺同士の交差も見る — **凹んだ敷地でも正しい。** 座標は mm、面積は ㎡ で返る。

```ts
import { pointInPolygon, polygonAreaM2, polygonSelfIntersection, rectEscapesPolygon } from "@kensnzk/koyu";

const poly = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }];
console.log(polygonAreaM2(poly), pointInPolygon({ x: 5000, y: 5000 }, poly),
  polygonSelfIntersection(poly),
  rectEscapesPolygon({ x1: 9000, y1: 0, x2: 12000, y2: 3000 }, poly));
```

```text
100 true undefined { x: 12000, y: 0 }
```

## 生成する

### svgPlan — 平面図

```ts
function svgPlan(model: Model, opts?: PlanOptions): string
interface PlanOptions {
  level?: string;   // 既定: 最初に宣言されたレベル
  scale?: number;   // px per mm。既定 0.05
}
```

SVG の文字列を返す。**`Error` を投げることがある** — レベルが一つも無いとき、指定したレベルに領域を持つ空間が無いとき。`SourceError` ではないので、CLI では生のスタックトレースになる。呼び出し側で捕まえること。

```ts
import { svgPlan } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const svg = svgPlan(a, { level: "L1" });
console.log(svg.length + "文字");
console.log(svg.split("\n")[0]);
try { svgPlan(a, { level: "L9" }); } catch (e) { console.log("throws:", (e as Error).message); }
```

```text
3369文字
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="393" viewBox="0 0 528 393" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
throws: レベル L9 に領域を持つ空間がありません
```

描画の規約は [spec/semantics.md §7](../spec/semantics.md)。

### toCanonical — 正準JSON

```ts
function toCanonical(model: Model): string
```

安定順のJSON文字列 (末尾に改行つき)。`import` は残らない。**既定境界 (`derived`) は出ない** — 正準JSONは書かれた構成だけを持つ。

```ts
import { toCanonical } from "@kensnzk/koyu";
console.log(toCanonical(a).split("\n").slice(0, 6).join("\n"));
```

```text
{
  "koyu": "0.3",
  "name": "二室一扉",
  "unit": "mm",
  "grid": {
    "X": [
```

スキーマと安定性の規則は [spec/canonical-json.md](../spec/canonical-json.md)。

### 正準エントリの部品 — canonicalSpaceEntry ほか

```ts
function canonicalSpaceEntry(s: Space): Record<string, unknown>
function canonicalBoundaryEntry(b: Boundary): Record<string, unknown>
function canonicalOpeningEntry(o: Opening): Record<string, unknown>
function canonicalSegEntry(g: Seg): Record<string, unknown>
function sortBySerial<T>(items: T[]): T[]
```

`toCanonical` が組み立てに使う部品で、semantic diff が比較の基底として同じものを共有している。要素一つの正準形が欲しいときに使う。`sortBySerial` は「宣言順に意味の無い集合」を直列化したJSONの辞書順に並べる — 正準順の土台である。

```ts
import { canonicalBoundaryEntry, canonicalSpaceEntry, sortBySerial } from "@kensnzk/koyu";

console.log(JSON.stringify(canonicalSpaceEntry(a.spaces.get("/L1/a")!)));
console.log(JSON.stringify(canonicalBoundaryEntry(a.boundaries[0]!)));
console.log(sortBySerial([{ k: "b" }, { k: "a" }]));
```

```text
{"type":"room","at":["X1","Y1","X2","Y2"],"attrs":{"name":"居室A"}}
{"between":["/L1/a","/L1/b"],"a":"/L1/a","kind":"wall","t":120,"attrs":{"spec":"PW1"},"openings":[{"kind":"door","w":780,"h":2000,"at":0.5}]}
[ { k: 'a' }, { k: 'b' } ]
```

## 差分

### semanticDiff / renderDiff

```ts
function semanticDiff(a: Model, b: Model): ModelDiff
function renderDiff(d: ModelDiff): string[]

interface ModelDiff {
  version?: { from: string; to: string };
  name?: { from?: string; to?: string };
  grid: GridChange[];
  levels:     { added: string[];      removed: string[];      changed: ChangedItem[] };
  assets:     { added: string[];      removed: string[];      changed: ChangedItem[] };
  polygons:   { added: string[];      removed: string[];      changed: ChangedItem[] };
  zones:      { added: string[];      removed: string[];      renamed: RenamedItem[]; changed: ChangedItem[] };
  spaces:     { added: SpaceItem[];   removed: SpaceItem[];   renamed: RenamedItem[]; changed: ChangedItem[] };
  boundaries: { added: BoundaryItem[]; removed: BoundaryItem[]; changed: BoundaryChange[] };
}
```

**構成の言葉で比べる。** 行順・書式・素の `wall` 宣言と省略 (既定壁) の違いは差分にしない。改名は `uid` の一致とパスの不一致で検出される。`toCanonical` が同一なら `renderDiff` は空配列を返す。

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const b = parseFile("examples/two-rooms.muro");
b.spaces.get("/L1/b")!.attrs["name"] = "書斎";

console.log(renderDiff(semanticDiff(a, b)));
console.log(renderDiff(semanticDiff(a, a)));
```

```text
[ '± /L1/b: name 居室B → 書斎' ]
[]
```

定義は [ADR-0018](../docs/decisions/0018-semantic-diff.md)。

## エラー

### SourceError

```ts
class SourceError extends Error {
  line: number;   // 出所の行
  raw: string;    // 位置情報を除いた本文
  file?: string;  // 合成時の出所レイヤー (解決済みの絶対パス)
  // message は `${file}:${line}行目: ${raw}`
}
```

**投げるのは `parse` 系だけである。** 検査 (`check` / `checkDiagnostics`) は投げず、必ず配列を返す。合成 (`import`) の失敗もこれで来る。

```ts
import { SourceError, parse } from "@kensnzk/koyu";

try {
  parse("grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X9 Y1..Y2");
} catch (e) {
  if (e instanceof SourceError) {
    console.log({ name: e.name, line: e.line, raw: e.raw, file: e.file, message: e.message });
  }
}
```

```text
{
  name: 'SourceError',
  line: 4,
  raw: '未定義の通り名です: X9',
  file: undefined,
  message: '4行目: 未定義の通り名です: X9'
}
```

合成を通したときは `file` が入る。

```ts
import { parseFile } from "@kensnzk/koyu/node";
try { parseFile("examples/house/L1.muro"); } catch (e) {
  if (e instanceof SourceError) console.log(e.message.replace(process.cwd() + "/", ""));
}
```

```text
examples/house/L1.muro:3行目: 未宣言のレベルです: level:L1
```

(分割されたレイヤーの一枚だけを読んだので、base層にある `level` の宣言が無い。)

### srcRef — 位置の表記

```ts
function srcRef(line: number, file?: string): string
```

診断や自作のエラーで、位置を同じ書式で表すための小物。

```ts
import { srcRef } from "@kensnzk/koyu";
console.log(srcRef(12), srcRef(12, "L1.muro"));
```

```text
12行目 L1.muro:12行目
```

## 版

```ts
const SUPPORTED_LANGUAGE_VERSIONS: readonly string[]
const DEFAULT_LANGUAGE_VERSION: string
```

このツールが受理する言語版と、`koyu <版>` を省略したときの解釈である。**省略は「最新版で読む」であって「版を跨いで意味が安定する」ではない** — 意味を固定したいファイルには版を書く ([ADR-0017](../docs/decisions/0017-language-versioning.md))。

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";
console.log(SUPPORTED_LANGUAGE_VERSIONS, DEFAULT_LANGUAGE_VERSION);
```

```text
[ '0.1', '0.2', '0.3' ] 0.3
```

## 型

値と一緒に型も出ている。主なものだけ挙げる。

| 出所 | 型 |
|---|---|
| モデル | `Model` `Space` `Zone` `Boundary` `Opening` `Seg` `Area` `Asset` `Level` `Rect` `Pt` `GridAxis` `GridRef` `SitePolygon` `Edge` `BoundaryKind` `Attrs` `AttrValue` |
| 合成 | `LayerLoader` |
| 検査 | `Diagnostic` `CheckResult` |
| グラフ・導出 | `Segment` `Band` `PlacedBand` `BandError` `Route` `NeighborInfo` |
| 問い | `DaylightResult` `SiteReport` `RoadFrontage` |
| 生成 | `PlanOptions` |
| 差分 | `ModelDiff` `FieldChange` `ChangedItem` `RenamedItem` `GridChange` `SpaceItem` `BoundaryItem` `BoundaryChange` |

## 参考にする実装

ビューワー **ugatsu** ([github.com/kensnzk/ugatsu](https://github.com/kensnzk/ugatsu)) がこのAPIの参照消費者である。導出をすべてこのAPIの呼び出しで行い、**自前の「答え」を一つも持たない** — 面積も壁の位置も通行可能性も、ugatsu の側では計算していない。同じ構えで書けば、koyu の意味論が変わったときに自分の実装が置いていかれることがない。

## 関連

- [spec/tools.md](../spec/tools.md) — CLI・MCP・公開APIの契約 (規範)
- [spec/semantics.md](../spec/semantics.md) — 導出・検査・問いの定義 (規範)
- [spec/canonical-json.md](../spec/canonical-json.md) — 正準JSONのスキーマ (規範)
- [cli.md](cli.md) — 同じ導出をコマンドラインから呼ぶ
- [diagnostics.md](diagnostics.md) — 診断コードの原因と直し方
