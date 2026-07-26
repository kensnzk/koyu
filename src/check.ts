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
  resolveSides,
  soloSide,
  spacesOverlap,
} from "./graph.js";
import { heff, isSemiOutdoor, levelsSorted, type Attrs, type Boundary, type Model, type Pt, type Rect, type Space,
  clipHalfPlane,
  columnsFor,
  polyBounds,
  rectToPoly,
  srcRef,
  polygonAreaM2,
  polygonSelfIntersection,
  shapeEscapesPolygon,
} from "./model.js";
import { runDecls, runIssues } from "./vertical.js";

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** 構造化診断 (ADR-0016)。message は本文のみ — 位置接頭辞「file:N行目: 」を含まない */
export interface Diagnostic {
  /** 台帳 DIAGNOSTIC_CODES のコード (領域2-3字 + 2桁連番) */
  code: string;
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
export const DIAGNOSTIC_CODES: Record<string, "error" | "warning"> = {
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
};

const EPS = 0.5;
/** 敷地まわりの幾何の許容 (境界上は内側扱い) — ADR-0011の1mm */
const EPS_SITE = 1;
const VERTICAL = new Set(["stair", "shaft", "void"]);
/** 0.3以前が採光の対象と推定していた型 (ADR-0020で廃止)。旧版の受理条件の判定にだけ使う — 意味論には効かない */
const LEGACY_DAYLIT = new Set(["unit", "room", "ldk", "bedroom", "living"]);

/** 互換層 — 従来の文字列形式。位置を持つ診断は「file:N行目: 本文」に組み立てる */
export function check(model: Model): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const d of checkDiagnostics(model)) {
    const text = d.line !== undefined ? `${srcRef(d.line, d.file)}: ${d.message}` : d.message;
    (d.severity === "error" ? errors : warnings).push(text);
  }
  return { errors, warnings };
}

