// Wall joins — the corners of a junction are closed by the derivation, and by nothing else.
//
// A boundary segment is a centre line, so thickening it about that line leaves the corner of a
// junction empty. This file holds the two halves of what joining means, and they pull against
// each other: **no gap** (the outer corner of every junction is covered by some wall) and **no
// overlap** (the bodies meeting there still add up to their union — they touch, they are not
// merged, and neither is a wall that lost its end swallowed by the one that won).
//
// The population of the second half is every wall of a level at once, so a body that grew into a
// wall on the other side of the building would fail it just as loudly as one that grew into its
// own neighbour. It is asserted of the fixtures here, where every wall meets on an axis and rises
// to the same height — **the two places the cut deliberately gives way to an overlap** are a
// winner that does not reach the top of what it cuts, and two losing ends leaning the same way,
// and both are cases where the alternative to overlapping is a hole.

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive, type Form } from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { areaOf, pointIn, unionArea } from "../src/core/poly.js";
import type { Pt } from "../src/core/model.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Every wall body of one level: the resolved footprint of every interval */
function footprints(form: Form, level: string): Pt[][] {
  const out: Pt[][] = [];
  for (const b of form.boundaries) {
    if (!b.material || b.level !== level) continue;
    for (const p of b.material.panels) out.push(p.footprint);
  }
  return out;
}

/**
 * The centre of the square outside a junction of two wall ends — the piece that belongs to
 * neither wall when nothing joins them. One sample per pair of ends that meet at an angle.
 */
function outerCorners(form: Form): Array<{ level: string; at: Pt }> {
  interface End {
    at: Pt;
    /** the direction into the wall */
    into: Pt;
    t: number;
  }
  const byNode = new Map<string, End[]>();
  for (const b of form.boundaries) {
    if (!b.material) continue;
    const s = b.segment;
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len === 0) continue;
    const u = { x: (s.x2 - s.x1) / len, y: (s.y2 - s.y1) / len };
    const ends: End[] = [
      { at: { x: s.x1, y: s.y1 }, into: u, t: b.material.t },
      { at: { x: s.x2, y: s.y2 }, into: { x: -u.x, y: -u.y }, t: b.material.t },
    ];
    for (const e of ends) {
      const k = `${b.level ?? ""}#${Math.round(e.at.x)}|${Math.round(e.at.y)}`;
      byNode.set(k, [...(byNode.get(k) ?? []), e]);
    }
  }
  const out: Array<{ level: string; at: Pt }> = [];
  for (const [k, ends] of byNode) {
    const level = k.slice(0, k.indexOf("#"));
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const a = ends[i]!;
        const b = ends[j]!;
        // Running along each other, there is no outer corner to close
        if (Math.abs(a.into.x * b.into.y - a.into.y * b.into.x) < 0.2) continue;
        out.push({
          level,
          at: {
            x: a.at.x - a.into.x * (b.t / 4) - b.into.x * (a.t / 4),
            y: a.at.y - a.into.y * (b.t / 4) - b.into.y * (a.t / 4),
          },
        });
      }
    }
  }
  return out;
}

function assertClosed(form: Form, what: string): void {
  const corners = outerCorners(form);
  assert.ok(corners.length > 0, `${what}: the model has junctions to look at`);
  const open = corners.filter(
    (c) => !footprints(form, c.level).some((f) => pointIn(c.at, f, 0.01)),
  );
  assert.deepEqual(
    open.map((c) => `${c.level} (${Math.round(c.at.x)}, ${Math.round(c.at.y)})`),
    [],
    `${what}: a junction is left open`,
  );
}

function assertNoOverlap(form: Form, what: string): void {
  for (const l of form.levels) {
    const f = footprints(form, l.name);
    if (f.length === 0) continue;
    assert.ok(
      Math.abs(areaOf(f) - unionArea(f)) < 1,
      `${what}: the wall bodies of ${l.name} overlap — they were joined into one another, not against one another`,
    );
  }
}

// ---- One room: the four walls tile the ring ------------------------------

const ROOM = `muro 1.3
grid X 0 4000
grid Y 0 3000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
`;

test("wall join: the four walls of a rectangular room tile the ring exactly — no corner gap, no corner overlap", () => {
  const form = derive(parse(ROOM));
  const f = footprints(form, "L1");
  assert.equal(f.length, 4, "one body per side");

  // The ring the four walls stand in: 100mm thick, half in and half out of the centre lines
  const ring = 4100 * 3100 - 3900 * 2900;
  assert.equal(areaOf(f), ring, "the four bodies add up to the ring");
  assert.equal(unionArea(f), ring, "and they cover it without overlapping");

  // Each outer corner belongs to exactly one of them
  for (const c of [
    { x: -25, y: -25 },
    { x: 4025, y: -25 },
    { x: -25, y: 3025 },
    { x: 4025, y: 3025 },
  ]) {
    assert.equal(
      f.filter((q) => pointIn(c, q, 0.01)).length,
      1,
      `the corner (${c.x}, ${c.y}) belongs to exactly one wall`,
    );
  }
});

test("wall join: the centre line of an interval is untouched — only the body moves", () => {
  const form = derive(parse(ROOM));
  const south = form.boundaries.find((b) => b.segment.y1 === 0 && b.segment.y2 === 0)!;
  const p = south.material!.panels[0]!;
  assert.deepEqual(
    [p.x1, p.y1, p.x2, p.y2],
    [0, 0, 4000, 0],
    "the interval still runs from one end of the segment to the other",
  );
  // ...and the body it carries does not: it runs on to the outer face of the wall it won against
  assert.deepEqual(
    p.footprint.map((q) => [q.x, q.y]),
    [
      [50, 50],
      [4050, 50],
      [4050, -50],
      [50, -50],
    ],
    "the body stops at the west wall's face and runs through the east corner",
  );
});

