import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse, parseFiles } from "../src/core/parse.js";
import { toCanonical } from "../src/core/model.js";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive } from "../src/core/derive.js";
import { semanticDiff, renderDiff } from "../src/core/diff.js";
import { deriveDefaultBoundaries, doorsBetween } from "../src/core/graph.js";
import { daylightInputs } from "../src/core/light.js";
import { svgPlan } from "../src/draw/plan.js";
import { assess, runAnalysis, createAssessmentRegistry } from "../src/validate/assessment.js";
import { createSchematicRegistry, SCHEMATIC_PROFILE } from "../src/validate/builtin/index.js";

const body = `grid X 0 4000 8000
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:space-a
space /L1/b room X2..X3 Y1..Y2 uid:space-b`;
const source = `muro 1.6\nmode spatial\n${body}`;

test("spatial mode preserves unknown faces without manufacturing walls, heights or slabs", () => {
  const model = parse(source);
  assert.deepEqual(checkDiagnostics(model), []);
  assert.equal(model.mode, "spatial");
  assert.equal(model.boundaries.length, 0);
  deriveDefaultBoundaries(model);
  assert.equal(model.boundaries.length, 0);
  const form = derive(model);
  assert.equal(form.mode, "spatial");
  assert.equal(form.unresolved?.length, 7);
  assert.equal(form.spaces.reduce((n, s) => n + s.areaM2!, 0), 32);
  assert.ok(form.spaces.every(s => s.z1 === undefined));
  assert.deepEqual(form.boundaries, []);
  assert.deepEqual(form.slabs, []);
  assert.equal(JSON.parse(toCanonical(model)).mode, "spatial");
  assert.equal(JSON.parse(toCanonical(model)).format, "koyu-canonical/2.0");
  assert.match(svgPlan(model), /data-unresolved="true"/);
});

test("building defaults survive the language bump and opting out of spatial mode", () => {
  const old = parse(`muro 1.5\n${body}`);
  const current = parse(`muro 1.6\n${body}`);
  assert.deepEqual(derive(current), derive(old));
  assert.equal(current.boundaries.length, 3);
  assert.ok(checkDiagnostics(current).some(d => d.code === "SUF01"));
  assert.ok(checkDiagnostics(current).some(d => d.code === "SUF03"));
  assert.equal(JSON.parse(toCanonical(current)).mode, undefined);
  const diff = semanticDiff(parse(source), current);
  assert.deepEqual(diff.mode, { from: "spatial", to: "building" });
  assert.ok(renderDiff(diff).includes("± mode spatial → building"));
  assert.deepEqual(diff.spaces.changed, []);
});

test("mode is a single entry declaration, gated after composition regardless of line order", () => {
  const files = { "main.muro": `import body.muro\nmode spatial\nmuro 1.6`, "body.muro": body };
  assert.equal(parseFiles(files, "main.muro").mode, "spatial");
  assert.deepEqual(files, { "main.muro": `import body.muro\nmode spatial\nmuro 1.6`, "body.muro": body });
  assert.equal(toCanonical(parseFiles(files, "main.muro")), toCanonical(parse(source)));
  for (const head of ["muro 1.5", "koyu 1.1", ""]) {
    assert.throws(() => parse(`${head}\nmode spatial\n${body}`), e => (e as {code?: string}).code === "VER10");
  }
  assert.throws(() => parse(source + "\nmode spatial"), /once/);
  for (const invalid of ["mode", "mode building", "mode spatial extra", "mode spatial mode:spatial"]) {
    assert.throws(() => parse(`muro 1.6\n${invalid}`), /exactly one value/);
  }
  assert.throws(() => parseFiles({ "main.muro": "muro 1.6\nimport child.muro", "child.muro": "mode spatial" }, "main.muro"), /base layer/);
});

test("declared faces resolve only their own segments and keep space identities", () => {
  const initial = parse(source);
  const refined = parse(source + "\nboundary /L1/a /L1/b type:open");
  assert.deepEqual(checkDiagnostics(refined), []);
  assert.equal(derive(refined).unresolved?.length, 6);
  assert.equal(derive(refined).boundaries[0]?.kind, "open");
  assert.deepEqual([...refined.spaces.values()], [...initial.spaces.values()]);
  const shaped = parse(`muro 1.6
mode spatial
grid X 0 4000 8000
grid Y 0 4000 8000
level L1 0
space /L1/a X1..X2 Y1..Y3 + X2..X3 Y1..Y2
space /L1/b X2..X3 Y2..Y3
boundary /L1/a /L1/b type:open edge:N`);
  assert.equal(derive(shaped).unresolved?.filter(f => f.a === "/L1/a" && f.b === "/L1/b").length, 1);
  const outside = parse(source + "\nspace /out outside:1\nboundary /L1/a /out type:open edge:W");
  assert.equal(derive(outside).unresolved?.length, 6);
});

