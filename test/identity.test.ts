// 同一性 (ADR-0015 / ADR-0039) — 凍らせる八つの面の三番目。
//
// ここが縛るのは五つ。
//   (1) uid を書ける対象の一覧が閉じている (space / zone のみ。台帳が動いたら落ちる)
//       — 他の要素に書けば ATT03、level なら SourceError。**黙って無視される経路は無い**
//   (2) 生成 (newUids) — 綴りの規則・モデル内での非衝突・束の中での非衝突・count の検証
//   (3) 付与は明示の行為である — parse も check も write の門番も uid を書かない
//   (4) 名は含む対象の中で一つを指す (UID04)。アセットから継いだ型の名は主張ではない
//   (5) 名で対応づく差分 — 名の付いた開口を動かせば「移動」であって「消えて生えた」ではない

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { semanticDiff, renderDiff } from "../src/core/diff.js";
import { newUids, openingIdentity, SourceError, toCanonical } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { ATTR_LEDGER } from "../src/core/vocabulary.js";
import * as api from "../src/index.js";

const BASE = [
  "koyu 1.1",
  "unit mm",
  "grid X 0 3600 7200",
  "grid Y 0 4500",
  "level L1 0 h:2400 slab:150",
].join("\n");

const build = (body: string) => parse(`${BASE}\n${body}`);
const codes = (src: string) => checkDiagnostics(parse(`${BASE}\n${src}`)).map((d) => d.code);

const TWO_ROOMS = [
  "space /L1/a room X1..X2 Y1..Y2",
  "space /L1/b room X2..X3 Y1..Y2",
  "space /out outside:1",
].join("\n");

// ---- (1) uid を書ける対象は閉じている ----

test("identity: the ledger holds uid on space and zone and on nothing else (the closed list, ADR-0039)", () => {
  const carriers = Object.entries(ATTR_LEDGER)
    .filter(([, keys]) => keys["uid"] !== undefined)
    .map(([elem]) => elem)
    .sort();
  assert.deepEqual(
    carriers,
    ["space", "zone"],
    "the list of things that can carry a uid is closed — adding one means changing spec/scope.md §5.1 as well",
  );
});

test("identity: a uid written on a space or a zone is accepted", () => {
  assert.deepEqual(
    codes(`zone /L1/z name:Z uid:zn-1\nspace /L1/z/a room X1..X2 Y1..Y2 uid:sp-a\nspace /out outside:1`),
    [],
  );
});

for (const [what, body] of [
  ["boundary", `${TWO_ROOMS}\nboundary /L1/a /L1/b t:120 uid:bd-1`],
  ["opening", `${TWO_ROOMS}\nboundary /L1/a /L1/b t:120\n  door w:780 h:2000 uid:op-1`],
  ["seg", `${TWO_ROOMS}\nboundary /L1/a /out t:150\n  seg w:600 at:0.5 edge:S uid:sg-1`],
  ["area", `space /L1/a room X1..X2 Y1..Y2\n  area X1..X2 Y1..Y2 uid:ar-1`],
  ["column", `space /L1/a room X1..X2 Y1..Y2\ncolumn 600 L1 uid:col-1`],
  ["asset", `asset D1 door w:800 h:2000 uid:as-1\nspace /L1/a room X1..X2 Y1..Y2`],
] as const) {
  test(`identity: a uid written on a ${what} is an error, never silently ignored (ATT03)`, () => {
    assert.ok(
      codes(body).includes("ATT03"),
      `a uid on a ${what} produced ${codes(body).join(", ") || "nothing"} — the silent path is back`,
    );
  });
}

test("identity: a uid written on a level is refused by the parser (level carries no free attributes)", () => {
  assert.throws(
    () => parse("koyu 1.1\nunit mm\ngrid X 0 3600\ngrid Y 0 4500\nlevel L1 0 h:2400 uid:lv-1"),
    (e: unknown) => e instanceof SourceError && /not in the ledger/.test(e.message),
  );
});

test("identity: a namespaced uid is carried, but it is not an identity (core never reads it)", () => {
  const m = build(`space /L1/a room X1..X2 Y1..Y2 acme.uid:sp-a\nspace /L1/b room X2..X3 Y1..Y2 acme.uid:sp-a`);
  assert.deepEqual(checkDiagnostics(m).map((d) => d.code), []); // 重複しても UID03 は出ない
  const renamed = build(`space /L1/x room X1..X2 Y1..Y2 acme.uid:sp-a\nspace /L1/b room X2..X3 Y1..Y2 acme.uid:sp-a`);
  assert.deepEqual(semanticDiff(m, renamed).spaces.renamed, [], "a carried key must not drive rename detection");
});

