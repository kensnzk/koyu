import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { semanticDiff } from "../src/core/diff.js";
import { envelopeGaps, segmentLength, segmentsFor } from "../src/core/graph.js";
import { areaM2, pointInPolygon, polygonAreaM2, toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { sectionForm } from "../src/core/section.js";
import { siteReport } from "../src/core/site.js";
import { sceneOf, svgPlan } from "../src/draw/index.js";

const grid = `muro 1.8
grid X 0 4000 8000 12000
grid Y 0 2000 4000 6000
axis D1 X1,Y1 X1+1000,Y3
axis D2 X2,Y1 X2+1000,Y3
axis D3 X3,Y1 X3+1000,Y3
level L1 0 slab:180 h:2700`;
const cellA = "D1,Y1;D2,Y1;D2,Y3;D1,Y3";
const cellB = "D2,Y1;D3,Y1;D3,Y3;D2,Y3";
const plan = `${grid}
space /L1/a apartment cell:${cellA}
space /L1/b apartment cell:${cellB}
space /out outside:1
boundary /L1/a /L1/b
  door w:900 at:0.5
boundary /L1/a /out edge:W
  window w:1000 h:1200 at:0.5`;

test("the shared oblique wall, openings, floor solids, areas and section follow a grid edit", () => {
  for (const [offset, aArea, doorX] of [[1000,16,4500],[2000,18,5000]] as const) {
    const model = parse(plan.replace("axis D2 X2,Y1 X2+1000,Y3", `axis D2 X2,Y1 X2+${offset},Y3`));
    const a = model.spaces.get("/L1/a")!;
    const form = derive(model);
    const outline = [{x:0,y:0},{x:4000,y:0},{x:4000+offset,y:4000},{x:1000,y:4000}];
    assert.deepEqual(a.cell!.outline, outline);
    assert.equal(areaM2(a), aArea);
    assert.equal(siteReport(model).totalFloor, 32);
    assert.equal(siteReport(model).footprint, 32);
    assert.deepEqual(form.spaces.find(s=>s.path === a.path)!.outline, [outline]);
    const wall = form.boundaries.find(b => b.a === a.path && b.b === "/L1/b")!;
    assert.equal(segmentLength(wall.segment), Math.hypot(offset,4000));
    const door = form.openings.find(o => o.kind === "door")!;
    assert.ok(Math.hypot(door.cx - doorX, door.cy - 2000) < 1e-8);
    assert.equal(door.w,900);
    const window = form.openings.find(o => o.kind === "window")!;
    assert.deepEqual([window.cx,window.cy,window.w], [500,2000,1000]);
    assert.ok(wall.material!.panels.length >= 2);
    assert.deepEqual(form.slabs.find(s=>s.kind === "floor" && s.space === a.path)!.outline,outline);
    const floor = sceneOf(form).nodes.find(n => n.of === "slab" && n.kind === "floor" && n.ref === a.path);
    assert.deepEqual(floor?.solid?.ring,outline);
    const section = sectionForm(form,{axis:"Y",at:2000,look:"N"});
    const cut = section.entities.find(e => e.of === "slab" && e.kind === "floor" && e.ref === a.path && e.class === "cut")!;
    assert.deepEqual([...new Set(cut.polygon.map(p=>p.u))].sort((a,b)=>a-b), [500,doorX]);
    assert.deepEqual(checkDiagnostics(model).filter(d => d.severity === "error"),[]);
  }
});

test("partial diagonal contact leaves the free remainder, and only material overlap is diagnosed", () => {
  const text = `${grid}
space /L1/a cell:${cellA}
space /L1/b cell:D2,Y1;D3,Y1;D3,Y2;D2,Y2
space /L1/corner X1..X1+200 Y2..Y3
boundary /L1/a /L1/b`;
  const model = parse(text);
  const contact = segmentsFor(model, model.boundaries.find(b=>b.a==="/L1/a" && b.b==="/L1/b")!);
  assert.equal(contact.length,1);
  assert.deepEqual([contact[0]!.x1,contact[0]!.y1,contact[0]!.x2,contact[0]!.y2],[4000,0,4500,2000]);
  const free = envelopeGaps(model, model.spaces.get("/L1/a")!).find(s=>s.diagonal && s.edgeOfA === "E")!;
  assert.deepEqual([free.x1,free.y1,free.x2,free.y2],[4500,2000,5000,4000]);
  assert.ok(!checkDiagnostics(model).some(d=>d.code==="GEO02"));
  const collision = parse(text.replace("X1..X1+200","X1..X1+1200"));
  assert.ok(checkDiagnostics(collision).some(d=>d.code==="GEO02"));
});

test("a cell retains its references through canonical and diff, and rejects malformed perimeters", () => {
  const room = (cell: string) => parse(`${grid}\nspace /L1/a cell:${cell}`);
  const a = room(cellA);
  assert.equal(toCanonical(a), toCanonical(room("Y3,D2;Y1,D2;Y1,D1;Y3,D1")));
  assert.equal(toCanonical(a),toCanonical(room("D2,Y3;D2,Y1;D1,Y1;D1,Y3")));
  assert.equal(semanticDiff(a,room(cellB)).spaces.changed.length,1);
  assert.throws(()=>room("D1,Y1;D2,Y3;D2,Y1;D1,Y3"));
  assert.throws(()=>room("D1,Y1;D2,Y1;D2,Y2;D2,Y3;D1,Y3"));
  assert.ok(areaM2(room("D1,Y1;D2,Y1;D2,Y3;X1+2300,Y2;D1,Y3").spaces.get("/L1/a")!)! > 0);
  assert.throws(()=>parse(`${grid}\nspace /L1/a X1..X2 Y1..Y3 cell:${cellA}`));
  assert.throws(()=>parse("muro 1.7\ngrid X 0 100\ngrid Y 0 100\nspace /a cell:X1,Y1;X2,Y1;X1,Y2"));
});

test("openings on a shallow oblique wall are checked by their distance along the wall", () => {
  const text = `muro 1.8
grid X 0 3600
grid Y 0 720 3720
axis F X1,Y1 X2,Y2
level L1 0 h:2700 slab:180
space /L1/room cell:X1,F;X2,F;X2,Y3;X1,Y3 level:L1
space /out outside:1
boundary /L1/room /out edge:S
  door w:1600 at:0.31
  window w:850 at:0.79`;
  const codes = (source:string) => checkDiagnostics(parse(source)).filter(d=>d.code==="OPN02");
  assert.equal(codes(text).length,0);
  assert.equal(codes(text.replace("at:0.79","at:0.55")).length,1);
});

test("the open leaf falls into the requested triangle when its diagonal bisects the bounding box", () => {
  const model = parse(`${grid}
space /L1/a cell:X1,Y1;X2,Y1;X2,Y3
space /L1/b cell:X1,Y1;X2,Y3;X1,Y3
boundary /L1/a /L1/b
  door w:900 at:0.5 swing:a`);
  const { leaf } = derive(model).openings[0]!.swing!;
  assert.ok(leaf.y < leaf.x);
});

test("the same axis-aligned lift returns identical geometry when allocated with a cell", () => {
  const base = `${grid}
level L2 3100 h:2700 slab:180
space /L1/lift lift X1..X2 Y1..Y2 lift:1
space /L2/lift lift X1..X2 Y1..Y2`;
  const cells = base.replaceAll("X1..X2 Y1..Y2","cell:X1,Y1;X2,Y1;X2,Y2;X1,Y2");
  const rect = derive(parse(base)), cell = derive(parse(cells));
  assert.ok(rect.runs.length > 0);
  assert.deepEqual(cell.runs,rect.runs);
});

const skewGrid = `muro 1.8
grid X 1000 5000 9000
grid Y 500 4500 8500 slope:1/5
level L1 0 h:2600 slab:200
level L2 3100 h:2600 slab:200`;

test("range unions follow the Y line through X1, leave the L notch open and meet the real walls", () => {
  const model = parse(`${skewGrid}
space /L1/L X1..X3 Y1..Y2 + X2..X3 Y2..Y3
space /L1/garden X1..X2 Y2..Y3 outside:1
space /out outside:1
boundary /L1/L /out edge:S
  window w:1000 h:1200 at:X2+300
boundary /L1/L /L1/garden edge:W
  door w:900 at:Y2+1200`);
  const form = derive(model);
  const room = form.spaces.find(s => s.path === "/L1/L")!;
  assert.equal(room.areaM2,48);
  const drawn = room.outline.map(ring => ring.map(({x,y})=>[x,y]));
  assert.deepEqual(drawn,[
    [[1000,500],[9000,2100],[9000,6100],[1000,4500]],
    [[5000,5300],[9000,6100],[9000,10100],[5000,9300]],
  ]);
  const slab = form.slabs.filter(s=>s.space===room.path && s.kind==="floor");
  assert.deepEqual(slab.map(s=>s.outline),room.outline);
  const door = form.openings.find(o=>o.kind==="door")!;
  assert.deepEqual([door.cx,door.cy],[5000,6500]);
  const win = form.openings.find(o=>o.kind==="window")!;
  assert.ok(Math.hypot(win.cx-5300,win.cy-1360)<1e-6);
  assert.ok(!checkDiagnostics(model).some(d=>d.severity==="error"));
});

test("an inclined envelope cannot silently become a rectangular stair frame; an explicitly square core works", () => {
  const crooked = parse(`${skewGrid}\nspace /L1/stair X1..X2 Y1..Y2 stair:N`);
  assert.ok(checkDiagnostics(crooked).some(d=>d.code==="RUN03"));
  assert.equal(derive(crooked).runs.length,0);
  const core = parse(`${skewGrid}\nspace /L1/stair cell:X1,Y1;X2,Y1-800;X2,Y2-800;X1,Y2 stair:N`);
  const runs = derive(core).runs;
  assert.equal(runs.length,1);
  assert.deepEqual(runs[0]!.rect,{x1:1000,x2:5000,y1:500,y2:4500});
});

test("a hosted component follows the skewed area but keeps its physical dimensions and world offsets", () => {
  const area = `${skewGrid}
asset WC component w:600 d:600
space /L1/room X1..X3 Y1..Y3
  area X2..X3 Y1..Y2 name:bay asset:WC align-y:min offset-y:400`;
  const form = derive(parse(area));
  const f = form.components![0]!;
  assert.deepEqual(f.centre, {x:7000,y:2460});
  const shifted = derive(parse(area.replace("offset-y:400","offset-y:400 offset-x:300"))).components![0]!;
  assert.deepEqual(shifted.centre, {x:7300,y:2460});
  assert.equal(shifted.footprint[1]!.x-shifted.footprint[0]!.x,600);
  assert.ok(!checkDiagnostics(parse(area)).some(d=>d.code==="SEG02" || d.code==="CMP02"));
});

const mixedGrid = `muro 1.8
grid X 0 4000 8000
grid Y 0 2000 4000 6000 8000
frame AB at:X3,Y4 angle:45 A:0,2000 B:0,2000
frame CD at:X1,Y4 angle:-45 C:0,2000 D:0,2000
level L1 0 slab:180 h:2700
level L2 3000`;
const perimeter = "X1,Y1;X3,Y1;X3,Y2;X2+2000,Y2;X2+2000,Y3;X3,Y3;X3,A1;A1,Y5;C1,Y5;X1,C1";
const inner1 = "X1+1000,Y1+1000 X1+2000,Y1+1000 X1+2000,Y2 X1+1000,Y2";
const inner2 = "X2-1000,Y3+500 X2,Y3+500 X2,Y3+1500 X2-1000,Y3+1500";
const hall = (rings: string[], outer = perimeter) => [
  mixedGrid,
  `space /L1/hall hall cell:${outer} uid:one-hall`,
  ...rings.map(ring => `  hole ${ring}`),
].join("\n");

test("three grid systems bound one concave room with two inner perimeters in plan, section and scene", () => {
  const model = parse(hall([inner1, inner2]) + `
space /L1/core shaft X1+1000..X1+2000 Y1+1000..Y2
space /out outside:1
boundary /L1/hall /L1/core
  door w:800 at:0.5 edge:W
boundary /L1/hall /out`);
  assert.deepEqual(checkDiagnostics(model).filter(d => d.severity === "error"), []);
  const space = model.spaces.get("/L1/hall")!;
  const form = derive(model);
  // An 8 m square, less a 2 m x 2 m recess, two 2 m x 2 m triangular corners and two 1 m holes.
  assert.ok(Math.abs(areaM2(space)! - 54) < 1e-8);
  const floor = sceneOf(form).nodes.filter(n => n.ref === space.path && n.kind === "floor").map(n => n.solid!.ring);
  const plan = form.plans.find(p => p.level === "L1")!.entities
    .filter(e => e.ref === space.path && e.of === "space" && e.class === "cut").map(e => e.polygon!);
  for (const pieces of [floor, plan]) {
    assert.ok(Math.abs(pieces.reduce((a, piece) => a + polygonAreaM2(piece), 0) - 54) < 1e-8);
    for (const [x, y] of [[7000, 3000], [1500, 1500], [3500, 5000], [500, 7500]]) {
      assert.ok(!pieces.some(piece => pointInPolygon({ x: x!, y: y! }, piece, 0)));
    }
  }
  const sides = form.boundaries.filter(b => b.a === space.path || b.b === space.path);
  const perimeterMm = 28000 + 2 * Math.hypot(2000, 2000) + 8000;
  assert.ok(Math.abs(sides.reduce((length, b) => length + segmentLength(b.segment), 0) - perimeterMm) < 1e-6);
  const door = form.openings.find(o => o.kind === "door")!;
  assert.equal(door.w, 800);
  assert.ok(door.cx >= 1000 && door.cx <= 2000 && door.cy >= 1000 && door.cy <= 2000);
  const cut = sectionForm(form, {axis:"Y", at:1500, look:"N"}).entities
    .filter(e => e.ref === space.path && e.of === "slab" && e.kind === "floor" && e.class === "cut");
  const spans = cut.map(e => e.polygon.map(p => p.u));
  assert.ok(Math.abs(spans.reduce((length, us) => length + Math.max(...us) - Math.min(...us), 0) - 7000) < 1e-6);
  assert.ok(spans.every(us => Math.max(...us) <= 1000.001 || Math.min(...us) >= 1999.999));
  const svg = svgPlan(model, {level:"L1"});
  assert.equal((svg.match(/>hall<\/text>/g) ?? []).length, 1);
});

test("hole order, start vertex and winding preserve the canonical form and derived geometry", () => {
  const first = parse(hall([inner1, inner2]));
  const other = parse(hall([inner2.split(" ").reverse().join(" "), inner1], perimeter.split(";").reverse().join(";")));
  assert.equal(toCanonical(first), toCanonical(other));
  assert.deepEqual(derive(first), derive(other));
  assert.deepEqual(semanticDiff(first, other).spaces.changed, []);
  const moved = parse(hall([inner1, inner2.replaceAll("Y3+", "Y3-")]));
  assert.ok(semanticDiff(first, moved).spaces.changed[0]!.fields.some(f => f.field === "hole"));
});

test("a hole is a simple inner perimeter belonging to one room", () => {
  const invalidHole = (ring: string) => () => parse(hall([inner1, ring]));
  assert.throws(invalidHole(inner1), /cell hole/);
  assert.throws(invalidHole(inner1.replaceAll("X1+1000", "X1-1000")), /cell hole/);
  assert.throws(invalidHole(inner1.replaceAll("X1+2000", "X1+2500")), /cell hole/);
  assert.throws(invalidHole(inner2.replaceAll("X2-1000", "X1")), /cell hole/);
  assert.throws(invalidHole("X1,Y1 X1,Y2 X2,Y2 X1,Y2"), /Invalid cell/);
  assert.throws(() => parse(`${mixedGrid}\nspace /L1/hall X1..X2 Y1..Y2\n  hole ${inner1}`), /space with a cell/);
});

test("an absolute frame station selects the sole matching segment that fits the full opening", () => {
  const room = hall([], perimeter.replaceAll("X2+2000", "X2+1000")) + `
space /out outside:1
boundary /L1/hall /out edge:E`;
  for (const kind of ["door", "window", "seg"]) {
    const write = (at: string, width: number) =>
      parse(`${room}\n  ${kind} w:${width} at:${at}`);
    const model = write("B1-600", 500);
    assert.deepEqual(checkDiagnostics(model).filter(d => d.severity === "error"), []);
    const form = derive(model);
    const placed = kind === "seg" ? form.segs[0]! : form.openings[0]!;
    assert.equal(placed.cx, 8000);
    assert.ok(Math.abs(placed.cy - (6000 - 600 * Math.SQRT2)) < 1e-6);

    const ambiguous = kind === "seg" ? "SEG05" : "OPN05";
    for (const [at, w] of [["B1-600", 200], ["B1-9000", 500], ["0.5", 500]] as const)
      assert.ok(checkDiagnostics(write(at, w)).some(d => d.code === ambiguous));
  }
});

test("absolute positions in earlier muro versions retain the segment selection rule", () => {
  const text = `muro 1.7
grid X 0 8000
grid Y 0 2000 4000 6000
level L1 0
space /L1/hall X1..X2 Y1..Y2 + X1..X2-2000 Y2..Y3 + X1..X2 Y3..Y4
space /out outside:1
boundary /L1/hall /out edge:E
  door w:500 at:Y1+1000`;
  assert.ok(checkDiagnostics(parse(text)).some(d => d.code === "OPN05"));
  assert.ok(!checkDiagnostics(parse(text.replace("1.7", "1.8"))).some(d => d.code === "OPN05"));
});
