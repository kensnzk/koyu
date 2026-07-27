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
import { check, checkDiagnostics, DIAGNOSTIC_CODES, type Diagnostic } from "../src/core/diagnose.js";
import { validate } from "../src/validate/index.js";
import { areaM2, isIndoor, srcRef } from "../src/core/model.js";
import { siteReport } from "../src/core/site.js";
import { parseFile } from "../src/parse-file.js";
import { parse, parseFiles } from "../src/core/parse.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const BASE = [
  "koyu 0.2",
  "unit mm",
  "grid X 0 3640 7280",
  "grid Y 0 3640",
  "level L1 0 h:2400 slab:150",
].join("\n");

/** 互換層と同じ組み立て — 位置があれば接頭辞、なければ本文のみ */
const fmt = (d: Diagnostic): string =>
  d.line !== undefined ? `${srcRef(d.line, d.file)}: ${d.message}` : d.message;

// ---- (a0) 診断の母集団は書かれた宣言である (ADR-0028) ----

/** 出所を持たないと決めた診断。これ以外は必ず line を持つ */
const NO_SOURCE = new Set(["UID03", "VER01"]);

test("出所: 書かれた宣言に対する診断は必ず line/file を持つ (例外は台帳の2件だけ)", () => {
  // guide/diagnostics.md の全例を走らせ、出所の無い診断を洗う。
  // かつては error 5件を含む8コードが位置を持たず、人向け出力から接頭辞が消えていた
  const md = readFileSync(join(root, "guide/diagnostics.md"), "utf8");
  const blocks = [...md.matchAll(/```muro-(?:bad|warn)\n([\s\S]*?)```/g)].map((m) => m[1]!);
  assert.ok(blocks.length > 40, `例が少なすぎる: ${blocks.length}`);
  const missing = new Map<string, string>();
  for (const src of blocks) {
    let diags: Diagnostic[];
    try {
      diags = checkDiagnostics(parse(src));
    } catch {
      continue; // muro-bad の構文エラーは SourceError — 診断の話ではない
    }
    for (const d of diags) {
      if (d.line === undefined && !NO_SOURCE.has(d.code)) missing.set(d.code, d.message);
    }
  }
  assert.deepEqual([...missing.keys()].sort(), [], `出所の無い診断: ${[...missing].map(([c, m]) => `${c} ${m}`).join(" / ")}`);
});

test("値: 解釈される属性の綴り誤りは、黙って既定へ落ちずエラーになる (ATT01/ATT02)", () => {
  // h:35OO は数字の0でなく英字のO。かつては高さ不変量 (HGT01 error) が丸ごと消えていた
  const typo = parse(`koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2 h:35OO
space /L2/a room X1..X2 Y1..Y2`);
  const d = checkDiagnostics(typo).filter((x) => x.code === "ATT01");
  assert.equal(d.length, 1);
  assert.equal(d[0]!.line, 6);
  assert.deepEqual(d[0]!.path, ["/L1/a"]);

  // 正しく書けば、同じ入力が本来の検査 (HGT01) に届く
  const ok = parse(`koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2 h:3500
space /L2/a room X1..X2 Y1..Y2`);
  const h = checkDiagnostics(ok);
  assert.deepEqual(h.map((x) => x.code), ["HGT01"]);
  assert.equal(h[0]!.line, 6, "HGT01 も出所を持つ");

  // 語彙の側 — ceiling は 0/1、turn は R/L
  const enums = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2 ceiling:none`);
  const e = checkDiagnostics(enums).filter((x) => x.code === "ATT02");
  assert.equal(e.length, 1);
  assert.match(e[0]!.message, /ceiling は 0 \/ 1/);
});

test("値: site の綴り誤りは敷地の判定 (site.escape) を無効にしていた", () => {
  const src = (v: string) => `koyu 0.5
grid X 0 20000
grid Y 0 20000
level L1 0 h:2400
zone /site name:敷地 site:${v}
polygon /site 0,0 5000,0 5000,5000 0,5000
space /L1/big room X1..X2 Y1..Y2`;
  // 正しく書けば、建物が敷地からはみ出していることが検証の違反として出る
  assert.ok(validate(parse(src("1"))).some((f) => f.rule === "site.escape"));
  // 綴りを誤ると判定が走らない — だからその綴り自体を core のエラーにする
  const typo = parse(src("yes"));
  assert.equal(validate(typo).filter((f) => f.rule === "site.escape").length, 0);
  assert.ok(checkDiagnostics(typo).some((d) => d.code === "ATT02"), "黙って緑にはならない");
});

test("母集団: 一本も立たない柱の宣言は、同じ階の別の宣言の成功に隠れない (COL01)", () => {
  const m = parse(`koyu 0.5
grid X 0 6000 12000
grid Y 0 6000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
column 800 L1 x:X1,X2
column 700 L1 x:X3`);
  // 二本目は X3 (床の外) を指すので一本も立たない。一本目が立っていても隠れない
  const col = checkDiagnostics(m).filter((d) => d.code === "COL01");
  assert.equal(col.length, 1);
  assert.equal(col[0]!.line, 7, "咎めているのは二本目の宣言の行");
});

test("母集団: 先の宣言に交点を取られた柱は COL01 ではなく COL02 (直す手が違う)", () => {
  const m = parse(`koyu 0.5
grid X 0 6000
grid Y 0 6000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
column 800 L1
column 700 L1`);
  const d = checkDiagnostics(m);
  assert.deepEqual(d.filter((x) => x.code === "COL01"), []);
  const col2 = d.filter((x) => x.code === "COL02");
  assert.equal(col2.length, 1);
  assert.equal(col2[0]!.line, 7);
  assert.equal(col2[0]!.related?.[0]?.line, 6, "影を作った宣言が related に載る");
});

test("母集団: 開口を咎める診断は開口ごとに、その行を指して出る (VRT05)", () => {
  const m = parse(`koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/s stair X1..X2 Y1..Y2
space /L2/s stair X1..X2 Y1..Y2
boundary /L1/s /L2/s type:stair
  door w:800
  door w:900`);
  const d = checkDiagnostics(m).filter((x) => x.code === "VRT05");
  assert.equal(d.length, 2, "扉二枚なら二件");
  assert.deepEqual(d.map((x) => x.line), [9, 10], "親の境界行ではなく当の door の行");
});

test("メッセージ: 接しているのに edge を取り違えたとき、割付へ誤誘導しない (BND04)", () => {
  // 東西に並ぶ二室の共有辺は E/W。edge:N を書いても「接していない」は事実に反する
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b edge:N`);
  const d = checkDiagnostics(m).filter((x) => x.code === "BND04");
  assert.equal(d.length, 1);
  assert.match(d[0]!.message, /edge:N に共有辺がありません/);
  assert.match(d[0]!.message, /実際に接しているのは E/);
});

