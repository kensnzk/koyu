// 数えない分節 (area / seg) — ADR-0003
// 隔離則: 面積・室数・グラフに一切影響しないことをここで保証する

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { areaM2, toCanonical } from "../src/model.js";
import { parse } from "../src/parse.js";
import { svgPlan } from "../src/plan.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/office.ifcxs", import.meta.url)),
  "utf8",
);

const BASE = `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700
`;

test("area/segが読める", () => {
  const m = parse(src);
  const hall = m.spaces.get("/L1/hall")!;
  assert.equal(hall.areas.length, 1);
  assert.deepEqual(hall.areas[0]!.rect, { x1: 0, y1: 0, x2: 1800, y2: 6400 });
  assert.equal(hall.areas[0]!.attrs["floor"], "モルタル");
  const oc = m.boundaries.find((b) => b.a === "/L1/office" && b.b === "/L1/corridor")!;
  assert.equal(oc.segs.length, 1);
  assert.equal(oc.segs[0]!.attrs["spec"], "ガラスパーティション");
});

test("隔離則: 面積は変わらない — 室は割れていない", () => {
  const m = parse(src);
  assert.equal(areaM2(m.spaces.get("/L1/hall")!), 40.96); // 土間があってもホールは40.96のまま
  assert.equal(areaM2(m.spaces.get("/L2/office")!), 102.4);
  assert.equal(m.spaces.size, 17); // 室数も変わらない
});

test("隔離則: グラフも変わらない", () => {
  const m = parse(src);
  assert.equal(doorsBetween(m, "/L2/office", "/out")!.doors, 4);
  assert.equal(doorsBetween(m, "/L1/office", "/out")!.doors, 2);
});

test("checkは警告ゼロのまま", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("平面図に土間とガラス区間が現れる", () => {
  const m = parse(src);
  const l1 = svgPlan(m, { level: "L1" });
  assert.ok(l1.includes("土間"));
  assert.ok(l1.includes("ガラスパーティション"));
});

test("正準JSONにareasとsegsが乗る", () => {
  const j = toCanonical(parse(src));
  assert.ok(j.includes('"areas"'));
  assert.ok(j.includes('"segs"'));
});

test("親からはみ出したareaは警告", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:畳
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("はみ出し")));
});

test("領域を持たない空間のareaはエラー", () => {
  const m = parse(`${BASE}
space /out exterior
  area X1..X2 Y1..Y2 floor:砂利
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("area は書けません")));
});

test("線分より広いsegはエラー", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:99999 spec:RC
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("超えて")));
});

test("open境界のsegは警告", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:1000 spec:RC
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("open境界")));
});

test("spaceの直下でないareaはエラー", () => {
  assert.throws(
    () =>
      parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  area X1..X2 Y1..Y2 floor:畳
`),
    /space の直下/,
  );
});
