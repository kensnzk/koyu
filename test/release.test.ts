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

test("version sync: package / lockfile / CITATION / spec / MCP", () => {
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

test("language version sync: the spec norm, the examples and the canonical JSON fixture (ADR-0017)", () => {
  // spec/language.md の版規範が実装の台帳と一致する
  const lang = read("spec/language.md");
  assert.ok(
    lang.includes(`対応する言語版は \`${SUPPORTED_LANGUAGE_VERSIONS.join(", ")}\``),
    "supported versions in language.md",
  );
  assert.ok(lang.includes(`最新版 \`${DEFAULT_LANGUAGE_VERSION}\``), "the default when omitted, in language.md");
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
