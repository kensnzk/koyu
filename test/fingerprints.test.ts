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
// The canonical column has been re-baselined twice, both times under ADR-0057: once for every
// example, when `koyu-canonical/1.1` became `1.2`; and once for `tower` alone, when it was given
// an `origin` and an `azimuth`. **The Form column has never been touched** — not by the format
// bump, and not by tower gaining a frame. That second fact is the machine's proof that koyu
// derives nothing from the frame.

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
    "7d42b36d4383c033bf27bbf293f217fbc96e0e021acde59d12987cb9eab5c24f",
    "6563b75ee0b10cfb5bc9a944af63eff14e2fbdf19735428f6d40dc74bb8578d9",
  ],
  "examples/complex/main.muro": [
    "7ade635ac9e03d3b261f0318ba2172d6a39515dcd32414a0e715d3dbd95136c7",
    "7e3b8522272f0bf32431b3bee75776a358c0453034439cc0e2c2e98cdae847f8",
  ],
  "examples/house.muro": [
    "4e6f9b108ab8dc72c2814f00ca02a13e92033dd10c80e2fae76675ef89b6d500",
    "43c0a10033e19eb3f3e3da11a2d7a0ef4fda5987886ea8abd25650b81ba30ad1",
  ],
  "examples/house/main.muro": [
    "08c792f3e1eac1adcb81098ea26436e0d0b2e064ac6d10ae222ceb3bb01554af",
    "e3cf2f90817c9aec484833649d4b286c8f0dfc6b238bceb6b4a246434dcfb7f9",
  ],
  "examples/mansion.muro": [
    "a64c2f2953e208fd1fabc4dad3d7ad63300a6ac6c225edb0d019e26b2cbd6a4d",
    "2826b693ca44b3da2203d573e5e2396b7ab6e542ca7c67cd0154c06217e105e1",
  ],
  "examples/office.muro": [
    "9a93b89e18766b08c0b2b88bb9705bc386f82c049501c0c169acd74fb091acf8",
    "e536046e5b75c3c956fd9808b6cd66d6748af538b10a5776b34ffec1ba4de454",
  ],
  "examples/steps/01-one-room.muro": [
    "a05a19df3ecf84a45a1fcaa9b4d199cc2b5249b1e0c2df8d8b596413c3b7b70b",
    "9fb0d7fb5374ca8e1b98d38761f34df3d44e812ba8420a38286b6951c5f8f39f",
  ],
  "examples/steps/02-two-rooms.muro": [
    "a392dd9ff8bf302783b056e55de3b10683b9ce8881ee2681113009ac1874e3bf",
    "e3baa8e8f61e846ee83f025955032692898a896f8c99c235c18d8d58e08f9a65",
  ],
  "examples/steps/03-door.muro": [
    "a895d6015a3095f2812e0d103c60479a638f899e6ab0892c9d25b17a2dd89903",
    "682916244661f86c3502d528ff622fad0d64cfb4ad1068a9743b4c6f83490b3d",
  ],
  "examples/steps/04-exterior.muro": [
    "9d464bf0712d68b94e7cc780dc02bd022f4dae238656f487d8ef7f6d6383f109",
    "189a2ce3d8db4624da75d193a49e745a866e3ac8344282d0be8c098942158032",
  ],
  "examples/steps/05-two-storeys.muro": [
    "cda8a44507c9017762710354a8c9ea5ad00ef47a57382200b27e7d75af14c4fb",
    "1b47d3ece275091db71e862f8c4e504d84e867602c97b0a78910a13ef5f0bb40",
  ],
  "examples/steps/06-finished.muro": [
    "0368af986ffc2546892ab350261c177e1332e568a9e8e3f49a39121da781fead",
    "ee5269f77e734704c5c5f05bec930859e9e18a248ff54e77b52476920e28985b",
  ],
  "examples/tower/main.muro": [
    "9f3e4ce334d9e88d893af073ed354a5e64fd949405e6715cd72ec96a6bf368e7",
    "a483e49f4938c58ff2e3fec5b6d711071135029ff663d765d6290092d0eb24ca",
  ],
  "examples/twin/main.muro": [
    "98ed8801a9f892ecb42ce287b243040a2ff05bad05f634b1013846704ad9223a",
    "37f530e039423b7a1c1aee0420a2f660d8f7ac551ad5fbbceac464cac6bee7cd",
  ],
  "examples/two-rooms.muro": [
    "e93cd6b0dee10147b78351f16f4a11832ec083d902d7863be997889b94a14236",
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
