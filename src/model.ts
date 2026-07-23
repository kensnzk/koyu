// koyu v0 — データモデル
// 一次要素は空間。壁は二つの空間の「境界」という関係であり、物ではない。
// 形はここには無い。形は生成物である。(docs/writing-architecture.md)

export type AttrValue = string | number;
export type Attrs = Record<string, AttrValue>;

/** 方位。edge指定は「最初に書いた空間」の矩形から見た辺。N=+Y, S=-Y, E=+X, W=-X */
export type Edge = "N" | "E" | "S" | "W";

export interface Level {
  name: string;
  /** FLの高さ mm */
  z: number;
  /** 階の基準天井高 mm */
  h?: number;
  /** この階の床組み厚 mm (下階の天井面から自階FLまで: スラブ+懐+仕上) */
  slab?: number;
}

export interface GridAxis {
  /** 通り名 (X1, X2, ...) */
  names: string[];
  /** 座標 mm */
  coords: number[];
}

/** mm矩形 (x1<x2, y1<y2) */
export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 数えない分節 — 室に従属する領域 (床材の切替など)。
 * 面積・室数・グラフには一切現れない。属性の上書きだけを運ぶ (ADR-0003)
 */
export interface Area {
  grid: { xa: string; xb: string; ya: string; yb: string };
  rect: Rect;
  attrs: Attrs;
  line: number;
}

export interface GridRef {
  xa: string;
  xb: string;
  ya: string;
  yb: string;
}

export interface Space {
  /** パスが同一性。/L1/a のように人間が読める階層で名指す。
   *  パスの第一義は集計の階層 — レベルは既定で先頭セグメントから読むが、
   *  階を跨ぐくくり (メゾネット) は level: 属性で明示する (ADR-0008) */
  path: string;
  /** 開かれた語彙 (room, corridor, exterior, void, ...) */
  type: string;
  /** 所属レベル名 (パス先頭セグメント、または level: 属性) */
  level?: string;
  /** グリッド参照。複数矩形の合併でL字などを表す (rectsと同順) */
  grids: GridRef[];
  /** グリッド解決後のmm矩形の合併。exteriorなどは空 */
  rects: Rect[];
  /** 数えない分節 (字下げのarea行) */
  areas: Area[];
  attrs: Attrs;
  line: number;
  /** 合成時の出所ファイル (コンフリクト報告用) */
  file?: string;
}

/**
 * ゾーン — 数える集約。住戸・部門など、空間の上位のくくり。
 * 幾何は持たず、パス接頭辞で束ねた空間の面積の合計として面積を持つ (ADR-0005)
 */
export interface Zone {
  path: string;
  attrs: Attrs;
  line: number;
  /** 合成時の出所ファイル (コンフリクト報告用) */
  file?: string;
}

/**
 * 建具アセット — RevitのFamily、USDのReferenceにあたる型の宣言 (ADR-0010)。
 * `asset SD1 door w:800 style:sliding` と宣言し、開口が `door SD1 ...` で参照する。
 * インスタンス側の属性が上書きする。別ファイル (アセット集) に置いて import できる
 */
export interface Asset {
  name: string;
  kind: "door" | "window";
  attrs: Attrs;
  line: number;
  file?: string;
}

/**
 * kindは関係のトポロジーだけを言う (IFCのIfcRelSpaceBoundaryがPhysical/Virtualしか
 * 言わないのと同じ構え)。手すり・カーテンウォールといった「実現する物」はspec語彙で、
 * kindには入れない (IfcRailingが要素であって境界種別でないことに倣う — ADR-0007)。
 * 水平: wall (物がある。扉がなければ通れない) / open (何もない — 通行可)
 * 垂直: stair (階段 — 通行可) / shaft (EV等 — 連続するが通行不可) /
 *       void (吹抜け — 床の不在)
 * 垂直の既定は床 (slab) であり書かない。levelのslab宣言が一括で与える。
 */
export type BoundaryKind = "wall" | "open" | "stair" | "shaft" | "void";

