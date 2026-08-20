---
title: The space-centred model
mode: explanation
---

# The space-centred model

What architecture deals in is not walls, floors and ceilings themselves but the space they produce. Yet architectural data has consistently described the things to be built. **koyu reverses the order — enumerate the rooms and the walls between them come with them.**

This page explains what that reversal is and why it is the natural one. The notation itself is in [space](../reference/muro/space.md).

## For thirty years nobody digitised the reading

A plan is, properly, a description of composition. Lines and symbols convey how space is divided and connected, and the reader reconstructs the space in their head. The content of a drawing *is* that **reading**.

The history of digitisation has never once captured it.

- **CAD captured the lines of the drawing.** The meaning stayed in the reader's head, exactly as in the paper era.
- **BIM gave things meaning.** But it attached that meaning to three-dimensional component solids. Space became something derived afterwards from what the components enclosed.

That `IfcSpace` exists in the IFC schema yet remains a second-class citizen — often not even exported — follows from that ordering. **The representation of things got ever more refined; nobody digitised the reading.**

Making form the source has three symptoms.

**The data is locked to the tool.** As long as the source lives in an authoring tool's proprietary database, what can be done with the model is bounded by that tool's UI and API.

**Versions cannot be managed.** In a format whose entities cross-reference by line number, re-exporting breaks the diff of the entire file. Which file counts as current is then decided by human process, not by the data.

**It does not connect to the outside world.** Ontologies, digital twins and city data all need space, topology and meaning — not solids. Re-extracting those from a set of components is what turns every connection into a bespoke integration project.

## What happens when you reverse it

Make space the primary element: rooms, zones, exterior regions. **A wall is not an independent thing but a relation — the boundary between two spaces.** An opening is a connection made through a boundary.

These four lines are the smallest file that is consistent and can be drawn in plan.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

No `koyu 1.0`, no `unit mm`, no `name`. All that is required is two grid axes, declared before the lines that use them, a declared level, and a type on the `space`. Coordinates are never written directly — position is always expressed in the language of the grid ([positions](../reference/muro/positions.md)).

Add a room. Write not a single boundary.

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

One boundary, though none was written. The two rooms touch, so the wall between them is derived ([Default boundaries](silence.md)).

**A file of nothing but `space` lines is not a deficient drawing; it is a complete description of architecture.** That is where this notation starts.

## The data is a graph already

Take spaces as nodes and boundaries as edges and architectural data is a graph. The questions design asks become graph queries with no conversion in between.

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

"Are these two rooms connected?", "is this boundary fire-rated?", "how many doors from here to there?" are answered without any extraction pass.

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

Answering the same question against a component model means walking space → space boundary → wall → opening relation → door, several hops deep, and then still guessing from geometry which two spaces the door actually connects, because the data does not say. **In koyu, egress, area, compartmentation and circulation are different readings of the same description.**

## The abstraction level is not new

Most of the composition is settled in two dimensions: the planar layout, adjacency, circulation. Onto that go levels, heights, voids and relations that cross storeys. That settles an orthogonal-grid building.

The important point is that **this is not a new abstraction**. It is the abstraction level drawings have carried for centuries, moved from paper to machine-readable text. That practice still delivers drawings, and that permits are still granted on drawings, is because **architectural decisions are made at this level of abstraction**.

Making space primary is therefore not an act of discarding information. What is discarded is form, and form is a consequence of the decisions. The choice here is to make the decision side the source.

## The claim is not that space alone describes everything

Structure and services are led by things, not by space: columns, beams, ducts, boards. A space-primary model is strong on the design and planning side; structure and services will be overlaid as separate layers that carry things.

Columns are the one exception with a settled treatment — they are **an element whose position is never written**, appearing where grid crossings meet a floor ([column](../reference/muro/column.md)). It is the rule that makes walls appear from boundaries, applied to a point element.

Places where the boundary of a space is ambiguous remain: voids, semi-outdoor space, exterior space. Part of why `IfcSpace` works poorly in practice lives here, and koyu decides it rather than dodging it — **semi-outdoor is derived, never declared** ([Derived information](source-and-derived.md)).

Granularity is not obvious either. Cut at rooms, at zones, or hold both? koyu's answer is "hold both, and let the path join them" ([Paths and area aggregation](paths.md)).

## Next

- [Walls as boundaries](boundary-is-a-relation.md) — the direct consequence
- [Default boundaries](silence.md) — the three tiers of default
- [Derived information](source-and-derived.md)
- [Writing `space`](../reference/muro/space.md)
