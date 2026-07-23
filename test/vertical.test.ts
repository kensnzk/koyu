import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { parse } from "../src/parse.js";

const BASE = `
grid X 0 3600 7200
grid Y 0 4500
`;

test("天井高 + 上階slab > 階高 は食い込みエラー", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 3000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("食い込み")));
});

test("上階のslab未宣言は高さ検査不能の警告", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("slab")));
});

test("異なるレベル間に壁境界は書けない", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
boundary /L1/a /L2/b t:120
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("異なるレベル")));
});

test("stair境界は平面で重なっていなければエラー", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("重なって")));
});

test("stairは扉0枚で階をまたぐ", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
boundary /L1/a /L2/b type:stair
`);
  assert.equal(doorsBetween(m, "/L1/a", "/L2/b")!.doors, 0);
});

test("負のオフセットも書ける", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
space /L1/a room X1..X2-600 Y1..Y2
`);
  assert.equal(m.spaces.get("/L1/a")!.rect!.x2, 3000);
});
