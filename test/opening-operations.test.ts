import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnalysisDefinition, ContextSnapshot } from "../src/analysis/contracts.js";
import type { JsonValue } from "../src/analysis/json.js";
import { derive } from "../src/core/derive.js";
import { parse } from "../src/core/parse.js";
import { planMarks } from "../src/draw/marks.js";
import { assess, createAssessmentRegistry, runAnalysis } from "../src/validate/assessment.js";
import {
  OPENING_OPERATIONS_ANALYSIS,
  OPENING_OPERATIONS_ANALYSIS_ID,
  SLIDING_STORAGE_LEAVES_SPACE_RULE,
  SLIDING_STORAGE_LEAVES_SPACE_RULE_ID,
  SLIDING_STORAGE_OVERLAPS_OPENING_RULE,
  SLIDING_STORAGE_OVERLAPS_OPENING_RULE_ID,
  type OpeningOperationsAnalysisValue,
} from "../src/validate/builtin/opening-operations.js";
import type { Profile, RuleSet } from "../src/validate/contracts.js";

const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-24",
  values: {},
};

const RULE_SET: RuleSet = {
  id: "test.rules.opening-operations",
  revision: "1",
  title: "Opening operation focused rules",
  purpose: "design-lint",
  rules: [SLIDING_STORAGE_LEAVES_SPACE_RULE, SLIDING_STORAGE_OVERLAPS_OPENING_RULE],
};
const PROFILE: Profile = {
  id: "test.profile.opening-operations",
  revision: "1",
  title: "Opening operation focused profile",
  analyses: [OPENING_OPERATIONS_ANALYSIS_ID],
  ruleSets: [{ id: RULE_SET.id, revision: RULE_SET.revision }],
};
const PROFILE_REF = { id: PROFILE.id, revision: PROFILE.revision } as const;
const REGISTRY = createAssessmentRegistry({
  analyses: [OPENING_OPERATIONS_ANALYSIS as AnalysisDefinition<JsonValue>],
  ruleSets: [RULE_SET],
  profiles: [PROFILE],
});

function fourRooms(opening: string, asset = ""): string {
  return `muro 1.5
grid X 0 4000 8000
grid Y 0 4000 8000
level L1 0 h:2700 slab:150
${asset}space /L1/a room X1..X2 Y1..Y2 level:L1
space /L1/b room X2..X3 Y1..Y2 level:L1
space /L1/c room X1..X2 Y2..Y3 level:L1
space /L1/d room X2..X3 Y2..Y3 level:L1
boundary /L1/a /L1/b
  ${opening}`;
}

