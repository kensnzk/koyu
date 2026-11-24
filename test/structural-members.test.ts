import assert from "node:assert/strict";
import { test } from "node:test";
import { columnsFor, SourceError, toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { derive } from "../src/core/derive.js";
import { sceneOf } from "../src/draw/scene.js";
import { areaSchedule } from "../src/core/area-schedule.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { renderDiff, semanticDiff } from "../src/core/diff.js";

const grid = `muro 1.7
grid X 0 3000 6000
grid Y 0 4000
level L1 0 h:2750
level L2 3000 h:2750
level L3 6000 h:2750
space /L1..L3/hall X1..X3 Y1..Y2
`;

const column = `column 800 L1..L3 at:X2+150,Y1-75 d:900
  section L2..L3 w:600 d:700
`;

test("one rotated centre controls column sections, the footing, and the count at a shared intersection", () => {
  const model = parse(`muro 1.8
grid X 0 8000
grid Y 0 4000
frame AB at:X1,Y1 angle:30 A:0,8000 B:0,6000
level L1 0 h:2700 slab:200
level L2 2900 h:2700 slab:200
column 600 L1..L2 at:B1,A2 d:900
  section L2 w:400 d:700
column 600 L1 at:A2,Y2 d:900
column 400 L1 at:A2+1,B1 d:700
foundation /pad level:L1 type:pad at:A2,B1 w:1800 d:2400 t:600`);
  const form = derive(model);
  const quantities = areaSchedule(form);
  assert.equal(form.columns.length, 3);
  assert.equal(quantities.columns.filter(c => c.level === "L1").length, 2);
  assert.equal(checkDiagnostics(model).filter(d => d.code === "COL02").length, 1);
  const scene = sceneOf(form);
  for (const [level, ref, width, depth] of [
    ["L1", "L1/A2/B1", 600, 900], ["L2", "L2/A2/B1", 400, 700], ["L1", "/pad", 1800, 2400],
  ] as const) {
    const ring = scene.nodes.find(n => n.ref === ref && n.solid)!.solid!.ring;
    const plan = form.plans.find(p => p.level === level)!.entities.find(e => e.ref === ref)!.polygon;
    assert.deepEqual(plan, ring);
    const angle = Math.PI / 6, [p, q, r] = ring;
    assert.ok(Math.abs(q!.x - p!.x - width * Math.cos(angle)) < 1e-7);
    assert.ok(Math.abs(q!.y - p!.y - width * Math.sin(angle)) < 1e-7);
    assert.ok(Math.abs(r!.x - q!.x + depth * Math.sin(angle)) < 1e-7);
    assert.ok(Math.abs(r!.y - q!.y - depth * Math.cos(angle)) < 1e-7);
  }
});

test("an unrelated frame preserves distinct primary column stations", () => {
  const model = parse(`muro 1.8
grid X 0 0.25 6000
grid Y 0 4000
frame AB at:X3,Y2 angle:30 A:0,3000 B:0,3000
level L1 0 h:2700
column 400 L1 at:X1,Y1
column 400 L1 at:X2,Y1`);
  assert.deepEqual(columnsFor(model, "L1").map(c => c.x), [0, 0.25]);
});
const structure = `beam /frame/b1 level:L2 from:X1,Y1 to:X2,Y2 w:400 d:700
foundation /frame/p level:L1 type:pad at:X2+150,Y1-75 w:1800 d:2000 t:700 top:-600
foundation /frame/s level:L1 type:strip from:X1,Y1 to:X2,Y2 w:1200 t:600 top:-500
foundation /frame/m level:L1 type:mat t:500 top:-1100
  outline X1,Y1 X1,Y2 X2,Y2 X2,Y1
`;

test("a column run follows one grid offset while its upper section changes", () => {
  const read = (input: string) => derive(parse(input)).columns.map(c => [c.ref, c.x, c.y, c.w, c.d, c.z0, c.z1]);
  assert.deepEqual(read(grid + column), [
    ["L1/X2+150/Y1-75",3150,-75,800,900,0,3000],["L2/X2+150/Y1-75",3150,-75,600,700,3000,6000],
    ["L3/X2+150/Y1-75",3150,-75,600,700,6000,8950],
  ]);
  assert.deepEqual(read(grid.replace("3000 6000","3200 6000") + column).map(c => c[1]), [3350,3350,3350]);
  assert.deepEqual(read(grid + column.replace("X2+150", "X2+200")).map(c => c[1]), [3200,3200,3200]);
  const canonical = JSON.parse(toCanonical(parse(grid + column))).columns[0];
  assert.equal(canonical.at, "X2+150,Y1-75");
  assert.deepEqual(canonical.sections, [{ levels:["L2","L3"], w:600, d:700 }]);
});

test("a mixed-grid column and pad can change their section frame without moving their centre", () => {
  const mixed = `muro 1.8
grid X 0 8000
grid Y 0 4000
frame AB at:X1,Y1 angle:30 A:0,8000 B:0,6000
frame CD at:X1,Y1 angle:-45 C:0,4000 D:0,4000
level L1 0 h:2700 slab:200
column 600 L1 at:A2,Y2 d:900
foundation /pad level:L1 type:pad at:A2,Y2 w:1800 d:2400 t:600`;
  const select = (name: string) => mixed.replaceAll("at:A2,Y2", `at:A2,Y2 frame:${name}`);
  for (const [name, degrees] of [["", 0], ["XY", 0], ["AB", 30], ["CD", -45]] as const) {
    const model = parse(name ? select(name) : mixed);
    const form = derive(model);
    const shapes = sceneOf(form).nodes.filter(n => (n.of === "column" || n.of === "foundation") && n.solid);
    assert.equal(shapes.length, 2);
    for (const shape of shapes) {
      const ring = shape.solid!.ring;
      const edge = { x: ring[1]!.x - ring[0]!.x, y: ring[1]!.y - ring[0]!.y };
      assert.ok(Math.abs(Math.atan2(edge.y, edge.x) * 180 / Math.PI - degrees) < 1e-8);
      assert.ok(Math.abs((ring[0]!.x + ring[2]!.x) / 2 - Math.sqrt(3) * 4000) < 1e-8);
      assert.ok(Math.abs((ring[0]!.y + ring[2]!.y) / 2 - 4000) < 1e-8);
    }
    const canonical = JSON.parse(toCanonical(model));
    assert.equal(canonical.columns[0].frame, name || undefined);
    assert.equal(canonical.foundations["/pad"].frame, name || undefined);
  }
  const diff = semanticDiff(parse(select("AB")), parse(select("CD")));
  assert.equal(diff.columns.added.length, 1);
  assert.equal(diff.members?.foundations?.changed[0]!.fields[0]!.field, "frame");
  assert.throws(() => parse(select("AC")), /Unknown section frame/);
  for (const line of ["column 600 L1 frame:XY", "foundation /pad level:L1 type:pad at:X1,Y1 frame:XY w:1800 d:2400 t:600"]) {
    assert.throws(() => parse(grid + line), e => e instanceof SourceError && e.code === "VER12");
  }
});

test("explicit placements supersede grid candidates by base or by coincident coordinates", () => {
  const model = parse(grid + `column 300 L1 x:X2 y:Y1
column 500 L1 at:X2+150,Y1-75
column 550 L1 at:X2-250,Y1
column 650 L1 at:X2+000,Y1-0
column 650 L1 at:X1+3000,Y1
`);
  assert.deepEqual(columnsFor(model,"L1").map(c => c.grid), ["X2+150/Y1-75","X2-250/Y1","X2/Y1"]);
  assert.equal(checkDiagnostics(model).filter(d => d.code === "COL02").length, 2);
  assert.deepEqual(checkDiagnostics(model).filter(d => d.code === "COL02").map(d => Boolean(d.related?.length)), [true,true]);
  const reversed = parse(grid + "column 500 L1 at:X2+150,Y1-75\ncolumn 300 L1 x:X2 y:Y1");
  assert.deepEqual(columnsFor(reversed, "L1").map(c => [c.grid,c.w]), [["X2+150/Y1-75",500]]);
});

test("beam, pad, strip and mat use common level datums and unambiguous physical quantities", () => {
  const f = derive(parse(grid + structure));
  const beam = f.beams![0]!;
  assert.deepEqual([beam.ref,beam.z0,beam.z1,beam.areaM2,beam.volumeM3], ["/frame/b1",2300,3000,2,1.4]);
  assert.deepEqual(beam.outline, [{x:160,y:-120},{x:3160,y:3880},{x:2840,y:4120},{x:-160,y:120}]);
  assert.deepEqual(f.foundations!.map(p => [p.type,p.z0,p.z1,p.areaM2]), [
    ["mat",-1600,-1100,12], ["pad",-1300,-600,3.6], ["strip",-1100,-500,6],
  ]);
  assert.deepEqual(f.foundations!.map(p => p.volumeM3), [6,2.52,3.6]);
  assert.deepEqual(f.spaces, derive(parse(grid)).spaces);
  const edited = derive(parse(grid.replace("3000 6000","3500 6000") + structure));
  assert.equal(edited.foundations![1]!.outline[0]!.x, 2750);
});

test("member declarations reject ambiguous or degenerate geometry and keep source provenance", () => {
  for (const src of [
    "column 500 L1 at:X1,Y1 x:X1",
    "column 500 L1 at:X1,Y1\n  section L2 w:400 d:500",
    "column 500 L1 at:X1,Y1\n  section L1 w:400 d:500\n  section L1 w:450 d:550",
    "beam /b level:L1 from:X1,Y1 to:X2-3000,Y1 w:400 d:500",
    "foundation /f type:mat level:L1 t:500",
    "foundation /f type:pad level:L1 at:X1,Y1 w:1000 d:1500 t:-10",
    "foundation /f type:mat level:L1 t:500\n  outline X1,Y1 X2,Y2 X1,Y2 X2,Y1",
    "foundation /f type:mat level:L1 t:500\n  outline X1,Y1 X2,Y1 X2,Y2 X1,Y2 X1,Y1",
  ]) assert.throws(() => parse(grid + src), SourceError, src);
  assert.throws(() => parseFiles({"main.muro": grid.replace("1.7", "1.6") + "import frame.muro", "frame.muro": column}, "main.muro"),
    e => e instanceof SourceError && e.code === "VER11" && e.file === "frame.muro" && e.line === 1);
  assert.ok(parse(grid.replace("muro 1.7\n","") + column + "muro 1.7"));
});

test("the diff reports member changes and ignores source locations", () => {
  const a = parse(grid + structure + column);
  const b = parse(grid + "\n" + structure + column);
  assert.deepEqual(renderDiff(semanticDiff(a,b)), []);
  const c = parse(grid + structure.replace("d:700","d:650").replace("top:-1100","top:-1000") + column.replace("X2+150","X2+250"));
  assert.deepEqual(semanticDiff(a,c).members?.beams?.changed, [{path:"/frame/b1", fields:[{field:"d",from:"700",to:"650"}]}]);
  assert.equal(semanticDiff(a,c).members?.foundations?.changed[0]?.path, "/frame/m");
  assert.equal(semanticDiff(a,c).columns.added.length, 1);
  const layer = parse(grid + structure + "drop beam /frame/b1\ndrop foundation /frame/m");
  assert.equal(derive(layer).beams, undefined);
  assert.equal(derive(layer).foundations!.length,2);
});

test("a re-entrant mat cuts as separate intervals on either side of its recess", async () => {
  const { sectionForm } = await import("../src/core/section.js");
  const model = parse(grid + `foundation /u level:L1 type:mat t:500
  outline X1,Y1 X3,Y1 X3,Y2 X3-1000,Y2 X3-1000,Y1+1000 X1+1000,Y1+1000 X1+1000,Y2 X1,Y2`);
  const form = derive(model);
  assert.equal(form.foundations![0]!.areaM2, 12);
  const cuts = sectionForm(form, {axis:"Y", at:2000, look:"N"}).entities.filter(e => e.of === "foundation" && e.class === "cut");
  assert.ok(cuts.length >= 2);
  assert.ok(cuts.every(e => Math.max(...e.polygon.map(p => p.u)) <= 1000 || Math.min(...e.polygon.map(p => p.u)) >= 5000));
});

test("explicit runs and sections traverse named pit datums and storeys in elevation order", () => {
  const datums = `muro 1.7
grid X 0 3000
grid Y 0 4000
level L1..L5 0 pitch:3200 h:2700
level Pit -700
level PDeep -2300
level EVPit -1100
`;
  const explicit = `column 800 PDeep..L5 at:X1+150,Y1-75 d:900
  section PDeep..EVPit w:950 d:1000
  section Pit..L1 w:850 d:900
`;
  const form = derive(parse(datums + explicit));
  assert.deepEqual(form.columns.map(c => [c.level, c.z0, c.z1, c.w, c.d]), [
    ["PDeep",-2300,-1100,950,1000],["EVPit",-1100,-700,950,1000],["Pit",-700,0,850,900],["L1",0,3200,850,900],
    ["L2",3200,6400,800,900],["L3",6400,9600,800,900],["L4",9600,12800,800,900],["L5",12800,15700,800,900],
  ]);
  assert.ok(form.columns.every(c => c.x === 150 && c.y === -75));
  assert.throws(() => parse(datums + explicit.replace("PDeep..L5","L5..PDeep")), /backwards/);
  assert.throws(() => parse(datums + explicit.replace("PDeep..EVPit","PDeep..Missing")), /undeclared/);
  assert.throws(() => parse(datums + "column 800 PDeep..L5 x:X1 y:Y1"), /Cannot read the level range/);
});
