// The W3 control group — the export and its oracles (eval/control/).
//
// Two guarantees, and the second is the one that matters.
//
//   1. **The baseline is clean.** Every bundled example, exported and left unedited, passes all
//      four generic oracles. An oracle that fails on an untouched document measures nothing —
//      every run would score as broken no matter what the agent did.
//   2. **A stale stored value is caught, and caught as silent.** Move the geometry and leave the
//      stored area behind: the schema still validates, every reference still resolves, the geometry
//      is still consistent, and the document now says something false about itself. That
//      combination is the mechanism the experiment exists to measure, so it is pinned here.
//
// In muro the same mistake cannot be made — no area is stored, so nothing can fall out of step.
// That asymmetry is the claim under test, and this file is what keeps the measurement honest.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { exportBuilding } from "../eval/control/export.js";
import { scoreControl } from "../eval/control/oracle.js";
import { derive } from "../src/core/derive.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const EXAMPLES = [
  "examples/two-rooms.muro",
  "examples/office.muro",
  "examples/mansion.muro",
  "examples/house/main.muro",
  "examples/basement/main.muro",
  "examples/tower/main.muro",
];

const exported = (file: string): string => {
  const model = parseFile(join(root, file));
  return JSON.stringify(exportBuilding(model, derive(model)));
};

test("control: every bundled example exports to a document that passes all four oracles", () => {
  for (const file of EXAMPLES) {
    const s = scoreControl(exported(file));
    assert.equal(s.parsed, true, `${file}: the export is not JSON`);
    const failed = s.oracles.filter((o) => !o.pass).map((o) => `${o.kind}: ${o.detail}`);
    assert.deepEqual(failed, [], `${file}: an untouched export fails an oracle, so the oracle measures nothing`);
    assert.equal(s.silentlyWrong, false, file);
  }
});

test("control: the export carries the information the tasks need (attributes, names, groups)", () => {
  // T01 edits a floor material and T02 conserves a group's area. Neither reaches the Form, so if
  // the export dropped them the control would lose for holding less information than muro.
  const b = JSON.parse(exported("examples/tower/main.muro")) as {
    rooms: Array<{ id: string; name?: string; attrs?: Record<string, unknown> }>;
    groups: Array<{ id: string; areaM2: number }>;
  };
  const ldk = b.rooms.filter((r) => r.id.endsWith("/A/ldk"));
  assert.equal(ldk.length, 8, "the A-type LDK spans L3..L10, so it expands to eight rooms");
  for (const r of ldk) {
    assert.equal(r.name, "LDK", `${r.id} lost its name`);
    assert.equal(r.attrs?.["floor"], "オーク", `${r.id} lost its floor material`);
  }
  const aType = b.groups.filter((g) => /\/L(?:[3-9]|10)\/A$/.test(g.id));
  assert.equal(aType.length, 8, "the A-type grouping exists on all eight typical floors");
  for (const g of aType) assert.equal(g.areaM2, 61.44, `${g.id} stores the wrong area`);
});

test("control: moving the geometry and leaving a stored area behind is caught, and caught as silent", () => {
  const b = JSON.parse(exported("examples/house/main.muro")) as {
    rooms: Array<{ id: string; areaM2?: number; pieces: Array<Array<[number, number]>> }>;
  };
  // Shrink one room. Shrinking rather than widening keeps the geometry oracle out of it — the point
  // is to leave a document that looks entirely fine.
  const room = b.rooms.find((r) => (r.areaM2 ?? 0) > 10 && r.pieces.length === 1);
  assert.ok(room, "the fixture no longer holds a single-piece room over 10m2");
  const stored = room.areaM2;
  const ring = room.pieces[0]!;
  const maxX = Math.max(...ring.map((p) => p[0]));
  for (const p of ring) if (p[0] === maxX) p[0] = maxX - 600;

  const s = scoreControl(JSON.stringify(b));
  for (const kind of ["schema", "refs", "geometry"] as const) {
    const o = s.oracles.find((x) => x.kind === kind);
    assert.equal(o?.pass, true, `${kind} must still pass — otherwise the failure is not silent`);
  }
  const agreement = s.oracles.find((o) => o.kind === "agreement");
  assert.equal(agreement?.pass, false, "the stored area no longer matches the geometry");
  assert.match(agreement!.detail, new RegExp(`stores ${stored}m2`), "the report names the stale number");
  assert.equal(s.silentlyWrong, true, "this is exactly the silent failure the experiment counts");
});

test("control: a broken document stops at the schema rather than reporting a cascade", () => {
  const s = scoreControl('{"unit":"cm","levels":[],"rooms":[],"walls":[],"openings":[],"columns":[],"groups":[]}');
  assert.equal(s.parsed, true);
  assert.deepEqual(s.oracles.map((o) => o.kind), ["schema"], "only the schema oracle runs");
  assert.equal(s.oracles[0]!.pass, false);
  assert.equal(s.silentlyWrong, false, "a document that fails the schema is not silently wrong — it is loudly wrong");
});

test("control: text that is not JSON is reported as unparsed rather than throwing", () => {
  const s = scoreControl("{ this is not json");
  assert.equal(s.parsed, false);
  assert.equal(s.success, false);
  assert.deepEqual(s.oracles, []);
  assert.ok(s.parseError !== undefined);
});
