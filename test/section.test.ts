// The section and the elevation (ADR-0064).
//
// What is held here is the classification, not the drawing. A vertical plane divides the mass into
// what it crossed and what stands behind it, and **that division is derivation's** — the same
// argument docs/why/plan-is-not-a-section.md makes for the horizontal one. If the comparison lived
// on the drawing side, each consumer would pick its own answer for a wall lying in the plane, and
// one source would give two sections.
//
// The numbers below are read off the notation rather than off the implementation. `two-rooms.muro`
// declares `level L1 0 h:2400 slab:150`, a `t:120` partition carrying `door w:780 h:2000`, and
// `t:150` exterior walls carrying `window w:2600 h:1100`. Everything asserted follows from those
// lines and the derivation constants, so a test that fails here is the implementation moving away
// from what the pages say, not a golden going stale.

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { derive } from "../src/core/derive.js";
import { type Edge, gridRef } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import {
  defaultLook,
  elevationForm,
  sectionForm,
  type FormSection,
  type SectionEntity,
} from "../src/core/section.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const form = (file: string) => derive(parseFile(join(root, file)));

const FACES: Edge[] = ["N", "E", "S", "W"];

/** Every bundled entry, so a claim about "any building" is tested against every building we have. */
const ENTRIES = [
  "examples/two-rooms.muro",
  "examples/house/main.muro",
  "examples/office.muro",
  "examples/mansion.muro",
  "examples/basement/main.muro",
  "examples/tower/main.muro",
  "examples/complex/main.muro",
];

const span = (e: SectionEntity, k: "u" | "z"): [number, number] => {
  const v = e.polygon.map((p) => p[k]);
  return [Math.min(...v), Math.max(...v)];
};

const pick = (s: Pick<FormSection, "entities">, cls: string, of: string): SectionEntity[] =>
  s.entities.filter((e) => e.class === cls && e.of === of);

// ---- What the plane cut ----

test("section: the plane cuts the walls where the walls are, and to the heights the walls reach", () => {
  const s = sectionForm(form("examples/two-rooms.muro"), {
    axis: "Y",
    at: 2250,
    atRef: "Y1+2250",
    look: "N",
  });
  const walls = pick(s, "cut", "boundary").map((e) => [...span(e, "u"), ...span(e, "z")]);

  // The `t:120` partition stands on X2 (x 3600) and the door in it rises to 2000, so what the plane
  // meets there is the head wall alone — the hole is in the wall before any drawing starts.
  assert.deepEqual(
    walls.find((w) => w[0] === 3540),
    [3540, 3660, 2000, 2600],
  );
  // The west exterior wall is `t:150` on x 0 and carries no opening on this line: full height,
  // FL to the storey pitch (2400 + ROOF_T 200, there being no level above).
  assert.deepEqual(
    walls.find((w) => w[0] === -75),
    [-75, 75, 0, 2600],
  );
  // The east wall carries `window w:2600 h:1100`. The head aligns at OPENING_HEAD 2000, so the
  // window occupies 900..2000 and the wall survives as a sill below it and a head above it.
  const east = walls.filter((w) => w[0] === 7125).sort((a, b) => a[2]! - b[2]!);
  assert.deepEqual(east, [
    [7125, 7275, 0, 900],
    [7125, 7275, 2000, 2600],
  ]);
});

test("section: the surfaces the level declared are cut at the heights the level declared", () => {
  const s = sectionForm(form("examples/two-rooms.muro"), { axis: "Y", at: 2250, look: "N" });
  const slabs = pick(s, "cut", "slab")
    .filter((e) => e.ref === "/L1/a")
    .map((e) => [e.kind, ...span(e, "z")]);
  assert.deepEqual(slabs.sort((a, b) => (a[1] as number) - (b[1] as number)), [
    ["floor", -150, 0], //   `slab:150` hangs below FL
    ["ceiling", 2370, 2400], // `h:2400`, CEILING_T 30
    ["roof", 2400, 2600], //  nothing above, so ROOF_T 200 sits on the ceiling height
  ]);
});

test("section: a room is cut open to its own ceiling height", () => {
  const s = sectionForm(form("examples/two-rooms.muro"), { axis: "Y", at: 2250, look: "N" });
  const rooms = pick(s, "cut", "space").map((e) => [e.ref, ...span(e, "u"), ...span(e, "z")]);
  assert.deepEqual(rooms, [
    ["/L1/a", 0, 3600, 0, 2400],
    ["/L1/b", 3600, 7200, 0, 2400],
  ]);
});

