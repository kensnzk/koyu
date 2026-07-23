// IFCXS v0 — 記法パーサ
// 一行が一文。図面が数百年運んできた抽象度を、そのままテキストにする。

import {
  type Attrs,
  type AttrValue,
  type Boundary,
  type Edge,
  type Model,
  type Opening,
  SourceError,
  type Space,
} from "./model.js";

const EDGES = new Set(["N", "E", "S", "W"]);

export function parse(source: string): Model {
  const model: Model = {
    version: "0.1",
    unit: "mm",
    grid: { X: { names: [], coords: [] }, Y: { names: [], coords: [] } },
    levels: {},
    spaces: new Map(),
    boundaries: [],
  };

  let current: Boundary | undefined;
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const ln = i + 1;
    const tokens = tokenize(raw, ln);
    if (tokens.length === 0) continue;
    const indented = /^\s/.test(raw);
    const [head, ...rest] = tokens as [string, ...string[]];

    if (indented) {
      if (head !== "door" && head !== "window") {
        throw new SourceError(ln, `字下げ行に置けるのは door / window のみです: ${head}`);
      }
      if (!current) {
        throw new SourceError(ln, `${head} は boundary の直下に字下げして書きます`);
      }
      current.openings.push(parseOpening(head, rest, ln));
      continue;
    }

    switch (head) {
      case "ifcxs": {
        model.version = rest[0] ?? "0.1";
        current = undefined;
        break;
      }
      case "name": {
        model.name = rest.join(" ");
        current = undefined;
        break;
      }
      case "unit": {
        if (rest[0] !== "mm") throw new SourceError(ln, `v0の単位はmmのみです: ${rest[0]}`);
        current = undefined;
        break;
      }
      case "grid": {
        const axis = rest[0];
        if (axis !== "X" && axis !== "Y") {
          throw new SourceError(ln, `grid の軸は X か Y です: ${axis}`);
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
        current = undefined;
        break;
      }
      case "level": {
        const name = rest[0];
        if (!name) throw new SourceError(ln, "level には名前が要ります");
        const z = toNumber(rest[1] ?? "", ln, "levelの高さ(z)");
        const attrs = parseAttrs(rest.slice(2), ln);
        const h = takeNumber(attrs, "h");
        const slab = takeNumber(attrs, "slab");
        model.levels[name] = {
          name,
          z,
          ...(h !== undefined ? { h } : {}),
          ...(slab !== undefined ? { slab } : {}),
        };
        current = undefined;
        break;
      }
      case "space": {
        const space = parseSpace(rest, ln, model);
        if (model.spaces.has(space.path)) {
          throw new SourceError(ln, `空間パスが重複しています: ${space.path}`);
        }
        model.spaces.set(space.path, space);
        current = undefined;
        break;
      }
      case "boundary": {
        current = parseBoundary(rest, ln);
        model.boundaries.push(current);
        break;
      }
      default:
        throw new SourceError(ln, `未知のキーワードです: ${head}`);
    }
  }
  return model;
}

// ---- 各要素 ----

function parseSpace(rest: string[], ln: number, model: Model): Space {
  const path = rest[0];
  if (!path || !path.startsWith("/")) {
    throw new SourceError(ln, "space は space /パス 型 [X?..X? Y?..Y?] の形で書きます");
  }
  const type = rest[1];
  if (!type) throw new SourceError(ln, `space ${path} に型(語彙)が要ります`);

  const regionTokens = rest.slice(2).filter((t) => t.includes(".."));
  const attrTokens = rest.slice(2).filter((t) => !t.includes(".."));
  const attrs = parseAttrs(attrTokens, ln);

  const seg = path.split("/")[1];
  const level = seg && model.levels[seg] ? seg : undefined;

  const space: Space = { path, type, level, attrs, line: ln };

  if (regionTokens.length > 0) {
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
    space.grid = { xa: xg[0], xb: xg[1], ya: yg[0], yb: yg[1] };
    space.rect = {
      x1: Math.min(xr[0], xr[1]),
      x2: Math.max(xr[0], xr[1]),
      y1: Math.min(yr[0], yr[1]),
      y2: Math.max(yr[0], yr[1]),
    };
  }
  return space;
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
  if (kindRaw !== "wall" && kindRaw !== "open" && kindRaw !== "stair" && kindRaw !== "shaft") {
    throw new SourceError(ln, `boundary の type は wall / open / stair / shaft です: ${kindRaw}`);
  }
  const edge = takeEdge(attrs, ln);
  return {
    a,
    b,
    kind: kindRaw,
    ...(t !== undefined ? { t } : {}),
    ...(edge ? { edge } : {}),
    attrs,
    openings: [],
    line: ln,
  };
}

function parseOpening(kind: "door" | "window", rest: string[], ln: number): Opening {
  const attrs = parseAttrs(rest, ln);
  const w = takeNumber(attrs, "w");
  if (w === undefined || w <= 0) {
    throw new SourceError(ln, `${kind} には幅 w:(mm) が要ります`);
  }
  const h = takeNumber(attrs, "h");
  const at = takeNumber(attrs, "at") ?? 0.5;
  if (at < 0 || at > 1) throw new SourceError(ln, "at は 0..1 で指定します");
  const edge = takeEdge(attrs, ln);
  return {
    kind,
    w,
    ...(h !== undefined ? { h } : {}),
    at,
    ...(edge ? { edge } : {}),
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
