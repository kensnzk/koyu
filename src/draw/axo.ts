// koyu — the axonometric (ADR-0026)
// A plan is "the section cut at that level"; this is the solid itself, projected. It needs neither
// WebGL nor a runtime — the text of an SVG comes out, exactly as it does for a plan, so a solid is
// checked by the same move: generate it and look.
//
// **Only what is generated is drawn.** Floors and roofs, walls (from the boundaries), columns
// (from the grid intersections), vertical circulation. None of it is in the source; all of it
// appears out of the rules.
//
// **There is not one rule of shape here** (ADR-0040). Outlines, thicknesses and z ranges are
// already in the `Form` that `derive(model)` returns, and the constructors that raise matter from
// a centre line (`columnRect` / `runPrism`) have their one implementation in core. A wall arrives
// as a body with its junctions already settled — there is no corner to repair here. What this page
// decides is the projection, the shading, the stacking order and the page.

import { columnRect, derive, runPrism } from "../core/derive.js";
import { type Model, type Pt } from "../core/model.js";

export interface AxoOptions {
  /** 見る向き — 建物のどの隅から見下ろすか (既定 SE) */
  dir?: "NE" | "NW" | "SE" | "SW";
  /** px per mm (既定 0.02) */
  scale?: number;
  /** 描くレベル (既定すべて) */
  levels?: string[];
  /** 天井も描く (既定 false — 描くと中が見えない) */
  ceilings?: boolean;
  /** 壁を描く (既定 true) */
  walls?: boolean;
}

/** 立体の一片 — 底面の輪郭と、頂点ごとの上端/下端z。箱も傾いた版もこれで足りる */
interface Prism {
  poly: Pt[];
  top: number[];
  bottom: number[];
  fill: string;
  /** 奥行きの並べ替えに使う代表点 */
  depth: number;
}

const INK = "#1f1f1f";
const PAPER = "#faf8f4";
/** 地盤面を見せる版の下端・上端 mm — 導出値ではなく紙の側の約束 */
const GROUND_Z0 = -400;
const GROUND_Z1 = -100;
const C = {
  floor: "#cfc7b6",
  roof: "#8d8577",
  ceiling: "#e2dbca",
  wall: "#b8b0a0",
  column: "#5d574d",
  run: "#7f8f8a",
  ground: "#eceadf",
};

