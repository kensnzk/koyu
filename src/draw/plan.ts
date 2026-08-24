// koyu — plan SVG generation
//
// **No rule of building shape lives here.** Wall thickness, opening position, door hinge and stair
// cut are already in the `Form` returned by `derive(model)` (ADR-0040). This page owns colour,
// line type, line weight, typography, symbols, annotation wording, scale and sheet margins — all
// presentation, and all allowed to differ by consumer (docs/reference/scope.md).
//
// Form carries boundary coordinates, wall thickness, opening intervals, door-arc geometry and
// the position where a cut crosses a run. The architectural convention and this renderer decide
// whether a break becomes a diagonal zigzag and whether an arrowhead is open.

import { derive } from "../core/derive.js";
import { displayName, polyBounds, type Model, type Pt } from "../core/model.js";
import { slopeText } from "../core/vertical.js";
import { planMarks, type Mark } from "./marks.js";
import { ARCHITECTURAL_PLAN_CONVENTION } from "./conventions/architectural.js";
import { componentSvg } from "./component-svg.js";
import { esc, Extent, FAINT, GRID, INK, openSheet, OUTDOOR, PAPER, ROOM, SEMI_OUTDOOR } from "./sheet.js";
import { writtenOf } from "./written.js";

export interface PlanOptions {
  level?: string;
  /** px per mm */
  scale?: number;
  /** Cut height above finished floor, mm. It changes the slice, so it is passed into Form. */
  cut?: number;
  /** Plan SVG bytes keyed by component asset name, for models made with the pure `parse` entry. */
  componentSvgs?: Readonly<Record<string, string>>;
}

