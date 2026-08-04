# Assessment protocol design

Date: 2026-08-03
Status: design review; no implementation has landed

## The decision this review prepares

koyu needs an extension surface on which independent analyses and architectural rules can meet the
same composed model without making those rules part of core. The surface must support a Japanese
early-code screen, a company rule pack, and a one-off project rule without any of them modifying the
language, importing a private implementation helper, or teaching the CLI and MCP three different
versions of the same calculation.

This review proposes the exact protocol. It does not decide which built-in rules should ship, and it
does not change the three domains:

```text
core (frozen) ──one way──> validation (unfrozen) ──> presentation / adapters
                            ├─ analyses
                            ├─ rules and rule sets
                            └─ assessment engine
```

An analysis computes facts and never passes judgement. A rule reads named analysis artefacts and an
explicit context snapshot, then returns an evaluation. A profile pins the exact analyses and rule
sets that make one assessment. The TypeScript API, CLI and MCP all expose the same JSON value emitted
by one operation layer.

## Non-negotiable properties

1. Core imports neither this protocol nor any rule.
2. Rules do not receive `Model`; only analysis providers do.
3. An absent finding is never enough to claim pass.
4. `not-applicable`, `indeterminate`, and `pass` are different states.
5. A jurisdiction and an effective date are never inferred from the machine clock, a path, or a room
   type.
6. Registration is explicit and local to a call. There is no process-global registry.
7. Duplicate identifiers, missing references, and dependency cycles fail before evaluation starts.
8. Missing project information is an assessment result, not a thrown programming error.
9. Provider exceptions are reported as execution failures; they do not become pass and do not stop
   MCP from answering.
10. Every report is JSON-safe and deterministic without a transport-specific rewrite.
11. Evaluation performs no file access, network access, dynamic import, or current-time lookup.
12. The main package retains zero runtime dependencies.

## Common value types

Only JSON values may cross the analysis, rule, report, CLI, or MCP boundary. `undefined`, `Map`,
`Set`, `Date`, functions, symbols, `NaN`, and infinities are rejected by the engine's boundary
validator.

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ComponentIdentity {
  id: string;
  revision: string;
}

export interface JurisdictionRef {
  country: string;
  region?: string;
  locality?: string;
  authority?: string;
}

export interface EffectiveRange {
  from: string; // YYYY-MM-DD
  to?: string;  // inclusive, YYYY-MM-DD
}
```

`id` uses a lowercase, dot-separated namespace:

```text
koyu.analysis.opening-exposure
koyu.schematic.access.unreachable
jp.bsl.article-43.frontage
acme.office.corridor-width
```

The runtime pattern is:

```text
^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$
```

An `id` names the continuing concept. `revision` names the exact executable meaning of that concept.
One registry may contain only one revision of an `id`; selecting between revisions belongs outside a
single run. A report always records both.

Dates are ISO calendar dates, not timestamps. The engine validates their spelling and compares them
as calendar dates. It never supplies today's date.

## Subjects and provenance

Every outcome and every piece of evidence points to stable subjects rather than embedding mutable
model objects.

```ts
export type SubjectRef =
  | { kind: "model"; ref: "/" }
  | { kind: "level"; ref: string }
  | { kind: "space"; ref: string }
  | { kind: "zone"; ref: string }
  | { kind: "boundary"; ref: string }
  | { kind: "opening"; ref: string }
  | { kind: "run"; ref: string }
  | { kind: "site"; ref: string }
  | { kind: `${string}.${string}`; ref: string };

export interface SourceLocation {
  file?: string;
  line?: number;
}

export type SourceRef =
  | { kind: "model"; subject: SubjectRef; location?: SourceLocation }
  | { kind: "context"; key: string; source: ContextSource }
  | { kind: "authority"; citation: AuthorityCitation }
  | { kind: `${string}.${string}`; data: JsonObject };

export interface ContextSource {
  kind: "authority" | "survey" | "brief" | "user" | "import" | "other";
  ref: string;
  observedAt?: string;
  retrievedAt?: string;
}

export interface AuthorityCitation {
  jurisdiction: JurisdictionRef;
  instrument: string;
  provision?: string;
  uri?: string;
  effective?: EffectiveRange;
}
```

An opening and boundary use the identities already derived by core. An external analysis may add a
namespaced subject kind, but built-in kinds have the shapes above. One outcome may concern several
subjects; a collision, for example, names both the opening and the column-derived subject.

## Quantities and evidence

Machines must not recover the reason for a result by parsing an English message. Numeric values are
tagged with units and comparisons carry both sides.

```ts
export interface Quantity {
  value: number; // finite
  unit: string;  // mm, m2, ratio, percent, count, degree, or a namespaced unit
}