function analysisValue(source: string): OpeningOperationsAnalysisValue {
  const artifact = runAnalysis(parse(source), OPENING_OPERATIONS_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("opening operation analysis did not complete");
  return artifact.value;
}

function onlyOutcome(source: string, ruleId: string = SLIDING_STORAGE_LEAVES_SPACE_RULE_ID.id) {
  const report = assess(parse(source), { registry: REGISTRY, profile: PROFILE_REF, context: CONTEXT });
  const run = report.rules.find((item) => item.rule.id === ruleId);
  assert.equal(run?.state, "evaluated");
  if (!run || run.state !== "evaluated") throw new Error("opening operation rule did not evaluate");
  assert.equal(run.evaluation.outcomes.length, 1);
  return run.evaluation.outcomes[0]!;
}

test("single sliding storage is measured on the intended room side and names the crossed room", () => {
  const source = fourRooms("door w:900 style:sliding hinge:N at:Y2-500");
  const opening = analysisValue(source).openings[0]!;

  assert.equal(opening.style, "sliding");
  assert.equal(opening.intoSpace, "/L1/a");
  assert.equal(opening.storage.length, 1);
  assert.equal(opening.storage[0]!.widthMm, 900);
  assert.equal(opening.storage[0]!.outsideTargetMm, 850);
  assert.deepEqual(opening.storage[0]!.crossedSpaces, [{ ref: "/L1/c", lengthMm: 850 }]);
  assert.equal(onlyOutcome(source).status, "fail");
});

test("single sliding storage passes when its full parked leaf remains in the intended room", () => {
  const source = fourRooms("door w:900 style:sliding hinge:N at:Y2-1500");
  const opening = analysisValue(source).openings[0]!;

  assert.equal(opening.storage[0]!.outsideTargetMm, 0);
  assert.deepEqual(opening.storage[0]!.crossedSpaces, []);
  assert.equal(onlyOutcome(source).status, "pass");
});

test("double sliding storage uses half a leaf at each jamb, while bypass needs no external storage", () => {
  const doubleSource = fourRooms("door w:900 style:sliding-double hinge:N at:Y2-500");
  const double = analysisValue(doubleSource).openings[0]!;
  assert.deepEqual(double.storage.map((leaf) => leaf.widthMm), [450, 450]);
  assert.deepEqual(double.storage.map((leaf) => leaf.outsideTargetMm), [400, 0]);
  assert.equal(onlyOutcome(doubleSource).status, "fail");

  const bypassSource = fourRooms("window w:900 h:1200 style:sliding-bypass hinge:N at:Y2-500");
  const bypass = analysisValue(bypassSource).openings[0]!;
  assert.deepEqual(bypass.storage, []);
  assert.equal(onlyOutcome(bypassSource).status, "pass");
});

test("unresolved sliding storage remains indeterminate when no storage geometry was produced", () => {
  const source = `muro 1.5
grid X 0 4000
grid Y 0 4000
level L1 0 h:2700 slab:150
space /empty room level:L1
space /room room X1..X2 Y1..Y2 level:L1
boundary /empty /room edge:S
  window w:900 h:1200 style:sliding swing:a at:0.5`;
  const opening = analysisValue(source).openings[0]!;

  assert.equal(opening.state, "indeterminate");
  assert.deepEqual(opening.storage, []);
  assert.equal(onlyOutcome(source).status, "indeterminate");
});

test("automatic single and double doors park behind sidelights inside the opening", () => {
  const single = analysisValue(fourRooms("door w:900 style:auto-single hinge:N at:Y2-500")).openings[0]!;
  const double = analysisValue(fourRooms("door w:900 style:auto hinge:N at:Y2-500")).openings[0]!;
  assert.deepEqual(single.storage, []);
  assert.deepEqual(double.storage, []);
  assert.equal(onlyOutcome(fourRooms("door w:900 style:auto hinge:N at:Y2-500")).status, "pass");
});

test("an asset and the same inline attributes derive identical operation geometry", () => {
  const inline = analysisValue(fourRooms("door w:900 style:sliding hinge:N at:Y2-500"));
  const asset = analysisValue(fourRooms(
    "door SD1 at:Y2-500",
    "asset SD1 door w:900 style:sliding hinge:N\n",
  ));
  assert.deepEqual(asset, inline);
});

test("the drawing-only sliding gap cannot change storage analysis", () => {
  const model = parse(fourRooms("door w:900 style:sliding hinge:N at:Y2-1500"));
  const form = derive(model);
  const atWall = planMarks(form, "L1", { slideGap: 0 });
  const farFromWall = planMarks(form, "L1", { slideGap: 500 });
  assert.notDeepEqual(atWall, farFromWall, "the symbol itself must prove that its paper offset changed");

  const first = analysisValue(fourRooms("door w:900 style:sliding hinge:N at:Y2-1500"));
  const second = analysisValue(fourRooms("door w:900 style:sliding hinge:N at:Y2-1500"));
  assert.deepEqual(second, first);
});

test("the same storage rule rotates with a horizontal boundary and an east hinge", () => {
  const source = `muro 1.5
grid X 0 4000 8000
grid Y 0 4000 8000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2 level:L1
space /L1/b room X2..X3 Y1..Y2 level:L1
space /L1/c room X1..X2 Y2..Y3 level:L1
space /L1/d room X2..X3 Y2..Y3 level:L1
boundary /L1/a /L1/c
  door w:900 style:sliding hinge:E at:X2-500`;
  const opening = analysisValue(source).openings[0]!;
  assert.equal(opening.storage[0]!.outsideTargetMm, 850);
  assert.deepEqual(opening.storage[0]!.crossedSpaces, [{ ref: "/L1/b", lengthMm: 850 }]);
});

test("a diagonal opening uses its canonical start and clips storage against the cut space", () => {
  const source = `muro 1.5
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2 level:L1
space /out outside:1
boundary /L1/a /out t:150
  line X1,Y1+3000 X1+3000,Y2
  door w:900 at:0.2 style:sliding`;
  const opening = analysisValue(source).openings[0]!;
  assert.equal(opening.state, "complete");
  assert.equal(opening.storage[0]!.outsideTargetMm, 421.472);
  assert.equal(onlyOutcome(source).status, "fail");
});

test("storage overlapping a separate aperture is measured only when the height ranges overlap", () => {
  const source = fourRooms(`door w:900 h:2100 style:sliding hinge:N at:Y2-1500
  door w:900 h:2100 style:hinged hinge:S at:Y2-500`);
  const opening = analysisValue(source).openings.find((item) => item.style === "sliding")!;
  assert.deepEqual(opening.storage[0]!.overlappedOpenings.map((item) => item.lengthMm), [800]);
  assert.equal(onlyOutcome(source).status, "pass", "the leaf remains in its intended room");
  assert.equal(onlyOutcome(source, SLIDING_STORAGE_OVERLAPS_OPENING_RULE_ID.id).status, "fail");

  const above = fourRooms(`door w:900 h:900 style:sliding hinge:N at:Y2-1500
  window w:900 h:600 style:fixed at:Y2-500`);
  const separated = analysisValue(above).openings[0]!;
  assert.deepEqual(separated.storage[0]!.overlappedOpenings, []);
  assert.equal(onlyOutcome(above, SLIDING_STORAGE_OVERLAPS_OPENING_RULE_ID.id).status, "pass");
});
