---
title: name / unit — the building name and the unit
mode: reference
---

# name / unit — the building name and the unit

Both are optional; a file with neither still passes `check`. If you write one, you write it **once** — a second, different opinion is an error rather than a silent overwrite.

## name — the building name

```muro-part
name 街角の複合ビル
```

`name` takes **the whole rest of the line** as its value. The rest is split into neither positionals nor `key:value`, so a name with spaces in it is written as-is. Write `name 3F改修 h:2600` and the `h:2600` is part of the building's name — there are no attributes on this line.

The line is read like any other line: everything after `#` is a comment, quotation marks `"` are stripped, and runs of whitespace collapse to one space.

```muro
name  街角の  複合ビル # 仮称
unit mm
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

The building's name here is `街角の 複合ビル`.

```text
$ npx tsx src/cli.ts json nm.muro
{
  "format": "koyu-canonical/2.0",
  "name": "街角の 複合ビル",
  "unit": "mm",
```

An empty value is an error.

```text
✖ nm.muro:line 1: name takes a value
```

### Once

A model has one building name. **Re-declaring the identical string is accepted; a different string is an error** — letting the later line win silently would make it unreadable which of the two was the building's name.

```muro-bad
name A
name B
grid X 0 3600
grid Y 0 4000
```

```text
✖ n2.muro:line 2: name is declared once (already "A" — in the base layer when composing)
```

The discipline is the same when composing: **once across all layers**. It may sit in the entry or in an imported layer, but if two layers claim different names it is an error, and the provenance of the later one is shown. Keeping the foundation declarations (`koyu` / `name` / `unit` / [grid](grid.md) / [level](level.md)) together in the entry is the readable arrangement.

### The declaration `name` is not the attribute `name:`

The declaration `name` is the name of the **building**, and there is one per model. The attribute `name:` is the display name of a [space](space.md), a [zone](zone.md), a [subdivision](area.md), an opening, and so on — one per element. They merely look alike; where they can be written and how many there are both differ.

```muro-part
name 街角の複合ビル                      # the building's name — the whole rest of the line
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール   # a space's display name — an attribute
```

In the canonical JSON the first is the top-level `"name"` and the second is the element's `attrs.name`. Neither key is emitted when it was not written.

## unit — the unit

```muro-part
unit mm
```

The only unit is mm. Any other word is an error.

```text
✖ n3.muro:line 1: The only unit in v0 is mm: m
```

This line is an assertion rather than a declaration: writing it or omitting it leaves the model identical. The canonical JSON emits `"unit": "mm"` either way.

The whole unit convention is this one table.

| Quantity | Unit |
|---|---|
| Length (coordinates, dimensions, wall thickness, ceiling height, opening width) | mm |
| A position along a segment | a ratio in 0..1 |
| Reported area | m² (to the wall centerline) |
| Angle | not writable — direction is carried by the [grid](grid.md) and the edge names (N/E/S/W) |

A decimal such as `0.1` may appear in a length, but the offset in a [grid reference](positions.md) is an integer only (`X2+600.5` is rejected as an undefined grid line name).

## Where they go

Neither line is indented. `name` and `unit` may sit anywhere among the other declarations, but `grid` and `level` have to precede their **use**, which in practice fixes the opening of a file to this order.

```muro-part
muro 1.4
name 街角の複合ビル
unit mm
grid X 0 6400 12800
grid Y 0 5600
level L1 0 h:3600 slab:600
```

For the version line, see [koyu &lt;version&gt;](version.md).
