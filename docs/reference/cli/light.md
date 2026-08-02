---
title: koyu light
mode: reference
---

# koyu light

For **spaces declared with `daylight:1`**, lists whether the effective window area reaches one seventh of the floor area.

## Arguments

```text
koyu light <entry.muro>
```

Takes one entry path.

## Flags

None.

## Output

One line per room in scope, then a summary.

```sh
npx tsx src/cli.ts light examples/house/main.muro
```

```text
✔ /home/ldk	LDK	window 7.54 m2 / floor 39.75 m2 = 1/5.3 (needs 1/7 ≈ 5.68 m2)
✔ /home/bed1	主寝室	window 5.72 m2 / floor 26.50 m2 = 1/4.6 (needs 1/7 ≈ 3.79 m2)
✔ Every room meets 1/7 — 2 rooms in scope (a rough judgement with no correction factor — this is validation, not what check guarantees)
```

The columns are tab-separated: `mark / path / name / the numbers`. `1/5.3` is floor over window; a denominator larger than 7 means it falls short.

When a room falls short it gets `✖`, and the summary gives the count.

```sh
npx tsx src/cli.ts light dark.muro
```

```text
✖ /L1/a	居室A	window 0.36 m2 / floor 16.20 m2 = 1/45.0 (needs 1/7 ≈ 2.31 m2)
✖ /L1/b	居室B	window 0.00 m2 / floor 16.20 m2 = no window (needs 1/7 ≈ 2.31 m2) ⚠ windows without h: are not counted
✖ Short of 1/7: 2 of 2 rooms (this is a validation judgement)
```

A room where no window could be counted reads `no window`.

## Windows without h

**A `window` with no `h` cannot have its area counted.** That room's line gains `⚠ windows without h: are not counted` at the end. The `/L1/b` above is written `window w:2600 edge:E` and still comes out as 0.00 m2 — it has a width but no height.

The numbers on a line carrying that warning are a lower bound, not the actual window area.

## Scope is never inferred from the type

**Only spaces that write `daylight:1` are judged.** The type is not consulted. Which rooms the one-seventh rule applies to is a legal judgement and cannot be derived from a type: habitable rooms in an apartment building are in scope, guest rooms in a hotel are not, and the single word `room` cannot express the difference.

With nothing in scope, no judgement runs at all.

```sh
npx tsx src/cli.ts light examples/office.muro
```

```text
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

**Do not read this as a pass.** Forgetting to write `daylight:1` produces exactly the same output.

## It is a rough judgement

No correction factor is applied. It does not look at where in the wall the opening sits, at the distance to the neighbouring boundary, or at an overhang. It is an early warning pitched at the resolution of schematic design, not a daylight calculation for a building permit.

And **this is a judgement, not what `check` guarantees.** A green `light` with a red `check` means the composition is broken; a green `check` with a red `light` means there are not enough windows. The two look at different things.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Every room in scope meets 1/7, **or nothing is in scope** |
| 1 | Some room falls short, or the input could not be read |
| 2 | No file path was given (usage is printed) |

**Nothing in scope exits 0.** Put `light` in CI for a model that writes no `daylight:1` anywhere, and green comes back having looked at nothing.

## Its relation to validate

The `✖` lines `light` produces are the same judgement as [`koyu validate`](validate.md)'s `daylight.ratio` (violation). `light` is the surface that also shows **the inputs** to that judgement; `validate` returns the judgement alone. For CI, `validate` is the better gate — it covers the other 14 rules at the same time.

## See also

- [koyu validate](validate.md) — `daylight.ratio` and `daylight.unknown`
- [koyu stats](stats.md) — the floor area breakdown
- [.muro reference](../muro/index.md) — how to write `daylight:` and `window`
- [The koyu command](index.md) — the shared promises about exit codes
