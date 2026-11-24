// koyu — the section and the elevation (ADR-0064)
//
// **There is not one rule of shape here.** Which bodies the plane crossed, which stand behind it,
// where each one lands on the sheet and how far back it is — all of that arrives in the
// `FormSection` that `sectionForm` returns. This page decides the ink, the line weights, the
// stacking, the words of the annotation, the scale and the margins, and nothing else. That is the
// same division `plan.ts` keeps, and it makes this the thinnest of the drawings: it performs no
// geometry at all.
//
// **One renderer, two entry points.** An elevation is a section whose plane misses the mass, so
// `cut` comes back empty and everything is `beyond`. Writing it as a second renderer would be
// writing the same painter twice and inviting the two to drift.

import { derive, type DeriveOptions, type Form } from "../core/derive.js";
import { displayName, frameGridRef, gridRef, gridPoint, namedAxisGeometry, yGridAt, type Edge, type Model } from "../core/model.js";
import {
  defaultLook,
  elevationForm,
  sectionForm,
  type FormSection,
  type LineFormSection,
  type SectionLine,
  type SectionAxis,
  type SectionEntity,
  type SectionPt,
} from "../core/section.js";
import { esc, Extent, memberInk, openSheet, r2, sheetPalette, subjectAttrs, type SheetOptions } from "./sheet.js";

export interface SectionOptions extends Pick<DeriveOptions, "roofSketches">, SheetOptions {
  /** which axis the plane is named on. `"X"` means the plane `x = at` */
  axis: SectionAxis;
  /** where the plane sits, world mm */
  at: number;
  /** the grid reference it was named by — it goes on the sheet, so the reader can find the cut */
  atRef?: string;
  /** the direction of view. Defaults to W across an X plane and N across a Y plane */
  look?: Edge;
  /** px per mm (default 0.05, the same as a plan, so the two can be laid side by side) */
  scale?: number;
  /** caller-supplied reference geometry in the section's `(u,z)` frame */
  guides?: SectionGuide[];
}

/** A section whose plane follows a directed line in plan. */
export interface LineSectionOptions extends Pick<DeriveOptions, "roofSketches">, SheetOptions {
  cut: SectionLine;
  /** a caller-owned name for the cut */
  atRef?: string;
  /** px per mm */
  scale?: number;
  /** caller-supplied reference geometry in the section's `(u,z)` frame */
  guides?: SectionGuide[];
}

/** A reference polyline drawn over a section without becoming part of the building Form. */
export interface SectionGuide {
  points: SectionPt[];
  label?: string;
  showVertices?: boolean;
}

export interface ElevationOptions extends Pick<DeriveOptions, "roofSketches">, SheetOptions {
  /** the side the viewer stands on. `S` is the south elevation, seen from the south */
  face: Edge;
  /** Read the face in this rotated grid frame. Omit to use world directions. */
  frame?: string;
  /** px per mm */
  scale?: number;
}

