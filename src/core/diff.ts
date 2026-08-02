// koyu — semantic diff (ADR-0018)
// 二つのModelを構成の言葉で比べる。行の入替・書き方の違いは差分ではない —
// 比較の基底は正準表現 (model.tsの正準エントリ) で、toCanonicalが同一なら差分は空。
// 空間の対応はuid (ADR-0015) を先に取り、uid一致・パス不一致を「改名」として報告する。
// 境界は実効集合 (deriveDefaultBoundaries適用後のModel.boundaries) で比べ、
// 素の宣言wallと既定壁 (derived) は同一視する (ADR-0014の帰結の吸収)。

import {
  areaM2,
  canonicalBoundaryEntry,
  canonicalOpeningEntry,
  canonicalSegEntry,
  canonicalSpaceEntry,
  openingIdentity,
  polygonAreaM2,
  type Attrs,
  type AttrValue,
  type Boundary,
  type ColumnDecl,
  type DrawnLine,
  type Edge,
  type Model,
  type Opening,
  type Pt,
  type Seg,
  type Space,
} from "./model.js";

/** フィールドの変化。from/toの片方が無ければ、その側に無かった (追加/削除) */
export interface FieldChange {
  field: string;
  from?: string;
  to?: string;
}

/** 変化した要素 — pathは新しい側 (b) の名 */
export interface ChangedItem {
  path: string;
  fields: FieldChange[];
}

/** uid一致・パス不一致 = 改名 (ADR-0015)。境界の対応はuidが継ぐため洪水にならない */
export interface RenamedItem {
  from: string;
  to: string;
  uid: string;
}

/** 通り座標の変化。名は位置 (X1=先頭) から読む — 座標の挿入は以降の名の付け替えとして現れる */
export interface GridChange {
  axis: "X" | "Y";
  name: string;
  kind: "added" | "removed" | "moved";
  from?: number;
  to?: number;
}

export interface SpaceItem {
  path: string;
  /** 書かれていれば。型は任意である */
  type?: string;
  areaM2?: number;
}

export interface BoundaryItem {
  between: [string, string];
  edge?: Edge;
  kind: string;
  t?: number;
}

/**
 * 柱の宣言 (ADR-0023)。**宣言順が意味を持つ** (同じ交点は先の宣言が勝つ) ので、
 * 順位も差分の対象である — 二行を入れ替えると実際に立つ柱が変わる
 */
export interface ColumnItem {
  /** 宣言の順位 (1始まり) */
  at: number;
  label: string;
}

export interface BoundaryChange {
  between: [string, string];
  edge?: Edge;
  fields: FieldChange[];
}

export interface ModelDiff {
  version?: { from: string; to: string };
  name?: { from?: string; to?: string };
  grid: GridChange[];
  levels: { added: string[]; removed: string[]; changed: ChangedItem[] };
  assets: { added: string[]; removed: string[]; changed: ChangedItem[] };
  polygons: { added: string[]; removed: string[]; changed: ChangedItem[] };
  zones: { added: string[]; removed: string[]; renamed: RenamedItem[]; changed: ChangedItem[] };
  spaces: { added: SpaceItem[]; removed: SpaceItem[]; renamed: RenamedItem[]; changed: ChangedItem[] };
  boundaries: { added: BoundaryItem[]; removed: BoundaryItem[]; changed: BoundaryChange[] };
  /** 柱 (ADR-0023) — 宣言の集合と、その順位 */
  columns: { added: ColumnItem[]; removed: ColumnItem[]; changed: ChangedItem[] };
}

// ---- 対応付け ----

interface Pair<T> {
  a: T;
  b: T;
  /** 境界のキーに使う安定トークン — uid対ならuid、パス対ならb側のパス */
  token: string;
}

interface Matching<T> {
  pairs: Pair<T>[];
  removed: T[];
  added: T[];
  renamed: RenamedItem[];
}

/**
 * 2パスの対応付け: ①uid一致 (String()比較・両側消費)、②残りをパス一致。残りは追加/削除。
 * uidが片側で重複しているモデル (UID03エラー) では当該uidはパス照合へフォールバックする —
 * checkエラーのモデルでもdiffは落ちない
 */
