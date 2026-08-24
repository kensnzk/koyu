import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { ContextSnapshot } from "../src/analysis/contracts.js";
import { parseFile } from "../src/parse-file.js";
import { assess, runAnalysis } from "../src/validate/assessment.js";
import {
  createSchematicRegistry,
  SCHEMATIC_ANALYSES,
  SCHEMATIC_ANALYSIS_IDS,
  SCHEMATIC_PROFILE,
  SCHEMATIC_PROFILE_ID,
  SCHEMATIC_RULE_SET,
  SCHEMATIC_RULE_SET_ID,
  SCHEMATIC_RULES,
} from "../src/validate/builtin/index.js";

const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

/**
 * The legacy ledger order, with two documented changes: `run.slope` splits in place into the ramp
 * rule and then the escalator rule (ADR-0055 §4), and `envelope.gap` is gone — muro 1.4 cannot
 * reach the state it reported, because an unfaced perimeter is now a wall (ADR-0065).
 */
const EXPECTED_RULE_ORDER = [
  "koyu.schematic.daylight.ratio",
  "koyu.schematic.daylight.unknown",
  "koyu.schematic.stair.proportion",
  "koyu.schematic.ramp.declared-slope",
  "koyu.schematic.escalator.usual-slope",
  "koyu.schematic.run.disconnected",
  "koyu.schematic.access.unreachable",
  "koyu.schematic.access.voidonly",
  "koyu.schematic.access.throughtenant",
  "koyu.schematic.access.parking",
  "koyu.schematic.access.backofhouse",
  "koyu.schematic.column.blocksdoor",
  "koyu.schematic.opening.storage-leaves-space",
  "koyu.schematic.opening.storage-overlaps-opening",
  "koyu.schematic.site.escape",
  "koyu.schematic.site.area",
  "koyu.schematic.site.frontage",
];

function bundledExamples(): string[] {
  const root = fileURLToPath(new URL("../examples", import.meta.url));
  const entries: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".muro")) {
      entries.push(entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name === "steps") {
      for (const step of readdirSync(join(root, entry.name))) {
        if (step.endsWith(".muro")) entries.push(`steps/${step}`);
      }
      continue;
    }
    if (existsSync(join(root, entry.name, "main.muro"))) entries.push(`${entry.name}/main.muro`);
  }
  return entries.sort();
}

const EXPECTED_ANALYSIS_ORDER = [
  "koyu.analysis.daylight",
  "koyu.analysis.vertical-runs",
  "koyu.analysis.access",
  "koyu.analysis.door-column-collisions",
  "koyu.analysis.opening-operations",
  "koyu.analysis.site",
];

/** Which new rule identities carry each legacy rule. `run.slope` is the only one-to-many entry. */
const LEGACY_TO_NEW: Record<string, string[]> = {
  "daylight.ratio": ["koyu.schematic.daylight.ratio"],
  "daylight.unknown": ["koyu.schematic.daylight.unknown"],
  "stair.proportion": ["koyu.schematic.stair.proportion"],
  "run.slope": ["koyu.schematic.ramp.declared-slope", "koyu.schematic.escalator.usual-slope"],
  "run.disconnected": ["koyu.schematic.run.disconnected"],
  "access.unreachable": ["koyu.schematic.access.unreachable"],
  "access.voidonly": ["koyu.schematic.access.voidonly"],
  "access.throughtenant": ["koyu.schematic.access.throughtenant"],
  "access.parking": ["koyu.schematic.access.parking"],
  "access.backofhouse": ["koyu.schematic.access.backofhouse"],
  "column.blocksdoor": ["koyu.schematic.column.blocksdoor"],
  "site.escape": ["koyu.schematic.site.escape"],
  "site.area": ["koyu.schematic.site.area"],
  "site.frontage": ["koyu.schematic.site.frontage"],
};

test("the built-in rule set keeps the legacy order and adds the opening-operation rule beside collisions", () => {
  assert.deepEqual(SCHEMATIC_RULES.map((rule) => rule.id), EXPECTED_RULE_ORDER);
  assert.deepEqual(SCHEMATIC_RULE_SET.rules.map((rule) => rule.id), EXPECTED_RULE_ORDER);
  for (const rule of SCHEMATIC_RULES) assert.equal(rule.revision, "1");
});

test("the built-in catalog holds its analyses in the declared order", () => {
  assert.deepEqual(SCHEMATIC_ANALYSES.map((analysis) => analysis.id), EXPECTED_ANALYSIS_ORDER);
  assert.deepEqual(SCHEMATIC_ANALYSIS_IDS.map((ref) => ref.id), EXPECTED_ANALYSIS_ORDER);
  for (const analysis of SCHEMATIC_ANALYSES) {
    assert.equal(analysis.revision, "1");
    assert.equal(analysis.model, "consistent");
    assert.deepEqual(analysis.context, [], `${analysis.id} must need no external context`);
  }
});

test("the rules that existed before the cutover are all carried but the envelope gap, and only run.slope split", () => {
  // The old ledger is deleted, so this is the migration record rather than a live comparison:
  // every key below is carried, `run.slope` is the only one-to-many entry, and `envelope.gap`
  // is absent because it was retired rather than carried (ADR-0065).
  const carried = Object.values(LEGACY_TO_NEW).flat();
  assert.deepEqual(
    carried.slice().sort(),
    EXPECTED_RULE_ORDER.filter((id) => !id.startsWith("koyu.schematic.opening.")).sort(),
  );

  const oneToMany = Object.entries(LEGACY_TO_NEW).filter(([, ids]) => ids.length > 1);
  assert.deepEqual(oneToMany.map(([old]) => old), ["run.slope"]);

  const byId = new Map(SCHEMATIC_RULES.map((rule) => [rule.id, rule]));
  for (const newId of carried) assert.ok(byId.get(newId), newId);
});

