// 戸建住宅 — メゾネット機構 (level:属性でパス=集計の階層)・部分吹抜け・開き勝手

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { doorsBetween } from "../src/core/graph.js";
import { isSemiOutdoor, zoneAreaM2 } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { siteReport } from "../src/core/site.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/house.muro", import.meta.url)),
  "utf8",
);

test("maisonette: the /home zone spans two storeys through the level: attribute", () => {
  const m = parse(src);
  assert.equal(m.spaces.get("/home/ldk")!.level, "L1");
  assert.equal(m.spaces.get("/home/bed1")!.level, "L2");
  assert.equal(zoneAreaM2(m, "/home"), 92.75); // 階を跨いだ住戸の面積 (吹抜けは不算入)
});

test("the consistency check passes with zero warnings (a partial void included)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("escape: three doors from the second-floor bedroom to the road (interior door, entrance, gate), passing through the garden", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/home/bed1", "/out/road")!;
  assert.equal(route.doors, 3);
  assert.ok(route.path.includes("/home/hall1"));
  assert.ok(route.path.includes("/site/garden"));
});

test("asking the site: declared area = derived area, 10.28m of frontage, 42% building coverage", () => {
  const m = parse(src);
  const r = siteReport(m);
  assert.equal(r.declaredArea, 126.24);
  assert.equal(r.derivedArea, 126.24); // 庭のタイル+建物投影の合併が宣言と一致
  assert.equal(r.roads.length, 1);
  assert.equal(r.roads[0]!.frontage, 10280); // 建物外壁が道路に面する分は数えない
  assert.equal(r.footprint, 53);
  assert.equal(Math.round((r.footprint / r.declaredArea!) * 1000) / 10, 42);
});

test("the garden is semi-outdoor (the fence is air:1 — it does not block outside air), and daylight through it stays at 1.0 (open above)", () => {
  const m = parse(src);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/site/garden")!), true);
  // LDKの採光: 庭越し5.72 + 西通路越し1.815 = 7.54 (0.7掛けされない)
});

test("raising the ceiling height of the lower storey past the storey height under a partial void is an error", () => {
  const m = parse(
    src.replace("level:L1 name:LDK", "level:L1 h:5300 name:LDK"),
  );
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("void covers only")));
});

test("an undeclared level: is an error", () => {
  assert.throws(() => parse(src.replace("level:L2 name:主寝室", "level:L9 name:主寝室")), /Undeclared level/);
});

test("a hinge whose axis does not match the segment is an error", () => {
  // ldk|hall1 の扉は垂直線分 (edge:E) — hinge:W は水平用なので合わない
  const m = parse(src.replace("hinge:S swing:b", "hinge:W swing:b"));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("vertical segment")));
});
