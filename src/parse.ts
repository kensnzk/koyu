// koyu v0 — 記法パーサ
// 一行が一文。図面が数百年運んできた抽象度を、そのままテキストにする。
// import による合成 (ADR-0010): ファイル群を重ねて一つの模型にする。
// 分担して書き、合成時のコンフリクト (パス・アセット・グリッドの重複) は言葉のエラーになる。

import {
  type Area,
  type Attrs,
  type AttrValue,
  type Boundary,
  type Edge,
  type Model,
  type Opening,
  type Rect,
  type Seg,
  SourceError,
  type Space,
} from "./model.js";

const EDGES = new Set(["N", "E", "S", "W"]);

function emptyModel(): Model {
  return {
    version: "0.1",
    unit: "mm",
    grid: { X: { names: [], coords: [] }, Y: { names: [], coords: [] } },
    levels: {},
    spaces: new Map(),
    zones: new Map(),
    assets: new Map(),
    boundaries: [],
    polygons: new Map(),
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
      } else if (head === "area") {
        if (currentSpaces.length === 0) {
          throw new SourceError(ln, "area は space の直下に字下げして書きます");
        }
        for (const s of currentSpaces) s.areas.push(parseArea(rest, ln, model));
      } else {
        throw new SourceError(
          ln,
          `字下げ行に置けるのは door / window / seg / area のみです: ${head}`,
        );
      }
      continue;
    }

    current = [];
    currentSpaces = [];
    switch (head) {
      case "koyu": {
        model.version = rest[0] ?? "0.1";
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
        const h = takeNumber(attrs, "h");
        const slab = takeNumber(attrs, "slab");
        const pitch = takeNumber(attrs, "pitch");

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
              ...(h !== undefined ? { h } : {}),
              ...(slab !== undefined ? { slab } : {}),
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
          ...(h !== undefined ? { h } : {}),
          ...(slab !== undefined ? { slab } : {}),
        };
        break;
      }
      case "space": {
        const path = rest[0];
        if (!path) throw new SourceError(ln, "space にはパスが要ります");
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
}

// ---- 各要素 ----

function parseSpace(rest: string[], ln: number, model: Model): Space {
  const path = rest[0];
  if (!path || !path.startsWith("/")) {
    throw new SourceError(ln, "space は space /パス 型 [X?..X? Y?..Y? [+ ...]] の形で書きます");
  }
  const type = rest[1];
  if (!type) throw new SourceError(ln, `space ${path} に型(語彙)が要ります`);

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

  const space: Space = { path, type, level, grids: [], rects: [], areas: [], attrs, line: ln };
  for (const g of groups) {
    if (g.length === 0) continue;
    const r = parseRegion(g, ln, model);
    space.grids.push(r.grid);
    space.rects.push(r.rect);
  }
  return space;
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
    if (rp.axis === "X") {
      xr = [rp.coord, rq.coord];
      xg = [p, q];
    } else {
      yr = [rp.coord, rq.coord];
      yg = [p, q];
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
  const w = takeNumber(attrs, "w");
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
  const t = takeNumber(attrs, "t");
  const kindRaw = takeString(attrs, "type") ?? "wall";
  if (!["wall", "open", "stair", "shaft", "void"].includes(kindRaw)) {
    throw new SourceError(
      ln,
      `boundary の type は wall / open / stair / shaft / void です: ${kindRaw}`,
    );
  }
  const air = takeNumber(attrs, "air");
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

  const w = takeNumber(attrs, "w");
  if (w === undefined || w <= 0) {
    throw new SourceError(ln, `${kind} には幅 w:(mm) が要ります (アセット側でも可)`);
  }
  const h = takeNumber(attrs, "h");
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

function parseAttrs(tokens: string[], ln: number): Attrs {
  const attrs: Attrs = {};
  for (const t of tokens) {
    const idx = t.indexOf(":");
    if (idx <= 0) throw new SourceError(ln, `属性は key:value で書きます: ${t}`);
    const key = t.slice(0, idx);
    const rawVal = t.slice(idx + 1);
    if (rawVal === "") throw new SourceError(ln, `属性 ${key} に値がありません`);
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

function takeNumber(attrs: Attrs, key: string): number | undefined {
  const v = attrs[key];
  if (v === undefined) return undefined;
  delete attrs[key];
  return typeof v === "number" ? v : Number.NaN;
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
