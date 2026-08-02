---
title: koyu axo
mode: reference
---

# koyu axo

Writes an axonometric as SVG. Floors, roofs, walls, columns and vertical runs are projected as they are. **No runtime and no WebGL are needed** — the output is SVG, so you confirm the solid with the same generate-and-look move you use for the plan.

## Arguments

```text
koyu axo <entry.muro> [-o <out.svg>] [-d NE|NW|SE|SW] [-l <levels>] [-s <scale>] [--no-walls] [--ceilings]
```

Takes one entry path. The drawing goes to a file; stdout gets one line naming where it went.

## Flags

| Flag | Default | Effect |
|---|---|---|
| `-o <path>` / `--out <path>` | `out/axo.svg` | Where to write. The directory is created if missing |
| `-d <dir>` / `--dir <dir>` | `SE` | Viewing direction. `NE`, `NW`, `SE`, `SW` only |
| `-l <spec>` / `--levels <spec>` | all levels | Levels to draw. A range `L1..L5` or a list `L1,L3` |
| `-s <n>` / `--scale <n>` | `0.02` | px per mm. Positive numbers only |
| `--no-walls` | walls drawn | Drop the walls |
| `--ceilings` | ceilings not drawn | Draw ceilings too (which hides the inside) |

A range does not require digits at its endpoints. A name like `R` works as an endpoint, and every level whose `z` falls between the two endpoints is selected.

## Output

```sh
npx tsx src/cli.ts axo examples/basement/main.muro -o out/axo.svg
```

```text
Generated the axonometric: out/axo.svg
```

Stacking flags does not change the shape of the output.

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -l L1..L3 -d NE -s 0.5 --ceilings -o out/axo2.svg
```

```text
Generated the axonometric: out/axo2.svg
```

## A calling mistake is returned as a calling mistake

All three valued flags check what they are given. **Neither an empty SVG nor a `NaN` SVG is ever written silently.**

An undeclared level name stops, with the declared names attached.

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -l ZZ9
```

```text
Undeclared level: ZZ9 (declared: B2 B1 L1 L2 L3 L4 L5 L6 L7 L8 L9 L10 L11 L12 L13 L14 L15 L16 L17 L18 L19 R)
```

A scale that is not a number, or is zero or less, stops.

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -s abc
```

```text
-s takes a positive number: abc
```

Any direction outside the four stops.

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -d UP
```

```text
-d is one of NE / NW / SE / SW: UP
```

All three exit 2.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | It was written |
| 1 | It could not be read because of a syntax or composition error |
| 2 | Undeclared level name / unreadable scale / unknown direction / no file path given |

## See also

- [koyu plan](plan.md) — the plan, as the same kind of SVG
- [koyu levels](levels.md) — the level names you can pass to `-l`
- [koyu runs](runs.md) — what the projected vertical circulation was derived from
- [The koyu command](index.md) — the shared promises about exit codes
