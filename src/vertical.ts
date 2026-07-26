// koyu — 縦動線の導出 (ADR-0021)
// 階段・斜路・エスカレーター・昇降機は「レベル間を通れる」という一つの関係の、
// 装置の違いにすぎない。トポロジー (どのレベルとどのレベルが繋がるか) は
// 垂直境界 (type:stair — graph.ts) が持ち、ここが答えるのは形である。
//
// 形はソースに無い。空間の領域と階高と「上る向き」の宣言だけから、
// 段割り・踊り場・勾配・立体・平面の切断をルールで生成する。
// 段数も踏面も勾配も書かれない — 書かないが検査する (RUN06 / RUN07)。

import { levelsSorted, type Edge, type Model, type Pt, type Rect, type Space } from "./model.js";

/** 装置。トポロジーではなく形の生成規則を選ぶ語 */
export type RunDevice = "stair" | "ramp" | "escalator" | "lift";
/** 宣言に使う属性キー = 装置名。値は上る向き (lift だけ 1) */
export const RUN_KEYS: readonly RunDevice[] = ["stair", "ramp", "escalator", "lift"];

/** 折返しの形式。曲線は導入しない — 螺旋は折返しの連続として書く (ADR-0021) */
export type RunForm = "straight" | "return";
export const RUN_FORMS: readonly RunForm[] = ["straight", "return"];

/** 既定の蹴上げ上限 mm (riser: で上書き) */
const DEFAULT_RISER_MAX = 180;
/** 踏面がこれを下回ると窮屈 (RUN06) */
const TREAD_MIN = 240;
/** 折返し階段の踊り場を導くときの目標踏面 mm (tread: で上書き) */
const TREAD_TARGET = 300;
/** 蹴上げ2倍+踏面 の快適域 (RUN06) */
const STEP_RULE = { lo: 550, hi: 700 };
/** エスカレーターの標準勾配 (30度 ≒ 1/1.73) と許容 */
const ESCALATOR_SLOPE = { lo: 1 / 2.3, hi: 1 / 1.4 };
/** 平面図の切断面 — FLからの高さ mm */
export const CUT_HEIGHT = 1200;
/** 踊り場の最小奥行 mm */
const LANDING_MIN = 1100;
/** 乗り込みの床の既定の奥行 mm (entry: で上書き) — 扉が段板に直接ぶつからないための帯 */
const ENTRY_LANDING = 1100;
/** エスカレーター一台の既定の呼び幅 mm (lane: で上書き) */
const LANE_ESCALATOR = 1200;
/** 平面のエスカレーターの段の刻みのピッチ mm */
const STEP_MARK = 400;
/** 段板の見付け厚 (立体) mm */
const TREAD_SOLID = 200;
/** 斜路・エスカレーター床版の厚さ mm */
const SLAB_T = 200;

/** 走りと踊り場の一区間。局所座標は t (走り方向) と s (進行方向の左からの幅) */
export interface RunPart {
  kind: "flight" | "landing";
  rect: Rect;
  /** 走り方向の区間 mm (t0 < t1、宣言された向きの枠で測る) */
  t0: number;
  t1: number;
  /** 幅方向の区間 mm */
  s0: number;
  s1: number;
  /** t0 における高さ / t1 における高さ (大小は問わない — 向きは reversed が言う) */
  z0: number;
  z1: number;
  /** 走る向きが宣言と逆か (折返しの二本目・並列の下り) */
  reversed: boolean;
  /** 蹴上げの数 (階段の走りのみ) */
  risers?: number;
  /** 踏面 mm (階段の走りのみ) */
  tread?: number;
  /** 並列の何台目か (エスカレーター) */
  lane?: number;
}

export interface VerticalRun {
  /** 宣言した空間のパス */
  path: string;
  device: RunDevice;
  form: RunForm;
  level: string;
  /** 上の到達先レベル (無ければ undefined — lift は同レベルで閉じる) */
  upper?: string;
  z0: number;
  z1: number;
  /** 上がる高さ mm */
  rise: number;
  /** 上る向き (lift は N を入れるが意味を持たない) */
  up: Edge;
  /** 折返しの向き: R=踊り場で右へ回る (既定) */
  turn: "L" | "R";
  rect: Rect;
  /** 走り方向の全長 mm */
  length: number;
  /** 幅 (走りと直交) mm */
  width: number;
  /** 乗り込みの床の奥行 mm (走りが領域の縁から始まらないための帯) */
  entry: number;
  /** 並列の台数 (エスカレーター。他は1) */
  lanes: number;
  parts: RunPart[];
  /** 蹴上げの数 (階段のみ) */
  risers: number;
  /** 蹴上げ mm (階段のみ) */
  riser: number;
  /** 代表踏面 mm (階段のみ) */
  tread: number;
  /** 最も急な走りの勾配 (rise/走り長)。1/N の N は 1/slope */
  slope: number;
  /** 走りの水平長の合計 mm (踊り場を含まない) */
  going: number;
}

