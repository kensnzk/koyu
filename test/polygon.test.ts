// 敷地形状 (ADR-0011) — 所与のジオメトリ。書かれる唯一の形。
// 導出面積 (シューレース)・建物のはみ出し検査・正準JSON・合成コンフリクト。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/check.js";
import { pointInPolygon, polygonAreaM2, toCanonical } from "../src/model.js";
import { parse, parseFiles } from "../src/parse.js";
import { siteReport } from "../src/site.js";

const BASE = [
  "koyu 0.1",
  "name 敷地形状",
  "unit mm",
  "grid X 0 8000",
  "grid Y 0 8000",
  "level L1 0 h:2400",
].join("\n");

test("polygonAreaM2: シューレース (三角形・非凸)", () => {
  assert.equal(polygonAreaM2([{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 0, y: 10000 }]), 50);
  // 凹型 (L字): 20m×20m から 10m×10m を欠く = 300㎡
  const L = [
    { x: 0, y: 0 },
    { x: 20000, y: 0 },
    { x: 20000, y: 10000 },
    { x: 10000, y: 10000 },
    { x: 10000, y: 20000 },
    { x: 0, y: 20000 },
  ];
  assert.equal(polygonAreaM2(L), 300);
});

test("pointInPolygon: 内・外・境界上 (epsで内側扱い)", () => {
  const tri = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 0, y: 10000 }];
  assert.equal(pointInPolygon({ x: 2000, y: 2000 }, tri), true);
  assert.equal(pointInPolygon({ x: 9000, y: 9000 }, tri), false);
  assert.equal(pointInPolygon({ x: 5000, y: 0 }, tri), true); // 辺上
});

test("siteReport: polygonがあるとき導出面積は多角形から出る (タイルは近似でよい)", () => {
  const m = parse(
    `${BASE}
zone /site name:敷地 site:1 area:96.00
polygon /site -1000,-1000 11000,-1000 11000,7000 -1000,7000
space /a room X1..X2 Y1..Y2 level:L1
space /site/yard yard X1-1000..X1 Y1..Y2 level:L1
space /out exterior road:6000
boundary /a /out edge:S t:150
boundary /site/yard /out edge:S t:120 air:1 spec:フェンス`,
  );
  const r = siteReport(m);
  assert.equal(r.polygon?.points.length, 4);
  assert.equal(r.derivedArea, 96); // 12m×8m — タイルの合併ではなく多角形
  assert.equal(r.declaredArea, 96);
});

test("check: 建物が敷地形状からはみ出すとエラー、タイルは検査しない", () => {
  const src = (bldg: string) =>
    `${BASE}
zone /site name:敷地 site:1
polygon /site -1000,-1000 9000,-1000 9000,9000 -1000,9000
${bldg}
space /site/yard yard X1-2000..X1 Y1..Y2 level:L1`; // タイルは西へ1mはみ出すが検査されない
  const ok = check(parse(src("space /a room X1..X2 Y1..Y2 level:L1")));
  assert.deepEqual(ok.errors, []);
  const bad = check(parse(src("space /a room X1..X2+2000 Y1..Y2 level:L1"))); // 東へ1000はみ出す
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0]!, /敷地形状からはみ出しています \(角 10000,0\)/);
});

test("check: 対応するゾーンのないpolygonは警告", () => {
  const r = check(parse(`${BASE}\npolygon /nowhere 0,0 1000,0 0,1000`));
  assert.match(r.warnings.join("\n"), /polygon \/nowhere に対応するゾーンがありません/);
});

test("正準JSON: polygonsブロックに頂点列が保存される", () => {
  const m = parse(
    `${BASE}\nzone /site site:1\npolygon /site 0,0 8000,0 8000,8000 0,8000\nspace /a room X1..X2 Y1..Y2 level:L1`,
  );
  const j = JSON.parse(toCanonical(m));
  assert.deepEqual(j.polygons["/site"], [[0, 0], [8000, 0], [8000, 8000], [0, 8000]]);
});

test("合成: 敷地形状の重複は出所つきコンフリクト", () => {
  assert.throws(
    () =>
      parseFiles(
        {
          "main.muro": `${BASE}\nzone /site site:1\nimport ./geoA.muro\nimport ./geoB.muro`,
          "geoA.muro": "polygon /site 0,0 1000,0 0,1000\n",
          "geoB.muro": "polygon /site 0,0 2000,0 0,2000\n",
        },
        "main.muro",
      ),
    /geoB\.muro.*敷地形状が重複.*geoA\.muro/s,
  );
});

test("polygon: 頂点2つ以下はエラー", () => {
  assert.throws(() => parse(`${BASE}\npolygon /site 0,0 1000,0`), /頂点を3つ以上/);
});
