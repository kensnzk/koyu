---
title: koyu diff
mode: reference
---

# koyu diff

Compares two models **in the language of composition**. Line order, formatting, and the difference between a bare `wall` declaration and leaving it out (the default wall) are not differences. This is not a text diff; it is a diff of meaning.

## Arguments

```text
koyu diff <a.muro> <b.muro> [--json]
```

**The only subcommand that takes two file paths.** The first is the "before", the second the "after", and both are composed as entries.

## Flags

| Flag | Effect |
|---|---|
| `--json` | Writes the `ModelDiff` to stdout as JSON |

## Output

With no differences, one line.

```sh
npx tsx src/cli.ts diff examples/two-rooms.muro examples/two-rooms.muro
```

```text
No differences
```

Otherwise one line per difference: `±` for a change, `+` for an addition, `−` for a removal.

Copy `examples/two-rooms.muro` to `before.muro`, then make `after.muro` from it by changing `/L1/b`'s `name:居室B` to `name:書斎` and the door between the two rooms from `w:780` to `w:900`.

```sh
npx tsx src/cli.ts diff before.muro after.muro
```

```text
± /L1/b: name 居室B → 書斎
± boundary /L1/a | /L1/b: door at:0.5 w 780 → 900
```

That `at:0.5` was never written. An opening with no position given sits at the middle of its boundary, so the diff reports it by the position that was derived.

## The shape of --json

A `ModelDiff` has seven sections. `grid` is a list of changes; the rest carry `added` / `removed` / `changed`, and `zones` and `spaces` additionally carry `renamed`.

```sh
npx tsx src/cli.ts diff before.muro after.muro --json
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
  "changed": [
   {
    "path": "/L1/b",
    "fields": [
     {
      "field": "name",
      "from": "居室B",
      "to": "書斎"
     }
    ]
   }
  ]
 },
 "boundaries": {
  "added": [],
  "removed": [],
  "changed": [
   {
    "between": [
     "/L1/a",
     "/L1/b"
    ],
    "fields": [
     {
      "field": "door at:0.5 w",
      "from": "780",
      "to": "900"
     }
    ]
   }
  ]
 },
 "columns": {
  "added": [],
  "removed": [],
  "changed": []
 }
}
```

With no differences the same skeleton comes out; every array is simply empty.

## What is not a difference

- **Line order and formatting.** Writing the same declarations in a different order, or with different whitespace, produces nothing.
- **A bare `wall` declaration versus leaving it out.** The default between touching spaces is a wall, so `boundary /L1/a /L1/b` written or omitted gives the same effective boundary. Boundaries are compared as effective sets.
- **How the building was split into layers.** What is compared is the composed model.
- **The trace of `over`.** A model set to `h:2400` by an `over` and a model written with `h:2400` from the start are the same.

## Renames

Something whose `uid` matches while its path differs is reported as a **rename**, not as a removal plus an addition. Renaming an element that has no `uid` looks like a removal plus an addition.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | No differences |
| 1 | There are differences |
| 2 | The input is broken by a syntax or composition error / the second file was not given |

**Only `diff` reads 0/1 this way.** [`check`](check.md)'s 0/1 is "does it hold together"; `diff`'s 0/1 is "are they the same". Do not swap them when both are in CI.

Broken input gives 2, not 1: the question of whether they differ went unanswered, so calling it "there are differences" would be a lie.

```sh
npx tsx src/cli.ts diff broken.muro after.muro
```

```text
✖ <absolute path>/broken.muro:line 2: Undefined grid line name: Y1
```

Forgetting the second file prints usage.

```sh
npx tsx src/cli.ts diff before.muro
```

```text
Usage: koyu diff <a.muro> <b.muro> [--json]
```

## Comparing against the committed version

```sh
git show HEAD:examples/two-rooms.muro > before.muro
npx tsx src/cli.ts diff before.muro examples/two-rooms.muro
```

```text
No differences
```

**This trick does not work for a model split into layers.** `diff` composes the layers from the entry, so a single extracted file placed elsewhere cannot resolve its relative `import`s. To compare split models, check out the old tree whole with `git worktree` and pass both base-layer paths.

## See also

- [koyu json](json.md) — the canonical JSON the diff rests on
- [koyu layers](layers.md) — which layers composed, and in what strength order
- [koyu check](check.md) — the other gate, where 0/1 means something else
- [The koyu command](index.md) — the shared promises about exit codes