interface EvidenceBase {
  id: string; // unique within its containing artefact or outcome
  subjects: [SubjectRef, ...SubjectRef[]];
  sources: [SourceRef, ...SourceRef[]];
  producedBy: ComponentIdentity;
}

export type Evidence =
  | (EvidenceBase & {
      kind: "fact";
      name: string;
      value: JsonValue | Quantity;
    })
  | (EvidenceBase & {
      kind: "comparison";
      observed: Quantity;
      operator: "<" | "<=" | "=" | ">=" | ">" | "inside" | "outside";
      required: Quantity | { minimum?: Quantity; maximum?: Quantity };
    })
  | (EvidenceBase & {
      kind: "route";
      reachable: boolean;
      profile: string;
      path: string[];
      cost?: Quantity;
    })
  | (EvidenceBase & {
      kind: "geometry";
      geometry: JsonObject;
    })
  | (EvidenceBase & {
      kind: "missing";
      missing: [MissingInput, ...MissingInput[]];
    })
  | (EvidenceBase & {
      kind: `${string}.${string}`;
      data: JsonObject;
    });
```

Built-in evidence kinds have stable data shapes. Extensions use a namespaced kind and JSON object;
they cannot overload a built-in spelling. Evidence IDs are not global identities. They provide a
stable ordering and a target for a UI within one outcome.

## ContextSnapshot

External facts do not become new core vocabulary. A caller supplies them as a complete, dated and
provenanced snapshot.

```ts
export interface ContextEntry {
  value: JsonValue;
  source: ContextSource;
}

export interface ContextSnapshot {
  schema: "koyu-context/1";
  asOf: string; // required YYYY-MM-DD
  jurisdiction?: JurisdictionRef;
  values: Record<string, ContextEntry>;
}

export type ContextDecode<T extends JsonValue> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export interface ContextKey<T extends JsonValue> extends ComponentIdentity {
  description: string;
  decode(value: JsonValue): ContextDecode<T>;
}

export interface ContextRequirement<T extends JsonValue = JsonValue> {
  key: ContextKey<T>;
  presence: "required" | "optional";
}

export type ContextRead<T extends JsonValue> =
  | { state: "present"; value: T; entry: ContextEntry }
  | { state: "missing" }
  | { state: "invalid"; entry: ContextEntry; message: string };

export interface ContextReader {
  get<T extends JsonValue>(key: ContextKey<T>): ContextRead<T>;
}
```

The key itself validates a value without a schema library. `decode` must be pure. An entry with an
invalid value is project input that could not be interpreted: it produces `invalid`, not a thrown
configuration exception. A malformed key definition, duplicate key identity, invalid date, or
non-JSON snapshot is a configuration error and prevents a run from starting.

The input snapshot may contain more values than a profile uses. The report contains only entries
actually required or read, sorted by key. This makes the report reproducible without echoing
unrelated or sensitive context.

## MissingInput and execution issues

Missingness has a first-class vocabulary shared by analyses and rules.

```ts
export type MissingInput =
  | { kind: "context"; key: string; reason: "missing" | "invalid"; message?: string }
  | { kind: "model"; subjects: SubjectRef[]; reason: string }
  | { kind: "analysis"; analysis: ComponentIdentity; reason: "partial" | "unavailable" }
  | { kind: `${string}.${string}`; data: JsonObject };

export interface ExecutionIssue {
  kind:
    | "model-inconsistent"
    | "dependency-unavailable"
    | "missing-context"
    | "invalid-context"
    | "execution-error"
    | `${string}.${string}`;
  message: string;
  subjects?: SubjectRef[];
  missing?: MissingInput[];
}
```

An `ExecutionIssue` is not a core `Diagnostic` and does not carry `code` or `severity`. It is also not
an architectural finding. It describes why an assessment computation could not finish.

## AnalysisArtifact

An analysis returns one discriminated union. It never returns `undefined` to mean several things.

```ts
export type AnalysisArtifact<T extends JsonValue> =
  | {
      state: "complete";
      value: T;
      evidence: Evidence[];
    }
  | {
      state: "partial";
      value: T;
      missing: [MissingInput, ...MissingInput[]];
      evidence: Evidence[];
    }
  | {
      state: "unavailable";
      missing: MissingInput[];
      issues: [ExecutionIssue, ...ExecutionIssue[]];
    };

export interface AnalysisRef<T extends JsonValue = JsonValue> extends ComponentIdentity {
  readonly __output?: T; // compile-time phantom; never serialized
}

