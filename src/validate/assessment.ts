import { checkDiagnostics, type Diagnostic } from "../core/diagnose.js";
import type { Model } from "../core/model.js";
import {
  ANALYSIS_FORMAT,
  COMPONENT_ID_PATTERN,
  isComponentIdentity,
  sameIdentity,
  type AnalysisArtifact,
  type AnalysisDefinition,
  type AnalysisRef,
  type AnalysisReport,
  type AnalysisRequirement,
  type AnalysisResult,
  type ComponentIdentity,
  type ContextEntry,
  type ContextKey,
  type ContextRead,
  type ContextReader,
  type ContextRequirement,
  type ContextSnapshot,
  type ContextSource,
  type DeepReadonly,
  type EffectiveRange,
  type Evidence,
  type ExecutionIssue,
  type JurisdictionRef,
  type MissingInput,
} from "../analysis/contracts.js";
import {
  JsonBoundaryError,
  assertJsonValue,
  canonicalJsonValue,
  codePointCompare,
  type JsonValue,
} from "../analysis/json.js";
import {
  ASSESSMENT_FORMAT,
  AssessmentConfigError,
  type AssessmentConfigProblem,
  type AssessmentFinding,
  type AssessmentOptions,
  type AssessmentRegistry,
  type AssessmentRegistryInput,
  type AssessmentReport,
  type AssessmentSummary,
  type ComponentKind,
  type Profile,
  type ProfileRef,
  type Rule,
  type RuleEvaluation,
  type RuleOutcome,
  type RuleRun,
  type RuleSet,
  type RunAnalysisOptions,
} from "./contracts.js";

const SOURCE_KINDS = new Set(["authority", "survey", "brief", "user", "import", "other"]);
const OUTCOME_STATUSES = new Set(["pass", "fail", "indeterminate"]);
const MODEL_REQUIREMENTS = new Set(["consistent", "any"]);
const ANALYSIS_ACCEPTANCE = new Set(["complete", "partial"]);
const CONTEXT_PRESENCE = new Set(["required", "optional"]);
const FINDING_LEVELS = new Set(["violation", "caution"]);
const RULE_SET_PURPOSES = new Set(["design-lint", "operational-review", "code-screening", "compliance"]);
const SUBJECT_KINDS = new Set(["level", "space", "zone", "boundary", "opening", "run", "site"]);
const EVIDENCE_KINDS = new Set(["fact", "comparison", "route", "geometry", "missing"]);
const ISSUE_KINDS = new Set(["model-inconsistent", "dependency-unavailable", "missing-context", "invalid-context", "execution-error"]);
const COMPARISON_OPERATORS = new Set(["<", "<=", "=", ">=", ">", "inside", "outside"]);

interface RegistryIndexes {
  readonly analyses: ReadonlyMap<string, AnalysisDefinition<JsonValue>>;
  readonly ruleSets: ReadonlyMap<string, RuleSet>;
  readonly profiles: ReadonlyMap<string, Profile>;
}

class LocalAssessmentRegistry implements AssessmentRegistry {
  readonly #verified = true;
  readonly analyses: readonly AnalysisDefinition<JsonValue>[];
  readonly ruleSets: readonly RuleSet[];
  readonly profiles: readonly Profile[];

  constructor(input: AssessmentRegistryInput) {
    try {
      preflightRegistry(input);
    } catch (error) {
      rethrowRegistryError(error, "registry preflight failed");
    }
    let snapshot: AssessmentRegistryInput;
    try {
      snapshot = {
        analyses: Object.freeze(snapshotMap(input.analyses, copyAnalysisDefinition)),
        ruleSets: Object.freeze(snapshotMap(input.ruleSets, copyRuleSet)),
        profiles: Object.freeze(snapshotMap(input.profiles, copyProfile)),
      };
    } catch (error) {
      throw new AssessmentConfigError({
        code: "invalid-registry",
        message: `registry snapshot failed: ${safeErrorMessage(error)}`,
      });
    }
    preflightRegistry(snapshot);
    this.analyses = snapshot.analyses;
    this.ruleSets = snapshot.ruleSets;
    this.profiles = snapshot.profiles;
    Object.freeze(this);
  }

  static is(value: unknown): value is LocalAssessmentRegistry {
    try {
      return typeof value === "object" && value !== null && #verified in value;
    } catch {
      return false;
    }
  }
}

function rethrowRegistryError(error: unknown, prefix: string): never {
  let configurationError = false;
  try {
    configurationError = error instanceof AssessmentConfigError;
  } catch {
    configurationError = false;
  }
  if (configurationError) throw error;
  throw new AssessmentConfigError({
    code: "invalid-registry",
    message: `${prefix}: ${safeErrorMessage(error)}`,
  });
}

class ContextDecoderExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextDecoderExecutionError";
  }
}

export function createAssessmentRegistry(input: AssessmentRegistryInput): AssessmentRegistry {
  return new LocalAssessmentRegistry(input);
}

export function runAnalysis<T extends JsonValue>(
  model: Model,
  analysis: AnalysisRef<T>,
  options: RunAnalysisOptions,
): AnalysisReport<T> {
  const configured = prepareConfiguration(options);
  const allowed = reachableAnalyses(configured.profile, configured.indexes.analyses);
  requireResolved(analysis, configured.indexes.analyses, configured.profile, "analysis");
  if (!allowed.has(analysis.id) || !sameIdentity(allowed.get(analysis.id)!, analysis)) {
    throw new AssessmentConfigError({
      code: "missing-reference",
      owner: identityOf(configured.profile),
      targetKind: "analysis",
      target: identityOf(analysis),
    });
  }
  const prepared = diagnoseModel(model, configured);

  const session = new AnalysisSession(
    model,
    prepared.modelState,
    prepared.indexes.analyses,
    allowed,
    prepared.context,
    prepared.usedContext,
  );
  const artifact = session.run(analysis);
  const report: AnalysisReport<T> = {
    schema: ANALYSIS_FORMAT,
    profile: identityOf(prepared.profile),
    model: modelReport(model, prepared.modelState, prepared.diagnostics),
    context: contextTrace(prepared.context, prepared.usedContext),
    result: { analysis: identityOf(analysis), artifact },
  };
  return immutableCanonical(report) as AnalysisReport<T>;
}

export function assess(model: Model, options: AssessmentOptions): AssessmentReport {
  const prepared = diagnoseModel(model, prepareConfiguration(options));
  const allowed = reachableAnalyses(prepared.profile, prepared.indexes.analyses);
  const session = new AnalysisSession(
    model,
    prepared.modelState,
    prepared.indexes.analyses,
    allowed,
    prepared.context,
    prepared.usedContext,
  );
  const selectedRuleSets = prepared.profile.ruleSets.map((reference) =>
    requireResolved(reference, prepared.indexes.ruleSets, prepared.profile, "rule-set")
  );
  const orderedRules = selectedRuleSets.flatMap((ruleSet) =>
    ruleSet.rules.map((rule) => ({ ruleSet, rule }))
  );

  // Complete the analysis phase before calling any rule. Shared dependencies still execute once.
  for (const { rule } of orderedRules) {
    for (const requirement of rule.analyses) session.run(requirement.analysis);
  }

  const runs: RuleRun[] = [];
  const findings: AssessmentFinding[] = [];
  for (const item of orderedRules) {
    const run = executeRule(item.rule, item.ruleSet, session, prepared);
    runs.push(run);
    if (run.state !== "evaluated") continue;
    for (const outcome of run.evaluation.outcomes) {
      if (outcome.status !== "fail") continue;
      findings.push({
        rule: identityOf(item.rule),
        ruleSet: identityOf(item.ruleSet),
        level: item.rule.level,
        outcome: outcome as RuleOutcome & { status: "fail" },
      });
    }
  }

  const summary = summarize(prepared.modelState, runs);
  const report: AssessmentReport = {
    schema: ASSESSMENT_FORMAT,
    profile: identityOf(prepared.profile),
    ruleSets: selectedRuleSets.map(identityOf),
    model: modelReport(model, prepared.modelState, prepared.diagnostics),
    context: contextTrace(prepared.context, prepared.usedContext),
    analyses: session.results,
    rules: runs,
    findings,
    summary,
  };
  return immutableCanonical(report) as AssessmentReport;
}

interface PreparedRun {
  readonly indexes: RegistryIndexes;
  readonly profile: Profile;
  readonly context: ContextSnapshot;
  readonly usedContext: Set<string>;
  readonly diagnostics: readonly Diagnostic[];
  readonly modelState: "consistent" | "inconsistent";
}

type PreparedConfiguration = Omit<PreparedRun, "diagnostics" | "modelState">;

function prepareConfiguration(options: AssessmentOptions): PreparedConfiguration {
  try {
    return prepareConfigurationUnchecked(options);
  } catch (error) {
    let configurationError = false;
    try {
      configurationError = error instanceof AssessmentConfigError;
    } catch {
      configurationError = false;
    }
    if (configurationError) throw error;
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: "$options",
      message: safeErrorMessage(error),
    });
  }
}