export function checkDiagnostics(model: Model): Diagnostic[] {
  const diags: Diagnostic[] = [];
  /** line:0 は「位置なし」— フィールドごと省略する (既定境界などの導出物) */
  const emit = (
    code: string,
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
      severity: DIAGNOSTIC_CODES[code]!,
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
      emit("BND05", `同じ空間対に edge 限定つきと無しの境界が併存しています (線分が重なります): ${pair}`, {
        path: pair.split(" | "),
      });
    }
  }

  const withRect = [...model.spaces.values()].filter((s) => s.rects.length > 0);
  const levels = levelsSorted(model);

  // レベルの重複
  for (let i = 1; i < levels.length; i++) {
    if (Math.abs(levels[i]!.z - levels[i - 1]!.z) < EPS) {
      emit("LVL01", `レベル ${levels[i - 1]!.name} と ${levels[i]!.name} のzが同じです`);
    }
  }

  // 自らの領域 (合併の矩形同士) の重なり
  for (const s of withRect) {
    for (let i = 0; i < s.rects.length; i++) {
      for (let j = i + 1; j < s.rects.length; j++) {
        if (planOverlap(s.rects[i]!, s.rects[j]!)) {
          emit("GEO01", `${s.path} の領域同士が重なっています`, { line: s.line, file: s.file, path: [s.path] });
        }
      }
    }
  }

  // 同一レベルでの空間同士の重なり
  for (let i = 0; i < withRect.length; i++) {
    for (let j = i + 1; j < withRect.length; j++) {
      const a = withRect[i]!;
      const b = withRect[j]!;
      if (a.level !== b.level) continue;
      if (spacesOverlap(a, b)) {
        emit("GEO02", `空間の領域が重なっています: ${a.path} と ${b.path}`, {
          path: [a.path, b.path],
          related: [loc(b.line, b.file)],
        });
      }
    }
  }

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

  // 縦動線 (ADR-0021): 宣言の妥当性と、**書かれていない導出値**の妥当性。
  // 段数も踏面も勾配も書かない — だから導出したものを検査する
  for (const i of runIssues(model)) {
    emit(i.code, i.message, { line: i.line, file: i.file, path: [i.path] });
  }

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
    // 両側が領域を持つときは「線が二つを分離するか」、片側だけのときは
    // 「線が外皮を実際に切るか」— 問いが違うので判定も分ける
    if (sa.rects.length > 0 && sb.rects.length > 0) {
      if (!resolveSides(sa, sb, b.drawn.a, b.drawn.b)) {
        emit(
          "LIN01",
          `線 ${b.drawn.aRef}..${b.drawn.bRef} は ${b.a} と ${b.b} を分離していません (二つの割付が線の両側に来るように引きます)`,
          bAt,
        );
        continue;
      }
    } else if (soloSide(sa.rects.length > 0 ? sa : sb, b.drawn.a, b.drawn.b) === 0) {
      emit(
        "LIN01",
        `線 ${b.drawn.aRef}..${b.drawn.bRef} が割付をちょうど二等分していて、どちらを残すか決まりません`,
        bAt,
      );
      continue;
    }
    // 線が実際に割付を切っているか — 両側に面積が残る割付が一つでもあれば切っている
    const box = polyBounds([b.drawn.a, b.drawn.b]);
    const cuts = [sa, sb].some((s) =>
      s.rects.some((r) => {
        const win = clipToBox(rectToPoly(r), box);
        if (win.length === 0) return false;
        const l = clipHalfPlane(win, b.drawn!.a, b.drawn!.b, true);
        const rr = clipHalfPlane(win, b.drawn!.a, b.drawn!.b, false);
        return l.length > 0 && rr.length > 0;
      }),
    );
    if (!cuts) {
      emit(
        "LIN03",
        `線 ${b.drawn.aRef}..${b.drawn.bRef} は何も切っていません (既定の隣接線と同じか、割付の外にあります)`,
        bAt,
      );
    }
  }

  // 外皮の穴 (ADR-0025): 既定境界は領域を持たない空間との間には導かれない (ADR-0014) ので、
  // 外部への境界の書き忘れは黙って壁の不在になる。導出された外周のうち、
  // 他の空間とも宣言された境界とも向かい合っていない区間を数える
  // 外構のタイル (site:1 ゾーンの配下)・外部・半屋外は囲われていないのが正常なので数えない。
  // そして**外皮を書き始めているレベルだけ**を見る — 外部への境界が一本も無い階は
  // 外皮をまだ模型にしていないだけであって、穴が開いているのではない。
  // 「書き始めたなら閉じきる」という整合の検査であって、完全性の要求ではない (ADR-0025)
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
    const total = gaps.reduce((a, g) => a + segmentLength(g), 0);
    emit(
      "ENV01",
      `外皮に面していない外周があります: ${s.path} — 合計 ${Math.round(total)}mm (${gaps.length}区間)。外部への境界を書きます`,
      { line: s.line, file: s.file, path: [s.path] },
    );
  }

  // 柱 (ADR-0023): 位置は書かれない。宣言に対して一本も立たなければ、
  // 通りか階の指定が実際の床とすれ違っている
  const colGrid = new Map<string, number[]>();
  for (const c of model.columns) {
    let total = 0;
    for (const lv of c.levels) total += columnsFor(model, lv).length;
    if (total === 0) {
      emit("COL01", `柱の宣言に対して立つ柱がありません (通りの交点に床がありません): ${c.levels.join(",")} ${c.size}角`, {
        line: c.line,
        file: c.file,
      });
    }
    for (const lv of c.levels) {
      const arr = colGrid.get(lv) ?? [];
      arr.push(c.size);
      colGrid.set(lv, arr);
    }
  }
  for (const [lv, sizes] of colGrid) {
    if (new Set(sizes).size > 1 && model.columns.filter((c) => c.levels.includes(lv) && !c.xNames && !c.yNames).length > 1) {
      emit("COL02", `レベル ${lv} に通りを限定しない柱の宣言が複数あります (同じ交点では先の宣言が勝ちます)`);
    }
  }

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
        emit("VER03", `${older}: level ${l.name} の underground: — koyu 0.5 へ上げます`);
      }
    }
  }

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

  // 境界の妥当性
  const levelIndex = new Map(levels.map((l, i) => [l.name, i]));
  for (const b of model.boundaries) {
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa || !sb) continue;
    const bAt = { line: b.line, file: b.file, path: [b.a, b.b] };

    if (VERTICAL.has(b.kind)) {
      // 垂直境界: 隣り合うレベルの、平面で重なる空間同士にしか張れない
      if (sa.rects.length === 0 || sb.rects.length === 0 || !sa.level || !sb.level) {
        emit("VRT01", `${b.kind} 境界は領域とレベルを持つ空間同士に書きます`, bAt);
        continue;
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
      if (b.openings.length > 0) {
        emit("VRT05", `垂直境界の開口は解釈されません`, bAt);
      }
      if (b.segs.length > 0) {
        emit("VRT06", `垂直境界の seg は解釈されません`, bAt);
      }
      continue;
    }

    // 水平境界
    if (sa.rects.length > 0 && sb.rects.length > 0 && sa.level !== sb.level) {
      emit(
        "BND03",
        `異なるレベルの空間に壁境界は書けません (垂直は type:stair/shaft/void): ${b.a} | ${b.b}`,
        bAt,
      );
      continue;
    }
    const segs = segmentsFor(model, b);
    // 線を持つ境界の線分ゼロは「接していない」ではない — 線が分離していないか
    // 何も切っていないかであり、それは LIN01 / LIN03 が言う
    if (!b.drawn) {
      if (sa.rects.length > 0 && sb.rects.length > 0 && segs.length === 0) {
        emit("BND04", `空間が接していないため境界を導けません: ${b.a} | ${b.b}`, bAt);
      }
      if ((sa.rects.length > 0 ? 1 : 0) + (sb.rects.length > 0 ? 1 : 0) === 1 && segs.length === 0) {
        emit("BND06", `外周に残る辺が無く、境界線分がゼロです: ${b.a} | ${b.b}`, bAt);
      }
    }
    if (b.kind === "open" && b.openings.length > 0) {
      emit("OPN03", `open境界の開口は通行に影響しません (常に通れます)`, bAt);
    }
    const placedOnSeg: Array<{ o: (typeof b.openings)[number]; key: string; c: number }> = [];
    for (const o of b.openings) {
      const placed = placeOpening(model, b, o);
      if ("error" in placed && placed.error) {
        emit(placed.code, placed.message, { line: placed.line, file: placed.file, path: [b.a, b.b] });
        continue;
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
      const inside = s.rects.some(
        (r) =>
          a.rect.x1 >= r.x1 - EPS &&
          a.rect.x2 <= r.x2 + EPS &&
          a.rect.y1 >= r.y1 - EPS &&
          a.rect.y2 <= r.y2 + EPS,
      );
      if (!inside) {
        emit("SEG02", `area が ${s.path} の領域からはみ出しています`, { line: a.line, file: s.file, path: [s.path] });
      }
    }
  }

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
        emit("HGT04", `${s.path} の天井高が不明で、${lu.name} との高さ検査ができません`, { path: [s.path] });
        continue;
      }
      if (h + lu.slab > pitch + EPS) {
        const partners = voidPartners.get(`${s.path}|${lu.name}`) ?? [];
        const cover = partners.length ? voidCoverage(s, partners) : 0;
        if (cover >= 0.99) continue; // 全面吹抜け — 宣言的免除
        if (partners.length) {
          emit(
            "HGT02",
            `${s.path} の天井高${h}は階高${pitch}を超えますが、吹抜けの被覆は${Math.round(
              cover * 100,
            )}%です。部分吹抜けでは天井高を階高内に収めます (吹抜け部分の高さは導出)`,
            { path: [s.path] },
          );
        } else {
          emit(
            "HGT01",
            `${s.path} が上階に食い込みます: 天井高${h} + ${lu.name}のslab${lu.slab} = ${h + lu.slab} > 階高${pitch}`,
            { path: [s.path] },
          );
        }
      }
    }
    if (slabMissing) {
      emit("HGT03", `レベル ${lu.name} に slab が未宣言のため、${lb.name} との高さ検査ができません`);
    }
  }

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
      for (const r of s.pieces.length > 0 ? s.pieces : s.rects.map(rectToPoly)) {
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

  return diags;
}

/** 凸多角形を軸平行の窓で切る (線の及ぶ範囲に限る — LIN03の判定用) */
function clipToBox(poly: Pt[], box: Rect): Pt[] {
  let p = poly;
  const corners: Array<[Pt, Pt]> = [
    [{ x: box.x1, y: box.y1 }, { x: box.x2, y: box.y1 }],
    [{ x: box.x2, y: box.y1 }, { x: box.x2, y: box.y2 }],
    [{ x: box.x2, y: box.y2 }, { x: box.x1, y: box.y2 }],
    [{ x: box.x1, y: box.y2 }, { x: box.x1, y: box.y1 }],
  ];
  for (const [u, v] of corners) {
    if (Math.abs(u.x - v.x) < 1e-9 && Math.abs(u.y - v.y) < 1e-9) continue;
    p = clipHalfPlane(p, u, v, true);
    if (p.length === 0) return [];
  }
  return p;
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
