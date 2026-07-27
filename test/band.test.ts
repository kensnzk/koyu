// 帯 (band, ADR-0019) — 寸法と並びから位置を導く。
// この試験の主眼は「帯で書いた版と位置で書いた版が同じ正準JSONを与える」ことである。
// 帯は parse 時に通常の空間へ展開されるので、下流 (check/plan/graph/diff/light/site) は帯を知らない。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { semanticDiff } from "../src/core/diff.js";
import { toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";

const HEAD = "koyu 0.4\nunit mm\ngrid X 0 6400 12800\ngrid Y 0 5600\nlevel L1 0 h:2400\n";

// ---- A. 展開 ----

test("帯: X方向・閉じた帯は位置で書いた版と同じ矩形になる", () => {
  const m = parse(
    `${HEAD}band X X1+3200..X2+3200 Y1+4000..Y2\n  space /L1/wet wet w:4800\n  space /L1/hall hall w:1600\n`,
  );
  assert.deepEqual(m.spaces.get("/L1/wet")!.rects, [{ x1: 3200, x2: 8000, y1: 4000, y2: 5600 }]);
  assert.deepEqual(m.spaces.get("/L1/hall")!.rects, [{ x1: 8000, x2: 9600, y1: 4000, y2: 5600 }]);
  // 綴り: 帯の両端は書かれたまま、内側の切り位置だけが床規則で綴られる
  assert.deepEqual(m.spaces.get("/L1/wet")!.grids, [
    { xa: "X1+3200", xb: "X2+1600", ya: "Y1+4000", yb: "Y2" },
  ]);
  assert.deepEqual(m.spaces.get("/L1/hall")!.grids, [
    { xa: "X2+1600", xb: "X2+3200", ya: "Y1+4000", yb: "Y2" },
  ]);
});

test("帯: Y方向", () => {
  const m = parse(
    `${HEAD}band Y X1..X1+3200 Y1..Y2\n  space /L1/bed2 bedroom w:2400\n  space /L1/bed1 bedroom w:3200\n`,
  );
  assert.deepEqual(m.spaces.get("/L1/bed2")!.rects, [{ x1: 0, x2: 3200, y1: 0, y2: 2400 }]);
  assert.deepEqual(m.spaces.get("/L1/bed1")!.rects, [{ x1: 0, x2: 3200, y1: 2400, y2: 5600 }]);
  assert.deepEqual(m.spaces.get("/L1/bed1")!.grids, [
    { xa: "X1", xb: "X1+3200", ya: "Y1+2400", yb: "Y2" },
  ]);
});

test("帯: w:rest は末尾でも先頭でも中間でも同じ矩形を与える", () => {
  const last = parse(
    `${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  const first = parse(
    `${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n  space /L1/b room w:1600\n`,
  );
  assert.deepEqual(last.spaces.get("/L1/b")!.rects, [{ x1: 1600, x2: 6400, y1: 0, y2: 5600 }]);
  assert.deepEqual(first.spaces.get("/L1/a")!.rects, [{ x1: 0, x2: 4800, y1: 0, y2: 5600 }]);
  const mid = parse(
    `${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n  space /L1/c room w:1600\n`,
  );
  assert.deepEqual(mid.spaces.get("/L1/b")!.rects, [{ x1: 1600, x2: 4800, y1: 0, y2: 5600 }]);
});

test("帯: 通り芯に一致する切り位置は通り名だけで綴られる (X2+0 にしない)", () => {
  const m = parse(
    `${HEAD}band X X1..X3 Y1..Y2\n  space /L1/a room w:6400\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.spaces.get("/L1/a")!.grids[0]!.xb, "X2");
  assert.equal(m.spaces.get("/L1/b")!.grids[0]!.xa, "X2");
});

test("帯: 先頭の通り芯より手前は負のオフセットで綴られる", () => {
  const m = parse(
    `${HEAD}band X X1-3200..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.spaces.get("/L1/a")!.grids[0]!.xb, "X1-1600");
});

test("帯: 要素が一つでも成立する", () => {
  const m = parse(`${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n`);
  assert.deepEqual(m.spaces.get("/L1/a")!.rects, [{ x1: 0, x2: 6400, y1: 0, y2: 5600 }]);
});

test("帯: レベルスパンは全要素まとめて展開される", () => {
  const src =
    "koyu 0.4\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\nlevel L2 3000 h:2400\nlevel L3 6000 h:2400\n" +
    "band X X1..X2 Y1..Y2\n  space /L1..L3/a room w:1600\n  space /L1..L3/b room w:rest\n";
  const m = parse(src);
  for (const lv of ["L1", "L2", "L3"]) {
    assert.deepEqual(m.spaces.get(`/${lv}/a`)!.rects, [{ x1: 0, x2: 1600, y1: 0, y2: 5600 }]);
    assert.deepEqual(m.spaces.get(`/${lv}/b`)!.rects, [{ x1: 1600, x2: 6400, y1: 0, y2: 5600 }]);
  }
});

test("帯: 直交方向の綴りは全要素に書かれたまま渡される", () => {
  const m = parse(
    `${HEAD}band X X1..X2 Y1+1000..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  for (const p of ["/L1/a", "/L1/b"]) {
    assert.equal(m.spaces.get(p)!.grids[0]!.ya, "Y1+1000");
    assert.equal(m.spaces.get(p)!.grids[0]!.yb, "Y2");
  }
});

test("帯: import層の中でも働き、エラーは出所つきで返る", () => {
  const m = parseFiles(
    {
      "main.muro": `${HEAD}import ./floor.muro\n`,
      "floor.muro": "band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n",
    },
    "main.muro",
  );
  assert.equal(m.spaces.get("/L1/a")!.file, "floor.muro");
  assert.throws(
    () =>
      parseFiles(
        {
          "main.muro": `${HEAD}import ./floor.muro\n`,
          "floor.muro": "band X X1..X2 Y1..Y2\n  space /L1/a room w:9999\n",
        },
        "main.muro",
      ),
    /floor\.muro:1行目/,
  );
});

test("帯: 帯が作った空間も zone が集約する", () => {
  const m = parse(
    `${HEAD}zone /L1 name:全体\nband X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.zones.get("/L1")!.attrs["name"], "全体");
  assert.deepEqual(check(m).errors, []);
});

test("帯: 隣り合う要素には既定の壁が導出される (ADR-0014)", () => {
  const m = parse(
    `${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  const derived = m.boundaries.filter((b) => b.derived);
  assert.equal(derived.length, 1);
  assert.equal(derived[0]!.kind, "wall");
});

// ---- B. 保証: 帯で書いた版 == 位置で書いた版 ----

test("保証: 帯で書いた版と位置で書いた版は正準JSONがバイト同一・semanticDiffが空", () => {
  const band = parse(
    `${HEAD}band X X1+3200..X2+3200 Y1+4000..Y2\n  space /L1/wet wet w:4800 name:水回り\n  space /L1/hall hall w:1600 name:玄関\n`,
  );
  const pos = parse(
    `${HEAD}space /L1/wet wet X1+3200..X2+1600 Y1+4000..Y2 name:水回り\nspace /L1/hall hall X2+1600..X2+3200 Y1+4000..Y2 name:玄関\n`,
  );
  assert.equal(toCanonical(band), toCanonical(pos));
  const d = semanticDiff(band, pos);
  assert.equal(d.spaces.changed.length + d.spaces.added.length + d.spaces.removed.length, 0);
});

test("保証: 正準JSONに band / rest / w は漏れない", () => {
  const j = toCanonical(
    parse(`${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`),
  );
  assert.ok(!j.includes("band"), "band が漏れている");
  assert.ok(!j.includes("rest"), "rest が漏れている");
  assert.ok(!/"w":/.test(j), "w が漏れている");
});

// ---- C. 編集の伝播 (帯の価値の証拠) ----

test("編集の伝播: 一箇所の w: を変えると隣が追随し、checkは緑のまま", () => {
  const mk = (w: number) =>
    parse(`${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:${w}\n  space /L1/b room w:rest\n`);
  const before = mk(1600);
  const after = mk(1800);
  assert.deepEqual(check(before).errors, []);
  assert.deepEqual(check(after).errors, []);
  // 隣が自動で追随している — 位置で書いた版なら手で直さねばならず、忘れれば隙間か重なりになる
  assert.equal(after.spaces.get("/L1/a")!.rects[0]!.x2, 1800);
  assert.equal(after.spaces.get("/L1/b")!.rects[0]!.x1, 1800);
  assert.equal(after.spaces.get("/L1/b")!.rects[0]!.x2, 6400);
});

// ---- D. エラー ----

const bad = (src: string, re: RegExp) => assert.throws(() => parse(HEAD + src), re);

test("帯のエラー: 軸", () => {
  bad("band X1..X2 Y1..Y2\n  space /L1/a room w:rest\n", /band の割る向きは X か Y です/);
  bad("band Z X1..X2 Y1..Y2\n  space /L1/a room w:rest\n", /band の割る向きは X か Y です/);
});

test("帯のエラー: 帯の行に属性は書けない", () => {
  bad(
    "band X X1..X2 Y1..Y2 floor:オーク\n  space /L1/a room w:rest\n",
    /band の行に書けるのは 軸と領域だけです/,
  );
});

test("帯のエラー: 範囲は昇順", () => {
  bad("band X X2..X1 Y1..Y2\n  space /L1/a room w:rest\n", /band の範囲は昇順で書きます/);
});

test("帯のエラー: 過剰決定と不足", () => {
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:4800\n  space /L1/b room w:3200\n",
    /帯の幅 6400mm に対し寸法の合計が 8000mm で、1600mm 超えています/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:3200\n",
    /帯の幅 6400mm に対し寸法の合計が 3200mm で、3200mm 足りません/,
  );
});

test("帯のエラー: rest は高々一つ / 残りがゼロ", () => {
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n  space /L1/b room w:rest\n",
    /残りを吸収する要素 \(w:rest\) は帯に一つだけです/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:6400\n  space /L1/b room w:rest\n",
    /残りがゼロです/,
  );
});

test("帯のエラー: 幅の欠落と不正な幅", () => {
  bad("band X X1..X2 Y1..Y2\n  space /L1/a room\n", /band の要素には幅 w:\(mm\) か w:rest が要ります/);
  for (const v of ["w:0", "w:-100", "w:1600.5", "w:ret"]) {
    bad(
      `band X X1..X2 Y1..Y2\n  space /L1/a room ${v}\n`,
      /band の要素の幅は正の整数mm か rest で書きます/,
    );
  }
});

test("帯のエラー: 要素の型・領域・level:", () => {
  bad("band X X1..X2 Y1..Y2\n  space /L1/a w:1600\n", /band の要素 \/L1\/a に型\(語彙\)が要ります/);
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest X1..X2\n",
    /band の要素に領域は書けません/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest level:L1\n",
    /band の要素に level: は書けません/,
  );
});

test("帯のエラー: 要素なし / 帯の外の字下げ space / 帯の下の area", () => {
  bad("band X X1..X2 Y1..Y2\n", /band の下に space を字下げして1つ以上書きます/);
  bad(
    "space /L1/a room X1..X2 Y1..Y2\n  space /L1/b room w:1600\n",
    /字下げした space は band の直下に書きます/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n  area X1..X2 Y1..Y2\n",
    /band の要素に area は書けません/,
  );
});

test("帯のエラー: 要素が違うレベルに展開される", () => {
  const src =
    "koyu 0.4\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\nlevel L2 3000 h:2400\n" +
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L2/b room w:rest\n";
  assert.throws(() => parse(src), /帯の要素は同じレベルに展開します/);
});

test("帯のエラー: 要素のパス重複", () => {
  bad(
    "space /L1/a room X1..X2 Y1..Y2\nband X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n",
    /空間パスが重複しています: \/L1\/a/,
  );
});

// ---- E. 字下げを落とした要素を黙って通さない (最重要の防御) ----

test("非字下げの space に w: は書けない — 字下げ落ちが黙って通るのを防ぐ", () => {
  bad("space /L1/a room w:1600\n", /space に w: は書けません/);
  // 帯の要素が字下げを失った形 (帯自体は閉じているので、破れではなく字下げ落ちが露見する)。
  // これが通ると室が領域を持たないまま全ての図から消え、check は緑のままになる
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:6400\nspace /L1/b room w:rest\n",
    /space に w: は書けません/,
  );
});

// ---- F. 版 ----

test("帯に語彙の版ゲートは無い (koyu 0.2 宣言でも読める)", () => {
  // koyu は zone / stack / polygon / import のいずれにも字句の版ゲートを持たない。
  // band にだけ設けるのは新機構の密輸になるため、意図的に設けていない (ADR-0019)。
  const m = parse(
    "koyu 0.2\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\n" +
      "band X X1..X2 Y1..Y2\n  space /L1/a hall w:1600\n  space /L1/b hall w:rest\n",
  );
  assert.equal(m.spaces.size, 2);
});
