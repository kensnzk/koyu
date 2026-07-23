// koyu — 空間グラフ
// 節点が空間、辺が境界。「この室とこの室は繋がっているか」「ここから外へ扉いくつか」が
// 変換なしにそのままグラフへの問いになる。
// 空間の領域は矩形の合併 (L字など)。壁は合併の外周と共有辺から導出される。

import type { Boundary, Edge, Model, Opening, Rect, Space } from "./model.js";
import { srcRef } from "./model.js";

/** 壁芯線分 (mm)。水平なら y1===y2、垂直なら x1===x2 */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horizontal: boolean;
  /** boundary.a 側 (領域を持つ側) の矩形から見た辺 */
  edgeOfA?: Edge;
}

const EPS = 0.5;

/** 二つの矩形が共有する辺の線分 (触れていなければ undefined) */
export function sharedSegment(a: Rect, b: Rect): Segment | undefined {
  for (const [x, ea] of [
    [a.x2, "E"],
    [a.x1, "W"],
  ] as const) {
    const bx = ea === "E" ? b.x1 : b.x2;
    if (Math.abs(x - bx) < EPS) {
      const y1 = Math.max(a.y1, b.y1);
      const y2 = Math.min(a.y2, b.y2);
      if (y2 - y1 > EPS) return { x1: x, y1, x2: x, y2, horizontal: false, edgeOfA: ea };
    }
  }
  for (const [y, ea] of [
    [a.y2, "N"],
    [a.y1, "S"],
  ] as const) {
    const by = ea === "N" ? b.y1 : b.y2;
    if (Math.abs(y - by) < EPS) {
      const x1 = Math.max(a.x1, b.x1);
      const x2 = Math.min(a.x2, b.x2);
      if (x2 - x1 > EPS) return { x1, y1: y, x2, y2: y, horizontal: true, edgeOfA: ea };
    }
  }
  return undefined;
}

