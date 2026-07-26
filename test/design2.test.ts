// L字領域・ゾーン・吹抜け (void)・採光 — 2026-07-23 後半の設計の検証

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, checkDiagnostics } from "../src/check.js";
import { doorsBetween, segmentsFor } from "../src/graph.js";
import { daylight } from "../src/light.js";
import { areaM2, effectiveUse } from "../src/model.js";
import { parse } from "../src/parse.js";

const mansion = readFileSync(
  fileURLToPath(new URL("../examples/mansion.muro", import.meta.url)),
  "utf8",
);
const office = readFileSync(
  fileURLToPath(new URL("../examples/office.muro", import.meta.url)),
  "utf8",
);

test("L字の室: LDKは2矩形の合併で面積は合計", () => {
  const m = parse(mansion);
  const ldk = m.spaces.get("/L2/A/ldk")!;
  assert.equal(ldk.rects.length, 2);
  assert.equal(areaM2(ldk), 17.08);
});

test("L字の外周: 共線の辺は一本にまとまり、掃き出し窓が置ける", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/L2/A/balcony")!;
  const segs = segmentsFor(m, b);
  assert.equal(segs.length, 1); // LDKの2矩形のS辺がバルコニーに対し1本にマージ
  assert.equal(segs[0]!.x1, 0);
  assert.equal(segs[0]!.x2, 5800);
});

test("同一ペアの複数線分: LDK|洋室はL字で2辺接し、edgeで扉の辺を選ぶ", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/L2/A/bedroom")!;
  assert.equal(segmentsFor(m, b).length, 2); // 縦 (W) と横 (N)
  const r = check(m);
  assert.deepEqual(r.errors, []); // door edge:W で曖昧が解けている
});

test("ゾーンのuse継承: 間取りの室は住戸のexclusiveを継ぐ", () => {
  const m = parse(mansion);
  assert.equal(effectiveUse(m, m.spaces.get("/L2/A/ldk")!), "exclusive");
  assert.equal(effectiveUse(m, m.spaces.get("/L2/B")!), "exclusive");
  assert.equal(effectiveUse(m, m.spaces.get("/L2/corridor")!), "common");
});

test("吹抜け: 高さ不変量はvoid境界で宣言的に免除される", () => {
  const m = parse(office);
  const r = check(m);
  assert.deepEqual(r.errors, []); // hall h:6700 は L2 に食い込むが void で免除
  assert.deepEqual(r.warnings, []);
});

test("吹抜けの免除はvoid境界なしでは働かない", () => {
  const m = parse(office.replace("boundary /L1/hall /L2/void type:void", ""));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("食い込み")));
});

test("吹抜けは通行できず、床面積にも入らない", () => {
  const m = parse(office);
  assert.equal(doorsBetween(m, "/L1/hall", "/L2/void"), undefined);
  const total = [...m.spaces.values()]
    .filter((s) => s.type !== "void")
    .reduce((sum, s) => sum + (areaM2(s) ?? 0), 0);
  assert.equal(Math.round(total * 100) / 100, 419.84); // 460.8 - 40.96 (吹抜け)
});

test("採光: 51室すべてが1/7を満たす。バルコニー越しは0.7掛け", () => {
  const m = parse(mansion);
  const results = daylight(m);
  assert.equal(results.length, 51); // (LDK+洋室)×8 + B〜E×8 + PH×3
  assert.ok(results.every((r) => r.ok));
  const ldk = results.find((r) => r.space.path === "/L5/A/ldk")!;
  assert.equal(Math.round(ldk.window * 1000) / 1000, 4.004); // 5.72 × 0.7
});

