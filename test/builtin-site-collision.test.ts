import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { AnalysisDefinition, AnalysisRef, ContextSnapshot } from "../src/analysis/contracts.js";
import type { JsonValue } from "../src/analysis/json.js";
import { toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { siteReport as legacySiteReport } from "../src/core/site.js";
import { accessFindings } from "../src/validate/access.js";
import { assess, createAssessmentRegistry, runAnalysis } from "../src/validate/assessment.js";
import {
  COLUMN_BLOCKS_DOOR_RULE,
  COLUMN_BLOCKS_DOOR_RULE_ID,
  DOOR_COLUMN_COLLISIONS_ANALYSIS,
  DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
  type DoorColumnCollisionsAnalysisValue,
} from "../src/validate/builtin/door-column-collisions.js";
import {
  SITE_ANALYSIS,
  SITE_ANALYSIS_ID,
  SITE_AREA_RULE,
  SITE_AREA_RULE_ID,
  SITE_ESCAPE_RULE,
  SITE_ESCAPE_RULE_ID,
  SITE_FRONTAGE_RULE,
  SITE_FRONTAGE_RULE_ID,
  type SiteAnalysisValue,
} from "../src/validate/builtin/site.js";
import type { AssessmentReport, Profile, Rule, RuleRun, RuleSet } from "../src/validate/contracts.js";
import { siteFindings } from "../src/validate/site.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const RULES: readonly Rule[] = [
  COLUMN_BLOCKS_DOOR_RULE,
  SITE_ESCAPE_RULE,
  SITE_AREA_RULE,
  SITE_FRONTAGE_RULE,
];
const RULE_SET: RuleSet = {
  id: "test.rules.site-collision",
  revision: "1",
  title: "Site and collision focused rules",
  purpose: "design-lint",
  rules: RULES,
};
const PROFILE: Profile = {
  id: "test.profile.site-collision",
  revision: "1",
  title: "Site and collision focused profile",
  analyses: [DOOR_COLUMN_COLLISIONS_ANALYSIS_ID, SITE_ANALYSIS_ID],
  ruleSets: [{ id: RULE_SET.id, revision: RULE_SET.revision }],
};
const PROFILE_REF = { id: PROFILE.id, revision: PROFILE.revision } as const;
const REGISTRY = createAssessmentRegistry({
  analyses: [
    DOOR_COLUMN_COLLISIONS_ANALYSIS as AnalysisDefinition<JsonValue>,
    SITE_ANALYSIS as AnalysisDefinition<JsonValue>,
  ],
  ruleSets: [RULE_SET],
  profiles: [PROFILE],
});

function documentedFixture(page: "column.md" | "site.md", anchor: string): string {
  const source = readFileSync(`${root}/docs/reference/validate/${page}`, "utf8");
  const marker = `{#${anchor}}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing documented section ${anchor}`);
  const next = source.indexOf("\n## ", start + marker.length);
  const section = source.slice(start, next < 0 ? source.length : next);
  const block = /```muro-(?:fail|caution)\n([\s\S]*?)\n```/.exec(section);
  assert.ok(block, `missing documented fixture ${anchor}`);
  return block[1]!;
}

function assessSource(source: string): AssessmentReport {
  return assess(parse(source), { registry: REGISTRY, profile: PROFILE_REF, context: CONTEXT });
}

function ruleRun(report: AssessmentReport, id: string): RuleRun {
  const run = report.rules.find((item) => item.rule.id === id);
  assert.ok(run, `missing rule run ${id}`);
  return run;
}

function onlyOutcome(report: AssessmentReport, id: string) {
  const run = ruleRun(report, id);
  assert.equal(run.state, "evaluated", `${id} must be evaluated`);
  if (run.state !== "evaluated") throw new Error(`${id} did not evaluate`);
  assert.equal(run.evaluation.outcomes.length, 1, `${id} must have one subject`);
  return run.evaluation.outcomes[0]!;
}

function siteValue(source: string): SiteAnalysisValue {
  const report = runAnalysis(parse(source), SITE_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  });
  assert.equal(report.result.artifact.state, "complete");
  if (report.result.artifact.state !== "complete") throw new Error("site analysis did not complete");
  return report.result.artifact.value;
}

function collisionValue(source: string): DoorColumnCollisionsAnalysisValue {
  const artifact = collisionArtifact(parse(source));
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("collision analysis did not complete");
  return artifact.value;
}

