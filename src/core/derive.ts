// koyu — 形の参照実装 (ADR-0040 / spec/derivation.md)
//
// **`derive(model)` が形の唯一の入口である。**
//
// ここまで、形は消費者ごとに組み立てられていた — `src/draw/plan.ts` が `segmentsFor` と
// `placeOpening` を呼び、ugatsu の `PlanView` と `buildScene` も同じ部品を別々に呼んでいた。
// 部品は共有されていても**組み立ての規則は共有されていない**ので、同じ原本から違う形が出た:
// 上部吹抜けの投影が ugatsu の平面から 11 件落ち、最上階の壁の上端は koyu と ugatsu で
// 150mm 割れ、壁厚の既定 100mm は四箇所に別々のリテラルとして書かれていた。
//
// **Form は見た目を持たない** (spec/scope.md §6)。返すのは座標・厚み・z 範囲・向き・
// そして対象の同一性だけである。色も書体も線幅も注記文字列も記号も縮尺も紙面の余白も、
// この型のどこにも現れない。`src/draw/` と ugatsu はこれを描くだけである。
//
// **平面は純粋な断面ではない。**扉の軌跡 (動きの記号)、上部吹抜けの投影 (切断面より上)、
// 切断線 (切れたことの位置)、下りる走り (切断面より下の見えがかり) は、立体を平面で切っても
// 出てこない。だから Form は平面を**分類つきの2Dエンティティ集合**として持つ — 各要素が
// (幾何・分類・対象の同一性) を持ち、分類は cut / below / above / swing / anchor に割れる。
// 切断高さは Form の**入力**であって中身ではない。

import { CEILING_T, ROOF_T, slabs, type Slab } from "./fabric.js";
import { placeBand, placeOpening, segmentLength, segmentsFor, type Segment } from "./graph.js";
import {
  areaM2,
  columnsFor,
  heff,
  isCoveredAbove,
  isIndoor,
  isSemiOutdoor,
  levelsSorted,
  polyBounds,
  polygonAreaM2,
  rectToPoly,
  regionOf,
  type Boundary,
  type BoundaryKind,
  type Column,
  type Model,
  type Opening,
  type Pt,
  type Space,
  canonicalBoundaryOrder,
  canonicalOpeningOrder,
  canonicalSegOrder,
  canonicalSpaceOrder,
  isOutside,
  isVoid
} from "./model.js";
import { EPS, SPAN_EPS } from "./tolerance.js";
import {
  CUT_HEIGHT,
  ARROW_SPAN_MIN,
  DEFAULT_RISER_MAX,
  ENTRY_LANDING,
  LANDING_MIN,
  LANE_ESCALATOR,
  runDrawsForLevel,
  runSolids,
  SLAB_T,
  STEP_MARK,
  TREAD_SOLID,
  TREAD_TARGET,
  verticalRuns,
  type RunSolid,
  type Seg2,
  type VerticalRun,
} from "./vertical.js";

// ---- 導出の定数 ----------------------------------------------------------
//
// **台帳の既定ではない。**台帳 (vocabulary.ts) が定めるのは「何を書いてよいか」であり、
// ここが定めるのは「書かれなかったときに何を導くか」である。書けば必ず書いた値が勝つ。

/** 壁厚の既定 mm。芯線に対して両側へ t/2 ずつ振り分ける (`t:` で上書き) */
export const WALL_T = 100;
/** 遮蔽しない境界 (air:1 — 手すり・柵) の厚みの既定 mm (`t:` で上書き) */
export const RAIL_T = 60;
/** 遮蔽しない境界の厚みの上限 mm。`t:` に何を書いてもここで頭打ちになる */
export const RAIL_T_MAX = 80;
/** 遮蔽しない境界の天端高 mm (境界の `h:` で上書き) */
export const RAIL_H = 1100;
/** 開口のまぐさ高 mm。扉はここまで立ち上がり、それ以外はここから下がる */
export const OPENING_HEAD = 2000;
/** 扉以外の開口の高さの既定 mm (開口の `h:` で上書き) */
export const OPENING_H = 1200;

/**
 * 導出の定数の台帳。**spec/derivation.md の表の唯一の出所である** —
 * `test/derive.test.ts` が表とここの一致を縛る (語彙台帳と spec/vocabulary.md と同じ構え)。
 */
