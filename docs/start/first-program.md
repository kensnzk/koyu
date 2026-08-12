---
title: Reading a building from a program
mode: tutorial
---

# Reading a building from a program

Read a `.muro` from TypeScript, take its diagnostics, and drop it to canonical JSON — twenty lines end to end. Everything the CLI answers, the API answers too; the CLI is just one entrance to it.

All you need is Node.js 22 or newer. If you have been through [the tutorial](index.md) you already have a building to feed it, which is convenient.

## Setting up

Make a working directory and install koyu plus `tsx`.

```sh
mkdir koyu-first && cd koyu-first
npm init -y
npm install @kensnzk/koyu
npm install --save-dev tsx
```

Put `"type": "module"` in `package.json`. For the building to read, drop in `house.muro` — the thirty lines from stage 6 of [the tutorial](index.md) will do exactly as they are.

```muro-part
muro 1.3
name 小さな家

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK floor:オーク daylight:1
...
```

## Twenty lines

Create `read.ts`.

```ts
import { parseFile } from "@kensnzk/koyu/node";
import { areaM2, checkDiagnostics, isOutside, toCanonical } from "@kensnzk/koyu";

const model = parseFile(process.argv[2] ?? "house.muro");

console.log(`${model.spaces.size} spaces / ${model.boundaries.length} boundaries`);

for (const space of model.spaces.values()) {
  if (isOutside(space)) continue;
  console.log(`  ${space.path}  ${space.type ?? "—"}  ${areaM2(space)!.toFixed(2)} m2`);
}

const diagnostics = checkDiagnostics(model);
for (const d of diagnostics) {
  console.log(`  ${d.severity} ${d.code} line ${d.line} — ${d.message}`);
}
console.log(diagnostics.some((d) => d.severity === "error") ? "not consistent" : "consistent");

const canonical = JSON.parse(toCanonical(model));
console.log(canonical.spaces["/L1/ldk"]);
```

Run it.

```sh
npx tsx read.ts
```

```text
5 spaces / 7 boundaries
  /L1/ldk  ldk  14.40 m2
  /L1/hall  hall  7.20 m2
  /L2/bed  bedroom  14.40 m2
  /L2/hall  hall  7.20 m2
consistent
{
  type: 'ldk',
  at: [ 'X1', 'Y1', 'X2', 'Y2' ],
  attrs: { daylight: 1, floor: 'オーク', name: 'LDK' }
}
```

## What those twenty lines do

**There are two entrances.** `parseFile` from `@kensnzk/koyu/node` is the filesystem entrance: it resolves the relative paths of `import` against the disk. The main `@kensnzk/koyu` entry point is pure and knows nothing about a filesystem — in a browser you hand a set of virtual files to its `parseFiles` instead.

**The `Model` that `parseFile` returns is what was written, and nothing more.** `model.spaces` is a `Map` keyed by path and `model.boundaries` is an array; both hold the declarations as authored. No judgement is baked in.

**`areaM2` answers areas**, measured to wall centrelines, in square metres. The loop skips spaces where `isOutside` holds, because the outside need not carry a region at all and without a region there is no area. **The type cannot do that job** — the type position is a free label and koyu never reads it ([space](../reference/muro/space.md)).

**`checkDiagnostics` returns an array.** Each element carries a `code` (a symbol like `OPN05`), a `severity` (`"error"` or `"warning"`), a `message`, a `line`, and, under composition, a `file`. **Severity is a property of the code and does not move with circumstance** — one code is never an error here and a warning there. That is why "is there any error?" is decided by looking at `severity` alone.

**`toCanonical` returns a string**, not an object — formatted, and stable byte for byte, which is the whole point of it. `JSON.parse` it to use it. It contains only what was written; the derived default boundaries are not in there.

## Feeding it a broken file

Drop one `edge:S` from a window in `house.muro` to make `broken.muro`, and hand it to the same program.

```sh
npx tsx read.ts broken.muro
```

```text
5 spaces / 7 boundaries
  /L1/ldk  ldk  14.40 m2
  /L1/hall  hall  7.20 m2
  /L2/bed  bedroom  14.40 m2
  /L2/hall  hall  7.20 m2
  error OPN05 line 29 — There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L2/bed | /out)
not consistent
{
  type: 'ldk',
  at: [ 'X1', 'Y1', 'X2', 'Y2' ],
  attrs: { daylight: 1, floor: 'オーク', name: 'LDK' }
}
```

**A diagnostic does not stop the model coming back.** Structural-consistency diagnostics do not halt parsing — areas and canonical JSON come out regardless.

What does stop parsing is a line that cannot be read at all. There `parseFile` throws a `SourceError`, carrying the line number and, under composition, the file it came from. Feed it a file whose `space /L1/a` has lost its type.

```ts
import { SourceError } from "@kensnzk/koyu";

try {
  parseFile("syntaxerr.muro");
} catch (e) {
  if (e instanceof SourceError) console.error(e.message);
}
```

```text
…/syntaxerr.muro:line 4: space /L1/a requires a type (a word from the vocabulary)
```

## Onward

- The space graph, circulation, daylight, the site — everything the CLI answers is callable from the API, and it is all laid out in [TypeScript API](../reference/api/index.md).
- To emit plans and axonometrics as SVG, see `svgPlan` and `svgAxo` in the [TypeScript API](../reference/api/index.md).
- To go down to centrelines, thicknesses, columns and the solids of vertical runs, see [Form — derive(model)](../reference/form/index.md).
- To look a diagnostic code up, see [The diagnostic code index](../reference/diagnostics/index.md).
- The shape of the canonical JSON is in [Canonical JSON](../reference/json/index.md).
- To let an LLM agent read and write buildings, [koyu-mcp](../reference/mcp/index.md) exposes the same derivations as 12 tools.
