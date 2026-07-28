---
title: Composition is for time and division of labour, not for size
mode: explanation
---

# Composition is for time and division of labour, not for size

koyu has a mechanism for stacking several files into one model. **It is not a tool for "splitting because the building is large".**

A 31,606 m² mixed-use complex is 646 lines of source. It would fit in one file without splitting at all. **Composition exists for three reasons, and none of them is size.**

1. **Writing in parallel** — architecture, structure and services, or storey by storey, written by different people and different agents
2. **Writing exceptions as differences** — laying the deviations of one storey over the typical floor
3. **Stacking time** — as-built over the plan, measured values over design values

The notation is in [Composition](../reference/muro/composition.md) and [over / drop](../reference/muro/over-drop.md). This page explains why it takes that shape.

## Six rules, and it only works when all six hold

The problem with composition is not that composition exists. **It is that the order of resolution is implicit.** Implicit resolution can produce different results from the same input. That is not a source of truth.

So six rules are laid down.

**1. Layers have an explicitly declared strength order.** The sequence of `import` lines *is* the declaration, and later layers are stronger. **Strength is not scan order** — the entry file stays weakest even if its own lines come after the `import`s. If scanning decided the order, moving an `import` line up or down would change the result.

**2. For a single value, the strongest layer's opinion wins.** Thickness, specification, use, storey height — every overwrite is explained by one rule.

**3. Sets compose through explicit edits.** No implicit merging. Everything that can carry several opinions at the same seat — openings, columns, subdivisions — belongs here.

**4. Definition and overwrite are distinguished.** A layer that defines something new and a layer that only adds an opinion to something existing are written differently.

**5. The same input always yields the same result.** The input includes the declaration of layers and their order.

**6. Provenance is traceable.** Any final value can be traced to the layer and line that gave it.

## Doing it

Three layers. `main.muro` holds the given, `plan.muro` the plan, `as-built.muro` the measurements.

```muro-part
koyu 1.0
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
import ./plan.muro
import ./as-built.muro
```

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000 name:D1
boundary /L1/a /out t:150 spec:EW1
boundary /L1/b /out t:150 spec:EW1
```

```muro-part
over /L1/a /L1/b t:125 spec:PW1-実測
over /L1/a h:2380
over /L1/a /out
  + window w:1200 h:1100 edge:S name:W9
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**The difference between design values and measured values is itself the quality record.** And where any value came from can always be asked.

```sh
npx tsx src/cli.ts layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:spec	← 2 as-built.muro
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
```

## No bespoke syntax for sets

Rule 3 makes ordinary what has traditionally been special-cased.

Adding a window to a wall, removing one column declaration, replacing a dwelling's subdivision — **all of them are written with the one rule of set editing.**

```muro-part
over /L5/A/hall /L5/corridor
  - door D2                              # remove
  = door D1 w:1000                       # replace (only the attributes written are swapped)
  + window w:600 h:1200 at:0.9 name:W1   # add
drop /L5/A/store                         # a space (its relations go with it)
drop /L5/a /L5/b                         # a boundary
drop column C1                           # a column declaration
```

**What is special is the kind of value, not the rule.**

Editing requires identity. Identity is "the containing object plus a name unique within it", so **an element without `name:` cannot be edited** — there is no word for it. And a name pointing at two things is a break in identity, so an edit like `drop column C1` **refuses when the name is not unique.**

## Definition and overwrite are different statements

| | Statement | If the target exists | If it does not |
|---|---|---|---|
| **definition** | `space` `boundary` `zone` `asset` `level` `polygon` | **error** (duplicate) | defines it |
| **overwrite** | `over` | overwrites it | **error** |

```text
✖ bad.muro:line 6: No such target for over: /L1/z (place it after the layer that defines it)
```

```text
✖ bad2.muro:line 6: Duplicate space path: /L1/a (first seen in bad2.muro at line 5)
```

**Adding an opinion to something that does not exist is usually a misspelling or a mistake about layer order.** Silently creating a new space would bury that mistake under a green check.

## Traces of overwriting do not survive into the machine format

A model whose `h:2380` came from an `over`, and a model that wrote `h:2380` from the start, **produce the same canonical JSON.**

Canonical form answers "is this the same building", not "how was it written". If you want the history of how it was written, git has it ([Canonical JSON](../reference/json/index.md)).

## What is not composed

- **variants (branching options)** — branching is what git branches are for. Comparing design options is comparing branches
- **nested asset references** — an asset does not reference an asset
- **per-layer namespace prefixes** — the path hierarchy is already a namespace ([A path is an address and an aggregation hierarchy](paths.md))
- **partial loading of a layer** — a layer is composed whole

Every one of these pushes towards composition becoming unresolvable. **Holding only what keeps the six rules** is what this list means.

## "Not for size", in practice

That said, splitting does have a side effect. The bundled complex has 646 lines across ten files, and the layer holding the office storeys is 41 lines — **about 6% of the whole.** To have an agent rewrite the office storeys, that one file is all the context it needs.

**That is not the purpose of composition but something that came along with splitting for time and division of labour.** Confuse purpose with consequence and you end up with a practice of "split it when it gets big", in which the strength order of layers stops being designed at all.

## Next

- [Composition](../reference/muro/composition.md) — writing `import`
- [over / drop](../reference/muro/over-drop.md) — overwriting and set editing
- [koyu layers](../reference/cli/layers.md)
- [A path is an address and an aggregation hierarchy](paths.md)
