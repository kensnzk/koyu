// リリース情報の同期 (ADR-0013 / ADR-0017 — 外部レビューD-011の回収)。
// package / lockfile / CITATION.cff / spec各文書 / MCPサーバーの版、言語版の台帳、
// 正準JSONフィクスチャが乖離したらここで落ちる。

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANGUAGE_VERSION,
  KOYU_VERSION,
  NEWEST_LANGUAGE_VERSION,
  MURO_SUPPORT,
  SUPPORTED_LANGUAGE_VERSIONS,
  toCanonical,
} from "../src/core/model.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");

/** Every .muro under a directory, so a version bump cannot miss one nobody listed. */
function muroFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) muroFiles(path, out);
    else if (entry.endsWith(".muro")) out.push(path);
  }
  return out;
}

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
  // The MCP server no longer spells the version itself — it reads `KOYU_VERSION`, so this
  // holds the one remaining literal. Two places carrying the same number is how they drift.
  assert.match(
    read("src/core/model.ts"),
    new RegExp(`KOYU_VERSION = "${pkg.version.replace(/\./g, "\\.")}"`),
    "KOYU_VERSION",
  );
});

/** Compare two `major.minor.patch` strings. Prerelease suffixes are not used in the ledger. */
function cmpSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The relation between the two version lines, which nothing held until now.
 *
 * The decision that split the axes named the missing machine check as its own cost: the
 * release test compared each axis against its own restatements and never against the other.
 *
 * **Half of the rule is now true by construction rather than by assertion.**
 * `SUPPORTED_LANGUAGE_VERSIONS` and `DEFAULT_LANGUAGE_VERSION` are derived from
 * `MURO_SUPPORT`, so the newest accepted version cannot move without a row being added — a
 * language version can no longer be cut halfway. What is left to check is that the row is
 * honest about which koyu it arrived in.
 */
test("the muro ledger and the koyu version agree (ADR-0042 代償1)", () => {
  const pkg = JSON.parse(read("package.json")) as { version: string };
  assert.equal(KOYU_VERSION, pkg.version, "KOYU_VERSION tracks package.json");

  for (const row of MURO_SUPPORT) {
    assert.match(row.muro, /^\d+\.\d+$/, `muro version is major.minor: ${row.muro}`);
    assert.match(row.since, /^\d+\.\d+\.\d+$/, `since is a plain release: ${row.muro} -> ${row.since}`);
    if (row.until !== null) {
      assert.match(row.until, /^\d+\.\d+\.\d+$/, `until is a plain release: ${row.muro} -> ${row.until}`);
    }
  }

  // Versions arrive in order, and so do the releases that carried them. Several language
  // versions may share a release — 0.3, 0.4 and 0.5 all arrived in 0.11.0 — so this is
  // non-decreasing, not strictly increasing.
  for (let i = 1; i < MURO_SUPPORT.length; i++) {
    assert.ok(
      cmpSemver(MURO_SUPPORT[i]!.since, MURO_SUPPORT[i - 1]!.since) >= 0,
      `the ledger is ordered by arrival: ${MURO_SUPPORT[i - 1]!.muro} (${MURO_SUPPORT[i - 1]!.since}) then ${MURO_SUPPORT[i]!.muro} (${MURO_SUPPORT[i]!.since})`,
    );
  }

  // **The check that catches a half-cut language version.** Adding a row for a new language
  // version means naming the release it ships in; if package.json has not been raised to
  // that release yet, the ledger is promising a version nobody can install.
  for (const row of MURO_SUPPORT) {
    assert.ok(
      cmpSemver(row.since, pkg.version) <= 0,
      `muro ${row.muro} claims to have arrived in koyu ${row.since}, which is ahead of this package (${pkg.version}) — raise the version in the same change, or correct the row`,
    );
  }

  // A retired version stops being accepted; retirement runs oldest-first, so the accepted
  // versions are always a suffix of the ledger.
  const retired = MURO_SUPPORT.filter((r) => r.until !== null).map((r) => r.muro);
  assert.deepEqual(
    SUPPORTED_LANGUAGE_VERSIONS.filter((v) => retired.includes(v)),
    [],
    "a retired version is not still accepted",
  );
  assert.deepEqual(
    [...SUPPORTED_LANGUAGE_VERSIONS],
    MURO_SUPPORT.filter((r) => r.until === null).map((r) => r.muro),
    "the accepted versions are the ledger's live rows, in the ledger's order",
  );
});

/**
 * `package.json` states which muro this build speaks, so a downstream can check it without
 * importing the package. That makes it a restatement of `MURO_SUPPORT`, and a restatement
 * with nothing holding it is what this whole undertaking exists to remove.
 */
test("the muro support declared in package.json equals the ledger", () => {
  const pkg = JSON.parse(read("package.json")) as {
    muro?: { reads: string[]; newest: string; undeclared: string };
  };
  assert.ok(pkg.muro, "package.json declares which muro it speaks");
  assert.deepEqual(pkg.muro!.reads, [...SUPPORTED_LANGUAGE_VERSIONS], "package.json muro.reads");
  assert.equal(pkg.muro!.newest, NEWEST_LANGUAGE_VERSION, "package.json muro.newest");
  // Separate from `newest` on purpose: they coincide today and diverge the day 1.2 lands.
  assert.equal(pkg.muro!.undeclared, DEFAULT_LANGUAGE_VERSION, "package.json muro.undeclared");
});

test("language version sync: the published norm, the examples and the canonical JSON fixture (ADR-0017)", () => {
  // The version norm of the published documentation agrees with the implementation ledger.
  // The page lists the accepted versions on one line, oldest first — the order is the norm,
  // because the newest is decided by index and not by how the string sorts.
  const inOrder = new RegExp(SUPPORTED_LANGUAGE_VERSIONS.map((v) => v.replace(".", "\\.")).join("\\s+"));
  for (const page of ["docs/reference/muro/version.md"]) {
    const md = read(page);
    assert.match(md, inOrder, `the accepted versions, in order, in ${page}`);
    assert.ok(md.includes(`\`${DEFAULT_LANGUAGE_VERSION}\``), `the default when omitted, in ${page}`);
  }
  // examplesは常に最新版で書く (掟9)。
  //
  // Discovered, not listed. Six of the ten entry files that declare a version
  // were named here while `check:examples` named twelve and `gate:examples`
  // walked the tree, so basement, complex, steps/06-finished and twin could
  // have declared anything. A hand-written list of the things a version bump
  // must touch is the defect it is meant to catch.
  const declared = muroFiles(root + "examples").filter((p) => /^koyu /m.test(readFileSync(p, "utf8")));
  assert.ok(declared.length >= 10, `too few example entry files found (${declared.length}) — the walk is broken`);
  for (const p of declared) {
    assert.match(
      readFileSync(p, "utf8"),
      new RegExp(`^koyu ${NEWEST_LANGUAGE_VERSION.replace(/\./g, "\\.")}$`, "m"),
      p.slice(root.length),
    );
  }
  // 正準JSONフィクスチャは実装の出力とバイト一致 (黙った乖離の防止)
  assert.equal(
    read("examples/two-rooms.canonical.json"),
    toCanonical(parseFile(root + "examples/two-rooms.muro")),
    "two-rooms.canonical.json",
  );
});
