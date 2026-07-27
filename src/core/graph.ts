// koyu — 空間グラフ
// 節点が空間、辺が境界。「この室とこの室は繋がっているか」「ここから外へ扉いくつか」が
// 変換なしにそのままグラフへの問いになる。
// 空間の領域は矩形の合併 (L字など)。壁は合併の外周と共有辺から導出される。

import type { Boundary, Edge, Model, Opening, Pt, Rect, Space } from "./model.js";
import { rectToPoly, srcRef } from "./model.js";
import * as poly from "./poly.js";

/** 壁芯線分 (mm)。水平なら y1===y2、垂直なら x1===x2。
 *  描かれた線 (ADR-0022) は斜めになりうる — その場合 diagonal が立つ */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horizontal: boolean;
  /** 軸に平行でない (描かれた線) */
  diagonal?: boolean;
  /** boundary.a 側 (領域を持つ側) の矩形から見た辺 */
  edgeOfA?: Edge;
}

const EPS = 0.5;

/**
 * 凸片の軸平行な辺 (向きから N/E/S/W を読む)。頂点列は反時計回りなので、
 * +x へ進む辺が南、+y が東、-x が北、-y が西の面になる。
 * 斜めの辺は返さない — それは描かれた線であり、自分の境界が実現を持っている
 */
function polyEdges(poly: Pt[]): Array<{ edge: Edge; fixed: number; lo: number; hi: number }> {
  const out: Array<{ edge: Edge; fixed: number; lo: number; hi: number }> = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    if (Math.abs(dy) < EPS && Math.abs(dx) > EPS) {
      out.push({
        edge: dx > 0 ? "S" : "N",
        fixed: p.y,
        lo: Math.min(p.x, q.x),
        hi: Math.max(p.x, q.x),
      });
    } else if (Math.abs(dx) < EPS && Math.abs(dy) > EPS) {
      out.push({
        edge: dy > 0 ? "E" : "W",
        fixed: p.x,
        lo: Math.min(p.y, q.y),
        hi: Math.max(p.y, q.y),
      });
    }
  }
  return out;
}

const FACING: Record<Edge, Edge> = { N: "S", S: "N", E: "W", W: "E" };

/** 凸片の外周のうち、他の空間の凸片と向かい合っていない区間 (= 外部に面する壁) */
function pieceOutline(pieces: Pt[][], others: Pt[][]): Segment[] {
  const otherEdges = others.flatMap(polyEdges);
  const segs: Segment[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const siblings = pieces.filter((_, k) => k !== i).flatMap(polyEdges);
    for (const e of polyEdges(pieces[i]!)) {
      let intervals: Array<[number, number]> = [[e.lo, e.hi]];
      for (const o of [...otherEdges, ...siblings]) {
        if (o.edge !== FACING[e.edge]) continue;
        if (Math.abs(o.fixed - e.fixed) > EPS) continue;
        intervals = intervals.flatMap(([s, t]) => {
          const cs = Math.max(s, o.lo);
          const ce = Math.min(t, o.hi);
          if (ce - cs <= EPS) return [[s, t] as [number, number]];
          const out: Array<[number, number]> = [];
          if (cs - s > EPS) out.push([s, cs]);
          if (t - ce > EPS) out.push([ce, t]);
          return out;
        });
      }
      const horizontal = e.edge === "N" || e.edge === "S";
      for (const [s, t] of intervals) {
        segs.push(
          horizontal
            ? { x1: s, y1: e.fixed, x2: t, y2: e.fixed, horizontal: true, edgeOfA: e.edge }
            : { x1: e.fixed, y1: s, x2: e.fixed, y2: t, horizontal: false, edgeOfA: e.edge },
        );
      }
    }
  }
  return segs;
}

/**
 * 二つの領域 (凸片の集合) が共有する軸平行な辺。矩形どうしの共有辺ではなく凸片で見るので、
 * 描かれた線で切られた形にも正しい。
 * 斜めの辺は返さない — それは描かれた線であり、自分の境界が実現を持っている
 */
