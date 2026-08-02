// The type position carries no meaning — the guarantee, held by machine.
//
// muro's type word is an open vocabulary, and for most of this language's life that
// openness was only half true. `exterior` and `void` sat in the same slot as `room`
// and `厨房`, so a one-character slip turned a building inside out while `check` stayed
// green: `exteriorr` measured 32.40 m2 where `exterior` measured 16.20. The guard put
// over that was a spelling heuristic across two words — which is what a missing rule
// looks like when you patch it instead of fixing it. It could not be widened either,
// because `road` and `wood` sit within edit distance 2 of `void` and both are words a
// person may legitimately write.
//
// Structure now lives in the ledger (`outside:` / `void:`), where an unknown key is an
// error and a namespace is how an author declares a word the tool must not read. The
// documentation's promise — that no verdict turns on how a type is spelled — is finally
// something core can keep, and this file is what keeps it.
//
// The first test is the acceptance criterion for that whole change. Core and drawing may
// still carry the type word forward — a label, a column in `stats`, lettering on a plan —
// but they may never branch on it.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { isIndoor } from "../src/core/model.js";
import { parse } from "../src/core/parse.js";
import { ATTR_LEDGER, attrSpec } from "../src/core/vocabulary.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Reading the word is fine, and so is comparing two of them (`diff` reports that a type
 * changed without caring which). What may not happen is a decision taken from a literal.
 */