function collisionArtifact(model: ReturnType<typeof parse>) {
  return runAnalysis(model, DOOR_COLUMN_COLLISIONS_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;
}

for (const fixture of [
  { page: "column.md", anchor: "column-blocksdoor", oldRule: "column.blocksdoor", rule: COLUMN_BLOCKS_DOOR_RULE_ID.id, level: "violation" },
  { page: "site.md", anchor: "site-escape", oldRule: "site.escape", rule: SITE_ESCAPE_RULE_ID.id, level: "violation" },
  { page: "site.md", anchor: "site-area", oldRule: "site.area", rule: SITE_AREA_RULE_ID.id, level: "caution" },
  { page: "site.md", anchor: "site-frontage", oldRule: "site.frontage", rule: SITE_FRONTAGE_RULE_ID.id, level: "violation" },
] as const) {
  test(`builtin migration reuses the documented ${fixture.anchor} failure`, () => {
    const report = assessSource(documentedFixture(fixture.page, fixture.anchor));
    const outcome = onlyOutcome(report, fixture.rule);
    assert.equal(outcome.status, "fail");
    const findings = report.findings.filter((finding) => finding.rule.id === fixture.rule);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.level, fixture.level);
    assert.equal(report.model.state, "consistent");
  });

  test(`builtin migration preserves the legacy ${fixture.anchor} subject and source`, () => {
    const sourceText = documentedFixture(fixture.page, fixture.anchor);
    const model = parse(sourceText);
    const legacy = (fixture.page === "column.md" ? accessFindings(model) : siteFindings(model))
      .filter((finding) => finding.rule === fixture.oldRule);
    const current = assess(model, { registry: REGISTRY, profile: PROFILE_REF, context: CONTEXT })
      .findings.filter((finding) => finding.rule.id === fixture.rule);
    assert.equal(legacy.length, 1);
    assert.equal(current.length, 1);
    const source = current[0]!.outcome.evidence
      .flatMap((item) => item.sources)
      .find((item) => item.kind === "model" && item.location?.line !== undefined);
    assert.ok(source?.kind === "model");
    assert.deepEqual({
      level: current[0]!.level,
      refs: current[0]!.outcome.subjects.map((subject) => subject.ref),
      line: source.location?.line,
      file: source.location?.file,
    }, {
      level: legacy[0]!.level,
      refs: legacy[0]!.path,
      line: legacy[0]!.line,
      file: legacy[0]!.file,
    });
  });
}

function areaSource(differenceMm2: number): string {
  const height = (1_000_000 + differenceMm2) / 1000;
  return `koyu 1.1
grid X 0 1000
grid Y 0 2000
level L1 0 h:2400 slab:150
zone /site site:1 area:1
polygon /site 0,0 1000,0 1000,${height} 0,${height}`;
}

test("site area uses raw polygon area and fails at the inclusive 0.05 m2 boundary", () => {
  const belowSource = areaSource(49_999);
  const below = siteValue(belowSource).polygons[0]!;
  assert.equal(below.rawAreaM2, 1.049999);
  assert.equal(below.roundedAreaM2, 1.05, "the rounded report value differs from the comparison input");
  assert.equal(onlyOutcome(assessSource(belowSource), SITE_AREA_RULE_ID.id).status, "pass");

  const exactSource = areaSource(50_000);
  assert.equal(siteValue(exactSource).polygons[0]!.rawAreaM2, 1.05);
  assert.equal(onlyOutcome(assessSource(exactSource), SITE_AREA_RULE_ID.id).status, "fail");

  const aboveSource = areaSource(50_001);
  assert.equal(siteValue(aboveSource).polygons[0]!.rawAreaM2, 1.050001);
  assert.equal(onlyOutcome(assessSource(aboveSource), SITE_AREA_RULE_ID.id).status, "fail");
});

function containmentSource(maxX: number): string {
  return `koyu 1.1
grid X 0 ${maxX}
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /L1/a room X1..X2 Y1..Y2 level:L1`;
}

test("site containment includes the 1 mm line tolerance and rejects a point beyond it", () => {
  const onTolerance = containmentSource(10_001);
  assert.equal(siteValue(onTolerance).spaceRelations[0]!.firstNonContainedPointMm, null);
  assert.equal(onlyOutcome(assessSource(onTolerance), SITE_ESCAPE_RULE_ID.id).status, "pass");

  const beyondTolerance = containmentSource(10_001.001);
  assert.deepEqual(
    siteValue(beyondTolerance).spaceRelations[0]!.firstNonContainedPointMm,
    { x: 10_001.001, y: 0 },
  );
  assert.equal(onlyOutcome(assessSource(beyondTolerance), SITE_ESCAPE_RULE_ID.id).status, "fail");
});

function frontageSource(frontage: number): string {
  return `koyu 1.1
grid X 0 ${frontage} 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n exterior X1..X2 Y2..Y3 road:4000 level:L1 outside:1
boundary /site/yard /out/road-n type:open`;
}

