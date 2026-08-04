---
title: Vertical circulation — stair proportion, slopes, run connection
mode: reference
---

# Vertical circulation — stair proportion, slopes, run connection

| rule | level |
|---|---|
| [`koyu.schematic.stair.proportion`](#stair-proportion) | caution |
| [`koyu.schematic.ramp.declared-slope`](#ramp-declared-slope) | caution |
| [`koyu.schematic.escalator.usual-slope`](#escalator-usual-slope) | caution |
| [`koyu.schematic.run.disconnected`](#run-disconnected) | caution |

**Riser counts, goings, landings and slopes are never written.** You write the device and the direction of ascent (`stair:N`, `ramp:E`, `escalator:S` — a `lift` has no direction of ascent, so its value is `1`: `lift:1`); everything else falls out of the region and the storey height. [`koyu check`](../cli/check.md) guarantees that the declaration determines one shape — **whether that shape can be climbed is what this volume says.**

Because the stance is "write nothing, check everything", what is checked is not a written value. **It is a derived one.**

```sh
koyu runs main.muro
```

```text
L1→L2	stair	s	rise 3000mm	straight	17 risers of 176mm, tread 150mm	going 2400mm	/L1/s
```

A `lift` has neither steps nor a pitch, so none of the rules in this chapter apply to one.

## `koyu.schematic.stair.proportion` — the derived step is cramped {#stair-proportion}

`caution`

The derived going is under 240mm, or `2×riser + going` falls outside 550–700mm. The second is the pace rule.

```muro-caution
koyu 1.1
grid X 0 3000
grid Y 0 4600
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
⚠ [koyu.schematic.stair.proportion] main.muro:line 6: Cramped step: /L1/s — derived tread 150mm, 2×riser+tread 502mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 3 evaluated / 13 not applicable / 0 indeterminate / 0 error
```

The arithmetic runs like this. The rise is 3000mm and the riser ceiling defaults to 180mm, so there are 17 risers of 3000/17 = 176mm. The 4600mm depth along travel loses the boarding floor at each end (1100mm by default), leaving 2400mm of run, divided by 16 goings = 150mm. **The stair shaft is too shallow.**

`riser:` overrides the riser ceiling, `entry:` the boarding floor, `landing:` the intermediate landing.

In a return stair (`form:return`) each flight has its own going. The check reads **the tightest flight**, so the going reported is that flight's.

**There are three fixes**, and each of them changes an input to the derivation.

```muro
koyu 1.1
grid X 0 3000
grid Y 0 7000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

Deepened along travel, 4600 → 7000mm. The run is 4800mm over 16 goings = 300mm, and `2×176 + 300 = 652mm` lands inside the pace rule.

Left shallow, folding it with `form:return` doubles the run and reaches the same 300mm.

```muro
koyu 1.1
grid X 0 3000
grid Y 0 4600
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N form:return
space /L2/s stair X1..X2 Y1..Y2
stack s L1..L2 type:stair
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

The third is to raise `riser:` and use fewer steps. **This is a dimensional warning, not a code-compliance verdict.**

## `koyu.schematic.ramp.declared-slope` — steeper than the limit you declared {#ramp-declared-slope}

`caution`

A ramp and an escalator both leave a slope band, but they leave a **different** band for different reasons: one is the limit the designer wrote down, the other is a range this pack carries. Two grounds mean two rules, so that either can be revised without touching the other.

`slope:` is **not the slope. It is the limit you will accept**, and it exists only so this check can be made. `slope:12` means "no steeper than 1/12". A ramp with no `slope:` is not checked, and if no ramp declares one the rule is `not-applicable` rather than passing.

```muro-caution
koyu 1.1
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
stack r L1..L2 type:stair
```

```text
⚠ [koyu.schematic.ramp.declared-slope] main.muro:line 6: Derived slope 1/1.3 is steeper than the declared 1/12: /L1/r (lengthen the run or lower the storey height)
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 3 evaluated / 13 not applicable / 0 indeterminate / 0 error
```

Against a 3000mm rise there is only 3800mm of run (6000mm less the 1100mm boarding floor at each end), giving 1/1.3 — an order of magnitude off the 1/12 asked for. **koyu does not invent a limit for a ramp that declared none.**

**Fix** — lengthen the ramp along travel, fold it with `form:return` to double the run, or lower the storey height. Actually achieving 1/12 in the example above takes 40000mm along travel (a 37800mm run, giving 1/12.6). **Ramps are long.** The numbers say so.

## `koyu.schematic.escalator.usual-slope` — outside the usual band {#escalator-usual-slope}

`caution`

An escalator needs no `slope:`. If the derived pitch falls outside 1/2.3 – 1/1.4 — a band around the usual 1/1.7, i.e. 30° — this rule fires. The band is **a custom this pack carries, not a limit anyone wrote in the file**, which is exactly why it is a separate rule from the ramp's.

```muro-caution
koyu 1.1
grid X 0 1200
grid Y 0 12000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/e room X1..X2 Y1..Y2 escalator:N
space /L2/e room X1..X2 Y1..Y2
stack e L1..L2 type:stair
```

```text
⚠ [koyu.schematic.escalator.usual-slope] main.muro:line 6: Derived slope 1/3.3 is outside the usual escalator range 1/2.3–1/1.4 (about 1/1.7 = 30 degrees): /L1/e
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 3 evaluated / 13 not applicable / 0 indeterminate / 0 error
```

This is the **too shallow** side. The region is so long that the derivation produced a reclining escalator nobody builds. Shorten the same region to 7200mm and the run is 5000mm, the pitch 1/1.7, and the judgement passes.

## `koyu.schematic.run.disconnected` — no vertical boundary joins the levels {#run-disconnected}

`caution`

**Shape and topology are written separately.** `stair:N` builds treads; it does not claim that the two levels are connected. What connects them is a `stack`, or a `boundary type:stair`.

```muro-caution
koyu 1.1
grid X 0 3000
grid Y 0 7000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N
space /L2/s stair X1..X2 Y1..Y2
```

```text
⚠ [koyu.schematic.run.disconnected] main.muro:line 6: /L1/s has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
Validation — 0 violations / 1 caution
  koyu.profile.schematic-screen@1 — 2 evaluated / 14 not applicable / 0 indeterminate / 0 error
```

Without a vertical boundary, [`koyu doors`](../cli/doors.md) will not find a route upstairs. **A stair that is drawn but not walkable** is the hardest mismatch to notice, which is why it warns.

The test is blunt: it asks whether the space is an endpoint of some `type:stair` or `type:shaft` boundary, and does not ask whether it connects to the right level.

**Fix** — write `stack s L1..L2 type:stair`. Conversely, if you want the connection without a generated shape (a lift shaft, say), drop the vertical-circulation attribute and keep the vertical boundary.

## See also

- [`koyu runs`](../cli/runs.md) — device, rise, riser count, going, slope and run length in one list
- [Reachability](access.md) — whether a run is stranded off the customer's route is what `koyu.schematic.access.backofhouse` says
- [The validation ledger](index.md) — all sixteen rules, and why a judgement is not a diagnostic
