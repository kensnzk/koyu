// koyu — the scene a Form describes (`@kensnzk/koyu/draw`)
//
// **Plain data. No three.js, no colour, no word, and no option.** A viewer turns these nodes into
// meshes with its own materials, its own lighting and its own idea of what is selected; two viewers
// showing the same building disagree about all of that and about none of this.
//
// **Why data and not a scene graph.** The package declares no runtime dependency and a test holds
// it to that, so a `THREE.Group` cannot be returned from here. That constraint turned out to be the
// right shape anyway: the two viewers that exist both wrap the result in their own group, one of
// them explodes the levels apart, and neither wants the other's materials.
//
// **No options, deliberately.** Everything a viewer might have asked for — which levels, whether to
// draw openings, how thick a ground plate is, how far to spread the storeys — is either a filter
// over the nodes (`nodes.filter`) or a transform on the consumer's own group. Baking any of it in
// here would make the scene stop being a projection of the Form, and two viewers would then differ
// by which options they passed rather than by how they draw.
//
// Every z is true world z. A plate is a face (`bottom === top`), because Form derives no thickness
// for the ground and inventing one here would be a paper decision made in the wrong place.
import { formBodies } from "../core/bodies.js";
import type { Form, FormSwing } from "../core/derive.js";
import type { Pt } from "../core/model.js";
import type { Seg2 } from "../core/vertical.js";
import { Extent } from "./sheet.js";

/** World mm, x east+ / y north+ / z up+. Plain numbers only. */
export interface ScenePrism {
  /** counter-clockwise plan ring — the winding every Form outline has */
  ring: Pt[];
  /** underside z per vertex. `bottom.length === ring.length` */
  bottom: number[];
  /** upper z per vertex. `top.length === ring.length` */
  top: number[];
  /**
   * True when every `bottom` is one number and every `top` is one number — a right prism.
   * **A fact about the numbers, not a hint about materials.** It is what lets a consumer take the
   * cheap extrude path and know when it must stitch a per-vertex buffer instead (a ramp, a flight).
   */
  level: boolean;
}

/** A polyline at one height. Nothing in Form needs a per-vertex z on a line. */
export interface SceneLine {
  points: Pt[];
  z: number;
  closed: boolean;
}

/**
 * A place to put a symbol or a word. **It carries no word.** `extent` is the plan bounds of what
 * the mark is about, so the wording a consumer chooses can be sized and offset against it.
 */
export interface SceneMark {
  x: number;
  y: number;
  z: number;
  extent: { x1: number; y1: number; x2: number; y2: number };
}

export type SceneSubject =
  | "space"
  | "boundary"
  | "opening"
  | "column"
  | "slab"
  | "run"
  | "site"
  | "level";

/**
 * The geometric treatment. **Five, and closed.** Anything a consumer branches a *material* on
 * beyond these — glass, selection, theme, storey colour — is read off a word, and words are the
 * consumer's.
 */
export type SceneRole =
  /** the air a space encloses, floor to ceiling */
  | "volume"
  /** a space or the site read as a horizontal face (`bottom === top`) */
  | "plate"
  /** matter — a wall body, a column, a slab, a tread, a ramp, a leaf */
  | "body"
  /** a line, not a body — a boundary's centreline, the site edge */
  | "edge"
  /** a seat for a symbol or a word */
  | "mark";

/** Booleans and free words carried verbatim. No colour, no line type, no wording. */
export interface SceneFacts {
  /** `FormSpace.void` — a volume with no floor and no matter */
  hollow?: boolean;
  semiOutdoor?: boolean;
  outside?: boolean;
  indoor?: boolean;
  covered?: boolean;
  /** `FormBoundary.air` — does not occlude (a rail, a fence) */
  air?: boolean;
  /** `FormBoundary.derived` — came from contact, not from a declaration */
  derived?: boolean;
  sliding?: boolean;
  /** `FormOpening.style` — a free word, carried and **not read** */
  style?: string;
  /** `FormOpening.name` — likewise */
  name?: string;
  /** `FormColumn.grid` — the drawing name of the intersection it stands on */
  grid?: string;
  areaM2?: number;
}

