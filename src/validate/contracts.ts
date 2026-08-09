import type { Diagnostic } from "../core/diagnose.js";
import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  AnalysisRequirement,
  AnalysisResult,
  AuthorityCitation,
  ComponentIdentity,
  ContextReader,
  ContextRequirement,
  ContextSnapshot,
  EffectiveRange,
  Evidence,
  ExecutionIssue,
  JurisdictionRef,
  MissingInput,
  SubjectRef,
} from "../analysis/contracts.js";
import type { JsonValue } from "../analysis/json.js";

export type OutcomeStatus = "pass" | "fail" | "indeterminate";
export type FindingLevel = "violation" | "caution";

export interface RuleOutcome {
  readonly id: string;
  readonly status: OutcomeStatus;
  readonly subjects: readonly [SubjectRef, ...SubjectRef[]];
  readonly message: string;
  readonly evidence: readonly [Evidence, ...Evidence[]];
}

export type RuleEvaluation =
  | {
      readonly applicability: "not-applicable";
      readonly reason: string;
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly applicability: "indeterminate";
      readonly reason: string;
      readonly missing: readonly [MissingInput, ...MissingInput[]];
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly applicability: "applicable";
      readonly outcomes: readonly [RuleOutcome, ...RuleOutcome[]];
    };

export interface RuleRunContext {
  readonly context: ContextReader;
  get<T extends JsonValue>(analysis: AnalysisRef<T>): AnalysisArtifact<T>;
}

export interface Rule extends ComponentIdentity {
  readonly title: string;
  readonly level: FindingLevel;
  readonly model: "consistent" | "any";
  readonly analyses: readonly AnalysisRequirement[];
  readonly context: readonly ContextRequirement[];
  readonly authority: readonly AuthorityCitation[];
  readonly evaluate: (context: RuleRunContext) => RuleEvaluation;
}

export type RuleSetPurpose = "design-lint" | "operational-review" | "code-screening" | "compliance";

export interface RuleSetRef extends ComponentIdentity {}

export interface RuleSet extends RuleSetRef {
  readonly title: string;
  readonly purpose: RuleSetPurpose;
  readonly jurisdiction?: JurisdictionRef;
  readonly effective?: EffectiveRange;
  readonly rules: readonly Rule[];
}

export interface ProfileRef extends ComponentIdentity {}

export interface Profile extends ProfileRef {
  readonly title: string;
  readonly jurisdiction?: JurisdictionRef;
  readonly effective?: EffectiveRange;
  readonly analyses: readonly AnalysisRef[];
  readonly ruleSets: readonly RuleSetRef[];
}

export interface AssessmentRegistry {
  readonly analyses: readonly AnalysisDefinition<JsonValue>[];
  readonly ruleSets: readonly RuleSet[];
  readonly profiles: readonly Profile[];
}

export interface AssessmentRegistryInput {
  readonly analyses: readonly AnalysisDefinition<JsonValue>[];
  readonly ruleSets: readonly RuleSet[];
  readonly profiles: readonly Profile[];
}

interface RuleRunBase {
  readonly rule: ComponentIdentity;
  readonly ruleSet: ComponentIdentity;
}

export type RuleRun =
  | (RuleRunBase & {
      readonly state: "evaluated";
      readonly evaluation: Extract<RuleEvaluation, { applicability: "applicable" }>;
      readonly issues: readonly [];
    })
  | (RuleRunBase & {
      readonly state: "not-applicable";
      readonly evaluation: Extract<RuleEvaluation, { applicability: "not-applicable" }>;
      readonly issues: readonly [];
    })
  | (RuleRunBase & {
      readonly state: "indeterminate";
      readonly evaluation: Extract<RuleEvaluation, { applicability: "indeterminate" }>;
      readonly issues: readonly [ExecutionIssue, ...ExecutionIssue[]];
    })
  | (RuleRunBase & {
      readonly state: "error";
      readonly issues: readonly [ExecutionIssue, ...ExecutionIssue[]];
    });

export interface AssessmentFinding {
  readonly rule: ComponentIdentity;
  readonly ruleSet: ComponentIdentity;
  readonly level: FindingLevel;
  readonly outcome: RuleOutcome & { readonly status: "fail" };
}