/** 軸測図のSVG。ソースに形は無い — ここに出るものはすべて規則からの生成物である */
export function svgAxo(model: Model, opts: AxoOptions = {}): string {
  const scale = opts.scale ?? 0.02;
  const dir = opts.dir ?? "SE";

  // **形はすべて Form が持つ** (ADR-0040) — 壁の厚みも、開口で割られた区間も、
  // 柱の z 範囲も、段板の立体も。ここが決めるのは投影と陰影と紙面だけである
  const form = derive(model);
  const names = new Set(
    form.levels.filter((l) => !opts.levels || opts.levels.includes(l.name)).map((l) => l.name),
  );

  // 見る向き: 平面を90度ずつ回してから等角に落とす
  const turn = { NE: 0, NW: 1, SW: 2, SE: 3 }[dir];
  const rot = (p: Pt): Pt => {
    let { x, y } = p;
    for (let i = 0; i < turn; i++) [x, y] = [y, -x];
    return { x, y };
  };
  const K = Math.cos(Math.PI / 6);
  const S = Math.sin(Math.PI / 6);
  const proj = (p: Pt, z: number): [number, number] => {
    const q = rot(p);
    return [(q.x - q.y) * K, (q.x + q.y) * S - z];
  };
  /** 手前ほど大きい。等角の視線は (1,1,1) なので x+y+z で並べる */
  const depthOf = (p: Pt, z: number): number => {
    const q = rot(p);
    return q.x + q.y + z;
  };

  const prisms: Prism[] = [];
  const add = (poly: Pt[], bottom: number | number[], top: number | number[], fill: string) => {
    if (poly.length < 3) return;
    const b = Array.isArray(bottom) ? bottom : poly.map(() => bottom);
    const t = Array.isArray(top) ? top : poly.map(() => top);
    const cx = poly.reduce((a, p) => a + p.x, 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p.y, 0) / poly.length;
    const cz = t.reduce((a, v) => a + v, 0) / t.length;
    prisms.push({ poly, bottom: b, top: t, fill, depth: depthOf({ x: cx, y: cy }, cz) });
  };

  // ---- 敷地 (地盤面) ----
  // 地盤に厚みは導出されない (Form が持つのは所与の形だけ) ので、地面をどれだけの
  // 厚みの版として見せるかは**紙の側の判断**である
  for (const poly of form.site) add(poly.points, GROUND_Z0, GROUND_Z1, C.ground);

  // ---- 床・屋根 (ADR-0024) ----
  for (const sl of form.slabs) {
    if (!names.has(sl.level)) continue;
    if (sl.kind === "ceiling" && !opts.ceilings) continue;
    add(sl.outline, sl.z0, sl.z1, sl.kind === "roof" ? C.roof : sl.kind === "floor" ? C.floor : C.ceiling);
  }

  // ---- 壁 (境界から生成) — **開口で割られた区間として立つ** ----
  if (opts.walls !== false) {
    for (const b of form.boundaries) {
      if (!b.material || (b.level !== undefined && !names.has(b.level))) continue;
      for (const p of b.material.panels) add(p.footprint, p.z0, p.z1, C.wall);
    }
  }

  // ---- 柱 (ADR-0023) ----
  for (const c of form.columns) {
    if (!names.has(c.level)) continue;
    add(columnRect(c), c.z0, c.z1, C.column);
  }

  // ---- 縦動線 (ADR-0021) — 段は段として、斜路は傾いた版として ----
  for (const run of form.runs) {
    if (!names.has(run.level)) continue;
    for (const s of run.solids) {
      const pr = runPrism(s);
      add(pr.poly, pr.bottom, pr.top, C.run);
    }
  }

  if (prisms.length === 0) throw new Error("There is nothing to draw");

  // ---- 投影して奥から描く (画家のアルゴリズム) ----
  prisms.sort((a, b) => a.depth - b.depth);
  // **外接範囲は畳んで取る。**Math.min(...pts) は引数の数がスタックの限界に当たる —
  // 開口で割られた壁は区間ごとに一片なので、大きな例では十万点を超える
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const see = (p: [number, number]): void => {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  };
  for (const pr of prisms) {
    for (let i = 0; i < pr.poly.length; i++) {
      see(proj(pr.poly[i]!, pr.top[i]!));
      see(proj(pr.poly[i]!, pr.bottom[i]!));
    }
  }
  const M = 40;
  const W = (maxX - minX) * scale + M * 2;
  const H = (maxY - minY) * scale + M * 2;
  const sx = (v: number) => (v - minX) * scale + M;
  const sy = (v: number) => (v - minY) * scale + M;

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">`,
    `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,
  ];
  const face = (ring: Array<[number, number]>, fill: string, shade: number) => {
    const d = ring.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${r2(sx(x))} ${r2(sy(y))}`).join(" ");
    return `<path d="${d} Z" fill="${tint(fill, shade)}" stroke="${INK}" stroke-width="0.35" stroke-opacity="0.5"/>`;
  };
  for (const pr of prisms) {
    const n = pr.poly.length;
    // **底面から描く。**箱を「上面+側面」だけで作ると底の無い箱になり、
    // 下から覗ける所 (-l で階を絞った最下段・外へ張り出した柱) で中が見える。
    // 塗り重ね順で先に置けば、隠れているときは側面と上面が覆う
    const bottom = pr.poly.map((p, i) => proj(p, pr.bottom[i]!));
    out.push(face([...bottom].reverse(), pr.fill, 0.55));
    // 側面: 投影して時計回り (面積が負) のものだけが手前を向く
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const quad: Array<[number, number]> = [
        proj(pr.poly[i]!, pr.top[i]!),
        proj(pr.poly[j]!, pr.top[j]!),
        proj(pr.poly[j]!, pr.bottom[j]!),
        proj(pr.poly[i]!, pr.bottom[i]!),
      ];
      if (signedArea(quad) <= 0) continue;
      // 面の向きで陰影を変える (東西面と南北面)
      const dx = pr.poly[j]!.x - pr.poly[i]!.x;
      const dy = pr.poly[j]!.y - pr.poly[i]!.y;
      out.push(face(quad, pr.fill, Math.abs(dx) > Math.abs(dy) ? 0.82 : 0.68));
    }
    const top = pr.poly.map((p, i) => proj(p, pr.top[i]!));
    out.push(face(top, pr.fill, 1));
  }
  out.push(
    `<text x="${M - 24}" y="${H - 12}" font-size="11" fill="${INK}">${esc(model.name ?? "Untitled")} — axonometric (from ${dir})</text>`,
    `<text x="${W - M + 24}" y="${H - 12}" text-anchor="end" font-size="8.5" fill="#a49b8a">koyu — generated from spaces (floors, roofs, walls, columns, vertical circulation)</text>`,
    "</svg>",
  );
  return out.join("\n") + "\n";
}

function signedArea(ring: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** 面の向きによる陰影 */
function tint(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * k)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
