import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "../src/index.js";
import { areaSchedule, derive } from "../src/form.js";

const entry = new URL("../conformance/cases/roof-frame-dimensions/main.muro", import.meta.url);
const source = readFileSync(entry, "utf8");

test("a geometric takeoff keeps space allocations separate from inclined surfaces and physical members", () => {
  const schedule = areaSchedule(derive(parse(source)));
  assert.deepEqual(schedule.levels, areaSchedule(derive(parse(source.split("roof /roof")[0]!))).levels);
  assert.equal(schedule.levels[0]!.indoorM2, 48);
  const roof = schedule.roofs[0]!;
  assert.equal(roof.modeledProjectionM2, 48);
  assert.ok(Math.abs(roof.surfaceAreaM2! - 48 * Math.hypot(1, 0.25)) < 1e-10);
  assert.equal(schedule.columns[1]!.areaM2, 0.2);
  assert.equal(schedule.beams[0]!.volumeM3, 1);
  assert.ok(Math.abs(schedule.foundations[0]!.volumeM3 - 2.16) < 1e-10);
});

test("an outline with no surveyed heights has a projection and no surface quantity", () => {
  const schedule = areaSchedule(derive(parse(source.replace("type:gable eave-z:3000 ridge-axis:X slope:1/4 t:150", ""))));
  assert.equal(schedule.roofs[0]!.projectedAreaM2, 48);
  assert.equal(schedule.roofs[0]!.modeledProjectionM2, 0);
  assert.equal(schedule.roofs[0]!.surfaceAreaM2, undefined);
});
