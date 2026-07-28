// 形の参照実装 (ADR-0040 / spec/derivation.md)。
//
// **`derive(model)` が形の唯一の入口である。**ここが縛るのは四つ。
//   1. 同梱例の `Form` のゴールデン — 返るものが変われば落ちる
//   2. `Form` が**見た目を持たない**こと (色・注記の言葉・作図の記号が一つも無い)
//   3. spec/derivation.md の定数・許容値の表と、実装の台帳が一致すること (日英とも)
//   4. 形の不変量 — 壁の区間が線分を覆い尽くす・切断高さが Form の入力である
//
// ゴールデンが落ちたときに直す先は二つしかない。形を変えたなら spec とゴールデンを
// 同じ変更で直す。変えたつもりが無いなら、その差は事故である。

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { derive, DERIVATION_CONSTANTS, levelPitch } from "../src/core/derive.js";
import { segmentLength } from "../src/core/graph.js";
import { parse } from "../src/core/parse.js";
import { TOLERANCES } from "../src/core/tolerance.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");

const EXAMPLES = [
  "examples/two-rooms.muro",
  "examples/office.muro",
  "examples/house/main.muro",
  "examples/basement/main.muro",
  "examples/tower/main.muro",
  "examples/complex/main.muro",
];

const digest = (file: string): string =>
  createHash("sha256").update(JSON.stringify(derive(parseFile(join(root, file))))).digest("hex").slice(0, 16);

// ---- 1. ゴールデン ----

/**
 * 同梱例の `Form` の指紋。**形が変われば落ちる。**
 * 座標・厚み・z 範囲・分類・並び — Form に載るものはすべてここに効く。
 */
const GOLDEN: Record<string, string> = {
  "examples/two-rooms.muro": "ae6e08bb1ea7579c",
  "examples/office.muro": "0c2e2572477c27ae",
  "examples/house/main.muro": "838a630e4ca95caf",
  "examples/basement/main.muro": "5d67ba01a2f7902f",
  "examples/tower/main.muro": "cc0b48ae4295d01f",
  "examples/complex/main.muro": "1b1c80b3e3fa3ef4",
};

test("derive: the Form of every bundled example matches its golden", () => {
  const now: Record<string, string> = {};
  for (const f of EXAMPLES) now[f] = digest(f);
  assert.deepEqual(now, GOLDEN, "the derived Form moved — fix spec/derivation.md and the golden in the same change");
});

test("derive: the Form is stable (deriving twice from the same source gives the same bytes)", () => {
  for (const f of EXAMPLES) assert.equal(digest(f), digest(f), f);
});

// ---- 2. 見た目を持たない ----

/** 同一性を運ぶキー — 原本に書かれた語 (パス・型・名) がここにだけ乗る */
const IDENTITY_KEYS = new Set([
  "a", "b", "grid", "into", "level", "name", "path", "ref", "space", "type", "upper", "device", "form", "up", "turn",
]);

function strings(v: unknown, key: string, out: Array<{ key: string; value: string }>): void {
  if (typeof v === "string") out.push({ key, value: v });
  else if (Array.isArray(v)) for (const x of v) strings(x, key, out);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) strings(x, k, out);
  }
}

