// koyu — 整合チェック
// コミットのたびに自動で回る検証の芽。構成の矛盾はここで言葉として現れる。
// 高さ方向の一貫性 — BIMが3Dであることで暗黙に担保していたもの — は、
// ここでは宣言された不変量 (天井高 + 上階slab ≤ 階高) の検査として明示的に持つ。
// 吹抜け (type:void) はこの不変量の宣言的な免除である。
//
// 診断契約 (ADR-0016): 一次形式は checkDiagnostics の Diagnostic[] — code / severity /
// 日本語本文 / 出所 / 対象パス。check は互換層で、従来の文字列 (位置接頭辞つき) を組み立てる。
// severity はコードの不変属性 — 重さを変えたくなったら新コードを切る。

import {
  placeBand,
  placeOpening,
  planOverlap,
  segmentsFor,
  segmentLength,
  envelopeGaps,
  drawnCut,
  spacesOverlap,
} from "./graph.js";
import { heff, isSemiOutdoor, levelsSorted, type Attrs, type Boundary, type Edge, type Level, type Model, type Pt, type Rect, type Space,
  columnSites,
  columnsFor,
  pointInPolygon,
  rectToPoly,
  regionOf,
  srcRef,
  polygonAreaM2,
  polygonSelfIntersection,
  shapeEscapesPolygon,
} from "./model.js";
import { cutsInWindow } from "./poly.js";
import { runDecls, runIssues } from "./vertical.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** 構造化診断 (ADR-0016)。message は本文のみ — 位置接頭辞「file:N行目: 」を含まない */
export interface Diagnostic {
  /** 台帳 DIAGNOSTIC_CODES のコード (領域2-3字 + 2桁連番) */
  code: DiagnosticCode;
  severity: "error" | "warning";
  /** 日本語の本文 (位置接頭辞なし) */
  message: string;
  /** 出所の行 (位置を持たない診断は省略) */
  line?: number;
  /** 出所レイヤー (合成時) */
  file?: string;
  /** 対象の空間/ゾーン/polygonのパス (境界は両パス) */
  path?: string[];
  /** 関連位置 (重複の既出側・重なりの相手など) */
  related?: Array<{ line: number; file?: string }>;
}

/**
 * 診断コードの台帳 — 全コードと規範severity。specの表 (semantics.md §5) とテストで一致を守る。
 * BND07 は欠番 — 「接しているのに境界が無い」警告はADR-0014 (既定境界) で廃止された。
 * SYN01 は構文・合成エラー (SourceError) の写し — checkは例外を診断にしない。CLIの check --json だけが写す。
 */
export const DIAGNOSTIC_CODES = {
  REF01: "error", // 境界が未定義の空間パスを参照
  BND01: "error", // 同一空間同士の境界
  BND02: "error", // 同一空間対の境界の重複 (edge限定まで同一 — ADR-0013)
  BND03: "error", // 異レベルの空間への壁境界
  BND04: "error", // 接していない空間の境界
  BND05: "warning", // 同一空間対でedge限定の有無が混在
  BND06: "warning", // 境界線分がゼロ
  LVL01: "error", // レベルzの重複
  GEO01: "error", // 自らの領域 (合併の矩形) 同士の重なり
  GEO02: "error", // 同一レベルの空間同士の重なり
  VRT01: "error", // 垂直境界の前提 (領域とレベルを持つ空間同士)
  VRT02: "error", // 非隣接レベル間の垂直境界
  VRT03: "error", // 平面が重ならない垂直境界
  VRT04: "warning", // void境界の上側が非void
  VRT05: "warning", // 垂直境界の開口 (解釈されない)
  VRT06: "warning", // 垂直境界のseg (解釈されない)
  OPN01: "error", // hingeの軸違い
  OPN02: "error", // 開口同士の重なり
  OPN03: "warning", // open境界の開口 (通行に影響しない)
  OPN04: "error", // 開口を置ける境界線分が無い
  OPN05: "error", // 境界線分が複数で曖昧
  OPN06: "error", // 開口の幅が線分長を超える
  OPN07: "error", // 開口の明示位置の軸違い
  OPN08: "error", // 開口の明示位置のはみ出し
  SEG01: "error", // 領域を持たない空間へのarea
  SEG02: "warning", // areaのはみ出し
  SEG03: "warning", // open境界のseg (解釈されない)
  SEG04: "error", // segを置ける境界線分が無い
  SEG05: "error", // segの境界線分が複数で曖昧
  SEG06: "error", // segの幅が線分長を超える
  SEG07: "error", // segの明示位置の軸違い
  SEG08: "error", // segの明示位置のはみ出し
  ZON01: "warning", // 空のゾーン
  ZON02: "warning", // ゾーンと同パスの空間
  HGT01: "error", // 上階への食い込み (高さ不変量違反)
  HGT02: "error", // 部分吹抜けの被覆不足
  HGT03: "warning", // 上階slab未宣言で高さ検査ができない
  HGT04: "warning", // 天井高不明で高さ検査ができない
  HGT05: "warning", // レベルが特定できない領域つき空間
  SIT01: "error", // 敷地形状の重複頂点
  SIT02: "error", // 敷地形状の自己交差
  SIT03: "error", // 建物の敷地形状からのはみ出し
  SIT04: "warning", // 対応するゾーンの無いpolygon
  SIT05: "warning", // 敷地面積の宣言と導出の食い違い
  UID01: "error", // 数字だけのuid (ADR-0015)
  UID02: "error", // 空白を含むuid
  UID03: "error", // uidの重複
  ATT01: "error", // 解釈される属性の値が数値でない (ADR-0028)
  ATT02: "error", // 解釈される属性の値が台帳の語彙にない (ADR-0028)
  DAY01: "error", // daylightの値が 0/1 以外 (ADR-0020)
  RUN01: "error", // 一つの空間に縦動線の宣言が複数 (ADR-0021)
  RUN02: "error", // 縦動線の値が上る向き (N/E/S/W) でない
  RUN03: "error", // 縦動線の領域が矩形一つでない / レベルが不明
  RUN04: "warning", // 上にレベルが無く縦動線の形が生成できない
  RUN05: "error", // form の値が不正、または形が決まらない
  RUN06: "warning", // 導出された段の寸法が窮屈 (書かないが検査する)
  RUN07: "warning", // 導出された勾配が宣言・常用域から外れる
  RUN08: "warning", // 縦動線の形はあるが上下を繋ぐ垂直境界が無い
  LIN01: "error", // 描かれた線が二つの空間を分離しない (ADR-0022)
  LIN02: "error", // 垂直境界に描かれた線
  LIN03: "warning", // 描かれた線が何も切っていない
  ENV01: "warning", // 外皮に穴 — 何にも面していない外周 (ADR-0025)
  COL01: "warning", // 柱の宣言に対して立つ柱が0本 (ADR-0023)
  COL02: "warning", // 同じ通りの交点に複数の柱宣言が重なる (先の宣言が勝つ)
  VER01: "error", // koyu 0.1 での既定境界の導出 (ADR-0017)
  VER02: "error", // koyu 0.3以前で採光の推定対象だった型に daylight が無い (ADR-0020)
  VER03: "error", // koyu 0.4以前のファイルに0.5の語 (縦動線・線・柱・地下)
  SYN01: "error", // 構文・合成エラー (SourceError の写し — check --json のみ)
} as const satisfies Record<string, "error" | "warning">;

