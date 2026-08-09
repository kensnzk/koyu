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
  /home/ldk	LDK	window 7.54 m2 / floor 39.75 m2 = 1/5.3
  /home/bed1	主寝室	window 5.72 m2 / floor 26.50 m2 = 1/4.6
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

The columns are tab-separated: `path / name / the numbers`. `1/5.3` is floor over window.

**No verdict comes out of here.** Whether a room has enough daylight is a rule with a threshold, and it belongs to [`koyu validate`](validate.md) — writing the same 1/7 in two places is how the two eventually disagree. This command exits 0 whenever it can answer, however dark the rooms are.

```sh
npx tsx src/cli.ts light dark.muro
```

```text
  /L1/a	居室A	window 0.36 m2 / floor 16.20 m2 = 1/45.0
  /L1/b	居室B	window 0.00 m2 / floor 16.20 m2 = no window ⚠ windows without h: are not counted
2 rooms in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
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

And **these are inputs, not a judgement.** `check` says the composition holds together; `light` says how much window faces how much floor. Neither of them says the room has enough daylight — [`koyu validate`](validate.md) does, and it is the only one that carries the threshold.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | The numbers were produced — **including when nothing is in scope** |
| 1 | The input could not be read |
| 2 | No file path was given (usage is printed) |

**This command is not a gate.** It exits 0 however dark the rooms are, because it draws no line. A CI job that wants to fail on insufficient daylight runs [`koyu validate`](validate.md), which carries the threshold and says so.

## Its relation to validate

`light` shows **the inputs**: floor area, effective window area, and their ratio. [`koyu validate`](validate.md) applies `koyu.schematic.daylight.ratio` to those same numbers and returns the verdict, with the evidence behind it.

The threshold lives in exactly one place, and it is not here. A command that printed its own verdict per room would be a second implementation of the same rule, and two implementations of one rule eventually disagree. For CI, `validate` is the gate, and it covers every rule at once.

## See also

- [koyu validate](validate.md) — `koyu.schematic.daylight.ratio` and `koyu.schematic.daylight.unknown`
- [koyu stats](stats.md) — the floor area breakdown
- [.muro reference](../muro/index.md) — how to write `daylight:` and `window`
- [The koyu command](index.md) — the shared promises about exit codes
