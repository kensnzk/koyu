// 数えない分節 (area / seg) — ADR-0003
// 隔離則: 面積・室数・グラフに一切影響しないことをここで保証する

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { doorsBetween } from "../src/core/graph.js";
import { areaM2, toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/office.muro", import.meta.url)),
  "utf8",
);

const BASE = `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700
`;

test("area and seg parse", () => {
  const m = parse(src);
  const hall = m.spaces.get("/L1/hall")!;
  assert.equal(hall.areas.length, 1);
  assert.deepEqual(hall.areas[0]!.rect, { x1: 0, y1: 0, x2: 1800, y2: 6400 });
  assert.equal(hall.areas[0]!.attrs["floor"], "モルタル");
  const oc = m.boundaries.find((b) => b.a === "/L1/office" && b.b === "/L1/corridor")!;
  assert.equal(oc.segs.length, 1);
  assert.equal(oc.segs[0]!.attrs["spec"], "ガラスパーティション");
});

test("isolation rule: the area does not change — the room is not split", () => {
  const m = parse(src);
  assert.equal(areaM2(m.spaces.get("/L1/hall")!), 40.96); // 土間があってもホールは40.96のまま
  assert.equal(areaM2(m.spaces.get("/L2/office")!), 102.4);
  assert.equal(m.spaces.size, 17); // 室数も変わらない
});

test("isolation rule: the graph does not change either", () => {
  const m = parse(src);
  assert.equal(doorsBetween(m, "/L2/office", "/out")!.doors, 4);
  assert.equal(doorsBetween(m, "/L1/office", "/out")!.doors, 2);
});

test("check stays at zero warnings", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("the earthen floor and the glass run appear in the plan", () => {
  const m = parse(src);
  const l1 = svgPlan(m, { level: "L1" });
  assert.ok(l1.includes("土間"));
  assert.ok(l1.includes("ガラスパーティション"));
});

test("areas and segs ride on the canonical JSON", () => {
  const j = toCanonical(parse(src));
  assert.ok(j.includes('"areas"'));
  assert.ok(j.includes('"segs"'));
});

test("an area spilling outside its parent is a warning", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:畳
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("spills outside")));
});

test("an area on a space with no region is an error", () => {
  const m = parse(`${BASE}
space /out exterior
  area X1..X2 Y1..Y2 floor:砂利
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("An area cannot be written")));
});

test("a seg wider than the segment is an error", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:99999 spec:RC
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("exceeds the boundary segment length")));
});

test("a seg on an open boundary is a warning", () => {
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:1000 spec:RC
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("on an open boundary")));
});

test("an area not directly under a space is an error", () => {
  assert.throws(
    () =>
      parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  area X1..X2 Y1..Y2 floor:畳
`),
    /indented directly under space/,
  );
});
