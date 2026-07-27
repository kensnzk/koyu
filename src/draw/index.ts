// koyu — 表現の面 (`@kensnzk/koyu/draw`)
//
// **ここは凍らない** (spec/scope.md §8)。サブコマンド `plan` / `axo` の**面** —
// 名前・引数・終了コード — は凍るが、出てくる SVG の中身は約束の外にある。
// 見た目は自由に変えてよく、形は変えない。
//
// ルートからも同じものが出ている (`@kensnzk/koyu`)。分けてあるのは、
// **凍る面と凍らない面を、import 一行で見分けられるようにするため**である。

export { svgPlan, type PlanOptions } from "./plan.js";
export { svgAxo, type AxoOptions } from "./axo.js";