/** Directed section line for an oblique primary or supplementary reference. */
export function referenceCut(model: Model, at: string, reverse = false): SectionLine | undefined {
  const named = namedAxisGeometry(model, at);
  let endpoints;
  if (named) {
    endpoints = [named.a, named.b] as const;
  } else {
    const ref = gridRef(model, at);
    if (ref?.axis !== "Y" || !model.grid.Y.slope) return;
    const x = model.grid.X.coords[0] ?? 0;
    const xEnd = x + 1000;
    endpoints = [{ x, y: yGridAt(model, ref.coord, x) }, { x: xEnd, y: yGridAt(model, ref.coord, xEnd) }] as const;
  }
  const [a, b] = reverse ? [endpoints[1], endpoints[0]] : endpoints;
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

export function svgSection(model: Model, opts: SectionOptions | LineSectionOptions): string {
  const form = derive(model, { roofSketches: opts.roofSketches });
  if ("cut" in opts) {
    const section = sectionForm(form, {
      cut: opts.cut,
      ...(opts.atRef !== undefined ? { atRef: opts.atRef } : {}),
    });
    const where = opts.atRef ?? `(${opts.cut.x1}, ${opts.cut.y1})–(${opts.cut.x2}, ${opts.cut.y2})`;
    return sheet(model, form, section, opts, `${model.name ?? "Untitled"} — section along ${where}`, opts.guides);
  }
  const look = opts.look ?? defaultLook(opts.axis);
  const section = sectionForm(form, {
    axis: opts.axis,
    at: opts.at,
    ...(opts.atRef !== undefined ? { atRef: opts.atRef } : {}),
    look,
  });
  const where = opts.atRef ?? `${opts.axis} ${opts.at}`;
  return sheet(
    model,
    form,
    section,
    opts,
    `${model.name ?? "Untitled"} — section at ${where} looking ${look}`,
    opts.guides,
  );
}

export function svgElevation(model: Model, opts: ElevationOptions): string {
  const form = derive(model, { roofSketches: opts.roofSketches });
  if (opts.frame !== undefined) {
    const grid = model.frames?.get(opts.frame);
    if (!grid) throw new Error(`Undefined grid frame: ${opts.frame}`);
    const section = elevationForm(form, opts.face, grid);
    const family = opts.face === "S" || opts.face === "N" ? 1 : 0;
    return sheet(model, form, section, opts, `${model.name ?? "Untitled"} — ${opts.frame} ${opts.face} elevation`,
      [], grid.name[family] + "1");
  }
  const section = elevationForm(form, opts.face);
  return sheet(model, form, section, opts, `${model.name ?? "Untitled"} — ${opts.face} elevation`);
}

/**
 * The stacking order, back to front.
 *
 * What is behind the plane is painted **far first**, so a nearer body covers a further one. That is
 * the painter's algorithm ADR-0026 already accepted as enough for a drawing meant to check with,
 * and here it is stronger than it is for an axonometric: there is one depth axis rather than the
 * sum of three, so the order is exact whenever two bodies do not interpenetrate — and
 * interpenetration in section is a contradiction `check` already reports (HGT01 / HGT02).
 */
function sheet(
  model: Model,
  form: Form,
  section: FormSection | LineFormSection,
  opts: SheetOptions & { scale?: number },
  heading: string,
  guides: SectionGuide[] = [],
  parallelGridLine?: string,
): string {
  const palette = sheetPalette(opts.drawingStyle);
  const s = opts.scale ?? 0.05;

  // **Folded, never spread** — a wall is one body per interval, so a large building runs past the
  // limit on how many arguments a call may take.
  const ext = new Extent();
  for (const e of section.entities) for (const p of e.polygon) ext.see(p.u, p.z);
  for (const guide of guides) {
    for (const p of guide.points) if (Number.isFinite(p.u) && Number.isFinite(p.z)) ext.see(p.u, p.z);
  }
  if (ext.empty) throw new Error("There is nothing to draw");
  const minU = ext.min0;
  const maxU = ext.max0;
  // **A level with no matter on it still has a datum**, so the storey ladder widens the height of
  // the sheet on its own — leave it out and a roof level declared without spaces falls off it.
  let minZ = ext.min1;
  let maxZ = ext.max1;
  for (const l of form.levels) {
    if (l.z < minZ) minZ = l.z;
    if (l.z > maxZ) maxZ = l.z;
  }

  const ML = 132; // the left margin carries the level names and their heights
  const MR = 84;
  const MT = 84;
  const MB = 84;
  const W = (maxU - minU) * s + ML + MR;
  const H = (maxZ - minZ) * s + MT + MB;
  const sx = (u: number): number => r2((u - minU) * s + ML);
  const sy = (z: number): number => r2((maxZ - z) * s + MT); // z is up on the page
  const path2d = (poly: SectionPt[]): string =>
    poly.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.u)} ${sy(p.z)}`).join(" ") + " Z";

  const parts: string[] = openSheet(W, H, palette);

  // ---- the air the plane opened ----
  // Behind everything, because it is not a surface. It is the storey's volume, and it shows only
  // where nothing stands behind the plane to be seen instead.
  for (const e of section.entities) {
    if (e.class !== "cut" || e.of !== "space") continue;
    parts.push(`<path d="${path2d(e.polygon)}" fill="${palette.room}"/>`);
  }

  // ---- what stands behind the plane, far first ----
  // An opening sits inside the wall it pierces, at the same distance, so it is painted after the
  // walls of its own depth rather than being sorted against them by a tie nobody decided.
  const beyond = section.entities
    .filter((e) => e.class === "beyond")
    .sort((a, b) => b.depth - a.depth || rank(a) - rank(b));
  for (const e of beyond) {
    const face = e.of === "opening" ? palette.glass : memberInk(palette, e.of) ?? palette.beyond;
    parts.push(
      `<path ${subjectAttrs(e.of, e.ref)} d="${path2d(e.polygon)}" fill="${face}" stroke="${e.polygon.length === 2 ? face : palette.ink}" stroke-width="${e.polygon.length === 2 ? 1.2 : 0.35}" stroke-opacity="0.5"/>`,
    );
  }

  // ---- the storey ladder ----
  // A level datum is to a section what a grid line is to a plan, so it is drawn as one.
  for (const l of form.levels) {
    if (l.z < minZ - 1 || l.z > maxZ + 1) continue;
    parts.push(
      `<line x1="${ML - 26}" y1="${sy(l.z)}" x2="${W - MR + 26}" y2="${sy(l.z)}" stroke="${palette.grid}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<text x="${ML - 34}" y="${sy(l.z) - 4}" text-anchor="end" font-size="10" fill="${palette.grid}">${esc(l.name)}</text>`,
      `<text x="${ML - 34}" y="${sy(l.z) + 9}" text-anchor="end" font-size="8.5" fill="${palette.faint}">${l.z >= 0 ? "+" : ""}${l.z}</text>`,
    );
  }

  // ---- the ground ----
  // **koyu holds no ground level.** `origin elevation:` is the height of model z = 0 in a vertical
  // reference system and says so on its own page — it is not GL, not 地盤面, not 平均地盤面. So this
  // line is a convention of the sheet, exactly like the slab `axo` puts under a building, and the
  // reference page says so. It is drawn at z = 0 because that is where the ground storey sits in
  // every model that does not say otherwise, and because nothing in the source can say otherwise.
  if (minZ - 1 <= 0 && 0 <= maxZ + 1) {
    parts.push(
      `<line x1="0" y1="${sy(0)}" x2="${W}" y2="${sy(0)}" stroke="${palette.ink}" stroke-width="1.2"/>`,
      `<text x="${W - MR + 26}" y="${sy(0) + 14}" text-anchor="end" font-size="8" fill="${palette.label}">z 0</text>`,
    );
  }

  // ---- the grid, along the sheet ----
  // The axis the plane is named on gets no bubbles — every one of its lines would land on the same
  // point. The other axis is what runs across the sheet, so that is the one that marks it.
  const gridMarks: { name: string; u: number }[] = [];
  if ("axis" in section) {
    const across = section.axis === "X" ? model.grid.Y : model.grid.X;
    const sign = section.look === "W" || section.look === "N" ? 1 : -1;
    across.coords.forEach((c, i) => {
      const position = section.axis === "X" ? yGridAt(model, c, section.at) : c;
      gridMarks.push({ name: across.names[i]!, u: position * sign });
    });
  } else if (section.atRef && model.grid.Y.slope && gridRef(model, section.atRef)?.axis === "Y") {
    const { x1, y1, x2, y2 } = section.cut;
    const dx = x2 - x1;
    if (dx !== 0) {
      const factor = Math.hypot(dx, y2 - y1) / dx;
      model.grid.X.coords.forEach((x, i) => gridMarks.push({ name: model.grid.X.names[i]!, u: (x - x1) * factor }));
    }
  }
  const gridLine = parallelGridLine ?? section.atRef;
  if ("cut" in section && gridLine) {
    const at = frameGridRef(model, gridLine);
    if (at) {
      const frame = model.frames!.get(at.frame)!;
      const other = at.index === 0 ? 1 : 0;
      const { x1, y1, x2, y2 } = section.cut;
      const length = Math.hypot(x2 - x1, y2 - y1);
      for (let i = 0; i < frame.coords[other].length; i++) {
        const name = frame.name[other]! + (i + 1);
        const p = gridPoint(model, gridLine + "," + name);
        const u = ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / length;
        gridMarks.push({ name, u });
      }
    }
  }
  for (const { name, u } of gridMarks) {
    if (u < minU - 1 || u > maxU + 1) continue;
    parts.push(
      `<line x1="${sx(u)}" y1="${MT - 26}" x2="${sx(u)}" y2="${H - MB + 26}" stroke="${palette.grid}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${sx(u)}" cy="${MT - 40}" r="11" fill="none" stroke="${palette.grid}" stroke-width="1"/>`,
      `<text x="${sx(u)}" y="${MT - 36}" text-anchor="middle" font-size="10" fill="${palette.grid}">${esc(name)}</text>`,
    );
  }

  // ---- what the plane cut ----
  // Solid ink, painted last, exactly as a plan paints its black bands last. There is no operation
  // that paints an opening back out in the paper colour: a wall arrives as the run of intervals its
  // openings split it into, so the hole is in it from the start.
  for (const e of section.entities) {
    if (e.class !== "cut" || e.of === "space" || e.of === "opening") continue;
    const colour = memberInk(palette, e.of) ?? palette.ink;
    const stroke = e.polygon.length === 2 ? ` stroke="${colour}" stroke-width="1.4"` : "";
    parts.push(`<g ${subjectAttrs(e.of, e.ref)}><path d="${path2d(e.polygon)}" fill="${colour}"${stroke}/></g>`);
  }
  // A leaf the plane cut is not matter in the way a wall is — it reads as the opening it fills.
  for (const e of section.entities) {
    if (e.class !== "cut" || e.of !== "opening") continue;
    parts.push(
      `<path d="${path2d(e.polygon)}" fill="${e.kind === "window" ? palette.glass : palette.room}" stroke="${palette.ink}" stroke-width="1"/>`,
    );
  }

  // ---- caller-supplied reference geometry ----
  // These lines explain the section but are not part of the building. Their coordinates use the
  // section's own frame, so a caller never has to reproduce the world-to-sheet mapping.
  for (const guide of guides) {
    const points = guide.points.filter((p) => Number.isFinite(p.u) && Number.isFinite(p.z));
    if (points.length >= 2) {
      parts.push(
        `<polyline points="${points.map((p) => `${sx(p.u)},${sy(p.z)}`).join(" ")}" fill="none" stroke="${palette.guide}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    if (guide.showVertices) {
      for (const p of points) {
        parts.push(`<circle cx="${sx(p.u)}" cy="${sy(p.z)}" r="2.8" fill="${palette.guide}"/>`);
      }
    }
    const last = points[points.length - 1];
    if (last && guide.label) {
      parts.push(`<text x="${sx(last.u) + 7}" y="${sy(last.z) - 7}" font-size="10" fill="${palette.guide}">${esc(guide.label)}</text>`);
    }
  }

  // ---- the rooms, named ----
  for (const e of section.entities) {
    if (e.class !== "cut" || e.of !== "space") continue;
    const space = model.spaces.get(e.ref);
    if (!space) continue;
    const b = box(e.polygon);
    if ((b.u1 - b.u0) * s < 46 || (b.z1 - b.z0) * s < 22) continue; // no room for the words
    const cx = sx((b.u0 + b.u1) / 2);
    const cy = sy((b.z0 + b.z1) / 2);
    parts.push(
      `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" fill="${palette.ink}">${esc(displayName(space))}</text>`,
      `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="${palette.label}">h ${Math.round(b.z1 - b.z0)}</text>`,
    );
  }

  parts.push(`<text x="${ML - 62}" y="${H - 18}" font-size="12" fill="${palette.ink}">${esc(heading)}</text>`, "</svg>");
  return parts.join("\n") + "\n";
}

/** Within one distance, walls before the openings that pierce them. */
function rank(e: SectionEntity): number {
  return e.of === "opening" ? 1 : 0;
}

function box(poly: SectionPt[]): { u0: number; u1: number; z0: number; z1: number } {
  const ext = new Extent();
  for (const p of poly) ext.see(p.u, p.z);
  return { u0: ext.min0, u1: ext.max0, z0: ext.min1, z1: ext.max1 };
}