export interface SceneNode {
  of: SceneSubject;
  role: SceneRole;
  /** the subject's identity in the spelling the rest of `Form` uses */
  ref: string;
  kind?: string;
  /** the authored level this node belongs to, when it has one */
  level?: string;
  /**
   * Place in canonical boundary order — the same meaning as `Mark.written`. **Never an index into
   * `model.boundaries`** (ADR-0041): declaration order is discarded by the canonical form, so
   * indexing by it reads another boundary's attributes and nothing throws.
   */
  written?: { boundary: number; index?: number };
  /** the two spaces a boundary or opening relates */
  pair?: { a: string; b: string };
  /** exactly one of these three, matching `role` */
  solid?: ScenePrism;
  line?: SceneLine;
  mark?: SceneMark;
  /** wall bodies and opening leaves only — the axis, which cannot be read off `ring` */
  centre?: Seg2;
  t?: number;
  /** verbatim, for a viewer that rotates a leaf open */
  swing?: FormSwing;
  facts: SceneFacts;
}

export interface SceneLevel {
  name: string;
  z: number;
  pitch?: number;
}

export interface Scene {
  levels: SceneLevel[];
  /**
   * The level that meets the ground — **the lowest level at or above z 0, not `levels[0]`**. A
   * building with a basement otherwise lands its site and its landscaping on the basement plan.
   * Undefined when nothing stands at or above ground.
   */
  ground?: string;
  nodes: SceneNode[];
}

/** A right prism is one where every underside and every top is the same number. */
const prism = (ring: Pt[], bottom: number[], top: number[]): ScenePrism => ({
  ring,
  bottom,
  top,
  level: new Set(bottom).size <= 1 && new Set(top).size <= 1,
});

const flat = (ring: Pt[], z0: number, z1: number): ScenePrism =>
  prism(
    ring,
    ring.map(() => z0),
    ring.map(() => z1),
  );

/** Drop the keys nobody set, so a node carries facts rather than a row of undefineds. */
const facts = (o: SceneFacts): SceneFacts => {
  const out: SceneFacts = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
};

/**
 * The scene a `Form` describes.
 *
 * Deterministic and cacheable: the same Form gives the same nodes in the same order, because the
 * order is `Form`'s own and is never re-established here.
 */
