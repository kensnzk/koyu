---
title: Walls as boundaries
mode: explanation
---

# Walls as boundaries

`boundary /L1/a /L1/b` is not a line that places a wall. It is a line that declares **that a relation — a boundary — exists between two spaces**. The wall centerline itself is written nowhere; it is derived as the shared edge of the two regions.

From that single fact a set of rules falls out together. There is no need to memorise three separate things. **Remember that it is a relation and the rest follows.** The notation is in [boundary](../reference/muro/boundary.md).

## Substance rides on the relation

A boundary grants **the seat of a shared surface** between two spaces, and substance sits on that seat.

- **Horizontally** — wall, curtain wall, railing, glass partition, open
- **Vertically** — floor, ceiling, slab, roof, void, stair, ramp, lift, escalator

Thickness, specification, fire rating, sound rating, slope, top height — every value belonging to the substance is held by the relation. Openings are placed as intervals along it.

**Why not put it on the space?** Because a relation grants a seat and a space's attributes do not. Put substance on the space side and the derivation has to work out which surface it lands on, and that is where ambiguity enters. A state in which the slab between two storeys can be claimed separately by the space below as its ceiling and by the space above as its floor is not a source of truth. **With a relation, the owner is uniquely determined.**

That decision has a consequence. **The exterior must be a space.** For a roof to be a relation the sky must exist as the other space; for a ground-bearing floor to be a relation the ground must. This is why `space /out exterior` appears in `.muro` files.

## Rule 1 — no boundary may be written between spaces that do not touch

A relation declared where no segment can be derived is not a state that holds.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b
```

```text
✖ b1.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

These two rooms meet at a corner, but "touch" in koyu means **sharing an edge that has length**. A single corner point is not contact.

## Rule 2 — one relation may split into several segments

A boundary with a space that has no region — the exterior, typically — is the perimeter of the room minus the stretches where it meets other spaces. That usually falls on several sides. **One relation, several segments.**

So an opening in an external wall must say which side it is on.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/living /out
  door w:900
```

```text
✖ b2.muro:line 7: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)
```

Compass directions come from the coordinate system. **X is positive east, Y is positive north, so N=+Y, S=−Y, E=+X, W=−X.** And `edge` is **the side as seen from the rectangle of `a`** — the space written first.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/living /out t:150
  door w:900 edge:S
```

Swap the order of the two paths and `edge:S` picks a different side. The convention is in [orientation](../reference/muro/orientation.md), and choosing an edge is covered in [positions](../reference/muro/positions.md).

## Rule 3 — the same pair of spaces may not carry two boundaries

A relation has identity. Two lines for one relation means two answers to one question.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

```text
✖ b3.muro:line 7: Duplicate boundary: /L1/a | /L1/b (first seen at b3.muro:line 6)
```

Silently letting the later line win would mean **whether this is a wall or an opening is decided by line order**. That is not a source of truth.

## Because it is a relation, its identity need not be written

`uid` may be written only on spaces and aggregates (`space` / `zone`). **A relation cannot carry a uid.**

The reason is in the nature of a relation. A relation always lies between two spaces, so **fix both ends and the relation is fixed.** What the outside world wants to point at is a space; to point at a relation, point at its two ends.

And there is a matter of count. Relations outnumber spaces — the bundled mixed-use complex has 425 spaces and 1,364 boundaries. Writing a uid per relation would erode the very goal of fitting a whole building into a machine's field of view.

Identity as a whole is covered in [Identity](../reference/identity.md).

## Ordering constraints are small

A `boundary` may be written before the spaces it names — **relation declarations may refer forward.** Only `grid` and `level` must precede the lines that use them.

## Next

- [Default boundaries](silence.md) — why touching spaces default to a wall
- [How plans are generated](plan-is-not-a-section.md) — where segments come out of relations
- [Writing `boundary`](../reference/muro/boundary.md)
- [Default boundaries](../reference/muro/defaults.md)