test("spatial mode still rejects contradictory geometry and written values", () => {
  assert.ok(checkDiagnostics(parse(source.replace("/L1/b room X2..X3", "/L1/b room X1..X2"))).some(d => d.code === "GEO02"));
  assert.ok(checkDiagnostics(parse(source.replaceAll("/L1/", "/unknown/"))).some(d => d.code === "SUF02"));
  assert.ok(checkDiagnostics(parse(source + "\nboundary /L1/a /missing")).some(d => d.severity === "error"));
  assert.throws(() => parse(source.replace("level L1 0", "level L1 0 h:-1")));
});

test("physical queries and architectural assessments cannot report success for spatial models", () => {
  const model = parse(source);
  assert.throws(() => doorsBetween(model, "/L1/a", "/L1/b"), /not evaluated/);
  assert.throws(() => daylightInputs(model), /not evaluated/);
  const report = assess(model, { registry: createSchematicRegistry(), profile: SCHEMATIC_PROFILE.id,
    context: { schema: "koyu-context/1", asOf: "2026-10-14", values: {} } });
  assert.equal(report.model.state, "consistent");
  assert.equal(report.model.mode, "spatial");
  assert.equal(report.summary.state, "incomplete");
  assert.equal(report.summary.rules.evaluated, 0);
  assert.ok(report.analyses.every(a => a.artifact.state === "unavailable"));
  assert.ok(report.rules.every(r => r.state === "indeterminate"));
});

test("spatial assessment does not execute third-party providers or rules, even without dependencies", () => {
  const identity = { id: "test.spatial", revision: "1" };
  const registry = createAssessmentRegistry({
    analyses: [{ ...identity, title: "Probe", model: "any", dependencies: [], context: [],
      run: () => { throw new Error("must not execute"); } }],
    ruleSets: [{ id: "test.rules", revision: "1", title: "Probe", purpose: "design-lint", rules: [
      { id: "test.rule", revision: "1", title: "Probe", level: "caution", model: "any", analyses: [], context: [], authority: [],
        evaluate: () => { throw new Error("must not execute"); } },
    ] }],
    profiles: [{ id: "test.profile", revision: "1", title: "Probe", analyses: [identity], ruleSets: [{id: "test.rules", revision: "1"}] }],
  });
  const options = { registry, profile: "test.profile", context: { schema: "koyu-context/1" as const, asOf: "2026-10-14", values: {} } };
  assert.equal(runAnalysis(parse(source), identity, options).result.artifact.state, "unavailable");
  assert.equal(assess(parse(source), options).rules[0]?.state, "indeterminate");
});

test("ordinary CLI reads saved spatial imports for check, json, plan and validate", () => {
  const dir = mkdtempSync(join(tmpdir(), "muro-spatial-"));
  try {
    const entry = join(dir, "main.muro");
    writeFileSync(entry, "muro 1.6\nmode spatial\nimport layout.muro\n");
    writeFileSync(join(dir, "layout.muro"), body);
    const run = (...args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], { encoding: "utf8" });
    const check = run("check", entry, "--strict");
    assert.equal(check.status, 0, check.stderr + check.stdout);
    const json = run("json", entry);
    assert.equal(json.status, 0, json.stderr);
    assert.equal(JSON.parse(json.stdout).mode, "spatial");
    const plan = run("plan", entry, "-l", "L1");
    assert.equal(plan.status, 0, plan.stderr);
    assert.match(readFileSync(join(dir, "main-L1.svg"), "utf8"), /data-unresolved/);
    const validation = run("validate", entry, "--json", "--profile", SCHEMATIC_PROFILE.id, "--as-of", "2026-10-14");
    assert.equal(validation.status, 1);
    assert.equal(JSON.parse(validation.stdout).summary.state, "incomplete");
    const doors = run("doors", entry, "/L1/a", "/L1/b");
    assert.equal(doors.status, 2);
    const light = run("light", entry);
    assert.equal(light.status, 2);
    assert.match(light.stderr, /not evaluated/);
    assert.match(doors.stderr, /not evaluated/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("spatial drawn cuts preserve area and explicitly supplied physical data without inferring a roof", () => {
  const model = parse(`muro 1.6
mode spatial
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:200
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  line X1,Y2-3000 X1+3000,Y2`);
  assert.deepEqual(checkDiagnostics(model), []);
  const form = derive(model);
  assert.equal(form.spaces[0]?.areaM2, 31.5);
  assert.ok(form.boundaries.some(b => b.segment.diagonal));
  assert.ok(form.slabs.some(s => s.kind === "floor"));
  assert.ok(form.slabs.some(s => s.kind === "ceiling"));
  assert.ok(form.slabs.every(s => s.kind !== "roof"));
  assert.equal(form.levels[0]?.pitch, 2700);
  assert.ok((form.unresolved?.length ?? 0) > 0);
});


test("grids and levels alone are a consistent spatial model", () => {
  const model = parse("muro 1.6\nmode spatial\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nlevel L2 3000");
  assert.deepEqual(checkDiagnostics(model), []);
  assert.equal(model.spaces.size, 0);
  assert.deepEqual(derive(model).unresolved, []);
  assert.deepEqual(derive(model).slabs, []);
});
