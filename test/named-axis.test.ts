import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, parseFiles, toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { renderDiff, semanticDiff } from "../src/core/diff.js";
import { gridPoint } from "../src/model.js";
import { SourceError } from "../src/core/model.js";

const grid = `muro 1.8
grid X 0 6000 10000
grid Y 0 4000 8000
`;
const axes = `axis D1 X1,Y1 X2,Y2
axis E1 X1,Y2 X2,Y1
`;

test("an authored axis is infinite and intersects Cartesian offsets or another axis", () => {
  const model = parse(grid + axes);
  assert.deepEqual(gridPoint(model, "D1,Y3", 0), {x:12000,y:8000});
  assert.deepEqual(gridPoint(model, "X2-1500,D1", 0), {x:4500,y:3000});
  assert.deepEqual(gridPoint(model, "E1,D1", 0), {x:3000,y:2000});
  assert.deepEqual(gridPoint(model, "D1,E1", 0), gridPoint(model, "E1,D1", 0));
  assert.throws(() => gridPoint(model, "Y1,X1", 0), /X grid line first/);
});

test("intersections drive column placement and roof areas through imported sources", () => {
  const files = {
    "main.muro": grid + "import axes.muro\nimport structure.muro",
    "axes.muro": axes,
    "structure.muro": `level L1 0 h:2800 slab:180
level L2 3200
space /L1/r X1..X3 Y1..Y3
column 400 L1 at:D1,E1
roof /r level:L2 t:100
  outline X1,Y1 X2,Y1 X2,D1
  face X1,Y1,0 X2,Y1,0 X2,D1,0`,
  };
  const parsed = parseFiles(files, "main.muro");
  const reordered = parseFiles({
    ...files,
    "structure.muro": files["structure.muro"].replace("D1,E1", "E1,D1").replaceAll("X2,D1", "D1,X2"),
  }, "main.muro");
  assert.equal(toCanonical(parsed), toCanonical(reordered));
  assert.deepEqual(renderDiff(semanticDiff(parsed, reordered)), []);
  const form = derive(parsed);
  assert.deepEqual(form.columns.map(c => [c.x,c.y]), [[3000,2000]]);
  assert.equal(form.roofs![0]!.projectedAreaM2, 12);
  const changed = { ...files, "axes.muro": axes.replace("X2,Y2", "X2,Y2+2000") };
  const moved = derive(parseFiles(changed, "main.muro"));
  assert.deepEqual(moved.columns.map(c => [c.x,c.y]), [[2400,2400]]);
  assert.equal(moved.roofs![0]!.projectedAreaM2, 18);
});

test("canonical and diff retain axis references and disregard reversed definitions", () => {
  const left = parse(grid + axes);
  const reversed = parse(grid + "axis E1 X2,Y1 X1,Y2\naxis D1 X2,Y2 X1,Y1");
  assert.equal(toCanonical(left), toCanonical(reversed));
  assert.deepEqual(renderDiff(semanticDiff(left, reversed)), []);
  assert.deepEqual(JSON.parse(toCanonical(left)).axes, {D1:["X1,Y1","X2,Y2"], E1:["X1,Y2","X2,Y1"]});
  const right = parse(grid + "axis D1 X1,Y1 X3,Y2\naxis G1 X1,Y1 X3,Y3");
  assert.deepEqual(renderDiff(semanticDiff(left,right)), [
    "+ axis G1","− axis E1","± axis D1: to X2,Y2 → X3,Y2",
  ]);
  assert.equal(JSON.parse(toCanonical(parse(grid))).axes, undefined);
});

