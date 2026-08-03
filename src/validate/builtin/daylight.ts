import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  ComponentIdentity,
  Evidence,
  Quantity,
  SourceRef,
  SubjectRef,
} from "../../analysis/contracts.js";
import { codePointCompare } from "../../analysis/json.js";
import { COVERED_SEMI_FACTOR, daylightInputs } from "../../core/light.js";
import {
  canonicalBoundaryOrder,
  canonicalOpeningOrder,
  isCoveredAbove,
  isOutside,
  isSemiOutdoor,
  type Model,
  type Space,
} from "../../core/model.js";
import type { Rule, RuleEvaluation, RuleOutcome } from "../contracts.js";
import { freezeBuiltin } from "./freeze.js";

/** The denominator of the required window area. **An architectural number, not a core invariant.** */
export const DAYLIGHT_DIVISOR = 7;

/** The tolerance the legacy comparison used, kept so the migration does not move the boundary. */
export const DAYLIGHT_AREA_EPSILON = 1e-9;

/**
 * A window that counts toward daylight but carries no `h:`, so its area is not in the sum.
 *
 * The shortfall is a **fact of the model**, not a missing external input: the artifact stays
 * `complete` and the count is carried here, so the ratio keeps the population it always had
 * and the gap is still visible.
 */
export type MissingHeightOpeningFact = {
  readonly ref: string;
  readonly boundaryRef: string;
  readonly widthMm: number;
  readonly location: { readonly file?: string; readonly line: number };
};

export type DaylightSpaceFact = {
  readonly ref: string;
  readonly floorAreaM2: number;
  readonly effectiveWindowAreaM2: number;
  readonly missingHeightOpenings: readonly MissingHeightOpeningFact[];
};

export type DaylightAnalysisValue = {
  readonly spaces: readonly DaylightSpaceFact[];
};

export const DAYLIGHT_ANALYSIS_ID: AnalysisRef<DaylightAnalysisValue> = freezeBuiltin({
  id: "koyu.analysis.daylight",
  revision: "1",
});

export const DAYLIGHT_RATIO_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.daylight.ratio",
  revision: "1",
} as const);

export const DAYLIGHT_UNKNOWN_RULE_ID = freezeBuiltin({
  id: "koyu.schematic.daylight.unknown",
  revision: "1",
} as const);

export const DAYLIGHT_ANALYSIS: AnalysisDefinition<DaylightAnalysisValue> = freezeBuiltin<AnalysisDefinition<DaylightAnalysisValue>>({
  ...DAYLIGHT_ANALYSIS_ID,
  title: "Daylight observations",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<DaylightAnalysisValue> => {
    const coreModel = model as unknown as Model;
    const uncounted = uncountedWindows(coreModel);
    const spaces = daylightInputs(coreModel)
      .map((input): DaylightSpaceFact => ({
        ref: input.space.path,
        floorAreaM2: input.floor,
        effectiveWindowAreaM2: input.window,
        missingHeightOpenings: uncounted.get(input.space.path) ?? [],
      }))
      .sort((a, b) => codePointCompare(a.ref, b.ref));

    return {
      state: "complete",
      value: { spaces },
      evidence: spaces.map((space) => daylightObservation(space, coreModel.spaces.get(space.ref))),
    };
  },
});

export const DAYLIGHT_RATIO_RULE: Rule = freezeBuiltin<Rule>({
  ...DAYLIGHT_RATIO_RULE_ID,
  title: "Daylight area ratio",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: DAYLIGHT_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateDaylightRatio(get(DAYLIGHT_ANALYSIS_ID)),
});

export const DAYLIGHT_UNKNOWN_RULE: Rule = freezeBuiltin<Rule>({
  ...DAYLIGHT_UNKNOWN_RULE_ID,
  title: "Daylight window area completeness",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: DAYLIGHT_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }) => evaluateDaylightCompleteness(get(DAYLIGHT_ANALYSIS_ID)),
});

function evaluateDaylightRatio(
  artifact: AnalysisArtifact<DaylightAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  if (artifact.value.spaces.length === 0) return notApplicable(NO_POPULATION);
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(artifact.value.spaces.map((space): RuleOutcome => {
    const required = space.floorAreaM2 / DAYLIGHT_DIVISOR;
    const failed = space.effectiveWindowAreaM2 + DAYLIGHT_AREA_EPSILON < required;
    return {
      id: space.ref,
      status: failed ? "fail" : "pass",
      subjects: [spaceSubject(space.ref)],
      message: failed
        ? `Insufficient daylight: ${space.ref} — effective window ${space.effectiveWindowAreaM2.toFixed(2)} m2 < required ${required.toFixed(2)} m2 (1/${DAYLIGHT_DIVISOR} of the ${space.floorAreaM2.toFixed(2)} m2 floor)`
        : `${space.ref} has effective window ${space.effectiveWindowAreaM2.toFixed(2)} m2 against required ${required.toFixed(2)} m2`,
      evidence: [
        requiredSpaceEvidence(evidenceById, space.ref),
        comparisonEvidence(
          "required-window-area",
          space.ref,
          { value: space.effectiveWindowAreaM2, unit: "m2" },
          ">=",
          { value: required, unit: "m2" },
          DAYLIGHT_RATIO_RULE_ID,
        ),
      ],
    };
  }));
}

