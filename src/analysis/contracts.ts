import type { Diagnostic } from "../core/diagnose.js";
import type { Model } from "../core/model.js";
import type { JsonObject, JsonValue } from "./json.js";

export const COMPONENT_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;

export interface ComponentIdentity {
  readonly id: string;
  readonly revision: string;
}

export function isComponentIdentity(value: unknown): value is ComponentIdentity {
  if (typeof value !== "object" || value === null) return false;
  try {
    const id = Object.getOwnPropertyDescriptor(value, "id");
    const revision = Object.getOwnPropertyDescriptor(value, "revision");
    return !!id
      && "value" in id
      && id.enumerable === true
      && typeof id.value === "string"
      && COMPONENT_ID_PATTERN.test(id.value)
      && !!revision
      && "value" in revision
      && revision.enumerable === true
      && typeof revision.value === "string"
      && revision.value.trim() !== "";
  } catch {
    return false;
  }
}

export function sameIdentity(a: ComponentIdentity, b: ComponentIdentity): boolean {
  return a.id === b.id && a.revision === b.revision;
}

export interface JurisdictionRef {
  readonly country: string;
  readonly region?: string;
  readonly locality?: string;
  readonly authority?: string;
}

export interface EffectiveRange {
  readonly from: string;
  readonly to?: string;
}

export type SubjectRef =
  | { readonly kind: "model"; readonly ref: "/" }
  | { readonly kind: "level" | "space" | "zone" | "boundary" | "opening" | "run" | "site"; readonly ref: string }
  | { readonly kind: `${string}.${string}`; readonly ref: string };

export interface SourceLocation {
  readonly file?: string;
  readonly line?: number;
}

export interface ContextSource {
  readonly kind: "authority" | "survey" | "brief" | "user" | "import" | "other";
  readonly ref: string;
  readonly observedAt?: string;
  readonly retrievedAt?: string;
}

export interface AuthorityCitation {
  readonly jurisdiction: JurisdictionRef;
  readonly instrument: string;
  readonly provision?: string;
  readonly uri?: string;
  readonly effective?: EffectiveRange;
}

export type SourceRef =
  | { readonly kind: "model"; readonly subject: SubjectRef; readonly location?: SourceLocation }
  | { readonly kind: "context"; readonly key: string; readonly source: ContextSource }
  | { readonly kind: "authority"; readonly citation: AuthorityCitation }
  | { readonly kind: `${string}.${string}`; readonly data: JsonObject };

export interface Quantity {
  readonly value: number;
  readonly unit: string;
}

interface EvidenceBase {
  readonly id: string;
  readonly subjects: readonly [SubjectRef, ...SubjectRef[]];
  readonly sources: readonly [SourceRef, ...SourceRef[]];
  readonly producedBy: ComponentIdentity;
}

export type Evidence =
  | (EvidenceBase & { readonly kind: "fact"; readonly name: string; readonly value: JsonValue | Quantity })
  | (EvidenceBase & {
      readonly kind: "comparison";
      readonly observed: Quantity;
      readonly operator: "<" | "<=" | "=" | ">=" | ">" | "inside" | "outside";
      readonly required: Quantity | { readonly minimum?: Quantity; readonly maximum?: Quantity };
    })
  | (EvidenceBase & {
      readonly kind: "route";
      readonly reachable: boolean;
      readonly profile: string;
      readonly path: readonly string[];
      readonly cost?: Quantity;
    })
  | (EvidenceBase & { readonly kind: "geometry"; readonly geometry: JsonObject })
  | (EvidenceBase & {
      readonly kind: "missing";
      readonly missing: readonly [MissingInput, ...MissingInput[]];
    })
  | (EvidenceBase & { readonly kind: `${string}.${string}`; readonly data: JsonObject });

export interface ContextEntry {
  readonly value: JsonValue;
  readonly source: ContextSource;
}

export interface ContextSnapshot {
  readonly schema: "koyu-context/1";
  readonly asOf: string;
  readonly jurisdiction?: JurisdictionRef;
  readonly values: Readonly<Record<string, ContextEntry>>;
}

export type ContextDecode<T extends JsonValue> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

export interface ContextKey<T extends JsonValue> extends ComponentIdentity {
  readonly description: string;
  readonly decode: (value: JsonValue) => ContextDecode<T>;
}

export interface ContextRequirement<T extends JsonValue = JsonValue> {
  readonly key: ContextKey<T>;
  readonly presence: "required" | "optional";
}

export type ContextRead<T extends JsonValue> =
  | { readonly state: "present"; readonly value: T; readonly entry: ContextEntry }
  | { readonly state: "missing" }
  | { readonly state: "invalid"; readonly entry: ContextEntry; readonly message: string };

export interface ContextReader {
  get<T extends JsonValue>(key: ContextKey<T>): ContextRead<T>;
}

export type MissingInput =
  | { readonly kind: "context"; readonly key: string; readonly reason: "missing" | "invalid"; readonly message?: string }
  | { readonly kind: "model"; readonly subjects: readonly SubjectRef[]; readonly reason: string }
  | { readonly kind: "analysis"; readonly analysis: ComponentIdentity; readonly reason: "partial" | "unavailable" }
  | { readonly kind: `${string}.${string}`; readonly data: JsonObject };

export interface ExecutionIssue {
  readonly kind:
    | "model-inconsistent"
    | "dependency-unavailable"
    | "missing-context"
    | "invalid-context"
    | "execution-error"
    | `${string}.${string}`;
  readonly message: string;
  readonly subjects?: readonly SubjectRef[];
  readonly missing?: readonly MissingInput[];
}

export type AnalysisArtifact<T extends JsonValue> =
  | {
      readonly state: "complete";
      readonly value: T;
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly state: "partial";
      readonly value: T;
      readonly missing: readonly [MissingInput, ...MissingInput[]];
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly state: "unavailable";
      readonly missing: readonly [MissingInput, ...MissingInput[]];
      readonly issues: readonly [ExecutionIssue, ...ExecutionIssue[]];
    };

export interface AnalysisRef<T extends JsonValue = JsonValue> extends ComponentIdentity {
  readonly __output?: T;
}

export interface AnalysisRequirement<T extends JsonValue = JsonValue> {
  readonly analysis: AnalysisRef<T>;
  readonly accept: "complete" | "partial";
}

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>>
        : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
          : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;

export interface AnalysisRunContext {
  readonly model: DeepReadonly<Model>;
  readonly context: ContextReader;
  get<T extends JsonValue>(analysis: AnalysisRef<T>): AnalysisArtifact<T>;
}

export interface AnalysisDefinition<T extends JsonValue = JsonValue> extends AnalysisRef<T> {
  readonly title: string;
  readonly model: "consistent" | "any";
  readonly dependencies: readonly AnalysisRequirement[];
  readonly context: readonly ContextRequirement[];
  readonly run: (context: AnalysisRunContext) => AnalysisArtifact<T>;
}

export interface AnalysisResult<T extends JsonValue = JsonValue> {
  readonly analysis: ComponentIdentity;
  readonly artifact: AnalysisArtifact<T>;
}

export const ANALYSIS_FORMAT = "koyu-analysis/1" as const;

export interface AnalysisReport<T extends JsonValue = JsonValue> {
  readonly schema: typeof ANALYSIS_FORMAT;
  readonly profile: ComponentIdentity;
  readonly model: {
    readonly languageVersion: string;
    readonly name?: string;
    readonly state: "consistent" | "inconsistent";
    readonly diagnostics: readonly Diagnostic[];
  };
  readonly context: ContextSnapshot;
  readonly result: AnalysisResult<T>;
}
