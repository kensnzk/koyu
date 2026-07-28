---
title: koyu graph
mode: reference
---

# koyu graph

Lists adjacency space by space, with the kind of each boundary and the number of doors. It is the map you read before [`koyu doors`](doors.md) gives an answer.

## Arguments

```text
koyu graph <entry.muro>
```

Takes one entry path.

## Flags

None.

## Output

Spaces come out in declaration order, each followed by its neighbours.

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 1 door → /L1/b  (spec:PW1)
  | wall → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 1 door → /L1/a  (spec:PW1)
  — 1 door → /out  (spec:EW1 fire:60)
/out (外部)
  | wall → /L1/a  (spec:EW1 fire:60)
  — 1 door → /L1/b  (spec:EW1 fire:60)
```

The heading line is the path and the display name; the indented lines are its neighbours. **Every relation appears from both sides** — the door between `/L1/a` and `/L1/b` shows up twice.

The parentheses hold the boundary's attributes. A boundary with no attributes gets no parentheses.

## The marks

| Mark | Meaning | Passable |
|---|---|---|
| `— N doors` | A wall with N doors | Yes |
| `\| wall` | A wall with no doors | No |
| `〰 open` | `open` — nothing there | Yes |
| `\| railing etc. (open to the air, not passable)` | A wall with `air:1` (railings, fences, garden walls) | No |
| `↕ stair` | `stair` | Yes |
| `↕ shaft (not passable)` | `shaft` (lifts and the like) | No |
| `↕ void` | `void` — the absence of a floor | No |

One door reads `1 door`; anything else reads `N doors`.

Vertical relations sit in the same list.

```sh
npx tsx src/cli.ts graph examples/house/main.muro
```

```text
/home/ldk (LDK)
  — 1 door → /home/hall1  (spec:LGS)
  | wall → /site/garden  (spec:EW)
  | wall → /site/west  (spec:EW)
  | wall → /site/east  (spec:EW)
  | wall → /site/north  (spec:EW)
  ↕ void → /home/void
/home/hall1 (玄関・階段)
  — 1 door → /home/ldk  (spec:LGS)
  — 1 door → /site/east  (spec:EW)
  | wall → /site/north  (spec:EW)
  ↕ stair → /home/hall2
```

(An excerpt from this building's full output.)

## Boundaries you never declared show up too

The default between touching spaces is a wall, so **a contact you did not write appears as a wall with no doors.** A `| wall` line carrying no attributes is usually one of these.

A space that lists no neighbours at all touches nothing. Suspect a mistake in its position, or the wrong level.

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Always (even with no spaces at all) |
| 1 | It could not be read because of a syntax or composition error |
| 2 | No file path was given (usage is printed) |

**`graph` never passes judgement.** However many impassable walls there are, it returns 0. For a verdict, use [`koyu doors`](doors.md) or [`koyu validate`](validate.md).

## See also

- [koyu doors](doors.md) — the fewest-door route between two points
- [koyu validate](validate.md) — picking unreachable rooms out of the whole building
- [.muro reference](../muro/index.md) — boundary kinds and attributes
- [The koyu command](index.md) — the shared promises about exit codes
