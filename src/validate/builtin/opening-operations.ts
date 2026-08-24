import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { codePointCompare } from "../../analysis/json.js";
import { derive, type FormOpening } from "../../core/derive.js";
import {
  canonicalBoundaryOrder,
  canonicalOpeningOrder,
  canonicalSpaceOrder,
  regionOf,
  type Model,
  type Pt,
  type Space,
} from "../../core/model.js";
import { pointIn } from "../../core/poly.js";
import { EPS, PARALLEL_EPS, PROBE } from "../../core/tolerance.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export const SLIDING_STORAGE_LEAVES_SPACE_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.opening.storage-leaves-space",
  revision: "1",
} as const);

export const SLIDING_STORAGE_OVERLAPS_OPENING_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.opening.storage-overlaps-opening",
  revision: "1",
} as const);

export type OperationPoint = {
  readonly x: number;
  readonly y: number;
};

export type OperationSegment = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

export type CrossedSpaceObservation = {
  readonly ref: string;
  readonly lengthMm: number;
};

export type SlidingStorageLeafObservation = {
  readonly leaf: number;
  readonly widthMm: number;
  /** The leaf's fully open position, on the intended room side of the wall face. */
  readonly parked: OperationSegment;
  /** The same parked interval on the wall axis, before the room-side probe is applied. */
  readonly wallAxis: OperationSegment;
  /** How much of `parked` does not lie in the intended room. */
  readonly outsideTargetMm: number;
  /** Other modelled spaces occupied by the parked leaf, in canonical path order. */
  readonly crossedSpaces: readonly CrossedSpaceObservation[];
  /** Other apertures covered by this parked leaf, with vertical overlap already required. */
  readonly overlappedOpenings: readonly {
    readonly ref: string;
    readonly lengthMm: number;
  }[];
};

export type SlidingStorageObservation = {
  readonly ref: string;
  readonly boundaryRef: string;
  readonly level: string;
  readonly kind: "door" | "window";
  readonly style:
    | "sliding"
    | "sliding-double"
    | "sliding-bypass"
    | "auto"
    | "auto-single"
    | "auto-double"
    | "gate-sliding";
  readonly z0: number;
  readonly z1: number;
  readonly aperture: OperationSegment;
  readonly intoSpace: string | null;
  readonly state: "complete" | "indeterminate";
  readonly reason: "opening-side-unresolved" | null;
  readonly storage: readonly SlidingStorageLeafObservation[];
};

export type OpeningOperationsAnalysisValue = {
  readonly openings: readonly SlidingStorageObservation[];
};

export const OPENING_OPERATIONS_ANALYSIS_ID: AnalysisRef<OpeningOperationsAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.opening-operations",
  revision: "1",
});

export const OPENING_OPERATIONS_ANALYSIS: AnalysisDefinition<OpeningOperationsAnalysisValue> = freezeBuiltin<AnalysisDefinition<OpeningOperationsAnalysisValue>>({
  ...OPENING_OPERATIONS_ANALYSIS_ID,
  title: "Opening operation geometry observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<OpeningOperationsAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const form = derive(coreModel);
    const spaces = canonicalSpaceOrder(coreModel);
    const openings: SlidingStorageObservation[] = [];
    const evidence: Evidence[] = [];

    for (const opening of form.openings) {
      const style = slidingStyle(opening.style);
      if (!style) continue;
      const observation = storageObservation(opening, style, spaces, form.openings);
      openings.push(observation);
      evidence.push(storageEvidence(observation, opening, coreModel));
    }

    openings.sort((a, b) => codePointCompare(a.ref, b.ref));
    evidence.sort((a, b) => codePointCompare(a.id, b.id));
    return { state: "complete", value: { openings }, evidence };
  },
});

export const SLIDING_STORAGE_LEAVES_SPACE_RULE: Rule = freezeBuiltin<Rule>({
  ...SLIDING_STORAGE_LEAVES_SPACE_RULE_ID,
  title: "Sliding leaf storage stays in its intended space",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: OPENING_OPERATIONS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateSlidingStorage(get(OPENING_OPERATIONS_ANALYSIS_ID)),
});

export const SLIDING_STORAGE_OVERLAPS_OPENING_RULE: Rule = freezeBuiltin<Rule>({
  ...SLIDING_STORAGE_OVERLAPS_OPENING_RULE_ID,
  title: "Sliding leaf storage does not cover another opening",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: OPENING_OPERATIONS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateStorageOpeningOverlap(get(OPENING_OPERATIONS_ANALYSIS_ID)),
});

