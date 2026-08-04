// The same question, asked three ways, has to come back the same.
//
// ADR-0053 says regulatory validation returns the same `AssessmentReport` whether it is reached
// from TypeScript, from `koyu validate --json`, or from the MCP `validate` tool. If the three
// could drift, "the CLI answers what the API answers" would be a slogan rather than a contract.
//
// The comparison is on the whole report, byte for byte after JSON round-tripping — not on a
// summary or a count, because a divergence in evidence or provenance is exactly the kind of
// thing a count would hide.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFile } from "../src/parse-file.js";
import { assess } from "../src/validate/index.js";
import { createSchematicRegistry, SCHEMATIC_PROFILE_ID } from "../src/validate/builtin/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const AS_OF = "2026-08-03";
const PROFILE = SCHEMATIC_PROFILE_ID.id;

/** A building that trips several rules, so the comparison has something to disagree about. */
const SOURCE = `koyu 1.1
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
boundary /L1/b /out t:150
`;

const dir = mkdtempSync(join(tmpdir(), "koyu-entries-"));
const file = join(dir, "main.muro");
writeFileSync(file, SOURCE);

/** Absolute paths differ by entry point only because the file is named differently; normalise. */
function normalise(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value).replaceAll(file, "<file>").replaceAll(dir, "<dir>"));
}

function viaTypeScript(): unknown {
  return normalise(assess(parseFile(file), {
    registry: createSchematicRegistry(),
    profile: SCHEMATIC_PROFILE_ID,
    context: { schema: "koyu-context/1", asOf: AS_OF, values: {} },
  }));
}

function viaCli(): unknown {
  // The fixture is violated, so the CLI exits 1 by design; the report is still on stdout.
  let out: string;
  try {
    out = execFileSync(
      "node",
      ["--import", "tsx", join(root, "src/cli.ts"), "validate", file, "--profile", PROFILE, "--as-of", AS_OF, "--json"],
      { encoding: "utf8", cwd: root },
    );
  } catch (e) {
    const failure = e as { status: number; stdout: string };
    assert.equal(failure.status, 1, "a violated fixture must exit 1, not fail to run");
    out = failure.stdout;
  }
  return normalise(JSON.parse(out));
}

function viaMcp(): unknown {
  const request = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file, profile: PROFILE, asOf: AS_OF } },
    }),
  ].join("\n") + "\n";
  const out = execFileSync("node", ["--import", "tsx", join(root, "src/mcp.ts")], {
    encoding: "utf8",
    input: request,
    cwd: root,
  });
  const last = out.trim().split("\n").filter(Boolean).at(-1)!;
  const response = JSON.parse(last) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.notEqual(response.result.isError, true, response.result.content[0]?.text);
  return normalise(JSON.parse(response.result.content[0]!.text));
}

test("TypeScript, the CLI and MCP return the same assessment report", () => {
  const ts = viaTypeScript();
  const cli = viaCli();
  const mcp = viaMcp();

  assert.deepEqual(cli, ts, "koyu validate --json and the TypeScript API disagree");
  assert.deepEqual(mcp, ts, "the MCP validate tool and the TypeScript API disagree");

  // And the report is worth comparing: it actually caught something.
  const report = ts as { findings: unknown[]; summary: { state: string } };
  assert.ok(report.findings.length > 0, "the fixture must trip at least one rule");
  assert.equal(report.summary.state, "complete");
});

test("all three refuse the same call for the same reason when the profile is missing", () => {
  // CLI: a usage error, off the 0/1 axis.
  let cliCode = 0;
  try {
    execFileSync("node", ["--import", "tsx", join(root, "src/cli.ts"), "validate", file], {
      encoding: "utf8",
      cwd: root,
      stdio: "pipe",
    });
  } catch (e) {
    cliCode = (e as { status: number }).status;
  }
  assert.equal(cliCode, 2, "a missing profile must be a usage error, not a verdict");

  // MCP: invalid arguments, flagged as an error rather than an empty report.
  const request = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file } },
    }),
  ].join("\n") + "\n";
  const out = execFileSync("node", ["--import", "tsx", join(root, "src/mcp.ts")], {
    encoding: "utf8",
    input: request,
    cwd: root,
  });
  const last = out.trim().split("\n").filter(Boolean).at(-1)!;
  const response = JSON.parse(last) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.equal(response.result.isError, true, "MCP accepted a validate call with no profile");
  assert.match(response.result.content[0]!.text, /profile/);
});

test("all three refuse a profile koyu does not ship", () => {
  let cliCode = 0;
  try {
    execFileSync(
      "node",
      ["--import", "tsx", join(root, "src/cli.ts"), "validate", file, "--profile", "jp.bsl.invented", "--as-of", AS_OF],
      { encoding: "utf8", cwd: root, stdio: "pipe" },
    );
  } catch (e) {
    cliCode = (e as { status: number }).status;
  }
  assert.equal(cliCode, 2);

  const request = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "validate", arguments: { file, profile: "jp.bsl.invented", asOf: AS_OF } },
    }),
  ].join("\n") + "\n";
  const out = execFileSync("node", ["--import", "tsx", join(root, "src/mcp.ts")], {
    encoding: "utf8",
    input: request,
    cwd: root,
  });
  const last = out.trim().split("\n").filter(Boolean).at(-1)!;
  const response = JSON.parse(last) as { result: { content: Array<{ text: string }>; isError?: boolean } };
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0]!.text, /Unknown profile/);
});