export interface AssessmentSummary {
  readonly state: "complete" | "incomplete";
  readonly rules: {
    readonly evaluated: number;
    readonly notApplicable: number;
    readonly indeterminate: number;
    readonly error: number;
  };
  readonly outcomes: {
    readonly pass: number;
    readonly fail: number;
    readonly indeterminate: number;
  };
}

/**
 * The name of the shape an assessment returns. **It carries no version**, for the same reason
 * as `ANALYSIS_FORMAT`: judgements are the face that grows by addition and freezes nothing,
 * and nothing reads this string back.
 */
export const ASSESSMENT_FORMAT = "koyu-assessment" as const;

export interface AssessmentReport {
  readonly schema: typeof ASSESSMENT_FORMAT;
  readonly profile: ComponentIdentity;
  readonly ruleSets: readonly ComponentIdentity[];
  readonly model: {
    readonly languageVersion: string;
    readonly name?: string;
    readonly state: "consistent" | "inconsistent";
    readonly diagnostics: readonly Diagnostic[];
  };
  readonly context: ContextSnapshot;
  readonly analyses: readonly AnalysisResult<JsonValue>[];
  readonly rules: readonly RuleRun[];
  readonly findings: readonly AssessmentFinding[];
  readonly summary: AssessmentSummary;
}

export type ComponentKind = "analysis" | "rule-set" | "profile" | "rule" | "context-key";

export type AssessmentConfigProblem =
  | { readonly code: "invalid-registry"; readonly message: string }
  | { readonly code: "duplicate-id"; readonly kind: ComponentKind; readonly id: string }
  | { readonly code: "invalid-id"; readonly kind: ComponentKind; readonly id: string }
  | {
      readonly code: "missing-reference";
      readonly owner: ComponentIdentity;
      readonly targetKind: ComponentKind;
      readonly target: ComponentIdentity;
    }
  | {
      readonly code: "revision-mismatch";
      readonly owner: ComponentIdentity;
      readonly targetKind: ComponentKind;
      readonly id: string;
      readonly expected: string;
      readonly actual: string;
    }
  | {
      readonly code: "dependency-cycle";
      readonly path: readonly [ComponentIdentity, ComponentIdentity, ...ComponentIdentity[]];
    }
  | { readonly code: "invalid-context"; readonly path: string; readonly message: string }
  | {
      readonly code: "effective-date-mismatch";
      readonly owner: ComponentIdentity;
      readonly asOf: string;
      readonly effective: EffectiveRange;
    }
  | {
      readonly code: "jurisdiction-mismatch";
      readonly owner: ComponentIdentity;
      readonly expected?: JurisdictionRef;
      readonly actual?: JurisdictionRef;
    };

export class AssessmentConfigError extends Error {
  readonly problem: AssessmentConfigProblem;
  readonly code: AssessmentConfigProblem["code"];

  constructor(problem: AssessmentConfigProblem) {
    super(problemMessage(problem));
    this.name = "AssessmentConfigError";
    this.problem = problem;
    this.code = problem.code;
  }
}

function problemMessage(problem: AssessmentConfigProblem): string {
  switch (problem.code) {
    case "invalid-registry": return problem.message;
    case "duplicate-id": return `duplicate ${problem.kind} id: ${problem.id}`;
    case "invalid-id": return `invalid ${problem.kind} identity: ${problem.id}`;
    case "missing-reference": return `${problem.owner.id} references missing ${problem.targetKind} ${problem.target.id}@${problem.target.revision}`;
    case "revision-mismatch": return `${problem.owner.id} requires ${problem.id}@${problem.expected}, registered revision is ${problem.actual}`;
    case "dependency-cycle": return `analysis dependency cycle: ${problem.path.map(identityLabel).join(" -> ")}`;
    case "invalid-context": return `${problem.path}: ${problem.message}`;
    case "effective-date-mismatch": return `${problem.owner.id} is not effective on ${problem.asOf}`;
    case "jurisdiction-mismatch": return `${problem.owner.id} has a different or missing jurisdiction`;
  }
}

function identityLabel(identity: ComponentIdentity): string {
  return `${identity.id}@${identity.revision}`;
}

export interface AssessmentOptions {
  readonly registry: AssessmentRegistry;
  readonly profile: ProfileRef | string;
  readonly context: ContextSnapshot;
}

export interface RunAnalysisOptions extends AssessmentOptions {}
