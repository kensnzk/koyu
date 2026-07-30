// The eval harness itself (eval/run.ts, eval/score.ts) — that it loads, and that it still measures.
//
// **This file exists because the harness rotted in silence.** `eval/score.ts` imported `daylight`
// from the public surface; the split of core from validation renamed it to `daylightInputs` and
// moved the judgement to `daylight.ratio`, and nothing noticed — the harness could not start at
// all. Separately the tower fixture drifted by one boundary and one window, so task oracles
// asserting "unchanged" were asserting numbers no run could satisfy.
//
// Neither failure was visible to `npm test`, because nothing imported the harness. Now something
// does. What is pinned here is the minimum that makes the harness trustworthy:
//
//   1. every task file loads and validates (catches import rot and a malformed control section)
//   2. the fixture's invariants are the numbers the tasks assert (catches fixture drift)
//   3. the reference solution passes, in both conditions (catches an unachievable task)

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { exportBuilding } from "../eval/control/export.js";
import { scoreControl } from "../eval/control/oracle.js";
import { EVAL_DIR, loadTask, scoreTask } from "../eval/score.js";
import { derive } from "../src/core/derive.js";
import { daylightInputs } from "../src/index.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const TASKS = join(EVAL_DIR, "tasks");
const TOWER = join(root, "examples/tower");

test("harness: every task file loads and validates", () => {
  const files = readdirSync(TASKS).filter((f) => f.endsWith(".json")).sort();
  assert.ok(files.length >= 6, `only ${files.length} task files were found`);
  for (const f of files) {
    const t = loadTask(join(TASKS, f));
    assert.equal(t.id, f.replace(/\.json$/, ""), `${f}: the id and the filename disagree`);
    assert.ok(t.oracles.length >= 2, `${f}: fewer than two oracles`);
  }
});

/**
 * The invariants the task oracles assert as "unchanged".
 *
 * These numbers live in two places — here and in the `expr` of several tasks — so they are written
 * here to make the pair break together. When the fixture legitimately changes, this test says so
 * first and names what to fix.
 */
test("harness: the tower fixture matches the invariants the tasks assert", () => {
  const m = parseFile(join(TOWER, "main.muro"));
  const windows = m.boundaries.reduce((n, b) => n + b.openings.filter((o) => o.kind === "window").length, 0);
  const openings = m.boundaries.reduce((n, b) => n + b.openings.length, 0);
  assert.deepEqual(
    {
      spaces: m.spaces.size,
      zones: m.zones.size,
      boundaries: m.boundaries.length,
      openings,
      windows,
      daylightTargets: daylightInputs(m).length,
    },
    { spaces: 178, zones: 9, boundaries: 543, openings: 313, windows: 158, daylightTargets: 66 },
    "the fixture drifted — fix the numbers in eval/tasks/*.json in the same change",
  );
});

/**
 * `eval/fixtures/tower-uid` is a **frozen copy**, not a link to `examples/tower`.
 *
 * The two drifted apart: the bundled example gained a boundary and a window, the frozen copy did
 * not. So the invariants a task asserts depend on **which fixture it uses**, and a blanket edit
 * across the task files corrupts the ones pointing at the frozen copy. That happened once already.
 */
test("harness: the frozen tower-uid fixture keeps its own invariants, distinct from examples/tower", () => {
  const uid = parseFile(join(root, "eval/fixtures/tower-uid/main.muro"));
  const bundled = parseFile(join(TOWER, "main.muro"));
  const count = (m: typeof uid) => ({
    spaces: m.spaces.size,
    zones: m.zones.size,
    boundaries: m.boundaries.length,
    openings: m.boundaries.reduce((n, b) => n + b.openings.length, 0),
  });
  assert.deepEqual(
    count(uid),
    { spaces: 178, zones: 9, boundaries: 542, openings: 286 },
    "the frozen fixture drifted — T05's oracles assert these exact numbers",
  );
  assert.notDeepEqual(
    count(uid),
    count(bundled),
    "the two fixtures are meant to differ; if they ever agree, the distinction above is no longer load-bearing",
  );
});