export const DERIVATION_CONSTANTS: Readonly<Record<string, number>> = {
  WALL_T,
  RAIL_T,
  RAIL_T_MAX,
  RAIL_H,
  OPENING_HEAD,
  OPENING_H,
  CEILING_T,
  ROOF_T,
  CUT_HEIGHT,
  DEFAULT_RISER_MAX,
  TREAD_TARGET,
  ARROW_SPAN_MIN,
  LANDING_MIN,
  ENTRY_LANDING,
  LANE_ESCALATOR,
  TREAD_SOLID,
  SLAB_T,
  STEP_MARK,
};

// ---- Form ----------------------------------------------------------------

/** 導出の入力 — **形を決める引数**。縮尺も余白も向きもここには無い (それは見た目である) */
export interface DeriveOptions {
  /** 平面の切断面の高さ mm (FL から。既定 1200) */
  cut?: number;
}

export interface FormInput {
  cut: number;
}

export interface FormLevel {
  name: string;
  z: number;
  h?: number;
  slab?: number;
  /**
   * 階高 mm — 壁と柱がどこまで立つか。上のレベルがあればその差、無ければ
   * その階の最大天井高 + 屋根版の厚さ (屋根の頂点に揃う)。決まらなければ undefined で、
   * そのレベルには壁も柱も**立たない** (SUF01 が既に error として言う)
   */
  pitch?: number;
}

export interface FormSpace {
  path: string;
  /** 書かれた自由なラベル。導出はこれを読まない — 構成の事実は [[outside]] / [[void]] にある */
  type?: string;
  level?: string;
  /** 導出された領域 (凸片)。反時計回り */
  outline: Pt[][];
  areaM2?: number;
  /** 気積 — 天井高が決まるときだけ */
  z0?: number;
  z1?: number;
  indoor: boolean;
  semiOutdoor: boolean;
  /** 建物の外部と宣言されているか (`outside:1`)。半屋外は外部ではない — [[indoor]] と併せて読む */
  outside: boolean;
  /** 吹抜けと宣言されているか (`void:1`)。床が無いので面積にも通行にも数えない */
  void: boolean;
  /** 上に空間が重なっているか */
  covered: boolean;
}

/** 壁の実体。開口で割られた区間の一枚 */
export interface FormPanel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z0: number;
  z1: number;
}

/** 境界の実体 — 芯線分と、物があるならその材 */
export interface FormBoundary {
  /** 関係の同一性 — 両端の空間と、宣言の並びの中の位置 (spec/scope.md §5) */
  ref: string;
  boundary: number;
  a: string;
  b: string;
  kind: BoundaryKind;
  /** 接触から導かれた既定境界か (ADR-0014) */
  derived: boolean;
  level?: string;
  air: boolean;
  segment: Segment;
  /** 物があるとき (kind:wall) だけ。open は線だけを持ち、材を持たない */
  material?: {
    t: number;
    z0: number;
    z1: number;
    /** 開口で割られた区間 (全高・腰壁・垂れ壁)。**平面の欠き取りはここから消える** */
    panels: FormPanel[];
  };
}

/** 扉が開く先と、その軌跡の幾何。円弧の中心・半径・掃き方向は形である */
export interface FormSwing {
  /** 開く先の空間 */
  into: string;
  /** 吊元 */
  hinge: Pt;
  /** 葉が開ききった先 (吊元から開く側へ幅のぶん) */
  leaf: Pt;
  /** 開口の反対の側柱 (吊元から線分に沿って幅のぶん) */
  jamb: Pt;
  /** 軌跡が反時計回りか */
  ccw: boolean;
}

export interface FormOpening {
  /** 開口の同一性 — 境界と、その中の並びの位置 (spec/scope.md §5) */
  ref: string;
  boundary: number;
  index: number;
  a: string;
  b: string;
  kind: "door" | "window";
  name?: string;
  level?: string;
  segment: Segment;
  /** 中心 mm */
  cx: number;
  cy: number;
  w: number;
  z0: number;
  z1: number;
  /** 建具の見付け厚 = 壁厚 */
  t: number;
  style?: string;
  /** 扉が開く先 (引戸・自動扉なら軌跡ではなく引き込みの向き) */
  swing?: FormSwing;
  /** 引き戸か (style:sliding / style:auto) */
  sliding: boolean;
}

