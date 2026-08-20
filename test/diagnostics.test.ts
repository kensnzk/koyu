// 診断契約 (ADR-0016) — checkDiagnosticsのcode/severity/出所/path/related、
// check互換層 (件数・順序・字面の1:1)、台帳DIAGNOSTIC_CODESとspec表の集合一致、
// CLIの --json / --strict (SourceErrorはSYN01の1件に写して有効JSON)。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, checkDiagnostics, DIAGNOSTIC_CODES, type Diagnostic } from "../src/core/diagnose.js";
import { SITE_ESCAPE_RULE_ID } from "../src/validate/builtin/index.js";
import { assessSchematic, caught } from "./helpers/schematic.js";
import { areaM2, isIndoor, srcRef, isOutside } from "../src/core/model.js";
import { siteReport } from "../src/core/site.js";
import { slabs } from "../src/core/fabric.js";
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

test("source: a diagnostic against a written declaration always carries line/file (the only exceptions are the two in the ledger)", () => {
  // Runs every failing example in the diagnostics reference and sweeps for a diagnostic with no
  // provenance. Eight codes, five of them errors, once carried no position, and the prefix vanished
  // from the human-facing output. The corpus is the **published documentation**, family page by
  // family page — the single guide page it used to read has been withdrawn (ADR-0046)
  const dir = join(root, "docs/reference/diagnostics");
  const md = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  const blocks = [...md.matchAll(/```muro-(?:bad|warn)\n([\s\S]*?)```/g)].map((m) => m[1]!);
  assert.ok(blocks.length > 40, `too few examples: ${blocks.length}`);
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
  assert.deepEqual([...missing.keys()].sort(), [], `diagnostics with no source: ${[...missing].map(([c, m]) => `${c} ${m}`).join(" / ")}`);
});

