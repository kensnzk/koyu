import type {
  AnalysisDefinition,
  AnalysisArtifact,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { envelopeGaps, segmentLength } from "../../core/graph.js";
import {
  canonicalSpaceOrder,
  isOutside,
  isSemiOutdoor,
  type Model,
  type Space,
} from "../../core/model.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export type EnvelopeRunFact = {
  readonly edge: string;
  readonly lengthMm: number;
  readonly segment: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
  };
};

export type EnvelopeSpaceFact = {
  readonly ref: string;
  readonly levelRef: string;
  readonly uncoveredLengthMm: number;
  readonly runs: readonly EnvelopeRunFact[];
};

export type EnvelopeAnalysisValue = {
  readonly startedLevels: readonly string[];
  readonly spaces: readonly EnvelopeSpaceFact[];
};

export const ENVELOPE_ANALYSIS_ID: AnalysisRef<EnvelopeAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.envelope",
  revision: "1",
});

export const ENVELOPE_GAP_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.envelope.gap",
  revision: "1",
} as const);

const VERTICAL_BOUNDARIES = new Set(["stair", "shaft", "void"]);

export const ENVELOPE_ANALYSIS: AnalysisDefinition<EnvelopeAnalysisValue> = freezeBuiltin<AnalysisDefinition<EnvelopeAnalysisValue>>({
  ...ENVELOPE_ANALYSIS_ID,
  title: "Envelope observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<EnvelopeAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const startedLevels = new Set<string>();
    for (const boundary of model.boundaries) {
      if (boundary.derived || VERTICAL_BOUNDARIES.has(boundary.kind)) continue;
      const a = model.spaces.get(boundary.a);
      const b = model.spaces.get(boundary.b);
      if (!a || !b) continue;
      const outer = a.rects.length === 0 ? b : b.rects.length === 0 ? a : undefined;
      if (outer?.level) startedLevels.add(outer.level);
    }

    const siteZones = [...model.zones.values()]
      .filter((zone) => zone.attrs["site"] === 1)
      .map((zone) => zone.path)
      .sort(compareText);
    const spaces = canonicalSpaceOrder(coreModel)
      .filter((space) => envelopePopulation(coreModel, space, startedLevels, siteZones))
      .map((space) => envelopeFact(coreModel, space));
    const evidence = spaces.map((space) => envelopeEvidence(space, coreModel.spaces.get(space.ref)!));

    return {
      state: "complete",
      value: {
        startedLevels: [...startedLevels].sort(compareText),
        spaces,
      },
      evidence,
    };
  },
});

export const ENVELOPE_GAP_RULE: Rule = freezeBuiltin<Rule>({
  ...ENVELOPE_GAP_RULE_ID,
  title: "Envelope perimeter gap",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: ENVELOPE_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(ENVELOPE_ANALYSIS_ID);
    if (artifact.state !== "complete") return analysisIndeterminate(artifact);
    if (artifact.value.spaces.length === 0) {
      return {
        applicability: "not-applicable",
        reason: "No enclosed-space population exists on a level whose envelope has been started",
        evidence: [],
      };
    }

    const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));
    const outcomes = artifact.value.spaces.map((space): RuleOutcome => {
        const evidence = evidenceById.get(envelopeEvidenceId(space.ref));
        if (!evidence) throw new Error(`missing envelope evidence for ${space.ref}`);
        const status = space.runs.length > 0 ? "fail" : "pass";
        return {
          id: space.ref,
          status,
          subjects: [spaceSubject(space.ref)],
          message: status === "fail"
            ? `Perimeter not faced by any envelope: ${space.ref} — ${describeRuns(space.runs)} (${Math.round(space.uncoveredLengthMm)}mm over ${space.runs.length} run(s)). Write a boundary to the exterior`
            : `${space.ref} has no uncovered envelope run`,
          evidence: [evidence],
        };
      });
    return { applicability: "applicable", outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]] };
  },
});

function envelopePopulation(
  model: Parameters<typeof isSemiOutdoor>[0],
  space: Space,
  startedLevels: ReadonlySet<string>,
  siteZones: readonly string[],
): boolean {
  if (space.rects.length === 0 || !space.level || !startedLevels.has(space.level)) return false;
  if (isOutside(space) || isSemiOutdoor(model, space)) return false;
  return !siteZones.some((zone) => space.path.startsWith(`${zone}/`));
}

function envelopeFact(
  model: Parameters<typeof envelopeGaps>[0],
  space: Space,
): EnvelopeSpaceFact {
  const runs = envelopeGaps(model, space)
    .map((segment): EnvelopeRunFact => ({
      edge: segment.edgeOfA ?? (segment.horizontal ? "N/S" : "E/W"),
      lengthMm: segmentLength(segment),
      segment: {
        x1: segment.x1,
        y1: segment.y1,
        x2: segment.x2,
        y2: segment.y2,
      },
    }))
    .sort(compareRuns);
  return {
    ref: space.path,
    levelRef: space.level!,
    uncoveredLengthMm: runs.reduce((sum, run) => sum + run.lengthMm, 0),
    runs,
  };
}

function envelopeEvidence(space: EnvelopeSpaceFact, source: Space): Evidence {
  const subject = spaceSubject(space.ref);
  return {
    id: envelopeEvidenceId(space.ref),
    kind: "fact",
    name: "uncoveredEnvelopeRuns",
    value: {
      length: { value: space.uncoveredLengthMm, unit: "mm" },
      runs: space.runs,
    },
    subjects: [subject],
    sources: [modelSource(subject, source)],
    producedBy: ENVELOPE_ANALYSIS_ID,
  };
}

function modelSource(subject: SubjectRef, source: Space): SourceRef {
  return {
    kind: "model",
    subject,
    location: {
      ...(source.file !== undefined ? { file: source.file } : {}),
      line: source.line,
    },
  };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function envelopeEvidenceId(ref: string): string {
  return `envelope:${ref}`;
}

function analysisIndeterminate(
  artifact: Exclude<AnalysisArtifact<EnvelopeAnalysisValue>, { state: "complete" }>,
): Extract<RuleEvaluation, { applicability: "indeterminate" }> {
  return {
    applicability: "indeterminate",
    reason: "Envelope observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
}

/** `S 3600mm / N 3600mm / W 4500mm` — which way each uncovered run faces, and how long it is. */
function describeRuns(runs: readonly EnvelopeRunFact[]): string {
  return runs.map((run) => `${run.edge} ${Math.round(run.lengthMm)}mm`).join(" / ");
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRuns(a: EnvelopeRunFact, b: EnvelopeRunFact): number {
  return compareText(a.edge, b.edge)
    || a.segment.x1 - b.segment.x1
    || a.segment.y1 - b.segment.y1
    || a.segment.x2 - b.segment.x2
    || a.segment.y2 - b.segment.y2;
}