export function sceneOf(form: Form): Scene {
  const nodes: SceneNode[] = [];
  const spaces = new Map(form.spaces.map((s) => [s.path, s]));
  const boundaries = new Map(form.boundaries.map((b) => [b.ref, b]));
  const openings = new Map(form.openings.map((o) => [o.ref, o]));
  const columns = new Map(form.columns.map((c) => [c.ref, c]));
  const runs = new Map(form.runs.map((r) => [r.path, r]));
  const levelZ = new Map(form.levels.map((l) => [l.name, l.z]));

  // ---- the bodies, straight out of the one enumeration, in its order ----
  for (const body of formBodies(form)) {
    const solid = prism(body.poly, body.bottom, body.top);
    switch (body.of) {
      case "space": {
        const s = spaces.get(body.ref);
        nodes.push({
          of: "space",
          role: "volume",
          ref: body.ref,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(s?.level !== undefined ? { level: s.level } : {}),
          solid,
          facts: facts({
            hollow: s?.void,
            semiOutdoor: s?.semiOutdoor,
            outside: s?.outside,
            indoor: s?.indoor,
            covered: s?.covered,
          }),
        });
        break;
      }
      case "boundary": {
        const b = boundaries.get(body.ref);
        nodes.push({
          of: "boundary",
          role: "body",
          ref: body.ref,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(b?.level !== undefined ? { level: b.level } : {}),
          ...(b ? { written: { boundary: b.boundary }, pair: { a: b.a, b: b.b } } : {}),
          solid,
          ...(body.centre ? { centre: body.centre } : {}),
          ...(b?.material ? { t: b.material.t } : {}),
          facts: facts({ air: b?.air, derived: b?.derived }),
        });
        break;
      }
      case "opening": {
        const o = openings.get(body.ref);
        nodes.push({
          of: "opening",
          role: "body",
          ref: body.ref,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(o?.level !== undefined ? { level: o.level } : {}),
          ...(o ? { written: { boundary: o.boundary, index: o.index }, pair: { a: o.a, b: o.b } } : {}),
          solid,
          ...(body.centre ? { centre: body.centre } : {}),
          ...(o ? { t: o.t } : {}),
          ...(o?.swing ? { swing: o.swing } : {}),
          facts: facts({ sliding: o?.sliding, style: o?.style, name: o?.name }),
        });
        break;
      }
      case "column": {
        const c = columns.get(body.ref);
        nodes.push({
          of: "column",
          role: "body",
          ref: body.ref,
          ...(c?.level !== undefined ? { level: c.level } : {}),
          solid,
          facts: facts({ grid: c?.grid }),
        });
        break;
      }
      case "slab": {
        nodes.push({
          of: "slab",
          role: "body",
          ref: body.ref,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          solid,
          facts: {},
        });
        break;
      }
      case "run": {
        const r = runs.get(body.ref);
        nodes.push({
          of: "run",
          role: "body",
          ref: body.ref,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(r?.level !== undefined ? { level: r.level } : {}),
          solid,
          facts: {},
        });
        break;
      }
    }
  }

  // ---- the layers that are not bodies ----

  // A space read as a face at its own floor, for a viewer that shows storeys as plates rather than
  // as air. `Form` derives no thickness for it, so it is a face and the consumer extrudes.
  for (const s of form.spaces) {
    if (s.level === undefined) continue;
    const z = levelZ.get(s.level);
    if (z === undefined) continue;
    for (const piece of s.outline) {
      nodes.push({
        of: "space",
        role: "plate",
        ref: s.path,
        ...(s.type !== undefined ? { kind: s.type } : {}),
        level: s.level,
        solid: flat(piece, z, z),
        facts: facts({
          hollow: s.void,
          semiOutdoor: s.semiOutdoor,
          outside: s.outside,
          indoor: s.indoor,
          covered: s.covered,
        }),
      });
    }
  }

  // Every boundary carries a centreline, whether or not it has matter — a relation with nothing in
  // it is still a relation, and a viewer that only meshed bodies would never see one.
  for (const b of form.boundaries) {
    const z = b.level !== undefined ? levelZ.get(b.level) : undefined;
    nodes.push({
      of: "boundary",
      role: "edge",
      ref: b.ref,
      kind: b.kind,
      ...(b.level !== undefined ? { level: b.level } : {}),
      written: { boundary: b.boundary },
      pair: { a: b.a, b: b.b },
      line: {
        points: [
          { x: b.segment.x1, y: b.segment.y1 },
          { x: b.segment.x2, y: b.segment.y2 },
        ],
        z: z ?? 0,
        closed: false,
      },
      facts: facts({ air: b.air, derived: b.derived }),
    });
  }

  for (const p of form.site) {
    nodes.push({
      of: "site",
      role: "plate",
      ref: p.path,
      solid: flat(p.points, 0, 0),
      facts: { areaM2: p.areaM2 },
    });
    nodes.push({
      of: "site",
      role: "edge",
      ref: p.path,
      line: { points: p.points, z: 0, closed: true },
      facts: { areaM2: p.areaM2 },
    });
  }

  // A seat per level, for whatever a viewer wants to write beside a storey. The extent is folded,
  // never spread — `Math.min(...pts)` overflows the stack on a model with tens of thousands of
  // solids, and one of the bundled stress models is exactly that.
  for (const l of form.levels) {
    const e = new Extent();
    for (const s of form.spaces) {
      if (s.level !== l.name) continue;
      for (const piece of s.outline) for (const pt of piece) e.see(pt.x, pt.y);
    }
    if (e.empty) continue;
    nodes.push({
      of: "level",
      role: "mark",
      ref: l.name,
      level: l.name,
      mark: {
        x: e.min0,
        y: (e.min1 + e.max1) / 2,
        z: l.z,
        extent: { x1: e.min0, y1: e.min1, x2: e.max0, y2: e.max1 },
      },
      facts: {},
    });
  }

  const ground = form.levels.filter((l) => l.z >= 0).sort((a, b) => a.z - b.z)[0]?.name;
  return {
    levels: form.levels.map((l) => ({
      name: l.name,
      z: l.z,
      ...(l.pitch !== undefined ? { pitch: l.pitch } : {}),
    })),
    ...(ground !== undefined ? { ground } : {}),
    nodes,
  };
}
