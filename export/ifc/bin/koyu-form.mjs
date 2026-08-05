#!/usr/bin/env node
// Put one koyu building into the single JSON document the IFC export reads.
//
// It takes two things, because **the Form holds shape and no attributes, and the canonical JSON
// holds attributes and no shape.** A space's `uid` and `name` are not in the Form at all, and a
// space declaring `outside:1` never appears there. They are joined by path.
//
// **Matter is raised here, by koyu's own constructors — never on the far side.** `Form` carries
// centre lines, thicknesses and z; turning those into outlines is part of the derivation, and
// there is exactly one implementation of it. Rewriting `thicken` in Python would share the parts
// while forking the rules of assembly, which is how one composition comes to have two shapes. So
// wall quadrilaterals, opening bands, column sections and run prisms all leave here as plain
// point lists, and the far side only writes IFC entities.
//
// **Imports come from `dist/` only.** Reading `src/` would exercise the implementation on this
// machine rather than the face that ships. `test/domains.test.ts` holds that.

import { toCanonical } from "../../../dist/index.js";
import { band, columnRect, derive, runPrism, thicken } from "../../../dist/form.js";
import { parseFile } from "../../../dist/parse-file.js";

const entry = process.argv[2];
if (!entry) {
  process.stderr.write("Usage: koyu-form <entry.muro>\n");
  process.exit(2);
}

const ring = (points) => points.map((p) => [p.x, p.y]);

const model = parseFile(entry);
const form = derive(model);

// One entry per FormBoundary, in the Form's own order — the index within a `ref` is what makes a
// wall's identity, so this order is contractual and never sorted.
const walls = form.boundaries.map((b) => ({
  ref: b.ref,
  a: b.a,
  b: b.b,
  kind: b.kind,
  derived: b.derived,
  level: b.level,
  air: b.air,
  segment: b.segment,
  material: b.material
    ? {
        t: b.material.t,
        z0: b.material.z0,
        z1: b.material.z1,
        outline: ring(thicken(b.segment.x1, b.segment.y1, b.segment.x2, b.segment.y2, b.material.t)),
        panels: b.material.panels,
      }
    : undefined,
}));

const openings = form.openings.map((o) => ({
  ref: o.ref,
  a: o.a,
  b: o.b,
  kind: o.kind,
  name: o.name,
  level: o.level,
  segment: o.segment,
  w: o.w,
  z0: o.z0,
  z1: o.z1,
  t: o.t,
  style: o.style,
  sliding: o.sliding,
  // The band the opening occupies, and the same band widened across the wall so the cut is clean
  // where the two faces would otherwise be coplanar.
  outline: ring(band(o.segment, o.cx, o.cy, o.w, o.t)),
  cutOutline: ring(band(o.segment, o.cx, o.cy, o.w, o.t + 2)),
}));

const segs = form.segs.map((s) => ({
  ref: s.ref,
  level: s.level,
  w: s.w,
  t: s.t,
  outline: ring(band(s.segment, s.cx, s.cy, s.w, s.t)),
}));

const columns = form.columns.map((c) => ({
  ref: c.ref,
  level: c.level,
  z0: c.z0,
  z1: c.z1,
  outline: ring(columnRect(c)),
  attrs: c.attrs,
}));

// A run's solids become prisms — an outline plus a bottom and top z at every vertex. A box gets
// four equal tops; an inclined slab gets tops that rise along the run. Both come out of koyu's
// own `runPrism`, so a ramp is never sloped one way here and another way on paper.
const runs = form.runs.map((r) => ({
  path: r.path,
  device: r.device,
  form: r.form,
  level: r.level,
  upper: r.upper,
  z0: r.z0,
  z1: r.z1,
  rise: r.rise,
  up: r.up,
  lanes: r.lanes,
  risers: r.risers,
  riser: r.riser,
  tread: r.tread,
  slope: r.slope,
  going: r.going,
  solids: r.solids.map((s) => {
    const prism = runPrism(s);
    return { kind: s.kind, outline: ring(prism.poly), bottom: prism.bottom, top: prism.top };
  }),
}));

process.stdout.write(
  JSON.stringify({
    entry,
    canonical: JSON.parse(toCanonical(model)),
    levels: form.levels,
    spaces: form.spaces.map((s) => ({ ...s, outline: s.outline.map(ring) })),
    walls,
    openings,
    segs,
    slabs: form.slabs.map((s) => ({ ...s, outline: ring(s.outline) })),
    columns,
    runs,
    site: form.site.map((s) => ({ ...s, points: ring(s.points) })),
  }),
);
