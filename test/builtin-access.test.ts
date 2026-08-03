import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AnalysisArtifact, ContextSnapshot } from "../src/analysis/contracts.js";
import { parse } from "../src/core/parse.js";
import { toCanonical, type Model } from "../src/core/model.js";
import { documentedCases } from "./helpers/docs.js";
import { assess, createAssessmentRegistry, runAnalysis } from "../src/validate/assessment.js";
import {
  ACCESS_ANALYSIS,
  ACCESS_ANALYSIS_ID,
  ACCESS_BACKOFHOUSE_RULE,
  ACCESS_BACKOFHOUSE_RULE_ID,
  ACCESS_PARKING_RULE,
  ACCESS_PARKING_RULE_ID,
  ACCESS_THROUGHTENANT_RULE,
  ACCESS_THROUGHTENANT_RULE_ID,
  ACCESS_UNREACHABLE_RULE,
  ACCESS_UNREACHABLE_RULE_ID,
  ACCESS_VOIDONLY_RULE,
  ACCESS_VOIDONLY_RULE_ID,
  type AccessAnalysisValue,
} from "../src/validate/builtin/access.js";
import type { AssessmentReport, Profile, Rule, RuleSet } from "../src/validate/contracts.js";

const CONTEXT: ContextSnapshot = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: {},
};

const RULES: readonly Rule[] = [
  ACCESS_UNREACHABLE_RULE,
  ACCESS_VOIDONLY_RULE,
  ACCESS_THROUGHTENANT_RULE,
  ACCESS_PARKING_RULE,
  ACCESS_BACKOFHOUSE_RULE,
];

const RULE_SET: RuleSet = {
  id: "test.rules.access",
  revision: "1",
  title: "Built-in access rules",
  purpose: "design-lint",
  rules: RULES,
};

const PROFILE: Profile = {
  id: "test.profile.access",
  revision: "1",
  title: "Built-in access profile",
  analyses: [ACCESS_ANALYSIS_ID],
  ruleSets: [{ id: RULE_SET.id, revision: RULE_SET.revision }],
};

const PROFILE_REF = { id: PROFILE.id, revision: PROFILE.revision } as const;

const REGISTRY = createAssessmentRegistry({
  analyses: [ACCESS_ANALYSIS],
  ruleSets: [RULE_SET],
  profiles: [PROFILE],
});

test("the access provider and five built-in rules expose the approved identities and levels", () => {
  assert.deepEqual(ACCESS_ANALYSIS_ID, { id: "koyu.analysis.access", revision: "1" });
  assert.deepEqual(RULES.map((rule) => ({ id: rule.id, revision: rule.revision, level: rule.level })), [
    { id: "koyu.schematic.access.unreachable", revision: "1", level: "violation" },
    { id: "koyu.schematic.access.voidonly", revision: "1", level: "violation" },
    { id: "koyu.schematic.access.throughtenant", revision: "1", level: "caution" },
    { id: "koyu.schematic.access.parking", revision: "1", level: "violation" },
    { id: "koyu.schematic.access.backofhouse", revision: "1", level: "caution" },
  ]);
});

test("the five existing access reference failures map to the new rule identities", () => {
  const examples = accessReferenceFailures();
  assert.equal(examples.length, 5);
  assertSingleFailure(assessSource(examples[0]!), ACCESS_UNREACHABLE_RULE_ID.id, "violation", "/L1/a");
  assertSingleFailure(assessSource(examples[1]!), ACCESS_VOIDONLY_RULE_ID.id, "violation", "/L1/a");
  assertSingleFailure(assessSource(examples[2]!), ACCESS_THROUGHTENANT_RULE_ID.id, "caution", "/L1/s");
  assertSingleFailure(assessSource(examples[3]!), ACCESS_PARKING_RULE_ID.id, "violation", "/L1/p");
  assertSingleFailure(assessSource(examples[4]!), ACCESS_BACKOFHOUSE_RULE_ID.id, "caution", "/L1/e");
});

