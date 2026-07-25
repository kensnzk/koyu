// リリース情報の同期 (ADR-0013 — 外部レビューD-011の回収)。
// package / lockfile / CITATION.cff / spec各文書 / MCPサーバーの版が乖離したらここで落ちる。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");

test("版の同期: package / lockfile / CITATION / spec / MCP", () => {
  const pkg = JSON.parse(read("package.json")) as { name: string; version: string };
  const lock = JSON.parse(read("package-lock.json")) as {
    name: string;
    version: string;
    packages: Record<string, { name?: string; version?: string }>;
  };
  assert.equal(lock.name, pkg.name, "lockfileの名前");
  assert.equal(lock.version, pkg.version, "lockfileの版");
  assert.equal(lock.packages[""]!.version, pkg.version, "lockfileルートパッケージの版");
  assert.match(read("CITATION.cff"), new RegExp(`version: "${pkg.version.replace(/\./g, "\\.")}"`), "CITATION.cff");
  const vTag = new RegExp(`koyu v${pkg.version.replace(/\./g, "\\.")}`);
  for (const f of [
    "spec/README.md",
    "spec/language.md",
    "spec/semantics.md",
    "spec/tools.md",
    "spec/canonical-json.md",
  ]) {
    assert.match(read(f), vTag, f);
  }
  assert.match(
    read("src/mcp.ts"),
    new RegExp(`version: "${pkg.version.replace(/\./g, "\\.")}"`),
    "MCP serverInfo",
  );
});
