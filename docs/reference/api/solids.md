---
title: 実体と生成物
mode: reference
---

# 実体と生成物

[`Form`](derive.md) が持つのは**芯線と厚みと z** である。そこから実体 — 厚みのある四辺形、立体の角柱 — を起こす規則も導出の一部なので、core が唯一の実装を持つ。床・天井・屋根・縦動線も同じ構えで、宣言から現れる生成物である。

```ts
import {
  band, bandLine, columnRect, runDrawsForLevel, runPrism, runSolids,
  slabs, slopeText, thicken, verticalRuns,
} from "@kensnzk/koyu";
```

**ここに出るものは原本のどこにも書かれていない。**床の厚みも段数も踏面も勾配も、規則から現れる。そして**どれも見た目を持たない** — 色も線幅も注記の書式も返さないので、ビュアーはこれを幾何へ写すだけでよい。

この頁の出力はすべて `examples/basement/main.muro` に対して実行したものである。

```ts
import { derive } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const b = parseFile("examples/basement/main.muro");
const form = derive(b);
```

## 実体の構成子

消費者がそれぞれ書き直せば、部品を共有していても組み立ての規則は共有されず、同じ `Form` から違う形が出る。だから四辺形と角柱を起こす式も一箇所にある。

### thicken

```ts
function thicken(x1: number, y1: number, x2: number, y2: number, t: number): Pt[]
```

芯線を厚みのある四辺形へ。**厚みは芯線に対して両側へ半分ずつ振り分ける。**単位法線へ ±t/2 だけ振るので、斜めの線分でも同じ一つの式である。

頂点は **始点+n → 終点+n → 終点−n → 始点−n** の順で、**向かい合う二辺の中点を結べば芯線に戻る。**

```ts
import { thicken } from "@kensnzk/koyu";

const wall = form.boundaries.find((x) => x.material && x.material.panels.length > 1)!;
const p = wall.material!.panels[1]!;
console.log(thicken(p.x1, p.y1, p.x2, p.y2, wall.material!.t).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
15875,13600 15875,14800 16125,14800 16125,13600
```

芯線は x=16000、厚みは 250 なので、四辺形は 15875〜16125 に振り分けられている。

### bandLine / band

```ts
function bandLine(seg: Segment, cx: number, cy: number, w: number): Seg2
function band(seg: Segment, cx: number, cy: number, w: number, t: number): Pt[]

interface Seg2 { x1: number; y1: number; x2: number; y2: number }
```

`bandLine` は帯 (開口・`seg`) が線分上で占める区間を返す — 中心から線分の向きへ幅の半分ずつ。`band` はそれを `thicken` に通した四辺形である。

```ts
import { band, bandLine } from "@kensnzk/koyu";

const o = form.openings.find((x) => x.kind === "door")!;
console.log(o.ref, JSON.stringify(bandLine(o.segment, o.cx, o.cy, o.w)));
console.log(band(o.segment, o.cx, o.cy, o.w, o.t).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
/B1/park|/B1/mech@5/0 {"x1":16000,"y1":13600,"x2":16000,"y2":14800}
15875,13600 15875,14800 16125,14800 16125,13600
```

**平面のエンティティは足あと (`polygon`) と芯線 (`lines`) の両方を持つ**ので、手すりを一本の線で描く側が四辺形から芯線を復元する必要は無い。

### columnRect

```ts
function columnRect(c: { x: number; y: number; w: number; d: number }): Pt[]
```

柱の断面。通り芯の交点を中心に、幅と奥行の半分ずつ。

```ts
import { columnRect } from "@kensnzk/koyu";
const c = form.columns[0]!;
console.log(c.ref, columnRect(c).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
B2/X1/Y1 -400,-400 400,-400 400,400 -400,400
```

### runPrism

```ts
function runPrism(s: RunSolid): FormPrism

interface FormPrism {
  poly: Pt[];
  bottom: number[];   // 頂点ごとの下端 z
  top: number[];      // 頂点ごとの上端 z
}
```

