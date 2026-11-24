import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, parseFiles, toCanonical } from "../src/index.js";
import { derive, elevationForm, sectionForm } from "../src/form.js";
import { sceneOf } from "../src/draw/index.js";
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

test("a gable or shed keeps its eave heights in a translated, rotated wing", () => {
  const prefix = `muro 1.8
grid X 0 1500
grid Y 0 2000
frame AB at:X2,Y2 angle:20 A:0,8000 B:0,6000
level L1 0 h:3000
roof /wing level:L1 eave-z:3000 slope:1/4 t:150 `;
  const model = (spec: string) => parse(prefix + spec + "\n  outline A1,B1 A2,B1 A2,B2 A1,B2");
  const angle = Math.PI / 9, cos = Math.cos(angle), sin = Math.sin(angle);
  for (const [spec, zAt] of [
    ["type:gable ridge-axis:A", (a, b) => 3000 + Math.min(b, 6000 - b) / 4],
    ["type:gable ridge-axis:B", (a, b) => 3000 + Math.min(a, 8000 - a) / 4],
    ["type:shed rise:+B", (a, b) => 3000 + b / 4],
    ["type:shed rise:-A", (a, b) => 3000 + (8000 - a) / 4],
  ] as [string, (a: number, b: number) => number][]) {
    const form = derive(model(spec));
    const roof = form.roofs![0]!;
    const faceCount = spec.includes("gable") ? 2 : 1;
    assert.equal(roof.faces.length, faceCount);
    close(roof.modeledProjectionM2, 48);
    close(roof.surfaceAreaM2!, 48 * Math.hypot(1, 0.25));
    for (const { vertices } of roof.faces) {
      for (const { x, y, z } of vertices) {
        const a = cos * (x - 1500) + sin * (y - 2000);
        const b = -sin * (x - 1500) + cos * (y - 2000);
        close(z, zAt(a, b));
      }
    }
    assert.equal(sceneOf(form).nodes.filter(n => n.of === "roof" && n.solid).length, faceCount);
    assert.ok(form.plans[0]!.entities.some(e => e.of === "roof"));
    assert.ok(sectionForm(form, { axis: "X", at: 4000, look: "W" }).entities.some(e => e.of === "roof" && e.class === "cut"));
    assert.ok(elevationForm(form, "S").entities.some(e => e.of === "roof"));
  }
  for (const [type, axis] of [["gable", "ridge-axis:A"], ["shed", "rise:+B"]]) {
    const roof = derive(model("type:" + type)).roofs![0]!;
    assert.deepEqual(roof.assumptions, [axis]);
    assert.deepEqual(roof.faces, derive(model("type:" + type + " " + axis)).roofs![0]!.faces);
  }
  const square = parse(prefix.replace("angle:20", "angle:30").replace("B:0,6000", "B:0,8000") +
    "type:gable\n  outline A1,B1 A2,B1 A2,B2 A1,B2");
  assert.deepEqual(derive(square).roofs![0]!.assumptions, ["ridge-axis:A"]);
  const fromRooms = parse(prefix.replace("roof /wing", "space /L1/wing A1..A2 B1..B2\nroof /wing") + "type:gable");
  const inferred = derive(fromRooms).roofs![0]!;
  assert.deepEqual(inferred.assumptions, ["outline:exposed-storey", "ridge-axis:A"]);
  close(inferred.modeledProjectionM2, 48);
  const worldShed = derive(model("type:shed rise:+Y")).roofs![0]!;
  for (const p of worldShed.faces[0]!.vertices) close(p.z, 3000 + (p.y - 2000) / 4);
  const incompatible = derive(model("type:gable ridge-axis:X")).roofs![0]!;
  close(incompatible.projectedAreaM2, 48);
  assert.equal(incompatible.modeledProjectionM2, 0);
  assert.throws(() => model("type:gable ridge-axis:C"), /declared frame direction/);
  assert.throws(() => model("type:shed rise:+A1"), /declared frame direction/);
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
