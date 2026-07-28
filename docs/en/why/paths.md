---
title: A path is an address and an aggregation hierarchy
mode: explanation
---

# A path is an address and an aggregation hierarchy

`/L5/A/ldk` is not a name but an address. And the hierarchy cut by `/` is itself the unit of aggregation. **A path plays two roles at once.**

Those two roles dissolve a problem that has been awkward in architectural data for years — **where to cut granularity.** At rooms? At dwelling units? At storeys? koyu's answer is "at all of them; the path makes them hold simultaneously".

## As an address

A path is human-readable. The outside world can point at a space without a table of UUIDs.

```muro-part
space /L5/A/ldk ldk X1..X3 Y1..Y2 name:リビングダイニング
```

Sensor readings, a booking system and a BEMS can all use the string `/L5/A/ldk` as a foreign key. **The path is the meaning.**

The leading segment of a path becomes a level **only when a `level` of that name is declared**. Writing `/L1/` does not conjure a level into existence.

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/x room X1..X2 Y1..Y2
```

```text
✖ p3.muro:line 3: /L1/x has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

An error, not a warning; the exit code is 1. **Without a level no form can be made**, so this counts as missing sufficiency.

The head of a path can express only one level, so **groupings that cross storeys (maisonettes and the like) are stated with the `level:` attribute.**

## As an aggregation hierarchy

A space with a region **may not have child spaces with regions**, because parent and child would overlap.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/home unit X1..X3 Y1..Y2
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

```text
✖ p1.muro:line 4: Space regions overlap: /L1/home and /L1/home/a
✖ p1.muro:line 4: Space regions overlap: /L1/home and /L1/home/b
```

**To split a dwelling into rooms, make the parent a `zone`, not a `space`.** A zone has no geometry; it is a counted aggregation that gathers whatever sits under its path prefix.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

```text
L1
  /L1/home/a	a	room	14.40 m2
  /L1/home/b	b	room	14.40 m2
  Subtotal 28.80 m2
Total 28.80 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/home	住戸	28.80 m2
```

The individual rooms come out, and the dwelling total survives. **You can split into a layout without losing the language of the dwelling** — that is what the double role buys.

From which one design guideline follows: **put the unit you want to aggregate by nearer the head of the path.**

The bundled examples use two idioms.

| Idiom | Examples | What you want to aggregate by |
|---|---|---|
| `/L1/room` — level first | `two-rooms`, `office`, `mansion`, `tower`, `complex` | area per storey, checks per storey |
| `/home/room` + `level:L1` — dwelling first | `house` | area per dwelling, maisonettes |

Neither is better. **It is a difference in what you want to group by.** When to reach for `zone` rather than `space` is covered in [zone](../reference/muro/zone.md).

## Paths change, which is why uid exists

Rename or restructure and the path changes, and any sensor or register that used it as a foreign key loses its join.

**When a reference must outlive the path, use `uid:`.** It is an opaque token, unique across the model, and not derived from the path.

```muro-part
space /L5/A/ldk ldk X1..X3 Y1..Y2 uid:u-7f3k9m2qx4b8dhtv
```

**Not derived from the path** is the crux. Derive it and a rename changes the token, and the whole point of a uid — pointing at the same thing across a rename — evaporates. When a machine makes one, it is random.

The division of labour is clean.

| Purpose | What to use |
|---|---|
| references inside the repository (`boundary`, `doors`, zone totals) | **the path** |
| aggregation hierarchy | **the path** |
| long-lived identity across renames (sensors, survey, registers) | **uid** |

`uid` may be written on `space` and `zone` and nothing else. It cannot go on a relation because a relation's identity is derived from its two ends ([A wall is a relation](boundary-is-a-relation.md)). The details are in [Identity](../reference/identity.md).

## It also works as a namespace

When composing several files, no per-layer namespace prefix is needed — **the path hierarchy is already a namespace.** Let `L5.muro` write `/L5/...` and `core.muro` write `/B2..L19/core/...` and nothing collides.

This is the result of borrowing from USD only the mechanism of a path namespace ([Composition is for time, not for size](composition-is-for-time.md)).

## Next

- [Writing `zone`](../reference/muro/zone.md)
- [Identity](../reference/identity.md)
- [Composition is for time, not for size](composition-is-for-time.md)
- [koyu stats](../reference/cli/stats.md)
