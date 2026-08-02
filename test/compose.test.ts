// 合成 (ADR-0010) — import・アセット参照 (Reference/Instance)・明示位置とはみ出し検査・
// 一棟マージ時のコンフリクト検出。examples/house/ が実証モデル。

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { toCanonical, zoneAreaM2 } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { parseFile } from "../src/parse-file.js";

const mainPath = fileURLToPath(
  new URL("../examples/house/main.muro", import.meta.url),
);

// ---- 合成: examples/house/ ----

test("import composition: five files build into one building and stay consistent", () => {
  const m = parseFile(mainPath);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(m.spaces.size, 13);
  assert.equal(zoneAreaM2(m, "/home"), 92.75); // 単一ファイル版 house.muro と同じ答え
});

test("import composition: each space records the file it came from", () => {
  const m = parseFile(mainPath);
  assert.match(m.spaces.get("/home/ldk")!.file ?? "", /L1\.muro$/);
  assert.match(m.spaces.get("/home/bed1")!.file ?? "", /L2\.muro$/);
  assert.match(m.spaces.get("/site/garden")!.file ?? "", /site\.muro$/);
});

test("import composition: importing the same file twice reads it only once", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-"));
  writeFileSync(join(dir, "a.muro"), "space /a room X1..X2 Y1..Y2 level:L1\n");
  writeFileSync(
    join(dir, "main.muro"),
    [
      "koyu 0.4",
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

test("parseFiles: the same composition runs over a virtual file set (for the browser)", () => {
  const m = parseFiles(
    {
      "main.muro": [
        "koyu 0.4",
        "name 仮想合成",
        "unit mm",
        "grid X 0 3640",
        "grid Y 0 3640",
        "level L1 0 h:2400",
        "import ./assets.muro",
        "import ./floors/L1.muro",
      ].join("\n"),
      "assets.muro": "asset D1 door w:800 h:2000 style:sliding\n",
      "floors/L1.muro":
        "space /a room X1..X2 Y1..Y2 level:L1\nboundary /a /out2 edge:S t:150\n  door D1\nspace /out2 outside:1\n",
    },
    "main.muro",
  );
  assert.equal(m.spaces.size, 2);
  const d = m.boundaries[0]!.openings[0]!;
  assert.equal(d.w, 800);
  assert.equal(d.attrs["style"], "sliding");
  assert.equal(m.spaces.get("/a")!.file, "floors/L1.muro"); // キーがそのまま出所になる
});

test("parseFiles: importing a missing file is an error on that line", () => {
  assert.throws(
    () =>
      parseFiles(
        {
          "main.muro": "koyu 0.4\nname x\nunit mm\ngrid X 0 1000\ngrid Y 0 1000\nlevel L1 0 h:2400\nimport ./nope.muro",
        },
        "main.muro",
      ),
    /main\.muro:line 7: Cannot read file: \.\/nope\.muro/,
  );
});

test("check: an error on a composed model carries the layer it came from", () => {
  const m = parseFiles(
    {
      "main.muro":
        "koyu 0.4\nname x\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400\nimport ./L1.muro",
      "L1.muro":
        "space /a room X1..X2 Y1..Y2 level:L1\nspace /b room X2..X3 Y1..Y2 level:L1\nboundary /a /b t:120\n  door w:900 at:Y1+200",
    },
    "main.muro",
  );
  const res = check(m);
  assert.equal(res.errors.length, 1);
  assert.match(res.errors[0]!, /^L1\.muro:line 4: At Y1\+200/);
});

// ---- コンフリクト検出 ----

function compose(files: Record<string, string>): () => void {
  const dir = mkdtempSync(join(tmpdir(), "koyu-"));
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body);
  return () => parseFile(join(dir, "main.muro"));
}

const BASE = [
  "koyu 0.4",
  "name コンフリクト",
  "unit mm",
  "grid X 0 3640",
  "grid Y 0 3640",
  "level L1 0 h:2400",
].join("\n");

test("conflict: a space path duplicated across files is an error carrying its origin", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro`,
    "a.muro": "space /r room X1..X2 Y1..Y2 level:L1\n",
    "b.muro": "space /r office X1..X2 Y1..Y2 level:L1\n",
  });
  assert.throws(run, /Duplicate space path.*\/r.*first seen.*a\.muro/s);
});

test("conflict: a duplicated asset name is an error too", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro\nimport ./b.muro`,
    "a.muro": "asset D1 door w:900 h:2100\n",
    "b.muro": "asset D1 door w:800 h:2000\n",
  });
  assert.throws(run, /Duplicate asset name.*D1.*first seen.*a\.muro/s);
});

