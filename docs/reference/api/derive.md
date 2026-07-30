---
title: 形の導出
mode: reference
---

# 形の導出

`.muro` に形は書かれていない。壁の位置も、開口で割られた区間も、柱の座標も、階段の段割りも、**規則から現れる生成物である。**`derive(model)` がその唯一の入口である。

```ts
import {
  canonicalBoundaryOrder, derive, DERIVATION_CONSTANTS, deriveDefaultBoundaries,
  levelPitch, placeBand, placeOpening, segmentsFor, TOLERANCES,
} from "@kensnzk/koyu";
```

## derive

```ts
function derive(model: Model, opts?: DeriveOptions): Form

interface DeriveOptions {
  cut?: number;   // 平面の切断面の高さ mm (FL から。既定 1200)
}
```

引数は原本と、**形を決める引数だけ**である。縮尺も余白も向きも色もここには無い — それは見た目であって形ではない。

**`Form` は見た目を一つも持たない。**返るのは座標・厚み・z 範囲・向き・そして対象の同一性だけである。色も書体も線幅も注記文字列も記号も縮尺も紙面の余白も、この型のどこにも現れない。[`svgPlan` / `svgAxo`](draw.md) はこれを描くだけである。

```ts
import { derive } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const b = parseFile("examples/basement/main.muro");
const form = derive(b);
console.log(`levels=${form.levels.length} spaces=${form.spaces.length} boundaries=${form.boundaries.length} openings=${form.openings.length} segs=${form.segs.length} slabs=${form.slabs.length} columns=${form.columns.length} runs=${form.runs.length} site=${form.site.length} plans=${form.plans.length}`);
console.log(form.input);
```

```text
levels=4 spaces=13 boundaries=45 openings=7 segs=0 slabs=29 columns=36 runs=7 site=0 plans=4
{ cut: 1200 }
```

## Form

```ts
interface Form {
  input: FormInput;          // { cut: number }
  levels: FormLevel[];
  spaces: FormSpace[];
  boundaries: FormBoundary[];
  openings: FormOpening[];
  segs: FormSeg[];
  slabs: Slab[];
  columns: FormColumn[];
  runs: FormRun[];
  site: FormSite[];
  plans: FormPlan[];
}
```

`input` は導出に使った引数をそのまま持つ。**切断高さは Form の入力であって中身ではない** — 同じ模型から違う切断高さの形を作れる。

## 添字は正準順である

**`FormBoundary.boundary` / `FormOpening.boundary` / `FormSeg.boundary` の添字は `canonicalBoundaryOrder(model)` の並びであって、`model.boundaries` の宣言順ではない。**

理由は単純である。宣言順は [正準JSON](canonical.md) が捨てる情報であり、**捨てられる情報が形を変えてはならない。**宣言順で同一性の綴りを振ると、正準JSONがバイト同一の二つの模型で `a|b@0` と `a|b@1` に割れてしまう。

### canonicalBoundaryOrder

```ts
function canonicalBoundaryOrder(model: Model): Boundary[]
```

境界を正準の順に並べて返す。並びは各境界を正準エントリへ直列化した文字列の照合順で、同じ綴りなら宣言順で安定する。**既定境界 (`derived`) も同じ規則で並ぶ** — 正準JSONには出ないが、`model.spaces` の並びから導かれるので、同じ規則で並べ直さないと同じ病を持つ。

```ts
import { canonicalBoundaryOrder } from "@kensnzk/koyu";

const order = canonicalBoundaryOrder(b);
for (let i = 0; i < 6; i++) {
  const bb = order[i]!;
  console.log(`canonical ${i}\tdeclared ${b.boundaries.indexOf(bb)}\t${bb.a} | ${bb.b}`);
}
```

```text
canonical 0	declared 17	/B1/ev | /B1/mech
canonical 1	declared 9	/B1/ramp | /B1/ev
canonical 2	declared 13	/B1/st | /B1/ev
canonical 3	declared 47	/B2/ev | /B1/ev
canonical 4	declared 48	/B1/ev | /L1/ev
canonical 5	declared 5	/B1/park | /B1/mech
```

**二つの並びは一致しない。**`Form` の中の添字から原本の境界に戻りたいなら、`model.boundaries[i]` ではなく `canonicalBoundaryOrder(model)[i]` を引く。

