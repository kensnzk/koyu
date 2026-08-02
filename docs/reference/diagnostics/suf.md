---
title: SUF — sufficiency
mode: reference
---

# SUF — sufficiency

There are four SUF codes. None of them asks whether a value is *right*; each asks **whether the value needed to make a shape is written at all**.

| Code | Severity | What it says |
|---|---|---|
| SUF01 | error | The ceiling height cannot be determined — no ceiling and no roof can be generated |
| SUF02 | error | It has a region but no determinable level — not one solid can be generated |
| SUF03 | warning | The level has no `slab:` — not one floor is generated on that storey |
| SUF04 | warning | A vertical circulation is declared but no shape is generated for it |

**Not making a shape and not being able to make one are different things.** koyu's derivation rules are deterministic and never invent a default: with no ceiling height written, nothing quietly substitutes 2400 — no ceiling is made. The same composition always yields the same shape. But **that the shape came out thin has to be told**. That is what SUF is for.

**These are not validity judgements.** SUF never says "that ceiling height is wrong". It says only "no ceiling height is written".

## SUF01 — the ceiling height cannot be determined {#suf01}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 slab:150
space /L1/a room X1..X2 Y1..Y2
```

```text
The ceiling height of /L1/a cannot be determined (neither the space's h: nor level L1's h: is there)
```

**Cause** — the space has no `h:`, and neither does the level it sits on. The effective ceiling height is undetermined.

A ceiling height is not one number used once; it is a number **many things read**. When it is undetermined, all of the following fall away.

- **No ceiling is generated.** A ceiling is what the effective ceiling height gives.
- **No roof is generated.** The top storey's roof apex sits at `the level's z + effective ceiling height + 200mm`.
- **The height invariant cannot be formed.** [HGT01](./hgt.md) goes quiet, and a storey-piercing ceiling height passes green.
- **If there is no level above, the storey height is undetermined too.** Walls and columns rise the full storey height. With a level above, the storey height is the difference in `z` — but **the top storey's height is fixed by "the tallest of the level's own `h:` and the effective ceiling heights of the spaces on it, plus 200mm"**. If not one ceiling height is determined, that number does not exist and **not one wall and not one column stands on that level**.

That last point is visible. Add exterior walls and columns to the four-line file above (which has only a top storey) and not one solid comes out. Add `level L2 3000 h:2400 slab:150` on top and walls and columns stand without a single `h:` being written — because the storey height now comes from the difference in `z`.

**Three kinds are not blamed.** For these the shape is settled without a ceiling height.

- Voids (`void:1`) — having neither floor nor ceiling is what a void is
- The exterior (`outside:1`) — it is the ground
- Semi-outdoor spaces — a space with a region meeting the exterior across `type:open` or `air:1`. A balcony has no ceiling height

**Fix** — write a base ceiling height on the level.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

Write `h:` on the space for rooms that differ (`space /L1/a room X1..X2 Y1..Y2 h:2700`). A space's `h` beats its level's.

## SUF02 — its level cannot be determined {#suf02}

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /house/a room X1..X2 Y1..Y2
```

```text
/house/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

**Cause** — a space sits on a level under one of two conditions.

- The **first segment of its path** matches a declared level name (`/L1/a` together with `level L1 0`)
- It carries a `level:` attribute (`space /house/a room X1..X2 Y1..Y2 level:L1`)

The example cuts its path by an aggregation hierarchy (`/house/…`), so the first segment `house` is not a level name.

**The opposite mistake is the more common one.** If you wrote `/L1/a` and still get this, **the `level L1 0` line is missing**. Writing `/L1/` in a path does not declare a level.

**Why it is an error** — z is undetermined, so **not one solid is generated** from this space. No floor, no ceiling, no roof, no walls, and nothing in the plan drawing. This is the state in which `koyu plan` dies saying there is no space with a region on that level.

**Fix** — one of two.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /house/a room X1..X2 Y1..Y2 level:L1
```

Use this when you want the path cut by an aggregation hierarchy (bundling by dwelling, wing or use). If you want the head of the path to state the level, add a `level L1 0 h:2400 slab:150` line to the base layer and write `space /L1/a …`.

## SUF03 — no slab, so no floor is generated {#suf03}

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
```

```text
Level L1 has no slab:, so not one floor is generated on this storey
```

**Cause** — the only thing that gives a floor is a `level`'s `slab:` (floor-construction thickness — structural slab, plenum and finish). There is no operation that places a floor; **writing `slab:` *is* declaring the floor**. Leave it out and not one floor is generated on that storey.

**There is collateral damage.** The [height invariant](./hgt.md) cannot be formed without the slab of the level above, so forgetting `slab:` on one level also stops the level **below** it from being checked. Ignore SUF03 and HGT01 goes silent.

**Why it stops at a warning** — because the shape itself is settled. "No `slab`, no floor element" is a deterministic rule; it is not a case of several shapes coming out of one composition. But **that the building ends up with no floors ought to be told.**

**Fix** — write `slab:` on the level.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

**Sometimes it does not fire.** If a level carries no space that could have a floor (a space with a region that is neither `void` nor `exterior`), SUF03 stays quiet. A roof level that exists only to give the top storey its upper bound (`level R 5800 slab:500`) is exactly that case — there is no floor that failed to be generated, so there is nothing to say.

## SUF04 — no level above, so no shape is generated {#suf04}

`warning`

```muro-warn
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/s stair X1..X2 Y1..Y2 stair:N
```

```text
No level sits above L2, so no form is generated for /L2/s
```

**Cause** — a vertical circulation's shape runs "from this level's finished floor to the next level's finished floor". A stair on the top storey has nowhere to climb, so not one step is generated. On that storey's plan only the flight arriving from below appears. The declaration is there and the shape is not: a matter of sufficiency.

A lift (`lift:`) is exempt from SUF04 — its shape is not a division into steps.

**Fix** — if the stair goes out to the roof, declare the roof surface as a level.

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
level R 6000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/s stair X1..X2 Y1..Y2 stair:N
```

If it does not go out to the roof, drop the declaration on that storey.

## Related

- [HGT — the height invariant](./hgt.md) — for when values **are** written and contradict each other
- [RUN — vertical circulation](./run.md) — the four codes for a declaration that cannot be read
- [koyu check](../cli/check.md)
