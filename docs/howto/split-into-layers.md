---
title: Split a building into layers
mode: howto
---

# Split a building into layers

Cut one `.muro` into layers and compose them with `import`. Divide the writing, write exceptions as differences, and let collisions fail the build.

**Composition is for time and for division of labour, not for size.** You do not split a building because it is large. You split it to share the writing, to write an exception as a difference, and to lay as-built over plan.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- One `.muro` file passes [`koyu check`](../reference/cli/check.md) with zero errors.
- You have some idea of the unit of division: storeys, site, joinery, as-built.

## 1. Choose the base layer (the entry)

The facts about the whole building — the version, `name`, `unit`, `grid`, `level` — are declared **exactly once** by the base layer. The file that gathers them is the entry.

```muro-part
# main.muro
koyu 1.1
name A small office
unit mm

grid X 0 6400 12800
grid Y 0 8400

level L1 0 h:2800 slab:400
level L2 4200 h:2800 slab:400
level R 8400 slab:400
```

## 2. Cut the rest into layers and import them

Spaces, boundaries, zones, assets and site outlines may live in any layer. Cut along the division of labour.

```muro-part
import ./assets.muro
import ./L1.muro
import ./L2.muro
import ./as-built.muro
```

An `import` path is **relative to the file that writes it**, not to the working directory at run time. Import the same file twice, or import in a cycle, and composition still happens once: it is idempotent.

## 3. Layers have strength — later is stronger

**The order of the `import` lines is the declaration of strength.** Flatten depth-first and that sequence is the layer order: the entry is index 0 and the weakest, and **each later layer is stronger**.

```text
$ npx tsx src/cli.ts layers main.muro
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	assets.muro
  2	L1.muro
  3	L2.muro
  4	as-built.muro
```

**Strength is not reading order.** Declarations in the entry that sit below the `import` lines do not make the entry stronger — it stays index 0. If order decided it, moving an `import` line up or down would change the result.

## 4. Replace values from a stronger layer — over

`over` replaces attributes on something that already exists. It takes spaces, zones, boundaries, levels and assets, and **the shape of the line decides which** — one path means a space (or a zone if no space has that path), two paths mean a boundary, `level` or `asset` followed by a name mean those.

```muro-part
# as-built.muro — the survey laid over the plan
over /L1/office h:2600 spec:As-built
over /L1/office /L1/core t:150
```

**`over` is not a definition.** If the target has not already been composed, it errors.

```text
✖ as-built.muro:line 6: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

**One layer holding two opinions about the same attribute is an error**, because which one wins would be undetermined.

```text
✖ as-built.muro:line 6: One layer holds two opinions about h on /L1/office (which one wins is undetermined)
```

How targets are named, and how far `over` reaches, is in [over / drop](../reference/muro/over-drop.md).

## 5. Sets compose through explicit edits — `+` / `-` / `=`

**Nothing merges implicitly.** For anything where several layers can hold opinions about the same slot — openings, `seg`, `area`, columns — write the edit indented under `over`.

```muro-part
over /L1/office /out
  = window W-1F w:1800                       # replace (only the attributes written)
  + window w:900 h:1800 at:0.8 name:W-1F-b   # add
over /L2/office /L2/core
  - door D2                                  # remove
```

**Identity is "the container plus a name unique within it".** An opening without a `name:` cannot be edited — there is no word that points at it. Anything added with `+` needs a `name:`. Naming as identity is covered in [Survive a rename](survive-a-rename.md).

Compose a layer carrying `- door D2` and the door is gone.

```text
$ npx tsx src/cli.ts doors main.muro /L2/office /out
2 doors — /L2/office → /L2/core → /L1/core → /out

