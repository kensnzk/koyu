// koyu v0 — 記法パーサ
// 一行が一文。図面が数百年運んできた抽象度を、そのままテキストにする。
// import による合成 (ADR-0010): ファイル群を重ねて一つの模型にする。
// 分担して書き、合成時のコンフリクト (パス・アセット・グリッドの重複) は言葉のエラーになる。

import {
  type Area,
  type Asset,
  type Attrs,
  type AttrValue,
  type Boundary,
  DEFAULT_LANGUAGE_VERSION,
  type Edge,
  type Level,
  type Model,
  type Opening,
  type Pt,
  type Rect,
  type Seg,
  SourceError,
  type Space,
  SUPPORTED_LANGUAGE_VERSIONS,
  type Zone,
} from "./model.js";
import { deriveDefaultBoundaries, derivePieces } from "./graph.js";

/** 境界のトポロジー語 — 増やすのは最後の手段である (spec/vocabulary.md 規則1) */
const BOUNDARY_KINDS = new Set(["wall", "open", "stair", "shaft", "void"]);

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
    attrSrc: new Map(),
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
    throw new SourceError(0, `Cannot read file: ${entry}`);
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
  // **この push の順序が層の強度順序である** (spec/composition.md 規則1)。
  // entry が添字0で最も弱く、後の層ほど強い。同じ層が二度 import されても最初の位置を保つ
  model.layers.push(key);
  ingest(model, src, key, seen, loader);
}

