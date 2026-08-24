// koyu — the marks of a plan (`@kensnzk/koyu/draw`)
//
// **This copies `Form`'s 2D entities into presentation marks.** Wall thickness, the intervals an
// opening splits a wall into, opening width and direction, where a run is cut and the projection
// of the void above are already in the `Form` that `derive(model)` returns (ADR-0040). This layer
// decides which entities become marks and applies drawing-only symbol conventions: the 60mm clear
// gap of a sliding leaf and the subdivisions named by an explicit multi-leaf style. None of those
// marks changes building shape, canonical data or the graph.
//
// **A plan is not a pure section.** Door swings, the projection of the void above, break lines and
// the descending run do not fall out of cutting a solid, however exactly it is cut. So `Form` hands
// the plan over as entities carrying a class (cut / below / above / swing / anchor), and this page
// reads that class rather than re-deciding it.
//
// **No words and no style.** `Form` carries no colour, no line type and no annotation wording
// (docs/reference/scope.md), and neither does a mark. Direction and stair-proportion labels are the
// consumer's — three consumers spell three different sets of them today,
// and a mark that carried one would make koyu's language mix everyone's. A mark carries the seat
// (`at`) and the unrounded facts (`note`); the words are put on at the far end.
import { band, type Form, type FormOpening, type FormPlan, type FormRun, type PlanClass, type PlanEntity } from "../core/derive.js";
import { polyBounds, type Pt } from "../core/model.js";
import { toPoint, type RunDevice, type RunPart, type Seg2 } from "../core/vertical.js";
import { ARCHITECTURAL_PLAN_CONVENTION } from "./conventions/architectural.js";

/**
 * A mark's role. The consumer decides stroke weight, colour, dash and every word from it.
 *
 * **Closed, and meant to be.** A consumer that spells `Record<MarkRole, …>` stops compiling when
 * koyu adds one, which is the point — the alternative is a mark that silently never appears.
 */
export type MarkRole =
  /** a space's face, cut by the plane */
  | "space"
  /** the same, where the space is semi-outdoor — roofed, not enclosed */
  | "space-semi-outdoor"
  /** the same, where the space is declared `outside:1` — ground, not floor */
  | "space-outdoor"
  /** a void's face — no floor, so no room */
  | "space-void"
  /** the void's two bounding-box diagonals (a drafting convention, not a shape of the building) */
  | "void-hatch"
  /** the body of a wall interval the plane cut */
  | "wall"
  /** the centreline of something that does not enclose (`air:1`) */
  | "rail"
  /** a relation with no matter (`type:open`) — a centreline and nothing else */
  | "open"
  /** the band of a segment that does not count */
  | "seg"
  /** a window opening, carrying the Form polygon whose two long edges continue the wall faces */
  | "window"
  /** hinge to leaf tip */
  | "door-leaf"
  /** the swing trace */
  | "door-arc"
  /** a sliding door's closed leaf */
  | "slide-panel"
  /** the short line across the centre of a sliding leaf */
  | "slide-centre"
  /** its travel into the pocket */
  | "slide-tail"
  /** the direction in which an automatic door opens */
  | "auto-direction"
  /** a general entrance threshold, without a claimed door operation */
  | "entrance"
  /** a gate jamb or post */
  | "gate-post"
  /** a vertically coiling shutter at the opening line */
  | "rolling-shutter"
  /** a sectional door that rises above the opening */
  | "overhead-door"
  /** an operable window leaf */
  | "window-leaf"
  /** an operable window's swing trace */
  | "window-arc"
  /** a sliding or projecting window sash */
  | "window-sash"
  /** the centre mark of a fixed window */
  | "window-fixed"
  /** a curtain-wall mullion at an explicitly divided panel boundary */
  | "curtain-wall-mullion"
  /** the meeting or overlap mark between window sashes */
  | "window-sash-centre"
  | "column"
  | "run-outline"
  | "run-tread"
  /** where the plane crosses the run — one line; making two of it is the consumer's convention */
  | "run-break"
  | "run-arrow"
  /** a seat only. The note has no geometry, and no words either */
  | "run-note"
  /** the projection of an upper void onto the plan below */
  | "void-above";

/** Pinned to `Form` by construction, so it cannot drift from what `derive` produced. */
export type MarkArc = NonNullable<PlanEntity["arc"]>;

/** What a mark stands for. `PlanSubject` plus the two Form arrays that make marks without entities. */
export type MarkSubject = "space" | "boundary" | "opening" | "column" | "run" | "seg";

