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
  spacesOverlap,
} from "./graph.js";
import { heff, isSemiOutdoor, levelsSorted, type Attrs, type Boundary, type Model, type Space,
  srcRef,
  polygonAreaM2,
  polygonSelfIntersection,
  rectEscapesPolygon,
} from "./model.js";

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
  VER01: "error", // koyu 0.1 での既定境界の導出 (ADR-0017)
  SYN01: "error", // 構文・合成エラー (SourceError の写し — check --json のみ)
};

const EPS = 0.5;
/** 敷地まわりの幾何の許容 (境界上は内側扱い) — ADR-0011の1mm */
const EPS_SITE = 1;
const VERTICAL = new Set(["stair", "shaft", "void"]);

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
    const key = `${pair}#${b.edge ?? ""}`;
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
    const set = pairEdges.get(pair) ?? new Set<string>();
    set.add(b.edge ?? "");
    pairEdges.set(pair, set);
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

  // 言語版の受理条件 (ADR-0017): 0.1は意味保存の場合のみ受理する。
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
    if (sa.rects.length > 0 && sb.rects.length > 0 && segs.length === 0) {
      emit("BND04", `空間が接していないため境界を導けません: ${b.a} | ${b.b}`, bAt);
    }
    if ((sa.rects.length > 0 ? 1 : 0) + (sb.rects.length > 0 ? 1 : 0) === 1 && segs.length === 0) {
      emit("BND06", `外周に残る辺が無く、境界線分がゼロです: ${b.a} | ${b.b}`, bAt);
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
      for (const r of s.rects) {
        const out = rectEscapesPolygon(r, poly.points, EPS_SITE);
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
