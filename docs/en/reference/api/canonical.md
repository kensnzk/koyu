---
title: Canonical JSON
mode: reference
---

# Canonical JSON

```ts
import { toCanonical } from "@kensnzk/koyu";

function toCanonical(model: Model): string
```

Writes a model out as a machine format. **The same composition produces the same bytes** — which is what diff and layer composition are built on.

```ts
import { toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
console.log(toCanonical(a).split("\n").slice(0, 8).join("\n"));
console.log("bytes:", Buffer.byteLength(toCanonical(a)));
```

```text
{
  "format": "koyu-canonical/1.0",
  "koyu": "1.0",
  "name": "二室",
  "unit": "mm",
  "grid": {
    "X": [
      0,
```

```text
bytes: 2164
```

Indentation is two spaces, and **there is a trailing newline.**

## What is in it, and what is not

**Only the written composition comes out.**

| Present | Absent |
|---|---|
| grid coordinates, levels, assets, site polygons, column declarations, zones, spaces, boundaries | `import` — no trace of composition survives |
| a space's allocation (`at`), spelled as the grid references written | the derived convex pieces (`pieces`) |
| declared boundaries | default (`derived`) boundaries |
| the spelling of a drawn line | its `effect` (whether it cut anything) |
| attributes | any trace of `over` / `drop` |

**Default boundaries are absent because they are not written composition.** When you rebuild a `Model` from canonical JSON, run [`deriveDefaultBoundaries`](derive.md#derivedefaultboundaries) — without it the meaning (the default walls) cannot be read back.

For the same reason, whether `over` or `drop` was written does not survive. **No trace of an override reaches the machine format** — leaving one would mix *how it was written* into *what was written*.

## The order at the top

```text
format → koyu → name → unit → grid → levels → assets → polygons → columns → zones → spaces → boundaries
```

**The first thing a document announces is the version of its own spelling.** `format` is `"koyu-canonical/1.0"`, and that is **neither the language version nor the tool version** — it counts spelling and nothing else.

- The minor rises when a key is added. The bytes of a document that has no such key do not change.
- The major rises when the name, order, collation, normalisation or number spelling of an existing key changes. Existing documents change bytes.

`koyu` is **the written version declaration passed straight through**, so it is absent from a file that declares no version.

```ts
import { parse, toCanonical } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2`);
console.log(toCanonical(m));
```

```text
{
  "format": "koyu-canonical/1.0",
  "unit": "mm",
  "grid": {
    "X": [
      0,
      3600
    ],
    "Y": [
      0,
      4000
    ]
  },
  "levels": {
    "L1": {
      "z": 0,
      "h": 2400
    }
  },
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ]
    }
  },
  "boundaries": []
}
```

**The default was not written in.** Recording a version the author never wrote would mean the bytes of the same input change on the day the tool's default moves. Determinism is a promise of the format, so it is not entrusted to a tool default.

Empty collections (`assets`, `polygons`, `columns`, `zones`) drop out entirely. `spaces` and `boundaries` are always present, empty or not.

## The rules of sorting

**Only a collection whose order carries no meaning may be sorted.** Ask before sorting: would swapping two entries make it a different composition? If so, do not sort. Sorting is not tidying — it is an assertion that order means nothing here.

| What | Order |
|---|---|
| object keys (attributes, level names) | collation |
| spaces, zones, assets, site polygons (things keyed by path) | collation of the path |
| boundaries | collation of the canonical entry serialised |
| openings, `seg`s, `area`s, a space's several allocations | the same |
| **column declarations** | **declaration order, untouched** |
| grid names inside a column declaration | the order of the grid |

**Columns alone are not sorted.** Two columns never share an intersection and the earlier declaration wins, so sorting would give two different buildings identical bytes. Only the list of grid names *inside* a declaration — where order means nothing — may be sorted.

A boundary's `between` is the two paths in collation order; the direction as written is kept separately in the `a` key, because `edge` and `swing` are read from the a side.

The endpoints of a drawn line are ordered by **ascending resolved coordinate**. A segment has no direction, so writing order is a variation in spelling. **The spelling itself is preserved** as the grid references written.

## Collation

**Ascending Unicode code point, which is the same as ascending UTF-8 bytes.**

**JavaScript's `<` and default `sort` cannot be used.** They order by UTF-16 code unit, which does not agree with code point order. 𠮟 (U+20B9F) is the surrogate pair D842,DF9F, so `<` places it before 﨑 (U+FA11); in UTF-8 they are F0 A0 AE 9F and EF A8 91, so 﨑 comes first. Both are real characters in Japanese, so the difference is not theoretical.

**The rule is anchored to the bytes of this format, not to a JavaScript default** — the side an implementation in another language reaches by writing the obvious thing.

## The invariant

When

```ts
toCanonical(a) === toCanonical(b)
```

holds, [`semanticDiff(a, b)`](diff.md) is empty; and when the diff is empty, the bytes match. **The two surfaces share one definition of "the same composition".**

The same holds for form. **Byte-identical canonical JSON means identical derived form.** That is why the order in which [`derive`](derive.md) reads boundaries, and the order in which lines cut regions, is the canonical order — reading in declaration order would produce different areas from the same canonical JSON.

## Where to use it

- **Version control.** "The `.muro` changed but the composition did not" becomes something a machine can say.
- **Checking composition.** A building split into layers can be compared with the same building written on one page.
- **Golden tests.** Unlike drawings, this is the surface where byte stability is promised.

```ts
import { toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
import { createHash } from "node:crypto";

const digest = (p: string) =>
  createHash("sha256").update(toCanonical(parseFile(p))).digest("hex").slice(0, 12);
```

## See also

- [Semantic diff](diff.md) — the same definition of "the same", in words a person reads
- [Deriving form](derive.md) — the derivation that reads this order
- [`koyu json`](../cli/json.md) — the same output from the command line