同じ理由で、**描かれた線による切り分けもこの順で行われる。**線の切り分けは直前の結果を読むので順序が効き、宣言順で切ると同じ正準JSONから違う面積が出てしまう。

## FormLevel

```ts
interface FormLevel {
  name: string;
  z: number;
  h?: number;
  slab?: number;
  pitch?: number;
}
```

`pitch` は**階高** — 壁と柱がどこまで立つかである。

- 上のレベルがあれば、その差がそのまま階高になる。
- **上が無いときは屋根の頂点に揃う** — その階の最大天井高 + 屋根版の厚さ。同じ式でなければ、壁が屋根を突き抜けるか、屋根の下に隙間が空く。
- 天井高が一つも決まらなければ階高も決まらず、**そのレベルには壁も柱も立たない。**既定値を捏造しない (`SUF01` が既に error として言う)。

### levelPitch

```ts
function levelPitch(model: Model, level: string): number | undefined
```

同じ計算を単体で呼ぶ入口である。

```ts
import { levelPitch } from "@kensnzk/koyu";
for (const l of form.levels) console.log(l.name, levelPitch(b, l.name));
```

```text
B2 3700
B1 3700
L1 4900
R undefined
```

```ts
console.log(form.levels);
```

```text
[
  { name: 'B2', z: -7400, h: 2600, slab: 800, pitch: 3700 },
  { name: 'B1', z: -3700, h: 2600, slab: 800, pitch: 3700 },
  { name: 'L1', z: 0, h: 4000, slab: 900, pitch: 4900 },
  { name: 'R', z: 4900, slab: 500 }
]
```

最上の `R` は天井高を持たないので `pitch` が無い。そこには壁も柱も立たない。

## FormSpace

```ts
interface FormSpace {
  path: string;
  type: string;
  level?: string;
  outline: Pt[][];     // 導出された領域 (凸片)。反時計回り
  areaM2?: number;
  z0?: number;         // 気積 — 天井高が決まるときだけ
  z1?: number;
  indoor: boolean;
  semiOutdoor: boolean;
  covered: boolean;    // 上に空間が重なっているか
}
```

領域を持たない空間 (`exterior` など) は `Form` に現れない。

```ts
console.log(form.spaces[0]);
```

```text
{
  path: '/B1/ev',
  type: 'shaft',
  level: 'B1',
  outline: [ [ [Object], [Object], [Object], [Object] ] ],
  areaM2: 14.04,
  z0: -3700,
  z1: -1100,
  indoor: true,
  semiOutdoor: false,
  covered: true
}
```

## FormBoundary と FormPanel

```ts
interface FormBoundary {
  ref: string;          // 関係の同一性 — `a|b@i`
  boundary: number;     // 正準順の添字 i
  a: string;
  b: string;
  kind: BoundaryKind;
  derived: boolean;
  level?: string;
  air: boolean;
  segment: Segment;     // 芯線分
  material?: {
    t: number;
    z0: number;
    z1: number;
    panels: FormPanel[];
  };
}

interface FormPanel {
  x1: number; y1: number; x2: number; y2: number;
  z0: number; z1: number;
}
```

**一つの境界が複数の線分を持つなら、`FormBoundary` も線分の数だけ出る。**`ref` は同じで `segment` が違う。

`material` は**物があるときだけ** (`kind:"wall"` で、レベルと階高が決まっているとき) 付く。`open` の境界は芯線だけを持ち、材を持たない。

**壁は最初から開口で割られた区間の列として現れる。**「壁の黒帯を紙の色で塗り潰す」という操作は要らない — `panels` に穴が既に空いている。

```ts
const wall = form.boundaries.find((x) => x.material && x.material.panels.length > 1)!;
console.log(wall.ref, wall.a, wall.b, wall.kind, wall.derived, wall.level, wall.air);
console.log(`t=${wall.material!.t} z=${wall.material!.z0}→${wall.material!.z1}`);
for (const p of wall.material!.panels) console.log(`  panel (${p.x1},${p.y1})-(${p.x2},${p.y2}) z ${p.z0}→${p.z1}`);
```

```text
/B1/park|/B1/mech@5 /B1/park /B1/mech wall false B1 false
t=250 z=-3700→0
  panel (16000,12400)-(16000,13600) z -3700→0
  panel (16000,13600)-(16000,14800) z -1700→0
  panel (16000,14800)-(16000,16000) z -3700→0
```

