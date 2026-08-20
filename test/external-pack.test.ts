// An outside rule pack, written against nothing but the published entry points.
//
// The claim ADR-0053 makes is that koyu's own sixteen rules get no privileged path: somebody
// else's pack uses the same SPI, reuses koyu's analyses, and composes alongside the built-ins
// without either one contaminating the other. This file is that claim, executed.
//
// **It imports only what the package publishes.** Nothing here reaches into src/core, and
// nothing registers itself — the catalog is a value handed to each call.

import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "../src/index.js";
import type {
  AnalysisArtifact,
  AnalysisDefinition,
  AnalysisRef,
  ContextKey,
  ContextSnapshot,
} from "../src/analysis/index.js";
import { runAnalysis } from "../src/analysis/index.js";
import { assess, createAssessmentRegistry, AssessmentConfigError } from "../src/validate/index.js";
import type { Profile, Rule, RuleEvaluation, RuleSet } from "../src/validate/index.js";
import {
  createSchematicRegistry,
  SCHEMATIC_ANALYSES,
  SCHEMATIC_PROFILE,
  SCHEMATIC_PROFILE_ID,
  SCHEMATIC_RULE_SET,
  DAYLIGHT_RATIO_RULE,
  SITE_ANALYSIS_ID,
  type SiteAnalysisValue,
} from "../src/validate/builtin/index.js";

const BUILDING = `koyu 1.1
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
zone /site site:1 area:60
polygon /site 0,0 8000,0 8000,5000 0,5000
space /out outside:1
space /site/a room X1..X2 Y1..Y2 level:L1
space /site/b room X2..X3 Y1..Y2 level:L1
boundary /site/a /out t:150
  door w:900 edge:W
boundary /site/a /site/b t:120
  door w:800
boundary /site/b /out t:150`;

const context = (asOf = "2026-08-03"): ContextSnapshot => ({
  schema: "koyu-context/1",
  asOf,
  values: {},
});

// ---- an external analysis, written against the public protocol only ----

type FloorCountValue = { readonly levels: readonly string[]; readonly count: number };

const FLOOR_COUNT_ID: AnalysisRef<FloorCountValue> = {
  id: "acme.analysis.floor-count",
  revision: "1",
};

const FLOOR_COUNT: AnalysisDefinition<FloorCountValue> = {
  ...FLOOR_COUNT_ID,
  title: "Storey count",
  model: "consistent",
  dependencies: [],
  context: [],
  run: ({ model }): AnalysisArtifact<FloorCountValue> => {
    const levels = Object.keys(model.levels).sort();
    return {
      state: "complete",
      value: { levels, count: levels.length },
      evidence: [{
        id: "acme:levels",
        kind: "fact",
        name: "levels",
        value: { levels },
        subjects: [{ kind: "model", ref: "/" }],
        sources: [{ kind: "model", subject: { kind: "model", ref: "/" } }],
        producedBy: FLOOR_COUNT_ID,
      }],
    };
  },
};

// ---- an external rule that requires external context ----

const MAX_STOREYS: ContextKey<number> = {
  id: "acme.context.max-storeys",
  revision: "1",
  description: "The greatest number of storeys the zoning allows",
  decode: (value) =>
    typeof value === "number" && Number.isInteger(value) && value > 0
      ? { ok: true, value }
      : { ok: false, message: "a positive integer number of storeys is required" },
};

const STOREY_LIMIT_RULE: Rule = {
  id: "acme.zoning.storey-limit",
  revision: "1",
  title: "Storey limit",
  level: "violation",
  model: "consistent",
  analyses: [{ analysis: FLOOR_COUNT_ID, accept: "complete" }],
  context: [{ key: MAX_STOREYS, presence: "required" }],
  authority: [{
    jurisdiction: { country: "AC", authority: "Acme" },
    instrument: "Acme zoning by-law",
    provision: "s.4",
  }],
  evaluate: ({ get, context: read }): RuleEvaluation => {
    const artifact = get(FLOOR_COUNT_ID);
    if (artifact.state !== "complete") {
      return { applicability: "indeterminate", reason: "storeys unknown", missing: artifact.missing, evidence: [] } as RuleEvaluation;
    }
    const limit = read.get(MAX_STOREYS);
    if (limit.state !== "present") {
      return {
        applicability: "indeterminate",
        reason: "no storey limit was supplied",
        missing: [{ kind: "context", key: MAX_STOREYS.id, reason: limit.state === "invalid" ? "invalid" : "missing" }],
        evidence: [],
      };
    }
    const failed = artifact.value.count > limit.value;
    return {
      applicability: "applicable",
      outcomes: [{
        id: "/",
        status: failed ? "fail" : "pass",
        subjects: [{ kind: "model", ref: "/" }],
        message: failed
          ? `${artifact.value.count} storeys exceeds the limit of ${limit.value}`
          : `${artifact.value.count} storeys is within the limit of ${limit.value}`,
        evidence: [artifact.evidence[0]!],
      }],
    };
  },
};