function matchByUidThenPath<T extends { path: string; attrs: Attrs }>(as: T[], bs: T[]): Matching<T> {
  const uniqueUids = (xs: T[]): Map<string, T> => {
    const byUid = new Map<string, T[]>();
    for (const x of xs) {
      const v = x.attrs["uid"];
      if (v === undefined) continue;
      const k = String(v);
      const arr = byUid.get(k) ?? [];
      arr.push(x);
      byUid.set(k, arr);
    }
    return new Map([...byUid].filter(([, arr]) => arr.length === 1).map(([k, arr]) => [k, arr[0]!]));
  };
  const ua = uniqueUids(as);
  const ub = uniqueUids(bs);
  const pairs: Pair<T>[] = [];
  const renamed: RenamedItem[] = [];
  const consumedA = new Set<T>();
  const consumedB = new Set<T>();
  for (const [uid, xa] of ua) {
    const xb = ub.get(uid);
    if (!xb) continue;
    // uidはパスと衝突しない名前空間に置く (uidに"/"始まりのトークンを書かれても混ざらない)
    pairs.push({ a: xa, b: xb, token: `\u0000uid:${uid}` });
    consumedA.add(xa);
    consumedB.add(xb);
    if (xa.path !== xb.path) renamed.push({ from: xa.path, to: xb.path, uid });
  }
  const restB = new Map(bs.filter((x) => !consumedB.has(x)).map((x) => [x.path, x]));
  const removed: T[] = [];
  for (const xa of as) {
    if (consumedA.has(xa)) continue;
    const xb = restB.get(xa.path);
    if (xb) {
      pairs.push({ a: xa, b: xb, token: xb.path });
      restB.delete(xa.path);
    } else {
      removed.push(xa);
    }
  }
  return { pairs, removed, added: [...restB.values()], renamed };
}

// ---- フィールド差分 ----

const str = (v: AttrValue | undefined): string | undefined => (v === undefined ? undefined : String(v));

function fieldChange(field: string, from?: string, to?: string): FieldChange {
  return { field, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) };
}

/** 属性の差分 — キー和集合の辞書順。値はStringで比べる (parseの数値化は両側で対称) */
function attrFields(a: Attrs, b: Attrs, prefix = ""): FieldChange[] {
  const out: FieldChange[] = [];
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[k] === b[k]) continue;
    out.push(fieldChange(`${prefix}${k}`, str(a[k]), str(b[k])));
  }
  return out;
}

/** 領域 (グリッド参照) の人間可読表記 */
function fmtGrids(s: Space): string {
  if (s.grids.length === 0) return "—";
  return s.grids.map((g) => `${g.xa}..${g.xb} ${g.ya}..${g.yb}`).join(" + ");
}

const fmtArea = (v: number | undefined): string | undefined => (v === undefined ? undefined : `${v.toFixed(2)} m2`);

function spaceFields(sa: Space, sb: Space): FieldChange[] {
  const fields: FieldChange[] = [];
  if (sa.type !== sb.type) fields.push(fieldChange("type", sa.type, sb.type));
  if (sa.level !== sb.level) fields.push(fieldChange("level", sa.level ?? "—", sb.level ?? "—"));
  const ea = canonicalSpaceEntry(sa);
  const eb = canonicalSpaceEntry(sb);
  if (JSON.stringify(ea["at"] ?? null) !== JSON.stringify(eb["at"] ?? null)) {
    fields.push(fieldChange("region", fmtGrids(sa), fmtGrids(sb)));
  }
  // 面積は導出値の差分として別掲する — 領域が同じでもグリッド座標の移動で変わる (原因はgrid差分が先頭で言う)
  const arA = areaM2(sa);
  const arB = areaM2(sb);
  if (arA !== arB) fields.push(fieldChange("area", fmtArea(arA), fmtArea(arB)));
  fields.push(...attrFields(sa.attrs, sb.attrs));
  // 数えない分節 (area) — 正準順の直列で多重集合として比べる
  fields.push(
    ...multisetFields(
      (ea["areas"] as unknown[] | undefined) ?? [],
      (eb["areas"] as unknown[] | undefined) ?? [],
      () => "area",
      (e) => JSON.stringify(e),
    ),
  );
  return fields;
}