function prepareConfigurationUnchecked(options: AssessmentOptions): PreparedConfiguration {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: "$options",
      message: "assessment options must be an object",
    });
  }
  validateConfigKeys(
    options as unknown as Record<string, unknown>,
    ["registry", "profile", "context"],
    "$options",
    ["registry", "profile", "context"],
  );
  const indexes = indexRegistry(options.registry);
  const profile = resolveProfile(options.profile, indexes.profiles);
  const context = normalizeContextSnapshot(options.context);
  const selectedRuleSets = profile.ruleSets.map((reference) =>
    requireResolved(reference, indexes.ruleSets, profile, "rule-set")
  );
  validateApplicability(profile, selectedRuleSets, context);
  return { indexes, profile, context, usedContext: new Set<string>() };
}

function diagnoseModel(model: Model, configured: PreparedConfiguration): PreparedRun {
  // This is the only call site for a run. The resulting array is shared by every provider and rule.
  const diagnostics = checkDiagnostics(model);
  const modelState = diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? "inconsistent"
    : "consistent";
  return { ...configured, diagnostics, modelState };
}

function preflightRegistry(input: AssessmentRegistryInput): void {
  if (!input || typeof input !== "object") {
    throw new AssessmentConfigError({ code: "invalid-registry", message: "registry catalog must be an object" });
  }
  validateConfigKeys(
    input as unknown as Record<string, unknown>,
    ["analyses", "ruleSets", "profiles"],
    "$registry",
    ["analyses", "ruleSets", "profiles"],
  );
  requireProtocolArray(input.analyses, "$.analyses");
  requireProtocolArray(input.ruleSets, "$.ruleSets");
  requireProtocolArray(input.profiles, "$.profiles");
  const analyses = uniqueMap(input.analyses, "analysis");
  const ruleSets = uniqueMap(input.ruleSets, "rule-set");
  const profiles = uniqueMap(input.profiles, "profile");
  const contextKeys = new Map<string, ContextKey<JsonValue>>();

  for (const definition of input.analyses) {
    validateIdentity(definition, "analysis");
    validateConfigKeys(
      definition as unknown as Record<string, unknown>,
      ["id", "revision", "title", "model", "dependencies", "context", "run"],
      `/analyses/${definition.id}`,
      ["id", "revision", "title", "model", "dependencies", "context", "run"],
    );
    validateNonEmpty(definition.title, `/analyses/${definition.id}/title`);
    if (!MODEL_REQUIREMENTS.has(definition.model)) malformedDefinition(definition, "model must be consistent or any");
    if (typeof definition.run !== "function") malformedDefinition(definition, "run must be a function");
    requireProtocolArray(definition.dependencies, `/analyses/${definition.id}/dependencies`);
    requireProtocolArray(definition.context, `/analyses/${definition.id}/context`);
    validateRequirements(definition, definition.dependencies, analyses);
    validateContextRequirements(definition, definition.context, contextKeys);
  }
  validateAnalysisCycles(input.analyses, analyses);

  for (const ruleSet of input.ruleSets) {
    validateIdentity(ruleSet, "rule-set");
    validateConfigKeys(
      ruleSet as unknown as Record<string, unknown>,
      ["id", "revision", "title", "purpose", "jurisdiction", "effective", "rules"],
      `/ruleSets/${ruleSet.id}`,
      ["id", "revision", "title", "purpose", "rules"],
    );
    validateNonEmpty(ruleSet.title, `/ruleSets/${ruleSet.id}/title`);
    if (!RULE_SET_PURPOSES.has(ruleSet.purpose)) malformedDefinition(ruleSet, "invalid rule-set purpose");
    requireProtocolArray(ruleSet.rules, `/ruleSets/${ruleSet.id}/rules`);
    validateEffective(ruleSet, ruleSet.effective);
    validateJurisdiction(ruleSet, ruleSet.jurisdiction);
    const rules = uniqueMap(ruleSet.rules, "rule");
    for (const rule of rules.values()) {
      validateIdentity(rule, "rule");
      validateConfigKeys(
        rule as unknown as Record<string, unknown>,
        ["id", "revision", "title", "level", "model", "analyses", "context", "authority", "evaluate"],
        `/rules/${rule.id}`,
        ["id", "revision", "title", "level", "model", "analyses", "context", "authority", "evaluate"],
      );
      validateNonEmpty(rule.title, `/ruleSets/${ruleSet.id}/rules/${rule.id}/title`);
      if (!FINDING_LEVELS.has(rule.level)) malformedDefinition(rule, "level must be violation or caution");
      if (!MODEL_REQUIREMENTS.has(rule.model)) malformedDefinition(rule, "model must be consistent or any");
      if (typeof rule.evaluate !== "function") malformedDefinition(rule, "evaluate must be a function");
      requireProtocolArray(rule.analyses, `/rules/${rule.id}/analyses`);
      requireProtocolArray(rule.context, `/rules/${rule.id}/context`);
      requireProtocolArray(rule.authority, `/rules/${rule.id}/authority`);
      validateRequirements(rule, rule.analyses, analyses);
      validateContextRequirements(rule, rule.context, contextKeys);
      for (const citation of rule.authority) validateAuthorityCitation(citation, rule);
    }
  }

  for (const profile of input.profiles) {
    validateIdentity(profile, "profile");
    validateConfigKeys(
      profile as unknown as Record<string, unknown>,
      ["id", "revision", "title", "jurisdiction", "effective", "analyses", "ruleSets"],
      `/profiles/${profile.id}`,
      ["id", "revision", "title", "analyses", "ruleSets"],
    );
    validateNonEmpty(profile.title, `/profiles/${profile.id}/title`);
    validateEffective(profile, profile.effective);
    validateJurisdiction(profile, profile.jurisdiction);
    requireProtocolArray(profile.analyses, `/profiles/${profile.id}/analyses`);
    requireProtocolArray(profile.ruleSets, `/profiles/${profile.id}/ruleSets`);
    validateUniqueRefs(profile.analyses, "analysis");
    validateUniqueRefs(profile.ruleSets, "rule-set");

    for (const reference of profile.analyses) {
      requireResolved(reference, analyses, profile, "analysis");
    }
    const allowed = reachableAnalyses(profile, analyses);

    const selectedRules = new Map<string, Rule>();
    for (const reference of profile.ruleSets) {
      const ruleSet = requireResolved(reference, ruleSets, profile, "rule-set");
      validateProfileRuleSetJurisdiction(profile, ruleSet);
      for (const rule of ruleSet.rules) {
        if (selectedRules.has(rule.id)) {
          throw new AssessmentConfigError({ code: "duplicate-id", kind: "rule", id: rule.id });
        }
        selectedRules.set(rule.id, rule);
        for (const requirement of rule.analyses) {
          const selected = allowed.get(requirement.analysis.id);
          if (!selected || !sameIdentity(selected, requirement.analysis)) {
            throw missingReference(profile, "analysis", requirement.analysis);
          }
        }
      }
    }
  }

  // `profiles` is built above to validate duplicates even though resolution happens in the loop.
  void profiles;
}

function uniqueMap<T extends ComponentIdentity>(items: readonly T[], kind: ComponentKind): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    validateDefinitionShape(item, kind);
    validateIdentity(item, kind);
    if (out.has(item.id)) {
      throw new AssessmentConfigError({ code: "duplicate-id", kind, id: item.id });
    }
    out.set(item.id, item);
  }
  return out;
}

function validateDefinitionShape(value: unknown, kind: ComponentKind): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AssessmentConfigError({ code: "invalid-id", kind, id: String(value) });
  }
  const layouts: Partial<Record<ComponentKind, { allowed: readonly string[]; required: readonly string[] }>> = {
    analysis: {
      allowed: ["id", "revision", "title", "model", "dependencies", "context", "run"],
      required: ["id", "revision", "title", "model", "dependencies", "context", "run"],
    },
    "rule-set": {
      allowed: ["id", "revision", "title", "purpose", "jurisdiction", "effective", "rules"],
      required: ["id", "revision", "title", "purpose", "rules"],
    },
    profile: {
      allowed: ["id", "revision", "title", "jurisdiction", "effective", "analyses", "ruleSets"],
      required: ["id", "revision", "title", "analyses", "ruleSets"],
    },
    rule: {
      allowed: ["id", "revision", "title", "level", "model", "analyses", "context", "authority", "evaluate"],
      required: ["id", "revision", "title", "level", "model", "analyses", "context", "authority", "evaluate"],
    },
  };
  const layout = layouts[kind];
  if (!layout) return;
  validateConfigKeys(value as Record<string, unknown>, layout.allowed, `/components/${kind}`, layout.required);
}

function validateRequirements(
  owner: ComponentIdentity,
  requirements: readonly AnalysisRequirement[],
  analyses: ReadonlyMap<string, AnalysisDefinition<JsonValue>>,
): void {
  const seen = new Set<string>();
  for (const requirement of requirements) {
    if (typeof requirement !== "object" || requirement === null || Array.isArray(requirement)) {
      malformedDefinition(owner, "analysis requirement must be an object");
    }
    validateConfigKeys(
      requirement as unknown as Record<string, unknown>,
      ["analysis", "accept"],
      `/components/${owner.id}/analyses`,
      ["analysis", "accept"],
    );
    validateReferenceIdentity(requirement.analysis, "analysis");
    if (!ANALYSIS_ACCEPTANCE.has(requirement.accept)) malformedDefinition(owner, "analysis accept must be complete or partial");
    if (seen.has(requirement.analysis.id)) {
      throw new AssessmentConfigError({ code: "duplicate-id", kind: "analysis", id: requirement.analysis.id });
    }
    seen.add(requirement.analysis.id);
    requireResolved(requirement.analysis, analyses, owner, "analysis");
  }
}

