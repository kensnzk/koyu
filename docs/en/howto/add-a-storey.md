---
title: Add a storey
mode: howto
---

# Add a storey

Put an upper storey onto a single-storey description, then confirm that the section adds up and that the new rooms can reach the outside.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- One storey of `.muro` passes [`koyu check`](../reference/cli/check.md) with zero errors.
- You know which file declares `grid` and `level`. If the building is split across files, read [Split a building into layers](split-into-layers.md) first.

## 1. Declare the level

`level` is a fact about the whole building, and the **entry file (the base layer) declares it exactly once**, even when the building is split across files. The positional `z` is millimetres above datum, `h:` is the standard ceiling height, `slab:` is the thickness of the floor construction on that storey.

```muro-part
level L1 0    h:2400 slab:150
level L2 2900 h:2400 slab:500
level R  5800 slab:500
```

**Declare the topmost level too, even though no space sits on it.** `R` above is that level: L2's storey height (R's z minus L2's z) only exists because that line exists. Without it the top storey has no ceiling above it, and a ceiling running straight through the roof draws no complaint.

A level must be declared before it is used. Write `/L2/…` spaces above the `level` line and their level is undetermined. The grammar and the attributes it accepts are in [level](../reference/muro/level.md).

## 2. Write the spaces on the new storey

**If the first segment of the path is a declared level name, the space belongs to that level.**

```muro-part
space /L2/bed  bedroom X1..X2 Y1..Y3 name:Main-bedroom
space /L2/hall hall    X2..X3 Y2..Y3 name:Upper-hall
```

If you keep level names out of paths — rooting paths at the dwelling, `/home/bed1` — say it with `level:`.

```muro-part
space /home/bed1 bedroom X1..X2 Y1..Y3 level:L2 name:Main-bedroom
```

Write neither, and a space that has a region has no determinable level. That is **SUF02, an error**.

```text
✖ nolevel.muro:line 10: /home/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

Writing the path `/L2/…` is not itself a declaration of the level — the `level L2 2900` line is still required.

## 3. Connect the storeys

The default between two spaces stacked on top of each other is a **floor**. Write nothing and there is no stair and no void: the upper storey floats, and `check` stays green. Stairs, shafts and voids are covered in [Connect storeys](connect-storeys.md). One line is enough for now.

```muro-part
boundary /L1/hall /L2/hall type:stair
```

A relation that spans storeys belongs to no single storey's layer. Put it in the base layer if the building is split across files.

## 4. Write doors from the new rooms to the stair

The default between two spaces that touch is a **wall with no door in it**. Adding rooms upstairs connects them to nothing.

```muro-part
boundary /L2/bed /L2/hall t:120
  door w:800
```

## Check it

All of the above in one file:

```muro
koyu 1.0
name Two storeys
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400 slab:150
level L2 2900 h:2400 slab:500
level R  5800 slab:500

space /L1/ldk  ldk     X1..X2 Y1..Y3 + X2..X3 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y2..Y3 name:Entry-and-stair
space /L2/bed  bedroom X1..X2 Y1..Y3 name:Main-bedroom
space /L2/hall hall    X2..X3 Y2..Y3 name:Upper-hall
space /L2/void         X2..X3 Y1..Y2 name:Over-the-living-room void:1
space /out name:Outside outside:1

boundary /L1/ldk /L1/hall t:120
  door w:800 edge:E
boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:Front-door
boundary /L2/bed /L2/hall t:120
  door w:800

boundary /L1/hall /L2/hall type:stair
boundary /L1/ldk /L2/void type:void
```

```sh
npx tsx src/cli.ts check two.muro
```

```text
✔ Consistent — 6 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

[`koyu levels`](../reference/cli/levels.md) prints the section as text. Whether ceiling plus slab fits inside the storey height is right there on the arrow line.

```text
$ npx tsx src/cli.ts levels two.muro
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:150
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

Whether you can actually get upstairs is [`koyu doors`](../reference/cli/doors.md)'s question. It prints the fewest doors and the route.

```text
$ npx tsx src/cli.ts doors two.muro /L2/bed /out
2 doors — /L2/bed → /L2/hall → /L1/hall → /out
```

## Green does not mean you can get upstairs

`check` says that what is written does not contradict itself as data. Forget the vertical boundary and the upper storey floats, still green. Here is the same file with the one line from step 3 removed.

```text
$ npx tsx src/cli.ts check two-sealed.muro
✔ Consistent — 6 spaces / 6 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ npx tsx src/cli.ts doors two-sealed.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

**Run `doors` or [`koyu validate`](../reference/cli/validate.md) every time you add a storey.** [Find spaces you cannot reach](find-unreachable.md) sweeps for sealed rooms mechanically.

## Where it goes wrong

### The ceiling eats into the storey above — HGT01 (error)

If ceiling height plus the slab of the storey above exceeds the storey height, the height invariant is broken. Raise the entry hall's ceiling alone:

```muro-part
space /L1/hall hall X2..X3 Y2..Y3 name:Entry-and-stair h:2600
```

```text
✖ two.muro:line 13: /L1/hall collides into the floor above: ceiling height 2600 + L2's slab 500 = 3100 > storey height 2900
```

Lower the ceiling, raise `level L2`'s `z` to buy storey height, or thin the slab. Only a lower storey that is almost entirely void may declare a ceiling height that crosses a storey.

### No floor, no ceiling — SUF03 (warning) / SUF01 (error)

Forget `slab:` on the upper level and not one floor is generated on that storey; drop `h:` as well and the ceiling height is undetermined. **No default is invented where a value is missing** — the sufficiency checks say so out loud rather than letting a thin model ship silently.

```muro-bad
koyu 1.0
name Missing pieces
unit mm

grid X 0 3640
grid Y 0 3640
level L1 0 h:2400 slab:400
level L2 2900

space /L1/a room X1..X2 Y1..Y2 name:Downstairs
space /L2/b room X1..X2 Y1..Y2 name:Upstairs
space /out name:Outside outside:1
boundary /L1/a /out edge:S t:150
  door w:900
```

```text
⚠ thin.muro:line 8: Level L2 has no slab:, so not one floor is generated on this storey
✖ thin.muro:line 11: The ceiling height of /L2/b cannot be determined (neither the space's h: nor level L2's h: is there)
```

Diagnostic codes come out of `check --json`. The table from code to cause is the [diagnostics reference](../reference/diagnostics/index.md).

## Next

- [Connect storeys](connect-storeys.md) — stairs, shafts and voids
- [Write a typical floor once](typical-floors.md) — when the same plan repeats
- [Find spaces you cannot reach](find-unreachable.md) — confirm the new storey is not sealed
