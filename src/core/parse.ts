// koyu v0 — 記法パーサ
// 一行が一文。図面が数百年運んできた抽象度を、そのままテキストにする。
// import による合成 (ADR-0010): ファイル群を重ねて一つの模型にする。
// 分担して書き、合成時のコンフリクト (パス・アセット・グリッドの重複) は言葉のエラーになる。

import {
  type Area,
  type Attrs,
  type AttrValue,
  type Boundary,
  DEFAULT_LANGUAGE_VERSION,
  type Edge,
  type Model,
  type Opening,
  type Pt,
  type Rect,
  type Seg,
  SourceError,
  type Space,
  SUPPORTED_LANGUAGE_VERSIONS,
} from "./model.js";
import { deriveDefaultBoundaries, derivePieces } from "./graph.js";

const EDGES = new Set(["N", "E", "S", "W"]);

/**
 * 帯 (band, ADR-0019) の宣言 — parse の局所状態であり Model には入らない。
 * 帯は「位置ではなく寸法と並び」を書く記法で、垂直の矩計 (level の積み上げ) の水平版である。
 * 展開すると通常の Space になるので、下流 (check/plan/graph/diff/light/site) は帯を知らない。
 */
interface BandDecl {
  axis: "X" | "Y";
  /** 割る向きの区間 mm */
  lo: number;
  hi: number;
  /** 帯の両端と直交方向の両端は「書かれた綴り」のまま要素へ渡す (意味保存の要) */
  loRef: string;
  hiRef: string;
  crossA: string;
  crossB: string;
  members: BandMember[];
  line: number;
}

interface BandMember {
  path: string;
  type: string;
  /** 帯の向きの寸法mm。"rest" は残りを吸収する印 (帯に高々一つ) */
  w: number | "rest";
  attrTokens: string[];
  line: number;
}

function emptyModel(): Model {
  return {
    version: DEFAULT_LANGUAGE_VERSION,
    unit: "mm",
    grid: { X: { names: [], coords: [] }, Y: { names: [], coords: [] } },
    levels: {},
    spaces: new Map(),
    zones: new Map(),
    assets: new Map(),
    boundaries: [],
    polygons: new Map(),
    columns: [],
    layers: [],
  };
}

/** レイヤーの読み込み口 — import の解決。fs版は parse-file.ts が、仮想版は parseFiles が与える。
 *  fromKey が undefined のときは entry 自身の解決 */
export type LayerLoader = (
  fromKey: string | undefined,
  ref: string,
) => { key: string; src: string };

export function parse(source: string): Model {
  const model = emptyModel();
  ingest(model, source, undefined, new Set(), undefined);
  // 描かれた線で領域を切り分けてから、既定の壁を導く (ADR-0022 / ADR-0027)。
  // 逆順だと、線で接触が消えた組にも既定境界が生まれ、線分ゼロの境界に
  // 出所の無い BND04 が出る — 書いていない関係を責めることになる
  derivePieces(model);
  deriveDefaultBoundaries(model);
  return model;
}

/** ローダーを介した合成の入口。entry もローダーで読む (ADR-0010) */
export function parseWith(loader: LayerLoader, entry: string): Model {
  const model = emptyModel();
  let layer: { key: string; src: string };
  try {
    layer = loader(undefined, entry);
  } catch {
    throw new SourceError(0, `ファイルが読めません: ${entry}`);
  }
  ingestLayer(model, layer.key, layer.src, new Set(), loader);
  // 描かれた線で領域を切り分けてから、既定の壁を導く (ADR-0022 / ADR-0027)。
  // 逆順だと、線で接触が消えた組にも既定境界が生まれ、線分ゼロの境界に
  // 出所の無い BND04 が出る — 書いていない関係を責めることになる
  derivePieces(model);
  deriveDefaultBoundaries(model);
  return model;
}

/** 仮想ファイル群からの合成 — fsの無い環境 (ブラウザ等) 向け。
 *  キーはPOSIX風の相対パス (`L1.muro`, `floors/L1.muro`)。import はキー空間の中で解決される */
export function parseFiles(files: Record<string, string>, entry: string): Model {
  const map = new Map(Object.entries(files).map(([k, v]) => [normKey(k), v]));
  return parseWith((from, ref) => {
    const key = from === undefined ? normKey(ref) : joinKey(dirKey(from), ref);
    const src = map.get(key);
    if (src === undefined) throw new Error(key);
    return { key, src };
  }, entry);
}

