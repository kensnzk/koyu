// IFCXS — 整合チェック
// コミットのたびに自動で回る検証の芽。構成の矛盾はここで言葉として現れる。
// 高さ方向の一貫性 — BIMが3Dであることで暗黙に担保していたもの — は、
// ここでは宣言された不変量 (天井高 + 上階slab ≤ 階高) の検査として明示的に持つ。
// 吹抜け (type:void) はこの不変量の宣言的な免除である。

import {
  placeBand,
  placeOpening,
  planOverlap,
  segmentsFor,
  sharedSegment,
  spacesOverlap,
} from "./graph.js";
import { heff, levelsSorted, type Model, type Space } from "./model.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

const EPS = 0.5;
const VERTICAL = new Set(["stair", "shaft", "void"]);

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

  const withRect = [...model.spaces.values()].filter((s) => s.rects.length > 0);
  const levels = levelsSorted(model);

  // レベルの重複
  for (let i = 1; i < levels.length; i++) {
    if (Math.abs(levels[i]!.z - levels[i - 1]!.z) < EPS) {
      errors.push(`レベル ${levels[i - 1]!.name} と ${levels[i]!.name} のzが同じです`);
    }
  }

  // 自らの領域 (合併の矩形同士) の重なり
  for (const s of withRect) {
    for (let i = 0; i < s.rects.length; i++) {
      for (let j = i + 1; j < s.rects.length; j++) {
        if (planOverlap(s.rects[i]!, s.rects[j]!)) {
          errors.push(`${s.line}行目: ${s.path} の領域同士が重なっています`);
        }
      }
    }
  }

  // 同一レベルでの空間同士の重なり
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      if (spacesOverlap(a, b)) {
        errors.push(`空間の領域が重なっています: ${a.path} と ${b.path}`);
      }
    }
  }

  // 接しているのに境界が宣言されていない組 (同一レベル)
  const declared = new Set(model.boundaries.map((b) => [b.a, b.b].sort().join("|")));
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      const touching = a.rects.some((ra) => b.rects.some((rb) => sharedSegment(ra, rb)));
      if (!touching) continue;
      if (!declared.has([a.path, b.path].sort().join("|"))) {
        warnings.push(`接しているのに境界が宣言されていません: ${a.path} | ${b.path}`);
      }
    }
  }

  // 境界の妥当性
  const levelIndex = new Map(levels.map((l, i) => [l.name, i]));
  for (const b of model.boundaries) {
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;

    if (VERTICAL.has(b.kind)) {
      // 垂直境界: 隣り合うレベルの、平面で重なる空間同士にしか張れない
      if (sa.rects.length === 0 || sb.rects.length === 0 || !sa.level || !sb.level) {
        errors.push(`${b.line}行目: ${b.kind} 境界は領域とレベルを持つ空間同士に書きます`);
        continue;
      }
      const ia = levelIndex.get(sa.level);
      const ib = levelIndex.get(sb.level);
      if (ia === undefined || ib === undefined || Math.abs(ia - ib) !== 1) {
        errors.push(
          `${b.line}行目: ${b.kind} 境界は隣り合うレベルの間に書きます: ${b.a} | ${b.b}`,
        );
      } else if (!spacesOverlap(sa, sb)) {
        errors.push(
          `${b.line}行目: ${b.kind} 境界の空間が平面上で重なっていません: ${b.a} | ${b.b}`,
        );
      }
      if (b.kind === "void") {
        const upper = (ia ?? 0) > (ib ?? 0) ? sa : sb;
        if (upper.type !== "void") {
          warnings.push(
            `${b.line}行目: void境界の上側は type:void の空間を想定しています: ${upper.path}`,
          );
        }
      }
      if (b.openings.length > 0) {
        warnings.push(`${b.line}行目: 垂直境界の開口は解釈されません`);
      }
      if (b.segs.length > 0) {
        warnings.push(`${b.line}行目: 垂直境界の seg は解釈されません`);
      }
      continue;
    }

    // 水平境界
    if (sa.rects.length > 0 && sb.rects.length > 0 && sa.level !== sb.level) {
      errors.push(
        `${b.line}行目: 異なるレベルの空間に壁境界は書けません (垂直は type:stair/shaft/void): ${b.a} | ${b.b}`,
      );
      continue;
    }
    const segs = segmentsFor(model, b);
    if (sa.rects.length > 0 && sb.rects.length > 0 && segs.length === 0) {
      errors.push(`${b.line}行目: 空間が接していないため境界を導けません: ${b.a} | ${b.b}`);
    }
    if ((sa.rects.length > 0 ? 1 : 0) + (sb.rects.length > 0 ? 1 : 0) === 1 && segs.length === 0) {
      warnings.push(`${b.line}行目: 外周に残る辺が無く、境界線分がゼロです: ${b.a} | ${b.b}`);
    }
    if (b.kind === "open" && b.openings.length > 0) {
      warnings.push(`${b.line}行目: open境界の開口は通行に影響しません (常に通れます)`);
    }
    for (const o of b.openings) {
      const placed = placeOpening(model, b, o);
      if ("error" in placed && placed.error) {
        errors.push(placed.error);
      }
    }
    for (const g of b.segs) {
      if (b.kind === "open") {
        warnings.push(`${g.line}行目: open境界 (壁が無い) の seg は解釈されません`);
        continue;
      }
      const placed = placeBand(model, b, g, "seg");
      if ("error" in placed && placed.error) {
        errors.push(placed.error);
      }
    }
  }

  // 数えない分節 (area) は親の領域に収まっているか
  for (const s of model.spaces.values()) {
    for (const a of s.areas) {
      if (s.rects.length === 0) {
        errors.push(`${a.line}行目: 領域を持たない空間 ${s.path} に area は書けません`);
        continue;
      }
      const inside = s.rects.some(
        (r) =>
          a.rect.x1 >= r.x1 - EPS &&
          a.rect.x2 <= r.x2 + EPS &&
          a.rect.y1 >= r.y1 - EPS &&
          a.rect.y2 <= r.y2 + EPS,
      );
      if (!inside) {
        warnings.push(`${a.line}行目: area が ${s.path} の領域からはみ出しています`);
      }
    }
  }

  // ゾーン: 束ねる空間が実在するか
  for (const z of model.zones.values()) {
    const children = [...model.spaces.keys()].filter((p) => p.startsWith(z.path + "/"));
    if (children.length === 0) {
      warnings.push(`${z.line}行目: ゾーン ${z.path} の下に空間がありません`);
    }
    if (model.spaces.has(z.path)) {
      warnings.push(`${z.line}行目: ゾーンと同じパスの空間があります (どちらかに寄せます): ${z.path}`);
    }
  }

  // 高さ方向の一貫性: 下階の空間の天井高 + 上階のslab ≤ 階高
  // 吹抜け (void境界) で上階へ立ち上がる空間はこの不変量から宣言的に免除される
  const voidExempt = new Set<string>();
  for (const b of model.boundaries) {
    if (b.kind !== "void") continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa?.level || !sb?.level) continue;
    const ia = levelIndex.get(sa.level) ?? 0;
    const ib = levelIndex.get(sb.level) ?? 0;
    const lower = ia < ib ? sa : sb;
    const upperLevel = ia < ib ? sb.level : sa.level;
    voidExempt.add(`${lower.path}|${upperLevel}`);
  }

  const byLevel = new Map<string, Space[]>();
  for (const s of withRect) {
    if (!s.level) continue;
    const arr = byLevel.get(s.level) ?? [];
    arr.push(s);
    byLevel.set(s.level, arr);
  }
  for (let i = 0; i + 1 < levels.length; i++) {
    const lb = levels[i]!;
    const lu = levels[i + 1]!;
    const below = byLevel.get(lb.name) ?? [];
    const above = byLevel.get(lu.name) ?? [];
    const pitch = lu.z - lb.z;
    let slabMissing = false;
    for (const s of below) {
      if (voidExempt.has(`${s.path}|${lu.name}`)) continue;
      const covered = above.some((u) => spacesOverlap(s, u)) || above.length === 0;
      if (!covered) continue;
      if (lu.slab === undefined) {
        slabMissing = true;
        continue;
      }
      const h = heff(model, s);
      if (h === undefined) {
        warnings.push(`${s.path} の天井高が不明で、${lu.name} との高さ検査ができません`);
        continue;
      }
      if (h + lu.slab > pitch + EPS) {
        errors.push(
          `${s.path} が上階に食い込みます: 天井高${h} + ${lu.name}のslab${lu.slab} = ${
            h + lu.slab
          } > 階高${pitch}`,
        );
      }
    }
    if (slabMissing) {
      warnings.push(
        `レベル ${lu.name} に slab が未宣言のため、${lb.name} との高さ検査ができません`,
      );
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
