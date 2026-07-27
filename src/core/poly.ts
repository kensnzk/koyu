// koyu — 凸片の幾何 (ADR-0027)
//
// 空間の形は**凸片の集合** (`Pt[][]`) である (ADR-0022)。矩形はその入口の綴りにすぎない。
// この層が存在しなかったあいだ、面積・被覆・切り分けの計算が model / graph / fabric /
// check / axo に散り、シューレース公式が三通り、矩形で切る処理が三通りあった。そして
// **「判定に使う集合」と「操作する集合」がずれる**という一つの誤りが、七箇所で別々に
// 現れた — 離れた翼が隅切りの向きを裏返して室が消え、上階を切ると下階の屋根が消え、
// 軸平行の線が「何も切っていない」と誤報された。どれも check が緑のまま起きた。
//
// ここに集めるのは、その規律である。**窓 (window) を渡さない操作を作らない** —
// どの範囲で測り、どの範囲を切るのかを、呼び手が必ず一緒に言う。

import type { Pt, Rect } from "./model.js";

/** 幾何の許容 mm。座標はmmの整数が基本なので、これより細かい差は同一とみなす */
export const EPS = 0.5;
/** 面積の退化の閾値 mm² — 1mm×1mm 未満の片は捨てる */
const AREA_EPS = 1;

// ---- 基本 ----

/** 符号つき面積 mm² (反時計回りが正)。**シューレースはここにしか無い** */
export function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** 面積 mm² */
export const area = (poly: Pt[]): number => Math.abs(signedArea(poly));

/** 凸片の集合の面積 mm² (片同士は重ならない前提 — check の GEO01/GEO02 が保証する) */
export const areaOf = (pieces: Pt[][]): number => pieces.reduce((a, p) => a + area(p), 0);

export function rectToPoly(r: Rect): Pt[] {
  return [
    { x: r.x1, y: r.y1 },
    { x: r.x2, y: r.y1 },
    { x: r.x2, y: r.y2 },
    { x: r.x1, y: r.y2 },
  ];
}

export function bounds(poly: Pt[]): Rect {
  return {
    x1: Math.min(...poly.map((p) => p.x)),
    x2: Math.max(...poly.map((p) => p.x)),
    y1: Math.min(...poly.map((p) => p.y)),
    y2: Math.max(...poly.map((p) => p.y)),
  };
}

/** 凸片の集合の外接矩形 (空なら undefined) */
export function boundsOf(pieces: Pt[][]): Rect | undefined {
  const all = pieces.flat();
  return all.length ? bounds(all) : undefined;
}

// ---- 切る ----

/**
 * 凸多角形を半平面で切る (Sutherland–Hodgman)。
 * 半平面は有向線分 a→b の左側 (外積>0)。**面積が退化した結果は空として返す** —
 * 以前は 1e-9 m² を閾値にしていたので mm² では 1e-3 mm² となり、
 * 実質どんな破片も生き残っていた。
 */
export function clipHalf(poly: Pt[], a: Pt, b: Pt, keepLeft: boolean): Pt[] {
  const side = (p: Pt): number => {
    const v = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    return keepLeft ? v : -v;
  };
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp >= -1e-6) out.push(p);
    if ((sp > 1e-6 && sq < -1e-6) || (sp < -1e-6 && sq > 1e-6)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return out.length >= 3 && area(out) > AREA_EPS ? out : [];
}

/** 軸平行の窓の内と外へ割る (どちらも凸片のまま) */
export function splitByRect(pieces: Pt[][], w: Rect): { inside: Pt[][]; outside: Pt[][] } {
  const edges: Array<[Pt, Pt]> = [
    [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y1 }],
    [{ x: w.x2, y: w.y1 }, { x: w.x2, y: w.y2 }],
    [{ x: w.x2, y: w.y2 }, { x: w.x1, y: w.y2 }],
    [{ x: w.x1, y: w.y2 }, { x: w.x1, y: w.y1 }],
  ];
  const outside: Pt[][] = [];
  let inside = pieces;
  for (const [u, v] of edges) {
    const next: Pt[][] = [];
    for (const p of inside) {
      const keep = clipHalf(p, u, v, true);
      const drop = clipHalf(p, u, v, false);
      if (keep.length) next.push(keep);
      if (drop.length) outside.push(drop);
    }
    inside = next;
  }
  return { inside, outside };
}

