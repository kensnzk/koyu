// semantic diff (ADR-0018) — 構成の言葉の差分。
// 不変量: toCanonical(a)===toCanonical(b) ⇒ semanticDiffは空 (行順・書き方は差分ではない)。
// 素の宣言wallと既定壁 (derived) の同一視、uid改名 (境界が洪水にならない)、
// uid重複モデルでの完走、CLIの終了コード 0/1/2 を検査する。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderDiff, semanticDiff, type ModelDiff } from "../src/core/diff.js";
import { toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const BASE = [
  "koyu 0.2",
  "unit mm",
  "grid X 0 3600 7200",
  "grid Y 0 4500",
  "level L1 0 h:2400",
].join("\n");

/** 差分が空か — renderDiffの行数ゼロと構造の空を同時に見る */
function assertEmpty(d: ModelDiff): void {
  assert.deepEqual(renderDiff(d), []);
  assert.equal(d.version, undefined);
  assert.equal(d.name, undefined);
  assert.deepEqual(d.grid, []);
  assert.deepEqual(d.spaces, { added: [], removed: [], renamed: [], changed: [] });
  assert.deepEqual(d.boundaries, { added: [], removed: [], changed: [] });
}

// ---- (a) 同一・同義は空 ----

test("diff: the diff of an identical model is empty", () => {
  const src = `${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/a /L1/b t:120`;
  assertEmpty(semanticDiff(parse(src), parse(src)));
});

test("diff: line order, the + order of merged regions and opening order are not differences (same toCanonical ⇒ empty diff)", () => {
  const a = parse(
    `${BASE}
space /L1/a room X1..X2 Y1..Y2 + X2..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  door w:800 at:0.25
  window w:600 at:0.75 h:1200`,
  );
  const b = parse(
    `${BASE}
space /out outside:1
space /L1/a room X2..X3 Y1..Y2 + X1..X2 Y1..Y2
boundary /L1/a /out t:150
  window w:600 at:0.75 h:1200
  door w:800 at:0.25`,
  );
  assert.equal(toCanonical(a), toCanonical(b));
  assertEmpty(semanticDiff(a, b));
});

test("diff: swapping the a/b orientation is not a difference when no edge or opening is written (toCanonical does differ)", () => {
  const a = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/a /L1/b t:120`);
  const b = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2\nboundary /L1/b /L1/a t:120`);
  assert.notEqual(toCanonical(a), toCanonical(b)); // 正準JSONは書かれた向きを保存する
  assertEmpty(semanticDiff(a, b));
});

test("diff: the self-diff of all 6 example entries is empty", () => {
  for (const f of [
    "examples/two-rooms.muro",
    "examples/office.muro",
    "examples/mansion.muro",
    "examples/house.muro",
    "examples/house/main.muro",
    "examples/tower/main.muro",
  ]) {
    const a = parseFile(root + f);
    const b = parseFile(root + f);
    assert.equal(toCanonical(a), toCanonical(b), f);
    assert.deepEqual(renderDiff(semanticDiff(a, b)), [], f);
  }
});

// ---- (b) 素wall宣言 vs 省略 (derived) ----

test("diff: a bare declared wall and a default (derived) wall are treated as one (ADR-0014 absorbed)", () => {
  const rooms = `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`;
  const verbose = parse(`${BASE}\n${rooms}\nboundary /L1/a /L1/b`);
  const slim = parse(`${BASE}\n${rooms}`);
  assert.notEqual(toCanonical(verbose), toCanonical(slim)); // 正準JSONは異なる — diffが実効集合で吸収する
  assertEmpty(semanticDiff(verbose, slim));
  assertEmpty(semanticDiff(slim, verbose));
});

test("diff: dropping a wall declaration that is not bare becomes an ordinary field difference (t 120 → none)", () => {
  const rooms = `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`;
  const d = semanticDiff(parse(`${BASE}\n${rooms}\nboundary /L1/a /L1/b t:120`), parse(`${BASE}\n${rooms}`));
  assert.equal(d.boundaries.added.length + d.boundaries.removed.length, 0);
  assert.equal(d.boundaries.changed.length, 1);
  assert.deepEqual(d.boundaries.changed[0]!.fields, [{ field: "t", from: "120" }]);
});

// ---- (c) uid改名 ----

