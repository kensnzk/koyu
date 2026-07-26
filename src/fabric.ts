// koyu — 面の要素の導出 (ADR-0024)
// 床・天井・屋根。**語彙は一つも増えない。**
//
// level の `slab` (床組み厚) は既に床を宣言していて、`h` (天井高) は既に天井を宣言している。
// 屋根は「上に何も無い床」の裏返しであり、これも既にモデルにある事実である。
// 壁が境界から現れ、柱が通りの交点から現れるのと同じ構えで、面もまた宣言から現れる —
// 床を置く操作も、天井を張る操作も、屋根を架ける操作も存在しない。

import {
  clipHalfPlane,
  heff,
  isSemiOutdoor,
  levelsSorted,
  polyBounds,
  rectToPoly,
  type Model,
  type Pt,
  type Rect,
  type Space,
} from "./model.js";
import { runDecls } from "./vertical.js";

/**
 * 凸片のうち、覆う矩形群に覆われていない部分を軸平行のタイルとして返す。
 * 覆う矩形の辺で座標圧縮し、覆われていないセルだけを凸片で切り取る (凸なので厳密)。
 * 部分被覆を扱わないと、塔屋が少しでも掛かった基壇に屋根が架からなくなる
 */
function uncovered(piece: Pt[], covers: Rect[]): Pt[][] {
  const b = polyBounds(piece);
  const near = covers.filter((r) => r.x2 > b.x1 && r.x1 < b.x2 && r.y2 > b.y1 && r.y1 < b.y2);
  if (near.length === 0) return [piece];
  const xs = [...new Set([b.x1, b.x2, ...near.flatMap((r) => [r.x1, r.x2])])]
    .filter((v) => v >= b.x1 - 0.5 && v <= b.x2 + 0.5)
    .sort((p, q) => p - q);
  const ys = [...new Set([b.y1, b.y2, ...near.flatMap((r) => [r.y1, r.y2])])]
    .filter((v) => v >= b.y1 - 0.5 && v <= b.y2 + 0.5)
    .sort((p, q) => p - q);
  const out: Pt[][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const cx = (xs[i]! + xs[i + 1]!) / 2;
      const cy = (ys[j]! + ys[j + 1]!) / 2;
      if (near.some((r) => cx > r.x1 && cx < r.x2 && cy > r.y1 && cy < r.y2)) continue;
      let cell = rectToPoly({ x1: xs[i]!, y1: ys[j]!, x2: xs[i + 1]!, y2: ys[j + 1]! });
      for (let k = 0; k < piece.length && cell.length > 0; k++) {
        cell = clipHalfPlane(cell, piece[k]!, piece[(k + 1) % piece.length]!, true);
      }
      if (cell.length >= 3) out.push(cell);
    }
  }
  return out;
}

/** 天井面の見付け厚 mm (仕上げの面としての厚み) */
const CEILING_T = 30;
/** 上に何も無いときの屋根版の厚さ mm (上階レベルの slab が無い場合の既定) */
const ROOF_T = 200;

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
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || !s.level) continue;
    const arr = byLevel.get(s.level) ?? [];
    arr.push(s);
    byLevel.set(s.level, arr);
  }

  for (const [li, level] of levels.entries()) {
    const upper = levels[li + 1];
    for (const s of byLevel.get(level.name) ?? []) {
      const pieces = s.pieces.length > 0 ? s.pieces : s.rects.map(rectToPoly);
      const isVoid = s.type === "void";
      const isExterior = s.type === "exterior";
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
      // 基壇の上に塔屋が載る建物では、これが基壇屋上として現れる。書かれていない
      if (isVoid || isExterior) continue;
      const covers: Rect[] = [];
      for (const up of levels.slice(li + 1)) {
        for (const o of byLevel.get(up.name) ?? []) {
          if (o.type === "void") continue; // 吹抜けは覆わない (床の不在)
          covers.push(...o.rects);
        }
      }
      const top = upper ? upper.z : level.z + (h ?? 0) + ROOF_T;
      const t = upper?.slab ?? ROOF_T;
      for (const outline of pieces) {
        for (const tile of uncovered(outline, covers)) {
          out.push({ kind: "roof", space: s.path, level: level.name, outline: tile, z0: top - t, z1: top });
        }
      }
    }
  }
  return out;
}