test("the pack is design lint, and claims neither jurisdiction nor authority", () => {
  assert.equal(SCHEMATIC_RULE_SET.purpose, "design-lint");
  assert.equal(SCHEMATIC_RULE_SET.jurisdiction, undefined);
  assert.equal(SCHEMATIC_RULE_SET.effective, undefined);
  assert.equal(SCHEMATIC_PROFILE.jurisdiction, undefined);
  assert.equal(SCHEMATIC_PROFILE.effective, undefined);

  assert.equal(SCHEMATIC_RULE_SET_ID.id, "koyu.ruleset.schematic-screen");
  assert.equal(SCHEMATIC_PROFILE_ID.id, "koyu.profile.schematic-screen");

  for (const rule of SCHEMATIC_RULES) {
    assert.ok(rule.id.startsWith("koyu.schematic."), rule.id);
    assert.deepEqual(rule.authority, [], `${rule.id} must cite no authority`);
    assert.deepEqual(rule.context, [], `${rule.id} must need no external context`);
  }
});

test("the profile reaches every analysis its rules require", () => {
  const reachable = new Set(SCHEMATIC_PROFILE.analyses.map((ref) => `${ref.id}@${ref.revision}`));
  assert.deepEqual(SCHEMATIC_PROFILE.analyses.map((ref) => ref.id), EXPECTED_ANALYSIS_ORDER);
  for (const rule of SCHEMATIC_RULES) {
    for (const requirement of rule.analyses) {
      const key = `${requirement.analysis.id}@${requirement.analysis.revision}`;
      assert.ok(reachable.has(key), `${rule.id} requires unreachable ${key}`);
    }
  }
  assert.deepEqual(
    SCHEMATIC_PROFILE.ruleSets.map((ref) => `${ref.id}@${ref.revision}`),
    ["koyu.ruleset.schematic-screen@1"],
  );
});

test("the catalog is deeply frozen against a real mutation", () => {
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
    if (seen.has(value)) return;
    seen.add(value);
    assert.ok(Object.isFrozen(value), `unfrozen value in the built-in catalog: ${String(value)}`);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) walk(descriptor.value);
    }
  };
  walk(SCHEMATIC_RULE_SET);
  walk(SCHEMATIC_PROFILE);
  for (const analysis of SCHEMATIC_ANALYSES) walk(analysis);

  assert.throws(() => {
    (SCHEMATIC_RULES as unknown as unknown[]).push({} as never);
  }, TypeError);
});

test("two registries built from the catalog are independent values, not a shared global", () => {
  const first = createSchematicRegistry();
  const second = createSchematicRegistry();
  assert.notEqual(first, second);
  assert.equal(first.ruleSets.length, 1);
  assert.equal(second.profiles.length, 1);
  assert.deepEqual(first.analyses.map((analysis) => analysis.id), EXPECTED_ANALYSIS_ORDER);
});

test("the whole pack runs against a bundled example and reports every rule", () => {
  const model = parseFile(fileURLToPath(new URL("../examples/house/main.muro", import.meta.url)));
  const registry = createSchematicRegistry();
  const report = assess(model, {
    registry,
    profile: SCHEMATIC_PROFILE_ID,
    context: CONTEXT,
  });

  assert.equal(report.model.state, "consistent");
  // Every rule in the set is accounted for, in declaration order, and none errored.
  assert.deepEqual(report.rules.map((run) => run.rule.id), EXPECTED_RULE_ORDER);
  const errored = report.rules.filter((run) => run.state === "error");
  assert.deepEqual(errored.map((run) => run.rule.id), []);

  // Every analysis the profile declares actually produced a result.
  assert.deepEqual(
    report.analyses.map((result) => result.analysis.id).slice().sort(),
    EXPECTED_ANALYSIS_ORDER.slice().sort(),
  );
  assert.equal(report.summary.rules.error, 0);
});

test("every bundled example runs the whole pack clean, with nothing left unjudged", () => {
  const registry = createSchematicRegistry();

  for (const name of bundledExamples()) {
    const model = parseFile(fileURLToPath(new URL(`../examples/${name}`, import.meta.url)));
    const report = assess(model, {
      registry,
      profile: SCHEMATIC_PROFILE_ID,
      context: CONTEXT,
    });

    // A rule that threw would otherwise look exactly like "nothing found".
    assert.deepEqual(report.rules.filter((run) => run.state === "error").map((r) => r.rule.id), [], name);
    assert.deepEqual(report.rules.filter((run) => run.state === "indeterminate").map((r) => r.rule.id), [], name);
    assert.equal(report.summary.state, "complete", name);
    assert.equal(report.model.state, "consistent", name);
    assert.deepEqual(report.findings.map((f) => `${f.rule.id}:${f.outcome.id}`), [], name);
  }
});

test("each analysis runs on its own without the rules, and stays JSON", () => {
  const model = parseFile(fileURLToPath(new URL("../examples/house/main.muro", import.meta.url)));
  const registry = createSchematicRegistry();

  for (const ref of SCHEMATIC_ANALYSIS_IDS) {
    const report = runAnalysis(model, ref, {
      registry,
      profile: SCHEMATIC_PROFILE_ID,
      context: CONTEXT,
    });
    assert.equal(report.result.analysis.id, ref.id);
    const serialized = JSON.stringify(report.result.artifact);
    assert.equal(typeof serialized, "string");
    for (const rule of SCHEMATIC_RULES) {
      assert.equal(serialized.includes(rule.id), false, `${ref.id} leaked ${rule.id}`);
    }
  }
});
