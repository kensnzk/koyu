import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "../src/core/parse.js";
import { derive } from "../src/core/derive.js";
import { gridPoint } from "../src/core/model.js";
import { svgPlan } from "../src/draw/plan.js";
import { planMarks } from "../src/draw/marks.js";
import { referenceCut, svgElevation, svgSection } from "../src/draw/section.js";
import { elevationForm } from "../src/core/section.js";
import { checkDiagnostics } from "../src/core/diagnose.js";

const source = `muro 1.8
grid X 0 10000
grid Y 0 10000
frame AB at:X1+1200,Y1+500 angle:20 A:0,6000 B:0,2500,5000
level L1 0 h:2600 slab:200
space /L1/a room cell:A1,B1;A2,B1;A2,B2;A1,B2
space /L1/b room cell:A1,B2;A2,B2;A2,B3;A1,B3
boundary /L1/a /L1/b
  door w:850 at:A1+2200
`;

test("a door sized along the AB wall remains tied to the local frame offset when the wing turns", () => {
  for (const angle of [20, -30, 90]) {
    const m = parse(source.replace("angle:20", "angle:" + angle));
    const o = derive(m).openings[0]!;
    const crossing = gridPoint(m, "A1+2200,B2");
    assert.ok(Math.hypot(o.cx - crossing.x, o.cy - crossing.y) < 0.001);
    assert.equal(o.w, 850);
  }
  for (const [at, code] of [["B2+100", "OPN07"], ["A1+5", "OPN08"]]) {
    assert.ok(checkDiagnostics(parse(source.replace("at:A1+2200", "at:" + at))).some(d => d.code === code));
  }
});

test("an offset section cuts the rotated grid and marks its own perpendicular stations", () => {
  const model = parse(source);
  const cut = referenceCut(model, "B2+400")!;
  const p = gridPoint(model, "A1,B2+400"), q = gridPoint(model, "A2,B2+400");
  assert.ok(Math.hypot(cut.x1-p.x,cut.y1-p.y) < 0.001 && Math.hypot(cut.x2-q.x,cut.y2-q.y) < 0.001);
  const svg = svgSection(model, { cut, atRef: "B2+400" });
  assert.match(svg, />A1<\/text>/);
  assert.match(svg, />A2<\/text>/);
  const plan = svgPlan(model);
  assert.match(plan, /data-axis="A2"/);
  assert.match(plan, /data-axis="B2"/);
});

test("a door's left and right jambs are measured from the swing room as the wing turns", () => {
  for (const angle of [0, 20, -30, 90, 190]) {
    const rad = angle * Math.PI / 180;
    for (const side of ["a","b"]) {
      for (const hand of ["L","R"]) {
        const model = parse(source.replace("angle:20", "angle:" + angle).trimEnd() + ` swing:${side} hinge:${hand}`);
        assert.ok(!checkDiagnostics(model).some(d => d.code === "OPN01"));
        const door = derive(model).openings[0]!;
        const swing = door.swing!;
        const a = side === "a" ? -1 : 1;
        const localX = 2200 + (hand === "L" ? a : -a) * 425;
        const x = 1200 + Math.cos(rad) * localX - Math.sin(rad) * 2500;
        const y = 500 + Math.sin(rad) * localX + Math.cos(rad) * 2500;
        assert.ok(Math.hypot(swing.hinge.x - x, swing.hinge.y - y) < 1e-6);
        assert.ok(Math.hypot(swing.leaf.x - x + a * 850 * Math.sin(rad),
          swing.leaf.y - y - a * 850 * Math.cos(rad)) < 1e-6);
      }
    }
  }
  const swing = (hinge: string) => derive(parse(source.trimEnd() + " hinge:" + hinge)).openings[0]!.swing!;
  assert.deepEqual(swing("N").hinge, swing("E").hinge);
  assert.deepEqual(swing("S").hinge, swing("W").hinge);
  assert.ok(swing("N").hinge.y > swing("S").hinge.y);
  const old = `muro 1.7
grid X 0 6000
grid Y 0 2500 5000
level L1 0
space /L1/a X1..X2 Y1..Y2
space /L1/b X1..X2 Y2..Y3
boundary /L1/a /L1/b
  door w:850 hinge:L`;
  assert.throws(() => parse(old), /require muro 1.8/);
});

test("a frame elevation projects the opening at its full width on either side of the wing", () => {
  for (const angle of [0, 20, -30, 90]) {
    const model = parse(source.replace("angle:20", "angle:" + angle));
    const form = derive(model), grid = model.frames!.get("AB")!;
    for (const face of ["S", "N"] as const) {
      const view = elevationForm(form, face, grid);
      assert.ok(view.entities.length && view.entities.every(e => e.class === "beyond"));
      const opening = view.entities.find(e => e.of === "opening")!;
      const us = opening.polygon.map(p => p.u);
      const sign = face === "S" ? 1 : -1;
      assert.ok(Math.abs(Math.max(...us) - Math.min(...us) - 850) < 1e-6);
      assert.ok(Math.abs((Math.max(...us) + Math.min(...us)) / 2 - sign * 2200) < 1e-6);
      const svg = svgElevation(model, {face, frame:"AB"});
      assert.match(svg, />A1<\/text>/);
      assert.match(svg, />A2<\/text>/);
    }
    for (const face of ["W", "E"] as const) {
      const svg = svgElevation(model, {face, frame:"AB"});
      assert.match(svg, />B2<\/text>/);
    }
    assert.throws(() => svgElevation(model, {face:"S", frame:"CD"}), /Undefined grid frame/);
  }
});

test("an outward-opening door takes its hand from the exterior for either boundary order", () => {
  for (const angle of [0, 125]) {
    const base = source.slice(0, source.indexOf("space /L1/b")).replace("angle:20", "angle:" + angle);
    const c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180);
    for (const order of ["/L1/a /out","/out /L1/a"]) {
      const side = order.startsWith("/out") ? "a" : "b";
      for (const hand of ["L","R"]) {
        const m = parse(base + `space /out outside:1
boundary ${order}
  line A1,B2 A2,B2
  door w:850 at:A1+2200 swing:${side} hinge:${hand}`);
        assert.ok(!checkDiagnostics(m).some(d => d.severity === "error"));
        const form = derive(m);
        const swing = form.openings[0]!.swing!;
        assert.equal(swing.into, "/out");
        const jamb = hand === "L" ? 2625 : 1775;
        const x = 1200 + c * jamb - s * 2500, y = 500 + s * jamb + c * 2500;
        assert.ok(Math.hypot(swing.hinge.x - x, swing.hinge.y - y) < 1e-6);
        assert.ok(Math.hypot(swing.leaf.x - x + s * 850, swing.leaf.y - y - c * 850) < 1e-6);
        assert.ok(planMarks(form,"L1").some(m => m.role === "door-arc"));
      }
    }
  }
});
