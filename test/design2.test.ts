// L字領域・ゾーン・吹抜け (void)・採光 — 2026-07-23 後半の設計の検証

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, checkDiagnostics } from "../src/core/diagnose.js";
import { doorsBetween, segmentsFor } from "../src/core/graph.js";
import { daylightInputs } from "../src/core/light.js";
import { DAYLIGHT_RATIO_RULE_ID } from "../src/validate/builtin/index.js";
import { caught } from "./helpers/schematic.js";
import { areaM2, effectiveAttr } from "../src/core/model.js";
import { isVoid } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";

const mansion = readFileSync(
  fileURLToPath(new URL("../examples/mansion.muro", import.meta.url)),
  "utf8",
);
const office = readFileSync(
  fileURLToPath(new URL("../examples/office.muro", import.meta.url)),
  "utf8",
);

test("an L-shaped room: the LDK is the union of two rectangles and its area is the sum", () => {
  const m = parse(mansion);
  const ldk = m.spaces.get("/L2/A/ldk")!;
  assert.equal(ldk.rects.length, 2);
  assert.equal(areaM2(ldk), 17.08);
});

test("the perimeter of an L: collinear edges merge into one, so a full-height window fits", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/L2/A/balcony")!;
  const segs = segmentsFor(m, b);
  assert.equal(segs.length, 1); // LDKの2矩形のS辺がバルコニーに対し1本にマージ
  assert.equal(segs[0]!.x1, 0);
  assert.equal(segs[0]!.x2, 5800);
});

test("several segments for one pair: the LDK and the bedroom touch on two edges of the L, and edge picks the one the door sits on", () => {
  const m = parse(mansion);
  const b = m.boundaries.find((x) => x.a === "/L2/A/ldk" && x.b === "/L2/A/bedroom")!;
  assert.equal(segmentsFor(m, b).length, 2); // 縦 (W) と横 (N)
  const r = check(m);
  assert.deepEqual(r.errors, []); // door edge:W で曖昧が解けている
});

test("an attribute inherited from the zone: the rooms of a layout inherit the dwelling's lease category", () => {
  const m = parse(mansion);
  const at = (path: string) => effectiveAttr(m, m.spaces.get(path)!, "lease.category");
  assert.equal(at("/L2/A/ldk"), "exclusive");
  assert.equal(at("/L2/B"), "exclusive");
  assert.equal(at("/L2/corridor"), "common");
  // The key is the caller's, so a key nobody wrote resolves to nothing rather than to a default.
  assert.equal(effectiveAttr(m, m.spaces.get("/L2/A/ldk")!, "fire.compartment"), undefined);
});

test("void: the height invariant is exempted declaratively by a void boundary", () => {
  const m = parse(office);
  const r = check(m);
  assert.deepEqual(r.errors, []); // hall h:6700 は L2 に食い込むが void で免除
  assert.deepEqual(r.warnings, []);
});

test("the void exemption does not work without a void boundary", () => {
  const m = parse(office.replace("boundary /L1/hall /L2/void type:void", ""));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("collides into the floor above")));
});

test("a void is not passable and does not count toward floor area", () => {
  const m = parse(office);
  assert.equal(doorsBetween(m, "/L1/hall", "/L2/void"), undefined);
  const total = [...m.spaces.values()]
    .filter((s) => !isVoid(s))
    .reduce((sum, s) => sum + (areaM2(s) ?? 0), 0);
  assert.equal(Math.round(total * 100) / 100, 419.84); // 460.8 - 40.96 (吹抜け)
});

test("daylight: all 51 rooms meet 1/7, and through a balcony the factor is 0.7", () => {
  const m = parse(mansion);
  const results = daylightInputs(m);
  assert.equal(results.length, 51); // (LDK+洋室)×8 + B〜E×8 + PH×3
  // 合否は core ではなく検証の面が言う (spec/scope.md §4)
  assert.deepEqual(caught(m).filter((f) => f.rule === DAYLIGHT_RATIO_RULE_ID.id), []);
  const ldk = results.find((r) => r.space.path === "/L5/A/ldk")!;
  assert.equal(Math.round(ldk.window * 1000) / 1000, 4.004); // 5.72 × 0.7
});