// ---- 宣言の読み取り ----

export interface RunDecl {
  device: RunDevice;
  /** 書かれた値 (未検証) */
  value: string;
}

/** 空間に書かれた縦動線の宣言をすべて返す (複数は RUN01) */
export function runDecls(s: Space): RunDecl[] {
  const out: RunDecl[] = [];
  for (const k of RUN_KEYS) {
    const v = s.attrs[k];
    if (v !== undefined) out.push({ device: k, value: String(v) });
  }
  return out;
}

const EDGES = new Set<string>(["N", "E", "S", "W"]);
const OPPOSITE: Record<Edge, Edge> = { N: "S", S: "N", E: "W", W: "E" };

// ---- 局所座標 (t = 進む向き / s = 進行方向の左からの距離) ----

/**
 * 走りの局所座標 (t,s) を世界の矩形へ写す。
 * t は進む向きに 0 から、s は**進行方向の左**から測る (折返しの左右がここで決まる)
 */
export function toWorld(rect: Rect, up: Edge, t0: number, t1: number, s0: number, s1: number): Rect {
  switch (up) {
    case "N":
      return { x1: rect.x1 + s0, x2: rect.x1 + s1, y1: rect.y1 + t0, y2: rect.y1 + t1 };
    case "S":
      return { x1: rect.x2 - s1, x2: rect.x2 - s0, y1: rect.y2 - t1, y2: rect.y2 - t0 };
    case "E":
      return { x1: rect.x1 + t0, x2: rect.x1 + t1, y1: rect.y2 - s1, y2: rect.y2 - s0 };
    case "W":
      return { x1: rect.x2 - t1, x2: rect.x2 - t0, y1: rect.y1 + s0, y2: rect.y1 + s1 };
  }
}

/** 走り方向の全長と幅 */
function extent(rect: Rect, up: Edge): { length: number; width: number } {
  const dx = rect.x2 - rect.x1;
  const dy = rect.y2 - rect.y1;
  return up === "N" || up === "S" ? { length: dy, width: dx } : { length: dx, width: dy };
}

// ---- 導出 ----

/**
 * モデル中の縦動線をすべて導く。
 * 宣言が壊れている空間 (値が方位でない・領域が単一矩形でない・レベル不明) は
 * ここでは黙って落とし、check が RUN01..RUN05 として言葉にする。
 */
export function verticalRuns(model: Model): VerticalRun[] {
  const levels = levelsSorted(model);
  const out: VerticalRun[] = [];
  for (const s of model.spaces.values()) {
    const run = verticalRun(model, s, levels);
    if (run) out.push(run);
  }
  return out.sort((a, b) => (a.z0 - b.z0) || (a.path < b.path ? -1 : 1));
}