/**
 * 診断コードの型 (ADR-0016)。台帳が唯一の出所であり、**登録していないコードは型が通らない**。
 * 以前は Record<string, ...> だったので、台帳に無いコードを emit すると severity が
 * undefined になり、error が黙って warning に落ち、--strict でも終了コード0になった。
 * 「忘れる自由は無い」という契約を、文ではなく型が守る。
 */
export type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;

const EPS = 0.5;
/** 敷地まわりの幾何の許容 (境界上は内側扱い) — ADR-0011の1mm */
const EPS_SITE = 1;
const VERTICAL = new Set(["stair", "shaft", "void"]);
/** 0.3以前が採光の対象と推定していた型 (ADR-0020で廃止)。旧版の受理条件の判定にだけ使う — 意味論には効かない */
const LEGACY_DAYLIT = new Set(["unit", "room", "ldk", "bedroom", "living"]);

/** 互換層 — 従来の文字列形式。位置を持つ診断は「file:N行目: 本文」に組み立てる */
/**
 * 解釈される属性の値の台帳 (ADR-0028)。**spec/vocabulary.md の★が契約であり、これはその写しである。**
 *
 * `of` があれば列挙、無ければ正の数値。ここに無い属性は自由に書けてそのまま運ばれる
 * (台帳の規則3)。daylight は DAY01 が、form は RUN05 が、縦動線の向きは RUN02 が
 * 既に守っているので重ねない。
 */
const ATTR_RULES: Record<string, Record<string, { of?: Array<string | number> }>> = {
  space: {
    h: {},
    ceiling: { of: [0, 1] },
    turn: { of: ["R", "L"] },
    riser: {},
    tread: {},
    entry: {},
    landing: {},
    lane: {},
    slope: {},
    road: {},
  },
  zone: { site: { of: [0, 1] }, area: {} },
  // air:1 の境界の天端高 (手すり・腰壁) — 立体が読むので台帳に載る (ADR-0028)
  boundary: { h: {} },
  opening: { style: { of: ["hinged", "sliding", "auto"] } },
};

interface AttrSubject {
  rules: Record<string, { of?: Array<string | number> }>;
  of: Attrs;
}

/** 値を検査すべき宣言を、出所つきで数え上げる — 母集団は**書かれた宣言**である */
function attrSubjects(
  model: Model,
): Array<[string, AttrSubject, { line?: number; file?: string; path?: string[] }]> {
  const out: Array<[string, AttrSubject, { line?: number; file?: string; path?: string[] }]> = [];
  for (const s of model.spaces.values()) {
    out.push([s.path, { rules: ATTR_RULES["space"]!, of: s.attrs }, { line: s.line, file: s.file, path: [s.path] }]);
  }
  for (const z of model.zones.values()) {
    out.push([`ゾーン ${z.path}`, { rules: ATTR_RULES["zone"]!, of: z.attrs }, { line: z.line, file: z.file, path: [z.path] }]);
  }
  for (const b of model.boundaries) {
    const at = { line: b.line, file: b.file, path: [b.a, b.b] };
    out.push([`境界 ${b.a} | ${b.b}`, { rules: ATTR_RULES["boundary"]!, of: b.attrs }, at]);
    for (const o of b.openings) {
      out.push([
        `${o.kind} (${b.a} | ${b.b})`,
        { rules: ATTR_RULES["opening"]!, of: o.attrs },
        { line: o.line, file: b.file, path: [b.a, b.b] },
      ]);
    }
  }
  return out;
}

/** 書かれた通り語で矩形を名指す — 「どの組が重なっているか」を言えるようにする */
function gridRefText(s: Space, i: number): string {
  const g = s.grids[i];
  if (!g) return `#${i + 1}`;
  return `${g.xa}..${g.xb} ${g.ya}..${g.yb}`;
}

export function check(model: Model): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const d of checkDiagnostics(model)) {
    const text = d.line !== undefined ? `${srcRef(d.line, d.file)}: ${d.message}` : d.message;
    (d.severity === "error" ? errors : warnings).push(text);
  }
  return { errors, warnings };
}

/**
 * 節が共有する文脈。**節をまたいで読まれる値だけ**がここに載る —
 * seenBoundary・pairEdges・siteZones・envelopedLevels・stood・uidOwners・
 * voidPartners・byLevel はどれも一つの節の内側で閉じているので、載せない。
 */
/** 診断の出所 (境界に対する診断が共有する) */
type At = { line?: number; file?: string; path?: string[]; related?: Array<{ line: number; file?: string }> };

interface Ctx {
  model: Model;
  emit: (
    code: DiagnosticCode,
    message: string,
    at?: {
      line?: number;
      file?: string;
      path?: string[];
      related?: Array<{ line: number; file?: string }>;
    },
  ) => void;
  loc: (line: number, file?: string) => { line: number; file?: string };
  /** 領域を持つ空間 (7つの節が読む) */
  withRect: Space[];
  /** z昇順のレベル */
  levels: Level[];
  /** レベル名 → z昇順の添字 (境界の妥当性と高さの節が読む) */
  levelIndex: Map<string, number>;
}

