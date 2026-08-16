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
// The canonical column has been re-baselined three times. Twice under ADR-0057: once for every
// example, when `koyu-canonical/1.1` became `1.2`; and once for `tower` alone, when it was given
// an `origin` and an `azimuth`. The third was `1.2` becoming `2.0`, when the version key was
// renamed from `koyu` to `muro` — the key names the language, and the language is muro. **A
// renamed key is a major**, which is the rule that decides the number and was the one thing the
// change first got wrong.
//
// **The Form column was not touched by any of those** — not by either format bump, not by tower
// gaining a frame, and not by muro 1.3. That is the machine's proof that neither the frame nor the
// spelling of a key reaches the meaning of a building. The third re-baselining was measured the
// same way: all 15 canonical hashes moved and none of the 15 Form hashes did, which is the
// signature of a format bump and of nothing else.
//
// The fourth re-baselining is muro 1.3 retiring `use` (ADR-0061), and it is the first where the
// examples themselves were edited rather than re-spelled: the version line moved to `muro 1.3`
// and 375 `use:` declarations became `lease.category:`, with the ten `use:parking` dropped
// because the type position already said `parking` or `ramp`. It reads:
//
//   canonical moved  10 of 15   — exactly the ten entries that were edited
//   canonical held    5 of 15   — steps/01 to steps/05, which write no version line and no `use:`
//   Form moved        0 of 15
//
// **Both halves are load-bearing.** The five that held are the promise of stability.md measured
// rather than asserted: retiring a key changes nothing for a file that does not write it, down to
// the byte. The zero says the other ten did not change either — 375 declarations rewritten across
// 30 files, and not one building became a different building.
//
// **The fifth re-baselining is the first that moves the Form column, and it is the derivation
// moving, not the language.** Walls were thickened about their centre lines and left there, so the
// corner of every junction belonged to neither of the two walls that met at it — four holes in
// `examples/two-rooms.muro`, 206 in `examples/complex`. The join is now derived, and the body of
// every wall that meets another moved with it. It reads:
//
//   canonical moved   0 of 15
//   Form moved       14 of 15   — every example in which two walls meet
//   Form held         1 of 15   — steps/01, one room with no boundary written, so no wall at all
//
// **A canonical column that did not move by a byte is what says this was not the language.** No
// source text is read differently; what changed is what koyu derives from the same reading, and
// the rules of derivation are a surface of their own (docs/reference/stability.md). The one
// example that held is the measurement of that claim rather than the assertion of it: an example
// with no wall in it cannot have a wall junction, and it did not move.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** entry → [canonical SHA-256, Form SHA-256]. Both columns were first measured at v0.17.0 */
const BASELINE: Readonly<Record<string, readonly [string, string]>> = {
  "examples/basement/main.muro": [
    "2ce1f5afc315503647a60500adaf153b51b4c68378632f612579e248e062a56e",
    "1fa571a563ca4bcb66fe8b718f17ba81898230bc6357ac85bbc4630e420a406c",
  ],
  "examples/complex/main.muro": [
    "d7cadb3af7574a8b61335e22ef636c4b3c2ed694be26156f3568a8f88bec1a2f",
    "d1d2cb12161f84b55663a046dd60b717605962ccbb3ff235fe208ea091df8166",
  ],
  "examples/house.muro": [
    "e698001d4e0a71817b9ccdd632b2be6f27075e5170702b0a78bf2abc8ca2c9b8",
    "4c0bc4acf1c2b62889de980c60b80222d5debdc24f1f5613a81016307516ebd4",
  ],
  "examples/house/main.muro": [
    "ee9709b23d22aa86d28bdd28af41af7acbdd985c1e210d7ef86d46577f9f100a",
    "9622d2a0f166f76dadb809df0769101c33a5a05e699aa1c47c8c84c377d17393",
  ],
  "examples/mansion.muro": [
    "d1703cd5d47f3cf2e0bffd84a3597ad597150b3c125be34a327242404cc791f9",
    "c5afa884e909bce64ab64277e00af6af617de420be5c6a71917b1dcd227dcb43",
  ],
  "examples/office.muro": [
    "850d5351073d5c0d41bf54bbfbc516a410f92e9a94f940b29873d31d8e46b9be",
    "7cf1f4c1fe0aa53033118cac9f596a2913cf37e006f403259563f5e5d244e697",
  ],
  "examples/steps/01-one-room.muro": [
    "4c23e5f10c4b43bb8dacd5220d6e3c7035bd79bb2f8a205f07bcb23f54e85b8d",
    "9fb0d7fb5374ca8e1b98d38761f34df3d44e812ba8420a38286b6951c5f8f39f",
  ],
  "examples/steps/02-two-rooms.muro": [
    "6a192e4647735d60491423954f17a1703718e974815529e7543abbf1001606fc",
    "5029df9c9fc19b19edb6ca37e2c3ce0ac9edf8a67bc3810f66f68b942c72b4ef",
  ],
  "examples/steps/03-door.muro": [
    "5a167a7ea8a494f15a624e19adeb8a26f52b6cdbb78a03b9f124e219f431ece7",
    "b9c48cc0a8644a10c79631ff423121787003a979d69eb4da531d28b44110b869",
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
    "69f901ffda67c04f9c64c4b9388df4335cb0642ddf98cd1add124db6100e2c7f",
    "433b74d5b0ccffb19bce6cc415375236f8e33ecfa9b4139d328a64138e41adc6",
  ],
  "examples/tower/main.muro": [
    "b07966388d7dddbd7e9c72d8ae62b2af785b5f6e177452eec6fd56156eabeb2d",
    "0c035e5be800bec70b3530223381fa4291fbb5f33677cee8fbb96129944bc461",
  ],
  "examples/twin/main.muro": [
    "19e658be12f04238657569879bf182220c8ba82821f7cc42b2b68d99c411888b",
    "b9cb0b650bccb6d849a21997d8a30d76868729d82d2fc33d31f6d60704798316",
  ],
  "examples/two-rooms.muro": [
    "6e429209adaeea792c151678fae21eeac0f596e8d0ab356e7ad2bd04d7a3a89a",
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
  // A hash table that silently stops covering a file proves nothing about that file.
  assert.equal(Object.keys(BASELINE).length, 15);
});
