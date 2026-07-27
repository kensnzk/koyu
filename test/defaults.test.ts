// 既定境界・uid・言語版 (ADR-0014 / 0015 / 0017) — 水平の「既定は壁」、
// 不透明な同一性トークン、版の受理条件 (旧版は意味保存の場合のみ)。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { deriveDefaultBoundaries, doorsBetween, neighbors } from "../src/core/graph.js";
import { toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";

const BASE = [
  "koyu 0.4",
  "unit mm",
  "grid X 0 4000 8000",
  "grid Y 0 4000 8000",
  "level L1 0 h:2400",
].join("\n");

const ROOMS = "space /L1/a hall X1..X2 Y1..Y2\nspace /L1/b hall X2..X3 Y1..Y2";

// ---- 既定境界 (ADR-0014) ----

test("既定境界: 明示の素wall宣言と省略は同じ意味 (SVG・doors・隣接が一致)", () => {
  const verbose = parse(`${BASE}\n${ROOMS}\nboundary /L1/a /L1/b`);
  const slim = parse(`${BASE}\n${ROOMS}`);
  assert.equal(svgPlan(slim, { level: "L1" }), svgPlan(verbose, { level: "L1" }));
  assert.equal(doorsBetween(slim, "/L1/a", "/L1/b"), doorsBetween(verbose, "/L1/a", "/L1/b"));
  assert.equal(neighbors(slim, "/L1/a").length, neighbors(verbose, "/L1/a").length);
  // 正準JSONは書かれた構成のみ — 既定境界は出ない (意味は導出後のModelが持つ)
  assert.match(toCanonical(verbose), /"between"/);
  assert.doesNotMatch(toCanonical(slim), /"between"/);
});

test("既定境界: 宣言がある組には導出しない (edge限定でも抑制)", () => {
  const m = parse(`${BASE}\n${ROOMS}\nboundary /L1/a /L1/b edge:E t:200`);
  assert.equal(m.boundaries.filter((b) => b.derived).length, 0);
});

test("既定境界: 導出は冪等", () => {
  const m = parse(`${BASE}\n${ROOMS}`);
  const n = m.boundaries.length;
  deriveDefaultBoundaries(m);
  assert.equal(m.boundaries.length, n);
});

test("既定境界: レベル未特定の空間同士にも働く (旧警告と同じ述語)", () => {
  const m = parse(`${BASE}\nspace /misc/a room X1..X2 Y1..Y2\nspace /misc/b room X2..X3 Y1..Y2`);
  assert.equal(m.boundaries.filter((b) => b.derived).length, 1);
});

test("既定境界: 領域を持たない空間 (exterior) との境界は導かない — 宣言必須のまま", () => {
  const m = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /out exterior`);
  assert.equal(m.boundaries.length, 0);
});

// ---- 言語版 (ADR-0017) ----

test("版: 0.1は意味保存の場合のみ受理 — 導出が起きるファイルはエラー", () => {
  const src = (v: string) => `koyu ${v}\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\n${ROOMS}`;
  const old = check(parse(src("0.1")));
  assert.equal(old.errors.length, 1);
  assert.match(old.errors[0]!, /0\.2 へ上げます/);
  assert.deepEqual(check(parse(src("0.2"))).errors, []);
});

test("版: 導出の起きない0.1ファイルはそのまま受理される", () => {
  const m = parse(`koyu 0.1\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\n${ROOMS}\nboundary /L1/a /L1/b`);
  assert.deepEqual(check(m).errors, []);
  assert.equal(m.version, "0.1");
});

test("版: 宣言の省略は最新版の意味論 (既定境界が導出され、エラーにならない)", () => {
  const m = parse(`unit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\n${ROOMS}`);
  assert.equal(m.version, "0.5");
  assert.equal(m.boundaries.filter((b) => b.derived).length, 1);
  assert.deepEqual(check(m).errors, []);
});

test("版: import層での宣言はエラー (base層のみ)", () => {
  assert.throws(
    () =>
      parseFiles(
        {
          "main.muro": "koyu 0.2\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nimport ./sub.muro\n",
          "sub.muro": "koyu 0.2\nspace /L1/a hall X1..X2 Y1..Y2\n",
        },
        "main.muro",
      ),
    /base層 \(entry\) でのみ書きます/,
  );
});

// ---- uid (ADR-0015) ----

test("uid: 正常な不透明トークンはエラーなし・正準JSONに保存される", () => {
  const m = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:sp-x7k2\nzone /L1 uid:un-01`);
  assert.deepEqual(check(m).errors, []);
  assert.match(toCanonical(m), /"uid": "sp-x7k2"/);
});

test("uid: 数字だけの形はエラー (0123が123になり区別が失われる)", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:123`));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /uid は数字だけのトークンにできません/);
});

test("uid: 空白を含む形はエラー", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:"a b"`));
  assert.match(r.errors.join("\n"), /uid に空白は使えません/);
});

test("uid: 重複は1つのuidにつき1本のエラーで全所有者を列挙 (スパン展開の複製も見える)", () => {
  const src = `koyu 0.2
unit mm
grid X 0 4000 8000
grid Y 0 4000
level L1 0
level L2 3000
space /L1..L2/a room X1..X2 Y1..Y2 uid:sp-dup`;
  const r = check(parse(src));
  const dup = r.errors.filter((e) => e.includes("uid が重複しています"));
  assert.equal(dup.length, 1);
  assert.match(dup[0]!, /space \/L1\/a/);
  assert.match(dup[0]!, /space \/L2\/a/);
});

test("uid: spaceとzoneの横断でも重複はエラー", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:x1\nzone /L1 uid:x1`));
  assert.match(r.errors.join("\n"), /uid が重複しています: x1/);
});