test("conflict: declaring a grid twice is an error (the base layer holds the foundation once)", () => {
  const run = compose({
    "main.muro": `${BASE}\nimport ./a.muro`,
    "a.muro": "grid X 0 5000\n",
  });
  assert.throws(run, /grid X is declared once/);
});

// ---- アセット参照 (Reference/Instance) ----

test("asset reference: door SD1 inherits the dimensions and style of the asset", () => {
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

test("asset reference: attributes on the instance override the asset", () => {
  const m = parseFile(mainPath);
  const b = [...m.boundaries.values()].find(
    (x) => x.a === "/home/bed1" && x.b === "/out/road",
  )!;
  const w = b.openings[0]!;
  assert.equal(w.ref, "W1");
  assert.equal(w.w, 2600); // アセット由来
  assert.equal(w.attrs["sill"], 800); // インスタンスが sill:0 を上書き
});

test("asset reference: an undefined asset is an error", () => {
  assert.throws(
    () =>
      parse(
        `${BASE}\nspace /a room X1..X2 Y1..Y2 level:L1\nboundary /a /out edge:S t:150\n  door NOPE`,
      ),
    /Undefined opening asset/,
  );
});

// ---- 明示位置とはみ出し検査 ----

test("explicit position: at:gridline+-offset resolves to a coordinate and canonical JSON keeps the notation", () => {
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

test("run-off check: a position whose width spills off the segment is an error carrying the allowed range", () => {
  const model = parse(
    [
      "koyu 0.4",
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
  assert.match(res.errors[0]!, /runs off the boundary segment.*center allowed 450-3190mm/s);
});

test("run-off check: a grid line reference on the wrong axis is an error (an X line on a vertical segment)", () => {
  const model = parse(
    [
      "koyu 0.4",
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
  assert.match(res.errors[0]!, /on the wrong axis: a vertical segment takes a Y grid line/);
});

test("overlap check: two openings overlapping on the same segment is an error", () => {
  const model = parse(
    [
      "koyu 0.4",
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
  assert.match(res.errors[0]!, /Openings overlap/);
});

test("a ratio position still works (at:0.25 is clamped within the segment)", () => {
  const model = parse(
    [
      "koyu 0.4",
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

// ---- Layer identity (rule 1: a layer imported twice is still composed once) ----
//
// Identity is **filesystem identity**. It used to be decided by spelling, so one file arriving
// through a symlink or in different letter case was composed twice and failed with
// `grid X is declared once` — idempotence broke on nothing but how the path was written.

test("layer identity: the same file reached through a symlink is one layer, not two", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-sym-"));
  writeFileSync(
    join(dir, "b.muro"),
    ["grid X 0 3000", "grid Y 0 3000", "level L1 0 h:2700 slab:150", "space /L1/b room X1..X2 Y1..Y2"].join("\n"),
  );
  symlinkSync("b.muro", join(dir, "link.muro"));
  writeFileSync(join(dir, "main.muro"), "koyu 1.1\nimport ./b.muro\nimport ./link.muro\n");

  const m = parseFile(join(dir, "main.muro"));
  assert.deepEqual(check(m).errors, []);
  assert.equal(m.layers.length, 2, "the entry and one layer — the symlink is the same file");
});

test("layer identity: on a case-insensitive filesystem, two spellings are one layer", () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-case-"));
  writeFileSync(
    join(dir, "b.muro"),
    ["grid X 0 3000", "grid Y 0 3000", "level L1 0 h:2700 slab:150", "space /L1/b room X1..X2 Y1..Y2"].join("\n"),
  );
  // On a case-sensitive filesystem B.muro does not exist, so the import cannot be read at all —
  // the premise does not hold there, so skip
  let caseInsensitive = true;
  try {
    readFileSync(join(dir, "B.muro"), "utf8");
  } catch {
    caseInsensitive = false;
  }
  if (!caseInsensitive) return;

  writeFileSync(join(dir, "main.muro"), "koyu 1.1\nimport ./b.muro\nimport ./B.muro\n");
  const m = parseFile(join(dir, "main.muro"));
  assert.deepEqual(check(m).errors, []);
  assert.equal(m.layers.length, 2, "the entry and one layer — the two spellings are the same file");
});