export interface AnalysisRequirement<T extends JsonValue = JsonValue> {
  analysis: AnalysisRef<T>;
  accept: "complete" | "partial";
}
```

`complete` means the analysis has all inputs required by its own declared contract. It does not mean
the building passes a rule. `partial` carries a useful lower bound or subset and says exactly what is
missing. `unavailable` carries no value and at least one issue. Its `missing` array is non-empty when
input absence caused the state, but may be empty when provider execution alone failed. Empty `missing`
arrays are invalid only on `partial`.

## Analysis definitions and Model access

Only analysis providers receive the composed model. The public type is deeply read-only.

```ts
export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> :
  T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

export interface AnalysisRunContext {
  model: DeepReadonly<Model>;
  context: ContextReader;
  get<T extends JsonValue>(analysis: AnalysisRef<T>): AnalysisArtifact<T>;
}

export interface AnalysisDefinition<T extends JsonValue> extends AnalysisRef<T> {
  title: string;
  model: "consistent" | "any";
  dependencies: AnalysisRequirement[];
  context: ContextRequirement[];
  run(ctx: AnalysisRunContext): AnalysisArtifact<T>;
}

export interface AnalysisResult<T extends JsonValue> {
  analysis: ComponentIdentity;
  artifact: AnalysisArtifact<T>;
}

export const ANALYSIS_FORMAT = "koyu-analysis/1" as const;

export interface AnalysisReport<T extends JsonValue> {
  schema: typeof ANALYSIS_FORMAT;
  model: {
    languageVersion: string;
    name?: string;
    state: "consistent" | "inconsistent";
    diagnostics: Diagnostic[];
  };
  context: ContextSnapshot;
  result: AnalysisResult<T>;
}
```

`model` is mandatory, not a default. `consistent` means any core diagnostic of severity `error`
prevents the provider from running. `any` is an explicit claim that the provider can make sense of a
structurally inconsistent model. Core warnings do not block either mode.

The runtime passes the same model instance behind a read-only type; providers must not mutate it.
Development tests take before-and-after canonical snapshots around every built-in provider to detect
mutation. Runtime deep-freezing `Map` is not treated as a security boundary.

Analysis `run` is synchronous. Data acquisition occurs before the call and is represented in the
snapshot. A later need for expensive worker execution can wrap this synchronous operation outside
the protocol without allowing rule results to depend on network timing.

## Rules

A rule cannot inspect a model, invoke an undeclared analysis, or read an undeclared context key.

```ts
export type OutcomeStatus = "pass" | "fail" | "indeterminate";
export type FindingLevel = "violation" | "caution";

export interface RuleOutcome {
  id: string; // unique within this rule run
  status: OutcomeStatus;
  subjects: [SubjectRef, ...SubjectRef[]];
  message: string;
  evidence: [Evidence, ...Evidence[]];
}

export type RuleEvaluation =
  | {
      applicability: "not-applicable";
      reason: string;
      evidence: Evidence[];
    }
  | {
      applicability: "indeterminate";
      reason: string;
      missing: [MissingInput, ...MissingInput[]];
      evidence: Evidence[];
    }
  | {
      applicability: "applicable";
      outcomes: [RuleOutcome, ...RuleOutcome[]];
    };

export interface RuleRunContext {
  context: ContextReader;
  get<T extends JsonValue>(analysis: AnalysisRef<T>): AnalysisArtifact<T>;
}

export interface Rule extends ComponentIdentity {
  title: string;
  level: FindingLevel;
  model: "consistent" | "any";
  analyses: AnalysisRequirement[];
  context: ContextRequirement[];
  authority: AuthorityCitation[];
  evaluate(ctx: RuleRunContext): RuleEvaluation;
}
```

`level` remains an invariant property of a rule. If two circumstances warrant different weights,
they are two rule IDs. `status` is separate: the same rule may pass one subject and fail another.

An applicable rule returns at least one outcome. An empty population is `not-applicable`, never an
empty applicable result. A rule may deliberately accept a partial analysis and return a fail for a
known subject plus an indeterminate outcome for missing subjects. If its requirement says
`accept: "complete"`, the engine does not call it with a partial artefact.

Rule outcome IDs and evidence IDs must be unique within their parent. The engine validates and sorts
them; messages do not participate in identity.

## RuleSet and Profile

A rule set groups rules for one purpose. A profile composes exact rule-set versions and the analysis
implementations needed to run them.

```ts
export type RuleSetPurpose =
  | "design-lint"
  | "operational-review"
  | "code-screening"
  | "compliance";

export interface RuleSetRef extends ComponentIdentity {}

export interface RuleSet extends RuleSetRef {
  title: string;
  purpose: RuleSetPurpose;
  jurisdiction?: JurisdictionRef;
  effective?: EffectiveRange;
  rules: Rule[];
}

