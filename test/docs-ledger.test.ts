// 公開ドキュメントの台帳が実装と一致していることの門番。
//
// 公開ドキュメントは正典である。正典が実装と食い違えば、読み手には確かめる術が
// 無い — 以前は「診断51件」「全49エクスポート」「ADR 19編」のように、書いた時点で
// 正しかった数がそのまま古びて残っていた。
//
// **数を手で書かない**という掟を、文ではなくテストで守る。台帳 (DIAGNOSTIC_CODES /
// VALIDATION_RULES / src/index.ts の書き下し / mcp.ts の TOOLS / cli.ts の使い方行) が
// 唯一の出所であり、公開ページはその全件を漏れなく載せていなければならない。
//
// 見出しの綴りが載っている場所がそのままアンカーになるので、この検査は
// 「/reference/diagnostics/opn#opn05 が実在する」ことの検査でもある。

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_CODES } from "../src/core/diagnose.js";
import { VALIDATION_RULES } from "../src/validate/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const DOCS = join(root, "docs");

/** 正典の木がまだ無い間は、この門番は黙って通す (移行中の中間状態を落とさない)。 */
const canonical = existsSync(join(DOCS, "reference"));

function markdown(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) markdown(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/** 公開文書の一区画をひと続きのテキストとして読む。 */
function corpus(...segments: string[]): string {
  return markdown(join(DOCS, ...segments))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

const CLI_SUBCOMMANDS = [
  "check",
  "validate",
  "layers",
  "diff",
  "plan",
  "axo",
  "doors",
  "graph",
  "stats",
  "levels",
  "runs",
  "light",
  "site",
  "json",
];

const MCP_TOOLS = [
  "model_summary",
  "check",
  "layers",
  "write_layer",
  "new_uids",
  "doors",
  "spaces",
  "light",
  "validate",
  "site",
  "plan_svg",
  "canonical_json",
];

/** 欠番。生きた診断として説明してはならない。 */
const RETIRED = [
  "BND07",
  "HGT03",
  "HGT04",
  "HGT05",
  "RUN04",
  "RUN06",
  "RUN07",
  "RUN08",
  "ENV01",
  "SIT03",
  "SIT05",
];

test("診断コードは65件すべてが見出しを持つ", { skip: !canonical }, () => {
  const text = corpus("reference", "diagnostics");
  const missing = Object.keys(DIAGNOSTIC_CODES).filter(
    (code) => !new RegExp(`^#{2,4}\\s.*\\b${code}\\b`, "m").test(text),
  );
  assert.deepEqual(missing, [], `見出しの無い診断コード: ${missing.join(", ")}`);
});

test("判定規則は15件すべてが見出しを持つ", { skip: !canonical }, () => {
  const text = corpus("reference", "validate");
  const missing = Object.keys(VALIDATION_RULES).filter(
    (rule) => !new RegExp(`^#{2,4}\\s.*${rule.replace(".", "\\.")}`, "m").test(text),
  );
  assert.deepEqual(missing, [], `見出しの無い判定規則: ${missing.join(", ")}`);
});

test("CLI は14サブコマンドすべてがページを持つ", { skip: !canonical }, () => {
  const dir = join(DOCS, "reference", "cli");
  const missing = CLI_SUBCOMMANDS.filter((cmd) => !existsSync(join(dir, `${cmd}.md`)));
  assert.deepEqual(missing, [], `ページの無いサブコマンド: ${missing.join(", ")}`);
});

test("MCP は12ツールすべてが見出しを持つ", { skip: !canonical }, () => {
  const text = corpus("reference", "mcp");
  const missing = MCP_TOOLS.filter(
    (tool) => !new RegExp(`^#{2,4}\\s.*\\b${tool}\\b`, "m").test(text),
  );
  assert.deepEqual(missing, [], `見出しの無いMCPツール: ${missing.join(", ")}`);
});

test("公開APIの全エクスポートがどこかに書かれている", { skip: !canonical }, () => {
  const index = readFileSync(join(root, "src", "index.ts"), "utf8");
  const names = new Set<string>();
  for (const block of index.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    for (const raw of (block[2] ?? "").split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  const text = corpus("reference", "api");
  const missing = [...names].filter((name) => !new RegExp(`\\b${name}\\b`).test(text));
  assert.deepEqual(missing, [], `文書に現れない公開名: ${missing.join(", ")}`);
});

test("欠番のコードを生きた診断として説明していない", { skip: !canonical }, () => {
  // retired.md は欠番を述べることが仕事なので対象外。ほかの頁でコードが見出しに
  // 立っていれば、それは生きた診断として扱われているということである。
  const text = markdown(join(DOCS, "reference", "diagnostics"))
    .filter((p) => !p.endsWith("retired.md"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  const revived = RETIRED.filter((code) =>
    new RegExp(`^#{2,4}\\s+${code}\\b`, "m").test(text),
  );
  assert.deepEqual(revived, [], `欠番なのに項目の見出しを持つ: ${revived.join(", ")}`);
});

test("既定の言語版が 1.0 として書かれている", { skip: !canonical }, () => {
  const text = corpus("reference", "muro");
  assert.ok(/koyu 1\.0/.test(text), "既定の言語版 1.0 がリファレンスに現れない");
  // 長く 0.5 (ja) / 0.4 (en) が既定として書かれていた。位置の既定 `at:0.5` とは
  // 別物なので、言語版を名指ししている綴りだけを見る。
  assert.ok(
    !/(?:言語版|language version)[^。\n]{0,20}(?:既定|defaults? (?:to|is))[^。\n]{0,10}0\.[45]/.test(
      text,
    ),
    "既定の言語版を 0.4 / 0.5 と書いた箇所が残っている",
  );
  assert.ok(
    !/```muro[^`]*\bkoyu 0\.[1-5]\b/s.test(text),
    "例が古い言語版を宣言している",
  );
});

/**
 * 公開されない場所。website/scripts/prepare-content.mjs の INTERNAL /
 * INTERNAL_FILES と同じ集合でなければならない — 食い違うと、この門番が
 * 公開されない頁に英語を要求するか、公開される頁を見逃す。
 */
const INTERNAL_DIRS = ["decisions", "log", "reviews", "notes", "img"];
const INTERNAL_FILES = [
  "policy.md",
  "horizon.md",
  "ifc-coverage.md",
  "ifcx-notes.md",
  "modules.md",
  "terminology.md",
  "writing-architecture.md",
];