/** 一つの空間の縦動線。宣言が無い/壊れているときは undefined */
export function verticalRun(
  model: Model,
  s: Space,
  levels = levelsSorted(model),
): VerticalRun | undefined {
  const decls = runDecls(s);
  if (decls.length !== 1) return undefined;
  const { device, value } = decls[0]!;
  if (s.rects.length !== 1 || !s.level) return undefined;
  const rect = s.rects[0]!;
  const li = levels.findIndex((l) => l.name === s.level);
  if (li < 0) return undefined;

  const up = device === "lift" ? "N" : (value as Edge);
  if (device !== "lift" && !EDGES.has(value)) return undefined;
  if (device === "lift" && value !== "1") return undefined;

  const formRaw = String(s.attrs["form"] ?? "straight");
  if (!RUN_FORMS.includes(formRaw as RunForm)) return undefined;
  const form = formRaw as RunForm;
  if (device !== "stair" && device !== "ramp" && form !== "straight") return undefined;

  const z0 = levels[li]!.z;
  const upper = levels[li + 1];
  if (!upper && device !== "lift") return undefined; // 上る先が無い — RUN04
  const z1 = upper?.z ?? z0;
  const rise = z1 - z0;

  const turn = s.attrs["turn"] === "L" ? "L" : "R";
  const { length, width } = extent(rect, up);

  const base = {
    path: s.path,
    device,
    form,
    level: s.level,
    ...(upper ? { upper: upper.name } : {}),
    z0,
    z1,
    rise,
    up,
    turn: turn as "L" | "R",
    rect,
    length,
    width,
  };
  if (device === "lift") {
    return { ...base, entry: 0, lanes: 1, parts: [], risers: 0, riser: 0, tread: 0, slope: 0, going: 0 };
  }

  // 乗り込みの床 (ADR-0021)。走りは領域の縁からは始まらない — 縁から始めると、
  // 階段室の扉が段板に直接ぶつかる。近端 (と直階段では遠端) に階の床が残り、
  // そこが扉の開く場所になる。この帯は走りではないので部品にはしない (階の床である)。
  const entry = Math.max(0, numAttr(s, "entry") ?? ENTRY_LANDING);
  const usable = form === "return" ? length - entry : length - entry * 2;
  if (usable <= 0) return undefined; // 乗り込みが全長を食う — RUN05

  // 並列の台数 (エスカレーター)。一台の呼び幅は lane: (既定1200mm)。
  // 上りと下りが並ぶのが実機の姿なので、台ごとに走る向きが交互になる
  const lane = Math.max(1, numAttr(s, "lane") ?? (device === "escalator" ? LANE_ESCALATOR : width));
  const lanes = device === "escalator" ? Math.max(1, Math.floor(width / lane)) : 1;
  const laneW = device === "escalator" ? Math.min(lane, width / lanes) : width;
  const laneMargin = (width - laneW * lanes) / 2;

  const parts: RunPart[] = [];
  let risersTotal = 0;
  let riser = 0;
  let tread = 0;

  if (form === "return") {
    // 折返し: 幅を二分し、遠端に中間踊り場。turn:R なら第一の走りが進行方向の左
    const mid = returnLanding(s, device, rise, length - entry, width);
    const flightLen = length - entry - mid;
    if (flightLen <= 0) return undefined; // RUN05
    const half = width / 2;
    const [aS, aE] = turn === "R" ? [0, half] : [half, width];
    const [bS, bE] = turn === "R" ? [half, width] : [0, half];
    const tA0 = entry;
    const tA1 = entry + flightLen;

    if (device === "stair") {
      risersTotal = Math.max(2, Math.ceil(rise / (numAttr(s, "riser") ?? DEFAULT_RISER_MAX)));
      riser = rise / risersTotal;
      const k = Math.min(risersTotal - 1, Math.max(1, Math.round(risersTotal / 2)));
      const zMid = z0 + k * riser;
      tread = flightLen / Math.max(1, k - 1);
      parts.push(
        flight(rect, up, tA0, tA1, aS, aE, z0, zMid, false, k, flightLen / Math.max(1, k - 1)),
        landingPart(rect, up, tA1, length, 0, width, zMid),
        // 二本目は遠端から近端へ戻る — t が減る向きに走り、z は増える
        flight(rect, up, tA0, tA1, bS, bE, z1, zMid, true, risersTotal - k, flightLen / Math.max(1, risersTotal - k - 1)),
      );
    } else {
      const zMid = z0 + rise / 2;
      parts.push(
        flight(rect, up, tA0, tA1, aS, aE, z0, zMid, false),
        landingPart(rect, up, tA1, length, 0, width, zMid),
        flight(rect, up, tA0, tA1, bS, bE, z1, zMid, true),
      );
    }
  } else {
    const t0 = entry;
    const t1 = length - entry;
    if (device === "stair") {
      risersTotal = Math.max(2, Math.ceil(rise / (numAttr(s, "riser") ?? DEFAULT_RISER_MAX)));
      riser = rise / risersTotal;
      tread = usable / Math.max(1, risersTotal - 1);
      parts.push(flight(rect, up, t0, t1, 0, width, z0, z1, false, risersTotal, tread));
    } else {
      // 並列の台。台ごとに走る向きが交互 — 上りの隣は上から降りてくる一台である
      for (let i = 0; i < lanes; i++) {
        const s0 = laneMargin + i * laneW;
        parts.push(flight(rect, up, t0, t1, s0, s0 + laneW, z0, z1, i % 2 === 1, undefined, undefined, i));
      }
    }
  }

  const going = parts
    .filter((p) => p.kind === "flight" && (p.lane ?? 0) === 0)
    .reduce((a, p) => a + (p.t1 - p.t0), 0);

  const slope = Math.max(
    ...parts
      .filter((p) => p.kind === "flight")
      .map((p) => (p.t1 - p.t0 > 0 ? Math.abs(p.z1 - p.z0) / (p.t1 - p.t0) : 0)),
  );

  return { ...base, entry, lanes, parts, risers: risersTotal, riser, tread, slope, going };
}