test("derive: the Form carries no appearance — no colour, no annotation word, no drawing symbol", () => {
  for (const f of EXAMPLES) {
    const json = JSON.stringify(derive(parseFile(join(root, f))));
    assert.equal(/#[0-9a-fA-F]{3,8}/.test(json), false, `${f}: a colour spelling rode into the Form`);
    for (const word of ['"UP"', '"DN"', '"stroke', '"fill', '"font', '"text"', '"label"', '"dasharray']) {
      assert.equal(json.includes(word), false, `${f}: ${word} rode into the Form`);
    }
  }
});

test("derive: the only words the Form carries beyond ASCII are the identity written in the source", () => {
  const bad: string[] = [];
  for (const f of EXAMPLES) {
    const out: Array<{ key: string; value: string }> = [];
    strings(derive(parseFile(join(root, f))), "", out);
    for (const s of out) {
      if (/^[\x20-\x7e]*$/.test(s.value)) continue;
      if (IDENTITY_KEYS.has(s.key)) continue;
      bad.push(`${f}: ${s.key} = ${JSON.stringify(s.value)}`);
    }
  }
  assert.deepEqual(bad, [], `a word that is not identity rode into the Form:\n  ${bad.join("\n  ")}`);
});

// ---- 3. spec の表と実装の台帳 ----

/** マーカー直後の表から `| \`NAME\` | value |` を読む */
function tableAfter(page: string, marker: string): Record<string, number> {
  const md = read(page);
  const at = md.indexOf(marker);
  assert.ok(at >= 0, `${page}: the ${marker} marker is missing`);
  const out: Record<string, number> = {};
  let started = false;
  for (const raw of md.slice(at + marker.length).split("\n")) {
    if (!raw.startsWith("|")) {
      if (started) break;
      continue;
    }
    started = true;
    const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
    const m = /^`([A-Z_][A-Z0-9_]*)`$/.exec(cells[0] ?? "");
    if (!m) continue;
    out[m[1]!] = Number(cells[1]);
  }
  assert.ok(started, `${page}: no table follows ${marker}`);
  return out;
}

for (const page of ["spec/derivation.md", "spec/en/derivation.md"]) {
  test(`derive: the constants table in ${page} and DERIVATION_CONSTANTS agree`, () => {
    assert.deepEqual(tableAfter(page, "<!-- derivation-constants -->"), { ...DERIVATION_CONSTANTS });
  });
  test(`derive: the tolerances table in ${page} and TOLERANCES agree`, () => {
    assert.deepEqual(tableAfter(page, "<!-- tolerances -->"), { ...TOLERANCES });
  });
}

// ---- 4. 形の不変量 ----

const SRC = `koyu 1.0
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b
  door w:900
boundary /L1/a /out edge:W
  window w:1600 h:1100
`;

test("derive: the panels of a wall cover the whole segment, with exactly the openings taken out", () => {
  const form = derive(parse(SRC));
  for (const b of form.boundaries) {
    if (!b.material) continue;
    const len = segmentLength(b.segment);
    const holes = form.openings.filter((o) => o.boundary === b.boundary && o.segment === b.segment);
    // 全高の区間 + 開口の腰壁・垂れ壁 の面積の合計が、線分の立面から開口を抜いた面積に等しい
    const panelArea = b.material.panels.reduce(
      (a, p) => a + Math.hypot(p.x2 - p.x1, p.y2 - p.y1) * (p.z1 - p.z0),
      0,
    );
    const holeArea = holes.reduce(
      (a, o) => a + o.w * (Math.min(o.z1, b.material!.z1) - Math.max(o.z0, b.material!.z0)),
      0,
    );
    assert.ok(
      Math.abs(panelArea + holeArea - len * (b.material.z1 - b.material.z0)) < 1,
      `${b.ref}: the panels and the openings do not add up to the elevation of the segment`,
    );
  }
});

test("derive: the cut height is an input to the Form, and it moves what the plan classifies", () => {
  const m = parse(SRC);
  assert.equal(derive(m).input.cut, 1200);
  assert.equal(derive(m, { cut: 400 }).input.cut, 400);
  const at = (cut: number) =>
    derive(m, { cut })
      .plans.find((p) => p.level === "L1")!
      .entities.filter((e) => e.of === "opening" && e.class === "cut").length;
  // 切断面 400mm は窓 (窓台 900mm) より下 — 窓は切られず、下の見えがかりになる
  assert.ok(at(1200) > at(400), "moving the cut plane must move what is cut");
});

test("derive: the storey height rises to the apex of the roof where no level sits above", () => {
  const m = parse(SRC);
  assert.equal(levelPitch(m, "L1"), 3000); // 上のレベルがある — その差
  assert.equal(levelPitch(m, "L2"), 2700 + 200); // 上が無い — 天井高 + 屋根版の厚さ
  const top = derive(m).levels.find((l) => l.name === "L2")!;
  assert.equal(top.pitch, 2900);
});

test("derive: a level whose ceiling height is undetermined raises no wall and no column", () => {
  // 既定値を捏造しない (spec/derivation.md §0-2) — SUF01 が「作れない」ことを言葉にする
  const m = parse(`koyu 1.0
grid X 0 4000
grid Y 0 5000
level L1 0 slab:300
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out
`);
  assert.equal(levelPitch(m, "L1"), undefined);
  const form = derive(m);
  assert.deepEqual(form.levels.map((l) => l.pitch), [undefined]);
  assert.deepEqual(form.boundaries.filter((b) => b.material).length, 0);
});

test("derive: the head of an opening aligns to the lintel, and the sill falls out of it", () => {
  const form = derive(parse(SRC));
  const win = form.openings.find((o) => o.kind === "window")!;
  assert.deepEqual([win.z0, win.z1], [2000 - 1100, 2000]); // h:1100 と書かれた窓
  const door = form.openings.find((o) => o.kind === "door")!;
  assert.deepEqual([door.z0, door.z1], [0, 2000]); // 扉は床から立ち、まぐさ高に達する
});
