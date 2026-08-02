// 既定境界・uid・言語版 (ADR-0014 / 0015 / 0017) — 水平の「既定は壁」、
// 不透明な同一性トークン、版の受理条件 (旧版は意味保存の場合のみ)。

import assert from "node:assert/strict";
import { test } from "node:test";
import { check } from "../src/core/diagnose.js";
import { deriveDefaultBoundaries, doorsBetween, neighbors } from "../src/core/graph.js";
import { SourceError, toCanonical } from "../src/core/model.js";
import { parse, parseFiles } from "../src/core/parse.js";
import { svgPlan } from "../src/draw/plan.js";

const BASE = [
  "koyu 0.4",
  "unit mm",
  "grid X 0 4000 8000",
  "grid Y 0 4000 8000",
  "level L1 0 h:2400 slab:150",
].join("\n");

const ROOMS = "space /L1/a hall X1..X2 Y1..Y2\nspace /L1/b hall X2..X3 Y1..Y2";

// ---- 既定境界 (ADR-0014) ----

test("default boundary: an explicit bare wall declaration and its omission mean the same thing (SVG, doors and neighbors agree)", () => {
  const verbose = parse(`${BASE}\n${ROOMS}\nboundary /L1/a /L1/b`);
  const slim = parse(`${BASE}\n${ROOMS}`);
  assert.equal(svgPlan(slim, { level: "L1" }), svgPlan(verbose, { level: "L1" }));
  assert.equal(doorsBetween(slim, "/L1/a", "/L1/b"), doorsBetween(verbose, "/L1/a", "/L1/b"));
  assert.equal(neighbors(slim, "/L1/a").length, neighbors(verbose, "/L1/a").length);
  // 正準JSONは書かれた構成のみ — 既定境界は出ない (意味は導出後のModelが持つ)
  assert.match(toCanonical(verbose), /"between"/);
  assert.doesNotMatch(toCanonical(slim), /"between"/);
});

test("default boundary: nothing is derived for a pair that carries a declaration (an edge-restricted one suppresses it too)", () => {
  const m = parse(`${BASE}\n${ROOMS}\nboundary /L1/a /L1/b edge:E t:200`);
  assert.equal(m.boundaries.filter((b) => b.derived).length, 0);
});

test("default boundary: derivation is idempotent", () => {
  const m = parse(`${BASE}\n${ROOMS}`);
  const n = m.boundaries.length;
  deriveDefaultBoundaries(m);
  assert.equal(m.boundaries.length, n);
});

test("default boundary: it works between spaces with no level determined too (the same predicate as the old warning)", () => {
  const m = parse(`${BASE}\nspace /misc/a room X1..X2 Y1..Y2\nspace /misc/b room X2..X3 Y1..Y2`);
  assert.equal(m.boundaries.filter((b) => b.derived).length, 1);
});

test("default boundary: no boundary is derived against a space with no region (exterior) — it stays declaration-only", () => {
  const m = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2\nspace /out outside:1`);
  assert.equal(m.boundaries.length, 0);
});

// ---- 言語版 (ADR-0017) ----

test("version: 0.1 is accepted only where the meaning is preserved — a file in which derivation happens is an error", () => {
  const src = (v: string) => `koyu ${v}\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\n${ROOMS}`;
  const old = check(parse(src("0.1")));
  assert.equal(old.errors.length, 1);
  assert.match(old.errors[0]!, /raise the version to koyu 0\.2/);
  assert.deepEqual(check(parse(src("0.2"))).errors, []);
});

test("version: a 0.1 file in which no derivation happens is accepted as it stands", () => {
  const m = parse(`koyu 0.1\nunit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\n${ROOMS}\nboundary /L1/a /L1/b`);
  assert.deepEqual(check(m).errors, []);
  assert.equal(m.version, "0.1");
});

test("version: omitting the declaration means the latest semantics (a default boundary is derived and it is not an error)", () => {
  const m = parse(`unit mm\ngrid X 0 4000 8000\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\n${ROOMS}`);
  assert.equal(m.version, "1.1");
  assert.equal(m.boundaries.filter((b) => b.derived).length, 1);
  assert.deepEqual(check(m).errors, []);
});

test("version: declaring it in an import layer is an error (the base layer only)", () => {
  assert.throws(
    () =>
      parseFiles(
        {
          "main.muro": "koyu 0.2\nunit mm\ngrid X 0 4000\ngrid Y 0 4000\nlevel L1 0 h:2400 slab:150\nimport ./sub.muro\n",
          "sub.muro": "koyu 0.2\nspace /L1/a hall X1..X2 Y1..Y2\n",
        },
        "main.muro",
      ),
    /declared only in the base layer \(the entry\)/,
  );
});

// ---- uid (ADR-0015) ----

test("uid: a well-formed opaque token raises no error and is preserved in canonical JSON", () => {
  const m = parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:sp-x7k2\nzone /L1 uid:un-01`);
  assert.deepEqual(check(m).errors, []);
  assert.match(toCanonical(m), /"uid": "sp-x7k2"/);
});

