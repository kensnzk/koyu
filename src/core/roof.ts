import {
  canonicalSpaceOrder,
  compareCanonical,
  frameCoordinates,
  frameGridRef,
  gridPoint,
  isOutside,
  isSemiOutdoor,
  regionOf,
  SourceError,
  type GridFrame,
  type Model,
  type Pt,
  type RoofDecl,
} from "./model.js";
import {
  area,
  areaOf,
  bounds,
  clipHalf,
  convexPieces,
  hull,
  subtract,
  unionArea,
} from "./poly.js";
import { AREA_EPS, CROSS_EPS, EPS } from "./tolerance.js";
import type { Slab } from "./fabric.js";

export interface RoofVertex extends Pt {
  z: number;
}
export interface FormRoof {
  ref: string;
  level: string;
  /** Disjoint convex pieces of the roof projection, excluding holes. */
  outline: Pt[][];
  /** Openings through the inferred roof beneath this roof, if written. */
  holes?: Pt[][];
  /** Top surfaces. Each ring is convex, planar and counter-clockwise in XY. */
  faces: { vertices: RoofVertex[] }[];
  /** Modelled vertical thickness in mm. Zero denotes a surface only. */
  thickness: number;
  assumptions: string[];
  projectedAreaM2: number;
  modeledProjectionM2: number;
  /** Area of the available faces, including when only part of an outline is surveyed. */
  surfaceAreaM2?: number;
}

const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const fail = (roof: RoofDecl, message: string): never => {
  throw new SourceError(roof.line, `${roof.path}: ${message}`, roof.file);
};

function point(model: Model, token: string, line: number): RoofVertex {
  const [x, y, z] = token.split(",");
  return { ...gridPoint(model, `${x},${y}`, line), z: Number(z ?? 0) };
}

function pieces<T extends Pt>(raw: T[], roof: RoofDecl): T[][] {
  return convexPieces(raw, (message) => fail(roof, message));
}

function exposedFootprint(model: Model, roof: RoofDecl): { outline: Pt[][]; refs: string[] } {
  const z = model.levels[roof.level]!.z;
  const all = canonicalSpaceOrder(model);
  const upper = all.filter((s) => s.level && model.levels[s.level]!.z > z && !isOutside(s)).flatMap(regionOf);
  const outline: Pt[][] = [], refs: string[] = [];
  for (const s of all) {
    if (s.level !== roof.level || isOutside(s) || isSemiOutdoor(model, s)) continue;
    const before = outline.length;
    for (const poly of regionOf(s)) outline.push(...subtract(poly, [...upper, ...outline]));
    if (outline.length > before) refs.push(...(s.cell?.refs ?? s.grids.map(g => g.xa)));
  }
  return { outline, refs };
}

function directionFrame(model: Model, roof: RoofDecl, refs: string[]): GridFrame | undefined {
  if (!model.frames?.size || (roof.type !== "gable" && roof.type !== "shed")) return undefined;
  const direction = roof.ridgeAxis ?? roof.rise?.slice(1);
  if (direction) {
    const frame = frameGridRef(model, direction + "1");
    return frame && model.frames.get(frame.frame);
  }
  const axes = refs.flatMap(p => p.split(","));
  const first = axes.length ? frameGridRef(model, axes[0]!)?.frame : undefined;
  return first && axes.every(axis => frameGridRef(model, axis)?.frame === first) ? model.frames.get(first) : undefined;
}

interface Plane {
  x: number;
  y: number;
  k: number;
}
const value = (plane: Plane, p: Pt) => plane.x * p.x + plane.y * p.y + plane.k;

/** Keep the points where this rise plane is below the other one. */
function lower(poly: Pt[], p: Plane, q: Plane): Pt[] {
  const x = q.x - p.x,
    y = q.y - p.y,
    k = q.k - p.k;
  if (Math.hypot(x, y) < 1e-12) return k >= 0 ? poly : [];
  const a = Math.abs(x) > Math.abs(y) ? { x: -k / x, y: 0 } : { x: 0, y: -k / y };
  return clipHalf(poly, a, { x: a.x + y, y: a.y - x }, true);
}

/** A surveyed face has a single plane; retaining nonplanar vertices would give each consumer a different roof. */
function facePlane(vertices: RoofVertex[], roof: RoofDecl): Plane {
  const a = vertices[0]!,
    b = vertices[1]!;
  const c = vertices.find((p) => Math.abs(cross(a, b, p)) > CROSS_EPS);
  if (!c) return fail(roof, "A roof face needs a positive projected area");
  const det = cross(a, b, c);
  const x = ((b.z - a.z) * (c.y - a.y) - (b.y - a.y) * (c.z - a.z)) / det;
  const y = ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / det;
  const plane = { x, y, k: a.z - x * a.x - y * a.y };
  if (vertices.some((p) => Math.abs(value(plane, p) - p.z) > 1e-5))
    return fail(roof, "Roof face vertices must share a plane");
  return plane;
}

