import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  assertJsonValue,
  canonicalJsonValue,
  codePointCompare,
  isJsonValue,
  type JsonValue,
} from "../src/analysis/json.js";
import type {
  AnalysisDefinition,
  AnalysisRef,
  AnalysisRunContext,
  ContextKey,
  ContextSnapshot,
  Evidence,
} from "../src/analysis/contracts.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
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
  type RuleRunContext,
  type RuleSet,
} from "../src/validate/contracts.js";

const MODEL_SUBJECT = { kind: "model", ref: "/" } as const;
const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const MODEL = parse(`koyu 1.1
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out
  door w:900 edge:S`);

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

function ruleSet(rules: readonly Rule[], id = "test.rules.main"): RuleSet {
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
  id = "test.profile.main",
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
  const sets = rules.length > 0 ? [ruleSet(rules)] : [];
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

function compileTimeCapabilities(analysisContext: AnalysisRunContext, ruleContext: RuleRunContext): void {
  // @ts-expect-error Rules deliberately have no path to the composed Model.
  void ruleContext.model;
  // @ts-expect-error Analysis providers receive a recursively readonly Model.
  analysisContext.model.spaces.set("/bad", analysisContext.model.spaces.values().next().value);
}
void compileTimeCapabilities;

test("JSON boundary accepts only deterministic JSON values", () => {
  assert.equal(isJsonValue({ a: [1, true, null, "x"] }), true);
  for (const value of [undefined, new Map(), new Set(), new Date(), Number.NaN, Infinity, () => 1, Symbol("x")]) {
    assert.equal(isJsonValue(value), false);
  }

  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  assert.throws(() => assertJsonValue(cycle), /cyclic/);

  const sparse = Array(1);
  assert.equal(isJsonValue(sparse), false);
  const symbolMember = { valid: true } as Record<PropertyKey, unknown>;
  symbolMember[Symbol("hidden")] = true;
  assert.equal(isJsonValue(symbolMember), false);
  assert.deepEqual(canonicalJsonValue({ z: 1, a: { y: 2, b: 3 } }), { a: { b: 3, y: 2 }, z: 1 });

  const protoInput = JSON.parse('{"__proto__":{"polluted":true},"a":1}') as Record<string, JsonValue>;
  const protoOutput = canonicalJsonValue(protoInput) as Record<string, JsonValue>;
  assert.equal(Object.getPrototypeOf(protoOutput), Object.prototype);
  assert.equal(Object.hasOwn(protoOutput, "__proto__"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(protoOutput)), protoInput);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(Object.is(canonicalJsonValue(-0), -0), false);

  assert.equal(codePointCompare("\uE000", "😀"), -1);
  const unicodeKeys = canonicalJsonValue({ "😀": 2, "\uE000": 1 }) as Record<string, JsonValue>;
  assert.deepEqual(Object.keys(unicodeKeys), ["\uE000", "😀"]);
  const numericA: Record<string, JsonValue> = {};
  numericA["10"] = "ten";
  numericA["2"] = "two";
  const numericB: Record<string, JsonValue> = {};
  numericB["2"] = "two";
  numericB["10"] = "ten";
  assert.equal(JSON.stringify(canonicalJsonValue(numericA)), JSON.stringify(canonicalJsonValue(numericB)));
  assert.equal(JSON.stringify(canonicalJsonValue(numericA)), '{"2":"two","10":"ten"}');
});

test("registry preflight rejects invalid identities, duplicates, missing revisions, and cycles", () => {
  const invalid = analysis("plain");
  assert.throws(
    () => createAssessmentRegistry({ analyses: [invalid], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "invalid-id",
  );
  const blankRevision = analysis("test.analysis.blank", undefined, { revision: " " });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [blankRevision], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "invalid-id",
  );

  const duplicateA = analysis("test.analysis.duplicate", undefined, { revision: "1" });
  const duplicateB = analysis("test.analysis.duplicate", undefined, { revision: "2" });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [duplicateA, duplicateB], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "duplicate-id",
  );
  assert.throws(
    () => createAssessmentRegistry({ analyses: [duplicateA, { ...duplicateA }], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "duplicate-id",
  );

  const missing = analysis("test.analysis.consumer", undefined, {
    dependencies: [{ analysis: ref("test.analysis.absent"), accept: "complete" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [missing], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "missing-reference",
  );

  const base = analysis("test.analysis.base", undefined, { revision: "2" });
  const mismatch = analysis("test.analysis.consumer", undefined, {
    dependencies: [{ analysis: ref(base.id, "1"), accept: "complete" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [base, mismatch], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "revision-mismatch",
  );

  const a = analysis("test.analysis.a", undefined, {
    dependencies: [{ analysis: ref("test.analysis.b"), accept: "complete" }],
  });
  const b = analysis("test.analysis.b", undefined, {
    dependencies: [{ analysis: ref("test.analysis.a"), accept: "complete" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [a, b], ruleSets: [], profiles: [] }),
    (error) => error instanceof AssessmentConfigError
      && error.code === "dependency-cycle"
      && error.problem.code === "dependency-cycle"
      && error.problem.path.map(({ id }) => id).join(" -> ") === "test.analysis.a -> test.analysis.b -> test.analysis.a",
  );

  const self = analysis("test.analysis.self", undefined, {
    dependencies: [{ analysis: ref("test.analysis.self"), accept: "complete" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [self], ruleSets: [], profiles: [] }),
    (error) => error instanceof AssessmentConfigError
      && error.code === "dependency-cycle"
      && error.problem.code === "dependency-cycle"
      && error.problem.path.length === 2,
  );

  const missingSetProfile: Profile = {
    ...profile([]),
    ruleSets: [{ id: "test.rules.absent", revision: "1" }],
  };
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [missingSetProfile] }),
    (error) => configCode(error) === "missing-reference",
  );

  const duplicateRuleA = rule("test.rule.shared", () => ({ applicability: "not-applicable", reason: "A", evidence: [] }));
  const duplicateRuleB = rule("test.rule.shared", () => ({ applicability: "not-applicable", reason: "B", evidence: [] }));
  const setA = ruleSet([duplicateRuleA], "test.rules.a");
  const setB = ruleSet([duplicateRuleB], "test.rules.b");
  assert.doesNotThrow(() => createAssessmentRegistry({
    analyses: [],
    ruleSets: [setA, setB],
    profiles: [profile([], [setA])],
  }));
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [setA, setB],
      profiles: [profile([], [setA, setB])],
    }),
    (error) => configCode(error) === "duplicate-id",
  );

  const visible = analysis("test.analysis.visible");
  const hidden = analysis("test.analysis.hidden");
  const hiddenRule = rule("test.rule.hidden-analysis", () => ({ applicability: "not-applicable", reason: "none", evidence: [] }), {
    analyses: [{ analysis: ref(hidden.id), accept: "complete" }],
  });
  const hiddenSet = ruleSet([hiddenRule]);
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [visible, hidden],
      ruleSets: [hiddenSet],
      profiles: [profile([ref(visible.id)], [hiddenSet])],
    }),
    (error) => configCode(error) === "missing-reference",
  );
});

test("registry is a local immutable snapshot and unbranded structural values are refused", () => {
  const hostileMap = [analysis("test.analysis.intrinsic-copy")];
  Object.defineProperty(hostileMap, "map", {
    value: () => [analysis("test.analysis.same"), analysis("test.analysis.same")],
    configurable: true,
  });
  const safelyCopied = createAssessmentRegistry({ analyses: hostileMap, ruleSets: [], profiles: [] });
  assert.deepEqual(safelyCopied.analyses.map(({ id }) => id), ["test.analysis.intrinsic-copy"]);

  const source = [analysis("test.analysis.local")];
  const first = registry(source);
  source.push(analysis("test.analysis.late"));
  assert.equal(first.analyses.length, 1);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.analyses), true);
  assert.equal(Object.isFrozen(first.analyses[0]), true);

  const forged = {
    analyses: [analysis("test.analysis.same"), analysis("test.analysis.same")],
    ruleSets: [],
    profiles: [profile([ref("test.analysis.same")])],
  } as AssessmentRegistry;
  assert.throws(
    () => runAnalysis(MODEL, ref("test.analysis.same"), { registry: forged, profile: "test.profile.main", context: CONTEXT }),
    (error) => configCode(error) === "invalid-registry",
  );

  const copiedSymbols = Object.getOwnPropertySymbols(first);
  const copied = {
    ...first,
    analyses: [analysis("test.analysis.same"), analysis("test.analysis.same")],
  } as unknown as Record<PropertyKey, unknown>;
  for (const symbol of copiedSymbols) copied[symbol] = (first as unknown as Record<PropertyKey, unknown>)[symbol];
  assert.throws(
    () => runAnalysis(MODEL, ref("test.analysis.same"), {
      registry: copied as unknown as AssessmentRegistry,
      profile: "test.profile.main",
      context: CONTEXT,
    }),
    (error) => configCode(error) === "invalid-registry",
  );

  const RegistryConstructor = first.constructor as unknown as new (input: {
    analyses: readonly AnalysisDefinition<JsonValue>[];
    ruleSets: readonly RuleSet[];
    profiles: readonly Profile[];
  }) => AssessmentRegistry;
  assert.throws(
    () => new RegistryConstructor({
      analyses: [analysis("test.analysis.same"), analysis("test.analysis.same")],
      ruleSets: [],
      profiles: [],
    }),
    (error) => configCode(error) === "duplicate-id",
  );

  const second = registry([analysis("test.analysis.local", () => ({ state: "complete", value: "second", evidence: [] }))]);
  assert.equal(runAnalysis(MODEL, ref("test.analysis.local"), {
    registry: first,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact.state, "complete");
  const secondResult = runAnalysis(MODEL, ref("test.analysis.local"), {
    registry: second,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact;
  assert.equal(secondResult.state === "complete" ? secondResult.value : undefined, "second");
});

test("profile roots expose their transitive analysis closure and the cache is per call", () => {
  let baseCalls = 0;
  const base = analysis("test.analysis.base", () => {
    baseCalls++;
    return { state: "complete", value: { count: baseCalls }, evidence: [] };
  });
  const top = analysis("test.analysis.top", (context) => {
    const first = context.get(ref(base.id));
    const second = context.get(ref(base.id));
    assert.equal(first, second);
    return { state: "complete", value: first.state === "complete" ? first.value : null, evidence: [] };
  }, { dependencies: [{ analysis: ref(base.id), accept: "complete" }] });
  const unreachable = analysis("test.analysis.unreachable", () => {
    throw new Error("must not run");
  });
  const catalog = registry([base, top, unreachable], [], [ref(top.id)]);

  const dependencyReport = runAnalysis(MODEL, ref(base.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.equal(dependencyReport.result.artifact.state, "complete");
  assert.equal(baseCalls, 1);

  runAnalysis(MODEL, ref(top.id), { registry: catalog, profile: { id: "test.profile.main", revision: "1" }, context: CONTEXT });
  assert.equal(baseCalls, 2, "a shared dependency runs once in a call and again in the next call");

  assert.throws(
    () => runAnalysis(MODEL, ref(unreachable.id), { registry: catalog, profile: "test.profile.main", context: CONTEXT }),
    (error) => configCode(error) === "missing-reference",
  );
  const untouchedModel = new Proxy(MODEL, {
    get() {
      throw new Error("MODEL_TOUCHED");
    },
  });
  assert.throws(
    () => runAnalysis(untouchedModel, ref(unreachable.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: CONTEXT,
    }),
    (error) => configCode(error) === "missing-reference" && !String(error).includes("MODEL_TOUCHED"),
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(base.id), { registry: catalog, profile: "test.profile.unknown", context: CONTEXT }),
    (error) => configCode(error) === "missing-reference",
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(base.id), {
      registry: catalog,
      profile: { id: "test.profile.main", revision: "2" },
      context: CONTEXT,
    }),
    (error) => configCode(error) === "revision-mismatch",
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(base.id), { registry: catalog, profile: undefined as never, context: CONTEXT }),
    (error) => configCode(error) === "invalid-id",
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(base.id), undefined as never),
    (error) => error instanceof AssessmentConfigError,
  );
  assert.throws(
    () => assess(MODEL, null as never),
    (error) => error instanceof AssessmentConfigError,
  );
});

test("one operation takes one core-diagnostic scan", () => {
  let baselineReads = 0;
  const baselineModel = new Proxy(MODEL, {
    get(target, property, receiver) {
      if (property === "spaces") baselineReads++;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  checkDiagnostics(baselineModel);
  assert.equal(baselineReads > 0, true);

  let operationReads = 0;
  const operationModel = new Proxy(MODEL, {
    get(target, property, receiver) {
      if (property === "spaces") operationReads++;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  const emptyRegistry = registry([], [], []);
  assess(operationModel, { registry: emptyRegistry, profile: "test.profile.main", context: CONTEXT });
  assert.equal(operationReads, baselineReads, "assessment performs exactly one diagnostic scan");
});

test("partial acceptance is explicit for both dependent analyses and rules", () => {
  let topCalls = 0;
  let strictAnalysisCalls = 0;
  let mixedRuleCalls = 0;
  let strictRuleCalls = 0;
  const base = analysis("test.analysis.partial-base", () => ({
    state: "partial",
    value: { known: 1 },
    missing: [{ kind: "context", key: "test.context.future", reason: "missing" }],
    evidence: [],
  }));
  const top = analysis("test.analysis.partial-consumer", ({ get }) => {
    topCalls++;
    const artifact = get(ref(base.id));
    return { state: "complete", value: artifact.state === "partial" ? artifact.value : null, evidence: [] };
  }, { dependencies: [{ analysis: ref(base.id), accept: "partial" }] });
  const strictAnalysis = analysis("test.analysis.complete-only-consumer", () => {
    strictAnalysisCalls++;
    return { state: "complete", value: true, evidence: [] };
  }, { dependencies: [{ analysis: ref(base.id), accept: "complete" }] });
  const topRule = rule("test.rule.top-consumer", () => ({
    applicability: "not-applicable",
    reason: "analysis phase only",
    evidence: [],
  }), { analyses: [{ analysis: ref(top.id), accept: "complete" }] });
  const mixed = rule("test.rule.partial-consumer", ({ get }) => {
    mixedRuleCalls++;
    assert.equal(get(ref(base.id)).state, "partial");
    return {
      applicability: "applicable",
      outcomes: [
        {
          id: "known",
          status: "fail",
          subjects: [MODEL_SUBJECT],
          message: "known negative",
          evidence: [fact({ id: "test.rule.partial-consumer", revision: "1" }, "known-proof")],
        },
        {
          id: "unknown",
          status: "indeterminate",
          subjects: [MODEL_SUBJECT],
          message: "unknown remainder",
          evidence: [fact({ id: "test.rule.partial-consumer", revision: "1" }, "unknown-proof")],
        },
      ],
    };
  }, { analyses: [{ analysis: ref(base.id), accept: "partial" }] });
  const strict = rule("test.rule.strict-consumer", () => {
    strictRuleCalls++;
    return { applicability: "not-applicable", reason: "must not run", evidence: [] };
  }, { analyses: [{ analysis: ref(base.id), accept: "complete" }] });
  const set = ruleSet([topRule, mixed, strict]);
  const catalog = createAssessmentRegistry({
    analyses: [base, top, strictAnalysis],
    ruleSets: [set],
    profiles: [profile([ref(top.id), ref(strictAnalysis.id)], [set])],
  });

  const strictArtifact = runAnalysis(MODEL, ref(strictAnalysis.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact;
  assert.equal(strictArtifact.state, "unavailable");
  assert.equal(strictAnalysisCalls, 0, "complete-only dependency precondition prevents the consumer provider");

  const report = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: CONTEXT });
  assert.deepEqual(report.analyses.map(({ analysis: identity }) => identity.id), [base.id, top.id]);
  assert.equal(topCalls, 1);
  assert.equal(mixedRuleCalls, 1);
  assert.equal(strictRuleCalls, 0);
  assert.deepEqual(report.rules.map(({ state }) => state), ["not-applicable", "evaluated", "indeterminate"]);
  assert.equal(report.summary.outcomes.fail, 1);
  assert.equal(report.summary.outcomes.indeterminate, 1);
  assert.equal(report.summary.state, "incomplete");
});

test("context is explicit, decoded, provenanced, and reduced to the used trace", () => {
  let calls = 0;
  const height: ContextKey<JsonValue> = {
    id: "test.context.height",
    revision: "1",
    description: "height in millimetres",
    decode: (value) => typeof value === "number"
      ? { ok: true, value }
      : { ok: false, message: "expected number" },
  };
  const provider = analysis("test.analysis.context", ({ context }) => {
    calls++;
    const read = context.get(height);
    assert.equal(read.state, "present");
    return { state: "complete", value: read.state === "present" ? read.value : null, evidence: [] };
  }, { context: [{ key: height, presence: "required" }] });
  const catalog = registry([provider]);
  const snapshot: ContextSnapshot = {
    schema: "koyu-context/1",
    asOf: "2026-08-03",
    values: {
      "test.context.unused": { value: "private", source: { kind: "brief", ref: "brief#unused" } },
      "test.context.height": {
        value: 2700,
        source: { kind: "survey", ref: "survey-A", observedAt: "2026-08-01" },
      },
    },
  };
  const report = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: snapshot,
  });
  assert.deepEqual(Object.keys(report.context.values), ["test.context.height"]);
  assert.equal(report.context.values[height.id]!.source.ref, "survey-A");
  assert.equal(Object.hasOwn(report, "ok"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
  assert.equal(calls, 1);

  const invalid = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: { ...snapshot, values: { [height.id]: { value: "high", source: { kind: "user", ref: "input" } } } },
  });
  assert.equal(invalid.result.artifact.state, "unavailable");
  assert.equal(invalid.result.artifact.missing.length > 0, true);
  assert.equal(calls, 1, "invalid required context prevents provider execution");

  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: { ...snapshot, asOf: "2026-02-30" },
    }),
    (error) => configCode(error) === "invalid-context",
  );

  const missingValue = {
    ...snapshot,
    values: { [height.id]: { source: { kind: "user", ref: "input" } } },
  } as unknown as ContextSnapshot;
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: missingValue,
    }),
    (error) => configCode(error) === "invalid-context",
  );

  const secretSource = {
    ...snapshot,
    values: {
      [height.id]: {
        value: 2700,
        source: { kind: "user", ref: "input", token: "TOP_SECRET" },
      },
    },
  } as unknown as ContextSnapshot;
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: secretSource,
    }),
    (error) => configCode(error) === "invalid-context" && !JSON.stringify(error).includes("TOP_SECRET"),
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: null as unknown as ContextSnapshot,
    }),
    (error) => configCode(error) === "invalid-context",
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: { ...snapshot, jurisdiction: null } as unknown as ContextSnapshot,
    }),
    (error) => configCode(error) === "invalid-context",
  );
});

