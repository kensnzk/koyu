import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  AnalysisReport,
  ContextKey,
  ContextSnapshot,
  Evidence,
} from "../src/analysis/contracts.js";
import type { JsonValue } from "../src/analysis/json.js";
import { parse } from "../src/core/parse.js";
import {
  assess,
  createAssessmentRegistry,
  runAnalysis,
} from "../src/validate/assessment.js";
import {
  AssessmentConfigError,
  type AssessmentRegistry,
  type Profile,
  type Rule,
  type RuleRun,
  type RuleSet,
  type RunAnalysisOptions,
} from "../src/validate/contracts.js";

const MODEL_SUBJECT = { kind: "model", ref: "/" } as const;
const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const MODEL_SOURCE = `koyu 1.1
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out
  door w:900 edge:S`;

const MODEL = parse(MODEL_SOURCE);
const SECOND_MODEL = parse(MODEL_SOURCE);
const INCONSISTENT_MODEL = parse(`koyu 1.1
unit mm
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /orphan room X1..X2 Y1..Y2`);

function ref(id: string, revision = "1"): AnalysisRef {
  return { id, revision };
}

function analysis(
  id: string,
  run: AnalysisDefinition<JsonValue>["run"] = () => ({ state: "complete", value: { id }, evidence: [] }),
  options: {
    revision?: string;
    model?: "consistent" | "any";
    dependencies?: AnalysisDefinition<JsonValue>["dependencies"];
    context?: AnalysisDefinition<JsonValue>["context"];
  } = {},
): AnalysisDefinition<JsonValue> {
  return {
    id,
    revision: options.revision ?? "1",
    title: id,
    model: options.model ?? "consistent",
    dependencies: options.dependencies ?? [],
    context: options.context ?? [],
    run,
  };
}

function rule(
  id: string,
  evaluate: Rule["evaluate"],
  options: Partial<Pick<Rule, "level" | "model" | "analyses" | "context">> = {},
): Rule {
  return {
    id,
    revision: "1",
    title: id,
    level: options.level ?? "violation",
    model: options.model ?? "consistent",
    analyses: options.analyses ?? [],
    context: options.context ?? [],
    authority: [],
    evaluate,
  };
}

function ruleSet(rules: readonly Rule[], id = "acceptance.rules.main"): RuleSet {
  return {
    id,
    revision: "1",
    title: id,
    purpose: "design-lint",
    rules,
  };
}

function profile(
  analyses: readonly AnalysisRef[],
  ruleSets: readonly RuleSet[] = [],
  id = "acceptance.profile.main",
): Profile {
  return {
    id,
    revision: "1",
    title: id,
    analyses,
    ruleSets: ruleSets.map(({ id: ruleSetId, revision }) => ({ id: ruleSetId, revision })),
  };
}

function registry(
  analyses: readonly AnalysisDefinition<JsonValue>[],
  rules: readonly Rule[] = [],
  roots: readonly AnalysisRef[] = analyses.map(({ id, revision }) => ({ id, revision })),
): AssessmentRegistry {
  const sets = rules.length === 0 ? [] : [ruleSet(rules)];
  return createAssessmentRegistry({ analyses, ruleSets: sets, profiles: [profile(roots, sets)] });
}

function fact(producedBy: { id: string; revision: string }, id: string): Evidence {
  return {
    id,
    kind: "fact",
    name: id,
    value: true,
    subjects: [MODEL_SUBJECT],
    sources: [{ kind: "model", subject: MODEL_SUBJECT }],
    producedBy,
  };
}

function configCode(error: unknown): string | undefined {
  return error instanceof AssessmentConfigError ? error.code : undefined;
}

function completeValue(report: AnalysisReport<JsonValue>): JsonValue {
  assert.equal(report.result.artifact.state, "complete");
  if (report.result.artifact.state !== "complete") throw new Error("expected a complete analysis artifact");
  return report.result.artifact.value;
}