function validateContextRequirements(
  owner: ComponentIdentity,
  requirements: readonly ContextRequirement[],
  known: Map<string, ContextKey<JsonValue>>,
): void {
  const local = new Set<string>();
  for (const requirement of requirements) {
    if (typeof requirement !== "object" || requirement === null || Array.isArray(requirement)) {
      malformedDefinition(owner, "context requirement must be an object");
    }
    validateConfigKeys(
      requirement as unknown as Record<string, unknown>,
      ["key", "presence"],
      `/components/${owner.id}/context`,
      ["key", "presence"],
    );
    const key = requirement.key as ContextKey<JsonValue>;
    if (typeof key !== "object" || key === null || Array.isArray(key)) {
      malformedDefinition(owner, "context key must be an object");
    }
    validateConfigKeys(
      key as unknown as Record<string, unknown>,
      ["id", "revision", "description", "decode"],
      "/contextKeys",
      ["id", "revision", "description", "decode"],
    );
    validateIdentity(key, "context-key");
    validateNonEmpty(key.description, `/contextKeys/${key.id}/description`);
    if (typeof key.decode !== "function") malformedDefinition(owner, "context key decode must be a function");
    if (!CONTEXT_PRESENCE.has(requirement.presence)) malformedDefinition(owner, "context presence must be required or optional");
    if (local.has(key.id)) {
      throw new AssessmentConfigError({ code: "duplicate-id", kind: "context-key", id: key.id });
    }
    local.add(key.id);
    const previous = known.get(key.id);
    if (previous && (previous.revision !== key.revision || previous.decode !== key.decode)) {
      throw new AssessmentConfigError({ code: "duplicate-id", kind: "context-key", id: key.id });
    }
    known.set(key.id, key);
  }
  void owner;
}

function validateAnalysisCycles(
  definitions: readonly AnalysisDefinition<JsonValue>[],
  analyses: ReadonlyMap<string, AnalysisDefinition<JsonValue>>,
): void {
  const state = new Map<string, "grey" | "black">();
  const stack: AnalysisDefinition<JsonValue>[] = [];

  const visit = (definition: AnalysisDefinition<JsonValue>): void => {
    const current = state.get(definition.id);
    if (current === "black") return;
    if (current === "grey") {
      const start = stack.findIndex((entry) => entry.id === definition.id);
      const cycle = [...stack.slice(start), definition].map(identityOf);
      throw new AssessmentConfigError({
        code: "dependency-cycle",
        path: cycle as [ComponentIdentity, ComponentIdentity, ...ComponentIdentity[]],
      });
    }
    state.set(definition.id, "grey");
    stack.push(definition);
    for (const requirement of definition.dependencies) {
      visit(requireResolved(requirement.analysis, analyses, definition, "analysis"));
    }
    stack.pop();
    state.set(definition.id, "black");
  };

  for (const definition of definitions) visit(definition);
}

function indexRegistry(registry: AssessmentRegistry): RegistryIndexes {
  if (!LocalAssessmentRegistry.is(registry)) {
    throw new AssessmentConfigError({
      code: "invalid-registry",
      message: "registry must be created by createAssessmentRegistry",
    });
  }
  return {
    analyses: new Map(registry.analyses.map((item) => [item.id, item])),
    ruleSets: new Map(registry.ruleSets.map((item) => [item.id, item])),
    profiles: new Map(registry.profiles.map((item) => [item.id, item])),
  };
}

function resolveProfile(
  selection: ProfileRef | string,
  profiles: ReadonlyMap<string, Profile>,
): Profile {
  if (typeof selection !== "string") {
    return requireResolved(selection, profiles, selection, "profile");
  }
  if (!COMPONENT_ID_PATTERN.test(selection)) {
    throw new AssessmentConfigError({ code: "invalid-id", kind: "profile", id: selection });
  }
  const profile = profiles.get(selection);
  if (!profile) {
    const target = { id: selection, revision: "unknown" };
    throw missingReference(target, "profile", target);
  }
  return profile;
}

function reachableAnalyses(
  profile: Profile,
  analyses: ReadonlyMap<string, AnalysisDefinition<JsonValue>>,
): Map<string, AnalysisRef> {
  const reachable = new Map<string, AnalysisRef>();
  const visit = (reference: AnalysisRef, owner: ComponentIdentity): void => {
    const definition = requireResolved(reference, analyses, owner, "analysis");
    const previous = reachable.get(definition.id);
    if (previous) {
      if (!sameIdentity(previous, definition)) {
        throw new AssessmentConfigError({
          code: "revision-mismatch",
          owner: identityOf(owner),
          targetKind: "analysis",
          id: definition.id,
          expected: previous.revision,
          actual: definition.revision,
        });
      }
      return;
    }
    reachable.set(definition.id, identityOf(definition));
    for (const dependency of definition.dependencies) visit(dependency.analysis, definition);
  };
  for (const root of profile.analyses) visit(root, profile);
  return reachable;
}

function requireResolved<T extends ComponentIdentity>(
  reference: ComponentIdentity,
  definitions: ReadonlyMap<string, T>,
  owner: ComponentIdentity,
  kind: ComponentKind,
): T {
  validateReferenceIdentity(reference, kind);
  const found = definitions.get(reference.id);
  if (!found) throw missingReference(owner, kind, reference);
  if (found.revision !== reference.revision) {
    throw new AssessmentConfigError({
      code: "revision-mismatch",
      owner: identityOf(owner),
      targetKind: kind,
      id: reference.id,
      expected: reference.revision,
      actual: found.revision,
    });
  }
  return found;
}

function validateReferenceIdentity(reference: unknown, kind: ComponentKind): asserts reference is ComponentIdentity {
  if (typeof reference !== "object" || reference === null || Array.isArray(reference)) {
    throw new AssessmentConfigError({ code: "invalid-id", kind, id: String(reference) });
  }
  validateConfigKeys(
    reference as Record<string, unknown>,
    ["id", "revision"],
    "/references",
    ["id", "revision"],
  );
  validateIdentity(reference, kind);
  if (Reflect.ownKeys(reference).length !== 2) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: "/references",
      message: "component references contain only id and revision",
    });
  }
}

function missingReference(
  owner: ComponentIdentity,
  targetKind: ComponentKind,
  target: ComponentIdentity,
): AssessmentConfigError {
  return new AssessmentConfigError({
    code: "missing-reference",
    owner: identityOf(owner),
    targetKind,
    target: identityOf(target),
  });
}

function validateIdentity(identity: unknown, kind: ComponentKind): asserts identity is ComponentIdentity {
  if (!isComponentIdentity(identity)) {
    const candidate = identity as { id?: unknown } | null | undefined;
    const id = typeof candidate?.id === "string" ? candidate.id : String(candidate?.id);
    throw new AssessmentConfigError({ code: "invalid-id", kind, id });
  }
}

function validateUniqueRefs(references: readonly ComponentIdentity[], kind: ComponentKind): void {
  const seen = new Set<string>();
  for (const reference of references) {
    validateReferenceIdentity(reference, kind);
    if (seen.has(reference.id)) {
      throw new AssessmentConfigError({ code: "duplicate-id", kind, id: reference.id });
    }
    seen.add(reference.id);
  }
}

function validateNonEmpty(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AssessmentConfigError({ code: "invalid-context", path, message: "must not be empty" });
  }
}

function requireProtocolArray(value: unknown, path: string): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new AssessmentConfigError({ code: "invalid-context", path, message: "must be an array" });
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new AssessmentConfigError({ code: "invalid-context", path, message: "array symbol fields are not allowed" });
    }
    if (key === "length" || !/^(0|[1-9]\d*)$/.test(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      throw new AssessmentConfigError({
        code: "invalid-context",
        path: `${path}[${key}]`,
        message: "array entries must be enumerable data properties",
      });
    }
  }
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) {
      throw new AssessmentConfigError({ code: "invalid-context", path: `${path}[${index}]`, message: "arrays must not be sparse" });
    }
  }
}

function malformedDefinition(owner: ComponentIdentity, message: string): never {
  throw new AssessmentConfigError({
    code: "invalid-context",
    path: `/components/${owner.id}`,
    message,
  });
}

function validateAuthorityCitation(
  citation: Rule["authority"][number],
  owner: ComponentIdentity,
): void {
  if (!citation || typeof citation !== "object") malformedDefinition(owner, "authority citation must be an object");
  try {
    assertJsonValue(citation);
    assertAuthorityCitation(citation);
  } catch (error) {
    malformedDefinition(owner, `invalid authority citation: ${safeErrorMessage(error)}`);
  }
  validateJurisdiction(owner, citation.jurisdiction);
  validateNonEmpty(citation.instrument, `/components/${owner.id}/authority/instrument`);
  if (citation.provision !== undefined) validateNonEmpty(citation.provision, `/components/${owner.id}/authority/provision`);
  if (citation.uri !== undefined) validateNonEmpty(citation.uri, `/components/${owner.id}/authority/uri`);
  validateEffective(owner, citation.effective);
}

