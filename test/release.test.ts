// リリース情報の同期 (ADR-0013 / ADR-0017 — 外部レビューD-011の回収)。
// package / lockfile / CITATION.cff / spec各文書 / MCPサーバーの版、言語版の台帳、
// 正準JSONフィクスチャが乖離したらここで落ちる。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS, toCanonical } from "../src/core/model.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");

test("version sync: package / lockfile / CITATION / MCP", () => {
  const pkg = JSON.parse(read("package.json")) as { name: string; version: string };
  const lock = JSON.parse(read("package-lock.json")) as {
    name: string;
    version: string;
    packages: Record<string, { name?: string; version?: string }>;
  };
  assert.equal(lock.name, pkg.name, "lockfile name");
  assert.equal(lock.version, pkg.version, "lockfile version");
  assert.equal(lock.packages[""]!.version, pkg.version, "lockfile root package version");
  assert.match(read("CITATION.cff"), new RegExp(`version: "${pkg.version.replace(/\./g, "\\.")}"`), "CITATION.cff");
  // The published documentation does not carry the version in its prose — the version belongs to
  // git, not to the body of a page that is always in the present tense. `spec/` used to name it on
  // five pages and this test kept them in step; the pages are gone (ADR-0046)
  assert.match(
    read("src/mcp.ts"),
    new RegExp(`version: "${pkg.version.replace(/\./g, "\\.")}"`),
    "MCP serverInfo",
  );
});

test("language version sync: the published norm, the examples and the canonical JSON fixture (ADR-0017)", () => {
  // The version norm of the published documentation agrees with the implementation ledger.
  // The page lists the accepted versions on one line, oldest first — the order is the norm,
  // because the newest is decided by index and not by how the string sorts.
  const inOrder = new RegExp(SUPPORTED_LANGUAGE_VERSIONS.map((v) => v.replace(".", "\\.")).join("\\s+"));
  for (const page of ["docs/reference/muro/version.md", "docs/en/reference/muro/version.md"]) {
    const md = read(page);
    assert.match(md, inOrder, `the accepted versions, in order, in ${page}`);
    assert.ok(md.includes(`\`${DEFAULT_LANGUAGE_VERSION}\``), `the default when omitted, in ${page}`);
  }
  // examplesは常に最新版で書く
  for (const f of [
    "examples/two-rooms.muro",
    "examples/office.muro",
    "examples/mansion.muro",
    "examples/house.muro",
    "examples/house/main.muro",
    "examples/tower/main.muro",
  ]) {
    assert.match(read(f), new RegExp(`^koyu ${DEFAULT_LANGUAGE_VERSION.replace(/\./g, "\\.")}$`, "m"), f);
  }
  // 正準JSONフィクスチャは実装の出力とバイト一致 (黙った乖離の防止)
  assert.equal(
    read("examples/two-rooms.canonical.json"),
    toCanonical(parseFile(root + "examples/two-rooms.muro")),
    "two-rooms.canonical.json",
  );
});