export interface FormSeg {
  /** 分節の同一性 — 境界と、その中の並びの位置 */
  ref: string;
  boundary: number;
  index: number;
  level?: string;
  segment: Segment;
  cx: number;
  cy: number;
  w: number;
  /** 帯の厚み = 壁厚 */
  t: number;
}

export interface FormColumn extends Column {
  ref: string;
  z0: number;
  z1: number;
}

export interface FormRun extends VerticalRun {
  solids: RunSolid[];
}

export interface FormSite {
  path: string;
  points: Pt[];
  areaM2: number;
}

/** 2Dエンティティの分類 — 平面が純粋な断面でないことを、この五つが言う */
export type PlanClass =
  /** 切断面が切ったもの */
  | "cut"
  /** 切断面より下の見えがかり */
  | "below"
  /** 切断面より上のものの投影 */
  | "above"
  /** 動きの軌跡 (扉) */
  | "swing"
  /** 記号を置く座 */
  | "anchor";

export type PlanSubject = "space" | "boundary" | "opening" | "column" | "run";

/** 縦動線のエンティティが何の線か (作図の役) */
export type PlanRole = "outline" | "tread" | "break" | "arrow";

export interface PlanEntity {
  class: PlanClass;
  of: PlanSubject;
  /** 対象の同一性 */
  ref: string;
  role?: PlanRole;
  polygon?: Pt[];
  lines?: Seg2[];
  arc?: { cx: number; cy: number; r: number; from: Pt; to: Pt; ccw: boolean };
  /** 記号・注記を置く座と、そこで人が上るか */
  anchor?: { x: number; y: number; up?: boolean };
}

export interface FormPlan {
  level: string;
  /** FL からの切断高さ mm (Form の入力) */
  cut: number;
  /** 世界座標での切断面の高さ mm */
  cutZ: number;
  entities: PlanEntity[];
}

/**
 * 形。**見た目を一つも持たない** (spec/scope.md §6)。
 * 座標・厚み・z 範囲・向き・対象の同一性だけを持ち、描き方は消費者が決める
 */
export interface Form {
  input: FormInput;
  levels: FormLevel[];
  spaces: FormSpace[];
  boundaries: FormBoundary[];
  openings: FormOpening[];
  /** 数えない分節 (ADR-0003) — 面積にもグラフにも現れないが、位置は導出される */
  segs: FormSeg[];
  slabs: Slab[];
  columns: FormColumn[];
  runs: FormRun[];
  site: FormSite[];
  plans: FormPlan[];
}

// ---- 導出 ----------------------------------------------------------------

/**
 * レベルの階高 mm — 壁と柱がどこまで立つか。
 *
 * 上のレベルがあれば、その差がそのまま階高である。**上が無いときは屋根の頂点に揃える** —
 * `slabs()` が最上階の屋根を `level.z + heff + ROOF_T` に架けるので、同じ式でなければ
 * 壁が屋根を突き抜けるか、屋根の下に隙間が空く。天井高が一つも決まらなければ階高も
 * 決まらず、そのレベルには壁も柱も立たない (既定値を捏造しない — SUF01 が言う)。
 */
export function levelPitch(model: Model, level: string): number | undefined {
  const levels = levelsSorted(model);
  const li = levels.findIndex((l) => l.name === level);
  if (li < 0) return undefined;
  const l = levels[li]!;
  const up = levels[li + 1];
  if (up) return up.z - l.z;
  let top: number | undefined = l.h;
  for (const s of model.spaces.values()) {
    if (s.level !== level || s.rects.length === 0) continue;
    const h = heff(model, s);
    if (h !== undefined && (top === undefined || h > top)) top = h;
  }
  return top === undefined ? undefined : top + ROOF_T;
}

/** 境界が立つレベル — 領域を持つ側の空間が決める (a を先に見る) */
function boundaryRoom(model: Model, b: Boundary): Space | undefined {
  const sa = model.spaces.get(b.a);
  const sb = model.spaces.get(b.b);
  if (sa && sa.rects.length > 0) return sa;
  if (sb && sb.rects.length > 0) return sb;
  return sa ?? sb;
}

