import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  Evidence,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import type { Model, Space } from "../../core/model.js";
import { verticalRuns } from "../../core/vertical.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

export const STAIR_PROPORTION_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.stair.proportion",
  revision: "1",
} as const);

export const RAMP_DECLARED_SLOPE_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.ramp.declared-slope",
  revision: "1",
} as const);

export const ESCALATOR_USUAL_SLOPE_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.escalator.usual-slope",
  revision: "1",
} as const);

export const RUN_DISCONNECTED_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.run.disconnected",
  revision: "1",
} as const);

export const TREAD_MIN_MM = 240;
export const STEP_RULE_MM = freezeBuiltin({ minimum: 550, maximum: 700 } as const);
export const ESCALATOR_SLOPE_BAND = freezeBuiltin({ minimum: 1 / 2.3, maximum: 1 / 1.4 } as const);
export const RAMP_SLOPE_EPSILON = 1e-9;

export type VerticalRunFact = {
  readonly ref: string;
  readonly device: "stair" | "ramp" | "escalator" | "lift";
  readonly levelRef: string;
  readonly upperLevelRef: string | null;
  readonly riseMm: number;
  readonly runLengthMm: number;
  readonly goingMm: number;
  readonly risers: number;
  readonly riserMm: number;
  readonly treadMm: number;
  readonly slope: number;
  readonly declaredSlopeDenominator: number | null;
  readonly verticalBoundaryLinked: boolean;
};

export type VerticalRunsAnalysisValue = {
  readonly runs: readonly VerticalRunFact[];
};

export const VERTICAL_RUNS_ANALYSIS_ID: AnalysisRef<VerticalRunsAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.vertical-runs",
  revision: "1",
});

export const VERTICAL_RUNS_ANALYSIS: AnalysisDefinition<VerticalRunsAnalysisValue> = freezeBuiltin<AnalysisDefinition<VerticalRunsAnalysisValue>>({
  ...VERTICAL_RUNS_ANALYSIS_ID,
  title: "Vertical circulation observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<VerticalRunsAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const linked = new Set<string>();
    for (const boundary of model.boundaries) {
      if (boundary.kind !== "stair" && boundary.kind !== "shaft") continue;
      linked.add(boundary.a);
      linked.add(boundary.b);
    }

    const runs = verticalRuns(coreModel).map((run): VerticalRunFact => {
      const source = model.spaces.get(run.path);
      const declared = source?.attrs["slope"];
      return {
        ref: run.path,
        device: run.device,
        levelRef: run.level,
        upperLevelRef: run.upper ?? null,
        riseMm: run.rise,
        runLengthMm: run.length,
        goingMm: run.going,
        risers: run.risers,
        riserMm: run.riser,
        treadMm: run.tread,
        slope: run.slope,
        declaredSlopeDenominator: typeof declared === "number" ? declared : null,
        verticalBoundaryLinked: linked.has(run.path),
      };
    });

    return {
      state: "complete",
      value: { runs },
      evidence: runs.map((run) => runObservation(run, coreModel.spaces.get(run.ref))),
    };
  },
});

export const STAIR_PROPORTION_RULE: Rule = freezeBuiltin<Rule>({
  ...STAIR_PROPORTION_RULE_ID,
  title: "Stair proportion",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: VERTICAL_RUNS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateStairProportion(get(VERTICAL_RUNS_ANALYSIS_ID)),
});

export const RAMP_DECLARED_SLOPE_RULE: Rule = freezeBuiltin<Rule>({
  ...RAMP_DECLARED_SLOPE_RULE_ID,
  title: "Ramp declared slope",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: VERTICAL_RUNS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateRampSlope(get(VERTICAL_RUNS_ANALYSIS_ID)),
});

