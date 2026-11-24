import { canonicalPointRef, compareCanonical, gridPoint, memberFrame, sectionRectangle, SourceError, type Model, type Pt } from "./model.js";
import { area, convexPieces, signedArea } from "./poly.js";

interface MemberDecl {
  path: string;
  level: string;
  top?: number;
  line: number;
  file?: string;
}

export interface BeamDecl extends MemberDecl {
  from: string;
  to: string;
  w: number;
  d: number;
}

export type FoundationDecl = MemberDecl & { t: number } & (
  | { type: "pad"; at: string; frame?: string; w: number; d: number }
  | { type: "strip"; from: string; to: string; w: number }
  | { type: "mat"; outline: string[] }
);

export interface FormMember {
  ref: string;
  level: string;
  outline: Pt[];
  z0: number;
  z1: number;
  areaM2: number;
  volumeM3: number;
}

export interface FormFoundation extends FormMember {
  type: FoundationDecl["type"];
  /** Convex decomposition for section cuts of a concave mat. */
  pieces?: Pt[][];
}

export function memberRef(model: Model, ref: string, line: number): string {
  gridPoint(model, ref, line);
  const normalized = ref.split(",").map(axis => axis.replace(/[+-]\d+$/, raw => {
    const offset = Number(raw);
    return offset > 0 ? `+${offset}` : offset === 0 ? "" : String(offset);
  })).join(",");
  return canonicalPointRef(model, normalized);
}

/** Horizontal rectangle with perpendicular ends at the two authored stations. */
function strip(model: Model, member: BeamDecl | (FoundationDecl & { type: "strip" })): Pt[] {
  const a = gridPoint(model, member.from, member.line);
  const b = gridPoint(model, member.to, member.line);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) throw new SourceError(member.line, "The endpoints of a structural span must differ", member.file);
  const dx = -(b.y - a.y) * member.w / (2 * length);
  const dy = (b.x - a.x) * member.w / (2 * length);
  return [
    { x: a.x - dx, y: a.y - dy }, { x: b.x - dx, y: b.y - dy },
    { x: b.x + dx, y: b.y + dy }, { x: a.x + dx, y: a.y + dy },
  ];
}

export function matOutline(model: Model, member: FoundationDecl & {type: "mat"}): { outline: Pt[]; pieces?: Pt[][] } {
  const outline = member.outline.map(ref => gridPoint(model, ref, member.line));
  if (signedArea(outline) < 0) outline.reverse();
  const pieces = convexPieces(outline, message => {
    throw new SourceError(member.line, `${member.path}: ${message}`, member.file);
  });
  return { outline, ...(pieces.length > 1 ? { pieces } : {}) };
}

function prism(model: Model, member: MemberDecl, outline: Pt[], thickness: number): FormMember {
  const z1 = model.levels[member.level]!.z + (member.top ?? 0);
  const areaM2 = area(outline) / 1e6;
  return { ref: member.path, level: member.level, outline, z0: z1 - thickness, z1, areaM2, volumeM3: areaM2 * thickness / 1000 };
}

function foundation(model: Model, f: FoundationDecl): FormFoundation {
  let outline: Pt[];
  let pieces: Pt[][] | undefined;
  const { type } = f;
  if (type === "pad") {
    const { x, y } = gridPoint(model, f.at, f.line);
    outline = sectionRectangle({ x, y, w: f.w, d: f.d, basis: memberFrame(model, f.at, f.frame)?.basis });
  } else if (type === "strip") {
    outline = strip(model, f);
  } else {
    ({ outline, pieces } = matOutline(model, f));
  }
  return { ...prism(model, f, outline, f.t), type, ...(pieces ? { pieces } : {}) };
}

/** Match canonical path order when building the shared solids for views and quantities. */
export function structuralMembers(model: Model): { beams: FormMember[]; foundations: FormFoundation[] } {
  const byPath = (a: MemberDecl, b: MemberDecl) => compareCanonical(a.path, b.path);
  return {
    beams: [...(model.beams ?? [])].sort(byPath).map(b => prism(model, b, strip(model, b), b.d)),
    foundations: [...(model.foundations ?? [])].sort(byPath).map(f => foundation(model, f)),
  };
}
