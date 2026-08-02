// koyu — 面の要素の導出 (ADR-0024)
// 床・天井・屋根。**語彙は一つも増えない。**
//
// level の `slab` (床組み厚) は既に床を宣言していて、`h` (天井高) は既に天井を宣言している。
// 屋根は「上に何も無い床」の裏返しであり、これも既にモデルにある事実である。
// 壁が境界から現れ、柱が通りの交点から現れるのと同じ構えで、面もまた宣言から現れる —
// 床を置く操作も、天井を張る操作も、屋根を架ける操作も存在しない。

import {
  canonicalSpaceOrder,
  heff,
  isSemiOutdoor,
  levelsSorted,
  type Model,
  type Pt,
  type Space,
  isOutside,
  isVoid as isVoidSpace
} from "./model.js";
import { areaOf, rectToPoly, subtract } from "./poly.js";
import { AREA_EPS } from "./tolerance.js";
import { runDecls } from "./vertical.js";

/** 天井面の見付け厚 mm (仕上げの面としての厚み) */
export const CEILING_T = 30;
/** 上に何も無いときの屋根版の厚さ mm (上階レベルの slab が無い場合の既定) */
export const ROOF_T = 200;

/** 空間の導出された領域。parse の出口で必ず埋まる (ADR-0022) — 割付への退避は持たない */
export const regionOf = (s: Space): Pt[][] =>
  s.pieces.length > 0 ? s.pieces : s.rects.map(rectToPoly);

export type SlabKind = "floor" | "ceiling" | "roof";

/** 生成された面。ビュアーはこれを幾何へ写すだけである */
export interface Slab {
  kind: SlabKind;
  /** どの空間の面か */
  space: string;
  level: string;
  /** 輪郭 — 導出された凸片 (描かれた線で切られていれば斜めになる) */
  outline: Pt[];
  z0: number;
  z1: number;
}

/**
 * 床・天井・屋根を導く。
 *
 * - **床** は level の `slab` (床組み厚) が与える。吹抜け (type:void) には無い —
 *   床の不在こそが吹抜けの定義だからである (ADR-0006)。外部空間にも無い (地面である)。
 * - **天井** は `h` (天井高) が与える。吹抜け・半屋外・縦動線には無い —
 *   縦動線の天井は上の走りに沿って傾いていて、一つの面ではない (ADR-0021)。
 * - **屋根** は「上に空間が重なっていない床つき空間」の上に架かる。上階レベルの
 *   `slab` を厚さに使い、上階が無ければ天井高の上に既定厚で載る。
 *   基壇の上の塔屋が覆わない部分に、書かずに屋根が現れる。
 */
export function slabs(model: Model): Slab[] {
  const levels = levelsSorted(model);
  const out: Slab[] = [];
  const byLevel = new Map<string, Space[]>();
  // Canonical order — the canonical form discards declaration order, so a surface that reads
  // it makes the shape a function of it (promise 1)
  for (const s of canonicalSpaceOrder(model)) {
    if (s.rects.length === 0 || !s.level) continue;
    const arr = byLevel.get(s.level) ?? [];
    arr.push(s);
    byLevel.set(s.level, arr);
  }

  for (const [li, level] of levels.entries()) {
    const upper = levels[li + 1];
    for (const s of byLevel.get(level.name) ?? []) {
      const pieces = regionOf(s);
      const isVoid = isVoidSpace(s);
      const isExterior = isOutside(s);
      const semi = isSemiOutdoor(model, s);
      const isRun = runDecls(s).length > 0;

      // 床: 階のFLの下に床組みが下がる
      if (!isVoid && !isExterior && level.slab !== undefined) {
        for (const outline of pieces) {
          out.push({ kind: "floor", space: s.path, level: level.name, outline, z0: level.z - level.slab, z1: level.z });
        }
      }

      const h = heff(model, s);
      // 天井: 一つの面として語れる空間にだけ張られる。
      // **天井は室の輪郭と必ずしも一致しない** — 折上げ・下がり天井 (梁型)・数室に
      // またがる連続天井・カーテンウォール手前の見切り。導出は基本計画の解像度での
      // 近似であり、`ceiling:0` が唯一の逃げ道 (現し天井) である。作図された天井を
      // 受け取る余地は ADR-0024 が開けてある
      const declared = s.attrs["ceiling"];
      if (declared !== 0 && !isVoid && !isExterior && !semi && !isRun && h !== undefined) {
        for (const outline of pieces) {
          out.push({
            kind: "ceiling",
            space: s.path,
            level: level.name,
            outline,
            z0: level.z + h - CEILING_T,
            z1: level.z + h,
          });
        }
      }

      // 屋根: 上に空間が重なっていない範囲に架かる。
      // **一部だけ覆われている空間には、覆われていない範囲にだけ屋根が架かる** —
      // 基壇の上に塔屋が載る建物では、これが基壇屋上として現れる。書かれていない。
      //
      // **床の不在は屋根の不在ではない。**吹抜けにも屋根は架かる — 上に何も無い
      // 吹抜けは、天窓で塞がれた竪穴か、空に開いた中庭かのどちらかであり、
      // 後者は半屋外として導出される (ADR-0007)。だから除くのは外部と半屋外だけである。
      // 逆に**覆っている側には吹抜けも数える** — 竪穴の途中の階に屋根は架からない。
      if (isExterior || semi) continue;
      // **覆っているものも導出された形で取る。**割付で取ると、上階を斜めに切った
      // 範囲まで「覆われている」と数えてしまい、その真下に屋根が架からなかった
      const covers: Pt[][] = [];
      for (const up of levels.slice(li + 1)) {
        for (const o of byLevel.get(up.name) ?? []) {
          if (isOutside(o)) continue;
          covers.push(...regionOf(o));
        }
      }
      const top = upper ? upper.z : level.z + (h ?? 0) + ROOF_T;
      const t = upper?.slab ?? ROOF_T;
      for (const outline of pieces) {
        for (const tile of subtract(outline, covers)) {
          if (areaOf([tile]) < AREA_EPS) continue;
          out.push({ kind: "roof", space: s.path, level: level.name, outline: tile, z0: top - t, z1: top });
        }
      }
    }
  }
  return out;
}
