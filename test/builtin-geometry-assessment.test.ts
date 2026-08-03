import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type {
  AnalysisArtifact,
  AnalysisRef,
  ContextKey,
  ContextSnapshot,
} from "../src/analysis/contracts.js";
import type { JsonValue } from "../src/analysis/json.js";
import { parse } from "../src/core/parse.js";
import { toCanonical } from "../src/core/model.js";
import { validate as legacyValidate } from "../src/validate/index.js";
import { assess, createAssessmentRegistry, runAnalysis } from "../src/validate/assessment.js";
import {
  ENVELOPE_ANALYSIS,
  ENVELOPE_ANALYSIS_ID,
  ENVELOPE_GAP_RULE,
  ENVELOPE_GAP_RULE_ID,
} from "../src/validate/builtin/envelope.js";
import {
  ESCALATOR_SLOPE_BAND,
  ESCALATOR_USUAL_SLOPE_RULE,
  ESCALATOR_USUAL_SLOPE_RULE_ID,
  RAMP_DECLARED_SLOPE_RULE,
  RAMP_DECLARED_SLOPE_RULE_ID,
  RAMP_SLOPE_EPSILON,
  RUN_DISCONNECTED_RULE,
  RUN_DISCONNECTED_RULE_ID,
  STEP_RULE_MM,
  STAIR_PROPORTION_RULE,
  STAIR_PROPORTION_RULE_ID,
  VERTICAL_RUNS_ANALYSIS,
  VERTICAL_RUNS_ANALYSIS_ID,
  type VerticalRunFact,
  type VerticalRunsAnalysisValue,
} from "../src/validate/builtin/vertical-runs.js";
import type {
  AssessmentReport,
  Profile,
  Rule,
  RuleEvaluation,
  RuleRunContext,
  RuleSet,
} from "../src/validate/contracts.js";

const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const RULES: readonly Rule[] = [
  ENVELOPE_GAP_RULE,
  STAIR_PROPORTION_RULE,
  RAMP_DECLARED_SLOPE_RULE,
  ESCALATOR_USUAL_SLOPE_RULE,
  RUN_DISCONNECTED_RULE,
];

const RULE_SET: RuleSet = {
  id: "test.rules.geometry",
  revision: "1",
  title: "Built-in geometry rules",
  purpose: "design-lint",
  rules: RULES,
};

const PROFILE: Profile = {
  id: "test.profile.geometry",
  revision: "1",
  title: "Built-in geometry profile",
  analyses: [ENVELOPE_ANALYSIS_ID, VERTICAL_RUNS_ANALYSIS_ID],
  ruleSets: [{ id: RULE_SET.id, revision: RULE_SET.revision }],
};

const PROFILE_REF = { id: PROFILE.id, revision: PROFILE.revision } as const;

const REGISTRY = createAssessmentRegistry({
  analyses: [ENVELOPE_ANALYSIS, VERTICAL_RUNS_ANALYSIS],
  ruleSets: [RULE_SET],
  profiles: [PROFILE],
});

const RUN_REFERENCE = `koyu 1.1
grid X 0 3000
grid Y 0 7000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair`;

test("the existing envelope and vertical-run reference fixtures map to the new schematic rule identities", () => {
  const envelope = assessSource(referenceExamples("envelope.md")[0]!);
  assertSingleFailure(envelope, ENVELOPE_GAP_RULE_ID.id, "caution", "/L1/a");

  const runs = referenceExamples("runs.md");
  assertSingleFailure(assessSource(runs[0]!), STAIR_PROPORTION_RULE_ID.id, "caution", "/L1/s");
  assertSingleFailure(assessSource(runs[1]!), RAMP_DECLARED_SLOPE_RULE_ID.id, "caution", "/L1/r");
  assertSingleFailure(assessSource(runs[2]!), ESCALATOR_USUAL_SLOPE_RULE_ID.id, "caution", "/L1/e");
  assertSingleFailure(assessSource(runs[3]!), RUN_DISCONNECTED_RULE_ID.id, "caution", "/L1/s");
});

