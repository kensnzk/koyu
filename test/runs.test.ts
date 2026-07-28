// 縦動線 (ADR-0021)・描かれた線 (ADR-0022)・柱 (ADR-0023) の保証。
// 「書かないが検査する」構えは、導出値そのものをテストで固定して初めて意味を持つ。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { validate } from "../src/validate/index.js";
import { doorsBetween, segmentsFor } from "../src/core/graph.js";
import { areaM2, columnsFor, polyBounds, polygonAreaM2 } from "../src/core/model.js";
import { slabs } from "../src/core/fabric.js";
import { svgAxo } from "../src/draw/axo.js";
import { parse } from "../src/core/parse.js";
import { runDrawsForLevel, runSolids, verticalRuns } from "../src/core/vertical.js";

const BASE = `koyu 0.5
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
`;

// ---- 縦動線: 形は書かれず、導出される ----

test("stair: the number of risers, the riser and the tread are derived though none of them is written", () => {
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
  // 縦動線まわりの構造整合の診断が無いことを見る。外皮の穴は検証の面なので
  // core の check には現れない (spec/scope.md §3)
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("the same stairwell splits into different steps once the storey height changes (nowhere is it written twice)", () => {
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

test("a run does not start at the edge of the region — the entry floor is where the door opens", () => {
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

test("escalator: the nominal width decides how many units, and the one beside an up unit goes down", () => {
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

test("escalator: the down unit tilts the same way as the up unit (the direction of travel is not geometry)", () => {
  // reversed は「人が t の減る向きに進む」だけを言う。機械としては二台とも同じ向きに
  // 架かっている — ここを混ぜたために、下りの台が鏡像に傾いていた
  const m = parse(`${BASE}
space /L1/e escalator X1..X2 Y1..Y1+7000 escalator:N
space /L2/e escalator X1..X2 Y1..Y1+7000
stack e L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  const inc = runSolids(run).filter((s) => s.kind === "incline");
  assert.equal(inc.length, 6); // 台ごとに版一枚と欄干二枚
  const decks = inc.filter((s) => s.rect.x2 - s.rect.x1 > 500);
  assert.equal(decks.length, 2);
  assert.deepEqual(
    inc.map((s) => (s.kind === "incline" ? s.up : "")),
    ["N", "N", "N", "N", "N", "N"],
    "the down unit and its balustrades rise toward N as well",
  );
});

test("plan: both parallel units appear cut, and the break line is drawn at that unit's own position", () => {
  // 可視を部品の番号で決めていたため、二台目が自分の階の平面から丸ごと消えていた
  const m = parse(`${BASE}
space /L1/e escalator X1..X2 Y1..Y1+7000 escalator:N
space /L2/e escalator X1..X2 Y1..Y1+7000
stack e L1..L2 type:stair
`);
  const [d] = runDrawsForLevel(m, "L1");
  assert.equal(d!.arrows.length, 2, "one up and one down");
  assert.deepEqual(d!.arrows.map((a) => a.up).sort(), [false, true]);
  // 矢印は台ごとに違う s (幅方向) に乗る — 同じ台に二本ではない
  assert.notEqual(d!.arrows[0]!.x1, d!.arrows[1]!.x1);
  // 下りの矢印は下流へ向かう。up は N (+Y) なので DN は y が減る向き
  const dn = d!.arrows.find((a) => !a.up)!;
  assert.ok(dn.y2 < dn.y1, "DN points against the ascending slope");
  const up = d!.arrows.find((a) => a.up)!;
  assert.ok(up.y2 > up.y1);
  // 切断線は跨いだ台ごとに一本 (作図慣習の二本の斜線は描画側が引く — ADR-0040)
  assert.equal(d!.breaks.length, 2, "one crossing per unit");
  // 切断線は台の幅の中に収まる (一台の位置を全台へ配っていない)
  for (const b of d!.breaks) assert.ok(Math.abs(b.x2 - b.x1) <= 1200 + 1);
});

test("plan: the descending run appears in what the ascending run left — per unit even when parallel", () => {
  const m = parse(`${BASE}
level L3 6000 h:2700 slab:300
space /L1/e escalator X1..X2 Y1..Y1+7000 escalator:N
space /L2/e escalator X1..X2 Y1..Y1+7000 escalator:N
space /L3/e escalator X1..X2 Y1..Y1+7000
stack e L1..L3 type:stair
`);
  const l2 = runDrawsForLevel(m, "L2");
  assert.equal(l2.length, 2); // 上る走りと下りる走り
  const down = l2.find((d) => d.arrows.length > 0 && d.breaks.length === 0)!;
  assert.equal(down.arrows.length, 2, "both units of the run from the storey below show");
  assert.equal(down.outline.length, 4, "two side lines per unit");
});

test("plan: twins are twins only once the direction matches too, not the position alone", () => {
  // 上る走りの切断位置を、向きの違う下りの走りへ当てると鏡像の平面が出る。
  // 揃っていないなら双子ではない — 下りる走りは丸ごと見える
  const src = (upper: string) => `${BASE}
level L3 6000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000 stair:${upper}
space /L3/s stair X1..X2 Y1..Y1+7000
stack s L1..L3 type:stair
`;
  const span = (upper: string) => {
    const down = runDrawsForLevel(parse(src(upper)), "L2").find((d) => d.breaks.length === 0)!;
    const ys = down.outline.flatMap((o) => [o.y1, o.y2]);
    return Math.max(...ys) - Math.min(...ys);
  };
  // 向きが揃うなら、下りは上りが隠した残り (切断線から先) にだけ現れる
  const same = span("N");
  // 向きが違えば双子ではない — 切断位置を借りず、丸ごと見える
  const flipped = span("S");
  assert.ok(same < flipped - 1000, `aligned ${Math.round(same)} < flipped ${Math.round(flipped)}`);
  assert.equal(Math.round(flipped), 4800); // 乗り込みを除いた走りの全長
});

test("stair: a return stair has a different tread per flight — the tightest flight represents it for checking", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N form:return
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  const per = run.parts.flatMap((p) => (p.kind === "flight" && p.tread ? [p.tread] : []));
  assert.equal(per.length, 2);
  assert.equal(Math.round(run.tread), Math.round(Math.min(...per)));
  assert.ok(run.tread <= Math.max(...per) + 1);
});

test("ramp: the slope is derived rather than written, and a slope steeper than the declared slope: draws a finding", () => {
  const m = parse(`${BASE}
space /L1/r ramp X1..X2 Y1..Y1+7000 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y1+7000
stack r L1..L2 type:stair
`);
  const run = verticalRuns(m).find((r) => r.level === "L1")!;
  assert.ok(run.slope > 1 / 12);
  // 勾配は建築の側の判断 — core は黙り、検証の面が言う
  assert.deepEqual(check(m).warnings, []);
  assert.ok(validate(m).some((f) => f.rule === "run.slope" && f.message.includes("slope")));
});

test("the shape is there but the graph cannot pass — with no vertical boundary a finding comes out (run.disconnected)", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
`);
  const r = check(m);
  assert.equal(r.errors.length, 0);
  assert.ok(validate(m).some((f) => f.rule === "run.disconnected" && f.message.includes("no vertical boundary")));
  assert.equal(doorsBetween(m, "/L1/s", "/L2/s"), undefined);
});

test("vertical circulation is exempt from the height invariant (its ceiling is not a surface)", () => {
  // 天井高2700 + 上階slab300 = 3000 で階高ちょうど。階段室だけ h を超えても通る
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 h:2900 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  assert.equal(check(m).errors.length, 0);
});

test("plan: the ascending run is cut at the break line, and beyond it the descending run shows", () => {
  const m = parse(`${BASE}
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
`);
  const l1 = runDrawsForLevel(m, "L1");
  assert.equal(l1.length, 1); // L1には上る走りだけ (下はレベルが無い)
  assert.ok(l1[0]!.breaks.length > 0, "a break line is drawn");
  assert.deepEqual(l1[0]!.arrows.map((a) => a.up), [true]);

  const l2 = runDrawsForLevel(m, "L2");
  // L2 は最上階なので上る走りが無く、下りる走りだけが丸ごと見える
  assert.deepEqual(l2.map((d) => d.arrows.map((a) => a.up)), [[false]]);
  assert.equal(l2[0]!.breaks.length, 0);
});

test("solid: a stair becomes a set of treads, a ramp becomes an inclined slab", () => {
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

test("line: the area one side loses the other gains (the total is preserved)", () => {
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

test("line: the boundary is realized as the written line itself, not as something derived", () => {
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

test("line: with exterior on one side it cuts the envelope, and no wall stands on the cut-off side", () => {
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

test("line: a line that does not separate is an error (LIN01)", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1,Y1 X1,Y2
`);
  assert.ok(check(m).errors.some((e) => e.includes("does not separate")));
});

// ---- 柱 (ADR-0023) ----

test("column: the position is not written; it emerges where grid intersections meet a floor", () => {
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

test("column: none stands on a floor that carries only sky — an open terrace is excluded, but under an overhang above they stand (ADR-0030)", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000 16000
level L1 0 h:2700
level L2 3000 h:2700 slab:300
space /out exterior
space /L1/a room X1..X3 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
space /L2/t terrace X2..X3 Y1..Y2
boundary /L2/t /out edge:E air:1 t:120
boundary /L2/t /out edge:S air:1 t:120
column 800 L1..L2
`);
  // L1: 全6交点 (屋内)。L2: /L2/b の内側4点は立つが、露天テラス /L2/t だけの X3列は立たない
  assert.equal(columnsFor(m, "L1").length, 6);
  const l2 = columnsFor(m, "L2").map((c) => c.grid);
  assert.deepEqual(l2, ["X1/Y1", "X1/Y2", "X2/Y1", "X2/Y2"]);
  // 同じテラスでも上に床が重なれば (張り出しの下) 柱は戻る
  const m2 = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000 16000
level L1 0 h:2700
level L2 3000 h:2700 slab:300
level L3 6000 h:2700 slab:300
space /out exterior
space /L2/t terrace X2..X3 Y1..Y2
boundary /L2/t /out edge:E air:1 t:120
space /L3/c room X2..X3 Y1..Y2
column 800 L2
`);
  assert.equal(columnsFor(m2, "L2").length, 4); // X2,X3 × Y1,Y2 — 全交点が戻る
});

test("column: restricting the grid lines, and the warning on a storey with no floor", () => {
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
  assert.ok(check(m).warnings.some((w) => w.includes("Not one column stands")));
});

// ---- 面の要素 (ADR-0024) ----

test("surface: floor, ceiling and roof carry no vocabulary of their own; they emerge from slab and h", () => {
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

test("surface: a void has no floor, vertical circulation has no ceiling, and ceiling:0 is an exposed ceiling", () => {
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
  assert.ok(!kinds("/L2/v").includes("floor"), "a void has no floor");
  assert.ok(!kinds("/L1/s").includes("ceiling"), "vertical circulation has no ceiling (it is not a surface)");
  assert.ok(!kinds("/L1/a").includes("ceiling"), "ceiling:0 is an exposed ceiling");
  assert.ok(kinds("/L1/a").includes("floor"), "the floor is there");
});

// ---- 軸測図 (ADR-0026) ----

test("axo: the solid comes out as SVG — floors, walls, columns and vertical circulation are all projected", () => {
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
  assert.match(svg, /axonometric/);
  // 段板・柱・床がそれぞれ面として出る (面の数が桁で足りていることを見る)
  assert.ok(svg.split("<path").length > 100, "faces are generated");
  // 向きを変えると別の投影になる
  assert.notEqual(svgAxo(m, { dir: "NW" }), svg);
});

test("axo: a solid carries a bottom face — where it can be looked at from below, the inside does not show", () => {
  // 箱を「上面+側面」だけで作ると**底の無い箱**になる。普通は見えないが、
  // -l で階を絞った最下段や、外へ張り出した柱では下から覗けて中身が見える。
  // 実際に見えた (外周柱の足元が抜けていた)
  const m = parse(`koyu 0.5
grid X 0 4000
grid Y 0 4000
level L1 0 h:3000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out t:200 spec:CW`);
  const svg = svgAxo(m, {});
  // **底面と上面は同じ形が上下にずれて現れる。**軸測投影は平行投影なので、
  // 一つの立体の上端と下端は合同な多角形になり、y だけが違う。
  // 色や面の数ではなくこの形の対で見るので、陰影を変えても壊れない
  const shapes = new Map<string, number[]>();
  for (const m2 of svg.matchAll(/<path d="([^"]+)"/g)) {
    const pts = [...m2[1]!.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
    if (pts.length < 6) continue;
    const [x0, y0] = pts;
    // 先頭を原点に寄せた相対座標が「形」。y の絶対値だけを別に持つ
    const key = pts.map((v, i) => (i % 2 ? v - y0! : v - x0!).toFixed(1)).join(",");
    (shapes.get(key) ?? shapes.set(key, []).get(key)!).push(y0!);
  }
  const paired = [...shapes.values()].filter((ys) => ys.length >= 2 && Math.max(...ys) - Math.min(...ys) > 1);
  assert.ok(paired.length > 0, "the same shape does not appear twice, one above the other — no bottom face is drawn");
});

test("axo: the absence of a floor is not the absence of a roof — a void is closed over", () => {
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

test("line: on the cut-off side the edge shared with the neighbour shortens too (no wall juts outside)", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 8000 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y3
space /L1/b room X2..X3 Y1..Y3
space /out exterior
boundary /L1/b /out t:200
  line X2,Y2 X3,Y3
boundary /L1/a /out t:200
`);
  assert.equal(check(m).errors.length, 0);
  // 隅切りで b の北西側が落ちるので、a と b の共有辺 (x=8000) は y 0..8000 だけになる
  const shared = m.boundaries.find(
    (x) => !x.drawn && [x.a, x.b].includes("/L1/a") && [x.a, x.b].includes("/L1/b"),
  )!;
  const segs = segmentsFor(m, shared);
  assert.equal(segs.length, 1);
  assert.deepEqual([segs[0]!.x1, segs[0]!.y1, segs[0]!.x2, segs[0]!.y2], [8000, 0, 8000, 8000]);
});

// ---- 母集団のずれ (ADR-0027) — どれも check が緑のまま黙って壊れていた ----

test("line: a distant wing does not flip the direction of the corner cut (the L-shaped room does not vanish)", () => {
  const m = parse(`koyu 0.5
grid X 0 7000 8000 10000
grid Y 0 8000 10000 40000
level L1 0 h:2400
space /L1/a room X1..X4 Y1..Y2 + X1..X2 Y2..Y4 name:L字の室
space /out exterior
boundary /L1/a /out t:150
  line X3,Y2 X4,Y1
`);
  assert.equal(check(m).errors.length, 0);
  // 10000×8000 + 7000×32000 = 304㎡ から、隅の三角 (2000×8000/2 = 8㎡) を落とす
  assert.equal(areaM2(m.spaces.get("/L1/a")!), 296);
});

test("roof: cut only the upper storey on a diagonal and a roof spans right below the cut", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000
grid Y 0 16000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level R 6000 slab:300
space /L1/a room X1..X3 Y1..Y2
space /L2/b room X1..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:200
boundary /L2/b /out t:200
  line X1,Y2 X2,Y1
`);
  assert.equal(check(m).errors.length, 0);
  const cut = 256 - areaM2(m.spaces.get("/L2/b")!)!; // 切り落とした面積
  assert.ok(cut > 0, "the upper storey is cut");
  const roof = slabs(m).filter((s) => s.kind === "roof" && s.space === "/L1/a");
  assert.ok(roof.length > 0, "a roof spans the range that was cut off");
  const a = roof.reduce((t, s) => t + polygonAreaM2(s.outline), 0);
  assert.ok(Math.abs(a - cut) < 0.5, `the roof area matches what was cut off: ${a} vs ${cut}`);
});

test("line: an axis-parallel line is not falsely reported as cutting nothing", () => {
  const m = parse(`koyu 0.5
grid X 0 8000 16000 24000
grid Y 0 16000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X4 Y1..Y2
boundary /L1/a /L1/b t:120
  line X3,Y1 X3,Y2
`);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter((w) => w.includes("cuts nothing")), []);
  // 割付は X2 で分かれていたが、線が X3 へ動かした
  assert.equal(areaM2(m.spaces.get("/L1/a")!), 256);
});

test("default boundary: no boundary without a source is made for a pair whose contact a line removed", () => {
  const m = parse(`koyu 0.5
grid X 0 3000 4000 9000
grid Y 0 4500
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X4 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
boundary /L1/b /out t:150
  line X2,Y1 X3,Y2
`);
  // 以前は rects の接触で既定壁が生まれ、線分ゼロの境界に位置なしの BND04 が出た
  assert.deepEqual(check(m).errors, []);
  const derived = m.boundaries.filter((b) => b.derived);
  for (const b of derived) assert.ok(segmentsFor(m, b).length > 0, `${b.a}|${b.b} has segments`);
});