function evaluateDaylightCompleteness(
  artifact: AnalysisArtifact<DaylightAnalysisValue>,
): RuleEvaluation {
  if (artifact.state !== "complete") return analysisIndeterminate(artifact);
  if (artifact.value.spaces.length === 0) return notApplicable(NO_POPULATION);
  const evidenceById = new Map(artifact.evidence.map((item) => [item.id, item]));

  return applicable(artifact.value.spaces.map((space): RuleOutcome => {
    const uncounted = space.missingHeightOpenings.length;
    return {
      id: space.ref,
      status: uncounted > 0 ? "fail" : "pass",
      subjects: [spaceSubject(space.ref)],
      message: uncounted > 0
        ? `Window area is not fully counted: ${space.ref} has a window without h: (write h: on it)`
        : `${space.ref} counts the area of every window that faces daylight`,
      evidence: [
        requiredSpaceEvidence(evidenceById, space.ref),
        comparisonEvidence(
          "uncounted-window-openings",
          space.ref,
          { value: uncounted, unit: "count" },
          "<=",
          { value: 0, unit: "count" },
          DAYLIGHT_UNKNOWN_RULE_ID,
        ),
      ],
    };
  }));
}

/**
 * The windows that face daylight but carry no `h:`, grouped by the space that asked the question.
 *
 * The population and the "does this opening count" test are the ones `daylightInputs` applies;
 * only the identity is added here, so the enumeration cannot disagree with the counted area.
 */
function uncountedWindows(model: Model): Map<string, MissingHeightOpeningFact[]> {
  const out = new Map<string, MissingHeightOpeningFact[]>();
  for (const [boundaryIndex, boundary] of canonicalBoundaryOrder(model).entries()) {
    const boundaryRef = `${boundary.a}|${boundary.b}@${boundaryIndex}`;
    const openings = canonicalOpeningOrder(boundary)
      .map((opening, openingIndex) => ({ opening, openingIndex }))
      .filter(({ opening }) => opening.kind === "window" && opening.h === undefined);
    if (openings.length === 0) continue;

    for (const near of [boundary.a, boundary.b] as const) {
      const space = model.spaces.get(near);
      if (!space || !asksDaylight(space)) continue;
      const far = model.spaces.get(near === boundary.a ? boundary.b : boundary.a);
      if (!far || daylightFactor(model, far) === 0) continue;

      const list = out.get(near) ?? [];
      for (const { opening, openingIndex } of openings) {
        list.push({
          ref: `${boundaryRef}/${openingIndex}`,
          boundaryRef,
          widthMm: opening.w,
          location: {
            ...(boundary.file !== undefined ? { file: boundary.file } : {}),
            line: boundary.line,
          },
        });
      }
      out.set(near, list);
    }
  }
  return out;
}

/** Whether the space put the daylight question on itself — never inferred from the type word (ADR-0020). */
function asksDaylight(space: Space): boolean {
  return space.rects.length > 0 && space.attrs["daylight"] === 1;
}

/** The coefficient `daylightInputs` applies to what lies beyond the window; 0 means it does not count. */
function daylightFactor(model: Model, far: Space): number {
  if (isOutside(far)) return 1;
  if (!isSemiOutdoor(model, far)) return 0;
  return isCoveredAbove(model, far) ? COVERED_SEMI_FACTOR : 1;
}

function daylightObservation(space: DaylightSpaceFact, source: Space | undefined): Evidence {
  const subject = spaceSubject(space.ref);
  return {
    id: daylightEvidenceId(space.ref),
    kind: "fact",
    name: "daylightInputs",
    value: {
      floor: { value: space.floorAreaM2, unit: "m2" },
      effectiveWindow: { value: space.effectiveWindowAreaM2, unit: "m2" },
      missingHeightOpenings: space.missingHeightOpenings,
    },
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
    producedBy: DAYLIGHT_ANALYSIS_ID,
  };
}

function comparisonEvidence(
  id: string,
  ref: string,
  observed: Quantity,
  operator: "<=" | ">=",
  required: Quantity,
  producedBy: ComponentIdentity,
): Evidence {
  return {
    id,
    kind: "comparison",
    observed,
    operator,
    required,
    subjects: [spaceSubject(ref)],
    sources: [modelSpaceSource(ref)],
    producedBy,
  };
}

function requiredSpaceEvidence(evidence: ReadonlyMap<string, Evidence>, ref: string): Evidence {
  const item = evidence.get(daylightEvidenceId(ref));
  if (!item) throw new Error(`missing daylight evidence for ${ref}`);
  return item;
}

function modelSpaceSource(ref: string): SourceRef {
  return { kind: "model", subject: spaceSubject(ref) };
}

function spaceSubject(ref: string): SubjectRef {
  return { kind: "space", ref };
}

function daylightEvidenceId(ref: string): string {
  return `daylight:${ref}`;
}

const NO_POPULATION = "No space with a region declares daylight:1";

function applicable(outcomes: RuleOutcome[]): RuleEvaluation {
  return {
    applicability: "applicable",
    outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]],
  };
}

function notApplicable(reason: string): RuleEvaluation {
  return { applicability: "not-applicable", reason, evidence: [] };
}

function analysisIndeterminate(
  artifact: Exclude<AnalysisArtifact<DaylightAnalysisValue>, { state: "complete" }>,
): Extract<RuleEvaluation, { applicability: "indeterminate" }> {
  return {
    applicability: "indeterminate",
    reason: "Daylight observations are incomplete",
    missing: artifact.missing,
    evidence: artifact.state === "partial" ? artifact.evidence : [],
  };
}