function normKey(p: string): string {
  return joinKey("", p);
}
function dirKey(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}
function joinKey(dir: string, rel: string): string {
  const out: string[] = dir ? dir.split("/") : [];
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

function ingestLayer(
  model: Model,
  key: string,
  src: string,
  seen: Set<string>,
  loader: LayerLoader | undefined,
): void {
  if (seen.has(key)) return; // 同じレイヤーは一度だけ合成される (USDのsublayerと同じ)
  seen.add(key);
  model.layers.push(key); // 合成への参加を要素の有無によらず記録する (grid/levelだけの層も数える)
  ingest(model, src, key, seen, loader);
}

function ingest(
  model: Model,
  source: string,
  file: string | undefined,
  seen: Set<string>,
  loader: LayerLoader | undefined,
): void {
  let current: Boundary[] = [];
  let currentSpaces: Space[] = [];
  let band: BandDecl | undefined; // 帯は次の非字下げ行か層の終わりで展開される (ADR-0019)
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    try {
      const raw = lines[i]!;
      const ln = i + 1;
      const tokens = tokenize(raw, ln);
      if (tokens.length === 0) continue;
      const indented = /^\s/.test(raw);
      const [head, ...rest] = tokens as [string, ...string[]];

    if (indented) {
      if (head === "door" || head === "window") {
        if (current.length === 0) {
          throw new SourceError(ln, `${head} は boundary の直下に字下げして書きます`);
        }
        for (const b of current) b.openings.push(parseOpening(head, rest, ln, model));
      } else if (head === "seg") {
        if (current.length === 0) {
          throw new SourceError(ln, "seg は boundary の直下に字下げして書きます");
        }
        for (const b of current) b.segs.push(parseSeg(rest, ln, model));
      } else if (head === "line") {
        // 描かれた線 (ADR-0022) — 境界の実現を、隣接からの導出ではなく設計の行為で与える
        if (current.length === 0) {
          throw new SourceError(ln, "line は boundary の直下に字下げして書きます");
        }
        const drawn = parseDrawnLine(rest, ln, model);
        for (const b of current) {
          if (b.drawn) throw new SourceError(ln, `一つの境界に線は一本です: ${b.a} | ${b.b}`);
          b.drawn = { ...drawn };
        }
      } else if (head === "area") {
        if (band) {
          throw new SourceError(
            ln,
            "band の要素に area は書けません (領域が導出のため — area が要る室は位置で書きます)",
          );
        }
        if (currentSpaces.length === 0) {
          throw new SourceError(ln, "area は space の直下に字下げして書きます");
        }
        for (const s of currentSpaces) s.areas.push(parseArea(rest, ln, model));
      } else if (head === "space") {
        // 帯の要素 — 領域の代わりに幅 w: を持つ space 行 (ADR-0019)
        if (!band) throw new SourceError(ln, "字下げした space は band の直下に書きます");
        band.members.push(parseBandMember(rest, ln));
      } else {
        throw new SourceError(
          ln,
          `字下げ行に置けるのは door / window / seg / line / area / space (band の要素) のみです: ${head}`,
        );
      }
      continue;
    }

    // 帯は次の非字下げ行の直前に展開する (パス重複の検出順を宣言順に保つ)
    if (band) {
      expandBand(model, band, file);
      band = undefined;
    }
    current = [];
    currentSpaces = [];
    switch (head) {
      case "koyu": {
        const v = rest[0];
        if (!v) throw new SourceError(ln, `koyu には版を書きます: koyu ${DEFAULT_LANGUAGE_VERSION}`);
        if (rest.length > 1) {
          throw new SourceError(ln, `koyu の版宣言に余分なトークンがあります: ${rest.slice(1).join(" ")}`);
        }
        if (!SUPPORTED_LANGUAGE_VERSIONS.includes(v)) {
          throw new SourceError(
            ln,
            `対応していないkoyuの版です: ${v} (このツールの対応: ${SUPPORTED_LANGUAGE_VERSIONS.join(", ")})`,
          );
        }
        // 版はbase層 (entry) でのみ・一度だけ宣言する — 合成順による黙った上書きを禁じる (ADR-0017)。
        // gridの規律に合わせ、再宣言は同値でもエラー
        if (file !== undefined && model.layers[0] !== file) {
          throw new SourceError(ln, "koyu の版宣言はbase層 (entry) でのみ書きます");
        }
        if (model.versionDeclared) {
          throw new SourceError(ln, `koyu の版は一度だけ宣言します (既に ${model.version})`);
        }
        model.version = v;
        model.versionDeclared = true;
        break;
      }
      case "import": {
        const rel = rest[0];
        if (!rel) throw new SourceError(ln, "import には相対パスを書きます: import ./assets.muro");
        if (!loader) {
          throw new SourceError(
            ln,
            "import はファイル合成 (parseFile / parseFiles / CLI) でのみ使えます",
          );
        }
        let layer: { key: string; src: string };
        try {
          layer = loader(file, rel);
        } catch {
          throw new SourceError(ln, `ファイルが読めません: ${rel}`);
        }
        ingestLayer(model, layer.key, layer.src, seen, loader);
        break;
      }
      case "asset": {
        // 建具アセット (RevitのFamily / USDのReference — ADR-0010)
        const aname = rest[0];
        const akind = rest[1];
        if (!aname || aname.includes(":") || aname.startsWith("/")) {
          throw new SourceError(ln, "asset は asset <名> door|window [属性...] の形で書きます");
        }
        if (akind !== "door" && akind !== "window") {
          throw new SourceError(ln, `asset の種別は door / window です: ${akind}`);
        }
        const prevA = model.assets.get(aname);
        if (prevA) {
          throw new SourceError(
            ln,
            `アセット名が重複しています: ${aname} (既出: ${prevA.file ?? "同ファイル"}:${prevA.line}行目)`,
          );
        }
        model.assets.set(aname, {
          name: aname,
          kind: akind,
          attrs: parseAttrs(rest.slice(2), ln),
          line: ln,
          ...(file ? { file } : {}),
        });
        break;
      }
      case "polygon": {
        // 敷地形状 (ADR-0011) — 所与のジオメトリ。唯一、書かれる形。
        // polygon /site -2600,-7000 38000,-7000 38000,15600 2000,16800 -2600,12000
        const ppath = rest[0];
        if (!ppath || !ppath.startsWith("/")) {
          throw new SourceError(ln, "polygon は polygon /ゾーンパス x,y x,y x,y ... の形で書きます");
        }
        const pts = rest.slice(1).map((tok) => {
          const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(tok);
          if (!m) throw new SourceError(ln, `頂点が読めません (x,y のmm座標): ${tok}`);
          return { x: Number(m[1]), y: Number(m[2]) };
        });
        if (pts.length < 3) throw new SourceError(ln, "polygon には頂点を3つ以上書きます");
        const prevP = model.polygons.get(ppath);
        if (prevP) {
          throw new SourceError(
            ln,
            `敷地形状が重複しています: ${ppath} (既出: ${prevP.file ?? "同ファイル"}:${prevP.line}行目)`,
          );
        }
        model.polygons.set(ppath, {
          path: ppath,
          points: pts,
          line: ln,
          ...(file ? { file } : {}),
        });
        break;
      }
      case "name": {
        const nm = rest.join(" ");
        if (!nm) throw new SourceError(ln, "name には値を書きます");
        if (model.name !== undefined && model.name !== nm) {
          throw new SourceError(ln, `name は一度だけ宣言します (既に「${model.name}」— 合成時はbase層で)`);
        }
        model.name = nm;
        break;
      }
      case "unit": {
        if (rest[0] !== "mm") throw new SourceError(ln, `v0の単位はmmのみです: ${rest[0]}`);
        break;
      }
      case "grid": {
        const axis = rest[0];
        if (axis !== "X" && axis !== "Y") {
          throw new SourceError(ln, `grid の軸は X か Y です: ${axis}`);
        }
        if (model.grid[axis].coords.length > 0) {
          throw new SourceError(ln, `grid ${axis} は一度だけ宣言します (合成時はbase層で)`);
        }
        const coords = rest.slice(1).map((t) => toNumber(t, ln, "gridの座標"));
        if (coords.length < 2) throw new SourceError(ln, "grid には座標を2つ以上書きます");
        for (let k = 1; k < coords.length; k++) {
          if (coords[k]! <= coords[k - 1]!) {
            throw new SourceError(ln, "grid の座標は昇順で書きます");
          }
        }
        model.grid[axis] = {
          names: coords.map((_, k) => `${axis}${k + 1}`),
          coords,
        };
        break;
      }
      case "level": {
        const name = rest[0];
        if (!name) throw new SourceError(ln, "level には名前が要ります");
        const z = toNumber(rest[1] ?? "", ln, "levelの高さ(z)");
        const attrs = parseAttrs(rest.slice(2), ln);
        const h = takeNumber(attrs, "h", ln);
        const slab = takeNumber(attrs, "slab", ln);
        const pitch = takeNumber(attrs, "pitch", ln);
        const under = takeNumber(attrs, "underground", ln);
        // **level は attrs を持たない。**残ったキーは正準JSONにも痕跡を残さず消えるので、
        // ここで拒まないと `undergound:1` が黙って地上階になる (ADR-0033)
        for (const key of Object.keys(attrs)) {
          throw new SourceError(
            ln,
            `level に台帳に無い属性 ${key}: があります (level が読むのは h / slab / pitch / underground です)`,
          );
        }
        if (under !== undefined && under !== 0 && under !== 1) {
          throw new SourceError(ln, "underground は 0 / 1 で指定します (1=地下)");
        }
        const ug = under === 1 ? { underground: true } : {};

        // 範囲宣言: level L3..L9 6700 pitch:2900 — 基準階のレベルを一度に宣言する
        const range = /^([A-Za-z]+)(\d+)\.\.([A-Za-z]+)(\d+)$/.exec(name);
        if (range) {
          const [, p1, n1, p2, n2] = range;
          if (p1 !== p2 || Number(n1) >= Number(n2)) {
            throw new SourceError(ln, `レベル範囲が読めません: ${name}`);
          }
          if (pitch === undefined || pitch <= 0) {
            throw new SourceError(ln, `レベル範囲には pitch:(階高mm) が要ります: ${name}`);
          }
          for (let k = Number(n1); k <= Number(n2); k++) {
            const nm = `${p1}${k}`;
            if (model.levels[nm]) throw new SourceError(ln, `レベルが重複しています: ${nm}`);
            model.levels[nm] = {
              name: nm,
              z: z + pitch * (k - Number(n1)),
              line: ln,
              ...(file !== undefined ? { file } : {}),
              ...(h !== undefined ? { h } : {}),
              ...(slab !== undefined ? { slab } : {}),
              ...ug,
            };
          }
          break;
        }
        if (pitch !== undefined) {
          throw new SourceError(ln, "pitch はレベル範囲 (L?..L?) の宣言でのみ使えます");
        }
        if (model.levels[name]) throw new SourceError(ln, `レベルが重複しています: ${name}`);
        model.levels[name] = {
          name,
          z,
          line: ln,
          ...(file !== undefined ? { file } : {}),
          ...(h !== undefined ? { h } : {}),
          ...(slab !== undefined ? { slab } : {}),
          ...ug,
        };
        break;
      }
      case "column": {
        // 柱 (ADR-0023) — 寸法と階と通りだけを書く。位置は通り芯の交点から導出される
        const size = toNumber(rest[0] ?? "", ln, "columnの寸法");
        if (size <= 0) throw new SourceError(ln, "column の寸法は正のmmで書きます");
        const span = rest[1];
        if (!span) {
          throw new SourceError(ln, "column は column <寸法mm> <L?..L?|レベル名> [x:通り,..] [y:通り,..] の形で書きます");
        }
        const levels = /\.\./.test(span)
          ? resolveSpanLevels(model, span, ln)
          : (() => {
              if (!model.levels[span]) throw new SourceError(ln, `未宣言のレベルです: ${span}`);
              return [span];
            })();
        const attrs = parseAttrs(rest.slice(2), ln);
        const depth = takeNumber(attrs, "d", ln);
        const names = (key: "x" | "y"): string[] | undefined => {
          const v = takeString(attrs, key);
          if (v === undefined) return undefined;
          const list = v.split(",").filter(Boolean);
          for (const n of list) {
            if (!model.grid[key === "x" ? "X" : "Y"].names.includes(n)) {
              throw new SourceError(ln, `未定義の通り名です: ${n}`);
            }
          }
          if (list.length === 0) throw new SourceError(ln, `${key}: に通り名を書きます`);
          return list;
        };
        const xNames = names("x");
        const yNames = names("y");
        model.columns.push({
          size,
          ...(depth !== undefined ? { depth } : {}),
          levels,
          ...(xNames ? { xNames } : {}),
          ...(yNames ? { yNames } : {}),
          attrs,
          line: ln,
          ...(file ? { file } : {}),
        });
        break;
      }
      case "band": {
        // 帯 (ADR-0019) — 寸法と並びを書き、位置を導く。宣言はここ、展開は次の非字下げ行の直前
        band = parseBandHead(rest, ln, model);
        break;
      }
      case "space": {
        const path = rest[0];
        if (!path) throw new SourceError(ln, "space にはパスが要ります");
        // w: は帯の要素の語 — 字下げを落とした要素が「領域なしの空間」として黙って通るのを防ぐ
        if (rest.some((t) => t === "w:" || t.startsWith("w:"))) {
          throw new SourceError(
            ln,
            "space に w: は書けません (幅で書く空間は band の直下に字下げします)",
          );
        }
        for (const [p] of expandSpan(model, [path], ln)) {
          const space = parseSpace([p!, ...rest.slice(1)], ln, model);
          const prevS = model.spaces.get(space.path);
          if (prevS) {
            throw new SourceError(
              ln,
              `空間パスが重複しています: ${space.path} (既出: ${prevS.file ?? "同ファイル"}:${prevS.line}行目)`,
            );
          }
          if (file) space.file = file;
          model.spaces.set(space.path, space);
          currentSpaces.push(space);
        }
        break;
      }
      case "boundary": {
        const pa = rest[0];
        const pb = rest[1];
        if (!pa || !pb) {
          throw new SourceError(ln, "boundary は boundary /パスA /パスB [属性...] の形で書きます");
        }
        for (const [ea, eb] of expandSpan(model, [pa, pb], ln)) {
          const b = parseBoundary([ea!, eb!, ...rest.slice(2)], ln);
          if (file) b.file = file;
          model.boundaries.push(b);
          current.push(b);
        }
        break;
      }
      case "zone": {
        // 数える集約 — 住戸・部門など。幾何は持たず、パス接頭辞で空間を束ねる
        const zpath = rest[0];
        if (!zpath || !zpath.startsWith("/")) {
          throw new SourceError(ln, "zone は zone /パス [属性...] の形で書きます");
        }
        for (const [p] of expandSpan(model, [zpath], ln)) {
          const prevZ = model.zones.get(p!);
          if (prevZ) {
            throw new SourceError(
              ln,
              `ゾーンパスが重複しています: ${p} (既出: ${prevZ.file ?? "同ファイル"}:${prevZ.line}行目)`,
            );
          }
          model.zones.set(p!, {
            path: p!,
            attrs: parseAttrs(rest.slice(1), ln),
            line: ln,
            ...(file ? { file } : {}),
          });
        }
        break;
      }
      case "stack": {
        // 垂直に連続する空間列: stack ev L1..L10 type:shaft
        const leaf = rest[0];
        const span = rest[1];
        if (!leaf || leaf.startsWith("/") || !span) {
          throw new SourceError(ln, "stack は stack <名前> <L?..L?> type:stair|shaft の形で書きます");
        }
        const levels = resolveSpanLevels(model, span, ln);
        const attrs = parseAttrs(rest.slice(2), ln);
        const kind = takeString(attrs, "type");
        if (kind !== "stair" && kind !== "shaft" && kind !== "void") {
          throw new SourceError(ln, `stack の type は stair / shaft / void です: ${kind}`);
        }
        for (let i = 0; i + 1 < levels.length; i++) {
          const b: Boundary = {
            a: `/${levels[i]!}/${leaf}`,
            b: `/${levels[i + 1]!}/${leaf}`,
            kind,
            attrs: { ...attrs },
            openings: [],
            segs: [],
            line: ln,
            ...(file ? { file } : {}),
          };
          model.boundaries.push(b);
          current.push(b);
        }
        break;
      }
      default:
        throw new SourceError(ln, `未知のキーワードです: ${head}`);
    }
    } catch (e) {
      // 合成時はどのファイルのエラーかを言葉にする
      if (e instanceof SourceError && !e.file && file) {
        throw new SourceError(e.line, e.raw, file);
      }
      throw e;
    }
  }
  // 層の終わりで閉じる帯 (最終行が帯の要素だった場合)
  if (band) {
    try {
      expandBand(model, band, file);
    } catch (e) {
      if (e instanceof SourceError && !e.file && file) {
        throw new SourceError(e.line, e.raw, file);
      }
      throw e;
    }
  }
}