export function svgPlan(model: Model, opts: PlanOptions = {}): string {
  const level = opts.level ?? Object.keys(model.levels)[0];
  if (!level) throw new Error("No level is defined");
  const scale = opts.scale ?? 0.05;

  const form = derive(model, opts.cut !== undefined ? { cut: opts.cut } : {});
  const plan = form.plans.find((p) => p.level === level);
  const rooms = form.spaces.filter((s) => s.level === level);
  if (!plan || rooms.length === 0) {
    throw new Error(`There is no space with a region on level ${level}`);
  }

  // Site geometry (ADR-0011) appears on the lowest plan, which also serves as the site plan.
  const lowest = form.levels[0]?.name;
  const sitePolys = level === lowest ? form.site : [];

  // Sheet extent includes written allocation, even where it reaches outside the cut shape.
  const modelRooms = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level === level);
  const allRects = modelRooms.flatMap((s) => s.rects);
  const polyPts = [...sitePolys.flatMap((p) => p.points), ...rooms.flatMap((s) => s.outline.flat())];
  // Fold through Extent: spreading every point can hit the call-stack limit on a large storey.
  const ext = new Extent();
  for (const r of allRects) {
    ext.see(r.x1, r.y1);
    ext.see(r.x2, r.y2);
  }
  for (const p of polyPts) ext.see(p.x, p.y);
  const minX = ext.min0;
  const maxX = ext.max0;
  const minY = ext.min1;
  const maxY = ext.max1;

  const M = 84; // sheet margin in px, including grid bubbles
  const W = (maxX - minX) * scale + M * 2;
  const H = (maxY - minY) * scale + M * 2;
  const sx = (x: number) => (x - minX) * scale + M;
  const sy = (y: number) => (maxY - y) * scale + M;
  const path2d = (poly: Pt[]): string =>
    poly.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ") + " Z";
  const line = (g: { x1: number; y1: number; x2: number; y2: number }, stroke: string, w: number, dash = "") =>
    `<line x1="${sx(g.x1)}" y1="${sy(g.y1)}" x2="${sx(g.x2)}" y2="${sy(g.y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const fill = (poly: Pt[], c: string) => `<path d="${path2d(poly)}" fill="${c}"/>`;

  const parts: string[] = openSheet(W, H);

  // Site boundary: a drafting dash pattern applied to the supplied geometry.
  for (const poly of sitePolys) {
    parts.push(
      `<path d="${path2d(poly.points)}" fill="none" stroke="#8a8171" stroke-width="1.1" stroke-dasharray="14 3 2.5 3 2.5 3"/>`,
    );
  }

  // Space faces are the cut through volume. A shared fill and no outline make split convex pieces
  // read as one room. Warm denotes indoors; cooler tones separate outside and semi-outdoor space.
  for (const s of rooms) {
    const isVoid = s.void;
    for (const poly of s.outline) {
      parts.push(fill(poly, isVoid ? PAPER : s.outside ? OUTDOOR : s.semiOutdoor ? SEMI_OUTDOOR : ROOM));
      if (isVoid) {
        // Void: dashed diagonals are a paper convention.
        const r = polyBounds(poly);
        parts.push(
          line({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 }, FAINT, 0.8, "6 4"),
          line({ x1: r.x1, y1: r.y2, x2: r.x2, y2: r.y1 }, FAINT, 0.8, "6 4"),
        );
      }
    }
  }

  // Uncounted area subdivisions, such as a floor-finish change, reproduce the written input.
  for (const s of modelRooms) {
    for (const a of s.areas) {
      const r = a.rect;
      const componentHost = a.attrs["asset"] !== undefined;
      const visibleSubdivision = a.attrs["floor"] !== undefined || a.attrs["spec"] !== undefined;
      if (!componentHost || visibleSubdivision) {
        parts.push(
          `<rect x="${sx(r.x1)}" y="${sy(r.y2)}" width="${(r.x2 - r.x1) * scale}" height="${(r.y2 - r.y1) * scale}" fill="#e7dfcc" fill-opacity="0.55" stroke="${FAINT}" stroke-width="0.8" stroke-dasharray="4 3"/>`,
        );
      }
      const label = [componentHost ? undefined : a.attrs["name"], a.attrs["floor"]]
        .filter((v): v is string => typeof v === "string")
        .join(" · ");
      if (label) {
        parts.push(
          `<text x="${sx(r.x1) + 6}" y="${sy(r.y2) + 12}" font-size="8.5" fill="#8a8171">${esc(label)}</text>`,
        );
      }
    }
  }

  // Components are below cut matter and room labels. The source SVG remains isolated as an image,
  // preserving its defs and IDs while the Form supplies all placement geometry.
  for (const component of form.components ?? []) {
    if (component.level !== level) continue;
    const asset = model.assets.get(component.asset);
    if (!asset || asset.kind !== "component") continue;
    const source = opts.componentSvgs?.[asset.name];
    if (!source) {
      throw new Error(
        `Component asset ${asset.name} has no plan SVG bytes; pass PlanOptions.componentSvgs`,
      );
    }
    const artwork = componentSvg(asset, source);
    const cx = sx(component.centre.x);
    const cy = sy(component.centre.y);
    const width = component.w * scale;
    const height = component.d * scale;
    parts.push(
      `<image class="component-asset" data-asset="${esc(asset.name)}" x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" preserveAspectRatio="none" href="${artwork.dataUri}" transform="rotate(${-component.rotation} ${cx} ${cy})"/>`,
    );
  }

  // Written grid axes.
  for (const [i, x] of model.grid.X.coords.entries()) {
    if (x < minX - 1 || x > maxX + 1) continue;
    parts.push(
      `<line x1="${sx(x)}" y1="${M - 26}" x2="${sx(x)}" y2="${H - M + 26}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${sx(x)}" cy="${M - 40}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${sx(x)}" y="${M - 36}" text-anchor="middle" font-size="10" fill="${GRID}">${model.grid.X.names[i]!}</text>`,
    );
  }
  for (const [i, y] of model.grid.Y.coords.entries()) {
    if (y < minY - 1 || y > maxY + 1) continue;
    parts.push(
      `<line x1="${M - 26}" y1="${sy(y)}" x2="${W - M + 26}" y2="${sy(y)}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${M - 40}" cy="${sy(y)}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${M - 40}" y="${sy(y) + 3.5}" text-anchor="middle" font-size="10" fill="${GRID}">${model.grid.Y.names[i]!}</text>`,
    );
  }

  // Marks copy Form geometry. This page adds only colour, weight, dash, glyph and wording; another
  // consumer can render the same marks differently.
  const marks = planMarks(form, level);
  const written = writtenOf(model);
  const segByRef = new Map(form.segs.map((g) => [g.ref, g]));
  // A generic room label over a stair repeats what the treads already say and obscures the arrow.
  // Seed the set from actual stair runs, then follow only vertical boundaries connected to them so
  // ramps, escalators and lift shafts keep their existing labels.
  const stairSpaces = new Set(form.runs.filter((r) => r.device === "stair").map((r) => r.path));
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of model.boundaries) {
      if (b.kind !== "stair" || (!stairSpaces.has(b.a) && !stairSpaces.has(b.b))) continue;
      if (!stairSpaces.has(b.a)) {
        stairSpaces.add(b.a);
        grew = true;
      }
      if (!stairSpaces.has(b.b)) {
        stairSpaces.add(b.b);
        grew = true;
      }
    }
  }
  for (const k of marks) {
    switch (k.role) {
      // Space faces and subdivision bands are rendered from their full outlines elsewhere. Upper
      // void projections are deliberately placed behind space labels.
      case "space":
      case "space-semi-outdoor":
      case "space-outdoor":
      case "space-void":
      case "void-hatch":
      case "void-above":
        break;
      // An uncounted segment can mark a wall specification change. Only the annotation wording is
      // recovered from the source. `written.boundary` indexes canonical order, never declaration
      // order, so a harmless source reorder cannot move the note to another boundary.
      case "seg": {
        parts.push(fill(k.polygon!, "#77716a"));
        const spec = written.segSpec(k.written!.boundary, k.written!.index!);
        const g = segByRef.get(k.ref);
        if (typeof spec === "string" && g) {
          const h = g.segment.horizontal;
          parts.push(
            `<text x="${sx(g.cx) + (h ? 0 : 8)}" y="${sy(g.cy) + (h ? -7 : 3)}" text-anchor="${h ? "middle" : "start"}" font-size="8" fill="#77716a">${esc(spec)}</text>`,
          );
        }
        break;
      }
      // A boundary with no matter remains legible as a light dashed relation.
      case "open":
        for (const g of k.lines ?? []) parts.push(line(g, FAINT, 1, "6 4"));
        break;
      // A rail stays lighter than a wall, while the endpoint posts keep a short rail from reading
      // as an accidental construction line. The axis itself comes from Form; the circles are a
      // paper convention and add no building geometry.
      case "rail":
        parts.push(`<g class="boundary-rail">`);
        for (const g of k.lines ?? []) {
          parts.push(line(g, INK, 1.1));
          parts.push(
            `<circle class="boundary-rail-post" cx="${sx(g.x1)}" cy="${sy(g.y1)}" r="1.45" fill="${INK}"/>`,
            `<circle class="boundary-rail-post" cx="${sx(g.x2)}" cy="${sy(g.y2)}" r="1.45" fill="${INK}"/>`,
          );
        }
        parts.push(`</g>`);
        break;
      // Only intervals and columns cut by the plane become black bodies. Sill walls lie below the
      // cut; no paper-coloured mask is needed to erase openings.
      case "wall":
      case "column":
        parts.push(fill(k.polygon!, INK));
        break;
      // A sliding leaf has no swing trace. Its solid line closes the opening; the thin dashed
      // continuation says which way it retracts without turning the opening into a box.
      case "slide-panel":
        parts.push(`<g class="opening-slide-panel">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 1.2));
        parts.push(`</g>`);
        break;
      case "slide-centre":
        parts.push(`<g class="opening-slide-centre">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.7));
        parts.push(`</g>`);
        break;
      case "slide-tail":
        parts.push(`<g class="opening-slide-guide">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.65, "5 3"));
        parts.push(`</g>`);
        break;
      case "auto-direction":
        parts.push(`<g class="opening-auto-direction">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.65));
        parts.push(`</g>`);
        break;
      case "entrance":
        parts.push(`<g class="opening-entrance">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.75));
        parts.push(`</g>`);
        break;
      case "gate-post":
        parts.push(`<g class="opening-gate-post">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 2));
        parts.push(`</g>`);
        break;
      case "rolling-shutter":
        parts.push(`<g class="opening-rolling-shutter">`);
        for (const g of k.lines ?? []) {
          parts.push(line(g, INK, 1));
          parts.push(
            `<rect x="${sx(g.x1) - 1.5}" y="${sy(g.y1) - 1.5}" width="3" height="3" fill="${INK}"/>`,
            `<rect x="${sx(g.x2) - 1.5}" y="${sy(g.y2) - 1.5}" width="3" height="3" fill="${INK}"/>`,
          );
        }
        parts.push(`</g>`);
        break;
      case "overhead-door":
        parts.push(`<g class="opening-overhead-door">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 1.1, "2 1"));
        parts.push(`</g>`);
        break;
      case "door-leaf":
        for (const g of k.lines ?? []) parts.push(line(g, INK, 1.1));
        break;
      case "window-leaf":
        parts.push(`<g class="opening-window-leaf">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.8));
        parts.push(`</g>`);
        break;
      case "door-arc":
      case "window-arc": {
        const a = k.arc!;
        const r = a.r * scale;
        // World counter-clockwise becomes clockwise after the SVG y-axis is inverted.
        const sweep = a.ccw ? 0 : 1;
        const window = k.role === "window-arc";
        parts.push(
          `<path class="${window ? "opening-window-arc" : "opening-door-arc"}" d="M ${sx(a.from.x)} ${sy(a.from.y)} A ${r} ${r} 0 0 ${sweep} ${sx(a.to.x)} ${sy(a.to.y)}" fill="none" stroke="${INK}" stroke-width="${window ? 0.55 : 0.7}"/>`,
        );
        break;
      }
      case "window": {
        const cut = k.class === "cut";
        const stroke = cut ? INK : FAINT;
        const dash = cut ? "" : "5 3";
        parts.push(`<g class="opening-window">`);
        if (k.polygon && k.polygon.length >= 4) {
          const p = k.polygon;
          // A window continues the two faces of the wall as unfilled lines. Closing this path
          // would add jamb caps and turn the window back into a boxed door opening.
          parts.push(
            `<path d="M ${sx(p[0]!.x)} ${sy(p[0]!.y)} L ${sx(p[1]!.x)} ${sy(p[1]!.y)} M ${sx(p[3]!.x)} ${sy(p[3]!.y)} L ${sx(p[2]!.x)} ${sy(p[2]!.y)}" fill="none" stroke="${stroke}" stroke-width="0.8"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
          );
        } else {
          for (const g of k.lines ?? []) parts.push(line(g, stroke, 0.55, dash));
        }
        parts.push(`</g>`);
        break;
      }
      case "window-sash":
        parts.push(`<g class="opening-window-sash">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.7));
        parts.push(`</g>`);
        break;
      case "window-fixed":
        parts.push(`<g class="opening-window-fixed">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.65));
        parts.push(`</g>`);
        break;
      case "curtain-wall-mullion":
        parts.push(`<g class="opening-curtain-wall-mullion">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.55));
        parts.push(`</g>`);
        break;
      case "window-sash-centre":
        parts.push(`<g class="opening-window-sash-centre">`);
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.55));
        parts.push(`</g>`);
        break;
      case "run-outline":
        for (const g of k.lines ?? []) parts.push(line(g, INK, 1.1));
        break;
      case "run-tread":
        for (const g of k.lines ?? []) parts.push(line(g, INK, 0.7));
        break;
      case "run-break":
        for (const g of k.lines ?? []) parts.push(...breakMark(g, line));
        break;
      case "run-arrow":
        parts.push(...arrow(k, line, sx, sy));
        break;
      // Wording and rounding begin here; the mark carries only unrounded facts.
      case "run-note": {
        const n = k.note;
        if (!n || n.of === "direction" || n.of === "stair") break;
        const text = `${n.lanes > 1 ? `${n.lanes} units ` : ""}slope ${slopeText(n.slope)}`;
        parts.push(
          `<text class="run-note" x="${sx(k.at!.x)}" y="${sy(k.at!.y) + 42}" text-anchor="middle" font-size="8" fill="#8a8171" stroke="${PAPER}" stroke-width="3" paint-order="stroke">${esc(text)}</text>`,
        );
        break;
      }
    }
  }

  // Place a space label at the centre of its largest convex piece.
  for (const s of rooms) {
    if (stairSpaces.has(s.path)) continue;
    const space = model.spaces.get(s.path)!;
    const poly = [...s.outline].sort((a, b) => polyArea(b) - polyArea(a))[0]!;
    const r = polyBounds(poly);
    const cx = sx((r.x1 + r.x2) / 2);
    const cy = sy((r.y1 + r.y2) / 2);
    const sub =
      s.void
        ? "void"
        : `${s.type ? `${esc(s.type)} · ` : ""}${s.areaM2} m2${s.semiOutdoor ? " · semi-outdoor" : ""}`;
    parts.push(
      `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" fill="${INK}">${esc(displayName(space))}</text>`,
      `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="#8a8171">${sub}</text>`,
      `<text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="8.5" fill="${FAINT}">${esc(s.path)}</text>`,
    );
  }

  // Projection from above the cut, including an upper void, drawn after space labels.
  for (const k of marks) {
    if (k.role !== "void-above") continue;
    parts.push(
      `<path d="${path2d(k.polygon!)}" fill="none" stroke="${FAINT}" stroke-width="0.8" stroke-dasharray="6 4"/>`,
      `<text x="${sx(k.at!.x)}" y="${sy(k.at!.y) + 40}" text-anchor="middle" font-size="9" fill="${FAINT}">void above</text>`,
    );
  }

  // North arrow (ADR-0057): drawn only when azimuth is written. It is presentation rather than
  // shape, so it is placed directly in sheet coordinates instead of entering Form. The picture
  // exposes a reversed bearing, a complementary angle or copied magnetic north.
  //
  // On screen model +Y is up and +X is right; true azimuth remains clockwise from +Y.
  if (model.azimuth) {
    const rad = (model.azimuth.deg * Math.PI) / 180;
    const nx = Math.sin(rad);
    const ny = -Math.cos(rad);
    const cx = W - M / 2; // centre of the right margin, separated from the grid bubbles
    const cy = M / 2;
    const R = 21;
    const px = -ny; // perpendicular direction for the arrowhead base
    const py = nx;
    const r2 = (n: number): string => String(Math.round(n * 100) / 100);
    const head = [
      [cx + nx * R, cy + ny * R],
      [cx + nx * R * 0.42 + px * 4.6, cy + ny * R * 0.42 + py * 4.6],
      [cx + nx * R * 0.42 - px * 4.6, cy + ny * R * 0.42 - py * 4.6],
    ]
      .map(([x, y]) => `${r2(x!)},${r2(y!)}`)
      .join(" ");
    parts.push(
      `<g class="north-arrow">`,
      `<line x1="${r2(cx - nx * R * 0.8)}" y1="${r2(cy - ny * R * 0.8)}" x2="${r2(cx + nx * R)}" y2="${r2(cy + ny * R)}" stroke="${INK}" stroke-width="1"/>`,
      `<polygon points="${head}" fill="${INK}"/>`,
      `<text x="${r2(cx + nx * (R + 10))}" y="${r2(cy + ny * (R + 10) + 3.4)}" text-anchor="middle" font-size="9" fill="${INK}">N</text>`,
      `</g>`,
    );
  }

  // Sheet title.
  const title = `${model.name ?? "Untitled"} — ${level} plan`;
  parts.push(`<text x="${M - 62}" y="${H - 18}" font-size="12" fill="${INK}">${esc(title)}</text>`);

  parts.push("</svg>");
  return parts.join("\n") + "\n";
}

