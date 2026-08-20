---
title: Lay measurements over the plan
mode: howto
---

# Lay measurements over the plan

The drawing says the partition is 120mm. On site it measured 150mm. The door was meant to be 900 and went in at 850, and the store room in the drawing was never built at all.

**Do not edit the plan file.** The moment you do, the distinction between "this is what the design decided" and "this is what the site did" disappears. They are two different facts, with different dates and different responsibility attached.

This is what composition in koyu is for. **Leave the plan as the plan, and lay the measurements on top.**

Every output below was actually run. Absolute paths are abbreviated to `<dir>/`.

## Three files

```text
main.muro       ← the entry: grid, levels, and the order the layers stack in
  plan.muro     ← layer 1: the design
  as-built.muro ← layer 2: the measurements (stronger)
```

**The order of the `import` lines is the declaration of strength.** A later layer is stronger. The entry is the weakest layer (index 0).

```muro-part
muro 1.4
name 実測を重ねた事務所
unit mm

grid X 0 3600 7200 9000
grid Y 0 4500

level L1 0 h:2700 slab:200

import ./plan.muro
import ./as-built.muro
```

The plan layer. **Not one character of it changes for the rest of this page.**

```muro-part
space /L1/office office X1..X2 Y1..Y2 name:事務室
space /L1/hall   hall   X2..X3 Y1..Y2 name:玄関
space /L1/store  store  X3..X4 Y1..Y2 name:物置
space /out       name:外部 outside:1

boundary /L1/office /L1/hall t:120 spec:LGS
  door w:800 h:2000 name:D1

boundary /L1/hall /out t:150 spec:EW edge:S
  door w:900 h:2100 name:D2
```

## Write the as-built layer

Four things the site turned up, in four different ways of writing.

```muro-part
over /L1/office /L1/hall t:150 spec:LGS150-実測
over level L1 h:2660

over /L1/hall /out
  = door D2 w:850
  + window w:1200 h:900 at:0.8 name:W1

drop /L1/store
```

Line by line. The full spelling and the constraints are on [over / drop](../reference/muro/over-drop.md).

### Single values are replaced with `over`

```muro-part
over /L1/office /L1/hall t:150 spec:LGS150-実測
over level L1 h:2660
```

**The shape of the line decides what kind of thing is being targeted.** Two paths means a boundary; `level` followed by a name means a level; one path means a space (or a zone, if no space has that path). No word is needed to say "this is a boundary".

**The comparison runs per attribute.** The boundary line above holds an opinion about `t` and `spec` only. Anything else the plan wrote survives, because the stronger layer said nothing about it.

### Sets are edited explicitly

Things several layers can hold an opinion about at the same place — doors, windows — **are not merged implicitly.** Indent under `over` and state the addition, the removal or the replacement.

```muro-part
over /L1/hall /out
  = door D2 w:850
  + window w:1200 h:900 at:0.8 name:W1
```

- `=` is **not a whole replacement.** The name stays and only the written attributes change. The line above sets D2's width to 850 and leaves its height of 2100 alone.
- An element added with `+` needs a `name:` — later statements need something to point at.
- To remove one, write `- door D2`.

**Position (`at:`) and edge (`edge:`) do not move under `=`.** When a door went in somewhere else entirely, remove it and write it again.

```muro-part
over /L1/hall /out
  - door D2
  + door w:850 h:2100 at:0.3 name:D2
```

### What was never built is removed with `drop`

```muro-part
drop /L1/store
```

**When a space goes, the boundaries that had it at one end go with it.** A boundary exists only *between* two spaces. Every other boundary is untouched.

`drop` takes spaces, zones, boundaries and columns, and errors when the target does not exist. It never silently does nothing.

## Look at the composed result

```sh
koyu check main.muro
```

