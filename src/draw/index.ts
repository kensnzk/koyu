// koyu — 表現の面 (`@kensnzk/koyu/draw`)
//
// **ここは凍らない** (docs/reference/scope.md)。サブコマンド `plan` / `axo` の**面** —
// 名前・引数・終了コード — は凍るが、出てくる SVG の中身は約束の外にある。
// 見た目は自由に変えてよく、形は変えない。
//
// ルートからも同じものが出ている (`@kensnzk/koyu`)。分けてあるのは、
// **凍る面と凍らない面を、import 一行で見分けられるようにするため**である。

export { svgPlan, type PlanOptions } from "./plan.js";
export {
  planMarks,
  SLIDE_POCKET,
  type Mark,
  type MarkArc,
  type MarkNote,
  type MarkOptions,
  type MarkRole,
  type MarkSubject,
} from "./marks.js";
export { svgAxo, type AxoOptions } from "./axo.js";
export {
  sceneOf,
  type Scene,
  type SceneFacts,
  type SceneLevel,
  type SceneLine,
  type SceneMark,
  type SceneNode,
  type ScenePrism,
  type SceneRole,
  type SceneSubject,
} from "./scene.js";
export { svgSection, svgElevation, type SectionOptions, type ElevationOptions } from "./section.js";
