// koyu v0 — 平面図の生成
// ソースに形は無い。形は必要になった時にルールから生成する。まず平面図、その後に三次元。
// 壁は「二つの空間の境界」から導かれて現れる — 壁を描く操作はどこにも無い。

import { placeBand, placeOpening, segmentsFor, type Segment } from "./graph.js";
import {
  areaM2,
  displayName,
  isSemiOutdoor,
  type Boundary,
  type Model,
  type Opening,
} from "./model.js";

export interface PlanOptions {
  level?: string;
  /** px per mm */
  scale?: number;
}

const WALL_DEFAULT_T = 100;
const INK = "#1f1f1f";
const PAPER = "#faf8f4";
const ROOM = "#f1ebdd";
const GRID = "#b5aa94";

export function svgPlan(model: Model, opts: PlanOptions = {}): string {
  const level = opts.level ?? Object.keys(model.levels)[0];
  if (!level) throw new Error("レベルが定義されていません");
  const scale = opts.scale ?? 0.05;

  const rooms = [...model.spaces.values()].filter(
    (s) => s.rects.length > 0 && s.level === level,
  );
  if (rooms.length === 0) throw new Error(`レベル ${level} に領域を持つ空間がありません`);

  const allRects = rooms.flatMap((s) => s.rects);
  const minX = Math.min(...allRects.map((r) => r.x1));
  const maxX = Math.max(...allRects.map((r) => r.x2));
  const minY = Math.min(...allRects.map((r) => r.y1));
  const maxY = Math.max(...allRects.map((r) => r.y2));

  const M = 84; // 余白 px (通り芯記号ぶん)
  const W = (maxX - minX) * scale + M * 2;
  const H = (maxY - minY) * scale + M * 2;
  const sx = (x: number) => (x - minX) * scale + M;
  const sy = (y: number) => (maxY - y) * scale + M;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`);

  // 空間の面 (合併の各矩形。同色・輪郭なしなのでL字は一体に見える)
  // 半屋外 (外部にopen/railで接する空間) は淡く塗り分け、屋外であることが図から読めるように
  for (const s of rooms) {
    const isVoid = s.type === "void";
    const semi = isSemiOutdoor(model, s);
    for (const r of s.rects) {
      parts.push(
        `<rect x="${sx(r.x1)}" y="${sy(r.y2)}" width="${(r.x2 - r.x1) * scale}" height="${(r.y2 - r.y1) * scale}" fill="${isVoid ? PAPER : semi ? "#f8f5ec" : ROOM}"/>`,
      );
      if (isVoid) {
        // 吹抜け: 破線の対角線 (作図慣習)
        parts.push(
          `<line x1="${sx(r.x1)}" y1="${sy(r.y1)}" x2="${sx(r.x2)}" y2="${sy(r.y2)}" stroke="#b3ab9c" stroke-width="0.8" stroke-dasharray="6 4"/>`,
          `<line x1="${sx(r.x1)}" y1="${sy(r.y2)}" x2="${sx(r.x2)}" y2="${sy(r.y1)}" stroke="#b3ab9c" stroke-width="0.8" stroke-dasharray="6 4"/>`,
        );
      }
    }
  }

  // 数えない分節 (area): 床材の切替など。面積にもグラフにも現れない — 淡い面と破線で示す
  for (const s of rooms) {
    for (const a of s.areas) {
      const r = a.rect;
      parts.push(
        `<rect x="${sx(r.x1)}" y="${sy(r.y2)}" width="${(r.x2 - r.x1) * scale}" height="${(r.y2 - r.y1) * scale}" fill="#e7dfcc" fill-opacity="0.55" stroke="#b3ab9c" stroke-width="0.8" stroke-dasharray="4 3"/>`,
      );
      const label = [a.attrs["name"], a.attrs["floor"]]
        .filter((v): v is string => typeof v === "string")
        .join(" ・ ");
      if (label) {
        parts.push(
          `<text x="${sx(r.x1) + 6}" y="${sy(r.y2) + 12}" font-size="8.5" fill="#8a8171">${esc(label)}</text>`,
        );
      }
    }
  }

  // 通り芯
  for (const [i, x] of model.grid.X.coords.entries()) {
    if (x < minX - 1 || x > maxX + 1) continue;
    const name = model.grid.X.names[i]!;
    parts.push(
      `<line x1="${sx(x)}" y1="${M - 26}" x2="${sx(x)}" y2="${H - M + 26}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${sx(x)}" cy="${M - 40}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${sx(x)}" y="${M - 36}" text-anchor="middle" font-size="10" fill="${GRID}">${name}</text>`,
    );
  }
  for (const [i, y] of model.grid.Y.coords.entries()) {
    if (y < minY - 1 || y > maxY + 1) continue;
    const name = model.grid.Y.names[i]!;
    parts.push(
      `<line x1="${M - 26}" y1="${sy(y)}" x2="${W - M + 26}" y2="${sy(y)}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${M - 40}" cy="${sy(y)}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${M - 40}" y="${sy(y) + 3.5}" text-anchor="middle" font-size="10" fill="${GRID}">${name}</text>`,
    );
  }

  // 壁 (境界から生成)。このレベルに触れる境界だけを描く
  const placedOpenings: Array<{ b: Boundary; o: Opening; seg: Segment; cx: number; cy: number }> = [];
  for (const b of model.boundaries) {
    const onLevel = [b.a, b.b].some((p) => model.spaces.get(p)?.level === level);
    if (!onLevel) continue;
    if (b.kind === "open") {
      // 開放的な分節: 壁は無いが構成の線として破線で示す (基本計画の抽象度)
      for (const seg of segmentsFor(model, b)) {
        parts.push(
          `<line x1="${sx(seg.x1)}" y1="${sy(seg.y1)}" x2="${sx(seg.x2)}" y2="${sy(seg.y2)}" stroke="#b3ab9c" stroke-width="1" stroke-dasharray="6 4"/>`,
        );
      }
      continue;
    }
    if (b.kind !== "wall") continue;
    if (b.air) {
      // 遮蔽しない物 (手すり・柵 = spec語彙): 細実線 —
      // 壁の黒帯と描き分けることで「囲われていない」ことが図から読める
      for (const seg of segmentsFor(model, b)) {
        parts.push(
          `<line x1="${sx(seg.x1)}" y1="${sy(seg.y1)}" x2="${sx(seg.x2)}" y2="${sy(seg.y2)}" stroke="${INK}" stroke-width="1.4"/>`,
        );
      }
      // 柵の扉 (門扉など): 線を切って軌跡を描く
      for (const o of b.openings) {
        if (o.kind !== "door") continue;
        const placed = placeOpening(model, b, o);
        if (!("error" in placed)) {
          parts.push(bandRect(placed.segment, o.w, placed.cx, placed.cy, 120, scale, sx, sy, PAPER));
          parts.push(doorSwing(model, b, o, placed.segment, placed.cx, placed.cy, scale, sx, sy));
        }
      }
      continue;
    }
    const t = b.t ?? WALL_DEFAULT_T;
    for (const seg of segmentsFor(model, b)) {
      parts.push(wallRect(seg, t, scale, sx, sy));
    }
    // 数えない分節 (seg): 壁材が途中から変わる区間 — 色調を変えて示す
    for (const g of b.segs) {
      const placed = placeBand(model, b, g, "seg");
      if (!("error" in placed)) {
        parts.push(bandRect(placed.segment, g.w, placed.cx, placed.cy, t, scale, sx, sy, "#77716a"));
        const spec = g.attrs["spec"];
        if (typeof spec === "string") {
          const horizontal = placed.segment.horizontal;
          parts.push(
            `<text x="${sx(placed.cx) + (horizontal ? 0 : 8)}" y="${sy(placed.cy) + (horizontal ? -7 : 3)}" text-anchor="${horizontal ? "middle" : "start"}" font-size="8" fill="#77716a">${esc(spec)}</text>`,
          );
        }
      }
    }
    for (const o of b.openings) {
      const placed = placeOpening(model, b, o);
      if (!("error" in placed && placed.error) && "segment" in placed) {
        placedOpenings.push({ b, o, seg: placed.segment, cx: placed.cx, cy: placed.cy });
      }
    }
  }

  // 開口 (壁を欠き取り、扉は吊元と軌跡を描く)
  for (const { b, o, seg, cx, cy } of placedOpenings) {
    const t = (b.t ?? WALL_DEFAULT_T) + 30; // 欠き取りは少し深く
    parts.push(bandRect(seg, o.w, cx, cy, t, scale, sx, sy, PAPER));
    if (o.kind === "door") {
      parts.push(doorSwing(model, b, o, seg, cx, cy, scale, sx, sy));
    } else {
      // 窓: 芯線一本
      const wpx = o.w * scale;
      if (seg.horizontal) {
        parts.push(
          `<line x1="${sx(cx) - wpx / 2}" y1="${sy(cy)}" x2="${sx(cx) + wpx / 2}" y2="${sy(cy)}" stroke="${INK}" stroke-width="1"/>`,
        );
      } else {
        parts.push(
          `<line x1="${sx(cx)}" y1="${sy(cy) - wpx / 2}" x2="${sx(cx)}" y2="${sy(cy) + wpx / 2}" stroke="${INK}" stroke-width="1"/>`,
        );
      }
    }
  }

  // 空間ラベル (最大の矩形の中心に置く)
  for (const s of rooms) {
    const r = [...s.rects].sort(
      (a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1),
    )[0]!;
    const cx = sx((r.x1 + r.x2) / 2);
    const cy = sy((r.y1 + r.y2) / 2);
    const sub =
      s.type === "void"
        ? "吹抜け"
        : `${esc(s.type)} ・ ${areaM2(s)}㎡${isSemiOutdoor(model, s) ? " ・ 半屋外" : ""}`;
    parts.push(
      `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" fill="${INK}">${esc(displayName(s))}</text>`,
      `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="#8a8171">${sub}</text>`,
      `<text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="8.5" fill="#b3ab9c">${esc(s.path)}</text>`,
    );
  }

  // 下階の平面への「上部吹抜け」表示 (作図慣習)
  for (const b of model.boundaries) {
    if (b.kind !== "void") continue;
    const sa = model.spaces.get(b.a);
    const sb = model.spaces.get(b.b);
    if (!sa?.level || !sb?.level) continue;
    const za = model.levels[sa.level]?.z;
    const zb = model.levels[sb.level]?.z;
    if (za === undefined || zb === undefined) continue;
    const lower = za < zb ? sa : sb;
    const upper = za < zb ? sb : sa;
    if (lower.level !== level) continue;
    for (const r of upper.rects) {
      parts.push(
        `<rect x="${sx(r.x1)}" y="${sy(r.y2)}" width="${(r.x2 - r.x1) * scale}" height="${(r.y2 - r.y1) * scale}" fill="none" stroke="#b3ab9c" stroke-width="0.8" stroke-dasharray="6 4"/>`,
        `<text x="${sx((r.x1 + r.x2) / 2)}" y="${sy((r.y1 + r.y2) / 2) + 40}" text-anchor="middle" font-size="9" fill="#b3ab9c">上部吹抜け</text>`,
      );
    }
  }

  // 表題
  const title = `${model.name ?? "無題"} — ${level} 平面`;
  parts.push(
    `<text x="${M - 62}" y="${H - 18}" font-size="12" fill="${INK}">${esc(title)}</text>`,
    `<text x="${W - M + 62}" y="${H - 18}" text-anchor="end" font-size="9" fill="#a49b8a">koyu v0 — 空間から生成 (壁芯・mm)</text>`,
  );

  parts.push("</svg>");
  return parts.join("\n") + "\n";
}

