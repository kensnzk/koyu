// koyu v0 — 公開API
export * from "./core/model.js";
export { parse, parseFiles, parseWith, tokenize, type LayerLoader } from "./core/parse.js";
export * from "./core/graph.js";
export { check, checkDiagnostics, DIAGNOSTIC_CODES, type CheckResult, type Diagnostic } from "./core/diagnose.js";
export {
  semanticDiff,
  renderDiff,
  type ModelDiff,
  type FieldChange,
  type ChangedItem,
  type RenamedItem,
  type GridChange,
  type SpaceItem,
  type BoundaryItem,
  type BoundaryChange,
} from "./core/diff.js";
export { daylightInputs, COVERED_SEMI_FACTOR, type DaylightInput } from "./core/light.js";
export { slabs, type Slab, type SlabKind } from "./core/fabric.js";
export {
  verticalRuns,
  verticalRun,
  runDecls,
  runSolids,
  runDrawsForLevel,
  runIssues,
  slopeText,
  toWorld,
  CUT_HEIGHT,
  RUN_KEYS,
  RUN_FORMS,
  type RunDevice,
  type RunForm,
  type RunPart,
  type VerticalRun,
  type RunSolid,
  type RunDraw,
  type RunArrow,
  type RunIssue,
  type Seg2,
} from "./core/vertical.js";
export { siteReport, type SiteReport, type RoadFrontage } from "./core/site.js";
export { svgPlan, type PlanOptions } from "./draw/plan.js";
export { svgAxo, type AxoOptions } from "./draw/axo.js";

// 検証の面 — **core ではない。**凍らない・増える・合否を言う (spec/scope.md §3)。
// Finding は Diagnostic と別の型で、フィールド名から違う (rule/level と code/severity)
export {
  validate,
  VALIDATION_RULES,
  accessFindings,
  daylightFindings,
  envelopeFindings,
  runFindings,
  siteFindings,
  type Finding,
  type ValidationRule,
} from "./validate/index.js";
