import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { codePointCompare } from "../../analysis/json.js";
import { placeOpening, type Segment } from "../../core/graph.js";
import {
  canonicalBoundaryOrder,
  canonicalOpeningOrder,
  columnsFor,
  levelsSorted,
  type Boundary,
  type Column,
  type Model,
  type Opening,
} from "../../core/model.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export const COLUMN_BLOCKS_DOOR_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.column.blocksdoor",
  revision: "1",
} as const);

export type DoorSegmentObservation = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly horizontal: boolean;
};

export type ColumnObservation = {
  readonly ref: string;
  readonly grid: string;
  readonly level: string;
  readonly centerMm: { readonly x: number; readonly y: number };
  readonly widthMm: number;
  readonly depthMm: number;
};

export type DoorColumnObservation = {
  readonly ref: string;
  readonly boundaryRef: string;
  readonly level: string;
  readonly boundary: { readonly a: string; readonly b: string };
  readonly widthMm: number;
  readonly centerMm: { readonly x: number; readonly y: number };
  readonly segment: DoorSegmentObservation;
  readonly firstColumnIntersection: ColumnObservation | null;
};

export type DoorColumnCollisionsAnalysisValue = {
  readonly doors: readonly DoorColumnObservation[];
};

export const DOOR_COLUMN_COLLISIONS_ANALYSIS_ID: AnalysisRef<DoorColumnCollisionsAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.door-column-collisions",
  revision: "1",
});

export const DOOR_COLUMN_COLLISIONS_ANALYSIS: AnalysisDefinition<DoorColumnCollisionsAnalysisValue> = freezeBuiltin<AnalysisDefinition<DoorColumnCollisionsAnalysisValue>>({
  ...DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
  title: "Door and column geometry observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<DoorColumnCollisionsAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const columnsByLevel = new Map<string, Column[]>();
    for (const level of levelsSorted(coreModel)) {
      columnsByLevel.set(level.name, columnsFor(coreModel, level.name));
    }

    const doors: DoorColumnObservation[] = [];
    const evidence: Evidence[] = [];
    for (const [boundaryIndex, boundary] of canonicalBoundaryOrder(coreModel).entries()) {
      const level = model.spaces.get(boundary.a)?.level ?? model.spaces.get(boundary.b)?.level;
      if (!level) continue;
      const boundaryRef = `${boundary.a}|${boundary.b}@${boundaryIndex}`;
      for (const [openingIndex, opening] of canonicalOpeningOrder(boundary).entries()) {
        if (opening.kind !== "door") continue;
        const placed = placeOpening(coreModel, boundary, opening);
        if ("error" in placed) continue;
        const column = firstIntersectingColumn(placed.segment, placed.cx, placed.cy, opening, columnsByLevel.get(level) ?? []);
        const observation: DoorColumnObservation = {
          ref: `${boundaryRef}/${openingIndex}`,
          boundaryRef,
          level,
          boundary: { a: boundary.a, b: boundary.b },
          widthMm: opening.w,
          centerMm: { x: placed.cx, y: placed.cy },
          segment: segmentObservation(placed.segment),
          firstColumnIntersection: column ? columnObservation(column) : null,
        };
        doors.push(observation);
        evidence.push(doorColumnEvidence(observation, boundary, column, coreModel));
      }
    }

    doors.sort((a, b) => codePointCompare(a.ref, b.ref));
    evidence.sort((a, b) => codePointCompare(a.id, b.id));
    return { state: "complete", value: { doors }, evidence };
  },
});

export const COLUMN_BLOCKS_DOOR_RULE: Rule = freezeBuiltin<Rule>({
  ...COLUMN_BLOCKS_DOOR_RULE_ID,
  title: "Column and door overlap",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: DOOR_COLUMN_COLLISIONS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateColumnDoorGeometry(get(DOOR_COLUMN_COLLISIONS_ANALYSIS_ID)),
});

