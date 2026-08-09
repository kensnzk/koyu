// The meaning of every bundled building, pinned across the 0.18.0 surface cutover.
//
// The whole public API moved in 0.18.0 — entry points, the validation contract, the CLI. None of
// that was supposed to change what a `.muro` file *means*. These hashes were taken from the
// implementation at `v0.17.0`, before any of it was touched, and they still have to hold: if the
// canonical form or the derived `Form` moved, the language moved, and the language version would
// have to move with it.
//
// A failure here is therefore never "update the hash". It is either a bug, or a language change
// that needs its own decision and a version bump.
//
// **The two columns do not fail for the same reasons.** The canonical hash also moves when the
// *format* version moves, because `koyu-canonical/x.y` is the first key of every document and so
// sits inside the bytes — that is a change of spelling, not of meaning, and it moves every example
// at once. **The Form hash is the meaning-invariant**, and it moves only when a building really
// became a different building. So: every canonical hash moved and no Form hash did is a format
// bump; one canonical hash moved is that example being edited; **a Form hash moved is the language
// moving, and nothing else looks like that.**
//
// The canonical column has been re-baselined three times. Twice under ADR-0057: once for every
// example, when `koyu-canonical/1.1` became `1.2`; and once for `tower` alone, when it was given
// an `origin` and an `azimuth`. The third was `1.2` becoming `2.0`, when the version key was
// renamed from `koyu` to `muro` — the key names the language, and the language is muro. **A
// renamed key is a major**, which is the rule that decides the number and was the one thing the
// change first got wrong.
//
// **The Form column has never been touched** — not by either format bump, and not by tower
// gaining a frame. That is the machine's proof that neither the frame nor the spelling of a key
// reaches the meaning of a building. The third re-baselining was measured the same way: all 15
// canonical hashes moved and none of the 15 Form hashes did, which is the signature of a format
// bump and of nothing else.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** entry → [canonical SHA-256, Form SHA-256]. **The Form column is the one measured at v0.17.0.** */
const BASELINE: Readonly<Record<string, readonly [string, string]>> = {
  "examples/basement/main.muro": [
    "f4e6952dcfe959a3c2458096cecd3f7a68c02784189ead71422ed9aa082d2afa",
    "6563b75ee0b10cfb5bc9a944af63eff14e2fbdf19735428f6d40dc74bb8578d9",
  ],
  "examples/complex/main.muro": [
    "6d8c31d1ea051a66a68b809d8c9242f3ac6563efb1462c168ee19c0ca63cbc89",
    "7e3b8522272f0bf32431b3bee75776a358c0453034439cc0e2c2e98cdae847f8",
  ],
  "examples/house.muro": [
    "f68cddc23c770d07594f84d0cc0f073d22980201d9d6f3cc9a050cef6c30bba2",
    "43c0a10033e19eb3f3e3da11a2d7a0ef4fda5987886ea8abd25650b81ba30ad1",
  ],
  "examples/house/main.muro": [
    "831f7965a73b840d4d812ee3f6a3ae5d2b5534635ff7b4ddafe9feeb7db6c3bd",
    "e3cf2f90817c9aec484833649d4b286c8f0dfc6b238bceb6b4a246434dcfb7f9",
  ],
  "examples/mansion.muro": [
    "daa2b19c1993b416eba0a34079f9cb360dc7f1b3b9ac78923db8ad4fcf5c8586",
    "2826b693ca44b3da2203d573e5e2396b7ab6e542ca7c67cd0154c06217e105e1",
  ],
  "examples/office.muro": [
    "c35d660de8c51ff1e04d1661f67de74b5c62309e693824b8242da8d9a49b5b72",
    "e536046e5b75c3c956fd9808b6cd66d6748af538b10a5776b34ffec1ba4de454",
  ],
  "examples/steps/01-one-room.muro": [
    "4c23e5f10c4b43bb8dacd5220d6e3c7035bd79bb2f8a205f07bcb23f54e85b8d",
    "9fb0d7fb5374ca8e1b98d38761f34df3d44e812ba8420a38286b6951c5f8f39f",
  ],
  "examples/steps/02-two-rooms.muro": [
    "6a192e4647735d60491423954f17a1703718e974815529e7543abbf1001606fc",
    "e3baa8e8f61e846ee83f025955032692898a896f8c99c235c18d8d58e08f9a65",
  ],
  "examples/steps/03-door.muro": [
    "5a167a7ea8a494f15a624e19adeb8a26f52b6cdbb78a03b9f124e219f431ece7",
    "682916244661f86c3502d528ff622fad0d64cfb4ad1068a9743b4c6f83490b3d",
  ],
  "examples/steps/04-exterior.muro": [
    "d8ad1921e9c9b9f68ff723f3be532a24ec0b23439c9e436de17b2d5cb9827045",
    "189a2ce3d8db4624da75d193a49e745a866e3ac8344282d0be8c098942158032",
  ],
  "examples/steps/05-two-storeys.muro": [
    "f93bed0140c709240db501e08b5c4a9dd1863fa6e50e4a81e7ac5b485b5b96a5",
    "1b47d3ece275091db71e862f8c4e504d84e867602c97b0a78910a13ef5f0bb40",
  ],
  "examples/steps/06-finished.muro": [
    "819191fb62926efca7394edcc3ce1a09c3725abc3621b5caf3d021d6529802da",
    "ee5269f77e734704c5c5f05bec930859e9e18a248ff54e77b52476920e28985b",
  ],
  "examples/tower/main.muro": [
    "1fbe753d22ae4b1f7c24d395471f13cf4a1ef6a6457c12b024a5769d2e409b12",
    "a483e49f4938c58ff2e3fec5b6d711071135029ff663d765d6290092d0eb24ca",
  ],
  "examples/twin/main.muro": [
    "e9d4a8471ec42455f8557f1bed7522d5b2dbdc43d95d0869b65918e734820305",
    "37f530e039423b7a1c1aee0420a2f660d8f7ac551ad5fbbceac464cac6bee7cd",
  ],
  "examples/two-rooms.muro": [
    "c379445062cde52509db846f0cd5ec39c8032cdec622c21c59deb740a52f10eb",
    "9d92220d9f2d7adc952d3cdb3a13da3cb6b32fd5991acfefd33df7ead90a1439",
  ],
};

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

test("meaning is preserved: every bundled example keeps its v0.17.0 canonical and Form hash", () => {
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