// ---- (2) 生成 ----

test("identity: a generated uid is 18 characters, u- and Crockford base32, and never digits alone", () => {
  const m = build(`space /L1/a room X1..X2 Y1..Y2`);
  for (const uid of newUids(m, 64)) {
    assert.match(uid, /^u-[0-9abcdefghjkmnpqrstvwxyz]{16}$/, uid);
    assert.equal(uid.length, 18);
    assert.equal(/\s/.test(uid), false);
    assert.equal(uid.indexOf("u"), 0, "the prefix letter is not in the alphabet, so it appears once");
  }
});

test("identity: a generated uid passes UID01/UID02 when it is written into the source", () => {
  const [uid] = newUids(build(`space /L1/a room X1..X2 Y1..Y2`));
  assert.deepEqual(codes(`space /L1/a room X1..X2 Y1..Y2 uid:${uid}`), []);
});

test("identity: newUids collides with nothing already composed into the model", () => {
  const taken = newUids(build(`space /L1/a room X1..X2 Y1..Y2`), 8);
  // その uid を全て書き込んだモデルを作り、そこから更に採る
  const m = build(taken.map((u, i) => `space /L1/s${i} room X1..X2 Y1..Y2 level:L1 uid:${u}`).join("\n"));
  const fresh = newUids(m, 8);
  for (const u of fresh) assert.equal(taken.includes(u), false, `${u} collides with a uid already in the model`);
  assert.equal(new Set(fresh).size, fresh.length, "a batch must not repeat itself");
});

test("identity: newUids takes a positive integer count", () => {
  const m = build(`space /L1/a room X1..X2 Y1..Y2`);
  assert.equal(newUids(m).length, 1);
  assert.equal(newUids(m, 3).length, 3);
  for (const bad of [0, -1, 1.5, NaN]) {
    assert.throws(() => newUids(m, bad), RangeError, `count=${bad}`);
  }
});

test("identity: newUids is on the public face (spec/tools.md and src/index.ts agree elsewhere)", () => {
  assert.equal(typeof api.newUids, "function");
});

// ---- (3) 付与は明示の行為である ----

test("identity: nothing assigns a uid on its own — parse and check leave the source without one", () => {
  const m = build(`${TWO_ROOMS}\nzone /L1/z name:Z`);
  checkDiagnostics(m);
  for (const s of m.spaces.values()) assert.equal(s.attrs["uid"], undefined, s.path);
  for (const z of m.zones.values()) assert.equal(z.attrs["uid"], undefined, z.path);
  assert.equal(/"uid"/.test(toCanonical(m)), false, "the canonical form must not grow a uid nobody wrote");
});

// ---- (4) 名は含む対象の中で一つを指す (UID04) ----

test("identity: two openings of one name in one boundary are an error (UID04)", () => {
  const src = `${TWO_ROOMS}
boundary /L1/a /out t:150
  window w:1200 h:1100 edge:S at:0.25 name:W1
  window w:1200 h:1100 edge:S at:0.75 name:W1`;
  const d = checkDiagnostics(parse(`${BASE}\n${src}`)).filter((x) => x.code === "UID04");
  assert.equal(d.length, 1);
  assert.equal(d[0]!.severity, "error");
  assert.deepEqual(d[0]!.path, ["/L1/a", "/out"]);
  assert.equal(d[0]!.related?.length, 1, "the earlier declaration is carried as related");
  assert.match(d[0]!.message, /Duplicate opening name/);
});

test("identity: the same rule holds for a seg in a boundary, an area in a space, and a column in the model", () => {
  const seg = `${TWO_ROOMS}
boundary /L1/a /out t:150
  seg w:600 at:0.2 edge:S name:S1
  seg w:600 at:0.6 edge:S name:S1`;
  assert.deepEqual(codes(seg), ["UID04"]);

  const area = `space /L1/a room X1..X2 Y1..Y2
  area X1..X2 Y1..Y2 floor:tile name:A1
  area X1..X2 Y1..Y2 floor:wood name:A1`;
  assert.deepEqual(codes(area), ["UID04"]);

  const column = `space /L1/a room X1..X2 Y1..Y2
column 600 L1 x:X1 name:C1
column 500 L1 x:X2 name:C1`;
  assert.deepEqual(codes(column), ["UID04"]);
});

