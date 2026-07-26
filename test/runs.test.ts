// 縦動線 (ADR-0021)・描かれた線 (ADR-0022)・柱 (ADR-0023) の保証。
// 「書かないが検査する」構えは、導出値そのものをテストで固定して初めて意味を持つ。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/check.js";
import { doorsBetween, segmentsFor } from "../src/graph.js";
import { areaM2, columnsFor, polyBounds } from "../src/model.js";
import { slabs } from "../src/fabric.js";
import { svgAxo } from "../src/axo.js";
import { parse } from "../src/parse.js";
import { runDrawsForLevel, runSolids, verticalRuns } from "../src/vertical.js";

const BASE = `koyu 0.5
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
`;

// ---- 縦動線: 形は書かれず、導出される ----

test("階段: 段数・蹴上げ・踏面は書かれていないのに導出される", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  const runs = verticalRuns(m);
  const up = runs.find((r) => r.level === "L1")!;
  assert.equal(up.device, "stair");
  assert.equal(up.rise, 3000);
  // 3000 / 180 上限 = 17段、蹴上げ 176.5mm、踏面は乗り込み1100×2を引いた4800を16で割る
  assert.equal(up.risers, 17);
  assert.equal(Math.round(up.riser), 176);
  assert.equal(Math.round(up.tread), 300);
  // 最小の模型なので外皮 (ENV01) は書いていない — 縦動線まわりの診断が無いことを見る
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter((w) => !w.includes("外皮")), []);
});

test("同じ階段室でも階高が変われば段割りが変わる (書き分けはどこにも無い)", () => {
  const src = (pitch: number) => `koyu 0.5
grid X 0 3000
grid Y 0 8000
level L1 0 h:2400 slab:300
level L2 ${pitch} h:2400 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N form:return
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`;
  const a = verticalRuns(parse(src(2800))).find((r) => r.level === "L1")!;
  const b = verticalRuns(parse(src(4200))).find((r) => r.level === "L1")!;
  assert.equal(a.risers, 16);
  assert.equal(b.risers, 24);
  // 踏面は目標300mmに揃い、余りが踊り場へ寄る (ADR-0021 決定3)
  assert.equal(Math.round(a.tread), 300);
  assert.equal(Math.round(b.tread), 300);
  assert.ok(a.parts.some((p) => p.kind === "landing"));
});

test("走りは領域の縁から始まらない — 乗り込みの床が扉の開く場所になる", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  assert.equal(run.entry, 1100);
  const flight = run.parts.find((p) => p.kind === "flight")!;
  assert.equal(flight.t0, 1100); // 近端に階の床が残る
  assert.equal(flight.t1, 7000 - 1100); // 直階段は遠端にも残る
  // 乗り込みは踊り場ではないので部品を持たない (階の床である)
  assert.equal(run.parts.filter((p) => p.kind === "landing").length, 0);
});

