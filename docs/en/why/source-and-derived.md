---
title: What the source holds, what koyu computes
mode: explanation
---

# What the source holds, what koyu computes

**There is no form in a `.muro` file.** Plans, areas, the inside/outside distinction, circulation — none of it is written in the source; all of it is derived.

This is not thrift but a definition of role. **Geometry is about to become available from reality.** Scanning, SLAM, photogrammetry, splats — the means of acquiring form keep getting cheaper. There is no reason to hold in the source what you will be able to capture.

**And some things never come out of a point cloud.** What kind of space is this. Whose boundary is this, between which two spaces. May this door be used. Since when. **Meaning, relation and identity cannot be observed. They can only be written.**

So this description holds what can only be written. **Not holding form in the source is not a compromise; it is the definition of the role.** And holding only what must be written makes it small. Small enough that a whole building fits into a machine's field of view — **smallness is not the goal but a consequence of the role.**

## One table

The two columns are not paired rows; each is an independent list.

| Written (the source) | Derived |
|---|---|
| the region of a space (union of grid-referenced rectangles) | wall centerline segments |
| the boundary relation (its two ends, kind, attributes) | default boundaries (horizontal walls, vertical floors) |
| openings (`door` / `window`) | areas (to wall centerlines) and indoor floor area |
| `grid` and `level` | vertical adjacency |
| the site polygon (`polygon`) | semi-outdoor and covered-above |
| assets and zones | passability |
| uncounted subdivisions (`area` / `seg`), `uid` | the plan, daylight inputs, frontage and coverage ratio, canonical JSON |

That table answers two beginner questions at once.

**"Where do I write the floor?"** — You do not. Spaces overlapping in plan on adjacent levels are vertically adjacent, and the default reading is that there is a floor. Only the exceptions (stair, shaft, void) are declared as boundaries.

**"I want to declare this space semi-outdoor."** — You cannot. Semi-outdoor is derived. A space with a region that meets the exterior across an `open` or `air:1` boundary is semi-outdoor ([Not writing something means something](silence.md)).

## Only the given carries coordinates

Inside the source there are three tiers.

| Tier | What it is | Coordinates | Substance |
|---|---|---|---|
| **the given** | grid lines, levels, the site polygon | **yes — the one absolute origin** | no |
| **relations** | what lies between two spaces | uniquely determined by the given | **lives here** |
| **spaces** | carry name, use and meaning | none; positioned relative to the given | no |

> **The given grants coordinates, relations hold substance, spaces hold names.**

**Grid lines, levels and the site polygon come from survey and from decisions; they are not products of design.** That is why they may carry coordinates. Put the other way round: what is written is the given, and what is not written is the product of design. That is how "form is not written" and "the site polygon is written" stop contradicting each other.

```muro-part
grid X 0 8400 16800 25200          # given — set by survey and structural planning
level L1 0 h:4200 slab:1400        # given
polygon /site -2600,-7000 38000,-7000 38000,15600 2000,16800   # given — the one written form
space /L1/lobby hall X1..X3 Y1..Y2 # refers to the given; holds no coordinates
```

The position of a space is always written as a grid reference (`X2+450` and the like). **There is no route by which a raw coordinate reaches a space.**

## What has no seat holds only containment

Things that do not live on a relation — equipment placed in a space, for instance — are held by a reference to a type plus **which space contains them**. No form can be built from containment.

**Containment is meaning, not place.** Try to derive place from containment and you need a placement mechanism, and then this description becomes **a placement tool**. Ruling that containment grants no seat is what closes that door.

Columns sit in between. A column's position is written nowhere; it **appears where a grid crossing meets a floor** — the given meeting the given, so it has a seat. It is the rule that makes walls appear from boundaries, applied to a point element ([column](../reference/muro/column.md)).

## Derivation and generation are different

One step outside derivation lies **generation**.

- **Derivation** — what is uniquely determined by the written composition: areas, segments, columns, riser counts, floors and roofs. The same source always yields the same thing.
- **Generation** — how the derived form is shown: line weight, colour, symbols, annotation, scale.

**"The same composition yielding several forms" is a defect.** What may be plural is the appearance, not the form. That line is enforced by machine — see [The same source must yield the same form](form-must-be-unique.md).

Take riser counts. Neither risers nor treads nor slope is written in the source. They are derived from **the region, the floor-to-floor height, and a declaration of which way is up**.

```sh
npx tsx src/cli.ts runs examples/complex/main.muro
```

```text
B2→B1	ramp	車路	rise 4200mm	return	slope 1/9.2	going 38800mm	/B2/ramp
B2→B1	stair	階段1	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/B2/st1
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
L1→L2	stair	階段1	rise 6600mm	return	37 risers of 178mm, tread 300mm	going 10800mm	/L1/st1
```

The same-sized stair enclosure takes 37 risers or 24 depending on the storey height. **Change the storey height and the riser count changes.** Nothing has to be recounted in the source.

## The machine format holds no derivation either

Canonical JSON holds **the result of composition**, not the result of derivation. A derived default boundary is not part of the written composition, so it does not appear there.

This is why `check` saying "1 boundary" and `koyu json` reporting `"boundaries": []` look like a contradiction. **The first counts meaning after derivation; the second counts the written source.** Because the rules are set out explicitly and a reference implementation is offered as an API, consumers never have to reimplement the meaning ([Canonical JSON](../reference/json/index.md)).

## Next

- [The same source must yield the same form](form-must-be-unique.md)
- [A plan is not a horizontal section](plan-is-not-a-section.md)
- [Form — what derivation returns](../reference/form/index.md)
- [The resolution of this data](resolution.md)