export function checkDiagnostics(model: Model): Diagnostic[] {
  const diags: Diagnostic[] = [];
  /** line:0 は「位置なし」— フィールドごと省略する (既定境界などの導出物) */
  const emit = (
    code: DiagnosticCode,
    message: string,
    at: {
      line?: number;
      file?: string;
      path?: string[];
      related?: Array<{ line: number; file?: string }>;
    } = {},
  ) => {
    diags.push({
      code,
      severity: DIAGNOSTIC_CODES[code],
      message,
      ...(at.line ? { line: at.line } : {}),
      ...(at.line && at.file !== undefined ? { file: at.file } : {}),
      ...(at.path ? { path: at.path } : {}),
      ...(at.related ? { related: at.related } : {}),
    });
  };
  const loc = (line: number, file?: string): { line: number; file?: string } => ({
    line,
    ...(file !== undefined ? { file } : {}),
  });


  const withRect = [...model.spaces.values()].filter((s) => s.rects.length > 0);
  const levels = levelsSorted(model);
  const levelIndex = new Map(levels.map((l, i) => [l.name, i]));
  const ctx: Ctx = { model, emit, loc, withRect, levels, levelIndex };

  // **節の順序が出力の順序である。**互換層は診断を出た順に文字列へ写すので、
  // ここの並びを入れ替えると check の出力が変わる (test/diagnostics.test.ts が固定している)。
  // 節の粒度は「走査単位」であって「診断コードの族」ではない — 一つのループが
  // 複数のコードを出すとき、それらは走査の順に交互に出る。族で割ると並びが崩れる
  checkBoundaryRefs(ctx);
  checkBoundaryIdentity(ctx);
  checkLevelDepth(ctx);
  checkSelfOverlap(ctx);
  checkSpaceOverlap(ctx);
  checkDaylightScope(ctx);
  checkAttrValues(ctx);
  checkRuns(ctx);
  checkDrawnLines(ctx);
  checkEnvelopeGaps(ctx);
  checkColumns(ctx);
  checkLanguageVersion(ctx);
  checkUids(ctx);
  checkBoundaryValidity(ctx);
  checkAreas(ctx);
  checkZones(ctx);
  checkHeights(ctx);
  checkOrphanSpaces(ctx);
  checkSite(ctx);
  return diags;
}


/** 吹抜けが下階の空間の平面をどれだけ覆うか (0..1) */
function voidCoverage(s: Space, partners: Space[]): number {
  let inter = 0;
  for (const r of s.rects) {
    for (const p of partners) {
      for (const pr of p.rects) {
        const o = planOverlap(r, pr);
        if (o) inter += (o.x2 - o.x1) * (o.y2 - o.y1);
      }
    }
  }
  const area = s.rects.reduce((sum, r) => sum + (r.x2 - r.x1) * (r.y2 - r.y1), 0);
  return area > 0 ? inter / area : 0;
}

/** 境界の参照先 — REF01 / BND01 */
function checkBoundaryRefs(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 境界の参照先
  for (const b of model.boundaries) {
    for (const p of [b.a, b.b]) {
      if (!model.spaces.has(p)) {
        emit("REF01", `未定義の空間を参照しています: ${p}`, { line: b.line, file: b.file, path: [b.a, b.b] });
      }
    }
    if (b.a === b.b) {
      emit("BND01", `同じ空間同士の境界は書けません: ${b.a}`, { line: b.line, file: b.file, path: [b.a, b.b] });
    }
  }
}

/** 境界の同一性 — BND02 / BND05 */
function checkBoundaryIdentity(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 境界の同一性: 同じ空間対 (edge限定まで同一) の重複宣言は矛盾の温床 — エラー (ADR-0013)。
  // wall/openの食い違いもこの検査が捕まえる。edge限定の有無が混在する対は線分が重なるため警告
  const seenBoundary = new Map<string, Boundary>();
  const pairEdges = new Map<string, Set<string>>();
  for (const b of model.boundaries) {
    const pair = [b.a, b.b].sort().join(" | ");
    // 描かれた線を持つ境界は、線そのものが実現なので同一性の鍵に線の綴りが入る。
    // 同じ空間対に二本の線 (二箇所の隅切りなど) を引くのは矛盾ではない
    const key = `${pair}#${b.edge ?? ""}#${b.drawn ? `${b.drawn.aRef}..${b.drawn.bRef}` : ""}`;
    const prev = seenBoundary.get(key);
    if (prev) {
      emit(
        "BND02",
        `境界が重複しています: ${pair}${b.edge ? ` edge:${b.edge}` : ""} (既出: ${srcRef(prev.line, prev.file)})`,
        { line: b.line, file: b.file, path: [b.a, b.b], related: [loc(prev.line, prev.file)] },
      );
    } else {
      seenBoundary.set(key, b);
    }
    // 線を持つ境界は外周の残りを取らない (線が線分そのもの) ので、edge の混在の話に入れない
    if (!b.drawn) {
      const set = pairEdges.get(pair) ?? new Set<string>();
      set.add(b.edge ?? "");
      pairEdges.set(pair, set);
    }
  }
  for (const [pair, edges] of pairEdges) {
    if (edges.has("") && edges.size > 1) {
      // 集合に対する診断でも、集合を作った宣言の行は必ず指す —
      // 「どこかで併存している」だけでは直す場所が無い
      const members = model.boundaries.filter((b) => !b.drawn && [b.a, b.b].sort().join(" | ") === pair);
      const first = members.find((b) => !b.edge) ?? members[0];
      emit("BND05", `同じ空間対に edge 限定つきと無しの境界が併存しています (線分が重なります): ${pair}`, {
        ...(first ? { line: first.line, file: first.file } : {}),
        path: pair.split(" | "),
        related: members.filter((b) => b !== first).map((b) => loc(b.line, b.file)),
      });
    }
  }
}

/** レベルの重複 — LVL01 */
function checkLevelDepth(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // レベルの重複
  for (let i = 1; i < levels.length; i++) {
    if (Math.abs(levels[i]!.z - levels[i - 1]!.z) < EPS) {
      emit("LVL01", `レベル ${levels[i - 1]!.name} と ${levels[i]!.name} のzが同じです`, {
        line: levels[i]!.line,
        file: levels[i]!.file,
        related: [loc(levels[i - 1]!.line, levels[i - 1]!.file)],
      });
    }
  }
}