test("section: a space with no volume to cut produces nothing, and neither does one that is outside", () => {
  // The garden and the yards of the house are semi-outdoor. A storey's ceiling height reaches
  // them, so they carry a z range — but no ceiling is derived over them, and cutting one would
  // paint a garden as a room.
  const s = sectionForm(form("examples/house/main.muro"), { axis: "X", at: 4540, look: "W" });
  const cut = new Set(pick(s, "cut", "space").map((e) => e.ref));
  assert.equal(cut.has("/home/ldk"), true);
  for (const outdoor of ["/site/garden", "/site/west", "/site/east", "/site/north"]) {
    assert.equal(cut.has(outdoor), false, `${outdoor} is not a room and must not be cut open as one`);
  }
});

test("section: a space is never drawn from outside — a void has no face to see", () => {
  for (const entry of ENTRIES) {
    const f = form(entry);
    const s = sectionForm(f, { axis: "X", at: 0, look: "W" });
    assert.deepEqual(
      pick(s, "beyond", "space"),
      [],
      `${entry}: a space is air, so there is nothing of it to see behind the plane`,
    );
  }
});

// ---- The frame ----

test("section: on the default look, u is the world coordinate along the cut line", () => {
  // The rule that decides the default. A dimension taken off the plan carries into the section
  // without being reversed; looking the other way mirrors the sheet, so it has to be asked for.
  const f = form("examples/two-rooms.muro");
  const west = (look: Edge): [number, number] =>
    span(
      pick(sectionForm(f, { axis: "Y", at: 2250, look }), "cut", "boundary").find(
        (e) => span(e, "z")[1] === 2600 && span(e, "u")[1] - span(e, "u")[0] === 150,
      )!,
      "u",
    );
  assert.equal(defaultLook("Y"), "N");
  assert.deepEqual(west("N"), [-75, 75]); // the wall on x 0, read as x
  assert.deepEqual(west("S"), [-75, 75]); // and mirrored, which for a wall on the origin is itself

  // A wall away from the origin shows the mirror plainly: X3 stands at x 7200.
  const east = (look: Edge): [number, number] => {
    const s = sectionForm(f, { axis: "Y", at: 2250, look });
    const e = pick(s, "cut", "boundary").filter((x) => span(x, "z")[1] === 2600);
    return span(e.sort((a, b) => span(a, "u")[0] - span(b, "u")[0])[look === "N" ? e.length - 1 : 0]!, "u");
  };
  assert.deepEqual(east("N"), [7125, 7275]);
  assert.deepEqual(east("S"), [-7275, -7125]);
});

test("section: looking along the plane instead of across it is refused, not answered", () => {
  assert.throws(
    () => sectionForm(form("examples/two-rooms.muro"), { axis: "X", at: 3600, look: "N" }),
    /runs along the X plane rather than across it/,
  );
});

test("section: an axis-parallel directed line gives the same classified entities as the axis form", () => {
  const f = form("examples/two-rooms.muro");
  const axis = sectionForm(f, { axis: "Y", at: 2250, look: "N" });
  const line = sectionForm(f, { cut: { x1: 0, y1: 2250, x2: 7200, y2: 2250 } });
  assert.deepEqual(line.entities, axis.entities);
});

test("section: a directed oblique line cuts in its own metric frame", () => {
  const f = form("examples/two-rooms.muro");
  const cut = { x1: 0, y1: 1000, x2: 7200, y2: 3500 };
  const s = sectionForm(f, { cut });
  const room = pick(s, "cut", "space");
  assert.ok(room.length >= 2, "the oblique line crosses both rooms");
  assert.deepEqual(span(room[0]!, "z"), [0, 2400]);
  const allU = room.flatMap((e) => e.polygon.map((p) => p.u));
  assert.ok(Math.abs(Math.min(...allU)) < 1e-9, "u starts at the first point of the directed line");
  assert.ok(
    Math.abs(Math.max(...allU) - Math.hypot(cut.x2 - cut.x1, cut.y2 - cut.y1)) < 1e-9,
    "u is distance along the directed line",
  );
});

test("section: a directed line with no direction is refused", () => {
  const f = form("examples/two-rooms.muro");
  assert.throws(
    () => sectionForm(f, { cut: { x1: 100, y1: 200, x2: 100, y2: 200 } }),
    /needs two distinct points/,
  );
});

// ---- The elevation ----

