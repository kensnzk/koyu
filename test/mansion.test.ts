// 10階建て内廊下型集合住宅 — 基準階の反復 (スパン展開とstack) の検証

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/core/diagnose.js";
import { doorsBetween } from "../src/core/graph.js";
import { areaM2, effectiveAttr, isSemiOutdoor, zoneAreaM2 } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/mansion.muro", import.meta.url)),
  "utf8",
);

test("under 200 lines of text expands into 10 storeys and 122 spaces", () => {
  const m = parse(src);
  assert.ok(src.split("\n").length < 200);
  assert.equal(m.spaces.size, 122);
  assert.equal(m.boundaries.length, 332);
  assert.equal(Object.keys(m.levels).length, 11); // L1..L10 + R (範囲宣言L3..L9は7レベル)
  assert.equal(m.zones.size, 8); // Aタイプのゾーン × L2..L9
});

test("typical-floor expansion: every storey gets the same layout, and the z of a level stacks by pitch", () => {
  const m = parse(src);
  assert.deepEqual(m.spaces.get("/L5/A/ldk")!.rects, m.spaces.get("/L2/A/ldk")!.rects);
  assert.deepEqual(m.spaces.get("/L9/E")!.rects, m.spaces.get("/L3/E")!.rects);
  assert.equal(m.levels["L5"]!.z, 12500); // 6700 + 2900×2
  assert.equal(m.levels["L9"]!.z, 24100);
});

test("stack expansion: nine lift-shaft and nine stair vertical boundaries", () => {
  const m = parse(src);
  assert.equal(m.boundaries.filter((b) => b.kind === "shaft").length, 9);
  assert.equal(m.boundaries.filter((b) => b.kind === "stair").length, 9);
});

test("the consistency check passes with zero warnings (the height invariants of all ten storeys included)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("asking about escape: three doors from the ninth-floor LDK to the ground (interior door, entrance, stair fire door)", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/L9/A/ldk", "/out")!;
  assert.equal(route.doors, 3);
  assert.equal(route.path.at(-2), "/L1/stair"); // 屋外階段で地上へ、最後は開放
  // EVシャフトは通れないので、EVからも階段迂回
  const ev = doorsBetween(m, "/L5/ev", "/out")!;
  assert.ok(ev.path.includes("/L5/corridor"));
});

test("eight doors from the second-floor bedroom to the ninth-floor bedroom", () => {
  const m = parse(src);
  assert.equal(doorsBetween(m, "/L2/A/bedroom", "/L9/A/bedroom")!.doors, 8);
});

test("area: 1704 m2 of exclusive floor — unchanged by splitting into a layout or by adding balconies", () => {
  const m = parse(src);
  const exclusive = [...m.spaces.values()]
    .filter((s) => effectiveAttr(m, s, "lease.category") === "exclusive" && !isSemiOutdoor(m, s))
    .reduce((sum, s) => sum + (areaM2(s) ?? 0), 0);
  assert.equal(Math.round(exclusive * 100) / 100, 1704);
  assert.equal(zoneAreaM2(m, "/L5/A"), 34.8); // 住戸=ゾーンの面積は室の合計 (半屋外は数えない)
});

test("semi-outdoor is derived: balconies and outdoor stairs are semi-outdoor, an interior corridor is not", () => {
  const m = parse(src);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/A/balcony")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/stair")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L10/terrace")!), true);
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/corridor")!), false); // 内廊下
  assert.equal(isSemiOutdoor(m, m.spaces.get("/L5/A/ldk")!), false); // バルコニーの内側
});

test("different level ranges cannot be mixed on one line", () => {
  assert.throws(
    () =>
      parse(`
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700
level L2 3000 h:2400 slab:600
level L3 6000 h:2400 slab:600
space /L1..L2/a room X1..X2 Y1..Y2
space /L2..L3/b room X2..X3 Y1..Y2
boundary /L1..L2/a /L2..L3/b t:120
`),
    /Level ranges on one line must agree/,
  );
});

test("a level range declaration requires pitch", () => {
  assert.throws(() => parse("level L2..L5 3000 h:2400"), /pitch/);
});
