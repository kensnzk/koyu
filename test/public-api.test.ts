// 公開面の門番 (ADR-0037)。
//
// 1.0.0 が凍結する八つの面の八番目は「公開 API と CLI」である (spec/scope.md §8)。
// 凍らせる面は書き下されていなければならない — `export *` は「何を約束したか」を
// 誰も言えない状態を作り、モジュールに export を足した瞬間に、宣言していない約束が
// 凍る面へ増える。
//
// ここが縛るのは四つ。
//   1. src/index.ts に `export *` が無く、面が名前の列として書き下されている
//   2. 書き下された値の列と、実際に実行時に出ている値が一致する
//   3. その名の集合と spec/tools.md (日英) の表が一致する — 片方だけ動いたら落ちる
//   4. CLI のサブコマンドの集合と spec/tools.md (日英) の表・使い方行が一致する
//
// 落ちたときに直す先は二つしかない。面を足したなら表に書く。表から消したなら export を外す。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as api from "../src/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");

const INDEX = read("src/index.ts");
/** コメントを剥いだ本体 — 「`export *` は使わない」と書いた行を検査が拾わないように */
const INDEX_CODE = INDEX.split("\n")
  .filter((l) => !l.trimStart().startsWith("//"))
  .join("\n");

/** src/index.ts が書き下している名 — `export { a, type B } from "…"` の列を読む */
function declaredSurface(): { values: string[]; types: string[] } {
  const values: string[] = [];
  const types: string[] = [];
  for (const m of INDEX_CODE.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}\s*from\s*"[^"]+"/g)) {
    const allTypes = m[1] !== undefined;
    for (const raw of m[2]!.split(",")) {
      const entry = raw.trim();
      if (entry === "") continue;
      const isType = allTypes || entry.startsWith("type ");
      const name = entry.replace(/^type\s+/, "").trim();
      (isType ? types : values).push(name);
    }
  }
  return { values, types };
}