export interface Opening {
  kind: "door" | "window";
  /** 参照した建具アセット名 (Reference — ADR-0010) */
  ref?: string;
  /** 幅 mm */
  w: number;
  /** 高さ mm */
  h?: number;
  /** 区間上の位置 0..1 (既定 0.5)。比率指定はクランプされる */
  at: number;
  /** 明示位置: 書かれた通り参照 (at:X2+450 など) */
  atRef?: string;
  /** 明示位置: 解決済みの絶対座標 mm。はみ出しはエラーになる (クランプしない) */
  atAbs?: number;
  /** 明示位置の軸 (水平線分はX系、垂直線分はY系でなければならない) */
  atAxis?: "X" | "Y";
  /** 区間が複数あるとき (外部境界など) の辺の指定 */
  edge?: Edge;
  /** 開き勝手: 吊元の側 (水平線分ならW/E、垂直線分ならS/N)。既定は始端側 */
  hinge?: Edge;
  /** 開き勝手: 開く側 (境界のa側/b側)。既定はa側 (領域を持つ方) */
  swing?: "a" | "b";
  attrs: Attrs;
  line: number;
}

/**
 * 境界上の数えない分節 — 壁材が途中から変わる区間など。
 * 開口と同じ流儀で位置 (at, w) を持つが、通行・接続には一切影響しない (ADR-0003)
 */
export interface Seg {
  /** 幅 mm */
  w: number;
  /** 区間中心の位置 0..1 (既定 0.5) */
  at: number;
  /** 明示位置 (開口と同じ流儀 — at:X2+450) */
  atRef?: string;
  atAbs?: number;
  atAxis?: "X" | "Y";
  edge?: Edge;
  attrs: Attrs;
  line: number;
}

/** 境界はどちらの空間にも属さない。二つの空間パスを結ぶ第一級の関係 */
export interface Boundary {
  a: string;
  b: string;
  kind: BoundaryKind;
  /** 壁厚 mm (通り芯・境界線に対して芯振り分け) */
  t?: number;
  /** 遮蔽しない (air:1) — 手すり・柵など、物はあるが外気・光を遮らない。
   *  通行可能性はkindが言い (壁は扉がなければ通れない)、遮蔽性はこの属性が言う。
   *  外部に対して open または air:1 の境界を持つ空間が半屋外と導出される */
  air?: boolean;
  /** 境界をaの矩形から見た特定の辺に限定する */
  edge?: Edge;
  attrs: Attrs;
  openings: Opening[];
  /** 数えない分節 (字下げのseg行) */
  segs: Seg[];
  line: number;
  /** 合成時の出所レイヤー (ADR-0010) */
  file?: string;
}

/** エラー・警告の位置表記 — 合成時はどのレイヤーのことかを言葉にする (ADR-0010) */
export function srcRef(line: number, file?: string): string {
  return `${file ? `${file}:` : ""}${line}行目`;
}

export interface Model {
  version: string;
  name?: string;
  unit: "mm";
  grid: { X: GridAxis; Y: GridAxis };
  levels: Record<string, Level>;
  spaces: Map<string, Space>;
  zones: Map<string, Zone>;
  assets: Map<string, Asset>;
  boundaries: Boundary[];
  /** 敷地形状 — 所与のジオメトリ (ADR-0011)。パス→頂点列 (mm)。唯一、書かれる形 */
  polygons: Map<string, SitePolygon>;
}

/** 平面上の点 (mm) */
export interface Pt {
  x: number;
  y: number;
}

/** 敷地形状 (ADR-0011) — 測量に由来する所与の多角形。建物の形は生成物のままで、
 *  これはゾーン (site:1) に付く入力データ。隔離レイヤー (別ファイル+import) 推奨 */
export interface SitePolygon {
  path: string;
  points: Pt[];
  line: number;
  file?: string;
}

/** 多角形の面積 ㎡ (シューレース公式)。頂点は順不同 (時計/反時計どちらでも) */
export function polygonAreaM2(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2 / 1e6;
}