const BRANCHES_ON_TYPE = [
  /\.type\s*[!=]==\s*["'`]/,
  /["'`]\s*[!=]==\s*[A-Za-z_$][\w$]*\.type\b/,
  /\.(?:has|includes)\(\s*[A-Za-z_$][\w$]*\.type\s*\)/,
];

// The readers that survive, named here so a third one cannot arrive unnoticed.
//
// Both are version-gated migration diagnostics: they read the OLD spelling in order to
// refuse a file written in it, and neither decides anything about what a model means.
// VER02 tells the author of a pre-0.4 file that five type words used to imply daylight.
// VER05 tells the author of a pre-1.1 file that `exterior`/`void` in the type position
// have stopped meaning anything — the very reading this change removed, kept alive for
// exactly as long as it takes to say so.
const ALLOWED = new Set([
  'src/core/diagnose.ts: if (s.type === undefined || !LEGACY_DAYLIT.has(s.type) || s.attrs["daylight"] !== undefined) continue;',
]);

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsFiles(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

test("vocabulary: nothing in core or drawing decides anything from the type word", () => {
  const offenders: string[] = [];
  for (const dir of ["src/core", "src/draw"]) {
    for (const file of tsFiles(join(root, dir))) {
      const rel = relative(root, file);
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!BRANCHES_ON_TYPE.some((re) => re.test(line))) return;
          if (ALLOWED.has(`${rel}: ${line.trim()}`)) return;
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "the type position is an open vocabulary, so a word read out of it is a word whose spelling nothing guards.\n" +
      "Structure belongs in the ledger, where an unknown key is an error:\n" +
      offenders.join("\n"),
  );
});

test("vocabulary: the ledger carries the two structural facts, and closes their values", () => {
  for (const key of ["outside", "void"]) {
    const spec = attrSpec("space", key);
    assert.ok(spec, `${key} is missing from the space ledger`);
    assert.deepEqual(spec.of, [0, 1], `${key} takes 0 or 1 and nothing else`);
  }
  // They are facts about a space, never about anything else.
  for (const elem of Object.keys(ATTR_LEDGER)) {
    if (elem === "space") continue;
    assert.equal(attrSpec(elem, "outside"), undefined, `outside must not be writable on ${elem}`);
    assert.equal(attrSpec(elem, "void"), undefined, `void must not be writable on ${elem}`);
  }
});

const TWO_ROOMS = `koyu 1.1
grid X 0 3000 6000
grid Y 0 4000
level L1 0 h:2700
`;

test("vocabulary: a misspelt structural key is an error, and the ledger is what catches it", () => {
  const diags = checkDiagnostics(parse(TWO_ROOMS + `space /L1/a room X1..X2 Y1..Y2 outsid:1\n`));
  const att03 = diags.filter((d) => d.code === "ATT03");
  assert.equal(att03.length, 1, "an unknown key with no namespace is an error — this is the hole the heuristic could not close");
  assert.equal(att03[0]!.severity, "error");

  // A value outside the domain is caught too, by the same ledger.
  const bad = checkDiagnostics(parse(TWO_ROOMS + `space /L1/a room X1..X2 Y1..Y2 void:2\n`));
  assert.equal(bad.filter((d) => d.code === "ATT02").length, 1, "void takes 0 or 1");

  // And the author's own word still costs nothing, as long as it is declared as theirs.
  const mine = checkDiagnostics(parse(TWO_ROOMS + `space /L1/a room X1..X2 Y1..Y2 acme.outsid:1\n`));
  assert.deepEqual(mine.filter((d) => d.severity === "error"), [], "a namespaced key is the author saying the tool must not read it");
});

test("vocabulary: floor area follows the declaration, and no longer follows a spelling", () => {
  const model = parse(
    TWO_ROOMS +
      `space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2 void:1
space /out/road outside:1 road:4000
`,
  );
  const indoor = [...model.spaces.values()].filter((s) => isIndoor(model, s)).map((s) => s.path);
  assert.deepEqual(indoor, ["/L1/a"], "a void has no floor and an outside is not in the building");

  // The point of the whole change: mistyping the *type* can no longer move an area,
  // because no area was ever reading the type.
  const typo = parse(
    TWO_ROOMS +
      `space /L1/a rooom X1..X2 Y1..Y2
space /L1/b whatever X2..X3 Y1..Y2 void:1
space /out/road nonsense outside:1 road:4000
`,
  );
  assert.deepEqual(
    [...typo.spaces.values()].filter((s) => isIndoor(typo, s)).map((s) => s.path),
    indoor,
    "the type word is a label; changing it must not move a single square metre",
  );
});

// ---- The version boundary ----
//
// Moving the two words out of the type position changed what a file MEANS. A file written
// before the move, left untouched, derives a different building under the new code: its
// exteriors become indoor floor area and its voids grow floors. Measured on the mixed-use
// example, 31,606.24 m2 -> 33,004.00 m2, and `check` was green throughout.
//
// That is the same silent reinterpretation this whole change was written to remove, so the
// language version had to move with it and VER05 has to stop the old spelling. The corpus
// migration is byte-identical, so nothing else in the suite exercises a pre-1.1 file — this
// is the only thing standing between an old file and a wrong building.

const LEGACY = `koyu 1.0
grid X 0 3000 6000
grid Y 0 4000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L2/hole void X2..X3 Y1..Y2 level:L1
space /out exterior name:外部 road:4000
`;

test("vocabulary: a pre-1.1 file writing the retired spelling is refused, and told both ways out", () => {
  const diags = checkDiagnostics(parse(LEGACY));
  const ver05 = diags.filter((d) => d.code === "VER05");
  assert.equal(ver05.length, 2, "one per space that would silently change meaning");
  assert.deepEqual([...new Set(ver05.map((d) => d.severity))], ["error"], "silent is why it is an error, not a warning");
  assert.match(ver05.map((d) => d.message).join("\n"), /Write outside:1 instead, then raise the version to koyu 1\.1/);
  assert.match(ver05.map((d) => d.message).join("\n"), /Write void:1 instead/);
});

test("vocabulary: the same boundary is watched from the other side", () => {
  // A 1.1 word in a 1.0 file: an older processor refuses it, so the versions must agree.
  const forward = checkDiagnostics(parse(LEGACY.replace("space /out exterior name:外部 road:4000", "space /out name:外部 road:4000 outside:1")));
  assert.ok(forward.some((d) => d.code === "VER05" && /carries outside:/.test(d.message)));
  // and omitting the type is 1.1 spelling too
  const untyped = checkDiagnostics(parse("koyu 1.0\ngrid X 0 3000\ngrid Y 0 4000\nlevel L1 0 h:2700\nspace /L1/a X1..X2 Y1..Y2\n"));
  assert.ok(untyped.some((d) => d.code === "VER05" && /no type/.test(d.message)));
});

test("vocabulary: raising the version is the other way out, and it silences all of it", () => {
  const raised = checkDiagnostics(
    parse(LEGACY.replace("koyu 1.0", "koyu 1.1")),
  ).filter((d) => d.code === "VER05");
  assert.deepEqual(raised, [], "a 1.1 file may spell exterior in the type position — it is just a label there");
});
