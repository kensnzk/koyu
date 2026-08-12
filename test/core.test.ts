import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { doorsBetween, neighbors, placeOpening } from "../src/core/graph.js";
import { areaM2, SourceError, toCanonical } from "../src/core/model.js";
import { parse, tokenize } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";

const examplePath = fileURLToPath(new URL("../examples/two-rooms.muro", import.meta.url));
const exampleSrc = readFileSync(examplePath, "utf8");

test("the two-room example parses", () => {
  const m = parse(exampleSrc);
  assert.equal(m.name, "二室");
  assert.equal(m.spaces.size, 3);
  assert.equal(m.boundaries.length, 3);
  const a = m.spaces.get("/L1/a")!;
  assert.deepEqual(a.rects, [{ x1: 0, y1: 0, x2: 3600, y2: 4500 }]);
  assert.equal(a.level, "L1");
  assert.equal(areaM2(a), 16.2);
  assert.equal(m.spaces.get("/out")!.rects.length, 0);
});

test("asking the graph: how many doors does the route pass through", () => {
  const m = parse(exampleSrc);
  assert.equal(doorsBetween(m, "/L1/a", "/L1/b")!.doors, 1);
  assert.equal(doorsBetween(m, "/L1/b", "/out")!.doors, 1);
  const aOut = doorsBetween(m, "/L1/a", "/out")!;
  assert.equal(aOut.doors, 2); // a→b→out。a|outの境界に扉は無い
  assert.deepEqual(aOut.path, ["/L1/a", "/L1/b", "/out"]);
  assert.equal(neighbors(m, "/L1/a").length, 2);
});

test("an opening is placed on the boundary segment", () => {
  const m = parse(exampleSrc);
  const ab = m.boundaries.find((b) => b.b === "/L1/b")!;
  const placed = placeOpening(m, ab, ab.openings[0]!);
  assert.ok("segment" in placed);
  if ("segment" in placed) {
    assert.equal(placed.cx, 3600);
    assert.equal(placed.cy, 2250);
  }
  const bOut = m.boundaries.find((b) => b.a === "/L1/b" && b.b === "/out")!;
  const genkan = placeOpening(m, bOut, bOut.openings[0]!);
  assert.ok("segment" in genkan);
  if ("segment" in genkan) {
    assert.equal(genkan.cy, 0); // S辺
    assert.equal(genkan.cx, 5400);
  }
});

test("the consistency check passes", () => {
  const m = parse(exampleSrc);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("a door on an exterior boundary is ambiguous without an edge, so it is an error", () => {
  const m = parse(exampleSrc.replace("edge:S ", ""));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("more than one boundary segment")));
});

test("overlapping regions are an error", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("Space regions overlap")));
});

test("a boundary between spaces that do not touch is an error", () => {
  const m = parse(`
grid X 0 3600 7200 10800 14400
grid Y 0 4500
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/c room X3..X4 Y1..Y2
boundary /L1/a /L1/c t:120
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("do not touch")));
});

test("touching spaces with no boundary written derive a default wall (ADR-0014)", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
`);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  const derived = m.boundaries.filter((b) => b.derived);
  assert.equal(derived.length, 1);
  assert.equal(derived[0]!.kind, "wall");
  // 既定の壁は扉が無いので通れない — 既定は「繋がっていない」ではなく「壁がある」
  assert.equal(doorsBetween(m, "/L1/a", "/L1/b"), undefined);
});

test("an opening wider than the segment is an error", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:99999
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("exceeds the boundary segment length")));
});

test("an open boundary is passable without a door", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
`);
  assert.equal(doorsBetween(m, "/L1/a", "/L1/b")!.doors, 0);
});

test("notation errors come back in words with a line number", () => {
  assert.throws(() => parse("space"), SourceError);
  assert.throws(() => parse("space L1/a"), /space takes the form/);
  assert.throws(
    () =>
      parse(`
grid X 0 3600
grid Y 0 4500
level L1 0
space /L1/a room X1..X9 Y1..Y2
`),
    /Undefined grid line name/,
  );
  assert.throws(() => parse("nonsense 1 2 3"), /Unknown keyword/);
});

test("quotes let a value carry whitespace", () => {
  assert.deepEqual(tokenize('space /L1/a room name:"居室 A"', 1), [
    "space",
    "/L1/a",
    "room",
    "name:居室 A",
  ]);
});

test("canonical JSON is stable", () => {
  const m = parse(exampleSrc);
  const j1 = toCanonical(m);
  const j2 = toCanonical(parse(exampleSrc));
  assert.equal(j1, j2);
  assert.ok(j1.includes('"between"'));
  assert.ok(j1.includes('"muro": "1.3"'), "the version key names the language, whatever word the source used");
});

test("a plan SVG is generated", () => {
  const m = parse(exampleSrc);
  const svg = svgPlan(m);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("居室A"));
  assert.ok(svg.includes("m2"));
  assert.ok(svg.includes(" A ")); // 扉の軌跡の円弧
  assert.ok(svg.trimEnd().endsWith("</svg>"));
});