export interface ProfileRef extends ComponentIdentity {}

export interface Profile extends ProfileRef {
  title: string;
  jurisdiction?: JurisdictionRef;
  effective?: EffectiveRange;
  analyses: AnalysisRef[];
  ruleSets: RuleSetRef[];
}

export interface AssessmentRegistry {
  analyses: readonly AnalysisDefinition<JsonValue>[];
  ruleSets: readonly RuleSet[];
  profiles: readonly Profile[];
}

export function createAssessmentRegistry(input: {
  analyses: readonly AnalysisDefinition<JsonValue>[];
  ruleSets: readonly RuleSet[];
  profiles: readonly Profile[];
}): AssessmentRegistry;
```

Array order is semantic execution order. A profile does not automatically inherit national,
regional, local, or company rule sets. The author lists the exact sequence. There is no last-wins
override. If two selected rule sets contain the same rule ID, registry resolution fails. A local
exception is represented by an explicitly different rule set/profile composition, not by mutating a
registered rule.

Rule constants that define a rule's meaning live in the rule implementation and are reported as
evidence. Project-specific facts and authority-supplied variable limits live in context. Profiles do
not smuggle unproven project facts in as unlabelled defaults.

`ContextSnapshot.asOf` must fall inside the selected profile and every selected rule set's effective
range. A mismatch is a configuration error, not `not-applicable`: the caller selected a version that
does not claim to apply on that date.

If a profile declares `jurisdiction`, the snapshot must declare the exact same jurisdiction. Exact
means the same explicitly present `country`, `region`, `locality`, and `authority` fields; omission is
not a wildcard. Every selected rule set that declares a jurisdiction must also equal the profile's
jurisdiction. A missing or unequal value is `jurisdiction-mismatch` before execution. A profile with no
jurisdiction may accept a snapshot that has one, but that does not make a jurisdiction-free rule set
claim statutory applicability.

## AssessmentReport

The complete report, not a flattened finding array, is the machine contract.

```ts
export const ASSESSMENT_FORMAT = "koyu-assessment/1" as const;

interface RuleRunBase {
  rule: ComponentIdentity;
  ruleSet: ComponentIdentity;
}

export type RuleRun =
  | (RuleRunBase & {
      state: "evaluated";
      evaluation: Extract<RuleEvaluation, { applicability: "applicable" }>;
      issues: [];
    })
  | (RuleRunBase & {
      state: "not-applicable";
      evaluation: Extract<RuleEvaluation, { applicability: "not-applicable" }>;
      issues: [];
    })
  | (RuleRunBase & {
      state: "indeterminate";
      evaluation: Extract<RuleEvaluation, { applicability: "indeterminate" }>;
      issues: [ExecutionIssue, ...ExecutionIssue[]];
    })
  | (RuleRunBase & {
      state: "error";
      issues: [ExecutionIssue, ...ExecutionIssue[]];
    });

export interface AssessmentFinding {
  rule: ComponentIdentity;
  ruleSet: ComponentIdentity;
  level: FindingLevel;
  outcome: RuleOutcome & { status: "fail" };
}

export interface AssessmentSummary {
  state: "complete" | "incomplete";
  rules: {
    evaluated: number;
    notApplicable: number;
    indeterminate: number;
    error: number;
  };
  outcomes: {
    pass: number;
    fail: number;
    indeterminate: number;
  };
}

export interface AssessmentReport {
  schema: typeof ASSESSMENT_FORMAT;
  profile: ComponentIdentity;
  ruleSets: ComponentIdentity[];
  model: {
    languageVersion: string;
    name?: string;
    state: "consistent" | "inconsistent";
    diagnostics: Diagnostic[];
  };
  context: ContextSnapshot;
  analyses: AnalysisResult<JsonValue>[];
  rules: RuleRun[];
  findings: AssessmentFinding[];
  summary: AssessmentSummary;
}
```

There is deliberately no `ok` boolean. `summary.state: "complete"` says the selected assessment ran
to completion; it does not say all rules passed. A consumer that gates a build chooses its policy
from `outcomes.fail`, `outcomes.indeterminate`, model consistency, and levels.

`findings` is a deterministic convenience projection of failed outcomes only. It is not the source
of truth, and it cannot distinguish all run states by itself. Indeterminate outcomes and rule runs
remain in `rules` and the summary.

The report's `context` contains the input header plus only the context entries used by a selected
analysis or rule. Its keys are written in deterministic order. Model diagnostics stay core
diagnostics with `code` and `severity`; execution issues and architectural outcomes retain their
different field names.

## Public operations

```ts
export type ComponentKind = "analysis" | "rule-set" | "profile" | "rule" | "context-key";

