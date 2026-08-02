// The W3 control group — export a muro building as a naive JSON model carrying coordinates.
//
// **This is not muro's canonical JSON.** The canonical form is muro's definition of equivalence,
// not the shape an engineer who has never seen muro would write to hold the same building. What
// this emits is the latter: a shape that **stores every fact muro derives** — areas, wall
// endpoints, absolute opening positions, storey heights, the area of a grouping.
//
// Why export by machine rather than write one by hand. Four criteria, in the order they bite:
//   1. **It carries the same information.** If the control holds less, the outcome is about
//      missing information, not about derivation.
//   2. **A third party can re-run it.** A hand-written file cannot be regenerated; an exporter can.
//   3. **It cannot be dismissed as a strawman.** An objection to the shape must point at this file.
//   4. **Only the thing under test differs** — whether derivation exists.
//
// For (4) this export carries none of muro's relational machinery. A wall is not "the boundary of
// two spaces" but **a thing with endpoints and a thickness**; there are no default walls, so every
// wall is listed. Room identifiers keep muro's paths verbatim — mangling them would only handicap
// the control for no reason.

import { writeFileSync } from "node:fs";
import { derive } from "../../src/core/derive.js";
import type { Form, FormBoundary } from "../../src/core/derive.js";
import type { Attrs, Model } from "../../src/core/model.js";
import { zoneAreaM2 } from "../../src/core/model.js";
import { parseFile } from "../../src/parse-file.js";

/** A level. The storey height is a derived quantity, so it is stored. */
export interface JsonLevel {
  name: string;
  z: number;
  ceilingHeight?: number;
  slabThickness?: number;
  /** How high walls and columns stand (muro derives this) */
  storeyHeight?: number;
}

/**
 * A room.
 *
 * `pieces` lists the convex pieces of the floor; the floor is their union. muro derives this from
 * the written region; here it is stored — **so widening a room means editing several places.**
 * `areaM2` is the same: not derived but saved, which makes agreement the writer's responsibility.
 */
export interface JsonRoom {
  id: string;
  level?: string;
  /** The free label, when one was written. koyu reads no meaning from it. */
  type?: string;
  name?: string;
  pieces: Array<Array<[number, number]>>;
  areaM2?: number;
  floorZ?: number;
  ceilingZ?: number;
  indoor: boolean;
  attrs?: Record<string, string | number>;
}

/** A wall — a thing, not a relation. The rooms on either side are held as references. */
export interface JsonWall {
  id: string;
  level?: string;
  sides: [string, string];
  start: [number, number];
  end: [number, number];
  /** Thickness in mm. An `open` relation carries no material, so no thickness. */
  thickness?: number;
  /** True when the wall does not block air or light (a handrail, a railing) */
  air: boolean;
  baseZ?: number;
  topZ?: number;
  kind: string;
  attrs?: Record<string, string | number>;
}

/** An opening — held at absolute coordinates rather than as a position along its wall. */
export interface JsonOpening {
  id: string;
  wall: string;
  kind: "door" | "window";
  name?: string;
  center: [number, number];
  width: number;
  sillZ: number;
  headZ: number;
  leafThickness: number;
  sliding: boolean;
}

export interface JsonColumn {
  id: string;
  level: string;
  center: [number, number];
  width: number;
  depth: number;
  baseZ: number;
  topZ: number;
}

/**
 * A grouping (muro's `zone`).
 *
 * **The area is stored, not derived.** In muro `zoneAreaM2` counts its members every time; here it
 * is a fact on the page, so widening one room means fixing this number by hand or the model no
 * longer agrees with itself. Membership follows the identifier prefix (`/L5/A/ldk` belongs to
 * `/L5/A`) — the convention JSON practice actually uses.
 */
export interface JsonGroup {
  id: string;
  name?: string;
  /** Total indoor floor area in m2 (a stored derived quantity) */
  areaM2: number;
  attrs?: Record<string, string | number>;
}

export interface JsonBuilding {
  unit: "mm";
  levels: JsonLevel[];
  rooms: JsonRoom[];
  walls: JsonWall[];
  openings: JsonOpening[];
  columns: JsonColumn[];
  groups: JsonGroup[];
  site?: Array<{ id: string; polygon: Array<[number, number]>; areaM2: number }>;
}

const pt = (p: { x: number; y: number }): [number, number] => [p.x, p.y];

/**
 * Copy attributes across verbatim.
 *
 * **This is what keeps the information equal.** A value such as `floor:オーク` never reaches the
 * Form (the Form carries identity only), yet it is written in the source. Dropping it would make
 * the control lose for holding less — which proves nothing about derivation.
 */
function attrsOf(a: Attrs, lift: readonly string[] = []): Record<string, string | number> | undefined {
  const keys = Object.keys(a).sort().filter((k) => !lift.includes(k));
  if (keys.length === 0) return undefined;
  const out: Record<string, string | number> = {};
  for (const k of keys) out[k] = a[k] as string | number;
  return out;
}

/** Wall identifiers — JSON has no relational identity, so a running number is the only option */
const wallId = (i: number): string => `W${String(i + 1).padStart(3, "0")}`;

