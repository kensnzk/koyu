// koyu — 平面図の生成
//
// **ここに形の規則は一つも無い。**壁の厚みも、開口の位置も、扉の吊元も、階段がどこで
// 切れるかも、`derive(model)` が返す `Form` に既に入っている (ADR-0040)。この頁が持つのは
// 色・線種・線幅・書体・記号・注記の言葉・縮尺・紙面の余白 — すべて**見た目**であり、
// 消費者ごとに違ってよいものである (docs/reference/scope.md)。
//
// 形と見た目の線引きはこうである。境界線分の座標・壁の厚み・開口で割られた区間・
// 扉の軌跡の中心と半径と掃き方向・切断面を跨ぐ位置は Form が持つ。1/4円を破線で描くか、
// 切断線を平行な二本の斜線として引くか、矢印に "UP" と書くかは、ここが決める。

import { band, derive, type PlanEntity } from "../core/derive.js";
import { canonicalBoundaryOrder, displayName, polyBounds, type Model, type Pt } from "../core/model.js";
import { slopeText } from "../core/vertical.js";
import { esc, Extent, FAINT, GRID, INK, openSheet, PAPER, ROOM } from "./sheet.js";

export interface PlanOptions {
  level?: string;
  /** px per mm */
  scale?: number;
  /** 切断面の高さ mm (FLから) — **形を決める引数**なので Form の入力へ渡る */
  cut?: number;
}

