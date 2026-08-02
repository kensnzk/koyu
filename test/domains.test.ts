// 領域の分離 (spec/scope.md §1) — 三つの領域と、その間の依存の向きを機械で守る門番。
//
// 方針の中心は「core は凍る・検証と表現は凍らない」であり、それが成り立つ条件は
// **依存が一方向であること**である。core が検証や描画を引いた瞬間、凍らないものが
// 凍る側へ染み出す。文で書いても守られないので、import を実際に読んで縛る。
//
// もう一つ守るのは**混同されないこと** — core の Diagnostic と検証の Finding が
// 取り違えられないよう、フィールド名からして別であることを型と実物の両方で確かめる。

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDiagnostics, DIAGNOSTIC_CODES } from "../src/core/diagnose.js";
import { parse } from "../src/core/parse.js";
import { validate, VALIDATION_RULES } from "../src/validate/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(root, "src");

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsFiles(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** そのファイルが引いている相対 import の一覧 (リポジトリ相対で解決した文字列) */
function importsOf(path: string): string[] {
  const src = readFileSync(path, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) out.push(m[1]!);
  return out;
}

const FILES = tsFiles(SRC).map((p) => ({ rel: relative(root, p), imports: importsOf(p) }));

test("domains: core depends on neither validation nor drawing (one-way — spec/scope.md §1)", () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!f.rel.startsWith("src/core/")) continue;
    for (const i of f.imports) {
      if (i.includes("validate/") || i.includes("draw/")) offenders.push(`${f.rel} → ${i}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "core pulls in a domain that does not freeze — the dirt seeps into the side that does:\n" + offenders.join("\n"),
  );
});

test("domains: validation pulls in core only (it does not pull in drawing)", () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!f.rel.startsWith("src/validate/")) continue;
    for (const i of f.imports) {
      if (i.includes("draw/")) offenders.push(`${f.rel} → ${i}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("domains: drawing pulls in core only (it does not pull in validation — drawing and judging are separate)", () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!f.rel.startsWith("src/draw/")) continue;
    for (const i of f.imports) {
      if (i.includes("validate/")) offenders.push(`${f.rel} → ${i}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("domains: a diagnostic and a finding cannot be mistaken for each other (the field names differ to begin with)", () => {
  const m = parse(`koyu 1.1
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n`);

  const diags = checkDiagnostics(m);
  const findings = validate(m);
  assert.ok(findings.length > 0, "this model trips the validation (1500mm of road frontage)");

  for (const d of diags) {
    assert.ok("code" in d && "severity" in d);
    assert.equal("rule" in d, false);
    assert.equal("level" in d, false);
  }
  for (const f of findings) {
    assert.ok("rule" in f && "level" in f);
    assert.equal("code" in f, false, "a Finding carrying code would mix with a core diagnostic");
    assert.equal("severity" in f, false);
  }
});

test("domains: the ledgers do not intersect (no spelling appears on both faces)", () => {
  const codes = new Set<string>(Object.keys(DIAGNOSTIC_CODES));
  for (const rule of Object.keys(VALIDATION_RULES)) {
    assert.equal(codes.has(rule), false, `${rule} is in both ledgers`);
    // 判定の規則名は必ずドットを持つ — core のコード (3字+2桁) と字面で見分けがつく
    assert.match(rule, /^[a-z]+\.[a-z]+$/, `a validation rule name has the form chapter.rule: ${rule}`);
  }
  for (const code of codes) assert.match(code, /^[A-Z]{3}\d{2}$/, `a diagnostic code is 3 letters and 2 digits: ${code}`);
});

// The page checked is the **published documentation**; `spec/` is an internal tree on its way out.
// Rows read `| [`envelope.gap`](envelope.md#envelope-gap) | caution | … |`
for (const page of ["docs/reference/validate/index.md"]) {
  test(`ledger: VALIDATION_RULES and the table in ${page} agree as sets`, () => {
    const md = readFileSync(join(root, page), "utf8");
    const inDocs = new Map<string, string>();
    for (const m of md.matchAll(/^\| \[`([a-z.]+)`\]\([^)]*\) \| (violation|caution) \|/gm)) {
      inDocs.set(m[1]!, m[2]!);
    }
    assert.deepEqual(
      [...inDocs.keys()].sort(),
      Object.keys(VALIDATION_RULES).sort(),
      `the table in ${page} and the implementation ledger disagree`,
    );
    for (const [rule, level] of inDocs) {
      assert.equal(level, VALIDATION_RULES[rule as keyof typeof VALIDATION_RULES], `the level of ${rule}`);
    }
  });
}

// Every rule must also have its own section, with its level stated there. The family pages of the
// published documentation carry them as `## `rule` — … {#anchor}` followed by `` `violation` ``.
for (const dir of ["docs/reference/validate"]) {
  test(`ledger: the sections under ${dir} agree with VALIDATION_RULES as sets, and the levels match too`, () => {
    const found = new Map<string, string>();
    for (const f of readdirSync(join(root, dir)).sort()) {
      if (!f.endsWith(".md")) continue;
      const lines = readFileSync(join(root, dir, f), "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const h = /^##\s+`([a-z]+\.[a-z]+)`\s+—\s+\S/.exec(lines[i]!);
        if (!h) continue;
        let level = "";
        for (let j = i + 1; j < lines.length && !/^##\s/.test(lines[j]!); j++) {
          const t = /^`(violation|caution)`$/.exec(lines[j]!.trim());
          if (t) {
            level = t[1]!;
            break;
          }
        }
        found.set(h[1]!, level);
      }
    }
    assert.deepEqual([...found.keys()].sort(), Object.keys(VALIDATION_RULES).sort());
    for (const [rule, level] of found) {
      assert.equal(level, VALIDATION_RULES[rule as keyof typeof VALIDATION_RULES], `the level of ${rule}`);
    }
  });
}