function sharedFromPieces(A: Pt[][], B: Pt[][]): Segment[] {
  const eb = B.flatMap(polyEdges);
  const out: Segment[] = [];
  for (const ea of A.flatMap(polyEdges)) {
    for (const o of eb) {
      if (o.edge !== FACING[ea.edge]) continue;
      if (Math.abs(o.fixed - ea.fixed) > EPS) continue;
      const lo = Math.max(ea.lo, o.lo);
      const hi = Math.min(ea.hi, o.hi);
      if (hi - lo <= EPS) continue;
      out.push(
        ea.edge === "N" || ea.edge === "S"
          ? { x1: lo, y1: ea.fixed, x2: hi, y2: ea.fixed, horizontal: true, edgeOfA: ea.edge }
          : { x1: ea.fixed, y1: lo, x2: ea.fixed, y2: hi, horizontal: false, edgeOfA: ea.edge },
      );
    }
  }
  return out;
}

/** 共線で連続する線分をまとめる (L字の合併外周を一本の壁にする) */
export function mergeCollinear(segs: Segment[]): Segment[] {
  const groups = new Map<string, Segment[]>();
  for (const s of segs) {
    const key = `${s.horizontal ? "h" : "v"}:${s.horizontal ? s.y1 : s.x1}:${s.edgeOfA ?? ""}`;
    const g = groups.get(key) ?? [];
    g.push(s);
    groups.set(key, g);
  }
  const out: Segment[] = [];
  for (const g of groups.values()) {
    g.sort((p, q) => (p.horizontal ? p.x1 - q.x1 : p.y1 - q.y1));
    let cur = { ...g[0]! };
    for (let i = 1; i < g.length; i++) {
      const s = g[i]!;
      const curEnd = cur.horizontal ? cur.x2 : cur.y2;
      const sStart = s.horizontal ? s.x1 : s.y1;
      if (sStart <= curEnd + EPS) {
        if (cur.horizontal) cur.x2 = Math.max(cur.x2, s.x2);
        else cur.y2 = Math.max(cur.y2, s.y2);
      } else {
        out.push(cur);
        cur = { ...s };
      }
    }
    out.push(cur);
  }
  return out;
}

/**
 * 既定境界の導出 (ADR-0014) — 垂直の「既定は床」と対称の、水平の「既定は壁」。
 * 同一レベル (未特定同士を含む) で平面が接する領域つき空間の組に、宣言境界がその組に
 * 一つも無ければ kind:wall の既定境界を導く。宣言は例外 (open・手すり) と属性のためにある。
 * 領域を持たない空間 (exterior等) との境界は導かない — 相手の名指しが情報のため宣言する。
 * 合成・スパン展開の完了後に呼ぶ (parse / parseWith の出口)。冪等。
 */
export function deriveDefaultBoundaries(model: Model): void {
  const declared = new Set<string>();
  for (const b of model.boundaries) declared.add([b.a, b.b].sort().join("|"));
  const withRect = [...model.spaces.values()].filter((s) => s.rects.length > 0);
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      const key = [a.path, b.path].sort().join("|");
      if (declared.has(key)) continue;
      // 接触は**導出された形**で見る — 線で接触が消えた組に既定の壁を作らない
      if (sharedFromPieces(piecesOf(a), piecesOf(b)).length === 0) continue;
      model.boundaries.push({
        a: a.path,
        b: b.path,
        kind: "wall",
        derived: true,
        attrs: {},
        openings: [],
        segs: [],
        line: 0,
      });
      declared.add(key);
    }
  }
}

/**
 * 描かれた線による領域の切り分け (ADR-0022)。
 *
 * 空間の `rects` は**書かれた割付** (セル) であって形ではない。形は凸片 `pieces` として
 * ここで導かれる — 既定は矩形そのまま、境界に線が描かれていればその半平面で切り直す。
 * 切り直しは「二空間の割付の合併を、線の両側へ分け直す」操作なので、
 * 一方が失う三角形をもう一方が得る (合計面積は保存される)。
 *
 * 線の及ぶ範囲は**書かれた区間の外接矩形**に限る。無限直線として全体を切ると、
 * 離れた翼まで巻き添えにするため。冪等ではないので parse の出口で一度だけ呼ぶ。
 */