test("context ordering, shared reads, and optional missing/invalid states are deterministic", () => {
  const decodeNumber = (value: JsonValue) => typeof value === "number"
    ? { ok: true as const, value }
    : { ok: false as const, message: "expected number" };
  const shared: ContextKey<JsonValue> = {
    id: "test.context.shared",
    revision: "1",
    description: "shared",
    decode: decodeNumber,
  };
  const optional: ContextKey<JsonValue> = {
    id: "test.context.optional",
    revision: "1",
    description: "optional",
    decode: decodeNumber,
  };
  const provider = analysis("test.analysis.context-states", ({ context }) => {
    const sharedRead = context.get(shared);
    const optionalRead = context.get(optional);
    return {
      state: "complete",
      value: { shared: sharedRead.state, optional: optionalRead.state },
      evidence: [],
    };
  }, {
    context: [
      { key: shared, presence: "required" },
      { key: optional, presence: "optional" },
    ],
  });
  const readerRule = rule("test.rule.context-reader", ({ context }) => {
    assert.equal(context.get(shared).state, "present");
    return { applicability: "not-applicable", reason: "trace only", evidence: [] };
  }, {
    analyses: [{ analysis: ref(provider.id), accept: "complete" }],
    context: [{ key: shared, presence: "required" }],
  });
  const set = ruleSet([readerRule]);
  const catalog = createAssessmentRegistry({
    analyses: [provider],
    ruleSets: [set],
    profiles: [profile([ref(provider.id)], [set])],
  });
  const sharedEntry = { value: 1, source: { kind: "brief" as const, ref: "brief#shared" } };
  const optionalEntry = { value: 2, source: { kind: "brief" as const, ref: "brief#optional" } };
  const firstContext: ContextSnapshot = {
    ...CONTEXT,
    values: { [optional.id]: optionalEntry, [shared.id]: sharedEntry },
  };
  const secondContext: ContextSnapshot = {
    ...CONTEXT,
    values: { [shared.id]: sharedEntry, [optional.id]: optionalEntry },
  };
  const first = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: firstContext });
  const second = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: secondContext });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(Object.keys(first.context.values), [optional.id, shared.id]);
  assert.equal(Object.keys(first.context.values).filter((id) => id === shared.id).length, 1);

  const missingOptional = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: { ...CONTEXT, values: { [shared.id]: sharedEntry } },
  }).result.artifact;
  assert.equal(missingOptional.state, "complete");
  if (missingOptional.state === "complete") {
    assert.deepEqual(missingOptional.value, { optional: "missing", shared: "present" });
  }

  const invalidOptional = runAnalysis(MODEL, ref(provider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: {
      ...CONTEXT,
      values: {
        [shared.id]: sharedEntry,
        [optional.id]: { value: "bad", source: { kind: "user", ref: "input" } },
      },
    },
  }).result.artifact;
  assert.equal(invalidOptional.state, "complete");
  if (invalidOptional.state === "complete") {
    assert.deepEqual(invalidOptional.value, { optional: "invalid", shared: "present" });
  }
});