/** Copy the fixture into a fresh directory outside the repository, the way `prepare` does */
function work(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "koyu-eval-test-")), "work");
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("harness: the muro reference solution for T01 passes every oracle", () => {
  const dir = work();
  cpSync(TOWER, dir, { recursive: true });
  // One line carries the A-type LDK across L3..L10, so the whole task is one edit
  let edited = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".muro"))) {
    const p = join(dir, f);
    const src = readFileSync(p, "utf8");
    if (!src.includes("/A/ldk") || !src.includes("floor:オーク")) continue;
    writeFileSync(p, src.replace("floor:オーク", "floor:タイル"), "utf8");
    edited++;
  }
  assert.equal(edited, 1, "the reference edit is one line in one file");

  const task = loadTask(join(TASKS, "T01-floor-material.json"));
  const r = scoreTask(task, dir, { taskDir: TASKS });
  const failed = r.oracles.filter((o) => !o.pass).map((o) => `${o.label}: ${o.detail}`);
  assert.deepEqual(failed, [], "the reference solution must pass — otherwise the task is unachievable");
});

test("harness: T01 is not already satisfied by the untouched fixture", () => {
  // A task the fixture already satisfies measures nothing. Only the oracles that ask for the change
  // may fail here; the ones asserting invariants must already hold.
  const dir = work();
  cpSync(TOWER, dir, { recursive: true });
  const task = loadTask(join(TASKS, "T01-floor-material.json"));
  const r = scoreTask(task, dir, { taskDir: TASKS });
  assert.equal(r.success, false, "the untouched fixture already passes T01");
  assert.equal(r.checkGreen, true, "the untouched fixture must be green — the task is not about fixing errors");
  const failed = r.oracles.filter((o) => !o.pass);
  assert.equal(failed.length, 2, `only the two change-asking oracles may fail, but ${failed.length} did`);
});

test("harness: every task that carries a control section is runnable in the control condition", () => {
  // A control section that reads a stored number, or that returns something other than `true`, is a
  // section that cannot measure what it claims to. `loadTask` rejects the first; this catches the
  // second by evaluating every assertion against the untouched export — each must return a boolean.
  const model = parseFile(join(TOWER, "main.muro"));
  const doc = JSON.stringify(exportBuilding(model, derive(model)));
  const withControl = readdirSync(TASKS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadTask(join(TASKS, f)))
    .filter((t) => t.control !== undefined);
  assert.equal(withControl.length, 6, "every task must be runnable in the control condition");
  for (const t of withControl) {
    if (t.fixture !== "examples/tower") continue; // a different fixture needs its own export
    const s = scoreControl(doc, t.control!.asserts);
    for (const o of s.oracles.filter((x) => x.kind === "assert")) {
      assert.ok(
        o.detail === "true" || o.detail === "evaluated to false",
        `${t.id} / ${o.label}: an assertion must evaluate to a boolean, got ${o.detail}`,
      );
    }
    // The untouched export must fail at least one assertion, or the task is already satisfied
    assert.ok(
      s.oracles.some((o) => o.kind === "assert" && !o.pass),
      `${t.id}: the untouched export already satisfies every assertion`,
    );
  }
});

test("harness: the control reference solution for T01 passes every oracle", () => {
  const task = loadTask(join(TASKS, "T01-floor-material.json"));
  assert.ok(task.control, "T01 must carry a control section to run in the control condition");
  const model = parseFile(join(TOWER, "main.muro"));
  const doc = JSON.parse(JSON.stringify(exportBuilding(model, derive(model)))) as {
    rooms: Array<{ id: string; attrs?: Record<string, unknown> }>;
  };

  // Untouched: the generic oracles pass and the two change-asking asserts fail
  const before = scoreControl(JSON.stringify(doc), task.control.asserts);
  assert.equal(before.success, false);
  assert.equal(before.oracles.filter((o) => !o.pass).length, 2);

  // The same change costs eight edits here, one per level — the mechanism the experiment measures
  let edited = 0;
  for (const r of doc.rooms) {
    if (r.id.endsWith("/A/ldk") && r.attrs?.["floor"] === "オーク") {
      r.attrs["floor"] = "タイル";
      edited++;
    }
  }
  assert.equal(edited, 8, "the A-type LDK is eight separate rooms in the control");

  const after = scoreControl(JSON.stringify(doc), task.control.asserts);
  const failed = after.oracles.filter((o) => !o.pass).map((o) => `${o.kind}/${o.label}: ${o.detail}`);
  assert.deepEqual(failed, [], "the reference solution must pass in the control too");
  assert.equal(after.silentlyWrong, false);
});