type Line = (
  g: { x1: number; y1: number; x2: number; y2: number },
  stroke: string,
  w: number,
  dash?: string,
) => string;

/**
 * Form supplies the segment crossing the flight. The renderer scales the supplied 10 by 40 break
 * glyph to that width and rotates it 30 degrees as a paper convention.
 */
function breakMark(g: { x1: number; y1: number; x2: number; y2: number }, line: Line): string[] {
  const glyph = ARCHITECTURAL_PLAN_CONVENTION.stairs.breakGlyph;
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const width = Math.hypot(dx, dy) || 1;
  const ax = dx / width;
  const ay = dy / width;
  const tx = dy / width;
  const ty = -dx / width;
  const cx = (g.x1 + g.x2) / 2;
  const cy = (g.y1 + g.y2) / 2;
  const angle = glyph.angleDegrees * Math.PI / 180;
  const longX = ax * Math.cos(angle) + tx * Math.sin(angle);
  const longY = ay * Math.cos(angle) + ty * Math.sin(angle);
  const crossX = -ax * Math.sin(angle) + tx * Math.cos(angle);
  const crossY = -ay * Math.sin(angle) + ty * Math.cos(angle);
  const scale = width / (glyph.height * Math.cos(angle));
  const point = (x: number, y: number) => ({
    x: cx + (longX * y + crossX * x) * scale,
    y: cy + (longY * y + crossY * x) * scale,
  });
  const halfHeight = glyph.height / 2;
  // Exact geometry of the convention's break glyph, centred and rotated on the flight.
  const paths = [
    [point(0, -halfHeight), point(0, -glyph.notch), point(-glyph.notch, -glyph.notch), point(0, 0)],
    [point(0, 0), point(glyph.notch, glyph.notch), point(0, glyph.notch), point(0, halfHeight)],
  ];
  return [
    `<g class="run-break-zigzag">`,
    ...paths.flatMap((points) =>
      points.slice(0, -1).map((p, i) =>
        line({ x1: p.x, y1: p.y, x2: points[i + 1]!.x, y2: points[i + 1]!.y }, INK, 1.35),
      ),
    ),
    `</g>`,
  ];
}