export function svgPlan(model: Model, opts: PlanOptions = {}): string {
  const level = opts.level ?? Object.keys(model.levels)[0];
  if (!level) throw new Error("No level is defined");
  const scale = opts.scale ?? 0.05;

  const form = derive(model, opts.cut !== undefined ? { cut: opts.cut } : {});
  const plan = form.plans.find((p) => p.level === level);
  const rooms = form.spaces.filter((s) => s.level === level);
  if (!plan || rooms.length === 0) {
    throw new Error(`There is no space with a region on level ${level}`);
  }

  // 敷地形状 (ADR-0011) は最下階の平面 (配置図兼用) に敷地境界線として描く — 紙面の構成の判断
  const lowest = form.levels[0]?.name;
  const sitePolys = level === lowest ? form.site : [];

  // 紙面の外接範囲。**書かれた割付も含める** — 切られた形より外へ割付がはみ出しても紙に載る
  const modelRooms = [...model.spaces.values()].filter((s) => s.rects.length > 0 && s.level === level);
  const allRects = modelRooms.flatMap((s) => s.rects);
  const polyPts = [...sitePolys.flatMap((p) => p.points), ...rooms.flatMap((s) => s.outline.flat())];
  // **畳んで取る** (Extent) — 引数を展開すると、大きな階では点の数がスタックの限界に当たる
  const ext = new Extent();
  for (const r of allRects) {
    ext.see(r.x1, r.y1);
    ext.see(r.x2, r.y2);
  }
  for (const p of polyPts) ext.see(p.x, p.y);
  const minX = ext.min0;
  const maxX = ext.max0;
  const minY = ext.min1;
  const maxY = ext.max1;

  const M = 84; // 余白 px (通り芯記号ぶん)
  const W = (maxX - minX) * scale + M * 2;
  const H = (maxY - minY) * scale + M * 2;
  const sx = (x: number) => (x - minX) * scale + M;
  const sy = (y: number) => (maxY - y) * scale + M;
  const path2d = (poly: Pt[]): string =>
    poly.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ") + " Z";
  const line = (g: { x1: number; y1: number; x2: number; y2: number }, stroke: string, w: number, dash = "") =>
    `<line x1="${sx(g.x1)}" y1="${sy(g.y1)}" x2="${sx(g.x2)}" y2="${sy(g.y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  const fill = (poly: Pt[], c: string) => `<path d="${path2d(poly)}" fill="${c}"/>`;

  const parts: string[] = openSheet(W, H);

  // 敷地境界線 (一点二点鎖線 — 作図慣習)。所与の形をそのまま引く
  for (const poly of sitePolys) {
    parts.push(
      `<path d="${path2d(poly.points)}" fill="none" stroke="#8a8171" stroke-width="1.1" stroke-dasharray="14 3 2.5 3 2.5 3"/>`,
    );
  }

  // 空間の面 — 切断面が気積を切った姿。同色・輪郭なしなのでL字も切られた形も一体に見える。
  // 半屋外は淡く塗り分け、屋外であることが図から読めるように
  for (const s of rooms) {
    const isVoid = s.void;
    for (const poly of s.outline) {
      parts.push(fill(poly, isVoid ? PAPER : s.semiOutdoor ? "#f8f5ec" : ROOM));
      if (isVoid) {
        // 吹抜け: 破線の対角線 (作図慣習)
        const r = polyBounds(poly);
        parts.push(
          line({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 }, FAINT, 0.8, "6 4"),
          line({ x1: r.x1, y1: r.y2, x2: r.x2, y2: r.y1 }, FAINT, 0.8, "6 4"),
        );
      }
    }
  }

  // 数えない分節 (area): 床材の切替など。書かれた与件をそのまま引く — 導出ではない
  for (const s of modelRooms) {
    for (const a of s.areas) {
      const r = a.rect;
      parts.push(
        `<rect x="${sx(r.x1)}" y="${sy(r.y2)}" width="${(r.x2 - r.x1) * scale}" height="${(r.y2 - r.y1) * scale}" fill="#e7dfcc" fill-opacity="0.55" stroke="${FAINT}" stroke-width="0.8" stroke-dasharray="4 3"/>`,
      );
      const label = [a.attrs["name"], a.attrs["floor"]]
        .filter((v): v is string => typeof v === "string")
        .join(" · ");
      if (label) {
        parts.push(
          `<text x="${sx(r.x1) + 6}" y="${sy(r.y2) + 12}" font-size="8.5" fill="#8a8171">${esc(label)}</text>`,
        );
      }
    }
  }

  // 通り芯 (与件)
  for (const [i, x] of model.grid.X.coords.entries()) {
    if (x < minX - 1 || x > maxX + 1) continue;
    parts.push(
      `<line x1="${sx(x)}" y1="${M - 26}" x2="${sx(x)}" y2="${H - M + 26}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${sx(x)}" cy="${M - 40}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${sx(x)}" y="${M - 36}" text-anchor="middle" font-size="10" fill="${GRID}">${model.grid.X.names[i]!}</text>`,
    );
  }
  for (const [i, y] of model.grid.Y.coords.entries()) {
    if (y < minY - 1 || y > maxY + 1) continue;
    parts.push(
      `<line x1="${M - 26}" y1="${sy(y)}" x2="${W - M + 26}" y2="${sy(y)}" stroke="${GRID}" stroke-width="0.8" stroke-dasharray="7 3 1.5 3"/>`,
      `<circle cx="${M - 40}" cy="${sy(y)}" r="11" fill="none" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${M - 40}" y="${sy(y) + 3.5}" text-anchor="middle" font-size="10" fill="${GRID}">${model.grid.Y.names[i]!}</text>`,
    );
  }

  // 壁 — Form が返す「開口で割られた区間」をそのまま塗る。
  // **欠き取り (紙の色で塗り潰して穴に見せる手) は無い** — 壁は最初から穴の空いた列である
  const byRef = new Map(form.boundaries.map((b) => [b.ref, b]));
  for (const e of plan.entities) {
    if (e.of !== "boundary") continue;
    const b = byRef.get(e.ref);
    if (!e.polygon) {
      // 物を持たない境界 (open): 構成の線として破線で示す (基本計画の抽象度)
      for (const g of e.lines ?? []) parts.push(line(g, FAINT, 1, "6 4"));
      continue;
    }
    if (e.class === "above") continue; // 垂れ壁は切断面より上 — 平面には出ない
    if (b?.air) {
      // 遮蔽しない物 (手すり・柵): 細実線 — 「囲われていない」ことが図から読めるように。
      // 切断面より上でも下でも一本の線で描く (厚みを持たない作図表現)。
      // **芯線は Form が持つ** — 足あとの四辺形から復元しない
      for (const g of e.lines ?? []) parts.push(line(g, INK, 1.4));
      continue;
    }
    // 切断面が切った区間だけを黒帯にする。腰壁 (class:below) は開口の下なので描かない —
    // **これが「欠き取り」の代わりである**。紙の色で塗り潰す操作はもう無い
    if (e.class === "cut") parts.push(fill(e.polygon, INK));
  }

  // 数えない分節 (seg): 壁材が途中から変わる区間 — 色調を変えて示す。
  // 帯の形は core の構成子が起こす。ここから引くのは注記の言葉 (`spec`) だけで、
  // それは形ではないので Form には載らない — 添字は宣言の並びの位置 = seg の同一性である
  const ordered = canonicalBoundaryOrder(model);
  for (const g of form.segs) {
    if (g.level !== level) continue;
    parts.push(fill(band(g.segment, g.cx, g.cy, g.w, g.t), "#77716a"));
    // `g.boundary` は **Form の境界の添字 = 正準順の添字**である (docs/reference/form/index.md)。
    // 宣言順の配列を引くと、宣言順を入れ替えただけで注記が別の境界のものになる
    const spec = ordered[g.boundary]?.segs[g.index]?.attrs["spec"];
    if (typeof spec === "string") {
      const h = g.segment.horizontal;
      parts.push(
        `<text x="${sx(g.cx) + (h ? 0 : 8)}" y="${sy(g.cy) + (h ? -7 : 3)}" text-anchor="${h ? "middle" : "start"}" font-size="8" fill="#77716a">${esc(spec)}</text>`,
      );
    }
  }

  // 開口 — 窓は芯線一本、扉は葉と軌跡 (1/4円の破線)
  const openings = new Map(form.openings.map((o) => [o.ref, o]));
  for (const e of plan.entities) {
    if (e.of !== "opening") continue;
    const o = openings.get(e.ref);
    if (!o) continue;
    if (e.class === "swing") {
      if (o.sliding) {
        // 引戸・自動ドア: 開き軌跡ではなく吊元側の控え (戸袋側) にパネルを描く
        const off = 110; // 壁面からの控え mm (作図表現)
        const sw = o.swing!;
        const ux = (sw.leaf.x - sw.hinge.x) / o.w;
        const uy = (sw.leaf.y - sw.hinge.y) / o.w;
        const ax = (sw.jamb.x - sw.hinge.x) / o.w;
        const ay = (sw.jamb.y - sw.hinge.y) / o.w;
        const s1 = { x: sw.hinge.x - ax * o.w + ux * off, y: sw.hinge.y - ay * o.w + uy * off };
        const s2 = { x: sw.hinge.x + ux * off, y: sw.hinge.y + uy * off };
        parts.push(
          line({ x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }, INK, 2),
          line({ x1: s2.x, y1: s2.y, x2: sw.hinge.x, y2: sw.hinge.y }, INK, 0.7),
        );
        continue;
      }
      if (e.lines) for (const g of e.lines) parts.push(line(g, INK, 1.4));
      if (e.arc) {
        const r = e.arc.r * scale;
        // 掃引方向: 世界の反時計回りは、y を反転した紙の上では時計回りになる
        const sweep = e.arc.ccw ? 0 : 1;
        parts.push(
          `<path d="M ${sx(e.arc.from.x)} ${sy(e.arc.from.y)} A ${r} ${r} 0 0 ${sweep} ${sx(e.arc.to.x)} ${sy(e.arc.to.y)}" fill="none" stroke="${INK}" stroke-width="0.7" stroke-dasharray="3 2.5"/>`,
        );
      }
      continue;
    }
    if (o.kind !== "door" && e.lines) {
      // 窓: 芯線一本
      for (const g of e.lines) parts.push(line(g, INK, 1));
    }
  }

  // 柱 (ADR-0023) — 位置はどこにも書かれていない。通り芯の交点と床の交わりから現れる
  for (const e of plan.entities) {
    if (e.of === "column" && e.polygon) parts.push(fill(e.polygon, INK));
  }

  // 縦動線 (ADR-0021) — そのレベルで切った姿。上る走りは切断線で切れ、
  // その先には下りる走り (下階の走りを上から見たもの) が現れる
  const runs = new Map(form.runs.map((r) => [r.path, r]));
  for (const e of plan.entities) {
    if (e.of !== "run") continue;
    if (e.role === "outline") for (const g of e.lines ?? []) parts.push(line(g, INK, 1.1));
    else if (e.role === "tread") for (const g of e.lines ?? []) parts.push(line(g, INK, 0.7));
    else if (e.role === "break") for (const g of e.lines ?? []) parts.push(...breakMark(g, line));
    else if (e.role === "arrow") parts.push(...arrow(e, line, sx, sy));
    else if (e.class === "anchor" && e.anchor) {
      const r = runs.get(e.ref);
      if (!r) continue;
      const text =
        r.device === "stair"
          ? `${r.risers}段 蹴上${Math.round(r.riser)}/踏面${Math.round(r.tread)}`
          : `${r.lanes > 1 ? `${r.lanes}台 ` : ""}勾配 ${slopeText(r.slope)}`;
      parts.push(
        `<text x="${sx(e.anchor.x)}" y="${sy(e.anchor.y) + 42}" text-anchor="middle" font-size="8" fill="#8a8171">${esc(text)}</text>`,
      );
    }
  }

  // 空間ラベル (最大の凸片の中心に置く)
  for (const s of rooms) {
    const space = model.spaces.get(s.path)!;
    const poly = [...s.outline].sort((a, b) => polyArea(b) - polyArea(a))[0]!;
    const r = polyBounds(poly);
    const cx = sx((r.x1 + r.x2) / 2);
    const cy = sy((r.y1 + r.y2) / 2);
    const sub =
      s.void
        ? "void"
        : `${s.type ? `${esc(s.type)} · ` : ""}${s.areaM2} m2${s.semiOutdoor ? " · semi-outdoor" : ""}`;
    parts.push(
      `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" fill="${INK}">${esc(displayName(space))}</text>`,
      `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="10" fill="#8a8171">${sub}</text>`,
      `<text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="8.5" fill="${FAINT}">${esc(s.path)}</text>`,
    );
  }

  // 切断面より上のものの投影 (上部吹抜け — 作図慣習)
  for (const e of plan.entities) {
    if (e.class !== "above" || e.of !== "space" || !e.polygon) continue;
    const r = polyBounds(e.polygon);
    parts.push(
      `<path d="${path2d(e.polygon)}" fill="none" stroke="${FAINT}" stroke-width="0.8" stroke-dasharray="6 4"/>`,
      `<text x="${sx((r.x1 + r.x2) / 2)}" y="${sy((r.y1 + r.y2) / 2) + 40}" text-anchor="middle" font-size="9" fill="${FAINT}">void above</text>`,
    );
  }

  // 北矢印 (ADR-0057) — azimuth が書かれているときだけ描く。**表現であって形ではない**ので
  // Form には無く、紙の座標に直接置く。これがある理由は装飾ではない — 方位の 180度違い・
  // 余角違い・磁北の書き写しは、どれも範囲内の整った数として通る。**絵だけが捕まえる。**
  //
  // 画面上の北: モデルの +Y は上、+X は右。真方位角は +Y から時計回りなので、画面でも時計回り
  if (model.azimuth) {
    const rad = (model.azimuth.deg * Math.PI) / 180;
    const nx = Math.sin(rad);
    const ny = -Math.cos(rad);
    const cx = W - M / 2; // 右余白の中央 (通り芯記号と同じ帯に、離して置く)
    const cy = M / 2;
    const R = 21;
    const px = -ny; // 軸に直交する向き (矢羽根の底辺)
    const py = nx;
    const r2 = (n: number): string => String(Math.round(n * 100) / 100);
    const head = [
      [cx + nx * R, cy + ny * R],
      [cx + nx * R * 0.42 + px * 4.6, cy + ny * R * 0.42 + py * 4.6],
      [cx + nx * R * 0.42 - px * 4.6, cy + ny * R * 0.42 - py * 4.6],
    ]
      .map(([x, y]) => `${r2(x!)},${r2(y!)}`)
      .join(" ");
    parts.push(
      `<g class="north-arrow">`,
      `<line x1="${r2(cx - nx * R * 0.8)}" y1="${r2(cy - ny * R * 0.8)}" x2="${r2(cx + nx * R)}" y2="${r2(cy + ny * R)}" stroke="${INK}" stroke-width="1"/>`,
      `<polygon points="${head}" fill="${INK}"/>`,
      `<text x="${r2(cx + nx * (R + 10))}" y="${r2(cy + ny * (R + 10) + 3.4)}" text-anchor="middle" font-size="9" fill="${INK}">N</text>`,
      `</g>`,
    );
  }

  // 表題
  const title = `${model.name ?? "Untitled"} — ${level} plan`;
  parts.push(`<text x="${M - 62}" y="${H - 18}" font-size="12" fill="${INK}">${esc(title)}</text>`);

  parts.push("</svg>");
  return parts.join("\n") + "\n";
}