function ingest(
  model: Model,
  source: string,
  file: string | undefined,
  seen: Set<string>,
  loader: LayerLoader | undefined,
): void {
  /** この層の強度。単一ソースの parse では層が無いので 0 とする */
  const layer = file === undefined ? 0 : Math.max(0, model.layers.indexOf(file));
  let current: Boundary[] = [];
  let currentSpaces: Space[] = [];
  let over: OverTarget | undefined;
  let band: BandDecl | undefined; // 帯は次の非字下げ行か層の終わりで展開される (ADR-0019)
  // **原本は NFC として読む** (ADR-0036)。`が` は一つの符号位置とも「か + 濁点」とも綴れ、
  // 正規化しなければ同じに見える二つのパスが別の空間になり (パス重複のエラーも出ない)、
  // 正準JSONには見分けのつかないキーが二つ並ぶ。同一性はここで一つに決める。
  // NFKC は採らない — ㎡ や ① を書き換えてしまい、それは書かれた表記の保存に反する
  const lines = source.normalize("NFC").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    try {
      const raw = lines[i]!;
      const ln = i + 1;
      const tokens = tokenize(raw, ln);
      if (tokens.length === 0) continue;
      const indented = /^\s/.test(raw);
      const [head, ...rest] = tokens as [string, ...string[]];

    if (indented) {
      if (over && (head === "+" || head === "-" || head === "=")) {
        applySetEdit(model, over, head, rest, ln, layer);
      } else if (over) {
        throw new SourceError(
          ln,
          `Only + (add) / - (remove) / = (replace) may sit directly under over: ${head}`,
        );
      } else if (head === "door" || head === "window") {
        if (current.length === 0) {
          throw new SourceError(ln, `${head} is written indented directly under boundary`);
        }
        for (const b of current) b.openings.push(parseOpening(head, rest, ln, model));
      } else if (head === "seg") {
        if (current.length === 0) {
          throw new SourceError(ln, "seg is written indented directly under boundary");
        }
        for (const b of current) b.segs.push(parseSeg(rest, ln, model));
      } else if (head === "line") {
        // 描かれた線 (ADR-0022) — 境界の実現を、隣接からの導出ではなく設計の行為で与える
        if (current.length === 0) {
          throw new SourceError(ln, "line is written indented directly under boundary");
        }
        const drawn = parseDrawnLine(rest, ln, model);
        for (const b of current) {
          if (b.drawn) throw new SourceError(ln, `One boundary carries one line: ${b.a} | ${b.b}`);
          b.drawn = { ...drawn };
        }
      } else if (head === "area") {
        if (band) {
          throw new SourceError(
            ln,
            "area may not be written on a band member (its region is derived — write a room that needs area by position)",
          );
        }
        if (currentSpaces.length === 0) {
          throw new SourceError(ln, "area is written indented directly under space");
        }
        for (const s of currentSpaces) s.areas.push(parseArea(rest, ln, model));
      } else if (head === "space") {
        // 帯の要素 — 領域の代わりに幅 w: を持つ space 行 (ADR-0019)
        if (!band) throw new SourceError(ln, "an indented space is written directly under band");
        band.members.push(parseBandMember(rest, ln));
      } else {
        throw new SourceError(
          ln,
          `Only door / window / seg / line / area / space (a band member) may sit on an indented line: ${head}`,
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
    over = undefined;
    switch (head) {
      case "koyu": {
        const v = rest[0];
        if (!v) throw new SourceError(ln, `koyu takes a version: koyu ${DEFAULT_LANGUAGE_VERSION}`);
        if (rest.length > 1) {
          throw new SourceError(ln, `Extra tokens on the koyu version declaration: ${rest.slice(1).join(" ")}`);
        }
        if (!SUPPORTED_LANGUAGE_VERSIONS.includes(v)) {
          throw new SourceError(
            ln,
            `Unsupported koyu version: ${v} (this tool supports ${SUPPORTED_LANGUAGE_VERSIONS.join(", ")})`,
          );
        }
        // 版はbase層 (entry) でのみ・一度だけ宣言する — 合成順による黙った上書きを禁じる (ADR-0017)。
        // gridの規律に合わせ、再宣言は同値でもエラー
        if (file !== undefined && model.layers[0] !== file) {
          throw new SourceError(ln, "The koyu version is declared only in the base layer (the entry)");
        }
        if (model.versionDeclared) {
          throw new SourceError(ln, `The koyu version is declared once (already ${model.version})`);
        }
        model.version = v;
        model.versionDeclared = true;
        break;
      }
      case "import": {
        const rel = rest[0];
        if (!rel) throw new SourceError(ln, "import takes a relative path: import ./assets.muro");
        if (!loader) {
          throw new SourceError(
            ln,
            "import is available only in file composition (parseFile / parseFiles / CLI)",
          );
        }
        let layer: { key: string; src: string };
        try {
          layer = loader(file, rel);
        } catch {
          throw new SourceError(ln, `Cannot read file: ${rel}`);
        }
        ingestLayer(model, layer.key, layer.src, seen, loader);
        break;
      }
      case "over": {
        // 上書き (合成の規則2・4)。**定義ではない** — 対象が既に無ければエラーである
        over = resolveOverTarget(model, rest, ln);
        const attrs = parseAttrs(rest.filter((t) => t.includes(":") && !t.startsWith("/")), ln);
        const subject = overSubject(over);
        for (const [key, v] of Object.entries(attrs)) {
          switch (over.kind) {
            case "space":
              applyAttr(model, "space", subject, over.space.attrs, key, v, layer, ln, layerOf(model, over.space.file));
              break;
            case "zone":
              applyAttr(model, "zone", subject, over.zone.attrs, key, v, layer, ln, layerOf(model, over.zone.file));
              break;
            case "asset":
              applyAttr(model, "asset", subject, over.asset.attrs, key, v, layer, ln, layerOf(model, over.asset.file));
              break;
            case "level":
              applyLevelAttr(model, over.level, key, v, layer, ln);
              break;
            case "boundary":
              for (const b of over.boundaries) {
                applyBoundaryAttr(model, b, key, v, layer, ln);
              }
              break;
          }
        }
        break;
      }
      case "drop": {
        // 集合からの削除 (合成の規則3)。暗黙の消滅は無い — 消すと書いたものだけが消える
        applyDrop(model, rest, ln);
        break;
      }
      case "asset": {
        // 建具アセット (RevitのFamily / USDのReference — ADR-0010)
        const aname = rest[0];
        const akind = rest[1];
        if (!aname || aname.includes(":") || aname.startsWith("/")) {
          throw new SourceError(ln, "asset takes the form asset <name> door|window [attributes...]");
        }
        if (akind !== "door" && akind !== "window") {
          throw new SourceError(ln, `An asset kind is door / window: ${akind}`);
        }
        const prevA = model.assets.get(aname);
        if (prevA) {
          throw new SourceError(
            ln,
            `Duplicate asset name: ${aname} (first seen in ${prevA.file ?? "the same file"} at line ${prevA.line})`,
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
          throw new SourceError(ln, "polygon takes the form polygon /zone-path x,y x,y x,y ...");
        }
        const pts = rest.slice(1).map((tok) => {
          const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(tok);
          if (!m) throw new SourceError(ln, `Cannot read the vertex (x,y in mm): ${tok}`);
          return { x: Number(m[1]), y: Number(m[2]) };
        });
        if (pts.length < 3) throw new SourceError(ln, "polygon takes three or more vertices");
        const prevP = model.polygons.get(ppath);
        if (prevP) {
          throw new SourceError(
            ln,
            `Duplicate site shape: ${ppath} (first seen in ${prevP.file ?? "the same file"} at line ${prevP.line})`,
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
        if (!nm) throw new SourceError(ln, "name takes a value");
        if (model.name !== undefined && model.name !== nm) {
          throw new SourceError(ln, `name is declared once (already "${model.name}" — in the base layer when composing)`);
        }
        model.name = nm;
        break;
      }
      case "unit": {
        if (rest[0] !== "mm") throw new SourceError(ln, `The only unit in v0 is mm: ${rest[0]}`);
        break;
      }
      case "grid": {
        const axis = rest[0];
        if (axis !== "X" && axis !== "Y") {
          throw new SourceError(ln, `A grid axis is X or Y: ${axis}`);
        }
        if (model.grid[axis].coords.length > 0) {
          throw new SourceError(ln, `grid ${axis} is declared once (in the base layer when composing)`);
        }
        const coords = rest.slice(1).map((t) => toNumber(t, ln, "The grid coordinate"));
        if (coords.length < 2) throw new SourceError(ln, "grid takes two or more coordinates");
        for (let k = 1; k < coords.length; k++) {
          if (coords[k]! <= coords[k - 1]!) {
            throw new SourceError(ln, "grid coordinates are written in ascending order");
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
        if (!name) throw new SourceError(ln, "level requires a name");
        const z = toNumber(rest[1] ?? "", ln, "The level height (z)");
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
            `level carries ${key}:, which is not in the ledger (level reads h / slab / pitch / underground)`,
          );
        }
        if (under !== undefined && under !== 0 && under !== 1) {
          throw new SourceError(ln, "underground is given as 0 / 1 (1 = below ground)");
        }
        const ug = under === 1 ? { underground: true } : {};

        // 範囲宣言: level L3..L9 6700 pitch:2900 — 基準階のレベルを一度に宣言する
        const range = /^([A-Za-z]+)(\d+)\.\.([A-Za-z]+)(\d+)$/.exec(name);
        if (range) {
          const [, p1, n1, p2, n2] = range;
          if (p1 !== p2 || Number(n1) >= Number(n2)) {
            throw new SourceError(ln, `Cannot read the level range: ${name}`);
          }
          if (pitch === undefined || pitch <= 0) {
            throw new SourceError(ln, `A level range requires pitch: (the storey height in mm): ${name}`);
          }
          for (let k = Number(n1); k <= Number(n2); k++) {
            const nm = `${p1}${k}`;
            if (model.levels[nm]) throw new SourceError(ln, `Duplicate level: ${nm}`);
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
          throw new SourceError(ln, "pitch is available only on a level range declaration (L?..L?)");
        }
        if (model.levels[name]) throw new SourceError(ln, `Duplicate level: ${name}`);
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
        const size = toNumber(rest[0] ?? "", ln, "The column dimension");
        if (size <= 0) throw new SourceError(ln, "A column dimension is written as a positive value in mm");
        const span = rest[1];
        if (!span) {
          throw new SourceError(ln, "column takes the form column <size mm> <L?..L?|level name> [x:grid,..] [y:grid,..]");
        }
        const levels = /\.\./.test(span)
          ? resolveSpanLevels(model, span, ln)
          : (() => {
              if (!model.levels[span]) throw new SourceError(ln, `Undeclared level: ${span}`);
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
              throw new SourceError(ln, `Undefined grid line name: ${n}`);
            }
          }
          if (list.length === 0) throw new SourceError(ln, `${key}: takes grid line names`);
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
        if (!path) throw new SourceError(ln, "space requires a path");
        // w: は帯の要素の語 — 字下げを落とした要素が「領域なしの空間」として黙って通るのを防ぐ
        if (rest.some((t) => t === "w:" || t.startsWith("w:"))) {
          throw new SourceError(
            ln,
            "w: may not be written on space (a space written by width sits indented under band)",
          );
        }
        for (const [p] of expandSpan(model, [path], ln)) {
          const space = parseSpace([p!, ...rest.slice(1)], ln, model);
          const prevS = model.spaces.get(space.path);
          if (prevS) {
            throw new SourceError(
              ln,
              `Duplicate space path: ${space.path} (first seen in ${prevS.file ?? "the same file"} at line ${prevS.line})`,
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
          throw new SourceError(ln, "boundary takes the form boundary /pathA /pathB [attributes...]");
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
          throw new SourceError(ln, "zone takes the form zone /path [attributes...]");
        }
        for (const [p] of expandSpan(model, [zpath], ln)) {
          const prevZ = model.zones.get(p!);
          if (prevZ) {
            throw new SourceError(
              ln,
              `Duplicate zone path: ${p} (first seen in ${prevZ.file ?? "the same file"} at line ${prevZ.line})`,
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
          throw new SourceError(ln, "stack takes the form stack <name> <L?..L?> type:stair|shaft");
        }
        const levels = resolveSpanLevels(model, span, ln);
        const attrs = parseAttrs(rest.slice(2), ln);
        const kind = takeString(attrs, "type");
        if (kind !== "stair" && kind !== "shaft" && kind !== "void") {
          throw new SourceError(ln, `A stack type is stair / shaft / void: ${kind}`);
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
        throw new SourceError(ln, `Unknown keyword: ${head}`);
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
    throw new SourceError(ln, "space takes the form space /path type [X?..X? Y?..Y? [+ ...]]");
  }
  const type = rest[1];
  if (!type) throw new SourceError(ln, `space ${path} requires a type (a word from the vocabulary)`);
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
    throw new SourceError(ln, `Undeclared level: level:${explicit}`);
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
      `A band divides along X or Y: ${axis ?? "(none)"} (it takes the form band X X1..X2 Y1..Y2)`,
    );
  }
  const tail = rest.slice(1);
  const extra = tail.filter((t) => !t.includes(".."));
  if (extra.length > 0) {
    throw new SourceError(
      ln,
      `Only the axis and the extent may be written on a band line (attributes go on the member space lines): ${extra.join(" ")}`,
    );
  }
  // 逆順表記は space では同じ矩形の別綴りだが、帯では並びの向きが意味を持つので許さない
  for (const t of tail) {
    const [p, q] = t.split("..");
    if (!p || !q) throw new SourceError(ln, `Cannot read the region: ${t}`);
    const rp = resolveRef(model, p, ln);
    const rq = resolveRef(model, q, ln);
    if (rp.axis === rq.axis && rp.coord > rq.coord) {
      throw new SourceError(
        ln,
        `A band range is written in ascending order (members run west to east / south to north): ${t}`,
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
    throw new SourceError(ln, "A band member takes the form space /path type w:(mm)");
  }
  const type = rest[1];
  // 型の位置に k:v が来たら「型の書き忘れ」— 幅の欠落として誤報しない
  if (!type || type.includes(":")) {
    throw new SourceError(ln, `The band member ${path} requires a type (a word from the vocabulary)`);
  }
  guardStructuralType(type, ln);
  let w: number | "rest" | undefined;
  const attrTokens: string[] = [];
  for (const t of rest.slice(2)) {
    if (t === "+" || t.includes("..")) {
      throw new SourceError(ln, `A region may not be written on a band member (the band and w: give it): ${t}`);
    }
    if (t.startsWith("level:")) {
      throw new SourceError(
        ln,
        `level: may not be written on a band member (a band is a run on one level): ${t}`,
      );
    }
    if (t.startsWith("w:")) {
      if (w !== undefined) throw new SourceError(ln, "Duplicate attribute key: w");
      const v = t.slice(2);
      if (v === "rest") w = "rest";
      else if (/^\d+$/.test(v) && Number(v) > 0) w = Number(v);
      else throw new SourceError(ln, `A band member width is written as a positive integer in mm, or as rest: ${t}`);
      continue;
    }
    attrTokens.push(t);
  }
  if (w === undefined) {
    throw new SourceError(ln, `A band member requires a width, w:(mm) or w:rest: ${path}`);
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
    throw new SourceError(ln, `The derived cut position is not an integer in mm: ${c}`);
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
    throw new SourceError(band.line, "band takes one or more indented space lines below it");
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
          `Only one member per band absorbs the remainder (w:rest): ${members[restAt]!.path}, ${m.path}`,
        );
      }
      restAt = k;
    } else sum += m.w;
  }
  const list = members.map((m) => `  ${m.path} w:${m.w}`).join("\n");
  if (sum > extent) {
    throw new SourceError(
      band.line,
      `The dimensions sum to ${sum}mm against a band width of ${extent}mm, ${sum - extent}mm over\n${list}`,
    );
  }
  const widths = members.map((m) => (m.w === "rest" ? 0 : m.w));
  if (restAt >= 0) {
    if (sum === extent) {
      throw new SourceError(
        members[restAt]!.line,
        `The other dimensions use up the band width of ${extent}mm, leaving zero for ${members[restAt]!.path} (w:rest)`,
      );
    }
    widths[restAt] = extent - sum;
  } else if (sum < extent) {
    throw new SourceError(
      band.line,
      `The dimensions sum to ${sum}mm against a band width of ${extent}mm, ${extent - sum}mm short ` +
        `(fix a dimension, or make one of them w:rest)\n${list}`,
    );
  }

  // レベルスパンは全要素をまとめて一度だけ展開する (帯の中で揃っていることを先に確かめる)
  const iterations = expandSpan(model, members.map((m) => m.path), band.line);
  for (const it of iterations) {
    const lv = new Set(it.map((p) => p.split("/")[1]));
    if (lv.size > 1) {
      throw new SourceError(
        band.line,
        `Band members expand onto the same level: ${it.map((p) => `${p} → ${p.split("/")[1]}`).join(", ")}`,
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
          `Duplicate space path: ${space.path} (first seen in ${prev.file ?? "the same file"} at line ${prev.line})`,
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
    throw new SourceError(ln, "A region is given as two ranges, X?..X? and Y?..Y?");
  }
  let xr: [number, number] | undefined;
  let yr: [number, number] | undefined;
  let xg: [string, string] | undefined;
  let yg: [string, string] | undefined;
  for (const t of regionTokens) {
    const [p, q] = t.split("..");
    if (!p || !q) throw new SourceError(ln, `Cannot read the region: ${t}`);
    const rp = resolveRef(model, p, ln);
    const rq = resolveRef(model, q, ln);
    if (rp.axis !== rq.axis) {
      throw new SourceError(ln, `Both ends of a range are grid lines on the same axis: ${t}`);
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
    throw new SourceError(ln, "A region uses one X range and one Y range");
  }
  if (xr[0] === xr[1] || yr[0] === yr[1]) throw new SourceError(ln, "The region has zero width");
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
    throw new SourceError(ln, "line takes the form line <start> <end> (for example line X3,Y1 X4,Y3)");
  }
  const [aRef, bRef] = rest as [string, string];
  const a = resolvePoint(model, aRef, ln);
  const b = resolvePoint(model, bRef, ln);
  if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) {
    throw new SourceError(ln, `Both ends of the line are the same point: ${aRef}`);
  }
  return { aRef, bRef, a, b, line: ln };
}

/** 通り語の対 `X3,Y1` / `X3+600,Y2-900` を点へ */
function resolvePoint(model: Model, token: string, ln: number): Pt {
  const parts = token.split(",");
  if (parts.length !== 2) {
    throw new SourceError(ln, `A point takes the form <X grid line>,<Y grid line>: ${token}`);
  }
  const p = resolveRef(model, parts[0]!, ln);
  const q = resolveRef(model, parts[1]!, ln);
  if (p.axis !== "X" || q.axis !== "Y") {
    throw new SourceError(ln, `A point is written X grid line first, then Y: ${token}`);
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
    throw new SourceError(ln, "seg requires a width w:(mm)");
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
      throw new SourceError(ln, "at is given as a ratio in 0..1, or as a grid reference (at:X2+450)");
    }
    return { at: v };
  }
  const r = resolveRef(model, v, ln);
  return { at: 0.5, atRef: v, atAbs: r.coord, atAxis: r.axis };
}

/** レベルのスパン (L2..L9) を、宣言済みレベルのz順の並びに解決する */
function resolveSpanLevels(model: Model, token: string, ln: number): string[] {
  const m = /^([A-Za-z]+\d+)\.\.([A-Za-z]+\d+)$/.exec(token);
  if (!m) throw new SourceError(ln, `Cannot read the level range: ${token}`);
  const from = model.levels[m[1]!];
  const to = model.levels[m[2]!];
  if (!from || !to) {
    throw new SourceError(ln, `The range includes an undeclared level (declare level first): ${token}`);
  }
  if (from.z >= to.z) throw new SourceError(ln, `The range runs backwards: ${token}`);
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
    throw new SourceError(ln, `Level ranges on one line must agree: ${[...spans].join(", ")}`);
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
  if (!m) throw new SourceError(ln, `Undefined grid line name: ${token}`);
  const name = m[1]!;
  const offset = m[2] ? Number(m[2]) : 0;
  for (const axis of ["X", "Y"] as const) {
    const g = model.grid[axis];
    const i = g.names.indexOf(name);
    if (i >= 0) return { axis, coord: g.coords[i]! + offset };
  }
  throw new SourceError(ln, `Undefined grid line name: ${token}`);
}

function parseBoundary(rest: string[], ln: number): Boundary {
  const a = rest[0];
  const b = rest[1];
  if (!a?.startsWith("/") || !b?.startsWith("/")) {
    throw new SourceError(ln, "boundary takes the form boundary /pathA /pathB [attributes...]");
  }
  const attrs = parseAttrs(rest.slice(2), ln);
  const t = takeNumber(attrs, "t", ln);
  const kindRaw = takeString(attrs, "type") ?? "wall";
  if (!BOUNDARY_KINDS.has(kindRaw)) {
    throw new SourceError(
      ln,
      `A boundary type is ${[...BOUNDARY_KINDS].join(" / ")}: ${kindRaw}`,
    );
  }
  const air = takeNumber(attrs, "air", ln);
  if (air !== undefined && air !== 0 && air !== 1) {
    throw new SourceError(ln, "air is given as 0 / 1 (1 = it does not block air or light: a railing, a fence)");
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
    if (!asset) throw new SourceError(ln, `Undefined opening asset: ${ref}`);
    if (asset.kind !== kind) {
      throw new SourceError(ln, `The asset ${ref} is a ${asset.kind} (it cannot be used as a ${kind})`);
    }
    Object.assign(attrs, asset.attrs);
  }
  Object.assign(attrs, parseAttrs(tokens, ln));

  const w = takeNumber(attrs, "w", ln);
  if (w === undefined || w <= 0) {
    throw new SourceError(ln, `${kind} requires a width w:(mm) (the asset may supply it)`);
  }
  const h = takeNumber(attrs, "h", ln);
  const at = parseAt(attrs, ln, model);
  const edge = takeEdge(attrs, ln);
  const hingeRaw = takeString(attrs, "hinge");
  if (hingeRaw !== undefined && !EDGES.has(hingeRaw)) {
    throw new SourceError(ln, `hinge is given as N/E/S/W: ${hingeRaw}`);
  }
  const swingRaw = takeString(attrs, "swing");
  if (swingRaw !== undefined && swingRaw !== "a" && swingRaw !== "b") {
    throw new SourceError(ln, `swing is a / b, the side of the boundary it opens toward: ${swingRaw}`);
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
  if (inQuote) throw new SourceError(ln, "Unclosed quote");
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
        `The type ${type} looks like a misspelling of ${w} (${w} is read structurally — if a different word was meant, spell it further away)`,
      );
    }
  }
}

/**
 * 上書きの対象 (合成の規則4 — 定義と上書きの区別)。
 * `space` / `boundary` は**定義**であり、重複はエラーである。`over` は**上書き**であり、
 * 対象が既に定義されていなければエラーである。二つは別の文であって、書き方から区別がつく。
 */
type OverTarget =
  | { kind: "space"; space: Space }
  | { kind: "zone"; zone: Zone }
  | { kind: "boundary"; boundaries: Boundary[] }
  | { kind: "level"; level: Level }
  | { kind: "asset"; asset: Asset };

/** その要素を定義した層の添字 (出所が無ければ 0 = 最も弱い) */
function layerOf(model: Model, file: string | undefined): number {
  if (file === undefined) return 0;
  const i = model.layers.indexOf(file);
  return i < 0 ? 0 : i;
}

/** 出所の鍵 — `<種別>:<対象>:<属性キー>` */
function srcKey(kind: string, subject: string, key: string): string {
  return `${kind}:${subject}:${key}`;
}

/** その対象の、出所を記録するときの名前 */
function overSubject(t: OverTarget): string {
  switch (t.kind) {
    case "space":
      return t.space.path;
    case "zone":
      return t.zone.path;
    case "level":
      return t.level.name;
    case "asset":
      return t.asset.name;
    case "boundary":
      return t.boundaries.map((b) => `${b.a}|${b.b}`).join(",");
  }
}

/**
 * 属性を一つ、強度の規則に従って書き込む (合成の規則2 — 単一の値は最も強い層の意見が勝つ)。
 *
 * **走査の順ではなく強度で決める。**entry は添字0で最も弱いが、その行が
 * import より後に書かれていれば走査としては最後に来る。順序で決めると、
 * import 行を上下に動かしただけで結果が変わってしまう。
 *
 * 同じ層が同じ属性に二度意見を持つのは矛盾なのでエラーにする (`>=` ではなく `>`)。
 */
function applyAttr(
  model: Model,
  kind: string,
  subject: string,
  into: Attrs,
  key: string,
  value: AttrValue,
  layer: number,
  ln: number,
  defLayer = 0,
): void {
  const k = srcKey(kind, subject, key);
  // 出所が記録されていなければ、値は**定義した層**が与えたものである。
  // entry (添字0) が import より後ろに over を書いても、定義した層の方が強ければ通らない —
  // 強度は走査の順ではなく宣言された順序で決まる (規則1)
  const prev = model.attrSrc.get(k) ?? (into[key] !== undefined ? defLayer : undefined);
  if (prev !== undefined) {
    if (prev > layer) return; // 強い層が既に決めている — 弱い層の意見は通らない
    if (prev === layer) {
      throw new SourceError(
        ln,
        `One layer holds two opinions about ${key} on ${subject} (which one wins is undetermined)`,
      );
    }
  }
  into[key] = value;
  model.attrSrc.set(k, layer);
}

/** 定義された属性の出所を、その層のものとして記録する */
function recordAttrs(model: Model, kind: string, subject: string, attrs: Attrs, layer: number): void {
  for (const key of Object.keys(attrs)) model.attrSrc.set(srcKey(kind, subject, key), layer);
}

/** 集合の要素を名で引く (合成の規則3 — 同一性は「含む対象 + その中で一意な名」) */
function findNamed<T extends { attrs: Attrs }>(list: T[], name: string): T[] {
  return list.filter((x) => String(x.attrs["name"] ?? "") === name);
}

/**
 * `over` の対象を解く。**書き方から種別が決まる** — 先頭のトークンが指す先で分かれる。
 *
 *   over /L5/A/ldk h:2600           空間 (パス1つ)
 *   over /site area:1100.20         ゾーン (パス1つ・空間が無ければゾーン)
 *   over /L5/A/hall /L5/corridor    境界 (パス2つ)
 *   over level L3 h:2600            レベル
 *   over asset SD1 w:900            アセット
 *
 * 対象が存在しなければエラーである。**上書きは定義ではない** — 存在しないものに
 * 意見だけを足すのは、たいてい綴り違いか、層の順序の思い違いである。
 */
function resolveOverTarget(model: Model, rest: string[], ln: number): OverTarget {
  const head = rest[0];
  if (head === "level") {
    const name = rest[1];
    const lv = name ? model.levels[name] : undefined;
    if (!lv) throw new SourceError(ln, `No such level for over: ${name ?? "(no name)"}`);
    return { kind: "level", level: lv };
  }
  if (head === "asset") {
    const name = rest[1];
    const a = name ? model.assets.get(name) : undefined;
    if (!a) throw new SourceError(ln, `No such asset for over: ${name ?? "(no name)"}`);
    return { kind: "asset", asset: a };
  }
  const paths = rest.filter((t) => t.startsWith("/"));
  if (paths.length === 0) {
    throw new SourceError(
      ln,
      "over takes the form over /path … / over /pathA /pathB … / over level <name> … / over asset <name> …",
    );
  }
  if (paths.length === 1) {
    const path = paths[0]!;
    const sp = model.spaces.get(path);
    if (sp) return { kind: "space", space: sp };
    const zn = model.zones.get(path);
    if (zn) return { kind: "zone", zone: zn };
    throw new SourceError(ln, `No such target for over: ${path} (place it after the layer that defines it)`);
  }
  if (paths.length > 2) {
    throw new SourceError(ln, `Too many paths on the over target: ${paths.join(" ")}`);
  }
  const [a, b] = paths as [string, string];
  const hit = model.boundaries.filter(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  );
  if (hit.length === 0) {
    throw new SourceError(ln, `No such boundary for over: ${a} | ${b}`);
  }
  return { kind: "boundary", boundaries: hit };
}

/** レベルの上書き — typed field なので属性の器を持たない。台帳の四語だけを受ける */
function applyLevelAttr(
  model: Model,
  lv: Level,
  key: string,
  v: AttrValue,
  layer: number,
  ln: number,
): void {
  const k = srcKey("level", lv.name, key);
  const prev = model.attrSrc.get(k) ?? layerOf(model, lv.file);
  if (prev > layer) return;
  if (prev === layer) {
    throw new SourceError(ln, `One layer holds two opinions about ${key} on level ${lv.name}`);
  }
  if (key === "h" || key === "slab") {
    if (typeof v !== "number" || !(v > 0)) {
      throw new SourceError(ln, `A level ${key} is written as a positive number: ${key}:${v}`);
    }
    lv[key] = v;
  } else if (key === "underground") {
    if (v !== 0 && v !== 1) throw new SourceError(ln, "underground is given as 0 / 1");
    lv.underground = v === 1;
  } else {
    throw new SourceError(ln, `Only h / slab / underground may be overridden on a level: ${key}`);
  }
  model.attrSrc.set(k, layer);
}

/** 境界の上書き — typed field (type/t/air/edge) と自由属性の両方を受ける */
function applyBoundaryAttr(
  model: Model,
  b: Boundary,
  key: string,
  v: AttrValue,
  layer: number,
  ln: number,
): void {
  const subject = `${b.a}|${b.b}`;
  const k = srcKey("boundary", subject, key);
  const prev = model.attrSrc.get(k) ?? layerOf(model, b.file);
  if (prev > layer) return;
  if (prev === layer) {
    throw new SourceError(ln, `One layer holds two opinions about ${key} on boundary ${subject}`);
  }
  if (key === "type") {
    const kind = String(v);
    if (!BOUNDARY_KINDS.has(kind)) {
      throw new SourceError(ln, `A boundary type is ${[...BOUNDARY_KINDS].join(" / ")}: ${kind}`);
    }
    b.kind = kind as Boundary["kind"];
  } else if (key === "t") {
    if (typeof v !== "number" || !(v > 0)) throw new SourceError(ln, `t is written as a positive number: t:${v}`);
    b.t = v;
  } else if (key === "air") {
    b.air = v === 1 ? true : undefined;
  } else if (key === "edge") {
    if (!EDGES.has(String(v))) throw new SourceError(ln, `edge is given as N/E/S/W: ${v}`);
    b.edge = String(v) as Edge;
  } else {
    b.attrs[key] = v;
  }
  model.attrSrc.set(k, layer);
}

/**
 * 集合の編集 (合成の規則3 — 追加 / 削除 / 置換)。**暗黙のマージをしない。**
 *
 *   + door SD1 w:900 at:X4 name:D9     追加
 *   - door D9                          削除 (名で指す)
 *   = door D9 w:1200                   置換 (名で指し、書いた属性だけを差し替える)
 *
 * 同一性は「含む対象 + その中で一意な名」である (spec/scope.md §5)。
 * 名を持たない要素は編集の対象にできない — 指す言葉が無いからである。
 */
function applySetEdit(
  model: Model,
  target: OverTarget,
  op: "+" | "-" | "=",
  rest: string[],
  ln: number,
  layer: number,
): void {
  const what = rest[0];
  if (!what) throw new SourceError(ln, `${op} takes door / window / seg / area after it`);
  const args = rest.slice(1);

  if (target.kind === "space") {
    if (what !== "area") {
      throw new SourceError(ln, `over on a space edits area: ${what}`);
    }
    editList(model, target.space.areas, op, args, ln, () => parseArea(args, ln, model), "area");
    return;
  }
  if (target.kind !== "boundary") {
    throw new SourceError(ln, `over on ${target.kind} has no set edits`);
  }
  for (const b of target.boundaries) {
    if (what === "door" || what === "window") {
      editList(model, b.openings, op, args, ln, () => parseOpening(what, args, ln, model), what);
    } else if (what === "seg") {
      editList(model, b.segs, op, args, ln, () => parseSeg(args, ln, model), "seg");
    } else {
      throw new SourceError(ln, `over on a boundary edits door / window / seg: ${what}`);
    }
  }
}

/** 一つの集合に対する追加・削除・置換 */
function editList<T extends { attrs: Attrs }>(
  model: Model,
  list: T[],
  op: "+" | "-" | "=",
  args: string[],
  ln: number,
  make: () => T,
  what: string,
): void {
  if (op === "+") {
    const made = make();
    if (String(made.attrs["name"] ?? "") === "") {
      throw new SourceError(ln, `A ${what} added with + requires name: (it is the name later statements point to)`);
    }
    if (findNamed(list, String(made.attrs["name"])).length > 0) {
      throw new SourceError(ln, `Duplicate ${what} name: ${made.attrs["name"]}`);
    }
    list.push(made);
    return;
  }
  const name = args[0];
  if (!name || name.includes(":")) {
    throw new SourceError(ln, `${op} ${what} takes the name it points to (${op} ${what} D1)`);
  }
  const hit = findNamed(list, name);
  if (hit.length === 0) throw new SourceError(ln, `No such ${what}: ${name}`);
  if (hit.length > 1) throw new SourceError(ln, `The ${what} name ${name} is not unique`);
  const idx = list.indexOf(hit[0]!);
  if (op === "-") {
    list.splice(idx, 1);
    return;
  }
  // = は書いた属性だけを差し替える (全置換ではない — 名は残る)
  const patch = parseAttrs(args.slice(1), ln);
  Object.assign(list[idx]!.attrs, patch);
  applyTypedPatch(list[idx]!, patch, ln);
}

/** 置換で typed field (w/h/at) に触れたぶんを反映する */
function applyTypedPatch(item: { attrs: Attrs } & Record<string, unknown>, patch: Attrs, ln: number): void {
  for (const key of ["w", "h"]) {
    const v = patch[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !(v > 0)) {
      throw new SourceError(ln, `${key} is written as a positive number: ${key}:${v}`);
    }
    item[key] = v;
    delete item.attrs[key];
  }
}

/**
 * 削除 (合成の規則3)。**消えるのは、消すと書いたものだけである。**
 *
 *   drop /L5/A/store          空間 (その空間に繋がる境界も一緒に消える)
 *   drop /L5/a /L5/b          境界
 *   drop column <名>          柱の宣言
 */
function applyDrop(model: Model, rest: string[], ln: number): void {
  if (rest[0] === "column") {
    const name = rest[1];
    if (!name) throw new SourceError(ln, "drop column takes the name of a column");
    const before = model.columns.length;
    model.columns = model.columns.filter((c) => String(c.attrs["name"] ?? "") !== name);
    if (model.columns.length === before) throw new SourceError(ln, `No such column: ${name}`);
    return;
  }
  const paths = rest.filter((t) => t.startsWith("/"));
  if (paths.length === 1) {
    const path = paths[0]!;
    if (model.spaces.delete(path)) {
      // 空間が消えれば、その空間を端に持つ関係も消える — 関係は空間の間にしか無い
      model.boundaries = model.boundaries.filter((b) => b.a !== path && b.b !== path);
      return;
    }
    if (model.zones.delete(path)) return;
    throw new SourceError(ln, `No such target for drop: ${path}`);
  }
  if (paths.length === 2) {
    const [a, b] = paths as [string, string];
    const before = model.boundaries.length;
    model.boundaries = model.boundaries.filter(
      (x) => !((x.a === a && x.b === b) || (x.a === b && x.b === a)),
    );
    if (model.boundaries.length === before) {
      throw new SourceError(ln, `No such boundary for drop: ${a} | ${b}`);
    }
    return;
  }
  throw new SourceError(ln, "drop takes the form drop /path / drop /pathA /pathB / drop column <name>");
}

function parseAttrs(tokens: string[], ln: number): Attrs {
  const attrs: Attrs = {};
  for (const t of tokens) {
    const idx = t.indexOf(":");
    if (idx <= 0) throw new SourceError(ln, `An attribute is written key:value: ${t}`);
    const key = t.slice(0, idx);
    const rawVal = t.slice(idx + 1);
    if (rawVal === "") throw new SourceError(ln, `The attribute ${key} has no value`);
    if (attrs[key] !== undefined) {
      // 後勝ちの黙認はtypoとマージ事故を隠す — 同一行内の重複はエラー (ADR-0013)
      throw new SourceError(ln, `Duplicate attribute key: ${key}`);
    }
    attrs[key] = maybeNumber(rawVal);
  }
  return attrs;
}

function maybeNumber(v: string): AttrValue {
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

function toNumber(v: string, ln: number, what: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw new SourceError(ln, `${what} is not a number: ${v}`);
  return Number(v);
}

function takeNumber(attrs: Attrs, key: string, ln: number): number | undefined {
  const v = attrs[key];
  if (v === undefined) return undefined;
  delete attrs[key];
  if (typeof v !== "number") {
    // NaNの黙認はcheck緑のまま導出を壊す (typo h:24O0 など) — その場のエラーにする
    throw new SourceError(ln, `The attribute ${key} is written as a number: ${v}`);
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
  if (!EDGES.has(v)) throw new SourceError(ln, `edge is given as N/E/S/W: ${v}`);
  return v as Edge;
}