// ---- 各要素 ----

function parseSpace(rest: string[], ln: number, model: Model): Space {
  const path = rest[0];
  if (!path || !path.startsWith("/")) {
    throw new SourceError(ln, "space は space /パス 型 [X?..X? Y?..Y? [+ ...]] の形で書きます");
  }
  const type = rest[1];
  if (!type) throw new SourceError(ln, `space ${path} に型(語彙)が要ります`);
  guardStructuralType(type, ln);

  // 領域は「+」区切りで複数書ける (L字などの合併)
  const groups: string[][] = [[]];
  const attrTokens: string[] = [];
  for (const t of rest.slice(2)) {
    if (t === "+") {
      groups.push([]);
    } else if (t.includes("..")) {
      groups[groups.length - 1]!.push(t);
    } else {
      attrTokens.push(t);
    }
  }
  const attrs = parseAttrs(attrTokens, ln);

  // レベルは既定でパス先頭から読む。階を跨ぐくくり (メゾネット等) は level: で明示する
  const explicit = takeString(attrs, "level");
  if (explicit !== undefined && !model.levels[explicit]) {
    throw new SourceError(ln, `未宣言のレベルです: level:${explicit}`);
  }
  const seg = path.split("/")[1];
  const level = explicit ?? (seg && model.levels[seg] ? seg : undefined);

  const space: Space = {
    path,
    type,
    level,
    grids: [],
    rects: [],
    pieces: [],
    areas: [],
    attrs,
    line: ln,
  };
  for (const g of groups) {
    if (g.length === 0) continue;
    const r = parseRegion(g, ln, model);
    space.grids.push(r.grid);
    space.rects.push(r.rect);
  }
  return space;
}