function evaluateColumnDoorGeometry(
  artifact: AnalysisArtifact<DoorColumnCollisionsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  if (artifact.value.doors.length === 0) return notApplicable("No placeable door has a resolvable level");

  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
  return applicable(artifact.value.doors.map((door): RuleOutcome => {
    const column = door.firstColumnIntersection;
    const failed = column !== null;
    const evidence = evidenceById.get(doorEvidenceId(door.ref));
    if (!evidence) throw new Error(`missing door-column evidence for ${door.ref}`);
    return {
      id: door.ref,
      status: failed ? "fail" : "pass",
      subjects: [spaceSubject(door.boundary.a), spaceSubject(door.boundary.b)],
      message: failed
        ? `${door.ref} intersects the derived column at ${column.grid}`
        : `${door.ref} does not intersect a derived column`,
      evidence: [evidence],
    };
  }));
}

function firstIntersectingColumn(
  segment: Segment,
  centerX: number,
  centerY: number,
  opening: Opening,
  columns: readonly Column[],
): Column | undefined {
  const half = opening.w / 2;
  for (const column of columns) {
    const x1 = column.x - column.w / 2;
    const x2 = column.x + column.w / 2;
    const y1 = column.y - column.d / 2;
    const y2 = column.y + column.d / 2;
    const along = segment.horizontal
      ? Math.max(centerX - half, x1) < Math.min(centerX + half, x2)
      : Math.max(centerY - half, y1) < Math.min(centerY + half, y2);
    const across = segment.horizontal
      ? y1 < segment.y1 && segment.y1 < y2
      : x1 < segment.x1 && segment.x1 < x2;
    if (along && across) return column;
  }
  return undefined;
}

function doorColumnEvidence(
  observation: DoorColumnObservation,
  boundary: Boundary,
  column: Column | undefined,
  model: Model,
): Evidence {
  const door = openingSubject(observation.ref);
  const columnRef = column ? columnSubject(columnRefOf(column)) : undefined;
  const declaration = column ? model.columns[column.decl] : undefined;
  const sources: SourceRef[] = [modelSource(boundarySubject(observation.boundaryRef), boundary.line, boundary.file)];
  if (columnRef && declaration) sources.push(modelSource(columnRef, declaration.line, declaration.file));
  return {
    id: doorEvidenceId(observation.ref),
    kind: "fact",
    name: "doorColumnGeometry",
    value: observation,
    subjects: columnRef ? [door, columnRef] : [door],
    sources: sources as [SourceRef, ...SourceRef[]],
    producedBy: DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
  };
}

function columnObservation(column: Column): ColumnObservation {
  return {
    ref: columnRefOf(column),
    grid: column.grid,
    level: column.level,
    centerMm: { x: column.x, y: column.y },
    widthMm: column.w,
    depthMm: column.d,
  };
}

function segmentObservation(segment: Segment): DoorSegmentObservation {
  return {
    x1: segment.x1,
    y1: segment.y1,
    x2: segment.x2,
    y2: segment.y2,
    horizontal: segment.horizontal,
  };
}

function applicable(outcomes: RuleOutcome[]): RuleEvaluation {
  if (outcomes.length === 0) throw new Error("applicable evaluation requires an outcome");
  return {
    applicability: "applicable",
    outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]],
  };
}

function notApplicable(reason: string): RuleEvaluation {
  return { applicability: "not-applicable", reason, evidence: [] };
}

function analysisIndeterminate(
  artifact: Exclude<AnalysisArtifact<DoorColumnCollisionsAnalysisValue>, { state: "complete" }>,
): RuleEvaluation {
  return {
    applicability: "indeterminate",
    reason: "Door and column geometry observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
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

function columnSubject(ref: string): SubjectRef {
  return { kind: "koyu.column", ref };
}

function boundarySubject(ref: string): SubjectRef {
  return { kind: "boundary", ref };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function columnRefOf(column: Column): string {
  return `${column.level}/${column.grid}`;
}

function doorEvidenceId(ref: string): string {
  return `door-column:${ref}`;
}
