---
title: Find spaces you cannot reach
mode: howto
---

# Find spaces you cannot reach

Sweep out the rooms nobody can get into, then write the openings that connect them.

**`check` does not ask this question.** `check` looks at whether what is written contradicts itself as data, not at whether the building works. **A building with no doors at all is completely sealed and completely green.** [`koyu validate`](../reference/cli/validate.md) and [`koyu doors`](../reference/cli/doors.md) are what catch it — run them beside `check` on every edit.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Why buildings seal themselves

Between two spaces that touch, and about which nothing has been declared, a **wall with no door** is derived. That is the default, and a default wall is not passable. Adding a room is, by itself, connecting it to nothing.

## 1. Sweep the whole model — validate

`validate` lists **every** room that cannot reach the exterior. You do not have to nominate a starting point.

```muro
koyu 1.1
name A sealed house
unit mm

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /out name:Outside outside:1

space /L1/ldk  ldk     X1..X2 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y1..Y2 name:Entry
space /L2/bed  bedroom X1..X2 Y1..Y2 name:Bedroom
space /L2/hall hall    X2..X3 Y1..Y2 name:Upper-hall

boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:Front-door
boundary /L1/ldk /out edge:W t:150 spec:EW
boundary /L2/bed /out edge:W t:150 spec:EW
boundary /L2/hall /out edge:E t:150 spec:EW

boundary /L1/hall /L2/hall type:stair
```

```text
$ npx tsx src/cli.ts check house.muro
✔ Consistent — 5 spaces / 7 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Five boundaries written, seven reported: the other two are default walls between rooms that touch. `check` is green.

```text
$ npx tsx src/cli.ts validate house.muro
⚠ [koyu.schematic.envelope.gap] house.muro:line 13: Perimeter not faced by any envelope: /L1/ldk — N 3600mm / S 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
⚠ [koyu.schematic.envelope.gap] house.muro:line 14: Perimeter not faced by any envelope: /L1/hall — N 1800mm / S 1800mm (3600mm over 2 run(s)). Write a boundary to the exterior
⚠ [koyu.schematic.envelope.gap] house.muro:line 15: Perimeter not faced by any envelope: /L2/bed — N 3600mm / S 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
⚠ [koyu.schematic.envelope.gap] house.muro:line 16: Perimeter not faced by any envelope: /L2/hall — N 1800mm / S 1800mm (3600mm over 2 run(s)). Write a boundary to the exterior
✖ [koyu.schematic.access.unreachable] house.muro:line 13: Cannot reach the exterior: /L1/ldk (no passable boundary leads out — write a door)
✖ [koyu.schematic.access.unreachable] house.muro:line 15: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
Validation — 2 violations / 4 cautions
```

`koyu.schematic.access.unreachable` is the violation, and it is the trap. **`validate` exits 1 only when there are violations** — that single command is enough to defend escape routes in CI. As a bonus, `koyu.schematic.envelope.gap` reports perimeter that faces nothing at all. The full list of rules is the [validation reference](../reference/validate/index.md).

## 2. Count one route — doors

To count between a specific pair, use `doors`. It prints the fewest doors and the route.

```text
$ npx tsx src/cli.ts doors house.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

Exit code 1. You cannot get out of the bedroom of a green building.

## 3. See which edges are walls — graph

[`koyu graph`](../reference/cli/graph.md) lists each space's neighbours with the kind of boundary between them.

```text
$ npx tsx src/cli.ts graph house.muro
/out (Outside)
  — 1 door → /L1/hall  (spec:EW)
  | wall → /L1/ldk  (spec:EW)
  | wall → /L2/bed  (spec:EW)
  | wall → /L2/hall  (spec:EW)
/L1/ldk (LDK)
  | wall → /out  (spec:EW)
  | wall → /L1/hall
/L1/hall (Entry)
  — 1 door → /out  (spec:EW)
  ↕ stair → /L2/hall
  | wall → /L1/ldk
/L2/bed (Bedroom)
  | wall → /out  (spec:EW)
  | wall → /L2/hall
/L2/hall (Upper-hall)
  | wall → /out  (spec:EW)
  ↕ stair → /L1/hall
  | wall → /L2/bed
```