/**
 * The facts an annotation is worded from. **No wording, no units, no rounding** — a ramp at
 * `slope = 1/12.5` is "1/13" to one consumer and "1/12.5" to another, and that disagreement
 * belongs to them, not here.
 */
export type MarkNote =
  /** direction shown by an arrow; stair presentation always points towards the upper landing */
  | { of: "direction"; up: boolean }
  /** a stair's proportions, exactly as `FormRun` carries them */
  | { of: "stair"; risers: number; riser: number; tread: number; going: number; rise: number }
  /** a ramp, escalator or lift. `slope` is rise over run; "1/N" is a spelling, not a number */
  | { of: "incline"; device: RunDevice; lanes: number; slope: number; rise: number };

export interface Mark {
  role: MarkRole;
  of: MarkSubject;
  /** the subject's identity: a space's or run's `path`, otherwise the Form `ref` */
  ref: string;
  /**
   * The classification `Form` gave the subject, carried through unchanged. Marks with no backing
   * entity (`seg`, `void-hatch`, the sliding marks) carry `"cut"` — they show at the cut.
   */
  class: PlanClass;
  polygon?: Pt[];
  lines?: Seg2[];
  arc?: MarkArc;
  /** where a symbol or annotation is seated. A point, never a string */
  at?: Pt;
  note?: MarkNote;
  /**
   * Place in the canonical order — the only route back to what was written. `boundary` indexes
   * `canonicalBoundaryOrder(model)`, **never `model.boundaries`** (ADR-0041): declaration order is
   * information the canonical form discards, so indexing by it reads a different boundary's `spec`
   * and nothing throws. Never parse `ref` for this.
   */
  written?: { boundary: number; index?: number };
  /** the two spaces a boundary-derived mark relates */
  pair?: { a: string; b: string };
}

/**
 * Clear distance from a wall face to a sliding door's panel, mm.
 *
 * **A drafting convention, not a derivation default.** It is not in the ledger of derivation
 * constants because no shape of the building depends on it. The actual offset from the wall
 * centreline is half the opening's wall thickness plus this gap.
 */
export const SLIDE_GAP = ARCHITECTURAL_PLAN_CONVENTION.openings.slidingGapMm;

export interface MarkOptions {
  /** override `SLIDE_GAP` */
  slideGap?: number;
}

const unit = (from: Pt, to: Pt, len: number): Pt => ({
  x: (to.x - from.x) / (len || 1),
  y: (to.y - from.y) / (len || 1),
});

type SymbolBase = Omit<Mark, "role" | "lines" | "arc">;

interface OpeningBasis {
  a: Pt;
  u: Pt;
  start: Pt;
  end: Pt;
}

const along = (p: Pt, v: Pt, d: number): Pt => ({ x: p.x + v.x * d, y: p.y + v.y * d });
const seg = (p: Pt, q: Pt): Seg2 => ({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });

function basisOf(o: FormOpening): OpeningBasis | undefined {
  const sw = o.swing;
  if (!sw) return undefined;
  return {
    a: unit(sw.hinge, sw.jamb, o.w),
    u: unit(sw.hinge, sw.leaf, o.w),
    start: sw.hinge,
    end: sw.jamb,
  };
}

const crossAbout = (centre: Pt, from: Pt, to: Pt): number =>
  (from.x - centre.x) * (to.y - centre.y) - (from.y - centre.y) * (to.x - centre.x);

function arcMark(role: "door-arc" | "window-arc", centre: Pt, from: Pt, to: Pt, base: SymbolBase): Mark {
  return {
    ...base,
    role,
    arc: {
      cx: centre.x,
      cy: centre.y,
      r: Math.hypot(from.x - centre.x, from.y - centre.y),
      from,
      to,
      ccw: crossAbout(centre, from, to) > 0,
    },
  };
}

/** One or two leaves hinged at the opening's jambs. */
function hingedMarks(
  o: FormOpening,
  meeting: number | undefined,
  leafRole: "door-leaf" | "window-leaf",
  arcRole: "door-arc" | "window-arc",
  base: SymbolBase,
): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  if (meeting === undefined) {
    const tip = along(b.start, b.u, o.w);
    return [
      { ...base, role: leafRole, lines: [seg(b.start, tip)] },
      arcMark(arcRole, b.start, tip, b.end, base),
    ];
  }
  const firstWidth = o.w * meeting;
  const secondWidth = o.w - firstWidth;
  const meet = along(b.start, b.a, firstWidth);
  const firstTip = along(b.start, b.u, firstWidth);
  const secondTip = along(b.end, b.u, secondWidth);
  return [
    { ...base, role: leafRole, lines: [seg(b.start, firstTip), seg(b.end, secondTip)] },
    arcMark(arcRole, b.start, firstTip, meet, base),
    arcMark(arcRole, b.end, secondTip, meet, base),
  ];
}