縦動線の立体を角柱へ。**傾いた版の四隅の高さは、走る向きに線形で振る** — `up` 側が高い。箱は四隅とも同じ高さになる。

底面の輪郭と頂点ごとの上下端 z という形は、箱にも傾いた版にも足りる。

```ts
import { runPrism } from "@kensnzk/koyu";

const ramp = form.runs.flatMap((r) => r.solids).find((s) => s.kind === "incline")!;
const pr = runPrism(ramp);
console.log(ramp.kind, `up=${ramp.up}`, "bottom", pr.bottom.join(" "), "top", pr.top.join(" "));
```

```text
incline up=E bottom -7600 -5750 -5750 -7600 top -7400 -5550 -5550 -7400
```

`up` 側 (東) の二隅が高く、厚みは版なりに平行についてきている。

## 床・天井・屋根

### slabs

```ts
function slabs(model: Model): Slab[]

type SlabKind = "floor" | "ceiling" | "roof";

interface Slab {
  kind: SlabKind;
  space: string;
  level: string;
  outline: Pt[];    // 導出された凸片の輪郭
  z0: number;
  z1: number;
}
```

**語彙は一つも増えていない。**level の `slab` (床組み厚) は既に床を宣言していて、`h` (天井高) は既に天井を宣言している。屋根は「上に何も無い床」の裏返しであり、これも既にモデルにある事実である。床を置く操作も、天井を張る操作も、屋根を架ける操作も存在しない。

| kind | 何が与えるか | 出ない空間 |
|---|---|---|
| `floor` | level の `slab` | 吹抜け (床の不在が定義である) ・外部 (地面である) |
| `ceiling` | `h` (天井高) | 吹抜け・半屋外・縦動線・外部・`ceiling:0` を書いた空間 |
| `roof` | 上に空間が重なっていない範囲 | 外部・半屋外 |

**屋根は一部だけ覆われている空間にも架かる。**覆われていない範囲にだけ架かるので、基壇の上に塔屋が載る建物では、これが基壇屋上として書かずに現れる。

**床の不在は屋根の不在ではない。**吹抜けにも屋根は架かる — 上に何も無い吹抜けは、天窓で塞がれた竪穴か、空に開いた中庭かのどちらかであり、後者は半屋外として導出される。逆に覆っている側には吹抜けも数えるので、竪穴の途中の階に屋根は架からない。

縦動線の天井が無いのは、上の走りに沿って傾いていて**一つの面ではない**からである。

```ts
import { slabs } from "@kensnzk/koyu";

const sl = slabs(b);
console.log(sl.length, "slabs;", ["floor","ceiling","roof"].map((k) => `${k}=${sl.filter((s) => s.kind === k).length}`).join(" "));
for (const s of sl.filter((x) => x.space === "/B2/park")) console.log(s.kind, s.space, s.level, `z ${s.z0}→${s.z1}`, s.outline.length + " pts");
```

```text
29 slabs; floor=15 ceiling=8 roof=6
floor /B2/park B2 z -8200→-7400 4 pts
ceiling /B2/park B2 z -4830→-4800 4 pts
```

床は階の FL の下に床組みのぶん下がる (B2 の FL は −7400、`slab` が 800 なので −8200 から)。天井は FL + 天井高 の面に、見付け厚のぶん下がって張られる。

**天井は室の輪郭と必ずしも一致しない** — 折上げ、下がり天井 (梁型)、数室にまたがる連続天井、カーテンウォール手前の見切り。この導出は基本計画の解像度での近似であり、`ceiling:0` (現し天井) が唯一の逃げ道である。

## 縦動線

### verticalRuns

