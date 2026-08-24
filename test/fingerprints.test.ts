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
    "de503c349cda3dadb53daf6f090b7875910b68e3b44497b47fc4f24afe5febf9",
    "ec6c647018cb1a14713d3a771b6dc0f32b6f2c3b782cf40fe78c9a8a150167ba",
  ],
  "examples/complex/main.muro": [
    "6d8636c92320b8e29b2ceb6080052f606106db4d6e9f2edbf22c0412f0aea788",
    "946a452b02bf467081804f089eab4db72f3002ae5a8b13a955c5027ba7df17f0",
  ],
  "examples/house.muro": [
    "2cb24dac4057631da0f04a6bca80133d09025e7fec39d27c08d369dd60c7e785",
    "26145386b412fe7a6cfa041493c3371c7190f7a0ea9c6616df95ae489a591ccb",
  ],
  "examples/house/main.muro": [
    "c183b5311af03bbcab8897d0725d688031bc9a432630232629cd54284930a6b7",
    "2eaf9e454f0b1d91bb481f75dbc56f17ce81f21fceecae1b1b623fb5dbbc8974",
  ],
  "examples/mansion.muro": [
    "262cab7db9670a83f006e307904057b2bf46189947988c64a821a5c2b57318d7",
    "c5afa884e909bce64ab64277e00af6af617de420be5c6a71917b1dcd227dcb43",
  ],
  "examples/office.muro": [
    "2434e7f640357f33057b1b556cf4bc811305c84d7c75ff22cf153231b0e8d179",
    "7cf1f4c1fe0aa53033118cac9f596a2913cf37e006f403259563f5e5d244e697",
  ],
  "examples/steps/01-one-room.muro": [
    "4c23e5f10c4b43bb8dacd5220d6e3c7035bd79bb2f8a205f07bcb23f54e85b8d",
    "f01644d2096c620c63dc5fd3c30199bce6640ffc3a5bfbb141ed0695528547fd",
  ],
  "examples/steps/02-two-rooms.muro": [
    "6a192e4647735d60491423954f17a1703718e974815529e7543abbf1001606fc",
    "0eba0fb048f90f098fa5875fe2c8127df8d68e01c74e9ecb3745771dcbe4e31a",
  ],
  "examples/steps/03-door.muro": [
    "5a167a7ea8a494f15a624e19adeb8a26f52b6cdbb78a03b9f124e219f431ece7",
    "19381f8a3bcb2e5c86cac2431cc81ebeac190dc87794ffe63712b2f8193d326d",
  ],
  "examples/steps/04-exterior.muro": [
    "d8ad1921e9c9b9f68ff723f3be532a24ec0b23439c9e436de17b2d5cb9827045",
    "c04f165ece16a62be10f4293fbb1b948e63ef9b29ef4b1951a079ccbcdee2297",
  ],
  "examples/steps/05-two-storeys.muro": [
    "f93bed0140c709240db501e08b5c4a9dd1863fa6e50e4a81e7ac5b485b5b96a5",
    "d4c0a82880f05d127f92948247121b3df1a1a599527690240f7b0ca24c91aace",
  ],
  "examples/steps/06-finished.muro": [
    "4f12540a116abb11af8f300f0e0f86119a9912afa2801e5ed8640bdbc9086817",
    "433b74d5b0ccffb19bce6cc415375236f8e33ecfa9b4139d328a64138e41adc6",
  ],
  "examples/tower/main.muro": [
    "7fb7eb0f02ee5c8352fb70ff1030a68638acca727694360b687cbfe3c4b60800",
    "f7e0e47145a555da4cb2ff38a888c473771d19059a637a257c2771ec38b04702",
  ],
  "examples/twin/main.muro": [
    "23f33d4af5dd629940f3c74e424550764142bc1727573903d41ae11694783448",
    "bfbbfccdba79a58b72f73344de02ecce17fe12b06a136464baad7aed2c92a69e",
  ],
  "examples/two-rooms.muro": [
    "f5a3ca851da8a50f55b770166fbb7f6d48fdad680573f2c5bb99a2c3f67a4876",
    "642a6ecea5c4b05f14b14c9a38a6dc44a2b2e808a468b6867eb57471566aa08a",
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