/** 矩形の指定辺の線分から、他の矩形と重なる区間を除いた残り */
function rectPerimeterRemainder(room: Rect, edge: Edge, others: Rect[]): Segment[] {
  const horizontal = edge === "N" || edge === "S";
  const fixed = edge === "N" ? room.y2 : edge === "S" ? room.y1 : edge === "E" ? room.x2 : room.x1;
  const lo = horizontal ? room.x1 : room.y1;
  const hi = horizontal ? room.x2 : room.y2;

  let intervals: Array<[number, number]> = [[lo, hi]];
  for (const o of others) {
    const touches = horizontal
      ? Math.abs((edge === "N" ? o.y1 : o.y2) - fixed) < EPS
      : Math.abs((edge === "E" ? o.x1 : o.x2) - fixed) < EPS;
    if (!touches) continue;
    const olo = horizontal ? o.x1 : o.y1;
    const ohi = horizontal ? o.x2 : o.y2;
    intervals = intervals.flatMap(([s, e]) => {
      const cs = Math.max(s, olo);
      const ce = Math.min(e, ohi);
      if (ce - cs <= EPS) return [[s, e] as [number, number]];
      const out: Array<[number, number]> = [];
      if (cs - s > EPS) out.push([s, cs]);
      if (e - ce > EPS) out.push([ce, e]);
      return out;
    });
  }
  return intervals.map(([s, e]) =>
    horizontal
      ? { x1: s, y1: fixed, x2: e, y2: fixed, horizontal: true, edgeOfA: edge }
      : { x1: fixed, y1: s, x2: fixed, y2: e, horizontal: false, edgeOfA: edge },
  );
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

/** 境界の壁芯線分を導く。壁の位置は空間の割付から生成される — 壁を置く操作は存在しない */
export function segmentsFor(model: Model, b: Boundary): Segment[] {
  const sa = model.spaces.get(b.a);
  const sb = model.spaces.get(b.b);
  if (!sa || !sb) return [];

  // 垂直境界 (stair/shaft/void/暗黙のslab) は壁線分を持たない
  if (b.kind === "stair" || b.kind === "shaft" || b.kind === "void") return [];

  let segs: Segment[] = [];
  const aHas = sa.rects.length > 0;
  const bHas = sb.rects.length > 0;

  if (aHas && bHas) {
    if (sa.level !== sb.level) return []; // 異なるレベル間に壁は立たない
    for (const ra of sa.rects) {
      for (const rb of sb.rects) {
        const s = sharedSegment(ra, rb);
        if (s) segs.push(s);
      }
    }
  } else if (aHas || bHas) {
    // 片側が領域を持たない (外部など): 合併の外周から、同レベルで接する他室の区間を除いた残り
    const roomSpace = aHas ? sa : sb;
    const others: Rect[] = [];
    for (const s of model.spaces.values()) {
      if (s === sa || s === sb) continue;
      if (s.level !== roomSpace.level) continue;
      others.push(...s.rects);
    }
    for (let ri = 0; ri < roomSpace.rects.length; ri++) {
      const room = roomSpace.rects[ri]!;
      const siblings = roomSpace.rects.filter((_, i) => i !== ri);
      const blockers = [...others, ...siblings];
      for (const e of ["N", "E", "S", "W"] as const) {
        segs.push(...rectPerimeterRemainder(room, e, blockers));
      }
    }
  }
  segs = mergeCollinear(segs);
  if (b.edge) segs = segs.filter((s) => s.edgeOfA === b.edge);
  return segs;
}

export function segmentLength(s: Segment): number {
  return s.horizontal ? s.x2 - s.x1 : s.y2 - s.y1;
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

/** 帯 (開口・seg) を境界線分上に配置する。曖昧なら error を返す */
export function placeBand(
  model: Model,
  b: Boundary,
  band: Band,
  label: string,
): PlacedBand | { error: string } {
  let segs = segmentsFor(model, b);
  if (band.edge) segs = segs.filter((s) => s.edgeOfA === band.edge);
  if (segs.length === 0) {
    return { error: `${srcRef(band.line, b.file)}: ${label} を置ける境界線分がありません (${b.a} | ${b.b})` };
  }
  if (segs.length > 1) {
    return {
      error: `${srcRef(band.line, b.file)}: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (${b.a} | ${b.b})`,
    };
  }
  const seg = segs[0]!;
  const len = segmentLength(seg);
  if (band.w > len) {
    return {
      error: `${srcRef(band.line, b.file)}: ${label}の幅 ${band.w} が境界線分の長さ ${len} を超えています`,
    };
  }
  const half = band.w / 2;
  let pos: number;
  if (band.atAbs !== undefined) {
    // 明示位置: 通り参照で置かれたものはクランプしない — はみ出しは言葉のエラーになる
    const axisOk = seg.horizontal ? band.atAxis === "X" : band.atAxis === "Y";
    if (!axisOk) {
      return {
        error: `${srcRef(band.line, b.file)}: ${label} の位置 ${band.atRef} は${
          seg.horizontal ? "水平線分なのでX系" : "垂直線分なのでY系"
        }の通りで指定します`,
      };
    }
    const start = seg.horizontal ? seg.x1 : seg.y1;
    pos = band.atAbs - start;
    if (pos < half - EPS || pos > len - half + EPS) {
      return {
        error: `${srcRef(band.line, b.file)}: 位置 ${band.atRef} では ${label} (幅${band.w}) が境界線分からはみ出します (線分 ${Math.round(
          start,
        )}〜${Math.round(start + len)}mm、中心の許容 ${Math.round(start + half)}〜${Math.round(
          start + len - half,
        )}mm)`,
      };
    }
  } else {
    pos = Math.min(Math.max(band.at * len, half), len - half);
  }
  return {
    segment: seg,
    cx: seg.horizontal ? seg.x1 + pos : seg.x1,
    cy: seg.horizontal ? seg.y1 : seg.y1 + pos,
  };
}

/** 開口を境界線分上に配置する */
export function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | { error: string } {
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