// ---- 帯 (band) — 寸法と並びから位置を導く (ADR-0019) ----

/** `band <軸> <X?..X?> <Y?..Y?>` の見出し行。key:value は書けない (帯は残らないので運び先が無い) */
function parseBandHead(rest: string[], ln: number, model: Model): BandDecl {
  const axis = rest[0];
  if (axis !== "X" && axis !== "Y") {
    throw new SourceError(
      ln,
      `band の割る向きは X か Y です: ${axis ?? "(無し)"} (band X X1..X2 Y1..Y2 の形で書きます)`,
    );
  }
  const tail = rest.slice(1);
  const extra = tail.filter((t) => !t.includes(".."));
  if (extra.length > 0) {
    throw new SourceError(
      ln,
      `band の行に書けるのは 軸と領域だけです (属性は要素の space 行に書きます): ${extra.join(" ")}`,
    );
  }
  // 逆順表記は space では同じ矩形の別綴りだが、帯では並びの向きが意味を持つので許さない
  for (const t of tail) {
    const [p, q] = t.split("..");
    if (!p || !q) throw new SourceError(ln, `領域指定が読めません: ${t}`);
    const rp = resolveRef(model, p, ln);
    const rq = resolveRef(model, q, ln);
    if (rp.axis === rq.axis && rp.coord > rq.coord) {
      throw new SourceError(
        ln,
        `band の範囲は昇順で書きます (要素は 西→東 / 南→北 に並びます): ${t}`,
      );
    }
  }
  const r = parseRegion(tail, ln, model); // 軸の対・幅ゼロ・未定義の通り名は既存の言葉で弾かれる
  return {
    axis,
    lo: axis === "X" ? r.rect.x1 : r.rect.y1,
    hi: axis === "X" ? r.rect.x2 : r.rect.y2,
    loRef: axis === "X" ? r.grid.xa : r.grid.ya,
    hiRef: axis === "X" ? r.grid.xb : r.grid.yb,
    crossA: axis === "X" ? r.grid.ya : r.grid.xa,
    crossB: axis === "X" ? r.grid.yb : r.grid.xb,
    members: [],
    line: ln,
  };
}

