---
title: Counted and uncounted divisions
mode: howto
---

# Counted and uncounted divisions

The first 2m of the office, at the entrance, is a hard-floored threshold in mortar. **Is that one room or two?**

koyu treats this as a design decision and lets you write it either way. But **the consequences differ.** This page writes both and settles how to choose.

Every output below was actually run.

## Two questions decide it

There are only two.

1. **Do you want it as a row in the area schedule?**
2. **Does it matter whether you can walk through it?**

If either is yes, it is a **counted division** — write two spaces. If both are no, it is an **uncounted division** — write it as an extent inside one space.

| How it is written | Area schedule | Circulation graph | What it carries |
|---|---|---|---|
| Two [`space`](../reference/muro/space.md) lines | **A row each** | **An edge** | Region, type, every attribute |
| [`zone`](../reference/muro/zone.md) | One row, the sum of its members | None (it has no geometry) | Aggregation and an inherited `use:` |
| [`area`](../reference/muro/area.md) (inside a space) | **None** | None | An extent plus `name:` `floor:` `spec:` |
| [`seg`](../reference/muro/seg.md) (on a boundary) | **None** | None (it puts no hole in the wall) | A run, and attribute overrides on it |

**`area` and `seg` do not count.** They appear in neither area, nor room count, nor the `koyu doors` graph.

## Writing it uncounted

Write the threshold as an extent inside the office. While we are here, write the fact that only part of the exterior wall is a curtain wall, with a `seg`.

```muro
muro 1.2
name 数えない分節
unit mm

grid X 0 8000
grid Y 0 5000

level L1 0 h:2700 slab:200

space /L1/office office X1..X2 Y1..Y2 name:事務室 floor:タイルカーペット
  area X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /out name:外部 outside:1

boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール
  door w:900 h:2100 at:X1+1000 name:D1
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

The area schedule is one row.

```text
L1
  /L1/office	事務室	office	40.00 m2
  Subtotal 40.00 m2
Total 40.00 m2 (indoor floor area)
  office: 40.00 m2
```

The threshold is absent from the graph too. The office is one node, with one door leading out.

```text
/L1/office (事務室)
  — 1 door → /out  (spec:RC)
/out (外部)
  — 1 door → /L1/office  (spec:RC)
```

**However many `area` lines you stack, the area comes from the parent space's region.** Floor finish varies by extent; the totals do not move. If that is what you wanted, you are done.

## Writing it counted

The same building, with the threshold and the working floor as separate spaces. **The parent is a `zone`, not a `space`** — a space with a region under another space with a region always overlaps.

```muro
muro 1.2
name 数える分節
unit mm

grid X 0 8000
grid Y 0 5000

level L1 0 h:2700 slab:200

zone /L1/office name:事務室
space /L1/office/doma  hall   X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /L1/office/floor office X1+2000..X2 Y1..Y2 name:執務 floor:タイルカーペット
space /out name:外部 outside:1

boundary /L1/office/doma /L1/office/floor type:open

boundary /L1/office/doma /out t:180 spec:RC edge:S
  door w:900 h:2100 name:D1
boundary /L1/office/floor /out t:180 spec:RC edge:S
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

The area schedule becomes two rows with a zone subtotal.

```text
L1
  /L1/office/doma	土間	hall	10.00 m2
  /L1/office/floor	執務	office	30.00 m2
  Subtotal 40.00 m2
Total 40.00 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/office	事務室	40.00 m2
  hall: 10.00 m2
  office: 30.00 m2
```

**The total is the same 40.00 m2.** Changing how it is divided does not move the floor area. What moved is the number of rows, and the grain at which questions can be asked.

```text
1 door — /L1/office/floor → /L1/office/doma → /out
```

There is now a route from the working floor to the outside. The uncounted version cannot be asked that question at all.

## The one line that separates the two

```muro-part
boundary /L1/office/doma /L1/office/floor type:open
```

**The moment a space is split in two, a wall is derived between the halves.** The default between touching spaces is a wall, and a wall with no door cannot be walked through. There is no door between the threshold and the working floor, so without `type:open` **the working floor is sealed.**

That is what "dividing makes circulation a question" amounts to. Do not divide and it never arises; divide and it must be written.

## What `area` cannot carry

An `area` is not a room, so **it has none of a room's attributes.**

The writable keys are `name:`, `floor:`, `spec:`, and namespaced keys containing a dot. `use:`, `h:` and `daylight:` cannot be written.

```text
✖ ar.muro:line 5: area (/L1/a) carries use:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.use:common)
```

Three more limits.

- **It cannot hold a boundary.** No doors, no windows. Adjacency and passage belong to the parent space.
- **One `area` is one rectangle.** `+` unions cannot be written. For several extents, write several `area` lines.
- **It cannot go on a space with no region.** There is no `area` inside `/out`.

`name:` **must be unique within the space.** The name is identity — it is what a later layer points at when editing.

## Why `seg` does not break the wall

One line separates `seg` from an opening. **An opening breaks the wall; a `seg` does not.**

```muro-part
boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール
  door w:900 h:2100 at:X1+1000 name:D1
```

That `seg` replaces the `spec` of a 3000mm run of the south wall and nothing else. No hole opens, no graph edge is added, and the answer from `koyu doors` does not change. Positioning (`w`, `at`, `edge`) is written exactly as for an opening, and the same checks run in the same order.

**`seg` is for "only part of this one wall is different".** If you want to walk through it, that is a `door`.

## Changing your mind

You can. **How a thing is divided is written composition, not derivation.**

**Uncounted → counted.** Turn the parent into a `zone`, rewrite the `area` as a `space`, and write the boundary between the two spaces. The area total does not change; the row count and the graph do.

**Counted → uncounted.** Merge the two `space` lines into one, and indent one region under it as an `area`. The zone is no longer needed.

Either way the change shows up in the [canonical JSON](../reference/json/index.md), and `koyu diff` names it in the language of composition.

## Rules of thumb

| Situation | How to write it |
|---|---|
| Floor finish changes across an extent | `area` |
| Recording where furniture or equipment goes | `area` |
| Only part of a wall has a different spec or fire rating | `seg` |
| You want a row in the area schedule | Two `space` lines |
| You want to ask whether it can be walked through | Two `space` lines |
| You want the `use:` totals split | Two `space` lines |
| The ceiling height differs | Two `space` lines (`h:` is a room attribute) |
| You want a separate daylight judgement | Two `space` lines (`daylight:` is a room attribute) |
| A grouping with no shape — a dwelling unit, a department, the site | `zone` |

## Related

- [area — the uncounted division inside a space](../reference/muro/area.md) — the isolation rule and the writable attributes
- [seg — the uncounted division on a boundary](../reference/muro/seg.md) — positioning and attribute overrides
- [space](../reference/muro/space.md) — the counted division
- [zone — counted aggregation](../reference/muro/zone.md) — a grouping with no shape
- [Common traps](troubleshooting.md#5-space-regions-overlap) — the error when the parent is a `space`