function validateEffective(owner: ComponentIdentity, effective: EffectiveRange | undefined): void {
  if (effective === undefined) return;
  if (typeof effective !== "object" || effective === null || Array.isArray(effective)) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/effective`,
      message: "effective must be an object when present",
    });
  }
  try {
    assertJsonValue(effective);
  } catch (error) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/effective`,
      message: `effective must be plain JSON data: ${safeErrorMessage(error)}`,
    });
  }
  validateConfigKeys(
    effective as unknown as Record<string, unknown>,
    ["from", "to"],
    `/components/${owner.id}/effective`,
    ["from"],
  );
  if (!isIsoDate(effective.from) || (effective.to !== undefined && !isIsoDate(effective.to))) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/effective`,
      message: "effective dates must be real YYYY-MM-DD calendar dates",
    });
  }
  if (effective.to !== undefined && effective.from > effective.to) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/effective`,
      message: "effective.from must not be after effective.to",
    });
  }
}

function validateJurisdiction(owner: ComponentIdentity, jurisdiction: JurisdictionRef | undefined): void {
  if (jurisdiction === undefined) return;
  if (typeof jurisdiction !== "object" || jurisdiction === null || Array.isArray(jurisdiction)) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/jurisdiction`,
      message: "jurisdiction must be an object when present",
    });
  }
  try {
    assertJsonValue(jurisdiction);
  } catch (error) {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/jurisdiction`,
      message: `jurisdiction must be plain JSON data: ${safeErrorMessage(error)}`,
    });
  }
  const allowed = new Set(["country", "region", "locality", "authority"]);
  if (typeof jurisdiction.country !== "string" || jurisdiction.country.trim() === "") {
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: `/components/${owner.id}/jurisdiction/country`,
      message: "country is required",
    });
  }
  for (const [field, value] of Object.entries(jurisdiction)) {
    if (!allowed.has(field)) {
      throw new AssessmentConfigError({
        code: "invalid-context",
        path: `/components/${owner.id}/jurisdiction/${field}`,
        message: "unknown jurisdiction field",
      });
    }
    if (typeof value !== "string" || value.trim() === "") {
      throw new AssessmentConfigError({
        code: "invalid-context",
        path: `/components/${owner.id}/jurisdiction/${field}`,
        message: "jurisdiction fields must be non-empty strings",
      });
    }
  }
}

function validateProfileRuleSetJurisdiction(profile: Profile, ruleSet: RuleSet): void {
  if (!profile.jurisdiction && ruleSet.jurisdiction) {
    throw jurisdictionMismatch(profile, undefined, ruleSet.jurisdiction);
  }
  if (profile.jurisdiction && ruleSet.jurisdiction && !sameJurisdiction(profile.jurisdiction, ruleSet.jurisdiction)) {
    throw jurisdictionMismatch(ruleSet, profile.jurisdiction, ruleSet.jurisdiction);
  }
}

function validateApplicability(profile: Profile, ruleSets: readonly RuleSet[], context: ContextSnapshot): void {
  validateAsOf(profile, profile.effective, context.asOf);
  for (const ruleSet of ruleSets) validateAsOf(ruleSet, ruleSet.effective, context.asOf);
  if (profile.jurisdiction && (!context.jurisdiction || !sameJurisdiction(profile.jurisdiction, context.jurisdiction))) {
    throw jurisdictionMismatch(profile, profile.jurisdiction, context.jurisdiction);
  }
}

function validateAsOf(owner: ComponentIdentity, effective: EffectiveRange | undefined, asOf: string): void {
  if (!effective) return;
  if (asOf < effective.from || (effective.to !== undefined && asOf > effective.to)) {
    throw new AssessmentConfigError({
      code: "effective-date-mismatch",
      owner: identityOf(owner),
      asOf,
      effective: { ...effective },
    });
  }
}

function jurisdictionMismatch(
  owner: ComponentIdentity,
  expected: JurisdictionRef | undefined,
  actual: JurisdictionRef | undefined,
): AssessmentConfigError {
  return new AssessmentConfigError({
    code: "jurisdiction-mismatch",
    owner: identityOf(owner),
    ...(expected ? { expected: { ...expected } } : {}),
    ...(actual ? { actual: { ...actual } } : {}),
  });
}

function sameJurisdiction(a: JurisdictionRef, b: JurisdictionRef): boolean {
  return a.country === b.country
    && a.region === b.region
    && a.locality === b.locality
    && a.authority === b.authority;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

function normalizeContextSnapshot(snapshot: ContextSnapshot): ContextSnapshot {
  try {
    return normalizeContextSnapshotUnchecked(snapshot);
  } catch (error) {
    let configurationError = false;
    try {
      configurationError = error instanceof AssessmentConfigError;
    } catch {
      configurationError = false;
    }
    if (configurationError) throw error;
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: "$",
      message: safeErrorMessage(error),
    });
  }
}

function normalizeContextSnapshotUnchecked(snapshot: ContextSnapshot): ContextSnapshot {
  try {
    assertJsonValue(snapshot);
  } catch (error) {
    const boundary = error instanceof JsonBoundaryError ? error : undefined;
    throw new AssessmentConfigError({
      code: "invalid-context",
      path: boundary?.path ?? "$",
      message: boundary?.message ?? safeErrorMessage(error),
    });
  }
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    throw new AssessmentConfigError({ code: "invalid-context", path: "$", message: "context snapshot must be an object" });
  }
  validateConfigKeys(snapshot as unknown as Record<string, unknown>, ["schema", "asOf", "jurisdiction", "values"], "$", ["schema", "asOf", "values"]);
  if (snapshot.schema !== "koyu-context/1") {
    throw new AssessmentConfigError({ code: "invalid-context", path: "$.schema", message: "expected koyu-context/1" });
  }
  if (!isIsoDate(snapshot.asOf)) {
    throw new AssessmentConfigError({ code: "invalid-context", path: "$.asOf", message: "expected a real YYYY-MM-DD date" });
  }
  if (snapshot.jurisdiction !== undefined) validateJurisdiction({ id: "koyu.context.snapshot", revision: "1" }, snapshot.jurisdiction);
  if (typeof snapshot.values !== "object" || snapshot.values === null || Array.isArray(snapshot.values)) {
    throw new AssessmentConfigError({ code: "invalid-context", path: "$.values", message: "expected an object" });
  }
  for (const key of Object.keys(snapshot.values).sort(codePointCompare)) {
    if (!COMPONENT_ID_PATTERN.test(key)) {
      throw new AssessmentConfigError({ code: "invalid-context", path: `$.values.${key}`, message: "key must be namespaced" });
    }
    validateContextEntry(snapshot.values[key], `$.values.${key}`);
  }
  return immutableCanonical(snapshot) as ContextSnapshot;
}

function validateContextEntry(entry: ContextEntry | undefined, path: string): void {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new AssessmentConfigError({ code: "invalid-context", path, message: "expected a context entry" });
  }
  validateConfigKeys(entry as unknown as Record<string, unknown>, ["value", "source"], path, ["value", "source"]);
  if (!Object.hasOwn(entry, "value")) {
    throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.value`, message: "value is required" });
  }
  const source = entry.source;
  if (!source || typeof source !== "object" || !SOURCE_KINDS.has(source.kind)) {
    throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.source.kind`, message: "invalid provenance kind" });
  }
  validateConfigKeys(
    source as unknown as Record<string, unknown>,
    ["kind", "ref", "observedAt", "retrievedAt"],
    `${path}.source`,
    ["kind", "ref"],
  );
  if (typeof source.ref !== "string" || source.ref.trim() === "") {
    throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.source.ref`, message: "provenance ref is required" });
  }
  for (const field of ["observedAt", "retrievedAt"] as const) {
    const value = source[field];
    if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
      throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.source.${field}`, message: "must be a non-empty string" });
    }
  }
}

function validateConfigKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  required: readonly string[] = [],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== "string") {
      throw new AssessmentConfigError({
        code: "invalid-context",
        path,
        message: "symbol fields are not allowed",
      });
    }
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      throw new AssessmentConfigError({
        code: "invalid-context",
        path: `${path}.${key}`,
        message: "fields must be enumerable data properties",
      });
    }
    if (!allowedSet.has(key)) {
      throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.${key}`, message: "unexpected field" });
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      throw new AssessmentConfigError({ code: "invalid-context", path: `${path}.${key}`, message: "field is required" });
    }
  }
}

class AnalysisSession {
  readonly results: AnalysisResult<JsonValue>[] = [];
  private readonly cache = new Map<string, AnalysisResult<JsonValue>>();

  constructor(
    private readonly model: Model,
    private readonly modelState: "consistent" | "inconsistent",
    private readonly definitions: ReadonlyMap<string, AnalysisDefinition<JsonValue>>,
    private readonly allowed: ReadonlyMap<string, AnalysisRef>,
    private readonly snapshot: ContextSnapshot,
    private readonly usedContext: Set<string>,
  ) {}

  run<T extends JsonValue>(reference: AnalysisRef<T>): AnalysisArtifact<T> {
    const cached = this.cache.get(reference.id);
    if (cached) return cached.artifact as AnalysisArtifact<T>;

    const selected = this.allowed.get(reference.id);
    if (!selected || !sameIdentity(selected, reference)) {
      return this.store(reference, unavailable(
        [{ kind: "analysis", analysis: identityOf(reference), reason: "unavailable" }],
        [{ kind: "dependency-unavailable", message: `analysis is not selected by the profile: ${reference.id}` }],
      )) as AnalysisArtifact<T>;
    }
    const definition = requireResolved(reference, this.definitions, reference, "analysis");

    const dependencyArtifacts = new Map<string, AnalysisArtifact<JsonValue>>();
    const dependencyMissing: MissingInput[] = [];
    for (const requirement of definition.dependencies) {
      const artifact = this.run(requirement.analysis);
      dependencyArtifacts.set(requirement.analysis.id, artifact);
      if (artifact.state === "unavailable" || (artifact.state === "partial" && requirement.accept === "complete")) {
        dependencyMissing.push({
          kind: "analysis",
          analysis: identityOf(requirement.analysis),
          reason: artifact.state === "partial" ? "partial" : "unavailable",
        });
      }
    }
    if (dependencyMissing.length > 0) {
      return this.store(reference, unavailable(dependencyMissing, [{
        kind: "dependency-unavailable",
        message: `one or more dependencies are unavailable for ${reference.id}`,
        missing: dependencyMissing,
      }])) as AnalysisArtifact<T>;
    }

    const context = contextReader(definition.context, this.snapshot, this.usedContext);
    let contextMissing: MissingInput[];
    try {
      contextMissing = requiredContextMissing(definition.context, context);
    } catch (error) {
      return this.store(reference, unavailable([executionMissing(reference, "context decoder failed")], [{
        kind: "execution-error",
        message: safeErrorMessage(error),
      }])) as AnalysisArtifact<T>;
    }
    if (contextMissing.length > 0) {
      return this.store(reference, unavailable(contextMissing, issuesForMissing(contextMissing))) as AnalysisArtifact<T>;
    }
    if (this.modelState === "inconsistent" && definition.model === "consistent") {
      const missing: MissingInput[] = [{ kind: "model", subjects: [{ kind: "model", ref: "/" }], reason: "core diagnostics contain an error" }];
      return this.store(reference, unavailable(missing, [{
        kind: "model-inconsistent",
        message: `${reference.id} requires a structurally consistent model`,
        missing,
      }])) as AnalysisArtifact<T>;
    }

    const declared = new Map(definition.dependencies.map((requirement) => [requirement.analysis.id, requirement.analysis]));
    const get = <U extends JsonValue>(requested: AnalysisRef<U>): AnalysisArtifact<U> => {
      const requirement = declared.get(requested.id);
      if (!requirement || !sameIdentity(requirement, requested)) {
        throw new Error(`undeclared analysis dependency: ${requested.id}@${requested.revision}`);
      }
      return dependencyArtifacts.get(requested.id)! as AnalysisArtifact<U>;
    };

    try {
      const artifact = normalizeArtifact(
        definition.run({ model: this.model as DeepReadonly<Model>, context, get }),
      );
      return this.store(reference, artifact) as AnalysisArtifact<T>;
    } catch (error) {
      return this.store(reference, unavailable([executionMissing(reference, "provider exception or invalid artifact")], [{
        kind: "execution-error",
        message: safeErrorMessage(error),
      }])) as AnalysisArtifact<T>;
    }
  }

  private store(reference: AnalysisRef, artifact: AnalysisArtifact<JsonValue>): AnalysisArtifact<JsonValue> {
    const stableArtifact = immutableCanonical(artifact) as AnalysisArtifact<JsonValue>;
    const result: AnalysisResult<JsonValue> = { analysis: identityOf(reference), artifact: stableArtifact };
    this.cache.set(reference.id, result);
    this.results.push(result);
    return stableArtifact;
  }
}

function executeRule(
  rule: Rule,
  ruleSet: RuleSet,
  session: AnalysisSession,
  prepared: PreparedRun,
): RuleRun {
  const identity = { rule: identityOf(rule), ruleSet: identityOf(ruleSet) };
  const artifacts = new Map<string, AnalysisArtifact<JsonValue>>();
  const missing: MissingInput[] = [];
  const issues: ExecutionIssue[] = [];

  if (prepared.modelState === "inconsistent" && rule.model === "consistent") {
    missing.push({ kind: "model", subjects: [{ kind: "model", ref: "/" }], reason: "core diagnostics contain an error" });
    issues.push({ kind: "model-inconsistent", message: `${rule.id} requires a structurally consistent model` });
  }
  for (const requirement of rule.analyses) {
    const artifact = session.run(requirement.analysis);
    artifacts.set(requirement.analysis.id, artifact);
    if (artifact.state === "unavailable" || (artifact.state === "partial" && requirement.accept === "complete")) {
      missing.push({
        kind: "analysis",
        analysis: identityOf(requirement.analysis),
        reason: artifact.state === "partial" ? "partial" : "unavailable",
      });
      issues.push({ kind: "dependency-unavailable", message: `${requirement.analysis.id} is not usable by ${rule.id}` });
    }
  }

  const context = contextReader(rule.context, prepared.context, prepared.usedContext);
  let missingContext: MissingInput[];
  try {
    missingContext = requiredContextMissing(rule.context, context);
  } catch (error) {
    return {
      ...identity,
      state: "error",
      issues: [{ kind: "execution-error", message: safeErrorMessage(error) }],
    };
  }
  missing.push(...missingContext);
  issues.push(...issuesForMissing(missingContext));
  if (missing.length > 0) {
    const orderedMissing = sortMissing(missing);
    const evaluation: Extract<RuleEvaluation, { applicability: "indeterminate" }> = {
      applicability: "indeterminate",
      reason: "one or more declared inputs are unavailable",
      missing: orderedMissing as [MissingInput, ...MissingInput[]],
      evidence: [],
    };
    return {
      ...identity,
      state: "indeterminate",
      evaluation,
      issues: sortIssues(issues) as [ExecutionIssue, ...ExecutionIssue[]],
    };
  }

  const declared = new Map(rule.analyses.map((requirement) => [requirement.analysis.id, requirement.analysis]));
  const get = <T extends JsonValue>(reference: AnalysisRef<T>): AnalysisArtifact<T> => {
    const requirement = declared.get(reference.id);
    if (!requirement || !sameIdentity(requirement, reference)) {
      throw new Error(`undeclared analysis dependency: ${reference.id}@${reference.revision}`);
    }
    return artifacts.get(reference.id)! as AnalysisArtifact<T>;
  };

  try {
    const evaluation = normalizeEvaluation(rule.evaluate({ context, get }));
    if (evaluation.applicability === "applicable") {
      return { ...identity, state: "evaluated", evaluation, issues: [] };
    }
    if (evaluation.applicability === "not-applicable") {
      return { ...identity, state: "not-applicable", evaluation, issues: [] };
    }
    const indeterminateIssues: [ExecutionIssue, ...ExecutionIssue[]] = [{
      kind: "koyu.rule-indeterminate",
      message: evaluation.reason,
      missing: evaluation.missing,
    }];
    return { ...identity, state: "indeterminate", evaluation, issues: indeterminateIssues };
  } catch (error) {
    return {
      ...identity,
      state: "error",
      issues: [{ kind: "execution-error", message: safeErrorMessage(error) }],
    };
  }
}

function contextReader(
  requirements: readonly ContextRequirement[],
  snapshot: ContextSnapshot,
  used: Set<string>,
): ContextReader {
  const declared = new Map(requirements.map((requirement) => [requirement.key.id, requirement.key]));
  const cache = new Map<string, ContextRead<JsonValue>>();

  return {
    get<T extends JsonValue>(requested: ContextKey<T>): ContextRead<T> {
      const key = declared.get(requested.id);
      if (!key || !sameIdentity(key, requested)) {
        throw new Error(`undeclared context key: ${requested.id}@${requested.revision}`);
      }
      const previous = cache.get(key.id);
      if (previous) return previous as ContextRead<T>;
      used.add(key.id);
      const entry = snapshot.values[key.id];
      if (!entry) {
        const result = { state: "missing" } as const;
        cache.set(key.id, result);
        return result;
      }
      let decoded;
      try {
        decoded = key.decode(entry.value);
      } catch (error) {
        throw new ContextDecoderExecutionError(`${key.id}: ${safeErrorMessage(error)}`);
      }
      if (typeof decoded !== "object" || decoded === null || typeof (decoded as { ok?: unknown }).ok !== "boolean") {
        throw new ContextDecoderExecutionError(`${key.id}: decoder returned a malformed result`);
      }
      if (!decoded.ok) {
        assertDecoderKeys(decoded as unknown as Record<string, unknown>, ["ok", "message"], key.id);
        if (typeof decoded.message !== "string") {
          throw new ContextDecoderExecutionError(`${key.id}: decoder rejection has no message`);
        }
        const result = { state: "invalid", entry, message: decoded.message } as const;
        cache.set(key.id, result);
        return result;
      }
      assertDecoderKeys(decoded as unknown as Record<string, unknown>, ["ok", "value"], key.id);
      try {
        assertJsonValue(decoded.value);
      } catch (error) {
        throw new ContextDecoderExecutionError(`${key.id}: decoder returned non-JSON data (${safeErrorMessage(error)})`);
      }
      const result = { state: "present", value: immutableCanonical(decoded.value) as JsonValue, entry } as const;
      cache.set(key.id, result);
      return result as ContextRead<T>;
    },
  };
}

function assertDecoderKeys(record: Record<string, unknown>, keys: readonly string[], keyId: string): void {
  try {
    assertJsonValue(record);
    assertExactKeys(record, keys, "context decoder result");
    assertRequiredKeys(record, keys, "context decoder result");
  } catch (error) {
    throw new ContextDecoderExecutionError(`${keyId}: ${safeErrorMessage(error)}`);
  }
}

function requiredContextMissing(
  requirements: readonly ContextRequirement[],
  reader: ContextReader,
): MissingInput[] {
  const missing: MissingInput[] = [];
  for (const requirement of requirements) {
    if (requirement.presence !== "required") continue;
    const read = reader.get(requirement.key);
    if (read.state === "missing") {
      missing.push({ kind: "context", key: requirement.key.id, reason: "missing" });
    } else if (read.state === "invalid") {
      missing.push({ kind: "context", key: requirement.key.id, reason: "invalid", message: read.message });
    }
  }
  return missing;
}

function issuesForMissing(missing: readonly MissingInput[]): [ExecutionIssue, ...ExecutionIssue[]] {
  const issues = missing.map<ExecutionIssue>((entry) => ({
    kind: entry.kind === "context" && entry.reason === "invalid" ? "invalid-context" : "missing-context",
    message: missingMessage(entry),
    missing: [entry],
  }));
  return issues as [ExecutionIssue, ...ExecutionIssue[]];
}

function missingMessage(input: MissingInput): string {
  if (input.kind === "context") return `${input.key} is ${input.reason}`;
  if (input.kind === "analysis") return `${input.analysis.id} is ${input.reason}`;
  if (input.kind === "model") return input.reason;
  return `missing ${input.kind}`;
}

function unavailable(
  missing: readonly MissingInput[],
  issues: readonly [ExecutionIssue, ...ExecutionIssue[]],
): AnalysisArtifact<JsonValue> {
  if (missing.length === 0) throw new TypeError("unavailable artifact requires at least one missing input");
  return {
    state: "unavailable",
    missing: sortMissing(missing) as [MissingInput, ...MissingInput[]],
    issues: sortIssues(issues) as [ExecutionIssue, ...ExecutionIssue[]],
  };
}

function executionMissing(component: ComponentIdentity, reason: string): MissingInput {
  return {
    kind: "koyu.execution",
    data: {
      componentId: component.id,
      componentRevision: component.revision,
      reason,
    },
  };
}

function normalizeArtifact(value: unknown): AnalysisArtifact<JsonValue> {
  assertJsonValue(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("analysis artifact must be an object");
  }
  const artifact = value as unknown as Record<string, unknown>;
  if (artifact.state === "complete") {
    assertExactKeys(artifact, ["state", "value", "evidence"], "complete artifact");
    assertRequiredKeys(artifact, ["value", "evidence"], "complete artifact");
    assertJsonValue(artifact.value);
    return {
      state: "complete",
      value: canonicalJsonValue(artifact.value),
      evidence: normalizeEvidenceArray(artifact.evidence),
    };
  }
  if (artifact.state === "partial") {
    assertExactKeys(artifact, ["state", "value", "missing", "evidence"], "partial artifact");
    assertRequiredKeys(artifact, ["value", "missing", "evidence"], "partial artifact");
    assertJsonValue(artifact.value);
    const missing = normalizeMissingArray(artifact.missing);
    if (missing.length === 0) throw new TypeError("partial artifact requires at least one missing input");
    return {
      state: "partial",
      value: canonicalJsonValue(artifact.value),
      missing: missing as [MissingInput, ...MissingInput[]],
      evidence: normalizeEvidenceArray(artifact.evidence),
    };
  }
  if (artifact.state === "unavailable") {
    assertExactKeys(artifact, ["state", "missing", "issues"], "unavailable artifact");
    assertRequiredKeys(artifact, ["missing", "issues"], "unavailable artifact");
    const missing = normalizeMissingArray(artifact.missing);
    if (missing.length === 0) throw new TypeError("unavailable artifact requires at least one missing input");
    const issues = normalizeIssueArray(artifact.issues);
    if (issues.length === 0) throw new TypeError("unavailable artifact requires at least one issue");
    return {
      state: "unavailable",
      missing: missing as [MissingInput, ...MissingInput[]],
      issues: issues as [ExecutionIssue, ...ExecutionIssue[]],
    };
  }
  throw new TypeError("analysis artifact has an invalid state");
}

function normalizeEvaluation(value: unknown): RuleEvaluation {
  assertJsonValue(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("rule evaluation must be an object");
  }
  const evaluation = value as unknown as Record<string, unknown>;
  if (evaluation.applicability === "not-applicable") {
    assertExactKeys(evaluation, ["applicability", "reason", "evidence"], "not-applicable evaluation");
    assertRequiredKeys(evaluation, ["reason", "evidence"], "not-applicable evaluation");
    requireString(evaluation.reason, "not-applicable reason");
    return {
      applicability: "not-applicable",
      reason: evaluation.reason,
      evidence: normalizeEvidenceArray(evaluation.evidence),
    };
  }
  if (evaluation.applicability === "indeterminate") {
    assertExactKeys(evaluation, ["applicability", "reason", "missing", "evidence"], "indeterminate evaluation");
    assertRequiredKeys(evaluation, ["reason", "missing", "evidence"], "indeterminate evaluation");
    requireString(evaluation.reason, "indeterminate reason");
    const missing = normalizeMissingArray(evaluation.missing);
    if (missing.length === 0) throw new TypeError("indeterminate evaluation requires missing input");
    return {
      applicability: "indeterminate",
      reason: evaluation.reason,
      missing: missing as [MissingInput, ...MissingInput[]],
      evidence: normalizeEvidenceArray(evaluation.evidence),
    };
  }
  if (evaluation.applicability === "applicable") {
    assertExactKeys(evaluation, ["applicability", "outcomes"], "applicable evaluation");
    assertRequiredKeys(evaluation, ["outcomes"], "applicable evaluation");
    if (!Array.isArray(evaluation.outcomes) || evaluation.outcomes.length === 0) {
      throw new TypeError("applicable evaluation requires at least one outcome");
    }
    const outcomes = evaluation.outcomes.map(normalizeOutcome);
    assertUniqueIds(outcomes, "rule outcome");
    outcomes.sort((a, b) => codePointCompare(a.id, b.id));
    return { applicability: "applicable", outcomes: outcomes as [RuleOutcome, ...RuleOutcome[]] };
  }
  throw new TypeError("rule evaluation has an invalid applicability");
}

function normalizeOutcome(value: unknown): RuleOutcome {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("rule outcome must be an object");
  }
  const outcome = value as Record<string, unknown>;
  assertExactKeys(outcome, ["id", "status", "subjects", "message", "evidence"], "rule outcome");
  assertRequiredKeys(outcome, ["id", "status", "subjects", "message", "evidence"], "rule outcome");
  requireString(outcome.id, "rule outcome id");
  requireString(outcome.message, "rule outcome message");
  if (typeof outcome.status !== "string" || !OUTCOME_STATUSES.has(outcome.status)) {
    throw new TypeError(`invalid outcome status: ${String(outcome.status)}`);
  }
  if (!Array.isArray(outcome.subjects) || outcome.subjects.length === 0) {
    throw new TypeError("rule outcome requires at least one subject");
  }
  const subjects = normalizeSubjects(outcome.subjects, "rule outcome");
  const evidence = normalizeEvidenceArray(outcome.evidence);
  if (evidence.length === 0) throw new TypeError("rule outcome requires at least one item of evidence");
  return {
    id: outcome.id,
    status: outcome.status as RuleOutcome["status"],
    subjects,
    message: outcome.message,
    evidence: evidence as [Evidence, ...Evidence[]],
  };
}

function normalizeEvidenceArray(value: unknown): Evidence[] {
  if (!Array.isArray(value)) throw new TypeError("evidence must be an array");
  const evidence = value.map(normalizeEvidence);
  assertUniqueIds(evidence, "evidence");
  evidence.sort((a, b) => codePointCompare(a.id, b.id));
  return evidence;
}

function normalizeMissingArray(value: unknown): MissingInput[] {
  if (!Array.isArray(value)) throw new TypeError("missing must be an array");
  return sortMissing(value.map(normalizeMissing));
}

function normalizeIssueArray(value: unknown): ExecutionIssue[] {
  if (!Array.isArray(value)) throw new TypeError("issues must be an array");
  return sortIssues(value.map(normalizeIssue));
}

function normalizeEvidence(value: unknown): Evidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("evidence item must be an object");
  }
  const record = value as Record<string, unknown>;
  requireString(record.id, "evidence id");
  requireString(record.kind, "evidence kind");
  assertExactIdentity(record.producedBy, "evidence producedBy");
  normalizeSubjects(record.subjects, "evidence");
  normalizeSources(record.sources);

  switch (record.kind) {
    case "fact":
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "name", "value"], "fact evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "name", "value"], "fact evidence");
      requireString(record.name, "fact evidence name");
      if (!("value" in record)) throw new TypeError("fact evidence requires value");
      break;
    case "comparison":
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "observed", "operator", "required"], "comparison evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "observed", "operator", "required"], "comparison evidence");
      assertQuantity(record.observed, "comparison observed");
      if (typeof record.operator !== "string" || !COMPARISON_OPERATORS.has(record.operator)) {
        throw new TypeError("comparison evidence has an invalid operator");
      }
      assertRequiredQuantity(record.required);
      break;
    case "route":
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "reachable", "profile", "path", "cost"], "route evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "reachable", "profile", "path"], "route evidence");
      if (typeof record.reachable !== "boolean") throw new TypeError("route reachable must be boolean");
      requireString(record.profile, "route profile");
      if (!Array.isArray(record.path) || !record.path.every((entry) => typeof entry === "string")) {
        throw new TypeError("route path must be a string array");
      }
      if (record.cost !== undefined) assertQuantity(record.cost, "route cost");
      break;
    case "geometry":
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "geometry"], "geometry evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "geometry"], "geometry evidence");
      assertJsonObject(record.geometry, "geometry evidence");
      break;
    case "missing": {
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "missing"], "missing evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "missing"], "missing evidence");
      const missing = normalizeMissingArray(record.missing);
      if (missing.length === 0) throw new TypeError("missing evidence requires at least one missing input");
      break;
    }
    default:
      if (!COMPONENT_ID_PATTERN.test(record.kind) || EVIDENCE_KINDS.has(record.kind)) {
        throw new TypeError(`invalid evidence kind: ${record.kind}`);
      }
      assertExactKeys(record, ["id", "kind", "subjects", "sources", "producedBy", "data"], "extension evidence");
      assertRequiredKeys(record, ["subjects", "sources", "producedBy", "data"], "extension evidence");
      assertJsonObject(record.data, "extension evidence data");
  }
  return canonicalJsonValue(record) as unknown as Evidence;
}

function normalizeSubjects(
  value: unknown,
  label: string,
): [RuleOutcome["subjects"][number], ...RuleOutcome["subjects"][number][]] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${label} requires at least one subject`);
  const subjects = value.map((subject) => {
    if (typeof subject !== "object" || subject === null || Array.isArray(subject)) {
      throw new TypeError("subject must be an object");
    }
    const record = subject as Record<string, unknown>;
    assertExactKeys(record, ["kind", "ref"], "subject");
    assertRequiredKeys(record, ["kind", "ref"], "subject");
    requireString(record.kind, "subject kind");
    requireString(record.ref, "subject ref");
    if (record.kind === "model") {
      if (record.ref !== "/") throw new TypeError("model subject ref must be /");
    } else if (!SUBJECT_KINDS.has(record.kind) && !COMPONENT_ID_PATTERN.test(record.kind)) {
      throw new TypeError(`invalid subject kind: ${record.kind}`);
    }
    return canonicalJsonValue(record) as RuleOutcome["subjects"][number];
  });
  return subjects as [RuleOutcome["subjects"][number], ...RuleOutcome["subjects"][number][]];
}

