// koyu — 検証の面 (建築的な判定)
//
// **ここは core ではない。**core が言うのは「書かれたものがデータとして矛盾していない」
// までであって、建築として妥当かは何も言わない (spec/scope.md §3)。採光・面積率・
// 外皮の連続・階段の寸法・到達可能性 — 建築の側の判断はすべてこの面に属す。
//
// この面は**凍らない**。規則が粗くても、管轄が一つしかなくても、精度が足りなくても、
// 増やしてよいし捨ててよい。値段が安いのは、凍らないからである。
//
// 汚くてよい条件は一つだけある — **判定の結果が、原本の保証と混同されないこと。**
// そのために、core の Diagnostic とは**型ごと分けてある**:
//
//   core     Diagnostic { code: "HGT01",        severity: "error" | "warning" }
//   検証     Finding    { rule: "daylight.ratio", level: "violation" | "caution" }
//
// フィールド名が違うので、二つの配列は取り違えようがない。連結しようとすれば型が落ちる。
// 「core の緑」と「判定の緑」を同じ言葉で語れないようにすることが、この分離の目的である。
//
// 依存は一方向 — 検証は core を読むが、core は検証を知らない
// (test/domains.test.ts が import を機械的に検査する)。

import type { Model } from "../core/model.js";
import { accessFindings } from "./access.js";
import { daylightFindings } from "./light.js";
import { envelopeFindings } from "./envelope.js";
import { runFindings } from "./runs.js";
import { siteFindings } from "./site.js";

/**
 * 判定の台帳。**綴りが core の診断コードと違う**のは事故を防ぐためである —
 * `ENV01` と `envelope.gap` を取り違える読み手はいない。
 *
 * 章 (`envelope` / `daylight` / `stair` / `run` / `access` / `column` / `site`) は管轄ではなく
 * 主題である。管轄が二つ目を持ったとき (日本の法規と別の国の法規) に章の下へ足す。
 */
export const VALIDATION_RULES = {
  "envelope.gap": "caution", // 外皮に穴 — 何にも面していない外周 (ADR-0025)
  "daylight.ratio": "violation", // 有効窓面積 < 床面積/7 (ADR-0020)
  "daylight.unknown": "caution", // h を持たない窓があり、窓面積を数え切れていない
  "stair.proportion": "caution", // 導出された段が窮屈 (踏面 <240 / 2R+T が 550〜700 の外)
  "run.slope": "caution", // 導出された勾配が宣言より急・常用域の外
  "run.disconnected": "caution", // 縦動線の形はあるが上下を繋ぐ垂直境界が無い
  "access.unreachable": "violation", // 領域を持つ室から外部へ辿り着けない
  "access.voidonly": "violation", // 扉が吹抜け (床の無い所) にしか開いていない
  "access.throughtenant": "caution", // 階段室からの避難が賃貸区画を通る
  "access.parking": "violation", // 駐車場から車が出られない
  "access.backofhouse": "caution", // 共用廊下からバックヤードを通らずに縦動線へ届かない
  "column.blocksdoor": "violation", // 導出された柱が導出された扉と重なる (ADR-0023)
  "site.escape": "violation", // 建物が敷地形状からはみ出す
  "site.area": "caution", // 敷地面積の宣言と導出の食い違い
  "site.frontage": "violation", // 接道長が 2m 未満 (法43条の粗い写し)
} as const satisfies Record<string, "violation" | "caution">;

/** 判定の規則名。台帳が唯一の出所 — 登録していない規則は型が通らない (core の DiagnosticCode と同じ構え) */
export type ValidationRule = keyof typeof VALIDATION_RULES;

/**
 * 判定の一件。**core の Diagnostic とは別の型である** — 混ぜられないことがこの型の仕事。
 *
 * `level` は「守られなかった」(violation) と「疑わしい」(caution) を分ける。
 * core の severity と違って、これは**建築の側の重さ**であって構成の壊れ方ではない。
 */
export interface Finding {
  rule: ValidationRule;
  level: "violation" | "caution";
  /** 日本語の本文 (位置接頭辞なし — core の Diagnostic と同じ流儀) */
  message: string;
  /** 出所の行 */
  line?: number;
  /** 出所レイヤー (合成時) */
  file?: string;
  /** 対象の空間/ゾーンのパス */
  path?: string[];
}

/** Finding を組み立てる — level は規則の不変属性であって、場合によって変わらない */
export function finding(
  rule: ValidationRule,
  message: string,
  at: { line?: number; file?: string; path?: string[] } = {},
): Finding {
  return {
    rule,
    level: VALIDATION_RULES[rule],
    message,
    ...(at.line !== undefined ? { line: at.line } : {}),
    ...(at.line !== undefined && at.file !== undefined ? { file: at.file } : {}),
    ...(at.path ? { path: at.path } : {}),
  };
}

/**
 * 全ての判定を回す。並びは章の順で、章の中は走査の順である
 * (core の checkDiagnostics と同じ規律 — ADR-0028)。
 *
 * **合否は返さない。**返るのは「守られなかったこと」の列であって、
 * 建物が使えるかどうかの結論ではない。
 */
export function validate(model: Model): Finding[] {
  return [
    ...envelopeFindings(model),
    ...daylightFindings(model),
    ...runFindings(model),
    ...accessFindings(model),
    ...siteFindings(model),
  ];
}
