---
title: Vertical circulation — stair / ramp / escalator / lift
mode: reference
---

# Vertical circulation — stair / ramp / escalator / lift

Riser counts, treads, landings and slopes are never written in `.muro`. **What is written is the region, the storey height and the direction of ascent; the form follows from those.**

The declaration is an attribute on a space. **The key names the device and the value gives the direction of ascent.**

```muro-part
space /L1/st  stair      X1..X2 Y1..Y2 name:階段 stair:N form:return turn:R
space /L1/rmp ramp       X2..X3 Y1..Y2 name:斜路 ramp:E slope:8
space /L1/es  escalator  X3..X4 Y1..Y2 name:エスカレーター escalator:N lane:1200
space /L1/ev  shaft      X4..X5 Y1..Y2 name:昇降機 lift:1
```

| Key | Value |
|---|---|
| `stair:` | Direction of ascent, `N` / `E` / `S` / `W` |
| `ramp:` | Direction of ascent, `N` / `E` / `S` / `W` |
| `escalator:` | Direction of ascent, `N` / `E` / `S` / `W` |
| `lift:` | `1` (a lift has no direction) |

`N` is +Y, `S` is −Y, `E` is +X, `W` is −X. The type in the second position (`stair`, `ramp`, `shaft`, …) is open vocabulary used for aggregation; what generates the form is the attribute key.

**One space carries one declaration.**

```text
RUN01  More than one vertical circulation declaration: stair:N ramp:N (one space carries one)
```

## What has to hold for a form to exist

If the declaration does not determine a form uniquely, `check` stops. Five things must hold.

1. Exactly **one** vertical circulation declaration
2. A value that reads as a direction (`1` for a lift)
3. A region that is **a single rectangle** — an L shape built with `+` will not do
4. A level that can be determined
5. For everything but a lift, **a level above**

```text
RUN02  The value of stair is the direction it rises, N/E/S/W: stair:up
RUN02  The value of lift is 1: lift:2
RUN03  The region of vertical circulation is a single rectangle (a union leaves the step division undetermined): /L1/st
SUF04  No level sits above L3, so no form is generated for /L3/st
```

`SUF04` is a warning; the rest are errors. **A lift has a form even with no level above it** — the car closes within its own level.

## form — straight and turning back

```text
form:straight   straight (the default)
form:return     turning back
```

**Only a stair and a ramp turn back.** `form:return` on an escalator or a lift is an error. There are no curves — a spiral is written as a succession of turns.

```text
RUN05  form is straight / return: form:spiral (write a spiral as a succession of turns)
RUN05  form:return may not be written on escalator (only a stair and a ramp turn back)
```

`turn:` picks the direction of the turn, and **only the literal `L` means left** — anything else, including nothing, is right (`R`). With `turn:R` the first flight lies on the left of the direction of travel.

## The boarding band

A flight does not begin at the edge of the region. **A boarding band is left at the near end, and that is where the door opens.** Starting at the edge would drive the stair enclosure's door straight into the treads. A straight run leaves the same band at the far end.

```text
form:straight   usable length = full length − entry × 2
form:return     usable length = full length − entry
```

`entry:` defaults to **1100mm**. When that band eats the whole length, no form is determined.

```text
RUN05  The form of the vertical circulation is undetermined: /L1/s (check that the landing does not exceed the full length)
```

## Dividing the steps

The riser count is the rise divided by the riser limit, rounded up, with a floor of two. The tread is the length of **one flight** divided by the number of gaps between that flight's steps. A turning run has two flights and therefore two treads, and the more cramped one represents it (see [aggregate values](#aggregate-values) below).

```text
risers = max(2, ceil(rise ÷ riser))
riser  = rise ÷ risers
tread  = the length of one flight ÷ max(1, that flight's risers − 1)
  form:straight   one flight = the usable length, and its risers are all of them
  form:return     one flight = full length − entry − landing; k risers below, risers − k above
```

`riser:` is the **upper limit** on a riser in mm, defaulting to **180**. Writing it changes the riser count.