function compileTimeAcceptance(
  registryValue: AssessmentRegistry,
  artifact: AnalysisArtifact<JsonValue>,
): void {
  // @ts-expect-error runAnalysis requires an explicit profile at compile time.
  const missingProfile: RunAnalysisOptions = { registry: registryValue, context: CONTEXT };
  void missingProfile;

  const emptyPartial: AnalysisArtifact<JsonValue> = {
    state: "partial",
    value: null,
    // @ts-expect-error partial artifacts require at least one missing input.
    missing: [],
    evidence: [],
  };
  const emptyUnavailable: AnalysisArtifact<JsonValue> = {
    state: "unavailable",
    // @ts-expect-error unavailable artifacts require at least one missing input.
    missing: [],
    issues: [{ kind: "execution-error", message: "invalid fixture" }],
  };
  void emptyPartial;
  void emptyUnavailable;

  if (artifact.state === "unavailable") {
    // @ts-expect-error unavailable artifacts deliberately carry no value.
    void artifact.value;
  }

  // @ts-expect-error the protocol has exactly four rule-run states and no not-assessed state.
  const impossibleState: RuleRun["state"] = "not-assessed";
  void impossibleState;
}
void compileTimeAcceptance;

test("registry preflight rejects a top-level catalog accessor without reading it", () => {
  let reads = 0;
  const hostile = {
    ruleSets: [],
    profiles: [],
  } as Record<string, unknown>;
  Object.defineProperty(hostile, "analyses", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("TOP_LEVEL_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => createAssessmentRegistry(hostile as unknown as {
      analyses: readonly AnalysisDefinition<JsonValue>[];
      ruleSets: readonly RuleSet[];
      profiles: readonly Profile[];
    }),
    (error) => error instanceof AssessmentConfigError,
  );
  assert.equal(reads, 0, "registry validation must inspect descriptors without invoking catalog getters");
});

test("registry preflight rejects a component identity accessor without reading it", () => {
  let reads = 0;
  const hostile = {
    revision: "1",
    title: "hostile identity",
    model: "consistent",
    dependencies: [],
    context: [],
    run: () => ({ state: "complete", value: true, evidence: [] }),
  } as Record<string, unknown>;
  Object.defineProperty(hostile, "id", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("IDENTITY_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [hostile as unknown as AnalysisDefinition<JsonValue>],
      ruleSets: [],
      profiles: [],
    }),
    (error) => error instanceof AssessmentConfigError,
  );
  assert.equal(reads, 0, "identity validation must inspect descriptors without invoking component getters");
});

