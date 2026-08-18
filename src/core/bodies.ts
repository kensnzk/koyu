// koyu — every body of a Form, in the one shape every body reduces to.
//
// **This composes no matter.** Each body was already raised by `derive`, and the constructors
// called to raise the rest (`band` / `bandLine` / `columnRect` / `runPrism`) are the published
// ones. The enumeration lives here rather than inside the section because it is not the section's:
// a vertical plane cuts these bodies, a 3D scene meshes them, and an isometric paints them. Three
// readers, one list. Written twice, the second copy silently loses whatever `derive` adds next —
// which is the failure ADR-0040 already paid for once.
//
// **What it does not decide.** Which bodies a given drawing may use is the drawing's judgement,
// not the enumeration's. A section drops outside and semi-outdoor spaces because cutting one
// paints a garden as a room; a 3D scene keeps them because a garden is a thing you see. So the
// list is complete here and narrowed at each call site.
import { band, bandLine, columnRect, runPrism, type Form } from "./derive.js";
import type { Pt } from "./model.js";
import type { Seg2 } from "./vertical.js";

/** What a body stands for. */
export type FormSubject = "space" | "boundary" | "opening" | "column" | "slab" | "run";

/** A body of the Form, in the one shape every body reduces to. */
export interface FormBody {
  of: FormSubject;
  ref: string;
  kind?: string;
  poly: Pt[];
  /** underside z per vertex, mm. `bottom.length === poly.length` */
  bottom: number[];
  /** upper z per vertex, mm. `top.length === poly.length` */
  top: number[];
  /**
   * The axis of a wall body or an opening leaf. **Carried because it cannot be read off `poly`** —
   * a junction takes the body off its own centre line, so the midpoints of opposing sides are not
   * the axis (see `FormPanel` in derive.ts). Recovering it on the drawing side puts a handrail
   * beside itself at every corner.
   */
  centre?: Seg2;
}

/** Every body of the Form, in canonical order. **The order is inherited, never re-established.** */
export function formBodies(form: Form): FormBody[] {
  const out: FormBody[] = [];
  const flat = (poly: Pt[], z0: number, z1: number): Pick<FormBody, "poly" | "bottom" | "top"> => ({
    poly,
    bottom: poly.map(() => z0),
    top: poly.map(() => z1),
  });

  // Spaces come first because space is the primary element.
  for (const s of form.spaces) {
    if (s.z0 === undefined || s.z1 === undefined) continue; // no ceiling height, no volume (SUF01)
    for (const piece of s.outline) {
      out.push({ of: "space", ref: s.path, ...(s.type ? { kind: s.type } : {}), ...flat(piece, s.z0, s.z1) });
    }
  }
  for (const b of form.boundaries) {
    if (!b.material) continue; // type:open — a relation with no matter
    for (const p of b.material.panels) {
      out.push({
        of: "boundary",
        ref: b.ref,
        kind: b.kind,
        ...flat(p.footprint, p.z0, p.z1),
        centre: { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 },
      });
    }
  }
  for (const o of form.openings) {
    out.push({
      of: "opening",
      ref: o.ref,
      kind: o.kind,
      ...flat(band(o.segment, o.cx, o.cy, o.w, o.t), o.z0, o.z1),
      centre: bandLine(o.segment, o.cx, o.cy, o.w),
    });
  }
  for (const c of form.columns) {
    out.push({ of: "column", ref: c.ref, ...flat(columnRect(c), c.z0, c.z1) });
  }
  for (const sl of form.slabs) {
    out.push({ of: "slab", ref: sl.space, kind: sl.kind, ...flat(sl.outline, sl.z0, sl.z1) });
  }
  for (const run of form.runs) {
    for (const s of run.solids) {
      const pr = runPrism(s);
      out.push({ of: "run", ref: run.path, kind: run.device, poly: pr.poly, bottom: pr.bottom, top: pr.top });
    }
  }
  return out;
}
