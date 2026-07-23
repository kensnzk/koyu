// 合成 (ADR-0010) — import・アセット参照 (Reference/Instance)・明示位置とはみ出し検査・
// 一棟マージ時のコンフリクト検出。examples/house/ が実証モデル。

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { toCanonical, zoneAreaM2 } from "../src/model.js";
import { parse, parseFile } from "../src/parse.js";

const mainPath = fileURLToPath(
  new URL("../examples/house/main.muro", import.meta.url),
);

// ---- 合成: examples/house/ ----

test("import合成: 5ファイルが一棟にビルドされ整合する", () => {
  const m = parseFile(mainPath);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(m.spaces.size, 13);
  assert.equal(zoneAreaM2(m, "/home"), 92.75); // 単一ファイル版 house.muro と同じ答え
});

test("import合成: 空間に出所ファイルが記録される", () => {
  const m = parseFile(mainPath);
  assert.match(m.spaces.get("/home/ldk")!.file ?? "", /L1\.muro$/);
  assert.match(m.spaces.get("/home/bed1")!.file ?? "", /L2\.muro$/);
  assert.match(m.spaces.get("/site/garden")!.file ?? "", /site\.muro$/);
});

test("import合成: 同一ファイルの二重importは一度だけ読み込まれる", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-"));
  writeFileSync(join(dir, "a.muro"), "space /a room X1..X2 Y1..Y2 level:L1\n");
  writeFileSync(
    join(dir, "main.muro"),
    [
      "koyu 0.1",
      "name 二重import",
      "unit mm",
      "grid X 0 3640",
      "grid Y 0 3640",
      "level L1 0 h:2400",
      "import ./a.muro",
      "import ./a.muro",
    ].join("\n"),
  );
  const m = parseFile(join(dir, "main.muro"));
  assert.equal(m.spaces.size, 1); // 重複エラーにならず、冪等
});

// ---- コンフリクト検出 ----

function compose(files: Record<string, string>): () => void {
  const dir = mkdtempSync(join(tmpdir(), "koyu-"));
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body);
  return () => parseFile(join(dir, "main.muro"));
}

const BASE = [
  "koyu 0.1",
  "name コンフリクト",
  "unit mm",
  "grid X 0 3640",
  "grid Y 0 3640",
  "level L1 0 h:2400",
].join("\n");

test("コンフリクト: 別ファイル間の空間パス重複は出所つきでエラー", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro`,
    "a.muro": "space /r room X1..X2 Y1..Y2 level:L1\n",
    "b.muro": "space /r office X1..X2 Y1..Y2 level:L1\n",
  });
  assert.throws(run, /空間パスが重複.*\/r.*既出.*a\.muro/s);
});

test("コンフリクト: アセット名の重複もエラー", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro`,
    "a.muro": "asset D1 door w:900 h:2100\n",
    "b.muro": "asset D1 door w:800 h:2000\n",
  });
  assert.throws(run, /アセット名が重複.*D1.*既出.*a\.muro/s);
});

