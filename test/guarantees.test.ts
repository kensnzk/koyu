// 意味の保証 (ADR-0013) — 外部レビュー (docs/reviews/2026-07-25) のP0回収。
// 正準JSONの無損失と正準順、境界の同一性、凹敷地の包含、敷地形状の妥当性、
// 宣言面積の照合、同一行の属性重複、言語版の検証、レイヤー記録の完全性。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/check.js";
import { toCanonical } from "../src/model.js";
import { parse, parseFiles } from "../src/parse.js";

const BASE = [
  "koyu 0.4",
  "unit mm",
  "grid X 0 4000 8000",
  "grid Y 0 4000 8000",
  "level L1 0 h:2400",
].join("\n");

// ---- 正準JSON: 無損失 ----

test("正準JSON: 境界の向き (a) が保存され、swingの意味がJSONだけで復元できる", () => {
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

test("正準JSON: segの明示位置も書かれた表記のまま保存される", () => {
  const m = parse(
    `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/n room X1..X2 Y2..Y3\nboundary /L1/z /L1/n t:100\n  seg w:1000 at:X1+2000`,
  );
  assert.match(toCanonical(m), /"at": "X1\+2000"/);
});

// ---- 正準JSON: 宣言順に依らない ----

test("正準JSON: 開口の宣言順はバイト列を変えない", () => {
  const src = (doors: string) =>
    `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/a room X2..X3 Y1..Y2\nboundary /L1/z /L1/a\n${doors}`;
  const j1 = toCanonical(parse(src("  door w:700 at:0.25\n  door w:700 at:0.75")));
  const j2 = toCanonical(parse(src("  door w:700 at:0.75\n  door w:700 at:0.25")));
  assert.equal(j1, j2);
});

test("正準JSON: 同じ空間対の境界 (edge違い) の宣言順もバイト列を変えない", () => {
  const src = (bounds: string) =>
    `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out exterior\n${bounds}`;
  const j1 = toCanonical(parse(src("boundary /L1/a /out edge:N t:100\nboundary /L1/a /out edge:S t:150")));
  const j2 = toCanonical(parse(src("boundary /L1/a /out edge:S t:150\nboundary /L1/a /out edge:N t:100")));
  assert.equal(j1, j2);
});

// ---- 境界の同一性 ----

test("check: 同じ空間対の境界の重複はエラー (wall/open矛盾を含む)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/a /L1/b\nboundary /L1/a /L1/b type:open`,
    ),
  );
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /境界が重複しています: \/L1\/a \| \/L1\/b/);
  assert.match(r.errors[0]!, /既出/);
});

test("check: 同じ空間対でもedgeが違えば別の境界 (エラーにしない)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/a room X2..X3 Y1..Y2\nspace /out exterior\nboundary /L1/a /out edge:N\nboundary /L1/a /out edge:S`,
    ),
  );
  assert.deepEqual(r.errors, []);
});

test("check: edge限定の有無が混在する対は警告 (線分が重なる)", () => {
  const r = check(
    parse(
      `${BASE}\nspace /L1/z room X1..X2 Y1..Y2\nspace /L1/n room X1..X2 Y2..Y3\nboundary /L1/z /L1/n\nboundary /L1/z /L1/n edge:N t:200`,
    ),
  );
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join("\n"), /edge 限定つきと無しの境界が併存/);
});

// ---- 敷地: 凹多角形の包含と形の妥当性 ----

test("check: 凹敷地 (U字) を跨ぐ建物は四隅が内側でもエラー", () => {
  const src = `koyu 0.4
unit mm
grid X 0 2000 28000 30000
grid Y 0 2000 6000 12000 20000
level L1 0
zone /site site:1
polygon /site 0,0 30000,0 30000,20000 20000,20000 20000,8000 10000,8000 10000,20000 0,20000
space /L1/hall room X2..X3 Y2..Y4`;
  const r = check(parse(src));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /\/L1\/hall が敷地形状からはみ出しています/);
});

test("check: 建物の角が敷地境界線上に載るのは内側扱い (エラーにしない)", () => {
  const src = `${BASE}
zone /site site:1
polygon /site 0,0 8000,0 8000,8000 0,8000
space /L1/a room X1..X3 Y1..Y3`;
  const r = check(parse(src));
  assert.deepEqual(r.errors, []);
});

test("check: 敷地形状の自己交差と重複頂点はエラー", () => {
  const bow = check(parse(`${BASE}\nzone /site site:1\npolygon /site 0,0 8000,8000 8000,0 0,8000`));
  assert.match(bow.errors.join("\n"), /敷地形状が自己交差しています/);
  const dup = check(parse(`${BASE}\nzone /site site:1\npolygon /site 0,0 0,0 8000,0 0,8000`));
  assert.match(dup.errors.join("\n"), /敷地形状に重複する頂点があります/);
});

test("check: 敷地面積の宣言と導出の食い違いは警告", () => {
  const src = (area: number) =>
    `${BASE}\nzone /site site:1 area:${area}\npolygon /site 0,0 10000,0 10000,10000 0,10000`;
  const bad = check(parse(src(50)));
  assert.match(bad.warnings.join("\n"), /敷地面積の宣言と導出が食い違います: 宣言 50㎡ \/ 導出 100\.00㎡/);
  const good = check(parse(src(100)));
  assert.equal(good.warnings.some((w) => w.includes("敷地面積の宣言と導出")), false);
});

// ---- 字句・版 ----

test("parse: 同一行の属性キーの重複はエラー (後勝ちで隠さない)", () => {
  assert.throws(
    () => parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 use:first use:second`),
    /属性キーが重複しています: use/,
  );
});

test("parse: 対応しないkoyu版はエラー", () => {
  assert.throws(() => parse("koyu 0.9\nunit mm"), /対応していないkoyuの版です: 0\.9/);
});

// ---- 合成: レイヤー記録の完全性 ----

test("合成: grid/levelだけのレイヤーもlayersに記録される", () => {
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

test("正準JSON: 明示のlevel:は保存される (無いとJSONから所属が復元できない)", () => {
  const mez = parse(
    "koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nlevel L2 3000\nspace /Z/a room X1..X2 Y1..Y2 level:L1",
  );
  assert.match(toCanonical(mez), /"level": "L1"/);
  // パス先頭と同じ所属 (既定) は書かれた綴りに関わらず省略
  const plain = parse("koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2");
  assert.doesNotMatch(toCanonical(plain), /"level"/);
});

test("正準JSON: 領域の逆順表記 (X2..X1) は昇順に正規化され、同じ矩形は同じバイト列", () => {
  const src = (r: string) => `koyu 0.4\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room ${r}`;
  assert.equal(toCanonical(parse(src("X2..X1 Y2..Y1"))), toCanonical(parse(src("X1..X2 Y1..Y2"))));
});

test("parse: 数値必須の属性に非数値を書くとエラー (NaNの黙認はしない)", () => {
  assert.throws(
    () => parse("koyu 0.4\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0 h:24O0"),
    /属性 h は数値で書きます: 24O0/,
  );
});

test("parse: 裸のnameはエラー", () => {
  assert.throws(() => parse("koyu 0.4\nname\nunit mm"), /name には値を書きます/);
});

test("parse: koyu行は2トークン・一度だけ (版なし・余剰・再宣言はエラー)", () => {
  assert.throws(() => parse("koyu\nunit mm"), /koyu には版を書きます/);
  assert.throws(() => parse("koyu 0.2 extra\nunit mm"), /余分なトークン/);
  assert.throws(() => parse("koyu 0.4\nkoyu 0.4\nunit mm"), /一度だけ宣言します/);
});
