import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseSpatial, parseSpatialFiles, spatialBody } from "../experiments/spatial-model/model.js";
import { spatialPlan } from "../experiments/spatial-model/plan.js";
import { parse } from "../src/core/parse.js";
import { checkDiagnostics } from "../src/core/diagnose.js";

const source = `mode spatial
muro 1.5
grid X 0 4000 8000
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:space-a
space /L1/b room X2..X3 Y1..Y2 uid:space-b`;

test("spatial: spaces without boundaries, ceiling heights or slabs are measurable and unresolved", () => {
  const report = parseSpatial(source);
  assert.equal(report.state, "consistent");
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(report.spaces.map(s => s.areaM2), [16, 16]);
  assert.deepEqual(report.levels, [{ name: "L1", z: 0, areaM2: 32 }]);
  assert.equal(report.relations.length, 7);
  assert.equal(report.relations.filter(r => r.b !== "outside").length, 1);
  assert.ok(report.relations.every(r => r.resolution === "unresolved" && r.passage === "unknown" && r.type === undefined));
  assert.equal(report.relations.find(r => r.b !== "outside")!.lengthMm, 4000);
  assert.ok(report.spaces.every(s => s.height === undefined));
  assert.deepEqual(Object.values(report.assessment), ["not-evaluated", "not-evaluated", "not-evaluated"]);
});

test("spatial: the marker prevents normal Muro reading, while ordinary Muro retains its wall defaults", () => {
  assert.throws(() => parse(source), /mode/);
  assert.throws(() => parseSpatial(spatialBody(source)), /mode spatial/);
  const ordinary = parse(spatialBody(source));
  assert.equal(ordinary.boundaries.length, 3);
  assert.ok(ordinary.boundaries.every(b => b.kind === "wall" && b.derived));
  assert.ok(checkDiagnostics(ordinary).some(d => d.code === "SUF01"));
});

test("spatial: declaring an open boundary or a door keeps space identities and resolves only that relation", () => {
  for (const declaration of ["boundary /L1/a /L1/b type:open", "boundary /L1/a /L1/b\n  door w:900"]) {
    const before = parseSpatial(source), after = parseSpatial(`${source}\n${declaration}`);
    assert.equal(after.state, "consistent");
    assert.deepEqual(after.spaces, before.spaces);
    const interior = after.relations.find(r => r.b !== "outside")!;
    assert.equal(interior.resolution, "declared");
    assert.equal(interior.passage, "passable");
    assert.ok(after.relations.filter(r => r.b === "outside").every(r => r.passage === "unknown"));
  }
  assert.equal(parseSpatial(`${source}\nboundary /L1/a /L1/b`).relations.find(r => r.b !== "outside")!.passage, "blocked");
});

test("spatial: one declared face does not resolve the other face of an L-shaped adjacency", () => {
  const report = parseSpatial(`mode spatial
muro 1.5
grid X 0 4000 8000
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y3 + X2..X3 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b edge:N`);
  assert.equal(report.state, "consistent");
  const interior = report.relations.filter(r => r.b !== "outside");
  assert.equal(interior.length, 2);
  assert.equal(interior.filter(r => r.resolution === "declared").length, 1);
  assert.equal(interior.filter(r => r.passage === "unknown").length, 1);
});

test("spatial: declaring an exterior face leaves the other perimeter segments unresolved", () => {
  const report = parseSpatial(`${source}\nspace /road outside:1\nboundary /L1/a /road type:open edge:W`);
  assert.equal(report.state, "consistent");
  const declared = report.relations.filter(r => r.resolution === "declared");
  assert.equal(declared.length, 1);
  assert.equal(declared[0]!.b, "/road");
  assert.equal(declared[0]!.passage, "passable");
  assert.equal(report.relations.filter(r => r.a === "/L1/a" && r.b === "outside").length, 2);
});

test("spatial: missing levels, overlaps, invalid attributes and references remain errors", () => {
  const variants = [
    source.replaceAll("/L1/", "/unknown/"),
    source.replace("X2..X3 Y1..Y2", "X1..X2 Y1..Y2"),
    `${source}\nboundary /L1/a /missing`,
  ];
  for (const value of variants) {
    const report = parseSpatial(value);
    assert.equal(report.state, "invalid");
    assert.ok(report.diagnostics.some(d => d.severity === "error"));
    assert.ok(report.relations.every(r => r.passage === "unknown"));
    assert.throws(() => spatialPlan(report, "L1"), /Correct spatial diagnostics/);
  }
  assert.throws(() => parseSpatial(source.replace("level L1 0", "level L1 0 h:-1")), /positive number/);
});

test("spatial: vertical overlap is geometric evidence and never asserts a connection", () => {
  const report = parseSpatial(`${source}\nlevel L2 3000\nspace /L2/c room X1..X2 Y1..Y2`);
  assert.equal(report.state, "consistent");
  assert.deepEqual(report.verticalOverlaps, [{ lower: "/L1/a", upper: "/L2/c", separationMm: 3000 }]);
  assert.equal(report.assessment.circulation, "not-evaluated");
});

test("spatial: imports preserve source bytes and marker placement preserves diagnostic lines", () => {
  const files = { "main.spatial": "mode spatial\nmuro 1.5\nimport rooms.muro", "rooms.muro": source.split("\n").slice(2).join("\n") };
  const saved = JSON.stringify(files);
  assert.deepEqual(parseSpatialFiles(files, "main.spatial").spaces, parseSpatial(source).spaces);
  assert.equal(JSON.stringify(files), saved);
  const bad = parseSpatial(`${source}\nboundary /L1/a /missing`);
  assert.equal(bad.diagnostics.find(d => d.code === "REF01")!.line, 8);
});

test("spatial: diagrams show unresolved lines and escape source labels", () => {
  const svg = spatialPlan(parseSpatial(source.replace("uid:space-a", 'uid:space-a name:"<script>"')), "L1");
  assert.equal((svg.match(/data-space=/g) ?? []).length, 2);
  assert.match(svg, /data-resolution="unresolved"/);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.throws(() => spatialPlan(parseSpatial(source), "L9"), /Undeclared level/);
});

test("spatial: repository CLI opens both saved study stages through normal file composition", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const run = (stage: string, command = "json", ...options: string[]) => spawnSync(process.execPath,
    ["--import", "tsx", "experiments/spatial-model/cli.ts", command, `experiments/spatial-model/examples/${stage}.spatial`, ...options],
    { cwd: root, encoding: "utf8" });
  const before = run("layout"), after = run("partial");
  assert.equal(before.status, 0, before.stderr);
  assert.equal(after.status, 0, after.stderr);
  const a = JSON.parse(before.stdout), b = JSON.parse(after.stdout);
  assert.deepEqual(a.spaces, b.spaces);
  assert.equal(a.relations.filter((r: { resolution: string }) => r.resolution === "declared").length, 0);
  assert.equal(b.relations.filter((r: { resolution: string }) => r.resolution === "declared").length, 2);
  assert.equal(run("layout", "plan").status, 2);
  assert.equal(run("layout", "plan", "-l", "L1").status, 0);
  assert.match(readFileSync(`${root}/experiments/spatial-model/examples/layout.spatial`, "utf8"), /^mode spatial/);
});