/** 点が多角形の内側にあるか (境界上は内側扱い、許容誤差eps mm) */
export function pointInPolygon(p: Pt, poly: Pt[], eps = 1): boolean {
  // 境界上の判定 (線分との距離 ≤ eps)
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
  // レイキャスト
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

export class SourceError extends Error {
  constructor(
    public line: number,
    /** 位置情報を除いた本文 (合成時のファイル付与に使う) */
    public raw: string,
    /** 出所ファイル (合成時) */
    public file?: string,
  ) {
    super(`${file ? `${file}:` : ""}${line}行目: ${raw}`);
    this.name = "SourceError";
  }
}

/** 面積 (壁芯) m²。複数矩形は合計 (重なりはcheckが禁じる) */
export function areaM2(s: Space): number | undefined {
  if (s.rects.length === 0) return undefined;
  const a = s.rects.reduce((sum, r) => sum + (r.x2 - r.x1) * (r.y2 - r.y1), 0) / 1e6;
  return Math.round(a * 100) / 100;
}

/**
 * 半屋外か — 宣言ではなく導出。外部 (type:exterior) に対して
 * open または air:1 (手すり等、遮蔽しない物) の境界で接する空間は半屋外である (ADR-0007)
 */
export function isSemiOutdoor(model: Model, s: Space): boolean {
  if (s.rects.length === 0) return false;
  for (const b of model.boundaries) {
    if (b.kind !== "open" && !b.air) continue;
    const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
    if (!other) continue;
    if (model.spaces.get(other)?.type === "exterior") return true;
  }
  return false;
}

/**
 * 上に (どのレベルであれ) 空間が重なっているか — 庇下・バルコニー下の導出。
 * 採光の半屋外係数 (庇下0.7 / 上が開いていれば1.0) などが読む (ADR-0009)
 */
export function isCoveredAbove(model: Model, s: Space): boolean {
  if (s.rects.length === 0 || !s.level) return false;
  const z = model.levels[s.level]?.z;
  if (z === undefined) return false;
  for (const o of model.spaces.values()) {
    if (o === s || o.rects.length === 0 || !o.level) continue;
    const oz = model.levels[o.level]?.z;
    if (oz === undefined || oz <= z) continue;
    for (const ra of s.rects) {
      for (const rb of o.rects) {
        const x = Math.min(ra.x2, rb.x2) - Math.max(ra.x1, rb.x1);
        const y = Math.min(ra.y2, rb.y2) - Math.max(ra.y1, rb.y1);
        if (x > 0.5 && y > 0.5) return true;
      }
    }
  }
  return false;
}

/** 矩形集合の合併面積 m² (水平投影 — 建築面積の導出に使う)。座標圧縮による厳密計算 */
export function unionAreaM2(rects: Rect[]): number {
  if (rects.length === 0) return 0;
  const xs = [...new Set(rects.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y1, r.y2]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const cx = (xs[i]! + xs[i + 1]!) / 2;
      const cy = (ys[j]! + ys[j + 1]!) / 2;
      if (rects.some((r) => cx > r.x1 && cx < r.x2 && cy > r.y1 && cy < r.y2)) {
        area += (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!);
      }
    }
  }
  return Math.round((area / 1e6) * 100) / 100;
}

