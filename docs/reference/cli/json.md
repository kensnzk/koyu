---
title: koyu json
mode: reference
---

# koyu json

Writes the composed model to stdout as canonical JSON. It is the ground under diffing and external integration, and the key order is stable.

## Arguments

```text
koyu json <entry.muro>
```

Takes one entry path.

## Flags

None. The output is always pretty-printed and goes to stdout, with no decoration beyond the trailing newline.

## Output

```sh
npx tsx src/cli.ts json examples/two-rooms.muro
```

```text
{
  "format": "koyu-canonical/1.1",
  "koyu": "1.0",
  "name": "二室",
  "unit": "mm",
  "grid": {
    "X": [
      0,
      3600,
      7200
    ],
    "Y": [
      0,
      4500
    ]
  },
  "levels": {
    "L1": {
      "z": 0,
      "h": 2400,
      "slab": 150
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
      ],
      "attrs": {
        "daylight": 1,
        "name": "居室A"
      }
    },
```

(The head of the output.)

**The first two keys name different versions.** `format` is the version of this JSON format itself; `koyu` is the language version written in the source. A source with no `koyu <version>` line produces no `koyu` key.

```sh
npx tsx src/cli.ts json derived.muro
```

```text
{
  "format": "koyu-canonical/1.1",
  "unit": "mm",
```

Boundaries are an array, each carrying both paths, the kind, the thickness, the attributes and the openings.

```text
  "boundaries": [
    {
      "between": [
        "/L1/a",
        "/L1/b"
      ],
      "a": "/L1/a",
      "kind": "wall",
      "t": 120,
      "attrs": {
        "spec": "PW1"
      },
      "openings": [
        {
          "kind": "door",
          "w": 780,
          "h": 2000,
          "at": 0.5
        }
      ]
    },
```

That opening's `at: 0.5` was never written. An opening with no position given sits at the middle of its boundary, so the canonical JSON writes the position that was settled.

## import does not survive

Canonical JSON is **the single composed model**. Even for a building split into layers, neither the `import`s nor the layer seams appear. Writing the same building in one file or in ten produces the same canonical JSON.

Nor does the trace of `over`. A model set to `h:2400` by an `over` and a model written with `h:2400` from the start are identical. What the canonical form answers is "is it the same building", not "how was it written".

## Default boundaries do not appear

**Canonical JSON carries only what was written; it carries no derived meaning.** You can see this with a file that declares two touching rooms and not a single `boundary`.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

```sh
npx tsx src/cli.ts check derived.muro
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```sh
npx tsx src/cli.ts json derived.muro
```

```text
  "boundaries": []
```

[`check`](check.md)'s "1 boundary" is the count on the **meaning** side, after the default wall is derived; `json`'s empty array is the count on the **written** side. They do not contradict each other. A consumer of canonical JSON derives the default boundaries itself before reading meaning into it.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Always |
| 1 | It could not be read because of a syntax or composition error |
| 2 | No file path was given (usage is printed) |

**`json` does not run `check`.** An inconsistent model still yields canonical JSON, as long as composition succeeded.

## See also

- [Canonical JSON](../json/index.md) — key-by-key reference and the stability rules
- [koyu diff](diff.md) — comparing two models in the language of composition
- [koyu check](check.md) — the side that counts derived boundaries
- [The public API](../api/index.md) — getting the same output from a program