test("the geometry migration remains subject, level, and source-equivalent to the legacy validator", () => {
  const runs = referenceExamples("runs.md");
  const cases = [
    { source: referenceExamples("envelope.md")[0]!, oldRule: "envelope.gap", newRule: ENVELOPE_GAP_RULE_ID.id },
    { source: runs[0]!, oldRule: "stair.proportion", newRule: STAIR_PROPORTION_RULE_ID.id },
    { source: runs[1]!, oldRule: "run.slope", newRule: RAMP_DECLARED_SLOPE_RULE_ID.id },
    { source: runs[2]!, oldRule: "run.slope", newRule: ESCALATOR_USUAL_SLOPE_RULE_ID.id },
    { source: runs[3]!, oldRule: "run.disconnected", newRule: RUN_DISCONNECTED_RULE_ID.id },
  ];

  for (const fixture of cases) {
    const model = parse(fixture.source);
    const legacy = legacyValidate(model).filter((finding) => finding.rule === fixture.oldRule);
    const current = assess(model, {
      registry: REGISTRY,
      profile: PROFILE_REF,
      context: CONTEXT,
    }).findings.filter((finding) => finding.rule.id === fixture.newRule);
    assert.equal(legacy.length, 1, fixture.oldRule);
    assert.equal(current.length, 1, fixture.newRule);
    const source = current[0]!.outcome.evidence
      .flatMap((item) => item.sources)
      .find((item) => item.kind === "model" && item.location?.line !== undefined);
    assert.ok(source?.kind === "model");
    assert.deepEqual({
      level: current[0]!.level,
      refs: current[0]!.outcome.subjects.map((subject) => subject.ref),
      line: source.location?.line,
      file: source.location?.file,
    }, {
      level: legacy[0]!.level,
      refs: legacy[0]!.path,
      line: legacy[0]!.line,
      file: legacy[0]!.file,
    }, fixture.newRule);
  }
});

test("built-in geometry rules distinguish explicit passes from empty populations", () => {
  const closed = assessSource(`koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:W t:200
boundary /L1/a /out edge:N t:200
boundary /L1/a /out edge:S t:200
boundary /L1/b /out t:150`);
  const envelope = evaluatedOutcomes(closed, ENVELOPE_GAP_RULE_ID.id);
  assert.deepEqual(envelope.map(({ id, status }) => ({ id, status })), [
    { id: "/L1/a", status: "pass" },
    { id: "/L1/b", status: "pass" },
  ]);

  const stair = assessSource(RUN_REFERENCE);
  assert.equal(outcome(stair, STAIR_PROPORTION_RULE_ID.id, "/L1/s").status, "pass");
  assert.equal(outcome(stair, RUN_DISCONNECTED_RULE_ID.id, "/L1/s").status, "pass");
  assert.equal(ruleRun(stair, RAMP_DECLARED_SLOPE_RULE_ID.id).state, "not-applicable");
  assert.equal(ruleRun(stair, ESCALATOR_USUAL_SLOPE_RULE_ID.id).state, "not-applicable");

  const empty = assessSource(`koyu 1.1
grid X 0 3000
grid Y 0 4000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2`);
  for (const rule of RULES) assert.equal(ruleRun(empty, rule.id).state, "not-applicable", rule.id);
});

test("envelope and vertical-run artifacts contain observations without verdict vocabulary or old rule identities", () => {
  const envelope = runAnalysis(parse(referenceExamples("envelope.md")[0]!), ENVELOPE_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;
  const runs = runAnalysis(parse(RUN_REFERENCE), VERTICAL_RUNS_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;

  for (const artifact of [envelope, runs]) {
    const json = JSON.stringify(artifact);
    assert.doesNotMatch(json, /"(?:status|outcomes|findings|ok|pass|fail|level|violation|caution|compliant|noncompliant|compliance|summary)"/i);
    assert.equal(json.includes("koyu.schematic."), false);
  }
});

test("stair thresholds use rounded dimensions and include both pace-band endpoints", () => {
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(240, 155)), "pass");
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(240, 230)), "pass");
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(239.49, 155)), "fail");
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(239.5, 155)), "pass");
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(241, 154)), "fail");
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(241, 230)), "fail");
});

test("envelope gap scanning drops exactly 1 mm and retains a run just above it", () => {
  const endpoint = assessSource(envelopeToleranceSource(3999));
  assert.equal(outcome(endpoint, ENVELOPE_GAP_RULE_ID.id, "/L1/a").status, "pass");

  const above = assessSource(envelopeToleranceSource(3998.999));
  const failed = outcome(above, ENVELOPE_GAP_RULE_ID.id, "/L1/a");
  assert.equal(failed.status, "fail");
  const fact = failed.evidence.find((item) => item.kind === "fact" && item.name === "uncoveredEnvelopeRuns");
  assert.ok(fact && fact.kind === "fact");
  assert.equal((fact.value as { length: { value: number } }).length.value > 1, true);
});

