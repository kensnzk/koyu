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

test("band: along X, a closed band gives the same rects as the version written by position", () => {
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

test("band: along Y", () => {
  const m = parse(
    `${HEAD}band Y X1..X1+3200 Y1..Y2\n  space /L1/bed2 bedroom w:2400\n  space /L1/bed1 bedroom w:3200\n`,
  );
  assert.deepEqual(m.spaces.get("/L1/bed2")!.rects, [{ x1: 0, x2: 3200, y1: 0, y2: 2400 }]);
  assert.deepEqual(m.spaces.get("/L1/bed1")!.rects, [{ x1: 0, x2: 3200, y1: 2400, y2: 5600 }]);
  assert.deepEqual(m.spaces.get("/L1/bed1")!.grids, [
    { xa: "X1", xb: "X1+3200", ya: "Y1+2400", yb: "Y2" },
  ]);
});

test("band: w:rest gives the same rects last, first, or in the middle", () => {
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

test("band: a cut that lands on a grid line is spelled with the grid name alone (not X2+0)", () => {
  const m = parse(
    `${HEAD}band X X1..X3 Y1..Y2\n  space /L1/a room w:6400\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.spaces.get("/L1/a")!.grids[0]!.xb, "X2");
  assert.equal(m.spaces.get("/L1/b")!.grids[0]!.xa, "X2");
});

test("band: a cut before the first grid line is spelled with a negative offset", () => {
  const m = parse(
    `${HEAD}band X X1-3200..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.spaces.get("/L1/a")!.grids[0]!.xb, "X1-1600");
});

test("band: a single member is enough", () => {
  const m = parse(`${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n`);
  assert.deepEqual(m.spaces.get("/L1/a")!.rects, [{ x1: 0, x2: 6400, y1: 0, y2: 5600 }]);
});

test("band: a level span expands all members together", () => {
  const src =
    "koyu 0.4\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\nlevel L2 3000 h:2400\nlevel L3 6000 h:2400\n" +
    "band X X1..X2 Y1..Y2\n  space /L1..L3/a room w:1600\n  space /L1..L3/b room w:rest\n";
  const m = parse(src);
  for (const lv of ["L1", "L2", "L3"]) {
    assert.deepEqual(m.spaces.get(`/${lv}/a`)!.rects, [{ x1: 0, x2: 1600, y1: 0, y2: 5600 }]);
    assert.deepEqual(m.spaces.get(`/${lv}/b`)!.rects, [{ x1: 1600, x2: 6400, y1: 0, y2: 5600 }]);
  }
});

test("band: the spelling across the band passes to every member as written", () => {
  const m = parse(
    `${HEAD}band X X1..X2 Y1+1000..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  for (const p of ["/L1/a", "/L1/b"]) {
    assert.equal(m.spaces.get(p)!.grids[0]!.ya, "Y1+1000");
    assert.equal(m.spaces.get(p)!.grids[0]!.yb, "Y2");
  }
});

test("band: it works inside an imported layer, and errors come back carrying their origin", () => {
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
    /floor\.muro:line 1/,
  );
});

test("band: a zone aggregates the spaces a band made as well", () => {
  const m = parse(
    `${HEAD}zone /L1 name:全体\nband X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  assert.equal(m.zones.get("/L1")!.attrs["name"], "全体");
  assert.deepEqual(check(m).errors, []);
});

test("band: adjacent members derive a default wall (ADR-0014)", () => {
  const m = parse(
    `${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`,
  );
  const derived = m.boundaries.filter((b) => b.derived);
  assert.equal(derived.length, 1);
  assert.equal(derived[0]!.kind, "wall");
});

// ---- B. 保証: 帯で書いた版 == 位置で書いた版 ----

test("guarantee: the band version and the position version give byte-identical canonical JSON and an empty semanticDiff", () => {
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

test("guarantee: band / rest / w never leak into canonical JSON", () => {
  const j = toCanonical(
    parse(`${HEAD}band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L1/b room w:rest\n`),
  );
  assert.ok(!j.includes("band"), "band leaked");
  assert.ok(!j.includes("rest"), "rest leaked");
  assert.ok(!/"w":/.test(j), "w leaked");
});

// ---- C. 編集の伝播 (帯の価値の証拠) ----

test("edit propagation: changing one w: makes the neighbour follow, and check stays green", () => {
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

test("band errors: the axis", () => {
  bad("band X1..X2 Y1..Y2\n  space /L1/a room w:rest\n", /A band divides along X or Y/);
  bad("band Z X1..X2 Y1..Y2\n  space /L1/a room w:rest\n", /A band divides along X or Y/);
});

test("band errors: attributes cannot be written on the band line", () => {
  bad(
    "band X X1..X2 Y1..Y2 floor:オーク\n  space /L1/a room w:rest\n",
    /Only the axis and the extent may be written on a band line/,
  );
});

test("band errors: the range is ascending", () => {
  bad("band X X2..X1 Y1..Y2\n  space /L1/a room w:rest\n", /A band range is written in ascending order/);
});

test("band errors: overdetermined and short", () => {
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:4800\n  space /L1/b room w:3200\n",
    /The dimensions sum to 8000mm against a band width of 6400mm, 1600mm over/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:3200\n",
    /The dimensions sum to 3200mm against a band width of 6400mm, 3200mm short/,
  );
});

test("band errors: at most one rest, and a remainder of zero", () => {
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n  space /L1/b room w:rest\n",
    /Only one member per band absorbs the remainder \(w:rest\)/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:6400\n  space /L1/b room w:rest\n",
    /leaving zero for \/L1\/b \(w:rest\)/,
  );
});

test("band errors: a missing width and an invalid width", () => {
  bad("band X X1..X2 Y1..Y2\n  space /L1/a room\n", /A band member requires a width, w:\(mm\) or w:rest/);
  for (const v of ["w:0", "w:-100", "w:1600.5", "w:ret"]) {
    bad(
      `band X X1..X2 Y1..Y2\n  space /L1/a room ${v}\n`,
      /A band member width is written as a positive integer in mm, or as rest/,
    );
  }
});

test("band errors: the member region and level: (the type is optional, as it is on space)", () => {
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest X1..X2\n",
    /A region may not be written on a band member/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest level:L1\n",
    /level: may not be written on a band member/,
  );
});

// The type used to be required here, and the parser had a special error for "a k:v landed in
// the type position" so that a forgotten type was not misreported as a missing width. With the
// type optional that shape is simply a member that carries no label, and it is legal.
test("band: a member may carry no type at all", () => {
  const m = parse("koyu 1.0\ngrid X 0 3200\ngrid Y 0 4000\nlevel L1 0\nband X X1..X2 Y1..Y2\n  space /L1/a w:rest\n");
  const s = m.spaces.get("/L1/a")!;
  assert.equal(s.type, undefined);
  assert.equal(s.rects.length, 1);
});

test("band errors: no members, an indented space outside a band, and area under a band", () => {
  bad("band X X1..X2 Y1..Y2\n", /band takes one or more indented space lines below it/);
  bad(
    "space /L1/a room X1..X2 Y1..Y2\n  space /L1/b room w:1600\n",
    /an indented space is written directly under band/,
  );
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n  area X1..X2 Y1..Y2\n",
    /area may not be written on a band member/,
  );
});

test("band errors: members expanding onto different levels", () => {
  const src =
    "koyu 0.4\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\nlevel L2 3000 h:2400\n" +
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:1600\n  space /L2/b room w:rest\n";
  assert.throws(() => parse(src), /Band members expand onto the same level/);
});

test("band errors: a duplicated member path", () => {
  bad(
    "space /L1/a room X1..X2 Y1..Y2\nband X X1..X2 Y1..Y2\n  space /L1/a room w:rest\n",
    /Duplicate space path: \/L1\/a/,
  );
});

// ---- E. 字下げを落とした要素を黙って通さない (最重要の防御) ----

test("w: cannot be written on an unindented space, which keeps a lost indent from passing silently", () => {
  bad("space /L1/a room w:1600\n", /w: may not be written on space/);
  // 帯の要素が字下げを失った形 (帯自体は閉じているので、破れではなく字下げ落ちが露見する)。
  // これが通ると室が領域を持たないまま全ての図から消え、check は緑のままになる
  bad(
    "band X X1..X2 Y1..Y2\n  space /L1/a room w:6400\nspace /L1/b room w:rest\n",
    /w: may not be written on space/,
  );
});

// ---- F. 版 ----

test("band has no vocabulary version gate (it parses even under a koyu 0.2 declaration)", () => {
  // koyu は zone / stack / polygon / import のいずれにも字句の版ゲートを持たない。
  // band にだけ設けるのは新機構の密輸になるため、意図的に設けていない (ADR-0019)。
  const m = parse(
    "koyu 0.2\nunit mm\ngrid X 0 6400\ngrid Y 0 5600\nlevel L1 0 h:2400\n" +
      "band X X1..X2 Y1..Y2\n  space /L1/a hall w:1600\n  space /L1/b hall w:rest\n",
  );
  assert.equal(m.spaces.size, 2);
});
