---
title: koyu runs
mode: reference
---

# koyu runs

Lists the vertical circulation. **The number of risers, the tread, the landing and the slope are nowhere in the source.** They are derived from the region and the storey height. This command is how you see what was derived.

## Arguments

```text
koyu runs <entry.muro>
```

Takes one entry path.

## Flags

None.

## Output

One run per line. A run stands **between two levels**, so a stair through three storeys is two lines, not three.

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

Columns are tab-separated and their number depends on the device.

| Column | Contents |
|---|---|
| 1 | `<lower level>→<upper level>`. Just the lower name when there is no upper |
| 2 | The device — `stair` / `ramp` / `escalator` / `lift` |
| 3 | Display name |
| 4 | `rise <n>mm` — the height climbed |
| 5 | `return` (it turns back) or `straight` |
| 6 | For a stair, `<n> risers of <riser>mm, tread <tread>mm`; for a ramp or escalator, `slope 1/<n>` |
| 7 | `going <n>mm` — the run length |
| 8 | The space path |

**Only `lift` stops at two columns.** A lift has no steps, no slope and no going, so the path follows the display name directly.

```text
B2→B1	lift	EV	/B2/ev
```

An escalator is reported by slope, not by steps.

```sh
npx tsx src/cli.ts runs examples/complex/main.muro
```

```text
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
```

(An excerpt from this building's full output.)

## When there is no vertical circulation

If none of `stair`, `ramp`, `escalator` or `lift` is declared, it says so.

```sh
npx tsx src/cli.ts runs examples/two-rooms.muro
```

```text
There is no vertical circulation (write stair:N / ramp:N / escalator:N / lift:1 on a space)
```

**Writing a stair boundary (`boundary /a /b type:stair`) alone puts nothing here.** A boundary kind is the relation "these two spaces are joined by a stair", not the form of the stair itself. For the form, write `stair:<direction of climb>` on the stair space. `examples/house` has only the former, so `runs` returns the line above.

## What follows from it being derived

Change the storey height and the same stair enclosure gets a different step division. There is nothing to write differently — **the number of risers changing when the storey height changes is what derivation means.** In `examples/basement` above, B2→B1 and B1→L1 are both `rise 3700mm`, so both come out as 21 risers; in a building with unequal storeys the same enclosure gets different divisions floor by floor.

**Whether the derived dimensions are comfortable to climb is not said here.** Whether the form is uniquely determined is [`koyu check`](check.md)'s job, and whether the steps are cramped or the slope is outside normal use is what [`koyu validate`](validate.md) says with `stair.proportion` and `run.slope`.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Always — **including when there is no vertical circulation at all** |
| 1 | It could not be read because of a syntax or composition error |
| 2 | No file path was given (usage is printed) |

Do not read the absence of vertical circulation as a pass. Forgetting to write `stair:` gives exactly the same output.

## See also

- [koyu validate](validate.md) — the step and slope judgements (`stair.proportion` / `run.slope`)
- [koyu check](check.md) — the diagnostics for whether the run's form is determined
- [koyu axo](axo.md) — seeing the derived runs as solids
- [.muro reference](../muro/index.md) — how to write `stair`, `ramp`, `escalator` and `lift`