/** 走りの部品。z0/z1 は t0/t1 における高さ (走る向きは reversed が言う) */
function flight(
  rect: Rect,
  up: Edge,
  t0: number,
  t1: number,
  s0: number,
  s1: number,
  z0: number,
  z1: number,
  reversed: boolean,
  risers?: number,
  tread?: number,
  lane?: number,
): RunPart {
  return {
    kind: "flight",
    rect: toWorld(rect, up, t0, t1, s0, s1),
    t0,
    t1,
    s0,
    s1,
    z0,
    z1,
    reversed,
    ...(risers !== undefined ? { risers } : {}),
    ...(tread !== undefined ? { tread } : {}),
    ...(lane !== undefined ? { lane } : {}),
  };
}

function landingPart(
  rect: Rect,
  up: Edge,
  t0: number,
  t1: number,
  s0: number,
  s1: number,
  z: number,
): RunPart {
  return {
    kind: "landing",
    rect: toWorld(rect, up, t0, t1, s0, s1),
    t0,
    t1,
    s0,
    s1,
    z0: z,
    z1: z,
    reversed: false,
  };
}

function numAttr(s: Space, key: string): number | undefined {
  const v = s.attrs[key];
  return typeof v === "number" ? v : undefined;
}

/**
 * 折返しの中間踊り場の奥行 mm。`landing:` があればそれ、無ければ導く。
 *
 * 走り長・踏面・踊り場は一つの式で結ばれていて、書けるのは高々二つである。
 * 領域 (平面が決める) と目標踏面 (快適さの定数) を与えると、踊り場は残余として決まる。
 * 逆に踊り場を書けば踏面が残余になる — **設計者が握りたいのは踏面の快適さ**なので、
 * 既定では残余を踊り場へ寄せる。踊り場が設計量になる場合は `landing:` で書き、
 * その結果の踏面は RUN06 が検査する (ADR-0021)。
 */
function returnLanding(
  s: Space,
  device: RunDevice,
  rise: number,
  length: number,
  width: number,
): number {
  const written = numAttr(s, "landing");
  if (written !== undefined) return Math.max(LANDING_MIN, written);
  if (device !== "stair") {
    // 斜路: 走りが長いほど勾配が緩い。踊り場は要る分だけ (幅の半分か最小値)
    return Math.max(LANDING_MIN, Math.min(width / 2, length / 3));
  }
  const target = numAttr(s, "tread") ?? TREAD_TARGET;
  const riserMax = numAttr(s, "riser") ?? DEFAULT_RISER_MAX;
  const n = Math.max(2, Math.ceil(rise / riserMax));
  const k = Math.min(n - 1, Math.max(1, Math.round(n / 2)));
  const treads = Math.max(1, Math.max(k - 1, n - k - 1));
  return Math.max(LANDING_MIN, Math.min(length - treads * target, length - LANDING_MIN));
}

/** 勾配の 1/N 表記 (N は小数第1位) */
export function slopeText(slope: number): string {
  if (slope <= 0) return "—";
  return `1/${(1 / slope).toFixed(1).replace(/\.0$/, "")}`;
}

// ---- 局所座標の点 ----

/** 走りの局所座標 (t,s) を世界の点へ (toWorld の点版 — 向きが保たれる) */
export function toPoint(rect: Rect, up: Edge, t: number, s: number): Pt {
  switch (up) {
    case "N":
      return { x: rect.x1 + s, y: rect.y1 + t };
    case "S":
      return { x: rect.x2 - s, y: rect.y2 - t };
    case "E":
      return { x: rect.x1 + t, y: rect.y2 - s };
    case "W":
      return { x: rect.x2 - t, y: rect.y1 + s };
  }
}

// ---- 立体 (ビルド) ----