The intermediate landing of a turning run **falls out as the remainder**. Flight length, tread and landing are bound by one equation, and at most two of them can be written. What a designer wants to hold is the comfort of the tread, so by default the remainder is pushed into the landing: the target tread `tread:` (default **300mm**) is taken first and what is left becomes the landing. Write `landing:` instead and the tread becomes the remainder. Derived or written, a landing shallower than the **1100mm minimum** is raised to 1100mm.

The steps split at `k = min(risers−1, max(1, round(risers ÷ 2)))`, and the landing sits at FL + k × riser. Because `round` takes a half upwards, **an odd riser count gives the lower flight one more step**. A turning ramp puts its landing at exactly half the height.

`runs` prints what was derived.

```text
$ koyu runs core.muro
L1→L2	lift	昇降機	/L1/ev
L1→L2	stair	階段	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/st
L2→R	lift	昇降機	/L2/ev
L2→R	stair	階段	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L2/st
```

## Parallel units — escalators

Only an escalator has parallel units. The nominal width of one unit is `lane:` (default **1200mm**); the count is the width divided by that, rounded down, with a floor of one; one unit is the smaller of the nominal width and width ÷ count; the remainder is split evenly between the two sides.

**The units alternate in direction** — the one beside an up escalator comes down.

`lane:` does nothing on a stair, a ramp or a lift. Their count is always one.

```text
$ koyu runs examples/complex/main.muro
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
```

## Aggregate values

When one run splits into several parts, which part represents it is fixed.

| Value | How it is taken |
|---|---|
| Total horizontal flight length (`going`) | **The first unit only** (both flights of a turning run count) |
| Tread | **The most cramped flight** represents it |
| Slope | **The steepest flight** represents it |

The second flight of a turning run carries more steps and is therefore finer. Look only at the first and a cramped flight slips past the checks.

## The attributes

| Key | Default | What it decides |
|---|---|---|
| `stair:` `ramp:` `escalator:` | — | The device and the direction of ascent (`N`/`E`/`S`/`W`) |
| `lift:` | — | A lift (the value is `1`) |
| `form:` | `straight` | `straight` / `return`. Only a stair and a ramp turn back |
| `turn:` | `R` | Direction of the turn. Only a literal `L` means left |
| `entry:` | 1100 | Depth of the boarding band in mm |
| `landing:` | derived | Depth of the intermediate landing in mm (minimum 1100) |
| `riser:` | 180 | **Upper limit** on a riser in mm. It sets the riser count |
| `tread:` | 300 | Target tread in mm, used to derive a turning run's landing |
| `lane:` | 1200 | Nominal width of one unit in mm. Only an escalator reads it |
| `slope:` | — | The denominator of an acceptable slope. **It does not affect the form** — only validation reads it |

`entry:`, `landing:`, `riser:`, `tread:`, `lane:` and `slope:` must all be positive numbers.

## The topology is written separately

**A vertical circulation declaration makes a form; it does not join storeys.** Which level connects to which is held by a vertical boundary — `stack`, or `boundary … type:stair`.

```muro-part
space /L1..L2/st stair X1..X2 Y2..Y3 name:階段 stair:N form:return
stack st L1..L2 type:stair
```

**Vertical passability is carried by the single word `stair`.** A stair, a ramp and an escalator have the same topology, so the set of boundary types does not grow; the difference between the devices lives only on the space. A lift shaft is `type:shaft` — continuous, but not passable.

Write the form and leave out the vertical boundary and `check` stays green. It is `koyu validate` that says so.

```text
⚠ [koyu.schematic.run.disconnected] nostack.muro:line 13: /L1/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
```

## Climbability is not what check guarantees

What `check` says goes as far as "the declaration determines a form uniquely". **Whether that form is comfortable to climb is said by a different surface.**

| Verdict | When it appears |
|---|---|
| `koyu.schematic.stair.proportion` | The derived tread is under 240mm, or 2 × riser + tread falls outside 550–700mm |
| `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` (ramp) | The derived slope is steeper than the 1/N written as `slope:` |
| `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` (escalator) | The derived slope is outside the usual range (about 1/1.7, i.e. 30 degrees) |
| `koyu.schematic.run.disconnected` | The form exists but no vertical boundary joins the levels |