test("daylight: losing the window fails it", () => {
  const m = parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
`);
  const r = daylightInputs(m);
  assert.equal(r.length, 1);
  assert.equal(Math.round(r[0]!.window * 100) / 100, 0.36);
  // core は数を返すだけ。1/7 に足りないという判定は検証の面が言う
  const short = caught(m).filter((f) => f.rule === DAYLIGHT_RATIO_RULE_ID.id);
  assert.equal(short.length, 1); // 0.36㎡ < 16.2/7
  assert.equal(short[0]!.level, "violation");
});

// ---- 居室は宣言である (ADR-0020) ----

/** 型だけを差し替えられる採光の稽古台。daylight は呼び出し側が付ける */
const daylightSrc = (space: string) => `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out outside:1
${space}
boundary /L1/a /out t:150
  window w:2600 h:2200 edge:S
`;

test("daylight: only daylight:1 is in scope — the type is never looked at", () => {
  // かつて採光の対象と推定された五つの型は、daylight が無ければ対象外になる
  for (const type of ["unit", "room", "ldk", "bedroom", "living"]) {
    const m = parse(daylightSrc(`space /L1/a ${type} X1..X2 Y1..Y2`));
    assert.deepEqual(check(m).errors, [], type);
    assert.equal(daylightInputs(m).length, 0, `${type} is out of scope without the declaration`);
  }
  // 型が自由語でも、daylight:1 を書けば対象になる
  const wet = parse(daylightSrc("space /L1/a wet X1..X2 Y1..Y2 daylight:1"));
  assert.equal(daylightInputs(wet).length, 1);
  assert.deepEqual(caught(wet).filter((f) => f.rule === DAYLIGHT_RATIO_RULE_ID.id), []);
  // daylight:0 は既定と同じ (明記しても対象外)
  assert.equal(daylightInputs(parse(daylightSrc("space /L1/a room X1..X2 Y1..Y2 daylight:0"))).length, 0);
});

test("daylight: the denominator is decided by where daylight:1 is written (a whole dwelling / room by room)", () => {
  const head = `
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out outside:1
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
  assert.equal(daylightInputs(whole).length, 1); // 住戸まるごとが一室
  assert.equal(daylightInputs(split).length, 2); // 割れば室ごと
  assert.equal(Math.round(daylightInputs(whole)[0]!.floor * 100) / 100, 32.4);
});

test("diagnostic: DAY01 — the value of daylight is only 0 or 1 (a misspelling does not silently fall through)", () => {
  for (const v of ["yes", "true", "2", "-1"]) {
    const d = checkDiagnostics(parse(daylightSrc(`space /L1/a room X1..X2 Y1..Y2 daylight:${v}`)));
    assert.deepEqual(d.map((x) => x.code), ["DAY01"], `daylight:${v}`);
    assert.equal(d[0]!.severity, "error");
    assert.deepEqual(d[0]!.path, ["/L1/a"]);
  }
  assert.deepEqual(checkDiagnostics(parse(daylightSrc("space /L1/a room X1..X2 Y1..Y2 daylight:1"))), []);
});

test("version: 0.3 and earlier are accepted only where the meaning is preserved — a type that used to be inferred needs daylight (VER02)", () => {
  const src = (v: string, dl: string) =>
    `koyu ${v}\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\nspace /L1/a room X1..X2 Y1..Y2${dl}`;
  // BND08 is scenery: the fixture names no outside, so it draws one at every version (ADR-0065)
  const codes = (source: string) =>
    checkDiagnostics(parse(source)).filter((x) => x.code !== "BND08");
  for (const v of ["0.1", "0.2", "0.3"]) {
    const d = codes(src(v, ""));
    assert.deepEqual(d.map((x) => x.code), ["VER02"], v);
    assert.match(d[0]!.message, /raise the version to koyu 0\.4/);
    // daylight が明示されていれば新旧で意味が同じなので、旧版のまま受理される
    assert.deepEqual(codes(src(v, " daylight:1")), [], `${v} daylight:1`);
    assert.deepEqual(codes(src(v, " daylight:0")), [], `${v} daylight:0`);
  }
  // 0.4 と、版宣言を省いたファイル (=最新版で読む) には出ない
  assert.deepEqual(codes(src("0.4", "")), []);
  // 推定対象でなかった型は旧版でも意味が変わらない
  assert.deepEqual(
    codes("koyu 0.3\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\nspace /L1/a hall X1..X2 Y1..Y2"),
    [],
  );
});