test("identity: an element with no name claims no identity, so it is not in the population", () => {
  const src = `${TWO_ROOMS}
boundary /L1/a /out t:150
  window w:1200 h:1100 edge:S at:0.25
  window w:1200 h:1100 edge:S at:0.75`;
  assert.deepEqual(codes(src), []);
});

test("identity: a name inherited from an asset is the type's name, not a claim (the same product twice on one wall)", () => {
  const src = `asset W1 window w:1200 h:1100 name:掃き出し窓
${TWO_ROOMS}
boundary /L1/a /out t:150
  window W1 edge:S at:0.25
  window W1 edge:S at:0.75`;
  assert.deepEqual(codes(src), []);
  const m = parse(`${BASE}\n${src}`);
  const b = m.boundaries.find((x) => x.a === "/L1/a" && x.b === "/out")!;
  // 名は attrs に残る (正準JSONは変わらない) が、同一性の主張ではない
  assert.equal(String(b.openings[0]!.attrs["name"]), "掃き出し窓");
  assert.equal(openingIdentity(m, b.openings[0]!), undefined);
});

test("identity: a name written on the instance is a claim even when the asset carries one too", () => {
  const src = `asset W1 window w:1200 h:1100 name:掃き出し窓
${TWO_ROOMS}
boundary /L1/a /out t:150
  window W1 edge:S at:0.25 name:W-e
  window W1 edge:S at:0.75 name:W-e`;
  assert.deepEqual(codes(src), ["UID04"]);
});

// ---- (4b) 合成の側 — 曖昧な名では消さない ----

test("identity: drop column refuses an ambiguous name rather than removing both (ADR-0039)", () => {
  assert.throws(
    () =>
      build(`space /L1/a room X1..X2 Y1..Y2
column 600 L1 x:X1 name:C1
column 500 L1 x:X2 name:C1
drop column C1`),
    (e: unknown) => e instanceof SourceError && /not unique/.test(e.message),
  );
});

test("identity: drop column removes exactly the one declaration it names", () => {
  const m = build(`space /L1/a room X1..X2 Y1..Y2
column 600 L1 x:X1 name:C1
column 500 L1 x:X2 name:C2
drop column C1`);
  assert.deepEqual(m.columns.map((c) => String(c.attrs["name"])), ["C2"]);
});

// ---- (5) 名で対応づく差分 ----

const DIFF_BASE = `${TWO_ROOMS}
boundary /L1/a /L1/b t:120
  door w:780 h:2000 at:0.3 name:D1`;

test("diff: moving a named door is reported as that door moving, not as one vanishing and another growing", () => {
  const a = build(DIFF_BASE);
  const b = build(DIFF_BASE.replace("at:0.3", "at:0.7"));
  assert.deepEqual(renderDiff(semanticDiff(a, b)), ["± boundary /L1/a | /L1/b: door D1 at 0.3 → 0.7"]);
});

test("diff: an unnamed door still corresponds by position (the fallback is unchanged)", () => {
  const src = DIFF_BASE.replace(" name:D1", "");
  const a = build(src);
  const b = build(src.replace("at:0.3", "at:0.7"));
  const lines = renderDiff(semanticDiff(a, b));
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /\+ door at:0\.7/);
  assert.match(lines[0]!, /− door at:0\.3/);
});

test("diff: a named door that changes kind or edge is one door changing, not two", () => {
  const a = build(DIFF_BASE);
  const b = build(DIFF_BASE.replace("door w:780 h:2000 at:0.3", "window w:780 h:2000 at:0.3"));
  assert.deepEqual(renderDiff(semanticDiff(a, b)), ["± boundary /L1/a | /L1/b: window D1 kind door → window"]);
});

test("diff: the invariant holds for named openings too — identical canonical form, empty diff", () => {
  const a = build(DIFF_BASE);
  const b = build(`${TWO_ROOMS}
boundary /L1/a /L1/b t:120
  door name:D1 at:0.3 w:780 h:2000`);
  assert.equal(toCanonical(a), toCanonical(b));
  assert.deepEqual(renderDiff(semanticDiff(a, b)), []);
});

test("diff: duplicate names do not throw — a model that check rejects still diffs", () => {
  const src = `${TWO_ROOMS}
boundary /L1/a /out t:150
  window w:1200 h:1100 edge:S at:0.25 name:W1
  window w:1200 h:1100 edge:S at:0.75 name:W1`;
  const a = build(src);
  const b = build(src.replace("h:1100 edge:S at:0.75", "h:1300 edge:S at:0.75"));
  assert.ok(checkDiagnostics(a).some((d) => d.code === "UID04"));
  assert.doesNotThrow(() => renderDiff(semanticDiff(a, b)));
});