test("エスカレーター: 呼び幅で台数が決まり、上りの隣は下りになる", () => {
  const m = parse(`${BASE}
space /L1/e escalator X1..X2 Y1..Y1+7000 escalator:N
space /L2/e escalator X1..X2 Y1..Y1+7000
stack e L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  assert.equal(run.lanes, 2); // 幅3000 ÷ 呼び幅1200 = 2台
  const flights = run.parts.filter((p) => p.kind === "flight");
  assert.equal(flights.length, 2);
  assert.equal(flights[0]!.reversed, false);
  assert.equal(flights[1]!.reversed, true); // 隣は逆向き
  assert.equal(flights[0]!.s1 - flights[0]!.s0, 1200);
});

test("斜路: 勾配は書かれず導出され、宣言 slope: より急なら警告", () => {
  const m = parse(`${BASE}
space /L1/r ramp X1..X2 Y1..Y1+7000 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y1+7000
stack r L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  assert.ok(run.slope > 1 / 12);
  assert.ok(check(m).warnings.some((w) => w.includes("勾配")));
});

test("形はあってもグラフでは通れない — 垂直境界が無ければ警告 (RUN08)", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
`);
  const r = check(m);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.includes("垂直境界がありません")));
  assert.equal(doorsBetween(m, "/L1/s", "/L2/s"), undefined);
});

test("縦動線は高さ不変量から免除される (天井が面でないため)", () => {
  // 天井高2700 + 上階slab300 = 3000 で階高ちょうど。階段室だけ h を超えても通る
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 h:2900 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  assert.equal(check(m).errors.length, 0);
});

test("平面: 上る走りは切断線で切れ、その先に下りる走りが見える", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  const l1 = runDrawsForLevel(m, "L1");
  assert.equal(l1.length, 1); // L1には上る走りだけ (下はレベルが無い)
  assert.ok(l1[0]!.breaks.length > 0, "切断線が引かれる");
  assert.deepEqual(l1[0]!.arrows.map((a) => a.label), ["UP"]);

  const l2 = runDrawsForLevel(m, "L2");
  // L2 は最上階なので上る走りが無く、下りる走りだけが丸ごと見える
  assert.deepEqual(l2.map((d) => d.arrows.map((a) => a.label)), [["DN"]]);
  assert.equal(l2[0]!.breaks.length, 0);
});

test("立体: 階段は段の集まり、斜路は傾いた版になる", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
space /L1/r ramp X2..X3 Y1..Y1+7000 ramp:N
space /L2/r ramp X2..X3 Y1..Y1+7000
stack s L1..L2 type:stair
stack r L1..L2 type:stair
`);
  const runs = verticalRuns(m).filter((r) => r.level === "L1");
  const stair = runs.find((r) => r.device === "stair")!;
  const ramp = runs.find((r) => r.device === "ramp")!;
  const st = runSolids(stair);
  assert.equal(st.length, stair.risers - 1); // 段板の数 = 蹴上げ数 - 1
  assert.ok(st.every((s) => s.kind === "box"));
  const rs = runSolids(ramp);
  assert.equal(rs.length, 1);
  assert.equal(rs[0]!.kind, "incline");
});

// ---- 描かれた線 (ADR-0022) ----

test("線: 一方が失う面積をもう一方が得る (合計は保存される)", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000 24000
grid Y 0 16000
level L1 0 h:2700
space /L1/w room X1..X2 Y1..Y2
space /L1/p corridor X2..X3 Y1..Y2
space /L1/e room X3..X4 Y1..Y2
space /out exterior
boundary /L1/w /L1/p t:120
  line X2,Y1 X3,Y2
boundary /L1/p /L1/e t:120
  line X3,Y1 X4,Y2
`);
  assert.equal(check(m).errors.length, 0);
  const w = areaM2(m.spaces.get("/L1/w")!)!;
  const p = areaM2(m.spaces.get("/L1/p")!)!;
  const e = areaM2(m.spaces.get("/L1/e")!)!;
  assert.equal(w + p + e, 384); // 8000×16000 × 3 = 384㎡
  assert.equal(p, 128); // 平行四辺形なので幅は変わらない
  assert.ok(w > 128 && e < 128);
});

test("線: 境界の実現は導出ではなく書かれた線そのものになる", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2,Y1 X2+4000,Y2
`);
  const b = m.boundaries.find((x) => x.drawn)!;
  const segs = segmentsFor(m, b);
  assert.equal(segs.length, 1);
  assert.equal(segs[0]!.diagonal, true);
  assert.deepEqual([segs[0]!.x1, segs[0]!.y1, segs[0]!.x2, segs[0]!.y2], [8000, 0, 12000, 16000]);
});

test("線: 片側が外部なら外皮を切り、切られた側に壁は立たない", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 16000
level L1 0 h:2700
space /L1/a room X1..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:200
  line X2,Y2 X3,Y2-8000
boundary /L1/a /out edge:N t:200
`);
  assert.equal(check(m).errors.length, 0);
  assert.equal(areaM2(m.spaces.get("/L1/a")!), 256 - 32); // 隅切り8000×8000の半分
  // 切り落とされた側の北面は短くなる
  const north = m.boundaries.find((b) => b.edge === "N")!;
  const len = segmentsFor(m, north).reduce((a, s) => a + (s.x2 - s.x1), 0);
  assert.equal(len, 8000);
});

test("線: 分離しない線はエラー (LIN01)", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1,Y1 X1,Y2
`);
  assert.ok(check(m).errors.some((e) => e.includes("分離していません")));
});

// ---- 柱 (ADR-0023) ----