三枚の区間のうち真ん中が**扉の上の垂れ壁**である。下端 (−1700) が扉の頭 — 床 (−3700) から 2000mm — に揃っている。

`ref` の綴りは `<a のパス>|<b のパス>@<正準順の添字>` である。`#` は色の綴りと紛れるので使わない。

## FormOpening と FormSwing

```ts
interface FormOpening {
  ref: string;        // `<境界の ref>/<開口の添字>`
  boundary: number;
  index: number;
  a: string; b: string;
  kind: "door" | "window";
  name?: string;
  level?: string;
  segment: Segment;
  cx: number; cy: number;   // 中心 mm
  w: number;
  z0: number; z1: number;
  t: number;                // 建具の見付け厚 = 壁厚
  style?: string;
  swing?: FormSwing;
  sliding: boolean;         // style:sliding / style:auto
}

interface FormSwing {
  into: string;    // 開く先の空間
  hinge: Pt;       // 吊元
  leaf: Pt;        // 葉が開ききった先
  jamb: Pt;        // 反対の側柱
  ccw: boolean;    // 軌跡が反時計回りか
}
```

開口の z は種類で決まる。**扉は床から立ち上がり**、それ以外は**まぐさ高 (2000mm) から高さのぶん下がる。**窓台 (`sill`) は運搬層なので core は見ない — 頭を揃えることで下端が決まる。

`swing` は扉にだけ付く。開く先は `swing:a/b`、無ければ領域を持つ側 (a を先に見る)。向きは**開く先の導出された形**のうち開口に最も近い凸片の中心へ向かう成分で決まる — 割付ではなく形を読むので、線で切られた空間でも正しい側へ開く。

```ts
const o = form.openings.find((x) => x.kind === "door" && x.swing)!;
console.log(JSON.stringify(o, null, 1));
```

```text
{
 "ref": "/B1/park|/B1/mech@5/0",
 "boundary": 5,
 "index": 0,
 "a": "/B1/park",
 "b": "/B1/mech",
 "kind": "door",
 "level": "B1",
 "segment": {
  "x1": 16000,
  "y1": 12400,
  "x2": 16000,
  "y2": 16000,
  "horizontal": false,
  "edgeOfA": "E"
 },
 "cx": 16000,
 "cy": 14200,
 "w": 1200,
 "z0": -3700,
 "z1": -1700,
 "t": 250,
 "swing": {
  "into": "/B1/park",
  "hinge": {
   "x": 16000,
   "y": 13600
  },
  "leaf": {
   "x": 14800,
   "y": 13600
  },
  "jamb": {
   "x": 16000,
   "y": 14800
  },
  "ccw": false
 },
 "sliding": false
}
```

## FormSeg

```ts
interface FormSeg {
  ref: string;      // `<境界の ref>~<seg の添字>`
  boundary: number;
  index: number;
  level?: string;
  segment: Segment;
  cx: number; cy: number;
  w: number;
  t: number;        // 帯の厚み = 壁厚
}
```

**数えない分節も位置は導出される。**面積にもグラフにも現れないが、どこにあるかは形の問題である。

## FormColumn / FormRun / FormSite

```ts
interface FormColumn extends Column {
  ref: string;      // `<レベル名>/<通りの組>`
  z0: number;
  z1: number;
}

interface FormRun extends VerticalRun {
  solids: RunSolid[];
}

interface FormSite {
  path: string;
  points: Pt[];
  areaM2: number;
}
```

柱は `z0` から `z0 + pitch` まで立つ。**階高が決まらないレベルには柱が一本も立たない。**

```ts
console.log(form.columns[0]);
```

```text
{
  x: 0,
  y: 0,
  w: 800,
  d: 800,
  level: 'B2',
  grid: 'X1/Y1',
  decl: 0,
  attrs: {},
  ref: 'B2/X1/Y1',
  z0: -7400,
  z1: -3700
}
```

`VerticalRun` と `RunSolid` の中身は [実体と生成物](solids.md)。

## FormPlan — 平面は純粋な断面ではない

