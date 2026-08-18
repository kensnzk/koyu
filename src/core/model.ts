// koyu v0 — データモデル
// 一次要素は空間。壁は二つの空間の「境界」という関係であり、物ではない。
// 形はここには無い。形は生成物である。(docs/writing-architecture.md)

import * as poly from "./poly.js";

export type AttrValue = string | number;
export type Attrs = Record<string, AttrValue>;

/**
 * The correspondence between the two version lines, and the only place it is recorded.
 *
 * muro is the language; koyu is the implementation that reads it. They are counted
 * separately because they promise different things, and until this ledger existed nothing
 * said which koyu implemented which muro — the published norm asserted the declaration in
 * prose while no such declaration existed on any surface.
 *
 * - `muro`  the language version, as written in a `.muro` file
 * - `since` the koyu version that first read it. **A version that shipped** — `1.0.0-rc.1`
 *           carried muro 1.0 in the tree but never reached npm, so muro 1.0 arrived for
 *           anyone outside this repository at 0.16.0, and that is what this records
 * - `until` the last koyu version that reads it, once a version is retired. Empty on every
 *           row: nothing has been retired. The field exists so that retiring is filling in
 *           a value rather than reshaping the ledger
 *
 * **The order of this array is the order of the versions, oldest first.** Comparison is by
 * index, never by spelling — as strings, "0.5" sorts after "1.0".
 *
 * Cutting a language version is adding a row here. `test/release.test.ts` holds that: a
 * release that moves the newest version must carry a row whose `since` is its own version.
 */
export const MURO_SUPPORT: readonly { muro: string; since: string; until: string | null }[] = [
  // The `koyu` keyword was read from the first commit, accepting whatever followed it.
  { muro: "0.1", since: "0.0.1", until: null },
  // 0.9.0 introduced the accepted-version list, and with it the first rejection.
  { muro: "0.2", since: "0.9.0", until: null },
  { muro: "0.3", since: "0.11.0", until: null },
  { muro: "0.4", since: "0.11.0", until: null },
  { muro: "0.5", since: "0.11.0", until: null },
  // Not 1.0.0-rc.1. That version set muro 1.0 in the tree and was never published; the
  // implementation version was returned to the 0.x line and shipped as 0.16.0 instead.
  { muro: "1.0", since: "0.16.0", until: null },
  { muro: "1.1", since: "0.17.0", until: null },
  // The version line stops answering to the implementation's name: `muro 1.2`, not `koyu 1.2`.
  { muro: "1.2", since: "0.20.0", until: null },
  // 1.3 adds no notation. It retires `use`, whose job was never a use — it held one grouping per
  // space, so tenancy, fire compartment and department all competed for it. VER07 stops it here;
  // the ledger row stays so that every version up to 1.2 goes on reading it (ADR-0061).
  { muro: "1.3", since: "0.21.0", until: null },
];

/** The word a version line is written with from 1.2 on. */
export const MURO_KEYWORD = "muro";

/**
 * The last version whose line is spelled `koyu`.
 *
 * **One spelling per version, never both.** Up to and including this version a file declares
 * itself `koyu <v>`, and from the next one it declares itself `muro <v>`. Accepting both for
 * the same version would give one declaration two spellings, and the canonical form's
 * uniqueness — which the whole conformance suite rests on — would go with it.
 *
 * Files written before 1.2 keep the old spelling and keep meaning exactly what they meant.
 * Nothing migrates, and nothing has to.
 */
export const LAST_KOYU_SPELLED_VERSION = "1.1";

/**
 * This implementation's own version — the one npm installs, held in step with `package.json`
 * by `test/release.test.ts`.
 *
 * It sits beside `MURO_SUPPORT` because the two are one fact read from two directions: the
 * `since` column is written in this vocabulary, and every surface that answers "which muro
 * does this build speak" needs both halves at once.
 */
export const KOYU_VERSION = "0.24.0";

/**
 * Whether `a` names a later language version than `b`.
 *
 * **Not by index in the ledger** — the whole point is to answer for a version the ledger has
 * never heard of, which is what a file from the future carries. Compared as numbers, because
 * as strings `"0.5" > "1.0"`. A spelling that is not `major.minor` is not a version at all
 * and is never "newer": it is unreadable, which is a different answer.
 */
export function isNewerVersion(a: string, b: string): boolean {
  const shape = /^(\d+)\.(\d+)$/;
  const pa = shape.exec(a);
  const pb = shape.exec(b);
  if (!pa || !pb) return false;
  const major = Number(pa[1]) - Number(pb[1]);
  return major !== 0 ? major > 0 : Number(pa[2]) > Number(pb[2]);
}

/**
 * What this build reads, what the newest version is, and how an undeclared file is read.
 *
 * The last two are separate facts and only coincide today. Once a newer version exists they
 * differ permanently, and the line has to say both or it is telling half the truth to the
 * person most likely to be surprised by it.
 */
export function versionLine(): string {
  const read = SUPPORTED_LANGUAGE_VERSIONS;
  const range = `${read[0]}–${read[read.length - 1]}`;
  return `koyu ${KOYU_VERSION} — reads muro ${range} (newest ${NEWEST_LANGUAGE_VERSION}; a file with no version line is read as ${DEFAULT_LANGUAGE_VERSION})`;
}

/**
 * The koyu version that first read this muro version, or `undefined` if no such version is
 * accepted. This is the direction a downstream needs: it depends on a language version and
 * has to turn that into a package range.
 */
export function koyuSince(muro: string): string | undefined {
  return MURO_SUPPORT.find((r) => r.muro === muro)?.since;
}

/**
 * Whether this build reads the given muro version.
 *
 * **What a downstream actually depends on is a language version, not a package range.** An
 * application that writes `muro 1.1` needs a koyu that reads 1.1; which koyu that is, is the
 * ledger's business, not the application's. Asserting this at startup turns a version skew
 * into one sentence instead of a parse error somewhere later.
 */