/** 関係の同一性の綴り。`#` は色の綴りと紛れるので使わない (test/derive.test.ts が縛る) */
const boundaryRef = (b: Boundary, i: number): string => `${b.a}|${b.b}@${i}`;

/** 線分上の距離 u の点 */
function alongPoint(seg: Segment, u: number, len: number): Pt {
  const f = len > 0 ? u / len : 0;
  return { x: seg.x1 + f * (seg.x2 - seg.x1), y: seg.y1 + f * (seg.y2 - seg.y1) };
}

/** 二つの線分が同じか (座標の厳密一致 — 導出された線分の同一性の粒度) */
const sameSegment = (a: Segment, b: Segment): boolean =>
  a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;

/**
 * 壁を開口で割る。**「壁の黒帯を紙の色で塗り潰す」という操作は、これがあれば要らない。**
 * 平面でも立体でも、壁は最初から穴の空いた区間の列として現れる。
 */
function panelsOf(
  seg: Segment,
  z0: number,
  z1: number,
  holes: Array<{ lo: number; hi: number; z0: number; z1: number }>,
): FormPanel[] {
  const len = segmentLength(seg);
  const out: FormPanel[] = [];
  const push = (u0: number, u1: number, a: number, b: number): void => {
    if (u1 - u0 <= SPAN_EPS || b - a <= SPAN_EPS) return;
    const p = alongPoint(seg, u0, len);
    const q = alongPoint(seg, u1, len);
    out.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, z0: a, z1: b });
  };
  let cursor = 0;
  for (const h of [...holes].sort((p, q) => p.lo - q.lo)) {
    const lo = Math.max(cursor, Math.min(len, h.lo));
    const hi = Math.max(lo, Math.min(len, h.hi));
    push(cursor, lo, z0, z1);
    push(lo, hi, z0, Math.max(z0, Math.min(z1, h.z0)));
    push(lo, hi, Math.max(z0, Math.min(z1, h.z1)), z1);
    cursor = Math.max(cursor, hi);
  }
  push(cursor, len, z0, z1);
  return out;
}

/**
 * 扉の開く先と軌跡。
 *
 * 開く先は `swing:a/b`、無ければ領域を持つ側 (a を先に見る)。向きは開く先の**導出された形**の
 * うち、開口に最も近い凸片の中心へ向かう成分で決める。**割付ではなく形を読む** —
 * 描かれた線で切られた空間では、最も近い割付の中心が線の反対側に落ちうる。
 */
function swingOf(
  model: Model,
  b: Boundary,
  o: Opening,
  seg: Segment,
  cx: number,
  cy: number,
): FormSwing | undefined {
  const sa = model.spaces.get(b.a);
  const sb = model.spaces.get(b.b);
  let into: Space | undefined;
  if (o.swing === "a") into = sa;
  else if (o.swing === "b") into = sb;
  else into = sa && sa.rects.length > 0 ? sa : sb;
  if (!into) return undefined;
  const pieces = regionOf(into);
  if (pieces.length === 0) return undefined;
  const centre = pieces
    .map((p) => {
      const r = polyBounds(p);
      return { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };
    })
    .sort((p, q) => (p.x - cx) ** 2 + (p.y - cy) ** 2 - ((q.x - cx) ** 2 + (q.y - cy) ** 2))[0]!;

  let hinge: Pt;
  let along: Pt;
  let inward: Pt;
  if (seg.diagonal) {
    // 斜めの線分では吊元を始端側に固定する — hinge の N/E/S/W は軸の言葉なので使えない。
    // 開く側は法線のうち開く空間の中心へ向く方をとる
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy) || 1;
    along = { x: dx / len, y: dy / len };
    const n = { x: -along.y, y: along.x };
    const sign = n.x * (centre.x - cx) + n.y * (centre.y - cy) >= 0 ? 1 : -1;
    inward = { x: n.x * sign, y: n.y * sign };
    hinge = { x: cx - along.x * (o.w / 2), y: cy - along.y * (o.w / 2) };
  } else if (seg.horizontal) {
    const fromEast = o.hinge === "E";
    hinge = { x: fromEast ? cx + o.w / 2 : cx - o.w / 2, y: cy };
    along = { x: fromEast ? -1 : 1, y: 0 };
    inward = { x: 0, y: centre.y > cy ? 1 : -1 };
  } else {
    const fromNorth = o.hinge === "N";
    hinge = { x: cx, y: fromNorth ? cy + o.w / 2 : cy - o.w / 2 };
    along = { x: 0, y: fromNorth ? -1 : 1 };
    inward = { x: centre.x > cx ? 1 : -1, y: 0 };
  }
  const leaf = { x: hinge.x + inward.x * o.w, y: hinge.y + inward.y * o.w };
  const jamb = { x: hinge.x + along.x * o.w, y: hinge.y + along.y * o.w };
  const cross =
    (leaf.x - hinge.x) * (jamb.y - hinge.y) - (leaf.y - hinge.y) * (jamb.x - hinge.x);
  return { into: into.path, hinge, leaf, jamb, ccw: cross > 0 };
}