test("elevation: the plane misses the mass, so it cuts nothing — on every face of every building", () => {
  // The claim is a consequence of where the plane sits, not a branch in the code, so it is tested
  // as one: every bundled entry, all four faces, no `cut` entity anywhere.
  for (const entry of ENTRIES) {
    const f = form(entry);
    for (const face of FACES) {
      const s = elevationForm(f, face);
      assert.deepEqual(
        s.entities.filter((e) => e.class === "cut"),
        [],
        `${entry} from ${face}: an elevation cuts nothing`,
      );
      assert.ok(s.entities.length > 0, `${entry} from ${face}: there is a building to see`);
    }
  }
});

test("elevation: standing to the south means looking north", () => {
  const s = elevationForm(form("examples/two-rooms.muro"), "S");
  assert.equal(s.look, "N");
  assert.equal(s.axis, "Y");
  // The plane sits at the near extreme: the outer face of the south wall, `t:150` on y 0.
  assert.equal(s.at, -75);
});

test("elevation: an opening is a hole in the wall face, with no operation that cuts one", () => {
  // ADR-0026 recorded that openings do not read as holes in a wall face, and said it would be paid
  // for when elevations arrived. It is paid by the derivation rather than by the drawing: a wall
  // arrives as the run of intervals its openings split it into, so the gap is already there.
  const s = elevationForm(form("examples/two-rooms.muro"), "S");
  // The south wall of /L1/b carries `door w:900 h:2100` and `window w:2600 h:1100`.
  const face = pick(s, "beyond", "boundary").filter((e) => e.ref.startsWith("/L1/b|/out"));
  const heights = face.map((e) => span(e, "z"));
  // Somewhere along that wall the matter stops at the door head and starts again above it.
  assert.ok(
    heights.some(([z0, z1]) => z0 === 2100 && z1 === 2600),
    `a head wall above the 2100 door: ${JSON.stringify(heights)}`,
  );
  // And the leaf itself is drawn into the gap, as its own subject.
  const door = pick(s, "beyond", "opening").find((e) => e.ref.startsWith("/L1/b|/out") && e.kind === "door");
  assert.ok(door, "the entrance door is there to be seen");
  assert.deepEqual(span(door, "z"), [0, 2100]); // `door w:900 h:2100` rises from the floor
});

// ---- The sloped body ----

test("section: a ramp cut along its rise leans, and cut across it lies level", () => {
  // The one body in a `Form` whose height varies over its own footprint. Reading the height **at
  // the crossing** — off the edge it sits on — rather than at the corners of the whole piece is
  // what makes both of these come out right, and it is why `crossing` returns an edge and a
  // parameter rather than a coordinate alone.
  const f = form("examples/basement/main.muro");
  const ramp = f.runs.find((r) => r.path === "/B1/ramp");
  assert.ok(ramp, "the basement has a car ramp");
  assert.equal(ramp.up, "E"); // it travels along +X, so its height varies with x

  // A plane of constant x meets the ramp at one point of its travel, so the cut is level.
  const across = sectionForm(f, { axis: "X", at: (ramp.rect.x1 + ramp.rect.x2) / 2, look: "W" });
  const level = pick(across, "cut", "run").filter((e) => e.ref === ramp.path);
  assert.ok(level.length > 0, "the plane meets the ramp");
  for (const e of level) {
    const zs = e.polygon.map((p) => p.z);
    assert.equal(new Set(zs).size, 2, `across the rise a run body has one bottom and one top: ${JSON.stringify(zs)}`);
  }

  // A plane of constant y runs the length of the travel, so the cut leans by the whole rise.
  // `form:return` puts the two flights side by side across the width, so the middle of the ramp is
  // the line between them and meets only the landing — this cuts through one flight.
  const along = sectionForm(f, { axis: "Y", at: ramp.rect.y1 + ramp.width / 4, look: "N" });
  const flight = pick(along, "cut", "run")
    .filter((e) => e.ref === ramp.path)
    .map((e) => span(e, "z"))
    .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  assert.ok(flight, "the plane meets a flight");
  // The flight of `/B1/ramp` rises 1850 (half of the 3700 storey, the run being a return), and the
  // inclined slab is SLAB_T 200 thick, so the cut spans exactly the one plus the other.
  assert.equal(flight[1] - flight[0], 1850 + 200);
});

// ---- Determinism ----

test("section: the same Form and the same plane give the same bytes", () => {
  const f = form("examples/house/main.muro");
  const spec = { axis: "X", at: 4540, atRef: "X2+900", look: "W" } as const;
  assert.equal(JSON.stringify(sectionForm(f, spec)), JSON.stringify(sectionForm(f, spec)));
});