function wallRect(
  seg: Segment,
  t: number,
  scale: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
): string {
  if (seg.horizontal) {
    const x = sx(seg.x1);
    const y = sy(seg.y1 + t / 2);
    return `<rect x="${x}" y="${y}" width="${(seg.x2 - seg.x1) * scale}" height="${t * scale}" fill="${INK}"/>`;
  }
  const x = sx(seg.x1 - t / 2);
  const y = sy(seg.y2);
  return `<rect x="${x}" y="${y}" width="${t * scale}" height="${(seg.y2 - seg.y1) * scale}" fill="${INK}"/>`;
}

function bandRect(
  seg: Segment,
  w: number,
  cx: number,
  cy: number,
  t: number,
  scale: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
  fill: string,
): string {
  if (seg.horizontal) {
    return `<rect x="${sx(cx - w / 2)}" y="${sy(cy + t / 2)}" width="${w * scale}" height="${t * scale}" fill="${fill}"/>`;
  }
  return `<rect x="${sx(cx + t / 2 - t)}" y="${sy(cy + w / 2)}" width="${t * scale}" height="${w * scale}" fill="${fill}"/>`;
}

/** 扉: 吊元から開いた軌跡 (1/4円)。吊り込み側は「先に書いた空間」= boundary.a 側 */
function doorSwing(
  model: Model,
  b: Boundary,
  o: Opening,
  seg: Segment,
  cx: number,
  cy: number,
  scale: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
): string {
  // 開く側の空間: swing:a/b の指定、既定はa側 (領域を持つ方)。合併なら扉に最も近い矩形へ開く
  const sa = model.spaces.get(b.a);
  const sb = model.spaces.get(b.b);
  let into: typeof sa;
  if (o.swing === "a") into = sa;
  else if (o.swing === "b") into = sb;
  else into = sa && sa.rects.length > 0 ? sa : sb;
  if (!into || into.rects.length === 0) return "";
  const dist = (rc: { x1: number; y1: number; x2: number; y2: number }) =>
    ((rc.x1 + rc.x2) / 2 - cx) ** 2 + ((rc.y1 + rc.y2) / 2 - cy) ** 2;
  const r = [...into.rects].sort((p, q) => dist(p) - dist(q))[0]!;
  const c = { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };

  // 世界座標: 吊元 hinge (hinge:W/E/S/N — 既定は始端側)、軌跡は hinge を中心とする1/4円
  let hinge: { x: number; y: number };
  let along: { x: number; y: number };
  let inward: { x: number; y: number };
  if (seg.horizontal) {
    const fromEast = o.hinge === "E";
    hinge = { x: fromEast ? cx + o.w / 2 : cx - o.w / 2, y: cy };
    along = { x: fromEast ? -1 : 1, y: 0 };
    inward = { x: 0, y: c.y > cy ? 1 : -1 };
  } else {
    const fromNorth = o.hinge === "N";
    hinge = { x: cx, y: fromNorth ? cy + o.w / 2 : cy - o.w / 2 };
    along = { x: 0, y: fromNorth ? -1 : 1 };
    inward = { x: c.x > cx ? 1 : -1, y: 0 };
  }
  const leafEnd = { x: hinge.x + inward.x * o.w, y: hinge.y + inward.y * o.w };
  const gapEnd = { x: hinge.x + along.x * o.w, y: hinge.y + along.y * o.w };

  const p1 = { x: sx(leafEnd.x), y: sy(leafEnd.y) };
  const p2 = { x: sx(gapEnd.x), y: sy(gapEnd.y) };
  const ph = { x: sx(hinge.x), y: sy(hinge.y) };
  const rad = o.w * scale;
  // 掃引方向: 外積で決める
  const crossZ = (p1.x - ph.x) * (p2.y - ph.y) - (p1.y - ph.y) * (p2.x - ph.x);
  const sweep = crossZ > 0 ? 1 : 0;
  return (
    `<line x1="${ph.x}" y1="${ph.y}" x2="${p1.x}" y2="${p1.y}" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M ${p1.x} ${p1.y} A ${rad} ${rad} 0 0 ${sweep} ${p2.x} ${p2.y}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2.5"/>`
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