export function speaksMuro(muro: string): boolean {
  return SUPPORTED_LANGUAGE_VERSIONS.includes(muro);
}

/**
 * Throw unless this build reads the given muro version, naming what would fix it.
 *
 * Separate from `speaksMuro` because the useful thing at a startup check is the message: the
 * caller knows the version it needs and nothing else, and the ledger is the only place that
 * can say which koyu to install for it.
 */
export function requireMuro(muro: string): void {
  if (speaksMuro(muro)) return;
  const row = MURO_SUPPORT.find((r) => r.muro === muro);
  const head = `This build of koyu (${KOYU_VERSION}) does not read muro ${muro}.`;
  // A row with `until` set is retired, and the advice is the opposite of the usual one:
  // a newer koyu will not help, because newer is what dropped it.
  if (row?.until) {
    throw new Error(
      `${head} It was retired after koyu ${row.until} — migrate the file, or install koyu ${row.until} or earlier.`,
    );
  }
  if (row) throw new Error(`${head} It arrived in koyu ${row.since} — install koyu ${row.since} or later.`);
  // **No row is not evidence that no koyu reads it.** A build only carries the rows compiled
  // into it, so a version released after this one looks exactly like a version that never
  // existed. Saying which is which is not this build's to say; saying what it knows is.
  const newer = isNewerVersion(muro, NEWEST_LANGUAGE_VERSION);
  throw new Error(
    newer
      ? `${head} It is newer than anything this build knows (it reads up to ${NEWEST_LANGUAGE_VERSION}) — upgrade koyu.`
      : `${head} This build reads ${SUPPORTED_LANGUAGE_VERSIONS.join(", ")}.`,
  );
}

/**
 * The language versions this build accepts (ADR-0017). An older version is accepted only
 * where the meaning is preserved; `check` is what decides that.
 *
 * **Derived from `MURO_SUPPORT`, not declared beside it.** Two lists of one fact is how the
 * correspondence drifted in the first place.
 */
export const SUPPORTED_LANGUAGE_VERSIONS: readonly string[] = MURO_SUPPORT.filter(
  (r) => r.until === null,
).map((r) => r.muro);

/**
 * The newest language version this build accepts — what to declare to get everything.
 * Derived, for the same reason as above.
 */
export const NEWEST_LANGUAGE_VERSION = SUPPORTED_LANGUAGE_VERSIONS[SUPPORTED_LANGUAGE_VERSIONS.length - 1]!;

/**
 * How a file with no version line is read. **Frozen at 1.1, and it does not follow the newest
 * version.**
 *
 * It used to be the newest, which meant an undeclared file was re-read under new semantics
 * every time the tool moved — silently, because nothing reports the absence of a declaration.
 * That is not hypothetical: the 1.0 → 1.1 move read `exterior` out of the type position, and
 * undeclared files written in the old dialect lost their outside spaces without a word.
 *
 * Freezing removes the danger rather than reporting it. **Newer semantics are opt-in: you get
 * them by naming them.** The cost is that an undeclared file never gets new notation, which is
 * the same statement read from the other side.
 *
 * Freezing this was not itself a version bump: at the moment it froze, the frozen value and
 * the newest version were both 1.1, so no file that existed read differently. They part
 * company from 1.2 on, and that gap is the whole point — an old file that names no version
 * does not quietly become a 1.2 file.
 */
export const DEFAULT_LANGUAGE_VERSION = "1.1";

/**
 * 機械形式 (正準JSON) が自分を名乗る版 (ADR-0036)。**言語版でもツール版でもない** —
 * 数えるのは綴りだけである。minorはキーが増えたとき、majorは既存のキーの名前・並び・照合順・
 * 正規化・数の綴りが変わったとき。**minorでも全ての文書のバイトは動く** — この文字列自体が
 * 第一キーだからで、増えたキーを持たない文書も先頭行だけは変わる (ADR-0051 が実測している)。
 * 意味論の版は muro が持つので、`muro` キー (書かれた版宣言の素通し) とは別の面である。
 *
 * The format keeps the name `koyu` because it is the implementation's output spelling — the
 * shape koyu writes. The key inside it names the language, and is spelled `muro` for the same
 * reason the version line is.
 *
 * **That rename is why this is 2.0 and not 1.3.** An existing key changed its name, which the
 * rule above puts squarely in major. Shipping it as a minor would have told every reader that
 * `1.x` stays compatible — so a reader expecting `koyu` would have accepted the document and
 * found no language version in it, which is the silent misread the format version exists to
 * prevent.
 */
export const CANONICAL_FORMAT = "koyu-canonical/2.0";

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
  /** 宣言の出所 — level 由来の診断 (LVL01/HGT03/VER03) が位置を持てるように (ADR-0028) */
  line: number;
  file?: string;
}

export interface GridAxis {
  /** 通り名 (X1, X2, ...) */
  names: string[];
  /** 座標 mm */
  coords: number[];
}

/** A grid reference resolved: which axis names it, and where it sits in mm. */
export interface GridPosition {
  axis: "X" | "Y";
  coord: number;
}

/**
 * A grid reference — `X2`, `X2+600`, `Y3-150` — resolved to an axis and a coordinate in mm.
 * `undefined` when the spelling is not a grid reference, or names no declared line.
 *
 * **This is the one place the spelling is read.** The notation writes no coordinate directly
 * (docs/reference/muro/positions.md), so every position in a source is a reference in this form:
 * an opening's `at:`, a `seg`'s, the endpoints of a drawn line. A caller outside the parser — the
 * `--at` of a section, say — resolves through here rather than through a second copy of the
 * pattern, because two copies is how `--at X3+450` and `at:X3+450` come to disagree.
 *
 * The names are machine-generated (`X1`, `Y2`, …), never written by the author, so the pattern is
 * the whole grammar: an axis letter, a line number, and at most one signed whole-millimetre offset.
 */