test("uid: a digits-only form is an error (0123 becomes 123 and the distinction is lost)", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:123`));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /A uid cannot be a token of digits alone/);
});

test("uid: a form containing whitespace is an error", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:"a b"`));
  assert.match(r.errors.join("\n"), /A uid cannot contain whitespace/);
});

test("uid: a duplicate is one error per uid listing every owner (copies from span expansion are visible too)", () => {
  const src = `koyu 0.2
unit mm
grid X 0 4000 8000
grid Y 0 4000
level L1 0
level L2 3000
space /L1..L2/a room X1..X2 Y1..Y2 uid:sp-dup`;
  const r = check(parse(src));
  const dup = r.errors.filter((e) => e.includes("Duplicate uid"));
  assert.equal(dup.length, 1);
  assert.match(dup[0]!, /space \/L1\/a/);
  assert.match(dup[0]!, /space \/L2\/a/);
});

test("uid: a duplicate across space and zone is an error too", () => {
  const r = check(parse(`${BASE}\nspace /L1/a room X1..X2 Y1..Y2 uid:x1\nzone /L1 uid:x1`));
  assert.match(r.errors.join("\n"), /Duplicate uid: x1/);
});

// ---- 値域は宣言の経路でも効く ----
//
// The ledger requires a positive number of the keys that stay in the attribute bag, and ATT01 says
// so. A key lifted into a typed field never reaches ATT01, so the same promise held on the `over`
// path and not on the declaration: `level L1 0 h:-2400` went green and put a negative ceiling
// height into the canonical JSON, inverting floor and ceiling.

const POSITIVE_ON_DECLARATION: Array<[string, string]> = [
  ["level h", "level L1 0 h:-2400 slab:150"],
  ["level slab", "level L1 0 h:2400 slab:-150"],
  ["level slab zero", "level L1 0 h:2400 slab:0"],
];

for (const [what, decl] of POSITIVE_ON_DECLARATION) {
  test(`value range: ${what} is refused on the declaration, not only through over`, () => {
    assert.throws(
      () => parse(["koyu 1.1", "grid X 0 3000", "grid Y 0 3000", decl, "space /L1/a room X1..X2 Y1..Y2"].join("\n")),
      (e: unknown) => e instanceof SourceError && /is written as a positive number/.test(e.message),
      what,
    );
  });
}

test("value range: a negative wall thickness and a negative opening height are refused on the declaration", () => {
  const base = [
    "koyu 1.1",
    "grid X 0 3000 6000",
    "grid Y 0 3000",
    "level L1 0 h:2400 slab:150",
    "space /L1/a room X1..X2 Y1..Y2",
    "space /L1/b room X2..X3 Y1..Y2",
  ];
  assert.throws(
    () => parse([...base, "boundary /L1/a /L1/b t:-100"].join("\n")),
    (e: unknown) => e instanceof SourceError && /t is written as a positive number/.test(e.message),
    "boundary t",
  );
  assert.throws(
    () => parse([...base, "boundary /L1/a /L1/b", "  window w:900 h:-2100"].join("\n")),
    (e: unknown) => e instanceof SourceError && /h is written as a positive number/.test(e.message),
    "opening h",
  );
  // A positive value still passes — the check is not simply refusing the key
  assert.deepEqual(check(parse([...base, "boundary /L1/a /L1/b t:120"].join("\n"))).errors, []);
});