/** 帯の要素: `space <パス> <型> w:<mm>|w:rest [属性...]` — 領域の代わりに寸法を持つ space 行 */
function parseBandMember(rest: string[], ln: number): BandMember {
  const path = rest[0];
  if (!path?.startsWith("/")) {
    throw new SourceError(ln, "band の要素は space /パス 型 w:(mm) の形で書きます");
  }
  const type = rest[1];
  // 型の位置に k:v が来たら「型の書き忘れ」— 幅の欠落として誤報しない
  if (!type || type.includes(":")) {
    throw new SourceError(ln, `band の要素 ${path} に型(語彙)が要ります`);
  }
  guardStructuralType(type, ln);
  let w: number | "rest" | undefined;
  const attrTokens: string[] = [];
  for (const t of rest.slice(2)) {
    if (t === "+" || t.includes("..")) {
      throw new SourceError(ln, `band の要素に領域は書けません (帯と w: が与えます): ${t}`);
    }
    if (t.startsWith("level:")) {
      throw new SourceError(
        ln,
        `band の要素に level: は書けません (帯は一つのレベルの並びです): ${t}`,
      );
    }
    if (t.startsWith("w:")) {
      if (w !== undefined) throw new SourceError(ln, "属性キーが重複しています: w");
      const v = t.slice(2);
      if (v === "rest") w = "rest";
      else if (/^\d+$/.test(v) && Number(v) > 0) w = Number(v);
      else throw new SourceError(ln, `band の要素の幅は正の整数mm か rest で書きます: ${t}`);
      continue;
    }
    attrTokens.push(t);
  }
  if (w === undefined) {
    throw new SourceError(ln, `band の要素には幅 w:(mm) か w:rest が要ります: ${path}`);
  }
  return { path, type, w, attrTokens, line: ln };
}

/**
 * resolveRef の逆 — 導かれた切り位置を通り参照に綴る「床規則」:
 * その座標**以下**で最も大きい通り芯からのオフセット (オフセット0なら通り名だけ)。
 * 上の通り芯から引く綴り (Y2-1800) は導出では生じない。
 */
function spellRef(model: Model, axis: "X" | "Y", c: number, ln: number): string {
  const g = model.grid[axis];
  if (!Number.isInteger(c)) {
    throw new SourceError(ln, `導かれた切り位置が整数mmになりません: ${c}`);
  }
  let i = 0;
  for (let k = 0; k < g.coords.length; k++) if (g.coords[k]! <= c) i = k;
  const off = c - g.coords[i]!;
  if (off === 0) return g.names[i]!;
  return `${g.names[i]}${off > 0 ? "+" : ""}${off}`;
}

