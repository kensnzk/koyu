// 意味の保証 (ADR-0013) — 外部レビュー (docs/reviews/2026-07-25) のP0回収。
// 正準JSONの無損失と正準順、境界の同一性、凹敷地の包含、敷地形状の妥当性、
// 宣言面積の照合、同一行の属性重複、言語版の検証、レイヤー記録の完全性。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { validate } from "../src/validate/index.js";
import { toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";

const BASE = [
  "koyu 0.4",
  "unit mm",
  "grid X 0 4000 8000",
  "grid Y 0 4000 8000",
  "level L1 0 h:2400",
].join("\n");

// ---- 正準JSON: 無損失 ----

test("canonical JSON: the boundary orientation (a) is preserved, so the meaning of swing is recoverable from the JSON alone", () => {
  const rooms = "space /L1/z room X1..X2 Y1..Y2\nspace /L1/a room X2..X3 Y1..Y2";
  const A = parse(`${BASE}\n${rooms}\nboundary /L1/z /L1/a\n  door w:800 swing:a`);
  const B = parse(`${BASE}\n${rooms}\nboundary /L1/a /L1/z\n  door w:800 swing:a`);
  const ja = toCanonical(A);
  const jb = toCanonical(B);
  // 扉の開く側が違う二つのモデルは、別のバイト列になる (v0.8までは同一になっていた)
  assert.notEqual(ja, jb);
  assert.match(ja, /"a": "\/L1\/z"/);
  assert.match(jb, /"a": "\/L1\/a"/);
});

test("canonical JSON: an explicit seg position is preserved in the notation as written", () => {
  const m = parse(
    `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/n room X1..X2 Y2..Y3\nboundary /L1/z /L1/n t:100\n  seg w:1000 at:X1+2000`,
  );
  assert.match(toCanonical(m), /"at": "X1\+2000"/);
});

// ---- 正準JSON: 宣言順に依らない ----

test("canonical JSON: the declaration order of openings does not change the bytes", () => {
  const src = (doors: string) =>
    `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/a room X2..X3 Y1..Y2\nboundary /L1/z /L1/a\n${doors}`;
  const j1 = toCanonical(parse(src("  door w:700 at:0.25\n  door w:700 at:0.75")));
  const j2 = toCanonical(parse(src("  door w:700 at:0.75\n  door w:700 at:0.25")));
  assert.equal(j1, j2);
});

test("canonical JSON: the declaration order of boundaries on the same pair of spaces (differing edge) does not change the bytes either", () => {
  const src = (bounds: string) =>
    `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out exterior\n${bounds}`;
  const j1 = toCanonical(parse(src("boundary /L1/a /out edge:N t:100\nboundary /L1/a /out edge:S t:150")));
  const j2 = toCanonical(parse(src("boundary /L1/a /out edge:S t:150\nboundary /L1/a /out edge:N t:100")));
  assert.equal(j1, j2);
});

// ---- 境界の同一性 ----

test("check: a duplicate boundary on the same pair of spaces is an error (a wall/open contradiction included)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/a /L1/b\nboundary /L1/a /L1/b type:open`,
    ),
  );
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /Duplicate boundary: \/L1\/a \| \/L1\/b/);
  assert.match(r.errors[0]!, /first seen at line/);
});

test("check: on the same pair of spaces a different edge is a different boundary (not an error)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out exterior\nboundary /L1/a /out edge:N\nboundary /L1/a /out edge:S`,
    ),
  );
  assert.deepEqual(r.errors, []);
});

test("check: a pair mixing edge-restricted and unrestricted boundaries is a warning (the segments overlap)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/n room X1..X2 Y2..Y3\nboundary /L1/z /L1/n\nboundary /L1/z /L1/n edge:N t:200`,
    ),
  );
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join("\n"), /carries both an edge-restricted and an unrestricted boundary/);
});

// ---- 敷地: 凹多角形の包含と形の妥当性 ----

test("check: a building straddling a concave site (U-shaped) is an error even when all four corners are inside", () => {
  const src = `koyu 0.4
unit mm
grid X 0 2000 28000 30000
grid Y 0 2000 6000 12000 20000
level L1 0
zone /site site:1
polygon /site 0,0 30000,0 30000,20000 20000,20000 20000,8000 10000,8000 10000,20000 0,20000
space /L1/hall room X2..X3 Y2..Y4`;
  const f = validate(parse(src)).filter((x) => x.rule === "site.escape");
  assert.equal(f.length, 1);
  assert.match(f[0]!.message, /\/L1\/hall escapes the site shape/);
});

