// Scoring for the W3 control group — oracles over an edited `building.json`.
//
// The muro side is scored by `eval/score.ts`, whose oracles run against the composed model. The
// control has no model, so its oracles run against the JSON. Four of them are generic and one is
// per task.
//
//   1. schema      — schema.json (structure and types)
//   2. refs        — referential integrity, which JSON Schema cannot express
//   3. geometry    — rooms on one level do not overlap, rings are simple, openings sit on their wall
//   4. agreement   — **stored derived values still agree with the geometry**
//   5. assert      — the task's own claim, written over the JSON
//
// **(4) is the headline number of the experiment.** In muro nothing derived is stored, so it cannot
// break; in the control every stored area, storey height and group total is a fact that an edit can
// leave behind. The plan predicts that when an agent misses one, nothing says so — this oracle is
// what turns that silence into a count.
//
// The scorer is allowed to use core's geometry (`src/core/poly.ts`). It measures, it is not the
// subject under test — the control model itself carries none of muro's machinery.

import { readFileSync } from "node:fs";
import type { Pt } from "../../src/core/model.js";
import { areaOf, overlaps } from "../../src/core/poly.js";
import type { JsonBuilding, JsonRoom } from "./export.js";
import { validateBuilding } from "./validate.js";

/** Mirrors `OracleResult` in eval/score.ts so both conditions report the same shape */
export interface ControlOracleResult {
  kind: "schema" | "refs" | "geometry" | "agreement" | "assert";
  label: string;
  pass: boolean;
  detail: string;
}

/** m2, rounded the way muro rounds it, so the two conditions are comparable */
const m2 = (pieces: Pt[][]): number => Math.round((areaOf(pieces) / 1_000_000) * 100) / 100;

const ptsOf = (ring: Array<[number, number]>): Pt[] => ring.map(([x, y]) => ({ x, y }));
const piecesOf = (r: JsonRoom): Pt[][] => r.pieces.map(ptsOf);

/** Area agreement is compared at the same resolution muro reports, plus one cent of slack */
const AREA_EPS = 0.011;
/** Coordinates are integers in mm; anything under half a millimetre is noise */
const MM_EPS = 0.5;

// ---- 1. schema ----

function schemaOracle(b: unknown): ControlOracleResult {
  const errors = validateBuilding(b);
  return {
    kind: "schema",
    label: "the document satisfies schema.json",
    pass: errors.length === 0,
    detail:
      errors.length === 0
        ? "no violation"
        : `${errors.length} violation(s), first: ${errors[0]!.path}: ${errors[0]!.message}`,
  };
}

// ---- 2. refs ----

/**
 * Referential integrity.
 *
 * **JSON Schema cannot express any of this.** A `pattern` can insist that `opening.wall` looks like
 * `W004`; nothing in the schema language can insist that W004 exists. In muro the same class of
 * mistake is a diagnostic (REF01 and its family), because a relation names its ends.
 */
function refsOracle(b: JsonBuilding): ControlOracleResult {
  const problems: string[] = [];
  const roomIds = new Set(b.rooms.map((r) => r.id));
  const wallIds = new Set(b.walls.map((w) => w.id));
  const levels = new Set(b.levels.map((l) => l.name));

  const dup = (what: string, ids: string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`the ${what} id ${id} appears twice`);
      seen.add(id);
    }
  };
  dup("room", b.rooms.map((r) => r.id));
  dup("wall", b.walls.map((w) => w.id));
  dup("opening", b.openings.map((o) => o.id));
  dup("group", b.groups.map((g) => g.id));

  for (const o of b.openings) {
    if (!wallIds.has(o.wall)) problems.push(`the opening ${o.id} names the wall ${o.wall}, which does not exist`);
  }
  for (const w of b.walls) {
    // A side may name a room, or a space with no region of its own (the exterior, a road).
    // Those carry no geometry, so the only thing checkable is that the spelling did not rot into
    // a room id that no longer exists.
    for (const side of w.sides) {
      if (side.startsWith("/out") || side.startsWith("/road") || side.startsWith("/site")) continue;
      if (!roomIds.has(side)) problems.push(`the wall ${w.id} names the room ${side}, which does not exist`);
    }
    if (w.level !== undefined && !levels.has(w.level)) {
      problems.push(`the wall ${w.id} names the level ${w.level}, which does not exist`);
    }
  }
  for (const r of b.rooms) {
    if (r.level !== undefined && !levels.has(r.level)) {
      problems.push(`the room ${r.id} names the level ${r.level}, which does not exist`);
    }
  }
  for (const g of b.groups) {
    if (!b.rooms.some((r) => r.id.startsWith(`${g.id}/`))) {
      problems.push(`the group ${g.id} holds no room`);
    }
  }

  return {
    kind: "refs",
    label: "every reference names something that exists",
    pass: problems.length === 0,
    detail: problems.length === 0 ? "no dangling reference" : `${problems.length}: ${problems.slice(0, 3).join("; ")}`,
  };
}

