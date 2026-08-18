// koyu — the section and the elevation (ADR-0064)
//
// **This reads a `Form` and nothing else.** Every body it cuts was raised by `derive` and
// enumerated by `formBodies` (bodies.ts). It composes no matter; it re-frames what came out of the
// one entry point to shape, which is what `planOf` does for a horizontal plane and this does for a
// vertical one.
//
// **Why it is here and not in `src/draw/`.** Everything a section needs is public on `Form`, so a
// renderer could compute one without tripping a single import gate. What forbids it is not a test
// but docs/why/plan-is-not-a-section.md: "this is a section, this is a projection" is decided by
// comparing a range against a plane, and left to the drawing side the thresholds differ per
// implementation, so one source yields two drawings. The comparison here is the same one, turned
// on its side.
//
// **What a vertical plane needs that a slice does not give.** A slice hands back flat pieces at
// one x and an empty background. A section is mostly what stands *behind* the plane — the far wall
// with its windows, the stair beyond the cut — and none of that falls out of cutting. Nor does the
// decision to throw the near half away, which is a choice of viewpoint and has to be an input.

import { formBodies, type FormBody } from "./bodies.js";
import type { Form } from "./derive.js";
import type { Edge, Pt } from "./model.js";
import { crossing, hull, signedArea } from "./poly.js";
import { EPS } from "./tolerance.js";

/** Which axis names the plane. `"X"` means the plane `x = at`. */
export type SectionAxis = "X" | "Y";

/**
 * What a vertical plane divides the mass into. **Two, where a plan has five.**
 *
 * A plan is looked at from above, so it carries what is below the cut, what is above it dropped
 * back down, and the symbols of movement. A section is looked at from the side: what the plane
 * crossed, and what stands behind it. What stands in front is not hidden by convention — it is
 * behind the viewer — so it is not produced at all, and saying so here is what stops each
 * consumer deciding it.
 */
export type SectionClass = "cut" | "beyond";

export type SectionSubject = "space" | "boundary" | "opening" | "column" | "slab" | "run";

/** A point on the section. **Not a plan coordinate** — `u` runs across the sheet, `z` is height. */
export interface SectionPt {
  u: number;
  z: number;
}

/** The plane, and the direction it is looked at from. */
export interface SectionSpec {
  axis: SectionAxis;
  /** where the plane sits along `axis`, world mm */
  at: number;
  /** the grid reference it was named by, when it was named by one */
  atRef?: string;
  /** the direction of view. `W`/`E` across an X plane, `N`/`S` across a Y plane */
  look: Edge;
}

export interface SectionEntity {
  class: SectionClass;
  of: SectionSubject;
  /** identity of the subject, in the spelling the rest of `Form` uses */
  ref: string;
  /** what the subject already says it is — a slab's face, an opening's leaf, a run's device */
  kind?: string;
  /** counter-clockwise in (u, z), like every outline `Form` returns */
  polygon: SectionPt[];
  /**
   * How far behind the plane the nearest point of the body stands, mm. `0` for anything the plane
   * crossed. **It is a distance, not a draw order** — `Form` holds no draw order, and whether to
   * sort by this, fade by it or ignore it is the drawing's business.
   */
  depth: number;
}

export interface FormSection {
  axis: SectionAxis;
  at: number;
  atRef?: string;
  look: Edge;
  entities: SectionEntity[];
}

/** The direction of view as a unit vector in plan. */
function look(edge: Edge): Pt {
  return edge === "N"
    ? { x: 0, y: 1 }
    : edge === "S"
      ? { x: 0, y: -1 }
      : edge === "E"
        ? { x: 1, y: 0 }
        : { x: -1, y: 0 };
}

/**
 * The axis a direction of view crosses. Looking east or west crosses an X plane.
 *
 * A `look` that runs along the plane rather than across it draws nothing, so it is refused rather
 * than answered — the same treatment `svgPlan` gives a level that was never declared.
 */
export function axisOf(edge: Edge): SectionAxis {
  return edge === "E" || edge === "W" ? "X" : "Y";
}

/**
 * The direction a section is looked at from when nobody said.
 *
 * The rule is statable rather than conventional: **on the default, `u` is the world coordinate
 * along the cut line**, so a dimension taken off the plan carries into the section without being
 * reversed. Looking the other way mirrors the sheet, which is why it has to be asked for.
 */
