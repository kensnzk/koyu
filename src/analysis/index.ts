// koyu — the analysis surface (`@kensnzk/koyu/analysis`)
//
// **Analysis makes the material for a judgement; it never holds the authority to judge.**
// An artifact carries measurements, evidence you can walk back to the model, the identity of
// the profile and inputs it came from, and whatever input was missing. It carries no `pass`,
// no `fail`, no level and no verdict — drawing the line is what `@kensnzk/koyu/validate` does.
//
// Every run names its context and its versioned profile explicitly. There is no implicit
// jurisdiction, no process-wide default profile, and no overload that lets a required input
// be omitted. Two runs that differ do so because the arguments differed, and the difference
// is visible in the result's provenance rather than hidden in process state.

export {
  COMPONENT_ID_PATTERN,
  isComponentIdentity,
  sameIdentity,
  ANALYSIS_FORMAT,
  type AnalysisArtifact,
  type AnalysisDefinition,
  type AnalysisRef,
  type AnalysisReport,
  type AnalysisRequirement,
  type AnalysisResult,
  type AnalysisRunContext,
  type AuthorityCitation,
  type ComponentIdentity,
  type ContextDecode,
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
  type Quantity,
  type SourceLocation,
  type SourceRef,
  type SubjectRef,
} from "./contracts.js";

export {
  assertJsonValue,
  canonicalJsonValue,
  codePointCompare,
  isJsonValue,
  JsonBoundaryError,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
} from "./json.js";

// Running one analysis, without running any rule. The registry and profile are the caller's
// values; see `@kensnzk/koyu/validate` for how they are built.
export { runAnalysis } from "../validate/assessment.js";
export type { RunAnalysisOptions } from "../validate/contracts.js";