function evaluateSlidingStorage(
  artifact: AnalysisArtifact<OpeningOperationsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") {
    return {
      applicability: "indeterminate",
      reason: "Opening operation geometry observations are incomplete",
      missing: artifact.missing,
      evidence: artifact.state === "partial" ? artifact.evidence : [],
    };
  }
  if (artifact.value.openings.length === 0) {
    return { applicability: "not-applicable", reason: "No placeable sliding opening is present", evidence: [] };
  }

  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  const outcomes = artifact.value.openings.map((opening): RuleOutcome => {
    const evidence = evidenceById.get(storageEvidenceId(opening.ref));
    if (!evidence) throw new Error(`missing opening-operation evidence for ${opening.ref}`);
    const subjects = storageSubjects(opening);
    if (opening.state === "indeterminate") {
      return {
        id: opening.ref,
        status: "indeterminate",
        subjects,
        message: `${opening.ref} has no resolved room side for its sliding-leaf storage`,
        evidence: [evidence],
      };
    }
    if (opening.storage.length === 0) {
      return {
        id: opening.ref,
        status: "pass",
        subjects,
        message: `${opening.ref} needs no sliding-leaf storage beyond its aperture`,
        evidence: [evidence],
      };
    }
    const outside = opening.storage.reduce((sum, leaf) => sum + leaf.outsideTargetMm, 0);
    const failed = outside > EPS;
    return {
      id: opening.ref,
      status: failed ? "fail" : "pass",
      subjects,
      message: failed
        ? `${opening.ref} has ${roundMm(outside)} mm of sliding-leaf storage outside ${opening.intoSpace}`
        : `${opening.ref} keeps its sliding-leaf storage inside ${opening.intoSpace}`,
      evidence: [evidence],
    };
  });
  return { applicability: "applicable", outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]] };
}

function evaluateStorageOpeningOverlap(
  artifact: AnalysisArtifact<OpeningOperationsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") {
    return {
      applicability: "indeterminate",
      reason: "Opening operation geometry observations are incomplete",
      missing: artifact.missing,
      evidence: artifact.state === "partial" ? artifact.evidence : [],
    };
  }
  if (artifact.value.openings.length === 0) {
    return { applicability: "not-applicable", reason: "No placeable sliding opening is present", evidence: [] };
  }

  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  const outcomes = artifact.value.openings.map((opening): RuleOutcome => {
    const evidence = evidenceById.get(storageEvidenceId(opening.ref));
    if (!evidence) throw new Error(`missing opening-operation evidence for ${opening.ref}`);
    const subjects = storageSubjects(opening);
    if (opening.state === "indeterminate") {
      return {
        id: opening.ref,
        status: "indeterminate",
        subjects,
        message: `${opening.ref} has unresolved sliding-leaf storage geometry`,
        evidence: [evidence],
      };
    }
    const overlaps = opening.storage.flatMap((leaf) => leaf.overlappedOpenings);
    const first = overlaps[0];
    return {
      id: opening.ref,
      status: first ? "fail" : "pass",
      subjects,
      message: first
        ? `${opening.ref} stores a sliding leaf across ${first.ref} for ${roundMm(first.lengthMm)} mm`
        : `${opening.ref} stores no sliding leaf across another opening`,
      evidence: [evidence],
    };
  });
  return { applicability: "applicable", outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]] };
}

type SlidingStyle = SlidingStorageObservation["style"];
type SlideKind = "single" | "double" | "bypass";

function slidingStyle(style: string | undefined): SlidingStyle | undefined {
  switch (style) {
    case "sliding":
    case "sliding-double":
    case "sliding-bypass":
    case "auto":
    case "auto-single":
    case "auto-double":
    case "gate-sliding":
      return style;
    default:
      return undefined;
  }
}

function slideKind(style: SlidingStyle): SlideKind {
  if (
    style === "sliding-bypass"
    || style === "auto"
    || style === "auto-single"
    || style === "auto-double"
  ) return "bypass";
  if (style === "sliding-double") return "double";
  return "single";
}

