---
title: Write a typical floor once
mode: howto
---

# Write a typical floor once

When the same plan repeats up a building, write the levels, the spaces and the boundaries **once**. Exceptional floors go on top as a difference.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Three things can be written once

| What | The write-once form | What it expands to |
|---|---|---|
| Levels | `level L2..L6 4200 pitch:4200 …` | five declarations, L2 through L6 |
| Spaces and boundaries | a path whose head is `/L2..L6/…` | the space or boundary on each level |
| Vertical boundaries | `stack core L1..L6 type:stair` | one per consecutive pair of levels |

The three are independent. You can span the paths without spanning the levels, or the reverse.

## 1. Declare the levels as a range

A name of the form `<prefix><number>..<prefix><number>` expands as an arithmetic series. Each level's z is `z + pitch × k`.

```muro-part
level L1 0 h:2800 slab:1400
level L2..L6 4200 pitch:4200 h:2800 slab:1400
level R 25200 slab:600
```

`pitch:` is **required** on a range and forbidden on a single declaration.

```text
✖ nopitch.muro:line 9: A level range requires pitch: (the storey height in mm): L2..L6
✖ single.muro:line 8: pitch is available only on a level range declaration (L?..L?)
✖ desc.muro:line 9: Cannot read the level range: L6..L2
```

`h:` and `slab:` land on every expanded level with the same value. The full rules for ranges are in [level](../reference/muro/level.md).

## 2. Span the head of the path

A path on a space, a zone or a boundary whose first segment reads `L2..L6` expands over the **declared levels between the two z values, in ascending z order**. The prefixes need not match — z decides the order, not the spelling of the name.

```muro-part
space /L2..L6/office room  X1..X2 Y1..Y2 name:Tenancy use:exclusive daylight:1
space /L2..L6/core   stair X2..X3 Y1..Y2 name:Stair use:common stair:N form:return

boundary /L2..L6/office /L2..L6/core t:200 spec:RC
  door w:900 name:Stair-door
```

Span both ends of a boundary and you get one same-storey boundary per level. Spanning only one end is allowed too.

**Something that exists on only part of the stack gets only that range.** The bundled `examples/tower/typical.muro` writes the dwellings as `/L3..L10/`, the balconies as `/L4..L10/` and the core as `/L3..L11/` — because on the third floor the south face is a roof terrace over the podium instead of a balcony.

## 3. Run the vertical circulation through with `stack`

```muro-part
stack core L1..L6 type:stair
```

[Connect storeys](connect-storeys.md) covers this in full.

## 4. Put exceptional floors in a difference layer

Leave the typical layer alone. Write the exception in its own file and **import it afterwards.** Later layers are stronger, and `over` replaces a value that already exists.

```muro-part
# L6.muro — the top floor becomes the staff canteen
over /L6/office h:3200 use:common name:Staff-canteen
over level L6 h:3200 slab:1000
```

`over` is not a definition. It errors if its target has not already been composed, so **the exception layer must be imported after the typical layer.** Layer strength and the rules for `over` are in [Split a building into layers](split-into-layers.md).

## Check it

```muro-part
# main.muro
koyu 1.1
name Office with a typical floor
unit mm

grid X 0 8400 16800
grid Y 0 8400

level L1 0 h:2800 slab:1400
level L2..L6 4200 pitch:4200 h:2800 slab:1400
level R 25200 slab:600

import ./L1.muro
import ./typical.muro
import ./L6.muro

stack core L1..L6 type:stair
```

```muro-part
# typical.muro — twelve lines that describe five storeys
space /L2..L6/office room  X1..X2 Y1..Y2 name:Tenancy use:exclusive daylight:1
space /L2..L6/core   stair X2..X3 Y1..Y2 name:Stair use:common stair:N form:return

boundary /L2..L6/office /L2..L6/core t:200 spec:RC
  door w:900 name:Stair-door
boundary /L2..L6/office /out edge:S t:200 spec:CW
  window w:8000 h:2600 name:CW
boundary /L2..L6/office /out edge:W t:200 spec:CW
boundary /L2..L6/office /out edge:N t:200 spec:CW
boundary /L2..L6/core /out edge:E t:200 spec:RC
boundary /L2..L6/core /out edge:N t:200 spec:RC
boundary /L2..L6/core /out edge:S t:200 spec:RC
```

```text
$ npx tsx src/cli.ts check main.muro
✔ Consistent — 13 spaces / 47 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**Thirteen spaces and forty-seven boundaries out of fewer than forty lines.** [`koyu levels`](../reference/cli/levels.md) shows the expansion — and the exception layer's replacement of L6's ceiling and slab shows up in the same output.

```text
$ npx tsx src/cli.ts levels main.muro
R	z:25200	slab:600
L6	z:21000	h:3200	slab:1000
  ↑ storey height 4200 = ceiling 3200 + slab 600 + 400 left over
L5	z:16800	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1000 + 400 left over
L4	z:12600	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L3	z:8400	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L2	z:4200	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
L1	z:0	h:2800	slab:1400
  ↑ storey height 4200 = ceiling 2800 + slab 1400
Per-space ceiling height: /L6/office h:3200
```

[`koyu stats`](../reference/cli/stats.md) counts L6 under its own name and use.

```text
L6
  /L6/office	Staff-canteen	room	70.56 m2
  /L6/core	Stair	stair	70.56 m2
  Subtotal 141.12 m2
Total 846.72 m2 (indoor floor area)
  hall: 70.56 m2
  stair: 423.36 m2
  room: 352.80 m2
By use: common 564.48 m2 (66.7%) / exclusive 282.24 m2 (33.3%)
```

Which layer supplied which value is [`koyu layers --attrs`](../reference/cli/layers.md)'s answer.

```text
$ npx tsx src/cli.ts layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	L1.muro
  2	typical.muro
  3	L6.muro

Attribute provenance:
  level:L6:h	← 3 L6.muro
  level:L6:slab	← 3 L6.muro
  space:/L6/office:h	← 3 L6.muro
  space:/L6/office:name	← 3 L6.muro
  space:/L6/office:use	← 3 L6.muro
```

Circulation expands too. From the top floor to the street, descending five storeys costs no extra doors.

```text
$ npx tsx src/cli.ts doors main.muro /L6/office /out
3 doors — /L6/office → /L6/core → /L5/core → /L4/core → /L3/core → /L2/core → /L1/core → /L1/lobby → /out
```

## Where it goes wrong

- **Forgetting `pitch:`.** A range cannot expand without a storey height — and writing it on a single declaration is an error the other way round.
- **Numbering downwards.** `L6..L2` cannot be read.
- **Importing the exception layer before the typical layer.** `over` has no target yet, so it errors.
- **A level in the span that should not carry the space.** `/L2..L6/…` creates the space on every level in range. Split the range when only some storeys should have it.

## Next

- [Split a building into layers](split-into-layers.md) — how the exception layer overrides the typical one
- [Connect storeys](connect-storeys.md) — running the core through the stack
- [Subdivide a dwelling into rooms](subdivide-a-unit.md) — taking the typical dwelling down to rooms
