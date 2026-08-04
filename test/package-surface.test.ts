// The twelve entry points, held to their contract by machine.
//
// The published surface is a set, and four things have to agree about it: `package.json#exports`,
// the modules those entries actually resolve to, the API reference, and the dependency direction.
// Prose cannot hold four things in agreement; this file can.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, unknown>;
};

/** The twelve JavaScript entry points, and the source each one resolves to. */
const ENTRIES: ReadonlyArray<readonly [subpath: string, source: string]> = [
  [".", "src/index.ts"],
  ["./model", "src/model.ts"],
  ["./diagnostics", "src/diagnostics.ts"],
  ["./graph", "src/graph.ts"],
  ["./form", "src/form.ts"],
  ["./analysis", "src/analysis/index.ts"],
  ["./diff", "src/diff.ts"],
  ["./vocabulary", "src/vocabulary.ts"],
  ["./validate", "src/validate/index.ts"],
  ["./validate/builtin", "src/validate/builtin/index.ts"],
  ["./draw", "src/draw/index.ts"],
  ["./node", "src/parse-file.ts"],
];

/** Data entries: not JavaScript, so they carry no module contract. */
const DATA_ENTRIES = ["./examples/*", "./syntax", "./package.json"];

test("package: exports declares exactly the twelve entry points plus the data entries", () => {
  assert.deepEqual(
    Object.keys(pkg.exports),
    [...ENTRIES.map(([subpath]) => subpath), ...DATA_ENTRIES],
    "package.json#exports and the approved entry list disagree",
  );
});

test("package: every declared entry resolves to the source it claims", () => {
  for (const [subpath, source] of ENTRIES) {
    const entry = pkg.exports[subpath] as { types: string; default: string };
    const expected = source.replace(/^src\//, "./dist/").replace(/\.ts$/, "");
    assert.equal(entry.default, `${expected}.js`, subpath);
    assert.equal(entry.types, `${expected}.d.ts`, subpath);
    assert.ok(statSync(join(root, source)).isFile(), `${subpath} has no source at ${source}`);
  }
});

test("package: each entry point is importable and exports at least one name", async () => {
  for (const [subpath, source] of ENTRIES) {
    const mod = (await import(join(root, source))) as Record<string, unknown>;
    const names = Object.keys(mod).filter((n) => n !== "default");
    assert.ok(names.length > 0, `${subpath} exports nothing`);
  }
});

test("package: the API reference names every declared subpath", () => {
  const md = readFileSync(join(root, "docs/reference/api/index.md"), "utf8");
  for (const [subpath] of ENTRIES) {
    const name = subpath === "." ? "@kensnzk/koyu" : `@kensnzk/koyu${subpath.slice(1)}`;
    assert.ok(md.includes(`\`${name}\``), `${name} is exported but is nowhere in the API reference`);
  }
});

// ---- root is a facade, not an aggregate ----

test("root: re-exports no domain module", () => {
  const src = readFileSync(join(root, "src/index.ts"), "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
  const from = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  // The loop needs composition, diagnosis and the canonical form. Nothing else.
  assert.deepEqual(
    [...new Set(from)].sort(),
    ["./core/diagnose.js", "./core/model.js", "./core/parse.js"],
    "root reaches past the minimal facade — a domain name belongs to its own entry point",
  );
});

test("root: carries no domain name", async () => {
  // Composing, checking and canonicalising are the loop, so those names may also appear in a
  // domain entry. What root must never become is the aggregate: the moment a query, a
  // derivation, a judgement or a drawing is reachable from root, the import line stops
  // telling the reader which contract they are relying on.
  const rootMod = (await import(join(root, "src/index.ts"))) as Record<string, unknown>;
  const rootNames = new Set(Object.keys(rootMod));

  const DOMAIN_NAMES = [
    "areaM2", "levelsSorted", "zoneAreaM2", "newUids", // model queries
    "doorsBetween", "neighbors", "passable", "segmentsFor", // graph
    "derive", "slabs", "verticalRuns", // form
    "runAnalysis", // analysis
    "semanticDiff", "renderDiff", // diff
    "ATTR_LEDGER", "attrSpec", // vocabulary
    "assess", "createAssessmentRegistry", "createSchematicRegistry", // validation
    "svgPlan", "svgAxo", // drawing
    "parseFile", "parseFileWith", // node
    "daylightInputs", "siteReport", // domain questions
  ];
  const leaked = DOMAIN_NAMES.filter((n) => rootNames.has(n));
  assert.deepEqual(leaked, [], `root has become an aggregate: ${leaked.join(", ")}`);

  // And it stays small. The exact set is pinned against the API reference elsewhere.
  assert.ok(rootNames.size <= 12, `root exports ${rootNames.size} values — it is meant to be minimal`);
});

// ---- browser safety ----

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/** Every source file reachable from an entry, following relative imports. */
function reachableFrom(entrySource: string): string[] {
  const seen = new Set<string>();
  const stack = [join(root, entrySource)];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
      const spec = m[1]!;
      if (!spec.startsWith(".")) continue;
      stack.push(resolve(file, "..", spec.replace(/\.js$/, ".ts")));
    }
  }
  return [...seen];
}

