import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, parseFiles, toCanonical } from "../src/index.js";
import { gridPoint } from "../src/model.js";
import { derive } from "../src/form.js";
import { renderDiff, semanticDiff } from "../src/core/diff.js";
import { frameGridRef, namedAxisGeometry, SourceError } from "../src/core/model.js";

const base = `muro 1.8
grid X 1000 7000
grid Y 2000 6000
`;
const ab = "frame AB at:X2,Y2 angle:30 A:0,3000,7000 B:-2000,0,4000\n";
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} differs from ${expected}`);
}
test("two independent orthogonal grids intersect in world space with local offsets", () => {
  const model = parse(base + ab);
  const p = gridPoint(model, "A1,B2");
  const a = gridPoint(model, "A2,B2");
  const b = gridPoint(model, "A1,B3");
  assert.deepEqual(p, { x: 7000, y: 6000 });
  near(Math.hypot(a.x - p.x, a.y - p.y), 3000);
  near(Math.hypot(b.x - p.x, b.y - p.y), 4000);
  near((a.x-p.x)*(b.x-p.x) + (a.y-p.y)*(b.y-p.y), 0);
  const offset = gridPoint(model, "A1+500,B2-200");
  near(offset.x, 7000 + 500*Math.cos(Math.PI/6) + 100);
  near(offset.y, 6000 + 250 - 200*Math.cos(Math.PI/6));
  assert.deepEqual(gridPoint(model, "B2-200,A1+500"), offset);
  assert.deepEqual(frameGridRef(model, "B2-200"), { frame:"AB", family:"B", index:1, coord:-200 });
  const crossing = gridPoint(model, "X1,B2");
  near(crossing.x, 1000);
  near(crossing.y, 6000 - 6000*Math.tan(Math.PI/6));
  assert.deepEqual(gridPoint(model, "B2,X1"), crossing);
  assert.deepEqual(gridPoint(model, "X2,Y2"), p);
  const shifted = namedAxisGeometry(model, "A1+500")!;
  near(shifted.a.x, gridPoint(model, "A1+500,B1").x);
  near(shifted.b.y, gridPoint(model, "A1+500,B3").y);
  assert.throws(() => gridPoint(model, "A1,A2"), /unique intersection/);
});

test("frame origin, rotation and dimensions remain editable source facts", () => {
  const text = base + ab + `frame CD at:A2,B2 angle:90 C:0,5000 D:0,6000
level L1 0 h:2800 slab:200
column 400 L1 at:A1+500,B2-200`;
  const model = parse(text);
  const c = gridPoint(model, "C2,D1");
  const anchor = gridPoint(model, "A2,B2");
  near(c.x, anchor.x);
  near(c.y, anchor.y + 5000);
  near(gridPoint(model, "A2,D1").x, anchor.x);
  const expected = gridPoint(model, "A1+500,B2-200");
  const col = derive(model).columns[0]!;
  assert.deepEqual([col.x,col.y], [expected.x,expected.y]);
  const doc = JSON.parse(toCanonical(model));
  assert.deepEqual(doc.frames.AB, { at:"X2,Y2", angle:30, A:[0,3000,7000], B:[-2000,0,4000] });
  assert.equal(doc.axes, undefined);
  const reverse = parse(text.replace("angle:30", "angle:-330").replace("at:A2,B2","at:B2,A2").replace("at:A1+500,B2-200","at:B2-200,A1+500"));
  assert.equal(toCanonical(reverse), toCanonical(model));
  assert.deepEqual(renderDiff(semanticDiff(model, reverse)), []);
  const rotated = parse(text.replace("angle:30","angle:60"));
  assert.deepEqual(renderDiff(semanticDiff(model, rotated)), ["± frame AB: angle 30 → 60"]);
  assert.notDeepEqual(gridPoint(rotated, "C2,D1"), c);
  assert.deepEqual(renderDiff(semanticDiff(parse(base), parse(base + ab))), ["+ frame AB"]);
});

test("frame declarations reject inconsistent dimensions, colliding lines and earlier editions", () => {
  for (const [old,next] of [["frame AB","frame AA"],["frame AB","frame XA"],["0,3000,7000","0,3000,3000"],["0,3000,7000","3000"],["angle:30","angle:NaN"]]) {
    assert.throws(() => parse(base + ab.replace(old!,next!)), SourceError);
  }
  assert.throws(() => parse(base + "axis A1 X1,Y1 X2,Y2\n" + ab), /Duplicate grid line/);
  assert.throws(() => parse(base + ab + "axis B1 X1,Y1 X2,Y2"), /Duplicate/);
  assert.throws(() => parseFiles({ main:base.replace("1.8","1.7")+"import local", local:ab }, "main"),
    e => e instanceof SourceError && e.code === "VER12" && e.file === "local" && e.line === 1);
});
