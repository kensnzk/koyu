---
title: Level of detail
mode: explanation
---

# Level of detail

There is a lot a `.muro` file cannot say. Junctions, substrates, connections, curved surfaces, equipment model numbers — none of them.

**That is not omission but a choice of abstraction level.** Nor is it "not enough yet" — add and you fall out of the machine's field of view, and the goal breaks. **Coverage percentage is not a value.**

## The abstraction level drawings have carried for centuries

Most of the composition is settled in two dimensions: the planar layout, adjacency, circulation. Onto that go levels, heights, voids and relations that cross storeys. **That settles an orthogonal-grid building.**

The important point is that this is not a new abstraction. **That practice still delivers drawings, and that permits are still granted on drawings, is because architectural decisions are made at this level of abstraction.**

All koyu does is move that level from paper to machine-readable text. **The resolution was not lowered; the resolution at which decisions are made was adopted as it is.**

## What can be said at this resolution

Of the bundled eleven-storey mixed-use building you can ask this.

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
Frame: EPSG 6677 / easting -6250.48 m / northing -35720.115 m / elevation 3.85 m of z=0 (vertical CRS 6695)
Bearing: +Y bears 352.4° true — 7.6° west of true north
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436%
```

Areas, totals by use, the ratio of net to common, frontage and coverage and floor area ratios, daylight inputs, circulation measured in doors, riser counts and treads and slopes, where columns stand, holes in the envelope. **Nearly everything decided at scheme design can be answered at this resolution.**

```text
By use: rentable 558.08 m2 (11.7%) / common 1611.52 m2 (33.7%) / exclusive 2616.32 m2 (54.7%)
```

## What cannot be said at this resolution

| Not sayable | Where it belongs |
|---|---|
| junctions, substrates, connections | detailed design. The language of things |
| material layer build-ups (`spec` is a name only) | detailed design; a candidate for a later composition layer |
| curved and free-form geometry | out of scope. This targets buildings an orthogonal grid suffices for |
| structural analysis (stresses, member sizing) | structure is a separate layer of things |
| services calculations (loads, air volumes, pipe sizing) | out of scope. Risers, lifts and plant rooms are writable as spaces |
| pitched roofs, eaves, parapets | not yet. Flat roofs are derived |
| composite vertical profiles (upstand plus coping handrail) | not yet |
| 2nd-level space boundaries for thermal analysis | out of scope |
| door and window frames, ironmongery, folding leaves | not yet |
| true north and geodetic coordinates | not yet. A prerequisite for city-data connections |

**Writing "not yet" and "out of scope" as separate things is the crux.** "Not yet" is a candidate to be judged by the five questions; "out of scope" is something decided as policy not to hold ([Extending attributes](open-vocabulary.md)).

The lists are [IFC4 coverage](ifc4-coverage.md) and [What koyu does not hold](../reference/not-held.md).

## Adding breaks the goal

**Not pursuing production-drawing resolution** is not merely a matter of not having the hands.

A 31,606 m² mixed-use complex is 12,685 tokens of source. **A whole building fits inside one LLM context.** The same scene in IFC is an order of magnitude larger, and what a production authoring tool exports (tens of megabytes) fits in no context at all ([Comparison with IFC and USD](vs-ifc.md)).

**Smallness is not the goal but a consequence of the role.** And the role is to hold what can only be written — meaning, relation, identity. Form is about to become available from reality ([Derived information](source-and-derived.md)).

Add junctions and the smallness goes. Lose the smallness and the building no longer fits in the field of view. **Out of the field of view, an agent cannot edit it, diffs cannot be read, and it does not scale to the city.** Raising coverage breaks all four at once.

## Resolution is not "coarse" but "where it gets decided"

Granularity can be made finer, and it is cheap. In the same complex, the podium layer produces 92 spaces from 140 lines and the hotel layer 84 spaces from 117 — **under two lines per space.** Re-cutting tenancies finer adds at that rate.

**Choosing the resolution is a design decision, not a limit of the notation.** Hold the car park as one space or as bays. Hold the office typical floor as three tenancies or divide it down to layout. **Both are writable.**

And the size of the written source is proportional **not to the size of the building but to the number of design decisions.**

## check guards consistency, not the realism of dimensions

This is easy to get wrong.

**A 2 m-wide lift and a 30 m-deep tenancy both come out green.** They are not contradictions in the composition ([What check guarantees](green-is-not-a-building.md)).

So writing a building that is *plausible* at scheme-design resolution means **taking dimensions from reality**. For reference, a few values taken from Japanese practice and from real products.

| Element | Value | Basis |
|---|---|---|
| basic span, offices and retail | 8,400 | the modal value for large Japanese offices; also divides into three parking bays (2,800 × 3) |
| lift shaft, 1600 kg class, one car | 2,800 W × 2,400 D | a 2,150 × 1,600 car plus counterweight plus structural allowance |
| office typical storey height | 4,200 | 2,800 ceiling plus 1,400 void |
| office tenancy depth (core to window) | 8.4–12.6 m | beyond 18 m both the working environment and the structure break down |
| hotel guest room | 4,200 wide × 8,400 deep ≈ 35 m² | width is half a span |
| double-loaded corridor | 2,400 | the standard for hotels and housing |

**Decide the dimensions, then write the spaces.** Do it the other way round and `check` passes but you do not have a building. This is design knowledge, not a norm — **what koyu guards is consistency, not realism.**

## Upstream and downstream

This resolution is not isolated. **There is room to extend both up and downstream.**

**Downstream** — on top of a settled composition, a person adds lines and raises the level of detail. Less derivation of position, more pins.

**Upstream** — give only the site and the brief, and have the composition itself generated. Only the site and the brief are pinned. In that direction the written source becomes **a record of a solution.** What is probabilistic is the agent's choice, and **the written source is a deterministic fixed point** — the build yields the same building every time.

**Both ride on the same notation.** Taking the present resolution (a resolved composition) as the midpoint, both are the same movement, extending the vocabulary of what is stipulated towards detail on one side and towards the brief on the other.

## Next

- [IFC4 coverage](ifc4-coverage.md) — what can be written, and what will not be
- [What koyu does not hold](../reference/not-held.md)
- [What check guarantees](green-is-not-a-building.md)
- [Comparison with IFC and USD](vs-ifc.md)