test("frontage compares the integer-rounded measurement against 2000 mm", () => {
  const roundsDown = frontageSource(1999.49);
  assert.equal(siteValue(roundsDown).roads[0]!.frontageMm, 1999);
  assert.equal(onlyOutcome(assessSource(roundsDown), SITE_FRONTAGE_RULE_ID.id).status, "fail");

  const roundsUp = frontageSource(1999.5);
  assert.equal(siteValue(roundsUp).roads[0]!.frontageMm, 2000);
  assert.equal(onlyOutcome(assessSource(roundsUp), SITE_FRONTAGE_RULE_ID.id).status, "pass");

  const exact = frontageSource(2000);
  assert.equal(siteValue(exact).roads[0]!.frontageMm, 2000);
  assert.equal(onlyOutcome(assessSource(exact), SITE_FRONTAGE_RULE_ID.id).status, "pass");
});

test("site analysis carries the complete shared metrics used by CLI and MCP without a verdict", () => {
  const source = documentedFixture("site.md", "site-frontage");
  const model = parse(source);
  const legacy = legacySiteReport(model);
  const value = siteValue(source);
  const basis = legacy.declaredArea ?? legacy.derivedArea;

  assert.deepEqual(value.metrics, {
    siteName: legacy.siteZone ? legacy.siteZone.attrs["name"] ?? "site" : null,
    polygonVertexCount: legacy.polygon?.points.length ?? null,
    declaredAreaM2: legacy.declaredArea ?? null,
    derivedAreaM2: legacy.derivedArea,
    areaBasisM2: basis,
    footprintM2: legacy.footprint,
    totalFloorM2: legacy.totalFloor,
    coveragePercent: basis === 0 ? null : Math.round((legacy.footprint / basis) * 1000) / 10,
    floorAreaRatioPercent: basis === 0 ? null : Math.round((legacy.totalFloor / basis) * 1000) / 10,
  });
  assert.equal(value.roads[0]!.name.length > 0, true);
  assert.equal("areaMatch" in value.metrics, false, "the 0.05 m2 verdict remains a Rule concern");
});

function alongOverlapSource(offset: number): string {
  const at = offset < 0 ? `X2${offset}` : `X2+${offset}`;
  return `koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1 x:X2 y:Y2
boundary /L1/a /L1/b
  door w:900 at:${at}`;
}

test("door and column edge contact along the boundary is not an overlap", () => {
  const touching = alongOverlapSource(-750);
  assert.equal(collisionValue(touching).doors[0]!.firstColumnIntersection, null);
  assert.equal(onlyOutcome(assessSource(touching), COLUMN_BLOCKS_DOOR_RULE_ID.id).status, "pass");

  const overlapping = alongOverlapSource(-749);
  assert.equal(collisionValue(overlapping).doors[0]!.firstColumnIntersection?.grid, "X2/Y2");
  assert.equal(onlyOutcome(assessSource(overlapping), COLUMN_BLOCKS_DOOR_RULE_ID.id).status, "fail");
});

function acrossOverlapSource(depth: number): string {
  return `koyu 1.1
grid X 0 4000 8000
grid Y 0 4700 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y3
space /L1/b room X1..X3 Y3..Y4
column 600 L1 d:${depth} x:X2 y:Y2
boundary /L1/a /L1/b
  door w:900 at:X2`;
}

test("a boundary on the column edge is not an overlap, but one millimetre inside is", () => {
  const touching = acrossOverlapSource(600);
  assert.equal(collisionValue(touching).doors[0]!.firstColumnIntersection, null);
  assert.equal(onlyOutcome(assessSource(touching), COLUMN_BLOCKS_DOOR_RULE_ID.id).status, "pass");

  const crossing = acrossOverlapSource(602);
  assert.equal(collisionValue(crossing).doors[0]!.firstColumnIntersection?.grid, "X2/Y2");
  assert.equal(onlyOutcome(assessSource(crossing), COLUMN_BLOCKS_DOOR_RULE_ID.id).status, "fail");
});

test("the collision analysis records only the first derived column for each door", () => {
  const source = `koyu 1.1
grid X 0 4000 4200 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X4 Y1..Y2
space /L1/b room X1..X4 Y2..Y3
column 600 L1 x:X2,X3 y:Y2
boundary /L1/a /L1/b
  door w:900 at:X2+100`;
  const value = collisionValue(source);
  assert.equal(value.doors.length, 1);
  assert.equal(value.doors[0]!.firstColumnIntersection?.grid, "X2/Y2");
  const report = assessSource(source);
  assert.equal(onlyOutcome(report, COLUMN_BLOCKS_DOOR_RULE_ID.id).status, "fail");
  assert.equal(report.findings.filter((finding) => finding.rule.id === COLUMN_BLOCKS_DOOR_RULE_ID.id).length, 1);
});