test("ramp and escalator slope boundaries preserve the existing inclusive comparisons", () => {
  const declared = 12;
  const limit = 1 / declared;
  assert.equal(verticalStatus(RAMP_DECLARED_SLOPE_RULE, runFact({
    device: "ramp",
    slope: limit,
    declaredSlopeDenominator: declared,
  })), "pass");
  assert.equal(verticalStatus(RAMP_DECLARED_SLOPE_RULE, runFact({
    device: "ramp",
    slope: limit + RAMP_SLOPE_EPSILON,
    declaredSlopeDenominator: declared,
  })), "pass");
  assert.equal(verticalStatus(RAMP_DECLARED_SLOPE_RULE, runFact({
    device: "ramp",
    slope: limit + RAMP_SLOPE_EPSILON * 1.01,
    declaredSlopeDenominator: declared,
  })), "fail");

  for (const slope of [ESCALATOR_SLOPE_BAND.minimum, ESCALATOR_SLOPE_BAND.maximum]) {
    assert.equal(verticalStatus(ESCALATOR_USUAL_SLOPE_RULE, runFact({ device: "escalator", slope })), "pass");
  }
  assert.equal(verticalStatus(ESCALATOR_USUAL_SLOPE_RULE, runFact({
    device: "escalator",
    slope: ESCALATOR_SLOPE_BAND.minimum - 1e-12,
  })), "fail");
  assert.equal(verticalStatus(ESCALATOR_USUAL_SLOPE_RULE, runFact({
    device: "escalator",
    slope: ESCALATOR_SLOPE_BAND.maximum + 1e-12,
  })), "fail");
});

test("vertical outcomes retain analysis provenance and machine-readable comparison values", () => {
  const stair = verticalOutcome(STAIR_PROPORTION_RULE, stairFact(240, 155));
  assert.equal(stair.evidence[0]!.id, "vertical-run:/L1/run");
  const tread = stair.evidence.find((item) => item.id === "tread-minimum");
  assert.ok(tread?.kind === "comparison");
  assert.deepEqual(tread.observed, { value: 240, unit: "mm" });
  assert.deepEqual(tread.required, { value: 240, unit: "mm" });

  const ramp = verticalOutcome(RAMP_DECLARED_SLOPE_RULE, runFact({
    device: "ramp",
    slope: 1 / 12,
    declaredSlopeDenominator: 12,
  }));
  const slope = ramp.evidence.find((item) => item.id === "declared-slope-limit");
  assert.ok(slope?.kind === "comparison");
  assert.deepEqual(slope.observed, { value: 1 / 12, unit: "ratio" });
  assert.deepEqual(slope.required, { value: 1 / 12 + RAMP_SLOPE_EPSILON, unit: "ratio" });
});

test("vertical connection is observed independently from the derived run shape", () => {
  assert.equal(verticalStatus(RUN_DISCONNECTED_RULE, runFact({ verticalBoundaryLinked: true })), "pass");
  assert.equal(verticalStatus(RUN_DISCONNECTED_RULE, runFact({ verticalBoundaryLinked: false })), "fail");
  const lift = evaluation(RUN_DISCONNECTED_RULE, completeRuns([runFact({ device: "lift" })]));
  assert.equal(lift.applicability, "not-applicable");
});

test("the geometry providers leave canonical model bytes unchanged", () => {
  for (const source of [referenceExamples("envelope.md")[0]!, RUN_REFERENCE]) {
    const model = parse(source);
    const before = toCanonical(model);
    const analysis = source === RUN_REFERENCE ? VERTICAL_RUNS_ANALYSIS_ID : ENVELOPE_ANALYSIS_ID;
    runAnalysis<JsonValue>(model, analysis as AnalysisRef<JsonValue>, {
      registry: REGISTRY,
      profile: PROFILE_REF,
      context: CONTEXT,
    });
    assert.equal(toCanonical(model), before);
  }
});

test("captured built-in identities, thresholds, providers, and rules are deeply immutable", () => {
  for (const value of [
    ENVELOPE_ANALYSIS_ID,
    ENVELOPE_ANALYSIS,
    ENVELOPE_GAP_RULE,
    VERTICAL_RUNS_ANALYSIS_ID,
    VERTICAL_RUNS_ANALYSIS,
    STAIR_PROPORTION_RULE,
    RAMP_DECLARED_SLOPE_RULE,
    ESCALATOR_USUAL_SLOPE_RULE,
    RUN_DISCONNECTED_RULE,
    STEP_RULE_MM,
    ESCALATOR_SLOPE_BAND,
  ]) assertDeepFrozen(value);

  assert.equal(Reflect.set(STEP_RULE_MM, "minimum", 551), false);
  assert.equal(verticalStatus(STAIR_PROPORTION_RULE, stairFact(240, 155)), "pass");
});

