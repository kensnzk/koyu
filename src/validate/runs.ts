// 検証 — 縦動線の建築的な妥当性 (ADR-0021)
//
// core が保証するのは「宣言から**形が一意に決まる**」までである (RUN01〜RUN05)。
// 決まった形が**登りやすいか**は建築の側の判断で、ここが引き受ける。
//
// 段数も踏面も勾配も原本には書かれない — 領域と階高から導出される。
// だから検査の対象は「書かれた値」ではなく「導出された値」である。
// 閾値 (踏面240mm・2R+T の 550〜700・エスカレーターの常用域) は日本の慣行の粗い写しで、
// 管轄が二つ目を持ったときに章の下へ足す。凍らないので、その時に足せばよい。

import type { Model } from "../core/model.js";
import { slopeText, verticalRuns } from "../core/vertical.js";
import { finding, type Finding } from "./index.js";

/** 踏面の下限 mm — 令23条の一般的な下限に倣う粗い値 */
export const TREAD_MIN = 240;
/** 2×蹴上 + 踏面 の目安 mm (歩幅則) */
export const STEP_RULE = { lo: 550, hi: 700 };
/** エスカレーターの常用勾配 (約1/1.7 = 30度) の許容幅 */
export const ESCALATOR_SLOPE = { lo: 1 / 2.3, hi: 1 / 1.4 };

export function runFindings(model: Model): Finding[] {
  const out: Finding[] = [];

  // 上下を繋ぐ垂直境界を持つ空間 — 形があってもここに無ければグラフでは通れない
  const stairLinked = new Set<string>();
  for (const b of model.boundaries) {
    if (b.kind === "stair" || b.kind === "shaft") {
      stairLinked.add(b.a);
      stairLinked.add(b.b);
    }
  }

  for (const run of verticalRuns(model)) {
    const s = model.spaces.get(run.path);
    if (!s) continue;
    const at = { line: s.line, file: s.file, path: [s.path] };
    if (run.device === "lift") continue;

    if (!stairLinked.has(run.path)) {
      out.push(
        finding(
          "run.disconnected",
          `${run.path} has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)`,
          at,
        ),
      );
    }

    if (run.device === "stair") {
      const t = Math.round(run.tread);
      const r = Math.round(run.riser);
      const rule = 2 * r + t;
      if (t < TREAD_MIN || rule < STEP_RULE.lo || rule > STEP_RULE.hi) {
        out.push(
          finding(
            "stair.proportion",
            `Derived step dimensions are cramped: ${run.risers} risers of ${r}mm, tread ${t}mm (2*riser+tread = ${Math.round(rule)}mm; expected ${STEP_RULE.lo}-${STEP_RULE.hi}mm)`,
            at,
          ),
        );
      }
    } else if (run.device === "ramp") {
      const declared = s.attrs["slope"];
      if (typeof declared === "number" && declared > 0 && run.slope > 1 / declared + 1e-9) {
        out.push(
          finding(
            "run.slope",
            `Derived slope ${slopeText(run.slope)} is steeper than the declared 1/${declared} (lengthen the run or lower the storey height)`,
            at,
          ),
        );
      }
    } else if (run.device === "escalator") {
      if (run.slope < ESCALATOR_SLOPE.lo || run.slope > ESCALATOR_SLOPE.hi) {
        out.push(
          finding(
            "run.slope",
            `Derived slope ${slopeText(run.slope)} is outside the usual escalator range (about 1/1.7 = 30 degrees)`,
            at,
          ),
        );
      }
    }
  }
  return out;
}
