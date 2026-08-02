---
title: koyu layers
mode: reference
---

# koyu layers

Lists the layers that took part in composition, weakest first, and with `--attrs` says which layer gave each final attribute value. **It exists so you can see, with your eyes, that no resolution anywhere is implicit.**

## Arguments

```text
koyu layers <entry.muro> [--attrs]
```

Takes one entry path.

## Flags

| Flag | Effect |
|---|---|
| `--attrs` | Lists the provenance of each attribute's final value, by layer index and file |

## Output

The layers come out in the order of the `import` lines, flattened depth-first. **The entry is index 0 and the weakest; later layers are stronger.**

```sh
npx tsx src/cli.ts layers examples/house/main.muro
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/house/main.muro
  1	<absolute path>/examples/house/assets.muro
  2	<absolute path>/examples/house/site.muro
  3	<absolute path>/examples/house/L1.muro
  4	<absolute path>/examples/house/L2.muro
```

(`<absolute path>` stands in for the resolved absolute path; the real output prints it in full.)

**Strength is not scan order.** Lines in the entry that sit below the `import` lines do not make the entry stronger — it stays index 0. If order decided it, moving an `import` line up or down would change the result.

Importing the same layer twice composes it once, keeping its first position.

A file with no `import` shows exactly one layer.

```sh
npx tsx src/cli.ts layers examples/two-rooms.muro
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/two-rooms.muro
```

## --attrs — where a value came from

After the layer list, `--attrs` lists **the attributes whose provenance moved because of an override.**

```muro-part
# main.muro — the base layer
import ./plan.muro        # layer 1
import ./as-built.muro    # layer 2 — the stronger of the two
```

```muro-part
# as-built.muro — layer 2
over /L1/a h:2250 spec:改修後
over /L1/a /L1/b t:200
```

```sh
npx tsx src/cli.ts layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/main.muro
  1	<absolute path>/plan.muro
  2	<absolute path>/as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 <absolute path>/as-built.muro
  space:/L1/a:h	← 2 <absolute path>/as-built.muro
  space:/L1/a:spec	← 2 <absolute path>/as-built.muro
```

The left column is `<kind>:<subject>:<attribute key>`. The kind is one of `space`, `zone`, `boundary`, `level`, `asset`; a boundary's subject is its two paths joined with `|`. To the right of the arrow are the layer index and its file.

Rows are sorted by the left column.

**In a building that writes no `over` at all, this section is just the heading.** Provenance is recorded when a value becomes the subject of an override; an attribute nobody has touched since it was defined does not appear. None of the bundled examples uses `over`, so `--attrs` leaves `Attribute provenance:` empty for all of them.

```sh
npx tsx src/cli.ts layers examples/tower/main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/tower/main.muro
  1	<absolute path>/examples/tower/assets.muro
  2	<absolute path>/examples/tower/site-geometry.muro
  3	<absolute path>/examples/tower/site.muro
  4	<absolute path>/examples/tower/L1.muro
  5	<absolute path>/examples/tower/L2.muro
  6	<absolute path>/examples/tower/typical.muro
  7	<absolute path>/examples/tower/L3.muro
  8	<absolute path>/examples/tower/L11.muro

Attribute provenance:
```

## When composition stops

A state in which the strength order does not settle stops before the model is built, so `layers` never gets that far: it prints a single `✖` and exits 1. **One layer holding two opinions about the same attribute is an error** — nothing decides which wins, which follows directly from leaving no implicit resolution.

The same goes for an `over` whose target does not exist, a `drop` whose target does not exist, and duplicated space paths or asset names: all of them stop ahead of composition.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | The layer list came out |
| 1 | It could not be read because of a syntax or composition error |
| 2 | No file path was given (usage is printed) |

**Zero layers cannot happen here.** The CLI composes from files, so the entry itself is always layer 0.

## See also

- [koyu diff](diff.md) — comparing two composed models in the language of composition
- [koyu check](check.md) — the consistency check after composition succeeds
- [.muro reference](../muro/index.md) — how to write `import`, `over` and `drop`
- [The koyu command](index.md) — the entry and how `import` resolves
