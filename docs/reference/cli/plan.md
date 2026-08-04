---
title: koyu plan
mode: reference
---

# koyu plan

Writes the plan drawing of one level as SVG. **There is no operation anywhere that draws a wall** — walls appear because they are derived from boundaries.

## Arguments

```text
koyu plan <entry.muro> [-l <level>] [-o <out.svg>]
```

Takes one entry path. The drawing goes to a file; stdout gets one line naming where it went.

## Flags

| Flag | Effect |
|---|---|
| `-l <level>` / `--level <level>` | The level to draw. Defaults to **the first level declared** |
| `-o <path>` | Where to write. Defaults to `<the entry path with .muro removed>-<level>.svg` |

There is no long form of `-o` (no `--out`), and no flag for scale or cut height.

## Output

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

```text
Generated the plan: out/house-L2.svg
```

The output directory is created if it does not exist.

Omitting `-o` writes next to the input file: `plan examples/two-rooms.muro` creates `examples/two-rooms-L1.svg`. Pass `-o` when you do not want to dirty the repository.

## Three quirks

**The default for `-l` is not the lowest storey.** It is the first level **in the order the `level` lines were written**. In a file where `level L2 …` comes before `level L1 …`, the default is L2. Pass `-l` explicitly to be sure which storey you get.

**The `-l=L2` form does nothing.** Separate the flag from its value with a space (`-l L2`). `-l=L2` is silently ignored and the default level is drawn. An undeclared level name stops with exit 2, but the `=` spelling does not stop — the flag itself is never recognised.

**A level with no space that has a region cannot be drawn.** Pass a roof level declared without spaces (`level R 5800 slab:500`) to `-l` and you get a raw exception, not a tidy diagnostic.

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l R -o out/house-R.svg
```

```text
<absolute path>/src/draw/plan.ts:39
    throw new Error(`There is no space with a region on level ${level}`);
          ^

Error: There is no space with a region on level R
```

The exit code is 1.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | It was written |
| 1 | It could not be drawn (a level with no space that has a region), or the input could not be read |
| 2 | `-l` was given an undeclared level name / no file path was given |

An undeclared level name is treated as a calling mistake. **An empty SVG is never written out silently and announced as "generated".**

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l ZZ9 -o out/x.svg
```

```text
Undeclared level: ZZ9 (declared: L1 L2 R)
```

**A green `check` does not mean `plan` will succeed.** Drawing is not what `check` inspects, and a mistyped `-l` is outside it entirely.

## The north arrow

**When [`azimuth`](../muro/azimuth.md) is declared, the plan draws a north arrow** in the top-right margin, pointing where true north lies on the paper. With no bearing declared there is no arrow — a model with no bearing must not be drawn as though it had one.

The arrow is the reason the bearing is worth drawing at all. A reversed sign, a quadrant taken the wrong way round, a value copied off a drawing that showed magnetic north: every one of those is a well-formed number inside the accepted range, and **no check catches any of them. Looking at the arrow catches all three.**

Like everything else on the paper it is presentation, and how it looks may change. What it points at may not.

## See also

- [koyu axo](axo.md) — the same generate-and-look move, in three dimensions
- [koyu levels](levels.md) — the declared levels and how the heights stack up
- [koyu check](check.md) — the gate to pass before drawing
- [The koyu command](index.md) — the shared promises about exit codes
