**English** · [日本語](../../howto/doors-and-escape.md)

# Ask about circulation and egress

Count how many doors are passed from a space to the outside, find the spaces that cannot be reached, and fix them.

`check` does not carry this question. What `check` looks at is only whether the composition stands up, not whether the building can be used. **A building with not one door written is completely sealed while `check` stays green.** Catching that sealing is the job of `doors`, and it is a check to run alongside `check` after every edit.

## Before you begin

- `check` passes with zero errors.
- You know the space paths of the origin and the destination. `koyu graph <file>` lists the paths.
- You know the rule about default boundaries — between touching spaces, absent a declaration, a wall with no door is derived ([spec/semantics.md §2, default boundaries](../../../spec/en/semantics.md) / [ADR-0014](../../../docs/decisions/0014-default-boundaries.md)).

## Steps

### 1. Prepare the file

The following is a two-storey house, and `check` is green on it. The only boundaries written are the four of the envelope and the one stair.

```muro
koyu 0.4
name 閉じた家
unit mm

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500

space /out exterior name:外部

space /L1/ldk  ldk     X1..X2 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y1..Y2 name:玄関
space /L2/bed  bedroom X1..X2 Y1..Y2 name:寝室
space /L2/hall hall    X2..X3 Y1..Y2 name:2階ホール

boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:玄関扉
boundary /L1/ldk /out edge:W t:150 spec:EW
boundary /L2/bed /out edge:W t:150 spec:EW
boundary /L2/hall /out edge:E t:150 spec:EW

boundary /L1/hall /L2/hall type:stair
```

```sh
npx tsx src/cli.ts check house.muro
```

```text
✔ 整合 — 空間 5 / 境界 7
```

Only five boundaries were written, yet there are seven. The two extra are the default walls derived between the touching rooms.

### 2. Count the doors

```sh
npx tsx src/cli.ts doors house.muro /L2/bed /out
```

```text
/L2/bed から /out へは到達できません
```

("/L2/bed cannot reach /out.") The exit code is 1. There is no way out of the bedroom of a green building.

### 3. If it is unreachable, look at the adjacencies

`graph` lists the neighbors of each space, tagged with the kind of boundary.

```sh
npx tsx src/cli.ts graph house.muro
```

```text
/out (外部)
  — 扉1 → /L1/hall  (spec:EW)
  | 壁 → /L1/ldk  (spec:EW)
  | 壁 → /L2/bed  (spec:EW)
  | 壁 → /L2/hall  (spec:EW)
/L1/ldk (LDK)
  | 壁 → /out  (spec:EW)
  | 壁 → /L1/hall
/L1/hall (玄関)
  — 扉1 → /out  (spec:EW)
  ↕ 階段 → /L2/hall
  | 壁 → /L1/ldk
/L2/bed (寝室)
  | 壁 → /out  (spec:EW)
  | 壁 → /L2/hall
/L2/hall (2階ホール)
  | 壁 → /out  (spec:EW)
  ↕ 階段 → /L1/hall
  | 壁 → /L2/bed
```

(`| 壁` is "wall", `— 扉1` is "1 door", `↕ 階段` is "stair".)

`| 壁` is a wall with no door, and cannot be passed. The `| 壁` lines carrying no `spec:` (`/L1/ldk` ↔ `/L1/hall` and `/L2/bed` ↔ `/L2/hall`) are the default walls, derived without being written. There is no way out of the bedroom into the hall, nor from the LDK into the entrance.

### 4. Write a door on the boundary that cannot be passed

To add a door to a default wall, declare that pair's boundary and put a `door` under it by indentation. The moment it is declared, derivation stops for that pair and the boundary you wrote becomes its boundary.

```muro-part
boundary /L1/ldk /L1/hall t:120 spec:LGS
  door w:800
boundary /L2/bed /L2/hall t:120 spec:LGS
  door w:800
```

### 5. Count again

```sh
npx tsx src/cli.ts doors house.muro /L2/bed /out
```

```text
2枚 — /L2/bed → /L2/hall → /L1/hall → /out
```

("2 doors.")

## Which boundaries become edges

The edges of the graph `doors` uses are settled by the boundary kind alone.

| Boundary | Passable? | Doors counted |
|---|---|---|
| `wall` (the default; no door) | No | — |
| `wall` + `door` | Yes | 1 |
| `open` | Always | 0 |
| `stair` (vertical) | Always | 0 |
| `shaft` (vertical) | No | — |
| `void` (vertical) | No | — |

`air:1` is about shielding, not about passage. Railings, fences, and walls let air through but not people — if you want passage, write a door (the gate in `examples/house.muro` is exactly this: a `door w:900` riding on the boundary of a wall). For the exact definition see [spec/semantics.md §4, passability](../../../spec/en/semantics.md).

There are three reasons for "cannot reach".

1. There is a wall with no door on the route (including a default wall) — much the most common.
2. The route passes through a `shaft` or a `void`. An elevator shaft is continuous but is not a route.
3. The origin or destination path does not exist. A misspelling returns the same wording, so confirm the path with `graph` first.

## Confirming it

On the bundled tower, count from a ninth-floor dwelling to the road on the south.

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L9/A/ldk /out/road-s
```

```text
4枚 — /L9/A/ldk → /L9/A/hall → /L9/corridor → /L9/st2 → /L8/st2 → /L7/st2 → /L6/st2 → /L5/st2 → /L4/st2 → /L3/st2 → /L2/st2 → /L1/st2 → /site/west → /site/walk → /out/road-s
```

The four are the door inside the dwelling (LDK to entrance), the dwelling's entrance door, the fire door of the stair enclosure, and the exterior exit on the ground floor. The stair adds no doors across the eight storeys from the ninth to the first (`stair` counts 0). Between the setback walkway and the road it is `type:open`, so that is 0 as well.

A shaft cannot be passed.

```sh
npx tsx src/cli.ts doors examples/tower/main.muro /L1/ev /L2/ev
```

```text
/L1/ev から /L2/ev へは到達できません
```

Nor can a railing. The void and the upstairs hall in `examples/house.muro` are separated by an `air:1` railing.

```sh
npx tsx src/cli.ts doors examples/house.muro /home/void /home/hall2
```

```text
/home/void から /home/hall2 へは到達できません
```

The exit code is 0 when it is reachable and 1 when it is not. Use that when guarding an escape route in CI.

## Related

- [The how-to index](README.md)
- [Add a level](add-a-level.md) — how to connect with a stair
- [Subdivide a dwelling](unit-layout.md) — putting doors between the rooms you split out
- [Getting unstuck](troubleshooting.md) — how to fix the line where `check` is green but `doors` says unreachable
- [Six ideas](../concepts.md) — that a boundary is a relation, and that the default is a wall
- [The diagnostic index](../diagnostics.md)
- [spec/semantics.md](../../../spec/en/semantics.md) §4 passability, §6 doors — the normative definitions
- [spec/language.md](../../../spec/en/language.md) §4 boundary — the grammar of kinds and openings
- [ADR-0014](../../../docs/decisions/0014-default-boundaries.md) — why the default was made a wall, and how the "these touch but no boundary is declared" warning (BND07) came to be retired
