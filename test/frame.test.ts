// 測地の枠 (ADR-0057) — `origin` と `azimuth`。
//
// この面の約束は二つある。**書かれたものはそのまま運ばれ、書かれなかったものは既定に落ちない。**
// そして **core はここから何も導出しない** — 枠の有無で Form が一片も動かないことが、
// 「投影は外の道具の仕事である」という線引きの機械による形である。

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive } from "../src/form.js";
import { parseFile } from "../src/parse-file.js";

const BASE = [
  "koyu 1.1",
  "unit mm",
  "grid X 0 3600",
  "grid Y 0 4500",
  "level L1 0 h:2400 slab:150",
  "space /L1/a room X1..X2 Y1..Y2",
].join("\n");

const ORIGIN = "origin epsg:6677 easting:-8000.123 northing:-34000.456";
const src = (...lines: string[]): string => `${BASE}\n${lines.join("\n")}\n`;

/** 一時ディレクトリに層を書き出して合成する (出所つきのエラーを見るため) */
function compose(files: Record<string, string>): () => void {
  const dir = mkdtempSync(join(tmpdir(), "koyu-frame-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return () => parseFile(join(dir, "main.muro"));
}

// ---- 1. 書かれたものは運ばれ、書かれなかったものは既定に落ちない ----

test("frame: both declarations are optional and neither lands as a default", () => {
  const m = parse(`${BASE}\n`);
  assert.equal(m.origin, undefined);
  // **不在は 0 ではない。**0 は「+Y が真北である」という主張で、不在は「向きを知らない」である
  assert.equal(m.azimuth, undefined);
  assert.ok(!toCanonical(m).includes("origin"));
  assert.ok(!toCanonical(m).includes("azimuth"));
});

test("frame: what was written is what comes back, in metres", () => {
  const m = parse(src(`${ORIGIN} elevation:2.35 vertical:6695`, "azimuth Y 347.5"));
  assert.deepEqual(
    { ...m.origin, line: undefined, file: undefined },
    {
      epsg: 6677,
      easting: -8000.123,
      northing: -34000.456,
      elevation: 2.35,
      vertical: 6695,
      line: undefined,
      file: undefined,
    },
  );
  assert.equal(m.azimuth?.deg, 347.5);
});

test("frame: azimuth 0 is a claim, and it is kept apart from absence", () => {
  const declared = parse(src("azimuth Y 0"));
  assert.equal(declared.azimuth?.deg, 0);
  assert.match(toCanonical(declared), /"azimuth": 0/);
  assert.ok(!toCanonical(parse(`${BASE}\n`)).includes("azimuth"));
});

// ---- 2. 正準形式での位置 ----

test("frame: the keys sit between unit and grid, and each is omitted when unwritten", () => {
  const json = toCanonical(parse(src(`${ORIGIN} elevation:2.35 vertical:6695`, "azimuth Y 347.5")));
  const at = (key: string): number => json.indexOf(`"${key}"`);
  assert.ok(at("unit") < at("origin"), "origin follows unit");
  assert.ok(at("origin") < at("azimuth"), "azimuth follows origin");
  assert.ok(at("azimuth") < at("grid"), "grid follows the frame");

  // origin の内側でも鍵ごとに省略される
  const bare = toCanonical(parse(src(ORIGIN)));
  assert.ok(bare.includes(`"epsg": 6677`));
  assert.ok(!bare.includes("elevation"));
  assert.ok(!bare.includes("vertical"));
});

// ---- 3. **core はここから何も導出しない** ----

test("frame: the derived Form is identical with and without a frame", () => {
  // これが「投影は core の仕事ではない」の機械による形である。ここが破れた日、
  // Form の座標が地理座標であるかのように読まれ始める
  const without = derive(parse(`${BASE}\n`));
  const with_ = derive(parse(src(`${ORIGIN} elevation:2.35 vertical:6695`, "azimuth Y 352.4")));
  assert.deepEqual(with_, without);
});

test("frame: bundled tower keeps its Form after gaining a frame", () => {
  const tower = parseFile(new URL("../examples/tower/main.muro", import.meta.url).pathname);
  assert.ok(tower.origin, "tower declares an origin");
  assert.ok(tower.azimuth, "tower declares an azimuth");
  // 枠を持つ実物が、枠を落としても同じ形を出す
  const stripped = { ...tower, origin: undefined, azimuth: undefined };
  assert.deepEqual(derive(tower), derive(stripped));
});

// ---- 4. origin の受け取り方 ----

test("origin: a key outside the ledger is refused, not silently dropped", () => {
  // origin は attrs を持たないので、残ったキーは正準JSONにも痕跡を残さず消える。
  // ここで拒まなければ `eastign:` は「原点の無いモデル」として黙って通る
  assert.throws(
    () => parse(src("origin epsg:6677 eastign:-8000 northing:-34000")),
    /origin carries eastign:, which is not in the ledger/,
  );
});

test("origin: epsg is required and is a whole number", () => {
  assert.throws(() => parse(src("origin easting:-8000 northing:-34000")), /origin requires epsg:/);
  assert.throws(() => parse(src("origin epsg:66.77 easting:-8000 northing:-34000")), /whole number/);
  assert.throws(() => parse(src("origin epsg:0 easting:-8000 northing:-34000")), /positive number/);
});

test("origin: easting and northing are a pair", () => {
  for (const half of ["easting:-8000", "northing:-34000"]) {
    assert.throws(
      () => parse(src(`origin epsg:6677 ${half}`)),
      /requires easting: and northing: together/,
      half,
    );
  }
});

test("origin: a height is refused unless the datum it is measured from is written", () => {
  // 無資格の高さは無いより悪い。日本では T.P./A.P./O.P./Y.P. が1m超違い、
  // 楕円体高と正標高はジオイド高だけ違う
  assert.throws(() => parse(src(`${ORIGIN} elevation:2.35`)), /written together/);
  assert.throws(() => parse(src(`${ORIGIN} vertical:6695`)), /written together/);
  assert.throws(() => parse(src(`${ORIGIN} elevation:2.35 vertical:669.5`)), /whole number/);
  assert.ok(parse(src(`${ORIGIN} elevation:2.35 vertical:6695`)).origin?.elevation === 2.35);
});

test("origin: the magnitude bound is a rule of the format, not of geodesy", () => {
  // 正準形式は指数表記を使わないと約束している
  assert.throws(() => parse(src("origin epsg:6677 easting:99999999 northing:-34000")), /out of range/);
  assert.throws(() => parse(src("origin epsg:6677 easting:-8000 northing:-99999999")), /out of range/);
  assert.throws(() => parse(src(`${ORIGIN} elevation:99999 vertical:6695`)), /out of range/);
});

// ---- 5. azimuth の受け取り方 ----

test("azimuth: it is a bearing, so it takes the axis it is the bearing of", () => {
  assert.throws(() => parse(src("azimuth 347.5")), /azimuth takes the form azimuth Y <degrees>/);
  assert.throws(() => parse(src("azimuth X 347.5")), /azimuth takes the form azimuth Y <degrees>/);
  assert.throws(() => parse(src("azimuth Y")), /takes one value/);
  assert.throws(() => parse(src("azimuth Y 347.5 latest")), /takes one value/);
});

test("azimuth: out of range is refused with the answer, never folded", () => {
  // **畳めば誤りが隠れる。**370 を 10 にしてしまえば、書いた人は自分の間違いを知る機会を失う
  assert.throws(() => parse(src("azimuth Y -12.5")), /0 <= v < 360: -12\.5 \(write 347\.5\)/);
  assert.throws(() => parse(src("azimuth Y 370")), /0 <= v < 360: 370/);
  // 360 は 0 の二つ目の綴りなので受けない
  assert.throws(() => parse(src("azimuth Y 360")), /0 <= v < 360: 360/);
  assert.equal(parse(src("azimuth Y 359.999")).azimuth?.deg, 359.999);
});

// ---- 6. 合成 — 一つのモデルは一つの枠を持つ ----

test("frame: a second declaration is an error naming where the first was", () => {
  assert.throws(
    compose({
      "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro\n`,
      "a.muro": `${ORIGIN}\n`,
      "b.muro": `${ORIGIN}\n`,
    }),
    /Duplicate origin: a model has one frame.*first seen.*a\.muro/s,
  );
  assert.throws(
    compose({
      "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro\n`,
      "a.muro": "azimuth Y 10\n",
      "b.muro": "azimuth Y 20\n",
    }),
    /Duplicate azimuth: a model has one frame.*first seen.*a\.muro/s,
  );
});

test("frame: the layer it is written in does not change the building", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-frame-"));
  writeFileSync(join(dir, "main.muro"), `${BASE}\nimport ./survey.muro\n`);
  writeFileSync(join(dir, "survey.muro"), `${ORIGIN}\nazimuth Y 347.5\n`);
  const layered = parseFile(join(dir, "main.muro"));
  const flat = parse(src(ORIGIN, "azimuth Y 347.5"));
  assert.equal(toCanonical(layered), toCanonical(flat));
});

test("frame: neither can be overridden nor removed", () => {
  // 今日これが通るのは resolveOverTarget と applyDrop が `/path` を要求するからで、
  // 偶然そうなっているだけである。約束にするために固定する
  assert.throws(() => parse(src(ORIGIN, "over origin epsg:6678")), /over takes the form/);
  assert.throws(() => parse(src("azimuth Y 10", "drop azimuth")), /drop takes the form/);
});

// ---- 7. SIT06 — 位置だけでは配置できない ----

test("SIT06: origin without azimuth warns, and the reverse does not", () => {
  // BND08 is scenery here: the fixture names no outside, so it draws one (ADR-0065)
  const frameCodes = (source: string) =>
    checkDiagnostics(parse(source)).filter((d) => d.code !== "BND08");
  const half = frameCodes(src(ORIGIN));
  assert.deepEqual(
    half.map((d) => [d.code, d.severity]),
    [["SIT06", "warning"]],
  );
  assert.ok(half[0]!.line !== undefined, "the warning points at the line that wrote the origin");

  // 向きだけを知っているのは完結した言明である
  assert.deepEqual(frameCodes(src("azimuth Y 347.5")), []);
  assert.deepEqual(frameCodes(src(ORIGIN, "azimuth Y 347.5")), []);
});