/** A pack that reuses koyu's own site analysis rather than recomputing the geometry. */
const TIGHT_SITE_RULE: Rule = {
  id: "acme.zoning.coverage",
  revision: "1",
  title: "Coverage ceiling",
  level: "caution",
  model: "consistent",
  analyses: [{ analysis: SITE_ANALYSIS_ID, accept: "complete" }],
  context: [],
  authority: [],
  evaluate: ({ get }): RuleEvaluation => {
    const artifact = get(SITE_ANALYSIS_ID) as AnalysisArtifact<SiteAnalysisValue>;
    if (artifact.state !== "complete") {
      return { applicability: "indeterminate", reason: "site unknown", missing: artifact.missing, evidence: [] } as RuleEvaluation;
    }
    const coverage = artifact.value.metrics.coveragePercent;
    if (coverage === null) return { applicability: "not-applicable", reason: "no site area", evidence: [] };
    return {
      applicability: "applicable",
      outcomes: [{
        id: artifact.value.selectedSiteRef ?? "/",
        status: coverage > 50 ? "fail" : "pass",
        subjects: [{ kind: "site", ref: artifact.value.selectedSiteRef ?? "/" }],
        message: `coverage ${coverage}% against the acme ceiling of 50%`,
        evidence: [artifact.evidence[0]!],
      }],
    };
  },
};

const ACME_RULE_SET: RuleSet = {
  id: "acme.ruleset.zoning",
  revision: "1",
  title: "Acme zoning",
  purpose: "code-screening",
  rules: [STOREY_LIMIT_RULE, TIGHT_SITE_RULE],
};

const ACME_PROFILE: Profile = {
  id: "acme.profile.zoning",
  revision: "1",
  title: "Acme zoning screen",
  analyses: [FLOOR_COUNT_ID, SITE_ANALYSIS_ID],
  ruleSets: [{ id: ACME_RULE_SET.id, revision: ACME_RULE_SET.revision }],
};

const ACME_PROFILE_REF = { id: ACME_PROFILE.id, revision: ACME_PROFILE.revision } as const;

/** koyu's pack and the external pack composed into one registry, as any caller would. */
function combinedRegistry() {
  return createAssessmentRegistry({
    analyses: [...SCHEMATIC_ANALYSES, FLOOR_COUNT as never],
    ruleSets: [SCHEMATIC_RULE_SET, ACME_RULE_SET],
    profiles: [SCHEMATIC_PROFILE, ACME_PROFILE],
  });
}

test("an external pack runs on the public SPI alone and reaches its own verdict", () => {
  const report = assess(parse(BUILDING), {
    registry: combinedRegistry(),
    profile: ACME_PROFILE_REF,
    context: { ...context(), values: { [MAX_STOREYS.id]: { value: 3, source: { kind: "brief", ref: "acme" } } } },
  });

  assert.equal(report.profile.id, "acme.profile.zoning");
  assert.deepEqual(report.ruleSets.map((r) => r.id), ["acme.ruleset.zoning"]);
  // Only the external pack ran: naming a profile selects its rule sets and nothing else.
  assert.deepEqual(report.rules.map((r) => r.rule.id), ["acme.zoning.storey-limit", "acme.zoning.coverage"]);
  assert.equal(report.summary.state, "complete");
});

test("an external rule reuses a koyu analysis instead of recomputing the geometry", () => {
  const report = assess(parse(BUILDING), {
    registry: combinedRegistry(),
    profile: ACME_PROFILE_REF,
    context: { ...context(), values: { [MAX_STOREYS.id]: { value: 3, source: { kind: "brief", ref: "acme" } } } },
  });
  // The site analysis appears in the external run because the external rule required it.
  assert.ok(report.analyses.some((a) => a.analysis.id === "koyu.analysis.site"));

  const coverage = report.rules.find((r) => r.rule.id === "acme.zoning.coverage");
  assert.equal(coverage?.state, "evaluated");
  if (coverage?.state !== "evaluated") throw new Error("coverage did not evaluate");
  // The same artifact the built-in site rules read, drawing a different line on it.
  assert.match(coverage.evaluation.outcomes[0]!.message, /coverage [\d.]+% against the acme ceiling of 50%/);
});

test("a required external context that is missing becomes indeterminate, never a pass", () => {
  const report = assess(parse(BUILDING), {
    registry: combinedRegistry(),
    profile: ACME_PROFILE_REF,
    context: context(), // no max-storeys supplied
  });
  const run = report.rules.find((r) => r.rule.id === "acme.zoning.storey-limit");
  assert.equal(run?.state, "indeterminate");
  assert.equal(report.summary.state, "incomplete", "an unjudged rule must not leave the report complete");
  // The rule that could not run produces no finding — it does not quietly become a pass, and it
  // does not become a failure either. The other rule in the set is unaffected.
  assert.equal(report.findings.some((f) => f.rule.id === "acme.zoning.storey-limit"), false);
  assert.equal(report.summary.rules.indeterminate, 1);
});

