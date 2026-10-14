import { checkDiagnostics, type Diagnostic } from "../../src/core/diagnose.js";
import { envelopeGaps, passable, segmentLength, segmentsFor, type Segment } from "../../src/core/graph.js";
import { areaM2, canonicalSpaceOrder, displayName, heff, isOutside, isVoid, levelsSorted,
  regionOf, type Boundary, type Model, type Pt } from "../../src/core/model.js";
import { parse, parseFiles, tokenize } from "../../src/core/parse.js";
import { overlaps } from "../../src/core/poly.js";

export interface SpatialSpace {
  path: string;
  uid?: string | number;
  name: string;
  level?: string;
  z?: number;
  height?: number;
  areaM2?: number;
  outside: boolean;
  void: boolean;
  outline: Pt[][];
}

export interface SpatialRelation {
  a: string;
  b: string;
  level?: string;
  segment: Segment;
  lengthMm: number;
  resolution: "unresolved" | "declared";
  type?: Boundary["kind"];
  passage: "unknown" | "passable" | "blocked";
}

export interface SpatialReport {
  format: "koyu-spatial-prototype";
  mode: "spatial";
  state: "consistent" | "invalid";
  diagnostics: Diagnostic[];
  levels: { name: string; z: number; areaM2: number }[];
  grid: Model["grid"];
  spaces: SpatialSpace[];
  relations: SpatialRelation[];
  verticalOverlaps: { lower: string; upper: string; separationMm: number }[];
  assessment: { circulation: "not-evaluated"; daylight: "not-evaluated"; egress: "not-evaluated" };
}

/** Keep line positions, and make the experimental reading explicit in the saved source. */
export function spatialBody(source: string): string {
  const lines = source.split(/\r?\n/);
  const first = lines.findIndex((line, i) => tokenize(line, i + 1).length > 0);
  if (first < 0 || tokenize(lines[first]!, first + 1).join(" ") !== "mode spatial") {
    throw new Error("A spatial prototype starts with mode spatial");
  }
  lines[first] = "";
  return lines.join("\n");
}

export function parseSpatial(source: string): SpatialReport {
  return observeSpatial(parse(spatialBody(source)));
}

export function parseSpatialFiles(files: Record<string, string>, entry: string): SpatialReport {
  if (!Object.hasOwn(files, entry)) throw new Error(`Missing spatial entry: ${entry}`);
  return observeSpatial(parseFiles({ ...files, [entry]: spatialBody(files[entry]!) }, entry));
}

function sameSegment(a: Segment, b: Segment): boolean {
  return a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
}

/** This adapter is experimental; it never exposes its intermediate building Model to consumers. */
export function observeSpatial(model: Model): SpatialReport {
  const declared = model.boundaries.filter(b => !b.derived);
  // shortcut: drawn diagonal cuts need a complete spatial perimeter contract before this prototype accepts them.
  if (declared.some(b => b.drawn)) throw new Error("The spatial prototype does not support boundary line declarations");

  // These two checks require physical ceilings/floors. Written values and all other contradictions remain checked.
  const spatial = { ...model, boundaries: declared };
  const diagnostics = checkDiagnostics(spatial).filter(d => d.code !== "SUF01" && d.code !== "SUF03");
  const state = diagnostics.some(d => d.severity === "error") ? "invalid" : "consistent";
  const spaces: SpatialSpace[] = canonicalSpaceOrder(spatial).map(s => ({
    path: s.path,
    ...(s.attrs.uid !== undefined ? { uid: s.attrs.uid } : {}),
    name: displayName(s),
    ...(s.level !== undefined ? { level: s.level, z: spatial.levels[s.level]?.z } : {}),
    ...(heff(spatial, s) !== undefined ? { height: heff(spatial, s) } : {}),
    ...(areaM2(s) !== undefined ? { areaM2: areaM2(s) } : {}),
    outside: isOutside(s), void: isVoid(s), outline: regionOf(s),
  }));
  const placed = canonicalSpaceOrder(spatial).filter(s => s.rects.length > 0 && s.level !== undefined);
  const declaredSegments = declared.map(boundary => ({ boundary, segments: segmentsFor(spatial, boundary) }));
  const relations: SpatialRelation[] = [];
  const relation = (a: string, b: string, level: string | undefined, segment: Segment, boundary?: Boundary): SpatialRelation => ({
    a, b, ...(level !== undefined ? { level } : {}), segment, lengthMm: segmentLength(segment),
    resolution: boundary ? "declared" : "unresolved",
    ...(boundary ? { type: boundary.kind } : {}),
    passage: state === "invalid" || !boundary ? "unknown" : passable(boundary) ? "passable" : "blocked",
  });
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i]!, b = placed[j]!;
    if (a.level !== b.level) continue;
    const probe: Boundary = { a: a.path, b: b.path, kind: "wall", attrs: {}, openings: [], segs: [], line: 0 };
    for (const segment of segmentsFor(spatial, probe)) {
      const match = declaredSegments.find(d =>
        ((d.boundary.a === a.path && d.boundary.b === b.path) || (d.boundary.a === b.path && d.boundary.b === a.path)) &&
        d.segments.some(s => sameSegment(s, segment)));
      relations.push(relation(a.path, b.path, a.level, segment, match?.boundary));
    }
  }
  // Named, region-less counterparts retain their written boundary. Unnamed perimeter stays unresolved.
  for (const { boundary, segments } of declaredSegments) {
    const a = spatial.spaces.get(boundary.a), b = spatial.spaces.get(boundary.b);
    if (!a || !b || (a.rects.length > 0 && b.rects.length > 0)) continue;
    for (const segment of segments) relations.push(relation(boundary.a, boundary.b, a.level ?? b.level, segment, boundary));
  }
  for (const s of placed) for (const segment of envelopeGaps(spatial, s)) {
    relations.push(relation(s.path, "outside", s.level, segment));
  }
  const verticalOverlaps: SpatialReport["verticalOverlaps"] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i]!, b = placed[j]!;
    const za = spatial.levels[a.level!]?.z, zb = spatial.levels[b.level!]?.z;
    if (za === undefined || zb === undefined || za === zb || !overlaps(regionOf(a), regionOf(b))) continue;
    verticalOverlaps.push({ lower: za < zb ? a.path : b.path, upper: za < zb ? b.path : a.path, separationMm: Math.abs(zb - za) });
  }
  return {
    format: "koyu-spatial-prototype", mode: "spatial", state, diagnostics,
    levels: levelsSorted(spatial).map(l => ({ name: l.name, z: l.z,
      areaM2: Math.round(spaces.filter(s => s.level === l.name && !s.outside && !s.void)
        .reduce((sum, s) => sum + (s.areaM2 ?? 0), 0) * 100) / 100 })),
    grid: spatial.grid, spaces, relations, verticalOverlaps,
    assessment: { circulation: "not-evaluated", daylight: "not-evaluated", egress: "not-evaluated" },
  };
}
