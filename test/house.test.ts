// 戸建住宅 — メゾネット機構 (level:属性でパス=集計の階層)・部分吹抜け・開き勝手

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.js";
import { doorsBetween } from "../src/graph.js";
import { zoneAreaM2 } from "../src/model.js";
import { parse } from "../src/parse.js";

const src = readFileSync(
  fileURLToPath(new URL("../examples/house.ifcxs", import.meta.url)),
  "utf8",
);

test("メゾネット: /home のゾーンが level: 属性で2つの階を跨ぐ", () => {
  const m = parse(src);
  assert.equal(m.spaces.get("/home/ldk")!.level, "L1");
  assert.equal(m.spaces.get("/home/bed1")!.level, "L2");
  assert.equal(zoneAreaM2(m, "/home"), 92.75); // 階を跨いだ住戸の面積 (吹抜けは不算入)
});

test("整合チェックが警告ゼロで通る (部分吹抜け含む)", () => {
  const m = parse(src);
  const r = check(m);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("内部階段: 2階の寝室から外へ扉2枚", () => {
  const m = parse(src);
  const route = doorsBetween(m, "/home/bed1", "/out")!;
  assert.equal(route.doors, 2);
  assert.ok(route.path.includes("/home/hall1"));
});

test("部分吹抜けで下階の天井高を階高超えにすると被覆率エラー", () => {
  const m = parse(
    src.replace("level:L1 name:LDK", "level:L1 h:5300 name:LDK"),
  );
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("被覆")));
});

test("未宣言のlevel:はエラー", () => {
  assert.throws(() => parse(src.replace("level:L2 name:主寝室", "level:L9 name:主寝室")), /未宣言のレベル/);
});

test("hingeの軸が線分に合わなければエラー", () => {
  // ldk|hall1 の扉は垂直線分 (edge:E) — hinge:W は水平用なので合わない
  const m = parse(src.replace("hinge:S swing:b", "hinge:W swing:b"));
  const r = check(m);
  assert.ok(r.errors.some((e) => e.includes("垂直線分")));
});