/** 自らの領域の重なり — GEO01 */
function checkSelfOverlap(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 自らの領域 (合併の矩形同士) の重なり
  for (const s of withRect) {
    for (let i = 0; i < s.rects.length; i++) {
      for (let j = i + 1; j < s.rects.length; j++) {
        if (planOverlap(s.rects[i]!, s.rects[j]!)) {
          // どの組かを言わなければ、三つ重なる空間にバイト同一の診断が三件並ぶ
          emit("GEO01", `${s.path} の領域同士が重なっています: ${gridRefText(s, i)} と ${gridRefText(s, j)}`, {
            line: s.line,
            file: s.file,
            path: [s.path],
          });
        }
      }
    }
  }
}

/** 空間同士の重なり — GEO02 */
function checkSpaceOverlap(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 同一レベルでの空間同士の重なり
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      if (spacesOverlap(a, b)) {
        emit("GEO02", `空間の領域が重なっています: ${a.path} と ${b.path}`, {
          line: a.line,
          file: a.file,
          path: [a.path, b.path],
          related: [loc(b.line, b.file)],
        });
      }
    }
  }
}

/** 採光の対象の宣言 — DAY01 */
function checkDaylightScope(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 採光の対象の宣言 (ADR-0020): daylight は「この室に 1/7 の判定を掛ける」という二値の宣言。
  // 綴りの揺れ (daylight:true / daylight:yes) が黙って対象外に落ちるのを防ぐ
  for (const s of model.spaces.values()) {
    const v = s.attrs["daylight"];
    if (v === undefined) continue;
    if (v !== 0 && v !== 1) {
      emit("DAY01", `daylight は 1 (採光判定の対象) か 0 (対象外) です: ${s.path} に daylight:${v}`, {
        line: s.line,
        file: s.file,
        path: [s.path],
      });
    }
  }
}

/** 解釈される属性の値 — ATT01 / ATT02 */
function checkAttrValues(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 解釈される属性の値 (ADR-0028): **書いたのに解釈されなかった値は、黙って既定へ落とさない。**
  //
  // daylight だけが DAY01 で守られていて、他の★属性は素通りだった。帰結は黙殺である —
  // `site:yes` は敷地の検査 (SIT03 error) を丸ごと無効にし、`h:35OO` は高さ不変量
  // (HGT01 error) を消し、`ceiling:none` は天井を張り、`turn:l` は階段を鏡像にする。
  // どれも check は緑のままだった。台帳 (spec/vocabulary.md) が契約である以上、
  // 台帳の型に合わない値はエラーである。
  for (const [where, attrs, at] of attrSubjects(model)) {
    for (const [key, rule] of Object.entries(attrs.rules)) {
      const v = attrs.of[key];
      if (v === undefined) continue;
      if (rule.of) {
        if (!rule.of.includes(v as string | number)) {
          emit("ATT02", `${where} の ${key} は ${rule.of.join(" / ")} のどれかです: ${key}:${v}`, at);
        }
      } else if (typeof v !== "number" || !(v > 0)) {
        emit("ATT01", `${where} の ${key} は正の数値で書きます: ${key}:${v}`, at);
      }
    }
  }
}

/** 縦動線 — RUN01〜RUN08 */
function checkRuns(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 縦動線 (ADR-0021): 宣言の妥当性と、**書かれていない導出値**の妥当性。
  // 段数も踏面も勾配も書かない — だから導出したものを検査する
  for (const i of runIssues(model)) {
    emit(i.code, i.message, { line: i.line, file: i.file, path: [i.path] });
  }
}

/** 描かれた線 — LIN01〜LIN03 */
function checkDrawnLines(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 描かれた線 (ADR-0022): 線は二つの空間を実際に分離しなければならない。
  // 「宣言どおりに切れているか」は arrangement の検査であり、check の仕事
  for (const b of model.boundaries) {
    if (!b.drawn) continue;
    const bAt = { line: b.drawn.line, file: b.file, path: [b.a, b.b] };
    if (VERTICAL.has(b.kind)) {
      emit("LIN02", `垂直境界に線は描けません (線は平面を区切る行為です): ${b.a} | ${b.b}`, bAt);
      continue;
    }
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    if (sa.rects.length === 0 && sb.rects.length === 0) {
      emit("LIN01", `領域を持たない空間同士に線は描けません: ${b.a} | ${b.b}`, bAt);
      continue;
    }
    // 判定と操作を同じ関数に通す (ADR-0027)。窓の中で分離が決まらなければ LIN01、
    // 決まるが実際には何も切っていなければ LIN03。以前は判定だけが別の窓 (線分の
    // 外接矩形) を使っていたので、軸平行の線では窓が潰れて必ず誤報していた
    const cut = drawnCut(sa, sb, b.drawn.a, b.drawn.b);
    if (!cut) {
      emit(
        "LIN01",
        sa.rects.length > 0 && sb.rects.length > 0
          ? `線 ${b.drawn.aRef}..${b.drawn.bRef} は ${b.a} と ${b.b} を分離していません (二つの割付が線の両側に来るように引きます)`
          : `線 ${b.drawn.aRef}..${b.drawn.bRef} が割付をちょうど二等分していて、どちらを残すか決まりません`,
        bAt,
      );
      continue;
    }
    const target = cut.solo ? [cut.solo] : [sa, sb];
    if (!target.some((s) => cutsInWindow(s.rects.map(rectToPoly), cut.window, b.drawn!.a, b.drawn!.b))) {
      emit(
        "LIN03",
        `線 ${b.drawn.aRef}..${b.drawn.bRef} は何も切っていません (既定の隣接線と同じか、割付の外にあります)`,
        bAt,
      );
    }
  }
}

