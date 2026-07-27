// 検証 — 採光 (法28条1項の粗い写し)
//
// **合否はここが言う。**core が返すのは `daylightInputs` — 床面積と、係数を掛けた
// 有効窓面積という**数**だけである (spec/scope.md §4「問いは合否を言わない」)。
// 1/7 という閾値は建築の側の規則であって、原本の構成が満たすべき不変量ではない。
//
// 判定は甘い。採光補正係数を掛けない粗い判定であり、基本計画の解像度に合わせた
// 早期警報である。用途別割合 (令19条3項) も適用建築物 (法28条1項) も見ない —
// 1/7 を掛ける先は `daylight:1` を書く位置として書き手が決める (ADR-0020)。

import type { Model } from "../core/model.js";
import { daylightInputs } from "../core/light.js";
import { finding, type Finding } from "./index.js";

/** 必要面積の分母。**建築の側の数であって、core の不変量ではない** */
export const DAYLIGHT_DIVISOR = 7;

export function daylightFindings(model: Model): Finding[] {
  const out: Finding[] = [];
  for (const d of daylightInputs(model)) {
    const at = { line: d.space.line, file: d.space.file, path: [d.space.path] };
    const need = d.floor / DAYLIGHT_DIVISOR;
    if (d.window + 1e-9 < need) {
      out.push(
        finding(
          "daylight.ratio",
          `採光が足りません: ${d.space.path} — 有効窓 ${d.window.toFixed(2)}㎡ < 必要 ${need.toFixed(2)}㎡ (床 ${d.floor.toFixed(2)}㎡ の 1/${DAYLIGHT_DIVISOR})`,
          at,
        ),
      );
    }
    if (d.missingH) {
      out.push(
        finding(
          "daylight.unknown",
          `h を持たない窓があるため窓面積を数え切れていません: ${d.space.path} (window に h: を書きます)`,
          at,
        ),
      );
    }
  }
  return out;
}