export const ESCALATOR_USUAL_SLOPE_RULE: Rule = freezeBuiltin<Rule>({
  ...ESCALATOR_USUAL_SLOPE_RULE_ID,
  title: "Escalator usual slope",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: VERTICAL_RUNS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateEscalatorSlope(get(VERTICAL_RUNS_ANALYSIS_ID)),
});

export const RUN_DISCONNECTED_RULE: Rule = freezeBuiltin<Rule>({
  ...RUN_DISCONNECTED_RULE_ID,
  title: "Vertical run connection",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: VERTICAL_RUNS_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateRunConnection(get(VERTICAL_RUNS_ANALYSIS_ID)),
});

function evaluateStairProportion(
  artifact: AnalysisArtifact<VerticalRunsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  const population = artifact.value.runs.filter((run) => run.device === "stair");
  if (population.length === 0) return notApplicable("No derived stair run exists");
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(population.map((run): RuleOutcome => {
    const tread = Math.round(run.treadMm);
    const riser = Math.round(run.riserMm);
    const pace = 2 * riser + tread;
    const failed = tread < TREAD_MIN_MM || pace < STEP_RULE_MM.minimum || pace > STEP_RULE_MM.maximum;
    return {
      id: run.ref,
      status: failed ? "fail" : "pass",
      subjects: [runSubject(run.ref)],
      message: failed
        ? `${run.ref} has a derived tread or pace outside the schematic band`
        : `${run.ref} has a derived tread and pace inside the schematic band`,
      evidence: [
        requiredRunEvidence(evidenceById, run.ref),
        comparisonEvidence(
          "tread-minimum",
          run,
          { value: tread, unit: "mm" },
          ">=",
          { value: TREAD_MIN_MM, unit: "mm" },
          STAIR_PROPORTION_RULE_ID,
        ),
        comparisonEvidence(
          "pace-band",
          run,
          { value: pace, unit: "mm" },
          "inside",
          {
            minimum: { value: STEP_RULE_MM.minimum, unit: "mm" },
            maximum: { value: STEP_RULE_MM.maximum, unit: "mm" },
          },
          STAIR_PROPORTION_RULE_ID,
        ),
      ],
    };
  }));
}

function evaluateRampSlope(
  artifact: AnalysisArtifact<VerticalRunsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  const population = artifact.value.runs.filter(
    (run) => run.device === "ramp"
      && run.declaredSlopeDenominator !== null
      && run.declaredSlopeDenominator > 0,
  );
  if (population.length === 0) return notApplicable("No ramp has a positive declared slope denominator");
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(population.map((run): RuleOutcome => {
    const declaredLimit = 1 / run.declaredSlopeDenominator!;
    const executableLimit = declaredLimit + RAMP_SLOPE_EPSILON;
    const failed = run.slope > executableLimit;
    return {
      id: run.ref,
      status: failed ? "fail" : "pass",
      subjects: [runSubject(run.ref)],
      message: failed
        ? `${run.ref} is steeper than its declared 1/${run.declaredSlopeDenominator} limit`
        : `${run.ref} is no steeper than its declared 1/${run.declaredSlopeDenominator} limit`,
      evidence: [
        requiredRunEvidence(evidenceById, run.ref),
        comparisonEvidence(
          "declared-slope-limit",
          run,
          { value: run.slope, unit: "ratio" },
          "<=",
          { value: executableLimit, unit: "ratio" },
          RAMP_DECLARED_SLOPE_RULE_ID,
        ),
        {
          id: "declared-slope-input",
          kind: "fact",
          name: "declaredSlopeLimit",
          value: {
            denominator: run.declaredSlopeDenominator!,
            ratio: declaredLimit,
            comparisonEpsilon: RAMP_SLOPE_EPSILON,
          },
          subjects: [runSubject(run.ref)],
          sources: [modelRunSource(run.ref)],
          producedBy: RAMP_DECLARED_SLOPE_RULE_ID,
        },
      ],
    };
  }));
}

