// 意味の保証 (ADR-0013 / ADR-0036) — 外部レビュー (docs/reviews/2026-07-25) のP0回収と、
// 機械形式の版・決定性の規範。正準JSONの無損失と正準順、形式版の名乗り、キーの照合順と
// Unicode正規化、境界の同一性、凹敷地の包含、敷地形状の妥当性、宣言面積の照合、
// 同一行の属性重複、言語版の検証、レイヤー記録の完全性。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { SITE_AREA_RULE_ID, SITE_ESCAPE_RULE_ID } from "../src/validate/builtin/index.js";
import { caught } from "./helpers/schematic.js";
import { CANONICAL_FORMAT, compareCanonical, toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";

const BASE = [
  "koyu 1.1",
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
    `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out outside:1\n${bounds}`;
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
      `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out outside:1\nboundary /L1/a /out edge:N\nboundary /L1/a /out edge:S`,
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
level L1 0 h:2400 slab:150
zone /site site:1
polygon /site 0,0 30000,0 30000,20000 20000,20000 20000,8000 10000,8000 10000,20000 0,20000
space /L1/hall room X2..X3 Y2..Y4`;
  const f = caught(parse(src)).filter((x) => x.rule === SITE_ESCAPE_RULE_ID.id);
  assert.equal(f.length, 1);
  assert.match(f[0]!.message, /\/L1\/hall escapes the site shape/);
});

test("check: a building corner sitting on the site boundary line counts as inside (not an error)", () => {
  const src = `${BASE}
zone /site site:1
polygon /site 0,0 8000,0 8000,8000 0,8000
space /L1/a room X1..X3 Y1..Y3`;
  assert.deepEqual(caught(parse(src)).filter((f) => f.rule === SITE_ESCAPE_RULE_ID.id), []);
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
  const bad = caught(parse(src(50))).filter((f) => f.rule === SITE_AREA_RULE_ID.id);
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.level, "caution");
  assert.match(bad[0]!.message, /Declared and derived site areas disagree: declared 50 m2 \/ derived 100\.00 m2/);
  assert.deepEqual(caught(parse(src(100))).filter((f) => f.rule === SITE_AREA_RULE_ID.id), []);
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

// ---- 機械形式の版と決定性 (ADR-0036) ----

test("canonical JSON: the document names its own format version first, and the language version only when it was declared", () => {
  const src = "unit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2";
  const declared = JSON.parse(toCanonical(parse(`koyu 0.5\n${src}`))) as Record<string, unknown>;
  assert.equal(Object.keys(declared)[0], "format", "the first key names the format");
  assert.equal(declared["format"], CANONICAL_FORMAT);
  assert.equal(declared["koyu"], "0.5");
  // 版宣言を省いたファイルに最新版を刻まない — 著者が書いていない版を名乗らせないためであり、
  // ツールの既定が動いた日に同じ入力のバイトが変わらないためである
  const omitted = JSON.parse(toCanonical(parse(src))) as Record<string, unknown>;
  assert.equal(omitted["format"], CANONICAL_FORMAT);
  assert.ok(!("koyu" in omitted), "an undeclared language version is not stamped into the machine format");
});

test("canonical JSON: the top-level keys are in the fixed schema order, and the source-derived keys are collated", () => {
  const m = parse(
    [
      "koyu 0.5",
      "name 版と並び",
      "unit mm",
      "grid X 0 4000 8000",
      "grid Y 0 4000",
      "level L1 0 h:2400",
      "asset SD1 door w:800",
      "space /L1/b room X2..X3 Y1..Y2 name:B spec:RC acme.x:1",
      "space /L1/a room X1..X2 Y1..Y2",
      "zone /L1 name:一階",
      "polygon /site -1000,-1000 9000,-1000 9000,5000",
      "column 600 L1",
      "boundary /L1/a /L1/b",
    ].join("\n"),
  );
  const doc = JSON.parse(toCanonical(m)) as Record<string, Record<string, unknown>>;
  // 最上位はスキーマが決める固定順である (照合順ではない — grid は unit の後に来る)
  assert.deepEqual(Object.keys(doc), [
    "format",
    "koyu",
    "name",
    "unit",
    "grid",
    "levels",
    "assets",
    "polygons",
    "columns",
    "zones",
    "spaces",
    "boundaries",
  ]);
  // 原本に由来するキー (パス・属性キー) は照合順である
  assert.deepEqual(Object.keys(doc["spaces"]!), ["/L1/a", "/L1/b"]);
  assert.deepEqual(Object.keys(doc["spaces"]!["/L1/b"] as Record<string, unknown>), ["type", "at", "attrs"]);
  assert.deepEqual(Object.keys((doc["spaces"]!["/L1/b"] as { attrs: object }).attrs), [
    "acme.x",
    "name",
    "spec",
  ]);
});

test("canonical JSON: the collation is the UTF-8 byte order of the emitted document, not the UTF-16 order of JavaScript", () => {
  // 𠮟 (U+20B9F) は代用対なので JavaScript の既定の sort では 﨑 (U+FA11) より前に来るが、
  // UTF-8 では EF… (﨑) が F0… (𠮟) より前である。どちらも日本語の実在の字である
  const astral = "\u{20B9F}";
  const compat = "﨑";
  assert.ok(astral < compat, "the premise: JavaScript's default order puts the astral character first");
  assert.deepEqual([astral, compat].sort(), [astral, compat], "the premise: so does Array#sort");
  assert.ok(compareCanonical(compat, astral) < 0, "the canonical order follows the UTF-8 bytes");

  const m = parse(
    [
      "koyu 0.5",
      "unit mm",
      "grid X 0 4000 8000",
      "grid Y 0 4000",
      "level L1 0",
      `space /L1/${astral} room X1..X2 Y1..Y2`,
      `space /L1/${compat} room X2..X3 Y1..Y2`,
    ].join("\n"),
  );
  const paths = Object.keys((JSON.parse(toCanonical(m)) as { spaces: object }).spaces);
  assert.deepEqual(paths, [`/L1/${compat}`, `/L1/${astral}`]);
  // 出た文書は、自分自身のバイトの昇順に並んでいる
  const json = toCanonical(m);
  assert.ok(json.indexOf(compat) < json.indexOf(astral));
});

test("canonical JSON: a numeric-looking level or asset name still lands in collation order", () => {
  // A plain JavaScript object keeps integer-like keys ahead of the rest, in ascending numeric
  // order, whatever order they were inserted in. So `Object.fromEntries` silently undid a correct
  // sort and a level named `2` came out before one named `10`, while collation order — which this
  // format promises — puts `10` first. `check` stayed green throughout.
  const m = parse(
    [
      "koyu 1.1",
      "unit mm",
      "grid X 0 4000",
      "grid Y 0 4000",
      "level 10 3000 h:2700 slab:150",
      "level 2 0 h:2700 slab:150",
      "asset 10 door w:800",
      "asset 2 door w:900",
      "space /2/a room X1..X2 Y1..Y2",
    ].join("\n"),
  );
  // **The order has to be read off the text.** `JSON.parse` hands back a plain object, so
  // `Object.keys` on it re-applies the very rule this test is about — the parsed view says
  // `["2", "10"]` however the bytes are ordered.
  const json = toCanonical(m);
  const keysUnder = (section: string): string[] => {
    const at = json.indexOf(`"${section}": {`);
    assert.ok(at >= 0, `${section} is missing`);
    const body = json.slice(at, json.indexOf("\n  },", at));
    return [...body.matchAll(/^    "([^"]+)": /gm)].map((mm) => mm[1]!);
  };
  assert.deepEqual(keysUnder("levels"), ["10", "2"], "levels");
  assert.deepEqual(keysUnder("assets"), ["10", "2"], "assets");
});

test("canonical JSON: compareCanonical agrees with comparing the UTF-8 bytes (the reference for another implementation)", () => {
  const corpus = [
    "",
    "a",
    "ab",
    "A",
    "/L1/a",
    "/L1/ab",
    "居室",
    "居間",
    "が",
    "か",
    "﨑",
    "\u{20B9F}",
    "\u{1F3E0}",
    "�",
    "㎡",
    "①",
    "z﨑",
    "z\u{20B9F}",
  ];
  for (const a of corpus) {
    for (const b of corpus) {
      const bytes = Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
      assert.equal(
        Math.sign(compareCanonical(a, b)),
        Math.sign(bytes),
        `compareCanonical(${JSON.stringify(a)}, ${JSON.stringify(b)}) disagrees with the UTF-8 bytes`,
      );
    }
  }
});

test("parse: text is read as NFC, so a composed character and its decomposition are the same name", () => {
  const nfc = "が"; // が
  const nfd = "が"; // か + 濁点
  assert.notEqual(nfc, nfd, "the premise: the two spellings are different strings");
  const src = (s: string) =>
    `koyu 0.5\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:${s}室`;
  assert.equal(toCanonical(parse(src(nfd))), toCanonical(parse(src(nfc))), "the same name gives the same bytes");
  // 同一性も NFC で決まる — 見分けのつかない二つのパスは、二つの空間ではなく重複である
  assert.throws(
    () =>
      parse(
        `koyu 0.5\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/${nfc} room X1..X2 Y1..Y2\nspace /L1/${nfd} room X2..X3 Y1..Y2`,
      ),
    /Duplicate space path/,
  );
});

test("parse: the normalization is NFC and not NFKC (㎡ and ① are not rewritten)", () => {
  const m = parse(
    `koyu 0.5\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:①号室 acme.note:㎡`,
  );
  const json = toCanonical(m);
  assert.match(json, /"name": "①号室"/);
  assert.match(json, /"acme\.note": "㎡"/);
});