```ts
function verticalRuns(model: Model): VerticalRun[]

type RunDevice = "stair" | "ramp" | "escalator" | "lift";
type RunForm = "straight" | "return";

interface VerticalRun {
  path: string;        // 宣言した空間のパス
  device: RunDevice;
  form: RunForm;
  level: string;
  upper?: string;      // 上の到達先レベル (lift は同レベルで閉じる)
  z0: number; z1: number;
  rise: number;        // 上がる高さ mm
  up: Edge;            // 上る向き (lift では意味を持たない)
  turn: "L" | "R";     // 折返しの向き (既定 R)
  rect: Rect;
  length: number;      // 走り方向の全長 mm
  width: number;       // 幅 (走りと直交) mm
  entry: number;       // 乗り込みの床の奥行 mm
  lanes: number;       // 並列の台数 (エスカレーター。他は1)
  parts: RunPart[];
  risers: number;      // 蹴上げの数 (階段のみ)
  riser: number;       // 蹴上げ mm (階段のみ)
  tread: number;       // 踏面 mm (階段のみ)
  slope: number;       // 最も急な走りの勾配 (rise / 走り長)
  going: number;       // 走りの水平長の合計 mm (踊り場を含まない)
}

interface RunPart {
  kind: "flight" | "landing";
  rect: Rect;
  t0: number; t1: number;   // 走り方向の区間 mm
  s0: number; s1: number;   // 幅方向の区間 mm
  z0: number; z1: number;   // t0 における高さ / t1 における高さ
  reversed: boolean;        // 人の進む向きが t の減る向きか
  risers?: number;
  tread?: number;
  lane?: number;            // 並列の何台目か
}
```

**段数も踏面も勾配も書かれていない。**書かれるのは装置 (`stair:` `ramp:` `escalator:` `lift:`) と上る向き、そして空間の矩形だけで、残りは導出される。曲線は導入されていない — 螺旋は折返しの連続として書く。

`RunPart` の幾何は `z0` と `z1` が全てである。**どちらへ傾くかも、段がどちらから上がるかも、この二つから決まる。**`reversed` は**人の進む向き**で、幾何とは独立である — 並列の下りエスカレーターは幾何が上りと同じで、進む向きだけが逆である。

```ts
import { slopeText, verticalRuns } from "@kensnzk/koyu";

const stair = verticalRuns(b).find((r) => r.device === "stair")!;
console.log(`${stair.path} ${stair.device} form=${stair.form} level=${stair.level}→${stair.upper} rise=${stair.rise} risers=${stair.risers} riser=${Math.round(stair.riser)} tread=${Math.round(stair.tread)} slope=${slopeText(stair.slope)} going=${stair.going} parts=${stair.parts.length}`);
console.log(stair.parts[0]);
```

```text
/B2/st stair form=return level=B2→B1 rise=3700 risers=21 riser=176 tread=300 slope=1/1.5 going=6000 parts=3
{
  kind: 'flight',
  rect: { x1: 16000, x2: 17300, y1: 8100, y2: 11100 },
  t0: 1100,
  t1: 4100,
  s0: 0,
  s1: 1300,
  z0: -7400,
  z1: -5461.9047619047615,
  reversed: false,
  risers: 11,
  tread: 300
}
```

折返しなので `parts` は 3 — 走り・踊り場・走りである。踏面が走りごとに違うときは、**最も窮屈な走りが代表する。**

### runSolids

```ts
function runSolids(run: VerticalRun): RunSolid[]

type RunSolid =
  | { kind: "box"; rect: Rect; z0: number; z1: number }
  | { kind: "incline"; rect: Rect; up: Edge; z0: number; z1: number; t: number };
```

その立体である。**段は段として、斜路は傾いた版として立ち上がる。**箱は段板・踊り場・エスカレーターの端部・かご、傾いた版は斜路・トラス・欄干になる。