test("check: a building corner sitting on the site boundary line counts as inside (not an error)", () => {
  const src = `${BASE}
zone /site site:1
polygon /site 0,0 8000,0 8000,8000 0,8000
space /L1/a room X1..X3 Y1..Y3`;
  assert.deepEqual(validate(parse(src)).filter((f) => f.rule === "site.escape"), []);
});

test("check: a self-intersecting site shape and a duplicate vertex are errors", () => {
  const bow = check(parse(`${BASE}\nzone /site site:1\npolygon /site 0,0 8000,8000 8000,0 0,8000`));
  assert.match(bow.errors.join("\n"), /The site shape is self-intersecting/);
  const dup = check(parse(`${BASE}\nzone /site site:1\npolygon /site 0,0 0,0 8000,0 0,8000`));
  assert.match(dup.errors.join("\n"), /The site shape has a duplicate vertex/);
});

test("validation: a disagreement between the declared and derived site area is a caution (the validation face, not core)", () => {
  const src = (area: number) =>
    `${BASE}\nzone /site site:1 area:${area}\npolygon /site 0,0 10000,0 10000,10000 0,10000`;
  const bad = validate(parse(src(50))).filter((f) => f.rule === "site.area");
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.level, "caution");
  assert.match(bad[0]!.message, /Declared and derived site areas disagree: declared 50 m2 \/ derived 100\.00 m2/);
  assert.deepEqual(validate(parse(src(100))).filter((f) => f.rule === "site.area"), []);
  // core は面積の食い違いを言わない — 測量値との照合は建築の側の判断である
  assert.equal(
    check(parse(src(50))).warnings.some((w) => w.includes("site area")),
    false,
  );
});

// ---- 字句・版 ----

test("parse: a duplicate attribute key on one line is an error (last-wins does not hide it)", () => {
  assert.throws(
    () => parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 use:first use:second`),
    /Duplicate attribute key: use/,
  );
});

test("parse: an unsupported koyu version is an error", () => {
  assert.throws(() => parse("koyu 0.9\nunit mm"), /Unsupported koyu version: 0\.9/);
});

// ---- 合成: レイヤー記録の完全性 ----

test("composition: a layer holding only grid/level is recorded in layers too", () => {
  const m = parseFiles(
    {
      "main.muro": "koyu 0.4\nunit mm\nimport ./base.muro\nimport ./rooms.muro\n",
      "base.muro": "grid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\n",
      "rooms.muro":
        "space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/a /L1/b\n  door w:800\n",
    },
    "main.muro",
  );
  assert.deepEqual(m.layers, ["main.muro", "base.muro", "rooms.muro"]);
});

// ---- 検証ファンアウトの回収 (v0.10) ----

test("canonical JSON: an explicit level: is preserved (without it the membership is not recoverable from the JSON)", () => {
  const mez = parse(
    "koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nlevel L2 3000\nspace /Z/a room X1..X2 Y1..Y2 level:L1",
  );
  assert.match(toCanonical(mez), /"level": "L1"/);
  // パス先頭と同じ所属 (既定) は書かれた綴りに関わらず省略
  const plain = parse("koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2");
  assert.doesNotMatch(toCanonical(plain), /"level"/);
});

test("canonical JSON: a reversed region notation (X2..X1) is normalized to ascending, so the same rectangle gives the same bytes", () => {
  const src = (r: string) => `koyu 0.4\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room ${r}`;
  assert.equal(toCanonical(parse(src("X2..X1 Y2..Y1"))), toCanonical(parse(src("X1..X2 Y1..Y2"))));
});

test("parse: a non-numeric value on an attribute that requires a number is an error (NaN is not tolerated silently)", () => {
  assert.throws(
    () => parse("koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0 h:24O0"),
    /The attribute h is written as a number: 24O0/,
  );
});

test("parse: a bare name is an error", () => {
  assert.throws(() => parse("koyu 0.4\nname\nunit mm"), /name takes a value/);
});

test("parse: the koyu line is two tokens and written once (no version, extra tokens and redeclaration are errors)", () => {
  assert.throws(() => parse("koyu\nunit mm"), /koyu takes a version/);
  assert.throws(() => parse("koyu 0.2 extra\nunit mm"), /Extra tokens on the koyu version declaration/);
  assert.throws(() => parse("koyu 0.4\nkoyu 0.4\nunit mm"), /The koyu version is declared once/);
});
