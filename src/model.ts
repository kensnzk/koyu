// koyu v0 — データモデル
// 一次要素は空間。壁は二つの空間の「境界」という関係であり、物ではない。
// 形はここには無い。形は生成物である。(docs/writing-architecture.md)

export type AttrValue = string | number;
export type Attrs = Record<string, AttrValue>;

/** このツールが受理する言語版 (ADR-0017)。旧版は意味保存の場合のみ受理される (checkが検査する) */
export const SUPPORTED_LANGUAGE_VERSIONS: readonly string[] = ["0.1", "0.2", "0.3", "0.4", "0.5"];
/** 版宣言を省略したときの解釈 — 常に最新版の意味論 (省略はツール版を跨いで意味安定ではない) */
export const DEFAULT_LANGUAGE_VERSION = "0.5";

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
  /**
   * 地下の宣言 (ADR-0022)。zの負値から推定はしない — 地盤面は敷地の事実であって
   * 座標系の原点の事実ではないため。集計 (地上/地下の床面積) と矩計の表示が読む。
   * 接土境界の語彙は導入しない (物の名は spec 語彙 — 台帳の規則2)
   */
  underground?: boolean;
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
  /** グリッド解決後のmm矩形の合併。exteriorなどは空。**書かれた割付** (セル) であって形ではない */
  rects: Rect[];
  /**
   * 導出された領域 — 凸片の集合 (ADR-0022)。既定は rects をそのまま写したもので、
   * 境界に描かれた線 (line) があればその半平面で切り分けた結果になる。
   * 面積・平面図・立体はこちらを読む。rects は「書かれた綴り」として正準JSONに残る
   */
  pieces: Pt[][];
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

/**
 * 描かれた線 (ADR-0022) — 空間を区切る設計の行為そのもの。
 * 端点は通り語 (`X3,Y1` / `X3+600,Y2-900`) で書く。生座標も角度も導入しない。
 * 境界が既定で持つ「隣接から導かれる線分」を、この線が置き換える
 */
export interface DrawnLine {
  /** 書かれた綴り — 正準JSONと差分が共有する */
  aRef: string;
  bRef: string;
  a: Pt;
  b: Pt;
  line: number;
}

/** 境界はどちらの空間にも属さない。二つの空間パスを結ぶ第一級の関係 */
export interface Boundary {
  a: string;
  b: string;
  kind: BoundaryKind;
  /** 描かれた線 (字下げの line 行)。あれば境界の実現はこの線になる */
  drawn?: DrawnLine;
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
  /** 既定境界 (ADR-0014) — 宣言されず、接触から導出された壁。正準JSONには出ない (書かれた構成のみ) */
  derived?: boolean;
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
  /** 敷地形状 — 所与のジオメトリ (ADR-0011)。パス→頂点列 (mm)。
   *  唯一の自由頂点列 — 空間の領域はグリッド参照の矩形として書かれる */
  polygons: Map<string, SitePolygon>;
  /** 柱の宣言 (ADR-0023)。位置は書かれない — 通り芯の交点から導出される */
  columns: ColumnDecl[];
  /** 合成に参加したレイヤー (ローダーのキー、合成順 — entryが先頭)。単一ソースのparseでは空 */
  layers: string[];
  /** koyu版が明示宣言されたか (base層でのみ・一度だけ — ADR-0017の合成規則の管理用) */
  versionDeclared?: boolean;
}

/** 平面上の点 (mm) */
export interface Pt {
  x: number;
  y: number;
}

/**
 * 柱の宣言 (ADR-0023) — 「どの通りに、どの階に、どの寸法で」だけを書く。
 * **位置は書かない**。通り芯 (共有線) の交点のうち、そのレベルの床のある所に立つ、
 * という規則で導出される。壁が境界から現れるのと同じ構えを、点の要素に適用したもの
 */