// ---- T junction ----------------------------------------------------------

const TEE = `muro 1.3
grid X 0 4000 8000
grid Y 0 3000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:200
boundary /L1/a /out
boundary /L1/b /out
`;

test("wall join: a T junction closes, and the thicker wall is the one that runs through", () => {
  const form = derive(parse(TEE));
  assertClosed(form, "T junction");
  assertNoOverlap(form, "T junction");

  const partition = form.boundaries.find((b) => b.a === "/L1/a" && b.b === "/L1/b")!;
  const body = partition.material!.panels[0]!.footprint;
  const ys = body.map((p) => p.y);
  const xs = body.map((p) => p.x);
  assert.equal(Math.min(...ys), -50, "the 200mm partition runs through to the outer face of the 100mm wall");
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [3900, 4100], "and keeps its own thickness doing it");

  // The wall that lost stops at the partition's face rather than crossing it
  const south = form.boundaries.filter((b) => b.material && b.segment.y1 === 0 && b.segment.y2 === 0);
  assert.equal(south.length, 2, "the south wall arrives as two segments, one either side");
  const reach = south.flatMap((b) => b.material!.panels.flatMap((p) => p.footprint.map((q) => q.x)));
  assert.equal(reach.filter((x) => x > 3900 && x < 4100).length, 0, "neither of them enters the partition");
});

// ---- Cross junction ------------------------------------------------------

const CROSS = `muro 1.3
grid X 0 4000 8000
grid Y 0 3000 6000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/c room X1..X2 Y2..Y3
space /L1/d room X2..X3 Y2..Y3
space /out outside:1
boundary /L1/a /out
boundary /L1/b /out
boundary /L1/c /out
boundary /L1/d /out
`;

test("wall join: four partitions meeting at a point close into a cross", () => {
  const form = derive(parse(CROSS));
  assertClosed(form, "cross");
  assertNoOverlap(form, "cross");
});

// ---- The shape is a function of the canonical form -----------------------

const REORDERED = `muro 1.3
grid X 0 4000 8000
grid Y 0 3000
level L1 0 h:2400
space /out outside:1
space /L1/b room X2..X3 Y1..Y2
space /L1/a room X1..X2 Y1..Y2
boundary /L1/b /out
boundary /L1/a /out
boundary /L1/a /L1/b t:200
`;

test("wall join: the join reads no declaration order — the same building joins the same way", () => {
  const a = derive(parse(TEE));
  const b = derive(parse(REORDERED));
  const key = (f: Form) =>
    f.boundaries
      .filter((x) => x.material)
      .map((x) => `${x.ref} ${x.material!.panels.map((p) => p.footprint.map((q) => `${q.x},${q.y}`).join(" ")).join(" | ")}`)
      .sort();
  assert.deepEqual(key(b), key(a));
});

// ---- Openings ------------------------------------------------------------

const WITH_DOOR = `muro 1.3
grid X 0 4000 8000
grid Y 0 3000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b
  door w:900
boundary /L1/a /out
boundary /L1/b /out
`;

test("wall join: an opening keeps its place and its width — the join moves ends, not holes", () => {
  const form = derive(parse(WITH_DOOR));
  const door = form.openings[0]!;
  assert.deepEqual([door.cx, door.cy, door.w], [4000, 1500, 900], "the door sits where it was placed");

  const partition = form.boundaries.find((b) => b.a === "/L1/a" && b.b === "/L1/b")!;
  const panels = partition.material!.panels;
  assert.equal(panels.length, 3, "the door splits the partition into a full-height piece, a head wall and another full-height piece");
  // The hole is still exactly the door: the centre lines meet at the jambs
  assert.deepEqual(
    panels.map((p) => [p.y1, p.y2]),
    [
      [0, 1050],
      [1050, 1950],
      [1950, 3000],
    ],
  );
  assertClosed(form, "with a door");
  assertNoOverlap(form, "with a door");
});

// ---- A cut reaches only as high as the wall that made it -----------------

const RAIL_AND_WALL = `muro 1.3
grid X 0 4000 8000
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/deck terrace X2..X3 Y1..Y2 outside:1
space /out outside:1
boundary /L1/a /L1/deck t:50
boundary /L1/deck /out air:1 t:80
`;

test("wall join: a rail that wins a junction takes no slice out of a wall above its own top", () => {
  const form = derive(parse(RAIL_AND_WALL));
  assert.deepEqual(
    checkDiagnostics(parse(RAIL_AND_WALL)).filter((d) => d.severity === "error"),
    [],
    "the fixture is a building koyu accepts",
  );
  const rail = form.boundaries.find((b) => b.air)!;
  const wall = form.boundaries.find((b) => b.material && !b.air)!;
  assert.ok(rail.material!.t > wall.material!.t, "the rail is the thicker of the two, so it wins the election");
  assert.ok(rail.material!.z1 < wall.material!.z1, "and it stops far below the top of the wall");

  // Cutting the wall back at both ends would leave a 40mm notch running from the top of the rail
  // to the top of the wall, because there is no rail up there to fill it
  for (const p of wall.material!.panels) {
    const ys = p.footprint.map((q) => q.y);
    assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 4000], "the wall keeps its whole body");
  }
  assertClosed(form, "a rail meeting a thinner wall");
});

// ---- Every bundled building ---------------------------------------------

test("wall join: no bundled building is left with an open corner", () => {
  for (const f of [
    "examples/two-rooms.muro",
    "examples/office.muro",
    "examples/house/main.muro",
    "examples/mansion.muro",
    "examples/basement/main.muro",
    "examples/tower/main.muro",
    "examples/complex/main.muro",
  ]) {
    assertClosed(derive(parseFile(join(root, f))), f);
  }
});