function evaluateEscalatorSlope(
  artifact: AnalysisArtifact<VerticalRunsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  const population = artifact.value.runs.filter((run) => run.device === "escalator");
  if (population.length === 0) return notApplicable("No derived escalator run exists");
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(population.map((run): RuleOutcome => {
    const failed = run.slope < ESCALATOR_SLOPE_BAND.minimum || run.slope > ESCALATOR_SLOPE_BAND.maximum;
    return {
      id: run.ref,
      status: failed ? "fail" : "pass",
      subjects: [runSubject(run.ref)],
      message: failed
        ? `${run.ref} is outside the schematic escalator slope band`
        : `${run.ref} is inside the schematic escalator slope band`,
      evidence: [
        requiredRunEvidence(evidenceById, run.ref),
        comparisonEvidence(
          "usual-slope-band",
          run,
          { value: run.slope, unit: "ratio" },
          "inside",
          {
            minimum: { value: ESCALATOR_SLOPE_BAND.minimum, unit: "ratio" },
            maximum: { value: ESCALATOR_SLOPE_BAND.maximum, unit: "ratio" },
          },
          ESCALATOR_USUAL_SLOPE_RULE_ID,
        ),
      ],
    };
  }));
}

function evaluateRunConnection(
  artifact: AnalysisArtifact<VerticalRunsAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  const population = artifact.value.runs.filter((run) => run.device !== "lift");
  if (population.length === 0) return notApplicable("No non-lift vertical run exists");
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(population.map((run): RuleOutcome => ({
    id: run.ref,
    status: run.verticalBoundaryLinked ? "pass" : "fail",
    subjects: [runSubject(run.ref)],
    message: run.verticalBoundaryLinked
      ? `${run.ref} is an endpoint of a vertical boundary`
      : `${run.ref} is not an endpoint of a vertical boundary`,
    evidence: [requiredRunEvidence(evidenceById, run.ref)],
  })));
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
  artifact: Exclude<AnalysisArtifact<VerticalRunsAnalysisValue>, { state: "complete" }>,
): RuleEvaluation {
  return {
    applicability: "indeterminate",
    reason: "Vertical-run observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
}

function runObservation(run: VerticalRunFact, source: Space | undefined): Evidence {
  const subject = runSubject(run.ref);
  return {
    id: runObservationEvidenceId(run.ref),
    kind: "fact",
    name: "verticalRun",
    value: run,
    subjects: [subject],
    sources: [{
      kind: "model",
      subject,
      ...(source
        ? {
            location: {
              ...(source.file !== undefined ? { file: source.file } : {}),
              line: source.line,
            },
          }
        : {}),
    }],
    producedBy: VERTICAL_RUNS_ANALYSIS_ID,
  };
}

function comparisonEvidence(
  id: string,
  run: VerticalRunFact,
  observed: { readonly value: number; readonly unit: string },
  operator: "<=" | ">=" | "inside",
  required:
    | { readonly value: number; readonly unit: string }
    | {
        readonly minimum: { readonly value: number; readonly unit: string };
        readonly maximum: { readonly value: number; readonly unit: string };
      },
  producedBy: AnalysisRef,
): Evidence {
  return {
    id,
    kind: "comparison",
    observed,
    operator,
    required,
    subjects: [runSubject(run.ref)],
    sources: [modelRunSource(run.ref)],
    producedBy,
  };
}

function runSubject(ref: string): SubjectRef {
  return { kind: "run", ref };
}

function modelRunSource(ref: string): SourceRef {
  return { kind: "model", subject: runSubject(ref) };
}

function requiredRunEvidence(evidence: ReadonlyMap<string, Evidence>, ref: string): Evidence {
  const item = evidence.get(runObservationEvidenceId(ref));
  if (!item) throw new Error(`missing vertical-run evidence for ${ref}`);
  return item;
}

function runObservationEvidenceId(ref: string): string {
  return `vertical-run:${ref}`;
}