function storageObservation(
  opening: FormOpening,
  style: SlidingStyle,
  spaces: readonly Space[],
  allOpenings: readonly FormOpening[],
): SlidingStorageObservation {
  const aperture = segment(opening.swing?.hinge ?? apertureStart(opening), opening.swing?.jamb ?? apertureEnd(opening));
  const base = {
    ref: opening.ref,
    boundaryRef: opening.ref.slice(0, opening.ref.lastIndexOf("/")),
    level: opening.level ?? "",
    kind: opening.kind,
    style,
    z0: opening.z0,
    z1: opening.z1,
    aperture,
  } as const;
  const kind = slideKind(style);
  if (kind === "bypass") {
    return {
      ...base,
      intoSpace: opening.swing?.into ?? null,
      state: "complete",
      reason: null,
      storage: [],
    };
  }
  if (!opening.swing || !opening.level) {
    return {
      ...base,
      intoSpace: opening.swing?.into ?? null,
      state: "indeterminate",
      reason: "opening-side-unresolved",
      storage: [],
    };
  }

  const target = spaces.find((space) => space.path === opening.swing!.into);
  if (!target) {
    return {
      ...base,
      intoSpace: opening.swing.into,
      state: "indeterminate",
      reason: "opening-side-unresolved",
      storage: [],
    };
  }

  const along = unit(opening.swing.hinge, opening.swing.jamb);
  const inward = unit(opening.swing.hinge, opening.swing.leaf);
  const faceOffset = opening.t / 2 + PROBE;
  const parkedAxis = kind === "double"
    ? [
        { widthMm: opening.w / 2, from: move(opening.swing.hinge, along, -opening.w / 2), to: opening.swing.hinge },
        { widthMm: opening.w / 2, from: opening.swing.jamb, to: move(opening.swing.jamb, along, opening.w / 2) },
      ]
    : [{ widthMm: opening.w, from: move(opening.swing.hinge, along, -opening.w), to: opening.swing.hinge }];
  const levelSpaces = spaces.filter((space) => space.level === opening.level);
  const storage = parkedAxis.map((leaf, index): SlidingStorageLeafObservation => {
    const axis = segment(leaf.from, leaf.to);
    const line = segment(move(leaf.from, inward, faceOffset), move(leaf.to, inward, faceOffset));
    const targetLength = coveredLength(line, regionOf(target));
    const crossedSpaces = levelSpaces
      .filter((space) => space.path !== target.path)
      .map((space): CrossedSpaceObservation => ({
        ref: space.path,
        lengthMm: roundMm(coveredLength(line, regionOf(space))),
      }))
      .filter((space) => space.lengthMm > EPS);
    return {
      leaf: index,
      widthMm: leaf.widthMm,
      parked: line,
      wallAxis: axis,
      outsideTargetMm: roundMm(Math.max(0, leaf.widthMm - targetLength)),
      crossedSpaces,
      overlappedOpenings: allOpenings
        .filter((candidate) => candidate.ref !== opening.ref && verticalOverlap(opening, candidate) > EPS)
        .map((candidate) => ({
          ref: candidate.ref,
          lengthMm: roundMm(collinearOverlap(axis, apertureSegment(candidate))),
        }))
        .filter((candidate) => candidate.lengthMm > EPS)
        .sort((a, b) => codePointCompare(a.ref, b.ref)),
    };
  });

  return {
    ...base,
    intoSpace: target.path,
    state: "complete",
    reason: null,
    storage,
  };
}

function apertureSegment(opening: FormOpening): OperationSegment {
  return segment(opening.swing?.hinge ?? apertureStart(opening), opening.swing?.jamb ?? apertureEnd(opening));
}

function verticalOverlap(a: FormOpening, b: FormOpening): number {
  return Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
}

function collinearOverlap(a: OperationSegment, b: OperationSegment): number {
  const from = { x: a.x1, y: a.y1 };
  const to = { x: a.x2, y: a.y2 };
  const direction = unit(from, to);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= EPS) return 0;
  const normal = { x: -direction.y, y: direction.x };
  const b1 = { x: b.x1, y: b.y1 };
  const b2 = { x: b.x2, y: b.y2 };
  const distance1 = Math.abs((b1.x - from.x) * normal.x + (b1.y - from.y) * normal.y);
  const distance2 = Math.abs((b2.x - from.x) * normal.x + (b2.y - from.y) * normal.y);
  if (distance1 > EPS || distance2 > EPS) return 0;
  const project = (point: Pt): number => (point.x - from.x) * direction.x + (point.y - from.y) * direction.y;
  const bStart = Math.min(project(b1), project(b2));
  const bEnd = Math.max(project(b1), project(b2));
  return Math.max(0, Math.min(length, bEnd) - Math.max(0, bStart));
}

