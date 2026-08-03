import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ContextSnapshot } from "../src/analysis/contracts.js";
import { daylightInputs } from "../src/core/light.js";
import { toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { validate as legacyValidate } from "../src/validate/index.js";
import { assess, createAssessmentRegistry, runAnalysis } from "../src/validate/assessment.js";
import {
  DAYLIGHT_ANALYSIS,
  DAYLIGHT_ANALYSIS_ID,
  DAYLIGHT_AREA_EPSILON,
  DAYLIGHT_DIVISOR,
  DAYLIGHT_RATIO_RULE,
  DAYLIGHT_RATIO_RULE_ID,
  DAYLIGHT_UNKNOWN_RULE,
  DAYLIGHT_UNKNOWN_RULE_ID,
  type DaylightAnalysisValue,
} from "../src/validate/builtin/daylight.js";
import type { AssessmentReport, Profile, RuleSet } from "../src/validate/contracts.js";

const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const RULE_SET: RuleSet = {
  id: "test.rules.daylight",
  revision: "1",
  title: "Built-in daylight rules",
  purpose: "design-lint",
  rules: [DAYLIGHT_RATIO_RULE, DAYLIGHT_UNKNOWN_RULE],
};

const PROFILE: Profile = {
  id: "test.profile.daylight",
  revision: "1",
  title: "Built-in daylight profile",
  analyses: [DAYLIGHT_ANALYSIS_ID],
  ruleSets: [{ id: RULE_SET.id, revision: RULE_SET.revision }],
};

const PROFILE_REF = { id: PROFILE.id, revision: PROFILE.revision } as const;

const REGISTRY = createAssessmentRegistry({
  analyses: [DAYLIGHT_ANALYSIS],
  ruleSets: [RULE_SET],
  profiles: [PROFILE],
});

/** 14.00 m2 of floor needs exactly 2.00 m2 of window, so the comparison sits on its endpoint. */
function endpointSource(windowWidthMm: number): string {
  return `koyu 1.1
grid X 0 3500
grid Y 0 4000
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:${windowWidthMm} h:1000 edge:S
  door w:900 edge:N`;
}

test("the daylight reference fixtures map to the new schematic rule identities", () => {
  const fixtures = referenceExamples();
  assert.equal(fixtures.length, 3);

  assertSingleFailure(assessSource(fixtures[0]!), DAYLIGHT_RATIO_RULE_ID.id, "violation", "/L1/a");
  assertSingleFailure(assessSource(fixtures[1]!), DAYLIGHT_RATIO_RULE_ID.id, "violation", "/L1/a");
  assertSingleFailure(assessSource(fixtures[2]!), DAYLIGHT_UNKNOWN_RULE_ID.id, "caution", "/L1/a");
});

test("the daylight migration stays level, subject, and source-equivalent to the legacy validator", () => {
  const fixtures = referenceExamples();
  const cases = [
    { source: fixtures[0]!, oldRule: "daylight.ratio", newRule: DAYLIGHT_RATIO_RULE_ID.id },
    { source: fixtures[1]!, oldRule: "daylight.ratio", newRule: DAYLIGHT_RATIO_RULE_ID.id },
    { source: fixtures[2]!, oldRule: "daylight.unknown", newRule: DAYLIGHT_UNKNOWN_RULE_ID.id },
  ];

  for (const fixture of cases) {
    const model = parse(fixture.source);
    const legacy = legacyValidate(model).filter((finding) => finding.rule === fixture.oldRule);
    const current = assessSource(fixture.source)
      .findings.filter((finding) => finding.rule.id === fixture.newRule);
    assert.equal(legacy.length, 1, fixture.oldRule);
    assert.equal(current.length, 1, fixture.newRule);

    const source = current[0]!.outcome.evidence
      .flatMap((item) => item.sources)
      .find((item) => item.kind === "model" && item.location?.line !== undefined);
    assert.ok(source?.kind === "model");
    assert.deepEqual(
      {
        level: current[0]!.level,
        subjects: current[0]!.outcome.subjects,
        line: source.location!.line,
        message: current[0]!.outcome.message,
      },
      {
        level: legacy[0]!.level,
        subjects: [{ kind: "space", ref: legacy[0]!.path![0]! }],
        line: legacy[0]!.line,
        message: legacy[0]!.message,
      },
      fixture.newRule,
    );
  }
});

test("the required area is met at its endpoint and missed just below it", () => {
  const met = assessSource(endpointSource(2000));
  assert.equal(outcomeStatus(met, DAYLIGHT_RATIO_RULE_ID.id, "/L1/a"), "pass");

  const missed = assessSource(endpointSource(1999));
  assert.equal(outcomeStatus(missed, DAYLIGHT_RATIO_RULE_ID.id, "/L1/a"), "fail");
});

test("the epsilon absorbs a shortfall that only floating-point division produced", () => {
  const space = completeDaylight(endpointSource(2000)).spaces[0]!;
  const required = space.floorAreaM2 / DAYLIGHT_DIVISOR;
  assert.ok(space.effectiveWindowAreaM2 + DAYLIGHT_AREA_EPSILON >= required);
  assert.equal(space.floorAreaM2, 14);
  assert.equal(space.effectiveWindowAreaM2, 2);
});

test("pass, fail and not-applicable are three distinct states", () => {
  const noPopulation = assessSource(`koyu 1.1
grid X 0 3500
grid Y 0 4000
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
  door w:900 edge:N`);
  for (const ruleId of [DAYLIGHT_RATIO_RULE_ID.id, DAYLIGHT_UNKNOWN_RULE_ID.id]) {
    const run = noPopulation.rules.find((item) => item.rule.id === ruleId);
    assert.equal(run?.state, "not-applicable", ruleId);
    assert.equal(noPopulation.findings.filter((f) => f.rule.id === ruleId).length, 0);
  }

  // A room that clears the ratio and counts every window passes both rules without a finding.
  const clean = assessSource(endpointSource(2000));
  assert.equal(outcomeStatus(clean, DAYLIGHT_RATIO_RULE_ID.id, "/L1/a"), "pass");
  assert.equal(outcomeStatus(clean, DAYLIGHT_UNKNOWN_RULE_ID.id, "/L1/a"), "pass");
  assert.equal(clean.findings.length, 0);
});

test("a window with no h: is kept as an explicit fact inside a complete artifact", () => {
  const artifact = daylightArtifact(referenceExamples()[2]!);
  const space = completeDaylight(referenceExamples()[2]!).spaces.find((item) => item.ref === "/L1/a");
  assert.ok(space);
  assert.equal(space.missingHeightOpenings.length, 1);
  assert.equal(space.missingHeightOpenings[0]!.widthMm, 600);
  // The counted area still holds the windows that do carry h:, exactly as before the migration.
  assert.equal(Number(space.effectiveWindowAreaM2.toFixed(2)), 2.88);
  // The gap is a fact of the model, so it never degrades the artifact to partial.
  assert.ok(!("missing" in artifact));
});

test("the enumerated openings never disagree with the area that daylightInputs counted", () => {
  const sources = [
    ...referenceExamples(),
    endpointSource(2000),
    // A window with no h: facing an indoor neighbour was never going to be counted.
    `koyu 1.1
grid X 0 3500 7000
grid Y 0 4000
level L1 0 h:2400 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:150
  window w:600
boundary /L1/a /out t:150
  window w:2400 h:1200 edge:S
  door w:900 edge:N
boundary /L1/b /out t:150
  door w:900 edge:N`,
  ];

  for (const source of sources) {
    const model = parse(source);
    const byRef = new Map(completeDaylight(source).spaces.map((space) => [space.ref, space]));
    assert.equal(byRef.size, daylightInputs(model).length);

    for (const input of daylightInputs(model)) {
      const space = byRef.get(input.space.path);
      assert.ok(space, input.space.path);
      assert.equal(space.effectiveWindowAreaM2, input.window);
      assert.equal(space.floorAreaM2, input.floor);
      assert.equal(
        space.missingHeightOpenings.length > 0,
        input.missingH,
        `${input.space.path} disagrees with daylightInputs about uncounted windows`,
      );
    }
  }
});

test("the daylight provider leaves the canonical model byte-identical", () => {
  for (const source of [...referenceExamples(), endpointSource(2000)]) {
    const model = parse(source);
    const before = toCanonical(model);
    runAnalysis(model, DAYLIGHT_ANALYSIS_ID, {
      registry: REGISTRY,
      profile: PROFILE_REF,
      context: CONTEXT,
    });
    assert.equal(toCanonical(model), before);
  }
});

test("the daylight artifact carries no verdict vocabulary and survives a JSON round-trip", () => {
  const artifact = daylightArtifact(referenceExamples()[0]!);
  const text = JSON.stringify(artifact);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(JSON.parse(text))));
  for (const word of ["violation", "caution", "pass", "fail", "koyu.schematic", "daylight.ratio"]) {
    assert.equal(text.includes(word), false, `the artifact must not speak of ${word}`);
  }
});