test("柱: 位置は書かれず、通りの交点と床の交わりから現れる", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y3
space /out exterior
column 800 L1
`);
  const cols = columnsFor(m, "L1");
  // X1,X2 × Y1,Y2,Y3 のうち、/L1/a (0..8000 × 0..16000) の内側 (境界上を含む) は6点
  assert.equal(cols.length, 6);
  assert.ok(cols.every((c) => c.w === 800 && c.d === 800));
  assert.equal(check(m).errors.length, 0);
});

test("柱: 通りの限定と、床の無い階での警告", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000
level L1 0 h:2700
level L2 3000 slab:300
space /L1/a room X1..X3 Y1..Y2
column 800 L1 x:X2
column 600 L2
`);
  assert.equal(columnsFor(m, "L1").length, 2); // X2 × Y1,Y2
  assert.ok(check(m).warnings.some((w) => w.includes("立つ柱がありません")));
});

// ---- 面の要素 (ADR-0024) ----

test("面: 床・天井・屋根は語彙を持たず slab と h から現れる", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level R 6000 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
`);
  const all = slabs(m);
  const of = (k: string, path: string) => all.filter((s) => s.kind === k && s.space === path);
  // 床は階のFLの下へ slab ぶん下がる
  assert.deepEqual(of("floor", "/L1/a").map((s) => [s.z0, s.z1]), [[-300, 0]]);
  // 天井は h の位置に張られる
  assert.equal(of("ceiling", "/L1/a").length, 1);
  assert.equal(of("ceiling", "/L1/a")[0]!.z1, 2700);
  // 屋根: /L1/a は上階 /L2/b に半分だけ覆われるので、覆われていない側にだけ架かる
  const roof = of("roof", "/L1/a");
  assert.equal(roof.length, 1);
  assert.deepEqual(polyBounds(roof[0]!.outline), { x1: 8000, x2: 16000, y1: 0, y2: 8000 });
  // 最上階は全面に屋根 (上階レベル R の slab を厚みに使う)
  assert.deepEqual(of("roof", "/L2/b").map((s) => [s.z0, s.z1]), [[5600, 6000]]);
});

test("面: 吹抜けに床は無く、縦動線に天井は無く、ceiling:0 は現し天井", () => {
  const m = parse(`koyu 0.5
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2 ceiling:0
space /L1/s stair X2..X3 Y1..Y1+7000 stair:N
space /L2/s stair X2..X3 Y1..Y1+7000
space /L2/v void X1..X2 Y1..Y2
boundary /L1/a /L2/v type:void
stack s L1..L2 type:stair
`);
  const all = slabs(m);
  const kinds = (path: string) => all.filter((s) => s.space === path).map((s) => s.kind).sort();
  assert.ok(!kinds("/L2/v").includes("floor"), "吹抜けに床は無い");
  assert.ok(!kinds("/L1/s").includes("ceiling"), "縦動線に天井は無い (面でない)");
  assert.ok(!kinds("/L1/a").includes("ceiling"), "ceiling:0 は現し天井");
  assert.ok(kinds("/L1/a").includes("floor"), "床はある");
});

// ---- 軸測図 (ADR-0026) ----

test("軸測: 立体がSVGとして出る — 床・壁・柱・縦動線がすべて投影される", () => {
  const m = parse(`koyu 0.5
grid X 0 3000 6000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level R 6000 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
space /L1/a room X2..X3 Y1..Y1+7000
space /L2/a room X2..X3 Y1..Y1+7000
space /out exterior
boundary /L1/a /out t:200
boundary /L2/a /out t:200
boundary /L1/s /out t:200
boundary /L2/s /out t:200
column 600 L1..L2
stack s L1..L2 type:stair
`);
  const svg = svgAxo(m);
  assert.match(svg, /^<svg xmlns/);
  assert.match(svg, /軸測/);
  // 段板・柱・床がそれぞれ面として出る (面の数が桁で足りていることを見る)
  assert.ok(svg.split("<path").length > 100, "面が生成されている");
  // 向きを変えると別の投影になる
  assert.notEqual(svgAxo(m, { dir: "NW" }), svg);
});

test("軸測: 床の不在は屋根の不在ではない — 吹抜けの上は塞がる", () => {
  const m = parse(`koyu 0.5
grid X 0 4000 8000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level R 6000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
`);
  const roofs = slabs(m).filter((s) => s.kind === "roof");
  // 吹抜けは上に何も無いので屋根が架かる (天窓)。下の /L1/a は吹抜けに覆われるので架からない
  assert.deepEqual(roofs.filter((r) => r.space === "/L2/v").length, 1);
  assert.deepEqual(roofs.filter((r) => r.space === "/L1/a").length, 0);
});