/** 軸平行の窓の内側だけ */
export const clipToRect = (poly: Pt[], w: Rect): Pt[] => splitByRect([poly], w).inside[0] ?? [];

/**
 * 凸片から凸片群を引く (差集合)。結果も凸片の集合。
 *
 * 一つの凸な引き手について、その各辺の外側を残す — 凸な穴の補集合は、辺ごとの
 * 半平面の和で正確に覆える。引き手が複数なら順に適用する。
 * **これが軸平行の矩形しか引けなかったせいで、斜めに切られた上階の下に屋根が
 * 架からなかった** (ADR-0024 が謳った部分被覆が、斜めでは効いていなかった)。
 */
export function subtract(piece: Pt[], covers: Pt[][]): Pt[][] {
  let rest: Pt[][] = [piece];
  for (const c of covers) {
    if (c.length < 3) continue;
    const ccw = signedArea(c) > 0 ? c : [...c].reverse();
    const next: Pt[][] = [];
    for (const r of rest) {
      // r ∩ c が空なら丸ごと残す (辺ごとに削ると重複が出るため先に見る)
      let inter: Pt[] = r;
      for (let i = 0; i < ccw.length && inter.length; i++) {
        inter = clipHalf(inter, ccw[i]!, ccw[(i + 1) % ccw.length]!, true);
      }
      if (inter.length === 0) {
        next.push(r);
        continue;
      }
      // 各辺の外側を順に取り、取った分は以降の候補から外す (重なりなく分割される)
      let remain = r;
      for (let i = 0; i < ccw.length && remain.length; i++) {
        const u = ccw[i]!;
        const v = ccw[(i + 1) % ccw.length]!;
        const out = clipHalf(remain, u, v, false);
        if (out.length) next.push(out);
        remain = clipHalf(remain, u, v, true);
      }
    }
    rest = next;
  }
  return rest;
}

/**
 * 凸片の集合の**合併**面積 mm² (重なりを二重に数えない)。
 * 建築面積 (水平投影) のように、階をまたぐ床を重ねて数える場面のための計算。
 * 積んだものから順に引きながら足す — 座標圧縮と違い、斜めの片にも厳密である。
 */
export function unionArea(pieces: Pt[][]): number {
  const acc: Pt[][] = [];
  let total = 0;
  for (const p of pieces) {
    if (p.length < 3) continue;
    total += areaOf(subtract(p, acc));
    acc.push(p);
  }
  return total;
}

/** 凸片の集合から凸片群を引く */
export const subtractAll = (pieces: Pt[][], covers: Pt[][]): Pt[][] =>
  pieces.flatMap((p) => subtract(p, covers));

// ---- 窓 (どの範囲で測り、どの範囲を切るか) ----

/**
 * 描かれた線の及ぶ窓 (ADR-0022)。
 *
 * **線に沿っては線自身の区間、線を横切っては相手を含む範囲。**
 * この非対称が要である — 無限直線として扱うと離れた翼を巻き込み、
 * 線分の外接矩形として扱うと軸平行の線で退化して何も切れない。
 * どちらの誤りも実際に起きた (室が消える / LIN03 が誤報する)。
 *
 * `across` に相手の範囲を渡すと二空間の分け直しの窓 (沿っては積・横切っては和) になり、
 * 省くと外皮を切る窓 (沿っては線の区間・横切っては自分の全体) になる。
 */