/** 外皮の穴 — ENV01 */
function checkEnvelopeGaps(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 外皮の穴 (ADR-0025): 既定境界は領域を持たない空間との間には導かれない (ADR-0014) ので、
  // 外部への境界の書き忘れは黙って壁の不在になる。導出された外周のうち、
  // 他の空間とも宣言された境界とも向かい合っていない区間を数える。
  // 外構のタイル (site:1 ゾーンの配下)・外部・半屋外は囲われていないのが正常なので数えない。
  // そして**外皮を書き始めているレベルだけ**を見る — 外部への境界が一本も無い階は
  // 外皮をまだ模型にしていないだけであって、穴が開いているのではない。
  // 「書き始めたなら閉じきる」という整合の検査であって、完全性の要求ではない
  const siteZones = [...model.zones.values()].filter((z) => z.attrs["site"] === 1).map((z) => z.path);
  const envelopedLevels = new Set<string>();
  for (const b of model.boundaries) {
    if (b.derived || VERTICAL.has(b.kind)) continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    const outer = sa.rects.length === 0 ? sb : sb.rects.length === 0 ? sa : undefined;
    if (outer?.level) envelopedLevels.add(outer.level);
  }
  for (const s of withRect) {
    if (!s.level || !envelopedLevels.has(s.level)) continue;
    if (s.type === "exterior" || isSemiOutdoor(model, s)) continue;
    if (siteZones.some((z) => s.path.startsWith(z + "/"))) continue;
    const gaps = envelopeGaps(model, s);
    if (gaps.length === 0) continue;
    // **どの辺かを言う。**合計長だけでは、edge を書き分けている図面で直す辺が特定できない。
    // envelopeGaps は座標つきの線分を返しているので、方角は既に手元にある
    const byDir = new Map<string, number>();
    for (const g of gaps) {
      const d = g.edgeOfA ?? (g.horizontal ? "N/S" : "E/W");
      byDir.set(d, (byDir.get(d) ?? 0) + segmentLength(g));
    }
    const total = gaps.reduce((a, g) => a + segmentLength(g), 0);
    const where = [...byDir].map(([d, mm]) => `${d} ${Math.round(mm)}mm`).join(" / ");
    emit(
      "ENV01",
      `外皮に面していない外周があります: ${s.path} — ${where} (合計 ${Math.round(total)}mm・${gaps.length}区間)。外部への境界を書きます`,
      { line: s.line, file: s.file, path: [s.path] },
    );
  }
}

/** 柱 — COL01 / COL02 */
function checkColumns(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 柱 (ADR-0023): 位置は書かれない。宣言に対して一本も立たなければ、
  // 通りか階の指定が実際の床とすれ違っている
  //
  // **母集団は宣言である。**「このレベルに何本立ったか」ではなく「この宣言から何本立ったか」を
  // 問う。前者を数えると、同じ階の別の宣言が一本でも立てた瞬間に、一本も立たない宣言が
  // 黙って通る (ADR-0028)。Column.decl がその帰属を持つ。
  const stood = new Map<number, number>();
  const levelsOfDecl = new Set<string>();
  for (const c of model.columns) for (const lv of c.levels) levelsOfDecl.add(lv);
  for (const lv of levelsOfDecl) {
    for (const col of columnsFor(model, lv)) stood.set(col.decl, (stood.get(col.decl) ?? 0) + 1);
  }
  for (let ci = 0; ci < model.columns.length; ci++) {
    const c = model.columns[ci]!;
    if ((stood.get(ci) ?? 0) > 0) continue;
    const at = { line: c.line, file: c.file };
    // 一本も立たない理由は二つある。**狙う交点に床が無い**か、床はあるが先の宣言に
    // 取られたか。後者を「床がありません」と言うと、直しようのない場所へ人を送る
    const sites = new Set(c.levels.flatMap((lv) => columnSites(model, c, lv).map((p) => `${lv}|${p.grid}`)));
    if (sites.size > 0) {
      // 影を作ったのは、この宣言と同じ交点に**実際に立った**先の宣言だけである
      const shadow = model.columns.filter((o, oi) => {
        if (oi >= ci) return false;
        return o.levels.some((lv) =>
          columnsFor(model, lv).some((k) => k.decl === oi && sites.has(`${lv}|${k.grid}`)),
        );
      });
      emit(
        "COL02",
        `この柱の宣言 (${c.levels.join(",")} ${c.size}角) は同じ交点を先の宣言に取られていて、一本も立ちません (同じ交点では先の宣言が勝ちます)`,
        { ...at, related: shadow.map((o) => loc(o.line, o.file)) },
      );
    } else {
      emit(
        "COL01",
        `柱の宣言に対して立つ柱がありません (通りの交点に床がありません): ${c.levels.join(",")} ${c.size}角`,
        at,
      );
    }
  }
}

/** 言語版の受理条件 — VER01〜VER03 */
function checkLanguageVersion(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 言語版の受理条件 (ADR-0017): 旧版は意味保存の場合のみ受理する。
  // 既定境界 (ADR-0014) が導出されるファイルは、0.1の意味 (境界なし+警告) と食い違う — エラーで二択を示す
  if (model.version === "0.1") {
    for (const b of model.boundaries) {
      if (b.derived) {
        emit(
          "VER01",
          `koyu 0.1 のファイルに境界が宣言されていない接触ペアがあります: ${b.a} | ${b.b} — 0.2では既定の壁が導出され意味が変わります。境界を宣言するか、koyu 0.2 へ上げます`,
          { path: [b.a, b.b] },
        );
      }
    }
  }

  // 0.3以前は型から採光の対象を推定していた (ADR-0020で廃止)。推定対象だった型の空間に daylight が
  // 書かれていなければ、0.4では判定から黙って外れる — 意味が変わるのでエラーで二択を示す
  if (["0.1", "0.2", "0.3"].includes(model.version)) {
    for (const s of model.spaces.values()) {
      if (!LEGACY_DAYLIT.has(s.type) || s.attrs["daylight"] !== undefined) continue;
      emit(
        "VER02",
        `koyu ${model.version} のファイルに daylight の無い ${s.type} があります: ${s.path} — 0.4では型から採光の対象を推定しないので判定から外れます。daylight:1 (対象) か daylight:0 (対象外) を書いてから koyu 0.4 へ上げます`,
        { line: s.line, file: s.file, path: [s.path] },
      );
    }
  }

  // 0.5 で入った語 (縦動線の宣言・描かれた線・柱・地下) は 0.4 以前の処理系が知らない。
  // 知らない処理系では黙って形が生成されないので、版を上げずに使うのはエラー (ADR-0017 決定3)
  if (model.version !== "0.5") {
    const older = `koyu ${model.version} のファイルに 0.5 の語があります`;
    for (const s of model.spaces.values()) {
      const d = runDecls(s);
      if (d.length > 0) {
        emit("VER03", `${older}: ${s.path} の ${d[0]!.device}: (縦動線) — koyu 0.5 へ上げます`, {
          line: s.line,
          file: s.file,
          path: [s.path],
        });
      }
    }
    for (const b of model.boundaries) {
      if (b.drawn) {
        emit("VER03", `${older}: ${b.a} | ${b.b} の line (描かれた線) — koyu 0.5 へ上げます`, {
          line: b.drawn.line,
          file: b.file,
          path: [b.a, b.b],
        });
      }
    }
    for (const c of model.columns) {
      emit("VER03", `${older}: column (柱) — koyu 0.5 へ上げます`, { line: c.line, file: c.file });
    }
    for (const l of Object.values(model.levels)) {
      if (l.underground) {
        emit("VER03", `${older}: level ${l.name} の underground: — koyu 0.5 へ上げます`, {
        line: l.line,
        file: l.file,
      });
      }
    }
  }
}

