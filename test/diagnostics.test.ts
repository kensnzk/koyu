// 診断契約 (ADR-0016) — checkDiagnosticsのcode/severity/出所/path/related、
// check互換層 (件数・順序・字面の1:1)、台帳DIAGNOSTIC_CODESとspec表の集合一致、
// CLIの --json / --strict (SourceErrorはSYN01の1件に写して有効JSON)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, checkDiagnostics, DIAGNOSTIC_CODES, type Diagnostic } from "../src/check.js";
import { srcRef } from "../src/model.js";
import { parse, parseFiles } from "../src/parse.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const BASE = [
  "koyu 0.2",
  "unit mm",
  "grid X 0 3640 7280",
  "grid Y 0 3640",
  "level L1 0 h:2400",
].join("\n");

/** 互換層と同じ組み立て — 位置があれば接頭辞、なければ本文のみ */
const fmt = (d: Diagnostic): string =>
  d.line !== undefined ? `${srcRef(d.line, d.file)}: ${d.message}` : d.message;

// ---- (a) 主要コードの発火 ----

test("診断: BND02 境界重複 — line/path/related (既出側) を持つ", () => {
  const diags = checkDiagnostics(
    parse(
      `${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b t:150`,
    ),
  );
  const d = diags.find((x) => x.code === "BND02")!;
  assert.equal(d.severity, "error");
  assert.equal(d.line, 9);
  assert.deepEqual(d.path, ["/L1/a", "/L1/b"]);
  assert.deepEqual(d.related, [{ line: 8 }]);
  assert.match(d.message, /^境界が重複しています/); // 本文に位置接頭辞は無い
});

test("診断: SIT03 敷地はみ出し", () => {
  const diags = checkDiagnostics(
    parse(
      `${BASE}
zone /site site:1
polygon /site -1000,-1000 9000,-1000 9000,9000 -1000,9000
space /a room X1..X3+2000 Y1..Y2 level:L1`,
    ),
  );
  const d = diags.find((x) => x.code === "SIT03")!;
  assert.equal(d.severity, "error");
  assert.equal(d.line, 8);
  assert.deepEqual(d.path, ["/a"]);
  assert.match(d.message, /敷地形状からはみ出しています/);
});