$ npx tsx src/cli.ts doors main.muro /L2/office /out   # after the - door D2 layer
Cannot reach /out from /L2/office
```

## 6. Remove things whole — drop

```muro-part
drop /L2/office        # a space, and its relations with it
drop /L1/a /L1/b       # a boundary
drop column C1         # a column declaration
```

An absent target is an error.

```text
✖ as-built.muro:line 6: No such target for drop: /L2/nowhere
```

Dropping a space drops the boundaries it held. [`koyu diff`](../reference/cli/diff.md) says so.

```text
$ npx tsx src/cli.ts diff main.muro dropped/main.muro
− space /L2/office (room 53.76 m2)
− boundary /L2/core | /L2/office
− boundary /L2/office | /out edge:W
```

## 7. Definition and override are different statements

| | Statement | Target exists | Target does not exist |
|---|---|---|---|
| **Define** | `space` `boundary` `zone` `asset` `level` `polygon` | **error** (duplicate) | defines it |
| **Override** | `over` | overrides it | **error** |

They are two statements, told apart by how they are written. Adding an opinion about something that does not exist is almost always a misspelling or a misunderstanding of the layer order.

## Check it

`check` the entry. Imports are followed automatically and the composed building comes back. **This is the gate on the build of the whole building.**

```text
$ npx tsx src/cli.ts check main.muro
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Which layer supplied which value is what `--attrs` answers. The same thing is on the API as `model.attrSrc`, keyed `<kind>:<target>:<attribute>` with the layer index as the value.

```text
$ npx tsx src/cli.ts layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	assets.muro
  2	L1.muro
  3	L2.muro
  4	as-built.muro

Attribute provenance:
  boundary:/L1/office|/L1/core:t	← 4 as-built.muro
  space:/L1/office:h	← 4 as-built.muro
  space:/L1/office:spec	← 4 as-built.muro
```

**The machine form keeps no trace of the overriding.** A model set to `h:2600` by an `over` and a model that said `h:2600` from the start give the same canonical JSON. The canonical form answers "is this the same building", not "how was it written".

## Do not check a layer on its own

A layer file has no `grid` and no `level`, so it cannot be read alone.

```text
$ npx tsx src/cli.ts check L1.muro
✖ L1.muro:line 1: Undefined grid line name: X1
```

**Always check the entry.**

## When layers collide

Two layers declaring the same thing is an error, and the error names both origins as `file:line`. These are not diagnostics: they **stop before the model is assembled**, in the same place a JSON parser rejects broken JSON.

**A duplicate space path**

```text
✖ L2.muro:line 9: Duplicate space path: /L1/office (first seen in L1.muro at line 1)
```

The path is the identity. A different space gets a different path.

**Redeclaring `grid`, `name` or the version** — usually from making a layer runnable on its own. It is an error even when the values agree.

```text
✖ L2.muro:line 1: grid X is declared once (in the base layer when composing)
```

**A duplicate asset name** — from writing the joinery types once per layer.

```text
✖ L2.muro:line 9: Duplicate asset name: W1 (first seen in assets.muro at line 2)
```

Keep the assets in one layer. If a different size is needed, give it a different name or override the attribute at the reference (`window W1 h:1200`).

## What does not compose

- **Design variants.** Branching belongs to git.
- **Nested asset references.** An asset does not reference an asset.
- **Per-layer namespace prefixes.** The path hierarchy already is a namespace.
- **Partial loading of a layer.** A layer composes whole.

## A worked division

The bundled `examples/house/` splits into five files:

| File | What it holds |
|---|---|
| `main.muro` | the base layer — version, name, unit, grid, levels, the `import`s, the relations that span storeys |
| `assets.muro` | joinery assets — the door and window schedule as a layer |
| `site.muro` | the site and exterior spaces, the boundary walls and the gate |
| `L1.muro` | the ground floor's spaces and boundaries |
| `L2.muro` | the first floor's spaces and boundaries |

**Relations that span storeys — vertical boundaries and `stack` — belong to no storey's layer, so they go in the base layer.** A `boundary` may forward-reference its spaces, so those lines work whether they are written before or after the `import`s of `L1.muro` and `L2.muro`.

**Keep the site outline in a layer of its own.** A `polygon` is a survey fact, not a product of the design. `examples/tower/site-geometry.muro` is a layer whose only declaration is one `polygon` line.

## Next

- [Write a typical floor once](typical-floors.md) — exceptional storeys as difference layers
- [Survive a rename](survive-a-rename.md) — `name:` is what a set edit points at
- [Describe a site](describe-a-site.md) — where the polygon layer goes