// ---- 実体の構成子 --------------------------------------------------------
//
// **Form が持つのは芯線と厚みと z である。**そこから実体 (厚みのある四辺形・立体の角柱) を
// 組み立てる規則も導出の一部なので、ここが唯一の実装を持つ (spec/derivation.md §7)。
// 描画側がそれぞれ書き直せば、同じ Form から違う形が出る余地がまた開く — ADR-0040 が
// 数えた「壁厚 100mm が四箇所に別々のリテラルとして書かれていた」のと同じ壊れ方である。

/**
 * 芯線を厚みのある四辺形へ。**厚みは芯線に対して両側へ半分ずつ振り分ける**
 * (spec/derivation.md §3.1)。単位法線へ ±t/2 だけ振るので斜めの線分でも同じ一つの式である。
 * 頂点は 始点+n → 終点+n → 終点−n → 始点−n の順で、`0番と3番の中点`〜`1番と2番の中点`が芯線に戻る。
 */
export function thicken(x1: number, y1: number, x2: number, y2: number, t: number): Pt[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (t / 2);
  const ny = (dx / len) * (t / 2);
  return [
    { x: x1 + nx, y: y1 + ny },
    { x: x2 + nx, y: y2 + ny },
    { x: x2 - nx, y: y2 - ny },
    { x: x1 - nx, y: y1 - ny },
  ];
}

/** 帯 (開口・seg) が線分上で占める区間 — 中心から線分の向きへ幅の半分ずつ */
export function bandLine(seg: Segment, cx: number, cy: number, w: number): Seg2 {
  const len = segmentLength(seg) || 1;
  const ux = ((seg.x2 - seg.x1) / len) * (w / 2);
  const uy = ((seg.y2 - seg.y1) / len) * (w / 2);
  return { x1: cx - ux, y1: cy - uy, x2: cx + ux, y2: cy + uy };
}

/** 帯を厚みのある四辺形へ (開口の建具・seg の帯はどちらもこれ) */
export function band(seg: Segment, cx: number, cy: number, w: number, t: number): Pt[] {
  const g = bandLine(seg, cx, cy, w);
  return thicken(g.x1, g.y1, g.x2, g.y2, t);
}

/** 柱の断面 — 通り芯の交点を中心に、幅と奥行の半分ずつ */
export function columnRect(c: { x: number; y: number; w: number; d: number }): Pt[] {
  return rectToPoly({ x1: c.x - c.w / 2, y1: c.y - c.d / 2, x2: c.x + c.w / 2, y2: c.y + c.d / 2 });
}

/** 立体の一片 — 底面の輪郭と、頂点ごとの下端/上端 z。箱も傾いた版もこれで足りる */
export interface FormPrism {
  poly: Pt[];
  bottom: number[];
  top: number[];
}

/**
 * 縦動線の立体を角柱へ。**傾いた版の四隅の高さは、走る向きに線形で振る** —
 * `up` 側が高い (spec/derivation.md §4.6)。箱は四隅とも同じ高さになる。
 */
export function runPrism(s: RunSolid): FormPrism {
  const poly = rectToPoly(s.rect);
  if (s.kind === "box") {
    return { poly, bottom: poly.map(() => s.z0), top: poly.map(() => s.z1) };
  }
  const r = s.rect;
  const top = poly.map((p) => {
    const u =
      s.up === "E"
        ? (p.x - r.x1) / Math.max(1, r.x2 - r.x1)
        : s.up === "W"
          ? (r.x2 - p.x) / Math.max(1, r.x2 - r.x1)
          : s.up === "N"
            ? (p.y - r.y1) / Math.max(1, r.y2 - r.y1)
            : (r.y2 - p.y) / Math.max(1, r.y2 - r.y1);
    return s.z0 + u * (s.z1 - s.z0);
  });
  return { poly, bottom: top.map((z) => z - s.t), top };
}

