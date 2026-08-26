// The meaning of every bundled building, pinned across the 0.18.0 surface cutover.
//
// The whole public API moved in 0.18.0 — entry points, the validation contract, the CLI. None of
// that was supposed to change what a `.muro` file *means*. These hashes were taken from the
// implementation at `v0.17.0`, before any of it was touched. Every re-baselining since is written
// out below, with what it moved and what it left standing.
//
// A failure here is therefore never "update the hash" on its own. It is a bug, or a language
// change, or a deliberate change to the rules of derivation — and the last two need their own
// decision recorded and their own version moved before the table is rewritten.
//
// **The two columns do not fail for the same reasons.** The canonical hash also moves when the
// *format* version moves, because `koyu-canonical/x.y` is the first key of every document and so
// sits inside the bytes — that is a change of spelling, not of meaning, and it moves every example
// at once. **The Form hash is the shape**, and it moves only when the shape really moved: because
// the building was edited, because the language reads it differently, or because a rule of the
// derivation was deliberately changed. So: every canonical hash moved and no Form hash did is a
// format bump; one canonical hash moved is that example being edited; **Form hashes moving while
// every canonical hash stands still is the derivation being changed, and it has to be able to name
// the rule.**
//
// Earlier canonical re-baselines include two under ADR-0057: once for every
// example, when `koyu-canonical/1.1` became `1.2`; and once for `tower` alone, when it was given
// an `origin` and an `azimuth`. Another was `1.2` becoming `2.0`, when the version key was
// renamed from `koyu` to `muro` — the key names the language, and the language is muro. **A
// renamed key is a major**, which is the rule that decides the number and was the one thing the
// change first got wrong.
//
// **The Form column was not touched by any of those** — not by a format bump, not by tower
// gaining a frame, and not by muro 1.3. That is the machine's proof that neither the frame nor the
// spelling of a key reaches the meaning of a building. The format change was measured the
// same way: every canonical hash moved and no Form hash did, which is the
// signature of a format bump and of nothing else.
//
// The muro 1.3 re-baseline retires `use` (ADR-0061), and it is the first where the
// examples themselves were edited rather than re-spelled: the version line moved to `muro 1.3`
// and `use:` declarations became `lease.category:`, with redundant `use:parking` values dropped
// because the type position already said `parking` or `ramp`. It reads:
//
//   canonical moved  — exactly the entries that were edited
//   canonical held   — steps/01 to steps/05, which write no version line and no `use:`
//   Form held        — every entry
//
// **Both halves are load-bearing.** The tutorial stages that held are the promise of stability.md measured
// rather than asserted: retiring a key changes nothing for a file that does not write it, down to
// the byte. The Form column says the edited examples did not change either — declarations were
// rewritten and no building became a different building.
//
// **A later re-baseline is the first that moves the Form column, and it is the derivation
// moving, not the language.** Walls were thickened about their centre lines and left there, so the
// corner of every junction belonged to neither of the two walls that met at it — four holes in
// `examples/two-rooms.muro` and many more in `examples/complex`. The join is now derived, and the body of
// every wall that meets another moved with it. It reads:
//
//   canonical held   — every entry
//   Form moved       — every example in which two walls meet
//   Form held        — steps/01, one room with no boundary written, so no wall at all
//
// **A canonical column that did not move by a byte is what says this was not the language.** No
// source text is read differently; what changed is what koyu derives from the same reading, and
// the rules of derivation are a surface of their own (docs/reference/stability.md). The one
// example that held is the measurement of that claim rather than the assertion of it: an example
// with no wall in it cannot have a wall junction, and it did not move.
//
// **The muro 1.4 re-baseline inverts the exterior default (ADR-0065)**, and it moves
// both columns for different reasons — the first that does. Up to 1.3 a face onto the outside got
// no wall unless a `boundary` to a region-less space was written; from 1.4 it is a wall, and what
// a declaration adds is the name of what it faces. It reads:
//
//   canonical moved  — the entries carrying a version line, `muro 1.3` → `1.4`
//   canonical held   — steps/01 to steps/05, which write none
//   Form moved       — steps/01 to steps/03, and nothing else
//   Form held        — every finished building among them
//
// **The Form column is the whole measurement.** A rule of derivation changed, and the shape of
// the complete buildings — including the largest bundled examples — did not move by a
// byte. It could not: every one of them had already written a boundary to the exterior for every
// run of every perimeter, so there was nothing left for the new default to do. The entries that
// moved were the first stages of the tutorial, where the outside has not
// been reached yet. That split is the claim of this change measured rather than asserted: **it
// fills holes and touches nothing else.**
//
// **The muro 1.5 re-baseline adds explicit opening operations (ADR-0068).** Entry files that
// declare the newest version move in the canonical column because that declaration is part of the
// bytes. Early tutorial stages still omit it and hold. The only Form change is that
// `examples/house/main.muro` changes its gate asset from the generic `hinged` operation to the
// explicit `gate-hinged` operation, adding that source fact and no building geometry.
//
// **The following re-baseline completes those opening operations before muro 1.5 ships.** Existing
// vehicle shutters become `rolling-shutter`; a full-height bypass sash becomes `sliding-bypass`;
// and an automatic entrance is narrowed to fit its supporting boundary. The opening names touched
// by that migration are brought into the repository's English authoring policy at the same time.
// Their canonical bytes and derived opening classifications therefore move deliberately under
// ADR-0070 and ADR-0071.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** entry → [canonical SHA-256, Form SHA-256]. Both columns were first measured at v0.17.0 */
const BASELINE: Readonly<Record<string, readonly [string, string]>> = {
  "examples/basement/main.muro": [
    "512ec4f111ab198ea2c535b0915ae3d481d004f66a32f0ae5cd26a17dc0271e2",
    "59218b0ade72ad7e0a2aceaecd0bf5436b3f5179b926edf15e80a4ec6e713267",
  ],
  "examples/complex/main.muro": [
    "9203736964ad9cac777669e34b5d4f30a7b45c84e9ad26e3b36db3900342999f",
    "fd2b7d42a0302c5e9105372083cf17d32859af56bf3a04b8da1b7add79246c63",
  ],
  "examples/house.muro": [
    "3103848fd20b80488150c656b754cb4e86bbca95832e9121a8296ed7a85a5c9d",
    "117adedc87618c09829426144f6a7d3bb8f823247ebbb243384da32091381719",
  ],
  "examples/house/main.muro": [
    "9943f3e1829d6281202c3cc99b1e0d8ad58ed8bf17ea638d05f59fb557335b53",
    "9ef24d4ba338fd686f5fd930f1d551c21430cbe82fe7c6289f6a7a7e2c6ecf7c",
  ],
  "examples/mansion.muro": [
    "940feb7445bd735187762299af54678b7161ea3a6acaaa703befcb8bf1b0152a",
    "53b9d694943de361bf38aed492d9d3631bc74d58063d27dc89684a102aaa21f9",
  ],
  "examples/office.muro": [
    "801ba29698cd84bc20687434e5e8ed1eac51e0ca87c7a11ab3aa255fa8900bb9",
    "bf576da70f00e9a9ecd0c47003ea4305f78dd36dffcaf5d9660a7bf1507f230d",
  ],
  "examples/steps/01-one-room.muro": [
    "4c23e5f10c4b43bb8dacd5220d6e3c7035bd79bb2f8a205f07bcb23f54e85b8d",
    "b8148f51ee516aa52cdb5d13052040d2376f60585b60fb0dade84ec08f9e5206",
  ],
  "examples/steps/02-two-rooms.muro": [
    "6a192e4647735d60491423954f17a1703718e974815529e7543abbf1001606fc",
    "520a01479190682491a89a878c081fe111c576560ad7c8b4d322d4d214c5a447",
  ],
  "examples/steps/03-door.muro": [
    "5a167a7ea8a494f15a624e19adeb8a26f52b6cdbb78a03b9f124e219f431ece7",
    "bcc79f27bcb338b1f2feb2830e0cef9cbdb563d40f659b7a7c611d8283a9bb0f",
  ],
  "examples/steps/04-exterior.muro": [
    "f142dae8a784453a203fc6a05b8182efbcf67ff478c1b20f659275024ff97a04",
    "6d6a27e32edf34c5f730c6f5499f4efc6780563bcae6f869f8162e8a86ad1ac0",
  ],
  "examples/steps/05-two-storeys.muro": [
    "10caf349b98e9afc9576d121558b06b00666f94e587d6efba953197470fe0b20",
    "8aef74f5c6400d692306518a073962a7a6e665d4a7edb3f4eb95e87f020fd0d4",
  ],
  "examples/steps/06-finished.muro": [
    "e545a38b20af34a7f0b07117ba6d274875a058ab5fecfd5ebbb9be75d44d2e9c",
    "5f69ba97dd01265285264f0719e3a89c3fadaa4de67fac4270c15f950643824c",
  ],
  "examples/tower/main.muro": [
    "114d14b85d3ed85daa75e8b9e0eb14573db83b4f300d270630d93d984c12a7c6",
    "da635b8160be13f6a9bd58d80f29b1a69b664b2026e692643e902b307850c168",
  ],
  "examples/twin/main.muro": [
    "8f828ce2fc1ea13dc6d0086a612df3f08e30dc3ae2bc12a02ef9ccbe8ea68210",
    "482e4623c55e5b0c77dde6dfc21f0d015818292f83636f1332f088f42d6278d1",
  ],
  "examples/two-rooms.muro": [
    "6eefd6aa530b05030c44ed294cf02373199d89837131f83835e3224b6dedc4c1",
    "2c5e83dff741982db524c603411f05bdda2eb7b17ec7131488d281f79f6debb2",
  ],
};

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