function referenceExamples(file: string): string[] {
  const markdown = readFileSync(new URL(`../docs/reference/validate/${file}`, import.meta.url), "utf8");
  return [...markdown.matchAll(/```muro-(?:fail|caution)\n([\s\S]*?)\n```/g)].map((match) => match[1]!);
}

function assessSource(source: string): AssessmentReport {
  return assess(parse(source), {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  });
}

function assertSingleFailure(
  report: AssessmentReport,
  ruleId: string,
  level: "violation" | "caution",
  ref: string,
): void {
  const findings = report.findings.filter((finding) => finding.rule.id === ruleId);
  assert.equal(findings.length, 1, ruleId);
  assert.equal(findings[0]!.level, level);
  assert.deepEqual(findings[0]!.outcome.subjects, [{ kind: ruleId.includes("envelope") ? "space" : "run", ref }]);
  assert.ok(findings[0]!.outcome.evidence.length > 0);
}

function ruleRun(report: AssessmentReport, id: string): AssessmentReport["rules"][number] {
  const run = report.rules.find((candidate) => candidate.rule.id === id);
  assert.ok(run, `missing rule run ${id}`);
  return run;
}

function evaluatedOutcomes(report: AssessmentReport, id: string) {
  const run = ruleRun(report, id);
  assert.equal(run.state, "evaluated", id);
  if (run.state !== "evaluated") throw new Error(`${id} was not evaluated`);
  return run.evaluation.outcomes;
}

function outcome(report: AssessmentReport, ruleId: string, outcomeId: string) {
  const found = evaluatedOutcomes(report, ruleId).find((candidate) => candidate.id === outcomeId);
  assert.ok(found, `missing outcome ${ruleId}:${outcomeId}`);
  return found;
}

function stairFact(treadMm: number, riserMm: number): VerticalRunFact {
  return runFact({ device: "stair", treadMm, riserMm });
}

function runFact(overrides: Partial<VerticalRunFact> = {}): VerticalRunFact {
  return {
    ref: "/L1/run",
    device: "stair",
    levelRef: "L1",
    upperLevelRef: "L2",
    riseMm: 3000,
    runLengthMm: 7000,
    goingMm: 4800,
    risers: 17,
    riserMm: 176,
    treadMm: 300,
    slope: 1 / 1.6,
    declaredSlopeDenominator: null,
    verticalBoundaryLinked: true,
    ...overrides,
  };
}

function envelopeToleranceSource(neighbourTopMm: number): string {
  return `koyu 1.1
grid X 0 4000 8000
grid Y 0 ${neighbourTopMm} 4000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y3
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out edge:N
boundary /L1/a /out edge:W
boundary /L1/a /out edge:S`;
}

function completeRuns(runs: readonly VerticalRunFact[]): AnalysisArtifact<VerticalRunsAnalysisValue> {
  return {
    state: "complete",
    value: { runs },
    evidence: runs.map((run) => ({
      id: `vertical-run:${run.ref}`,
      kind: "fact",
      name: "verticalRun",
      value: run,
      subjects: [{ kind: "run", ref: run.ref }],
      sources: [{ kind: "model", subject: { kind: "run", ref: run.ref } }],
      producedBy: VERTICAL_RUNS_ANALYSIS_ID,
    })),
  };
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  const object = value as object;
  if (seen.has(object)) return;
  seen.add(object);
  assert.equal(Object.isFrozen(object), true);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor && "value" in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}

function verticalStatus(rule: Rule, fact: VerticalRunFact): "pass" | "fail" | "indeterminate" {
  return verticalOutcome(rule, fact).status;
}

function verticalOutcome(rule: Rule, fact: VerticalRunFact) {
  const result = evaluation(rule, completeRuns([fact]));
  assert.equal(result.applicability, "applicable");
  if (result.applicability !== "applicable") throw new Error(`${rule.id} was not applicable`);
  assert.equal(result.outcomes.length, 1);
  return result.outcomes[0]!;
}

function evaluation(
  rule: Rule,
  artifact: AnalysisArtifact<VerticalRunsAnalysisValue>,
): RuleEvaluation {
  const context: RuleRunContext = {
    context: {
      get<T extends JsonValue>(_key: ContextKey<T>) {
        throw new Error("no context key is declared by a built-in geometry rule");
      },
    },
    get<T extends JsonValue>(_analysis: AnalysisRef<T>) {
      return artifact as unknown as AnalysisArtifact<T>;
    },
  };
  return rule.evaluate(context);
}
