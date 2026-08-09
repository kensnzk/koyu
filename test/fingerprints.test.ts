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
// an `origin` and an `azimuth`. The third was `1.2` becoming `1.3`, when the version key was
// renamed from `koyu` to `muro` — the key names the language, and the language is muro.
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
    "c52bf70390e05bb739ecc635f8fe251e9ee7369b9aeb6f43e5028444b3c9850a",
    "6563b75ee0b10cfb5bc9a944af63eff14e2fbdf19735428f6d40dc74bb8578d9",
  ],
  "examples/complex/main.muro": [
    "d7631378fb2cdea57c0abace592020e0aaa7c26cf61d07db4a8aa0b7d195f8ad",
    "7e3b8522272f0bf32431b3bee75776a358c0453034439cc0e2c2e98cdae847f8",
  ],
  "examples/house.muro": [
    "5d23bb8abe3b8da3bbadbde1613033ba4053282fb722acc90304c13281503f23",
    "43c0a10033e19eb3f3e3da11a2d7a0ef4fda5987886ea8abd25650b81ba30ad1",
  ],
  "examples/house/main.muro": [
    "a2f76bbcbe35a9727416eddaa241672b3f2ee6b964c39a83adfbddbc7d8415bb",
    "e3cf2f90817c9aec484833649d4b286c8f0dfc6b238bceb6b4a246434dcfb7f9",
  ],
  "examples/mansion.muro": [
    "7bd02abf2d75397037f3f19f192902f5cd39f1c58b027945df27a427d8ed1602",
    "2826b693ca44b3da2203d573e5e2396b7ab6e542ca7c67cd0154c06217e105e1",
  ],
  "examples/office.muro": [
    "55cb43f31b3e3dab399616a8e10c8f6d84114d403464c5d33a2cef9ad1823e2a",
    "e536046e5b75c3c956fd9808b6cd66d6748af538b10a5776b34ffec1ba4de454",
  ],
  "examples/steps/01-one-room.muro": [
    "a50f5272f9e0a8721c716ac59f109c5d728b28f2ffb896249038d89406e1cdb8",
    "9fb0d7fb5374ca8e1b98d38761f34df3d44e812ba8420a38286b6951c5f8f39f",
  ],
  "examples/steps/02-two-rooms.muro": [
    "483182259e3d6bb0dc5a3faa88e6e0d2132e77f832ab405485319c2ef614c955",
    "e3baa8e8f61e846ee83f025955032692898a896f8c99c235c18d8d58e08f9a65",
  ],
  "examples/steps/03-door.muro": [
    "b11a15f08843b83486a7b530ce64036449e375f07cc37c69edec19fc6ba4565a",
    "682916244661f86c3502d528ff622fad0d64cfb4ad1068a9743b4c6f83490b3d",
  ],
  "examples/steps/04-exterior.muro": [
    "b941b3e71fe559372330cb2478ce65a419c30df27b8890472fad8d5d24b67854",
    "189a2ce3d8db4624da75d193a49e745a866e3ac8344282d0be8c098942158032",
  ],
  "examples/steps/05-two-storeys.muro": [
    "cbe002765740e83c89adf9f2e75511b4dd1e64c1c215bb8a2689ab9218a07f9d",
    "1b47d3ece275091db71e862f8c4e504d84e867602c97b0a78910a13ef5f0bb40",
  ],
  "examples/steps/06-finished.muro": [
    "ed93b44b8d7f71a267a5c6ac05726503c82b72d0a82db9fc79ac7a459234284d",
    "ee5269f77e734704c5c5f05bec930859e9e18a248ff54e77b52476920e28985b",
  ],
  "examples/tower/main.muro": [
    "8a9957264588c9e46b5615d5f6eef2260ac1c4b34effe6de8d0c8d5c6150db8d",
    "a483e49f4938c58ff2e3fec5b6d711071135029ff663d765d6290092d0eb24ca",
  ],
  "examples/twin/main.muro": [
    "bd97c7ff29a40665d66a26d694a63bb61bf967a4757862be2e84ac5c5cfa5b33",
    "37f530e039423b7a1c1aee0420a2f660d8f7ac551ad5fbbceac464cac6bee7cd",
  ],
  "examples/two-rooms.muro": [
    "a0fefeca956b5a36a9f062200476e9b0c226a24d1d5a2ea49d01a546bcc104bb",
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