const spans = (z0: number, z1: number, z: number): boolean => z >= z0 - SPAN_EPS && z <= z1 + SPAN_EPS;

/**
 * 形を導く。**これが形の唯一の入口である。**
 *
 * 引数は原本と、形を決める引数だけ (切断高さ)。返る `Form` は見た目を持たない。
 */
export function derive(model: Model, opts: DeriveOptions = {}): Form {
  const cut = opts.cut ?? CUT_HEIGHT;
  const levels = levelsSorted(model);

  // ---- レベル ----
  const formLevels: FormLevel[] = levels.map((l) => ({
    name: l.name,
    z: l.z,
    ...(l.h !== undefined ? { h: l.h } : {}),
    ...(l.slab !== undefined ? { slab: l.slab } : {}),
    ...(levelPitch(model, l.name) !== undefined ? { pitch: levelPitch(model, l.name)! } : {}),
  }));
  const pitchOf = new Map(formLevels.map((l) => [l.name, l.pitch]));
  const zOf = new Map(levels.map((l) => [l.name, l.z]));

  // ---- 空間 ----
  // Canonical order, not declaration order. The canonical form discards declaration order,
  // so a shape that reads it yields two different `Form`s for one building (promise 1)
  const spaces: FormSpace[] = [];
  for (const s of canonicalSpaceOrder(model)) {
    if (s.rects.length === 0) continue;
    const h = heff(model, s);
    const z = s.level !== undefined ? zOf.get(s.level) : undefined;
    spaces.push({
      path: s.path,
      ...(s.type !== undefined ? { type: s.type } : {}),
      ...(s.level !== undefined ? { level: s.level } : {}),
      outline: regionOf(s),
      ...(areaM2(s) !== undefined ? { areaM2: areaM2(s)! } : {}),
      ...(z !== undefined && h !== undefined ? { z0: z, z1: z + h } : {}),
      indoor: isIndoor(model, s),
      semiOutdoor: isSemiOutdoor(model, s),
      outside: isOutside(s),
      void: isVoid(s),
      covered: isCoveredAbove(model, s),
    });
  }

  // ---- 境界と開口 ----
  const boundaries: FormBoundary[] = [];
  const openings: FormOpening[] = [];
  const segs: FormSeg[] = [];
  // **関係の同一性の綴りは正準順で振る** — 宣言順で振ると、正準JSONが同じでも
  // `a|b@0` と `a|b@1` に割れる (ADR-0041)
  for (const [bi, b] of canonicalBoundaryOrder(model).entries()) {
    const wallSegs = segmentsFor(model, b);
    if (wallSegs.length === 0) continue;
    const room = boundaryRoom(model, b);
    const level = room?.level;
    const z0 = level !== undefined ? zOf.get(level) : undefined;
    const pitch = level !== undefined ? pitchOf.get(level) : undefined;
    const ref = boundaryRef(b, bi);

    // この境界の開口を、載っている線分ごとに集める
    const placed: Array<{ o: Opening; index: number; seg: Segment; cx: number; cy: number }> = [];
    // Canonical order, not declaration order — the index is part of the identity spelling
    for (const [oi, o] of canonicalOpeningOrder(b).entries()) {
      const p = placeOpening(model, b, o);
      if ("error" in p) continue;
      placed.push({ o, index: oi, seg: p.segment, cx: p.cx, cy: p.cy });
    }

    const t = b.air ? Math.min(b.t ?? RAIL_T, RAIL_T_MAX) : (b.t ?? WALL_T);
    let top: number | undefined;
    if (z0 !== undefined) {
      if (b.air) {
        const written = b.attrs["h"];
        top = z0 + (typeof written === "number" ? written : RAIL_H);
      } else if (pitch !== undefined) {
        top = z0 + pitch;
      }
    }

    for (const seg of wallSegs) {
      const mine = placed.filter((p) => sameSegment(p.seg, seg));
      const len = segmentLength(seg);
      const holes: Array<{ lo: number; hi: number; z0: number; z1: number }> = [];
      for (const p of mine) {
        const d = Math.hypot(p.cx - seg.x1, p.cy - seg.y1);
        // 開口の z: 扉は床から立ち上がり、それ以外はまぐさ高から高さのぶん下がる。
        // **窓台 (sill) は運搬層なので core は見ない** — 頭を揃えることで下端が決まる
        const oz0 =
          z0 === undefined
            ? 0
            : p.o.kind === "door"
              ? z0
              : z0 + OPENING_HEAD - (p.o.h ?? OPENING_H);
        const oz1 =
          z0 === undefined
            ? 0
            : p.o.kind === "door"
              ? z0 + (p.o.h ?? OPENING_HEAD)
              : z0 + OPENING_HEAD;
        holes.push({ lo: d - p.o.w / 2, hi: d + p.o.w / 2, z0: oz0, z1: oz1 });
        const style = p.o.attrs["style"];
        const sliding = style === "sliding" || style === "auto";
        const name = p.o.attrs["name"];
        openings.push({
          ref: `${ref}/${p.index}`,
          boundary: bi,
          index: p.index,
          a: b.a,
          b: b.b,
          kind: p.o.kind,
          ...(typeof name === "string" ? { name } : {}),
          ...(level !== undefined ? { level } : {}),
          segment: seg,
          cx: p.cx,
          cy: p.cy,
          w: p.o.w,
          z0: oz0,
          z1: oz1,
          t,
          ...(typeof style === "string" ? { style } : {}),
          ...(p.o.kind === "door"
            ? (() => {
                const sw = swingOf(model, b, p.o, seg, p.cx, p.cy);
                return sw ? { swing: sw } : {};
              })()
            : {}),
          sliding,
        });
      }
      for (const [gi, g] of canonicalSegOrder(b).entries()) {
        const p = placeBand(model, b, g, "seg");
        if ("error" in p || !sameSegment(p.segment, seg)) continue;
        segs.push({
          ref: `${ref}~${gi}`,
          boundary: bi,
          index: gi,
          ...(level !== undefined ? { level } : {}),
          segment: seg,
          cx: p.cx,
          cy: p.cy,
          w: g.w,
          t,
        });
      }
      boundaries.push({
        ref,
        boundary: bi,
        a: b.a,
        b: b.b,
        kind: b.kind,
        derived: b.derived === true,
        ...(level !== undefined ? { level } : {}),
        air: b.air === true,
        segment: seg,
        ...(b.kind === "wall" && z0 !== undefined && top !== undefined && len > EPS
          ? { material: { t, z0, z1: top, panels: panelsOf(seg, z0, top, holes) } }
          : {}),
      });
    }
  }

  // ---- 柱 ----
  const columns: FormColumn[] = [];
  for (const l of levels) {
    const pitch = pitchOf.get(l.name);
    if (pitch === undefined) continue;
    for (const c of columnsFor(model, l.name)) {
      columns.push({ ...c, ref: `${l.name}/${c.grid}`, z0: l.z, z1: l.z + pitch });
    }
  }

  // ---- 縦動線 ----
  const runs: FormRun[] = verticalRuns(model).map((r) => ({ ...r, solids: runSolids(r) }));

  // ---- 敷地 (与件) ----
  const site: FormSite[] = [...model.polygons.values()].map((p) => ({
    path: p.path,
    points: p.points,
    areaM2: polygonAreaM2(p.points),
  }));

  // ---- 平面 ----
  const plans = levels.map((l) =>
    planOf(model, l.name, l.z + cut, cut, { spaces, boundaries, openings, columns }),
  );

  return {
    input: { cut },
    levels: formLevels,
    spaces,
    boundaries,
    openings,
    segs,
    slabs: slabs(model),
    columns,
    runs,
    site,
    plans,
  };
}