/** A light, open direction arrow. Its line already points where the presentation mark intends. */
function arrow(
  k: Mark,
  line: Line,
  sx: (x: number) => number,
  sy: (y: number) => number,
): string[] {
  const lines = k.lines ?? [];
  const first = lines[0];
  const g = lines[lines.length - 1];
  if (!first || !g) return [];
  // The head is paper-sized, not a dimension of the building. Keeping it in SVG coordinates
  // makes the same stair legible on a compact house and a large floor plate.
  const screenLen = Math.hypot(sx(g.x2) - sx(g.x1), sy(g.y2) - sy(g.y1)) || 1;
  const vx = (sx(g.x2) - sx(g.x1)) / screenLen;
  const vy = (sy(g.y2) - sy(g.y1)) / screenLen;
  const px = -vy;
  const py = vx;
  const head = ARCHITECTURAL_PLAN_CONVENTION.stairs.arrowHead;
  const tip = { x: sx(g.x2), y: sy(g.y2) };
  const back = { x: tip.x - vx * head.length, y: tip.y - vy * head.length };
  return [
    `<g class="run-direction-arrow">`,
    ...lines.map((segment) => line(segment, INK, 0.8)),
    ...(k.class === "below"
      ? []
      : [`<circle class="run-direction-arrow-start" cx="${sx(first.x1)}" cy="${sy(first.y1)}" r="${head.startRadius}" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`]),
    `<path class="run-direction-arrow-head" d="M ${back.x + px * head.halfWidth} ${back.y + py * head.halfWidth} L ${tip.x} ${tip.y} L ${back.x - px * head.halfWidth} ${back.y - py * head.halfWidth}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</g>`,
  ];
}

function polyArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}