`| wall` is a wall with no door in it, and nobody passes. **A `| wall` line with no `spec:` is a default wall — derived, never written.** Those are `/L1/ldk` ↔ `/L1/hall` and `/L2/bed` ↔ `/L2/hall`: no way out of the bedroom, no way out of the living room.

## 4. Write a door on the boundary that blocks

To put a door into a default wall, declare that pair's boundary and indent a `door` under it. **Declaring it stops the default from being derived; what you wrote is now the boundary for that pair.**

```muro-part
boundary /L1/ldk /L1/hall t:120 spec:LGS
  door w:800
boundary /L2/bed /L2/hall t:120 spec:LGS
  door w:800
```

```text
$ npx tsx src/cli.ts doors house.muro /L2/bed /out
2 doors — /L2/bed → /L2/hall → /L1/hall → /out

$ npx tsx src/cli.ts validate house.muro
Validation — 0 violations / 4 cautions
```

The violations are gone. The four remaining cautions are gaps in the envelope.

## Which boundaries are edges

The graph that `doors` and `koyu.schematic.access.unreachable` walk is decided by the boundary type alone.

| Boundary | Passable | Doors counted |
|---|---|---|
| `wall` (default, no door) | no | — |
| `wall` with a `door` | yes | 1 |
| `open` | always | 0 |
| `stair` (vertical) | always | 0 |
| `shaft` (vertical) | no | — |
| `void` (vertical) | no | — |

**`air:1` is about enclosure, not about passage.** Balustrades, railings and boundary walls let air through and people not. Write a door if people should pass.

```text
$ npx tsx src/cli.ts doors examples/house.muro /home/void /home/hall2
Cannot reach /home/hall2 from /home/void
```

A shaft is continuous and still not a route.

```text
$ npx tsx src/cli.ts doors examples/tower/main.muro /L1/ev /L2/ev
Cannot reach /L2/ev from /L1/ev
```

## Three reasons for "cannot reach"

1. **A doorless wall on the route** — including a default wall. By far the most common.
2. **The route passes through a `shaft` or a `void`.** A lift shaft that runs the full height of the building is not a route.
3. **The start or the end path does not exist.** A misspelling produces the same message, so check the paths with `graph` first.

## Doors that open where there is no floor

There is one way to have a door and still not pass: a door that opens only onto a void. There is no floor, so nobody crosses.

```text
✖ [koyu.schematic.access.unreachable] voidonly.muro:line 14: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
✖ [koyu.schematic.access.voidonly] voidonly.muro:line 14: Doors open only onto a void: /L2/bed (they open where there is no floor, so nobody can pass)
```

The same thing happens outdoors. **Give a balcony only a `window` and nobody can step onto it.** An opening is either passage (`door`) or daylight (`window`); one opening cannot claim both. A full-height sliding assembly is written as a `door` for the sliding leaves and a `window` for the fixed panes.

## Cars that cannot get out

Car parks have their own test, separate from the pedestrian one. `koyu.schematic.access.parking` is a violation when a car park has **no opening at least 2400mm wide, no `type:open` boundary and no ramp**. A basement car park served only by a person-sized door is caught here.

```text
✖ [koyu.schematic.access.parking] main.muro:line 32: No vehicle route to the exterior: /B2/park (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
✖ [koyu.schematic.access.parking] main.muro:line 32: No vehicle route to the exterior: /B1/park (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
✖ [koyu.schematic.access.parking] main.muro:line 33: No vehicle route to the exterior: /B2/ramp (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)
```

## Next

- [Connect storeys](connect-storeys.md) — when to use `stair` and when `shaft`
- [Subdivide a dwelling into rooms](subdivide-a-unit.md) — doors between the rooms you just made
- [Add a storey](add-a-storey.md) — confirming the new storey is not floating