function planOf(
  model: Model,
  level: string,
  cutZ: number,
  cut: number,
  form: {
    spaces: FormSpace[];
    boundaries: FormBoundary[];
    openings: FormOpening[];
    columns: FormColumn[];
  },
): FormPlan {
  const entities: PlanEntity[] = [];

  // 空間の領域 — 切断面が気積を切った姿
  for (const s of form.spaces) {
    if (s.level !== level) continue;
    for (const poly of s.outline) {
      entities.push({ class: "cut", of: "space", ref: s.path, polygon: poly });
    }
  }

  // 境界 — 物があれば開口で割られた区間のうち切断面を含むもの、無ければ芯線分だけ
  for (const b of form.boundaries) {
    if (b.level !== level) continue;
    if (!b.material) {
      entities.push({
        class: "cut",
        of: "boundary",
        ref: b.ref,
        lines: [{ x1: b.segment.x1, y1: b.segment.y1, x2: b.segment.x2, y2: b.segment.y2 }],
      });
      continue;
    }
    // 区間は**足あと (厚みのある四辺形) と芯線の両方**を持つ。厚みを持つものとして描くか
    // 一本の線として描くか (遮蔽しない手すり・柵) は見た目の判断なので、消費者が選ぶ
    for (const p of b.material.panels) {
      entities.push({
        class: spans(p.z0, p.z1, cutZ) ? "cut" : p.z1 < cutZ ? "below" : "above",
        of: "boundary",
        ref: b.ref,
        polygon: thicken(p.x1, p.y1, p.x2, p.y2, b.material.t),
        lines: [{ x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 }],
      });
    }
  }

  // 開口 — 建具そのもの (切断面に掛かるか、下にあるか)
  for (const o of form.openings) {
    if (o.level !== level) continue;
    const g = bandLine(o.segment, o.cx, o.cy, o.w);
    entities.push({
      class: spans(o.z0, o.z1, cutZ) ? "cut" : o.z1 < cutZ ? "below" : "above",
      of: "opening",
      ref: o.ref,
      polygon: thicken(g.x1, g.y1, g.x2, g.y2, o.t),
      lines: [g],
    });
    if (!o.swing) continue;
    const sw = o.swing;
    entities.push({
      class: "swing",
      of: "opening",
      ref: o.ref,
      lines: [{ x1: sw.hinge.x, y1: sw.hinge.y, x2: sw.leaf.x, y2: sw.leaf.y }],
      ...(o.sliding
        ? {}
        : {
            arc: {
              cx: sw.hinge.x,
              cy: sw.hinge.y,
              r: o.w,
              from: sw.leaf,
              to: sw.jamb,
              ccw: sw.ccw,
            },
          }),
    });
  }

  // 柱
  for (const c of form.columns) {
    if (c.level !== level) continue;
    entities.push({
      class: spans(c.z0, c.z1, cutZ) ? "cut" : "below",
      of: "column",
      ref: c.ref,
      polygon: columnRect(c),
    });
  }

  // 縦動線 — 上る走りは切断面で切れ、下りる走りはその残りに現れる
  for (const d of runDrawsForLevel(model, level, cut)) {
    const cls: PlanClass = d.dir === "up" ? "cut" : "below";
    if (d.outline.length > 0) entities.push({ class: cls, of: "run", ref: d.path, role: "outline", lines: d.outline });
    if (d.treads.length > 0) entities.push({ class: cls, of: "run", ref: d.path, role: "tread", lines: d.treads });
    if (d.breaks.length > 0) entities.push({ class: "cut", of: "run", ref: d.path, role: "break", lines: d.breaks });
    for (const a of d.arrows) {
      entities.push({
        class: cls,
        of: "run",
        ref: d.path,
        role: "arrow",
        lines: [{ x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 }],
        anchor: { x: a.x1, y: a.y1, up: a.up },
      });
    }
    if (d.anchor) entities.push({ class: "anchor", of: "run", ref: d.path, anchor: d.anchor });
  }

  // 上部吹抜けの投影 — 切断面より上のものが下階の平面に落ちる。
  // **落とすのは導出された形である** — 割付で落とすと、切られた吹抜けが切られる前の姿で出る
  for (const b of canonicalBoundaryOrder(model)) {
    if (b.kind !== "void") continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa?.level || !sb?.level) continue;
    const za = model.levels[sa.level]?.z;
    const zb = model.levels[sb.level]?.z;
    if (za === undefined || zb === undefined) continue;
    const lower = za < zb ? sa : sb;
    const upper = za < zb ? sb : sa;
    if (lower.level !== level) continue;
    for (const poly of regionOf(upper)) {
      entities.push({ class: "above", of: "space", ref: upper.path, polygon: poly });
    }
  }

  return { level, cut, cutZ, entities };
}