export function derivePieces(model: Model): void {
  for (const s of model.spaces.values()) s.pieces = s.rects.map(rectToPoly);
  // 線は宣言順に効く。derivePieces は parse の出口で一度だけ呼ぶ (冪等ではない)

  for (const b of model.boundaries) {
    if (!b.drawn) continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    const cut = drawnCut(sa, sb, b.drawn.a, b.drawn.b);
    if (!cut) continue;

    if (cut.solo) {
      // 外皮を切る線 — 持つ側だけが窓の中で自分の側へ切り落とされる。相手は面積を得ない
      const s = cut.solo;
      const { inside, outside } = poly.splitByRect(s.pieces, cut.window);
      s.pieces = [
        ...outside,
        ...inside.map((p) => poly.clipHalf(p, b.drawn!.a, b.drawn!.b, cut.sideA > 0)).filter((p) => p.length > 0),
      ];
      continue;
    }

    // 二空間の分け直し — 窓の中の割付を合併し、線の両側へ分け直す (合計面積は保存される)
    const splitA = poly.splitByRect(sa.pieces, cut.window);
    const splitB = poly.splitByRect(sb.pieces, cut.window);
    const pool = [...splitA.inside, ...splitB.inside];
    if (pool.length === 0) continue;
    sa.pieces = [
      ...splitA.outside,
      ...pool.map((p) => poly.clipHalf(p, b.drawn!.a, b.drawn!.b, cut.sideA > 0)).filter((p) => p.length > 0),
    ];
    sb.pieces = [
      ...splitB.outside,
      ...pool.map((p) => poly.clipHalf(p, b.drawn!.a, b.drawn!.b, cut.sideA < 0)).filter((p) => p.length > 0),
    ];
  }
}

/**
 * 描かれた線の切り方を一度に決める — 窓・残す側・片側かどうか (ADR-0022 / ADR-0027)。
 *
 * **窓と側は必ず一緒に決める。**別々に決めていたために、側は空間の全割付を無限直線で
 * 測るのに切るのは線の近傍だけ、という母集団のずれが生まれ、線から遠い翼が符号を
 * 支配して、残すつもりだった側が黙って切り落とされた (check は緑のまま)。
 * check の LIN01/LIN03 もこの同じ関数を通す — 判定と操作が食い違わないために。
 */
export function drawnCut(
  sa: Space,
  sb: Space,
  a: Pt,
  b: Pt,
): { window: Rect; sideA: number; solo?: Space } | undefined {
  const ba = poly.boundsOf(sa.pieces);
  const bb = poly.boundsOf(sb.pieces);
  // 片側が領域を持たない (外部) — 外皮を切る線
  if (!ba || !bb) {
    const solo = ba ? sa : bb ? sb : undefined;
    const sb2 = ba ?? bb;
    if (!solo || !sb2) return undefined;
    const w = poly.lineWindow(a, b, sb2);
    if (!poly.validWindow(w)) return undefined;
    const side = poly.sideOfTouching(solo.pieces, w, a, b);
    if (side === 0) return undefined; // 窓の中でちょうど二等分 — 残す側が決まらない (LIN01)
    return { window: w, sideA: solo === sa ? side : -side, solo };
  }
  const w = poly.lineWindow(a, b, ba, bb);
  if (!poly.validWindow(w)) return undefined;
  let ia = poly.sideOfTouching(sa.pieces, w, a, b);
  let ib = poly.sideOfTouching(sb.pieces, w, a, b);
  if (ia === 0 && ib === 0) return undefined; // どちらも偏りなし — 分離が決まらない (LIN01)
  if (ia === 0) ia = -ib;
  if (ib === 0) ib = -ia;
  if (ia === ib) return undefined; // 同じ側 — 分離していない (LIN01)
  return { window: w, sideA: ia };
}