/** 直列化の多重集合差分 — 一致は相殺し、残りを追加/削除のFieldChangeにする */
function multisetFields(
  as: unknown[],
  bs: unknown[],
  label: (e: unknown) => string,
  describe: (e: unknown) => string,
): FieldChange[] {
  const count = new Map<string, number>();
  for (const e of as) {
    const k = JSON.stringify(e);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out: FieldChange[] = [];
  for (const e of bs) {
    const k = JSON.stringify(e);
    const c = count.get(k) ?? 0;
    if (c > 0) count.set(k, c - 1);
    else out.push(fieldChange(label(e), undefined, describe(e)));
  }
  for (const e of as) {
    const k = JSON.stringify(e);
    const c = count.get(k) ?? 0;
    if (c > 0) {
      count.set(k, c - 1);
      out.push(fieldChange(label(e), describe(e), undefined));
    }
  }
  return out;
}

// ---- 境界 ----

/** aの向きが意味を持つか — edge/開口 (swing/hinge)/segはa側の矩形から読まれる */
function orientationMatters(b: Boundary): boolean {
  return b.edge !== undefined || b.openings.length > 0 || b.segs.length > 0;
}

/**
 * 比較用の直列 — 正準エントリのa/betweenを安定トークンに置き換える。
 * derivedフラグはエントリに出ない: 素の宣言wallと既定壁は同一の直列になる (ADR-0014の同一視)。
 * 向き (a) は意味を持つときだけ比べる
 */
function comparable(b: Boundary, tok: (p: string) => string): string {
  const e = canonicalBoundaryEntry(b);
  e["between"] = [tok(b.a), tok(b.b)].sort();
  if (orientationMatters(b)) e["a"] = tok(b.a);
  else delete e["a"];
  return JSON.stringify(e);
}

/**
 * 開口の対のキー。**名があれば名が優先である** (ADR-0039) —
 * 開口の同一性は「含む対象 + その中で一意な名」から導かれるので (docs/reference/scope.md)、
 * 名の付いた扉を動かせば「同じ扉の at が変わった」であって「消えて生えた」ではない。
 * 名が無ければ位置で対応づける他にない: (kind, edge??"", atRef??at)。
 * 名のある開口と無い開口は別のキー空間に落ちるので、名を後から書き足した編集は追加/削除に見える —
 * 名を書く行為そのものが同一性の宣言なので、それでよい
 */
const openingKey = (model: Model) => (o: Opening): string => {
  const name = openingIdentity(model, o);
  // 名は、位置のキー (door… / window…) と混ざらないトークン空間に置く
  if (name !== undefined) return `\u0000name:${name}`;
  return `${o.kind}#${o.edge ?? ""}#${String(o.atRef ?? o.at)}`;
};
const openingLabel = (model: Model) => (o: Opening): string => {
  const name = openingIdentity(model, o);
  if (name !== undefined) return `${o.kind} ${name}`;
  return `${o.kind}${o.edge ? ` edge:${o.edge}` : ""} at:${String(o.atRef ?? o.at)}`;
};

function describeOpening(o: Opening): string {
  const parts = [
    ...(o.ref ? [o.ref] : []),
    `w:${o.w}`,
    ...(o.h !== undefined ? [`h:${o.h}`] : []),
    ...(o.hinge ? [`hinge:${o.hinge}`] : []),
    ...(o.swing ? [`swing:${o.swing}`] : []),
    ...Object.entries(o.attrs).map(([k, v]) => `${k}:${v}`),
  ];
  return parts.join(" ");
}

/** segの対のキー — 開口と同じ規律。名があれば名、無ければ (edge??"", atRef??at, w) */
const segKey = (g: Seg): string => {
  const name = g.attrs["name"];
  if (name !== undefined && name !== "") return `\u0000name:${String(name)}`;
  return `${g.edge ?? ""}#${String(g.atRef ?? g.at)}#${g.w}`;
};
const segLabel = (g: Seg): string => {
  const name = g.attrs["name"];
  if (name !== undefined && name !== "") return `seg ${String(name)}`;
  return `seg${g.edge ? ` edge:${g.edge}` : ""} at:${String(g.atRef ?? g.at)} w:${g.w}`;
};

interface Keyed<T> {
  x: T;
  key: string;
  serial: string;
}

/**
 * キーで束ね、直列一致を相殺し、残りを直列順に対にする — 開口・seg・境界に共通の2段構え。
 * キー衝突 (同位置の開口・BND02重複の境界) でも落ちずに対→追加/削除へ順に流す
 */
function pairUp<T>(as: Keyed<T>[], bs: Keyed<T>[]) {
  const group = (xs: Keyed<T>[]): Map<string, Keyed<T>[]> => {
    const m = new Map<string, Keyed<T>[]>();
    for (const e of xs) {
      const arr = m.get(e.key) ?? [];
      arr.push(e);
      m.set(e.key, arr);
    }
    return m;
  };
  const ga = group(as);
  const gb = group(bs);
  const pairs: Array<[T, T]> = [];
  const removed: T[] = [];
  const added: T[] = [];
  for (const k of [...new Set([...ga.keys(), ...gb.keys()])].sort()) {
    const la = ga.get(k) ?? [];
    const lb = gb.get(k) ?? [];
    // 直列一致は相殺 (多重集合)
    const used = new Set<number>();
    const remA: Keyed<T>[] = [];
    for (const ea of la) {
      const i = lb.findIndex((eb, j) => !used.has(j) && ea.serial === eb.serial);
      if (i >= 0) used.add(i);
      else remA.push(ea);
    }
    const remB = lb.filter((_, j) => !used.has(j));
    remA.sort((x, y) => (x.serial < y.serial ? -1 : 1));
    remB.sort((x, y) => (x.serial < y.serial ? -1 : 1));
    const n = Math.min(remA.length, remB.length);
    for (let i = 0; i < n; i++) pairs.push([remA[i]!.x, remB[i]!.x]);
    removed.push(...remA.slice(n).map((e) => e.x));
    added.push(...remB.slice(n).map((e) => e.x));
  }
  return { pairs, removed, added };
}

const keyed = <T>(xs: T[], key: (x: T) => string, serial: (x: T) => string): Keyed<T>[] =>
  xs.map((x) => ({ x, key: key(x), serial: serial(x) }));

function openingFields(mb: Model, oa: Opening, ob: Opening): FieldChange[] {
  const label = openingLabel(mb)(ob);
  const out: FieldChange[] = [];
  const sub = (f: string, va: AttrValue | undefined, vb: AttrValue | undefined) => {
    if (va !== vb) out.push(fieldChange(`${label} ${f}`, str(va), str(vb)));
  };
  // 名で対応づいた対は、種別も辺も位置もキーに入っていない — フィールドの変化として言う。
  // 位置で対応づいた対ではこの三つは定義上一致するので、何も出ない (ADR-0039)
  sub("kind", oa.kind, ob.kind);
  sub("edge", oa.edge, ob.edge);
  sub("at", String(oa.atRef ?? oa.at), String(ob.atRef ?? ob.at));
  sub("ref", oa.ref, ob.ref);
  sub("w", oa.w, ob.w);
  sub("h", oa.h, ob.h);
  sub("hinge", oa.hinge, ob.hinge);
  sub("swing", oa.swing, ob.swing);
  out.push(...attrFields(oa.attrs, ob.attrs, `${label} `));
  return out;
}

/** 描かれた線の綴り (端点は正準順 — 書き順は図形を変えない) */
function lineLabel(d: DrawnLine | undefined): string | undefined {
  if (!d) return undefined;
  const forward = d.a.x < d.b.x || (d.a.x === d.b.x && d.a.y <= d.b.y);
  return forward ? `${d.aRef}..${d.bRef}` : `${d.bRef}..${d.aRef}`;
}

function boundaryFields(
  ma: Model,
  mb: Model,
  ba: Boundary,
  bb: Boundary,
  tokA: (p: string) => string,
  tokB: (p: string) => string,
): FieldChange[] {
  const out: FieldChange[] = [];
  if (ba.kind !== bb.kind) out.push(fieldChange("kind", ba.kind, bb.kind));
  if (ba.t !== bb.t) out.push(fieldChange("t", str(ba.t), str(bb.t)));
  if ((ba.air ?? false) !== (bb.air ?? false)) out.push(fieldChange("air", ba.air ? "1" : undefined, bb.air ? "1" : undefined));
  if ((orientationMatters(ba) || orientationMatters(bb)) && tokA(ba.a) !== tokB(bb.a)) {
    out.push(fieldChange("orientation (a side)", ba.a, bb.a));
  }
  // 描かれた線 (ADR-0022) — 境界の実現そのものなので、動かせば建物の形が変わる。
  // 面積の変化として空間側に間接的に出ることはあるが、それは導出値であって原因ではない。
  // 面積が偶然一致する変更 (隅切りを反対の隅へ移す) は、ここが無いと完全に不可視になる
  if (lineLabel(ba.drawn) !== lineLabel(bb.drawn)) {
    out.push(fieldChange("line", lineLabel(ba.drawn), lineLabel(bb.drawn)));
  }
  out.push(...attrFields(ba.attrs, bb.attrs));
  // 開口 — 名 (あれば)、無ければ (kind, edge, at) で対にし、対はフィールド差分、残りは追加/削除
  const oSerial = (o: Opening): string => JSON.stringify(canonicalOpeningEntry(o));
  const ops = pairUp(keyed(ba.openings, openingKey(ma), oSerial), keyed(bb.openings, openingKey(mb), oSerial));
  for (const [oa, ob] of ops.pairs) out.push(...openingFields(mb, oa, ob));
  for (const o of ops.added) out.push(fieldChange(openingLabel(mb)(o), undefined, describeOpening(o)));
  for (const o of ops.removed) out.push(fieldChange(openingLabel(ma)(o), describeOpening(o), undefined));
  // seg — 名 (あれば)、無ければ (edge, at, w) で対にする
  const gSerial = (g: Seg): string => JSON.stringify(canonicalSegEntry(g));
  const sgs = pairUp(keyed(ba.segs, segKey, gSerial), keyed(bb.segs, segKey, gSerial));
  for (const [ga, gb] of sgs.pairs) {
    const lab = segLabel(gb);
    // 名で対応づいた対は、辺も位置も幅もキーに入っていない (ADR-0039)
    if ((ga.edge ?? "") !== (gb.edge ?? "")) out.push(fieldChange(`${lab} edge`, ga.edge, gb.edge));
    const [pa, pb] = [String(ga.atRef ?? ga.at), String(gb.atRef ?? gb.at)];
    if (pa !== pb) out.push(fieldChange(`${lab} at`, pa, pb));
    if (ga.w !== gb.w) out.push(fieldChange(`${lab} w`, String(ga.w), String(gb.w)));
    out.push(...attrFields(ga.attrs, gb.attrs, `${lab} `));
  }
  for (const g of sgs.added) {
    out.push(fieldChange(segLabel(g), undefined, Object.entries(g.attrs).map(([k, v]) => `${k}:${v}`).join(" ")));
  }
  for (const g of sgs.removed) {
    out.push(fieldChange(segLabel(g), Object.entries(g.attrs).map(([k, v]) => `${k}:${v}`).join(" "), undefined));
  }
  return out;
}

// ---- 多角形 ----

/** 巡回正規化 (回転・反転で最小の直列) — 始点の書き替え・逆回りは形の変化ではない */
function polygonNormal(points: Pt[]): string {
  const arr = points.map((p) => [p.x, p.y]);
  let best: string | undefined;
  for (const seq of [arr, [...arr].reverse()]) {
    for (let i = 0; i < seq.length; i++) {
      const s = JSON.stringify([...seq.slice(i), ...seq.slice(0, i)]);
      if (best === undefined || s < best) best = s;
    }
  }
  return best ?? "[]";
}

// ---- 本体 ----

/** 二つのModelの意味差分。toCanonical(a)===toCanonical(b) なら空 (不変量) */
export function semanticDiff(a: Model, b: Model): ModelDiff {
  const d: ModelDiff = {
    grid: [],
    levels: { added: [], removed: [], changed: [] },
    assets: { added: [], removed: [], changed: [] },
    polygons: { added: [], removed: [], changed: [] },
    zones: { added: [], removed: [], renamed: [], changed: [] },
    spaces: { added: [], removed: [], renamed: [], changed: [] },
    boundaries: { added: [], removed: [], changed: [] },
    columns: { added: [], removed: [], changed: [] },
  };
  if (a.version !== b.version) d.version = { from: a.version, to: b.version };
  if (a.name !== b.name) {
    d.name = { ...(a.name !== undefined ? { from: a.name } : {}), ...(b.name !== undefined ? { to: b.name } : {}) };
  }

  // グリッド — 出力の先頭に置く (空間の面積差分の原因説明になる)。名は位置 (X1=先頭) から読む
  for (const axis of ["X", "Y"] as const) {
    const ca = a.grid[axis].coords;
    const cb = b.grid[axis].coords;
    for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
      const name = `${axis}${i + 1}`;
      const va = ca[i];
      const vb = cb[i];
      if (va === undefined && vb !== undefined) d.grid.push({ axis, name, kind: "added", to: vb });
      else if (va !== undefined && vb === undefined) d.grid.push({ axis, name, kind: "removed", from: va });
      else if (va !== undefined && vb !== undefined && va !== vb) {
        d.grid.push({ axis, name, kind: "moved", from: va, to: vb });
      }
    }
  }

  // レベル — uidを持たないため改名は削除+追加になる (既知の限界 — ADR-0018)
  const levelSort = levelOrder(a, b);
  for (const name of [...new Set([...Object.keys(a.levels), ...Object.keys(b.levels)])].sort(
    (p, q) => (levelSort.get(p) ?? 0) - (levelSort.get(q) ?? 0),
  )) {
    const la = a.levels[name];
    const lb = b.levels[name];
    if (!la && lb) d.levels.added.push(name);
    else if (la && !lb) d.levels.removed.push(name);
    else if (la && lb) {
      const fields: FieldChange[] = [];
      if (la.z !== lb.z) fields.push(fieldChange("z", str(la.z), str(lb.z)));
      if (la.h !== lb.h) fields.push(fieldChange("h", str(la.h), str(lb.h)));
      if (la.slab !== lb.slab) fields.push(fieldChange("slab", str(la.slab), str(lb.slab)));
      // 地下の宣言 (ADR-0022) は集計 (地上/地下の床面積) と矩計が読む — 落とすと意味が変わる
      if (!!la.underground !== !!lb.underground) {
        fields.push(fieldChange("underground", la.underground ? "1" : "—", lb.underground ? "1" : "—"));
      }
      if (fields.length) d.levels.changed.push({ path: name, fields });
    }
  }

  // 建具アセット — 名がキー
  for (const name of [...new Set([...a.assets.keys(), ...b.assets.keys()])].sort()) {
    const aa = a.assets.get(name);
    const ab = b.assets.get(name);
    if (!aa && ab) d.assets.added.push(name);
    else if (aa && !ab) d.assets.removed.push(name);
    else if (aa && ab) {
      const fields: FieldChange[] = [];
      if (aa.kind !== ab.kind) fields.push(fieldChange("kind", aa.kind, ab.kind));
      fields.push(...attrFields(aa.attrs, ab.attrs));
      if (fields.length) d.assets.changed.push({ path: name, fields });
    }
  }

  // 敷地形状 — パスがキー。巡回正規化 (回転・反転) で一致すれば差分なし
  for (const path of [...new Set([...a.polygons.keys(), ...b.polygons.keys()])].sort()) {
    const pa = a.polygons.get(path);
    const pb = b.polygons.get(path);
    if (!pa && pb) d.polygons.added.push(path);
    else if (pa && !pb) d.polygons.removed.push(path);
    else if (pa && pb && polygonNormal(pa.points) !== polygonNormal(pb.points)) {
      // 変わった項だけを言う — 「頂点 4 → 4 / 面積 100.00㎡ → 100.00㎡」は
      // 何も伝えない。形が変わって頂点数も面積も同じなら、そう言う
      const fields: FieldChange[] = [];
      if (pa.points.length !== pb.points.length) {
        fields.push(fieldChange("vertices", String(pa.points.length), String(pb.points.length)));
      }
      const ar = round2(polygonAreaM2(pa.points));
      const br = round2(polygonAreaM2(pb.points));
      if (ar !== br) fields.push(fieldChange("area", fmtArea(ar), fmtArea(br)));
      if (fields.length === 0) fields.push(fieldChange("shape", "same vertex count and same area", "the vertices sit elsewhere"));
      d.polygons.changed.push({ path, fields });
    }
  }

  // 柱 (ADR-0023) — 位置は書かれないので、比べるのは宣言そのものである。
  // **宣言順が意味を持つ** (同じ交点は先の宣言が勝つ) ので、順位の入替も差分になる
  {
    const label = (c: ColumnDecl): string =>
      [
        `${c.size} square`,
        ...(c.depth !== undefined ? [`d:${c.depth}`] : []),
        c.levels.length > 2 ? `${c.levels[0]}..${c.levels[c.levels.length - 1]}` : c.levels.join(","),
        ...(c.xNames ? [`x:${c.xNames.join(",")}`] : []),
        ...(c.yNames ? [`y:${c.yNames.join(",")}`] : []),
        ...Object.entries(c.attrs).map(([k, v]) => `${k}:${v}`),
      ].join(" ");
    const rank = (cs: ColumnDecl[]): Map<string, number> => {
      const m = new Map<string, number>();
      cs.forEach((c, i) => m.set(label(c), i + 1));
      return m;
    };
    const ra = rank(a.columns);
    const rb = rank(b.columns);
    for (const [lab, at] of ra) if (!rb.has(lab)) d.columns.removed.push({ at, label: lab });
    for (const [lab, at] of rb) if (!ra.has(lab)) d.columns.added.push({ at, label: lab });
    for (const [lab, at] of ra) {
      const to = rb.get(lab);
      if (to !== undefined && to !== at) {
        d.columns.changed.push({ path: lab, fields: [fieldChange("rank", String(at), String(to))] });
      }
    }
  }

  // ゾーン — 空間と同じ2パス対応 (uid→パス)
  const zm = matchByUidThenPath([...a.zones.values()], [...b.zones.values()]);
  d.zones.renamed = zm.renamed.sort((x, y) => (x.to < y.to ? -1 : 1));
  d.zones.added = zm.added.map((z) => z.path).sort();
  d.zones.removed = zm.removed.map((z) => z.path).sort();
  for (const p of zm.pairs) {
    const fields = attrFields(p.a.attrs, p.b.attrs);
    if (fields.length) d.zones.changed.push({ path: p.b.path, fields });
  }
  d.zones.changed.sort((x, y) => (x.path < y.path ? -1 : 1));

  // 空間 — 2パス対応。並びはパス順→レベル順 (スパン展開の行が隣接する)
  const sm = matchByUidThenPath([...a.spaces.values()], [...b.spaces.values()]);
  const key = (path: string): string => pathSortKey(path, levelSort);
  d.spaces.renamed = sm.renamed.sort((x, y) => (key(x.to) < key(y.to) ? -1 : 1));
  const spaceItem = (s: Space): SpaceItem => {
    const ar = areaM2(s);
    return { path: s.path, ...(s.type !== undefined ? { type: s.type } : {}), ...(ar !== undefined ? { areaM2: ar } : {}) };
  };
  d.spaces.added = sm.added.map(spaceItem).sort((x, y) => (key(x.path) < key(y.path) ? -1 : 1));
  d.spaces.removed = sm.removed.map(spaceItem).sort((x, y) => (key(x.path) < key(y.path) ? -1 : 1));
  for (const p of sm.pairs) {
    const fields = spaceFields(p.a, p.b);
    if (fields.length) d.spaces.changed.push({ path: p.b.path, fields });
  }
  d.spaces.changed.sort((x, y) => (key(x.path) < key(y.path) ? -1 : 1));

  // 境界 — 実効集合。キーは (安定トークン2つの昇順, edge??"")。改名は対応対のトークンが吸収する
  const tokMapA = new Map<string, string>();
  const tokMapB = new Map<string, string>();
  for (const p of sm.pairs) {
    tokMapA.set(p.a.path, p.token);
    tokMapB.set(p.b.path, p.token);
  }
  for (const s of sm.removed) tokMapA.set(s.path, s.path);
  for (const s of sm.added) tokMapB.set(s.path, s.path);
  const tokA = (p: string): string => tokMapA.get(p) ?? p; // 未定義の空間参照 (REF01) はパスのまま
  const tokB = (p: string): string => tokMapB.get(p) ?? p;
  const bKey = (tok: (p: string) => string) => (x: Boundary): string =>
    `${[tok(x.a), tok(x.b)].sort().join("\u0000")}#${x.edge ?? ""}`;
  const bm = pairUp(
    keyed(a.boundaries, bKey(tokA), (x) => comparable(x, tokA)),
    keyed(b.boundaries, bKey(tokB), (x) => comparable(x, tokB)),
  );
  const bItem = (x: Boundary): BoundaryItem => ({
    between: [x.a, x.b].sort() as [string, string],
    ...(x.edge ? { edge: x.edge } : {}),
    kind: x.kind,
    ...(x.t !== undefined ? { t: x.t } : {}),
  });
  const bSort = (x: { between: [string, string] }, y: { between: [string, string] }): number => {
    const kx = `${key(x.between[0])} | ${key(x.between[1])}`;
    const ky = `${key(y.between[0])} | ${key(y.between[1])}`;
    return kx < ky ? -1 : 1;
  };
  for (const [ba, bb] of bm.pairs) {
    const fields = boundaryFields(a, b, ba, bb, tokA, tokB);
    if (fields.length) {
      d.boundaries.changed.push({
        between: [bb.a, bb.b].sort() as [string, string],
        ...(bb.edge ? { edge: bb.edge } : {}),
        fields,
      });
    }
  }
  d.boundaries.added = bm.added.map(bItem).sort(bSort);
  d.boundaries.removed = bm.removed.map(bItem).sort(bSort);
  d.boundaries.changed.sort(bSort);
  return d;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** レベル名→z順の序数 (両モデルの和集合)。パスの並べ替えに使う */
function levelOrder(a: Model, b: Model): Map<string, number> {
  const merged = new Map<string, number>();
  for (const l of [...Object.values(a.levels), ...Object.values(b.levels)]) {
    if (!merged.has(l.name)) merged.set(l.name, l.z);
  }
  return new Map([...merged].sort((x, y) => x[1] - y[1]).map(([name], i) => [name, i]));
}

/**
 * パス順→レベル順のキー: 先頭セグメントがレベルなら (残りのパス, レベル序数) で並べる —
 * スパン展開の同名空間 (/L4/A/ldk … /L10/A/ldk) が隣接して階順に並ぶ
 */
function pathSortKey(path: string, levels: Map<string, number>): string {
  const segs = path.split("/");
  const lv = segs[1] !== undefined ? levels.get(segs[1]) : undefined;
  if (lv === undefined) return `${path}\u0000`;
  return `/${segs.slice(2).join("/")}\u0000${String(lv).padStart(4, "0")}`;
}

// ---- 人間可読出力 ----

/** フィールドの変化を「field from → to」に組む (片側欠落は +/−) */
function fmtField(f: FieldChange): string {
  if (f.from === undefined) return `+ ${f.field}${f.to !== undefined && f.to !== "" ? ` ${f.to}` : ""}`;
  if (f.to === undefined) return `− ${f.field}${f.from !== "" ? ` (${f.from})` : ""}`;
  return `${f.field} ${f.from} → ${f.to}`;
}

const fmtFields = (fields: FieldChange[]): string => fields.map(fmtField).join(" / ");

const betweenLabel = (x: { between: [string, string]; edge?: Edge }): string =>
  `${x.between[0]} | ${x.between[1]}${x.edge ? ` edge:${x.edge}` : ""}`;

/** 差分行 (英語・空なら差分なし)。並びはsemanticDiffが決めた正準順のまま */
export function renderDiff(d: ModelDiff): string[] {
  const out: string[] = [];
  for (const g of d.grid) {
    if (g.kind === "moved") out.push(`± grid ${g.axis} ${g.name} ${g.from} → ${g.to}`);
    else if (g.kind === "added") out.push(`+ grid ${g.axis} ${g.name} ${g.to}`);
    else out.push(`− grid ${g.axis} ${g.name} ${g.from}`);
  }
  if (d.version) out.push(`± koyu ${d.version.from} → ${d.version.to}`);
  if (d.name) out.push(`± name ${d.name.from ?? "—"} → ${d.name.to ?? "—"}`);
  for (const n of d.levels.added) out.push(`+ level ${n}`);
  for (const n of d.levels.removed) out.push(`− level ${n}`);
  for (const c of d.levels.changed) out.push(`± level ${c.path}: ${fmtFields(c.fields)}`);
  for (const n of d.assets.added) out.push(`+ asset ${n}`);
  for (const n of d.assets.removed) out.push(`− asset ${n}`);
  for (const c of d.assets.changed) out.push(`± asset ${c.path}: ${fmtFields(c.fields)}`);
  for (const p of d.polygons.added) out.push(`+ polygon ${p}`);
  for (const p of d.polygons.removed) out.push(`− polygon ${p}`);
  for (const c of d.polygons.changed) out.push(`± polygon ${c.path}: ${fmtFields(c.fields)}`);
  for (const r of d.zones.renamed) out.push(`renamed zone ${r.from} → ${r.to} (uid:${r.uid})`);
  for (const p of d.zones.added) out.push(`+ zone ${p}`);
  for (const p of d.zones.removed) out.push(`− zone ${p}`);
  for (const c of d.zones.changed) out.push(`± zone ${c.path}: ${fmtFields(c.fields)}`);
  for (const r of d.spaces.renamed) out.push(`renamed ${r.from} → ${r.to} (uid:${r.uid})`);
  // 型は任意なので、書かれていない空間もある。`${undefined}` が "undefined" と刷られると
  // 型がそう綴られたように読めるので、集計の見出しと同じ形で言う (cli.ts と同じ構え)
  const label = (t?: string) => t ?? "(untyped)";
  for (const s of d.spaces.added) {
    out.push(`+ space ${s.path} (${label(s.type)}${s.areaM2 !== undefined ? ` ${s.areaM2.toFixed(2)} m2` : ""})`);
  }
  for (const s of d.spaces.removed) {
    out.push(`− space ${s.path} (${label(s.type)}${s.areaM2 !== undefined ? ` ${s.areaM2.toFixed(2)} m2` : ""})`);
  }
  for (const c of d.spaces.changed) out.push(`± ${c.path}: ${fmtFields(c.fields)}`);
  for (const x of d.boundaries.added) {
    out.push(`+ boundary ${betweenLabel(x)} (${x.kind}${x.t !== undefined ? ` t:${x.t}` : ""})`);
  }
  for (const x of d.boundaries.removed) out.push(`− boundary ${betweenLabel(x)}`);
  for (const c of d.boundaries.changed) out.push(`± boundary ${betweenLabel(c)}: ${fmtFields(c.fields)}`);
  for (const c of d.columns.added) out.push(`+ column ${c.label}`);
  for (const c of d.columns.removed) out.push(`− column ${c.label}`);
  for (const c of d.columns.changed) out.push(`± column ${c.path}: ${fmtFields(c.fields)}`);
  return out;
}