test("section: shape is a function of the canonical form, and so is the section of it", () => {
  // The discipline test/uniqueness.test.ts keeps: **establish that the canonical forms are equal
  // first**, so that if the premise collapses the pair is reported as proving nothing.
  const base = `muro 1.3
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
`;
  const written = parse(base + "boundary /L1/a /L1/b t:120\nboundary /L1/a /out\nboundary /L1/b /out\n");
  const swapped = parse(base + "boundary /L1/b /L1/a t:120\nboundary /L1/b /out\nboundary /L1/a /out\n");
  const spec = { axis: "Y", at: 2250, look: "N" } as const;
  const a = sectionForm(derive(written), spec);
  const b = sectionForm(derive(swapped), spec);
  // The a/b order of a boundary and the order the boundaries were written are both information the
  // canonical form discards, so the shapes must agree — the section included.
  assert.equal(JSON.stringify(a.entities.length), JSON.stringify(b.entities.length));
  assert.deepEqual(
    a.entities.map((e) => [e.class, e.of, e.polygon]).sort(),
    b.entities.map((e) => [e.class, e.of, e.polygon]).sort(),
  );
});

test("section: it reads a Form and nothing else", () => {
  // A JSON round-trip strips every reference the `Form` did not carry as data. Passing proves the
  // derivation reached for no `Model`, which is what keeps it unable to invent shape.
  const f = form("examples/office.muro");
  const spec = { axis: "X", at: 0, look: "W" } as const;
  assert.deepEqual(sectionForm(JSON.parse(JSON.stringify(f)), spec), sectionForm(f, spec));
});

// ---- The grid reference ----

test("the grid reference of a cut resolves through the same function the source uses", () => {
  const m = parseFile(join(root, "examples/two-rooms.muro"));
  assert.deepEqual(gridRef(m, "X2"), { axis: "X", coord: 3600 });
  assert.deepEqual(gridRef(m, "X2+450"), { axis: "X", coord: 4050 });
  assert.deepEqual(gridRef(m, "Y2-600"), { axis: "Y", coord: 3900 });
  // A spelling the notation does not accept is not a position, and neither is an undeclared line.
  assert.equal(gridRef(m, "X9"), undefined);
  assert.equal(gridRef(m, "1800"), undefined);
  assert.equal(gridRef(m, "X2+600.5"), undefined);
});

// ---- What every entity must carry ----

test("section: every entity names its subject and says how far behind the plane it stands", () => {
  for (const entry of ENTRIES) {
    const f = form(entry);
    const s = sectionForm(f, { axis: "X", at: 0, look: "E" });
    for (const e of s.entities) {
      assert.ok(e.ref.length > 0, `${entry}: an entity carries the identity of its subject`);
      assert.ok(e.polygon.length >= 3, `${entry}: ${e.ref} has a shape`);
      assert.ok(Number.isFinite(e.depth), `${entry}: ${e.ref} has a distance`);
      if (e.class === "cut") assert.equal(e.depth, 0, `${entry}: what the plane cut is at the plane`);
      else assert.ok(e.depth >= -1, `${entry}: ${e.ref} stands behind the plane, not in front of it`);
    }
  }
});

// ---- What the review found ----

test("section: a body no wider than the tolerance is still cut by a plane through it", () => {
  // The classification asks which side a body is **wholly** on. Asking instead how far it reaches
  // past the plane needs more than the tolerance on both sides, which a body no wider than the
  // tolerance can never give — and `t:1` is a model `check` passes without a word.
  const m = parse(`muro 1.3
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:1
boundary /L1/a /out
boundary /L1/b /out
`);
  const f = derive(m);
  const thin = f.boundaries.find((b) => b.a === "/L1/a" && b.b === "/L1/b")!;
  assert.equal(thin.material?.t, 1);
  const s = sectionForm(f, { axis: "X", at: 3600, look: "W" });
  const mine = s.entities.filter((e) => e.ref === thin.ref);
  assert.deepEqual(
    mine.map((e) => e.class),
    ["cut"],
    "the plane goes straight through it, so it is cut and not something standing behind",
  );
});

test("section: what stands behind the plane is never a negative distance from it", () => {
  // A face within the tolerance of the plane counts as on it, so the nearest point of a body can
  // measure a hair negative. `depth` is documented as a distance behind the plane.
  for (const entry of ENTRIES) {
    const f = form(entry);
    for (const spec of [
      { axis: "X", at: 0, look: "E" } as const,
      { axis: "Y", at: 0, look: "N" } as const,
    ]) {
      for (const e of sectionForm(f, spec).entities) {
        assert.ok(e.depth >= 0, `${entry}: ${e.ref} reports depth ${e.depth}`);
      }
    }
  }
});