test("meaning is preserved: every bundled example keeps its pinned canonical and Form hash", () => {
  const moved: string[] = [];
  for (const [entry, [canonical, form]] of Object.entries(BASELINE)) {
    const model = parseFile(`${root}${entry}`);
    const actualCanonical = sha256(toCanonical(model));
    const actualForm = sha256(JSON.stringify(derive(model)));
    if (actualCanonical !== canonical) moved.push(`${entry}: canonical ${canonical} → ${actualCanonical}`);
    if (actualForm !== form) moved.push(`${entry}: Form ${form} → ${actualForm}`);
  }
  assert.deepEqual(
    moved,
    [],
    "the meaning of a bundled example moved during an API change:\n" + moved.join("\n") +
      "\nThis is not a hash to update — either it is a bug, or the language version must move.",
  );
});

test("the fingerprint table covers every bundled entry", () => {
  // Entry files are root examples, tutorial steps, and main.muro in a composed example directory.
  // Derive that inventory from the filesystem: a hand-written total would drift with the examples.
  const examples = join(root, "examples");
  const entries: string[] = [];
  for (const entry of readdirSync(examples, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".muro")) {
      entries.push(`examples/${entry.name}`);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name === "steps") {
      for (const step of readdirSync(join(examples, entry.name))) {
        if (step.endsWith(".muro")) entries.push(`examples/steps/${step}`);
      }
      continue;
    }
    if (existsSync(join(examples, entry.name, "main.muro"))) entries.push(`examples/${entry.name}/main.muro`);
  }
  assert.deepEqual(Object.keys(BASELINE).sort(), entries.sort());
});