type Line = (
  g: { x1: number; y1: number; x2: number; y2: number },
  stroke: string,
  w: number,
  dash?: string,
) => string;

/**
 * 切断線 — 作図慣習の平行な二本の斜線。Form が持つのは「走りを横切る切断の位置」だけで、
 * 二本にすることも振り分けの寸法も、ここが決める見た目である
 */
function breakMark(g: { x1: number; y1: number; x2: number; y2: number }, line: Line): string[] {
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const width = Math.hypot(dx, dy) || 1;
  // 走る向き (切断線に直交する単位ベクトル)
  const tx = dy / width;
  const ty = -dx / width;
  const s = Math.min(300, width / 4);
  const off = Math.min(220, s);
  const at = (k: number, l: number) => ({
    x1: g.x1 + tx * (k),
    y1: g.y1 + ty * (k),
    x2: g.x2 + tx * (l),
    y2: g.y2 + ty * (l),
  });
  return [line(at(-s - off, s - off), INK, 1.4), line(at(-s + off, s + off), INK, 1.4)];
}

/** 矢印 — 三角の頭と "UP"/"DN" の言葉は、どちらも見た目である */
function arrow(
  e: PlanEntity,
  line: Line,
  sx: (x: number) => number,
  sy: (y: number) => number,
): string[] {
  const g = e.lines?.[0];
  if (!g) return [];
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const len = Math.hypot(dx, dy) || 1;
  const hx = (dx / len) * 420;
  const hy = (dy / len) * 420;
  const px = (-dy / len) * 200;
  const py = (dx / len) * 200;
  return [
    line(g, INK, 1),
    `<path d="M ${sx(g.x2)} ${sy(g.y2)} L ${sx(g.x2 - hx + px)} ${sy(g.y2 - hy + py)} L ${sx(g.x2 - hx - px)} ${sy(g.y2 - hy - py)} Z" fill="${INK}"/>`,
    `<text x="${sx(g.x1) + 4}" y="${sy(g.y1) + 4}" font-size="9" fill="${INK}">${e.anchor?.up ? "UP" : "DN"}</text>`,
  ];
}

function polyArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