type SlideKind = "single" | "double" | "bypass";

/** Sliding leaves, offset from the wall face, with pocket guides where the leaves retract. */
function slideMarks(o: FormOpening, gap: number, kind: SlideKind, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const offset = o.t / 2 + gap;
  const s1 = along(b.start, b.u, offset);
  const s2 = along(b.end, b.u, offset);
  const centre = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
  const halfTick = o.t / 2;
  if (kind === "bypass") {
    const overlap = o.w * ARCHITECTURAL_PLAN_CONVENTION.openings.bypassOverlapRatio;
    const other1 = along(b.start, b.u, offset + gap);
    const other2 = along(b.end, b.u, offset + gap);
    const firstEnd = along(s1, b.a, o.w / 2 + overlap);
    const secondStart = along(other1, b.a, o.w / 2 - overlap);
    return [
      { ...base, role: "slide-panel", lines: [seg(s1, firstEnd), seg(secondStart, other2)] },
      { ...base, role: "slide-centre", lines: [seg(centre, along(centre, b.u, gap))] },
    ];
  }
  const panels =
    kind === "double"
      ? [seg(s1, centre), seg(centre, s2)]
      : [seg(s1, s2)];
  const panelCentres =
    kind === "double"
      ? [along(s1, b.a, o.w / 4), along(s1, b.a, (o.w * 3) / 4)]
      : [centre];
  const centreMarks = panelCentres.map((point) =>
    seg(along(point, b.u, -halfTick), along(point, b.u, halfTick))
  );
  const tails =
    kind === "double"
      ? [seg(along(s1, b.a, -o.w / 2), s1), seg(s2, along(s2, b.a, o.w / 2))]
      : [seg(along(s1, b.a, -o.w), s1)];
  return [
    { ...base, role: "slide-panel", lines: panels },
    { ...base, role: "slide-centre", lines: centreMarks },
    { ...base, role: "slide-tail", lines: tails },
  ];
}

function automaticDirectionMarks(o: FormOpening, gap: number, double: boolean, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const offset = o.t / 2 + gap;
  const start = along(b.start, b.u, offset);
  const points = double ? [along(start, b.a, o.w / 4), along(start, b.a, (o.w * 3) / 4)] : [along(start, b.a, o.w / 2)];
  const dirs = double ? [-1, 1] : [-1];
  const lines: Seg2[] = [];
  for (const [i, p] of points.entries()) {
    const tip = along(p, b.a, dirs[i]! * o.w * ARCHITECTURAL_PLAN_CONVENTION.openings.automaticDirectionRatio);
    lines.push(seg(along(p, b.u, -o.t / 4), tip), seg(along(p, b.u, o.t / 4), tip));
  }
  return [{ ...base, role: "auto-direction", lines }];
}

/** Automatic leaves park behind fixed sidelights inside the opening; no guide extends into the wall. */
function automaticDoorMarks(o: FormOpening, gap: number, double: boolean, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const offset = o.t / 2 + gap;
  const start = along(b.start, b.u, offset);
  const divisions = double ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  const points = divisions.map((ratio) => along(start, b.a, o.w * ratio));
  const panels = points.slice(0, -1).map((point, index) => seg(point, points[index + 1]!));
  const halfTick = o.t / 2;
  const ticks = points.slice(1, -1).map((point) =>
    seg(along(point, b.u, -halfTick), along(point, b.u, halfTick))
  );
  return [
    { ...base, role: "slide-panel", lines: panels },
    ...(ticks.length > 0 ? [{ ...base, role: "slide-centre" as const, lines: ticks }] : []),
    ...automaticDirectionMarks(o, gap, double, base),
  ];
}

function entranceMarks(o: FormOpening, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const half = o.t / 2;
  return [{
    ...base,
    role: "entrance",
    lines: [
      seg(b.start, b.end),
      seg(along(b.start, b.u, -half), along(b.start, b.u, half)),
      seg(along(b.end, b.u, -half), along(b.end, b.u, half)),
    ],
  }];
}

function verticalDoorMarks(
  o: FormOpening,
  role: "rolling-shutter" | "overhead-door",
  base: SymbolBase,
): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  return [{ ...base, role, lines: [seg(b.start, b.end)] }];
}

function gatePostMarks(o: FormOpening, gap: number, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const half = o.t / 2 + gap;
  return [{
    ...base,
    role: "gate-post",
    lines: [
      seg(along(b.start, b.u, -half), along(b.start, b.u, half)),
      seg(along(b.end, b.u, -half), along(b.end, b.u, half)),
    ],
  }];
}