test("the daylight rules and analysis are frozen against a real mutation", () => {
  for (const value of [DAYLIGHT_ANALYSIS, DAYLIGHT_RATIO_RULE, DAYLIGHT_UNKNOWN_RULE]) {
    assert.ok(Object.isFrozen(value));
    assert.throws(() => {
      (value as unknown as Record<string, unknown>)["level"] = "caution";
    }, TypeError);
  }
  assert.ok(Object.isFrozen(DAYLIGHT_ANALYSIS_ID));
  assert.throws(() => {
    (DAYLIGHT_ANALYSIS_ID as unknown as Record<string, unknown>)["revision"] = "2";
  }, TypeError);
});

function referenceExamples(): string[] {
  const markdown = readFileSync(
    new URL("../docs/reference/validate/daylight.md", import.meta.url),
    "utf8",
  );
  return [...markdown.matchAll(/```muro-(?:fail|caution)\n([\s\S]*?)\n```/g)].map((m) => m[1]!);
}

function assessSource(source: string): AssessmentReport {
  return assess(parse(source), {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  });
}

function daylightArtifact(source: string) {
  return runAnalysis(parse(source), DAYLIGHT_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;
}

function completeDaylight(source: string): DaylightAnalysisValue {
  const artifact = daylightArtifact(source);
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("daylight analysis did not complete");
  return artifact.value;
}

function outcomeStatus(report: AssessmentReport, ruleId: string, ref: string): string | undefined {
  const run = report.rules.find((item) => item.rule.id === ruleId);
  if (run?.state !== "evaluated") return undefined;
  return run.evaluation.outcomes.find((outcome) => outcome.id === ref)?.status;
}

function assertSingleFailure(
  report: AssessmentReport,
  ruleId: string,
  level: "violation" | "caution",
  ref: string,
): void {
  const findings = report.findings.filter((finding) => finding.rule.id === ruleId);
  assert.equal(findings.length, 1, ruleId);
  assert.equal(findings[0]!.level, level);
  assert.deepEqual(findings[0]!.outcome.subjects, [{ kind: "space", ref }]);
  assert.ok(findings[0]!.outcome.evidence.length > 0);
}