export type AssessmentConfigProblem =
  | { code: "duplicate-id"; kind: ComponentKind; id: string }
  | { code: "invalid-id"; kind: ComponentKind; id: string }
  | {
      code: "missing-reference";
      owner: ComponentIdentity;
      targetKind: ComponentKind;
      target: ComponentIdentity;
    }
  | {
      code: "revision-mismatch";
      owner: ComponentIdentity;
      targetKind: ComponentKind;
      id: string;
      expected: string;
      actual: string;
    }
  | {
      code: "dependency-cycle";
      path: [ComponentIdentity, ComponentIdentity, ...ComponentIdentity[]];
    }
  | { code: "invalid-context"; path: string; message: string }
  | {
      code: "effective-date-mismatch";
      owner: ComponentIdentity;
      asOf: string;
      effective: EffectiveRange;
    }
  | {
      code: "jurisdiction-mismatch";
      owner: ComponentIdentity;
      expected?: JurisdictionRef;
      actual?: JurisdictionRef;
    };

export class AssessmentConfigError extends Error {
  readonly problem: AssessmentConfigProblem;
  readonly code: AssessmentConfigProblem["code"];
}

export interface AssessmentOptions {
  registry: AssessmentRegistry;
  profile: ProfileRef | string;
  context: ContextSnapshot;
}

export function assess(model: Model, options: AssessmentOptions): AssessmentReport;

export interface RunAnalysisOptions {
  registry: AssessmentRegistry;
  context: ContextSnapshot;
}

