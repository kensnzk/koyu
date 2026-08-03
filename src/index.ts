// koyu — the root surface (`@kensnzk/koyu`)
//
// **Only the names written down here are promised.** `export *` is never used: the moment a
// module gains an export, a promise nobody declared would freeze into the surface. A surface
// that freezes has to be written out by hand (docs/reference/scope.md).
//
// **root is not a shorthand for every subpath.** What lives here is the minimum needed to begin
// the standard loop — read a `.muro`, confirm it is not self-contradictory, and take the
// canonical form — plus the types those signatures cannot be written without. Domain names
// (`model`, `graph`, `form`, `analysis`, `validate`, `draw`, `node`) are **not** re-exported
// from here. A caller who needs a domain names that domain, and the import line then says which
// contract is being relied on: the face that freezes, the face that computes from external
// conditions, the face that concludes, the presentation that may change freely, and the
// Node-specific adapter never get mixed together.
//
// root is browser-safe: nothing reachable from here pulls a Node builtin.
//
// The twelve entry points:
//
//   @kensnzk/koyu                   this file — compose, check, canonicalise
//   @kensnzk/koyu/model             Model, and the questions the model answers alone
//   @kensnzk/koyu/diagnostics       structural-consistency diagnostics
//   @kensnzk/koyu/graph             adjacency, passability, routes, boundary segments
//   @kensnzk/koyu/form              the one derivation of shape
//   @kensnzk/koyu/analysis          facts made under an explicit context and profile
//   @kensnzk/koyu/diff              the semantic difference between two models
//   @kensnzk/koyu/vocabulary        the attribute ledger
//   @kensnzk/koyu/validate          the rule SPI, the runner, AssessmentReport
//   @kensnzk/koyu/validate/builtin  the rules, rule set and profile koyu ships
//   @kensnzk/koyu/draw              presentation of the Form
//   @kensnzk/koyu/node              filesystem and other Node-specific adapters
//
// This list and the table in docs/reference/api/index.md agree as sets — test/public-api.test.ts
// binds them.

// ---- 解析と合成 (docs/reference/muro/import.md) ----
export { parse, parseFiles, parseWith, tokenize, type LayerLoader } from "./core/parse.js";

// ---- 構造整合の確認 — **合否は言わない。**書かれたものが矛盾していないかまで ----
export {
  check,
  checkDiagnostics,
  type CheckResult,
  type Diagnostic,
  type DiagnosticCode,
} from "./core/diagnose.js";

// ---- 機械形式と、版 ----
export {
  DEFAULT_LANGUAGE_VERSION,
  SourceError,
  SUPPORTED_LANGUAGE_VERSIONS,
  toCanonical,
  type Model,
} from "./core/model.js";