/** ゾーンの面積 = パス接頭辞で束ねた空間の合計 (吹抜けと半屋外は数えない — 専有面積の言葉) */
export function zoneAreaM2(model: Model, zonePath: string): number {
  let sum = 0;
  for (const s of model.spaces.values()) {
    if (!s.path.startsWith(zonePath + "/")) continue;
    if (s.type === "void") continue;
    if (isSemiOutdoor(model, s)) continue;
    sum += areaM2(s) ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

/** 実効use属性 — 自分に無ければ、最も深いゾーン祖先から継承する */
export function effectiveUse(model: Model, s: Space): string | undefined {
  const own = s.attrs["use"];
  if (typeof own === "string") return own;
  let best: string | undefined;
  let bestLen = -1;
  for (const z of model.zones.values()) {
    if (s.path.startsWith(z.path + "/") && z.path.length > bestLen) {
      const u = z.attrs["use"];
      if (typeof u === "string") {
        best = u;
        bestLen = z.path.length;
      }
    }
  }
  return best;
}

/** 空間の有効天井高 mm (space自身のh属性 → レベルのh の順) */
export function heff(model: Model, s: Space): number | undefined {
  const own = s.attrs["h"];
  if (typeof own === "number") return own;
  return s.level ? model.levels[s.level]?.h : undefined;
}

/** レベルをzの昇順で返す */
export function levelsSorted(model: Model): Level[] {
  return Object.values(model.levels).sort((a, b) => a.z - b.z);
}

export function displayName(s: Space): string {
  const n = s.attrs["name"];
  return typeof n === "string" ? n : (s.path.split("/").pop() ?? s.path);
}

/** 正準JSON — 機械形式。差分とレイヤー合成の土台 (キーは安定順) */
export function toCanonical(model: Model): string {
  const spaces: Record<string, unknown> = {};
  for (const p of [...model.spaces.keys()].sort()) {
    const s = model.spaces.get(p)!;
    spaces[p] = {
      type: s.type,
      ...(s.grids.length === 1
        ? { at: [s.grids[0]!.xa, s.grids[0]!.ya, s.grids[0]!.xb, s.grids[0]!.yb] }
        : s.grids.length > 1
          ? { at: s.grids.map((g) => [g.xa, g.ya, g.xb, g.yb]) }
          : {}),
      ...(Object.keys(s.attrs).length ? { attrs: sortObj(s.attrs) } : {}),
      ...(s.areas.length
        ? {
            areas: s.areas.map((a) => ({
              at: [a.grid.xa, a.grid.ya, a.grid.xb, a.grid.yb],
              ...(Object.keys(a.attrs).length ? { attrs: sortObj(a.attrs) } : {}),
            })),
          }
        : {}),
    };
  }
  const boundaries = [...model.boundaries]
    .map((b) => ({
      between: [b.a, b.b].sort(),
      kind: b.kind,
      ...(b.t !== undefined ? { t: b.t } : {}),
      ...(b.air ? { air: true } : {}),
      ...(b.edge ? { edge: b.edge } : {}),
      ...(Object.keys(b.attrs).length ? { attrs: sortObj(b.attrs) } : {}),
      ...(b.openings.length
        ? {
            openings: b.openings.map((o) => ({
              kind: o.kind,
              ...(o.ref ? { ref: o.ref } : {}),
              w: o.w,
              ...(o.h !== undefined ? { h: o.h } : {}),
              at: o.atRef ?? o.at,
              ...(o.edge ? { edge: o.edge } : {}),
              ...(o.hinge ? { hinge: o.hinge } : {}),
              ...(o.swing ? { swing: o.swing } : {}),
              ...(Object.keys(o.attrs).length ? { attrs: sortObj(o.attrs) } : {}),
            })),
          }
        : {}),
      ...(b.segs.length
        ? {
            segs: b.segs.map((g) => ({
              w: g.w,
              at: g.at,
              ...(g.edge ? { edge: g.edge } : {}),
              ...(Object.keys(g.attrs).length ? { attrs: sortObj(g.attrs) } : {}),
            })),
          }
        : {}),
    }))
    .sort((x, y) => (x.between.join() < y.between.join() ? -1 : 1));

  const zones: Record<string, unknown> = {};
  for (const p of [...model.zones.keys()].sort()) {
    const z = model.zones.get(p)!;
    zones[p] = Object.keys(z.attrs).length ? { attrs: sortObj(z.attrs) } : {};
  }
  const assets: Record<string, unknown> = {};
  for (const n of [...model.assets.keys()].sort()) {
    const a = model.assets.get(n)!;
    assets[n] = { kind: a.kind, ...(Object.keys(a.attrs).length ? { attrs: sortObj(a.attrs) } : {}) };
  }
  const polygons: Record<string, number[][]> = {};
  for (const p of [...model.polygons.keys()].sort()) {
    polygons[p] = model.polygons.get(p)!.points.map((pt) => [pt.x, pt.y]);
  }

  const doc = {
    koyu: model.version,
    ...(model.name ? { name: model.name } : {}),
    unit: model.unit,
    grid: { X: model.grid.X.coords, Y: model.grid.Y.coords },
    levels: sortObj(
      Object.fromEntries(
        Object.entries(model.levels).map(([k, v]) => [
          k,
          {
            z: v.z,
            ...(v.h !== undefined ? { h: v.h } : {}),
            ...(v.slab !== undefined ? { slab: v.slab } : {}),
          },
        ]),
      ),
    ),
    ...(Object.keys(assets).length ? { assets } : {}),
    ...(Object.keys(polygons).length ? { polygons } : {}),
    ...(Object.keys(zones).length ? { zones } : {}),
    spaces,
    boundaries,
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}