/** 境界の壁芯線分を導く。壁の位置は空間の割付から生成される — 壁を置く操作は存在しない */
export function segmentsFor(model: Model, b: Boundary): Segment[] {
  const sa = model.spaces.get(b.a);
  const sb = model.spaces.get(b.b);
  if (!sa || !sb) return [];

  // 垂直境界 (stair/shaft/void/暗黙のslab) は壁線分を持たない
  if (b.kind === "stair" || b.kind === "shaft" || b.kind === "void") return [];

  // 描かれた線 (ADR-0022): 隣接からの導出ではなく、書かれた線がそのまま境界の実現になる。
  // ただし**一本の設計線は複数の境界に共有されうる** — 貫通通路の壁は、その前を通る
  // 区画の数だけ境界を持つ。この境界が実現するのは、線の両側がちょうど a と b に
  // なっている区間だけであり、線の全長ではない
  if (b.drawn) return drawnShare(model, sa, sb, b.drawn.a, b.drawn.b);

  let segs: Segment[] = [];
  const aHas = sa.rects.length > 0;
  const bHas = sb.rects.length > 0;

  if (aHas && bHas) {
    if (sa.level !== sb.level) return []; // 異なるレベル間に壁は立たない
    // 共有辺も**導出された領域** (pieces) から取る。割付から取ると、
    // 描かれた線で切り落とした側にまで壁が立つ (隅切りの外へ壁が飛び出す)
    segs.push(...sharedFromPieces(piecesOf(sa), piecesOf(sb)));
  } else if (aHas || bHas) {
    // 片側が領域を持たない (外部など): 導出された領域の外周から、
    // 同レベルで向かい合う他室の区間を除いた残り。**割付ではなく形の縁を辿る** —
    // 描かれた線で切り落とされた側には壁が立たない (ADR-0022)
    const roomSpace = aHas ? sa : sb;
    const others: Pt[][] = [];
    for (const s of model.spaces.values()) {
      if (s === sa || s === sb) continue;
      if (s.level !== roomSpace.level) continue;
      others.push(...piecesOf(s));
    }
    segs.push(...pieceOutline(piecesOf(roomSpace), others));
  }
  segs = mergeCollinear(segs);
  if (b.edge) segs = segs.filter((s) => s.edgeOfA === b.edge);
  return segs;
}

/**
 * 空間の外周のうち、**何にも面していない**区間 (ADR-0025)。
 * 他の空間とも、宣言された外部境界とも向かい合っていない縁 — 外皮の穴である。
 * 既定境界 (ADR-0014) は領域を持たない空間との間には導かれないので、
 * 外部への境界の書き忘れは黙って壁の不在になる。これを言葉にするための導出。
 */
export function envelopeGaps(model: Model, s: Space): Segment[] {
  if (s.rects.length === 0 || !s.level) return [];
  const others: Pt[][] = [];
  for (const o of model.spaces.values()) {
    if (o === s || o.level !== s.level) continue;
    others.push(...piecesOf(o));
  }
  let gaps = pieceOutline(piecesOf(s), others);
  // 宣言された境界 (外部・斜めを含む) が覆う区間を引く
  for (const b of model.boundaries) {
    if (b.a !== s.path && b.b !== s.path) continue;
    if (b.kind === "stair" || b.kind === "shaft" || b.kind === "void") continue;
    for (const seg of segmentsFor(model, b)) {
      gaps = gaps.flatMap((g) => subtractOverlap(g, seg));
    }
  }
  return gaps.filter((g) => segmentLength(g) > 1);
}