/** uid — UID01〜UID03 */
function checkUids(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // uid (ADR-0015): 不透明トークン、space/zone横断でモデル全体一意。
  // 数字だけの形は禁じる — parseの数値化で 0123 が 123 になり、書いたトークンの区別が失われる
  const uidOwners = new Map<string, Array<{ kind: string; path: string; line: number; file?: string }>>();
  const collectUid = (kind: string, path: string, attrs: Attrs, line: number, file?: string) => {
    const v = attrs["uid"];
    if (v === undefined) return;
    if (typeof v === "number") {
      emit("UID01", `uid は数字だけのトークンにできません: uid:${v} (sp-${v} のような形にします)`, {
        line,
        file,
        path: [path],
      });
      return;
    }
    if (v === "" || /\s/.test(v)) {
      emit("UID02", `uid に空白は使えません: "${v}"`, { line, file, path: [path] });
      return;
    }
    const arr = uidOwners.get(v) ?? [];
    arr.push({ kind, path, line, file });
    uidOwners.set(v, arr);
  };
  for (const s of model.spaces.values()) collectUid("space", s.path, s.attrs, s.line, s.file);
  for (const z of model.zones.values()) collectUid("zone", z.path, z.attrs, z.line, z.file);
  for (const [uid, owners] of uidOwners) {
    if (owners.length > 1) {
      emit(
        "UID03",
        `uid が重複しています: ${uid} (${owners.map((o) => `${o.kind} ${o.path} — ${srcRef(o.line, o.file)}`).join(", ")})`,
        { path: owners.map((o) => o.path), related: owners.map((o) => loc(o.line, o.file)) },
      );
    }
  }
}

/** 境界の妥当性 — VRT / BND03〜06 / OPN / SEG */
function checkBoundaryValidity(ctx: Ctx): void {
  const { model, emit } = ctx;
  // 境界の妥当性。**一本のループを保つ** — 一つの境界が出す複数のコードは
  // 走査の順に固まって出るので、コードの族で節に割ると並びが崩れる (ADR-0028)。
  // ループの `continue` は「この境界の残りを飛ばす」を意味するので、
  // 段に切り出すときは**呼び出し側の continue として残す** — 判定の綴りを
  // ヘルパの中へ持ち込むと、同じ条件が二箇所に分かれて片方だけ直る
  for (const b of model.boundaries) {
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue; // 未定義の参照は REF01 が言う — 形の検査には進まない
    const bAt = { line: b.line, file: b.file, path: [b.a, b.b] };

    if (VERTICAL.has(b.kind)) {
      checkVerticalBoundary(ctx, b, sa, sb, bAt);
      continue; // 垂直境界は水平の検査 (線分・開口・seg) を一切受けない
    }
    if (sa.rects.length > 0 && sb.rects.length > 0 && sa.level !== sb.level) {
      emit(
        "BND03",
        `異なるレベルの空間に壁境界は書けません (垂直は type:stair/shaft/void): ${b.a} | ${b.b}`,
        bAt,
      );
      continue; // レベルを跨ぐ壁は成立していない — 線分も開口も問わない
    }
    checkBoundarySegments(ctx, b, sa, sb, bAt);
    checkOpenings(ctx, b);
    checkBoundarySegs(ctx, b);
  }
}

/** 垂直境界 (stair/shaft/void) — VRT01〜VRT06 */
function checkVerticalBoundary(ctx: Ctx, b: Boundary, sa: Space, sb: Space, bAt: At): void {
  const { emit, levelIndex } = ctx;
  // 垂直境界: 隣り合うレベルの、平面で重なる空間同士にしか張れない
  if (sa.rects.length === 0 || sb.rects.length === 0 || !sa.level || !sb.level) {
    emit("VRT01", `${b.kind} 境界は領域とレベルを持つ空間同士に書きます`, bAt);
    return; // 前提が崩れているので、以降の判定は意味を持たない
  }
  const ia = levelIndex.get(sa.level);
  const ib = levelIndex.get(sb.level);
  if (ia === undefined || ib === undefined || Math.abs(ia - ib) !== 1) {
    emit("VRT02", `${b.kind} 境界は隣り合うレベルの間に書きます: ${b.a} | ${b.b}`, bAt);
  } else if (!spacesOverlap(sa, sb)) {
    emit("VRT03", `${b.kind} 境界の空間が平面上で重なっていません: ${b.a} | ${b.b}`, bAt);
  }
  if (b.kind === "void") {
    const upper = (ia ?? 0) > (ib ?? 0) ? sa : sb;
    if (upper.type !== "void") {
      emit("VRT04", `void境界の上側は type:void の空間を想定しています: ${upper.path}`, bAt);
    }
  }
  // 咎めているのは字下げされた door / window / seg の行そのものなので、
  // 親の境界宣言ではなくその行を指す。宣言が複数あれば診断も複数出る
  for (const o of b.openings) {
    emit("VRT05", `垂直境界の${o.kind}は解釈されません`, { line: o.line, file: b.file, path: [b.a, b.b] });
  }
  for (const g of b.segs) {
    emit("VRT06", `垂直境界の seg は解釈されません`, { line: g.line, file: b.file, path: [b.a, b.b] });
  }
}

