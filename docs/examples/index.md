---
title: The bundled buildings
mode: explanation
---

# The bundled buildings

Eight buildings ship with the repository, from a two-room minimum to a twin-tower redevelopment of 141,449 m² gross. **Every one of them passes `koyu check`.** In a notation where being able to read the drawing means you were able to write it, the examples are not an appendix — they are the entrance.

They are roughly in order of difficulty and mostly build on one another. Each page is organised as "what this example shows **first**", a representative excerpt, and the questions worth putting to it with the answers that actually came back.

## Scale

| Example | Source | Levels | Spaces | Boundaries | Interior floor area | Semi-outdoor |
|---|---|---:|---:|---:|---:|---:|
| [two-rooms](two-rooms.md) | 26 lines / 1 file | 1 | 3 | 3 | 32.40 m² | — |
| [office](office.md) | 110 lines / 1 file | 3 | 17 | 43 | 419.84 m² | — |
| [house](house.md) | 89 lines / 1 file (composed version 102 lines / 5 files) | 3 | 13 | 31 | 92.75 m² | 73.24 m² |
| [basement](basement.md) | 86 lines / 1 file | 4 | 15 | 49 | 1,242.08 m² | — |
| [mansion](mansion.md) | 192 lines / 1 file | 11 | 122 | 332 | 2,366.40 m² | 162.16 m² |
| [tower](tower.md) | 453 lines / 9 files | 12 | 178 | 543 | 4,785.92 m² | 941.16 m² |
| [complex](complex.md) | 646 lines / 10 files | 22 | 425 | 1,364 | 31,606.24 m² | — |
| [twin](twin.md) | 1,220 lines / 11 files | 39 | 1,808 | 5,973 | 141,448.56 m² | 6,534.08 m² |

Space and boundary counts are what `koyu check` prints for the composed model, floor area is the total from `koyu stats`, and the level count is the number of rows from `koyu levels`. **Every figure in this table came from actually running the command.**

```sh
npx tsx src/cli.ts check examples/twin/main.muro
```

```text
✔ Consistent — 1808 spaces / 5973 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## Size does not scale with line count

**The floor area grows 4,300-fold and the source grows 47-fold.** That is two-rooms at 32.40 m² / 26 lines against twin at 141,448.56 m² / 1,220 lines. Between complex and tower it is starker still: 6.6 times the floor area for 1.43 times the source.

The reason is not compression. **Large mixed-use buildings are made of repetition**, and level spans (`/B2..L19/`), [bands](../reference/muro/band.md) and [`stack`](../reference/muro/stack.md) fold that repetition whole. The core of complex covers twenty-one levels, from two floors below ground to the nineteenth, in nine lines; the hotel guest rooms expand from thirteen lines of band declaration into seventy-eight rooms.

So **the size of the source is proportional to the number of design decisions, not to the size of the building**. That is not a property of the notation; it is a property of architecture, which the notation happens to reflect.

Whether a building fits in an LLM's context is settled there too. Measured with o200k_base: two-rooms is 359 tokens, the nine files of tower total 8,574, the ten files of complex total 12,685, and the eleven files of twin total 26,630. **A single 31,606 m² building fits whole into any model's context.** The same scene written in IFC4 and IFCX, measured the same way, is in [koyu measured against IFC](vs-ifc.md).

## Running them

All eight are checked at once.

```sh
npm run check:examples
```

For one building, check first, then put questions to it.

```sh
npx tsx src/cli.ts check  examples/office.muro
npx tsx src/cli.ts stats  examples/office.muro
npx tsx src/cli.ts doors  examples/office.muro /L2/office /out
npx tsx src/cli.ts plan   examples/office.muro -l L2 -o out/office-L2.svg
```

**A green `check` does not mean the building works.** All `check` says is that what was written is not self-contradictory as data. Architectural verdicts come separately from [`koyu validate`](../reference/cli/validate.md) — all eight bundled buildings pass that too.

## Where to start

- **New to the notation** — [two-rooms](two-rooms.md), then [office](office.md), then [house](house.md).
- **You know what you want to write** — [Look it up by what you want to write](by-pattern.md) jumps straight from a feature to the line in an example that has it.
- **You want to know whether it holds at scale** — [complex](complex.md) and [twin](twin.md).
- **You want the comparison with IFC** — [koyu measured against IFC](vs-ifc.md).

## The step-by-step example

[examples/steps/](../../examples/steps/) holds the state reached at each of six stages, from one room to two storeys. That set accompanies the tutorial rather than the gallery, so follow it from [your first program](../start/first-program.md).
