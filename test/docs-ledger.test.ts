// The published documentation inventories must agree with the implementation.
//
// The published documentation is authoritative. If it disagrees with the implementation, readers
// have no independent way to resolve the conflict. Counts that were correct when written used to
// remain after their inventories changed.
//
// Tests enforce the rule not to hand-write those counts. DIAGNOSTIC_CODES, the built-in rule
// catalog, the exports in src/index.ts, TOOLS in mcp.ts and the CLI usage line are the sources.
// Published pages must cover every member without copying the population size.
//
// A heading's spelling also becomes its anchor, so this verifies that links such as
// /reference/diagnostics/opn#opn05 have a target.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_CODES } from "../src/core/diagnose.js";
import { SCHEMATIC_RULES } from "../src/validate/builtin/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const DOCS = join(root, "docs");

/** Allow intermediate migration states before the authoritative tree exists. */
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

/** Read one section of the published tree as a single corpus. */
function corpus(...segments: string[]): string {
  return markdown(join(DOCS, ...segments))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

const cliSource = readFileSync(join(root, "src", "cli.ts"), "utf8");
const cliUsage = /Usage: koyu <([^>]+)>/.exec(cliSource)?.[1];
assert.ok(cliUsage, "src/cli.ts has no subcommand ledger in its usage line");
const CLI_SUBCOMMANDS = cliUsage.split("|");

const mcpSource = readFileSync(join(root, "src", "mcp.ts"), "utf8");
const mcpToolObject = /^const TOOLS: Record<string, Tool> = \{([\s\S]*?)^\};/m.exec(mcpSource)?.[1];
assert.ok(mcpToolObject, "src/mcp.ts has no TOOLS ledger");
const MCP_TOOLS = [...mcpToolObject.matchAll(/^  ([a-z][a-z0-9_]*): \{/gm)].map((match) => match[1]!);

/** Retired codes must not be documented as live diagnostics. */
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

test("every diagnostic code has a heading", { skip: !canonical }, () => {
  const text = corpus("reference", "diagnostics");
  const missing = Object.keys(DIAGNOSTIC_CODES).filter(
    (code) => !new RegExp(`^#{2,4}\\s.*\\b${code}\\b`, "m").test(text),
  );
  assert.deepEqual(missing, [], `diagnostic codes with no heading: ${missing.join(", ")}`);
});

test("every validation rule has a heading", { skip: !canonical }, () => {
  const text = corpus("reference", "validate");
  const missing = SCHEMATIC_RULES.map((rule) => rule.id).filter(
    (rule) => !new RegExp(`^#{2,4}\\s.*${rule.replace(/\./g, "\\.")}`, "m").test(text),
  );
  assert.deepEqual(missing, [], `validation rules with no heading: ${missing.join(", ")}`);
});

// **The count is not written into the name.** A test called "all N subcommands" goes on saying
// fourteen after the fifteenth is added, and a name that states a false total is worse than one
// that states none — the ledger above is the only place the number lives.
test("every CLI subcommand has a page", { skip: !canonical }, () => {
  const dir = join(DOCS, "reference", "cli");
  const missing = CLI_SUBCOMMANDS.filter((cmd) => !existsSync(join(dir, `${cmd}.md`)));
  assert.deepEqual(missing, [], `subcommands with no page: ${missing.join(", ")}`);
});

test("every MCP tool has a heading", { skip: !canonical }, () => {
  const text = corpus("reference", "mcp");
  const missing = MCP_TOOLS.filter(
    (tool) => !new RegExp(`^#{2,4}\\s.*\\b${tool}\\b`, "m").test(text),
  );
  assert.deepEqual(missing, [], `MCP tools with no heading: ${missing.join(", ")}`);
});

test("every public API export is documented", { skip: !canonical }, () => {
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
  assert.deepEqual(missing, [], `public names absent from the documentation: ${missing.join(", ")}`);
});

test("retired codes are not documented as live diagnostics", { skip: !canonical }, () => {
  // retired.md exists to explain retired codes and is excluded. A heading elsewhere revives the
  // code in the published diagnostic inventory.
  const text = markdown(join(DOCS, "reference", "diagnostics"))
    .filter((p) => !p.endsWith("retired.md"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  const revived = RETIRED.filter((code) =>
    new RegExp(`^#{2,4}\\s+${code}\\b`, "m").test(text),
  );
  assert.deepEqual(revived, [], `retired codes with a live heading: ${revived.join(", ")}`);
});

// The default and accepted-language-version checks moved to restatements.test.ts. The former
// check copied a default version literal and stayed green after the source constant moved. Its
// replacement reads the constant directly.

// This file also used to copy the unpublished-path inventory without consuming it. The source is
// now only INTERNAL / INTERNAL_FILES in prepare-content.mjs; no duplicate inventory remains here.
