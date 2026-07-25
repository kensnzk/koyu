// 正準性のproperty test (ADR-0013/0014) — 「同じ構成からは常にバイト同一のJSONが出る」を
// 生成した模型の並べ替えで機械的に守る。乱数は種つきLCG (再現可能)。

import assert from "node:assert/strict";
import { test } from "node:test";
import { toCanonical } from "../src/model.js";
import { parse } from "../src/parse.js";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 3×3グリッドのセルから部屋を選び、境界・開口・ゾーンを乱数で生成する。
 *  返り値は「並べ替え可能なブロック」(親行+字下げ子行) の列 */
function generateBlocks(rnd: () => number): string[][] {
  const header = [
    ["koyu 0.2"],
    ["unit mm"],
    ["grid X 0 3000 6000 9000"],
    ["grid Y 0 3000 6000 9000"],
    ["level L1 0 h:2400"],
  ];
  const cells: Array<[number, number]> = [];
  for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) if (rnd() < 0.6) cells.push([i, j]);
  if (cells.length < 2) cells.push([1, 1], [2, 1]);
  const path = ([i, j]: [number, number]) => `/L1/r${i}${j}`;
  const spaces = cells.map((c) => [
    `space ${path(c)} room X${c[0]}..X${c[0] + 1} Y${c[1]}..Y${c[1] + 1}${rnd() < 0.3 ? ` uid:sp-${c[0]}${c[1]}` : ""}`,
  ]);
  // 接する組の一部にだけ境界を宣言する (残りは既定壁 — ADR-0014)
  const bounds: string[][] = [];
  for (const a of cells) {
    for (const b of cells) {
      const adjacent =
        (a[0] === b[0] && b[1] === a[1] + 1) || (a[1] === b[1] && b[0] === a[0] + 1);
      if (!adjacent || rnd() < 0.4) continue;
      const attrs = rnd() < 0.5 ? ` t:${100 + Math.floor(rnd() * 3) * 40} spec:W${Math.floor(rnd() * 3)}` : "";
      const block = [`boundary ${path(a)} ${path(b)}${attrs}`];
      const openings = Math.floor(rnd() * 3);
      for (let k = 0; k < openings; k++) {
        const kind = rnd() < 0.6 ? "door" : "window";
        block.push(`  ${kind} w:${700 + k * 100}${kind === "window" ? " h:1200" : ""} at:0.${2 + k * 3}`);
      }
      bounds.push(block);
    }
  }
  const zones = rnd() < 0.5 ? [["zone /L1 name:全体"]] : [];
  return [...header, ...spaces, ...bounds, ...zones];
}

test("property: 宣言順・開口順の並べ替えはバイト列を変えない (種30個)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rnd = lcg(seed);
    const blocks = generateBlocks(rnd);
    const header = blocks.slice(0, 5);
    const body = blocks.slice(5);
    const render = (bs: string[][]) => bs.map((b) => b.join("\n")).join("\n");
    const original = render([...header, ...body]);
    // 並べ替え1: 本体ブロックのシャッフル
    const shuffled = render([...header, ...shuffle(body, lcg(seed * 7))]);
    // 並べ替え2: 逆順 + ブロック内の開口の逆順
    const reversed = render([
      ...header,
      ...[...body].reverse().map((b) => [b[0]!, ...b.slice(1).reverse()]),
    ]);
    const j0 = toCanonical(parse(original));
    assert.equal(toCanonical(parse(shuffled)), j0, `seed=${seed} shuffle`);
    assert.equal(toCanonical(parse(reversed)), j0, `seed=${seed} reverse`);
  }
});
