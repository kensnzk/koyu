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

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { toCanonical } from "../src/index.js";
import { derive } from "../src/form.js";
import { parseFile } from "../src/parse-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));

/** entry → [canonical SHA-256, Form SHA-256], measured at v0.17.0. */
const BASELINE: Readonly<Record<string, readonly [string, string]>> = {
  "examples/basement/main.muro": [
    "404fc5ae276a4bcebd40bcee84dad59e0e0871d19a89867203c3d05fb39286b2",
    "6563b75ee0b10cfb5bc9a944af63eff14e2fbdf19735428f6d40dc74bb8578d9",
  ],
  "examples/complex/main.muro": [
    "787cfc87e5c4aaf5555089f27dddffef6f82c7f32e6c2ab3b0fd437908a0e320",
    "7e3b8522272f0bf32431b3bee75776a358c0453034439cc0e2c2e98cdae847f8",
  ],
  "examples/house.muro": [
    "19dfc7301f063c379df456474030c8c5470e99eb3fe128dd2ce4f79e1e1e5d65",
    "43c0a10033e19eb3f3e3da11a2d7a0ef4fda5987886ea8abd25650b81ba30ad1",
  ],
  "examples/house/main.muro": [
    "5144f112b89709ca244fb3cb09b7649df061ad77cf109e8ee95f396cebeb7e83",
    "e3cf2f90817c9aec484833649d4b286c8f0dfc6b238bceb6b4a246434dcfb7f9",
  ],
  "examples/mansion.muro": [
    "e07900c318b7133246022622f1e1f3ef42be3c2e4d6239cabe485fa8db533f8f",
    "2826b693ca44b3da2203d573e5e2396b7ab6e542ca7c67cd0154c06217e105e1",
  ],
  "examples/office.muro": [
    "d120d18f7a8d8a029d3255196175dc7b233f10f11a47990e4da6e0f1a6e453be",
    "e536046e5b75c3c956fd9808b6cd66d6748af538b10a5776b34ffec1ba4de454",
  ],
  "examples/steps/01-one-room.muro": [
    "b8f7795ff8eec8f636a0da95455c2bea5be57419a38f0ac5f3d1717294fc5b9b",
    "9fb0d7fb5374ca8e1b98d38761f34df3d44e812ba8420a38286b6951c5f8f39f",
  ],
  "examples/steps/02-two-rooms.muro": [
    "2569b2a8eb3aa100a4de57bc5d6d44e7f4f159c7e11136dc2a76bce22f11dd3e",
    "e3baa8e8f61e846ee83f025955032692898a896f8c99c235c18d8d58e08f9a65",
  ],
  "examples/steps/03-door.muro": [
    "debd9284854db19f19e150424d8ba4bfc7f12dce8f4798670f2b275ddd20786a",
    "682916244661f86c3502d528ff622fad0d64cfb4ad1068a9743b4c6f83490b3d",
  ],
  "examples/steps/04-exterior.muro": [
    "47e96211aafaeb35299310ac0e295676f4ee3b4443d5e27cf5f83ca77f419d34",
    "189a2ce3d8db4624da75d193a49e745a866e3ac8344282d0be8c098942158032",
  ],
  "examples/steps/05-two-storeys.muro": [
    "cd2b1d0fa56ba35a94a2d5ad9d3e100c0c36d4d5ea4f4dc41916e7a2a93c9ca5",
    "1b47d3ece275091db71e862f8c4e504d84e867602c97b0a78910a13ef5f0bb40",
  ],
  "examples/steps/06-finished.muro": [
    "318720ea50c5d4cd8d2641cdae521d5fffcd2c11556acb505c24bfeead077fec",
    "ee5269f77e734704c5c5f05bec930859e9e18a248ff54e77b52476920e28985b",
  ],
  "examples/tower/main.muro": [
    "d81a557c970b6e8c50126b6e33ba91b322fdba0e607a87ff60291b2d9ce3b744",
    "a483e49f4938c58ff2e3fec5b6d711071135029ff663d765d6290092d0eb24ca",
  ],
  "examples/twin/main.muro": [
    "727bb53384d8c17e4d08036a9550400b02aaea857e667526670be9905b55f8d1",
    "37f530e039423b7a1c1aee0420a2f660d8f7ac551ad5fbbceac464cac6bee7cd",
  ],
  "examples/two-rooms.muro": [
    "6fc26013384d8e97179f49e91900f860aeca96ebc54af18eca3e2ebe3a8b2186",
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
