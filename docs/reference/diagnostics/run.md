---
title: RUN — vertical circulation
mode: reference
---

# RUN — vertical circulation

Four RUN codes are live. RUN04, RUN06, RUN07 and RUN08 are **retired numbers**.

| Code | Severity | What it says |
|---|---|---|
| RUN01 | error | One space carries more than one vertical-circulation declaration |
| RUN02 | error | The value is not a direction of rise |
| RUN03 | error | The region is not a single rectangle, or the level is undetermined |
| RUN04 | — | **retired** |
| RUN05 | error | `form` is invalid, or the shape cannot be settled |
| RUN06 RUN07 RUN08 | — | **retired** |

A stair, a ramp, an escalator and a lift are one relation — "you can pass between levels" — differing only in the device. The notation keeps two things apart.

- **Topology** — which level connects to which. Carried by a vertical boundary (`stack` / `boundary type:stair`).
- **Shape** — flights, landings, slope. **Derived** from the space's declaration. Step counts, treads and slopes are never written.

The declaration is one attribute. **The key names the device; the value gives the direction of rise.**

```muro-part
space /L1/s stair X1..X2 Y1..Y2 stair:N
```

The four keys are `stair:`, `ramp:`, `escalator:` and `lift:`. The value is a compass direction (N=+Y, S=-Y, E=+X, W=-X); only `lift:`, which has no direction, takes `1`.

RUN asks only whether **a unique shape follows from the declaration**. Whether the resulting shape is comfortable to climb is an architectural judgement, and `koyu validate` says that separately.

**One space produces at most one RUN diagnostic.** The tests run in the order below, and the first hit ends the scan for that space.

## RUN01 — more than one vertical-circulation declaration {#run01}

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N ramp:N
space /L2/s stair X1..X2 Y1..Y2
space /out outside:1
boundary /L1/s /out
boundary /L2/s /out
```

```text
More than one vertical circulation declaration: stair:N ramp:N (one space carries one)
```

**Cause** — the four keys select a device's **shape-generation rule**. One space cannot hold a shape under two rules at once.

**Fix** — split the space and write one on each. A space where a stair and a ramp coexist is really two spaces.

## RUN02 — the value is the direction of rise {#run02}

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:up
space /L2/s stair X1..X2 Y1..Y2
space /out outside:1
boundary /L1/s /out
boundary /L2/s /out
```

```text
The value of stair is the direction it rises, N/E/S/W: stair:up
```

**Cause** — dividing the rise into steps needs to know which way it climbs. That is the one piece of information the region cannot supply, so it has to be written. `up`, `1` and `north` all fail.

`lift:` gets a different body.

```text
The value of lift is 1: lift:N
```

**Fix** — write one compass letter (`stair:N`). A lift takes `lift:1`.

## RUN03 — the region must be a single rectangle {#run03}

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 + X2..X3 Y1..Y2 stair:N
space /L2/s stair X1..X3 Y1..Y2
space /out outside:1
boundary /L1/s /out
boundary /L2/s /out
```

```text
The region of vertical circulation is a single rectangle (a union leaves the step division undetermined): /L1/s
```

**Cause** — the step division follows from the length along the direction of travel and the width across it. An L-shaped or U-shaped union has neither uniquely.

**Fix** — allocate the stair enclosure as a single rectangle. Most places that seem to want an L-shaped stair enclosure actually want a stair plus a landing hall.

RUN03 also covers two more states under the same code.

```text
Vertical circulation requires a region: /L1/s
```

No region was written at all.

```text
The level of the vertical circulation cannot be determined: /house/s
```

The level cannot be settled. [SUF02](./suf.md) fires alongside this — another consequence of the same space.

## RUN05 — invalid form {#run05}

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N form:spiral
space /L2/s stair X1..X2 Y1..Y2
space /out outside:1
boundary /L1/s /out
boundary /L2/s /out
```

```text
form is straight / return: form:spiral (write a spiral as a succession of turns)
```

**Cause** — `form` takes exactly two values, `straight` and `return`. koyu has introduced no curves, so a spiral stair or ramp is approximated as a succession of turns.

RUN05 also covers two more states under the same code.

```text
form:return may not be written on lift (only a stair and a ramp turn back)
```

Only a stair and a ramp turn back. `form:return` cannot be written on an escalator or a lift.

```text
The form of the vertical circulation is undetermined: /L1/s (check that the landing does not exceed the full length)
```

The written values do not fit together and no shape comes out. Nearly always `landing:` (the depth of an intermediate landing) or `entry:` (the depth of the boarding floor) has eaten the whole length of the run.

**Fix** — use `form:return`, or stack the turns across several levels. If the run is short, lengthen the enclosure or shorten the landing.

## Reading the derived shape

`koyu runs` prints the derived shape as a table.

```muro
grid X 0 3000
grid Y 0 12000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
space /out outside:1
boundary /L1/r /out
boundary /L2/r /out
```

```sh
koyu runs ramp.muro
```

```text
L1→L2	ramp	r	rise 3000mm	straight	slope 1/3.3	going 9800mm	/L1/r
```

Neither the step count nor the slope was written, and both come out. That is derivation.

## The four retired numbers

**RUN04 merged into [SUF04](./suf.md).** "No level above, so not one shape is generated" is a matter of sufficiency, not of vertical circulation. The code belongs to SUF, but the scan is the same single pass, so the diagnostic still comes out in declaration order among the vertical circulations.

**RUN06, RUN07 and RUN08 moved to validation.** All three said whether a *derived* shape was usable — an architectural judgement, not a question of whether what was written holds together.

| Was | Now | Level |
|---|---|---|
| RUN06 (cramped steps) | `koyu.schematic.stair.proportion` | caution |
| RUN07 (steep slope) | `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` | caution |
| RUN08 (shape present, not connected) | `koyu.schematic.run.disconnected` | caution |

The numbers are **never reused**.

```sh
koyu validate ramp.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
⚠ [koyu.schematic.run.disconnected] <absolute path>/ramp.muro:line 5: /L1/r has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [koyu.schematic.ramp.declared-slope] <absolute path>/ramp.muro:line 5: Derived slope 1/3.3 is steeper than the declared 1/12: /L1/r (lengthen the run or lower the storey height)
Validation — 0 violations / 2 cautions
```

The file above is green under `check`. **`slope:` is not the slope you are writing; it is the steepest slope you will accept**, and it exists only to be checked against. `koyu.schematic.run.disconnected` names the hardest mismatch to notice — a stair drawn on the plan that circulation cannot pass through — which is what you get when the shape declaration (`ramp:N`) is written and the topology declaration (`stack` / `boundary type:stair`) is forgotten.

Cramped steps work the same way.

```sh
koyu validate tight.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

```text
⚠ [koyu.schematic.stair.proportion] <absolute path>/tight.muro:line 5: Cramped step: /L1/s — derived tread 13mm, 2×riser+tread 365mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
Validation — 0 violations / 1 caution
```

## Related

- [SUF — sufficiency](./suf.md) — SUF04 (no level above) and SUF02 (level undetermined)
- [VRT — vertical boundaries](./vrt.md) — the checks on the topology side
- [VER — the language version](./ver.md) — a vertical-circulation declaration is 0.5 vocabulary (VER03)
- [koyu validate](../cli/validate.md) — `koyu.schematic.stair.proportion` / `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` / `koyu.schematic.run.disconnected`
- [koyu check](../cli/check.md)
