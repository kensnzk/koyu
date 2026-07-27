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

test("領域: core は検証にも描画にも依存しない (一方向 — spec/scope.md §1)", () => {
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
    "core が凍らない領域を引いている — 凍る側へ汚れが染み出す:\n" + offenders.join("\n"),
  );
});

test("領域: 検証は core だけを引く (描画を引かない)", () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!f.rel.startsWith("src/validate/")) continue;
    for (const i of f.imports) {
      if (i.includes("draw/")) offenders.push(`${f.rel} → ${i}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("領域: 描画は core だけを引く (検証を引かない — 描くことと判定は別)", () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!f.rel.startsWith("src/draw/")) continue;
    for (const i of f.imports) {
      if (i.includes("validate/")) offenders.push(`${f.rel} → ${i}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("領域: 診断と判定は取り違えられない (フィールド名からして別)", () => {
  const m = parse(`koyu 0.5
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n exterior X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1
boundary /site/yard /out/road-n`);

  const diags = checkDiagnostics(m);
  const findings = validate(m);
  assert.ok(findings.length > 0, "この模型は判定に引っかかる (接道1500mm)");

  for (const d of diags) {
    assert.ok("code" in d && "severity" in d);
    assert.equal("rule" in d, false);
    assert.equal("level" in d, false);
  }
  for (const f of findings) {
    assert.ok("rule" in f && "level" in f);
    assert.equal("code" in f, false, "Finding が code を持つと core の診断と混ざる");
    assert.equal("severity" in f, false);
  }
});

test("領域: 台帳が交わらない (同じ綴りが二つの面に無い)", () => {
  const codes = new Set<string>(Object.keys(DIAGNOSTIC_CODES));
  for (const rule of Object.keys(VALIDATION_RULES)) {
    assert.equal(codes.has(rule), false, `${rule} が両方の台帳にある`);
    // 判定の規則名は必ずドットを持つ — core のコード (3字+2桁) と字面で見分けがつく
    assert.match(rule, /^[a-z]+\.[a-z]+$/, `判定の規則名は chapter.rule の形にする: ${rule}`);
  }
  for (const code of codes) assert.match(code, /^[A-Z]{3}\d{2}$/, `診断コードは3字+2桁: ${code}`);
});

test("台帳: VALIDATION_RULES と spec/validation.md の表が集合一致する", () => {
  const md = readFileSync(join(root, "spec/validation.md"), "utf8");
  const inSpec = new Map<string, string>();
  for (const m of md.matchAll(/^\| `([a-z.]+)` \| (violation|caution) \|/gm)) {
    inSpec.set(m[1]!, m[2]!);
  }
  assert.deepEqual(
    [...inSpec.keys()].sort(),
    Object.keys(VALIDATION_RULES).sort(),
    "spec/validation.md の表と実装の台帳が食い違う",
  );
  for (const [rule, level] of inSpec) {
    assert.equal(level, VALIDATION_RULES[rule as keyof typeof VALIDATION_RULES], `${rule} の level`);
  }
});

test("台帳: guide/validation.md の節が VALIDATION_RULES と集合一致し、level も一致する", () => {
  const md = readFileSync(join(root, "guide/validation.md"), "utf8");
  const lines = md.split("\n");
  const found = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const h = /^###\s+`([a-z.]+)`\s+—\s+\S/.exec(lines[i]!);
    if (!h) continue;
    let level = "";
    for (let j = i + 1; j < lines.length && !/^###\s/.test(lines[j]!); j++) {
      const s = /^`(violation|caution)`$/.exec(lines[j]!.trim());
      if (s) {
        level = s[1]!;
        break;
      }
    }
    found.set(h[1]!, level);
  }
  assert.deepEqual([...found.keys()].sort(), Object.keys(VALIDATION_RULES).sort());
  for (const [rule, level] of found) {
    assert.equal(level, VALIDATION_RULES[rule as keyof typeof VALIDATION_RULES], `${rule} の level`);
  }
});
