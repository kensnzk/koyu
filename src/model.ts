// IFCXS v0 — データモデル
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

export interface Space {
  /** パスが同一性。/L1/a のように人間が読める階層で名指す */
  path: string;
  /** 開かれた語彙 (room, corridor, exterior, void, ...) */
  type: string;
  /** 所属レベル名 (パスの先頭セグメントがレベル名なら自動判定) */
  level?: string;
  /** グリッド参照 (X1..X2 Y1..Y2) */
  grid?: { xa: string; xb: string; ya: string; yb: string };
  /** グリッド解決後のmm矩形。exteriorなどは持たない */
  rect?: Rect;
  attrs: Attrs;
  line: number;
}

/**
 * 水平: wall (壁) / open (垂れ壁の有無を言わない開放的な分節 — 基本計画の抽象度)
 * 垂直: stair (階段 — 通行可) / shaft (EV等 — 連続するが通行不可)
 * 垂直の既定は床 (slab) であり書かない。levelのslab宣言が一括で与える。
 */
export type BoundaryKind = "wall" | "open" | "stair" | "shaft";

export interface Opening {
  kind: "door" | "window";
  /** 幅 mm */
  w: number;
  /** 高さ mm */
  h?: number;
  /** 区間上の位置 0..1 (既定 0.5) */
  at: number;
  /** 区間が複数あるとき (外部境界など) の辺の指定 */
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
  /** 境界をaの矩形から見た特定の辺に限定する */
  edge?: Edge;
  attrs: Attrs;
  openings: Opening[];
  line: number;
}

export interface Model {
  version: string;
  name?: string;
  unit: "mm";
  grid: { X: GridAxis; Y: GridAxis };
  levels: Record<string, Level>;
  spaces: Map<string, Space>;
  boundaries: Boundary[];
}

export class SourceError extends Error {
  constructor(
    public line: number,
    message: string,
  ) {
    super(`${line}行目: ${message}`);
    this.name = "SourceError";
  }
}

/** 面積 (壁芯) m² */
export function areaM2(s: Space): number | undefined {
  if (!s.rect) return undefined;
  const a = ((s.rect.x2 - s.rect.x1) * (s.rect.y2 - s.rect.y1)) / 1e6;
  return Math.round(a * 100) / 100;
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
      ...(s.grid ? { at: [s.grid.xa, s.grid.ya, s.grid.xb, s.grid.yb] } : {}),
      ...(Object.keys(s.attrs).length ? { attrs: sortObj(s.attrs) } : {}),
    };
  }
  const boundaries = [...model.boundaries]
    .map((b) => ({
      between: [b.a, b.b].sort(),
      kind: b.kind,
      ...(b.t !== undefined ? { t: b.t } : {}),
      ...(b.edge ? { edge: b.edge } : {}),
      ...(Object.keys(b.attrs).length ? { attrs: sortObj(b.attrs) } : {}),
      ...(b.openings.length
        ? {
            openings: b.openings.map((o) => ({
              kind: o.kind,
              w: o.w,
              ...(o.h !== undefined ? { h: o.h } : {}),
              at: o.at,
              ...(o.edge ? { edge: o.edge } : {}),
              ...(Object.keys(o.attrs).length ? { attrs: sortObj(o.attrs) } : {}),
            })),
          }
        : {}),
    }))
    .sort((x, y) => (x.between.join() < y.between.join() ? -1 : 1));

  const doc = {
    ifcxs: model.version,
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
    spaces,
    boundaries,
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}