依存ゼロの素の記述で、**ビュアーはこれを幾何へ写すだけでよい** — 段割りや勾配の判断は一切持たない。角柱にするには [`runPrism`](#runprism) を通す。

```ts
import { runSolids } from "@kensnzk/koyu";
console.log(runSolids(stair).length, runSolids(stair)[0]);
```

```text
20 {
  kind: 'box',
  rect: { x1: 16000, x2: 17300, y1: 8100, y2: 8400 },
  z0: -7600,
  z1: -7223.809523809524
}
```

### runDrawsForLevel

```ts
function runDrawsForLevel(model: Model, level: string, cut?: number): RunDraw[]

interface RunDraw {
  path: string;
  device: RunDevice;
  dir: "up" | "down";
  treads: Seg2[];     // 段鼻 (階段) / 段の刻み (エスカレーター)
  outline: Seg2[];    // 走りの側線・踊り場の縁
  breaks: Seg2[];     // 走りが切断面を跨ぐ位置を幅いっぱいに横切る線分
  arrows: RunArrow[];
  anchor?: { x: number; y: number };
}

interface RunArrow extends Seg2 {
  up: boolean;        // この面でこの走りを進むと上るか
}
```

そのレベルで切った縦動線の作図である。`cut` の既定は 1200mm。

**一枚の平面には二つの走りが出る** — このレベルから**上る**走り (切断線で切れる) と、このレベルへ**下りる**走り (下階の走りを上から見たもの)。切断より先には上る走りは描かれず、その位置から先に下りる走りが見える。**下りる走りは、双子の上る走りが隠した残りに現れる。**

**色も線種も注記文字列も持たない。**`breaks` は「走りが切断面を跨ぐ位置」であって、作図慣習の平行な二本の斜線は描画側が引く。`RunArrow` も "UP" と "DN" という**言葉を持たない** — 上るかどうかを `up` が言い、注記の文字列は描画側が組む。`anchor` は注記を置く座で、上る走りにだけ一つ付く。

```ts
import { runDrawsForLevel } from "@kensnzk/koyu";

for (const d of runDrawsForLevel(b, "B1")) {
  console.log(`${d.path}\t${d.device}\tdir=${d.dir}\ttreads=${d.treads.length}\toutline=${d.outline.length}\tbreaks=${d.breaks.length}\tarrows=${d.arrows.map((a) => (a.up ? "up" : "down")).join(",") || "-"}\tanchor=${d.anchor ? `${d.anchor.x},${d.anchor.y}` : "-"}`);
}
```

```text
/B1/ev	lift	dir=up	treads=2	outline=4	breaks=0	arrows=-	anchor=-
/B1/ramp	ramp	dir=up	treads=0	outline=2	breaks=1	arrows=up	anchor=25000,3500
/B1/st	stair	dir=up	treads=6	outline=2	breaks=1	arrows=up	anchor=17300,9700
/B2/ramp	ramp	dir=down	treads=0	outline=6	breaks=0	arrows=down	anchor=-
/B2/st	stair	dir=down	treads=11	outline=6	breaks=0	arrows=down	anchor=-
```

B1 の平面に、B1 から上る階段 (`/B1/st`、6段ぶんが切断線まで) と、B2 から上がってきた階段 (`/B2/st`、その先の11段) が同時に出ている。**これが階段が階ごとに違う姿で現れる理由である。**

### slopeText

```ts
function slopeText(slope: number): string
```

勾配を `1/N` 表記へ (N は小数第1位まで、末尾の `.0` は落とす)。0以下では `—` を返す。

```ts
import { slopeText } from "@kensnzk/koyu";
console.log(slopeText(1/12), slopeText(0.5), slopeText(0));
```

```text
1/12 1/2 —
```

**これは数の綴りであって判定ではない。**勾配が急すぎるかどうかは [`validate`](validate.md) の `run.slope` が言う。

## 関連

- [形の導出](derive.md) — `Form` 全体と、そこに至る規則
- [図の生成](draw.md) — これらを SVG にする
- [縦動線を書く](../muro/vertical-circulation.md) — 記法の側から見た宣言
- [`koyu runs`](../cli/runs.md) — 導出された段割りをコマンドラインで見る
