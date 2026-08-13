---
title: Connect storeys (stairs, shafts, voids)
mode: howto
---

# Connect storeys (stairs, shafts, voids)

Write stairs, lift shafts and voids between spaces that stack. Do not write riser counts, treads or slopes — let the form be derived.

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## The vertical default is a floor

Between two spaces whose plans overlap there is a **floor**, whether or not you write one. That is the default, so there is nothing to write for a floor. **You write only the exceptions**, and there are exactly three.

| Type | Passable | Floor | What it is for |
|---|---|---|---|
| `stair` | yes (counts 0 doors) | none | stairs, ramps, escalators |
| `shaft` | no | none | lift shafts, duct and pipe shafts |
| `void` | no | none | double-height voids |

**One word, `stair`, carries the whole topology of vertical passage.** A stair, a ramp and an escalator are the same relation — you can get from one level to the next — and the difference between the devices is declared on the space, not on the boundary. The three types are set out in [stack](../reference/muro/stack.md).

## 1. Put a space on each storey

A vertical relation is a relation between two spaces, so **both ends have to exist**. A stair needs a stair space on every storey it serves; a shaft needs a shaft space on every storey it passes.

```muro-part
space /L1..L3/st stair X2..X3 Y1..Y2 name:Stair lease.category:common stair:N form:return
space /L1..L3/ev shaft X3..X4 Y1..Y2 name:Lift  lease.category:common lift:1
```

A path whose head is a span, `L1..L3`, expands over the declared levels in z order. [Write a typical floor once](typical-floors.md) covers that notation.

**Vertical circulation is space.** It has area, it is passable, it carries escape. Reduce it to a connection and it drops out of the schedules.

## 2. Do not declare the form — choose the rule that generates it

Riser count, riser height, tread and slope appear **nowhere in the source**. You write where it is, how big it is and which way it climbs; the form follows from the level difference and the derived going.

| Attribute | Meaning |
|---|---|
| `stair:N/E/S/W` | a stair, and the direction of climb (N=+Y, S=−Y, E=+X, W=−X) |
| `ramp:N/E/S/W` | a ramp |
| `escalator:N/E/S/W` | an escalator |
| `lift:1` | a lift (no going) |
| `form:return` / `form:straight` | scissor/return flights, or one straight flight |
| `slope:` | declares the **maximum** gradient; used by validation |

There is no spiral stair. A spiral is written as successive returns (`form:return`). The full list of attributes is in [vertical circulation](../reference/muro/vertical-circulation.md).

## 3. Write the vertical boundaries

For two storeys, one `boundary` is enough.

```muro-part
boundary /L1/hall /L2/hall type:stair
```

**For many storeys, write it once with `stack`.** `stack <last path segment> <level range> type:` is the same as writing one vertical boundary per consecutive pair of levels.

```muro-part
stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

`stack ev L1..L3 type:shaft` is exactly these two lines:

```muro-part
boundary /L1/ev /L2/ev type:shaft
boundary /L2/ev /L3/ev type:shaft
```

A relation that spans storeys belongs to no storey's layer. Put it in the base layer when the building is split across files.

## Check it

```muro
muro 1.3
name Connecting storeys
unit mm

grid X 0 8400 11200 14000
grid Y 0 5600 8400

level L1 0 h:2800 slab:1400
level L2 4200 h:2800 slab:1400
level L3 8400 h:2800 slab:1400
level R 12600 slab:600

space /out name:Outside outside:1

space /L1..L3/st   stair X2..X3 Y1..Y2 name:Stair lease.category:common stair:N form:return
space /L1..L3/ev   shaft X3..X4 Y1..Y2 name:Lift lease.category:common lift:1
space /L1..L3/hall hall  X2..X4 Y2..Y3 name:Lift-lobby lease.category:common

space /L1/lobby     hall X1..X2 Y1..Y3 name:Entrance lease.category:common
space /L2..L3/office room X1..X2 Y1..Y3 name:Tenancy lease.category:exclusive

boundary /L1..L3/hall /L1..L3/st t:200 spec:RC
  door w:900 name:Stair-fire-door
boundary /L1..L3/hall /L1..L3/ev t:200 spec:RC
boundary /L1..L3/st /L1..L3/ev t:200 spec:RC

boundary /L1/lobby /L1/st t:200 spec:RC
boundary /L1/lobby /L1/hall type:open
boundary /L1/lobby /out edge:W t:200 spec:CW
  door w:1800 name:Front-entrance
boundary /L1/lobby /out edge:N t:200 spec:CW
boundary /L1/lobby /out edge:S t:200 spec:CW

boundary /L2..L3/office /L2..L3/st t:200 spec:RC
boundary /L2..L3/office /L2..L3/hall t:200 spec:RC
  door w:1600 name:Tenancy-entrance
