// ショーケース: 街角の複合ビル (examples/tower/) — 全機能の実証を回帰で守る。
// 9ファイル合成・非矩形敷地 (polygon)・角地2道路・吹抜け・L字住戸・バルコニー・
// 例外階 (L3テラス)・ペントハウス・アセット・明示位置・スパン・stack。

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { daylight } from "../src/light.js";
import { doorsBetween } from "../src/graph.js";
import { isSemiOutdoor, zoneAreaM2 } from "../src/model.js";
import { parseFile } from "../src/parse-file.js";
import { siteReport } from "../src/site.js";

const mainPath = fileURLToPath(new URL("../examples/tower/main.muro", import.meta.url));

test("tower: 9レイヤーが一棟にビルドされ、警告ゼロで整合する", () => {
  const m = parseFile(mainPath);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(m.spaces.size, 178);
  assert.equal(m.boundaries.length, 542);
});

test("tower: 延床4785.92㎡ (商業+住宅)、Aタイプは各階61.44㎡", () => {
  const m = parseFile(mainPath);
  assert.equal(zoneAreaM2(m, "/L5/A"), 61.44);
  const site = siteReport(m);
  assert.equal(site.totalFloor, 4785.92);
});

test("tower: 非矩形敷地 — polygon導出面積が測量宣言と一致し、角地の接道が2本出る", () => {
  const m = parseFile(mainPath);
  const site = siteReport(m);
  assert.equal(site.polygon?.points.length, 5);
  assert.equal(site.derivedArea, 1097.8);
  assert.equal(site.declaredArea, 1097.8);
  assert.equal(site.roads.length, 2);
  const widths = site.roads.map((r) => r.width).sort((a, b) => a - b);
  assert.deepEqual(widths, [6000, 12000]);
});

test("tower: 敷地形状の外に建物を出すとエラーになる", () => {
  const m = parseFile(mainPath);
  // 塔状部の東端住戸を敷地東端 (x=38000) を越えて広げたと仮定した検査は
  // polygon.test.ts が担う。ここでは現状が内包されていることだけ確かめる
  const r = check(m);
  assert.equal(r.errors.filter((e) => e.includes("敷地形状")).length, 0);
});

test("tower: バルコニーとテラスは半屋外の導出 (宣言なし)", () => {
  const m = parseFile(mainPath);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/bA")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L3/tA")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L11/roof")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/A/ldk")!), false);
});

test("tower: 全居室が採光1/7を満たす (バルコニー越し0.7掛け含む)", () => {
  const m = parseFile(mainPath);
  const rep = daylight(m);
  assert.equal(rep.length > 60, true);
  assert.deepEqual(rep.filter((r) => !r.ok).map((r) => r.space.path), []);
});

test("tower: 避難の問い — 9階LDKから道路まで扉4枚、PHは3枚", () => {
  const m = parseFile(mainPath);
  const a = doorsBetween(m, "/L9/A/ldk", "/out/road-s");
  assert.equal(a?.doors, 4);
  const ph = doorsBetween(m, "/L11/PB", "/out/road-s");
  assert.equal(ph?.doors, 3);
  // EVシャフトは連続するが通れない
  assert.equal(doorsBetween(m, "/L5/corridor", "/L4/ev"), undefined);
});

test("tower: 例外階L3 — バルコニーは無く、低層部屋根のテラスに開く", () => {
  const m = parseFile(mainPath);
  assert.equal(m.spaces.has("/L3/bA"), false);
  assert.equal(m.spaces.has("/L4/bA"), true);
  assert.equal(m.spaces.get("/L3/tA")!.file?.endsWith("L3.muro"), true);
});