test("diff: same uid with a different path is a rename — the matched pair's token carries the boundaries over, so no flood of removals and additions", () => {
  const BASE3 = ["koyu 0.2", "unit mm", "grid X 0 4000 8000 12000", "grid Y 0 4000", "level L1 0 h:2400"].join("\n");
  const a = parse(
    `${BASE3}
space /L1/a room X1..X2 Y1..Y2 uid:sp-a
space /L1/b room X2..X3 Y1..Y2 uid:sp-b
space /L1/c room X3..X4 Y1..Y2 uid:sp-c
boundary /L1/a /L1/b t:120
  door w:780`,
  );
  const b = parse(
    `${BASE3}
space /L1/a room X1..X2 Y1..Y2 uid:sp-a
space /L1/living room X2..X3 Y1..Y2 uid:sp-b
space /L1/c room X3..X4 Y1..Y2 uid:sp-c
boundary /L1/a /L1/living t:120
  door w:780`,
  );
  const d = semanticDiff(a, b);
  assert.deepEqual(d.spaces.renamed, [{ from: "/L1/b", to: "/L1/living", uid: "sp-b" }]);
  assert.deepEqual(d.spaces.added, []);
  assert.deepEqual(d.spaces.removed, []);
  assert.deepEqual(d.spaces.changed, []);
  // 宣言境界 (a|b) も既定境界 (b|c) も改名を跨いで対応する
  assert.deepEqual(d.boundaries, { added: [], removed: [], changed: [] });
  assert.match(renderDiff(d)[0]!, /^renamed \/L1\/b → \/L1\/living \(uid:sp-b\)$/);
});

test("diff: a zone uid rename is reported the same way", () => {
  const a = parse(`${BASE}\nspace /Z1/a room X1..X2 Y1..Y2 level:L1\nzone /Z1 uid:zn-1 use:exclusive`);
  const b = parse(`${BASE}\nspace /Z2/a room X1..X2 Y1..Y2 level:L1\nzone /Z2 uid:zn-1 use:exclusive`);
  const d = semanticDiff(a, b);
  assert.deepEqual(d.zones.renamed, [{ from: "/Z1", to: "/Z2", uid: "zn-1" }]);
  assert.deepEqual(d.zones.changed, []);
});

// ---- (d) 変化の検出 ----

