import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { area } from "../src/core/poly.js";
import { elevationForm, sectionForm } from "../src/core/section.js";
import { planMarks, sceneOf, svgAxo, svgElevation, svgPlan, svgSection } from "../src/draw/index.js";

const grid = `muro 1.7
mode spatial
grid X 0 4000
grid Y 0 3000
level L1 0 h:3000`;
const outline = "  outline X1,Y1 X2,Y1 X2,Y2 X1,Y2";
const model = parse(`${grid}
roof /cover level:L1 type:shed eave-z:1000 rise:+X slope:1/2 t:200
${outline}
column 500 L1 at:X1+2000,Y1+1500
beam /frame level:L1 from:X1,Y1+1500 to:X2,Y1+1500 w:300 d:500 top:2500
foundation /foot level:L1 type:pad at:X1+2000,Y1+1500 w:1200 d:1400 t:500 top:-200`);

test("one inclined face and structural members retain their dimensions in each projection", () => {
  const form = derive(model);
  const entities = form.plans[0]!.entities;
  const roof = entities.filter((e) => e.of === "roof");
  assert.deepEqual(Object.fromEntries(roof.map((e) => [e.class, area(e.polygon!) / 1e6])), {
    below: 1.2, cut: 1.2, above: 9.6,
  });
  assert.equal(entities.find((e) => e.of === "beam")!.class, "above");
  assert.equal(entities.find((e) => e.of === "foundation")!.class, "below");
  assert.deepEqual(planMarks(form, "L1").filter((m) => m.of === "roof").map((m) => m.polygon), roof.map((e) => e.polygon));
  const cut = sectionForm(form, { axis: "Y", at: 1500, look: "N" });
  const sectionOf = (of: string) => cut.entities.find((e) => e.of === of && e.class === "cut")!.polygon;
  assert.deepEqual(sectionOf("roof"), [{ u: 0, z: 800 }, { u: 4000, z: 2800 }, { u: 4000, z: 3000 }, { u: 0, z: 1000 }]);
  assert.deepEqual(sectionOf("beam").map((p) => p.z), [2000, 2000, 2500, 2500]);
  assert.deepEqual(sectionOf("foundation").map((p) => p.u), [1400, 2600, 2600, 1400]);
  assert.deepEqual(sectionOf("column").map((p) => p.u), [1750, 2250, 2250, 1750]);
  assert.deepEqual(elevationForm(form, "S").entities.find((e) => e.of === "roof")!.polygon, sectionOf("roof"));
  const facingUpslope = sectionForm(form, { axis: "X", at: 2000, look: "E" });
  const roofBehind = facingUpslope.entities.find((e) => e.of === "roof" && e.class === "beyond");
  assert.ok(roofBehind);
  assert.equal(Math.max(...roofBehind.polygon.map((p) => p.z)), 3000);
  assert.equal(Math.min(...roofBehind.polygon.map((p) => p.z)), 1800);
  const body = sceneOf(form).nodes.find((n) => n.of === "roof")!.solid!;
  assert.deepEqual(body.top, [1000, 3000, 3000, 1000]);
  assert.deepEqual(body.bottom, [800, 2800, 2800, 800]);
  for (const svg of [svgPlan(model, {level:"L1"}), svgSection(model, {axis:"Y", at:1500}), svgElevation(model, {face:"S"}), svgAxo(model)]) {
    for (const subject of ["roof","column","beam","foundation"]) assert.ok(svg.includes(`data-of="${subject}"`), subject);
  }
});

test("an outline without heights stays visible in plan; an edge-on roof surface remains visible in section and elevation", () => {
  const outlineModel = parse(`${grid}\nroof /unknown level:L1\n${outline}`);
  const form = derive(outlineModel);
  assert.equal(form.plans[0]!.entities.find((e) => e.of === "roof")!.class, "footprint");
  assert.ok(svgPlan(outlineModel).includes('data-class="footprint"'));
  assert.equal(sceneOf(form).nodes.filter((n) => n.of === "roof").length, 0);

  for (const type of ["type:flat eave-z:1500", "type:shed eave-z:1000 rise:+X slope:1/2"]) {
    const m = parse(`${grid}\nroof /surface level:L1 ${type}\n${outline}`);
    const surface = derive(m);
    for (const projection of [sectionForm(surface, {axis:"Y", at:1500, look:"N"}), elevationForm(surface,"S")]) {
      const edge = projection.entities.find((e) => e.ref === "/surface")!.polygon;
      assert.equal(edge.length, 2);
      assert.equal(edge[1]!.u - edge[0]!.u, 4000);
    }
  }
});

test("schematic roof options select the same geometry in a spatial plan, section, elevation and axonometric", () => {
  const model = parse(`${grid}
space /L1/hall hall X1..X2 Y1..Y2
roof /sketch level:L1 type:gable
${outline}`);
  const sketches = { roofSketches: true };
  assert.ok(svgPlan(model).includes('data-class="footprint"'));
  assert.ok(!svgPlan(model, sketches).includes('data-class="footprint"'));
  for (const svg of [
    svgSection(model, { axis: "X", at: 2000, ...sketches }),
    svgElevation(model, { face: "S", ...sketches }),
    svgAxo(model, sketches),
  ]) {
    assert.ok(svg.includes('data-ref="/sketch"'));
  }
});
