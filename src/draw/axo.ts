// koyu — 軸測図 (アクソメ) の生成 (ADR-0026)
// 平面図が「そのレベルで切った断面」であるのに対し、これは立体をそのまま投影した図である。
// WebGLも実行環境も要らない — 平面と同じく SVG のテキストが出るので、
// 生成して見る、という同じ手で立体を確かめられる。
//
// 描くのは**生成物だけ**である。床・屋根 (fabric.ts)、壁 (境界から)、柱 (通りの交点から)、
// 縦動線 (vertical.ts)。どれもソースには無く、規則から現れる。

import { slabs } from "../core/fabric.js";
import { segmentsFor, type Segment } from "../core/graph.js";
import {
  columnsFor,
  levelsSorted,
  rectToPoly,
  type Model,
  type Pt,
} from "../core/model.js";
import { runSolids, verticalRuns } from "../core/vertical.js";

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
const C = {
  floor: "#cfc7b6",
  roof: "#8d8577",
  ceiling: "#e2dbca",
  wall: "#b8b0a0",
  column: "#5d574d",
  run: "#7f8f8a",
  ground: "#eceadf",
  opening: "#f2efe6",
};

/** 軸測図のSVG。ソースに形は無い — ここに出るものはすべて規則からの生成物である */
export function svgAxo(model: Model, opts: AxoOptions = {}): string {
  const scale = opts.scale ?? 0.02;
  const dir = opts.dir ?? "SE";
  const levels = levelsSorted(model).filter(
    (l) => !opts.levels || opts.levels.includes(l.name),
  );
  const names = new Set(levels.map((l) => l.name));

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
  for (const poly of model.polygons.values()) add(poly.points, -400, -100, C.ground);

  // ---- 床・屋根 (ADR-0024) ----
  for (const sl of slabs(model)) {
    if (!names.has(sl.level)) continue;
    if (sl.kind === "ceiling" && !opts.ceilings) continue;
    add(sl.outline, sl.z0, sl.z1, sl.kind === "roof" ? C.roof : sl.kind === "floor" ? C.floor : C.ceiling);
  }

  // ---- 壁 (境界から生成) と開口 ----
  if (opts.walls !== false) {
    for (const b of model.boundaries) {
      if (b.kind !== "wall") continue;
      const sa = model.spaces.get(b.a);
      const sb = model.spaces.get(b.b);
      const room = sa && sa.rects.length > 0 ? sa : sb;
      if (!room?.level || !names.has(room.level)) continue;
      const z0 = model.levels[room.level]!.z;
      const h = pitchOf(model, room.level);
      const t = b.air ? Math.min(b.t ?? 60, 80) : (b.t ?? 100);
      const top = b.air ? z0 + (typeof b.attrs["h"] === "number" ? (b.attrs["h"] as number) : 1100) : z0 + h;
      for (const seg of segmentsFor(model, b)) add(thicken(seg, t), z0, top, C.wall);
    }
  }

  // ---- 柱 (ADR-0023) ----
  for (const l of levels) {
    const h = pitchOf(model, l.name);
    for (const c of columnsFor(model, l.name)) {
      add(
        rectToPoly({ x1: c.x - c.w / 2, y1: c.y - c.d / 2, x2: c.x + c.w / 2, y2: c.y + c.d / 2 }),
        l.z,
        l.z + h,
        C.column,
      );
    }
  }

  // ---- 縦動線 (ADR-0021) — 段は段として、斜路は傾いた版として ----
  for (const run of verticalRuns(model)) {
    if (!names.has(run.level)) continue;
    for (const s of runSolids(run)) {
      if (s.kind === "box") {
        add(rectToPoly(s.rect), s.z0, s.z1, C.run);
        continue;
      }
      // 傾いた版: 四隅の高さを走る向きに線形で振る
      const poly = rectToPoly(s.rect);
      const f = (p: Pt): number => {
        const r = s.rect;
        const u =
          s.up === "E"
            ? (p.x - r.x1) / Math.max(1, r.x2 - r.x1)
            : s.up === "W"
              ? (r.x2 - p.x) / Math.max(1, r.x2 - r.x1)
              : s.up === "N"
                ? (p.y - r.y1) / Math.max(1, r.y2 - r.y1)
                : (r.y2 - p.y) / Math.max(1, r.y2 - r.y1);
        return s.z0 + u * (s.z1 - s.z0);
      };
      add(poly, poly.map((p) => f(p) - s.t), poly.map(f), C.run);
    }
  }

  if (prisms.length === 0) throw new Error("描くものがありません");

  // ---- 投影して奥から描く (画家のアルゴリズム) ----
  prisms.sort((a, b) => a.depth - b.depth);
  const pts: Array<[number, number]> = [];
  for (const pr of prisms) {
    for (let i = 0; i < pr.poly.length; i++) {
      pts.push(proj(pr.poly[i]!, pr.top[i]!), proj(pr.poly[i]!, pr.bottom[i]!));
    }
  }
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
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
    `<text x="${M - 24}" y="${H - 12}" font-size="11" fill="${INK}">${esc(model.name ?? "無題")} — 軸測 (${dir}から)</text>`,
    `<text x="${W - M + 24}" y="${H - 12}" text-anchor="end" font-size="8.5" fill="#a49b8a">koyu — 空間から生成 (床・屋根・壁・柱・縦動線)</text>`,
    "</svg>",
  );
  return out.join("\n") + "\n";
}

/** レベルの階高 (次のレベルまで)。最上階は天井高+slabで近似 */
function pitchOf(model: Model, level: string): number {
  const l = model.levels[level]!;
  const up = Object.values(model.levels)
    .filter((o) => o.z > l.z)
    .sort((a, b) => a.z - b.z)[0];
  return up ? up.z - l.z : (l.h ?? 2400) + (l.slab ?? 0);
}

/** 壁芯線分を厚みのある四角形へ (斜めの線分もそのまま扱える) */
function thicken(seg: Segment, t: number): Pt[] {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (t / 2);
  const ny = (dx / len) * (t / 2);
  return [
    { x: seg.x1 + nx, y: seg.y1 + ny },
    { x: seg.x2 + nx, y: seg.y2 + ny },
    { x: seg.x2 - nx, y: seg.y2 - ny },
    { x: seg.x1 - nx, y: seg.y1 - ny },
  ];
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
