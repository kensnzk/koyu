// L字領域・ゾーン・吹抜け (void)・採光 — 2026-07-23 後半の設計の検証

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween, segmentsFor } from "../src/graph.js";
import { daylight } from "../src/light.js";
import { areaM2, effectiveUse } from "../src/model.js";
import { parse } from "../src/parse.js";

const mansion = readFileSync(
  fileURLToPath(new URL("../examples/mansion.ifcxs", import.meta.url)),
  "utf8",
);
const office = readFileSync(
  fileURLToPath(new URL("../examples/office.ifcxs", import.meta.url)),
  "utf8",
);

test("L字の室: LDKは2矩形の合併で面積は合計", () => {
  const m = parse(mansion);
  const ldk = m.spaces.get("/L2/A/ldk")!;
  assert.equal(ldk.rects.length, 2);
  assert.equal(areaM2(ldk), 17.08);
});

test("L字の外周: 共線の外壁は一本にまとまり、掃き出し窓が置ける", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/out")!;
  const segs = segmentsFor(m, b);
  const south = segs.filter((s) => s.edgeOfA === "S");
  assert.equal(south.length, 1); // 2矩形のS辺が1本にマージ
  assert.equal(south[0]!.x1, 0);
  assert.equal(south[0]!.x2, 5800);
});

test("同一ペアの複数線分: LDK|洋室はL字で2辺接し、edgeで扉の辺を選ぶ", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/L2/A/bedroom")!;
  assert.equal(segmentsFor(m, b).length, 2); // 縦 (W) と横 (N)
  const r = check(m);
  assert.deepEqual(r.errors, []); // door edge:W で曖昧が解けている
});

test("ゾーンのuse継承: 間取りの室は住戸のexclusiveを継ぐ", () => {
  const m = parse(mansion);
  assert.equal(effectiveUse(m, m.spaces.get("/L2/A/ldk")!), "exclusive");
  assert.equal(effectiveUse(m, m.spaces.get("/L2/B")!), "exclusive");
  assert.equal(effectiveUse(m, m.spaces.get("/L2/corridor")!), "common");
});

test("吹抜け: 高さ不変量はvoid境界で宣言的に免除される", () => {
  const m = parse(office);
  const r = check(m);
  assert.deepEqual(r.errors, []); // hall h:6700 は L2 に食い込むが void で免除
  assert.deepEqual(r.warnings, []);
});

test("吹抜けの免除はvoid境界なしでは働かない", () => {
  const m = parse(office.replace("boundary /L1/hall /L2/void type:void", ""));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("食い込み")));
});

test("吹抜けは通行できず、床面積にも入らない", () => {
  const m = parse(office);
  assert.equal(doorsBetween(m, "/L1/hall", "/L2/void"), undefined);
  const total = [...m.spaces.values()]
    .filter((s) => s.type !== "void")
    .reduce((sum, s) => sum + (areaM2(s) ?? 0), 0);
  assert.equal(Math.round(total * 100) / 100, 419.84); // 460.8 - 40.96 (吹抜け)
});

test("採光: 51室すべてが1/7を満たす (補正係数なしの粗い判定)", () => {
  const m = parse(mansion);
  const results = daylight(m);
  assert.equal(results.length, 51); // (LDK+洋室)×8 + B〜E×8×... 住居系の居室
  assert.ok(results.every((r) => r.ok));
});

test("採光: 窓を失えば落ちる", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
`);
  const r = daylight(m);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.ok, false); // 0.36㎡ < 16.2/7
});