/**
 * Turn one `FormBoundary` into one wall.
 *
 * A muro boundary reaches the Form **per segment** (one relation can hold several segments), so
 * here there are as many walls as segments — exactly how a naive JSON model holds them.
 */
function wallOf(b: FormBoundary, i: number, model: Model): JsonWall {
  const decl = model.boundaries[b.boundary];
  return {
    id: wallId(i),
    ...(b.level === undefined ? {} : { level: b.level }),
    sides: [b.a, b.b],
    start: [b.segment.x1, b.segment.y1],
    end: [b.segment.x2, b.segment.y2],
    ...(b.material === undefined
      ? {}
      : { thickness: b.material.t, baseZ: b.material.z0, topZ: b.material.z1 }),
    kind: b.kind,
    air: b.air,
    ...(decl === undefined || attrsOf(decl.attrs) === undefined ? {} : { attrs: attrsOf(decl.attrs) }),
  };
}

export function exportBuilding(model: Model, form: Form): JsonBuilding {
  const walls = form.boundaries.map((b, i) => wallOf(b, i, model));
  // An opening points at the wall it sits on. Form openings carry the boundary index and the
  // segment, so that pair is the key.
  const wallIndexOf = new Map<string, number>();
  for (const [i, b] of form.boundaries.entries()) {
    wallIndexOf.set(`${b.boundary}|${b.segment.x1},${b.segment.y1},${b.segment.x2},${b.segment.y2}`, i);
  }
  const openings: JsonOpening[] = form.openings.map((o, k) => {
    const key = `${o.boundary}|${o.segment.x1},${o.segment.y1},${o.segment.x2},${o.segment.y2}`;
    const wi = wallIndexOf.get(key);
    if (wi === undefined) throw new Error(`the opening ${o.ref} sits on no exported wall`);
    return {
      id: `O${String(k + 1).padStart(3, "0")}`,
      wall: wallId(wi),
      kind: o.kind,
      ...(o.name === undefined ? {} : { name: o.name }),
      center: [o.cx, o.cy] as [number, number],
      width: o.w,
      sillZ: o.z0,
      headZ: o.z1,
      leafThickness: o.t,
      sliding: o.sliding,
    };
  });

  return {
    unit: "mm",
    levels: form.levels.map((l) => ({
      name: l.name,
      z: l.z,
      ...(l.h === undefined ? {} : { ceilingHeight: l.h }),
      ...(l.slab === undefined ? {} : { slabThickness: l.slab }),
      ...(l.pitch === undefined ? {} : { storeyHeight: l.pitch }),
    })),
    rooms: form.spaces.map((s) => ({
      id: s.path,
      ...(s.level === undefined ? {} : { level: s.level }),
      ...(s.type === undefined ? {} : { type: s.type }),
      pieces: s.outline.map((ring) => ring.map(pt)),
      ...(s.areaM2 === undefined ? {} : { areaM2: s.areaM2 }),
      ...(s.z0 === undefined ? {} : { floorZ: s.z0 }),
      ...(s.z1 === undefined ? {} : { ceilingZ: s.z1 }),
      indoor: s.indoor,
      ...(() => {
        const a = model.spaces.get(s.path)?.attrs;
        if (a === undefined) return {};
        const bag = attrsOf(a, ["name"]);
        return {
          ...(typeof a["name"] === "string" ? { name: a["name"] } : {}),
          ...(bag === undefined ? {} : { attrs: bag }),
        };
      })(),
    })),
    walls,
    openings,
    columns: form.columns.map((c, k) => ({
      id: `C${String(k + 1).padStart(3, "0")}`,
      level: c.level,
      center: [c.x, c.y] as [number, number],
      width: c.w,
      depth: c.d,
      baseZ: c.z0,
      topZ: c.z1,
    })),
    groups: [...model.zones.values()]
      .map((z) => {
        const bag = attrsOf(z.attrs, ["name"]);
        return {
          id: z.path,
          ...(typeof z.attrs["name"] === "string" ? { name: z.attrs["name"] } : {}),
          areaM2: zoneAreaM2(model, z.path),
          ...(bag === undefined ? {} : { attrs: bag }),
        };
      })
      .sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0)),
    ...(form.site.length === 0
      ? {}
      : { site: form.site.map((s) => ({ id: s.path, polygon: s.points.map(pt), areaM2: s.areaM2 })) }),
  };
}

/**
 * Fold coordinate pairs onto one line.
 *
 * `JSON.stringify(_, null, 2)` breaks `[0, 0]` across four lines. **Verbosity must not handicap the
 * control** — what is under test is propagation, not line count or character count. A hand-written
 * JSON folds them the same way.
 */
export function compact(json: string): string {
  return json.replace(/\[\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+\]/g, "[$1, $2]");
}

// ---- CLI ----

if (process.argv[1]?.endsWith("export.ts") === true) {
  const [entry, out] = process.argv.slice(2);
  if (entry === undefined) {
    console.error("usage: tsx eval/control/export.ts <entry.muro> [out.json]");
    process.exit(2);
  }
  const model = parseFile(entry);
  const json = compact(JSON.stringify(exportBuilding(model, derive(model)), null, 2)) + "\n";
  if (out === undefined) process.stdout.write(json);
  else {
    writeFileSync(out, json);
    console.error(`wrote ${out}`);
  }
}