```text
✔ Consistent — 3 spaces / 2 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

The store room is gone, leaving three spaces. The storey height carries the measured value.

```sh
koyu levels main.muro
```

```text
L1	z:0	h:2660	slab:200
```

## See which layer won

**This is the main return on writing as-built as a layer.** The origin of every final value can be read by machine.

```sh
koyu layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<dir>/main.muro
  1	<dir>/plan.muro
  2	<dir>/as-built.muro

Attribute provenance:
  boundary:/L1/office|/L1/hall:spec	← 2 <dir>/as-built.muro
  boundary:/L1/office|/L1/hall:t	← 2 <dir>/as-built.muro
  level:L1:h	← 2 <dir>/as-built.muro
```

The provenance key is `<kind>:<target>:<attribute>`. Only the three values the measurements took away appear here — **attributes still supplied by the plan are not listed.** The list of what changed on site falls out of it directly.

## See the change as a difference

Make a second entry that composes the plan alone, and the two models can be compared directly.

```muro-part
muro 1.4
name 実測を重ねた事務所
unit mm

grid X 0 3600 7200 9000
grid Y 0 4500

level L1 0 h:2700 slab:200

import ./plan.muro
```

```sh
koyu diff plan-only.muro main.muro
```

```text
± level L1: h 2700 → 2660
− space /L1/store (store 8.10 m2)
− boundary /L1/hall | /L1/store
± boundary /L1/hall | /L1/office: t 120 → 150 / spec LGS → LGS150-実測
± boundary /L1/hall | /out edge:S: door D2 w 900 → 850 / + window W1 w:1200 h:900 name:W1
```

**That is the completion report, written out.** The exit code is 1 when there are differences and 0 when there are none, so CI can gate on "the as-built layer is still empty".

## The overrides leave no trace

Neither `over` nor `drop` appears in the composed model or in the [canonical JSON](../reference/json/index.md). A boundary set to `t:150` by an override and a boundary written as `t:150` from the start give the same canonical JSON.

```text
      "kind": "wall",
      "t": 150,
      "attrs": {
        "spec": "LGS150-実測"
      },
```

**The canonical form answers "is this the same building", not "how was it written".** When you need to know how it was written, that is when you reach for `layers --attrs`.

## Three holes that are easy to step in

### The target of `over` does not exist

```text
✖ <dir>/miss.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

**You cannot add an opinion to something that is not there.** The cause is almost always one of two things: a misspelled path, or a mistaken idea about the layer order. `over` does not define. Defining is what `space` and `boundary` do, and the two are different statements.

### One layer holds two opinions about one attribute

```text
✖ <dir>/bad.muro:line 2: One layer holds two opinions about t on boundary /L1/office|/L1/hall
```

Which one wins is undetermined, so it stops. **Overriding is something you do from another layer.** A definition and an `over` touching the same attribute inside one layer gives the same error.

### Default walls cannot be overridden

Where two spaces touch, a wall is derived even with nothing declared. That default boundary is built **after every layer has been composed**, so an `over`, which runs during composition, cannot see it.

Any wall you intend to give a measured thickness or spec must be declared as a `boundary` in the plan layer. Walls left to the default cannot be touched from the as-built layer.

## Throw the as-built layer away

Delete the `import ./as-built.muro` line and the plan is back exactly as it was. **The measurements never touched the plan, so there is nothing to restore.**

Layers stack the same way for anything else — a renovation layer, a fit-out layer, a services-replacement layer. Order is strength, so a layer added later beats the ones before it.

## Related

- [over / drop](../reference/muro/over-drop.md) — spelling and constraints of override, removal and set editing
- [Composition — layer strength and six rules](../reference/muro/composition.md) — strength, definition versus override, determinism, provenance
- [import](../reference/muro/import.md) — the one word that reads a layer, and how the layer order is built
- [koyu layers](../reference/cli/layers.md) — prints the layer order and the provenance of each attribute
- [koyu diff](../reference/cli/diff.md) — compares two models in the language of composition
