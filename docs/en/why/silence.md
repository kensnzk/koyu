---
title: Not writing something means something
mode: explanation
---

# Not writing something means something

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

## Only the third is different

**Internal walls are automatic; external walls are manual.** This asymmetry does not show up in a table of default values. Miss it and the drawing breaks.

The file above passes `check`, and yet **it has no external walls at all**. The only thing drawn in black is the one line in the middle — the derived default wall. The perimeter has nothing.

An envelope appears only once an exterior space and boundaries to it are written.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

**There is a reason.** *Which* exterior — street, neighbouring plot, garden, common corridor — is itself information, and no default can derive it. Whether the exterior is one monolithic `/out` or is split by orientation is a design decision. Road frontage is measured against exterior spaces declared as roads, so how you split it changes the numbers.

**The dividing line is not "is it `exterior`" but "does it have a region".** An exterior space that does have a region and a level — `space /out/garden exterior X2..X3 Y1..Y2 level:L1` — gets a derived default wall against the rooms it touches.

## A missing envelope is not caught by green — it is caught by judgement

`check` does not look at envelope gaps, because a gap is not a contradiction in the composition.

Judgement does.

```sh
npx tsx src/cli.ts validate gap.muro
```

```text
⚠ [envelope.gap] gap.muro:line 6: Perimeter not faced by any envelope: /L1/b — S 3600mm / E 4000mm / N 3600mm (11200mm over 3 run(s)). Write a boundary to the exterior
```

The rule is deliberately coarse — it looks only at **levels where at least one boundary to the exterior has been written**. It will not call a storey whose envelope has not been modelled yet "full of holes". It demands "if you started, finish"; it does not demand completeness. Coarseness is allowed because judgement lives in a domain that does not freeze ([Two kinds of green](two-kinds-of-green.md)). The rule is [envelope.gap](../reference/validate/envelope.md).

## Silence generates derivation — semi-outdoor

The three tiers pay off most clearly in semi-outdoor space. **Semi-outdoor cannot be declared. It is derived.**

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room ldk X1..X2 Y1..Y2
space /L1/balcony balcony X2..X3 Y1..Y2
space /out exterior
boundary /L1/room /L1/balcony t:150
  window w:1600 h:2000
boundary /L1/balcony /out type:open
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

- [What the source holds, what koyu computes](source-and-derived.md)
- [A green check is not a usable building](green-is-not-a-building.md)
- [Default boundaries](../reference/muro/defaults.md)
- [Derivation constants](../reference/form/constants.md) — what is derived when nothing is written