/** 水平境界の線分がゼロ — BND04 / BND06 */
function checkBoundarySegments(ctx: Ctx, b: Boundary, sa: Space, sb: Space, bAt: At): void {
  const { model, emit } = ctx;
  // 線を持つ境界の線分ゼロは「接していない」ではない — 線が分離していないか
  // 何も切っていないかであり、それは LIN01 / LIN03 が言う
  if (b.drawn) return;
  const segs = segmentsFor(model, b);
  if (sa.rects.length > 0 && sb.rects.length > 0 && segs.length === 0) {
    // **線分がゼロの理由は二つある。**接していないか、edge: で絞った先に共有辺が
    // 無いか。前者だと断言すると、実際には接している二室について「割付を直せ」と
    // 言うことになる — 直すべきは方角一語である (N=+Y, S=-Y, E=+X, W=-X)
    const without = b.edge ? segmentsFor(model, { ...b, edge: undefined }) : [];
    if (without.length > 0) {
      const dirs = [...new Set(without.map((g) => g.edgeOfA))].filter((d): d is Edge => d !== undefined);
      emit(
        "BND04",
        `edge:${b.edge} に共有辺がありません: ${b.a} | ${b.b} (実際に接しているのは ${
          dirs.join("・") || "別の辺"
        } です)`,
        bAt,
      );
    } else {
      emit("BND04", `空間が接していないため境界を導けません: ${b.a} | ${b.b}`, bAt);
    }
  }
  if ((sa.rects.length > 0 ? 1 : 0) + (sb.rects.length > 0 ? 1 : 0) === 1 && segs.length === 0) {
    emit(
      "BND06",
      `${b.edge ? `edge:${b.edge} の` : ""}外周に残る辺が無く、境界線分がゼロです: ${b.a} | ${b.b}`,
      bAt,
    );
  }
}

/**
 * 開口 — OPN03 / 配置エラー (OPN04〜08) / OPN01 / OPN02。
 * **一つの関数に保つ** — 配置に失敗した開口は OPN01 も受けず OPN02 の母集団からも外れる。
 * 配置の結果 (placedOnSeg) を跨いで持つのはここだけである
 */
function checkOpenings(ctx: Ctx, b: Boundary): void {
  const { model, emit, loc } = ctx;
  if (b.kind === "open" && b.openings.length > 0) {
    for (const o of b.openings) {
      emit("OPN03", `open境界の${o.kind}は通行に影響しません (常に通れます)`, {
        line: o.line,
        file: b.file,
        path: [b.a, b.b],
      });
    }
  }
  const placedOnSeg: Array<{ o: (typeof b.openings)[number]; key: string; c: number }> = [];
  for (const o of b.openings) {
    const placed = placeOpening(model, b, o);
    if ("error" in placed && placed.error) {
      emit(placed.code, placed.message, { line: placed.line, file: placed.file, path: [b.a, b.b] });
      continue; // 置けなかった開口は、以降 (hinge の軸・重なり) の対象にならない
    }
    if ("segment" in placed) {
      const s = placed.segment;
      placedOnSeg.push({
        o,
        key: `${s.x1},${s.y1},${s.x2},${s.y2}`,
        c: s.horizontal ? placed.cx : placed.cy,
      });
    }
    if (o.hinge && "segment" in placed) {
      const okAxis = placed.segment.horizontal
        ? o.hinge === "W" || o.hinge === "E"
        : o.hinge === "N" || o.hinge === "S";
      if (!okAxis) {
        emit(
          "OPN01",
          `hinge:${o.hinge} は${placed.segment.horizontal ? "水平線分 (W/E)" : "垂直線分 (N/S)"}で指定します`,
          { line: o.line, file: b.file, path: [b.a, b.b] },
        );
      }
    }
  }
  // 同じ線分の上の開口同士は重なってはならない
  const byKey = new Map<string, typeof placedOnSeg>();
  for (const p of placedOnSeg) {
    const arr = byKey.get(p.key) ?? [];
    arr.push(p);
    byKey.set(p.key, arr);
  }
  for (const group of byKey.values()) {
    group.sort((p, q) => p.c - q.c);
    for (let k = 0; k + 1 < group.length; k++) {
      const p = group[k]!;
      const q = group[k + 1]!;
      const need = (p.o.w + q.o.w) / 2;
      if (q.c - p.c < need - EPS) {
        emit(
          "OPN02",
          `開口同士が重なっています (${p.o.kind}と${q.o.kind} — 中心間 ${Math.round(
            q.c - p.c,
          )}mm < 必要 ${Math.round(need)}mm)`,
          { line: q.o.line, file: b.file, path: [b.a, b.b], related: [loc(p.o.line, b.file)] },
        );
      }
    }
  }
}

/** 数えない分節 (seg) の配置 — SEG03 / SEG04〜08 */
function checkBoundarySegs(ctx: Ctx, b: Boundary): void {
  const { model, emit } = ctx;
  for (const g of b.segs) {
    if (b.kind === "open") {
      emit("SEG03", `open境界 (壁が無い) の seg は解釈されません`, { line: g.line, file: b.file, path: [b.a, b.b] });
      continue;
    }
    const placed = placeBand(model, b, g, "seg");
    if ("error" in placed && placed.error) {
      emit(placed.code, placed.message, { line: placed.line, file: placed.file, path: [b.a, b.b] });
    }
  }
}

/** 数えない分節 — SEG01 / SEG02 */
function checkAreas(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 数えない分節 (area) は親の領域に収まっているか
  for (const s of model.spaces.values()) {
    for (const a of s.areas) {
      if (s.rects.length === 0) {
        emit("SEG01", `領域を持たない空間 ${s.path} に area は書けません`, {
          line: a.line,
          file: s.file,
          path: [s.path],
        });
        continue;
      }
      // 内包も導出された形で見る — 割付で見ると、切り落とした側に置いた床材が通ってしまう
      const inside = regionOf(s).some((g) =>
        rectToPoly(a.rect).every((pt) => pointInPolygon(pt, g, EPS)),
      );
      if (!inside) {
        emit("SEG02", `area が ${s.path} の領域からはみ出しています`, { line: a.line, file: s.file, path: [s.path] });
      }
    }
  }
}

/** ゾーン — ZON01 / ZON02 */
function checkZones(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // ゾーン: 束ねる空間が実在するか
  for (const z of model.zones.values()) {
    const children = [...model.spaces.keys()].filter((p) => p.startsWith(z.path + "/"));
    if (children.length === 0) {
      emit("ZON01", `ゾーン ${z.path} の下に空間がありません`, { line: z.line, file: z.file, path: [z.path] });
    }
    if (model.spaces.has(z.path)) {
      emit("ZON02", `ゾーンと同じパスの空間があります (どちらかに寄せます): ${z.path}`, {
        line: z.line,
        file: z.file,
        path: [z.path],
      });
    }
  }
}

