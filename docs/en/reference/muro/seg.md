---
title: seg — an uncounted segmentation along a boundary
mode: reference
---

# seg — an uncounted segmentation along a boundary

```text
boundary /pathA /pathB …
  seg w:3000 [at:…] [edge:…] [attributes…]
```

A `seg` is an interval written **one level of indentation** under a [boundary](boundary.md). Use it when the specification changes partway along a wall — one stretch of a single wall is curtain wall, or the fire rating differs just there — and that stretch needs naming.

**A seg is not counted.** It affects neither passage nor connection nor area, adds no edge to the graph `koyu doors` walks, and cuts no hole in the wall. All it carries is **a position, and the attributes overridden over that interval**.

That is the one line separating a `seg` from an [opening](door.md). An opening divides the wall — the wall, as a run of intervals, gets a hole exactly there. A `seg` does not divide it.

## Position is written exactly as it is for an opening

| Attribute | Required | Meaning |
|---|---|---|
| `w` | **yes** | length of the interval in mm along the segment |
| `at` | no | a ratio 0..1 (default 0.5, clamped) or an absolute position by grid reference (not clamped) |
| `edge` | no | choose a side where the boundary has several segments |

Without `w`, parse stops there and then.

```text
✖ seg requires a width w:(mm)
```

Whether it can be placed is decided in the same order as for an opening — take the segments, narrow by `edge`, place nothing if there are none, place nothing if there are two or more and no side is chosen, place nothing if the width exceeds the segment length.

```text
✖ There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)
✖ The seg width 9000 exceeds the boundary segment length 3600
✖ The seg position Y1+1000 is on the wrong axis: a horizontal segment takes an X grid line
```

## The attributes are an override over the interval

They replace the boundary's `spec` for that stretch alone.

```muro
koyu 1.0
name 分節の書き方
unit mm

grid X 0 8000
grid Y 0 5000
level L1 0 h:2700 slab:200

space /L1/office office X1..X2 Y1..Y2 name:事務室
  area X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /out name:外部 outside:1

boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール fire:60
  window w:2400 h:2000 at:X1+4000 name:嵌め殺し
boundary /L1/office /out t:180 spec:RC edge:N
boundary /L1/office /out t:180 spec:RC edge:E
boundary /L1/office /out t:180 spec:RC edge:W
  door w:900 h:2100 name:出入口
```

The south wall is `spec:RC`, except for a 3000mm interval centred on X1+4000, which is `spec:カーテンウォール`. A window hangs over that same interval — a `seg` and an opening do not interfere, so they may overlap freely.

The area is still 8000 × 5000.

```text
  /L1/office	事務室	office	40.00 m2
```

Neither the `seg` nor the `area` above it moved a single square metre.

## The pair with area

There are two uncounted segmentations. **Both obey the same isolation rule** — they carry a position and overriding attributes, and touch nothing in the composition.

| | Written under | What it divides |
|---|---|---|
| `seg` | a [boundary](boundary.md) | an interval along a boundary segment |
| `area` | a [space](space.md) | a region inside a room |

`area` is the indoor counterpart — a change of floor finish, say. Spilling outside the parent region is a warning (SEG02); writing one on a space that has no region is an error (SEG01).

## Attribute tiers

| Attribute | Tier |
|---|---|
| `w` `at` `edge` | structure — parse lifts these into typed fields |
| `name` | interpreted |
| `spec` `fire` `sound` | carried — carried and nothing more |

A key outside the ledger cannot be written.

```text
✖ seg (/L1/a | /out) carries finish:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.finish:タイル)
```

Give it a namespace containing a dot (`acme.finish:tile`) and it passes. The core does not read namespaced keys.

`name` is **a name unique inside that boundary**. Two segs on one boundary with the same name is UID04.

## Diagnostics

| Code | Severity | What it says |
|---|---|---|
| SEG03 | warning | a `seg` on an `open` boundary — there is no wall, so it is not interpreted |
| SEG04 | error | there is no boundary segment to place the `seg` on |
| SEG05 | error | there is more than one segment and none is chosen |
| SEG06 | error | the `seg` is wider than the segment |
| SEG07 | error | an absolute position on the wrong axis |
| SEG08 | error | an absolute position runs off the segment |
| VRT06 | warning | a `seg` on a vertical boundary — not interpreted |
| UID04 | error | duplicate `name` within one boundary |

SEG01 and SEG02 belong to `area`, not to `seg`.

To look a code up by cause and cure, there is [the list of diagnostic codes](../diagnostics/index.md).

## Neighbouring pages

- [boundary](boundary.md) — the relation a `seg` sits on
- [door](door.md) / [window](window.md) — the openings that do divide the wall
- [space](space.md) — where `area` is written
- [koyu check](../cli/check.md)