export function defaultLook(axis: SectionAxis): Edge {
  return axis === "X" ? "W" : "N";
}

/**
 * Where the sheet's `u` axis points, in plan. **It is the viewer's right hand**: `u = d × ẑ`.
 *
 * Facing north, east is on your right; facing east, south is. Fixing it here is what makes one
 * spec give one drawing — a renderer that guessed would mirror the building and no test would
 * catch it.
 */
function rightOf(d: Pt): Pt {
  return { x: d.y, y: -d.x };
}

/**
 * The bodies a vertical plane may cut. **Outside and semi-outdoor spaces are dropped.** A storey's
 * ceiling height reaches them, so they carry a z range, but no ceiling is derived over them
 * (fabric.ts excludes both) and there is nothing above them to bound the air. Cutting one paints a
 * garden as a room. A 3D scene keeps them, which is why the enumeration itself does not judge.
 */
function cuttableBodies(form: Form): FormBody[] {
  const airless = new Set(form.spaces.filter((s) => s.outside || s.semiOutdoor).map((s) => s.path));
  return formBodies(form).filter((b) => !(b.of === "space" && airless.has(b.ref)));
}

/** The polygon a body leaves on the plane, or `undefined` where the plane only grazes a corner. */
function cutOf(body: FormBody, axis: SectionAxis, at: number, u: (p: Pt) => number): SectionPt[] | undefined {
  const met = crossing(body.poly, axis, at);
  if (!met) return undefined;
  const n = body.poly.length;
  // The height at a crossing, read off the edge it sits on. **This is exact, not sampled** — a
  // per-vertex height means the height is linear along each edge, which is all the reading assumes.
  const at01 = (v: number[], c: { edge: number; t: number }): number =>
    v[c.edge]! + c.t * (v[(c.edge + 1) % n]! - v[c.edge]!);
  const ends = met.map((c) => ({
    u: u(body.poly[c.edge]!) + c.t * (u(body.poly[(c.edge + 1) % n]!) - u(body.poly[c.edge]!)),
    z0: at01(body.bottom, c),
    z1: at01(body.top, c),
  }));
  const [a, b] = ends[0]!.u <= ends[1]!.u ? [ends[0]!, ends[1]!] : [ends[1]!, ends[0]!];
  if (b.u - a.u <= EPS) return undefined;
  // Bottom-left, bottom-right, top-right, top-left — counter-clockwise with z up.
  return [
    { u: a.u, z: a.z0 },
    { u: b.u, z: b.z0 },
    { u: b.u, z: b.z1 },
    { u: a.u, z: a.z1 },
  ];
}

/**
 * The shape a body throws onto the plane, seen head-on.
 *
 * A body of the `Form` is a prism over a convex ring whose top and bottom vary linearly, so it is
 * a convex solid and **its shadow is the hull of its projected vertices** — exact, not an outline
 * fitted to it. Where the top and bottom do not vary (everything but a ramp or an escalator) that
 * hull is a rectangle, and it is taken directly.
 */
function shadowOf(body: FormBody, u: (p: Pt) => number): SectionPt[] | undefined {
  let uLo = Infinity;
  let uHi = -Infinity;
  let zLo = Infinity;
  let zHi = -Infinity;
  let level = true;
  for (let i = 0; i < body.poly.length; i++) {
    const v = u(body.poly[i]!);
    if (v < uLo) uLo = v;
    if (v > uHi) uHi = v;
    const b = body.bottom[i]!;
    const t = body.top[i]!;
    if (b < zLo) zLo = b;
    if (t > zHi) zHi = t;
    if (b !== body.bottom[0] || t !== body.top[0]) level = false;
  }
  if (uHi - uLo <= EPS || zHi - zLo <= EPS) return undefined;
  if (level) {
    return [
      { u: uLo, z: zLo },
      { u: uHi, z: zLo },
      { u: uHi, z: zHi },
      { u: uLo, z: zHi },
    ];
  }
  const pts: Pt[] = [];
  for (let i = 0; i < body.poly.length; i++) {
    const v = u(body.poly[i]!);
    pts.push({ x: v, y: body.bottom[i]! }, { x: v, y: body.top[i]! });
  }
  const ring = hull(pts);
  return ring.length >= 3 ? ring.map((p) => ({ u: p.x, z: p.y })) : undefined;
}

