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

test("attribute keys that take their own color: grammar = the ★ rows of spec/vocabulary.md", () => {
  // 表の★行の第1列。`stair / ramp / escalator` は分け、`level:` は綴りを落とし、
  // 日本語の見出し (領域・軸・先頭トークン) は属性キーではないので採らない
  const starred = new Set<string>();
  for (const line of read("spec/vocabulary.md").split("\n")) {
    if (!line.startsWith("|") || !line.includes("★")) continue;
    for (const raw of line.split("|")[1]!.split("/")) {
      const key = raw.trim().replace(/:$/, "");
      if (/^[a-z][a-z0-9]*$/.test(key)) starred.add(key);
    }
  }
  // 表を持たない節で★が宣言されている属性 (level / zone) — 台帳の本文がその出所である
  for (const key of ["slab", "pitch", "underground", "site", "area"]) starred.add(key);

  assert.deepEqual(
    [...alternatives("attr-ledger")].sort(),
    [...starred].sort(),
    "when a ★ is added to spec/vocabulary.md, fix attr-ledger too (law 7)",
  );
});

test("every include in the grammar resolves to a repository entry", () => {
  for (const p of grammar.patterns) {
    assert.ok(p.include.startsWith("#"), `how the include is spelled: ${p.include}`);
    const key = p.include.slice(1);
    assert.ok(grammar.repository[key], `the repository has no ${key}`);
  }
  assert.equal(grammar.scopeName, "source.koyu");
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