```ts
interface FormPlan {
  level: string;
  cut: number;      // FL からの切断高さ mm
  cutZ: number;     // 世界座標での切断面の高さ mm
  entities: PlanEntity[];
}

interface PlanEntity {
  class: PlanClass;
  of: PlanSubject;
  ref: string;
  role?: PlanRole;
  polygon?: Pt[];
  lines?: Seg2[];
  arc?: { cx: number; cy: number; r: number; from: Pt; to: Pt; ccw: boolean };
  anchor?: { x: number; y: number; up?: boolean };
}

type PlanClass = "cut" | "below" | "above" | "swing" | "anchor";
type PlanSubject = "space" | "boundary" | "opening" | "column" | "run";
type PlanRole = "outline" | "tread" | "break" | "arrow";
```

**立体を平面で切っても平面図は出てこない。**扉の軌跡は動きの記号であり、上部吹抜けの投影は切断面より上にあり、切断線は切れたことの位置であり、下りる走りは切断面より下の見えがかりである。どれも断面には無い。

だから平面は**分類つきの2Dエンティティ集合**として持つ。

| `class` | 何か |
|---|---|
| `cut` | 切断面が切ったもの |
| `below` | 切断面より下の見えがかり |
| `above` | 切断面より上のものの投影 |
| `swing` | 動きの軌跡 (扉) |
| `anchor` | 記号を置く座 |

**区間は足あと (`polygon`) と芯線 (`lines`) の両方を持つ。**厚みを持つものとして描くか、一本の線として描くか (遮蔽しない手すり) は見た目の判断なので、消費者が選べるようにしてある。

```ts
const plan = form.plans.find((p) => p.level === "B1")!;
const count = new Map<string, number>();
for (const e of plan.entities) count.set(`${e.class}/${e.of}`, (count.get(`${e.class}/${e.of}`) ?? 0) + 1);
console.log(`level=${plan.level} cut=${plan.cut} cutZ=${plan.cutZ} entities=${plan.entities.length}`);
for (const [k, n] of [...count].sort()) console.log(`  ${k} ${n}`);
```

```text
level=B1 cut=1200 cutZ=-2500 entities=62
  above/boundary 2
  anchor/run 2
  below/run 5
  cut/boundary 19
  cut/column 15
  cut/opening 2
  cut/run 9
  cut/space 6
  swing/opening 2
```

**一枚の平面に上る走りと下りる走りの両方が出る。**B1 では B1 から上る階段が切断線で切れ、その先に B2 から上がってきた階段が見える。これが階段が階ごとに違う姿で現れる理由であり、平面図が「そのレベルで切った断面」だという事実そのものである。

`swing` の `arc` は引き戸には付かない — 引き込みの向きだけが `lines` に残る。

## 導出の部品

`derive` が使っている部品は個別にも呼べる。**それを組み立てて一棟ぶんの形にするのが `derive` である** — 組み立てを消費者ごとにやると、同じ原本から違う建物が出る。

### segmentsFor

```ts
interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  horizontal: boolean;   // 水平なら y1===y2、垂直なら x1===x2
  diagonal?: boolean;    // 軸に平行でない (描かれた線)
  edgeOfA?: Edge;        // boundary.a 側の矩形から見た辺
}

function segmentsFor(model: Model, b: Boundary): Segment[]
```

**壁がどこに現れるかの答えはこの一本だけである。**壁を置く操作は存在しない。

- 両側が領域を持つ → 二つの領域が共有する軸平行な辺
- 片側が領域を持たない (`exterior` など) → 外周のうち、同レベルで向かい合う他室の区間を除いた残り
- 境界に線が描かれている → その線のうち、左右がちょうど a と b になっている区間
- 垂直境界 (`stair` / `shaft` / `void`) → 空配列

**共有辺も外周も、割付ではなく導出された形 (`pieces`) から取る。**割付から取ると、線で切り落とした側にまで壁が立つ。

```ts
import { parse, segmentsFor } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:800
boundary /L1/a /out t:150`);

const bIn = g.boundaries.find((x) => x.b === "/L1/b")!;
console.log(segmentsFor(g, bIn));