test("a context value the decoder rejects is invalid input, not a pass", () => {
  // Well-formed JSON carrying an unusable value is the *project's* problem, not the caller's
  // wiring: the decoder rejects it, the rule sees `invalid`, and the rule stays unjudged.
  const report = assess(parse(BUILDING), {
    registry: combinedRegistry(),
    profile: ACME_PROFILE_REF,
    context: { ...context(), values: { [MAX_STOREYS.id]: { value: -2, source: { kind: "brief", ref: "acme" } } } },
  });
  const run = report.rules.find((r) => r.rule.id === "acme.zoning.storey-limit");
  assert.equal(run?.state, "indeterminate");
  assert.equal(report.summary.state, "incomplete");
  assert.equal(report.findings.some((f) => f.rule.id === "acme.zoning.storey-limit"), false);
});

test("a malformed context entry is a configuration error, before any rule runs", () => {
  // A snapshot that does not even have the declared shape is the caller's wiring, and it stops
  // the call rather than producing a report that looks like a judgement.
  assert.throws(
    () => assess(parse(BUILDING), {
      registry: combinedRegistry(),
      profile: ACME_PROFILE_REF,
      context: {
        ...context(),
        values: { [MAX_STOREYS.id]: { source: { kind: "brief", ref: "acme" } } as never },
      },
    }),
    (e: unknown) => e instanceof AssessmentConfigError && e.code === "invalid-context",
  );
});

test("two packs and two profiles do not contaminate each other, in either order", () => {
  const model = parse(BUILDING);
  const registry = combinedRegistry();
  const acmeContext = {
    ...context(),
    values: { [MAX_STOREYS.id]: { value: 3, source: { kind: "brief" as const, ref: "acme" } } },
  };

  const koyuFirst = assess(model, { registry, profile: SCHEMATIC_PROFILE_ID, context: context() });
  const acmeSecond = assess(model, { registry, profile: ACME_PROFILE_REF, context: acmeContext });

  // Same registry, reversed order, and a second registry built independently.
  const other = combinedRegistry();
  const acmeFirst = assess(model, { registry: other, profile: ACME_PROFILE_REF, context: acmeContext });
  const koyuSecond = assess(model, { registry: other, profile: SCHEMATIC_PROFILE_ID, context: context() });

  assert.equal(JSON.stringify(koyuFirst), JSON.stringify(koyuSecond), "koyu's report moved with call order");
  assert.equal(JSON.stringify(acmeSecond), JSON.stringify(acmeFirst), "the external report moved with call order");

  // And neither profile ran the other's rules.
  assert.equal(koyuFirst.rules.every((r) => r.rule.id.startsWith("koyu.schematic.")), true);
  assert.equal(acmeFirst.rules.every((r) => r.rule.id.startsWith("acme.")), true);
});

test("importing a pack registers nothing — the built-ins run only when handed over", () => {
  // A registry holding only the external pack cannot reach koyu's profile at all. (The pack is
  // trimmed to the rule that needs no koyu analysis — preflight would otherwise reject the
  // registry outright, which is the same invariant seen one step earlier.)
  const standaloneSet: RuleSet = { ...ACME_RULE_SET, rules: [STOREY_LIMIT_RULE] };
  const externalOnly = createAssessmentRegistry({
    analyses: [FLOOR_COUNT as never],
    ruleSets: [standaloneSet],
    profiles: [{ ...ACME_PROFILE, analyses: [FLOOR_COUNT_ID] }],
  });
  assert.throws(
    () => assess(parse(BUILDING), {
      registry: externalOnly,
      profile: SCHEMATIC_PROFILE_ID,
      context: context(),
    }),
    (e: unknown) => e instanceof AssessmentConfigError,
    "koyu's profile resolved out of a registry that was never given it",
  );

  // And the built-in registry has no idea the external pack exists.
  assert.throws(
    () => assess(parse(BUILDING), {
      registry: createSchematicRegistry(),
      profile: ACME_PROFILE_REF,
      context: context(),
    }),
    (e: unknown) => e instanceof AssessmentConfigError,
  );
});

test("an external analysis runs on its own through the analysis entry point", () => {
  const report = runAnalysis(parse(BUILDING), FLOOR_COUNT_ID, {
    registry: combinedRegistry(),
    profile: ACME_PROFILE_REF,
    context: context(),
  });
  assert.equal(report.result.analysis.id, "acme.analysis.floor-count");
  assert.equal(report.result.artifact.state, "complete");
  // An analysis result carries no verdict vocabulary, external or not.
  const json = JSON.stringify(report.result.artifact);
  assert.doesNotMatch(json, /"(?:status|level|violation|caution)"/);
});

test("the built-in rules are ordinary values on the same SPI", () => {
  // Nothing about DAYLIGHT_RATIO_RULE differs in kind from STOREY_LIMIT_RULE: same interface,
  // same fields, and the built-in is the one with *fewer* privileges (it cites no authority).
  for (const key of ["id", "revision", "title", "level", "model", "analyses", "context", "authority", "evaluate"]) {
    assert.ok(key in DAYLIGHT_RATIO_RULE, `built-in rule lacks ${key}`);
    assert.ok(key in STOREY_LIMIT_RULE, `external rule lacks ${key}`);
  }
  assert.deepEqual(DAYLIGHT_RATIO_RULE.authority, []);
  assert.equal(STOREY_LIMIT_RULE.authority.length, 1);
});