export function gridRef(model: Model, token: string): GridPosition | undefined {
  const m = /^([XY]\d+)([+-]\d+)?$/.exec(token);
  if (!m) return undefined;
  const offset = m[2] ? Number(m[2]) : 0;
  for (const axis of ["X", "Y"] as const) {
    const g = model.grid[axis];
    const i = g.names.indexOf(m[1]!);
    if (i >= 0) return { axis, coord: g.coords[i]! + offset };
  }
  return undefined;
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
  /**
   * 自由なラベル。**core はこの語を一切読まない**ので、綴りは何の判定にも効かない。
   * 集計の軸と図面の刷り字にだけ現れる。任意 — 書かなければ何も無い。
   * 構成の事実 (外部・吹抜け) は `outside:` / `void:` の宣言の側にある
   */
  type?: string;
  /** 所属レベル名 (パス先頭セグメント、または level: 属性) */
  level?: string;
  /** グリッド参照。複数矩形の合併でL字などを表す (rectsと同順) */
  grids: GridRef[];
  /** グリッド解決後のmm矩形の合併。`outside:1` の空間などは空。**書かれた割付** (セル) であって形ではない */
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
  /**
   * 切り分けの帰結 — **導出したその場で記録する** (ADR-0041)。
   *
   * `derivePieces` は割付から形を起こしながら線を順に適用するので、その時点でしか
   * 「この線が実際に何かを切ったか」を正しくは言えない。診断が後から計算し直すと、
   * **既に切られた形**を相手に窓を組み立てることになり、母集団が食い違う。
   * 判定と操作を同じ場所に置く — 同じ関数を通すだけでなく、同じ母集団を見る (ADR-0041)。
   *
   * `undetermined` = 残す側が決まらない (LIN01) / `nothing` = 何も切らない (LIN03)。
   * 正準JSONには出ない — 書かれた構成ではなく導出の帰結だからである。
   */
  effect?: "cut" | "nothing" | "undetermined";
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
  return `${file ? `${file}:` : ""}line ${line}`;
}

export interface Model {
  version: string;
  name?: string;
  unit: "mm";
  /**
   * 測地の枠 — 位置 (ADR-0057)。**core は持つだけで、投影も子午線収差角も計算しない。**
   * モデルは一つの枠を持つ (`origin` は全レイヤーを通して一度)
   */
  origin?: SiteOrigin;
  /** 測地の枠 — 真北 (ADR-0057)。**不在は 0 ではなく「未知」である** */
  azimuth?: Azimuth;
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
  /**
   * 合成に参加したレイヤー (ローダーのキー)。**この並びが層の強度順序である** (docs/reference/muro/import.md)。
   * entry が添字0で最も弱く、**後の層ほど強い**。単一ソースの parse では空。
   *
   * 並びは import 行を深さ優先で平坦化した順で、同じ層が二度現れれば最初の位置を保つ。
   * 著者が import 行を並べる行為が強度の宣言であり、暗黙の解決はどこにも無い。
   */
  layers: string[];
  /**
   * 属性ごとの出所 (合成の規則6 — 出所が追える)。
   * キーは `<種別>:<対象>:<属性キー>`、値は `layers` の添字。
   *
   * 「最終的な値を、どの層のどの行が与えたか」を言えるようにするためにある。
   * `over` はここを読んで**強い層の意見だけを通す** — 走査の順ではなく強度で決まる。
   */
  attrSrc: Map<string, number>;
  /** koyu版が明示宣言されたか (base層でのみ・一度だけ — ADR-0017の合成規則の管理用) */
  versionDeclared?: boolean;
  /**
   * muro 1.0 で入った合成の語 (`over` / `drop` / `over` 直下の `+` `-` `=`) が書かれた箇所 (ADR-0038)。
   * **上書きの跡は機械形式に残らない** (合成の規則5) ので、正準JSONにも合成後のモデルにも
   * 「上書きが書かれたかどうか」は残らない。VER04 が旧版の宣言を捕まえるには宣言の出所が要るので、
   * ここだけが走査の順に持つ。診断のためだけの列であり、導出も正準形もこれを読まない
   */
  compositionEdits: CompositionEdit[];
}

