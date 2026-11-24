import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive } from "../src/core/derive.js";
import { toCanonical, type Pt } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { runDrawsForLevel, runSolids, verticalRuns } from "../src/core/vertical.js";
import { planMarks, sceneOf } from "../src/draw/index.js";

const source = `muro 1.8
grid X 0 12000
grid Y 0 8000
frame AB at:X2,Y2 angle:30 A:0,6000 B:0,6000
level L1 0 h:2600
level L2 3200 h:2600
level L3 6400 h:2600
space /L1/stair A1..A2 B1..B2 stair:N form:return entry:1000 landing:1400 turn:L
space /L2/stair A1..A2 B1..B2 stair:N form:return entry:1000 landing:1400 turn:L
space /L3/stair A1..A2 B1..B2
stack stair L1..L3 type:stair`;

const lower = "/L1/stair";
const upper = "/L2/stair";
const withArrival = (s: string, ref: string) => s.replace("form:return", "form:return arrival-at:" + ref);

function localStation(p: Pt, dimension: "A" | "B"): number {
  const x = p.x - 12000;
  const y = p.y - 8000;
  const a = Math.PI / 6;
  return dimension === "A" ? x * Math.cos(a) + y * Math.sin(a) : -x * Math.sin(a) + y * Math.cos(a);
}

test("a single upper arrival moves the incoming plan and tread solids, independently of both departures and the landing", () => {
  for (const up of ["N", "S", "E", "W"]) {
    for (const turn of ["L", "R"]) {
      const original = source.replaceAll("stair:N", "stair:" + up).replaceAll("turn:L", "turn:" + turn);
      const dimension = up === "N" || up === "S" ? "B" : "A";
      const forward = up === "N" || up === "E";
      const station = forward ? 650 : 5350;
      const ref = dimension + (forward ? "1+650" : "2-650");
      const model = parse(withArrival(original, ref));
      assert.deepEqual(checkDiagnostics(model).filter(d => d.severity === "error"), []);
      assert.ok(toCanonical(model).includes(ref));

      const before = derive(parse(original));
      const after = derive(model);
      const run = after.runs.find(r => r.path === lower)!;
      const previous = before.runs.find(r => r.path === lower)!;
      assert.deepEqual(run.parts.slice(0, 2), previous.parts.slice(0, 2));
      assert.deepEqual(after.runs.find(r => r.path === upper), before.runs.find(r => r.path === upper));
      const returning = run.parts[2]!;
      assert.equal(returning.t0, 650);
      assert.equal(returning.s0, previous.parts[2]!.s0);
      assert.equal(returning.s1, previous.parts[2]!.s1);
      assert.equal(returning.tread, (4600 - 650) / (returning.risers! - 1));
      assert.equal(run.going - previous.going, 350);
      const worldEnd = (points: Pt[]) => {
        const values = points.map(p => localStation(p, dimension));
        assert.ok(Math.abs((forward ? Math.min(...values) : Math.max(...values)) - station) < 1e-6);
      };

      const topTread = sceneOf(after).nodes.filter(n => n.of === "run" && n.ref === lower && n.solid)
        .sort((a, b) => Math.max(...b.solid!.top) - Math.max(...a.solid!.top))[0]!;
      worldEnd(topTread.solid!.ring);
      const outlines = planMarks(after, "L2").filter(m => m.ref === lower && m.role === "run-outline");
      worldEnd(outlines.flatMap(m => m.lines!.flatMap(l => [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }])));
    }
  }
});

test("an omitted return arrival matches the boarding station, including the default entry depth", () => {
  for (const [s, ref] of [[source, "B1+1000"], [source.replaceAll(" entry:1000", ""), "B1+1100"]] as const) {
    const a = parse(s);
    const b = parse(withArrival(s, ref));
    const original = verticalRuns(a)[0]!;
    const equal = verticalRuns(b)[0]!;
    assert.deepEqual(equal, original);
    assert.deepEqual(runSolids(equal), runSolids(original));
    assert.deepEqual(runDrawsForLevel(b, "L2"), runDrawsForLevel(a, "L2"));
  }
});

test("invalid, transverse and out-of-frame arrivals are diagnosed on the declaring space", () => {
  const xy = source.replace(/^frame .+\n/m, "").replaceAll("A1..A2 B1..B2", "X1..X1+6000 Y1..Y1+6000");
  const bad = ["X1+650", "Y7", "Y1-1", "Y1+4600", "Y2+1000", "300", "north"].map(ref => withArrival(xy, ref));
  bad.push(withArrival(xy.replace("1.8", "1.7"), "Y1+650"));
  for (const declaration of ["stair:N form:straight", "ramp:N form:return", ""]) {
    bad.push(xy.replace("stair:N form:return", declaration + " arrival-at:Y1+650"));
  }
  bad.push(withArrival(source, "Y1+650"), withArrival(source, "A1+650"));
  for (const s of bad) {
    const model = parse(s);
    assert.ok(checkDiagnostics(model).some(d => d.code === "RUN05" && d.path?.includes(lower)));
    assert.ok(!verticalRuns(model).some(r => r.path === lower));
  }
  for (const ref of ["Y1", "Y1+650", "Y2-3401"]) {
    assert.equal(verticalRuns(parse(withArrival(xy, ref)))[0]?.path, lower);
  }
  const top = xy.slice(0, xy.indexOf("space /L1/")) + "space /L3/stair X1..X1+6000 Y1..Y1+6000 stair:N form:return";
  for (const invalid of [withArrival(top, "X1+650"), withArrival(top.replace("1.8", "1.7"), "Y1+650")]) {
    assert.ok(checkDiagnostics(parse(invalid)).some(d => d.code === "RUN05" && d.message.includes("arrival-at")));
  }
  assert.ok(checkDiagnostics(parse(withArrival(top, "Y1+650"))).some(d => d.code === "SUF04"));
  const noDeparture = withArrival(xy.replace("landing:1400", "landing:5900"), "Y1");
  assert.ok(checkDiagnostics(parse(noDeparture)).some(d => d.code === "RUN05" && !d.message.includes("arrival-at")));
});

test("adjacent floors with different boarding positions clip both ends of a partially covered flight", () => {
  const xy = source.replace(/^frame .+\n/m, "").replaceAll("A1..A2 B1..B2", "X1..X1+6000 Y1..Y1+6000");
  const model = parse(xy.replace("entry:1000", "entry:600"));
  const down = runDrawsForLevel(model, "L2").find(d => d.path === lower)!;
  const eastEdge = down.outline.filter(l => l.x1 === 6000 && l.x2 === 6000);
  assert.deepEqual(eastEdge.map(l => [l.y1, l.y2]), [[600, 1000], [3700, 4600], [4600, 6000]]);
});
