import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { areaM2 } from "../src/model.js";
import { parse } from "../src/parse.js";
import { svgPlan } from "../src/plan.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/office.ifcxs", import.meta.url)),
  "utf8",
);

test("オフィス2フロアが読める", () => {
  const m = parse(src);
  assert.equal(m.spaces.size, 17);
  assert.equal(m.boundaries.length, 42);
  assert.equal(Object.keys(m.levels).length, 3);
});

test("通り芯からのオフセットが解決される", () => {
  const m = parse(src);
  // X1+3200 / X2+3000 のオフセット壁
  assert.deepEqual(m.spaces.get("/L1/stair")!.rect, { x1: 0, y1: 8000, x2: 3200, y2: 12000 });
  assert.deepEqual(m.spaces.get("/L1/wc-w")!.rect, { x1: 9400, y1: 8000, x2: 12800, y2: 12000 });
});

test("整合チェックが警告ゼロで通る (高さの不変量含む)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("避難の問い: 2階の執務室から外へ扉4枚、階段経由", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L2/office", "/out")!;
  assert.equal(route.doors, 4);
  assert.ok(route.path.includes("/L2/stair"));
  assert.ok(route.path.includes("/L1/stair"));
  // 1階の事務室からは2枚 (廊下→ホールはopenで0)
  assert.equal(doorsBetween(m, "/L1/office", "/out")!.doors, 2);
});

test("EVシャフトは繋がるが通れない — 経路は階段に迂回する", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L1/ev", "/L2/ev")!;
  assert.equal(route.doors, 4);
  assert.ok(route.path.includes("/L1/stair")); // shaft直行 (扉0) ではなく階段経由
});

test("面積: フロア230.4㎡×2", () => {
  const m = parse(src);
  const total = [...m.spaces.values()]
    .map((s) => areaM2(s) ?? 0)
    .reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total * 100) / 100, 460.8);
});

test("レベル別の平面図が出る", () => {
  const m = parse(src);
  const l2 = svgPlan(m, { level: "L2" });
  assert.ok(l2.includes("執務室"));
  assert.ok(!l2.includes("エントランスホール")); // L1の室はL2平面に出ない
});
