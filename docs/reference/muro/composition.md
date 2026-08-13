---
title: Composition — layer strength and the six rules
mode: reference
---

# Composition — layer strength and the six rules

**Composition exists for time and for division of labour, not for size.** Writing in parts, writing an exception as a difference, laying as-built over the plan — these are what composition is for. Files are not split because a building is large.

Composition keeps six rules. **It is usable only when all six hold.** The consequence of any one being absent is that the same input yields a different result, and that is not an original.

---

## Rule 1 — Layers carry a declared order of strength

**The order of the `import` lines is the declaration of strength.** The tree of nested imports flattened depth-first is the layer order, and **later layers are stronger**. The entry is index 0 and the weakest. A layer imported twice keeps its first position — it is composed only once.

```muro-part
muro 1.3
grid X 0 4000 8000
level L1 0 h:2700 slab:300
import ./plan.muro        # layer 1
import ./as-built.muro    # layer 2 — this one is stronger
```

**Strength is not scan order.** A line in the entry written after the `import` lines is still at index 0. Deciding by scan order would mean that moving an `import` line up or down changes the result.

```muro-part
# main.muro — this over is scanned last, and is still the weakest opinion
import ./plan.muro
over /L1/a h:9999
```

If `plan.muro` says `space /L1/a room X1..X2 Y1..Y2 h:2500`, the composed `h` is **2500**. The layer that defined it (index 1) is stronger than the entry (index 0).

`layers` prints the order.

```text
$ koyu layers <entry.muro>
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro
```

## Rule 2 — For a single value, the strongest layer's opinion wins

Thickness, specification, use, storey height — every override is explained by one rule.

```muro-part
over /L1/a h:2400 spec:as-built
over /L1/a /L1/b t:150 type:open
over level L1 h:2900
over asset SD1 w:900
```

`over` takes a space, a zone, a boundary, a level, or an asset. **The kind of target follows from how the line is written** — one path is a space (a zone if no space has it), two paths a boundary, and `level` or `asset` followed by a name the corresponding element. The spelling and the constraints are in [over / drop](over-drop.md).

Strength is compared **per attribute**. A stronger layer holding an opinion about `h` does not silence a weaker layer's `spec` if the stronger layer says nothing about `spec`.

**It is an error for one layer to hold two opinions about the same attribute.** Which one wins would be undetermined, and that is the direct consequence of leaving no implicit resolution.

```text
$ koyu check main.muro
✖ e3.muro:line 2: One layer holds two opinions about h on /L1/a (which one wins is undetermined)
```

The same error appears when a definition and an `over` inside one layer touch the same attribute. An override is something one layer does **to another**.

## Rule 3 — Sets compose through declared edits

**No implicit merge.** Everything about which several layers may hold an opinion at the same place — openings, `seg`, `area`, columns — belongs to this rule.

```muro-part
over /L1/a /L1/b
  - door D2                              # remove
  = door D1 w:1000                       # replace (only the attributes written)
  + window w:600 h:1200 at:0.9 name:W1   # add
drop /L1/store                           # a space (its relations go with it)
drop /L1/a /L1/b                         # a boundary
drop column C1                           # a column declaration
```

**Identity is "the containing object plus a name unique within it."** An element without `name:` cannot be the target of an edit — there is no word with which to point at it. An element added with `+` requires `name:`; a duplicate name inside the same container is an error, and so is a name that `-` or `=` cannot resolve uniquely.

**Rule 3 makes ordinary what used to be treated as special.** Anything about which several layers may hold an opinion is resolved by a declared edit rather than an implicit winner. **What is special is the kind of value, not the rule.** No dedicated syntax is created.

## Rule 4 — Definition and override are distinguished

| | Statement | When the target exists | When it does not |
|---|---|---|---|
| **Definition** | `space` `boundary` `zone` `asset` `level` `polygon` `column` `origin` `azimuth` | **error** (duplicate) | defines it |
| **Override** | `over` | overrides it | **error** |