// ---- 3. geometry ----

/**
 * Geometric consistency.
 *
 * Two rooms on one level may not overlap, a ring must be a real polygon, and an opening must sit on
 * the wall it names. In muro these are GEO02, the region grammar, and OPN — all structural.
 */
function geometryOracle(b: JsonBuilding): ControlOracleResult {
  const problems: string[] = [];

  for (const r of b.rooms) {
    for (const [i, ring] of r.pieces.entries()) {
      if (ring.length < 3) problems.push(`the room ${r.id} piece ${i} has fewer than three points`);
      else if (areaOf([ptsOf(ring)]) < 1) problems.push(`the room ${r.id} piece ${i} has no area`);
    }
  }

  // Overlap is asked per level, and only among rooms that count as indoor floor — the same
  // population muro asks it of.
  const byLevel = new Map<string, JsonRoom[]>();
  for (const r of b.rooms) {
    if (!r.indoor || r.pieces.length === 0) continue;
    const key = r.level ?? "(none)";
    byLevel.set(key, [...(byLevel.get(key) ?? []), r]);
  }
  for (const [level, rooms] of byLevel) {
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (overlaps(piecesOf(rooms[i]!), piecesOf(rooms[j]!))) {
          problems.push(`on ${level} the rooms ${rooms[i]!.id} and ${rooms[j]!.id} overlap`);
        }
      }
    }
  }

  const wallOf = new Map(b.walls.map((w) => [w.id, w]));
  for (const o of b.openings) {
    const w = wallOf.get(o.wall);
    if (w === undefined) continue; // refs already reported it
    const [cx, cy] = o.center;
    const [x1, y1] = w.start;
    const [x2, y2] = w.end;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < MM_EPS) continue;
    // Distance from the centre to the wall's line, and the position along it
    const cross = Math.abs((x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)) / len;
    const along = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / len;
    if (cross > MM_EPS) problems.push(`the opening ${o.id} is ${cross.toFixed(1)}mm off the wall ${o.wall}`);
    else if (along - o.width / 2 < -MM_EPS || along + o.width / 2 > len + MM_EPS) {
      problems.push(`the opening ${o.id} runs past the end of the wall ${o.wall}`);
    }
  }

  return {
    kind: "geometry",
    label: "rooms do not overlap and every opening sits on its wall",
    pass: problems.length === 0,
    detail: problems.length === 0 ? "geometrically consistent" : `${problems.length}: ${problems.slice(0, 3).join("; ")}`,
  };
}

// ---- 4. agreement ----

/**
 * Whether the stored derived values still agree with the geometry.
 *
 * **This is the measure the experiment exists for.** Every one of these numbers is derived in muro
 * and therefore cannot disagree with anything; in the control each is a stored fact that an edit
 * can leave stale, and nothing in the JSON stack says so. A failure here is a **silent** failure:
 * the document is schema-valid, every reference resolves, the geometry is consistent, and the
 * building still says something false about itself.
 */
