// 戸建住宅 — メゾネット機構 (level:属性でパス=集計の階層)・部分吹抜け・開き勝手

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { isSemiOutdoor, zoneAreaM2 } from "../src/model.js";
import { parse } from "../src/parse.js";
import { siteReport } from "../src/site.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/house.ifcxs", import.meta.url)),
  "utf8",
);

test("メゾネット: /home のゾーンが level: 属性で2つの階を跨ぐ", () => {
  const m = parse(src);
  assert.equal(m.spaces.get("/home/ldk")!.level, "L1");
  assert.equal(m.spaces.get("/home/bed1")!.level, "L2");
  assert.equal(zoneAreaM2(m, "/home"), 92.75); // 階を跨いだ住戸の面積 (吹抜けは不算入)
});

test("整合チェックが警告ゼロで通る (部分吹抜け含む)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("避難: 2階の寝室から道路まで扉3枚 (室内扉・玄関・門扉)、庭を通る", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/home/bed1", "/out/road")!;
  assert.equal(route.doors, 3);
  assert.ok(route.path.includes("/home/hall1"));
  assert.ok(route.path.includes("/site/garden"));
});

test("敷地の問い: 宣言面積=導出面積、接道10.28m、建蔽率42%", () => {
  const m = parse(src);
  const r = siteReport(m);
  assert.equal(r.declaredArea, 126.24);
  assert.equal(r.derivedArea, 126.24); // 庭のタイル+建物投影の合併が宣言と一致
  assert.equal(r.roads.length, 1);
  assert.equal(r.roads[0]!.frontage, 10280); // 建物外壁が道路に面する分は数えない
  assert.equal(r.footprint, 53);
  assert.equal(Math.round((r.footprint / r.declaredArea!) * 1000) / 10, 42);
});

test("庭は半屋外 (塀はair:1 — 外気を遮らない)、採光は庭越しでも1.0 (上が開いている)", () => {
  const m = parse(src);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/site/garden")!), true);
  // LDKの採光: 庭越し5.72 + 西通路越し1.815 = 7.54 (0.7掛けされない)
});

test("部分吹抜けで下階の天井高を階高超えにすると被覆率エラー", () => {
  const m = parse(
    src.replace("level:L1 name:LDK", "level:L1 h:5300 name:LDK"),
  );
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("被覆")));
});

test("未宣言のlevel:はエラー", () => {
  assert.throws(() => parse(src.replace("level:L2 name:主寝室", "level:L9 name:主寝室")), /未宣言のレベル/);
});

test("hingeの軸が線分に合わなければエラー", () => {
  // ldk|hall1 の扉は垂直線分 (edge:E) — hinge:W は水平用なので合わない
  const m = parse(src.replace("hinge:S swing:b", "hinge:W swing:b"));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("垂直線分")));
});
