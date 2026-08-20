---
title: Default boundaries
mode: explanation
---

# Default boundaries

koyu's notation is short not because there is little to learn but because **there is much that goes unwritten**. Read the syntax tables without knowing what is left out, and what leaving it out means, and you cannot tell whether a file has too few lines or too many.

**There are three kinds of "not writing", and they mean different things.**

| Kind of contact | What silence means | So what is a declaration for |
|---|---|---|
| Two spaces with regions touching in plan on the same level | **a wall** (derived) | exceptions (`type:open` / `air:1`), and attributes and openings |
| Spaces on adjacent levels overlapping in plan | **a floor** (derived) | exceptions (`stair` / `shaft` / `void`) |
| Contact with a space that has no region (`exterior` and the like) | **nothing at all** | the envelope itself |

The rules as written are in [Default boundaries](../reference/muro/defaults.md). What this page explains is why the three tiers are shaped this way.

## The first two are symmetrical

**Horizontally a wall, vertically a floor. Neither is written.**

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out outside:1
boundary /L1/a /out
boundary /L1/b /out
```

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

There is a wall between the two rooms. Where storeys overlap, there is a floor between them. **Both are the architectural default; the exception is the rare case.**

Invert the default and the reason for this choice becomes visible. If a wall between two touching rooms had to be written, a file would need roughly as many `boundary` lines as it has spaces — 1,364 of them for a 425-space building. That is not description but **dictation**, and it carries not one design decision.

**A declaration is needed only to depart from the default, or to give the defaulted substance a value.**

```muro-part
boundary /L1/a /L1/b type:open          # exception — open, not a wall
boundary /L1/a /L1/b t:120 spec:PW1     # give the defaulted wall a thickness and a spec
boundary /L1/hall /L2/bed type:stair    # exception — a stair, not a floor
```

There used to be a warning for "these touch but no boundary is declared". Once the default became a wall it had no work left to do, and it was retired. **Where silence carries positive meaning, it is not an omission.**

## The outside is not an exception

**Every side of a space is a wall unless something says otherwise** — the side facing another room, and the side facing the weather alike. Nothing about a boundary changes when the thing on the far side is the outdoors.

It was not always so. Until muro 1.4 the exterior was carved out of the default: a boundary between touching spaces was derived, but a boundary to a space with no region was not. The reason was real — *which* exterior a face looks at (street, neighbouring plot, garden, common corridor) is information no default can derive, and road frontage is measured against exterior spaces declared as roads, so how you split them changes the numbers.

**The reason was real and the rule still did not pay.** Naming was not something the old rule obtained; it was something the old rule *demanded*, and what you got for forgetting was not a name but a hole — no wall in the plan, a gap in the solids, and `check` green over the top of it. On a 425-space building that came to 34 missing stretches of wall, of which a person reading the model found two.

So the default moved and the naming stayed:

```muro-warn
muro 1.4
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

Six lines, and both rooms are enclosed — one wall between them and a wall around the outside of each. What is missing is not substance but a name, and `check` says exactly that:

```text
⚠ …/rooms.muro:line 5: A default wall was derived where /L1/a faces the outside: S 3600mm / N 3600mm / W 4000mm (11200mm over 3 runs) — write a boundary to say which outside it faces
⚠ …/rooms.muro:line 6: A default wall was derived where /L1/b faces the outside: S 3600mm / E 4000mm / N 3600mm (11200mm over 3 runs) — write a boundary to say which outside it faces
✔ Consistent — 2 spaces / 3 boundaries (2 warnings)
```

Write the name and the warning goes; the walls were never in question.

```muro
muro 1.4
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

**This is the shape the whole page argues for.** Silence gives you the ordinary thing; a declaration departs from it, or gives the defaulted substance a value. The exterior used to be the one place where silence gave you nothing instead, and being the exception is what made it the thing everybody forgot.

**Suppression works by run, not by pair.** Between two spaces, one declaration covers the pair. The outside is not a pair — it is whatever the rest of the perimeter faces — so a boundary written `edge:S` takes the south run and the default keeps the other three. You cannot half-declare your way back into a hole.

## Silence generates derivation — semi-outdoor

The three tiers pay off most clearly in semi-outdoor space. **Semi-outdoor cannot be declared. It is derived.**

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room ldk X1..X2 Y1..Y2
space /L1/balcony balcony X2..X3 Y1..Y2
space /out outside:1
boundary /L1/room /L1/balcony t:150
  window w:1600 h:2000
boundary /L1/balcony /out type:open
boundary /L1/room /out
```

The last line is what makes the balcony semi-outdoor. Writing `type:terrace`, or `type:balcony`, does not — **it is the boundary that makes it so.**

```text
L1
  /L1/room	room	ldk	14.40 m2
  /L1/balcony	balcony	balcony	7.20 m2 (semi-outdoor, reported separately)
  Subtotal 14.40 m2
Total 14.40 m2 (indoor floor area)
Semi-outdoor 7.20 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
```

A space with a region that meets the exterior across an `open` or `air:1` boundary is semi-outdoor. A terrace enclosed by a railing is written with `air:1` — there is a thing, but it blocks neither air nor light — and that alone satisfies the condition. **You do not declare the property; you write the composition that produces it.**

## Silence is not licence to be empty

Not having to write something is different from getting a form without it. **If information needed to make a form is missing, `check` errors.**

If no ceiling height can be determined, no wall and no column stands on that level, so this is an error (SUF01). A space that has a region but no determinable level is an error too (SUF02). **koyu does not invent a default and press on** — if a thing cannot be made, it is not made, and the fact is put into words.

The list is in [SUF — sufficiency](../reference/diagnostics/suf.md).

## Next

- [Derived information](source-and-derived.md)
- [What check guarantees](green-is-not-a-building.md)
- [Default boundaries](../reference/muro/defaults.md)
- [Derivation constants](../reference/form/constants.md) — what is derived when nothing is written
