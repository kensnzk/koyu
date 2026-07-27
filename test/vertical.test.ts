import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { doorsBetween } from "../src/core/graph.js";
import { parse } from "../src/core/parse.js";

const BASE = `
grid X 0 3600 7200
grid Y 0 4500
`;

test("ceiling height + the slab above > storey height collides into the floor above", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 3000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("collides into the floor above")));
});

test("an undeclared slab on the level above warns that the height cannot be checked", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("slab")));
});

test("a wall boundary cannot be written between spaces on different levels", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
boundary /L1/a /L2/b t:120
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("different level")));
});

test("a stair boundary is an error unless the two spaces overlap in plan", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("do not overlap in plan")));
});

test("a stair crosses storeys with zero doors", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
level L2 4000 slab:1300
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X1..X2 Y1..Y2
boundary /L1/a /L2/b type:stair
`);
  assert.equal(doorsBetween(m, "/L1/a", "/L2/b")!.doors, 0);
});

test("a negative offset can be written", () => {
  const m = parse(`${BASE}
level L1 0 h:2700
space /L1/a room X1..X2-600 Y1..Y2
`);
  assert.equal(m.spaces.get("/L1/a")!.rects[0]!.x2, 3000);
});