test("invalid axes have no fallback point; older editions report the declaration's source", () => {
  const model = parse(grid + axes + "axis D2 X1,Y2 X2,Y3\naxis H X1,Y1 X3,Y1");
  for (const ref of ["D1,D1", "D1,D2", "Y1,H"]) {
    assert.throws(() => gridPoint(model,ref,4), /unique intersection/);
  }
  assert.throws(() => gridPoint(model,"missing,Y1",0), /Undefined grid line/);
  assert.throws(() => gridPoint(model,"D1+200,Y1",0), /Offsets on named axes/);
  assert.throws(() => parse(grid + axes + "axis D1 X1,Y1 X2,Y2"), /Duplicate/);
  assert.throws(() => parse(grid + "axis X9 X1,Y1 X2,Y2"), /reserved/);
  assert.throws(() => parse(grid + "axis D1 X1,Y1 X1,Y1"), /distinct/);
  assert.throws(() => parse(grid + axes + "axis F D1,E1 X1,Y2"), /X,Y grid/);
  assert.throws(() => parseFiles({
    "main":grid.replace("1.8","1.7")+"import axes","axes":"\n"+axes,
  },"main"), e => e instanceof SourceError && e.code === "VER12" && e.file === "axes" && e.line === 2);
  assert.doesNotThrow(() => parse(grid.replace("muro 1.8\n","") + axes + "muro 1.8"));
});

test("the primary Y family inclines about X1 including grid offsets and independent named axes", () => {
  const source = `muro 1.8
grid Y 2000 6000 slope:1/5
grid X 1000 7000
axis H X1,Y2 X2,Y2-1200
axis G X1,Y1 X2,Y1
level L1 0 h:2800 slab:200
space /L1/a cell:X1,Y1;X2,Y1;X2,Y2;X1,Y2
column 400 L1 x:X2 y:Y2`;
  const model = parse(source);
  assert.deepEqual(gridPoint(model, "X1,Y2"), { x: 1000, y: 6000 });
  assert.deepEqual(gridPoint(model, "X2+500,Y2-200"), { x: 7500, y: 7100 });
  assert.deepEqual(gridPoint(model, "H,Y1"), { x: 21000, y: 6000 });
  assert.deepEqual(gridPoint(model, "Y1,H"), gridPoint(model, "H,Y1"));
  assert.throws(() => gridPoint(model, "G,Y2"), /unique intersection/);
  assert.deepEqual(derive(model).columns.map(({ x, y }) => [x, y]), [[7000, 7200]]);
  assert.equal(JSON.parse(toCanonical(model)).grid.slopeY, 0.2);
  const decimal = parse(source.replace("1/5", "0.2"));
  assert.equal(toCanonical(model), toCanonical(decimal));
  assert.deepEqual(renderDiff(semanticDiff(model, decimal)), []);
  const negative = parse(source.replace("1/5", "-1/5"));
  assert.deepEqual(gridPoint(negative, "X2,Y2"), { x: 7000, y: 4800 });
  assert.deepEqual(renderDiff(semanticDiff(model, negative)), ["± grid Y slope 0.2 → -0.2"]);
});

test("an explicit grid slope is a 1.8 declaration; a zero slope preserves the orthogonal grid", () => {
  const zero = parse(grid.replace("grid Y 0 4000 8000", "grid Y 0 4000 8000 slope:0"));
  assert.equal(toCanonical(zero), toCanonical(parse(grid)));
  assert.deepEqual(gridPoint(zero, "X2,Y2"), { x: 6000, y: 4000 });
  assert.throws(() => parseFiles({
    main: "muro 1.7\nimport geometry", geometry: "\ngrid Y 0 4000 slope:0",
  }, "main"), e => e instanceof SourceError && e.code === "VER12" && e.file === "geometry" && e.line === 2);
  for (const bad of ["1/0", "1/-5", "NaN", "1/2/3", ""]) {
    assert.throws(() => parse(`muro 1.8\ngrid Y 0 4000 slope:${bad}`), /finite signed/);
  }
  assert.throws(() => parse("muro 1.8\ngrid Y 0 4000 slope:1/5 slope:1/5"), /single slope/);
  assert.throws(() => parse("muro 1.8\ngrid X 0 4000 slope:1/5"), /Only the Y/);
});