/** 軸平行の線分から、同一直線上で重なる区間を引く */
function subtractOverlap(g: Segment, o: Segment): Segment[] {
  if (o.diagonal || g.horizontal !== o.horizontal) return [g];
  const fixedG = g.horizontal ? g.y1 : g.x1;
  const fixedO = o.horizontal ? o.y1 : o.x1;
  if (Math.abs(fixedG - fixedO) > EPS) return [g];
  const [gl, gh] = g.horizontal ? [g.x1, g.x2] : [g.y1, g.y2];
  const [ol, oh] = o.horizontal
    ? [Math.min(o.x1, o.x2), Math.max(o.x1, o.x2)]
    : [Math.min(o.y1, o.y2), Math.max(o.y1, o.y2)];
  const cs = Math.max(gl, ol);
  const ce = Math.min(gh, oh);
  if (ce - cs <= EPS) return [g];
  const parts: Array<[number, number]> = [];
  if (cs - gl > EPS) parts.push([gl, cs]);
  if (gh - ce > EPS) parts.push([ce, gh]);
  return parts.map(([a, b]) =>
    g.horizontal
      ? { ...g, x1: a, x2: b }
      : { ...g, y1: a, y2: b },
  );
}

function piecesOf(s: Space): Pt[][] {
  return s.pieces.length > 0 ? s.pieces : s.rects.map(rectToPoly);
}

/** 線の左右へ少し離れた点。どちらの空間に属するかを見るための探り */
const PROBE = 5;

/**
 * 描かれた線のうち、この二空間が実際に向かい合っている区間だけを返す (ADR-0022)。
 *
 * 一本の設計線は複数の境界に共有される — 貫通通路の壁は、その前を通る区画の数だけ
 * 境界を持つ。各境界が線の全長を実現すると、平面には同じ壁が何本も重なって現れる。
 * 線を両空間の縁で切り、左右がちょうど a と b になっている区間だけを残す。
 */
function drawnShare(model: Model, sa: Space, sb: Space, p: Pt, q: Pt): Segment[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const A = piecesOf(sa);
  const B = piecesOf(sb);

  // 切り位置: 両空間の凸片の辺と線の交点
  const cuts = new Set<number>([0, 1]);
  for (const poly of [...A, ...B]) {
    for (let i = 0; i < poly.length; i++) {
      const t = lineHit(p, q, poly[i]!, poly[(i + 1) % poly.length]!);
      if (t !== undefined && t > 1e-9 && t < 1 - 1e-9) cuts.add(t);
    }
  }
  const ts = [...cuts].sort((x, y) => x - y);

  const kept: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const m = (ts[i]! + ts[i + 1]!) / 2;
    const cx = p.x + m * dx;
    const cy = p.y + m * dy;
    const left = { x: cx + nx * PROBE, y: cy + ny * PROBE };
    const right = { x: cx - nx * PROBE, y: cy - ny * PROBE };
    const inA = (pt: Pt) => A.some((g) => poly.pointIn(pt, g, 0));
    const inB = (pt: Pt) => B.some((g) => poly.pointIn(pt, g, 0));
    // 片側が領域を持たない (外部) 相手なら、持つ側が片側に居るだけで境界になる
    const soloB = sb.rects.length === 0;
    const soloA = sa.rects.length === 0;
    const ok = soloB
      ? inA(left) !== inA(right)
      : soloA
        ? inB(left) !== inB(right)
        : (inA(left) && inB(right)) || (inB(left) && inA(right));
    if (ok) kept.push([ts[i]!, ts[i + 1]!]);
  }

  // 連続する区間をまとめる
  const out: Segment[] = [];
  for (const [a0, a1] of kept) {
    const last = out[out.length - 1];
    const start = { x: p.x + a0 * dx, y: p.y + a0 * dy };
    const end = { x: p.x + a1 * dx, y: p.y + a1 * dy };
    if (last && Math.hypot(last.x2 - start.x, last.y2 - start.y) < EPS) {
      last.x2 = end.x;
      last.y2 = end.y;
      continue;
    }
    const horizontal = Math.abs(dy) < 0.5;
    const vertical = Math.abs(dx) < 0.5;
    out.push({
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      horizontal,
      ...(horizontal || vertical ? {} : { diagonal: true as const }),
    });
  }
  return out;
}

/** 無限直線 p→q と線分 u→v の交点の、線側のパラメータ t (平行・範囲外は undefined) */
function lineHit(p: Pt, q: Pt, u: Pt, v: Pt): number | undefined {
  const rx = q.x - p.x;
  const ry = q.y - p.y;
  const sx = v.x - u.x;
  const sy = v.y - u.y;
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-9) return undefined;
  const t = ((u.x - p.x) * sy - (u.y - p.y) * sx) / d;
  const w = ((u.x - p.x) * ry - (u.y - p.y) * rx) / d;
  return w >= -1e-9 && w <= 1 + 1e-9 ? t : undefined;
}

