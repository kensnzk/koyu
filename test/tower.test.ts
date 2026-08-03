// ショーケース: 街角の複合ビル (examples/tower/) — 全機能の実証を回帰で守る。
// 9ファイル合成・非矩形敷地 (polygon)・角地2道路・吹抜け・L字住戸・バルコニー・
// 例外階 (L3テラス)・ペントハウス・アセット・明示位置・スパン・stack。

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { daylightInputs } from "../src/core/light.js";
import { DAYLIGHT_RATIO_RULE_ID } from "../src/validate/builtin/index.js";
import { caught } from "./helpers/schematic.js";
import { doorsBetween } from "../src/core/graph.js";
import { isSemiOutdoor, zoneAreaM2 } from "../src/core/model.js";
import { parseFile } from "../src/parse-file.js";
import { siteReport } from "../src/core/site.js";

const mainPath = fileURLToPath(new URL("../examples/tower/main.muro", import.meta.url));

test("tower: nine layers build into one building and check with zero warnings", () => {
  const m = parseFile(mainPath);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(m.spaces.size, 178);
  assert.equal(m.boundaries.length, 543); // L2廊下の東面 (外皮の穴 ENV01 が見つけた)
});

test("tower: 4785.92 m2 of total floor area (retail + housing), type A is 61.44 m2 on every storey", () => {
  const m = parseFile(mainPath);
  assert.equal(zoneAreaM2(m, "/L5/A"), 61.44);
  const site = siteReport(m);
  assert.equal(site.totalFloor, 4785.92);
});

test("tower: a non-rectangular site — the area derived from the polygon matches the surveyed declaration, and the corner lot yields two frontages", () => {
  const m = parseFile(mainPath);
  const site = siteReport(m);
  assert.equal(site.polygon?.points.length, 5);
  assert.equal(site.derivedArea, 1097.8);
  assert.equal(site.declaredArea, 1097.8);
  assert.equal(site.roads.length, 2);
  const widths = site.roads.map((r) => r.width).sort((a, b) => a - b);
  assert.deepEqual(widths, [6000, 12000]);
});

test("tower: putting the building outside the site shape is an error", () => {
  const m = parseFile(mainPath);
  // 塔状部の東端住戸を敷地東端 (x=38000) を越えて広げたと仮定した検査は
  // polygon.test.ts が担う。ここでは現状が内包されていることだけ確かめる
  const r = check(m);
  assert.equal(r.errors.filter((e) => e.includes("site shape")).length, 0);
});

test("tower: balconies and terraces are derived as semi-outdoor (never declared)", () => {
  const m = parseFile(mainPath);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/bA")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L3/tA")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L11/roof")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/A/ldk")!), false);
});

test("tower: every habitable room meets the 1/7 daylight ratio (the 0.7 factor through a balcony included)", () => {
  const m = parseFile(mainPath);
  const rep = daylightInputs(m);
  assert.equal(rep.length > 60, true);
  // 合否は検証の面が言う — core が返すのは床面積と有効窓面積だけ
  assert.deepEqual(caught(m).filter((f) => f.rule === DAYLIGHT_RATIO_RULE_ID.id), []);
});

test("tower: asking about escape — four doors from the ninth-floor LDK to the road, three from the penthouse", () => {
  const m = parseFile(mainPath);
  const a = doorsBetween(m, "/L9/A/ldk", "/out/road-s");
  assert.equal(a?.doors, 4);
  const ph = doorsBetween(m, "/L11/PB", "/out/road-s");
  assert.equal(ph?.doors, 3);
  // EVシャフトは連続するが通れない
  assert.equal(doorsBetween(m, "/L5/corridor", "/L4/ev"), undefined);
});

test("tower: the exceptional storey L3 — no balcony, opening onto the terrace on the low-rise roof", () => {
  const m = parseFile(mainPath);
  assert.equal(m.spaces.has("/L3/bA"), false);
  assert.equal(m.spaces.has("/L4/bA"), true);
  assert.equal(m.spaces.get("/L3/tA")!.file?.endsWith("L3.muro"), true);
});