export function runAnalysis<T extends JsonValue>(
  model: Model,
  analysis: AnalysisRef<T>,
  options: RunAnalysisOptions,
): AnalysisReport<T>;
```

`profile` as a string means an exact ID in a registry that contains only one revision of each ID. A
`ProfileRef` additionally asserts the expected revision. Missing or mismatched revisions throw
`AssessmentConfigError` before work starts.

The machine report always retains every outcome. A human presenter may hide passing rows, but neither
the direct API DTO nor CLI JSON nor MCP `structuredContent` has a verbosity-dependent shape.

## Registry validation algorithm

`createAssessmentRegistry` performs all static validation and returns frozen top-level arrays.

1. Validate every component ID and non-empty revision.
2. Build three maps by ID: analysis, rule set, and profile. A duplicate ID is an error even when the
   revisions differ.
3. Within each rule set, reject duplicate rule IDs. Across all rule sets duplicates may exist until a
   profile selects both; profile resolution then rejects the ambiguity.
4. Resolve every analysis dependency by exact ID and revision.
5. Run a three-colour depth-first search over the complete analysis graph. Encountering a grey node
   throws `dependency-cycle` with the complete cycle path.
6. Resolve each profile's analysis and rule-set references by exact ID and revision.
7. Resolve every selected rule's analysis references. The reference must also be reachable from the
   profile's explicitly listed analyses; profiles cannot gain hidden providers from rule code.
8. Collect context-key definitions by ID. Reusing the same ID/revision and decoder object is allowed;
   a different revision or decoder under the same ID is `duplicate-id`.
9. Reject duplicate rule IDs in each fully resolved profile.
10. For a jurisdictional profile, reject a selected jurisdictional rule set whose jurisdiction is not
    exactly equal. A jurisdiction-free profile cannot select a jurisdictional rule set.
11. Validate all effective date ranges.

There is no partial registry. Any error prevents construction, so a call can never run with the
first of two duplicate definitions.

## Analysis execution algorithm

`runAnalysis` and `assess` use the same per-call `AnalysisSession`.

1. Validate the context snapshot as JSON and validate its date and entry sources.
2. Run `checkDiagnostics(model)` exactly once. Preserve its scan order.
3. Create an empty result cache keyed by analysis ID. There is no cache shared across calls or models.
4. Resolve the requested analysis by exact identity.
5. Evaluate dependencies depth-first in the definition's declared order.
6. If a required dependency is unavailable, or is partial while the requirement accepts only
   complete, do not call the provider. Store an unavailable artefact with
   `dependency-unavailable` and a reference to that dependency.
7. Read and decode declared context keys. A missing or invalid required key prevents the provider
   call and yields unavailable. Optional keys remain readable as `missing` or `invalid`.
8. If the model has an error diagnostic and the definition says `model: "consistent"`, do not call
   it. Store unavailable with `model-inconsistent` and the relevant diagnostics remain in the report.
9. Invoke `run` once. Catch an exception and turn it into unavailable with `execution-error`. Record
   only the error name and message, never a stack or arbitrary thrown object.
10. Validate the returned discriminant, JSON value, finite numbers, required missing list, evidence
    IDs, and provenance. An invalid provider result becomes `execution-error`.
11. Sort evidence by ID with code-point comparison and place the result in the cache.

Subsequent dependency reads return the exact cached artefact. Providers cannot request undeclared
dependencies: `ctx.get` rejects them as a provider execution error.

For `assess`, the `analyses` array contains only analyses reached by selected rules, in dependency
post-order; dependencies appear before consumers. Siblings follow declaration order. An analysis
selected by several rules appears once.

## Rule execution algorithm

1. Resolve the profile and validate `ContextSnapshot.asOf` against the profile and selected rule sets.
   Validate the snapshot jurisdiction against a jurisdictional profile by exact field equality.
2. Flatten rule sets in profile order and rules in rule-set declaration order. Validate that rule IDs
   are unique across the flattened sequence.
3. Evaluate the analyses reachable from those rules through the shared session.
4. For each rule, check model consistency, analysis acceptance, and required context before invoking
   `evaluate`.
5. A failed precondition produces a rule run with `state: "indeterminate"`, explicit missing inputs,
   and no call to rule code.
6. Invoke `evaluate`. Catch exceptions as `state: "error"`; never synthesize an architectural fail or
   pass from a programming error.
7. Validate the evaluation. Applicable results require at least one outcome. Outcome IDs are unique.
   Every fail carries evidence. Every indeterminate result identifies missing or uncertain input.
8. Sort outcomes by outcome ID and each outcome's evidence by evidence ID using code-point order.
9. Map applicability to `RuleRun.state`. Flatten fail outcomes into `findings` in rule-run order, then
   outcome-ID order.
10. Count every state and outcome. Mark the report incomplete if the model is inconsistent, a rule is
    indeterminate, an outcome is indeterminate, or a provider/rule execution error occurred.

A `not-applicable` rule does not make the report incomplete. A `fail` does not make the report
incomplete either: it is a completed negative judgement. A report can therefore be complete with
failures, and incomplete with no failures.

## Deterministic order

Determinism is part of the report contract.

| Collection | Order |
|---|---|
| model diagnostics | core scan order |
| rule sets | profile declaration order |
| rules | rule-set declaration order |
| analyses | dependency post-order; declared dependency order breaks ties |
| outcomes | code-point order of `RuleOutcome.id` |
| evidence | code-point order of `Evidence.id` |
| findings | rule order, then outcome order |
| context values in the report | code-point order of key |

No protocol code uses `localeCompare`, object insertion order from external JSON, filesystem order, or
registration side effects as a tiebreaker.

## Model inconsistency

`assess` always includes core diagnostics but never merges them with assessment findings.

- Any core error makes `model.state` inconsistent and `summary.state` incomplete.
- An analysis or rule marked `consistent` does not execute.
- A component marked `any` may execute, but its outcomes do not turn the whole report complete.
- Core warnings do not block execution and keep the model state consistent.
- A caller cannot pass `force` to relabel an inconsistent model. Exploratory tolerant analyses use
  the explicit `any` contract.

This prevents a broken model with no emitted findings from being presented as a valid building while
still allowing tools such as a layer inventory or source-oriented analysis to report useful facts.

## Explicit registration and external packs

An external package exports values; importing it has no registration side effect.

```ts
import { createAssessmentRegistry } from "@kensnzk/koyu/validate";
import { builtinAnalyses, builtinRuleSets, builtinProfiles } from "@kensnzk/koyu/validate/builtin";
import { analyses, ruleSets, profiles } from "@acme/koyu-rules";

const registry = createAssessmentRegistry({
  analyses: [...builtinAnalyses, ...analyses],
  ruleSets: [...builtinRuleSets, ...ruleSets],
  profiles: [...builtinProfiles, ...profiles],
});
```

The CLI may load one explicitly named configuration module before evaluation. The MCP server may do
the same only at process startup. An MCP tool call never accepts a module path or source code, and
neither transport scans `node_modules` for packs.

## Shared operation DTOs

Transport adapters do not call analyses or rules directly. A shared operation module returns the
already validated JSON DTO.

```ts
export interface AssessOperationInput {
  file: string;
  profile: ProfileRef | string;
  context: ContextSnapshot;
}

export interface AnalyzeOperationInput {
  file: string;
  analysis: AnalysisRef | string;
  context: ContextSnapshot;
}