/**
 * 生成された立体 — 依存ゼロの素の記述。ビュアーはこれを幾何へ写すだけで、
 * 段割りや勾配の判断は一切持たない (README の「ビュアーは答えを持たない」)
 */
export type RunSolid =
  /** 軸平行の直方体 — 段板・踊り場・エスカレーターの端部・かご */
  | { kind: "box"; rect: Rect; z0: number; z1: number }
  /** 傾いた版 — rect の up 側へ z0→z1 で上がる厚さ t の板 (斜路・トラス・欄干) */
  | { kind: "incline"; rect: Rect; up: Edge; z0: number; z1: number; t: number };

/** 縦動線の三次元形状。段は段として、斜路は傾いた版として立ち上がる */
export function runSolids(run: VerticalRun): RunSolid[] {
  const out: RunSolid[] = [];
  if (run.device === "lift") {
    const m = Math.min(300, (run.rect.x2 - run.rect.x1) / 6, (run.rect.y2 - run.rect.y1) / 6);
    out.push({
      kind: "box",
      rect: { x1: run.rect.x1 + m, y1: run.rect.y1 + m, x2: run.rect.x2 - m, y2: run.rect.y2 - m },
      z0: run.z0 + 60,
      z1: run.z0 + 2400,
    });
    return out;
  }

  for (const p of run.parts) {
    if (p.kind === "landing") {
      out.push({ kind: "box", rect: p.rect, z0: p.z0 - SLAB_T, z1: p.z0 });
      continue;
    }
    const len = p.t1 - p.t0;
    // 走る向き: reversed なら t1 側が出発、t0 側が到着
    const dir = p.reversed ? OPPOSITE[run.up] : run.up;
    const zLow = Math.min(p.z0, p.z1);
    const zHigh = Math.max(p.z0, p.z1);

    if (run.device === "stair") {
      const k = p.risers ?? 1;
      const treads = Math.max(1, k - 1);
      const d = len / treads;
      const rise = (zHigh - zLow) / k;
      for (let i = 1; i <= treads; i++) {
        // 走る向きに i 段目。段板は蹴上げ+控えの厚みを持ち、隣と重なって連続した段形になる
        const a = p.reversed ? p.t1 - i * d : p.t0 + (i - 1) * d;
        const b = p.reversed ? p.t1 - (i - 1) * d : p.t0 + i * d;
        const top = zLow + i * rise;
        out.push({
          kind: "box",
          rect: toWorld(run.rect, run.up, Math.min(a, b), Math.max(a, b), p.s0, p.s1),
          z0: top - rise - TREAD_SOLID,
          z1: top,
        });
      }
      continue;
    }
    // 斜路・エスカレーター: 傾いた版。dir 側へ上がる
    out.push({ kind: "incline", rect: p.rect, up: dir, z0: zLow, z1: zHigh, t: SLAB_T });
    if (run.device === "escalator") {
      // 欄干 (両側の傾いた薄板) — 一台ごとに二枚。見た目がエスカレーターになる最小
      const bal = Math.min(140, (p.s1 - p.s0) / 8);
      for (const [q0, q1] of [
        [p.s0, p.s0 + bal],
        [p.s1 - bal, p.s1],
      ] as const) {
        out.push({
          kind: "incline",
          rect: toWorld(run.rect, run.up, p.t0, p.t1, q0, q1),
          up: dir,
          z0: zLow + 900,
          z1: zHigh + 900,
          t: 100,
        });
      }
    }
  }
  return out;
}

// ---- 平面 (切断) ----