export function segmentLength(s: Segment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

/** 平面上の重なり (垂直隣接の導出に使う)。重ならなければ undefined */
export function planOverlap(a: Rect, b: Rect): Rect | undefined {
  const x1 = Math.max(a.x1, b.x1);
  const x2 = Math.min(a.x2, b.x2);
  const y1 = Math.max(a.y1, b.y1);
  const y2 = Math.min(a.y2, b.y2);
  if (x2 - x1 > EPS && y2 - y1 > EPS) return { x1, y1, x2, y2 };
  return undefined;
}

/** 二つの空間が平面上で重なるか (合併同士) */
export function spacesOverlap(a: Space, b: Space): boolean {
  for (const ra of a.rects) {
    for (const rb of b.rects) {
      if (planOverlap(ra, rb)) return true;
    }
  }
  return false;
}

/** 境界線分上に位置を持つもの (開口・seg) の共通形 */
export interface Band {
  w: number;
  at: number;
  /** 明示位置 (通り参照 at:X2+450 の解決値)。指定時はクランプせず、はみ出しをエラーにする */
  atRef?: string;
  atAbs?: number;
  atAxis?: "X" | "Y";
  edge?: Edge;
  line: number;
}

export interface PlacedBand {
  segment: Segment;
  /** 中心の座標 mm */
  cx: number;
  cy: number;
}

/** placeBand が出しうる診断コード (ADR-0016 の台帳の部分集合 — check の emit が型で受ける) */
export type BandCode =
  | "OPN04" | "OPN05" | "OPN06" | "OPN07" | "OPN08"
  | "SEG04" | "SEG05" | "SEG06" | "SEG07" | "SEG08";

/** 帯の配置失敗 — error は互換の完成文 (位置接頭辞つき)。code/line/message は診断契約 (ADR-0016) の材料 */
export interface BandError {
  error: string;
  /** 診断コード — 開口は OPN04〜08、seg は SEG04〜08 (呼び手のlabelで決まる) */
  code: BandCode;
  line: number;
  file?: string;
  /** 位置接頭辞を除いた本文 */
  message: string;
}

/** 帯 (開口・seg) を境界線分上に配置する。曖昧なら error を返す */
export function placeBand(
  model: Model,
  b: Boundary,
  band: Band,
  label: string,
): PlacedBand | BandError {
  // 配置失敗の診断: label が "seg" なら SEG系、開口 (door/window等) なら OPN系のコード
  const fail = (n: "04" | "05" | "06" | "07" | "08", message: string): BandError => ({
    error: `${srcRef(band.line, b.file)}: ${message}`,
    code: (label === "seg" ? `SEG${n}` : `OPN${n}`) as BandCode,
    line: band.line,
    ...(b.file !== undefined ? { file: b.file } : {}),
    message,
  });
  let segs = segmentsFor(model, b);
  if (band.edge) segs = segs.filter((s) => s.edgeOfA === band.edge);
  if (segs.length === 0) {
    return fail("04", `No boundary segment can hold the ${label} (${b.a} | ${b.b})`);
  }
  if (segs.length > 1) {
    return fail("05", `There is more than one boundary segment; pick an edge with edge:N/E/S/W (${b.a} | ${b.b})`);
  }
  const seg = segs[0]!;
  const len = segmentLength(seg);
  if (band.w > len) {
    return fail("06", `The ${label} width ${band.w} exceeds the boundary segment length ${len}`);
  }
  const half = band.w / 2;
  let pos: number;
  if (band.atAbs !== undefined) {
    // 斜めの線分 (描かれた線) の上では、通り参照は一意に位置を定めない — 比率で書く
    if (seg.diagonal) {
      return fail(
        "07",
        `The ${label} position ${band.atRef} cannot be used on a diagonal segment (write it as a ratio, at:0..1)`,
      );
    }
    // 明示位置: 通り参照で置かれたものはクランプしない — はみ出しは言葉のエラーになる
    const axisOk = seg.horizontal ? band.atAxis === "X" : band.atAxis === "Y";
    if (!axisOk) {
      return fail(
        "07",
        // **期待する軸を言う。**書かれた軸を言うと「X1+200 は Y系で書かれています」のような
        // 偽の文になる (この枝は軸が食い違ったときにだけ通るので、書かれた軸は期待と逆である)
        `The ${label} position ${band.atRef} is on the wrong axis: ${
          seg.horizontal ? "a horizontal segment takes an X" : "a vertical segment takes a Y"
        } grid line`,
      );
    }
    const start = seg.horizontal ? seg.x1 : seg.y1;
    pos = band.atAbs - start;
    if (pos < half - EPS || pos > len - half + EPS) {
      return fail(
        "08",
        `At ${band.atRef} the ${label} (width ${band.w}) runs off the boundary segment (segment ${Math.round(
          start,
        )}-${Math.round(start + len)}mm, center allowed ${Math.round(start + half)}-${Math.round(
          start + len - half,
        )}mm)`,
      );
    }
  } else {
    pos = Math.min(Math.max(band.at * len, half), len - half);
  }
  // 線分上の位置はパラメトリックに取る — 軸平行でも斜めでも同じ一つの式
  const f = len > 0 ? pos / len : 0;
  return {
    segment: seg,
    cx: seg.x1 + f * (seg.x2 - seg.x1),
    cy: seg.y1 + f * (seg.y2 - seg.y1),
  };
}

/** 開口を境界線分上に配置する */
export function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | BandError {
  return placeBand(model, b, o, o.kind);
}

/**
 * 通行可能か。open境界と階段は扉なしで通れ、wall境界は扉があるときだけ通れる
 * (手すり = 扉のないwall+air:1 なので自動的に通れない)。
 * shaft (EV等) と void (吹抜け) は空間として連続するが人は通れない
 */
export function passable(b: Boundary): boolean {
  if (b.kind === "open" || b.kind === "stair") return true;
  if (b.kind === "shaft" || b.kind === "void") return false;
  return b.openings.some((o) => o.kind === "door");
}


/** 通過扉数 (open境界・階段=0, 扉付きwall境界=1) */
function doorCost(b: Boundary): number {
  return b.kind === "wall" ? 1 : 0;
}

export interface Route {
  doors: number;
  path: string[];
}

/** aからbまで扉をいくつ通るか (最小)。到達不能なら undefined */
export function doorsBetween(model: Model, from: string, to: string): Route | undefined {
  if (!model.spaces.has(from) || !model.spaces.has(to)) return undefined;
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  dist.set(from, 0);
  const queue: string[] = [from];
  const visited = new Set<string>();
  while (queue.length) {
    queue.sort((p, q) => (dist.get(p) ?? Infinity) - (dist.get(q) ?? Infinity));
    const u = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    for (const b of model.boundaries) {
      if (!passable(b)) continue;
      const v = b.a === u ? b.b : b.b === u ? b.a : undefined;
      if (!v || visited.has(v)) continue;
      const nd = (dist.get(u) ?? Infinity) + doorCost(b);
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        queue.push(v);
      }
    }
  }
  if (!dist.has(to)) return undefined;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!);
  return { doors: dist.get(to)!, path };
}

export interface NeighborInfo {
  space: Space;
  boundary: Boundary;
  passable: boolean;
  doors: number;
}

export function neighbors(model: Model, path: string): NeighborInfo[] {
  const out: NeighborInfo[] = [];
  for (const b of model.boundaries) {
    const other = b.a === path ? b.b : b.b === path ? b.a : undefined;
    if (!other) continue;
    const s = model.spaces.get(other);
    if (!s) continue;
    out.push({
      space: s,
      boundary: b,
      passable: passable(b),
      doors: b.openings.filter((o) => o.kind === "door").length,
    });
  }
  return out;
}
