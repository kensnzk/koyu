import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { doorsBetween } from "../src/core/graph.js";
import { areaM2 } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/office.muro", import.meta.url)),
  "utf8",
);

test("a two-storey office parses", () => {
  const m = parse(src);
  assert.equal(m.spaces.size, 17);
  assert.equal(m.boundaries.length, 43);
  assert.equal(Object.keys(m.levels).length, 3);
});

test("offsets from a grid line are resolved", () => {
  const m = parse(src);
  // X1+3200 / X2+3000 のオフセット壁
  assert.deepEqual(m.spaces.get("/L1/stair")!.rects, [
    { x1: 0, y1: 8000, x2: 3200, y2: 12000 },
  ]);
  assert.deepEqual(m.spaces.get("/L1/wc-w")!.rects, [
    { x1: 9400, y1: 8000, x2: 12800, y2: 12000 },
  ]);
});

test("the consistency check passes with zero warnings (the height invariants included)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("asking about escape: four doors from the second-floor office room to the outside, by way of the stair", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L2/office", "/out")!;
  assert.equal(route.doors, 4);
  assert.ok(route.path.includes("/L2/stair"));
  assert.ok(route.path.includes("/L1/stair"));
  // 1階の事務室からは2枚 (廊下→ホールはopenで0)
  assert.equal(doorsBetween(m, "/L1/office", "/out")!.doors, 2);
});

test("a lift shaft is continuous but not passable — the route detours through the stair", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L1/ev", "/L2/ev")!;
  assert.equal(route.doors, 4);
  assert.ok(route.path.includes("/L1/stair")); // shaft直行 (扉0) ではなく階段経由
});

test("area: 230.4 m2 per floor, twice", () => {
  const m = parse(src);
  const total = [...m.spaces.values()]
    .map((s) => areaM2(s) ?? 0)
    .reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total * 100) / 100, 460.8);
});

test("a plan comes out per level", () => {
  const m = parse(src);
  const l2 = svgPlan(m, { level: "L2" });
  assert.ok(l2.includes("執務室"));
  assert.ok(!l2.includes("エントランスホール")); // L1の室はL2平面に出ない
});