test("母集団: 「延べ面積」は一箇所が答える — stats と site と MCP がずれない", () => {
  const m = parseFile(join(root, "examples/complex/main.muro"));
  const indoor = [...m.spaces.values()].filter((s) => s.level && isIndoor(m, s));
  const total = indoor.reduce((a, s) => a + (areaM2(s) ?? 0), 0);
  // かつては CLI stats だけが exterior を屋内床に数え、site と 160㎡ 食い違っていた
  assert.equal(Math.round(total * 100) / 100, siteReport(m).totalFloor);
  assert.ok(
    [...m.spaces.values()].some((s) => s.type === "exterior" && s.rects.length > 0),
    "外部の領域を持つ例で試している",
  );
});

test("順序: 診断の並びは走査の順序である — 一つの境界が出す複数のコードは離れない", () => {
  // **並びは契約である。**互換層は診断を出た順に文字列へ写す。
  // (24行目はかつて `kind:open` と書かれていて、boundary の語は `type:` なので
  //  黙って壁のままだった。ATT03 がそれを見つけた — この模型自身が、
  //  台帳に無いキーが何を起こすかの実例である)
  // ここで効く模型は「一本の境界が複数のコードを出す」もの — 15行目の境界は
  // BND04・OPN04・SEG04 を続けて出す。checkDiagnostics を**コード族**で節に割ると
  // この三つが他の境界の診断で分断され、並びが崩れる。走査単位で割れば崩れない。
  const m = parse(`koyu 0.5
grid X 0 3600 7200 10800
grid Y 0 4000 8000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/far room X3..X4 Y2..Y3
space /L2/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:900 at:0.4
  door w:900 at:0.5
boundary /L1/a /L1/b edge:E t:120
boundary /L1/a /L1/far t:120
  door w:900
  seg w:600 spec:GL
boundary /L1/a /L2/a t:120
  door w:900
  seg w:600
boundary /L1/a /out type:void
  door w:900
  seg w:600
boundary /L1/b /out type:open
  door w:900
  seg w:600`);
  assert.deepEqual(
    checkDiagnostics(m).map((d) => [d.code, d.line]),
    [
      ["BND05", 11], // 境界の同一性 (edge限定の混在)
      ["OPN02", 13], // ここから境界の妥当性 — 境界の宣言順に、境界ごとに固まって出る
      ["BND04", 15],
      ["OPN04", 16],
      ["SEG04", 17],
      ["BND03", 18],
      ["VRT01", 21],
      ["OPN03", 25],
      ["OPN05", 25],
      ["SEG03", 26],
    ],
  );
});

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

test("判定: site.escape 敷地はみ出し — core の診断ではなく検証の Finding として出る", () => {
  const m = parse(
    `${BASE}
zone /site site:1
polygon /site -1000,-1000 9000,-1000 9000,9000 -1000,9000
space /a room X1..X3+2000 Y1..Y2 level:L1`,
  );
  // core は黙る — はみ出しは構成の矛盾ではない (形は一意に出る)
  assert.equal(checkDiagnostics(m).filter((d) => (d.code as string).startsWith("SIT")).length, 0);
  const f = validate(m).find((x) => x.rule === "site.escape")!;
  assert.equal(f.level, "violation");
  assert.equal(f.line, 8);
  assert.deepEqual(f.path, ["/a"]);
  assert.match(f.message, /escapes the site shape/);
  // **型が違うので混ぜられない** — Finding は code も severity も持たない
  assert.equal("code" in f, false);
  assert.equal("severity" in f, false);
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
    parse(`koyu 0.1\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400 slab:150\nspace /L1/a hall X1..X2 Y1..Y2\nspace /L1/b hall X2..X3 Y1..Y2`),
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
        "koyu 0.4\nname x\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400 slab:150\nimport ./L1.muro",
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

test("台帳: 英訳の §5 の表も実装と集合一致する (訳の欠落は黙って溜まる)", () => {
  // 訳の同期テストは見出しとコードブロックしか見ないので、**表の行が17本落ちても緑だった**。
  // 台帳は三者 (実装・spec・spec/en) が一致して初めて契約である (ADR-0016)
  const en = readFileSync(join(root, "spec/en/semantics.md"), "utf8");
  const table: Record<string, string> = {};
  for (const m of en.matchAll(/^\| ([A-Z]{3}\d{2}) \| (error|warning) \|/gm)) {
    table[m[1]!] = m[2]!;
  }
  assert.deepEqual(table, DIAGNOSTIC_CODES);
  assert.match(en, /\| BND07 \| — \|/);
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