test("decoder rejection is input invalid, while decoder failure is an execution error", () => {
  let providerCalls = 0;
  const throwingKey: ContextKey<JsonValue> = {
    id: "test.context.throwing-decoder",
    revision: "1",
    description: "throws",
    decode: () => { throw new Error("decoder bug"); },
  };
  const provider = analysis("test.analysis.decoder-error", () => {
    providerCalls++;
    return { state: "complete", value: true, evidence: [] };
  }, { context: [{ key: throwingKey, presence: "required" }] });
  const snapshot: ContextSnapshot = {
    ...CONTEXT,
    values: {
      [throwingKey.id]: { value: 1, source: { kind: "user", ref: "input" } },
    },
  };
  const artifact = runAnalysis(MODEL, ref(provider.id), {
    registry: registry([provider]),
    profile: "test.profile.main",
    context: snapshot,
  }).result.artifact;
  assert.equal(artifact.state, "unavailable");
  assert.equal(providerCalls, 0);
  if (artifact.state === "unavailable") {
    assert.equal(artifact.missing[0]!.kind, "koyu.execution");
    assert.equal(artifact.issues[0]!.kind, "execution-error");
  }

  let ruleCalls = 0;
  const brokenRule = rule("test.rule.decoder-error", () => {
    ruleCalls++;
    return { applicability: "not-applicable", reason: "unused", evidence: [] };
  }, { context: [{ key: throwingKey, presence: "required" }] });
  const report = assess(MODEL, {
    registry: registry([], [brokenRule], []),
    profile: "test.profile.main",
    context: snapshot,
  });
  assert.equal(report.rules[0]!.state, "error");
  assert.equal(ruleCalls, 0);

  const malformedKey: ContextKey<JsonValue> = {
    id: "test.context.non-json-decoder",
    revision: "1",
    description: "returns a Map",
    decode: (() => ({ ok: true, value: new Map() })) as unknown as ContextKey<JsonValue>["decode"],
  };
  const malformedProvider = analysis("test.analysis.non-json-decoder", () => ({
    state: "complete",
    value: true,
    evidence: [],
  }), { context: [{ key: malformedKey, presence: "required" }] });
  const malformedArtifact = runAnalysis(MODEL, ref(malformedProvider.id), {
    registry: registry([malformedProvider]),
    profile: "test.profile.main",
    context: {
      ...CONTEXT,
      values: { [malformedKey.id]: { value: 1, source: { kind: "user", ref: "input" } } },
    },
  }).result.artifact;
  assert.equal(malformedArtifact.state, "unavailable");
  assert.match(JSON.stringify(malformedArtifact), /execution-error/);

  let hiddenDecoderProviderCalls = 0;
  let hiddenDecoderReads = 0;
  const hiddenResultKey: ContextKey<JsonValue> = {
    id: "test.context.hidden-decoder-result",
    revision: "1",
    description: "returns hidden executable state",
    decode: (() => {
      const decoded = { value: 1 } as Record<PropertyKey, unknown>;
      Object.defineProperty(decoded, "ok", {
        enumerable: true,
        get() {
          hiddenDecoderReads++;
          return true;
        },
      });
      decoded[Symbol("secret")] = () => "TOP_SECRET";
      Object.defineProperty(decoded, "hidden", {
        enumerable: false,
        get() {
          hiddenDecoderReads++;
          return "TOP_SECRET";
        },
      });
      return decoded;
    }) as unknown as ContextKey<JsonValue>["decode"],
  };
  const hiddenResultProvider = analysis("test.analysis.hidden-decoder-result", () => {
    hiddenDecoderProviderCalls++;
    return { state: "complete", value: true, evidence: [] };
  }, { context: [{ key: hiddenResultKey, presence: "required" }] });
  const hiddenResultArtifact = runAnalysis(MODEL, ref(hiddenResultProvider.id), {
    registry: registry([hiddenResultProvider]),
    profile: "test.profile.main",
    context: {
      ...CONTEXT,
      values: { [hiddenResultKey.id]: { value: 1, source: { kind: "user", ref: "input" } } },
    },
  }).result.artifact;
  assert.equal(hiddenResultArtifact.state, "unavailable");
  assert.equal(hiddenDecoderProviderCalls, 0);
  assert.equal(hiddenDecoderReads, 0);
  assert.doesNotMatch(JSON.stringify(hiddenResultArtifact), /TOP_SECRET/);
});

