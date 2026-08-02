---
title: Parsing and composition
mode: reference
---

# Parsing and composition

Five entrances turn `.muro` text into a [`Model`](model.md). **They differ only in how `import` resolves; the `Model` that comes out has the same shape.**

```ts
import { parse, parseFiles, parseWith, tokenize } from "@kensnzk/koyu";
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";
```

Every entrance finishes two derivations before returning.

1. **Cutting regions by drawn lines** — a space's `pieces` gets filled in.
2. **Deriving default boundaries** — where two touching spaces have no declared boundary at all, a `kind:"wall"` boundary is added.

That order, not the reverse. Reversed, a pair whose contact a line has just removed would still gain a default boundary, and a zero-length boundary would draw a diagnostic with no source — blaming a relation nobody wrote.

**These five and `tokenize` are the only things that throw.** Syntax and composition failures arrive as a [`SourceError`](errors.md). Checking (`checkDiagnostics`, `check`) never throws; it always returns an array.

## parse

```ts
function parse(source: string): Model
```

Reads one piece of text. `import` cannot resolve, so it errors. For tests, scratch work, and text you assemble yourself.

```ts
import { parse } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2`);
console.log(m.spaces.size, m.version, m.layers);
```

```text
1 1.0 []
```

`layers` lists the layers that took part in composition, so with a single source it is empty. No version is declared here, so `version` holds the default.

## parseFiles

```ts
function parseFiles(files: Record<string, string>, entry: string): Model
```

Hand it a table of key to content. `import` resolves inside that key space; keys are normalised as POSIX-style relative paths (`L1.muro`, `floors/L1.muro`).

**This is the standard entrance for a browser** — you can pass editor buffers straight in.

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600 7200\ngrid Y 0 4000\nlevel L1 0\nimport ./L1.muro`,
  "L1.muro": `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`,
}, "main.muro");
console.log(m.spaces.size, m.layers);
```

```text
2 [ 'main.muro', 'L1.muro' ]
```

Importing a key that is not in the table raises a `SourceError` reading `Cannot read file:`.

## parseWith

```ts
type LayerLoader = (
  fromKey: string | undefined,
  ref: string,
) => { key: string; src: string };

function parseWith(loader: LayerLoader, entry: string): Model
```

**Replace how layers are read.** Pulling from HTTP, from a database, from anywhere — that entrance goes here.

When `fromKey` is `undefined` you are resolving the entry itself; otherwise you are resolving the `ref` written inside the file at that key. The `key` you return is the identity of the layer, and **the same key is composed only once** — a double `import` and a cycle both fold away idempotently.

```ts
import { parseWith } from "@kensnzk/koyu";

const src: Record<string, string> = {
  e: `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`,
};
const m = parseWith((_from, ref) => ({ key: ref, src: src[ref]! }), "e");
console.log(m.spaces.size, m.layers);
```

```text
1 [ 'e' ]
```

The loader may throw. Throwing on the entry is translated into a `SourceError` reading `Cannot read file: <entry>`.

## parseFile

```ts
function parseFile(filePath: string): Model
```

Reads from the filesystem. **It comes from `@kensnzk/koyu/node`** — the root never pulls `node:fs`. This is what the CLI uses.

**`import` resolves relative to the file the line is written in**, not relative to the entry and not relative to the working directory.

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log(m.name, m.spaces.size, m.layers.length + " layers");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")).join("\n"));
```

```text
小さな戸建住宅 13 5 layers
examples/house/main.muro
examples/house/assets.muro
examples/house/site.muro
examples/house/L1.muro
examples/house/L2.muro
```

`layers` holds **resolved absolute paths** (the output above strips the working directory for readability). The `file` field on a diagnostic carries the same value.

Handing it a single layer of a split building fails: that layer has neither `grid` nor `level`. What you pass is always the one entry file.

## parseFileWith

```ts
function parseFileWith(
  filePath: string,
  overlay?: (absPath: string) => string | undefined,
): Model
```

For any path where `overlay` returns a string, that string is composed instead of the contents on disk. What it receives is the **resolved absolute path**.

**This is what a pre-write gatekeeper uses**: it can ask "would saving this break anything?" without saving.

```ts
import { parseFileWith } from "@kensnzk/koyu/node";

const m = parseFileWith("examples/two-rooms.muro", (abs) =>
  abs.endsWith("two-rooms.muro")
    ? `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:差し替え`
    : undefined);
console.log(m.spaces.get("/L1/a")!.attrs["name"]);
```

```text
差し替え
```

Omit `overlay` and it is `parseFile` — which is nothing but another name for this function.

## tokenize

```ts
function tokenize(line: string, ln: number): string[]
```

The low-level part that splits one line into tokens. **It splits on whitespace and keeps whitespace inside quotes.** Outside quotes, everything from `#` on is dropped as a comment. An unclosed quote throws a `SourceError` (that is what `ln` is for).

Use it when you are writing your own completion, syntax colouring, or line rewriting.

```ts
import { tokenize } from "@kensnzk/koyu";
console.log(tokenize('space /L1/a room X1..X2 Y1..Y2 name:"居 室" # comment', 1));
```

```text
[ 'space', '/L1/a', 'room', 'X1..X2', 'Y1..Y2', 'name:居 室' ]
```

The quote marks themselves do not survive: `name:"居 室"` becomes the single token `name:居 室`.

## Which one

| Situation | Entrance |
|---|---|
| read one file (node) | `parseFile` |
| check before saving (node) | `parseFileWith` |
| browser, editor buffers | `parseFiles` |
| HTTP, a database, your own storage | `parseWith` |
| one string, a test | `parse` |
| you need the tokens of a line | `tokenize` |

## See also

- [Model and its types](model.md) — what comes back
- [Diagnostics](diagnostics.md) — checking what you read
- [Errors](errors.md) — what is inside a `SourceError`
- [`import` — splitting into layers](../muro/import.md) — composition seen from the notation