test("value: a misspelled value on an interpreted attribute is an error rather than silently falling back to the default (ATT01/ATT02)", () => {
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
  // the two rooms name no outside, so each draws BND08 first — the order is the order of the scan
  assert.deepEqual(h.map((x) => x.code), ["BND08", "BND08", "HGT01"]);
  assert.equal(h[2]!.line, 6, "HGT01 carries a source too");

  // 語彙の側 — ceiling は 0/1、turn は R/L
  const enums = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2 ceiling:none`);
  const e = checkDiagnostics(enums).filter((x) => x.code === "ATT02");
  assert.equal(e.length, 1);
  assert.match(e[0]!.message, /ceiling on \/L1\/a is one of 0 \/ 1/);
});

test("value: a misspelled site used to disable the site validation (site.escape)", () => {
  const src = (v: string) => `koyu 0.5
grid X 0 20000
grid Y 0 20000
level L1 0 h:2400
zone /site name:敷地 site:${v}
polygon /site 0,0 5000,0 5000,5000 0,5000
space /L1/big room X1..X2 Y1..Y2`;
  // 正しく書けば、建物が敷地からはみ出していることが検証の違反として出る
  assert.ok(caught(parse(src("1"))).some((f) => f.rule === SITE_ESCAPE_RULE_ID.id));
  // 綴りを誤ると判定が走らない — だからその綴り自体を core のエラーにする
  const typo = parse(src("yes"));
  assert.equal(caught(typo).filter((f) => f.rule === SITE_ESCAPE_RULE_ID.id).length, 0);
  assert.ok(checkDiagnostics(typo).some((d) => d.code === "ATT02"), "it does not go green silently");
});

test("population: a column declaration that raises not one column is not hidden by another declaration succeeding on the same storey (COL01)", () => {
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
  assert.equal(col[0]!.line, 7, "the line blamed is the second declaration");
});

test("population: a column whose intersections were taken by an earlier declaration is COL02, not COL01 (the fix differs)", () => {
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
  assert.equal(col2[0]!.related?.[0]?.line, 6, "the declaration that cast the shadow appears in related");
});

test("population: a diagnostic blaming an opening is emitted per opening, pointing at its own line (VRT05)", () => {
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
  assert.equal(d.length, 2, "two doors, two diagnostics");
  assert.deepEqual(d.map((x) => x.line), [9, 10], "the line of the door itself, not of the parent boundary");
});

test("message: when the spaces do touch but the edge is mistaken, it does not misdirect toward the layout (BND04)", () => {
  // 東西に並ぶ二室の共有辺は E/W。edge:N を書いても「接していない」は事実に反する
  const m = parse(`${BASE}
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b edge:N`);
  const d = checkDiagnostics(m).filter((x) => x.code === "BND04");
  assert.equal(d.length, 1);
  assert.match(d[0]!.message, /No shared edge on edge:N/);
  assert.match(d[0]!.message, /they actually touch on E/);
});

test("population: one place answers \"total floor area\" — stats, site and MCP do not diverge", () => {
  const m = parseFile(join(root, "examples/complex/main.muro"));
  const indoor = [...m.spaces.values()].filter((s) => s.level && isIndoor(m, s));
  const total = indoor.reduce((a, s) => a + (areaM2(s) ?? 0), 0);
  // かつては CLI stats だけが exterior を屋内床に数え、site と 160㎡ 食い違っていた
  assert.equal(Math.round(total * 100) / 100, siteReport(m).totalFloor);
  assert.ok(
    [...m.spaces.values()].some((s) => isOutside(s) && s.rects.length > 0),
    "the example under test has an exterior carrying a region",
  );
});

test("sufficiency: SUF is emitted when a value needed to build the shape is missing — a completeness check, not a validity one (ADR-0034)", () => {
  // **かつては全部が緑だった。**examples/two-rooms.muro は診断0件のまま床を一枚も持たず、
  // guide の muro ブロック250件のうち134件が天井高を、210件が slab を持たなかった
  // BND08 is dropped: it is about naming the outside, which no SUF code is (ADR-0065), and
  // every fixture here is minimal enough to draw one
  const suf = (src: string) =>
    checkDiagnostics(parse(src))
      .filter((d) => d.code !== "BND08")
      .map((d) => [d.code, d.severity, d.line] as const);

  // SUF01 — 天井高が決まらない (空間の h も レベルの h も無い)
  assert.deepEqual(
    suf(`grid X 0 3600\ngrid Y 0 4000\nlevel L1 0 slab:150\nspace /L1/a room X1..X2 Y1..Y2`),
    [["SUF01", "error", 4]],
  );
  // SUF02 — レベルが特定できない (z が決まらず立体が一つも出ない)
  assert.deepEqual(
    suf(`grid X 0 3600\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\nspace /house/a room X1..X2 Y1..Y2`),
    [["SUF02", "error", 4]],
  );
  // SUF03 — slab が無く床が一枚も生成されない。出所は level の行である
  assert.deepEqual(
    suf(`grid X 0 3600\ngrid Y 0 4000\nlevel L1 0 h:2400\nspace /L1/a room X1..X2 Y1..Y2`),
    [["SUF03", "warning", 3]],
  );
  // SUF04 — 縦動線の宣言があるのに形が一つも生成されない (RUN の走査の中に居る)
  assert.deepEqual(
    suf(
      `grid X 0 3000 6000\ngrid Y 0 6000\nlevel L1 0 h:2700 slab:300\nlevel L2 3000 h:2700 slab:300\n` +
        `space /L1/a room X1..X2 Y1..Y2\nspace /L2/s stair X1..X2 Y1..Y2 stair:N`,
    ),
    [["SUF04", "warning", 6]],
  );
});

test("sufficiency: a space whose shape does not depend on ceiling height is outside the SUF01 population (ADR-0034)", () => {
  // 吹抜け・外部・半屋外には fabric が天井も屋根も架けない — 天井高を問う意味が無い。
  // **母集団は fabric の規則と同じ形をしている** (ADR-0024)
  const m = parse(`grid X 0 4000 8000
grid Y 0 4000
level L1 0 slab:150
level L2 3000 h:2400 slab:150
space /L1/liv living X1..X2 Y1..Y2 h:2400
space /L1/bal balcony X2..X3 Y1..Y2
space /L2/v X1..X2 Y1..Y2 void:1
space /out outside:1
boundary /L1/bal /out type:open`);
  // h を持たないのは balcony (半屋外) と void と exterior だけ — SUF01 は一件も出ない。
  // BND08 は外部の名指しの話なので母集団が別である (ADR-0065)
  assert.deepEqual(
    checkDiagnostics(m).map((d) => d.code).filter((c) => c.startsWith("SUF")),
    [],
  );
  // レベルに床を持ちうる空間が載っていなければ SUF03 も出ない (屋上レベルの類)
  assert.deepEqual(
    checkDiagnostics(
      parse(`grid X 0 3600\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\nlevel R 3000\nspace /L1/a room X1..X2 Y1..Y2`),
    ).map((d) => d.code).filter((c) => c.startsWith("SUF")),
    [],
  );
});

test("sufficiency: when SUF is silent, floors, ceilings and roofs are actually generated (ADR-0034)", () => {
  const m = parseFile(join(root, "examples/two-rooms.muro"));
  assert.deepEqual(checkDiagnostics(m), []);
  const kinds = new Set(slabs(m).map((s) => s.kind));
  // かつてこの例は診断0件のまま**床を一枚も持たなかった** (level L1 に slab が無かった)
  assert.deepEqual([...kinds].sort(), ["ceiling", "floor", "roof"]);
});

test("order: the order of diagnostics is the order of the traversal — the several codes one boundary emits do not come apart", () => {
  // **並びは契約である。**互換層は診断を出た順に文字列へ写す。
  // (24行目はかつて `kind:open` と書かれていて、boundary の語は `type:` なので
  //  黙って壁のままだった。ATT03 がそれを見つけた — この模型自身が、
  //  台帳に無いキーが何を起こすかの実例である)
  // ここで効く模型は「一本の境界が複数のコードを出す」もの — 15行目の境界は
  // BND04・OPN04・SEG04 を続けて出す。checkDiagnostics を**コード族**で節に割ると
  // この三つが他の境界の診断で分断され、並びが崩れる。走査単位で割れば崩れない。
  const m = parse(`koyu 1.1
grid X 0 3600 7200 10800
grid Y 0 4000 8000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /L1/far room X3..X4 Y2..Y3
space /L2/a room X1..X2 Y1..Y2
space /out outside:1
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
      // then the envelope clause, once per space in declaration order (ADR-0065). /L1/b named
      // its outside with a type:open boundary, so only the other three are left unnamed
      ["BND08", 6],
      ["BND08", 8],
      ["BND08", 9],
    ],
  );
});

