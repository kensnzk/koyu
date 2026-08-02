// 検証 — 採光 (法28条1項の粗い写し)
//
// **合否はここが言う。**core が返すのは `daylightInputs` — 床面積と、係数を掛けた
// 有効窓面積という**数**だけである (docs/reference/scope.md「問いは合否を言わない」)。
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
          `Insufficient daylight: ${d.space.path} — effective window ${d.window.toFixed(2)} m2 < required ${need.toFixed(2)} m2 (1/${DAYLIGHT_DIVISOR} of the ${d.floor.toFixed(2)} m2 floor)`,
          at,
        ),
      );
    }
    if (d.missingH) {
      out.push(
        finding(
          "daylight.unknown",
          `Window area is not fully counted: ${d.space.path} has a window without h: (write h: on it)`,
          at,
        ),
      );
    }
  }
  return out;
}