test("canonical boundary and opening indexes keep two edge-specific doors distinct", () => {
  const source = `koyu 1.1
grid X 0 4000
grid Y 0 4000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out edge:N
  door w:900 at:0.5
boundary /L1/a /out edge:S
  door w:900 at:0.5`;
  const value = collisionValue(source);
  assert.equal(value.doors.length, 2);
  assert.equal(new Set(value.doors.map((door) => door.ref)).size, 2);
  assert.deepEqual(value.doors.map((door) => door.ref), [
    "/L1/a|/out@0/0",
    "/L1/a|/out@1/0",
  ]);
});

test("site-space evidence uses an injective identity for delimiter-bearing paths", () => {
  const source = `koyu 1.1
grid X 0 1000 2000
grid Y 0 1000
level L1 0 h:2400 slab:150
zone /a site:1
polygon /a 0,0 2000,0 2000,1000 0,1000
zone /a|/b site:1
polygon /a|/b 0,0 2000,0 2000,1000 0,1000
space /b|/c room X1..X2 Y1..Y2 level:L1
space /c room X2..X3 Y1..Y2 level:L1`;
  const value = siteValue(source);
  assert.equal(value.spaceRelations.length, 4);
  const ids = value.spaceRelations.map((relation) => JSON.stringify(["site-space", relation.siteRef, relation.spaceRef]));
  assert.equal(new Set(ids).size, ids.length);
  const report = assessSource(source);
  assert.equal(report.analyses.find((item) => item.analysis.id === SITE_ANALYSIS_ID.id)?.artifact.state, "complete");
});

test("an overlaid door never fabricates an overlay line in the base boundary file", () => {
  const model = parseFiles({
    "main.muro": `koyu 1.1
import ./base.muro
over /L1/a /L1/b
  + door w:900 at:0.5 name:D1`,
    "base.muro": `grid X 0 4000
grid Y 0 4000 8000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b`,
  }, "main.muro");
  const artifact = collisionArtifact(model);
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("collision analysis did not complete");
  const source = artifact.evidence[0]!.sources[0]!;
  assert.equal(source.kind, "model");
  if (source.kind !== "model") throw new Error("expected model provenance");
  assert.deepEqual(source.location, { file: "base.muro", line: 6 });
});

test("site and collision providers leave canonical model bytes unchanged and definitions are frozen", () => {
  for (const [source, analysis] of [
    [documentedFixture("site.md", "site-frontage"), SITE_ANALYSIS_ID],
    [documentedFixture("column.md", "column-blocksdoor"), DOOR_COLUMN_COLLISIONS_ANALYSIS_ID],
  ] as const) {
    const model = parse(source);
    const before = toCanonical(model);
    runAnalysis<JsonValue>(model, analysis as AnalysisRef<JsonValue>, {
      registry: REGISTRY,
      profile: PROFILE_REF,
      context: CONTEXT,
    });
    assert.equal(toCanonical(model), before);
  }
  for (const value of [
    SITE_ANALYSIS,
    SITE_ESCAPE_RULE,
    SITE_AREA_RULE,
    SITE_FRONTAGE_RULE,
    DOOR_COLUMN_COLLISIONS_ANALYSIS,
    COLUMN_BLOCKS_DOOR_RULE,
  ]) assertDeepFrozen(value);
});

test("empty populations are not applicable and analyses contain facts rather than verdicts", () => {
  const empty = `koyu 1.1
grid X 0 4000
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2`;
  const report = assessSource(empty);
  for (const id of [
    COLUMN_BLOCKS_DOOR_RULE_ID.id,
    SITE_ESCAPE_RULE_ID.id,
    SITE_AREA_RULE_ID.id,
    SITE_FRONTAGE_RULE_ID.id,
  ]) {
    assert.equal(ruleRun(report, id).state, "not-applicable", id);
  }

  const siteReport = runAnalysis(
    parse(documentedFixture("site.md", "site-frontage")),
    SITE_ANALYSIS_ID,
    { registry: REGISTRY, profile: PROFILE_REF, context: CONTEXT },
  );
  const collisionReport = runAnalysis(
    parse(documentedFixture("column.md", "column-blocksdoor")),
    DOOR_COLUMN_COLLISIONS_ANALYSIS_ID,
    { registry: REGISTRY, profile: PROFILE_REF, context: CONTEXT },
  );
  for (const artifact of [siteReport.result.artifact, collisionReport.result.artifact]) {
    const serialized = JSON.stringify(artifact);
    assert.doesNotMatch(serialized, /\b(?:pass|fail|violation|caution|compliant|noncompliant)\b/i);
    for (const rule of RULES) assert.equal(serialized.includes(rule.id), false, rule.id);
  }
});

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  const object = value as object;
  if (seen.has(object)) return;
  seen.add(object);
  assert.equal(Object.isFrozen(object), true);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor && "value" in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}