test("undeclared analysis and context access is an execution failure", () => {
  const hidden = analysis("test.analysis.declared-elsewhere");
  const key: ContextKey<JsonValue> = {
    id: "test.context.declared-elsewhere",
    revision: "1",
    description: "not declared by the caller",
    decode: (value) => ({ ok: true, value }),
  };
  const rogueAnalysis = analysis("test.analysis.rogue", ({ get, context }) => {
    get(ref(hidden.id));
    context.get(key);
    return { state: "complete", value: true, evidence: [] };
  });
  const analysisCatalog = registry([hidden, rogueAnalysis], [], [ref(hidden.id), ref(rogueAnalysis.id)]);
  const artifact = runAnalysis(MODEL, ref(rogueAnalysis.id), {
    registry: analysisCatalog,
    profile: "test.profile.main",
    context: {
      ...CONTEXT,
      values: { [key.id]: { value: true, source: { kind: "user", ref: "input" } } },
    },
  }).result.artifact;
  assert.equal(artifact.state, "unavailable");
  assert.match(JSON.stringify(artifact), /undeclared analysis dependency/);

  const rogueContextAnalysis = analysis("test.analysis.rogue-context", ({ context }) => {
    context.get(key);
    return { state: "complete", value: true, evidence: [] };
  });
  const contextArtifact = runAnalysis(MODEL, ref(rogueContextAnalysis.id), {
    registry: registry([rogueContextAnalysis]),
    profile: "test.profile.main",
    context: {
      ...CONTEXT,
      values: { [key.id]: { value: true, source: { kind: "user", ref: "input" } } },
    },
  }).result.artifact;
  assert.equal(contextArtifact.state, "unavailable");
  assert.match(JSON.stringify(contextArtifact), /undeclared context key/);

  const rogueRule = rule("test.rule.rogue-analysis", ({ get }) => {
    get(ref(hidden.id));
    return { applicability: "not-applicable", reason: "unreachable", evidence: [] };
  });
  const rogueContextRule = rule("test.rule.rogue-context", ({ context }) => {
    context.get(key);
    return { applicability: "not-applicable", reason: "unreachable", evidence: [] };
  });
  const set = ruleSet([rogueRule, rogueContextRule]);
  const ruleCatalog = createAssessmentRegistry({
    analyses: [hidden],
    ruleSets: [set],
    profiles: [profile([ref(hidden.id)], [set])],
  });
  const report = assess(MODEL, { registry: ruleCatalog, profile: "test.profile.main", context: CONTEXT });
  assert.deepEqual(report.rules.map(({ state }) => state), ["error", "error"]);
  assert.match(JSON.stringify(report.rules[0]), /undeclared analysis dependency/);
  assert.match(JSON.stringify(report.rules[1]), /undeclared context key/);
});