test("each access rule distinguishes an explicit pass from an empty population", () => {
  const direct = assessSource(`koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out
  door w:900 edge:S`);
  assert.equal(outcome(direct, ACCESS_UNREACHABLE_RULE_ID.id, "/L1/a").status, "pass");
  assert.equal(outcome(direct, ACCESS_VOIDONLY_RULE_ID.id, "/L1/a").status, "pass");

  const stair = assessSource(`koyu 1.1
grid X 0 4000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/s stair X1..X2 Y1..Y2
boundary /L1/s /out
  door w:900 edge:S`);
  assert.equal(outcome(stair, ACCESS_THROUGHTENANT_RULE_ID.id, "/L1/s").status, "pass");

  const parking = assessSource(parkingDoorSource(2400));
  assert.equal(outcome(parking, ACCESS_PARKING_RULE_ID.id, "/L1/p").status, "pass");

  const vertical = assessSource(horizontalVerticalSource("direct"));
  assert.equal(outcome(vertical, ACCESS_BACKOFHOUSE_RULE_ID.id, "/L1/e").status, "pass");

  const empty = assessSource(`koyu 1.1
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2`);
  for (const rule of RULES) assert.equal(ruleRun(empty, rule.id).state, "not-applicable", rule.id);
});

test("a person route preserves void and shaft intermediates while void-only remains a separate judgement", () => {
  const source = `koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/a room X1..X2 Y1..Y2
space /L1/v room X2..X3 Y1..Y2 void:1
space /L1/h shaft X3..X4 Y1..Y2
boundary /L1/a /L1/v type:open
boundary /L1/v /L1/h type:open
boundary /L1/h /out type:open`;
  const report = assessSource(source);
  assert.equal(outcome(report, ACCESS_UNREACHABLE_RULE_ID.id, "/L1/a").status, "pass");
  assert.equal(outcome(report, ACCESS_VOIDONLY_RULE_ID.id, "/L1/a").status, "fail");

  const artifact = accessArtifact(parse(source));
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("access analysis did not complete");
  const route = artifact.value.personExteriorRoutes.find((candidate) => candidate.ref === "/L1/a");
  assert.deepEqual(route, {
    ref: "/L1/a",
    reachable: true,
    path: ["/L1/a", "/L1/v", "/L1/h", "/out"],
  });
});

test("rentable spaces are excluded only as intermediates of the stair egress query", () => {
  const blocked = assessSource(accessReferenceFailures()[2]!);
  assert.equal(outcome(blocked, ACCESS_THROUGHTENANT_RULE_ID.id, "/L1/s").status, "fail");

  const alternate = `koyu 1.1
grid X 0 3000 6000 9000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/s stair X1..X2 Y1..Y2
space /L1/t room X2..X3 Y1..Y2 use:rentable
space /L1/c corridor X1..X2 Y1+6000..Y1+12000 use:common
boundary /L1/s /L1/t
  door w:900
boundary /L1/t /out
  door w:900 edge:S
boundary /L1/s /L1/c
  door w:900
boundary /L1/c /out
  door w:900 edge:W`;
  const report = assessSource(alternate);
  assert.equal(outcome(report, ACCESS_THROUGHTENANT_RULE_ID.id, "/L1/s").status, "pass");
  const artifact = accessArtifact(parse(alternate));
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("access analysis did not complete");
  assert.deepEqual(artifact.value.rentableAvoidingExteriorRoutes, [{
    ref: "/L1/s",
    reachable: true,
    path: ["/L1/s", "/L1/c", "/out"],
  }]);
});

