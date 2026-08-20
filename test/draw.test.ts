// 描画は Form を描くだけである (ADR-0040 / spec/derivation.md §7・§9)。
//
// 「導出の規則は仕様が持つ。実装ではない」(docs/policy.md §5.6-1) が成り立つ条件は、
// **形を組み立てる場所が一つしか無いこと**である。部品を共有していても組み立てを各自が
// 書けば、同じ原本から違う形が出る — ADR-0040 が数えた壊れ方 (壁厚 100mm が四箇所に別々の
// リテラルとして、上部吹抜けの投影が消費者ごとに、階高が 2550 と 2700 に) がそれである。
//
// ここが縛るのは四つ。
//   1. `src/draw/` が core から形を組み立てる部品を引かないこと (import を実際に読む)
//   2. 導出の定数が `src/draw/` に綴られていないこと
//   3. 平面の黒帯が Form の「切られた区間」そのものであること (相似変換を解いて突き合わせる)
//   4. 区間が足あとと芯線の両方を持ち、芯線が足あとの軸であること
//      — これがあるので描画側は四辺形から芯線を復元しない
// 加えて、外接範囲を畳んで取ること (大きな例で `Math.min(...pts)` がスタックを溢れさせた)。

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  band,
  bandLine,
  derive,
  DERIVATION_CONSTANTS,
  runPrism,
  thicken,
} from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { sectionForm } from "../src/core/section.js";
import { svgAxo } from "../src/draw/axo.js";
import { planMarks } from "../src/draw/marks.js";
import { svgPlan } from "../src/draw/plan.js";
import { svgElevation, svgSection } from "../src/draw/section.js";
import { OUTDOOR, ROOM, SEMI_OUTDOOR } from "../src/draw/sheet.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const DRAW = join(root, "src/draw");
const drawFiles = readdirSync(DRAW)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ name: `src/draw/${f}`, src: readFileSync(join(DRAW, f), "utf8") }));

// ---- 1. 形を組み立てる部品を引かない ----

/**
 * core にある「形を組み立てる」関数。描画がこれを引いた瞬間、組み立ての規則が
 * 消費者の側に増える。引いてよいのは `derive` と `Form` と、その実体の構成子だけである。
 */
const FORM_ASSEMBLY = [
  "areaM2",
  "columnsFor",
  "deriveDefaultBoundaries",
  "heff",
  "isCoveredAbove",
  "isIndoor",
  "isSemiOutdoor",
  "levelPitch",
  "levelsSorted",
  "placeBand",
  "placeOpening",
  "polygonAreaM2",
  "regionOf",
  "runDrawsForLevel",
  "runSolids",
  "segmentsFor",
  "slabs",
  "verticalRuns",
];