export interface ColumnDecl {
  /** 一辺 mm (角柱)。`d:` があれば矩形断面の奥行 */
  size: number;
  depth?: number;
  /** 展開済みレベル名 (宣言順ではなくz昇順) */
  levels: string[];
  /** 限定する通り名。未指定は全通り */
  xNames?: string[];
  yNames?: string[];
  attrs: Attrs;
  line: number;
  file?: string;
}

/** 導出された柱 — 一本の柱 */
export interface Column {
  x: number;
  y: number;
  /** X方向の幅 mm / Y方向の奥行 mm */
  w: number;
  d: number;
  level: string;
  /** 立っている通りの名 (X3・Y2 のような組) — 図面の言葉 */
  grid: string;
  attrs: Attrs;
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

/** 線分同士が内部で交差するか (端点・境界上の接触は交差としない、許容誤差eps mm)。交点を返す */
function properCrossing(a1: Pt, a2: Pt, b1: Pt, b2: Pt, eps = 1): Pt | undefined {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (d === 0) return undefined; // 平行・共線 (共線の重なりは接触扱い — 境界上は内側)
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  const la = Math.hypot(a2.x - a1.x, a2.y - a1.y);
  const lb = Math.hypot(b2.x - b1.x, b2.y - b1.y);
  if (la === 0 || lb === 0) return undefined;
  const ea = eps / la;
  const eb = eps / lb;
  if (t <= ea || t >= 1 - ea || u <= eb || u >= 1 - eb) return undefined; // 端点付近は接触
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/** 多角形の自己交差点 (隣接しない辺同士の内部交差)。なければundefined */
export function polygonSelfIntersection(poly: Pt[], eps = 1): Pt | undefined {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // 先頭と末尾の辺は隣接
      const x = properCrossing(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!, eps);
      if (x) return x;
    }
  }
  return undefined;
}

/**
 * 矩形が多角形からはみ出す点 (完全に内側ならundefined)。凹多角形にも正しい:
 * 四隅の内包に加え、多角形の頂点の矩形内への入り込みと、辺同士の内部交差を検査する
 */
export function rectEscapesPolygon(r: Rect, poly: Pt[], eps = 1): Pt | undefined {
  return shapeEscapesPolygon(rectToPoly(r), poly, eps);
}

/** 凸片が多角形からはみ出す点 (導出された領域を敷地形状と照合する — ADR-0022) */
export function shapeEscapesPolygon(shape: Pt[], poly: Pt[], eps = 1): Pt | undefined {
  for (const c of shape) if (!pointInPolygon(c, poly, eps)) return c;
  for (const p of poly) {
    // 多角形の頂点が凸片の内部に食い込む (境界上は食い込みではない)
    if (pointInPolygon(p, shape, eps) && !onPolygonEdge(p, shape, eps)) return p;
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    for (let k = 0; k < shape.length; k++) {
      const x = properCrossing(a, b, shape[k]!, shape[(k + 1) % shape.length]!, eps);
      if (x) return x;
    }
  }
  return undefined;
}