test("vehicle traversal includes the 2400 mm endpoint and requires a declared ramp for vertical links", () => {
  const narrow = assessSource(parkingDoorSource(2399));
  assert.equal(outcome(narrow, ACCESS_UNREACHABLE_RULE_ID.id, "/L1/p").status, "pass");
  assert.equal(outcome(narrow, ACCESS_PARKING_RULE_ID.id, "/L1/p").status, "fail");

  const endpoint = assessSource(parkingDoorSource(2400));
  assert.equal(outcome(endpoint, ACCESS_PARKING_RULE_ID.id, "/L1/p").status, "pass");

  const steps = assessSource(verticalParkingSource(false));
  assert.equal(outcome(steps, ACCESS_UNREACHABLE_RULE_ID.id, "/B1/p").status, "pass");
  assert.equal(outcome(steps, ACCESS_PARKING_RULE_ID.id, "/B1/p").status, "fail");

  const ramp = assessSource(verticalParkingSource(true));
  assert.equal(outcome(ramp, ACCESS_PARKING_RULE_ID.id, "/B1/p").status, "pass");
  const artifact = accessArtifact(parse(verticalParkingSource(true)));
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("access analysis did not complete");
  assert.deepEqual(
    artifact.value.vehicleExteriorRoutes.find((candidate) => candidate.ref === "/B1/p")?.path,
    ["/B1/p", "/B1/r", "/L1/r", "/out"],
  );
});

test("back-of-house is avoided and a target's own vertical link is not accepted as horizontal entry", () => {
  const backyard = assessSource(accessReferenceFailures()[4]!);
  assert.equal(outcome(backyard, ACCESS_BACKOFHOUSE_RULE_ID.id, "/L1/e").status, "fail");

  const circular = assessSource(horizontalVerticalSource("vertical-only"));
  assert.equal(outcome(circular, ACCESS_BACKOFHOUSE_RULE_ID.id, "/L1/e").status, "fail");

  const direct = assessSource(horizontalVerticalSource("direct"));
  assert.equal(outcome(direct, ACCESS_BACKOFHOUSE_RULE_ID.id, "/L1/e").status, "pass");
});

test("each access rule says exactly what its documented example says it says", () => {
  const cases = documentedCases("access.md");
  assert.equal(cases.length, 5);

  for (const expected of cases) {
    assert.equal(expected.rule, expected.section, `${expected.page}: heading and verdict disagree`);

    const current = assessSource(expected.source)
      .findings.filter((finding) => finding.rule.id === expected.rule);
    assert.equal(current.length, 1, expected.rule);

    const source = current[0]!.outcome.evidence
      .flatMap((item) => item.sources)
      .find((item) => item.kind === "model" && item.location?.line !== undefined);
    assert.ok(source?.kind === "model");
    // access is compared on its message too: the wording tells the reader which of the five
    // different traversals refused, and rolling them into one phrase would hide that.
    assert.deepEqual(
      {
        level: current[0]!.level,
        line: source.location?.line,
        message: current[0]!.outcome.message,
      },
      { level: expected.level, line: expected.line, message: expected.message },
      expected.rule,
    );
  }
});

test("the provider emits neutral JSON observations and leaves the canonical model unchanged", () => {
  const sources = [
    verticalParkingSource(true),
    accessReferenceFailures()[2]!,
    accessReferenceFailures()[4]!,
  ];
  for (const source of sources) {
    const model = parse(source);
    const before = toCanonical(model);
    const artifact = accessArtifact(model);
    assert.equal(toCanonical(model), before);
    assert.deepEqual(JSON.parse(JSON.stringify(artifact)), artifact);

    const json = JSON.stringify(artifact);
    assert.doesNotMatch(json, /"(?:status|outcomes|findings|level|violation|caution|pass|fail)"/);
    assert.equal(json.includes("koyu.schematic."), false);
    for (const oldId of [
      "access.unreachable",
      "access.voidonly",
      "access.throughtenant",
      "access.parking",
      "access.backofhouse",
    ]) assert.equal(json.includes(oldId), false, oldId);
  }
});

test("exterior reachability builds the passable graph in one boundary scan", () => {
  const model = parse(largeConnectedSource(96));
  let boundaryScans = 0;
  const boundaries = model.boundaries;
  model.boundaries = new Proxy(boundaries, {
    get(target, property, receiver) {
      if (property === Symbol.iterator) {
        boundaryScans++;
        return target[Symbol.iterator].bind(target);
      }
      return Reflect.get(target, property, receiver);
    },
  });

  const artifact = ACCESS_ANALYSIS.run({
    model,
    context: {
      get() {
        throw new Error("the access analysis declares no context");
      },
    },
    get() {
      throw new Error("the access analysis declares no dependencies");
    },
  });
  assert.equal(artifact.state, "complete");
  if (artifact.state !== "complete") throw new Error("access analysis did not complete");
  assert.equal(boundaryScans, 1);
  assert.equal(artifact.value.personExteriorRoutes.length, 96);
  assert.equal(artifact.value.personExteriorRoutes.every((route) => route.reachable), true);
});

