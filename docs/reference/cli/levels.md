---
title: koyu levels
mode: reference
---

# koyu levels

A section drawing in text. Lists the levels in descending `z` and breaks each storey height down into ceiling height and floor build-up.

## Arguments

```text
koyu levels <entry.muro>
```

Takes one entry path.

## Flags

None.

## Output

```sh
npx tsx src/cli.ts levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:400
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

A level's line is tab-separated, and `h` and `slab` appear only when written. The order runs top to bottom, that is, **descending `z`**.

The `↑` line is **the stack-up seen from the level on the line above it**. The storey height is the difference to the next level's `z`, and the breakdown explains it with that level's `h` and **the next level's** `slab`. The topmost level, with nothing above it, gets no `↑` line.

## When there is a remainder

If the storey height exceeds ceiling plus floor build-up, the difference comes out as `left over`. It is the ceiling void.

```sh
npx tsx src/cli.ts levels examples/tower/main.muro
```

```text
R	z:35200	slab:500
L11	z:32000	h:2600	slab:500
  ↑ storey height 3200 = ceiling 2600 + slab 500 + 100 left over
L10	z:29000	h:2500	slab:450
  ↑ storey height 3000 = ceiling 2500 + slab 500
L9	z:26000	h:2500	slab:450
  ↑ storey height 3000 = ceiling 2500 + slab 450 + 50 left over
```

(The head of this building's full output.)

## When the breakdown is missing

The breakdown appears only when **that level has an `h` and the level above has a `slab`**. Missing either leaves just `↑ storey height <n>`.

Both absences are reported separately by [`koyu check`](check.md): an undetermined ceiling height is an error, a missing floor build-up is a warning. (In either case the height checks do not run.)

**Declaring a roof level with no spaces (`level R 5800 slab:500`) brings the top storey into the checks too.** With nothing above it, the top storey height cannot be computed.

## Per-space ceiling heights

Spaces carrying `h:` are listed at the end, with the effective ceiling height — the value in force for that space.

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ storey height 4000 = ceiling 2700 + slab 1300
L1	z:0	h:2700	slab:600
  ↑ storey height 4000 = ceiling 2700 + slab 1300
Per-space ceiling height: /L1/hall h:6700
```

Spaces without a region, and spaces not on a level, do not appear here.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | It came out |
| 1 | No level is defined, or the input could not be read |
| 2 | No file path was given (usage is printed) |

```sh
npx tsx src/cli.ts levels nolevels.muro
```

```text
No level is defined
```

## See also

- [koyu check](check.md) — reports missing ceiling heights and floor build-ups as diagnostics
- [koyu stats](stats.md) — floor area per level
- [koyu plan](plan.md) — pass one of these level names to `-l`
- [.muro reference](../muro/index.md) — how to write `level`