test("コンフリクト: グリッドの二重宣言はエラー (基盤はbase層が一度だけ持つ)", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro`,
    "a.muro": "grid X 0 5000\n",
  });
  assert.throws(run, /grid X は一度だけ宣言します/);
});

// ---- アセット参照 (Reference/Instance) ----

test("アセット参照: door SD1 がアセットの寸法・styleを引き継ぐ", () => {
  const m = parseFile(mainPath);
  const b = [...m.boundaries.values()].find(
    (x) => x.a === "/home/ldk" && x.b === "/home/hall1",
  )!;
  const d = b.openings[0]!;
  assert.equal(d.ref, "SD1");
  assert.equal(d.w, 800);
  assert.equal(d.h, 2000);
  assert.equal(d.attrs["style"], "sliding");
});

test("アセット参照: インスタンス側の属性がアセットを上書きする", () => {
  const m = parseFile(mainPath);
  const b = [...m.boundaries.values()].find(
    (x) => x.a === "/home/bed1" && x.b === "/out/road",
  )!;
  const w = b.openings[0]!;
  assert.equal(w.ref, "W1");
  assert.equal(w.w, 2600); // アセット由来
  assert.equal(w.attrs["sill"], 800); // インスタンスが sill:0 を上書き
});

test("アセット参照: 未定義アセットはエラー", () => {
  assert.throws(
    () =>
      parse(
        `${BASE}\nspace /a room X1..X2 Y1..Y2 level:L1\nboundary /a /out edge:S t:150\n  door NOPE`,
      ),
    /未定義の建具アセット/,
  );
});

// ---- 明示位置とはみ出し検査 ----

test("明示位置: at:通り芯±寸法 が座標に解決され、正準JSONは表記を保存する", () => {
  const m = parseFile(mainPath);
  const b = [...m.boundaries.values()].find(
    (x) => x.a === "/home/hall1" && x.b === "/site/east",
  )!;
  const d = b.openings[0]!; // 玄関 at:Y2+1820
  assert.equal(d.atRef, "Y2+1820");
  assert.equal(d.atAbs, 3640 + 1820);
  const j = JSON.parse(toCanonical(m));
  const cb = j.boundaries.find(
    (x: { between: [string, string] }) =>
      x.between[0] === "/home/hall1" && x.between[1] === "/site/east",
  );
  assert.equal(cb.openings[0].at, "Y2+1820");
});

test("はみ出し検査: 幅が線分から溢れる位置は許容範囲つきでエラー", () => {
  const model = parse(
    [
      "koyu 0.1",
      "name はみ出し",
      "unit mm",
      "grid X 0 3640 7280",
      "grid Y 0 3640",
      "level L1 0 h:2400",
      "space /a room X1..X2 Y1..Y2 level:L1",
      "space /b room X2..X3 Y1..Y2 level:L1",
      "boundary /a /b t:120",
      "  door w:900 at:Y1+200",
    ].join("\n"),
  );
  const res = check(model);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0]!, /はみ出します.*中心の許容 450〜3190/s);
});

test("はみ出し検査: 軸違いの通り芯参照はエラー (垂直線分にX系)", () => {
  const model = parse(
    [
      "koyu 0.1",
      "name 軸違い",
      "unit mm",
      "grid X 0 3640 7280",
      "grid Y 0 3640",
      "level L1 0 h:2400",
      "space /a room X1..X2 Y1..Y2 level:L1",
      "space /b room X2..X3 Y1..Y2 level:L1",
      "boundary /a /b t:120",
      "  door w:900 at:X1+200",
    ].join("\n"),
  );
  const res = check(model);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0]!, /垂直線分なのでY系/);
});

test("重なり検査: 同じ線分上の2つの開口が重なるとエラー", () => {
  const model = parse(
    [
      "koyu 0.1",
      "name 重なり",
      "unit mm",
      "grid X 0 3640 7280",
      "grid Y 0 3640",
      "level L1 0 h:2400",
      "space /a room X1..X2 Y1..Y2 level:L1",
      "space /b room X2..X3 Y1..Y2 level:L1",
      "boundary /a /b t:120",
      "  door w:900 at:Y1+1000",
      "  door w:900 at:Y1+1400",
    ].join("\n"),
  );
  const res = check(model);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0]!, /重なっています/);
});

test("比率位置は従来どおり動く (at:0.25 は線分内にクランプ)", () => {
  const model = parse(
    [
      "koyu 0.1",
      "name 比率",
      "unit mm",
      "grid X 0 3640 7280",
      "grid Y 0 3640",
      "level L1 0 h:2400",
      "space /a room X1..X2 Y1..Y2 level:L1",
      "space /b room X2..X3 Y1..Y2 level:L1",
      "boundary /a /b t:120",
      "  door w:900 at:0.25",
    ].join("\n"),
  );
  const res = check(model);
  assert.deepEqual(res.errors, []);
});