function agreementOracle(b: JsonBuilding): ControlOracleResult {
  const problems: string[] = [];

  for (const r of b.rooms) {
    if (r.areaM2 === undefined || r.pieces.length === 0) continue;
    const computed = m2(piecesOf(r));
    if (Math.abs(computed - r.areaM2) > AREA_EPS) {
      problems.push(`the room ${r.id} stores ${r.areaM2}m2 but its pieces measure ${computed}m2`);
    }
  }

  for (const g of b.groups) {
    const members = b.rooms.filter((r) => r.id.startsWith(`${g.id}/`) && r.indoor);
    const computed = Math.round(members.reduce((a, r) => a + m2(piecesOf(r)), 0) * 100) / 100;
    if (Math.abs(computed - g.areaM2) > AREA_EPS) {
      problems.push(`the group ${g.id} stores ${g.areaM2}m2 but its members measure ${computed}m2`);
    }
  }

  // The storey height is the gap to the level above. The topmost level is left alone: muro pins it
  // to the apex of the roof, a rule the control has no reason to know.
  const byZ = [...b.levels].sort((p, q) => p.z - q.z);
  for (const [i, l] of byZ.entries()) {
    const above = byZ[i + 1];
    if (above === undefined || l.storeyHeight === undefined) continue;
    const gap = above.z - l.z;
    if (Math.abs(gap - l.storeyHeight) > MM_EPS) {
      problems.push(`the level ${l.name} stores a storey height of ${l.storeyHeight} but the level above sits ${gap} away`);
    }
  }

  // Deliberately not checked: whether a wall's height equals the storey height of its level.
  // That is a muro derivation rule (a wall rises to the storey height unless `h:` or `air:` says
  // otherwise) and the control was never told it. Holding the control to a rule it does not know
  // is the unfairness this whole design set out to avoid. What is checked above is only the
  // internal agreement of numbers the document itself stores.

  return {
    kind: "agreement",
    label: "every stored derived value still agrees with the geometry",
    pass: problems.length === 0,
    detail:
      problems.length === 0
        ? "no stored value disagrees"
        : `${problems.length} silent disagreement(s): ${problems.slice(0, 3).join("; ")}`,
  };
}

// ---- 5. assert ----

/** The context an assertion is written against — deliberately small and JSON-shaped */
export interface AssertContext {
  b: JsonBuilding;
  room: (id: string) => JsonRoom | undefined;
  rooms: (prefix: string) => JsonRoom[];
  group: (id: string) => { id: string; areaM2: number } | undefined;
  wall: (id: string) => JsonBuilding["walls"][number] | undefined;
  openingsOf: (wallId: string) => JsonBuilding["openings"];
  /** Area measured from the pieces, not the stored number — an assertion must ask the geometry */
  areaOf: (r: JsonRoom | undefined) => number | undefined;
  /**
   * The area of a grouping, summed from the geometry of its indoor members.
   *
   * The stored `group.areaM2` is exactly the number an edit can leave stale, so an assertion about
   * a conserved area must not read it. This counts the pieces instead.
   */
  groupAreaOf: (id: string) => number;
  /** The x and y extent of a room's pieces — what "its east edge moved to 3800" asks */
  extentOf: (r: JsonRoom | undefined) => { x1: number; y1: number; x2: number; y2: number } | undefined;
  /** Rooms that are subject to the daylight question (`daylight:1` and holding a region) */
  daylightRooms: () => JsonRoom[];
}

export function assertContext(b: JsonBuilding): AssertContext {
  return {
    b,
    room: (id) => b.rooms.find((r) => r.id === id),
    rooms: (prefix) => b.rooms.filter((r) => r.id.startsWith(prefix)),
    group: (id) => b.groups.find((g) => g.id === id),
    wall: (id) => b.walls.find((w) => w.id === id),
    openingsOf: (wallId) => b.openings.filter((o) => o.wall === wallId),
    areaOf: (r) => (r === undefined ? undefined : m2(piecesOf(r))),
    groupAreaOf: (id) => {
      const members = b.rooms.filter((r) => r.id.startsWith(`${id}/`) && r.indoor);
      return Math.round(members.reduce((a, r) => a + m2(piecesOf(r)), 0) * 100) / 100;
    },
    extentOf: (r) => {
      if (r === undefined || r.pieces.length === 0) return undefined;
      const pts = r.pieces.flat();
      return {
        x1: Math.min(...pts.map((p) => p[0])),
        y1: Math.min(...pts.map((p) => p[1])),
        x2: Math.max(...pts.map((p) => p[0])),
        y2: Math.max(...pts.map((p) => p[1])),
      };
    },
    daylightRooms: () => b.rooms.filter((r) => r.attrs?.["daylight"] === 1 && r.pieces.length > 0),
  };
}