/** 点が多角形の辺の上にあるか (許容誤差eps mm) */
export function onPolygonEdge(p: Pt, poly: Pt[], eps = 1): boolean {
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

/** 面積 (壁芯) m²。導出された凸片の合計 — 描かれた線で切られていればその形の面積になる */
export function areaM2(s: Space): number | undefined {
  if (s.rects.length === 0) return undefined;
  const pieces = s.pieces.length > 0 ? s.pieces : s.rects.map(rectToPoly);
  const a = pieces.reduce((sum, p) => sum + polygonAreaM2(p), 0);
  return Math.round(a * 100) / 100;
}

/** 矩形を頂点列へ (反時計回り) */
export function rectToPoly(r: Rect): Pt[] {
  return [
    { x: r.x1, y: r.y1 },
    { x: r.x2, y: r.y1 },
    { x: r.x2, y: r.y2 },
    { x: r.x1, y: r.y2 },
  ];
}

/** 凸多角形を半平面で切る (Sutherland–Hodgman)。
 *  半平面は有向線分 a→b の左側 (外積>0)。切り落とされて空なら [] */
export function clipHalfPlane(poly: Pt[], a: Pt, b: Pt, keepLeft: boolean, eps = 1e-6): Pt[] {
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
    if (sp >= -eps) out.push(p);
    if ((sp > eps && sq < -eps) || (sp < -eps && sq > eps)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  // 退化 (面積ゼロ) は捨てる
  return out.length >= 3 && polygonAreaM2(out) > 1e-9 ? out : [];
}

/** 頂点列の外接矩形 */
export function polyBounds(poly: Pt[]): Rect {
  return {
    x1: Math.min(...poly.map((p) => p.x)),
    x2: Math.max(...poly.map((p) => p.x)),
    y1: Math.min(...poly.map((p) => p.y)),
    y2: Math.max(...poly.map((p) => p.y)),
  };
}

/**
 * そのレベルに立つ柱を導く (ADR-0023)。
 * 通り芯の交点のうち、床のある空間 (exterior・void を除く) の内側にあるものへ柱を置く。
 * 位置はどこにも書かれていない — 通りと床という既にある事実の交わりから現れる
 */
export function columnsFor(model: Model, level: string): Column[] {
  const floors = [...model.spaces.values()].filter(
    (s) => s.level === level && s.type !== "exterior" && s.type !== "void" && s.rects.length > 0,
  );
  if (floors.length === 0) return [];
  const out: Column[] = [];
  const seen = new Set<string>();
  for (const c of model.columns) {
    if (!c.levels.includes(level)) continue;
    const xs = model.grid.X.names
      .map((n, i) => ({ n, v: model.grid.X.coords[i]! }))
      .filter((g) => !c.xNames || c.xNames.includes(g.n));
    const ys = model.grid.Y.names
      .map((n, i) => ({ n, v: model.grid.Y.coords[i]! }))
      .filter((g) => !c.yNames || c.yNames.includes(g.n));
    for (const gx of xs) {
      for (const gy of ys) {
        const key = `${gx.n}|${gy.n}`;
        if (seen.has(key)) continue; // 同じ交点に二本は立たない (先の宣言が勝つ)
        const inside = floors.some((s) =>
          (s.pieces.length ? s.pieces : s.rects.map(rectToPoly)).some((p) =>
            pointInPolygon({ x: gx.v, y: gy.v }, p, 1),
          ),
        );
        if (!inside) continue;
        seen.add(key);
        out.push({
          x: gx.v,
          y: gy.v,
          w: c.size,
          d: c.depth ?? c.size,
          level,
          grid: `${gx.n}・${gy.n}`,
          attrs: c.attrs,
        });
      }
    }
  }
  return out;
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

/** 正準JSONの空間エントリ (書かれた表記・正準順)。semantic diff (ADR-0018) が比較基底として共有する */
export function canonicalSpaceEntry(s: Space): Record<string, unknown> {
  return {
    type: s.type,
    // 明示の level: (パス先頭セグメントと異なる所属 — メゾネット等) は書かれた構成として保存する。
    // これが無いとJSONだけでは所属レベル (垂直検査・集計・既定境界の前提) を復元できない
    ...(s.level !== undefined && s.path.split("/")[1] !== s.level ? { level: s.level } : {}),
    ...(s.grids.length === 1
      ? { at: [s.grids[0]!.xa, s.grids[0]!.ya, s.grids[0]!.xb, s.grids[0]!.yb] }
      : s.grids.length > 1
        ? { at: sortBySerial(s.grids.map((g) => [g.xa, g.ya, g.xb, g.yb])) }
        : {}),
    ...(Object.keys(s.attrs).length ? { attrs: sortObj(s.attrs) } : {}),
    ...(s.areas.length
      ? {
          areas: sortBySerial(
            s.areas.map((a) => ({
              at: [a.grid.xa, a.grid.ya, a.grid.xb, a.grid.yb],
              ...(Object.keys(a.attrs).length ? { attrs: sortObj(a.attrs) } : {}),
            })),
          ),
        }
      : {}),
  };
}

/** 正準JSONの開口エントリ (atRef??at 等の正準表記) — toCanonicalとsemantic diffが共有 */
export function canonicalOpeningEntry(o: Opening): Record<string, unknown> {
  return {
    kind: o.kind,
    ...(o.ref ? { ref: o.ref } : {}),
    w: o.w,
    ...(o.h !== undefined ? { h: o.h } : {}),
    at: o.atRef ?? o.at,
    ...(o.edge ? { edge: o.edge } : {}),
    ...(o.hinge ? { hinge: o.hinge } : {}),
    ...(o.swing ? { swing: o.swing } : {}),
    ...(Object.keys(o.attrs).length ? { attrs: sortObj(o.attrs) } : {}),
  };
}

/** 正準JSONのsegエントリ — toCanonicalとsemantic diffが共有 */
export function canonicalSegEntry(g: Seg): Record<string, unknown> {
  return {
    w: g.w,
    at: g.atRef ?? g.at,
    ...(g.edge ? { edge: g.edge } : {}),
    ...(Object.keys(g.attrs).length ? { attrs: sortObj(g.attrs) } : {}),
  };
}

/** 正準JSONの境界エントリ。a/bの向きは書かれた表記 (aキー) として保存する — edge/swingはa側から読む */
export function canonicalBoundaryEntry(b: Boundary): Record<string, unknown> {
  return {
    between: [b.a, b.b].sort(),
    a: b.a,
    kind: b.kind,
    ...(b.t !== undefined ? { t: b.t } : {}),
    ...(b.air ? { air: true } : {}),
    ...(b.edge ? { edge: b.edge } : {}),
    // 描かれた線は書かれた綴りのまま残す — 頂点座標はビルドの産物であって構成ではない
    ...(b.drawn ? { line: [b.drawn.aRef, b.drawn.bRef] } : {}),
    ...(Object.keys(b.attrs).length ? { attrs: sortObj(b.attrs) } : {}),
    ...(b.openings.length ? { openings: sortBySerial(b.openings.map(canonicalOpeningEntry)) } : {}),
    ...(b.segs.length ? { segs: sortBySerial(b.segs.map(canonicalSegEntry)) } : {}),
  };
}

/** 正準JSON — 機械形式。差分とレイヤー合成の土台 (キーは安定順) */
export function toCanonical(model: Model): string {
  const spaces: Record<string, unknown> = {};
  for (const p of [...model.spaces.keys()].sort()) {
    spaces[p] = canonicalSpaceEntry(model.spaces.get(p)!);
  }
  // 境界: 宣言順は意味を持たないため、並びは内容の正準順 (betweenの辞書順、同一betweenは直列化順)。
  // 既定境界 (derived — ADR-0014) は出さない: 正準JSONは書かれた構成のみで、意味は導出後のModelが持つ
  const boundaries = sortBySerial(
    [...model.boundaries].filter((b) => !b.derived).map(canonicalBoundaryEntry),
  );

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
            ...(v.underground ? { underground: 1 } : {}),
          },
        ]),
      ),
    ),
    ...(Object.keys(assets).length ? { assets } : {}),
    ...(Object.keys(polygons).length ? { polygons } : {}),
    ...(model.columns.length
      ? {
          columns: sortBySerial(
            model.columns.map((c) => ({
              size: c.size,
              ...(c.depth !== undefined ? { d: c.depth } : {}),
              levels: c.levels,
              ...(c.xNames ? { x: c.xNames } : {}),
              ...(c.yNames ? { y: c.yNames } : {}),
              ...(Object.keys(c.attrs).length ? { attrs: sortObj(c.attrs) } : {}),
            })),
          ),
        }
      : {}),
    ...(Object.keys(zones).length ? { zones } : {}),
    spaces,
    boundaries,
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** 宣言順に意味の無い集合を、直列化したJSONの辞書順に並べる — 正準順の土台 (diffも同じ順で比べる) */
export function sortBySerial<T>(items: T[]): T[] {
  return items
    .map((it) => [JSON.stringify(it), it] as const)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([, it]) => it);
}