function surfaceArea(vertices: RoofVertex[]): number {
  let total = 0;
  const a = vertices[0]!;
  for (let i = 1; i + 1 < vertices.length; i++) {
    const b = vertices[i]!,
      c = vertices[i + 1]!;
    const ux = b.x - a.x,
      uy = b.y - a.y,
      uz = b.z - a.z,
      vx = c.x - a.x,
      vy = c.y - a.y,
      vz = c.z - a.z;
    total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return total;
}

function generatedFaces(
  roof: RoofDecl,
  frame: GridFrame | undefined,
  outline: Pt[][],
  datum: number,
  pitch: number | undefined,
  sketch: boolean,
  assumptions: string[],
): RoofVertex[][] {
  if (!roof.type || !outline.length) return [];
  const base = roof.eaveZ !== undefined ? datum + roof.eaveZ : undefined;
  const high = roof.highZ !== undefined ? datum + roof.highZ : undefined;
  const lifted = (ring: Pt[], z: (p: Pt) => number) => ring.map((p) => ({ x: p.x, y: p.y, z: z(p) }));
  const sketchEave = () => {
    if (!sketch || pitch === undefined) return undefined;
    assumptions.push("eave:storey-top");
    return datum + pitch;
  };
  if (roof.type === "flat") {
    const z = base ?? sketchEave();
    return z === undefined ? [] : outline.map((p) => lifted(p, () => z));
  }
  let planes: Plane[];
  if (roof.type === "shed" || roof.type === "gable") {
    const points = outline.flat();
    const names = frame?.name ?? "XY";
    const basis = frame?.basis ?? [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    const fromEave = (axis: string, sign: number): Plane => {
      const unit = basis[names.indexOf(axis)]!;
      const x = sign * unit.x, y = sign * unit.y;
      return { x, y, k: -Math.min(...points.map(p => x * p.x + y * p.y)) };
    };
    if (roof.type === "shed") {
      const rise = roof.rise ?? (sketch ? "+" + names[1] : undefined);
      if (!rise) return [];
      if (!roof.rise) assumptions.push("rise:" + rise);
      planes = [fromEave(rise.slice(1), rise[0] === "-" ? -1 : 1)];
    } else {
      const box = bounds(frame ? points.map(p => frameCoordinates(frame, p)) : points);
      const width = box.x2 - box.x1, depth = box.y2 - box.y1;
      if (Math.abs(areaOf(outline) - width * depth) > AREA_EPS) return [];
      const longer = width >= depth - (frame ? EPS : 0) ? 0 : 1;
      const axis = roof.ridgeAxis ?? (sketch ? names[longer] : undefined);
      if (!axis) return [];
      if (!roof.ridgeAxis) assumptions.push("ridge-axis:" + axis);
      const across = names[axis === names[0] ? 1 : 0]!;
      planes = [fromEave(across, 1), fromEave(across, -1)];
    }
  } else {
    const boundary = hull(outline.flat());
    if (Math.abs(area(boundary) - areaOf(outline)) > AREA_EPS) return [];
    planes = boundary.map((a, i) => {
      const b = boundary[(i + 1) % boundary.length]!,
        len = Math.hypot(b.x - a.x, b.y - a.y);
      const x = (a.y - b.y) / len,
        y = (b.x - a.x) / len;
      return { x, y, k: -x * a.x - y * a.y };
    });
  }
  const panels: { ring: Pt[]; plane: Plane }[] = [];
  for (const plane of planes) {
    for (const piece of outline) {
      let ring = piece;
      for (const other of planes) {
        if (other !== plane && ring.length) ring = lower(ring, plane, other);
      }
      if (ring.length) panels.push({ ring, plane });
    }
  }
  const run = Math.max(0, ...panels.flatMap(({ ring, plane }) => ring.map((p) => value(plane, p))));
  if (run <= 0) return [];
  let slope = roof.slope;
  if (base !== undefined && high !== undefined) slope = (high - base) / run;
  if (slope === undefined && sketch) {
    slope = 0.25;
    assumptions.push("slope:1/4");
  }
  if (slope === undefined) return [];
  const eave = base ?? (high !== undefined ? high - slope * run : sketchEave());
  if (eave === undefined) return [];
  return panels.map(({ ring, plane }) => lifted(ring, (p) => eave + slope! * value(plane, p)));
}

/** Resolve the authored geometry also at parse time, when only an outline or a few panels may exist. */
export function readRoofGeometry(model: Model, roof: RoofDecl) {
  const datum = model.levels[roof.level]!.z;
  const xy = ({ x, y }: Pt): Pt => ({ x, y });
  const ring = (refs: string[]) =>
    pieces(
      refs.map((ref) => xy(point(model, ref, roof.line))),
      roof,
    );
  const faces: RoofVertex[][] = [];
  for (const refs of roof.faces) {
    const vertices = refs.map((ref) => point(model, ref, roof.line));
    facePlane(vertices, roof);
    for (const panel of pieces(vertices, roof)) {
      faces.push(panel.map((vertex) => ({ ...vertex, z: vertex.z + datum })));
    }
  }

  const projections = faces.map((panel) => panel.map(xy));
  let outline = roof.outline ? ring(roof.outline) : projections;
  if (roof.holes.length && !roof.outline) fail(roof, "Roof holes need an explicit outer outline");
  const holes = roof.holes.flatMap(ring);
  if (holes.some((hole) => areaOf(subtract(hole, outline)) > AREA_EPS)) {
    fail(roof, "A roof hole extends beyond its outline");
  }
  if (holes.length) outline = outline.flatMap((piece) => subtract(piece, holes));

  if (faces.length) {
    if (projections.some((panel) => areaOf(subtract(panel, outline)) > AREA_EPS)) {
      fail(roof, "A roof face extends beyond its outline");
    }
    if (areaOf(projections) - unionArea(projections) > AREA_EPS) {
      fail(roof, "Roof face projections overlap; use a separate roof for a separate surface");
    }
    if (
      roof.eaveZ !== undefined ||
      roof.highZ !== undefined ||
      roof.slope !== undefined ||
      roof.ridgeAxis !== undefined ||
      roof.rise !== undefined
    ) {
      fail(roof, "Surveyed faces supply their own geometry; omit independent type dimensions");
    }
  }
  return { outline, holes, faces };
}

export function roofForms(
  model: Model,
  sketch: boolean,
  pitches: Map<string, number | undefined>,
): FormRoof[] {
  const ordered = [...(model.roofs ?? [])].sort((a, b) => compareCanonical(a.path, b.path));
  return ordered.map((roof) => {
    const authored = readRoofGeometry(model, roof);
    const assumptions: string[] = [];
    let outline = authored.outline;
    let refs = roof.outline ?? [];
    if (!roof.outline && !roof.faces.length && sketch) {
      ({ outline, refs } = exposedFootprint(model, roof));
      if (outline.length) assumptions.push("outline:exposed-storey");
    }
    // Interiors of the pieces are disjoint. Merge a convex footprint spanning several rooms.
    if (outline.length > 1) {
      const merged = hull(outline.flat());
      if (Math.abs(area(merged) - areaOf(outline)) <= AREA_EPS) outline = [merged];
    }
    const datum = model.levels[roof.level]!.z;
    const faces = authored.faces.length
      ? authored.faces
      : generatedFaces(roof, directionFrame(model, roof, refs), outline, datum, pitches.get(roof.level), sketch, assumptions);
    return {
      ref: roof.path,
      level: roof.level,
      outline,
      ...(authored.holes.length ? { holes: authored.holes } : {}),
      faces: faces.map((vertices) => ({ vertices })),
      thickness: roof.thickness ?? 0,
      assumptions,
      projectedAreaM2: areaOf(outline) / 1e6,
      modeledProjectionM2: areaOf(faces) / 1e6,
      ...(faces.length
        ? { surfaceAreaM2: faces.reduce((sum, panel) => sum + surfaceArea(panel), 0) / 1e6 }
        : {}),
    };
  });
}

/** The written roof replaces inferred material only on its own storey and projection.
 * A floor and an explicit roof with exactly the same horizontal layer produce one body. */
export function replaceRoofSlabs(slabs: Slab[], roofs: FormRoof[]): Slab[] {
  if (!roofs.length) return slabs;
  return slabs.flatMap((s) => {
    let covers: Pt[][] = [];
    if (s.kind === "roof")
      covers = roofs.filter((r) => r.level === s.level).flatMap((r) => [...r.outline, ...(r.holes ?? [])]);
    if (s.kind === "floor") {
      for (const roof of roofs) {
        if (roof.thickness !== s.z1 - s.z0) continue;
        for (const f of roof.faces)
          if (f.vertices.every((p) => Math.abs(p.z - s.z1) < 1e-6)) covers.push(f.vertices);
      }
    }
    return covers.length ? subtract(s.outline, covers).map((outline) => ({ ...s, outline })) : [s];
  });
}