/**
 * Evaluate one assertion.
 *
 * `eval/` is an internal tool: task files are written by hand inside the repository, so arbitrary
 * code (`new Function`) is acceptable here exactly as it is in eval/score.ts. No external input
 * reaches it.
 */
export function evaluateAssert(b: JsonBuilding, expr: string, label?: string): ControlOracleResult {
  const ctx = assertContext(b);
  const names = Object.keys(ctx);
  const fn = new Function(...names, `return (${expr})`);
  let value: unknown;
  try {
    value = fn(...names.map((n) => (ctx as unknown as Record<string, unknown>)[n]));
  } catch (e) {
    return { kind: "assert", label: label ?? expr, pass: false, detail: `threw: ${String(e)}` };
  }
  const pass = value === true;
  return {
    kind: "assert",
    label: label ?? expr,
    pass,
    detail: pass ? "true" : `evaluated to ${JSON.stringify(value) ?? String(value)}`,
  };
}

// ---- putting it together ----

export interface ControlScore {
  parsed: boolean;
  parseError?: string;
  oracles: ControlOracleResult[];
  passed: number;
  total: number;
  success: boolean;
  /**
   * The headline number: schema, refs and geometry all pass, yet a stored derived value
   * disagrees — the document looks fine and says something false.
   */
  silentlyWrong: boolean;
}

export function scoreControl(raw: string, asserts: Array<{ expr: string; label?: string }> = []): ControlScore {
  let b: JsonBuilding;
  try {
    b = JSON.parse(raw) as JsonBuilding;
  } catch (e) {
    return {
      parsed: false,
      parseError: String(e),
      oracles: [],
      passed: 0,
      total: 0,
      success: false,
      silentlyWrong: false,
    };
  }
  const schema = schemaOracle(b);
  // The later oracles read fields the schema guarantees, so a schema failure stops here rather
  // than reporting a cascade of consequences as if they were separate findings.
  if (!schema.pass) {
    return { parsed: true, oracles: [schema], passed: 0, total: 1, success: false, silentlyWrong: false };
  }
  const oracles = [
    schema,
    refsOracle(b),
    geometryOracle(b),
    agreementOracle(b),
    ...asserts.map((a) => evaluateAssert(b, a.expr, a.label)),
  ];
  const passed = oracles.filter((o) => o.pass).length;
  const looksFine = oracles
    .filter((o) => o.kind === "schema" || o.kind === "refs" || o.kind === "geometry")
    .every((o) => o.pass);
  return {
    parsed: true,
    oracles,
    passed,
    total: oracles.length,
    success: passed === oracles.length,
    silentlyWrong: looksFine && oracles.some((o) => o.kind === "agreement" && !o.pass),
  };
}

// ---- CLI ----

if (process.argv[1]?.endsWith("oracle.ts") === true) {
  const file = process.argv[2];
  if (file === undefined) {
    console.error("usage: tsx eval/control/oracle.ts <building.json>");
    process.exit(2);
  }
  const s = scoreControl(readFileSync(file, "utf8"));
  if (!s.parsed) {
    console.log(`not JSON: ${s.parseError}`);
    process.exit(1);
  }
  for (const o of s.oracles) console.log(`${o.pass ? "pass" : "FAIL"}  ${o.kind.padEnd(9)} ${o.label} — ${o.detail}`);
  console.log(`${s.passed}/${s.total} passed${s.silentlyWrong ? "  (SILENTLY WRONG)" : ""}`);
  process.exit(s.success ? 0 : 1);
}