They are different statements, and which is which follows from how they are written. Adding an opinion to something that does not exist is usually a misspelling, or a mistaken idea of the layer order.

**Not every definition can be overridden.** `over` takes a path, a level or an asset, so `polygon`, `origin` and `azimuth` are outside its reach: a site outline and the frame it sits in are given once and are not argued with layer by layer. To study the same design against a different given, write a second entry that imports the same design layer.

```text
$ koyu check main.muro
✖ e1.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

```text
$ koyu check main.muro
✖ e4.muro:line 1: Duplicate space path: /L1/a (first seen in plan.muro at line 1)
```

## Rule 5 — The same input always yields the same result

The input includes **the declaration of the layers and their order**. The same entry always yields the same list of layers, and the same list of layers always yields the same model.

**No trace of an override survives into the composed model or the canonical JSON.** A model brought to `h:2400` by `over` and a model written with `h:2400` from the start yield the same canonical JSON. What the canonical form answers is "is this the same building", not "how was it written".

The same holds for `import`, `stack`, span expansion and bands: each is expanded into ordinary declarations during composition and leaves nothing in the machine format.

## Rule 6 — Provenance can be followed

The layer that gave the final value can be named.

```text
$ koyu layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
  space:/L1/a:spec	← 2 as-built.muro
```

The provenance key is `<kind>:<subject>:<attribute>`. The kind is one of `space`, `zone`, `boundary`, `level`, `asset`, and a boundary subject is spelled `<pathA>|<pathB>`. Through the API the same keys live in `model.attrSrc`, whose values are indices into `model.layers`.

---

## Collisions and errors

A state in which the resolution of the composition is undetermined **stops before the model is assembled**. It sits at the same layer as a JSON parser rejecting broken JSON, and is not something reported afterwards as a diagnostic. Under `check --json` these appear as `SYN01`, carrying the line and — when composing — the file.

| State | Treatment |
|---|---|
| Duplicate space path, zone path, asset name, or site shape | error (with both origins) |
| Re-declaring `grid` / `name` / `koyu` | error (`name` may repeat with the same string) |
| `over` with no target / `drop` with no target | error |
| One layer holding two opinions about the same attribute | error |
| A set edit with no name, an ambiguous name, or a duplicate name | error |
| Importing the same file twice, or a cycle | idempotent (composed once) |

## What is not composed

- **Alternatives** — several schemes are not folded into one file. Branching belongs to git
- **Nested asset references** — an asset does not reference an asset
- **Per-layer namespace prefixes** — the path hierarchy is already a namespace
- **Partial loading of a layer** — a layer is composed whole

## The words of composition are 1.0 words

`over`, `drop` and the set edits `+` / `-` / `=` arrived in muro 1.0. Writing one of them in a file that declares `koyu 0.5` or earlier is stopped by `check` as **VER04** (an error).

Read as code plus message, the diagnostics `check --json` returns look like this.

```text
VER04  A koyu 0.5 file uses a 1.0 word: over /L1/a h:2500 (a composition override) — raise the version to koyu 1.0
VER04  A koyu 0.5 file uses a 1.0 word: drop /L1/b (a composition removal) — raise the version to koyu 1.0
```

A file with no version declaration is read as `1.1` — frozen, not following the newest — so it never sees this diagnostic. The accepted versions are `0.1`, `0.2`, `0.3`, `0.4`, `0.5`, `1.0`, `1.1`, `1.2` and `1.3`, and older-to-newer runs in that order.

## See also

- [import](import.md) — the word that reads a layer, and how the order is built
- [over / drop](over-drop.md) — the spelling and constraints of overriding, removing and set edits
- [stack](stack.md) — declaring relations across storeys at once, and span expansion
- [koyu check](../cli/check.md) — the gate, run against the composed model
- [koyu layers](../cli/layers.md) — prints the layer order and attribute provenance