const bOut = g.boundaries.find((x) => x.b === "/out")!;
for (const s of segmentsFor(g, bOut)) console.log(`edge:${s.edgeOfA} ${s.x1},${s.y1} → ${s.x2},${s.y2}`);
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
]
edge:S 0,0 → 3600,0
edge:N 0,4000 → 3600,4000
edge:W 0,0 → 0,4000
```

外壁が三本しか出ていないのは、`/L1/a` の E 辺を `/L1/b` が占めているからである。**外部との境界が複数の線分に割れるのはこれが理由で、開口を置くには `edge:` で辺を選ぶ必要がある。**

方角は **N=+Y・S=−Y・E=+X・W=−X**。線分の長さが要るなら端点から自分で測る — koyu が持つのは「どこに線分があるか」までである。

### deriveDefaultBoundaries

```ts
function deriveDefaultBoundaries(model: Model): void
```

同一レベルで平面が接する領域つき空間の組に、宣言境界が一つも無ければ `kind:"wall"` の境界を導いて `model.boundaries` に加える (`derived: true` の印が付く)。接触は**導出された形**で見るので、線で接触が消えた組には作られない。

**`a`/`b` の向きは正準順である。**宣言境界の `a` は書かれた向きで、正準JSONが `a` キーとして保存するから形に持ち込んでよい。既定境界は正準JSONに出ないので**書かれた向きが無く**、空間の宣言順を拾えば正準形が捨てた情報が形を変えてしまう ([約束1](../form/index.md))。だからパスの照合順で決める — `edgeOfA` の方位と関係の同一性 `a|b@i` がこれに従う。

**領域を持たない空間 (`exterior` 等) との間には導かない。**相手を名指しすること自体が情報なので、そこは宣言してもらう。

**[`parse` 系](parsing.md)はすべて出口でこれを適用済みである。**冪等なので何度呼んでもよい。

```ts
import { deriveDefaultBoundaries } from "@kensnzk/koyu";
const before = g.boundaries.length;
deriveDefaultBoundaries(g);
console.log(before, "→", g.boundaries.length);
```

```text
2 → 2
```

**明示的に呼ぶ必要があるのは、正準JSONから `Model` を組み立てたときだけである。**正準JSONは書かれた構成しか持たないので、既定の壁を読むにはこれを通す。

### placeOpening / placeBand

```ts
interface Band {
  w: number; at: number;
  atRef?: string; atAbs?: number; atAxis?: "X" | "Y";
  edge?: Edge; line: number;
}

interface PlacedBand { segment: Segment; cx: number; cy: number }

interface BandError {
  error: string;      // 位置接頭辞つきの完成文
  code: BandCode;
  line: number;
  file?: string;
  message: string;    // 位置接頭辞を除いた本文
}

type BandCode =
  | "OPN04" | "OPN05" | "OPN06" | "OPN07" | "OPN08"
  | "SEG04" | "SEG05" | "SEG06" | "SEG07" | "SEG08";