// ---- (a) 主要コードの発火 ----

test("diagnostic: BND02 duplicate boundary — carries line/path/related (the first-seen side)", () => {
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
  assert.match(d.message, /^Duplicate boundary/); // 本文に位置接頭辞は無い
});

test("validation: site escape — emitted as an assessment outcome, not a core diagnostic", () => {
  // A current language version, and a slab, so the model is structurally consistent: the rules
  // declare `model: "consistent"` and refuse to judge a self-contradictory composition at all.
  const m = parse(
    `koyu 1.1
unit mm
grid X 0 3640 7280
grid Y 0 3640
level L1 0 h:2400 slab:150
zone /site site:1
polygon /site -1000,-1000 9000,-1000 9000,9000 -1000,9000
space /a room X1..X3+2000 Y1..Y2 level:L1`,
  );
  // core は黙る — はみ出しは構成の矛盾ではない (形は一意に出る)
  assert.equal(checkDiagnostics(m).filter((d) => (d.code as string).startsWith("SIT")).length, 0);
  const f = caught(m).find((x) => x.rule === SITE_ESCAPE_RULE_ID.id)!;
  assert.equal(f.level, "violation");
  assert.equal(f.line, 8);
  assert.deepEqual(f.path, ["/a"]);
  assert.match(f.message, /escapes the site shape/);
  // **型が違うので混ぜられない** — 判定は code も severity も持たない
  const outcome = assessSchematic(m).findings.find((x) => x.rule.id === SITE_ESCAPE_RULE_ID.id)!;
  assert.equal("code" in outcome.outcome, false);
  assert.equal("severity" in outcome.outcome, false);
  assert.equal(outcome.outcome.status, "fail");
});