/** The names in the table right after `<!-- api-surface -->` — values and types alike */
function surfaceTable(path: string): string[] {
  const md = read(path);
  const at = md.indexOf("<!-- api-surface -->");
  assert.ok(at >= 0, `${path}: the <!-- api-surface --> marker is missing`);
  const out: string[] = [];
  let started = false;
  for (const line of md.slice(at).split("\n")) {
    if (!line.startsWith("|")) {
      if (started) break; // 表は空行で終わる
      continue;
    }
    started = true;
    const cells = line.split("|").slice(1, -1);
    // 先頭のセルは面の見出し (訳される) なので読まない
    for (const cell of cells.slice(1)) {
      for (const m of cell.matchAll(/`([^`]+)`/g)) out.push(m[1]!);
    }
  }
  assert.ok(started, `${path}: no table follows the marker`);
  return out;
}

/** src/cli.ts に実在するサブコマンド (ハードコードするとここが古びる) */
function cliSubcommands(): string[] {
  const src = read("src/cli.ts");
  const subs = new Set<string>();
  for (const m of src.matchAll(/^\s*case "([a-z][a-z0-9-]*)":/gm)) subs.add(m[1]!);
  for (const m of src.matchAll(/cmd === "([a-z][a-z0-9-]*)"/g)) subs.add(m[1]!);
  return [...subs].sort();
}

// The pages checked are the **published documentation**. `spec/` is an internal tree on its way
// out; while two trees both claim to be normative, the machine must bind the canonical one.
const SURFACE_PAGES = ["docs/reference/api/index.md", "docs/en/reference/api/index.md"];
const CLI_PAGES = ["docs/reference/cli/index.md", "docs/en/reference/cli/index.md"];

// ---- 1. 面が書き下されている ----

test("public API: src/index.ts uses no `export *` (a face that freezes has to be written down)", () => {
  assert.equal(
    /export\s+\*/.test(INDEX_CODE),
    false,
    "`export *` puts names on the frozen face that nobody declared — list them one by one",
  );
});

test("public API: src/index.ts declares nothing of its own (it is a face, not a module)", () => {
  const own = [...INDEX_CODE.matchAll(/^export\s+(?!type\s*\{|\{)(\S+)/gm)].map((m) => m[1]!);
  assert.deepEqual(own, [], `src/index.ts declares its own export: ${own.join(", ")}`);
});

// ---- 2. 書かれた値と、実際に出ている値 ----

test("public API: the values written down and the values actually exported agree", () => {
  const { values } = declaredSurface();
  assert.deepEqual(
    [...values].sort(),
    Object.keys(api).sort(),
    "the list in src/index.ts and the runtime exports disagree",
  );
});

test("public API: no name is written down twice", () => {
  const { values, types } = declaredSurface();
  const all = [...values, ...types];
  const dup = all.filter((n, i) => all.indexOf(n) !== i);
  assert.deepEqual(dup, [], `written down twice: ${dup.join(", ")}`);
});

// ---- 3. 面と公開ドキュメントの一致 ----

for (const page of SURFACE_PAGES) {
  test(`public API: the face and the table in ${page} agree as sets`, () => {
    const { values, types } = declaredSurface();
    const inSpec = surfaceTable(page);
    const dup = inSpec.filter((n, i) => inSpec.indexOf(n) !== i);
    assert.deepEqual(dup, [], `${page}: listed twice: ${dup.join(", ")}`);
    assert.deepEqual(
      [...inSpec].sort(),
      [...values, ...types].sort(),
      `${page} and src/index.ts disagree — either write the new name into the table, or take the export out`,
    );
  });
}

// ---- 4. CLI の面 ----

for (const page of CLI_PAGES) {
  test(`public API: the CLI table in ${page} lists exactly the subcommands that exist`, () => {
    const section = read(page);
    const rows: string[] = [];
    for (const line of section.split("\n")) {
      if (!line.startsWith("|")) continue;
      const first = line.split("|")[1] ?? "";
      // The docs spell the first cell as a link: `| [`check`](check.md) |`
      const m = /^\s*\[?`([a-z][a-z0-9-]*)`\]?(?:\([^)]*\))?\s*$/.exec(first);
      if (m) rows.push(m[1]!);
    }
    assert.deepEqual(rows.sort(), cliSubcommands(), `${page}: the CLI table and src/cli.ts disagree`);
  });

  test(`public API: the usage line in ${page} lists exactly the subcommands that exist`, () => {
    const m = /koyu <([a-z|]+)>/.exec(read(page));
    assert.ok(m, `${page}: there is no usage line`);
    assert.deepEqual(m[1]!.split("|").sort(), cliSubcommands(), `${page}: the usage line is stale`);
  });
}

test("public API: the usage the CLI itself prints lists exactly the subcommands that exist", () => {
  const m = /Usage: koyu <([a-z|]+)>/.exec(read("src/cli.ts"));
  assert.ok(m, "src/cli.ts prints no usage line");
  assert.deepEqual(m[1]!.split("|").sort(), cliSubcommands());
});

// ---- 5. 配布物 ----

test("package: every subpath in exports points at something the build produces", () => {
  const pkg = JSON.parse(read("package.json")) as {
    exports: Record<string, string | Record<string, string>>;
    files: string[];
    engines?: Record<string, string>;
  };
  for (const [sub, target] of Object.entries(pkg.exports)) {
    const paths = typeof target === "string" ? [target] : Object.values(target);
    for (const p of paths) {
      if (p.includes("*")) continue; // パターンは実体を一つに定めない
      const src = p.replace(/^\.\/dist\//, "src/").replace(/\.d\.ts$/, ".ts").replace(/\.js$/, ".ts");
      assert.doesNotThrow(() => read(src.startsWith("./") ? src.slice(2) : src), `${sub} → ${p}`);
    }
  }
  // 仕様を同梱する — 契約は配布物の中にある
  assert.ok(pkg.files.includes("spec"), "the package does not ship spec/");
  assert.ok(pkg.exports["./spec/*"], "spec/ is shipped but not reachable as a subpath");
  assert.ok(pkg.engines?.["node"], "the runtime is not declared (engines.node)");
});
