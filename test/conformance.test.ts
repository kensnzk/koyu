// The conformance runner — the one koyu-aware piece of the suite.
//
// `conformance/` holds the definition of muro as input and expectation only; no case references a
// koyu function. This file is the thin layer that puts koyu forward as the implementation under
// test. Another implementation writes its own runner against the same directories, and the format
// contract is conformance/README.md — not this file.
//
// Three expectations, each on a frozen face:
//   canonical.json    byte-identical (the machine format promises bytes)
//   diagnostics.json  structurally equal, order included (the code/severity/provenance contract)
//   form.json         structurally equal (the derivation rules freeze the Form, not its spelling)
//
// `koyu validate` is deliberately out of scope: the validation surface is the one that grows, and a
// suite that grew with it would fail every other implementation each time a rule was added.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/core/diagnose.js";
import { derive } from "../src/core/derive.js";
import { SourceError, toCanonical } from "../src/core/model.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const CASES = join(root, "conformance", "cases");

interface About {
  pins: string[];
  why: string;
  /**
   * The case this one describes the same building as. **This is where muro differs from a schema** —
   * two different spellings collapse to one canonical form and one shape, and that collapse is the
   * claim. Naming the partner makes the pair explicit instead of leaving a reader to notice two
   * files that happen to expect the same bytes.
   *
   * **A single case can never pin an equivalence.** On its own it is a snapshot of whatever the
   * implementation does; only the pair says the two spellings mean one building.
   */
  sameBuildingAs?: string;
}

interface Case {
  name: string;
  dir: string;
  about: About;
  expects: {
    canonical?: string;
    diagnostics?: string;
    form?: string;
    parseError?: string;
  };
}

function load(): Case[] {
  const out: Case[] = [];
  for (const name of readdirSync(CASES).sort()) {
    const dir = join(CASES, name);
    if (!statSync(dir).isDirectory()) continue;
    const aboutPath = join(dir, "about.json");
    assert.ok(existsSync(aboutPath), `${name}: about.json is missing — every case says what it pins`);
    const about = JSON.parse(readFileSync(aboutPath, "utf8")) as About;
    assert.ok(existsSync(join(dir, "main.muro")), `${name}: main.muro is missing — the entry name is fixed`);
    const read = (f: string): string | undefined => {
      const p = join(dir, "expected", f);
      return existsSync(p) ? readFileSync(p, "utf8") : undefined;
    };
    out.push({
      name,
      dir,
      about,
      expects: {
        canonical: read("canonical.json"),
        diagnostics: read("diagnostics.json"),
        form: read("form.json"),
        parseError: read("parse-error.txt"),
      },
    });
  }
  return out;
}

const cases = load();

test("conformance: the suite is not empty (scaffolding so this file cannot pass in silence)", () => {
  assert.ok(cases.length >= 5, `too few cases: ${cases.length}`);
});

test("conformance: every case carries at least one expectation", () => {
  const bare = cases.filter((c) => Object.values(c.expects).every((v) => v === undefined));
  assert.deepEqual(bare.map((c) => c.name), [], "a case with no expectation tests nothing");
});

test("conformance: every case says which normative statement it pins", () => {
  const bad: string[] = [];
  for (const c of cases) {
    if (!Array.isArray(c.about.pins) || c.about.pins.length === 0) bad.push(`${c.name}: pins is empty`);
    if (typeof c.about.why !== "string" || c.about.why.trim() === "") bad.push(`${c.name}: why is empty`);
    for (const pin of c.about.pins ?? []) {
      const [page] = pin.split("#");
      if (!existsSync(join(root, page!))) bad.push(`${c.name}: pins a page that does not exist — ${page}`);
    }
  }
  assert.deepEqual(bad, [], `the ledger is broken:\n  ${bad.join("\n  ")}`);
});