function coveredLength(line: OperationSegment, pieces: readonly Pt[][]): number {
  const from = { x: line.x1, y: line.y1 };
  const to = { x: line.x2, y: line.y2 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length <= EPS) return 0;
  const cuts = [0, 1];
  for (const piece of pieces) {
    for (let i = 0; i < piece.length; i++) {
      addIntersectionParameters(cuts, from, to, piece[i]!, piece[(i + 1) % piece.length]!);
    }
  }
  cuts.sort((a, b) => a - b);
  const unique = cuts.filter((value, index) => index === 0 || Math.abs(value - cuts[index - 1]!) * length > EPS);
  let inside = 0;
  for (let i = 0; i + 1 < unique.length; i++) {
    const a = unique[i]!;
    const b = unique[i + 1]!;
    if ((b - a) * length <= EPS) continue;
    const at = (a + b) / 2;
    const point = { x: from.x + (to.x - from.x) * at, y: from.y + (to.y - from.y) * at };
    if (pieces.some((piece) => pointIn(point, piece))) inside += (b - a) * length;
  }
  return inside;
}

function addIntersectionParameters(cuts: number[], p: Pt, q: Pt, a: Pt, b: Pt): void {
  const rx = q.x - p.x;
  const ry = q.y - p.y;
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const cross = rx * sy - ry * sx;
  const apx = a.x - p.x;
  const apy = a.y - p.y;
  if (Math.abs(cross) <= PARALLEL_EPS) {
    if (Math.abs(apx * ry - apy * rx) > PARALLEL_EPS) return;
    const length2 = rx * rx + ry * ry;
    if (length2 === 0) return;
    for (const edgePoint of [a, b]) {
      const at = ((edgePoint.x - p.x) * rx + (edgePoint.y - p.y) * ry) / length2;
      if (at > 0 && at < 1) cuts.push(at);
    }
    return;
  }
  const t = (apx * sy - apy * sx) / cross;
  const u = (apx * ry - apy * rx) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) cuts.push(Math.max(0, Math.min(1, t)));
}

function apertureStart(opening: FormOpening): Pt {
  const along = unit({ x: opening.segment.x1, y: opening.segment.y1 }, { x: opening.segment.x2, y: opening.segment.y2 });
  return move({ x: opening.cx, y: opening.cy }, along, -opening.w / 2);
}

function apertureEnd(opening: FormOpening): Pt {
  const along = unit({ x: opening.segment.x1, y: opening.segment.y1 }, { x: opening.segment.x2, y: opening.segment.y2 });
  return move({ x: opening.cx, y: opening.cy }, along, opening.w / 2);
}

function unit(from: Pt, to: Pt): Pt {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function move(point: Pt, direction: Pt, distance: number): Pt {
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance };
}

function segment(from: Pt, to: Pt): OperationSegment {
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function storageEvidence(
  observation: SlidingStorageObservation,
  formOpening: FormOpening,
  model: Model,
): Evidence {
  const boundary = canonicalBoundaryOrder(model)[formOpening.boundary]!;
  const opening = canonicalOpeningOrder(boundary)[formOpening.index]!;
  return {
    id: storageEvidenceId(observation.ref),
    kind: "fact",
    name: "openingOperationGeometry",
    value: observation,
    subjects: storageSubjects(observation),
    sources: [modelSource(openingSubject(observation.ref), opening.line, boundary.file)],
    producedBy: OPENING_OPERATIONS_ANALYSIS_ID,
  };
}

function storageSubjects(observation: SlidingStorageObservation): [SubjectRef, ...SubjectRef[]] {
  const refs: SubjectRef[] = [openingSubject(observation.ref)];
  if (observation.intoSpace) refs.push(spaceSubject(observation.intoSpace));
  const crossed = new Set(observation.storage.flatMap((leaf) => leaf.crossedSpaces.map((space) => space.ref)));
  for (const ref of [...crossed].sort(codePointCompare)) refs.push(spaceSubject(ref));
  const openings = new Set(observation.storage.flatMap((leaf) => leaf.overlappedOpenings.map((item) => item.ref)));
  for (const ref of [...openings].sort(codePointCompare)) refs.push(openingSubject(ref));
  return refs as [SubjectRef, ...SubjectRef[]];
}

function modelSource(subject: SubjectRef, line: number, file?: string): SourceRef {
  return {
    kind: "model",
    subject,
    location: { ...(file !== undefined ? { file } : {}), line },
  };
}

function openingSubject(ref: string): SubjectRef {
  return { kind: "opening", ref };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function storageEvidenceId(ref: string): string {
  return `opening-operation:${ref}`;
}
