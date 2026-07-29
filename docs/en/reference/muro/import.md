---
title: import — reading a layer
mode: reference
---

# import — reading a layer

`import` is the one word for writing a single building across several files. Each line reads one layer, and the layers it reads are composed into a single model.

```
import <relative path>
```

The path is **relative to the file it is written in**, not to the working directory the command runs from. The extension is written out.

```muro-part
import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

## One file is one layer

koyu has no statement that declares a layer. **A file simply is a layer.** `import` is the statement that reads a file, and at the same time the statement that pushes one layer onto the stack.

The file the reading starts from is the **entry**. `koyu check` and `koyu plan` are always given the entry; the `import` lines are followed automatically.

`examples/house/` splits one house across five files.

| File | What it holds |
|---|---|
| `main.muro` | The entry — version, building name, unit, grid, levels, the `import` lines, and the relations that cross storeys |
| `assets.muro` | Door and window assets — the layer that corresponds to a door schedule |
| `site.muro` | The site and the exterior spaces, the wall and the gate |
| `L1.muro` | The spaces and boundaries of the ground floor |
| `L2.muro` | The spaces and boundaries of the first floor |

```text
$ koyu check examples/house/main.muro
✔ Consistent — 13 spaces / 31 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## The layer order is the tree flattened depth-first

`import` nests — a layer that has been read may itself write `import`. **The layer order is that tree flattened in depth-first pre-order.**

A parent enters the list before its children. Everything reached through one `import` line comes before the **next** `import` line beside it.

```muro-part
# main.muro
import ./a.muro     # a imports b from inside itself
import ./c.muro     # c imports b as well
```

```text
$ koyu layers main.muro
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	a.muro
  2	b.muro
  3	c.muro
```

Index 0 is the entry. The entry enters the list before any file it reads.

**A layer imported twice keeps its first position.** Above, `b.muro` is read from both `a.muro` and `c.muro`, but appears once, at the index it first reached — 2. Double imports and cycles are idempotent and are not errors: a layer is composed exactly once.

**"The same layer" is decided by filesystem identity, not by spelling.** A path that goes through a symlink, and a different spelling on a case-insensitive filesystem (`b.muro` and `B.muro`), are the same layer as long as they name the same file. Counting by spelling would compose one file twice and collide with the once-only declaration of `grid X` — idempotence would break on nothing more than how the path was written.

This order is not decoration. **Later layers are stronger, and the index is the strength.** When two layers hold an opinion about the same attribute, the index decides which wins. The rules of strength are in [the rules of composition](composition.md).

## What is declared exactly once

The declarations that express the consistency of the building as a whole must appear **exactly once** somewhere in the composition.

| Declaration | Discipline |
|---|---|
| `koyu <version>` | **In the entry only**, once. Re-declaring it is an error even with the same version |
| `name` | Once. **Re-declaring it with the same string is allowed** |
| `unit mm` | May be written any number of times (only the value is checked) |
| `grid X` / `grid Y` | Once per axis |
| `level` | A duplicate name is an error. **It may live in any layer** |

```text
$ koyu check main.muro
✖ l.muro:line 1: The koyu version is declared only in the base layer (the entry)
```

```text
$ koyu check main.muro
✖ l.muro:line 1: grid Y is declared once (in the base layer when composing)
```

`grid` and `level` pass even when they are not in the entry. What matters is not the place but the **order**: both must be composed **before anything that uses them**. By convention they sit in the entry, or in the one base layer the entry imports first.

## A layer cannot be read on its own

A layer written as a share of the work has neither `grid` nor `level`, so handing that file alone to `check` cannot work.

```text
$ koyu check examples/house/L1.muro
✖ examples/house/L1.muro:line 3: Undeclared level: level:L1
```

**Checking is always done against the entry.** `check`, `plan`, `stats`, `json` — give any of them the entry and they see the composed model.

## Forward references

`boundary` **may reference a space forward**. A relation that crosses storeys can be written in the entry and still resolve against spaces imported afterwards.

```muro-part
# main.muro — the spaces arrive with the imports below
boundary /home/hall1 /home/hall2 type:stair

import ./L1.muro
import ./L2.muro
```

`over` and `drop` are the opposite: **their target must already be composed.** An override is not a definition, so a line with no target is an error. See [over / drop](over-drop.md).

## What may live in a layer

Spaces, boundaries, zones, assets, the site shape, columns, `stack` — every definition may live in any layer. Cut the files along the division of labour. By storey works; so does by doors, by site, by services.

The site shape (`polygon`) is a survey given rather than a product of design, so the standard way to write it is to isolate it in a layer that holds nothing but that one line. `examples/tower/site-geometry.muro` has exactly that shape.

## import does not survive

The canonical JSON is the single composed model, and **no trace of `import` remains in it**. A building written across five files and the same content written in one file yield the same canonical JSON. How the layers were cut is the author's business, not a property of the building.

## Errors

| State | What comes out |
|---|---|
| The file cannot be read | `Cannot read file: ./missing.muro` |
| A duplicate space path, zone path or asset name | An error that **names the provenance of both, as `file:line`** |
| Re-declaring `grid` / `name` / `koyu` | An error |
| A double import, or a cycle | Not an error (composed once) |

```text
$ koyu check main.muro
✖ e4.muro:line 1: Duplicate space path: /L1/a (first seen in plan.muro at line 1)
```

A path is identity itself. A different space gets a different path. When an asset name collides, either gather the assets into one layer, give the second one another name, or override the attributes at the point of reference.

These stop **before the model is assembled**. They sit at the same layer as a JSON parser rejecting broken JSON, and are not reported afterwards as diagnostics.

## From the API

`import` is a statement of file composition. `parse()`, which reads a single string, has no loader, so a string containing `import` is rejected.

```text
import is available only in file composition (parseFile / parseFiles / CLI)
```

Read from the filesystem with `parseFile`; read from a set of virtual files (a browser, say) with `parseFiles`, whose keys are POSIX-style relative paths and whose `import` resolves inside that key space.

## See also

- [The rules of composition](composition.md) — layer strength and the six rules composition keeps
- [over / drop](over-drop.md) — overriding, removing, and editing sets
- [stack](stack.md) — declaring relations across storeys at once, and span expansion
- [koyu check](../cli/check.md) — the gate, given the entry
- [koyu layers](../cli/layers.md) — prints the layer order and attribute provenance