test("diagnostic: UID03 duplicate uid — no position (line omitted), every owner appears in path/related", () => {
  const diags = checkDiagnostics(
    parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:sp-1x\nspace /L1/b room X2..X3 Y1..Y2 uid:sp-1x`),
  );
  const d = diags.find((x) => x.code === "UID03")!;
  assert.equal(d.severity, "error");
  assert.equal(d.line, undefined);
  assert.deepEqual(d.path, ["/L1/a", "/L1/b"]);
  assert.deepEqual(d.related, [{ line: 6 }, { line: 7 }]);
});

test("diagnostic: VER01, default boundary derivation under 0.1 — derived, so it has no position", () => {
  const diags = checkDiagnostics(
    parse(`koyu 0.1\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400 slab:150\nspace /L1/a hall X1..X2 Y1..Y2\nspace /L1/b hall X2..X3 Y1..Y2`),
  );
  // the two rooms also draw BND08 apiece; VER01 is about the wall *between* them, which is
  // what changed at 0.2. The exterior default is version-blind (ADR-0065)
  assert.deepEqual(diags.map((x) => x.code), ["VER01", "BND08", "BND08"]);
  const d = diags[0]!;
  assert.equal(d.code, "VER01");
  assert.equal(d.severity, "error");
  assert.equal(d.line, undefined);
  assert.deepEqual(d.path, ["/L1/a", "/L1/b"]);
});

test("diagnostic: a placeBand placement failure splits into OPN codes for openings and SEG codes for segs", () => {
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
  assert.match(opn.message, /runs off the boundary segment/);
  const seg = diags.find((x) => x.code === "SEG06")!;
  assert.equal(seg.line, 10);
  assert.match(seg.message, /exceeds the boundary segment length/);
});

// ---- (b) check互換層 — 件数・順序・字面の1:1 ----

test("compatibility: check is a mapping of checkDiagnostics (split by severity, position prefix assembled)", () => {
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

test("compatibility: a diagnostic on a composed model carries file, and the compatibility string is prefixed with layer:line", () => {
  const m = parseFiles(
    {
      "main.muro":
        "koyu 0.4\nname x\nunit mm\ngrid X 0 3640 7280\ngrid Y 0 3640\nlevel L1 0 h:2400 slab:150\nimport ./L1.muro",
      "L1.muro":
        "space /a room X1..X2 Y1..Y2 level:L1\nspace /b room X2..X3 Y1..Y2 level:L1\nboundary /a /b t:120\n  door w:900 at:Y1+200",
    },
    "main.muro",
  );
  // the two rooms name no outside, so BND08 follows — provenance is what this test is about,
  // and it carries the layer for the derived-envelope warning just as it does for OPN08
  const diags = checkDiagnostics(m);
  assert.deepEqual(diags.map((d) => d.code), ["OPN08", "BND08", "BND08"]);
  assert.equal(diags[0]!.file, "L1.muro");
  assert.equal(diags[0]!.line, 4);
  assert.equal(check(m).errors[0], `L1.muro:line 4: ${diags[0]!.message}`);
  assert.equal(diags[1]!.file, "L1.muro");
  assert.equal(diags[1]!.line, 1);
});

// ---- (c) 台帳とspec表の一致 ----

/** The code → severity table of the diagnostics index. Rows read `| [BND01](#bnd01) | error | … |` */
function indexLedger(page: string): Record<string, string> {
  const md = readFileSync(join(root, page), "utf8");
  const table: Record<string, string> = {};
  for (const m of md.matchAll(/^\| \[([A-Z]{3}\d{2})\]\([^)]*\) \| (error|warning) \|/gm)) {
    table[m[1]!] = m[2]!;
  }
  return table;
}

// The ledger is a contract only when all three agree — the implementation and both locales
// (ADR-0016). The translation-sync test reads headings and code blocks only, so **seventeen table
// rows once went missing and it stayed green.**
//
// The pages checked are the **published documentation**. `spec/` is an internal tree on its way
// out and has in fact gone stale; while two trees both claim to be normative, the machine must
// bind the one that is canonical.
for (const page of ["docs/reference/diagnostics/index.md"]) {
  test(`ledger: DIAGNOSTIC_CODES and the table in ${page} agree as sets, and BND07 is retired`, () => {
    assert.deepEqual(indexLedger(page), DIAGNOSTIC_CODES);
    // A retired code leaves the ledger but keeps a headstone in the index
    assert.match(readFileSync(join(root, page), "utf8"), /`BND07`/);
    assert.equal("BND07" in DIAGNOSTIC_CODES, false);
  });
}

// ---- (d)(e) CLI: --json / --strict ----

test("CLI: check --json is valid JSON, --strict exits 1 on a warning, and a SourceError becomes SYN01", { timeout: 60000 }, () => {
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
  assert.match(strict.stdout, /⚠ .*There are no spaces beneath zone \/empty/);

  // 構文・合成エラー (SourceError) も --json では有効JSON — SYN01の1件に写して exit 1
  const syn = run("check", brokenFile, "--json");
  assert.equal(syn.status, 1);
  const synDiags = JSON.parse(syn.stdout) as Diagnostic[];
  assert.equal(synDiags.length, 1);
  assert.equal(synDiags[0]!.code, "SYN01");
  assert.equal(synDiags[0]!.severity, "error");
  assert.equal(synDiags[0]!.line, 6);
});