function normalizeSources(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("evidence requires at least one source");
  for (const source of value) normalizeSource(source);
}

function normalizeSource(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("source must be an object");
  const record = value as Record<string, unknown>;
  requireString(record.kind, "source kind");
  if (record.kind === "model") {
    assertExactKeys(record, ["kind", "subject", "location"], "model source");
    assertRequiredKeys(record, ["subject"], "model source");
    normalizeSubjects([record.subject], "model source");
    if (record.location !== undefined) {
      if (typeof record.location !== "object" || record.location === null || Array.isArray(record.location)) {
        throw new TypeError("source location must be an object");
      }
      const location = record.location as Record<string, unknown>;
      assertExactKeys(location, ["file", "line"], "source location");
      if (location.file !== undefined && typeof location.file !== "string") throw new TypeError("source location file must be a string");
      if (location.line !== undefined && (!Number.isInteger(location.line) || (location.line as number) < 1)) {
        throw new TypeError("source location line must be a positive integer");
      }
    }
    return;
  }
  if (record.kind === "context") {
    assertExactKeys(record, ["kind", "key", "source"], "context source");
    assertRequiredKeys(record, ["key", "source"], "context source");
    if (typeof record.key !== "string" || !COMPONENT_ID_PATTERN.test(record.key)) throw new TypeError("context source key must be namespaced");
    assertContextSource(record.source);
    return;
  }
  if (record.kind === "authority") {
    assertExactKeys(record, ["kind", "citation"], "authority source");
    assertRequiredKeys(record, ["citation"], "authority source");
    assertAuthorityCitation(record.citation);
    return;
  }
  if (!COMPONENT_ID_PATTERN.test(record.kind)) throw new TypeError(`invalid source kind: ${record.kind}`);
  assertExactKeys(record, ["kind", "data"], "extension source");
  assertRequiredKeys(record, ["data"], "extension source");
  assertJsonObject(record.data, "extension source data");
}