test("採光: 窓を失えば落ちる", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
`);
  const r = daylight(m);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.ok, false); // 0.36㎡ < 16.2/7
});

// ---- 居室は宣言である (ADR-0020) ----

/** 型だけを差し替えられる採光の稽古台。daylight は呼び出し側が付ける */
const daylightSrc = (space: string) => `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
${space}
boundary /L1/a /out t:150
  window w:2600 h:2200 edge:S
`;

test("採光: 対象は daylight:1 だけ — 型は一切見ない", () => {
  // かつて採光の対象と推定された五つの型は、daylight が無ければ対象外になる
  for (const type of ["unit", "room", "ldk", "bedroom", "living"]) {
    const m = parse(daylightSrc(`space /L1/a ${type} X1..X2 Y1..Y2`));
    assert.deepEqual(check(m).errors, [], type);
    assert.equal(daylight(m).length, 0, `${type} は宣言なしでは対象外`);
  }
  // 型が自由語でも、daylight:1 を書けば対象になる
  const wet = parse(daylightSrc("space /L1/a wet X1..X2 Y1..Y2 daylight:1"));
  assert.equal(daylight(wet).length, 1);
  assert.equal(daylight(wet)[0]!.ok, true);
  // daylight:0 は既定と同じ (明記しても対象外)
  assert.equal(daylight(parse(daylightSrc("space /L1/a room X1..X2 Y1..Y2 daylight:0"))).length, 0);
});

test("採光: 判定の分母は daylight:1 を書いた位置で決まる (住戸まるごと / 室ごと)", () => {
  const head = `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
`;
  const whole = parse(`${head}space /L1/a unit X1..X3 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:2600 h:2200 edge:S`);
  const split = parse(`${head}zone /L1/a
space /L1/a/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/a/bed bedroom X2..X3 Y1..Y2 daylight:1
boundary /L1/a/ldk /out t:150
  window w:2600 h:2200 edge:S
boundary /L1/a/bed /out t:150
  window w:2600 h:2200 edge:S`);
  assert.equal(daylight(whole).length, 1); // 住戸まるごとが一室
  assert.equal(daylight(split).length, 2); // 割れば室ごと
  assert.equal(Math.round(daylight(whole)[0]!.floor * 100) / 100, 32.4);
});

test("診断: DAY01 — daylight の値は 0/1 に限る (綴りの揺れで黙って落ちない)", () => {
  for (const v of ["yes", "true", "2", "-1"]) {
    const d = checkDiagnostics(parse(daylightSrc(`space /L1/a room X1..X2 Y1..Y2 daylight:${v}`)));
    assert.deepEqual(d.map((x) => x.code), ["DAY01"], `daylight:${v}`);
    assert.equal(d[0]!.severity, "error");
    assert.deepEqual(d[0]!.path, ["/L1/a"]);
  }
  assert.deepEqual(checkDiagnostics(parse(daylightSrc("space /L1/a room X1..X2 Y1..Y2 daylight:1"))), []);
});

test("版: 0.3以前は意味保存の場合のみ受理 — 推定対象だった型に daylight が要る (VER02)", () => {
  const src = (v: string, dl: string) =>
    `koyu ${v}\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2${dl}`;
  for (const v of ["0.1", "0.2", "0.3"]) {
    const d = checkDiagnostics(parse(src(v, "")));
    assert.deepEqual(d.map((x) => x.code), ["VER02"], v);
    assert.match(d[0]!.message, /koyu 0\.4 へ上げます/);
    // daylight が明示されていれば新旧で意味が同じなので、旧版のまま受理される
    assert.deepEqual(checkDiagnostics(parse(src(v, " daylight:1"))), [], `${v} daylight:1`);
    assert.deepEqual(checkDiagnostics(parse(src(v, " daylight:0"))), [], `${v} daylight:0`);
  }
  // 0.4 と、版宣言を省いたファイル (=最新版で読む) には出ない
  assert.deepEqual(checkDiagnostics(parse(src("0.4", ""))), []);
  // 推定対象でなかった型は旧版でも意味が変わらない
  assert.deepEqual(
    checkDiagnostics(parse("koyu 0.3\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0\nspace /L1/a hall X1..X2 Y1..Y2")),
    [],
  );
});