test("diff: changes of region, area, attribute and level", () => {
  const a = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 floor:畳`);
  const b = parse(`koyu 0.2\nunit mm\ngrid X 0 3600 7200\ngrid Y 0 4500\nlevel L1 0 h:2600\nspace /L1/a room X1..X3 Y1..Y2 floor:オーク`);
  const d = semanticDiff(a, b);
  assert.equal(d.levels.changed.length, 1);
  assert.deepEqual(d.levels.changed[0]!.fields, [{ field: "h", from: "2400", to: "2600" }]);
  const c = d.spaces.changed[0]!;
  assert.equal(c.path, "/L1/a");
  assert.deepEqual(c.fields, [
    { field: "region", from: "X1..X2 Y1..Y2", to: "X1..X3 Y1..Y2" },
    { field: "area", from: "16.20 m2", to: "32.40 m2" },
    { field: "floor", from: "畳", to: "オーク" },
  ]);
});

test("diff: a change of boundary t and opening width becomes field differences on a single matched pair", () => {
  const rooms = `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`;
  const a = parse(`${BASE}\n${rooms}\nboundary /L1/a /L1/b t:120\n  door w:780 h:2000`);
  const b = parse(`${BASE}\n${rooms}\nboundary /L1/a /L1/b t:150\n  door w:900 h:2000`);
  const d = semanticDiff(a, b);
  assert.equal(d.boundaries.changed.length, 1);
  const c = d.boundaries.changed[0]!;
  assert.deepEqual(c.between, ["/L1/a", "/L1/b"]);
  assert.deepEqual(c.fields, [
    { field: "t", from: "120", to: "150" },
    { field: "door at:0.5 w", from: "780", to: "900" },
  ]);
  assert.equal(renderDiff(d)[0], "± boundary /L1/a | /L1/b: t 120 → 150 / door at:0.5 w 780 → 900");
});

test("diff: a moved grid coordinate comes first in the output and explains the cause of the area difference", () => {
  const rooms = `space /L1/a room X1..X2 Y1..Y2`;
  const a = parse(`${BASE}\n${rooms}`);
  const b = parse(`koyu 0.2\nunit mm\ngrid X 0 4200 7200\ngrid Y 0 4500\nlevel L1 0 h:2400\n${rooms}`);
  const d = semanticDiff(a, b);
  assert.deepEqual(d.grid, [{ axis: "X", name: "X2", kind: "moved", from: 3600, to: 4200 }]);
  const lines = renderDiff(d);
  assert.equal(lines[0], "± grid X X2 3600 → 4200");
  assert.ok(lines.some((l) => l.includes("area 16.20 m2 → 18.90 m2")));
});

test("diff: a polygon is compared under cyclic normalization (rotation and reversal), and the text names only the fields that changed", () => {
  const site = `zone /site site:1`;
  const a = parse(`${BASE}\n${site}\npolygon /site 0,0 10000,0 10000,10000 0,10000`);
  const rotated = parse(`${BASE}\n${site}\npolygon /site 10000,0 10000,10000 0,10000 0,0`);
  const reversed = parse(`${BASE}\n${site}\npolygon /site 0,10000 10000,10000 10000,0 0,0`);
  assert.deepEqual(semanticDiff(a, rotated).polygons.changed, []);
  assert.deepEqual(semanticDiff(a, reversed).polygons.changed, []);
  // 面積だけが変わったなら面積だけを言う — 「頂点 4 → 4」は何も伝えない
  const grown = parse(`${BASE}\n${site}\npolygon /site 0,0 12000,0 12000,10000 0,10000`);
  assert.deepEqual(semanticDiff(a, grown).polygons.changed, [
    { path: "/site", fields: [{ field: "area", from: "100.00 m2", to: "120.00 m2" }] },
  ]);
  // 頂点数も面積も同じまま形が変わることはある — そのときは黙らずにそう言う
  const sheared = parse(`${BASE}\n${site}\npolygon /site 0,0 10000,0 12000,10000 2000,10000`);
  assert.deepEqual(semanticDiff(a, sheared).polygons.changed, [
    { path: "/site", fields: [{ field: "shape", from: "same vertex count and same area", to: "the vertices sit elsewhere" }] },
  ]);
});

test("diff: the three words of 0.5 — column, drawn line and underground all show in the diff (ADR-0029)", () => {
  const B = ["koyu 0.5", "unit mm", "grid X 0 4000 8000", "grid Y 0 3000", "level L1 0 h:2700"].join("\n");

  // 柱: 宣言そのものを比べる。位置は書かれないので、比べるものは宣言しかない
  const noCol = parse(`${B}\nspace /L1/a room X1..X3 Y1..Y2`);
  const withCol = parse(`${B}\nspace /L1/a room X1..X3 Y1..Y2\ncolumn 800 L1 x:X2`);
  assert.deepEqual(semanticDiff(noCol, withCol).columns.added, [{ at: 1, label: "800 square L1 x:X2" }]);
  assert.deepEqual(renderDiff(semanticDiff(withCol, noCol)), ["− column 800 square L1 x:X2"]);

  // **宣言順は意味である** (同じ交点は先の宣言が勝つ) — 入れ替えは順位の差分になる
  const two = (first: string, second: string) =>
    parse(`${B}\nspace /L1/a room X1..X3 Y1..Y2\ncolumn ${first}\ncolumn ${second}`);
  const d = semanticDiff(two("900 L1 x:X2", "500 L1"), two("500 L1", "900 L1 x:X2"));
  assert.deepEqual(d.columns.changed.map((c) => [c.path, c.fields[0]!.from, c.fields[0]!.to]), [
    ["900 square L1 x:X2", "1", "2"],
    ["500 square L1", "2", "1"],
  ]);

  // 描かれた線: 面積が変わらない移動 (隅切りを反対の隅へ) でも見える
  const line = (spell: string) =>
    parse(`${B}\nspace /L1/a room X1..X2 Y1..Y2\nspace /out outside:1\nboundary /L1/a /out edge:S t:120\n  line ${spell}`);
  const moved = semanticDiff(line("X1+1000,Y1 X1,Y1+1000"), line("X2-1000,Y1 X2,Y1+1000"));
  assert.equal(moved.boundaries.changed.length, 1);
  assert.deepEqual(moved.boundaries.changed[0]!.fields, [
    { field: "line", from: "X1,Y1+1000..X1+1000,Y1", to: "X2-1000,Y1..X2,Y1+1000" },
  ]);
  // 端点の書き順は図形を変えない — 差分にもならない
  assertEmpty(semanticDiff(line("X1+1000,Y1 X1,Y1+1000"), line("X1,Y1+1000 X1+1000,Y1")));

  // 地下: 集計と矩計が読む宣言なので、付け外しは差分である
  const lv = (extra: string) => parse(`${B.replace("level L1 0 h:2700", `level L1 0 h:2700${extra}`)}\nspace /L1/a room X1..X2 Y1..Y2`);
  assert.deepEqual(semanticDiff(lv(""), lv(" underground:1")).levels.changed, [
    { path: "L1", fields: [{ field: "underground", from: "—", to: "1" }] },
  ]);
});

test("canonical JSON: the declaration order of columns is kept, the order of grid line names is canonicalized (ADR-0029)", () => {
  const B = ["koyu 0.5", "unit mm", "grid X 0 4000 8000", "grid Y 0 4000", "level L1 0 h:3000"].join("\n");
  const two = (first: string, second: string) =>
    parse(`${B}\nspace /L1/a room X1..X3 Y1..Y2\ncolumn ${first}\ncolumn ${second}`);
  // **順序は意味なので消さない** — 消すと別の建物が同一バイトになる
  assert.notEqual(toCanonical(two("900 L1 x:X2", "500 L1")), toCanonical(two("500 L1", "900 L1 x:X2")));
  // 一方、通り名の列に順序の意味は無い — 正準化してバイトを揃える
  const names = (spell: string) => parse(`${B}\nspace /L1/a room X1..X3 Y1..Y2\ncolumn 800 L1 ${spell}`);
  assert.equal(toCanonical(names("x:X1,X2 y:Y1,Y2")), toCanonical(names("x:X2,X1 y:Y2,Y1")));
});

test("diff: changes of version and name", () => {
  const a = parse(`koyu 0.1\nname 甲\nunit mm\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`);
  const b = parse(`koyu 0.2\nname 乙\nunit mm\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`);
  const d = semanticDiff(a, b);
  assert.deepEqual(d.version, { from: "0.1", to: "0.2" });
  assert.deepEqual(d.name, { from: "甲", to: "乙" });
});

// ---- (e) uid重複モデルでも完走 ----

test("diff: on a model with duplicate uids (UID03) it falls back to path matching and does not crash", () => {
  const a = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:dup\nspace /L1/b room X2..X3 Y1..Y2 uid:dup`);
  const b = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:dup\nspace /L1/c room X2..X3 Y1..Y2 uid:dup`);
  const d = semanticDiff(a, b);
  // 重複uidは同一性の根拠にならない — 改名ではなく追加/削除として出る
  assert.deepEqual(d.spaces.renamed, []);
  assert.equal(d.spaces.added.length, 1);
  assert.equal(d.spaces.added[0]!.path, "/L1/c");
  assert.equal(d.spaces.removed.length, 1);
  assert.equal(d.spaces.removed[0]!.path, "/L1/b");
});

// ---- (f) 追加/削除 ----

test("diff: spaces added and removed (with type and area). The default boundary of a new contact shows as an addition too", () => {
  const a = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2`);
  const b = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /L1/study room X2..X3 Y1..Y2`);
  const d = semanticDiff(a, b);
  assert.deepEqual(d.spaces.added, [{ path: "/L1/study", type: "room", areaM2: 16.2 }]);
  assert.deepEqual(d.boundaries.added, [{ between: ["/L1/a", "/L1/study"], kind: "wall" }]);
  assert.ok(renderDiff(d).includes("+ space /L1/study (room 16.20 m2)"));
  const r = semanticDiff(b, a);
  assert.equal(r.spaces.removed[0]!.path, "/L1/study");
  assert.equal(r.boundaries.removed.length, 1);
});

// ---- CLI: 終了コード 0/1/2 ----

test("CLI: the exit code of diff is 0 = no differences / 1 = differences / 2 = broken input", { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "koyu-diff-"));
  const fa = join(dir, "a.muro");
  const fb = join(dir, "b.muro");
  const broken = join(dir, "broken.muro");
  writeFileSync(fa, `${BASE}\nspace /L1/a room X1..X2 Y1..Y2 floor:畳\n`);
  writeFileSync(fb, `${BASE}\nspace /L1/a room X1..X2 Y1..Y2 floor:オーク\n`);
  writeFileSync(broken, `${BASE}\nspace /L1/a room X1..X9 Y1..Y2\n`); // 未定義の通り → SourceError

  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "diff", ...args], {
      cwd: root,
      encoding: "utf8",
    });

  const same = run(fa, fa);
  assert.equal(same.status, 0);
  assert.match(same.stdout, /No differences/);

  const changed = run(fa, fb);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /± \/L1\/a: floor 畳 → オーク/);

  const json = run(fa, fb, "--json");
  assert.equal(json.status, 1);
  const d = JSON.parse(json.stdout) as ModelDiff;
  assert.equal(d.spaces.changed[0]!.path, "/L1/a");

  const bad = run(fa, broken);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Undefined grid line name/);
});

test("moving level: to another level is a difference (it appears in the canonical JSON too — the invariant holds)", () => {
  const src = (lv: string) =>
    `koyu 0.2\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0\nlevel L2 3000\nspace /Z/a room X1..X2 Y1..Y2 level:${lv}`;
  const a = parse(src("L1"));
  const b = parse(src("L2"));
  assert.notEqual(toCanonical(a), toCanonical(b));
  const lines = renderDiff(semanticDiff(a, b));
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /level L1 → L2/);
});