export interface Seg2 {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RunArrow extends Seg2 {
  label: string;
}

/** そのレベルで切った縦動線の作図。平面図とビュアーが共有する唯一の答え */
export interface RunDraw {
  path: string;
  device: RunDevice;
  /** 段鼻 (階段) / 段の刻み (エスカレーター) */
  treads: Seg2[];
  /** 輪郭 — 走りの側線・踊り場の縁 */
  outline: Seg2[];
  /** 切断線 (作図慣習の平行な二本の斜線) */
  breaks: Seg2[];
  arrows: RunArrow[];
  /** 注記 (勾配・段数) */
  notes: Array<{ x: number; y: number; text: string }>;
}

/** 走りが切断面と交わる位置 (部品の番号と、原点の枠での t) */
function cutAt(run: VerticalRun, cutZ: number): { index: number; t: number } | undefined {
  for (let i = 0; i < run.parts.length; i++) {
    const p = run.parts[i]!;
    if (p.kind !== "flight") continue;
    const lo = Math.min(p.z0, p.z1);
    const hi = Math.max(p.z0, p.z1);
    if (cutZ < lo || cutZ > hi || hi - lo < 1) continue;
    // z0 は t0 における高さなので、t は z について線形に引ける
    const f = (cutZ - p.z0) / (p.z1 - p.z0);
    return { index: i, t: p.t0 + f * (p.t1 - p.t0) };
  }
  return undefined;
}

/**
 * そのレベルの平面に現れる縦動線を描く。
 *
 * 一枚の平面には二つの走りが出る — このレベルから**上る**走り (切断線で切れる) と、
 * このレベルへ**下りる**走り (下階の走りを上から見たもの)。切断より先には上る走りは
 * 描かれず、その位置から先に下りる走りが見える。これが階段が階ごとに違う姿で現れる
 * 理由であり、平面図が「そのレベルで切った断面」だという事実そのものである。
 *
 * 折返しでは切断は一本目の走り (片側の幅) にしか掛からない。もう一方の幅は
 * 丸ごと下りる走りのものなので、可視の判定は**部品ごと**に行う。
 */
export function runDrawsForLevel(model: Model, level: string, cut = CUT_HEIGHT): RunDraw[] {
  const z = model.levels[level]?.z;
  if (z === undefined) return [];
  const cutZ = z + cut;
  const runs = verticalRuns(model);
  const out: RunDraw[] = [];
  const upRuns = runs.filter((r) => r.level === level);

  for (const r of upRuns) {
    out.push(drawRun(r, r.device === "lift" ? undefined : cutAt(r, cutZ), "up"));
  }
  for (const r of runs.filter((x) => x.upper === level)) {
    if (r.device === "lift") continue; // かごの記号は自レベルに一つで足りる
    const twin = upRuns.find((u) => sameFootprint(u.rect, r.rect));
    out.push(drawRun(r, twin ? cutAt(twin, cutZ) : undefined, "down"));
  }
  return out;
}

function sameFootprint(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x1 - b.x1) < 1 &&
    Math.abs(a.y1 - b.y1) < 1 &&
    Math.abs(a.x2 - b.x2) < 1 &&
    Math.abs(a.y2 - b.y2) < 1
  );
}

/** 切断が起きた高さ (切られた走りの t から逆算する) */
function cutHeight(p: RunPart, t: number): number {
  const f = p.t1 - p.t0 === 0 ? 0 : (t - p.t0) / (p.t1 - p.t0);
  return p.z0 + f * (p.z1 - p.z0);
}

/** 部品の可視区間 (原点の枠の [t0,t1])。見えなければ undefined */
function visible(
  run: VerticalRun,
  index: number,
  cut: { index: number; t: number } | undefined,
  dir: "up" | "down",
): [number, number] | undefined {
  const p = run.parts[index]!;
  // 切断が無い (階高が切断面より低い / 上る走りがそもそも無い) — 走りは丸ごと見える
  if (!cut) return [p.t0, p.t1];
  if (index === cut.index) {
    // 切られた走り: 上りは出発側、下りはその先
    const startSide = p.reversed ? [cut.t, p.t1] : [p.t0, cut.t];
    const farSide = p.reversed ? [p.t0, cut.t] : [cut.t, p.t1];
    const [a, b] = (dir === "up" ? startSide : farSide) as [number, number];
    return b - a > 1 ? [a, b] : undefined;
  }
  // 折返しの二本目は幅が違うので、切断の手前/先という順序には従わない —
  // 上りは切られる走りまで、下りはそれ以降が見える
  return (dir === "up") === index < cut.index ? [p.t0, p.t1] : undefined;
}