function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | BandError
function placeBand(model: Model, b: Boundary, band: Band, label: string): PlacedBand | BandError
```

境界線分の上に開口 (または `seg`) を置き、中心の絶対座標を返す。**置けないときは投げずに `BandError` を返す** — `"error" in result` で判別する。

`label` が `"seg"` なら `SEG` 系、それ以外 (`"door"` / `"window"`) なら `OPN` 系のコードになる。`placeOpening` は `placeBand(model, b, o, o.kind)` にすぎない。

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
  error: 'line 8: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)',
  code: 'OPN05',
  line: 8,
  message: 'There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)'
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

**比率の `at` は線分に収まるようクランプされる。**通り参照 (`atAbs`) はクランプされず、はみ出せば `OPN08` / `SEG08` になる。斜めの線分 (描かれた線) の上では通り参照が一意に位置を定めないので `OPN07` / `SEG07` になる — 比率で書く。

## DERIVATION_CONSTANTS

```ts
const DERIVATION_CONSTANTS: Readonly<Record<string, number>>
```

**書かれなかったときに何を導くかを定める数である。**書けば必ず書いた値が勝つ — これは「何を書いてよいか」の台帳ではない。

```ts
import { DERIVATION_CONSTANTS } from "@kensnzk/koyu";
console.log(DERIVATION_CONSTANTS);
```

```text
{
  WALL_T: 100,
  RAIL_T: 60,
  RAIL_T_MAX: 80,
  RAIL_H: 1100,
  OPENING_HEAD: 2000,
  OPENING_H: 1200,
  CEILING_T: 30,
  ROOF_T: 200,
  CUT_HEIGHT: 1200,
  DEFAULT_RISER_MAX: 180,
  TREAD_TARGET: 300,
  ARROW_SPAN_MIN: 900,
  LANDING_MIN: 1100,
  ENTRY_LANDING: 1100,
  LANE_ESCALATOR: 1200,
  TREAD_SOLID: 200,
  SLAB_T: 200,
  STEP_MARK: 400
}
```

| 名 | 何の既定か | 上書き |
|---|---|---|
| `WALL_T` | 壁厚 mm。芯線に対して両側へ半分ずつ振り分ける | 境界の `t:` |
| `RAIL_T` | 遮蔽しない境界 (`air:1`) の厚み mm | 境界の `t:` |
| `RAIL_T_MAX` | 遮蔽しない境界の厚みの上限 mm。`t:` に何を書いてもここで頭打ち | — |
| `RAIL_H` | 遮蔽しない境界の天端高 mm | 境界の `h:` |
| `OPENING_HEAD` | 開口のまぐさ高 mm。扉はここまで立ち上がり、それ以外はここから下がる | — |
| `OPENING_H` | 扉以外の開口の高さ mm | 開口の `h:` |
| `CEILING_T` | 天井面の見付け厚 mm | — |
| `ROOF_T` | 上に何も無いときの屋根版の厚さ mm | 上階の `slab:` |
| `CUT_HEIGHT` | 平面の切断面の高さ mm (FL から) | `derive` の `cut` |
| `DEFAULT_RISER_MAX` | 蹴上げの上限 mm | `riser:` |
| `TREAD_TARGET` | 折返し階段の踊り場を導くときの目標踏面 mm | `tread:` |
| `ARROW_SPAN_MIN` | 平面に進む向きの矢印が出る可視区間の下限 mm。**厳密な超過**なので、ちょうど 900mm の区間には矢印が出ない | — |
| `LANDING_MIN` | 踊り場の最小奥行 mm | — |
| `ENTRY_LANDING` | 乗り込みの床の奥行 mm | `entry:` |
| `LANE_ESCALATOR` | エスカレーター一台の呼び幅 mm | `lane:` |
| `TREAD_SOLID` | 段板の見付け厚 (立体) mm | — |
| `SLAB_T` | 斜路・エスカレーター床版の厚さ mm | — |
| `STEP_MARK` | 平面のエスカレーターの段の刻みのピッチ mm | — |

## TOLERANCES

```ts
const TOLERANCES: Readonly<Record<string, number>>
```

**「どれだけ違えば別のものか」を決める数である。**同じ問いに二つの許容値があってはならないので、一箇所に集めてある。

```ts
import { TOLERANCES } from "@kensnzk/koyu";
console.log(TOLERANCES);
```

```text
{
  EPS: 0.5,
  AREA_EPS: 1,
  PROBE: 5,
  SPAN_EPS: 1,
  CROSS_EPS: 0.000001,
  PARALLEL_EPS: 1e-9,
  POINT_EPS: 1
}
```

| 名 | 単位 | 何の許容か |
|---|---|---|
| `EPS` | mm | 長さ・座標。辺の共線・向かい合わせ・区間の一致・共線マージの隙間 |
| `AREA_EPS` | mm² | 面積の退化。切った残りがこれ以下なら空 |
| `PROBE` | mm | 描かれた線の左右を探る距離。**形の解像度の下限である** — この幅を下回る空間は左右のどちらにも判定できない |
| `SPAN_EPS` | mm | 区間・切断・枠の一致。切断面と部品の z の比較、可視区間の長さの下限、外皮の穴の長さの下限 |
| `CROSS_EPS` | 外積 | 半平面で切るときの符号。頂点を残すか、交点を挿むか |
| `PARALLEL_EPS` | 無次元 | 無限直線と線分の平行判定・線分側パラメータの範囲 |
| `POINT_EPS` | mm | 点が多角形の辺の上にあるとみなす幅 (境界上は内側扱い) |

**座標は mm の整数が基本である。**だから長さの許容 0.5mm は整数の刻みの半分に置かれている。面積の許容 1mm² は 1mm×1mm の破片であり、半平面で切った残りがこれ以下なら形として数えない。

## 関連

- [実体と生成物](solids.md) — 芯線と厚みから四辺形と角柱を起こす構成子、床・屋根・縦動線
- [図の生成](draw.md) — `Form` を SVG にする
- [Model と構成型](model.md) — `derive` の入力
- [正準JSON](canonical.md) — 添字の並びを決めている形式