function normalizeMissing(value: unknown): MissingInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("missing input must be an object");
  }
  const record = value as Record<string, unknown>;
  requireString(record.kind, "missing input kind");
  if (record.kind === "context") {
    assertExactKeys(record, ["kind", "key", "reason", "message"], "missing context input");
    assertRequiredKeys(record, ["key", "reason"], "missing context input");
    if (typeof record.key !== "string" || !COMPONENT_ID_PATTERN.test(record.key)) throw new TypeError("missing context key must be namespaced");
    if (record.reason !== "missing" && record.reason !== "invalid") throw new TypeError("invalid missing context reason");
    if (record.message !== undefined && typeof record.message !== "string") throw new TypeError("missing context message must be a string");
  } else if (record.kind === "model") {
    assertExactKeys(record, ["kind", "subjects", "reason"], "missing model input");
    assertRequiredKeys(record, ["subjects", "reason"], "missing model input");
    if (!Array.isArray(record.subjects)) throw new TypeError("missing model subjects must be an array");
    if (record.subjects.length > 0) normalizeSubjects(record.subjects, "missing model input");
    requireString(record.reason, "missing model reason");
  } else if (record.kind === "analysis") {
    assertExactKeys(record, ["kind", "analysis", "reason"], "missing analysis input");
    assertRequiredKeys(record, ["analysis", "reason"], "missing analysis input");
    assertExactIdentity(record.analysis, "missing analysis identity");
    if (record.reason !== "partial" && record.reason !== "unavailable") throw new TypeError("invalid missing analysis reason");
  } else {
    if (!COMPONENT_ID_PATTERN.test(record.kind)) throw new TypeError(`invalid missing input kind: ${record.kind}`);
    assertExactKeys(record, ["kind", "data"], "extension missing input");
    assertRequiredKeys(record, ["data"], "extension missing input");
    assertJsonObject(record.data, "extension missing data");
  }
  return canonicalJsonValue(record) as unknown as MissingInput;
}

function normalizeIssue(value: unknown): ExecutionIssue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("issue must be an object");
  const record = value as Record<string, unknown>;
  assertExactKeys(record, ["kind", "message", "subjects", "missing"], "execution issue");
  assertRequiredKeys(record, ["kind", "message"], "execution issue");
  requireString(record.kind, "issue kind");
  requireString(record.message, "issue message");
  if (!ISSUE_KINDS.has(record.kind) && !COMPONENT_ID_PATTERN.test(record.kind)) {
    throw new TypeError(`invalid issue kind: ${record.kind}`);
  }
  if (record.subjects !== undefined) {
    if (!Array.isArray(record.subjects)) throw new TypeError("issue subjects must be an array");
    if (record.subjects.length > 0) normalizeSubjects(record.subjects, "issue");
  }
  if (record.missing !== undefined) normalizeMissingArray(record.missing);
  return canonicalJsonValue(record) as unknown as ExecutionIssue;
}

function assertQuantity(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} must be a quantity`);
  const record = value as Record<string, unknown>;
  assertExactKeys(record, ["value", "unit"], label);
  assertRequiredKeys(record, ["value", "unit"], label);
  if (typeof record.value !== "number" || !Number.isFinite(record.value)) throw new TypeError(`${label} value must be finite`);
  requireString(record.unit, `${label} unit`);
}

function assertRequiredQuantity(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("comparison required must be a quantity or bounds");
  const record = value as Record<string, unknown>;
  if ("value" in record) {
    assertQuantity(value, "comparison required");
    return;
  }
  assertExactKeys(record, ["minimum", "maximum"], "comparison bounds");
  if (record.minimum === undefined && record.maximum === undefined) throw new TypeError("comparison bounds require minimum or maximum");
  if (record.minimum !== undefined) assertQuantity(record.minimum, "comparison minimum");
  if (record.maximum !== undefined) assertQuantity(record.maximum, "comparison maximum");
}

function assertJsonObject(value: unknown, label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${label} must be a JSON object`);
  assertJsonValue(value);
}

function assertContextSource(value: unknown): asserts value is ContextSource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("context source must be an object");
  const source = value as Record<string, unknown>;
  assertExactKeys(source, ["kind", "ref", "observedAt", "retrievedAt"], "context source provenance");
  assertRequiredKeys(source, ["kind", "ref"], "context source provenance");
  if (typeof source.kind !== "string" || !SOURCE_KINDS.has(source.kind)) throw new TypeError("invalid context source kind");
  requireString(source.ref, "context source ref");
  if (source.observedAt !== undefined && typeof source.observedAt !== "string") throw new TypeError("observedAt must be a string");
  if (source.retrievedAt !== undefined && typeof source.retrievedAt !== "string") throw new TypeError("retrievedAt must be a string");
}