/** The bare module specifiers a file imports. */
function bareImportsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/from\s+"([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((spec) => !spec.startsWith("."));
}

test("browser safety: only /node reaches a Node builtin", () => {
  for (const [subpath, source] of ENTRIES) {
    if (subpath === "./node") continue;
    const offenders: string[] = [];
    for (const file of reachableFrom(source)) {
      for (const spec of bareImportsOf(file)) {
        if (NODE_BUILTINS.has(spec)) offenders.push(`${relative(root, file)} → ${spec}`);
      }
    }
    assert.deepEqual(offenders, [], `${subpath} pulls a Node builtin:\n${offenders.join("\n")}`);
  }
});

test("zero runtime dependencies: the package declares none, and nothing imports one", () => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.peerDependencies ?? {}, {});

  const offenders: string[] = [];
  for (const file of tsFiles(join(root, "src"))) {
    for (const spec of bareImportsOf(file)) {
      if (!NODE_BUILTINS.has(spec)) offenders.push(`${relative(root, file)} → ${spec}`);
    }
  }
  assert.deepEqual(offenders, [], `src/ imports a third-party module:\n${offenders.join("\n")}`);
});

// ---- the adapters own no thresholds ----

test("adapters: the CLI and the MCP server carry no rule threshold of their own", () => {
  // Every number a rule compares against lives in one place. An adapter that divides or
  // compares on its own eventually disagrees with the rule it is supposed to be reporting.
  const forbidden: Array<[RegExp, string]> = [
    [/\/\s*7\b/, "the daylight divisor"],
    [/\b2400\b/, "the vehicle-door width"],
    [/\b2000\b(?!\s*-)/, "the frontage minimum"],
    [/\b0\.05\b/, "the site-area tolerance"],
    [/\b550\b|\b700\b|\b240\b/, "the stair band"],
    [/1\s*\/\s*2\.3|1\s*\/\s*1\.4/, "the escalator band"],
  ];
  for (const file of ["src/cli.ts", "src/mcp.ts"]) {
    const text = readFileSync(join(root, file), "utf8")
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        // Comments and tool descriptions talk *about* the rules; they do not apply one.
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith('"') && !t.startsWith("description:");
      })
      .join("\n");
    for (const [pattern, what] of forbidden) {
      assert.equal(pattern.test(text), false, `${file} appears to carry ${what} of its own`);
    }
  }
});

test("adapters: no legacy validation name survives anywhere in the repository", () => {
  const dead = ["VALIDATION_RULES", "ValidationRule", "validate(model)", "daylightFindings", "siteFindings", "accessFindings"];
  const roots = ["src", "test", "eval", "scripts"].map((d) => join(root, d));
  const self = fileURLToPath(import.meta.url);
  const offenders: string[] = [];
  for (const dir of roots) {
    for (const file of tsFiles(dir)) {
      if (file === self) continue; // this file names them in order to forbid them
      const text = readFileSync(file, "utf8");
      for (const name of dead) {
        if (text.includes(name)) offenders.push(`${relative(root, file)} → ${name}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a deleted name is still referenced:\n${offenders.join("\n")}`);
});

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) tsFiles(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".mjs")) out.push(p);
  }
  return out;
}
