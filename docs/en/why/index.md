---
title: What koyu is
mode: explanation
---

# What koyu is

From drawings through CAD to BIM, architectural data has consistently described **the things to be built**. Walls, slabs, columns, beams are laid out, and rooms are derived afterwards as whatever those things happen to enclose. The data of things has been digitised over and over for thirty years, but **architecture itself — how space is divided, connected and ordered — has never become machine-readable.**

koyu reverses the order. A text in which space is the primary element (`.muro`) is the authored source, and form is derived from it when needed. This is not an improvement to BIM; it is **a change of subject** — from the building (a thing) to architecture (space).

Change the subject and a building's data shrinks by an order of magnitude. An eleven-storey mixed-use building of 4,786 m² is written in nine source files, 453 lines, 8,574 tokens. A 31,606 m² complex with two basement levels and nineteen storeys above ground takes 646 lines and 12,685 tokens. **A whole building fits inside a machine's field of view.**

## In three lines

**Space is primary, and a wall is not a thing but a relation between two spaces.** Enumerate the rooms and the walls come with them.

**The source carries meaning, not form.** Plans, areas and circulation are not written; they are derived.

**Smallness is not the goal but a consequence of the role.** Hold only what must be written — meaning, relation, identity — and a whole building fits in one LLM context.

## What is written, what is computed

```muro
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

Not one wall is written in those five lines. `koyu check` nonetheless counts one boundary.

```text
✔ Consistent — 2 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

The two rooms touch, so the wall between them is **derived**. There is no operation in koyu that places a wall. See [The space-centred model](space-is-primary.md) and [Walls as boundaries](boundary-is-a-relation.md).

## Five minutes to decide whether this is for you

Run these in order. They all work on the bundled examples.

**1. Look at consistency.**

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**2. Ask the composition directly.** Questions that would require an extraction pass over a component model are answers here, with no conversion.

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

**3. Count the doors on a route.**

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2 doors — /L1/a → /L1/b → /out
```

**4. Do the same at the scale of a whole building.**

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
Site /site (敷地)
  Site shape: polygon with 5 vertices (a polygon declaration — given geometry)
  Site area: declared 1097.80 m2 / derived 1097.80 m2
  Road: /out/road-s (南側道路) width 12000mm / frontage 40600mm
  Road: /out/road-e (東側道路) width 6000mm / frontage 20200mm
  Building footprint (horizontal projection, rough): 569.60 m2 → building coverage ratio 51.9%
  Total floor area: 4785.92 m2 → floor area ratio 436.0%
```

Frontage, footprint and gross floor area are written nowhere. They are derived from the site polygon and the regions of the spaces.

**5. Find out what "green" means.** The following eleven lines pass `check` — and you cannot get out of the building.

```muro
koyu 1.0
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/hall hall X1..X2 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2
space /out exterior
boundary /L1/hall /out t:150
boundary /L2/bed /out t:150
boundary /L1/hall /L2/bed type:stair
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

```text
$ npx tsx src/cli.ts doors sealed.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

Whether that strikes you as right is the dividing line. `check` says only that **what is written does not contradict itself as data** — see [What check guarantees](green-is-not-a-building.md). Architectural judgement is what `koyu validate` says, separately.

### It suits you if

- you want to version the **decisions of the composition** at the scheme-design stage
- you want to ask about area, circulation, compartmentation and daylight without an extraction pass
- you want LLMs and agents to edit buildings directly
- you want comparing design options to be comparing git branches
- you want to join survey data, sensors and city data to a building on the **space** side

### It does not suit you if

- you need construction-drawing resolution (junctions, substrates, connections)
- curved and free-form geometry is the subject
- you want a model for structural or MEP analysis
- you want a round trip with existing IFC assets (there is an exit, but no round trip)

Where the line is drawn is set out in [Level of detail](resolution.md).

## How to read this volume

**How the notation thinks**

- [The space-centred model](space-is-primary.md) — the starting point
- [Walls as boundaries](boundary-is-a-relation.md)
- [Default boundaries](silence.md)
- [Derived information](source-and-derived.md)
- [Paths and area aggregation](paths.md)
- [Extending attributes](open-vocabulary.md)

**The shape of the promise**

- [What check guarantees](green-is-not-a-building.md)
- [check and validate](two-kinds-of-green.md)
- [Separating language, checks and drawing](three-domains.md)
- [Splitting and layering files](composition-is-for-time.md)
- [Determinism of derivation](form-must-be-unique.md)
- [How plans are generated](plan-is-not-a-section.md)

**Relation to the existing world**

- [BIM, IFC and USD basics](bim-ifc-usd.md) — for readers without the vocabulary of this field
- [Comparison with IFC and USD](vs-ifc.md) — with measured token counts
- [IFC4 coverage](ifc4-coverage.md)
- [Notation format comparison](dsl-not-yaml.md) — written out in YAML and JSON for comparison
- [Level of detail](resolution.md)

The exact extent of the promise is in [Scope](../reference/scope.md).
