**English** · [日本語](../composition.md)

# The rules of composition

koyu v0.16.0 / muro 1.0. The grammar is in [language.md](language.md) §8; the normative scope is in [scope.md](scope.md).

**Composition exists for time and for division of labour, not for size.** Writing in parts, writing an exception as a difference, laying as-built over the plan — these are what composition is for. Files are not split because a building is large.

Following USD, six rules are laid down. **Composition is usable only when all six hold.** The consequence of any one being absent is that the same input yields a different result, and that is not an original.

---

## Rule 1 — Layers carry a declared order of strength

**The order of the `import` lines is the declaration of strength.** The list flattened depth-first is the layer order, and **later layers are stronger**. The entry is index 0 and the weakest. A layer imported twice keeps its first position (it is composed only once).

```muro-part
koyu 1.0
grid X 0 6400 12800
level L1 0 h:3600 slab:600
import ./plan.muro        # layer 1
import ./as-built.muro    # layer 2 — this one is stronger
```

**Strength is not scan order.** A line in the entry that sits after the `import` lines is still at index 0. Deciding by scan order would mean that moving an `import` line up or down changes the result.

```sh
koyu layers <entry.muro>            # prints the layers in strength order
```

## Rule 2 — For a single value, the strongest layer's opinion wins

Thickness, specification, use, storey height — every override is explained by one rule.

```muro-part
over /L5/A/ldk h:2600 spec:改修後
over /L5/A/hall /L5/corridor t:200 type:open
over level L3 h:2600
over asset SD1 w:900
```

`over` takes a space, a zone, a boundary, a level, or an asset. The kind of target follows from how it is written — one path is a space (a zone if no space has it), two paths a boundary, and `level` or `asset` followed by a name the corresponding element.

**It is an error for one layer to hold two opinions about the same attribute.** Which one wins would be undetermined, and that is the direct consequence of leaving no implicit resolution.

## Rule 3 — Sets compose through declared edits

**No implicit merge.** Everything about which several layers may hold an opinion at the same place — openings, segs, areas, columns — belongs to this rule.

```muro-part
over /L5/A/hall /L5/corridor
  - door D2                              # remove
  = door D1 w:1000                       # replace (only the attributes written)
  + window w:600 h:1200 at:0.9 name:W1   # add
drop /L5/A/store                         # a space (its relations go with it)
drop /L5/a /L5/b                         # a boundary
drop column C1                           # a column declaration
```

**Identity is "the containing object plus a name unique within it"** ([scope.md §5](scope.md#5-identity)). An element without `name:` cannot be the target of an edit — there is no word with which to point at it. An element added with `+` requires `name:`, and a duplicate within the same container is an error.

**Rule 3 makes ordinary what used to be treated as special.** Anything about which several layers may hold an opinion is resolved by a declared edit rather than an implicit winner. **What is special is the kind of value, not the rule.** No dedicated syntax is created.

## Rule 4 — Definition and override are distinguished

| | Statement | When the target exists | When it does not |
|---|---|---|---|
| **Definition** | `space` `boundary` `zone` `asset` `level` `polygon` | **error** (duplicate) | defines it |
| **Override** | `over` | overrides it | **error** |

They are different statements, and which is which follows from how they are written. Adding an opinion to something that does not exist is usually a misspelling, or a mistaken idea of the layer order.

## Rule 5 — The same input always yields the same result

The input includes **the declaration of the layers and their order**. The same entry always yields the same list of layers, and the same list of layers always yields the same model.

**No trace of an override remains in the machine format.** A model brought to `h:2400` by `over` and a model written with `h:2400` from the start yield the same canonical JSON. What the canonical form answers is "is this the same building", not "how was it written".

## Rule 6 — Provenance can be followed

The layer that gave the final value can be named.

```sh
koyu layers <entry.muro> --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
  space:/L1/a:spec	← 2 as-built.muro
```

Through the API it is `model.attrSrc` (keys are `<kind>:<subject>:<attribute>`, values are indices into `model.layers`).

---

## Collisions and errors

A state in which the resolution of the composition is undetermined **stops before the model is assembled** (a syntax or composition error, i.e. `SourceError`; it appears as SYN01 under `check --json`). It sits at the same layer as a JSON parser rejecting broken JSON, and is not something reported afterwards as a diagnostic.

| State | Treatment |
|---|---|
| Duplicate space path, zone path, asset name, or site shape | error (with both origins) |
| Re-declaring `grid` / `name` / `koyu` | error (even with the same value) |
| `over` with no target / `drop` with no target | error |
| One layer holding two opinions about the same attribute | error |
| A set edit with no name, an ambiguous name, or a duplicate name | error |
| Importing the same file twice, or a cycle | idempotent (composed once) |

## What is not composed

- **Variants (USD's variant)** — alternatives are not carried. Branching belongs to git
- **Nested asset references** — an asset does not reference an asset
- **Per-layer namespace prefixes** — the path hierarchy is already a namespace
- **Partial loading of a layer** — a layer is composed whole