/** 帯を通常の Space へ展開する。一方向・順序付き・決定的 — 足し算と一回の引き算だけ */
function expandBand(model: Model, band: BandDecl, file: string | undefined): void {
  const { axis, lo, hi, members } = band;
  if (members.length === 0) {
    throw new SourceError(band.line, "band の下に space を字下げして1つ以上書きます");
  }
  const extent = hi - lo;
  let sum = 0;
  let restAt = -1;
  for (let k = 0; k < members.length; k++) {
    const m = members[k]!;
    if (m.w === "rest") {
      if (restAt >= 0) {
        throw new SourceError(
          m.line,
          `残りを吸収する要素 (w:rest) は帯に一つだけです: ${members[restAt]!.path}, ${m.path}`,
        );
      }
      restAt = k;
    } else sum += m.w;
  }
  const list = members.map((m) => `  ${m.path} w:${m.w}`).join("\n");
  if (sum > extent) {
    throw new SourceError(
      band.line,
      `帯の幅 ${extent}mm に対し寸法の合計が ${sum}mm で、${sum - extent}mm 超えています\n${list}`,
    );
  }
  const widths = members.map((m) => (m.w === "rest" ? 0 : m.w));
  if (restAt >= 0) {
    if (sum === extent) {
      throw new SourceError(
        members[restAt]!.line,
        `帯の幅 ${extent}mm を他の寸法が使い切っていて、${members[restAt]!.path} (w:rest) の残りがゼロです`,
      );
    }
    widths[restAt] = extent - sum;
  } else if (sum < extent) {
    throw new SourceError(
      band.line,
      `帯の幅 ${extent}mm に対し寸法の合計が ${sum}mm で、${extent - sum}mm 足りません ` +
        `(寸法を直すか、どれかを w:rest にします)\n${list}`,
    );
  }

  // レベルスパンは全要素をまとめて一度だけ展開する (帯の中で揃っていることを先に確かめる)
  const iterations = expandSpan(model, members.map((m) => m.path), band.line);
  for (const it of iterations) {
    const lv = new Set(it.map((p) => p.split("/")[1]));
    if (lv.size > 1) {
      throw new SourceError(
        band.line,
        `帯の要素は同じレベルに展開します: ${it.map((p) => `${p} → ${p.split("/")[1]}`).join(", ")}`,
      );
    }
  }

  for (const it of iterations) {
    let cursor = lo;
    for (let k = 0; k < members.length; k++) {
      const m = members[k]!;
      const a = cursor;
      const b = cursor + widths[k]!;
      cursor = b;
      // 帯の両端は書かれた綴りのまま。内側の切り位置だけを綴る (これが意味保存の要)
      const aRef = a === lo ? band.loRef : spellRef(model, axis, a, m.line);
      const bRef = b === hi ? band.hiRef : spellRef(model, axis, b, m.line);
      const along = `${aRef}..${bRef}`;
      const cross = `${band.crossA}..${band.crossB}`;
      const xTok = axis === "X" ? along : cross;
      const yTok = axis === "X" ? cross : along;
      const space = parseSpace([it[k]!, m.type, xTok, yTok, ...m.attrTokens], m.line, model);
      const prev = model.spaces.get(space.path);
      if (prev) {
        throw new SourceError(
          m.line,
          `空間パスが重複しています: ${space.path} (既出: ${prev.file ?? "同ファイル"}:${prev.line}行目)`,
        );
      }
      if (file) space.file = file;
      model.spaces.set(space.path, space);
    }
  }
}

/** 領域指定 (X?..X? Y?..Y?) をグリッド参照とmm矩形に解決する */
function parseRegion(
  regionTokens: string[],
  ln: number,
  model: Model,
): { grid: { xa: string; xb: string; ya: string; yb: string }; rect: Rect } {
  if (regionTokens.length !== 2) {
    throw new SourceError(ln, "領域は X?..X? と Y?..Y? の2つで指定します");
  }
  let xr: [number, number] | undefined;
  let yr: [number, number] | undefined;
  let xg: [string, string] | undefined;
  let yg: [string, string] | undefined;
  for (const t of regionTokens) {
    const [p, q] = t.split("..");
    if (!p || !q) throw new SourceError(ln, `領域指定が読めません: ${t}`);
    const rp = resolveRef(model, p, ln);
    const rq = resolveRef(model, q, ln);
    if (rp.axis !== rq.axis) {
      throw new SourceError(ln, `領域の両端は同じ軸の通りで指定します: ${t}`);
    }
    // 逆順表記 (X2..X1) は同じ矩形の別綴り — 座標昇順に正規化して保存する (正準JSON・diffが揃う)
    const [lo, hi] = rp.coord <= rq.coord ? [[rp.coord, p] as const, [rq.coord, q] as const]
                                          : [[rq.coord, q] as const, [rp.coord, p] as const];
    if (rp.axis === "X") {
      xr = [lo[0], hi[0]];
      xg = [lo[1], hi[1]];
    } else {
      yr = [lo[0], hi[0]];
      yg = [lo[1], hi[1]];
    }
  }
  if (!xr || !yr || !xg || !yg) {
    throw new SourceError(ln, "領域には X系とY系の通りを1組ずつ使います");
  }
  if (xr[0] === xr[1] || yr[0] === yr[1]) throw new SourceError(ln, "領域の幅がゼロです");
  return {
    grid: { xa: xg[0], xb: xg[1], ya: yg[0], yb: yg[1] },
    rect: {
      x1: Math.min(xr[0], xr[1]),
      x2: Math.max(xr[0], xr[1]),
      y1: Math.min(yr[0], yr[1]),
      y2: Math.max(yr[0], yr[1]),
    },
  };
}

/**
 * 描かれた線 (ADR-0022) — `line X3,Y1 X4+600,Y3`。
 * 端点は通り語の対 (`<X通り>,<Y通り>`、どちらもオフセット可)。
 * **生の座標も角度も書けない** — 位置を定めるのは常に線であり、線の端点は通りである
 */
function parseDrawnLine(
  rest: string[],
  ln: number,
  model: Model,
): { aRef: string; bRef: string; a: Pt; b: Pt; line: number } {
  if (rest.length !== 2) {
    throw new SourceError(ln, "line は line <始点> <終点> の形で書きます (例: line X3,Y1 X4,Y3)");
  }
  const [aRef, bRef] = rest as [string, string];
  const a = resolvePoint(model, aRef, ln);
  const b = resolvePoint(model, bRef, ln);
  if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) {
    throw new SourceError(ln, `line の両端が同じ点です: ${aRef}`);
  }
  return { aRef, bRef, a, b, line: ln };
}

/** 通り語の対 `X3,Y1` / `X3+600,Y2-900` を点へ */
function resolvePoint(model: Model, token: string, ln: number): Pt {
  const parts = token.split(",");
  if (parts.length !== 2) {
    throw new SourceError(ln, `点は <X通り>,<Y通り> の形で書きます: ${token}`);
  }
  const p = resolveRef(model, parts[0]!, ln);
  const q = resolveRef(model, parts[1]!, ln);
  if (p.axis !== "X" || q.axis !== "Y") {
    throw new SourceError(ln, `点はX通り,Y通りの順で書きます: ${token}`);
  }
  return { x: p.coord, y: q.coord };
}

