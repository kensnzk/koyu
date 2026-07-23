// IFCXS — 採光の粗い判定 (法規検証の芽・第一号)
// 住居系の居室について 窓面積/床面積 ≥ 1/7 を確かめる。
// 採光補正係数は掛けない甘い判定であり、基本計画の解像度に合わせた早期警報である。
// 対象: unit / room / ldk / bedroom / living (hab:0 で除外、hab:1 で他の型も対象に)

import { areaM2, isCoveredAbove, isSemiOutdoor, type Model, type Space } from "./model.js";

const HABITABLE = new Set(["unit", "room", "ldk", "bedroom", "living"]);

/** 庇下・バルコニー下 (上に空間がある半屋外) 越しの窓の係数 — 縁側補正に倣う粗い値。
 *  上が開いた半屋外 (庭・最上階バルコニー) 越しは 1.0 (ADR-0009) */
const COVERED_SEMI_FACTOR = 0.7;

export interface DaylightResult {
  space: Space;
  /** 床面積 m² */
  floor: number;
  /** 外部に面する窓の面積 m² (w×h) */
  window: number;
  /** 必要面積 m² (床/7) */
  need: number;
  ok: boolean;
  /** h未指定で数えられなかった窓があるか */
  missingH: boolean;
}

export function daylight(model: Model): DaylightResult[] {
  const out: DaylightResult[] = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0) continue;
    const hab = s.attrs["hab"];
    const target = hab === 1 || (HABITABLE.has(s.type) && hab !== 0);
    if (!target) continue;
    const floor = areaM2(s)!;
    let win = 0;
    let missingH = false;
    for (const b of model.boundaries) {
      const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
      if (!other) continue;
      const os = model.spaces.get(other);
      if (!os) continue;
      // 外部に直接面する窓は係数1。半屋外越しは、その半屋外が庇下 (上に空間がある) なら0.7、
      // 上が開いていれば (庭・最上階バルコニー) 1.0
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
    const need = floor / 7;
    out.push({ space: s, floor, window: win, need, ok: win + 1e-9 >= need, missingH });
  }
  return out;
}
