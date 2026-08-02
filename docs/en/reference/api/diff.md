---
title: Semantic diff
mode: reference
---

# Semantic diff

Compares two models **in the language of composition.** Line order, formatting, and the difference between a bare `wall` declaration and its omission (a default wall) are not differences.

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import type { ModelDiff } from "@kensnzk/koyu";
```

## semanticDiff

```ts
function semanticDiff(a: Model, b: Model): ModelDiff
```

**There is one invariant**: if [`toCanonical(a) === toCanonical(b)`](canonical.md) then the diff is empty.

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const b = parseFile("examples/two-rooms.muro");
b.spaces.get("/L1/b")!.attrs["name"] = "書斎";

console.log(renderDiff(semanticDiff(a, b)));
console.log(renderDiff(semanticDiff(a, a)));
```

```text
[ '± /L1/b: name 居室B → 書斎' ]
[]
```

## ModelDiff

```ts
interface ModelDiff {
  version?: { from: string; to: string };
  name?: { from?: string; to?: string };
  grid: GridChange[];
  levels:     { added: string[];       removed: string[];       changed: ChangedItem[] };
  assets:     { added: string[];       removed: string[];       changed: ChangedItem[] };
  polygons:   { added: string[];       removed: string[];       changed: ChangedItem[] };
  zones:      { added: string[];       removed: string[];       renamed: RenamedItem[]; changed: ChangedItem[] };
  spaces:     { added: SpaceItem[];    removed: SpaceItem[];    renamed: RenamedItem[]; changed: ChangedItem[] };
  boundaries: { added: BoundaryItem[]; removed: BoundaryItem[]; changed: BoundaryChange[] };
  columns:    { added: ColumnItem[];   removed: ColumnItem[];   changed: ChangedItem[] };
}
```

**Do not forget `columns`.** Order carries meaning for column declarations, so **rank is part of the diff**, not just membership — swapping two lines changes which columns actually stand.

The constituent types:

```ts
interface FieldChange {
  field: string;
  from?: string;    // a missing side means it was absent there (added / removed)
  to?: string;
}

interface ChangedItem {
  path: string;     // the name on the new (b) side
  fields: FieldChange[];
}

interface RenamedItem {
  from: string;
  to: string;
  uid: string;
}

interface GridChange {
  axis: "X" | "Y";
  name: string;
  kind: "added" | "removed" | "moved";
  from?: number;
  to?: number;
}

interface SpaceItem {
  path: string;
  type: string;
  areaM2?: number;
}

interface BoundaryItem {
  between: [string, string];
  edge?: Edge;
  kind: string;
  t?: number;
}

interface BoundaryChange {
  between: [string, string];
  edge?: Edge;
  fields: FieldChange[];
}

interface ColumnItem {
  at: number;       // rank of the declaration, 1-based
  label: string;
}
```

**An empty diff still has the whole structure.** No key ever goes missing, so reading `d.columns.added.length` is safe.

```ts
console.log(JSON.stringify(semanticDiff(a, a), null, 1));
```

```text
{
 "grid": [],
 "levels": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "assets": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "polygons": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "zones": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": []
 },
 "spaces": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": []
 },
 "boundaries": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "columns": {
  "added": [],
  "removed": [],
  "changed": []
 }
}
```

Only `version` and `name` drop out entirely when unchanged.

## How things are matched

**Two passes.**

1. Match by **equal `uid`** (consumed from both sides).
2. Match the rest by **equal path**.
3. What is still left over is an addition or a deletion.

**Equal uid with a different path is a rename.** Boundaries inherit their correspondence from the uid, so one rename does not turn into a flood of boundary changes.

```ts
import { parse, renderDiff, semanticDiff } from "@kensnzk/koyu";

const r1 = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:u-0123456789abcdef`);
const r2 = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/study room X1..X2 Y1..Y2 uid:u-0123456789abcdef`);

console.log(JSON.stringify(semanticDiff(r1, r2).spaces, null, 1));
console.log(renderDiff(semanticDiff(r1, r2)));
```

```text
{
 "added": [],
 "removed": [],
 "renamed": [
  {
   "from": "/L1/a",
   "to": "/L1/study",
   "uid": "u-0123456789abcdef"
  }
 ],
 "changed": []
}
```

```text
[ 'renamed /L1/a → /L1/study (uid:u-0123456789abcdef)' ]
```

Where a uid is duplicated on one side (a model that raises the `UID03` error), that uid falls back to path matching. **A model that fails checking still diffs.**

### Matching openings and `seg`s

**A name wins if there is one.** Move a named door and it is "the `at` of the same door changed", not "one disappeared and another grew". Without a name there is nothing but position to go on: `(kind, edge, at)` for an opening, `(edge, at, w)` for a `seg`.

Named and unnamed openings fall into different key spaces, so **adding a name afterwards shows up as a deletion plus an addition.** Writing the name is itself the declaration of identity, so that is correct.

### The direction of a boundary

The direction of `a` matters only where there is an `edge`, an opening with `swing` / `hinge`, or a `seg`. **Otherwise direction is not compared** — swapping the order the two spaces were written is not a difference.

The `derived` mark does not reach the comparison either, so **a bare `wall` declaration and a default wall serialise identically.** "I spelled out `boundary /L1/a /L1/b`" is not a difference.

## Columns

```ts
const head = `koyu 1.0
grid X 0 6000 12000
grid Y 0 6000
level L1 0 h:4000 slab:200
space /L1/hall room X1..X3 Y1..Y2
space /out outside:1
boundary /L1/hall /out
`;
const c1 = parse(head + `column 800 L1\n`);
const c2 = parse(head + `column 900 L1 x:X1,X2\ncolumn 800 L1\n`);

const d = semanticDiff(c1, c2);
console.log(JSON.stringify(d.columns, null, 1));
console.log(renderDiff(d));
```

```text
{
 "added": [
  {
   "at": 1,
   "label": "900 square L1 x:X1,X2"
  }
 ],
 "removed": [],
 "changed": [
  {
   "path": "800 square L1",
   "fields": [
    {
     "field": "rank",
     "from": "1",
     "to": "2"
    }
   ]
  }
 ]
}
```

```text
[
  '+ column 900 square L1 x:X1,X2',
  '± column 800 square L1: rank 1 → 2'
]
```

**The declaration itself is unchanged, and yet a change of `rank` is reported.** A line went in ahead of it, so it now claims intersections later — which may change which columns actually stand. That is what "declaration order is meaning" amounts to.

## Comparing site polygons

Polygons are compared after **cyclic normalisation**: the smallest serialisation over rotations (a different starting vertex) and reversal (the opposite winding). So **rewriting the same shape from a different starting point is not a difference.**

## renderDiff

```ts
function renderDiff(d: ModelDiff): string[]
```

Returns the difference as readable lines. **The wording is English** — the only text that is not is a value written in the model, such as a room name. **The order is the canonical order `semanticDiff` fixed**, and an empty diff gives an empty array.

Three signs:

| Sign | Meaning |
|---|---|
| `+` | added |
| `−` | removed |
| `±` | changed |

Only a rename has no sign; it reads `renamed <before> → <after> (uid:…)`.

Space paths **come out in level order**: where the first segment is a level, they sort by (the rest of the path, the ordinal of the level), so spaces born from a span expansion (`/L4/A/ldk` … `/L10/A/ldk`) sit together, storey by storey.

## See also

- [Canonical JSON](canonical.md) — the format whose equality is equivalent to an empty diff
- [Generating identity](identity.md) — the `uid` that survives a rename
- [`koyu diff`](../cli/diff.md) — the same diff from the command line