/** 数えない分節: 室内の領域 (床材の切替など) */
function parseArea(rest: string[], ln: number, model: Model): Area {
  const regionTokens = rest.filter((t) => t.includes(".."));
  const attrTokens = rest.filter((t) => !t.includes(".."));
  const r = parseRegion(regionTokens, ln, model);
  return { grid: r.grid, rect: r.rect, attrs: parseAttrs(attrTokens, ln), line: ln };
}

/** 数えない分節: 境界上の区間 (壁材の途中変更など) */
function parseSeg(rest: string[], ln: number, model: Model): Seg {
  const attrs = parseAttrs(rest, ln);
  const w = takeNumber(attrs, "w", ln);
  if (w === undefined || w <= 0) {
    throw new SourceError(ln, "seg には幅 w:(mm) が要ります");
  }
  const at = parseAt(attrs, ln, model);
  const edge = takeEdge(attrs, ln);
  return { w, ...at, ...(edge ? { edge } : {}), attrs, line: ln };
}

/**
 * 位置指定: at は 0..1 の比率 (クランプされる) か、通り参照 (at:X2+450 — 明示位置)。
 * 明示位置ははみ出しをクランプせずエラーにする (placeBand)
 */
function parseAt(
  attrs: Attrs,
  ln: number,
  model: Model,
): { at: number; atRef?: string; atAbs?: number; atAxis?: "X" | "Y" } {
  const v = attrs["at"];
  if (v === undefined) return { at: 0.5 };
  delete attrs["at"];
  if (typeof v === "number") {
    if (v < 0 || v > 1) {
      throw new SourceError(ln, "at は 0..1 の比率か、通り参照 (at:X2+450) で指定します");
    }
    return { at: v };
  }
  const r = resolveRef(model, v, ln);
  return { at: 0.5, atRef: v, atAbs: r.coord, atAxis: r.axis };
}

/** レベルのスパン (L2..L9) を、宣言済みレベルのz順の並びに解決する */
function resolveSpanLevels(model: Model, token: string, ln: number): string[] {
  const m = /^([A-Za-z]+\d+)\.\.([A-Za-z]+\d+)$/.exec(token);
  if (!m) throw new SourceError(ln, `レベル範囲が読めません: ${token}`);
  const from = model.levels[m[1]!];
  const to = model.levels[m[2]!];
  if (!from || !to) {
    throw new SourceError(ln, `未宣言のレベルを含む範囲です (levelを先に書きます): ${token}`);
  }
  if (from.z >= to.z) throw new SourceError(ln, `範囲の向きが逆です: ${token}`);
  return Object.values(model.levels)
    .filter((l) => l.z >= from.z && l.z <= to.z)
    .sort((a, b) => a.z - b.z)
    .map((l) => l.name);
}

/**
 * パス中のレベルスパン (/L2..L9/A) を展開する。
 * 一行の中の複数パスは同じスパンを指す必要があり、同じレベルに揃って展開される (基準階の書き味)
 */
function expandSpan(model: Model, paths: string[], ln: number): string[][] {
  const spans = new Set<string>();
  for (const p of paths) {
    const seg = p.split("/")[1];
    if (seg && /^[A-Za-z]+\d+\.\.[A-Za-z]+\d+$/.test(seg)) spans.add(seg);
  }
  if (spans.size === 0) return [paths];
  if (spans.size > 1) {
    throw new SourceError(ln, `一行の中のレベル範囲は揃えます: ${[...spans].join(", ")}`);
  }
  const span = [...spans][0]!;
  const levels = resolveSpanLevels(model, span, ln);
  return levels.map((lv) =>
    paths.map((p) => {
      const segs = p.split("/");
      if (segs[1] === span) segs[1] = lv;
      return segs.join("/");
    }),
  );
}

/** 通り参照 (X2, X2+600, Y3-150 など) を軸と座標mmに解決する */
function resolveRef(model: Model, token: string, ln: number): { axis: "X" | "Y"; coord: number } {
  const m = /^([XY]\d+)([+-]\d+)?$/.exec(token);
  if (!m) throw new SourceError(ln, `未定義の通り名です: ${token}`);
  const name = m[1]!;
  const offset = m[2] ? Number(m[2]) : 0;
  for (const axis of ["X", "Y"] as const) {
    const g = model.grid[axis];
    const i = g.names.indexOf(name);
    if (i >= 0) return { axis, coord: g.coords[i]! + offset };
  }
  throw new SourceError(ln, `未定義の通り名です: ${token}`);
}

function parseBoundary(rest: string[], ln: number): Boundary {
  const a = rest[0];
  const b = rest[1];
  if (!a?.startsWith("/") || !b?.startsWith("/")) {
    throw new SourceError(ln, "boundary は boundary /パスA /パスB [属性...] の形で書きます");
  }
  const attrs = parseAttrs(rest.slice(2), ln);
  const t = takeNumber(attrs, "t", ln);
  const kindRaw = takeString(attrs, "type") ?? "wall";
  if (!["wall", "open", "stair", "shaft", "void"].includes(kindRaw)) {
    throw new SourceError(
      ln,
      `boundary の type は wall / open / stair / shaft / void です: ${kindRaw}`,
    );
  }
  const air = takeNumber(attrs, "air", ln);
  if (air !== undefined && air !== 0 && air !== 1) {
    throw new SourceError(ln, "air は 0 / 1 で指定します (1=遮蔽しない: 手すり・柵など)");
  }
  const edge = takeEdge(attrs, ln);
  return {
    a,
    b,
    kind: kindRaw as Boundary["kind"],
    ...(t !== undefined ? { t } : {}),
    ...(air === 1 ? { air: true } : {}),
    ...(edge ? { edge } : {}),
    attrs,
    openings: [],
    segs: [],
    line: ln,
  };
}