function windowSlideMarks(o: FormOpening, kind: SlideKind, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const offset = o.t / 4;
  const nearStart = along(b.start, b.u, offset);
  const nearEnd = along(b.end, b.u, offset);
  const farStart = along(b.start, b.u, -offset);
  const farEnd = along(b.end, b.u, -offset);
  const centre = along(b.start, b.a, o.w / 2);
  if (kind === "bypass") {
    const overlap = o.w * ARCHITECTURAL_PLAN_CONVENTION.openings.bypassOverlapRatio;
    return [
      {
        ...base,
        role: "window-sash",
        lines: [
          seg(nearStart, along(nearStart, b.a, o.w / 2 + overlap)),
          seg(along(farStart, b.a, o.w / 2 - overlap), farEnd),
        ],
      },
      { ...base, role: "window-sash-centre", lines: [seg(along(centre, b.u, -offset), along(centre, b.u, offset))] },
    ];
  }
  const centreNear = along(centre, b.u, offset);
  const panels = kind === "double" ? [seg(nearStart, centreNear), seg(centreNear, nearEnd)] : [seg(nearStart, nearEnd)];
  const sashCentres =
    kind === "double"
      ? [along(nearStart, b.a, o.w / 4), along(nearStart, b.a, (o.w * 3) / 4)]
      : [centreNear];
  const centreMarks = sashCentres.map((point) =>
    seg(along(point, b.u, -o.t / 4), along(point, b.u, o.t / 4))
  );
  const tails =
    kind === "double"
      ? [seg(along(nearStart, b.a, -o.w / 2), nearStart), seg(nearEnd, along(nearEnd, b.a, o.w / 2))]
      : [seg(along(nearStart, b.a, -o.w), nearStart)];
  return [
    { ...base, role: "window-sash", lines: panels },
    { ...base, role: "window-sash-centre", lines: centreMarks },
    { ...base, role: "slide-tail", lines: tails },
  ];
}

function projectingWindowMarks(o: FormOpening, gap: number, base: SymbolBase): Mark[] {
  const b = basisOf(o);
  if (!b) return [];
  const offset = o.t / 2 + gap;
  const p1 = along(b.start, b.u, offset);
  const p2 = along(b.end, b.u, offset);
  return [{ ...base, role: "window-sash", lines: [seg(b.start, p1), seg(p1, p2), seg(p2, b.end)] }];
}

function fixedWindowMarks(o: FormOpening, lines: Seg2[], base: SymbolBase): Mark[] {
  const g = lines[0];
  if (!g) return [];
  const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1) || 1;
  const n = { x: -(g.y2 - g.y1) / len, y: (g.x2 - g.x1) / len };
  const centre = { x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2 };
  return [{
    ...base,
    role: "window-fixed",
    lines: [seg(along(centre, n, -o.t / 2), along(centre, n, o.t / 2))],
  }];
}

function curtainWallMullionMarks(o: FormOpening, base: SymbolBase): Mark[] {
  const panels = o.panels ?? 1;
  if (!Number.isInteger(panels) || panels < 2) return [];
  const length = Math.hypot(o.segment.x2 - o.segment.x1, o.segment.y2 - o.segment.y1);
  if (length <= 0) return [];
  const axis = {
    x: (o.segment.x2 - o.segment.x1) / length,
    y: (o.segment.y2 - o.segment.y1) / length,
  };
  const marks: Mark[] = [];
  for (let i = 1; i < panels; i += 1) {
    const offset = -o.w / 2 + (o.w * i) / panels;
    const cx = o.cx + axis.x * offset;
    const cy = o.cy + axis.y * offset;
    const normal = { x: -axis.y, y: axis.x };
    marks.push({
      ...base,
      role: "curtain-wall-mullion",
      lines: [seg(along({ x: cx, y: cy }, normal, -o.t / 2), along({ x: cx, y: cy }, normal, o.t / 2))],
    });
  }
  return marks;
}

const distance = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

const flightPoint = (run: FormRun, part: RunPart, t: number): Pt =>
  toPoint(run.rect, run.up, t, (part.s0 + part.s1) / 2);

const flightRise = (run: FormRun, part: RunPart): Seg2 => {
  const from = flightPoint(run, part, part.reversed ? part.t1 : part.t0);
  const to = flightPoint(run, part, part.reversed ? part.t0 : part.t1);
  return seg(from, to);
};