test("drawing: src/draw assembles no form — it pulls in derive and the Form, never the parts that build one", () => {
  const offenders: string[] = [];
  for (const f of drawFiles) {
    for (const m of f.src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g)) {
      const names = m[1]!.split(",").map((s) => s.replace(/^\s*type\s+/, "").trim().split(/\s+as\s+/)[0]!);
      for (const n of names) {
        if (FORM_ASSEMBLY.includes(n)) offenders.push(`${f.name} → ${n} (from ${m[2]})`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "drawing reaches for a part that builds the form — the rule would then live in two places:\n" +
      offenders.join("\n"),
  );
});

// ---- 2. 導出の定数が描画側に綴られていない ----

test("drawing: no derivation constant is spelled in src/draw (the ledger in core is the only source)", () => {
  const values = new Set(Object.values(DERIVATION_CONSTANTS));
  const offenders: string[] = [];
  for (const f of drawFiles) {
    for (const m of f.src.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;/gm)) {
      if (values.has(Number(m[2]))) offenders.push(`${f.name}: const ${m[1]} = ${m[2]}`);
    }
    for (const n of Object.keys(DERIVATION_CONSTANTS)) {
      if (new RegExp(`^const\\s+${n}\\s*=`, "m").test(f.src)) offenders.push(`${f.name}: redefines ${n}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "a derivation default is written on the drawing side — write it in core and let spec/derivation.md carry it:\n" +
      offenders.join("\n"),
  );
});

// ---- 3. 平面の黒帯は Form の区間そのもの ----

// azimuth is declared deliberately: the plan then draws a north arrow, and this test's population
// of black quads has to stay exactly the cut intervals plus the columns. Without it the arrow
// would be excluded by accident (no arrow to exclude) rather than by construction.
const SRC = `koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 9000
azimuth Y 347.5
level L1 0 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y3
space /L1/b room X2..X3 Y1..Y2
space /L1/c room X2..X3 Y2..Y3 t:150
space /out outside:1
column 600 L1
boundary /L1/a /L1/b
  door w:900
boundary /L1/b /L1/c
  window w:1200
boundary /L1/a /out edge:W
  window w:1600 h:1100
boundary /L1/c /out edge:N
`;

/** SVG から塗りつぶされた四辺形を拾う (色は問わない — 拾う色だけを引数で選ぶ) */
function filledQuads(svg: string, fill: string): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  for (const m of svg.matchAll(/<path\b([^>]*)>/g)) {
    const a = m[1]!;
    if ((/\bfill="([^"]*)"/.exec(a)?.[1] ?? "") !== fill) continue;
    const d = /\bd="([^"]*)"/.exec(a)?.[1] ?? "";
    if (/[AaCcQqSsTt]/.test(d)) continue;
    const n = [...d.matchAll(/-?[\d.]+/g)].map((x) => Number(x[0]));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!]);
    if (pts.length === 4) out.push(pts);
  }
  return out;
}

const bbox = (qs: Array<Array<[number, number]>>): [number, number, number, number] => {
  const xs = qs.flat().map((p) => p[0]);
  const ys = qs.flat().map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/** 四点を回転と向きに依らない一つの綴りへ */
const ringKey = (pts: Array<[number, number]>): string => {
  const s = pts.map(([x, y]) => `${Math.round(x * 1e6) / 1e6},${Math.round(y * 1e6) / 1e6}`);
  const rot = (a: string[]) =>
    a.map((_, i) => a.slice(i).concat(a.slice(0, i)).join(" ")).sort()[0]!;
  const f = rot(s);
  const r = rot([...s].reverse());
  return f < r ? f : r;
};

test("drawing: every black band of the plan is a cut interval of the Form — no shape is invented on paper", () => {
  const m = parse(SRC);
  const form = derive(m);
  const svg = svgPlan(m, { level: "L1" });

  // 紙に出た黒い四辺形 (壁の切られた区間 + 柱)
  const drawn = filledQuads(svg, "#1f1f1f");
  assert.ok(drawn.length > 0, "the plan draws something black");

  // Form が言う、そのレベルで切られた区間 + 柱
  const air = new Set(form.boundaries.filter((b) => b.air).map((b) => b.ref));
  const plan = form.plans.find((p) => p.level === "L1")!;
  const expected = plan.entities
    .filter(
      (e) =>
        e.polygon !== undefined &&
        ((e.of === "boundary" && e.class === "cut" && !air.has(e.ref)) || e.of === "column"),
    )
    .map((e) => e.polygon!.map((p) => [p.x, p.y] as [number, number]));
  assert.equal(drawn.length, expected.length, "the plan draws exactly as many bands as the Form has");

  // 紙は世界を一様に縮めて y を反転しただけである。倍率と原点は外接枠から解く
  const [dx0, dy0, dx1, dy1] = bbox(drawn);
  const [wx0, wy0, wx1, wy1] = bbox(expected);
  const k = (dx1 - dx0) / (wx1 - wx0);
  assert.ok(
    Math.abs(k - (dy1 - dy0) / (wy1 - wy0)) < 1e-9,
    "the paper scales x and y by the same factor",
  );
  const put = (p: [number, number]): [number, number] => [
    dx0 + (p[0] - wx0) * k,
    dy1 - (p[1] - wy0) * k,
  ];

  const bag = (qs: Array<Array<[number, number]>>) => {
    const b = new Map<string, number>();
    for (const q of qs) b.set(ringKey(q), (b.get(ringKey(q)) ?? 0) + 1);
    return b;
  };
  const got = bag(drawn.map((q) => q.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6] as [number, number])));
  const want = bag(expected.map((q) => q.map(put).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6] as [number, number])));
  assert.deepEqual([...got].sort(), [...want].sort(), "a band on paper does not come from the Form");
});

// ---- 4. 区間は足あとと芯線の両方を持つ ----

test("drawing: a wall interval carries both its body and its centreline, because the one cannot be read off the other", () => {
  const form = derive(parse(SRC));
  const thick = new Map(form.boundaries.filter((b) => b.material).map((b) => [b.ref, b.material!.t]));
  let seen = 0;
  let joined = 0;
  for (const plan of form.plans) {
    for (const e of plan.entities) {
      if (e.of !== "boundary" || !e.polygon) continue;
      seen++;
      assert.ok(e.lines?.length === 1, `${e.ref}: an interval with a body carries its centreline`);
      const q = e.polygon;
      const g = e.lines[0]!;
      // In a body whose junctions are settled, the midpoints of the two opposing sides do not give
      // the centre line back — **which is why both are carried.** The drawing side cannot recover
      // the axis from the outline
      const a = { x: (q[0]!.x + q[3]!.x) / 2, y: (q[0]!.y + q[3]!.y) / 2 };
      const b = { x: (q[1]!.x + q[2]!.x) / 2, y: (q[1]!.y + q[2]!.y) / 2 };
      if (![[a.x, g.x1], [a.y, g.y1], [b.x, g.x2], [b.y, g.y2]].every(([got, want]) => Math.abs(got! - want!) < 1e-9)) {
        joined++;
      }
      // A junction moves only the ends, along the centre line — the body never leaves the band of
      // the wall's own thickness
      const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      for (const p of q) {
        const across = Math.abs((g.x2 - g.x1) * (p.y - g.y1) - (g.y2 - g.y1) * (p.x - g.x1)) / len;
        assert.ok(across <= thick.get(e.ref)! / 2 + 1e-9, `${e.ref}: the body is wider than the wall`);
      }
    }
  }
  assert.ok(seen > 0, "the model has walls to look at");
  assert.ok(joined > 0, "the model has joined corners, where the body is not the centreline thickened");
});

test("derive: the constructors agree — a band is its own centreline thickened, and a box prism is flat", () => {
  const seg = { x1: 0, y1: 0, x2: 3000, y2: 4000, horizontal: false, vertical: false, diagonal: true };
  const g = bandLine(seg, 1500, 2000, 1000);
  assert.deepEqual(band(seg, 1500, 2000, 1000, 200), thicken(g.x1, g.y1, g.x2, g.y2, 200));
  // 帯の長さは書かれた幅そのものである (斜めでも同じ一つの式 — spec/derivation.md §3.2)
  assert.ok(Math.abs(Math.hypot(g.x2 - g.x1, g.y2 - g.y1) - 1000) < 1e-9);

  const box = runPrism({ kind: "box", rect: { x1: 0, y1: 0, x2: 1000, y2: 2000 }, z0: 100, z1: 400 });
  assert.deepEqual(box.bottom, [100, 100, 100, 100]);
  assert.deepEqual(box.top, [400, 400, 400, 400]);
  const ramp = runPrism({
    kind: "incline",
    rect: { x1: 0, y1: 0, x2: 1000, y2: 2000 },
    up: "E",
    z0: 0,
    z1: 600,
    t: 200,
  });
  // up:E なので x が大きい二隅が高い。厚さは版なりに平行についてくる
  assert.deepEqual(ramp.top, [0, 600, 600, 0]);
  assert.deepEqual(ramp.bottom, [-200, 400, 400, -200]);
});

// ---- 5. 外接範囲は畳んで取る ----

test("drawing: the axonometric of a model with tens of thousands of solids still draws (the extent is folded, not spread)", () => {
  // `Math.min(...pts)` は引数がスタックの限界 (12万強) を超えると RangeError で落ちる。
  // 壁が開口で割られて区間ごとに一片になった時点で、同梱の双塔がこれを踏んだ。
  // ここでは通り芯だけで柱を大量に立てて、同じ限界を安く超える
  const N = 160;
  const axis = (a: string) => `grid ${a} ` + Array.from({ length: N }, (_, i) => i * 1000).join(" ");
  const m = parse(`koyu 1.1
${axis("X")}
${axis("Y")}
level L1 0 h:2700 slab:200
space /L1/a room X1..X${N} Y1..Y${N}
space /out outside:1
boundary /L1/a /out
column 600 L1
`);
  const form = derive(m);
  assert.ok(form.columns.length > 25000, `the model has ${form.columns.length} columns`);
  const svg = svgAxo(m);
  assert.match(svg, /^<svg xmlns/);
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  // 外接枠が有限であること — 畳み忘れると Infinity が viewBox へ漏れる
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  assert.ok(box, "the axonometric carries a viewBox");
  assert.ok(Number.isFinite(Number(box[1])) && Number(box[1]!) > 0);
  assert.ok(Number.isFinite(Number(box[2])) && Number(box[2]!) > 0);
});

// ---- The section and the elevation (ADR-0064) ----

test("drawing: every black band of a section is a body the plane cut, and nothing else is one", () => {
  // The counterpart of the plan's black-band test, and it holds the same law: the poché **is** the
  // `cut` classification of the `Form`, not a shape the drawing worked out for itself. If the two
  // ever disagree, a viewer written against `Form` draws a different building from `koyu section`.
  const m = parseFile(join(root, "examples/house/main.muro"));
  const section = sectionForm(derive(m), { axis: "X", at: 4540, atRef: "X2+900", look: "W" });
  const svg = svgSection(m, { axis: "X", at: 4540, atRef: "X2+900" });

  // The air of a room and the leaf of an opening are cut too, but they are not matter and are not
  // painted as it. What is left is the poché.
  const poche = section.entities.filter(
    (e) => e.class === "cut" && e.of !== "space" && e.of !== "opening",
  );
  const black = [...svg.matchAll(/<path d="[^"]*" fill="#1f1f1f"\/>/g)];
  assert.equal(
    black.length,
    poche.length,
    `the sheet paints ${black.length} bodies solid and the plane cut ${poche.length}`,
  );
  assert.ok(poche.length > 0, "there is something to cut");
});

test("drawing: a section of a model with tens of thousands of bodies still draws (the extent is folded)", () => {
  const N = 160;
  const axis = (a: string) => `grid ${a} ` + Array.from({ length: N }, (_, i) => i * 1000).join(" ");
  const m = parse(`muro 1.3
${axis("X")}
${axis("Y")}
level L1 0 h:2700 slab:200
space /L1/a room X1..X${N} Y1..Y${N}
space /out outside:1
boundary /L1/a /out
column 600 L1
`);
  assert.ok(derive(m).columns.length > 25000, "the model is large enough to overflow a spread");
  for (const svg of [
    svgSection(m, { axis: "X", at: 80000 }),
    svgElevation(m, { face: "S" }),
  ]) {
    assert.match(svg, /^<svg xmlns/);
    assert.ok(svg.trimEnd().endsWith("</svg>"));
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    assert.ok(box, "the drawing carries a viewBox");
    assert.ok(Number.isFinite(Number(box[1])) && Number(box[1]!) > 0);
    assert.ok(Number.isFinite(Number(box[2])) && Number(box[2]!) > 0);
  }
});

test("drawing: a plane with the whole building behind the viewer is said so, not written out empty", () => {
  // Looking west from a plane far to the west leaves the building behind you. Nothing is produced,
  // and an empty sheet must not be written out and then announced as a drawing.
  const m = parseFile(join(root, "examples/two-rooms.muro"));
  assert.throws(() => svgSection(m, { axis: "X", at: -900000, look: "W" }), /There is nothing to draw/);
  // The same plane looked at the other way is the whole building in elevation, and draws.
  assert.match(svgSection(m, { axis: "X", at: -900000, look: "E" }), /^<svg xmlns/);
});

test("drawing: every drawing carries the mark", () => {
  const m = parseFile(join(root, "examples/two-rooms.muro"));
  for (const svg of [
    svgPlan(m, { level: "L1" }),
    svgAxo(m),
    svgSection(m, { axis: "Y", at: 2250 }),
    svgElevation(m, { face: "S" }),
  ]) {
    assert.match(svg, /<g transform="translate\([^)]*\) scale\([^)]*\)"><path d="M1027\.53 171\.361/);
  }
});

test("drawing: indoors, semi-outdoors and outdoors are three different fills on the plan", () => {
  // **What is pinned is the distinction, not the colour.** `src/draw` does not freeze, so any of
  // these three may be re-chosen; what may not happen is two of them collapsing into one, which is
  // the state the plan was in before — a forecourt and an entrance hall drawn as one field of the
  // same cream, on a sheet whose whole job is to say which is which.
  const svg = svgPlan(
    parse(`muro 1.4
grid X 0 3600 7200 10800
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room room X1..X2 Y1..Y2
space /L1/deck terrace X2..X3 Y1..Y2
space /L1/yard X3..X4 Y1..Y2 outside:1 name:Forecourt
space /out outside:1
boundary /L1/deck /out air:1
boundary /L1/room /out
boundary /L1/yard /out`),
    { level: "L1" },
  );
  const form = derive(parse(`muro 1.4
grid X 0 3600 7200 10800
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room room X1..X2 Y1..Y2
space /L1/deck terrace X2..X3 Y1..Y2
space /L1/yard X3..X4 Y1..Y2 outside:1 name:Forecourt
space /out outside:1
boundary /L1/deck /out air:1
boundary /L1/room /out
boundary /L1/yard /out`));
  const of = (path: string) => form.spaces.find((x) => x.path === path)!;
  assert.equal(of("/L1/room").outside, false, "the fixture must actually hold the three kinds");
  assert.equal(of("/L1/room").semiOutdoor, false);
  assert.equal(of("/L1/deck").semiOutdoor, true);
  assert.equal(of("/L1/yard").outside, true);

  const fills = new Set([ROOM, SEMI_OUTDOOR, OUTDOOR]);
  assert.equal(fills.size, 3, "the three are three colours, not two spelled twice");
  for (const c of fills) {
    assert.ok(svg.includes(`fill="${c}"`), `the plan draws nothing in ${c}`);
  }
});

test("drawing: a mark says which of the three a space's face is, so another viewer can disagree about the colour only", () => {
  // The roles are a closed union on purpose (`MarkRole`): a consumer spelling them exhaustively
  // stops compiling when one arrives, rather than silently never drawing it.
  const model = parse(`muro 1.4
grid X 0 3600 7200 10800
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room room X1..X2 Y1..Y2
space /L1/deck terrace X2..X3 Y1..Y2
space /L1/yard X3..X4 Y1..Y2 outside:1
space /out outside:1
boundary /L1/deck /out air:1
boundary /L1/room /out
boundary /L1/yard /out`);
  const roles = new Map(
    planMarks(derive(model), "L1")
      .filter((k) => k.of === "space" && k.class === "cut")
      .map((k) => [k.ref, k.role]),
  );
  assert.equal(roles.get("/L1/room"), "space");
  assert.equal(roles.get("/L1/deck"), "space-semi-outdoor");
  assert.equal(roles.get("/L1/yard"), "space-outdoor");
});
