// koyu — the validation surface (`@kensnzk/koyu/validate`)
//
// **This is not core.** core says "what is written is not self-contradictory as data" and stops
// there; whether the building works is a different question with a different answer, and this
// face is where it gets answered (docs/reference/scope.md).
//
// This face does not freeze. Rules may be coarse, a rule set may cover one jurisdiction or none,
// and the resolution may be too low — add freely, throw away freely. It is cheap because it
// does not freeze. One condition attaches to that freedom: **a judgement must never be mistaken
// for what core guarantees.** The two are different from the type up:
//
//   core        Diagnostic { code: "HGT01", severity: "error" | "warning" }
//   validation  RuleOutcome { status: "pass" | "fail" | "indeterminate" } inside an AssessmentReport
//
// Nothing here judges on its own. This module is the **SPI and the runner**: the caller composes
// an immutable registry of rules, rule sets and profiles, names one profile and one context, and
// gets back an `AssessmentReport`. There is no registration API, no process-global registry and
// no import-time side effect — a rule pack that is merely imported does nothing. koyu's own pack
// is one such value and gets no privileged path: see `@kensnzk/koyu/validate/builtin`.
//
// The report never collapses to a boolean or a bare array. "No finding" and "could not be
// judged" have to stay distinguishable, so the report keeps pass, fail, not-applicable,
// indeterminate and rule error apart, along with the identity of everything that was applied.
//
// Dependency runs one way — validation reads core, core knows nothing of validation
// (test/domains.test.ts checks the imports by machine).

export { assess, createAssessmentRegistry } from "./assessment.js";

export {
  ASSESSMENT_FORMAT,
  AssessmentConfigError,
  type AssessmentFinding,
  type AssessmentConfigProblem,
  type AssessmentOptions,
  type AssessmentRegistry,
  type AssessmentRegistryInput,
  type AssessmentReport,
  type AssessmentSummary,
  type ComponentKind,
  type FindingLevel,
  type OutcomeStatus,
  type Profile,
  type ProfileRef,
  type Rule,
  type RuleEvaluation,
  type RuleOutcome,
  type RuleRun,
  type RuleRunContext,
  type RuleSet,
  type RuleSetPurpose,
  type RuleSetRef,
} from "./contracts.js";
