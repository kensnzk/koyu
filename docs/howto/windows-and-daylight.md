---
title: Open windows and pass the daylight check
mode: howto
---

# Open windows and pass the daylight check

Put windows into habitable rooms and pass [`koyu light`](../reference/cli/light.md)'s one-seventh test — effective window area ≥ floor area ÷ 7.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- [`koyu check`](../reference/cli/check.md) passes with zero errors.
- You have decided which rooms are to be judged. **koyu does not guess.**

## 1. Declare that a room is in scope

`light` looks **only** at spaces carrying `daylight:1`. **It never looks at the type.** Whether a room is judged is something the author declares, not something inferred from what the room is called. The default is out of scope, so with no `daylight` anywhere nothing is judged.

```muro-part
space /L1/a bedroom X1..X2 Y1..Y2 name:Bedroom daylight:1  # in scope
space /L1/b wet     X2..X3 Y1..Y2 name:Washroom            # default: out of scope
space /L1/c wet     X3..X4 Y1..Y2 name:Bathroom daylight:1 # type stays wet; judged anyway
```

`daylight:0` means the same as the default, but writing it tells the reader that the exclusion was deliberate. The only values are 0 and 1.

```text
✖ daylight-yes.muro:line 10: daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/a carries daylight:yes
✖ daylight-yes.muro:line 11: daylight is either 1 (in scope for the daylight check) or 0 (out of scope): /L1/b carries daylight:yes
```

**Where you put `daylight:1` also decides the grain of the denominator.** Put it on an undivided `unit` and the whole dwelling is judged as one room; put it on the living room and bedrooms and each is judged separately. Both are correct — it is a choice about the resolution of the scheme.

**With nothing in scope, `light` exits 0** — indistinguishable from "every room passes". When a room you expected does not appear, suspect a missing `daylight:1` first.

```text
$ npx tsx src/cli.ts light daylight-noscope.muro
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

## 2. Write `window` on a boundary that faces out

A window counts only when the other side of that boundary is **the exterior (`exterior`) or a semi-outdoor space**. A window between two rooms contributes nothing (it is treated as zero).

```muro-part
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:Sliding-window
```

The attributes a window accepts are in [window](../reference/muro/window.md).

## 3. Write both `w:` and `h:`

Width `w:` is required by the grammar; without it reading stops.

```text
✖ daylight-now.muro:line 17: window requires a width w:(mm) (the asset may supply it)
```

Height `h:` is optional to the grammar, but **`light` counts only windows that have one.** A window without `h:` is not an error; it is treated as zero area, and `light` appends a note.

```text
  /L1/a	Room-A	window 0.00 m2 / floor 16.20 m2 = no window ⚠ windows without h: are not counted
```

If the opening references a joinery asset, the `h:` may live on the asset ([asset](../reference/muro/asset.md)).

## 4. Pick the edge with `edge:` when the perimeter breaks into pieces

A boundary with a space that has no region — `/out` and its like — is whatever is left of the room's perimeter after the parts touching other spaces are removed, and it usually falls on several sides. Say which with `edge:N/E/S/W`. N is +Y, S is −Y, E is +X, W is −X, read from the rectangle of the space **written first** on the boundary line.

```text
✖ daylight-noedge.muro:line 17: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)
```

## Check it

Run `light`. Exit 0 if every room in scope passes, 1 if any falls short.

```muro
muro 1.2
name Daylight practice
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
level R 2700 slab:150

space /L1/a room X1..X2 Y1..Y2 name:Room-A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:Room-B daylight:1
space /out name:Outside outside:1

boundary /L1/a /L1/b t:120
  door w:780 h:2000
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:Sliding-window
boundary /L1/b /out t:150 spec:EW
  door w:900 h:2100 edge:S at:X2+900 name:Front-door
  window w:2600 h:1100 edge:E name:High-window
