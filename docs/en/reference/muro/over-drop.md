---
title: over / drop — overriding and removing
mode: reference
---

# over / drop — overriding and removing

`over` replaces attributes on something that already exists; `drop` removes something that already exists. The `+` / `-` / `=` lines written indented directly under `over` edit a **set** — openings, `seg`, `area`.

All three are muro 1.0 words. Writing one in a file that declares `koyu 0.5` or earlier is stopped by `check` as **VER04** (an error).

## The kind of target is read from the shape of the line

Neither `over` nor `drop` has a word that says "this is a space". **The shape of the line decides the kind.**

| How it is written | Target |
|---|---|
| `over /path …` | A space. If no space has that path, a **zone** |
| `over /pathA /pathB …` | A boundary (the relation joining two space paths) |
| `over level <name> …` | A level |
| `over asset <name> …` | A door or window asset |
| `drop /path` | A space; a zone if no space has that path |
| `drop /pathA /pathB` | A boundary |
| `drop column <name>` | A column declaration |

A path is recognised by its leading `/`; `level` and `asset` by the word at the head of the line. Three or more paths is an error.

```text
✖ x.muro:line 1: Too many paths on the over target: /L1/a /L1/b /out
✖ x.muro:line 1: over takes the form over /path … / over /pathA /pathB … / over level <name> … / over asset <name> …
```

## over — replacing attributes

```muro-part
over /L1/a h:2400 spec:as-built      # a space
over /site area:1097.80              # a zone (no space carries that path)
over /L1/a /L1/b t:150 type:open     # a boundary
over level L3 h:2600                 # a level
over asset SD1 w:900 style:hinged    # an asset
```

**`over` is not a definition.** If the target has not already been composed, it is an error.

```text
✖ e1.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

Adding an opinion to something that does not exist is usually a misspelling, or a mistaken idea of the layer order.

`over` reaches the typed fields the parser lifts out of the attributes as well as the free ones — a boundary's `type`, `t`, `air` and `edge`, and a level's `h`, `slab` and `underground` can all be overridden.

**Only three words may be overridden on a level.**

```text
✖ x.muro:line 1: Only h / slab / underground may be overridden on a level: spec
```

### When one pair of spaces carries several boundaries

The same pair of spaces may carry several boundaries, each limited to an edge with `edge:`. `over /L1/a /L1/b t:250` reaches **every boundary between that pair**. There is no word for singling one of them out.

### A default wall cannot be overridden

A `wall` boundary is derived between touching spaces even when none is written. That default is built **after every layer has been composed**, so it does not exist yet while `over` is running.

```text
✖ o.muro:line 1: No such boundary for over: /L1/a | /L1/b
```

A wall that needs a thickness or a specification is declared as a `boundary` rather than left to the default.

### Strength

Which layer's `over` wins is decided by the layer order. **Later layers are stronger.** One layer holding two opinions about the same attribute is an error. The rules are in [the rules of composition](composition.md).

## Set edits — `+` / `-` / `=`

Things about which several layers may hold an opinion at the same place — openings, `seg`, `area` — are never merged implicitly. **A declared edit** is written indented directly under `over`.

```muro-part
over /L1/a /L1/b
  - door D2                              # remove
  = door D1 w:1000                       # replace
  + window w:600 h:1200 at:0.9 name:W1   # add
```

**Nothing else may sit directly under `over`.**

```text
✖ x.muro:line 2: Only + (add) / - (remove) / = (replace) may sit directly under over: door
```

Which set can be edited depends on the target.

| Target of `over` | What can be edited |
|---|---|
| A boundary | `door` / `window` / `seg` |
| A space | `area` |
| A zone, a level, an asset | Nothing |

```text
✖ x.muro:line 2: over on a space edits area: door
```

### Identity is the container plus a name unique within it

`-` and `=` point at a member **by name**. A member without `name:` cannot be edited — there is no word with which to point at it.

```muro-part
boundary /L1/a /L1/b t:120
  door w:900 name:D1     # named — editable later
  door w:800 at:0.8      # unnamed — nothing can point at it
```

A member added with `+` requires `name:`. A duplicate name inside the same container is an error, and so is a name that `-` or `=` cannot resolve uniquely.

```text
✖ e2.muro:line 2: A door added with + requires name: (it is the name later statements point to)
✖ x.muro:line 2: Duplicate door name: D1
✖ x.muro:line 2: No such door: D9
✖ x.muro:line 2: The door name D9 is not unique
```

### What `=` actually replaces

`=` is **not a wholesale replacement** — the name stays and only the attributes written are replaced. The dimensions it reaches are `w:` and `h:`.

```muro-part
over /L1/a /L1/b
  = door D1 w:1000        # the width becomes 1000
```

**Position (`at:`) and edge (`edge:`) are not moved by `=`.** Written there they survive as attributes of the member, but the opening does not move. To move one, remove it and write it again.

```muro-part
over /L1/a /L1/b
  - door D1
  + door w:900 at:0.2 name:D1
```

## drop — removing

**What goes is exactly what was written to go.**

```muro-part
drop /L1/store        # a space
drop /L1/a /L1/b      # a boundary
drop column C1        # a column declaration
```

A missing target is an error. It never silently does nothing.

```text
✖ x.muro:line 1: No such target for drop: /L1/nowhere
✖ x.muro:line 1: No such column: C9
```

`drop` takes exactly four kinds of target: a space, a zone, a boundary, a column. Assets and levels cannot be dropped.

```text
✖ y.muro:line 1: drop takes the form drop /path / drop /pathA /pathB / drop column <name>
```

### Dropping a space drops its relations

A boundary exists only **between** two spaces. So when a space goes, every boundary with that space at an end goes with it. The rest are untouched.

### Dropping a boundary can bring the wall back

`drop /L1/a /L1/b` removes the **declaration**. If the two spaces touch in plan, a default `wall` is derived after composition and a wall stands there anyway. What is lost is the thickness, the specification, and **the openings that boundary carried**.

Drop a wall that held a door and an unbroken default wall remains — the way through is gone.

### drop column refuses an ambiguous name

A column's identity is a name too. If two column declarations carry the same name, which one to remove was never written, so `drop` **refuses rather than silently removing both**.

```muro-part
column 700 L1 x:X1,X2 name:C1
column 600 L1 x:X3 name:C1
drop column C1
```

```text
✖ dropcol.muro:line 1: The column name C1 is not unique
```

Give them different names and it passes. It is the same discipline as the set edits on openings and `seg`.

## No trace of an override survives

**Neither `over` nor `drop` survives into the composed model or the canonical JSON.** A building brought to `h:2400` by `over` and a building written with `h:2400` from the start yield the same canonical JSON. A dropped space is indistinguishable from one that was never written.

What the canonical form answers is "is this the same building", not "how was it written".

To find out which layer gave the final value, read the provenance recorded during composition.

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

## See also

- [The rules of composition](composition.md) — strength, definition versus override, determinism, provenance
- [import](import.md) — the word that reads a layer, and how the order is built
- [boundary](boundary.md) — declaring boundaries and their openings
- [space](space.md) — declaring spaces and `area`
- [koyu layers](../cli/layers.md) — prints which layer gave the final value