export function lineWindow(a: Pt, b: Pt, self: Rect, across?: Rect): Rect {
  const vertical = Math.abs(b.y - a.y) >= Math.abs(b.x - a.x);
  const lo = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
  const hi = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
  const span = (s: number, t: number, o1?: number, o2?: number): [number, number] =>
    o1 === undefined || o2 === undefined
      ? [Math.min(s, t), Math.max(s, t)]
      : [Math.min(s, o1), Math.max(t, o2)];
  if (vertical) {
    // 沿う = y、横切る = x
    const [y1, y2] = across
      ? [Math.max(self.y1, across.y1), Math.min(self.y2, across.y2)]
      : [lo.y, hi.y];
    const [x1, x2] = span(self.x1, self.x2, across?.x1, across?.x2);
    return { x1, x2, y1, y2 };
  }
  const [x1, x2] = across
    ? [Math.max(self.x1, across.x1), Math.min(self.x2, across.x2)]
    : [lo.x, hi.x];
  const [y1, y2] = span(self.y1, self.y2, across?.y1, across?.y2);
  return { x1, x2, y1, y2 };
}

/** 窓が実体を持つか */
export const validWindow = (w: Rect): boolean => w.x2 - w.x1 > EPS && w.y2 - w.y1 > EPS;

/** 窓に触れる凸片だけを選ぶ。線が届かない翼を判定から外すための門 */
export function touching(pieces: Pt[][], w: Rect): Pt[][] {
  return pieces.filter((p) => {
    const r = bounds(p);
    return r.x2 > w.x1 - EPS && r.x1 < w.x2 + EPS && r.y2 > w.y1 - EPS && r.y1 < w.y2 + EPS;
  });
}

/**
 * 線が触れる凸片が、線のどちら側に偏っているか (正=左 / 負=右 / 0=偏りなし)。
 *
 * **母集団は「線が触れる凸片」であり、それを丸ごと測る。**二つの誤りの間を通る:
 * 全ての凸片を測ると、線が届かない離れた翼が符号を支配して室が消える。
 * 窓の中だけを測ると、窓の外にある同じ片の大部分という判断材料を捨てて、
 * 隅から隅への線が「二等分」に見えてしまう。切るのは窓の中だけ、決めるのは片の全体。
 */
export function sideOfTouching(pieces: Pt[][], w: Rect, a: Pt, b: Pt): number {
  let left = 0;
  let right = 0;
  for (const p of touching(pieces, w)) {
    left += area(clipHalf(p, a, b, true));
    right += area(clipHalf(p, a, b, false));
  }
  const d = left - right;
  return Math.abs(d) < AREA_EPS ? 0 : d > 0 ? 1 : -1;
}

/** 窓の中で線が実際に切っているか (両側に面積が残るか) */
export function cutsInWindow(pieces: Pt[][], w: Rect, a: Pt, b: Pt): boolean {
  for (const p of splitByRect(touching(pieces, w), w).inside) {
    if (clipHalf(p, a, b, true).length > 0 && clipHalf(p, a, b, false).length > 0) return true;
  }
  return false;
}

// ---- 包含 ----

/** 点が多角形の辺の上にあるか */
export function onEdge(p: Pt, poly: Pt[], eps = 1): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    if ((p.x - qx) ** 2 + (p.y - qy) ** 2 <= eps * eps) return true;
  }
  return false;
}

/** 点が多角形の内側にあるか (境界上は内側扱い) */
export function pointIn(p: Pt, poly: Pt[], eps = 1): boolean {
  if (onEdge(p, poly, eps)) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** 二つの凸片の集合が平面上で重なるか */
export function overlaps(A: Pt[][], B: Pt[][]): boolean {
  for (const a of A) {
    for (const b of B) {
      let inter: Pt[] = a;
      const ccw = signedArea(b) > 0 ? b : [...b].reverse();
      for (let i = 0; i < ccw.length && inter.length; i++) {
        inter = clipHalf(inter, ccw[i]!, ccw[(i + 1) % ccw.length]!, true);
      }
      if (inter.length > 0) return true;
    }
  }
  return false;
}
