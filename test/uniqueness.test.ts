// 導出の一意性 (spec/scope.md §6 / ADR-0041) — **形は正準形の関数である。**
//
// spec/scope.md §6 は「この記述からは、一意な形が作れなければならない」と約束する。
// その約束を機械が縛れる形に言い直すと、こうなる:
//
//     toCanonical(a) === toCanonical(b)  ⟹  derive(a) ≡ derive(b)
//
// 正準形は「同じ建物とは何か」の定義である。だから正準形が捨てる情報 —
// 線の端点の書き順、境界の宣言順、行の並び — が形を変えるなら、
// **正準形はその問いに答えられていない**。捨ててよいものを捨てていないか、
// 捨ててはいけないものを捨てているかの、どちらかである。
//
// この三つは実測で壊れていた (ADR-0041 の文脈にある数字がそれである)。

import assert from "node:assert/strict";
import { test } from "node:test";
import { derive } from "../src/core/derive.js";
import { toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";

const form = (src: string) => JSON.stringify(derive(parse(src)));

/** 正準形が同じなら形も同じ、を一組について確かめる */
function sameForm(a: string, b: string, what: string): void {
  assert.equal(
    toCanonical(parse(a)),
    toCanonical(parse(b)),
    `${what}: the premise fails — the two are not canonically equal, so this pair proves nothing`,
  );
  assert.equal(form(a), form(b), `${what}: canonically equal but the derived form differs`);
}

const BASE = `koyu 1.0
grid X 0 3000 6000 9000
grid Y 0 6000
level L1 0 h:2700 slab:300
`;

// ---- 線の端点の書き順 ----

test("uniqueness: the written order of a line's endpoints does not move the form", () => {
  const src = (line: string) => `${BASE}space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /L1/b
${line}
  door w:900 at:0.25 name:D1
boundary /L1/a /out edge:S
`;
  // 同じ二点を結ぶ線を、両方の端から書く
  sameForm(
    src("  line X1,Y1+2000 X2,Y1+4000"),
    src("  line X2,Y1+4000 X1,Y1+2000"),
    "line endpoints written in reverse",
  );
});

test("uniqueness: a reversed line does not move the opening on it", () => {
  // 退化していない具体の座標で押さえる — 開口の `at:` は線分の始端からの比なので、
  // 始端が書き順で決まっていた頃はここが (1500,2500) と (4500,3500) に割れていた
  const src = (line: string) => `${BASE}space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /L1/b
${line}
  door w:900 at:0.25 name:D1
boundary /L1/a /out edge:S
`;
  const fwd = derive(parse(src("  line X1,Y1+2000 X2,Y1+4000"))).openings[0]!;
  const rev = derive(parse(src("  line X2,Y1+4000 X1,Y1+2000"))).openings[0]!;
  assert.deepEqual([fwd.cx, fwd.cy], [750, 2500]);
  assert.deepEqual([rev.cx, rev.cy], [fwd.cx, fwd.cy]);
});

// ---- 境界の宣言順 ----

test("uniqueness: the declaration order of boundaries carrying a line does not move the form", () => {
  const ab = `boundary /L1/a /L1/b
  line X2,Y1 X3,Y2`;
  const bc = `boundary /L1/b /L1/c
  line X3,Y1 X2,Y2`;
  const src = (first: string, second: string) => `${BASE}space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/c room X3..X4 Y1..Y2
space /out exterior
${first}
${second}
boundary /L1/a /out edge:S
`;
  // 二本の線は互いに交差し、切り分けの結果を読み合う — 順序が効く形である
  sameForm(src(ab, bc), src(bc, ab), "boundaries with lines declared in the other order");
});

test("uniqueness: crossing lines give each space the same area whichever is declared first", () => {
  const src = (first: string, second: string) => `${BASE}space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/c room X3..X4 Y1..Y2
space /out exterior
${first}
${second}
boundary /L1/a /out edge:S
`;
  const ab = `boundary /L1/a /L1/b\n  line X2,Y1 X3,Y2`;
  const bc = `boundary /L1/b /L1/c\n  line X3,Y1 X2,Y2`;
  const areaOf = (s: string) => {
    const f = derive(parse(s));
    return Object.fromEntries(f.spaces.map((v) => [v.path, Math.round((v.areaM2 ?? 0) * 100) / 100]));
  };
  const one = areaOf(src(ab, bc));
  const two = areaOf(src(bc, ab));
  assert.deepEqual(one, two);
  // 27.00 ↔ 22.50 に割れていた組
  assert.equal(one["/L1/a"], 27);
  assert.equal(one["/L1/c"], 22.5);
});

// ---- The declaration order of spaces ----
//
// The three above watch that how a **boundary** is written does not reach the shape. The same
// promise covers the declaration order of spaces — the canonical form sorts `spaces` by path
// collation, so declaration order is discarded information. It leaked from three places: the
// `a`/`b` of a derived boundary (its orientation is recorded nowhere, so it took declaration
// order), the ordering of `Form.spaces`, and the ordering of `slabs`.

// The same two rooms with only the order of the lines swapped. **The pairing of a space with its
// region is left alone** — change it and this is a different building, whose canonical form is
// not equal, so the pair proves nothing
const A_LINE = "space /L1/a room X1..X2 Y1..Y2";
const B_LINE = "space /L1/b room X2..X3 Y1..Y2";
const aFirst = `${BASE}${A_LINE}\n${B_LINE}\n`;
const bFirst = `${BASE}${B_LINE}\n${A_LINE}\n`;

test("uniqueness: the declaration order of adjacent spaces does not move the form", () => {
  // No boundary written at all — the default wall is derived, which is the muro idiom
  sameForm(aFirst, bFirst, "adjacent spaces declared in the other order");
});

test("uniqueness: a derived boundary takes its a/b from the canonical order, not the declaration order", () => {
  const ab = derive(parse(aFirst)).boundaries[0]!;
  const ba = derive(parse(bFirst)).boundaries[0]!;
  // The pair that split into `a|b@0` vs `b|a@0` by declaration order. The spelling of a relation's
  // identity must not be a function of it
  assert.equal(ab.ref, "/L1/a|/L1/b@0");
  assert.deepEqual([ba.ref, ba.a, ba.b], [ab.ref, ab.a, ab.b]);
});

// ---- The written order of a region union ----

test("uniqueness: the written order of a region union does not move the form", () => {
  const src = (union: string) => `${BASE}space /L1/L room ${union}
space /out exterior
boundary /L1/L /out edge:N
`;
  // The canonical form sorts `at` into canonical spelling order, discarding the written order of
  // `+`. That discarded order survived in the convex pieces, slabs and plan entities, so with two
  // pieces of equal area the anchor of the room label — a physical quantity — became a function
  // of declaration order
  sameForm(
    src("X1..X2 Y1..Y2 + X2..X3 Y1..Y2"),
    src("X2..X3 Y1..Y2 + X1..X2 Y1..Y2"),
    "region union written in the other order",
  );
});

// ---- a/b の向き ----
//
// a/b の向きは正準JSONに `a` として残る (`edge` と `swing` をそこから読むため) ので、
// 正準形は等しくならない。だからこれは上の含意の話ではなく、**a/b が何に効くか**の話である。
// 効いてよいのは `edge` と `swing` だけであって、形ではない。

test("uniqueness: which space is written first does not flip which side a line keeps", () => {
  const src = (bnd: string) => `${BASE}space /L1/room room X1..X2 Y1..Y2
space /out exterior
boundary /L1/room /out edge:S
boundary /L1/room /out edge:E
boundary /L1/room /out edge:N
${bnd}
  line X1,Y1+2000 X1+2000,Y1
`;
  const roomFirst = derive(parse(src("boundary /L1/room /out edge:W")));
  const outFirst = derive(parse(src("boundary /out /L1/room edge:W")));
  const area = (f: ReturnType<typeof derive>) =>
    Math.round((f.spaces.find((s) => s.path === "/L1/room")!.areaM2 ?? 0) * 100) / 100;
  // a/b の向きで結果が反転していた (別の格子での実測は 26.00㎡ ↔ 34.00㎡)。
  // 線が実際に隅を落としていること (= 検査が空振りしていないこと) も併せて縛る
  const full = 3 * 6; // 3000 × 6000 mm
  assert.ok(area(roomFirst) < full, "the line must actually cut a corner off");
  assert.equal(
    area(outFirst),
    area(roomFirst),
    "writing the exterior first must not flip the side the line keeps",
  );
});

// ---- 同梱例が実際に一意であること ----

test("uniqueness: every bundled example derives one form from its canonical form", async () => {
  const { parseFile } = await import("../src/parse-file.js");
  const files = [
    "examples/two-rooms.muro",
    "examples/office.muro",
    "examples/house/main.muro",
    "examples/tower/main.muro",
    "examples/complex/main.muro",
    "examples/twin/main.muro",
  ];
  for (const f of files) {
    const a = parseFile(f);
    const b = parseFile(f);
    assert.equal(toCanonical(a), toCanonical(b), `${f}: canonical form is not stable`);
    assert.equal(JSON.stringify(derive(a)), JSON.stringify(derive(b)), `${f}: derived form is not stable`);
  }
});
