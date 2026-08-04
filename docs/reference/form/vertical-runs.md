---
title: The arithmetic of vertical runs
mode: reference
---

# The arithmetic of vertical runs

Riser count, going and slope are never written. **They are derived from the region, the storey pitch and one declared direction of rise.**

```muro-part
space /B2..B1/st stair X3..X3+2600 Y2..Y2+5400 name:避難階段 stair:N form:return
```

```sh
npx tsx src/cli.ts runs examples/basement/main.muro
```

```text
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B2/ramp
B2→B1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B2/st
B1→L1	lift	EV	/B1/ev
B1→L1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B1/ramp
B1→L1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B1/st
L1→R	lift	EV	/L1/ev
```

The 21, the 176mm, the 300mm and the 6000mm appear nowhere in the source. Here is the arithmetic that produces them.

## Local coordinates

A run is measured in **t** (from 0 in the direction of travel) and **s** (from **the left of the direction of travel**). The direction of rise, `stair:N`, fixes t, and s follows from it. Which way a turn goes is decided here.

`turn:` is L **only when `L` is written**; unwritten and invalid values are both R.

## When no shape is generated at all

Any of these produces no shape whatsoever. [RUN01–05 / SUF04](../diagnostics/run.md) put it into words.

- Zero or two or more vertical-circulation declarations
- The region is not a single rectangle
- The level cannot be determined
- A value other than N/E/S/W on anything but a lift, or a value other than `1` on a lift
- `form:` other than `straight` or `return`
- `form:return` on something other than a stair or a ramp
- No level above (lifts excepted)
- The entry landing consumes the full length
- A turning run leaves no run length

**A lift has a shape even with no level above** — the car closes on its own level.

## Entry landing and step division

A run does not start at the edge of its region. **An entry band** remains at the near end, and that is where the door opens. A straight run keeps one at the far end too.

**The entry band is floor, not landing.** Starting a run at the edge means the stair-hall door hits a tread directly. Its depth is `entry:`, or `ENTRY_LANDING` (1100mm).

```text
usable = length − entry            (form:return)
usable = length − entry × 2        (form:straight)

risers = max(2, ⌈rise ÷ (riser: ?? 180)⌉)
riser  = rise ÷ risers
going  = usable ÷ max(1, risers − 1)
slope  = level difference ÷ run length
```

`riser:` is **an upper bound on the riser**, not the riser itself. The value written decides the riser count; the actual riser is the storey rise divided by that count.

## Turning

The width is halved and an intermediate landing is placed at the far end. With `turn:R` the first flight runs on the left of the direction of travel, with `turn:L` on the right. **The two flights occupy the same interval of t and differ only in s.**

The split of the steps is:

```text
k             = min(risers − 1, max(1, round(risers ÷ 2)))
landing level = FL + k × riser
```

**`round` rounds a half up, so with an odd riser count the lower flight has one step more.** The second flight is also geometrically reversed — the low-t side is the high one. A turning ramp puts its landing at exactly half the rise.

### The landing is the remainder

Run length, going and landing are tied by a single equation, and at most two of them can be written. What a designer wants to hold is the comfort of the going, so **by default the remainder goes to the landing**.

```text
landing: written : max(LANDING_MIN, the written value)
ramp             : max(LANDING_MIN, min(width ÷ 2, (length − entry) ÷ 3))
stair            : max(LANDING_MIN, min((length − entry) − n × target going,
                                        (length − entry) − LANDING_MIN))
```

For the stair, n is `max(1, max(k − 1, risers − k − 1))` and the target going is `tread:`, or `TREAD_TARGET` (300mm). Write `landing:` and the going becomes the remainder instead. Derived or written, a landing below `LANDING_MIN` (1100mm) is raised to the minimum.

### Solve it

`/B2/st` is a 2600 × 5400 rectangle. `stair:N`, so the length is 5400 and the width 2600, over a storey rise of 3700.

```text
entry       = 1100                             (default)
risers      = max(2, ⌈3700 ÷ 180⌉) = 21
riser       = 3700 ÷ 21 = 176.19mm             → "21 risers of 176mm"
k           = min(20, round(21 ÷ 2)) = 11
n           = max(1, max(11−1, 21−11−1)) = 10
landing     = max(1100, min(4300 − 10×300, 4300 − 1100)) = 1300
run length  = 5400 − 1100 − 1300 = 3000
going, 1st  = 3000 ÷ (11 − 1) = 300mm
going, 2nd  = 3000 ÷ (10 − 1) = 333.3mm
```

The aggregate going is **the tightest flight**, so 300mm, and the total run length is 3000 × 2 = **6000mm**. That is the CLI line, exactly.

## Side by side — escalators

The nominal width of one unit is `lane:`, or `LANE_ESCALATOR` (1200mm).

```text
units      = max(1, ⌊width ÷ nominal⌋)
unit width = min(nominal, width ÷ units)
remainder  = (width − unit width × units) ÷ 2  split evenly between the two edges
```

**Units alternate in direction of travel** — next to an up escalator is one coming down. `lane:` has no effect on stairs, ramps or lifts (the count is always one).

`/L1/es` in `examples/complex/` is 3200 wide, so:

```text
unit 1 : t 1100…10900, s 400…1600,  up
unit 2 : t 1100…10900, s 1600…2800, down (same geometry, opposite direction of travel)
```

`⌊3200 ÷ 1200⌋ = 2` units at 1200mm each, remainder 800 split 400 to each edge.

## Aggregate values

| Value | What it counts |
|---|---|
| `going` (total horizontal run) | **the first unit only.** Both flights of a turning run count |
| `tread` | **the tightest flight** represents it |
| `slope` | **the steepest flight** represents it |

The asymmetry is what the judgements rely on — the second flight of a turning run has more steps and is therefore tighter, so looking only at the first would let a cramped flight slip past [`koyu.schematic.stair.proportion`](../validate/runs.md).

## Solids

| Part | Shape |
|---|---|
| Landing | a slab; top at the landing level, thickness `SLAB_T` (200mm) |
| Stair flight | for k risers there are **k − 1 tread boards** (the top step is carried by the floor above). The top of tread i is bottom + i × riser, thickness riser + `TREAD_SOLID` (200mm) |
| Ramp, escalator | one inclined slab, thickness `SLAB_T` |
| Escalator balustrade | two per unit; width `min(140, unit width ÷ 8)`, thickness 100mm, raised 900mm above the tread surface |
| Lift car | a box inset `min(300, shorter side ÷ 6)` on all four sides — the inset is **one value shared by all four**, not solved per side. **Constant height regardless of storey pitch**, from FL + 60 to FL + 2400 |

**The tilt is decided by the z values, never by the direction of travel.** A down escalator tilts geometrically the same way an up one does; only the direction people move differs. Reading that one word geometrically as well is what once tilted the down unit into a mirror image, drew its arrow pointing up, and made the second unit vanish from the plan.

## Neighbouring pages

- [The plan](plan.md) — how ascending and descending runs complement each other on one sheet
- [Constants and tolerances](constants.md) — where 180 / 300 / 1100 / 1200 / 200 / 400 come from
- [vertical-circulation](../muro/vertical-circulation.md) — how to write a run
- [RUN diagnostics](../diagnostics/run.md) — when no shape is generated
- [runs judgements](../validate/runs.md) — is it climbable, is the slope within bounds
- [koyu runs](../cli/runs.md) — see the arithmetic as a table
