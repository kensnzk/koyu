// koyu — the marks of a plan (`@kensnzk/koyu/draw`)
//
// **This copies `Form`'s 2D entities into marks. Not one rule of geometry lives here.** Wall
// thickness, the intervals an opening splits a wall into, a door swing's centre and radius and
// sweep, where a run is cut, the projection of the void above — all of it is already in the `Form`
// that `derive(model)` returns (ADR-0040). What is decided here is *which* of those entities
// becomes a mark and what the mark stands for.
//
// **A plan is not a pure section.** Door swings, the projection of the void above, break lines and
// the descending run do not fall out of cutting a solid, however exactly it is cut. So `Form` hands
// the plan over as entities carrying a class (cut / below / above / swing / anchor), and this page
// reads that class rather than re-deciding it.
//
// **No words and no style.** `Form` carries no colour, no line type and no annotation wording
// (docs/reference/scope.md), and neither does a mark. "UP", "DN", 「上部吹抜け」 and 「12段
// 蹴上180/踏面240」 are the consumer's — three consumers spell three different sets of them today,
// and a mark that carried one would make koyu's language mix everyone's. A mark carries the seat
// (`at`) and the unrounded facts (`note`); the words are put on at the far end.
import { band, type Form, type FormOpening, type PlanClass, type PlanEntity } from "../core/derive.js";
import { polyBounds, type Pt } from "../core/model.js";
import type { RunDevice, Seg2 } from "../core/vertical.js";

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
  /** a non-door opening's centreline */
  | "window"
  /** hinge to leaf tip */
  | "door-leaf"
  /** the swing trace */
  | "door-arc"
  /** a sliding door's pocket panel */
  | "slide-panel"
  /** its setback line */
  | "slide-tail"
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
  /** direction of travel at an arrow's tail */
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
   * entity (`seg`, `void-hatch`, the two sliding marks) carry `"cut"` — they show at the cut.
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
 * Setback of a sliding door's pocket panel from the wall face, mm.
 *
 * **A drafting convention, not a derivation default.** It is not in the ledger of derivation
 * constants because no shape of the building depends on it; all three implementations spell 110.
 */
export const SLIDE_POCKET = 110;

export interface MarkOptions {
  /** override `SLIDE_POCKET` */
  slidePocket?: number;
}

const unit = (from: Pt, to: Pt, len: number): Pt => ({
  x: (to.x - from.x) / (len || 1),
  y: (to.y - from.y) / (len || 1),
});

/** A sliding or automatic door: no swing trace — a panel set back on the hinge side, and its tail. */
function slideMarks(o: FormOpening, pocket: number, base: Omit<Mark, "role" | "lines">): Mark[] {
  const sw = o.swing;
  if (!sw) return [];
  const { hinge } = sw;
  const u = unit(hinge, sw.leaf, o.w); // towards the side it opens onto
  const a = unit(hinge, sw.jamb, o.w); // along the segment
  const s1 = { x: hinge.x - a.x * o.w + u.x * pocket, y: hinge.y - a.y * o.w + u.y * pocket };
  const s2 = { x: hinge.x + u.x * pocket, y: hinge.y + u.y * pocket };
  return [
    { ...base, role: "slide-panel", lines: [{ x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }] },
    { ...base, role: "slide-tail", lines: [{ x1: s2.x, y1: s2.y, x2: hinge.x, y2: hinge.y }] },
  ];
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
  const pocket = opts?.slidePocket ?? SLIDE_POCKET;
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
      if (o.sliding) {
        marks.push(...slideMarks(o, pocket, { ...base, class: "swing" }));
        continue;
      }
      if (e.lines) marks.push({ ...base, role: "door-leaf", class: "swing", lines: e.lines });
      if (e.arc) marks.push({ ...base, role: "door-arc", class: "swing", arc: e.arc });
      continue;
    }
    // No class filter, so a clerestory above the cut arrives as a `window` too. `Mark.class` puts
    // that fact in the consumer's hand instead of hiding it.
    if (o.kind !== "door" && e.lines) marks.push({ ...base, role: "window", class: e.class, lines: e.lines });
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
    else if (e.role === "tread" && e.lines) marks.push({ ...base, role: "run-tread", class: e.class, lines: e.lines });
    else if (e.role === "break" && e.lines) marks.push({ ...base, role: "run-break", class: "cut", lines: e.lines });
    else if (e.role === "arrow" && e.lines) {
      marks.push({
        ...base,
        role: "run-arrow",
        class: e.class,
        lines: e.lines,
        ...(e.anchor ? { at: { x: e.anchor.x, y: e.anchor.y } } : {}),
        note: { of: "direction", up: e.anchor?.up === true },
      });
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