/** 高さ方向の一貫性 — HGT01〜HGT04 */
function checkHeights(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 高さ方向の一貫性: 下階の空間の天井高 + 上階のslab ≤ 階高
  // 吹抜け (void境界) は宣言的な免除だが、免除が効くのは吹抜けが平面を覆う範囲まで —
  // 部分吹抜けでは下階の天井高は階高内に収める (吹抜け部分の高さは導出) (ADR-0006追記)
  const voidPartners = new Map<string, Space[]>();
  for (const b of model.boundaries) {
    if (b.kind !== "void") continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa?.level || !sb?.level) continue;
    const ia = levelIndex.get(sa.level) ?? 0;
    const ib = levelIndex.get(sb.level) ?? 0;
    const lower = ia < ib ? sa : sb;
    const upper = ia < ib ? sb : sa;
    const key = `${lower.path}|${upper.level}`;
    const arr = voidPartners.get(key) ?? [];
    arr.push(upper);
    voidPartners.set(key, arr);
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
      if (isSemiOutdoor(model, s)) continue; // 屋外・半屋外 (庭・バルコニー等) に天井は無い
      // 縦動線の宣言的免除 (ADR-0021)。void の免除が「床の不在」だったのに対し、
      // こちらは「天井が面でない」— 階段室・斜路の天井は上の走りに沿って傾いている。
      // h を一つの数で語れない以上、この不変量は成立しない。頭上高さの検査は別の問い
      if (runDecls(s).length > 0) continue;
      const covered = above.some((u) => spacesOverlap(s, u)) || above.length === 0;
      if (!covered) continue;
      if (lu.slab === undefined) {
        slabMissing = true;
        continue;
      }
      const h = heff(model, s);
      if (h === undefined) {
        emit("HGT04", `${s.path} の天井高が不明で、${lu.name} との高さ検査ができません`, {
          line: s.line,
          file: s.file,
          path: [s.path],
        });
        continue;
      }
      if (h + lu.slab > pitch + EPS) {
        const partners = voidPartners.get(`${s.path}|${lu.name}`) ?? [];
        const cover = partners.length ? voidCoverage(s, partners) : 0;
        if (cover >= 0.99) continue; // 全面吹抜け — 宣言的免除
        if (partners.length) {
          // 本文は HGT01 と同じ三項を出す — 決め手が上階の slab のとき
          // 「天井高3000は階高3000を超えます」という成り立たない不等式になっていた。
          // 被覆は免除しきい値 (99%) と衝突しないよう小数一桁で言う
          emit(
            "HGT02",
            `${s.path} が上階に食い込みます: 天井高${h} + ${lu.name}のslab${lu.slab} = ${
              h + lu.slab
            } > 階高${pitch}。吹抜けの被覆は${(cover * 100).toFixed(1)}%しかありません — 部分吹抜けでは天井高を階高内に収めます (吹抜け部分の高さは導出)`,
            { line: s.line, file: s.file, path: [s.path] },
          );
        } else {
          emit(
            "HGT01",
            `${s.path} が上階に食い込みます: 天井高${h} + ${lu.name}のslab${lu.slab} = ${h + lu.slab} > 階高${pitch}`,
            { line: s.line, file: s.file, path: [s.path] },
          );
        }
      }
    }
    if (slabMissing) {
      emit("HGT03", `レベル ${lu.name} に slab が未宣言のため、${lb.name} との高さ検査ができません`, {
        line: lu.line,
        file: lu.file,
      });
    }
  }
}

/** レベルに載らない空間 — HGT05 */
function checkOrphanSpaces(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // レベルに載らない領域つき空間
  for (const s of withRect) {
    if (!s.level) {
      emit("HGT05", `${s.path} は領域を持ちますが、レベルが特定できません (パス先頭か level: で指定します)`, {
        line: s.line,
        file: s.file,
        path: [s.path],
      });
    }
  }
}

/** 敷地形状 — SIT01〜SIT05 */
function checkSite(ctx: Ctx): void {
  const { model, emit, loc, withRect, levels, levelIndex } = ctx;
  // 敷地形状 (ADR-0011): 形の妥当性、対応ゾーンの存在、宣言面積との照合、建物のはみ出し検査。
  // はみ出しは四隅の内包に加え、多角形の頂点の入り込みと辺の交差を見る — 凹敷地でも正しい (ADR-0013)。
  // 地上の外部空間タイル (庭・通路) は近似なので検査しない — 面積の真は多角形が持つ
  for (const poly of model.polygons.values()) {
    for (let i = 0; i < poly.points.length; i++) {
      const a = poly.points[i]!;
      const b = poly.points[(i + 1) % poly.points.length]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) <= EPS_SITE) {
        emit("SIT01", `敷地形状に重複する頂点があります (${Math.round(a.x)},${Math.round(a.y)})`, {
          line: poly.line,
          file: poly.file,
          path: [poly.path],
        });
      }
    }
    const selfX = polygonSelfIntersection(poly.points);
    if (selfX) {
      emit("SIT02", `敷地形状が自己交差しています (${Math.round(selfX.x)},${Math.round(selfX.y)} 付近)`, {
        line: poly.line,
        file: poly.file,
        path: [poly.path],
      });
      continue; // 不正な形に対する包含・面積は判定しない
    }
    const zone = model.zones.get(poly.path);
    if (!zone) {
      emit("SIT04", `polygon ${poly.path} に対応するゾーンがありません`, {
        line: poly.line,
        file: poly.file,
        path: [poly.path],
      });
      continue;
    }
    if (zone.attrs["site"] !== 1) continue;
    const declared = zone.attrs["area"];
    if (typeof declared === "number") {
      const derived = polygonAreaM2(poly.points);
      if (Math.abs(declared - derived) >= 0.05) {
        emit(
          "SIT05",
          `敷地面積の宣言と導出が食い違います: 宣言 ${declared}㎡ / 導出 ${derived.toFixed(2)}㎡`,
          { line: zone.line, file: zone.file, path: [zone.path] },
        );
      }
    }
    for (const s of withRect) {
      if (s.type === "exterior" || s.path.startsWith(poly.path + "/")) continue;
      // 照合するのは割付ではなく**導出された領域** — 敷地なりに切った外形はここで通る
      for (const r of regionOf(s)) {
        const out = shapeEscapesPolygon(r, poly.points, EPS_SITE);
        if (out) {
          emit("SIT03", `${s.path} が敷地形状からはみ出しています (${Math.round(out.x)},${Math.round(out.y)} 付近)`, {
            line: s.line,
            file: s.file,
            path: [s.path],
          });
          break;
        }
      }
    }
  }
}