function parseOpening(
  kind: "door" | "window",
  rest: string[],
  ln: number,
  model: Model,
): Opening {
  // 先頭の非 key:value トークンは建具アセット参照 (Instance←Reference — ADR-0010)。
  // アセットの属性を既定とし、インスタンスの属性が上書きする
  let ref: string | undefined;
  let tokens = rest;
  if (rest[0] && !rest[0].includes(":") && !rest[0].startsWith("/")) {
    ref = rest[0];
    tokens = rest.slice(1);
  }
  const attrs: Attrs = {};
  if (ref) {
    const asset = model.assets.get(ref);
    if (!asset) throw new SourceError(ln, `未定義の建具アセットです: ${ref}`);
    if (asset.kind !== kind) {
      throw new SourceError(ln, `アセット ${ref} は ${asset.kind} です (${kind} として使えません)`);
    }
    Object.assign(attrs, asset.attrs);
  }
  Object.assign(attrs, parseAttrs(tokens, ln));

  const w = takeNumber(attrs, "w", ln);
  if (w === undefined || w <= 0) {
    throw new SourceError(ln, `${kind} には幅 w:(mm) が要ります (アセット側でも可)`);
  }
  const h = takeNumber(attrs, "h", ln);
  const at = parseAt(attrs, ln, model);
  const edge = takeEdge(attrs, ln);
  const hingeRaw = takeString(attrs, "hinge");
  if (hingeRaw !== undefined && !EDGES.has(hingeRaw)) {
    throw new SourceError(ln, `hinge は N/E/S/W で指定します: ${hingeRaw}`);
  }
  const swingRaw = takeString(attrs, "swing");
  if (swingRaw !== undefined && swingRaw !== "a" && swingRaw !== "b") {
    throw new SourceError(ln, `swing は a / b (境界のどちら側へ開くか) です: ${swingRaw}`);
  }
  return {
    kind,
    ...(ref ? { ref } : {}),
    w,
    ...(h !== undefined ? { h } : {}),
    ...at,
    ...(edge ? { edge } : {}),
    ...(hingeRaw ? { hinge: hingeRaw as Edge } : {}),
    ...(swingRaw ? { swing: swingRaw as "a" | "b" } : {}),
    attrs,
    line: ln,
  };
}

// ---- 低レベル ----

/** 空白区切り。"..."内の空白は保持し、引用符外の # 以降はコメント */
export function tokenize(line: string, ln: number): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === "#") break;
    if (!inQuote && /\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (inQuote) throw new SourceError(ln, "引用符が閉じていません");
  if (cur) tokens.push(cur);
  return tokens;
}

/**
 * 型として構造的に解釈される二語 (spec/vocabulary.md 規則1)。
 * `exterior` は「外部」、`void` は「床面積に算入しない」— どちらも構成の事実である。
 */
const STRUCTURAL_TYPES = ["exterior", "void"];

/** 編集距離が1以内か (挿入・削除・置換をそれぞれ1と数える) */
function nearBy1(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/**
 * 型の綴りを守る (ADR-0033)。**型の語彙は開いている** — `room` も `ldk` も `厨房` も自由である。
 * だが構造として解釈される二語だけは、一字違いが黙って意味を変える:
 * `exteriorr` と書けば外部でなくなり、延床が倍になる。check は緑のままだった。
 *
 * 開かれた語彙を殺さずにこれを塞ぐ唯一の形が、**二語の近傍だけを拒むこと**である。
 * 遠い語 (room / yard / ldk) は何も言われない。
 */
function guardStructuralType(type: string, ln: number): void {
  for (const w of STRUCTURAL_TYPES) {
    if (nearBy1(type.toLowerCase(), w)) {
      throw new SourceError(
        ln,
        `型 ${type} は ${w} の綴り違いに見えます (${w} は構造として解釈される語です — 別の語彙のつもりなら綴りを離します)`,
      );
    }
  }
}

function parseAttrs(tokens: string[], ln: number): Attrs {
  const attrs: Attrs = {};
  for (const t of tokens) {
    const idx = t.indexOf(":");
    if (idx <= 0) throw new SourceError(ln, `属性は key:value で書きます: ${t}`);
    const key = t.slice(0, idx);
    const rawVal = t.slice(idx + 1);
    if (rawVal === "") throw new SourceError(ln, `属性 ${key} に値がありません`);
    if (attrs[key] !== undefined) {
      // 後勝ちの黙認はtypoとマージ事故を隠す — 同一行内の重複はエラー (ADR-0013)
      throw new SourceError(ln, `属性キーが重複しています: ${key}`);
    }
    attrs[key] = maybeNumber(rawVal);
  }
  return attrs;
}

function maybeNumber(v: string): AttrValue {
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

function toNumber(v: string, ln: number, what: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new SourceError(ln, `${what}が数値ではありません: ${v}`);
  return Number(v);
}

function takeNumber(attrs: Attrs, key: string, ln: number): number | undefined {
  const v = attrs[key];
  if (v === undefined) return undefined;
  delete attrs[key];
  if (typeof v !== "number") {
    // NaNの黙認はcheck緑のまま導出を壊す (typo h:24O0 など) — その場のエラーにする
    throw new SourceError(ln, `属性 ${key} は数値で書きます: ${v}`);
  }
  return v;
}

function takeString(attrs: Attrs, key: string): string | undefined {
  const v = attrs[key];
  if (v === undefined) return undefined;
  delete attrs[key];
  return String(v);
}

function takeEdge(attrs: Attrs, ln: number): Edge | undefined {
  const v = takeString(attrs, "edge");
  if (v === undefined) return undefined;
  if (!EDGES.has(v)) throw new SourceError(ln, `edge は N/E/S/W で指定します: ${v}`);
  return v as Edge;
}
