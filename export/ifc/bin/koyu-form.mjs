#!/usr/bin/env node
// Put one koyu building into the single JSON document the IFC export reads.
//
// It takes two things, because **the Form holds shape and no attributes, and the canonical JSON
// holds attributes and no shape.** A space's `uid` and `name` are not in the Form at all, and a
// space declaring `outside:1` never appears there. They are joined by path, so both are handed
// over as they are.
//
// **Imports come from `dist/` only.** Reading `src/` directly would exercise the implementation
// on this machine rather than the face that actually ships. `test/domains.test.ts` holds that.

import { toCanonical } from "../../../dist/index.js";
import { derive } from "../../../dist/form.js";
import { parseFile } from "../../../dist/parse-file.js";

const entry = process.argv[2];
if (!entry) {
  process.stderr.write("Usage: koyu-form <entry.muro>\n");
  process.exit(2);
}

const model = parseFile(entry);
process.stdout.write(
  JSON.stringify({
    entry,
    form: derive(model),
    canonical: JSON.parse(toCanonical(model)),
  }),
);