export function assessOperation(input: AssessOperationInput): AssessmentReport;
export function analyzeOperation(input: AnalyzeOperationInput): AnalysisReport<JsonValue>;
```

The operation layer owns file loading. The pure assessment protocol continues to accept `Model`.

CLI JSON output is exactly:

```ts
process.stdout.write(JSON.stringify(result, null, 1) + "\n");
```

MCP returns the same `result` object as `structuredContent`. Its text block is a human summary and is
not the machine contract. No MCP-only field is inserted into the DTO, and no CLI-only field is
removed. Tests compare:

```text
assessOperation(input)
deep-equals JSON.parse(CLI stdout)
deep-equals MCP structuredContent
```

The same equality holds for the complete `AnalysisReport` returned by `analyzeOperation`, including
model diagnostics and the used-context trace. Purpose-specific `light` and `site` presenters, if
retained, call `analyzeOperation`; they contain no coefficient, threshold, area tolerance, or route
algorithm.

Configuration errors map to CLI exit 2 and MCP `isError: true`. A completed report maps to CLI exit 1
when it contains a fail or is incomplete, otherwise 0. This policy is an adapter decision derived
from the report; it does not add an `ok` field to the report.

## Rejected alternatives

### Keep `validate(model): Finding[]`

Rejected because an empty array conflates pass, no applicable population, missing context, a failed
analysis, and a broken model. Adding optional fields to `Finding` does not recover rule-run states.

### Let every rule inspect `Model`

Rejected because each pack would reimplement area, route, exposure, and geometry semantics. CLI and
MCP drift already demonstrates the result. Rules consume named, cached analyses instead.

### Put jurisdiction, zoning and limits into `.muro`

Rejected because those facts do not define the building's core composition and change on timelines
independent of the design. They belong to a dated context snapshot with provenance.

### Infer a profile from country, coordinates, room types, or today's date

Rejected because applicability is a judgement and because identical source would produce different
answers on different days or machines. Profile and `asOf` are explicit inputs.

### One universal built-in rule set

Rejected because physical collision, design heuristics, operating policy, and statutory screening
make different claims. Rule-set purpose and jurisdiction must remain visible in every report.

### Global `registerRule()` side effects

Rejected because import order would become configuration, tests would leak state, duplicate handling
would depend on process history, and two concurrent assessments could not use different packs.

### Last registration wins

Rejected because silent override is exactly the ambiguity the composition rules avoid. Duplicate IDs
are errors; alternate selections are explicit profiles.

### Automatically merge national, regional and local rule sets

Rejected because legal exceptions are not ordinary inheritance and because the engine cannot know
which local rule replaces, narrows, or supplements another. A profile lists the resolved sequence.

### Fetch authority data during a rule

Rejected because network availability, current content, credentials and time would enter the result.
Connectors create a snapshot before assessment.

### Make every provider asynchronous

Rejected for the first protocol because acquisition is outside the run and all current derivations
are synchronous. An async transport can prepare context and then call the deterministic synchronous
engine.

### Throw for missing project information

Rejected because missingness is an expected architectural state. It produces partial, unavailable,
or indeterminate. Only an invalid registry or malformed protocol value throws a configuration error.

### Catch duplicate IDs only when that rule runs

Rejected because a report would depend on which branch happened to execute. Registry and profile
validation complete before the first analysis runs.

### Sort rules by ID

Rejected because profile authorship defines a meaningful reading order. IDs order repeated outcomes
inside a rule; profiles and rule sets order the rules themselves.

### Add an overall `ok`

Rejected because different consumers gate cautions, indeterminate results and model warnings
differently. The report gives orthogonal facts and the adapter or caller chooses policy.

### Maintain separate CLI and MCP response shapes

Rejected because it makes transport code a second implementation of the answer. Both expose the same
operation DTO; human text is presentation only.

## Test matrix

### Registry and identity

| Case | Expected result |
|---|---|
| valid independent packs | one immutable registry |
| invalid or unnamespaced component ID | `AssessmentConfigError(invalid-id)` |
| duplicate analysis ID, same revision | `duplicate-id` |
| duplicate analysis ID, different revision | `duplicate-id` |
| missing analysis dependency | `missing-reference` |
| referenced revision differs | `revision-mismatch` |
| direct dependency cycle | `dependency-cycle` with two-node path |
| indirect dependency cycle | `dependency-cycle` with complete path |
| duplicate rule ID in one rule set | `duplicate-id` |
| duplicate rule ID across selected rule sets | profile resolution fails |
| same duplicate in unselected rule sets | registry may exist; selecting both fails |
| profile references an unregistered rule set | `missing-reference` |
| rule requests an analysis not listed by profile | profile resolution fails |
| conflicting context-key definitions | `duplicate-id` |

### Context

| Case | Expected result |
|---|---|
| valid required entry | decoded value and provenance available |
| missing required entry | analysis unavailable or rule indeterminate |
| invalid required entry | explicit `invalid-context` issue |
| missing optional entry | provider receives `state: missing` |
| invalid optional entry | provider receives `state: invalid` |
| malformed JSON value / `NaN` | configuration error before execution |
| absent `asOf` or invalid date | configuration error |
| profile outside effective range | `effective-date-mismatch` |
| jurisdictional profile, snapshot omits jurisdiction | `jurisdiction-mismatch` |
| profile and snapshot jurisdiction differ by one field | `jurisdiction-mismatch` |
| jurisdiction-free profile selects jurisdictional rule set | registry construction fails |
| jurisdictional profile selects unequal rule-set jurisdiction | registry construction fails |
| unused context entry | absent from report context trace |
| two readers use one key | one entry in report context trace |

### Analyses

| Case | Expected result |
|---|---|
| complete provider | complete artefact |
| useful result with missing input | partial with non-empty missing list |
| no derivable value | unavailable with non-empty missing list |
| shared dependency | executes once per assessment |
| dependency accepts partial | consumer executes with partial artefact |
| dependency requires complete | consumer becomes unavailable |
| undeclared `ctx.get` | provider execution error |
| provider throws `Error` | unavailable execution-error, no stack in report |
| provider throws non-Error | unavailable with safe string message |
| provider returns `Map`, `undefined`, or infinity | execution-error |
| provider mutates model | mutation contract test fails |
| inconsistent model + `consistent` | provider not called |
| inconsistent model + `any` | provider called; report remains incomplete |
| two separate assessment calls | no shared cache |
| evidence returned out of order | sorted by evidence ID |
| direct `runAnalysis` on inconsistent model | analysis report retains core diagnostics |

### Rules and report states

| Case | Expected result |
|---|---|
| applicable passing subject | pass outcome, complete report |
| applicable failing subject | fail outcome and flattened finding |
| empty population | not-applicable, no outcome |
| missing required analysis | indeterminate rule, evaluator not called |
| missing required context | indeterminate rule, evaluator not called |
| rule deliberately accepts partial | evaluator runs and may emit mixed outcomes |
| rule returns empty applicable outcomes | execution error |
| duplicate outcome ID | execution error |
| any outcome without subjects | execution error |
| any outcome without evidence | execution error |
| rule throws | rule state error, report incomplete |
| one fail and no missing data | report complete with fail count 1 |
| no fail but one indeterminate | report incomplete |
| only not-applicable rules | report complete, no claim of pass population |
| core error and no rule executes | inconsistent/incomplete, never pass |
| core warning only | rules execute normally |
| same rule tries to vary level | impossible through one rule definition |
| human presenter hides passes | machine report still retains all outcomes |

### Determinism

| Case | Expected result |
|---|---|
| same model, registry, profile and context twice | byte-identical JSON |
| unrelated registration order changes | selected report unchanged |
| dependency shared by rules in different sets | one result in dependency post-order |
| outcomes returned in reverse order | canonical outcome-ID order |
| evidence returned in reverse order | canonical evidence-ID order |
| context object keys inserted differently | identical report bytes |
| locale differs | identical machine report |

### Transport equivalence

| Case | Expected result |
|---|---|
| direct TS assessment | reference DTO |
| CLI `validate --json` | parsed stdout deep-equals reference DTO |
| MCP `validate` | `structuredContent` deep-equals reference DTO |
| direct TS analysis | reference analysis report DTO |
| CLI `analyze --json` | parsed stdout deep-equals analysis report DTO |
| MCP `analyze` | `structuredContent` deep-equals analysis report DTO |
| CLI human output | derived from DTO; no rule execution |
| MCP text block | derived from DTO; machine consumer ignores it |
| missing profile | CLI exit 2 / MCP error, no partial report |
| provider execution error | CLI exit 1 / MCP successful structured incomplete report |

### Domain and distribution gates

| Case | Expected result |
|---|---|
| imports under `src/core/` | no validate or draw import |
| rule implementations | no direct core model import |
| CLI and MCP sources | no threshold or regulatory constant |
| external fixture pack | imports only public validation contracts |
| root package entry | exposes no validation or drawing value |
| package manifest | zero runtime dependencies |
| packed install | every declared subpath imports successfully |

## Acceptance boundary

The protocol is ready to implement only if the following can be answered from the types and
algorithms above without adding an implicit convention:

- Which exact rule and revision spoke?
- Which profile selected it, for which jurisdiction and date?
- Did the rule pass, fail, not apply, or fail to reach a conclusion?
- Which model facts and external facts produced the result?
- Were those facts complete, partial, or unavailable?
- Did a broken model prevent a false pass?
- Did an external pack replace anything silently?
- Can a CLI, MCP client, and TypeScript caller compare the same object byte for byte?

If any answer requires parsing a message, inspecting registration order, reading the current clock,
or knowing which transport produced the output, the boundary is not complete.