test("required and optional context states preserve preconditions and provenance", () => {
  let requiredCalls = 0;
  const height: ContextKey<JsonValue> = {
    id: "acceptance.context.height",
    revision: "1",
    description: "height",
    decode: (value) => typeof value === "number"
      ? { ok: true, value }
      : { ok: false, message: "expected number" },
  };
  const requiredProvider = analysis("acceptance.analysis.required-context", () => {
    requiredCalls++;
    return { state: "complete", value: true, evidence: [] };
  }, { context: [{ key: height, presence: "required" }] });
  const requiredCatalog = registry([requiredProvider]);

  const missing = runAnalysis(MODEL, ref(requiredProvider.id), {
    registry: requiredCatalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(missing.result.artifact.state, "unavailable");
  if (missing.result.artifact.state === "unavailable") {
    assert.deepEqual(missing.result.artifact.missing, [{ kind: "context", key: height.id, reason: "missing" }]);
  }
  assert.equal(requiredCalls, 0);

  const invalid = runAnalysis(MODEL, ref(requiredProvider.id), {
    registry: requiredCatalog,
    profile: "acceptance.profile.main",
    context: {
      ...CONTEXT,
      values: { [height.id]: { value: "high", source: { kind: "user", ref: "brief#height" } } },
    },
  });
  assert.equal(invalid.result.artifact.state, "unavailable");
  assert.equal(invalid.context.values[height.id]!.source.ref, "brief#height");
  assert.equal(requiredCalls, 0);

  const optionalProvider = analysis("acceptance.analysis.optional-context", ({ context }) => ({
    state: "complete",
    value: context.get(height).state,
    evidence: [],
  }), { context: [{ key: height, presence: "optional" }] });
  const optional = runAnalysis(MODEL, ref(optionalProvider.id), {
    registry: registry([optionalProvider]),
    profile: "acceptance.profile.main",
    context: {
      ...CONTEXT,
      values: { [height.id]: { value: "high", source: { kind: "survey", ref: "survey#height" } } },
    },
  });
  assert.equal(completeValue(optional), "invalid");
  assert.equal(optional.context.values[height.id]!.source.ref, "survey#height");
});

test("rule context and model preconditions never call evaluate", () => {
  const brief: ContextKey<JsonValue> = {
    id: "acceptance.context.brief",
    revision: "1",
    description: "brief value",
    decode: (value) => typeof value === "string"
      ? { ok: true, value }
      : { ok: false, message: "expected string" },
  };
  let contextCalls = 0;
  const contextRule = rule("acceptance.rule.context-guard", () => {
    contextCalls++;
    return { applicability: "not-applicable", reason: "must not run", evidence: [] };
  }, { context: [{ key: brief, presence: "required" }] });
  const contextCatalog = registry([], [contextRule], []);

  const missing = assess(MODEL, {
    registry: contextCatalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(missing.rules[0]!.state, "indeterminate");

  const invalid = assess(MODEL, {
    registry: contextCatalog,
    profile: "acceptance.profile.main",
    context: {
      ...CONTEXT,
      values: { [brief.id]: { value: 9, source: { kind: "brief", ref: "brief#invalid" } } },
    },
  });
  assert.equal(invalid.rules[0]!.state, "indeterminate");
  assert.equal(invalid.context.values[brief.id]!.source.ref, "brief#invalid");
  assert.equal(contextCalls, 0);

  let modelCalls = 0;
  const modelRule = rule("acceptance.rule.model-guard", () => {
    modelCalls++;
    return { applicability: "not-applicable", reason: "must not run", evidence: [] };
  });
  const modelReport = assess(INCONSISTENT_MODEL, {
    registry: registry([], [modelRule], []),
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(modelReport.rules[0]!.state, "indeterminate");
  assert.equal(modelReport.summary.state, "incomplete");
  assert.equal(modelCalls, 0);
});

test("unavailable dependencies block consumers but not independent rules", () => {
  let brokenCalls = 0;
  let consumerCalls = 0;
  const broken = analysis("acceptance.analysis.broken", () => {
    brokenCalls++;
    throw new Error("provider failed");
  });
  const consumer = analysis("acceptance.analysis.consumer", () => {
    consumerCalls++;
    return { state: "complete", value: true, evidence: [] };
  }, { dependencies: [{ analysis: ref(broken.id), accept: "complete" }] });
  const analysisCatalog = registry([broken, consumer], [], [ref(consumer.id)]);
  const consumerReport = runAnalysis(MODEL, ref(consumer.id), {
    registry: analysisCatalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(consumerReport.result.artifact.state, "unavailable");
  assert.equal(brokenCalls, 1);
  assert.equal(consumerCalls, 0);

  let dependentRuleCalls = 0;
  let independentRuleCalls = 0;
  const dependentRule = rule("acceptance.rule.dependent", () => {
    dependentRuleCalls++;
    return { applicability: "not-applicable", reason: "must not run", evidence: [] };
  }, { analyses: [{ analysis: ref(broken.id), accept: "complete" }] });
  const independentRule = rule("acceptance.rule.independent", () => {
    independentRuleCalls++;
    return { applicability: "not-applicable", reason: "independent", evidence: [] };
  });
  const set = ruleSet([dependentRule, independentRule]);
  const assessmentCatalog = createAssessmentRegistry({
    analyses: [broken],
    ruleSets: [set],
    profiles: [profile([ref(broken.id)], [set])],
  });
  const report = assess(MODEL, {
    registry: assessmentCatalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.deepEqual(report.rules.map(({ state }) => state), ["indeterminate", "not-applicable"]);
  assert.equal(report.summary.state, "incomplete");
  assert.equal(dependentRuleCalls, 0);
  assert.equal(independentRuleCalls, 1);
  assert.equal(brokenCalls, 2, "the failed provider runs once in each operation and is cached within assessment");
});

test("analysis reports round-trip and malformed evidence becomes an execution failure", () => {
  const provider = analysis("acceptance.analysis.round-trip", () => ({
    state: "complete",
    value: { answer: 42 },
    evidence: [fact({ id: "acceptance.analysis.round-trip", revision: "1" }, "answer")],
  }));
  const catalog = registry([provider]);
  const first = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  const second = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(Object.hasOwn(first, "ok"), false);

  const duplicateEvidence = analysis("acceptance.analysis.duplicate-evidence", () => ({
    state: "complete",
    value: true,
    evidence: [
      fact({ id: "acceptance.analysis.duplicate-evidence", revision: "1" }, "same"),
      fact({ id: "acceptance.analysis.duplicate-evidence", revision: "1" }, "same"),
    ],
  }));
  const malformed = runAnalysis(MODEL, ref(duplicateEvidence.id), {
    registry: registry([duplicateEvidence]),
    profile: "acceptance.profile.main",
    context: CONTEXT,
  });
  assert.equal(malformed.result.artifact.state, "unavailable");
  if (malformed.result.artifact.state === "unavailable") {
    assert.equal(malformed.result.artifact.missing.length > 0, true);
    assert.equal(malformed.result.artifact.issues[0]!.kind, "execution-error");
  }
});

test("registries, profiles, and per-call caches remain isolated in reverse and reentrant execution", () => {
  const localId = "acceptance.analysis.local";
  const localRef = ref(localId);
  const registryB = registry([
    analysis(localId, () => ({ state: "complete", value: "B", evidence: [] })),
  ]);
  const registryA = registry([
    analysis(localId, () => {
      const nested = runAnalysis(MODEL, localRef, {
        registry: registryB,
        profile: "acceptance.profile.main",
        context: CONTEXT,
      });
      return {
        state: "complete",
        value: { owner: "A", nested: completeValue(nested) },
        evidence: [],
      };
    }),
  ]);
  const runLocal = (catalog: AssessmentRegistry) => completeValue(runAnalysis(MODEL, localRef, {
    registry: catalog,
    profile: "acceptance.profile.main",
    context: CONTEXT,
  }));
  assert.deepEqual(
    [runLocal(registryA), runLocal(registryB), runLocal(registryB), runLocal(registryA)],
    [
      { nested: "B", owner: "A" },
      "B",
      "B",
      { nested: "B", owner: "A" },
    ],
  );

  const profileAnalysisA = analysis("acceptance.analysis.profile-a", () => ({ state: "complete", value: "profile-a", evidence: [] }));
  const profileAnalysisB = analysis("acceptance.analysis.profile-b", () => ({ state: "complete", value: "profile-b", evidence: [] }));
  const profileA = profile([ref(profileAnalysisA.id)], [], "acceptance.profile.a");
  const profileB = profile([ref(profileAnalysisB.id)], [], "acceptance.profile.b");
  const profileCatalog = createAssessmentRegistry({
    analyses: [profileAnalysisB, profileAnalysisA],
    ruleSets: [],
    profiles: [profileB, profileA],
  });
  const runProfile = (definition: AnalysisDefinition<JsonValue>, selected: Profile) => completeValue(runAnalysis(
    MODEL,
    ref(definition.id),
    { registry: profileCatalog, profile: selected.id, context: CONTEXT },
  ));
  assert.deepEqual(
    [
      runProfile(profileAnalysisA, profileA),
      runProfile(profileAnalysisB, profileB),
      runProfile(profileAnalysisB, profileB),
      runProfile(profileAnalysisA, profileA),
    ],
    ["profile-a", "profile-b", "profile-b", "profile-a"],
  );

  const packA = analysis("acceptance.analysis.pack-a", () => ({ state: "complete", value: "pack-a", evidence: [] }));
  const packB = analysis("acceptance.analysis.pack-b", () => ({ state: "complete", value: "pack-b", evidence: [] }));
  const packProfile = profile([ref(packA.id)], [], "acceptance.profile.pack");
  const forward = createAssessmentRegistry({ analyses: [packA, packB], ruleSets: [], profiles: [packProfile] });
  const reverse = createAssessmentRegistry({ analyses: [packB, packA], ruleSets: [], profiles: [packProfile] });
  const forwardReport = runAnalysis(MODEL, ref(packA.id), {
    registry: forward,
    profile: packProfile.id,
    context: CONTEXT,
  });
  const reverseReport = runAnalysis(MODEL, ref(packA.id), {
    registry: reverse,
    profile: packProfile.id,
    context: CONTEXT,
  });
  assert.equal(JSON.stringify(forwardReport), JSON.stringify(reverseReport));

  let calls = 0;
  const counted = analysis("acceptance.analysis.per-call", () => ({
    state: "complete",
    value: ++calls,
    evidence: [],
  }));
  const countedProfileA = profile([ref(counted.id)], [], "acceptance.profile.cache-a");
  const countedProfileB = profile([ref(counted.id)], [], "acceptance.profile.cache-b");
  const countedCatalog = createAssessmentRegistry({
    analyses: [counted],
    ruleSets: [],
    profiles: [countedProfileA, countedProfileB],
  });
  completeValue(runAnalysis(MODEL, ref(counted.id), {
    registry: countedCatalog,
    profile: countedProfileA.id,
    context: CONTEXT,
  }));
  completeValue(runAnalysis(SECOND_MODEL, ref(counted.id), {
    registry: countedCatalog,
    profile: countedProfileB.id,
    context: CONTEXT,
  }));
  completeValue(runAnalysis(MODEL, ref(counted.id), {
    registry: countedCatalog,
    profile: countedProfileA.id,
    context: CONTEXT,
  }));
  assert.equal(calls, 3);
});

test("invalid effective ranges and selected rule-set applicability fail before model work", () => {
  const reversed: Profile = {
    ...profile([], [], "acceptance.profile.reversed"),
    effective: { from: "2027-01-01", to: "2026-01-01" },
  };
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [reversed] }),
    (error) => configCode(error) === "invalid-context",
  );

  const impossibleDate: Profile = {
    ...profile([], [], "acceptance.profile.impossible-date"),
    effective: { from: "2026-02-30" },
  };
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [impossibleDate] }),
    (error) => configCode(error) === "invalid-context",
  );

  const datedSet: RuleSet = {
    ...ruleSet([], "acceptance.rules.dated"),
    effective: { from: "2026-04-01", to: "2027-03-31" },
  };
  const datedProfile = profile([], [datedSet], "acceptance.profile.dated");
  const datedCatalog = createAssessmentRegistry({ analyses: [], ruleSets: [datedSet], profiles: [datedProfile] });
  const untouchedModel = new Proxy(MODEL, {
    get() {
      throw new Error("MODEL_TOUCHED");
    },
  });
  assert.throws(
    () => assess(untouchedModel, {
      registry: datedCatalog,
      profile: datedProfile.id,
      context: { ...CONTEXT, asOf: "2028-01-01" },
    }),
    (error) => configCode(error) === "effective-date-mismatch" && !String(error).includes("MODEL_TOUCHED"),
  );

  const jurisdictionSet: RuleSet = {
    ...ruleSet([], "acceptance.rules.jurisdiction"),
    jurisdiction: { country: "JP", region: "13" },
  };
  const differentJurisdiction: Profile = {
    ...profile([], [jurisdictionSet], "acceptance.profile.different-jurisdiction"),
    jurisdiction: { country: "JP", region: "14" },
  };
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [jurisdictionSet],
      profiles: [differentJurisdiction],
    }),
    (error) => configCode(error) === "jurisdiction-mismatch",
  );
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [jurisdictionSet],
      profiles: [profile([], [jurisdictionSet], "acceptance.profile.missing-jurisdiction")],
    }),
    (error) => configCode(error) === "jurisdiction-mismatch",
  );
});

