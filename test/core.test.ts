import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween, neighbors, placeOpening } from "../src/graph.js";
import { areaM2, SourceError, toCanonical } from "../src/model.js";
import { parse, tokenize } from "../src/parse.js";
import { svgPlan } from "../src/plan.js";

const examplePath = fileURLToPath(new URL("../examples/two-rooms.ifcxs", import.meta.url));
const exampleSrc = readFileSync(examplePath, "utf8");

test("二室一扉が読める", () => {
  const m = parse(exampleSrc);
  assert.equal(m.name, "二室一扉");
  assert.equal(m.spaces.size, 3);
  assert.equal(m.boundaries.length, 3);
  const a = m.spaces.get("/L1/a")!;
  assert.deepEqual(a.rects, [{ x1: 0, y1: 0, x2: 3600, y2: 4500 }]);
  assert.equal(a.level, "L1");
  assert.equal(areaM2(a), 16.2);
  assert.equal(m.spaces.get("/out")!.rects.length, 0);
});

test("グラフへの問い: 扉をいくつ通るか", () => {
  const m = parse(exampleSrc);
  assert.equal(doorsBetween(m, "/L1/a", "/L1/b")!.doors, 1);
  assert.equal(doorsBetween(m, "/L1/b", "/out")!.doors, 1);
  const aOut = doorsBetween(m, "/L1/a", "/out")!;
  assert.equal(aOut.doors, 2); // a→b→out。a|outの境界に扉は無い
  assert.deepEqual(aOut.path, ["/L1/a", "/L1/b", "/out"]);
  assert.equal(neighbors(m, "/L1/a").length, 2);
});

test("開口は境界線分の上に配置される", () => {
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

test("整合チェックが通る", () => {
  const m = parse(exampleSrc);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("外部境界の扉は辺の指定がなければ曖昧としてエラー", () => {
  const m = parse(exampleSrc.replace("edge:S ", ""));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("複数")));
});

test("領域の重なりはエラー", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("重なって")));
});

test("接していない空間の境界はエラー", () => {
  const m = parse(`
grid X 0 3600 7200 10800 14400
grid Y 0 4500
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/c room X3..X4 Y1..Y2
boundary /L1/a /L1/c t:120
`);
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("接していない")));
});

test("接しているのに境界が無ければ警告", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
`);
  const r = check(m);
  assert.ok(r.warnings.some((w) => w.includes("宣言されていません")));
});

test("開口が線分より広ければエラー", () => {
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
  assert.ok(r.errors.some((e) => e.includes("超えて")));
});

test("open境界は扉なしで通れる", () => {
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

test("記法のエラーは行番号つきで言葉になる", () => {
  assert.throws(() => parse("space /L1/a"), SourceError);
  assert.throws(
    () =>
      parse(`
grid X 0 3600
grid Y 0 4500
level L1 0
space /L1/a room X1..X9 Y1..Y2
`),
    /未定義の通り名/,
  );
  assert.throws(() => parse("nonsense 1 2 3"), /未知のキーワード/);
});

test("引用符で空白を含む値が書ける", () => {
  assert.deepEqual(tokenize('space /L1/a room name:"居室 A"', 1), [
    "space",
    "/L1/a",
    "room",
    "name:居室 A",
  ]);
});

test("正準JSONは安定している", () => {
  const m = parse(exampleSrc);
  const j1 = toCanonical(m);
  const j2 = toCanonical(parse(exampleSrc));
  assert.equal(j1, j2);
  assert.ok(j1.includes('"between"'));
  assert.ok(j1.includes('"ifcxs": "0.1"'));
});

test("平面図SVGが生成される", () => {
  const m = parse(exampleSrc);
  const svg = svgPlan(m);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("居室A"));
  assert.ok(svg.includes("㎡"));
  assert.ok(svg.includes(" A ")); // 扉の軌跡の円弧
  assert.ok(svg.trimEnd().endsWith("</svg>"));
});