function drawRun(
  run: VerticalRun,
  cut: { index: number; t: number } | undefined,
  dir: "up" | "down",
): RunDraw {
  const draw: RunDraw = {
    path: run.path,
    device: run.device,
    treads: [],
    outline: [],
    breaks: [],
    arrows: [],
    notes: [],
  };
  const { rect, up } = run;
  const seg = (t0: number, s0: number, t1: number, s1: number): Seg2 => {
    const a = toPoint(rect, up, t0, s0);
    const b = toPoint(rect, up, t1, s1);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };

  if (run.device === "lift") {
    // 昇降機の記号: かごの輪郭と対角線 (作図慣習)
    const m = Math.min(250, run.width / 8);
    const [t0, t1, s0, s1] = [m, run.length - m, m, run.width - m];
    draw.outline.push(
      seg(t0, s0, t1, s0),
      seg(t0, s1, t1, s1),
      seg(t0, s0, t0, s1),
      seg(t1, s0, t1, s1),
    );
    draw.treads.push(seg(t0, s0, t1, s1), seg(t0, s1, t1, s0));
    return draw;
  }

  for (let i = 0; i < run.parts.length; i++) {
    const p = run.parts[i]!;
    const win = visible(run, i, cut, dir);
    if (!win) continue;
    const [lo, hi] = win;
    draw.outline.push(seg(lo, p.s0, hi, p.s0), seg(lo, p.s1, hi, p.s1));
    if (p.kind === "landing") continue;

    if (run.device === "stair") {
      const d = (p.t1 - p.t0) / Math.max(1, (p.risers ?? 2) - 1);
      for (let t = p.t0 + d; t < p.t1 - 1; t += d) {
        if (t < lo - 0.5 || t > hi + 0.5) continue;
        draw.treads.push(seg(t, p.s0, t, p.s1));
      }
    } else if (run.device === "escalator") {
      for (let t = lo + STEP_MARK; t < hi - 1; t += STEP_MARK) {
        draw.treads.push(seg(t, p.s0, t, p.s1));
      }
    }

    // 矢印: 一台ごと (エスカレーターの上り/下りが並ぶ)。折返しは走りごとには描かず、
    // 出発する走り (上り) / 到着する走り (下り) に一本だけ
    const isFirst = i === run.parts.findIndex((q) => q.kind === "flight");
    const isLast = i === run.parts.map((q) => q.kind).lastIndexOf("flight");
    const wantArrow = run.device === "escalator" ? true : dir === "up" ? isFirst : isLast;
    if (wantArrow && hi - lo > 900) {
      const c = (p.s0 + p.s1) / 2;
      // 走る向き: 上りは走りの進行、下りはその逆 (人は下ってくる)
      const forward = p.reversed ? false : true;
      const goUp = run.device === "escalator" ? !p.reversed : dir === "up";
      const from = goUp === forward ? lo + 150 : hi - 150;
      const to = goUp === forward ? hi - 150 : lo + 150;
      draw.arrows.push({ ...seg(from, c, to, c), label: goUp ? "UP" : "DN" });
    }
  }

  // 切断線: 走りを横切る平行な二本の斜線 (作図慣習)。交差させると吹抜けの対角線と紛れる
  if (dir === "up" && cut) {
    // 並列の台はどれも同じ高さで切られるので、切断線は切断面を跨ぐ走りすべてに引く
    for (const p of run.parts) {
      if (p.kind !== "flight") continue;
      const lo = Math.min(p.z0, p.z1);
      const hi = Math.max(p.z0, p.z1);
      const cz = cutHeight(run.parts[cut.index]!, cut.t);
      if (cz < lo - 1 || cz > hi + 1) continue;
      const g = Math.min(300, (p.s1 - p.s0) / 4);
      const off = Math.min(220, g);
      draw.breaks.push(
        seg(cut.t - g - off, p.s0, cut.t + g - off, p.s1),
        seg(cut.t - g + off, p.s0, cut.t + g + off, p.s1),
      );
    }
  }

  if (dir === "up") {
    draw.notes.push({
      x: (rect.x1 + rect.x2) / 2,
      y: (rect.y1 + rect.y2) / 2,
      text:
        run.device === "stair"
          ? `${run.risers}段 蹴上${Math.round(run.riser)}/踏面${Math.round(run.tread)}`
          : `${run.lanes > 1 ? `${run.lanes}台 ` : ""}勾配 ${slopeText(run.slope)}`,
    });
  }
  return draw;
}

// ---- 検査の材料 (check.ts が言葉にする) ----

export interface RunIssue {
  code: string;
  message: string;
  path: string;
  line: number;
  file?: string;
}

/**
 * 縦動線の検査。宣言の妥当性 (RUN01..05) と、**書かれていない導出値**の妥当性
 * (RUN06 段の寸法 / RUN07 勾配 / RUN08 トポロジーの欠落)。
 * 勾配も段数も書かない — だから検査する、という構えの実装 (ADR-0021)。
 */