test("assessment collections follow dependency, profile, rule, finding, and diagnostic order", () => {
  const shared = analysis("acceptance.analysis.shared");
  const left = analysis("acceptance.analysis.left", () => ({ state: "complete", value: "left", evidence: [] }), {
    dependencies: [{ analysis: ref(shared.id), accept: "complete" }],
  });
  const right = analysis("acceptance.analysis.right", () => ({ state: "complete", value: "right", evidence: [] }), {
    dependencies: [{ analysis: ref(shared.id), accept: "complete" }],
  });
  const root = analysis("acceptance.analysis.root", () => ({ state: "complete", value: "root", evidence: [] }), {
    dependencies: [
      { analysis: ref(left.id), accept: "complete" },
      { analysis: ref(right.id), accept: "complete" },
    ],
  });

  const ruleA = rule("acceptance.rule.a", () => ({
    applicability: "applicable",
    outcomes: [
      {
        id: "z",
        status: "fail",
        subjects: [MODEL_SUBJECT],
        message: "z",
        evidence: [fact({ id: "acceptance.rule.a", revision: "1" }, "z-proof")],
      },
      {
        id: "a",
        status: "fail",
        subjects: [MODEL_SUBJECT],
        message: "a",
        evidence: [fact({ id: "acceptance.rule.a", revision: "1" }, "a-proof")],
      },
    ],
  }), { analyses: [{ analysis: ref(root.id), accept: "complete" }] });
  const ruleB = rule("acceptance.rule.b", () => ({
    applicability: "applicable",
    outcomes: [{
      id: "b",
      status: "fail",
      subjects: [MODEL_SUBJECT],
      message: "b",
      evidence: [fact({ id: "acceptance.rule.b", revision: "1" }, "b-proof")],
    }],
  }));
  const setA = ruleSet([ruleA], "acceptance.rules.a");
  const setB = ruleSet([ruleB], "acceptance.rules.b");
  const selected = profile([ref(root.id)], [setB, setA], "acceptance.profile.order");
  const catalog = createAssessmentRegistry({
    analyses: [root, right, left, shared],
    ruleSets: [setA, setB],
    profiles: [selected],
  });
  const report = assess(MODEL, {
    registry: catalog,
    profile: selected.id,
    context: CONTEXT,
  });
  assert.deepEqual(report.analyses.map(({ analysis: identity }) => identity.id), [
    shared.id,
    left.id,
    right.id,
    root.id,
  ]);
  assert.deepEqual(report.ruleSets.map(({ id }) => id), [setB.id, setA.id]);
  assert.deepEqual(report.rules.map(({ rule: identity }) => identity.id), [ruleB.id, ruleA.id]);
  assert.deepEqual(report.findings.map(({ rule: identity, outcome }) => `${identity.id}:${outcome.id}`), [
    `${ruleB.id}:b`,
    `${ruleA.id}:a`,
    `${ruleA.id}:z`,
  ]);

  const diagnosticModel = parse(`koyu 1.1
grid X 0 3600 7200 10800
grid Y 0 4000 8000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/far room X3..X4 Y2..Y3
space /L2/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /L1/b t:120
  door w:900 at:0.4
  door w:900 at:0.5
boundary /L1/a /L1/b edge:E t:120
boundary /L1/a /L1/far t:120
  door w:900
  seg w:600 spec:GL
boundary /L1/a /L2/a t:120
  door w:900
  seg w:600
boundary /L1/a /out type:void
  door w:900
  seg w:600
boundary /L1/b /out type:open
  door w:900
  seg w:600`);
  const diagnostics = assess(diagnosticModel, {
    registry: registry([], [], []),
    profile: "acceptance.profile.main",
    context: CONTEXT,
  }).model.diagnostics;
  assert.deepEqual(diagnostics.map(({ code, line }) => [code, line]), [
    ["BND05", 11],
    ["OPN02", 13],
    ["BND04", 15],
    ["OPN04", 16],
    ["SEG04", 17],
    ["BND03", 18],
    ["VRT01", 21],
    ["OPN03", 25],
    ["OPN05", 25],
    ["SEG03", 26],
    // then the envelope clause, once per space in declaration order (ADR-0065)
    ["BND08", 6],
    ["BND08", 8],
    ["BND08", 9],
  ]);
});

test("a missing asOf is rejected without consulting the model or current time", () => {
  let calls = 0;
  const provider = analysis("acceptance.analysis.no-date-default", () => {
    calls++;
    return { state: "complete", value: true, evidence: [] };
  });
  const catalog = registry([provider]);
  const untouchedModel = new Proxy(MODEL, {
    get() {
      throw new Error("MODEL_TOUCHED");
    },
  });
  const noAsOf = {
    schema: "koyu-context/1",
    values: {},
  } as unknown as ContextSnapshot;
  assert.throws(
    () => runAnalysis(untouchedModel, ref(provider.id), {
      registry: catalog,
      profile: "acceptance.profile.main",
      context: noAsOf,
    }),
    (error) => configCode(error) === "invalid-context" && !String(error).includes("MODEL_TOUCHED"),
  );
  assert.equal(calls, 0);
});