```text
$ koyu validate a.muro
⚠ [koyu.schematic.stair.proportion] a.muro:line 12: Cramped step: /L1/st — derived tread 165mm, 2×riser+tread 515mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
⚠ [koyu.schematic.ramp.declared-slope] a.muro:line 14: Derived slope 1/0.9 is steeper than the declared 1/12: /L1/rp (lengthen the run or lower the storey height)
⚠ [koyu.schematic.escalator.usual-slope] a.muro:line 15: Derived slope 1/0.9 is outside the usual escalator range 1/2.3–1/1.4 (about 1/1.7 = 30 degrees): /L1/es
```

The thresholds are a coarse copy of Japanese practice and are not frozen. **These are judgements, not guarantees.**

## What reaches the drawings

A plan is the section cut at 1200mm above FL on that level. An ascending run's visible extent follows from comparing the cut with the heights of its parts; a descending run appears in **what its twin ascending run left uncovered**. Nosings are drawn only inside the visible extent, and the cut appears as a single line crossing the full width of the run.

Arrows go one per unit on an escalator, and one each on the departing and the arriving run for a stair or a ramp. Their direction comes from the direction people travel, so **an escalator points the same way on both floors while a stair and a ramp reverse on the upper one** — the machine's direction is fixed and the person's changes with the floor.

In three dimensions a stair flight of k risers carries **k−1 treads** (the top step is received by the floor above), a ramp is one inclined slab, an escalator is **one slab plus two balustrades per unit**, and a lift car is a box of **constant height regardless of the storey height**. The balustrade dimensions are in [form/constants.md](../form/constants.md).

## A complete example

```muro
muro 1.3
name 階段室のある小さなコア
unit mm

grid X 0 2800 5600 12000
grid Y 0 2000 8600

level L1 0 h:3600 slab:600
level L2 4200 h:3600 slab:600
level R  8400 slab:500

space /L1..L2/hall   hall   X1..X4 Y1..Y2 name:ホール lease.category:common
space /L1..L2/st     stair  X1..X2 Y2..Y3 name:階段 lease.category:common stair:N form:return turn:R
space /L1..L2/ev     shaft  X2..X3 Y2..Y3 name:昇降機 lease.category:common lift:1
space /L1..L2/office office X3..X4 Y2..Y3 name:事務室 lease.category:exclusive

space /out name:外部 outside:1

boundary /L1..L2/st /L1..L2/hall t:180 spec:RC
  door w:900 name:D1
boundary /L1..L2/ev /L1..L2/hall t:180 spec:RC
  door w:1100 name:D2
boundary /L1..L2/office /L1..L2/hall t:100 spec:LGS
  door w:900 name:D3

boundary /L2/hall /out edge:S t:200
boundary /L1..L2/hall /out edge:W t:200
boundary /L1..L2/hall /out edge:E t:200
boundary /L1..L2/st /out edge:W t:200
boundary /L1..L2/st /out edge:N t:200
boundary /L1..L2/ev /out edge:N t:200
boundary /L1..L2/office /out edge:N t:200
boundary /L1..L2/office /out edge:E t:200

boundary /L1/hall /out edge:S t:200
  door w:1800 name:E1

stack st L1..L2 type:stair
stack ev L1..L2 type:shaft
```

```text
$ koyu check core.muro
✔ Consistent — 9 spaces / 28 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ koyu validate core.muro
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

The stair's region is 2800 × 6600mm and the rise is 4200mm. Taking the 1100mm boarding band off leaves 5500mm; a target tread of 300mm leaves a 2200mm landing as the remainder, so each flight is 3300mm, the 24 risers come out at 175mm, and the tread is 300mm. **None of those numbers is written anywhere.**

## See also

- [stack](stack.md) — declaring relations across storeys at once, and span expansion
- [space](space.md) — declaring spaces, regions and paths
- [boundary](boundary.md) — boundary types, horizontal and vertical
- [koyu check](../cli/check.md) — the gate that asks whether a form is determined
- [koyu validate](../cli/validate.md) — the judgement on climbability
