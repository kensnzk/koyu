// シンタックスハイライトの非乖離保証 (ADR-0031)。
//
// editors/vscode/syntaxes/koyu.tmLanguage.json は VS Code と Shiki (Docusaurus) が
// 共有する唯一の文法である。色は実装でも規範でもないが、**語の一覧を二重に持つ**ので、
// 放っておけば必ず腐る。ここが守るのは五つ。
//   (1) 行頭に書ける語が src/core/parse.ts の switch (head) と一致する
//   (2) 字下げして書ける語が src/core/parse.ts の indented 分岐と一致する
//   (3) 色の分かれる属性キーが spec/vocabulary.md の★と一致する (掟7 — 台帳が契約)
//   (4) patterns の include が repository の項に解決する (綴り間違いは静かに無色になる)
//   (5) 同梱の例に、文法が知らない行頭の語が無い
//
// 文法そのものの照合 (Oniguruma での実トークン化) はここではしない — 実行時依存ゼロ (掟8)。

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ATTR_LEDGER } from "../src/core/vocabulary.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");

interface Grammar {
  scopeName: string;
  fileTypes: string[];
  patterns: Array<{ include: string }>;
  repository: Record<string, { match?: string; begin?: string }>;
}

const grammar = JSON.parse(
  read("editors/vscode/syntaxes/koyu.tmLanguage.json"),
) as Grammar;

/** 文法の match から、英字だけの選択肢 `(a|b|c)` を採る */
function alternatives(key: string): string[] {
  const match = grammar.repository[key]?.match;
  assert.ok(match, `the grammar has no ${key}`);
  const m = /\(([A-Za-z][A-Za-z0-9|]*)\)/.exec(match);
  assert.ok(m, `${key} carries no word alternatives: ${match}`);
  return m[1]!.split("|");
}

const parseSrc = read("src/core/parse.ts");

test("words that can start a line: grammar = the switch (head) in src/core/parse.ts", () => {
  // switch (head) { ... default: 未知のキーワード — 分岐の case がそのまま語彙である
  const body = parseSrc.slice(parseSrc.indexOf("switch (head) {"));
  const cases = [...body.matchAll(/^ {6}case "([a-z]+)":/gm)].map((m) => m[1]!);
  assert.ok(cases.length > 5, "no case was collected from switch (head)");
  assert.deepEqual(
    [...alternatives("keyword-directive")].sort(),
    [...new Set(cases)].sort(),
    "fix keyword-directive in editors/vscode/syntaxes/koyu.tmLanguage.json",
  );
});

test("words that can be written indented: grammar = the indented branch in src/core/parse.ts", () => {
  const block = parseSrc.slice(
    parseSrc.indexOf("if (indented) {"),
    parseSrc.indexOf("switch (head) {"),
  );
  const heads = [...block.matchAll(/head === "([a-z]+)"/g)].map((m) => m[1]!);
  assert.ok(heads.length > 3, "no word was collected from the indented branch");
  assert.deepEqual(
    [...alternatives("keyword-child")].sort(),
    [...new Set(heads)].sort(),
    "fix keyword-child in editors/vscode/syntaxes/koyu.tmLanguage.json",
  );
});

test("attribute keys that take their own color: grammar = the non-carrier keys of ATTR_LEDGER", () => {
  // The single source is the implementation ledger (law 7), not a prose table — a table cannot say
  // which tier a key is in, and the previous version had to hard-code five keys the table missed.
  //
  // Carrier-tier keys are deliberately not coloured: core does not act on them, and the colour is
  // what tells a writer "a tool reads this". Everything else in the ledger gets it.
  const coloured = new Set<string>();
  for (const keys of Object.values(ATTR_LEDGER)) {
    for (const [key, spec] of Object.entries(keys)) {
      if (spec.tier !== "carry") coloured.add(key);
    }
  }
  assert.deepEqual(
    [...alternatives("attr-ledger")].sort(),
    [...coloured].sort(),
    "when a key is added to ATTR_LEDGER, fix attr-ledger in the grammar too (law 7)",
  );
});

test("every include in the grammar resolves to a repository entry", () => {
  for (const p of grammar.patterns) {
    assert.ok(p.include.startsWith("#"), `how the include is spelled: ${p.include}`);
    const key = p.include.slice(1);
    assert.ok(grammar.repository[key], `the repository has no ${key}`);
  }
  // The grammar describes the language, so its scope is the language's name — matching the
  // extension it is registered against. It used to say `source.koyu`, which named the
  // implementation and left the two halves of the editor integration disagreeing.
  assert.equal(grammar.scopeName, "source.muro");
  assert.deepEqual(grammar.fileTypes, ["muro"]);
});

test("no bundled example carries a line-head word the grammar does not know", () => {
  const directives = new Set(alternatives("keyword-directive"));
  const children = new Set(alternatives("keyword-child"));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".muro")) files.push(p);
    }
  };
  walk(join(root, "examples"));
  assert.ok(files.length > 10, "no example was found");

  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (const [i, raw] of lines.entries()) {
      const line = raw.split("#")[0]!;
      if (!line.trim()) continue;
      const head = line.trim().split(/\s+/)[0]!;
      const known = /^\s/.test(line) ? children.has(head) : directives.has(head);
      assert.ok(known, `the grammar does not know ${head} at ${file}:${i + 1}`);
    }
  }
});
