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
  "examples/spatial/main.muro": ["87088c399bbbbd6939f9e45107bc4479019041e2ac085fa53c2792bb9a89f0d4", "c09bd2c29d6f3e1c5d00e19f87cdf3c44966e0317aaac0cce912445577376f02"],
  "examples/basement/main.muro": [
    "1a9914496db7886bc8cb79370244c4d1376929083d5e759e3856593a7b07bccd",
    "ec6c647018cb1a14713d3a771b6dc0f32b6f2c3b782cf40fe78c9a8a150167ba",
  ],
  "examples/complex/main.muro": [
    "0650c611287a7cabfbcbfedc0346dbb214b2ea46c003503efaa370c92335dddb",
    "946a452b02bf467081804f089eab4db72f3002ae5a8b13a955c5027ba7df17f0",
  ],
  "examples/house.muro": [
    "e76d0a58c6c3054f1972cad7c818b3a0badfc4b2f0f61934ef2d49d724d1e08f",
    "26145386b412fe7a6cfa041493c3371c7190f7a0ea9c6616df95ae489a591ccb",
  ],
  "examples/house/main.muro": [
    "9398517179260fc15551613ada9ccaa6d7aa8b0dcf6154e5927e83611876535e",
    "2eaf9e454f0b1d91bb481f75dbc56f17ce81f21fceecae1b1b623fb5dbbc8974",
  ],
  "examples/mansion.muro": [
    "5fa6091b10a4b144e7ec7e9240011c430e3d78c4094f4aaa9dc8543b4b8dbbf4",
    "c5afa884e909bce64ab64277e00af6af617de420be5c6a71917b1dcd227dcb43",
  ],
  "examples/office.muro": [
    "516c5c7a9c7f3e996841b4196d9bbe8511d343683d555d98c9639f79740230eb",
    "7cf1f4c1fe0aa53033118cac9f596a2913cf37e006f403259563f5e5d244e697",
  ],
  "examples/steps/01-one-room.muro": [
    "ca5bab41074dbac2c7a4afe98ac8bd4d0fc7ce8559c91499f0f9cbbd67221e05",
    "f01644d2096c620c63dc5fd3c30199bce6640ffc3a5bfbb141ed0695528547fd",
  ],
  "examples/steps/02-two-rooms.muro": [
    "00af990bb81c9c900f30e2aa2211622a7aaa95639cc005f8d085eea77463313e",
    "0eba0fb048f90f098fa5875fe2c8127df8d68e01c74e9ecb3745771dcbe4e31a",
  ],
  "examples/steps/03-door.muro": [
    "25646c1b4361baceacd4f930ee2a8e512241022403d79a8463330a77da836aca",
    "19381f8a3bcb2e5c86cac2431cc81ebeac190dc87794ffe63712b2f8193d326d",
  ],
  "examples/steps/04-exterior.muro": [
    "32e3e86fbaec46fca98e88cc8d36631a7f9fae12ab26704d7cc35e00aa31131d",
    "c04f165ece16a62be10f4293fbb1b948e63ef9b29ef4b1951a079ccbcdee2297",
  ],
  "examples/steps/05-two-storeys.muro": [
    "a7cb8c5d49bfca5bde790b80b16274faab54fdb84b31c1937b05e8e8a3571015",
    "d4c0a82880f05d127f92948247121b3df1a1a599527690240f7b0ca24c91aace",
  ],
  "examples/steps/06-finished.muro": [
    "1406bf2d612e2ea7ddd1dc7e48e3d427d1dac6da6ee308d07c4e2ccfbb4fc6f7",
    "433b74d5b0ccffb19bce6cc415375236f8e33ecfa9b4139d328a64138e41adc6",
  ],
  "examples/tower/main.muro": [
    "5e0311e845410fc021c17a6fbb494da907e20b066542bde996d95396d3660679",
    "f7e0e47145a555da4cb2ff38a888c473771d19059a637a257c2771ec38b04702",
  ],
  "examples/twin/main.muro": [
    "e2c19a62fdeb17fc0d72cbb070ef9f5bd406eb2d33271c1737a791493e7e17d8",
    "bfbbfccdba79a58b72f73344de02ecce17fe12b06a136464baad7aed2c92a69e",
  ],
  "examples/two-rooms.muro": [
    "7f51ffc132a5e0e29a162cab0b23d87592d470499339771cc0ce05b85bd9e763",
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