for (const c of cases) {
  test(`conformance: ${c.name}`, () => {
    const entry = join(c.dir, "main.muro");

    if (c.expects.parseError !== undefined) {
      const want = c.expects.parseError.trim();
      assert.throws(
        () => parseFile(entry),
        (e: unknown) => {
          assert.ok(e instanceof SourceError, `${c.name}: an exception other than SourceError — ${String(e)}`);
          assert.ok(
            e.message.includes(want),
            `${c.name}: the message does not carry the expected text\n  want: ${want}\n  got : ${e.message}`,
          );
          return true;
        },
      );
      // A case that must not parse has nothing else to check — no model exists
      assert.equal(c.expects.canonical, undefined, `${c.name}: a parse-error case cannot also expect a canonical form`);
      assert.equal(c.expects.form, undefined, `${c.name}: a parse-error case cannot also expect a form`);
      return;
    }

    const model = parseFile(entry);

    if (c.expects.canonical !== undefined) {
      // **Bytes.** The format promises them, so anything weaker is not this test.
      assert.equal(toCanonical(model), c.expects.canonical, `${c.name}: the canonical JSON differs byte for byte`);
    }

    if (c.expects.diagnostics !== undefined) {
      // The absolute path of the entry differs per checkout, so provenance is compared by basename
      const got = checkDiagnostics(model).map((d) => ({
        ...d,
        ...(d.file !== undefined ? { file: d.file.split("/").pop() } : {}),
      }));
      assert.deepEqual(got, JSON.parse(c.expects.diagnostics), `${c.name}: the diagnostics differ`);
    }

    if (c.expects.form !== undefined) {
      assert.deepEqual(
        JSON.parse(JSON.stringify(derive(model))),
        JSON.parse(c.expects.form),
        `${c.name}: the derived Form differs`,
      );
    }
  });
}

// ---- Equivalence: different spellings, one canonical form ----

test("conformance: a case naming a partner describes the same building", () => {
  const byName = new Map(cases.map((c) => [c.name, c]));
  let checked = 0;
  for (const c of cases) {
    const partnerName = c.about.sameBuildingAs;
    if (partnerName === undefined) continue;
    const partner = byName.get(partnerName);
    assert.ok(partner, `${c.name}: sameBuildingAs names a case that does not exist — ${partnerName}`);
    assert.ok(
      c.expects.canonical !== undefined && partner.expects.canonical !== undefined,
      `${c.name} and ${partnerName}: both must expect a canonical form for the pairing to mean anything`,
    );
    assert.equal(
      c.expects.canonical,
      partner.expects.canonical,
      `${c.name} and ${partnerName} are declared equivalent, yet their expected canonical forms differ`,
    );
    // **And the shape too, when both carry one.** Byte-identical canonical forms with differing
    // shapes is exactly the break promise 1 forbids, so a pair that expects both must check both.
    if (c.expects.form !== undefined && partner.expects.form !== undefined) {
      assert.deepEqual(
        JSON.parse(c.expects.form),
        JSON.parse(partner.expects.form),
        `${c.name} and ${partnerName} are declared equivalent, yet their expected shapes differ`,
      );
    }
    // And the pairing is only worth writing if the two are spelled differently
    const spell = (x: Case) => readFileSync(join(x.dir, "main.muro"), "utf8");
    assert.notEqual(spell(c), spell(partner), `${c.name} and ${partnerName} are the same text — the pair proves nothing`);
    checked++;
  }
  assert.ok(checked >= 3, `too few equivalence pairs: ${checked}`);
});

// ---- The ledger: which normative statements are pinned ----

test("conformance: the ledger reports what it covers (a case that pins nothing new is still allowed)", () => {
  const byPage = new Map<string, string[]>();
  for (const c of cases) {
    for (const pin of c.about.pins) {
      const arr = byPage.get(pin) ?? [];
      arr.push(c.name);
      byPage.set(pin, arr);
    }
  }
  // Printed rather than asserted: coverage grows case by case, and a threshold here would either be
  // met trivially or block honest work. What must hold is that every pin resolves, which is above.
  const lines = [...byPage.entries()].sort().map(([pin, names]) => `  ${pin}\n      ${names.join(", ")}`);
  assert.ok(lines.length > 0, "no normative statement is pinned");
  console.log(`conformance covers ${byPage.size} normative statements with ${cases.length} cases:\n${lines.join("\n")}`);
});
