// 10階建て内廊下型集合住宅 — 基準階の反復 (スパン展開とstack) の検証

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { areaM2, effectiveUse, zoneAreaM2 } from "../src/model.js";
import { parse } from "../src/parse.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/mansion.ifcxs", import.meta.url)),
  "utf8",
);

test("200行たらずのテキストが10フロア114空間に展開される", () => {
  const m = parse(src);
  assert.ok(src.split("\n").length < 200);
  assert.equal(m.spaces.size, 114);
  assert.equal(m.boundaries.length, 316);
  assert.equal(Object.keys(m.levels).length, 11); // L1..L10 + R (範囲宣言L3..L9は7レベル)
  assert.equal(m.zones.size, 8); // Aタイプのゾーン × L2..L9
});

test("基準階の展開: どの階も同じ割付、レベルのzはpitchで積まれる", () => {
  const m = parse(src);
  assert.deepEqual(m.spaces.get("/L5/A/ldk")!.rects, m.spaces.get("/L2/A/ldk")!.rects);
  assert.deepEqual(m.spaces.get("/L9/E")!.rects, m.spaces.get("/L3/E")!.rects);
  assert.equal(m.levels["L5"]!.z, 12500); // 6700 + 2900×2
  assert.equal(m.levels["L9"]!.z, 24100);
});

test("stackの展開: EVシャフト9本・階段9本の垂直境界", () => {
  const m = parse(src);
  assert.equal(m.boundaries.filter((b) => b.kind === "shaft").length, 9);
  assert.equal(m.boundaries.filter((b) => b.kind === "stair").length, 9);
});

test("整合チェックが警告ゼロで通る (10フロアぶんの高さ不変量含む)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("避難の問い: 9階のLDKから地上まで扉3枚 (室内扉・玄関・階段防火戸)", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L9/A/ldk", "/out")!;
  assert.equal(route.doors, 3);
  assert.equal(route.path.at(-2), "/L1/stair"); // 屋外階段で地上へ、最後は開放
  // EVシャフトは通れないので、EVからも階段迂回
  const ev = doorsBetween(m, "/L5/ev", "/out")!;
  assert.ok(ev.path.includes("/L5/corridor"));
});

test("2階の洋室から9階の洋室へは扉8枚", () => {
  const m = parse(src);
  assert.equal(doorsBetween(m, "/L2/A/bedroom", "/L9/A/bedroom")!.doors, 8);
});

test("面積: 専有1704㎡ — 間取りに割ってもゾーンの集計で不変", () => {
  const m = parse(src);
  const exclusive = [...m.spaces.values()]
    .filter((s) => effectiveUse(m, s) === "exclusive")
    .reduce((sum, s) => sum + (areaM2(s) ?? 0), 0);
  assert.equal(Math.round(exclusive * 100) / 100, 1704);
  assert.equal(zoneAreaM2(m, "/L5/A"), 34.8); // 住戸=ゾーンの面積は室の合計
});

test("一行の中で異なるレベル範囲は使えない", () => {
  assert.throws(
    () =>
      parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700
level L2 3000 h:2400 slab:600
level L3 6000 h:2400 slab:600
space /L1..L2/a room X1..X2 Y1..Y2
space /L2..L3/b room X2..X3 Y1..Y2
boundary /L1..L2/a /L2..L3/b t:120
`),
    /レベル範囲は揃えます/,
  );
});

test("レベル範囲の宣言には pitch が要る", () => {
  assert.throws(() => parse("level L2..L5 3000 h:2400"), /pitch/);
});