/**
 * Stair arrows are presentation symbols built on the run parts Form already supplied.
 *
 * The raw plan entity follows travel on the visible face and stays untouched. The paper arrow
 * instead covers the elevation interval visible on that sheet. A return stair remains one path:
 * its two flight segments are joined across the landing.
 */
function stairArrowPath(run: FormRun, plan: FormPlan, entity: PlanEntity): Seg2[] {
  const raw = entity.lines?.[0];
  if (!raw) return [];
  const flights = run.parts.filter((p) => p.kind === "flight");
  if (flights.length === 0) {
    return entity.anchor?.up === true
      ? [raw]
      : [{ x1: raw.x2, y1: raw.y2, x2: raw.x1, y2: raw.y1 }];
  }

  const cutZ = Math.min(run.z1, run.z0 + plan.cut);
  const zStart = entity.anchor?.up === true ? run.z0 : cutZ;
  const zEnd = entity.anchor?.up === true ? cutZ : run.z1;
  const out: Seg2[] = [];
  let previous: Pt | undefined;
  let previousPart: RunPart | undefined;
  for (const part of flights) {
    const lo = Math.min(part.z0, part.z1);
    const hi = Math.max(part.z0, part.z1);
    const fromZ = Math.max(zStart, lo);
    const toZ = Math.min(zEnd, hi);
    if (toZ - fromZ < 1e-6 || hi - lo < 1e-6) continue;
    const whole = flightRise(run, part);
    const point = (z: number): Pt => {
      const q = (z - lo) / (hi - lo);
      return { x: whole.x1 + (whole.x2 - whole.x1) * q, y: whole.y1 + (whole.y2 - whole.y1) * q };
    };
    const from = point(fromZ);
    const to = point(toZ);
    if (previous && previousPart && distance(previous, from) > 1) {
      const previousIndex = run.parts.indexOf(previousPart);
      const currentIndex = run.parts.indexOf(part);
      const landing = run.parts
        .slice(previousIndex + 1, currentIndex)
        .find((candidate) => candidate.kind === "landing");
      if (landing?.kind === "landing") {
        const previousLocal = runLocal(run, previous);
        const fromLocal = runLocal(run, from);
        const atT0 = Math.abs(previousLocal.t - landing.t0) <= Math.abs(previousLocal.t - landing.t1);
        const joinT = atT0 ? landing.t0 : landing.t1;
        const farT = atT0 ? landing.t1 : landing.t0;
        const flightWidth = Math.min(previousPart.s1 - previousPart.s0, part.s1 - part.s0);
        const ratio = ARCHITECTURAL_PLAN_CONVENTION.stairs.landingOffsetFlightWidthRatio;
        const offset = Math.min(Math.abs(farT - joinT) * ratio, flightWidth * ratio);
        const insideT = joinT + Math.sign(farT - joinT) * offset;
        const insidePrevious = toPoint(run.rect, run.up, insideT, previousLocal.s);
        const insideNext = toPoint(run.rect, run.up, insideT, fromLocal.s);
        out.push(seg(previous, insidePrevious), seg(insidePrevious, insideNext), seg(insideNext, from));
      } else {
        out.push(seg(previous, from));
      }
    }
    out.push(seg(from, to));
    previous = to;
    previousPart = part;
  }
  return out;
}

function runLocal(run: FormRun, point: Pt): { t: number; s: number } {
  switch (run.up) {
    case "N": return { t: point.y - run.rect.y1, s: point.x - run.rect.x1 };
    case "S": return { t: run.rect.y2 - point.y, s: run.rect.x2 - point.x };
    case "E": return { t: point.x - run.rect.x1, s: run.rect.y2 - point.y };
    case "W": return { t: run.rect.x2 - point.x, s: point.y - run.rect.y1 };
  }
}