function entitiesOf(bodies: FormBody[], spec: SectionSpec): SectionEntity[] {
  const d = look(spec.look);
  const r = rightOf(d);
  const u = (p: Pt): number => p.x * r.x + p.y * r.y;
  /** How far behind the plane a point stands. Positive is away from the viewer. */
  const behind = (p: Pt): number => (spec.axis === "X" ? (p.x - spec.at) * d.x : (p.y - spec.at) * d.y);

  const out: SectionEntity[] = [];
  for (const body of bodies) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of body.poly) {
      const f = behind(p);
      if (f < lo) lo = f;
      if (f > hi) hi = f;
    }
    // **The body is asked which side it is wholly on, not how far it reaches past the plane.**
    // Asking the second question needs the body to extend more than the tolerance on both sides,
    // which a body no wider than the tolerance itself can never do — a `t:1` wall standing on the
    // plane reaches −0.5 and +0.5, and would be reported as standing behind a plane that goes
    // straight through it.
    const wholly = { behind: lo >= -EPS && hi > EPS, front: hi <= EPS && lo < -EPS };
    if (!wholly.behind && !wholly.front) {
      // It reaches both sides: the plane crossed it.
      const polygon = cutOf(body, spec.axis, spec.at, u);
      if (polygon) {
        out.push({ class: "cut", of: body.of, ref: body.ref, ...(body.kind ? { kind: body.kind } : {}), polygon, depth: 0 });
      }
      continue;
    }
    // Wholly at or behind the plane. A space is a void — from outside there is nothing to see.
    if (wholly.behind && body.of !== "space") {
      const polygon = shadowOf(body, u);
      if (polygon) {
        out.push({
          class: "beyond",
          of: body.of,
          ref: body.ref,
          ...(body.kind ? { kind: body.kind } : {}),
          polygon,
          // A face within the tolerance of the plane counts as on it, so the nearest point can
          // measure a hair negative. `depth` is a distance behind the plane and never less than 0.
          depth: Math.max(0, lo),
        });
      }
    }
    // Otherwise it stands in front of the plane, behind the viewer, and is not produced.
  }
  return out;
}

/**
 * The section a vertical plane makes of a `Form`.
 *
 * The plane is named by an axis and a coordinate; `look` says which way it is faced, and must
 * cross the plane rather than run along it.
 */
export function sectionForm(form: Form, spec: SectionSpec): FormSection {
  if (axisOf(spec.look) !== spec.axis) {
    throw new Error(
      `Looking ${spec.look} runs along the ${spec.axis} plane rather than across it (an X plane is looked at from E or W, a Y plane from N or S)`,
    );
  }
  return {
    axis: spec.axis,
    at: spec.at,
    ...(spec.atRef !== undefined ? { atRef: spec.atRef } : {}),
    look: spec.look,
    entities: entitiesOf(cuttableBodies(form), spec),
  };
}

/**
 * The elevation of one face — **a section whose plane misses the mass.**
 *
 * `face` names the side the viewer stands on: `S` is the south elevation, seen from the south.
 * The plane is put at the extreme of the mass along the line of sight, so **nothing can straddle
 * it and `cut` comes back empty by construction** rather than by a branch in the code. Where
 * exactly it goes is free: the projection is orthographic, so moving the plane further back
 * changes no `u` and no `z`, only the datum that `depth` is counted from.
 */
export function elevationForm(form: Form, face: Edge): FormSection {
  // Standing to the south means looking north.
  const from: Edge = face === "N" ? "S" : face === "S" ? "N" : face === "E" ? "W" : "E";
  const axis = axisOf(from);
  const d = look(from);
  const bodies = cuttableBodies(form);
  // The near extreme along the line of sight: looking towards the larger coordinate puts the plane
  // at the smallest, and looking towards the smaller puts it at the largest.
  const towardsLarger = (axis === "X" ? d.x : d.y) > 0;
  let at = 0;
  let seen = false;
  for (const body of bodies) {
    for (const p of body.poly) {
      const c = axis === "X" ? p.x : p.y;
      if (!seen || (towardsLarger ? c < at : c > at)) at = c;
      seen = true;
    }
  }
  const spec: SectionSpec = { axis, at, look: from };
  return { axis, at, look: from, entities: entitiesOf(bodies, spec) };
}

/** The area of a section polygon, mm². Used by the tests that hold the cut against the Form. */
export function sectionArea(polygon: SectionPt[]): number {
  return Math.abs(signedArea(polygon.map((p) => ({ x: p.u, y: p.z }))));
}