boundary /L2..L3/office /out edge:W t:200 spec:CW
boundary /L2..L3/office /out edge:N t:200 spec:CW
boundary /L2..L3/office /out edge:S t:200 spec:CW

boundary /L1..L3/st /out edge:S t:200 spec:RC
boundary /L1..L3/ev /out edge:S t:200 spec:RC
boundary /L1..L3/ev /out edge:E t:200 spec:RC
boundary /L1..L3/hall /out edge:N t:200 spec:RC
boundary /L1..L3/hall /out edge:E t:200 spec:RC

stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

```text
$ npx tsx src/cli.ts check vert.muro
✔ Consistent — 13 spaces / 43 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

[`koyu runs`](../reference/cli/runs.md) answers with the form you did not write. Neither the riser count nor the tread appears anywhere in the source.

```text
$ npx tsx src/cli.ts runs vert.muro
L1→L2	lift	Lift	/L1/ev
L1→L2	stair	Stair	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/st
L2→L3	lift	Lift	/L2/ev
L2→L3	stair	Stair	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L2/st
L3→R	lift	Lift	/L3/ev
L3→R	stair	Stair	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L3/st
```

A stair is a passable edge that adds no doors. The four doors from the third-floor tenancy to the street are the tenancy entrance, the stair fire door on L3, the stair fire door on L1 and the front entrance — descending two storeys costs nothing.

```text
$ npx tsx src/cli.ts doors vert.muro /L3/office /out
4 doors — /L3/office → /L3/hall → /L3/st → /L2/st → /L1/st → /L1/hall → /L1/lobby → /out
```

A shaft is not a route. Continuous is not the same as passable.

```text
$ npx tsx src/cli.ts doors vert.muro /L1/ev /L2/ev
Cannot reach /L2/ev from /L1/ev
```

## Write a void

Where the ceiling below is open, **put a space declaring `void:1` on the upper storey** and write a `type:void` vertical boundary to the space below.

```muro-part
space /L2/void X2..X3 Y1..Y2 name:Over-the-living-room void:1

boundary /L1/ldk /L2/void type:void
```

A void carries no floor area, and [`koyu stats`](../reference/cli/stats.md) says so.

```text
L2
  /L2/bed	Main-bedroom	bedroom	26.50 m2
  /L2/hall	Upper-hall	hall	13.25 m2
  /L2/void	Over-the-living-room	void (not counted as floor area)
  Subtotal 39.75 m2
```

It is not passable either. The `↕ void` line in [`koyu graph`](../reference/cli/graph.md) looks like an edge, but nobody crosses it.

```text
/L2/void (Over-the-living-room)
  ↕ void → /L1/ldk
  | wall → /L2/bed
  | wall → /L2/hall
```

```text
$ npx tsx src/cli.ts doors two.muro /L1/ldk /L2/void
Cannot reach /L2/void from /L1/ldk
```

## Where it goes wrong

### The form is there but nothing connects — run.disconnected (caution)

Write `stair:` and `form:` but no `stack` and no vertical boundary, and the stair's form is derived while the circulation graph stays cut. `check` returns green. [`koyu validate`](../reference/cli/validate.md) is what catches it.

```text
⚠ [koyu.schematic.run.disconnected] vert-nostack.muro:line 15: /L1/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [koyu.schematic.run.disconnected] vert-nostack.muro:line 15: /L2/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
⚠ [koyu.schematic.run.disconnected] vert-nostack.muro:line 15: /L3/st has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)
```

### The steps come out cramped — stair.proportion (caution)

Too short a stair enclosure crams the same risers into a shorter going, and the tread starves. Shrink the stair space above from 8400 deep to 4000:

```text
$ npx tsx src/cli.ts runs vert-cramped.muro
L1→L2	lift	Lift	/L1/ev
L1→L2	stair	Stair	rise 4200mm	return	24 risers of 175mm, tread 164mm	going 3600mm	/L1/st
```

```text
⚠ [koyu.schematic.stair.proportion] vert-cramped.muro:line 15: Cramped step: /L1/st — derived tread 164mm, 2×riser+tread 514mm (wants tread ≥ 240mm and pace 550–700mm; deepen the shaft along travel, fold it with form:return, or raise riser:)
```

**What you fix is the size of the enclosure, not the size of the step.** [What koyu derives from the dimensions you write](choose-dimensions.md) varies one enclosure through six depths and prints the step each one produces.

### Escaping through a shaft

Of all the reasons `doors` says "cannot reach", `shaft` and `void` are the hardest to spot. A lift shaft that runs the full height of the building is still not a route. Escape has to go through `stair`.

## Next

- [Find spaces you cannot reach](find-unreachable.md) — test the route you think you built
- [Write a typical floor once](typical-floors.md) — when the same core repeats
- [What koyu derives from the dimensions you write](choose-dimensions.md) — what an enclosure size does to the step
