// koyu — 公開面 (ADR-0037)
//
// **ここに書き下された名だけが約束である。**`export *` は使わない — モジュールに
// export を足した瞬間に、誰も宣言していない約束が凍る面に増えてしまうからである。
// 凍らせる面は、書き下されていなければならない (spec/scope.md §8)。
//
// 載せる基準は一つ — **面の外に利用者がいること。**
//   1. パッケージの外 (ugatsu / eval / scripts / editors) が実際に呼ぶ
//   2. CLI か MCP が答えるものを API からも答えるために要る
//      (「CLIが答えるものはすべてこのAPIが答える」— guide/api.md)
//   3. spec が名指しで約束する導出 (scope.md §4・§6 / semantics.md)
//   4. test が契約として固定している
// core のモジュール同士が引き合うだけの配管は面ではない。型は、載せた値の署名を
// 書き下すのに要るものだけを載せる。
//
// この一覧と spec/tools.md の一覧は集合として一致する — test/public-api.test.ts が縛る。

// ---- 解析と合成 (spec/composition.md) ----
export { parse, parseFiles, parseWith, tokenize, type LayerLoader } from "./core/parse.js";

// ---- モデルの語彙 — 書かれた構成の型 ----
export type {
  Area,
  Asset,
  Attrs,
  AttrValue,
  Boundary,
  BoundaryKind,
  Column,
  ColumnDecl,
  DrawnLine,
  Edge,
  GridAxis,
  GridRef,
  Level,
  Model,
  Opening,
  Pt,
  Rect,
  Seg,
  SitePolygon,
  Space,
  Zone,
} from "./core/model.js";

// ---- モデルへの問い・導出・機械形式 ----
// **合否は言わない** (spec/scope.md §4)。数と形を返すところまでが core である
export {
  areaM2,
  columnsFor,
  DEFAULT_LANGUAGE_VERSION,
  displayName,
  effectiveUse,
  heff,
  isCoveredAbove,
  isIndoor,
  isSemiOutdoor,
  levelsSorted,
  newUids,
  pointInPolygon,
  polyBounds,
  polygonAreaM2,
  rectToPoly,
  SourceError,
  srcRef,
  SUPPORTED_LANGUAGE_VERSIONS,
  toCanonical,
  unionAreaM2,
  zoneAreaM2,
} from "./core/model.js";

// ---- 構造整合の診断 (ADR-0016) ----
export {
  check,
  checkDiagnostics,
  DIAGNOSTIC_CODES,
  type CheckResult,
  type Diagnostic,
  type DiagnosticCode,
} from "./core/diagnose.js";

// ---- 空間グラフと導出の部品 ----
export {
  deriveDefaultBoundaries,
  doorsBetween,
  envelopeGaps,
  neighbors,
  passable,
  placeBand,
  placeOpening,
  segmentsFor,
  type Band,
  type BandCode,
  type BandError,
  type NeighborInfo,
  type PlacedBand,
  type Route,
  type Segment,
} from "./core/graph.js";

// ---- 床・天井・屋根 (ADR-0024) ----
export { slabs, type Slab, type SlabKind } from "./core/fabric.js";

// ---- 採光の入力 (ADR-0020) ----
export { daylightInputs, type DaylightInput } from "./core/light.js";

// ---- 縦動線 (ADR-0021) ----
export {
  runDrawsForLevel,
  runSolids,
  slopeText,
  verticalRuns,
  type RunArrow,
  type RunDevice,
  type RunDraw,
  type RunForm,
  type RunPart,
  type RunSolid,
  type Seg2,
  type VerticalRun,
} from "./core/vertical.js";

// ---- 敷地 (ADR-0009 / ADR-0011) ----
export { siteReport, type RoadFrontage, type SiteReport } from "./core/site.js";

// ---- 構成の言葉の差分 (ADR-0018) ----
export {
  renderDiff,
  semanticDiff,
  type BoundaryChange,
  type BoundaryItem,
  type ChangedItem,
  type ColumnItem,
  type FieldChange,
  type GridChange,
  type ModelDiff,
  type RenamedItem,
  type SpaceItem,
} from "./core/diff.js";

// ---- 生成 — **凍らない** (spec/scope.md §8)。SVGの中身は約束の外にある ----
// 領域としては `@kensnzk/koyu/draw` にも分けてある
export { svgPlan, type PlanOptions } from "./draw/plan.js";
export { svgAxo, type AxoOptions } from "./draw/axo.js";

// ---- 検証 — **core ではない。**凍らない・増える・合否を言う (spec/scope.md §3) ----
// Finding は Diagnostic と別の型で、フィールド名から違う (rule/level と code/severity)。
// 領域としては `@kensnzk/koyu/validate` にも分けてある
export {
  validate,
  VALIDATION_RULES,
  type Finding,
  type ValidationRule,
} from "./validate/index.js";