```

```text
$ npx tsx src/cli.ts light daylight.muro
  /L1/a	Room-A	window 5.72 m2 / floor 16.20 m2 = 1/2.8
  /L1/b	Room-B	window 2.86 m2 / floor 16.20 m2 = 1/5.7
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

Read a line left to right: verdict, path, name, **effective** window area (after the coefficient), floor area, their ratio, the area required. A room with no window at all reads `no window`.

The same two rooms with the windows removed:

```text
  /L1/a	Room-A	window 0.00 m2 / floor 16.20 m2 = no window
  /L1/b	Room-B	window 0.00 m2 / floor 16.20 m2 = no window
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

[`koyu validate`](../reference/cli/validate.md) says the same thing as `koyu.schematic.daylight.ratio` (a violation). Use that one in CI.

```text
✖ [koyu.schematic.daylight.ratio] daylight-none.muro:line 10: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [koyu.schematic.daylight.ratio] daylight-none.muro:line 11: Insufficient daylight: /L1/b — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
```

## Daylight borrowed through a semi-outdoor space

A window that faces a balcony, a terrace or a garden is discounted. **If a space overlaps that semi-outdoor space from above, the coefficient is 0.7; if the sky is open, it is 1.0.** Whether there is a roof is itself derived, so adding a balcony on the storey above drops the coefficient below it.

A sliding window (2600×2200 = 5.72 m²) onto an open terrace counts in full.

```muro
muro 1.2
name Daylight through a terrace
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400 slab:150
level R 2700 slab:150

space /L1/liv living  X1..X2 Y1..Y2      name:Living-room daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:Terrace
space /out name:Outside outside:1

boundary /L1/liv /L1/bal t:100 spec:Sash
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:Balustrade air:1 h:1100
```

```text
  /L1/liv	Living-room	window 5.72 m2 / floor 16.00 m2 = 1/2.8
```

Put a balcony on the storey above, in the same position, and the terrace is under cover: 0.7 applies. **Neither the window nor the floor has changed.**

```muro
muro 1.2
name Daylight through a terrace
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /L1/liv living  X1..X2 Y1..Y2      name:Living-room daylight:1
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:Terrace
space /L2/bal balcony X1..X2 Y1-1500..Y1 name:Balcony-above
space /out name:Outside outside:1

boundary /L1/liv /L1/bal t:100 spec:Sash
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:Balustrade air:1 h:1100
boundary /L2/bal /out edge:S t:120 spec:Balustrade air:1 h:1100
```

```text
  /L1/liv	Living-room	window 4.00 m2 / floor 16.00 m2 = 1/4.0
```

**A space is semi-outdoor only when it has a region and has an `open` or `air:1` boundary to the exterior.** A balcony whose balustrade is missing its `air:1` is not semi-outdoor, and a window borrowing through it counts as zero.

```text
  /L1/liv	Living-room	window 0.00 m2 / floor 16.00 m2 = no window
1 room in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

## When it falls short

Every `✖` line prints the area required. Reach it by one of:

- **Enlarge the window, or add more of them.** Effective window area is the sum over every boundary of that space.
- **If it borrows through a semi-outdoor space, move the window onto a boundary that faces the exterior directly.** The coefficient becomes 1.0.
- **If the room need not be judged, drop `daylight:1`.** Write `daylight:0` to keep the intent visible.
- **Make the floor smaller.** One-seventh is a ratio of areas, so a deep room can fail even with glazing across its whole face. [Choose dimensions before you write](choose-dimensions.md) has the rules of thumb.

`light` is a rough early warning with no correction factors. It is not a compliance judgement. What it does and does not claim is in [the daylight rule](../reference/validate/daylight.md).

## Next

- [Subdivide a dwelling into rooms](subdivide-a-unit.md) — subdividing moves the daylight declaration too
- [Describe a site](describe-a-site.md) — a garden being open to the sky is what sets the coefficient
- [Find spaces you cannot reach](find-unreachable.md) — a balcony with only a window cannot be stepped onto