function assessSource(source: string): AssessmentReport {
  return assess(parse(source), {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  });
}

function accessArtifact(model: Model): AnalysisArtifact<AccessAnalysisValue> {
  return runAnalysis(model, ACCESS_ANALYSIS_ID, {
    registry: REGISTRY,
    profile: PROFILE_REF,
    context: CONTEXT,
  }).result.artifact;
}

function accessReferenceFailures(): string[] {
  const markdown = readFileSync(new URL("../docs/reference/validate/access.md", import.meta.url), "utf8");
  return [...markdown.matchAll(/```muro-(?:fail|caution)\n([\s\S]*?)\n```/g)].map((match) => match[1]!);
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

function ruleRun(report: AssessmentReport, id: string): AssessmentReport["rules"][number] {
  const run = report.rules.find((candidate) => candidate.rule.id === id);
  assert.ok(run, `missing rule run ${id}`);
  return run;
}

function outcome(report: AssessmentReport, ruleId: string, outcomeId: string) {
  const run = ruleRun(report, ruleId);
  assert.equal(run.state, "evaluated", ruleId);
  if (run.state !== "evaluated") throw new Error(`${ruleId} was not evaluated`);
  const found = run.evaluation.outcomes.find((candidate) => candidate.id === outcomeId);
  assert.ok(found, `missing outcome ${ruleId}:${outcomeId}`);
  return found;
}

function parkingDoorSource(widthMm: number): string {
  return `koyu 1.1
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out outside:1
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:${widthMm} edge:S`;
}

function verticalParkingSource(declaredRamp: boolean): string {
  return `koyu 1.1
grid X 0 6000 12000
grid Y 0 6000
level B1 -3000 h:2700 slab:300 underground:1
level L1 0 h:2700 slab:300
space /out outside:1
space /B1/p parking X1..X2 Y1..Y2 use:parking
space /B1/r ramp X2..X3 Y1..Y2 use:parking${declaredRamp ? " ramp:E" : ""}
space /L1/r parking X2..X3 Y1..Y2 use:parking
boundary /B1/p /B1/r type:open
boundary /L1/r /out
  door w:2400 edge:E
stack r B1..L1 type:stair`;
}

function horizontalVerticalSource(mode: "direct" | "vertical-only"): string {
  const corridorLevel = mode === "direct" ? "L1" : "L2";
  return `koyu 1.1
grid X 0 3000 6000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /${corridorLevel}/c corridor X1..X2 Y1..Y2 use:common
space /L1/e room X2..X3 Y1..Y2 use:common escalator:N
space /L2/e room X2..X3 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /${corridorLevel}/c /${corridorLevel}/e
  door w:900`;
}

function largeConnectedSource(count: number): string {
  const coordinates = Array.from({ length: count + 1 }, (_, index) => index * 1000).join(" ");
  const spaces = Array.from({ length: count }, (_, index) => {
    const ref = roomRef(index);
    return `space /L1/${ref} room X${index + 1}..X${index + 2} Y1..Y2`;
  });
  const boundaries = [
    `boundary /L1/${roomRef(0)} /out type:open`,
    ...Array.from({ length: count - 1 }, (_, index) =>
      `boundary /L1/${roomRef(index)} /L1/${roomRef(index + 1)} type:open`
    ),
  ];
  return [
    "koyu 1.1",
    `grid X ${coordinates}`,
    "grid Y 0 1000",
    "level L1 0 h:2700 slab:150",
    "space /out outside:1",
    ...spaces,
    ...boundaries,
  ].join("\n");
}

function roomRef(index: number): string {
  return `r${index.toString().padStart(3, "0")}`;
}

