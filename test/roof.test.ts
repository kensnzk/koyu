import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseFiles, toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { areaOf } from "../src/core/poly.js";

const base = `muro 1.7
grid X 0 4000 8000
grid Y 0 6000
level L1 0 h:3000 slab:160
level L2 4000
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2`;
const rectangle = "  outline X1,Y1 X3,Y1 X3,Y2 X1,Y2";
const shape = (source: string) => derive(parse(base + "\n" + source));
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("a sketch follows both rooms; only written controls enter the source", () => {
  const model = parse(base + "\nroof /cover level:L1 type:gable");
  const roof = derive(model).roofs![0]!;
  assert.deepEqual(roof.assumptions, [
    "outline:exposed-storey",
    "ridge-axis:X",
    "slope:1/4",
    "eave:storey-top",
  ]);
  assert.equal(roof.faces.length, 2);
  const z = roof.faces.flatMap((f) => f.vertices.map((v) => v.z));
  assert.equal(Math.min(...z), 4000);
  assert.equal(Math.max(...z), 4750);
  assert.equal(roof.projectedAreaM2, 48);
  close(roof.surfaceAreaM2!, Math.hypot(1, 0.25) * 48);
  const canonical = JSON.parse(toCanonical(model)).roofs["/cover"];
  assert.deepEqual(canonical, { level: "L1", type: "gable" });
  assert.equal(derive(model).slabs.filter((s) => s.kind === "roof").length, 0);
});

test("fixed heights determine slope; a high point alone plus slope locates both eaves", () => {
  const a = shape("roof /cover level:L1 type:hip eave-z:3000 high-z:3750\n" + rectangle).roofs![0]!;
  const b = shape("roof /cover level:L1 type:hip high-z:3750 slope:1/4\n" + rectangle).roofs![0]!;
  assert.deepEqual(a, b);
  assert.equal(a.faces.length, 4);
  const ridge = a.faces.flatMap((f) => f.vertices).filter((v) => v.z === 3750);
  assert.deepEqual(
    [...new Set(ridge.map((v) => Math.round(v.x)))].sort((a, b) => a - b),
    [3000, 5000],
  );
  assert.ok(ridge.every((v) => Math.abs(v.y - 3000) < 1e-7));
  assert.throws(
    () => shape("roof /r level:L1 type:hip eave-z:3000 high-z:3750 slope:1/4"),
    /two increasing heights/,
  );
});

test("a shed canopy can project beyond the rooms; it contributes 4.8 m2 in projection", () => {
  const roof = shape(
    "roof /p level:L1 type:shed eave-z:2850 rise:+Y slope:1/20 t:120\n" +
      "  outline X1,Y1-1200 X2,Y1-1200 X2,Y1 X1,Y1",
  ).roofs![0]!;
  assert.deepEqual(roof.assumptions, []);
  assert.equal(roof.thickness, 120);
  assert.equal(roof.projectedAreaM2, 4.8);
  close(roof.surfaceAreaM2!, 4.8 * Math.hypot(1, 1 / 20));
  assert.deepEqual([...new Set(roof.faces[0]!.vertices.map((p) => p.z))], [2850, 2910]);
});

test("spatial readback keeps an outline without an invented height; a sketch is opt-in", () => {
  const model = parse(base + "\nmode spatial\nroof /r level:L1 type:gable\n" + rectangle);
  const observed = derive(model).roofs![0]!;
  assert.deepEqual(observed.faces, []);
  assert.deepEqual(observed.assumptions, []);
  assert.equal(observed.projectedAreaM2, 48);
  assert.equal(observed.modeledProjectionM2, 0);
  assert.equal(observed.surfaceAreaM2, undefined);
  assert.equal(derive(model, { roofSketches: true }).roofs![0]!.faces.length, 2);
});

test("surveyed faces can cover a subset; relative elevations use the selected storey", () => {
  const roof = shape(
    "roof /r level:L2 type:gable\n" + rectangle + "\n  face X1,Y1,100 X2,Y1,1100 X2,Y2,1100 X1,Y2,100",
  ).roofs![0]!;
  assert.equal(roof.projectedAreaM2, 48);
  assert.equal(roof.modeledProjectionM2, 24);
  assert.deepEqual(
    roof.faces[0]!.vertices.map((p) => p.z),
    [4100, 5100, 5100, 4100],
  );
  close(roof.surfaceAreaM2!, 24 * Math.hypot(1, 0.25));
  assert.throws(() => shape("roof /r level:L1\n  face X1,Y1,0 X2,Y1,0 X2,Y2,200 X1,Y2,0"), /share a plane/);
});

test("an inferred roof outside the explicit projection survives; an identical floor layer is represented once", () => {
  const f = shape("roof /r level:L1 type:flat eave-z:4000 t:120\n  outline X1,Y1 X2,Y1 X2,Y2 X1,Y2");
  assert.equal(areaOf(f.slabs.filter((s) => s.kind === "roof").map((s) => s.outline)), 24e6);
  const s = base.replace("level L2 4000", "level L2 4000 slab:120");
  const g = derive(
    parse(s + "\nspace /L2/top X1..X2 Y1..Y2\nroof /r level:L1 type:flat eave-z:4000 t:120\n" + rectangle),
  );
  assert.ok(!g.slabs.some((s) => s.kind === "floor" && s.level === "L2"));
  assert.equal(g.spaces.find((s) => s.path === "/L2/top")!.areaM2, 24);
});

test("concave outlines and courtyards retain their measured footprint", () => {
  const l = shape(
    "roof /r level:L1 type:flat eave-z:3000\n  outline X1,Y1 X3,Y1 X3,Y1+2000 X2,Y1+2000 X2,Y2 X1,Y2",
  ).roofs![0]!;
  assert.equal(l.projectedAreaM2, 32);
  assert.equal(l.surfaceAreaM2, 32);
  const c = shape(
    "roof /r level:L1 type:flat eave-z:3000\n" +
      rectangle +
      "\n  hole X1+1000,Y1+1000 X2,Y1+1000 X2,Y1+2000 X1+1000,Y1+2000",
  ).roofs![0]!;
  assert.equal(c.projectedAreaM2, 45);
  assert.equal(c.surfaceAreaM2, 45);
  const form = shape(
    "roof /r level:L1 type:flat eave-z:3000\n" +
      rectangle +
      "\n  hole X1+1000,Y1+1000 X2,Y1+1000 X2,Y1+2000 X1+1000,Y1+2000",
  );
  assert.ok(!form.slabs.some((s) => s.kind === "roof"));
});

test("roof declarations in imported layers require the effective edition", () => {
  assert.throws(
    () =>
      parseFiles(
        { "main.muro": base.replace("1.7", "1.6") + "\nimport roof.muro", "roof.muro": "roof /r level:L1" },
        "main.muro",
      ),
    (e: any) => e.code === "VER11" && e.file === "roof.muro" && e.line === 1,
  );
});

test("equivalent offsets and elevation spellings preserve canonical roof identity", () => {
  const read = (first: string) =>
    parse(base + "\nroof /r level:L1\n  face " + first + " X2,Y1,100 X2,Y2,100 X1,Y2,0");
  assert.equal(toCanonical(read("X1+0,Y1-00,0.00")), toCanonical(read("X1,Y1,0")));
  assert.throws(() => parse(base + "\nroof /r level:L1 type:flat eave-z:" + "9".repeat(400)), /finite/);
  assert.throws(() => parse(base + "\nroof /r level:toString"), /declared level/);
});