export function runIssues(model: Model): RunIssue[] {
  const out: RunIssue[] = [];
  const levels = levelsSorted(model);
  const stairLinked = new Set<string>();
  for (const b of model.boundaries) {
    if (b.kind === "stair" || b.kind === "shaft") {
      stairLinked.add(b.a);
      stairLinked.add(b.b);
    }
  }

  for (const s of model.spaces.values()) {
    const decls = runDecls(s);
    if (decls.length === 0) continue;
    const at = { path: s.path, line: s.line, ...(s.file !== undefined ? { file: s.file } : {}) };
    if (decls.length > 1) {
      out.push({
        code: "RUN01",
        message: `縦動線の宣言が複数あります: ${decls.map((d) => `${d.device}:${d.value}`).join(" ")} (一つの空間に一つです)`,
        ...at,
      });
      continue;
    }
    const { device, value } = decls[0]!;
    if (device === "lift" ? value !== "1" : !EDGES.has(value)) {
      out.push({
        code: "RUN02",
        message:
          device === "lift"
            ? `lift の値は 1 です: lift:${value}`
            : `${device} の値は上る向き N/E/S/W です: ${device}:${value}`,
        ...at,
      });
      continue;
    }
    if (s.rects.length !== 1) {
      out.push({
        code: "RUN03",
        message:
          s.rects.length === 0
            ? `縦動線には領域が要ります: ${s.path}`
            : `縦動線の領域は矩形一つです (合併は段割りが決まりません): ${s.path}`,
        ...at,
      });
      continue;
    }
    if (!s.level) {
      out.push({ code: "RUN03", message: `縦動線のレベルが特定できません: ${s.path}`, ...at });
      continue;
    }
    const formRaw = String(s.attrs["form"] ?? "straight");
    if (!RUN_FORMS.includes(formRaw as RunForm)) {
      out.push({
        code: "RUN05",
        message: `form は ${RUN_FORMS.join(" / ")} です: form:${formRaw} (螺旋は折返しの連続として書きます)`,
        ...at,
      });
      continue;
    }
    if (device !== "stair" && device !== "ramp" && formRaw !== "straight") {
      out.push({
        code: "RUN05",
        message: `${device} に form:${formRaw} は書けません (折返せるのは階段と斜路です)`,
        ...at,
      });
      continue;
    }

    const li = levels.findIndex((l) => l.name === s.level);
    if (device !== "lift" && (li < 0 || !levels[li + 1])) {
      out.push({
        code: "RUN04",
        message: `${s.level} の上にレベルが無いため、${s.path} の形は生成されません`,
        ...at,
      });
      continue;
    }

    const run = verticalRun(model, s, levels);
    if (!run) {
      out.push({
        code: "RUN05",
        message: `縦動線の形が決まりません: ${s.path} (踊り場が全長を超えていないか確かめます)`,
        ...at,
      });
      continue;
    }
    if (device === "lift") continue;

    if (!stairLinked.has(s.path)) {
      out.push({
        code: "RUN08",
        message: `${s.path} は縦動線の形を持ちますが、上下を繋ぐ垂直境界がありません (stack か boundary type:stair を書きます — 形はあってもグラフでは通れません)`,
        ...at,
      });
    }

    if (device === "stair") {
      const t = Math.round(run.tread);
      const r = Math.round(run.riser);
      const rule = 2 * r + t;
      if (t < TREAD_MIN || rule < STEP_RULE.lo || rule > STEP_RULE.hi) {
        out.push({
          code: "RUN06",
          message: `導出された段の寸法が窮屈です: ${run.risers}段 蹴上${r}mm / 踏面${t}mm (2×蹴上+踏面 = ${Math.round(rule)}mm、目安 ${STEP_RULE.lo}〜${STEP_RULE.hi}mm)`,
          ...at,
        });
      }
    } else if (device === "ramp") {
      const declared = s.attrs["slope"];
      if (typeof declared === "number" && declared > 0 && run.slope > 1 / declared + 1e-9) {
        out.push({
          code: "RUN07",
          message: `導出された勾配 ${slopeText(run.slope)} が宣言 1/${declared} より急です (走り長を伸ばすか階高を下げます)`,
          ...at,
        });
      }
    } else if (device === "escalator") {
      if (run.slope < ESCALATOR_SLOPE.lo || run.slope > ESCALATOR_SLOPE.hi) {
        out.push({
          code: "RUN07",
          message: `導出された勾配 ${slopeText(run.slope)} はエスカレーターの常用域 (約1/1.7 = 30度) から外れています`,
          ...at,
        });
      }
    }
  }
  return out;
}
