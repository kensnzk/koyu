// koyu core — 採光の**入力**を返す (合否は言わない)
//
// 方針 §5.7: 「集計とグラフの問いは core が持つ。**ただし合否を言わない。**
// 開口面積と床面積を返す。」1/7 の判定は建築の側の規則なので、検証の面
// (src/validate/light.ts) が持つ。ここが返すのは数だけである。
//
// 対象は `daylight:1` を書いた空間だけ — 型からは推定しない (ADR-0020)。
// 「どの室に採光の問いを掛けるか」は書き手の宣言であって、core の推定ではない。

import { areaM2, isCoveredAbove, isSemiOutdoor, type Model, type Space } from "./model.js";

/** 庇下・バルコニー下 (上に空間がある半屋外) 越しの窓の係数 — 縁側補正に倣う粗い値。
 *  上が開いた半屋外 (庭・最上階バルコニー) 越しは 1.0 (ADR-0009) */
export const COVERED_SEMI_FACTOR = 0.7;

/**
 * 採光の問いの入力。**合否を持たない** — `need` も `ok` もここには無い。
 * 閾値を掛けるのは検証の面である。
 */
export interface DaylightInput {
  space: Space;
  /** 床面積 m² (壁芯) */
  floor: number;
  /** 外部に面する窓の有効面積 m² (w×h×係数) */
  window: number;
  /** h未指定で数えられなかった窓があるか — 数が信用できないことの印 */
  missingH: boolean;
}

/**
 * `daylight:1` と宣言された領域つき空間について、床面積と有効窓面積を返す。
 * 係数は「窓の先が何か」の導出 — 外部に直接面すれば1、庇下の半屋外越しなら0.7、
 * 上が開いた半屋外越しなら1.0。この係数は形の導出であって判定ではない。
 */
export function daylightInputs(model: Model): DaylightInput[] {
  const out: DaylightInput[] = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0) continue;
    if (s.attrs["daylight"] !== 1) continue;
    const floor = areaM2(s)!;
    let win = 0;
    let missingH = false;
    for (const b of model.boundaries) {
      const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
      if (!other) continue;
      const os = model.spaces.get(other);
      if (!os) continue;
      const factor =
        os.type === "exterior"
          ? 1
          : isSemiOutdoor(model, os)
            ? isCoveredAbove(model, os)
              ? COVERED_SEMI_FACTOR
              : 1
            : 0;
      if (factor === 0) continue;
      for (const o of b.openings) {
        if (o.kind !== "window") continue;
        if (o.h === undefined) {
          missingH = true;
          continue;
        }
        win += (o.w * o.h * factor) / 1e6;
      }
    }
    out.push({ space: s, floor, window: win, missingH });
  }
  return out;
}
