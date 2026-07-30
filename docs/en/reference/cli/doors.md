---
title: koyu doors
mode: reference
---

# koyu doors

Gives the route from one space to another **through the fewest doors** on the space graph. It is the escape-and-circulation question.

## Arguments

```text
koyu doors <entry.muro> <pathA> <pathB>
```

After the entry path, give the departure and arrival space paths. Both are required.

## Flags

None.

## Output

One line: the number of doors, and the spaces passed through.

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

The route is a list of spaces, not of doors. Boundaries that cost no door — `open`, stairs — also appear along it.

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
```

```text
3 doors — /home/bed1 → /home/hall2 → /home/hall1 → /site/east → /site/garden → /out/road
```

Five boundaries are crossed but only 3 doors counted. `/home/hall2 → /home/hall1` is a stair and `/site/east → /site/garden` is `open`, so neither counts.

When there is no route, it says so.

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed9 /site/garden
```

```text
Cannot reach /site/garden from /home/bed9
```

## What is passable

| Boundary | Passable |
|---|---|
| A wall with doors | Yes (each boundary crossed counts as one door, however many are written on it) |
| A wall with no doors | No |
| `open` | Yes (no door counted) |
| A wall with `air:1` (railings, fences, garden walls) | **No** — `air` is about enclosure, not about passage |
| `stair` | Yes (no door counted) |
| `shaft` (lifts and the like) | No |
| `void` | No |

Boundaries you never wrote are used too. The default between touching spaces is a wall, and a wall with no doors is impassable, so **a contact you did not write acts to block the route.**

## Paths that do not exist

**A mistyped path also produces "cannot reach".** A typo and a genuine dead end give the same message and the same exit code 1. The `/home/bed9` above is not a space that exists.

When you get "cannot reach", check the spelling with [`koyu graph`](graph.md) first. The exterior is not necessarily one space — in `examples/house` it is split into `/out/road`, `/out/n`, `/out/e` and `/out/w`, and there is no space called `/out`.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | It can be reached |
| 1 | It cannot be reached (including via a path that does not exist), or the input could not be read |
| 2 | Two paths were not given / no file path was given |

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1
```

```text
Usage: koyu doors <file> /pathA /pathB
```

## One pair at a time

`doors` answers about the one pair you gave it. **To ask whether any room at all fails to reach the outside, use [`koyu validate`](validate.md)** — `access.unreachable` tests reachability to the exterior for every room that has a region.

## See also

- [koyu graph](graph.md) — adjacency and boundary kinds, space by space
- [koyu validate](validate.md) — reachability across the whole building at once
- [.muro reference](../muro/index.md) — how to write `boundary` and openings
- [The koyu command](index.md) — the shared promises about exit codes