/** `over` / `drop` / 集合編集の宣言 (VER04 のための出所 — ADR-0038) */
export interface CompositionEdit {
  /** 書かれた語そのもの — `over` / `drop` / `+` / `-` / `=` */
  word: string;
  /** 何に向けられた宣言か (メッセージに出す。`over /L1/a` の `/L1/a` など) */
  subject: string;
  line: number;
  file?: string;
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
  /**
   * どの宣言から立ったか (model.columns の添字)。**診断の母集団を宣言に戻すために要る** —
   * これが無いと「この宣言に対して一本も立たない」を問えない (ADR-0028)
   */
  decl: number;
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

/**
 * 測地の原点 (ADR-0057) — モデルの (0,0,0) が外の座標系のどこに座るか。測量に由来する所与で、
 * 敷地形状 (SitePolygon) と同じ隔離レイヤーに住む。
 *
 * **単位はメートルであって mm ではない。** これはモデルの中の長さではなく、外の枠の中の点であり、
 * 外の枠は自分の数字を持つ。mm を選べば `-8000.12` → `-800012` の桁埋め誤りが 7.2m のずれとして
 * 完全に静かに通る (1000倍の誤りは騒がしいが、桁埋めの誤りは騒がない)。
 *
 * **EPSG コードは解釈しない。**測地系・投影・系番号・軸順を一語で言い切るので、測地系を別に綴れば
 * 矛盾の余地ができる。core が見るのは正の整数であることだけで、コード表は持たない
 */
export interface SiteOrigin {
  /** 水平 (2D 投影) CRS の EPSG コード。複合コードは受けない — `vertical` と役割を分ける */
  epsg: number;
  /** 東距 m。**平面直角座標系の成果では Y 欄である** */
  easting: number;
  /** 北距 m。**平面直角座標系の成果では X 欄である** — 通常の慣習の逆 */
  northing: number;
  /** モデルの z=0 の高さ m。**GL でも地盤面でも平均地盤面でもない。**`vertical` と対で書く */
  elevation?: number;
  /** 鉛直 CRS の EPSG コード (日本は 6695 = T.P. 系)。`elevation` と対で必須 */
  vertical?: number;
  line: number;
  file?: string;
}

/**
 * 真北 (ADR-0057) — モデルの +Y 軸の真方位角。真北から時計回りの度、0 ≤ deg < 360。
 *
 * **方位角であって回転角ではない。**「+Y から北へ時計回り」と綴れば逆向きの方位角になり、
 * 建築も測量も時計回りの角を北から対象へ測るので、読者の既定の読みが定義の逆になる。
 *
 * `N/E/S/W` は依然として軸の語である (docs/reference/muro/orientation.md)。方位を持つ場所は
 * ここひとつで、面の真方位角は deg / deg+90 / deg+180 / deg+270 と消費者の側で一行で出る
 */
export interface Azimuth {
  deg: number;
  line: number;
  file?: string;
}

/** 多角形の面積 ㎡。シューレースの実体は poly.ts にひとつだけある */
export const polygonAreaM2 = (points: Pt[]): number => poly.area(points) / 1e6;

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

/** 点が多角形の辺の上にあるか */
export const onPolygonEdge = poly.onEdge;

/** 点が多角形の内側にあるか (境界上は内側扱い) */
export const pointInPolygon = poly.pointIn;

export class SourceError extends Error {
  constructor(
    public line: number,
    /** 位置情報を除いた本文 (合成時のファイル付与に使う) */
    public raw: string,
    /** 出所ファイル (合成時) */
    public file?: string,
    /**
     * The diagnostic code this failure carries in `check --json`, when it has one of its own.
     *
     * Most parse failures are just syntax and are reported as `SYN01`. A few are a named
     * condition a caller has to be able to act on without matching the message text — a file
     * declaring a language version this build cannot read is the case that forced this: the
     * answer is "upgrade koyu", and a viewer wanting to say so should not be reading English.
     *
     * Narrow on purpose. The diagnostic ledger lives in `diagnose.ts`, which reads this
     * module, so the union cannot be imported here — and widening it to `string` would let
     * a typo reach `check --json` as a code no page documents.
     */
    public code?: "VER06",
  ) {
    super(`${file ? `${file}:` : ""}line ${line}: ${raw}`);
    this.name = "SourceError";
  }
}

/**
 * 空間の導出された領域 (ADR-0022 / docs/reference/form/index.md)。**形を読むときの唯一の入口**。
 * parse の出口で必ず埋まるので、割付への退避は「未parseのModelを手で組んだとき」だけに効く。
 * この式が各所に散っていたことが、rects と pieces の取り違えを四度生んだ根である。
 */
export const regionOf = (s: Space): Pt[][] =>
  s.pieces.length > 0 ? s.pieces : s.rects.map(poly.rectToPoly);

/** 面積 (壁芯) m²。導出された凸片の合計 — 描かれた線で切られていればその形の面積になる */
export function areaM2(s: Space): number | undefined {
  if (s.rects.length === 0) return undefined;
  const a = poly.areaOf(regionOf(s)) / 1e6;
  return Math.round(a * 100) / 100;
}

/** 矩形を頂点列へ (反時計回り) */
export const rectToPoly = poly.rectToPoly;

/** 頂点列の外接矩形 */
export const polyBounds = poly.bounds;

/**
 * 宣言 c がそのレベルで狙う交点のうち、**床の上にあるもの**。先勝ちの規則を適用する前の姿。
 *
 * 「一本も立たない」の理由を二つに割るために要る (ADR-0028) — ここが空なら床が無く、
 * 空でないのに一本も立たないなら先の宣言に取られている。直す手が正反対である。
 */
export function columnSites(
  model: Model,
  c: ColumnDecl,
  level: string,
): Array<{ x: number; y: number; grid: string }> {
  if (!c.levels.includes(level)) return [];
  const floors = [...model.spaces.values()].filter(
    (s) =>
      s.level === level &&
      !isOutside(s) &&
      !isVoid(s) &&
      s.rects.length > 0 &&
      // 空しか支えない床には柱を立てない (ADR-0030): 半屋外で上に床も無い
      // 屋上庭園・テラスは、柱が持ち上げるものを持たない
      !(isSemiOutdoor(model, s) && !isCoveredAbove(model, s)),
  );
  if (floors.length === 0) return [];
  const xs = model.grid.X.names
    .map((n, i) => ({ n, v: model.grid.X.coords[i]! }))
    .filter((g) => !c.xNames || c.xNames.includes(g.n));
  const ys = model.grid.Y.names
    .map((n, i) => ({ n, v: model.grid.Y.coords[i]! }))
    .filter((g) => !c.yNames || c.yNames.includes(g.n));
  const out: Array<{ x: number; y: number; grid: string }> = [];
  for (const gx of xs) {
    for (const gy of ys) {
      const inside = floors.some((s) =>
        (s.pieces.length ? s.pieces : s.rects.map(rectToPoly)).some((p) =>
          pointInPolygon({ x: gx.v, y: gy.v }, p, 1),
        ),
      );
      if (inside) out.push({ x: gx.v, y: gy.v, grid: `${gx.n}/${gy.n}` });
    }
  }
  return out;
}

/**
 * そのレベルに立つ柱を導く (ADR-0023)。
 * 通り芯の交点のうち、床のある空間 (`outside:1`・`void:1` を除く) の内側にあるものへ柱を置く。
 * 位置はどこにも書かれていない — 通りと床という既にある事実の交わりから現れる
 */
export function columnsFor(model: Model, level: string): Column[] {
  const out: Column[] = [];
  const seen = new Set<string>();
  for (let ci = 0; ci < model.columns.length; ci++) {
    const c = model.columns[ci]!;
    for (const site of columnSites(model, c, level)) {
      if (seen.has(site.grid)) continue; // 同じ交点に二本は立たない (先の宣言が勝つ)
      seen.add(site.grid);
      out.push({
        x: site.x,
        y: site.y,
        w: c.size,
        d: c.depth ?? c.size,
        level,
        grid: site.grid,
        decl: ci,
        attrs: c.attrs,
      });
    }
  }
  return out;
}

/**
 * 建物の外部か。**空間の型ではなく `outside:1` の宣言で決まる。**
 *
 * 型の位置は開かれた語彙であって、そこから構成の事実を読むと綴りが意味を持ってしまう。
 * `exteriorr` の一字で外部が屋内になり、延床が倍になりながら check は緑だった。
 * 宣言なら台帳が綴りを守る (ATT03/ATT02) — 開かれた語彙を殺さずに塞ぐ唯一の形である。
 */
export function isOutside(s: Space): boolean {
  return s.attrs["outside"] === 1;
}

/** 吹抜けか — 床が無いので、面積にも通行にも数えない。[[isOutside]] と同じ理由で宣言である */
export function isVoid(s: Space): boolean {
  return s.attrs["void"] === 1;
}

/**
 * 半屋外か — 宣言ではなく導出。外部 (outside:1) に対して
 * open または air:1 (手すり等、遮蔽しない物) の境界で接する空間は半屋外である (ADR-0007)
 */
export function isSemiOutdoor(model: Model, s: Space): boolean {
  if (s.rects.length === 0) return false;
  for (const b of model.boundaries) {
    if (b.kind !== "open" && !b.air) continue;
    const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
    if (!other) continue;
    const o = model.spaces.get(other);
    if (o && isOutside(o)) return true;
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
    if (poly.overlaps(regionOf(s), regionOf(o))) return true;
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
    if (!isIndoor(model, s)) continue;
    sum += areaM2(s) ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * 屋内の床面積に数えるか。**「延べ面積」を問う三箇所 (stats / site / MCP) の唯一の答え**。
 *
 * 判定が散っていたときは、外部そのものが屋内床に入り、しかも「隣に道路を書いたか」で
 * 半屋外に落ちるかどうかが変わっていた。母集団は場所ごとに決めるものではない (ADR-0028)。
 */
export function isIndoor(model: Model, s: Space): boolean {
  if (s.rects.length === 0) return false;
  if (isOutside(s) || isVoid(s)) return false;
  return !isSemiOutdoor(model, s);
}

/**
 * The value a space carries for `key`: its own declaration, else the one on the deepest zone
 * whose path is a prefix of the space's.
 *
 * **The caller names the key, and core forms no opinion about what it means.** That is what
 * makes this legitimate for a carried namespaced key such as `lease.category`: asking is not
 * reading. Core still gives the key no meaning, decides nothing by it, and would answer the
 * same way for a key it has never seen.
 *
 * The resolution is the one `use` had before it was retired, with the literal `"use"` moved out
 * to the caller. Non-string values resolve too — a space that writes `dept.name:2024` now
 * answers with the number rather than falling through to its zone, which is what was written.
 */
export function effectiveAttr(model: Model, s: Space, key: string): AttrValue | undefined {
  const own = s.attrs[key];
  if (own !== undefined) return own;
  let best: AttrValue | undefined;
  let bestLen = -1;
  for (const z of model.zones.values()) {
    if (s.path.startsWith(z.path + "/") && z.path.length > bestLen) {
      const v = z.attrs[key];
      if (v !== undefined) {
        best = v;
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

/**
 * 開口が主張する同一性の名 (ADR-0039)。
 *
 * 開口の同一性は「含む対象 + その中で一意な名」から導かれる (docs/reference/scope.md)。だが
 * `name:` はアセットからも流れ込む — そしてアセットの `name` は**型の名**である
 * (`asset W1 window … name:掃き出し窓`)。同じ建具を一枚の壁に二枚並べるのは
 * ごく普通の設計であり、型の名を同一性の主張として読めば、それが衝突になってしまう。
 *
 * **主張は、その開口の行に書かれた名だけである。**参照したアセットの名と同じ値なら、
 * それは継いだ型の名であって主張ではない (undefined)。
 */
export function openingIdentity(model: Model, o: Opening): string | undefined {
  const n = o.attrs["name"];
  if (n === undefined || n === "") return undefined;
  const name = String(n);
  const inherited = o.ref === undefined ? undefined : model.assets.get(o.ref)?.attrs["name"];
  if (inherited !== undefined && String(inherited) === name) return undefined;
  return name;
}

// ---- 同一性の生成 (ADR-0039) ----

/**
 * 生成される uid の綴り — 接頭辞 `u-` + 16字、合わせて18字。
 *
 * 字母は Crockford base32 の小文字 (`i` `l` `o` `u` を持たない)。**接頭辞の `u` は
 * 字母に無い**ので、生成された uid は必ず一つだけ `u` を持ち、それが先頭である。
 * 16字 × 5ビット = **80ビット**。
 *
 * 接頭辞があるのは、数字だけの綴りを構造的に不可能にするためである (UID01 —
 * 数値化でトークンの区別が失われる)。種別 (space / zone) は綴りに入れない —
 * uid は不透明であり、綴りから何かが読めてはならない。
 */
const UID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const UID_LENGTH = 16;
const UID_PREFIX = "u-";

/**
 * 新しい uid を作る (ADR-0039)。**パスからもモデルの中身からも導出しない** —
 * 導出すれば改名でトークンが変わり、uid の意味 (改名を跨ぐ) が消える。
 *
 * 保証は二段である。
 *
 *   1. **合成済みのこのモデルとは衝突しない。**検査して作るので確実である
 *   2. **まだ合成されていない層・他のリポジトリとは、確率でしか衝突しない。**
 *      80ビットの乱数なので、100万個を集めても衝突確率は 10⁻¹² を下回る。
 *      **確実さが要るなら、合成して `check` を通すこと** — UID03 だけが実際に一意性を証明する
 *
 * 付与は明示の行為である。この関数を呼ばないかぎり、どのツールも uid を書かない (opt-in)。
 */
export function newUids(model: Model, count = 1): string[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`count is a positive integer: ${count}`);
  const taken = new Set<string>();
  for (const s of model.spaces.values()) {
    const v = s.attrs["uid"];
    if (v !== undefined) taken.add(String(v));
  }
  for (const z of model.zones.values()) {
    const v = z.attrs["uid"];
    if (v !== undefined) taken.add(String(v));
  }
  const out: string[] = [];
  const buf = new Uint8Array(UID_LENGTH);
  while (out.length < count) {
    globalThis.crypto.getRandomValues(buf);
    // 1バイト (0..255) の下位5ビットは 0..31 に一様である (256 = 32 × 8) — 剰余の偏りは無い
    let token = UID_PREFIX;
    for (const b of buf) token += UID_ALPHABET[b & 31];
    if (taken.has(token)) continue;
    taken.add(token);
    out.push(token);
  }
  return out;
}

/** 正準JSONの空間エントリ (書かれた表記・正準順)。semantic diff (ADR-0018) が比較基底として共有する */
export function canonicalSpaceEntry(s: Space): Record<string, unknown> {
  return {
    ...(s.type !== undefined ? { type: s.type } : {}),
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
    between: [b.a, b.b].sort(compareCanonical),
    a: b.a,
    kind: b.kind,
    ...(b.t !== undefined ? { t: b.t } : {}),
    ...(b.air ? { air: true } : {}),
    ...(b.edge ? { edge: b.edge } : {}),
    // 描かれた線は書かれた綴りのまま残す — 頂点座標はビルドの産物であって構成ではない
    // 端点の書き順は図形を変えない (線分は向きを持たない — 導出される凸片は同一) ので、
    // 解決座標の昇順に正準化する。**綴りは保つ** (通り参照のまま — 規則3)
    ...(b.drawn ? { line: canonicalLineEnds(b.drawn) } : {}),
    ...(Object.keys(b.attrs).length ? { attrs: sortObj(b.attrs) } : {}),
    ...(b.openings.length ? { openings: sortBySerial(b.openings.map(canonicalOpeningEntry)) } : {}),
    ...(b.segs.length ? { segs: sortBySerial(b.segs.map(canonicalSegEntry)) } : {}),
  };
}

/**
 * 境界を正準の順に並べる (ADR-0041)。
 *
 * **宣言順は正準JSONが捨てる情報である。**捨てられる情報が形を変えてはならないので、
 * 境界を順に読む導出 — 線の切り分け (`derivePieces`) と、関係の同一性の綴り
 * (`derive` の `a|b@i`) — はこの並びを使う。
 *
 * 既定境界 (derived) は正準JSONに出ないが、`model.spaces` の並び (= 宣言順) から
 * 導かれるので、同じ規則で並べ直さないと同じ病を持つ。
 */
export function canonicalBoundaryOrder(model: Model): Boundary[] {
  return [...model.boundaries]
    .map((b, i) => ({ b, key: JSON.stringify(canonicalBoundaryEntry(b)), i }))
    .sort((p, q) => compareCanonical(p.key, q.key) || p.i - q.i)
    .map((x) => x.b);
}

/**
 * The openings of one boundary in canonical order, and its `seg`s likewise.
 *
 * **The same disease as `canonicalBoundaryOrder`, one level down.** The identity of an opening is
 * `<the boundary's ref>/<index within the boundary>`, and that index used to be the declaration
 * order — which the canonical form discards, since it sorts openings by content
 * (`canonicalBoundaryEntry`). So two sources with byte-identical canonical JSON gave the same
 * spelling to *different* openings: `…@4/0` was the door in one and the window in the other.
 *
 * A generated pair found this — the hand-written witnesses never swapped two openings on one
 * boundary, and neither did any conformance case.
 */
export function canonicalOpeningOrder(b: Boundary): Opening[] {
  return [...b.openings]
    .map((o, i) => ({ o, key: JSON.stringify(canonicalOpeningEntry(o)), i }))
    .sort((p, q) => compareCanonical(p.key, q.key) || p.i - q.i)
    .map((x) => x.o);
}

export function canonicalSegOrder(b: Boundary): Seg[] {
  return [...b.segs]
    .map((g, i) => ({ g, key: JSON.stringify(canonicalSegEntry(g)), i }))
    .sort((p, q) => compareCanonical(p.key, q.key) || p.i - q.i)
    .map((x) => x.g);
}

/**
 * Spaces in canonical order (path collation).
 *
 * **Declaration order is information the canonical form discards** — `toCanonical` sorts the
 * `spaces` keys by collation. So every derivation that reads spaces in order, such as the
 * ordering of `Form.spaces`, uses this. The `Map` insertion order itself is left alone:
 * diagnostics are contractually in **scan order** (ADR-0028), so another reader needs
 * declaration order.
 */
export function canonicalSpaceOrder(model: Model): Space[] {
  return [...model.spaces.keys()].sort(compareCanonical).map((p) => model.spaces.get(p)!);
}

/**
 * Puts the spelling of every region into canonical order.
 *
 * **The order the parts of a `+` union were written in is information the canonical form
 * discards** — `canonicalSpaceEntry` runs `at` through `sortBySerial`. Discarded information
 * must not change the shape, so everything that reads `rects` — convex pieces, boundary
 * segments, slabs, plan entities, and the anchor of a room label when two pieces have equal
 * area — is kept off the written order by sorting the spelling. `grids` and `rects` stay
 * parallel.
 */
export function normalizeRegionOrder(model: Model): void {
  for (const s of model.spaces.values()) {
    if (s.grids.length < 2 || s.grids.length !== s.rects.length) continue;
    const order = s.grids
      .map((g, i) => [JSON.stringify([g.xa, g.ya, g.xb, g.yb]), i] as const)
      .sort(([x], [y]) => compareCanonical(x, y))
      .map(([, i]) => i);
    s.grids = order.map((i) => s.grids[i]!);
    s.rects = order.map((i) => s.rects[i]!);
  }
}

/** 正準JSON — 機械形式。差分とレイヤー合成の土台 (キーは安定順) */
export function toCanonical(model: Model): string {
  // Keys taken from the source go in a Map so the collation order survives serialisation
  const spaces = new Map<string, unknown>();
  for (const p of [...model.spaces.keys()].sort(compareCanonical)) {
    spaces.set(p, canonicalSpaceEntry(model.spaces.get(p)!));
  }
  // 境界: 宣言順は意味を持たないため、並びは内容の正準順 (betweenの辞書順、同一betweenは直列化順)。
  // 既定境界 (derived — ADR-0014) は出さない: 正準JSONは書かれた構成のみで、意味は導出後のModelが持つ
  const boundaries = sortBySerial(
    [...model.boundaries].filter((b) => !b.derived).map(canonicalBoundaryEntry),
  );

  const zones = new Map<string, unknown>();
  for (const p of [...model.zones.keys()].sort(compareCanonical)) {
    const z = model.zones.get(p)!;
    zones.set(p, Object.keys(z.attrs).length ? { attrs: sortObj(z.attrs) } : {});
  }
  const assets = new Map<string, unknown>();
  for (const n of [...model.assets.keys()].sort(compareCanonical)) {
    const a = model.assets.get(n)!;
    assets.set(n, { kind: a.kind, ...(Object.keys(a.attrs).length ? { attrs: sortObj(a.attrs) } : {}) });
  }
  const polygons = new Map<string, number[][]>();
  for (const p of [...model.polygons.keys()].sort(compareCanonical)) {
    polygons.set(p, model.polygons.get(p)!.points.map((pt) => [pt.x, pt.y]));
  }

  const doc = {
    // **文書が最初に名乗るのは自分の綴りの版である** (ADR-0036)。`koyu` は言語版であって
    // 形式版ではなく、しかも「書かれた版宣言の素通し」なので、宣言の無いファイルには出ない —
    // 出せば、その版を著者は書いていないのに書いたことになり、しかもツールの既定が動いた日に
    // 同じ入力のバイトが変わる。決定性は形式の側の約束なので、ツールの既定に預けない
    format: CANONICAL_FORMAT,
    // **The key names the language, so it is spelled `muro`** — whatever word the file used.
    // A document written `koyu 1.1` still says `"muro": "1.1"` here: the key is the name of
    // the thing being versioned, not a copy of how the author spelled the declaration.
    ...(model.versionDeclared ? { muro: model.version } : {}),
    ...(model.name ? { name: model.name } : {}),
    unit: model.unit,
    // 測地の枠 (ADR-0057) — **単位を言った直後、グリッドを言う前。**この二つは grid が張る
    // 座標系そのものを外の世界に結びつけるので、その座標系より先に立つ。
    // **値はメートル**であって mm ではない (外の枠の中の点だから)。書かれなければ鍵ごと出ない
    ...(model.origin
      ? {
          origin: {
            epsg: model.origin.epsg,
            easting: model.origin.easting,
            northing: model.origin.northing,
            ...(model.origin.elevation !== undefined ? { elevation: model.origin.elevation } : {}),
            ...(model.origin.vertical !== undefined ? { vertical: model.origin.vertical } : {}),
          },
        }
      : {}),
    ...(model.azimuth ? { azimuth: model.azimuth.deg } : {}),
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
    ...(assets.size ? { assets } : {}),
    ...(polygons.size ? { polygons } : {}),
    // **柱の宣言順は意味である。**同じ交点に二本は立たず、先の宣言が勝つ (ADR-0023) ので、
    // 並べ替えると別の建物が同一のJSONになる。並べ替えてよいのは宣言の**中**の、
    // 順序に意味の無い通り名の列だけである (ADR-0029)
    ...(model.columns.length
      ? {
          columns: model.columns.map((c) => ({
            size: c.size,
            ...(c.depth !== undefined ? { d: c.depth } : {}),
            levels: c.levels,
            ...(c.xNames ? { x: sortGridNames(model.grid.X.names, c.xNames) } : {}),
            ...(c.yNames ? { y: sortGridNames(model.grid.Y.names, c.yNames) } : {}),
            ...(Object.keys(c.attrs).length ? { attrs: sortObj(c.attrs) } : {}),
          })),
        }
      : {}),
    ...(zones.size ? { zones } : {}),
    spaces,
    boundaries,
  };
  return canonicalStringify(doc) + "\n";
}

/**
 * 描かれた線の端点の対を、解決座標の昇順に並べる。
 * 線分は向きを持たない — 端点をどちらから書いても導出される凸片は同一なので、
 * 書き順は綴りの揺れである (規則1)。綴り自体は通り参照のまま保つ (規則3)
 */
function canonicalLineEnds(d: DrawnLine): [string, string] {
  return drawnIsForward(d) ? [d.aRef, d.bRef] : [d.bRef, d.aRef];
}

/**
 * 描かれた線の正準の向き — 解決座標の (x, then y) 昇順。
 *
 * **線分は向きを持たない。**同じ二点を結ぶ線は、どちらの端から書いても同じ線である。
 * 正準JSONはこの規則で端点の対を並べ替える。したがって**書き順は形を変えてはならない** —
 * `canonicalizeDrawn` が parse の出口でモデルの側もこの向きに揃える (ADR-0041)。
 */
export function drawnIsForward(d: DrawnLine): boolean {
  return d.a.x < d.b.x || (d.a.x === d.b.x && d.a.y <= d.b.y);
}

/**
 * 描かれた線を正準の向きへ揃える。綴り (`aRef`/`bRef`) も一緒に入れ替えるので、
 * 診断が引用する綴りは書かれたとおりのまま入れ替わる。
 *
 * これをしないと、**正準JSONがバイト同一のまま扉が別の位置に出る** — 実測で
 * `line X1,Y1+2000 X2,Y1+4000` と `line X2,Y1+4000 X1,Y1+2000` が sha256 一致のまま
 * 扉を (1500,2500) と (4500,3500) に置いていた。開口の `at:` は線分の始端からの比なので、
 * 始端が書き順で決まる限り、形は正準形の関数にならない。
 */
export function canonicalizeDrawn(d: DrawnLine): void {
  if (drawnIsForward(d)) return;
  const { a, b, aRef, bRef } = d;
  d.a = b;
  d.b = a;
  d.aRef = bRef;
  d.bRef = aRef;
}

/** 通り名の列を通りの並び順に整える — `x:X2,X1` と `x:X1,X2` は同じ構成である */
function sortGridNames(axis: string[], names: string[]): string[] {
  return [...names].sort((p, q) => {
    const ip = axis.indexOf(p);
    const iq = axis.indexOf(q);
    if (ip < 0 || iq < 0) return compareCanonical(p, q); // 未宣言の通りは照合順で安定させる
    return ip - iq;
  });
}

/**
 * 正準形の照合順 — **Unicode符号位置の昇順**であり、これは出力される UTF-8 バイトの昇順に等しい
 * (ADR-0036)。**JavaScript の `<` と既定の `sort` は使えない** — あれは UTF-16 コード単位順で、
 * 符号位置順と一致しない。実測: 𠮟 (U+20B9F) は代用対 D842,DF9F なので `<` では 﨑 (U+FA11) より
 * 小さいが、UTF-8 では F0 A0 AE 9F と EF A8 91 で 﨑 が先である。どちらも日本語の実在の字なので、
 * 差は理論上のものではない。**規範は「JSの既定」ではなく「この形式自身のバイト」に置く** —
 * 別の言語で書かれた実装が素直に書けば同じ並びになる側を選ぶ。
 *
 * 実装は代用対の持ち上げによる: 符号位置順では U+E000..U+FFFF が代用対 (U+10000以上) より
 * 手前に来るので、コード単位を写して比べる。
 */
export function compareCanonical(a: string, b: string): number {
  if (a === b) return 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return utf8Order(x) < utf8Order(y) ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

/** UTF-16コード単位を、符号位置 (= UTF-8バイト) の順に並ぶ数へ写す */
function utf8Order(u: number): number {
  if (u >= 0xd800 && u <= 0xdfff) return u + 0x2000; // 代用対 = U+10000以上 — 最上位へ
  if (u >= 0xe000) return u - 0x800; // 代用領域の穴を詰める
  return u;
}

function sortObj<T>(o: Record<string, T>): Map<string, T> {
  return new Map(Object.entries(o).sort(([a], [b]) => compareCanonical(a, b)));
}

/**
 * Serialises a canonical document, with the same bytes `JSON.stringify(value, null, 2)` produces —
 * plus `Map`, whose entries are emitted **in insertion order**.
 *
 * A plain object cannot carry the collation order: JavaScript keeps integer-like keys
 * (`"2"`, `"10"`) ahead of the rest, in ascending numeric order, whatever order they were inserted
 * in. So a level or asset named `2` came out before one named `10`, while collation order — which
 * this format promises — puts `10` first. `Object.fromEntries` silently undid a correct sort.
 * A `Map` has no such rule, so keys taken from the source are carried in one.
 */
function canonicalStringify(value: unknown, depth = 0): string {
  const pad = "  ".repeat(depth + 1);
  const close = "  ".repeat(depth);
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad + canonicalStringify(v, depth + 1));
    return `[\n${items.join(",\n")}\n${close}]`;
  }
  const entries: Array<[string, unknown]> =
    value instanceof Map ? [...value.entries()] : Object.entries(value);
  const kept = entries.filter(([, v]) => v !== undefined);
  if (kept.length === 0) return "{}";
  const items = kept.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${canonicalStringify(v, depth + 1)}`);
  return `{\n${items.join(",\n")}\n${close}}`;
}

/**
 * 宣言順に意味の無い集合を、直列化したJSONの辞書順に並べる — 正準順の土台 (diffも同じ順で比べる)。
 *
 * **掛ける前に問う: この配列の順序を入れ替えたら別の構成になるか。**なるなら掛けてはならない。
 * 並べ替えは整形ではなく「順序に意味が無い」ことの表明である。柱 (columns) は先勝ちの規則を
 * 持つので掛けない — 掛けていたとき、別の建物が同一バイトの正準JSONになっていた (ADR-0029)
 */
export function sortBySerial<T>(items: T[]): T[] {
  return items
    .map((it) => [JSON.stringify(it), it] as const)
    .sort(([x], [y]) => compareCanonical(x, y))
    .map(([, it]) => it);
}