test("診断: UID03 uid重複 — 位置なし (line省略)、全所有者がpath/relatedに載る", () => {
  const diags = checkDiagnostics(
    parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:sp-1x\nspace /L1/b room X2..X3 Y1..Y2 uid:sp-1x`),
  );
  const d = diags.find((x) => x.code === "UID03")!;
  assert.equal(d.severity, "error");
  assert.equal(d.line, undefined);
  assert.deepEqual(d.path, ["/L1/a", "/L1/b"]);
  assert.deepEqual(d.related, [{ line: 6 }, { line: 7 }]);
});

test("診断: VER01 0.1での既定境界導出 — 導出物なので位置なし", () => {
  const diags = checkDiagnostics(
    parse(`koyu 0.1\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0\nspace /L1/a hall X1..X2 Y1..Y2\nspace /L1/b hall X2..X3 Y1..Y2`),
  );
  assert.equal(diags.length, 1);
  const d = diags[0]!;
  assert.equal(d.code, "VER01");
  assert.equal(d.severity, "error");
  assert.equal(d.line, undefined);
  assert.deepEqual(d.path, ["/L1/a", "/L1/b"]);
});

test("診断: placeBandの配置失敗は開口=OPN系・seg=SEG系に分かれる", () => {
  const diags = checkDiagnostics(
    parse(
      `${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
  seg w:99999`,
    ),
  );
  const opn = diags.find((x) => x.code === "OPN08")!;
  assert.equal(opn.line, 9);
  assert.match(opn.message, /はみ出します/);
  const seg = diags.find((x) => x.code === "SEG06")!;
  assert.equal(seg.line, 10);
  assert.match(seg.message, /境界線分の長さ.*超えています/);
});

// ---- (b) check互換層 — 件数・順序・字面の1:1 ----

test("互換: checkはcheckDiagnosticsの写像 (severityで振り分け、位置接頭辞を組み立てる)", () => {
  const sources = [
    // エラー2 (BND02, OPN08) + 警告1 (ZON01)
    `${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
boundary /L1/a /L1/b t:150
zone /empty`,
    // 位置なし診断 (UID03)
    `${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:sp-1x\nspace /L1/b room X2..X3 Y1..Y2 uid:sp-1x`,
    // 敷地 (SIT03) + ZON01
    `${BASE}\nzone /site site:1\npolygon /site -1000,-1000 9000,-1000 9000,9000 -1000,9000\nspace /a room X1..X3+2000 Y1..Y2 level:L1`,
  ];
  for (const src of sources) {
    const m = parse(src);
    const diags = checkDiagnostics(m);
    const r = check(m);
    assert.deepEqual(r.errors, diags.filter((d) => d.severity === "error").map(fmt));
    assert.deepEqual(r.warnings, diags.filter((d) => d.severity === "warning").map(fmt));
    // severityは台帳の不変属性と一致する
    for (const d of diags) assert.equal(d.severity, DIAGNOSTIC_CODES[d.code]);
  }
});

test("互換: 合成モデルの診断はfileを持ち、互換文字列はレイヤー:行の接頭辞になる", () => {
  const m = parseFiles(
    {
      "main.muro":
        "koyu 0.4\nname x\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400\nimport ./L1.muro",
      "L1.muro":
        "space /a room X1..X2 Y1..Y2 level:L1\nspace /b room X2..X3 Y1..Y2 level:L1\nboundary /a /b t:120\n  door w:900 at:Y1+200",
    },
    "main.muro",
  );
  const diags = checkDiagnostics(m);
  assert.equal(diags.length, 1);
  assert.equal(diags[0]!.code, "OPN08");
  assert.equal(diags[0]!.file, "L1.muro");
  assert.equal(diags[0]!.line, 4);
  assert.equal(check(m).errors[0], `L1.muro:4行目: ${diags[0]!.message}`);
});

// ---- (c) 台帳とspec表の一致 ----

test("台帳: DIAGNOSTIC_CODESとsemantics.md §5の表が集合一致し、BND07は欠番", () => {
  const spec = readFileSync(join(root, "spec/semantics.md"), "utf8");
  const table: Record<string, string> = {};
  for (const m of spec.matchAll(/^\| ([A-Z]{3}\d{2}) \| (error|warning) \|/gm)) {
    table[m[1]!] = m[2]!;
  }
  assert.deepEqual(table, DIAGNOSTIC_CODES);
  // 廃止コードは台帳から消えるが、specに墓標が残る
  assert.match(spec, /\| BND07 \| — \| 欠番/);
  assert.equal("BND07" in DIAGNOSTIC_CODES, false);
});

// ---- (d)(e) CLI: --json / --strict ----

test("CLI: check --json は有効JSON、--strict は警告で終了コード1、SourceErrorはSYN01", { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-diag-"));
  const warnFile = join(dir, "warn.muro");
  writeFileSync(warnFile, `${BASE}\nzone /empty\n`); // 警告 (ZON01) のみ
  const brokenFile = join(dir, "broken.muro");
  writeFileSync(brokenFile, `${BASE}\nspace /a room X1..X9 Y1..Y2 level:L1\n`); // 未定義の通り → SourceError

  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
      cwd: root,
      encoding: "utf8",
    });

  // --json: 有効JSONのDiagnostic[]。警告のみなら終了コード0
  const json = run("check", warnFile, "--json");
  assert.equal(json.status, 0);
  const diags = JSON.parse(json.stdout) as Diagnostic[];
  assert.equal(diags.length, 1);
  assert.equal(diags[0]!.code, "ZON01");
  assert.equal(diags[0]!.severity, "warning");

  // --strict: 警告があれば終了コード1 (人間向け出力は不変)
  const strict = run("check", warnFile, "--strict");
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /⚠ .*ゾーン \/empty の下に空間がありません/);

  // 構文・合成エラー (SourceError) も --json では有効JSON — SYN01の1件に写して exit 1
  const syn = run("check", brokenFile, "--json");
  assert.equal(syn.status, 1);
  const synDiags = JSON.parse(syn.stdout) as Diagnostic[];
  assert.equal(synDiags.length, 1);
  assert.equal(synDiags[0]!.code, "SYN01");
  assert.equal(synDiags[0]!.severity, "error");
  assert.equal(synDiags[0]!.line, 6);
});
