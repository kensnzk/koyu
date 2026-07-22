// IFCXS v0 — 整合チェック
// コミットのたびに自動で回る検証の芽。構成の矛盾はここで言葉として現れる。

import { placeOpening, segmentsFor, sharedSegment } from "./graph.js";
import type { Model } from "./model.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

export function check(model: Model): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 境界の参照先
  for (const b of model.boundaries) {
    for (const p of [b.a, b.b]) {
      if (!model.spaces.has(p)) {
        errors.push(`${b.line}行目: 未定義の空間を参照しています: ${p}`);
      }
    }
    if (b.a === b.b) {
      errors.push(`${b.line}行目: 同じ空間同士の境界は書けません: ${b.a}`);
    }
  }

  const withRect = [...model.spaces.values()].filter((s) => s.rect);

  // 同一レベルでの領域の重なり
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      const ov =
        Math.min(a.rect!.x2, b.rect!.x2) - Math.max(a.rect!.x1, b.rect!.x1) > 0.5 &&
        Math.min(a.rect!.y2, b.rect!.y2) - Math.max(a.rect!.y1, b.rect!.y1) > 0.5;
      if (ov) {
        errors.push(`空間の領域が重なっています: ${a.path} と ${b.path}`);
      }
    }
  }

  // 接しているのに境界が宣言されていない組
  const declared = new Set(model.boundaries.map((b) => [b.a, b.b].sort().join("|")));
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      if (!sharedSegment(a.rect!, b.rect!)) continue;
      if (!declared.has([a.path, b.path].sort().join("|"))) {
        warnings.push(`接しているのに境界が宣言されていません: ${a.path} | ${b.path}`);
      }
    }
  }

  // 境界の線分が導けるか
  for (const b of model.boundaries) {
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    const segs = segmentsFor(model, b);
    if (sa.rect && sb.rect && segs.length === 0) {
      errors.push(`${b.line}行目: 空間が接していないため境界を導けません: ${b.a} | ${b.b}`);
    }
    if ((sa.rect ? 1 : 0) + (sb.rect ? 1 : 0) === 1 && segs.length === 0) {
      warnings.push(`${b.line}行目: 外周に残る辺が無く、境界線分がゼロです: ${b.a} | ${b.b}`);
    }
    if (b.kind === "open" && b.openings.length > 0) {
      warnings.push(`${b.line}行目: open境界の開口は通行に影響しません (常に通れます)`);
    }
    // 開口の配置
    for (const o of b.openings) {
      const placed = placeOpening(model, b, o);
      if ("error" in placed && placed.error) {
        errors.push(placed.error);
      }
    }
  }

  // レベルに載らない領域つき空間
  for (const s of withRect) {
    if (!s.level) {
      warnings.push(
        `${s.line}行目: ${s.path} は領域を持ちますが、パス先頭がレベル名ではありません`,
      );
    }
  }

  return { errors, warnings };
}