function assertAuthorityCitation(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("authority citation must be an object");
  const citation = value as Record<string, unknown>;
  assertExactKeys(citation, ["jurisdiction", "instrument", "provision", "uri", "effective"], "authority citation");
  assertRequiredKeys(citation, ["jurisdiction", "instrument"], "authority citation");
  assertJurisdiction(citation.jurisdiction);
  requireString(citation.instrument, "authority instrument");
  if (citation.provision !== undefined && typeof citation.provision !== "string") throw new TypeError("authority provision must be a string");
  if (citation.uri !== undefined && typeof citation.uri !== "string") throw new TypeError("authority uri must be a string");
  if (citation.effective !== undefined) assertEffective(citation.effective);
}

function assertJurisdiction(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("jurisdiction must be an object");
  const jurisdiction = value as Record<string, unknown>;
  assertExactKeys(jurisdiction, ["country", "region", "locality", "authority"], "jurisdiction");
  assertRequiredKeys(jurisdiction, ["country"], "jurisdiction");
  requireString(jurisdiction.country, "jurisdiction country");
  for (const field of ["region", "locality", "authority"] as const) {
    if (jurisdiction[field] !== undefined && typeof jurisdiction[field] !== "string") {
      throw new TypeError(`jurisdiction ${field} must be a string`);
    }
  }
}

function assertEffective(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("effective range must be an object");
  const effective = value as Record<string, unknown>;
  assertExactKeys(effective, ["from", "to"], "effective range");
  assertRequiredKeys(effective, ["from"], "effective range");
  if (typeof effective.from !== "string" || !isIsoDate(effective.from)) throw new TypeError("effective from must be a date");
  if (effective.to !== undefined && (typeof effective.to !== "string" || !isIsoDate(effective.to))) throw new TypeError("effective to must be a date");
  if (typeof effective.to === "string" && effective.from > effective.to) throw new TypeError("effective range is reversed");
}

function sortMissing(missing: readonly MissingInput[]): MissingInput[] {
  return [...missing].sort((a, b) => codePointCompare(stableString(a), stableString(b)));
}

function sortIssues(issues: readonly ExecutionIssue[]): ExecutionIssue[] {
  return [...issues].sort((a, b) => codePointCompare(stableString(a), stableString(b)));
}

function stableString(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function assertUniqueIds(items: readonly { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new TypeError(`duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

function assertExactIdentity(value: unknown, label: string): asserts value is ComponentIdentity {
  if (!isComponentIdentity(value)) throw new TypeError(`${label} is invalid`);
  assertExactKeys(value as unknown as Record<string, unknown>, ["id", "revision"], label);
  assertRequiredKeys(value as unknown as Record<string, unknown>, ["id", "revision"], label);
}

function assertExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) throw new TypeError(`${label} has an unexpected field: ${key}`);
  }
}

function assertRequiredKeys(record: Record<string, unknown>, required: readonly string[], label: string): void {
  for (const key of required) {
    if (!Object.hasOwn(record, key)) throw new TypeError(`${label} is missing field: ${key}`);
  }
}

function requireString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`);
}

function summarize(modelState: "consistent" | "inconsistent", runs: readonly RuleRun[]): AssessmentSummary {
  const rules = { evaluated: 0, notApplicable: 0, indeterminate: 0, error: 0 };
  const outcomes = { pass: 0, fail: 0, indeterminate: 0 };
  for (const run of runs) {
    if (run.state === "evaluated") {
      rules.evaluated++;
      for (const outcome of run.evaluation.outcomes) outcomes[outcome.status]++;
    } else if (run.state === "not-applicable") {
      rules.notApplicable++;
    } else if (run.state === "indeterminate") {
      rules.indeterminate++;
    } else {
      rules.error++;
    }
  }
  const incomplete = modelState === "inconsistent"
    || rules.indeterminate > 0
    || rules.error > 0
    || outcomes.indeterminate > 0;
  return { state: incomplete ? "incomplete" : "complete", rules, outcomes };
}

function modelReport(
  model: Model,
  state: "consistent" | "inconsistent",
  diagnostics: readonly Diagnostic[],
): AnalysisReport["model"] {
  return {
    languageVersion: model.version,
    ...(model.name !== undefined ? { name: model.name } : {}),
    state,
    diagnostics: diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
      ...(diagnostic.file !== undefined ? { file: diagnostic.file } : {}),
      ...(diagnostic.path !== undefined ? { path: [...diagnostic.path] } : {}),
      ...(diagnostic.related !== undefined
        ? { related: diagnostic.related.map((item) => ({ ...item })) }
        : {}),
    })),
  };
}

function contextTrace(snapshot: ContextSnapshot, used: ReadonlySet<string>): ContextSnapshot {
  const values: Record<string, ContextEntry> = {};
  for (const key of [...used].sort(codePointCompare)) {
    const entry = snapshot.values[key];
    if (entry) values[key] = entry;
  }
  return {
    schema: "koyu-context/1",
    asOf: snapshot.asOf,
    ...(snapshot.jurisdiction ? { jurisdiction: snapshot.jurisdiction } : {}),
    values,
  };
}

function identityOf(identity: ComponentIdentity): ComponentIdentity {
  return { id: identity.id, revision: identity.revision };
}

function refMap(references: readonly AnalysisRef[]): Map<string, AnalysisRef> {
  return new Map(references.map((reference) => [reference.id, reference]));
}

function safeErrorMessage(error: unknown): string {
  try {
    if (error instanceof Error) {
      const name = typeof error.name === "string" && error.name !== "" ? error.name : "Error";
      const message = typeof error.message === "string" ? error.message : "";
      return message === "" ? name : `${name}: ${message}`;
    }
  } catch {
    return "Error inspection failed";
  }
  return "Non-Error thrown";
}

function immutableCanonical(value: unknown): unknown {
  return deepFreeze(canonicalJsonValue(value));
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return Object.freeze(value);
}

function copyAnalysisDefinition(definition: AnalysisDefinition<JsonValue>): AnalysisDefinition<JsonValue> {
  return Object.freeze({
    id: definition.id,
    revision: definition.revision,
    title: definition.title,
    model: definition.model,
    dependencies: Object.freeze(snapshotMap(definition.dependencies, copyAnalysisRequirement)),
    context: Object.freeze(snapshotMap(definition.context, copyContextRequirement)),
    run: definition.run,
  });
}

function copyAnalysisRequirement(requirement: AnalysisRequirement): AnalysisRequirement {
  return Object.freeze({
    analysis: Object.freeze(identityOf(requirement.analysis)),
    accept: requirement.accept,
  });
}

function copyContextRequirement(requirement: ContextRequirement): ContextRequirement {
  return Object.freeze({
    key: Object.freeze({
      id: requirement.key.id,
      revision: requirement.key.revision,
      description: requirement.key.description,
      decode: requirement.key.decode,
    }),
    presence: requirement.presence,
  });
}

function copyRule(rule: Rule): Rule {
  return Object.freeze({
    id: rule.id,
    revision: rule.revision,
    title: rule.title,
    level: rule.level,
    model: rule.model,
    analyses: Object.freeze(snapshotMap(rule.analyses, copyAnalysisRequirement)),
    context: Object.freeze(snapshotMap(rule.context, copyContextRequirement)),
    authority: Object.freeze(snapshotMap(rule.authority, copyAuthorityCitation)),
    evaluate: rule.evaluate,
  });
}

function copyRuleSet(ruleSet: RuleSet): RuleSet {
  return Object.freeze({
    id: ruleSet.id,
    revision: ruleSet.revision,
    title: ruleSet.title,
    purpose: ruleSet.purpose,
    ...(ruleSet.jurisdiction !== undefined ? { jurisdiction: copyRecordLike(ruleSet.jurisdiction) } : {}),
    ...(ruleSet.effective !== undefined ? { effective: copyRecordLike(ruleSet.effective) } : {}),
    rules: Object.freeze(snapshotMap(ruleSet.rules, copyRule)),
  });
}

function copyProfile(profile: Profile): Profile {
  return Object.freeze({
    id: profile.id,
    revision: profile.revision,
    title: profile.title,
    ...(profile.jurisdiction !== undefined ? { jurisdiction: copyRecordLike(profile.jurisdiction) } : {}),
    ...(profile.effective !== undefined ? { effective: copyRecordLike(profile.effective) } : {}),
    analyses: Object.freeze(snapshotMap(profile.analyses, (reference) => Object.freeze(identityOf(reference)))),
    ruleSets: Object.freeze(snapshotMap(profile.ruleSets, (reference) => Object.freeze(identityOf(reference)))),
  });
}

function copyAuthorityCitation(citation: Rule["authority"][number]): Rule["authority"][number] {
  const copied = {
    ...citation,
    ...(Object.hasOwn(citation, "jurisdiction") ? { jurisdiction: copyRecordLike(citation.jurisdiction) } : {}),
    ...(Object.hasOwn(citation, "effective") ? { effective: copyRecordLike(citation.effective) } : {}),
  };
  return deepFreeze(copied);
}

function copyRecordLike<T>(value: T): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  return immutableCanonical(value) as T;
}

function snapshotMap<T, U>(items: readonly T[], mapper: (item: T) => U): U[] {
  if (!Array.isArray(items)) throw new TypeError("protocol collection must be an array");
  const length = items.length;
  if (!Number.isSafeInteger(length) || length < 0) throw new TypeError("protocol collection length is invalid");
  const out: U[] = [];
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(items, index)) throw new TypeError("protocol collections must not be sparse");
    out.push(mapper(items[index]!));
  }
  return out;
}