test("provider failures become unavailable with non-empty execution missing and no stack", () => {
  let consistentCalls = 0;
  const throwing = analysis("test.analysis.throwing", () => {
    throw new Error("provider exploded");
  });
  const malformed = analysis("test.analysis.malformed", (() => ({
    state: "complete",
    value: new Map(),
    evidence: [],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const mixedBranch = analysis("test.analysis.mixed-branch", (() => ({
    state: "unavailable",
    value: 99,
    missing: [{ kind: "koyu.provider", data: { reason: "none" } }],
    issues: [{ kind: "execution-error", message: "original issue" }],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const secretMissingIdentity = analysis("test.analysis.secret-missing", (() => ({
    state: "unavailable",
    missing: [{
      kind: "analysis",
      analysis: { id: "test.analysis.dependency", revision: "1", secret: "TOP_SECRET" },
      reason: "unavailable",
    }],
    issues: [{ kind: "execution-error", message: "original issue" }],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const issueWithBranchLeak = analysis("test.analysis.issue-branch-leak", (() => ({
    state: "unavailable",
    missing: [{ kind: "koyu.provider", data: { reason: "none" } }],
    issues: [{ kind: "execution-error", message: "original issue", value: 99 }],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const consistent = analysis("test.analysis.consistent", () => {
    consistentCalls++;
    return { state: "complete", value: true, evidence: [] };
  });
  const tolerant = analysis("test.analysis.tolerant", () => ({ state: "complete", value: true, evidence: [] }), { model: "any" });
  const catalog = registry([
    throwing,
    malformed,
    mixedBranch,
    secretMissingIdentity,
    issueWithBranchLeak,
    consistent,
    tolerant,
  ]);

  for (const target of [throwing, malformed, mixedBranch, secretMissingIdentity, issueWithBranchLeak]) {
    const artifact = runAnalysis(MODEL, ref(target.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: CONTEXT,
    }).result.artifact;
    assert.equal(artifact.state, "unavailable");
    assert.equal(artifact.state === "unavailable" && artifact.missing.length > 0, true);
    const json = JSON.stringify(artifact);
    assert.match(json, /execution-error/);
    assert.doesNotMatch(json, /at .*assessment/);
    assert.doesNotMatch(json, /TOP_SECRET/);
    if (target === mixedBranch && artifact.state === "unavailable") {
      assert.equal(artifact.missing[0]!.kind, "koyu.execution", "mixed union branch is replaced by an engine execution failure");
    }
  }

  const blocked = runAnalysis(INCONSISTENT_MODEL, ref(consistent.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.equal(blocked.model.state, "inconsistent");
  assert.equal(blocked.model.diagnostics.some(({ severity }) => severity === "error"), true);
  assert.equal(blocked.result.artifact.state, "unavailable");
  assert.equal(consistentCalls, 0);

  const allowed = runAnalysis(INCONSISTENT_MODEL, ref(tolerant.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.equal(allowed.result.artifact.state, "complete");
  assert.equal(allowed.model.state, "inconsistent");
});

test("partial and unavailable artifacts require non-empty missing at runtime", () => {
  const validUnavailable = analysis("test.analysis.valid-unavailable", () => ({
    state: "unavailable",
    missing: [{ kind: "context", key: "test.context.absent", reason: "missing" }],
    issues: [{ kind: "missing-context", message: "context is absent" }],
  }));
  const emptyPartial = analysis("test.analysis.empty-partial", (() => ({
    state: "partial",
    value: { known: true },
    missing: [],
    evidence: [],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const emptyUnavailable = analysis("test.analysis.empty-unavailable", (() => ({
    state: "unavailable",
    missing: [],
    issues: [{ kind: "execution-error", message: "bad provider contract" }],
  })) as unknown as AnalysisDefinition<JsonValue>["run"]);
  const catalog = registry([validUnavailable, emptyPartial, emptyUnavailable]);

  const valid = runAnalysis(MODEL, ref(validUnavailable.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact;
  assert.equal(valid.state, "unavailable");
  if (valid.state === "unavailable") assert.equal(valid.missing[0]!.kind, "context");

  for (const invalid of [emptyPartial, emptyUnavailable]) {
    const artifact = runAnalysis(MODEL, ref(invalid.id), {
      registry: catalog,
      profile: "test.profile.main",
      context: CONTEXT,
    }).result.artifact;
    assert.equal(artifact.state, "unavailable");
    if (artifact.state === "unavailable") {
      assert.equal(artifact.missing[0]!.kind, "koyu.execution");
      assert.equal(artifact.issues[0]!.kind, "execution-error");
    }
  }
});

test("hostile and non-Error throws never escape or echo arbitrary values", () => {
  const hostile = new Proxy(new Error("HIDDEN_ERROR_SECRET"), {
    getPrototypeOf() { throw new Error("prototype trap"); },
    get() { throw new Error("property trap"); },
  });
  const hostileProvider = analysis("test.analysis.hostile-throw", () => { throw hostile; });
  const stringProvider = analysis("test.analysis.string-throw", () => { throw "TOP_SECRET"; });
  const catalog = registry([hostileProvider, stringProvider]);

  const hostileArtifact = runAnalysis(MODEL, ref(hostileProvider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact;
  assert.equal(hostileArtifact.state, "unavailable");
  assert.match(JSON.stringify(hostileArtifact), /Error inspection failed/);
  assert.doesNotMatch(JSON.stringify(hostileArtifact), /HIDDEN_ERROR_SECRET|prototype trap|property trap/);

  const stringArtifact = runAnalysis(MODEL, ref(stringProvider.id), {
    registry: catalog,
    profile: "test.profile.main",
    context: CONTEXT,
  }).result.artifact;
  assert.match(JSON.stringify(stringArtifact), /Non-Error thrown/);
  assert.doesNotMatch(JSON.stringify(stringArtifact), /TOP_SECRET/);

  const hostileRule = rule("test.rule.hostile-throw", () => { throw hostile; });
  const ruleReport = assess(MODEL, {
    registry: registry([], [hostileRule], []),
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.equal(ruleReport.rules[0]!.state, "error");
  assert.doesNotMatch(JSON.stringify(ruleReport), /HIDDEN_ERROR_SECRET|prototype trap|property trap/);
});

test("assessment preserves all four rule states, evidence, projections, and deterministic order", () => {
  const evaluated = rule("test.rule.evaluated", () => ({
    applicability: "applicable",
    outcomes: [
      {
        id: "z-pass",
        status: "pass",
        subjects: [MODEL_SUBJECT],
        message: "passes",
        evidence: [fact({ id: "test.rule.evaluated", revision: "1" }, "z-evidence")],
      },
      {
        id: "a-fail",
        status: "fail",
        subjects: [MODEL_SUBJECT],
        message: "fails",
        evidence: [
          fact({ id: "test.rule.evaluated", revision: "1" }, "z-last"),
          fact({ id: "test.rule.evaluated", revision: "1" }, "a-first"),
        ],
      },
    ],
  }));
  const notApplicable = rule("test.rule.not-applicable", () => ({
    applicability: "not-applicable",
    reason: "empty population",
    evidence: [],
  }));
  const indeterminate = rule("test.rule.indeterminate", () => ({
    applicability: "indeterminate",
    reason: "missing brief",
    missing: [{ kind: "context", key: "test.context.brief", reason: "missing" }],
    evidence: [],
  }));
  const broken = rule("test.rule.error", () => {
    throw new Error("rule exploded");
  });
  const catalog = registry([], [evaluated, notApplicable, indeterminate, broken], []);

  const first = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: CONTEXT });
  const second = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: CONTEXT });
  assert.deepEqual(first.rules.map(({ state }) => state), ["evaluated", "not-applicable", "indeterminate", "error"]);
  assert.deepEqual(first.summary.rules, { evaluated: 1, notApplicable: 1, indeterminate: 1, error: 1 });
  assert.deepEqual(first.summary.outcomes, { pass: 1, fail: 1, indeterminate: 0 });
  assert.equal(first.summary.state, "incomplete");
  assert.equal(first.findings.length, 1);
  assert.equal(first.findings[0]!.outcome.id, "a-fail");
  const run = first.rules[0]!;
  assert.equal(run.state, "evaluated");
  if (run.state === "evaluated") {
    assert.deepEqual(run.evaluation.outcomes.map(({ id }) => id), ["a-fail", "z-pass"]);
    assert.deepEqual(run.evaluation.outcomes[0]!.evidence.map(({ id }) => id), ["a-first", "z-last"]);
  }
  assert.equal(Object.hasOwn(first, "ok"), false);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("outcomes and evidence use Unicode scalar-value order", () => {
  const unicode = rule("test.rule.unicode-order", () => ({
    applicability: "applicable",
    outcomes: [
      {
        id: "😀",
        status: "pass",
        subjects: [MODEL_SUBJECT],
        message: "astral",
        evidence: [fact({ id: "test.rule.unicode-order", revision: "1" }, "proof")],
      },
      {
        id: "\uE000",
        status: "pass",
        subjects: [MODEL_SUBJECT],
        message: "private use",
        evidence: [
          fact({ id: "test.rule.unicode-order", revision: "1" }, "😀"),
          fact({ id: "test.rule.unicode-order", revision: "1" }, "\uE000"),
        ],
      },
    ],
  }));
  const report = assess(MODEL, {
    registry: registry([], [unicode], []),
    profile: "test.profile.main",
    context: CONTEXT,
  });
  const run = report.rules[0]!;
  assert.equal(run.state, "evaluated");
  if (run.state === "evaluated") {
    assert.deepEqual(run.evaluation.outcomes.map(({ id }) => id), ["\uE000", "😀"]);
    assert.deepEqual(run.evaluation.outcomes[0]!.evidence.map(({ id }) => id), ["\uE000", "😀"]);
  }
});

test("a completed architectural fail remains complete, while malformed rule protocol is an error", () => {
  const fail = rule("test.rule.fail", () => ({
    applicability: "applicable",
    outcomes: [{
      id: "failure",
      status: "fail",
      subjects: [MODEL_SUBJECT],
      message: "negative judgement",
      evidence: [fact({ id: "test.rule.fail", revision: "1" }, "proof")],
    }],
  }));
  const failReport = assess(MODEL, { registry: registry([], [fail], []), profile: "test.profile.main", context: CONTEXT });
  assert.equal(failReport.summary.state, "complete");
  assert.equal(failReport.summary.outcomes.fail, 1);

  const invalidSource = rule("test.rule.invalid-source", (() => ({
    applicability: "applicable",
    outcomes: [{
      id: "bad",
      status: "fail",
      subjects: [MODEL_SUBJECT],
      message: "bad shape",
      evidence: [{
        id: "bad-evidence",
        kind: "comparison",
        observed: { value: "wide", unit: "mm" },
        operator: "<=",
        required: { value: 900, unit: "mm" },
        subjects: [MODEL_SUBJECT],
        sources: [{ kind: "mystery", data: {} }],
        producedBy: { id: "test.rule.invalid-source", revision: "1" },
      }],
    }],
  })) as unknown as Rule["evaluate"]);
  const invalidSubject = rule("test.rule.invalid-subject", (() => ({
    applicability: "applicable",
    outcomes: [{
      id: "bad",
      status: "fail",
      subjects: [{ kind: "planet", ref: "earth" }],
      message: "bad subject",
      evidence: [fact({ id: "test.rule.invalid-subject", revision: "1" }, "proof")],
    }],
  })) as unknown as Rule["evaluate"]);
  const invalidQuantity = rule("test.rule.invalid-quantity", (() => ({
    applicability: "applicable",
    outcomes: [{
      id: "bad",
      status: "fail",
      subjects: [MODEL_SUBJECT],
      message: "bad quantity",
      evidence: [{
        id: "bad-comparison",
        kind: "comparison",
        observed: { value: "wide", unit: "mm" },
        operator: "<=",
        required: { value: 900, unit: "mm" },
        subjects: [MODEL_SUBJECT],
        sources: [{ kind: "model", subject: MODEL_SUBJECT }],
        producedBy: { id: "test.rule.invalid-quantity", revision: "1" },
      }],
    }],
  })) as unknown as Rule["evaluate"]);
  const mixedEvaluation = rule("test.rule.mixed-evaluation", (() => ({
    applicability: "not-applicable",
    reason: "none",
    evidence: [],
    outcomes: [],
  })) as unknown as Rule["evaluate"]);
  const secretIdentity = rule("test.rule.secret-identity", (() => ({
    applicability: "applicable",
    outcomes: [{
      id: "bad",
      status: "pass",
      subjects: [MODEL_SUBJECT],
      message: "secret identity",
      evidence: [{
        id: "proof",
        kind: "fact",
        name: "proof",
        value: true,
        subjects: [MODEL_SUBJECT],
        sources: [{ kind: "model", subject: MODEL_SUBJECT }],
        producedBy: { id: "test.rule.secret-identity", revision: "1", secret: "TOP_SECRET" },
      }],
    }],
  })) as unknown as Rule["evaluate"]);
  const report = assess(MODEL, {
    registry: registry([], [invalidSource, invalidSubject, invalidQuantity, mixedEvaluation, secretIdentity], []),
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.deepEqual(report.rules.map(({ state }) => state), ["error", "error", "error", "error", "error"]);
  assert.equal(report.summary.state, "incomplete");
  assert.equal(report.findings.length, 0, "protocol failure is not fabricated as an architectural fail");
  assert.doesNotMatch(JSON.stringify(report), /TOP_SECRET/);
});

test("invalid applicable populations and duplicate local IDs become rule errors", () => {
  const producer = { id: "test.rule.protocol-errors", revision: "1" };
  const outcome = (id: string) => ({
    id,
    status: "pass" as const,
    subjects: [MODEL_SUBJECT] as const,
    message: id,
    evidence: [fact(producer, `${id}-proof`)] as const,
  });
  const empty = rule("test.rule.empty-outcomes", (() => ({
    applicability: "applicable",
    outcomes: [],
  })) as unknown as Rule["evaluate"]);
  const duplicateOutcomes = rule("test.rule.duplicate-outcomes", (() => ({
    applicability: "applicable",
    outcomes: [outcome("same"), outcome("same")],
  })) as unknown as Rule["evaluate"]);
  const duplicateEvidence = rule("test.rule.duplicate-evidence", (() => ({
    applicability: "applicable",
    outcomes: [{
      ...outcome("one"),
      evidence: [fact(producer, "same-proof"), fact(producer, "same-proof")],
    }],
  })) as unknown as Rule["evaluate"]);
  const noEvidence = rule("test.rule.no-evidence", (() => ({
    applicability: "applicable",
    outcomes: [{
      id: "one",
      status: "fail",
      subjects: [MODEL_SUBJECT],
      message: "no proof",
      evidence: [],
    }],
  })) as unknown as Rule["evaluate"]);
  const report = assess(MODEL, {
    registry: registry([], [empty, duplicateOutcomes, duplicateEvidence, noEvidence], []),
    profile: "test.profile.main",
    context: CONTEXT,
  });
  assert.deepEqual(report.rules.map(({ state }) => state), ["error", "error", "error", "error"]);
  assert.equal(report.summary.rules.error, 4);
  assert.equal(report.findings.length, 0);
});

test("not-applicable alone is complete; a core error remains incomplete", () => {
  const notApplicable = rule("test.rule.only-not-applicable", () => ({
    applicability: "not-applicable",
    reason: "empty population",
    evidence: [],
  }), { model: "any" });
  const catalog = registry([], [notApplicable], []);
  const complete = assess(MODEL, { registry: catalog, profile: "test.profile.main", context: CONTEXT });
  assert.equal(complete.rules[0]!.state, "not-applicable");
  assert.equal(complete.summary.state, "complete");

  const incomplete = assess(INCONSISTENT_MODEL, { registry: catalog, profile: "test.profile.main", context: CONTEXT });
  assert.equal(incomplete.rules[0]!.state, "not-applicable");
  assert.equal(incomplete.model.state, "inconsistent");
  assert.equal(incomplete.summary.state, "incomplete");
});

test("runtime registry boundaries reject invalid enum values and conflicting context keys", () => {
  const badModel = analysis("test.analysis.bad-model") as unknown as Record<string, unknown>;
  badModel.model = "sometimes";
  assert.throws(
    () => createAssessmentRegistry({ analyses: [badModel as unknown as AnalysisDefinition<JsonValue>], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const badAccept = analysis("test.analysis.bad-accept", undefined, {
    dependencies: [{ analysis: ref("test.analysis.base"), accept: "sometimes" as "complete" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [analysis("test.analysis.base"), badAccept], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const badPurpose = ruleSet([]) as unknown as Record<string, unknown>;
  badPurpose.purpose = "everything";
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [badPurpose as unknown as RuleSet], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const badPresenceKey: ContextKey<JsonValue> = {
    id: "test.context.bad-presence",
    revision: "1",
    description: "bad presence",
    decode: (value) => ({ ok: true, value }),
  };
  const badPresence = analysis("test.analysis.bad-presence", undefined, {
    context: [{ key: badPresenceKey, presence: "sometimes" as "required" }],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [badPresence], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const badLevel = rule("test.rule.bad-level", () => ({ applicability: "not-applicable", reason: "none", evidence: [] }));
  (badLevel as unknown as Record<string, unknown>).level = "fatal";
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [ruleSet([badLevel])], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const noCountry = {
    ...profile([]),
    jurisdiction: { region: "13" },
  } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [noCountry] }),
    (error) => configCode(error) === "invalid-context",
  );

  const missingAuthorityJurisdiction = rule("test.rule.bad-authority", () => ({
    applicability: "not-applicable",
    reason: "none",
    evidence: [],
  }));
  (missingAuthorityJurisdiction as unknown as Record<string, unknown>).authority = [{ instrument: "Building Act" }];
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [ruleSet([missingAuthorityJurisdiction])],
      profiles: [],
    }),
    (error) => configCode(error) === "invalid-context",
  );

  const nullEffective = { ...profile([]), effective: null } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [nullEffective] }),
    (error) => configCode(error) === "invalid-context",
  );
  const extraEffective = {
    ...profile([]),
    effective: { from: "2026-01-01", secret: "TOP_SECRET" },
  } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [extraEffective] }),
    (error) => configCode(error) === "invalid-context" && !JSON.stringify(error).includes("TOP_SECRET"),
  );
  const nullJurisdictionSet = { ...ruleSet([]), jurisdiction: null } as unknown as RuleSet;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [nullJurisdictionSet], profiles: [] }),
    (error) => configCode(error) === "invalid-context",
  );

  const undefinedDependency = analysis("test.analysis.undefined-dependency", undefined, {
    dependencies: [undefined as unknown as AnalysisDefinition<JsonValue>["dependencies"][number]],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [undefinedDependency], ruleSets: [], profiles: [] }),
    (error) => error instanceof AssessmentConfigError,
  );
  const undefinedContext = analysis("test.analysis.undefined-context", undefined, {
    context: [undefined as unknown as AnalysisDefinition<JsonValue>["context"][number]],
  });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [undefinedContext], ruleSets: [], profiles: [] }),
    (error) => error instanceof AssessmentConfigError,
  );
  const undefinedRuleRequirement = rule("test.rule.undefined-requirement", () => ({
    applicability: "not-applicable",
    reason: "none",
    evidence: [],
  }));
  (undefinedRuleRequirement as unknown as Record<string, unknown>).analyses = [undefined];
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [ruleSet([undefinedRuleRequirement])],
      profiles: [],
    }),
    (error) => error instanceof AssessmentConfigError,
  );

  const nullAuthorityEffective = rule("test.rule.null-authority-effective", () => ({
    applicability: "not-applicable",
    reason: "none",
    evidence: [],
  }));
  (nullAuthorityEffective as unknown as Record<string, unknown>).authority = [{
    jurisdiction: { country: "JP" },
    instrument: "Building Act",
    effective: null,
  }];
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [ruleSet([nullAuthorityEffective])],
      profiles: [],
    }),
    (error) => configCode(error) === "invalid-context",
  );

  const decodeA = (value: JsonValue) => ({ ok: true as const, value });
  const decodeB = (value: JsonValue) => ({ ok: true as const, value });
  const keyA: ContextKey<JsonValue> = { id: "test.context.conflict", revision: "1", description: "A", decode: decodeA };
  const keyB: ContextKey<JsonValue> = { id: "test.context.conflict", revision: "1", description: "B", decode: decodeB };
  const a = analysis("test.analysis.key-a", undefined, { context: [{ key: keyA, presence: "optional" }] });
  const b = analysis("test.analysis.key-b", undefined, { context: [{ key: keyB, presence: "optional" }] });
  assert.throws(
    () => createAssessmentRegistry({ analyses: [a, b], ruleSets: [], profiles: [] }),
    (error) => configCode(error) === "duplicate-id",
  );
});

test("profile effective date and exact jurisdiction are preflight conditions", () => {
  const provider = analysis("test.analysis.jurisdiction");
  const selected: Profile = {
    ...profile([ref(provider.id)]),
    effective: { from: "2026-04-01", to: "2027-03-31" },
    jurisdiction: { country: "JP", region: "13", locality: "13101" },
  };
  const catalog = createAssessmentRegistry({ analyses: [provider], ruleSets: [], profiles: [selected] });
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: selected.id,
      context: { ...CONTEXT, asOf: "2028-01-01", jurisdiction: selected.jurisdiction },
    }),
    (error) => configCode(error) === "effective-date-mismatch",
  );
  assert.throws(
    () => runAnalysis(MODEL, ref(provider.id), {
      registry: catalog,
      profile: selected.id,
      context: { ...CONTEXT, jurisdiction: { country: "JP", region: "13" } },
    }),
    (error) => configCode(error) === "jurisdiction-mismatch",
  );

  for (const asOf of ["0001-01-01", "0099-12-31", "0100-02-28"]) {
    const report = runAnalysis(MODEL, ref(provider.id), {
      registry: createAssessmentRegistry({
        analyses: [provider],
        ruleSets: [],
        profiles: [profile([ref(provider.id)])],
      }),
      profile: "test.profile.main",
      context: { ...CONTEXT, asOf },
    });
    assert.equal(report.context.asOf, asOf);
  }
});

test("effective and jurisdiction reject hidden state and accessors without executing getters", () => {
  const symbolEffective = { from: "2026-01-01" } as Record<PropertyKey, unknown>;
  symbolEffective[Symbol("hidden")] = () => "TOP_SECRET";
  const profileWithSymbol = {
    ...profile([]),
    effective: symbolEffective,
  } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [profileWithSymbol] }),
    (error) => configCode(error) === "invalid-context",
  );

  const hiddenJurisdiction = { country: "JP" } as Record<string, unknown>;
  Object.defineProperty(hiddenJurisdiction, "hidden", {
    value: "TOP_SECRET",
    enumerable: false,
  });
  const profileWithHidden = {
    ...profile([]),
    jurisdiction: hiddenJurisdiction,
  } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [profileWithHidden] }),
    (error) => configCode(error) === "invalid-context" && !JSON.stringify(error).includes("TOP_SECRET"),
  );

  let nestedReads = 0;
  const accessorJurisdiction = {} as Record<string, unknown>;
  Object.defineProperty(accessorJurisdiction, "country", {
    enumerable: true,
    get() {
      nestedReads += 1;
      return "JP";
    },
  });
  const profileWithNestedAccessor = {
    ...profile([]),
    jurisdiction: accessorJurisdiction,
  } as unknown as Profile;
  assert.throws(
    () => createAssessmentRegistry({ analyses: [], ruleSets: [], profiles: [profileWithNestedAccessor] }),
    (error) => configCode(error) === "invalid-context",
  );
  assert.equal(nestedReads, 0);

  let profileReads = 0;
  const profileWithAccessor = profile([]) as unknown as Record<string, unknown>;
  Object.defineProperty(profileWithAccessor, "effective", {
    enumerable: true,
    get() {
      profileReads += 1;
      return { from: "2026-01-01" };
    },
  });
  assert.throws(
    () => createAssessmentRegistry({
      analyses: [],
      ruleSets: [],
      profiles: [profileWithAccessor as unknown as Profile],
    }),
    (error) => configCode(error) === "invalid-context",
  );
  assert.equal(profileReads, 0);
});

test("protocol source has no global registration, discovery, I/O, or current-time escape hatch", () => {
  const source = [
    "../src/analysis/json.ts",
    "../src/analysis/contracts.ts",
    "../src/validate/contracts.ts",
    "../src/validate/assessment.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /\b(?:register|unregister)(?:Analysis|Rule|Profile|Pack)\b/);
  assert.doesNotMatch(source, /^\s*(?:export\s+)?(?:let|var)\s+\w*(?:registry|catalog)/gim);
  assert.doesNotMatch(source, /globalThis|node_modules|Date\.now\(|new Date\(\)|node:fs|node:path|process\.(?:env|cwd)/);
});
