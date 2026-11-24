import assert from "node:assert/strict";
import { test } from "node:test";
import { derive, runPrism } from "../src/core/derive.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { pointInPolygon, toCanonical, type Pt } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { planMarks, sceneOf } from "../src/draw/index.js";

const source = `muro 1.8
grid X 0 8000
grid Y 0 5000
frame AB at:X2,Y2 angle:20 A:0,3000,6000 B:0,5600,8600
level L1 0 h:2600 slab:200
level L2 3200 h:2600 slab:200
level L3 6400 h:2600 slab:200
space /L1..L2/stair stair A1..A2 B1..B2 stair:N form:return entry:1000 landing:1400 flights:A1..A1+1300,A1+1600..A2
space /L3/stair stair A1..A2 B1..B2
stack stair L1..L3 type:stair
space /L1..L2/lift shaft A2..A3 B1..B2 lift:1
stack lift L1..L2 type:shaft
space /L1..L2/landing lobby A1..A3 B2..B3
boundary /L1/stair /L1/landing
  door w:900 at:A1+1500
boundary /L1/lift /L1/landing
  door w:900 at:A2+1500`;

// Independent reference transform, with its origin translated away from world XY.
const c = Math.cos(Math.PI / 9), s = Math.sin(Math.PI / 9);
const toWorld = (a:number, b:number) => ({x:8000+c*a-s*b, y:5000+s*a+c*b});
const near = (a:Pt,b:Pt) => assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-6, JSON.stringify({a,b}));

test("frame ranges keep dimensions and rotate the stair flights, landing, lift, openings and plan traces as one", () => {
  const model = parse(source);
  assert.deepEqual(checkDiagnostics(model).filter(d=>d.severity==="error"),[]);
  const form = derive(model);
  const stair = form.runs.find(r=>r.path==="/L1/stair")!;
  const space = form.spaces.find(s=>s.path===stair.path)!;
  assert.equal(space.areaM2,16.8);
  assert.equal(stair.length,5600);
  assert.equal(stair.width,3000);
  assert.deepEqual(stair.parts.map(p=>p.kind),["flight","landing","flight"]);
  assert.deepEqual(stair.parts.filter(p=>p.kind==="flight").map(p=>p.s1-p.s0),[1300,1400]);
  near(stair.outline![0]!,toWorld(0,0));
  near(stair.parts[1]!.outline![0]!,toWorld(0,4200));
  assert.equal(stair.parts[1]!.z0,1600);
  assert.equal(stair.parts[2]!.z0,3200);
  const landing = stair.solids.find(o=>o.kind==="box" && o.z1===1600)!;
  near(runPrism(landing).poly[1]!,toWorld(3000,4200));
  const lift = form.runs.find(r=>r.path==="/L1/lift")!;
  near(runPrism(lift.solids[0]!).poly[0]!,toWorld(3300,300));
  const door = form.openings.find(o=>o.a===stair.path)!;
  near({x:door.cx,y:door.cy},toWorld(1500,5600));
  const shape = space.outline[0]!;
  for(const solid of sceneOf(form).nodes.filter(n=>n.of==="run"&& n.ref===stair.path)) {
    assert.ok(solid.solid!.ring.every(p=>pointInPolygon(p,shape,1)));
  }
  const marks = planMarks(form,"L2");
  for(const path of ["/L1/stair","/L2/stair"]){
    const parts = marks.filter(m=>m.of==="run" && m.ref===path && m.lines?.length);
    assert.ok(parts.length>0,path);
    assert.ok(parts.flatMap(m=>m.lines!).every(l=>pointInPolygon({x:l.x1,y:l.y1},shape,1) && pointInPolygon({x:l.x2,y:l.y2},shape,1)));
  }
});

test("range unions retain their frame, and a mixed-frame overlap is tested in world coordinates", () => {
  const grid = source.slice(0,source.indexOf("space"));
  const a = parse(grid+"space /L1/ell A1..A3 B1..B2 + A1..A2 B2..B3");
  const b = parse(grid+"space /L1/ell B2..B3 A2..A1 + B2..B1 A3..A1");
  assert.equal(toCanonical(a),toCanonical(b));
  assert.equal(derive(a).spaces[0]!.areaM2,42.6);
  const mixed = parse(grid+"space /L1/two X1..X2 Y1..Y2 + A1..A2 B1..B2");
  assert.ok(!checkDiagnostics(mixed).some(d=>d.code==="GEO01"));
  assert.throws(()=>parse(grid+"space /L1/invalid X1..X2 B1..B2"));
});

test("a fixture aligned within an AB area keeps its size and turns with the room", () => {
  const grid=source.slice(0,source.indexOf("space"));
  const model=parse(grid+`asset WC component w:600 d:800
space /L1/bath A1..A2 B1..B2
  area A1..A1+2000 B1..B1+2000 name:wc asset:WC align-x:min align-y:min`);
  const fixture=derive(model).components![0]!;
  near(fixture.centre,toWorld(300,400));
  near(fixture.footprint[0]!,toWorld(0,0));
  near(fixture.footprint[1]!,toWorld(600,0));
  assert.equal(fixture.rotation,20);
  assert.ok(!checkDiagnostics(model).some(d=>["CMP02","SEG02"].includes(d.code)));
});