function stairCutLine(run: FormRun, cut: number): Seg2 | undefined {
  const cutZ = Math.min(run.z1, run.z0 + cut);
  for (const part of run.parts) {
    if (part.kind !== "flight") continue;
    const lo = Math.min(part.z0, part.z1);
    const hi = Math.max(part.z0, part.z1);
    if (cutZ < lo - 1e-6 || cutZ > hi + 1e-6 || hi - lo < 1e-6) continue;
    const q = (cutZ - part.z0) / (part.z1 - part.z0);
    const t = part.t0 + (part.t1 - part.t0) * q;
    const a = toPoint(run.rect, run.up, t, part.s0);
    const b = toPoint(run.rect, run.up, t, part.s1);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  return undefined;
}

function stairTreadAtOrAboveCut(run: FormRun, tread: Seg2, cut: number): boolean {
  const mid = { x: (tread.x1 + tread.x2) / 2, y: (tread.y1 + tread.y2) / 2 };
  const local = runLocal(run, mid);
  const part = run.parts.find((candidate) =>
    candidate.kind === "flight" &&
    local.t >= candidate.t0 - 1 && local.t <= candidate.t1 + 1 &&
    local.s >= candidate.s0 - 1 && local.s <= candidate.s1 + 1,
  );
  if (!part || part.kind !== "flight" || Math.abs(part.t1 - part.t0) < 1e-6) return true;
  const q = (local.t - part.t0) / (part.t1 - part.t0);
  const z = part.z0 + (part.z1 - part.z0) * q;
  return z >= run.z0 + cut - 1e-6;
}

function sameLine(a: Seg2, b: Seg2): boolean {
  const direct = distance({ x: a.x1, y: a.y1 }, { x: b.x1, y: b.y1 }) < 1 &&
    distance({ x: a.x2, y: a.y2 }, { x: b.x2, y: b.y2 }) < 1;
  const reverse = distance({ x: a.x1, y: a.y1 }, { x: b.x2, y: b.y2 }) < 1 &&
    distance({ x: a.x2, y: a.y2 }, { x: b.x1, y: b.y1 }) < 1;
  return direct || reverse;
}

function stairVisibleBoundaryLines(run: FormRun, plan: FormPlan, entity: PlanEntity): Seg2[] {
  const cutZ = Math.min(run.z1, run.z0 + plan.cut);
  const z0 = entity.anchor?.up === true ? run.z0 : cutZ;
  const z1 = entity.anchor?.up === true ? cutZ : run.z1;
  const out: Seg2[] = [];
  for (const part of run.parts) {
    if (part.kind !== "flight") continue;
    for (const [t, z] of [[part.t0, part.z0], [part.t1, part.z1]] as const) {
      if (z < z0 - 1e-6 || z > z1 + 1e-6) continue;
      const a = toPoint(run.rect, run.up, t, part.s0);
      const b = toPoint(run.rect, run.up, t, part.s1);
      const boundary = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      if (!out.some((existing) => sameLine(existing, boundary))) out.push(boundary);
    }
  }
  return out;
}

/**
 * The marks drawn on one level's plan, from `Form`.
 *
 * **The model is not read.** Grid lines, `area` frames, space names, the north arrow and the sheet
 * title are written givens, and the consumer draws them separately from what it wrote. Returns an
 * empty list where the level has no plan.
 */
export function planMarks(form: Form, level: string, opts?: MarkOptions): Mark[] {
  const plan = form.plans.find((p) => p.level === level);
  if (!plan) return [];
  const gap = opts?.slideGap ?? SLIDE_GAP;
  const marks: Mark[] = [];
  const S = new Map(form.spaces.map((s) => [s.path, s]));
  const B = new Map(form.boundaries.map((b) => [b.ref, b]));
  const O = new Map(form.openings.map((o) => [o.ref, o]));
  const R = new Map(form.runs.map((r) => [r.path, r]));

  // ---- spaces ----
  for (const e of plan.entities) {
    if (e.of !== "space" || e.class !== "cut" || !e.polygon) continue;
    const s = S.get(e.ref);
    // A void is a **declaration** (`void:1`), not a word in the type vocabulary (ADR-0051), and
    // `Form` carries that fact through as `FormSpace.void`.
    if (s?.void) {
      const r = polyBounds(e.polygon);
      marks.push({ role: "space-void", of: "space", ref: e.ref, class: "cut", polygon: e.polygon });
      marks.push({
        role: "void-hatch",
        of: "space",
        ref: e.ref,
        class: "cut",
        lines: [
          { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 },
          { x1: r.x1, y1: r.y2, x2: r.x2, y2: r.y1 },
        ],
      });
      continue;
    }
    marks.push({
      // **Outside is asked first.** A space declared `outside:1` that also carries an `open` or
      // `air:1` boundary to another outside space derives as semi-outdoor too, and of the two
      // facts the declared one is the one that decides what the space is
      role: s?.outside ? "space-outdoor" : s?.semiOutdoor ? "space-semi-outdoor" : "space",
      of: "space",
      ref: e.ref,
      class: "cut",
      polygon: e.polygon,
    });
  }

  // ---- boundaries ----
  // **What says a boundary has matter is the presence of `polygon`, not a lookup on the boundary.**
  // Read `lines` first and every wall falls into the `open` branch — the whole drawing turns to
  // dashes with not one black band in it. That regression is real; it has happened.
  //
  // The order matters as much. Asking "is this class dropped?" before "is this a rail?" draws no
  // handrail at all: a rail stands 1100 high and the plane cuts at 1200, so every rail interval is
  // classified `below` and a class-first branch discards the lot in silence.
  for (const e of plan.entities) {
    if (e.of !== "boundary") continue;
    const b = B.get(e.ref);
    const base = {
      of: "boundary" as const,
      ref: e.ref,
      ...(b ? { written: { boundary: b.boundary }, pair: { a: b.a, b: b.b } } : {}),
    };
    if (!e.polygon) {
      if (e.lines) marks.push({ ...base, role: "open", class: e.class, lines: e.lines });
      continue;
    }
    if (b?.air) {
      // Something that does not enclose is drawn as its axis, not as a body — that the space is
      // not shut is readable from the drawing. `Form` carries the axis, so it is never recovered
      // from the footprint.
      if (e.class !== "above" && e.lines) marks.push({ ...base, role: "rail", class: e.class, lines: e.lines });
      continue;
    }
    if (e.class === "cut") marks.push({ ...base, role: "wall", class: "cut", polygon: e.polygon });
  }

  // ---- segments that do not count — no area, no graph, but a derived position ----
  for (const g of form.segs) {
    if (g.level !== level) continue;
    marks.push({
      role: "seg",
      of: "seg",
      ref: g.ref,
      class: "cut",
      polygon: band(g.segment, g.cx, g.cy, g.w, g.t),
      written: { boundary: g.boundary, index: g.index },
    });
  }

  // ---- openings ----
  for (const e of plan.entities) {
    if (e.of !== "opening") continue;
    const o = O.get(e.ref);
    if (!o) continue;
    const base = {
      of: "opening" as const,
      ref: e.ref,
      written: { boundary: o.boundary, index: o.index },
      pair: { a: o.a, b: o.b },
    };
    if (e.class === "swing") {
      const symbolBase = { ...base, class: "swing" as const };
      const style = o.style;
      if (o.kind === "window") {
        if (style === "hinged") marks.push(...hingedMarks(o, undefined, "window-leaf", "window-arc", symbolBase));
        else if (style === "hinged-double") marks.push(...hingedMarks(o, 0.5, "window-leaf", "window-arc", symbolBase));
        else if (style === "sliding") marks.push(...windowSlideMarks(o, "single", symbolBase));
        else if (style === "sliding-double") marks.push(...windowSlideMarks(o, "double", symbolBase));
        else if (style === "sliding-bypass") marks.push(...windowSlideMarks(o, "bypass", symbolBase));
        else if (style === "projecting") marks.push(...projectingWindowMarks(o, gap, symbolBase));
        continue;
      }
      if (style === undefined || style === "hinged") marks.push(...hingedMarks(o, undefined, "door-leaf", "door-arc", symbolBase));
      else if (style === "sliding") marks.push(...slideMarks(o, gap, "single", symbolBase));
      else if (style === "sliding-double") marks.push(...slideMarks(o, gap, "double", symbolBase));
      else if (style === "sliding-bypass") marks.push(...slideMarks(o, gap, "bypass", symbolBase));
      else if (style === "auto-single") {
        marks.push(...automaticDoorMarks(o, gap, false, symbolBase));
      } else if (style === "auto" || style === "auto-double") {
        marks.push(...automaticDoorMarks(o, gap, true, symbolBase));
      } else if (style === "entrance") marks.push(...entranceMarks(o, symbolBase));
      else if (style === "rolling-shutter") marks.push(...verticalDoorMarks(o, "rolling-shutter", symbolBase));
      else if (style === "overhead") marks.push(...verticalDoorMarks(o, "overhead-door", symbolBase));
      else if (style === "hinged-double") marks.push(...hingedMarks(o, 0.5, "door-leaf", "door-arc", symbolBase));
      else if (style === "hinged-unequal") marks.push(...hingedMarks(
        o,
        ARCHITECTURAL_PLAN_CONVENTION.openings.unequalLeafMeetingRatio,
        "door-leaf",
        "door-arc",
        symbolBase,
      ));
      else if (style === "gate-hinged") {
        marks.push(...gatePostMarks(o, gap, symbolBase));
        marks.push(...hingedMarks(o, undefined, "door-leaf", "door-arc", symbolBase));
      } else if (style === "gate-hinged-double") {
        marks.push(...gatePostMarks(o, gap, symbolBase));
        marks.push(...hingedMarks(o, 0.5, "door-leaf", "door-arc", symbolBase));
      } else if (style === "gate-sliding") {
        marks.push(...gatePostMarks(o, gap, symbolBase));
        marks.push(...slideMarks(o, gap, "single", symbolBase));
      }
      continue;
    }
    // No class filter, so a clerestory above the cut arrives as a `window` too. `Mark.class` puts
    // that fact in the consumer's hand instead of hiding it.
    if (o.kind !== "door" && e.lines) {
      marks.push({
        ...base,
        role: "window",
        class: e.class,
        lines: e.lines,
        ...(e.polygon ? { polygon: e.polygon } : {}),
      });
      if (o.style === "fixed" && e.class === "cut") {
        marks.push(...fixedWindowMarks(o, e.lines, { ...base, class: "cut" }));
      } else if (o.style === "curtain-wall" && e.class === "cut") {
        marks.push(...curtainWallMullionMarks(o, { ...base, class: "cut" }));
      }
    }
  }

  // ---- columns (written nowhere — they appear where grid lines meet a floor) ----
  for (const e of plan.entities) {
    if (e.of === "column" && e.polygon) {
      marks.push({ role: "column", of: "column", ref: e.ref, class: e.class, polygon: e.polygon });
    }
  }

  // ---- vertical circulation — the ascending run is cut, and beyond it the descending run shows ----
  for (const e of plan.entities) {
    if (e.of !== "run") continue;
    const base = { of: "run" as const, ref: e.ref };
    if (e.role === "outline" && e.lines) marks.push({ ...base, role: "run-outline", class: e.class, lines: e.lines });
    else if (e.role === "tread" && e.lines) {
      const run = R.get(e.ref);
      const lines = run?.device === "stair" && e.class === "below"
        ? e.lines.filter((tread) => stairTreadAtOrAboveCut(run, tread, plan.cut))
        : e.lines;
      if (lines.length > 0) marks.push({ ...base, role: "run-tread", class: e.class, lines });
    }
    else if (e.role === "break" && e.lines) marks.push({ ...base, role: "run-break", class: "cut", lines: e.lines });
    else if (e.role === "arrow" && e.lines) {
      const run = R.get(e.ref);
      // Form keeps the direction of travel on each visible face. On a conventional stair plan the
      // presentation arrow means one thing instead: increasing elevation. The run arriving from
      // below therefore starts on its lower visible part and points into this level. Reverse only
      // stair arrows here; escalators retain their actual operating direction.
      const lines = run?.device === "stair" ? stairArrowPath(run, plan, e) : e.lines;
      if (run?.device === "stair" && lines.length > 0) {
        if (e.class === "below") {
          const cut = stairCutLine(run, plan.cut);
          const existingBreaks = marks
            .filter((mark) => mark.role === "run-break")
            .flatMap((mark) => mark.lines ?? []);
          if (cut && !existingBreaks.some((existing) => sameLine(existing, cut))) {
            marks.push({ ...base, role: "run-break", class: "cut", lines: [cut] });
          }
        }
        const existingTreads = marks
          .filter((mark) => mark.role === "run-tread" && mark.ref === e.ref)
          .flatMap((mark) => mark.lines ?? []);
        const boundaries = stairVisibleBoundaryLines(run, plan, e)
          .filter((boundary) => !existingTreads.some((existing) => sameLine(existing, boundary)));
        if (boundaries.length > 0) {
          marks.push({ ...base, role: "run-tread", class: e.class, lines: boundaries });
        }
        marks.push({
          ...base,
          role: "run-arrow",
          class: e.class,
          lines,
          at: { x: lines[0]!.x1, y: lines[0]!.y1 },
          note: { of: "direction", up: true },
        });
      } else {
        for (const g of lines) {
          marks.push({
            ...base,
            role: "run-arrow",
            class: e.class,
            lines: [g],
            at: { x: g.x1, y: g.y1 },
            note: { of: "direction", up: e.anchor?.up === true },
          });
        }
      }
    } else if (e.class === "anchor" && e.anchor) {
      const r = R.get(e.ref);
      if (!r) continue;
      marks.push({
        ...base,
        role: "run-note",
        class: "anchor",
        at: { x: e.anchor.x, y: e.anchor.y },
        note:
          r.device === "stair"
            ? { of: "stair", risers: r.risers, riser: r.riser, tread: r.tread, going: r.going, rise: r.rise }
            : { of: "incline", device: r.device, lanes: r.lanes, slope: r.slope, rise: r.rise },
      });
    }
  }

  // ---- the void above, dropped onto the plan below ----
  for (const e of plan.entities) {
    if (e.class !== "above" || e.of !== "space" || !e.polygon) continue;
    const r = polyBounds(e.polygon);
    marks.push({
      role: "void-above",
      of: "space",
      ref: e.ref,
      class: "above",
      polygon: e.polygon,
      at: { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 },
    });
  }

  return marks;
}
