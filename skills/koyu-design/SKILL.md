---
name: koyu-design
description: Design buildings by writing muro, the text notation where space is the primary element and walls, floors and openings are derived rather than drawn. Use when asked to design, lay out, plan or revise a building, dwelling, floor plan or spatial programme — a flat, a house, an office, a clinic, a tower — or when working with .muro files, koyu, or ugatsu. Produces .muro files that koyu checks and ugatsu.dev opens.
---

# Designing in muro

muro describes a building by its **spaces** and the **relations between them**.
A wall is not drawn: it is the boundary between two spaces, derived from where
they touch. Floors and ceilings come from `slab:` and `h:`. Openings are cut into
boundaries. You write the spatial configuration; the geometry is generated.

Two consequences to internalise before writing anything:

- **Two spaces that touch, with nothing declared between them, means a wall.**
  Never write walls. Write a `boundary` line only to make an opening, to make the
  relation `open`, or to attach thickness and specification.
- **A derived wall has no door, so it cannot be walked through.** If a room must
  be reachable, declare the boundary and give it a door. This is the single most
  common way a plan comes out wrong.

## The workflow

1. Decide the outline: the site, the storeys, the programme with rough areas.
2. **Write the layers using `band`** (below). Read [REFERENCE.md](REFERENCE.md)
   in this skill once before writing, rather than guessing syntax.
3. Check it — koyu is the judge, and it needs no install:

   ```bash
   npx -p @kensnzk/koyu koyu check main.muro
   ```

   Working inside the koyu repository, `npm run koyu -- check main.muro`. If you
   have no shell but the `koyu` MCP server is connected, its `check` tool is the
   same judge (and `write_layer` edits with the check as a gate). Fix what it
   reports — errors carry a code and `layer:line` — and check again.
4. **Hand over the `.muro` files themselves.** They are the deliverable. They
   open at [ugatsu.dev](https://ugatsu.dev) by drag and drop — plan, 3D, area
   schedule and space graph, all derived from the text.

Three or four steps. Get a plan in front of the person quickly: they will judge
it at a glance and ask for the next version. Do not run area, daylight,
circulation or site queries (`koyu stats` / `light` / `doors` / `site`) unless
the question is actually about those.

## Write with `band`, not with coordinates

A band divides a strip into consecutive spaces by width. It is what a designer
actually decides, and it removes all coordinate arithmetic:

```muro
band X X1..X2 Y1..Y2
  space /L1/entry hall w:1500 name:Entrance
  space /L1/wc    wc   w:900  name:WC
  space /L1/wash  wash w:1500 name:Washroom
  space /L1/bath  bath w:rest name:Bathroom
```

`band <X|Y> <Xrange> <Yrange>` names the axis the members run along, then the
strip. Members carry `w:<mm>`, and at most one carries `w:rest`. The widths must
fill the strip exactly. The band disappears at parse time, expanded into ordinary
spaces.

**A band is one-dimensional: a member touches only its two neighbours in the
strip, plus whatever lies across the strip's long edge.** This is where plans go
wrong. A hall placed in the middle of a band cannot serve the rooms on either
side of it — put circulation in its own band running the other way, or make the
corridor span the full width so rooms open off its long edge.

## Circulation before rooms

Decide how a person moves through the building first, then hang rooms off it.
In a small dwelling that usually means: entrance → living space → everything
else, with the wet rooms opening off one side. In an office: a corridor spanning
the width, offices along it, the stair and shaft at one end, and a vertical
`boundary … type:stair` joining the cores on consecutive storeys.

## Examples in this skill

Both check green (they are gated by this repository's CI). Read one before
writing your own.

- [examples/flat-1ldk.muro](examples/flat-1ldk.muro) — a one-bedroom flat on an
  8 × 6 m site, single storey, two bands, 33.62 m² gross.
- [examples/office/](examples/office/main.muro) — a two-storey office composed
  from three layers (`main.muro` holds the grid and levels and imports `L1.muro`
  and `L2.muro`), with a stair joining the cores, 138.24 m² gross.

## Reading the checker

`check` reports structural consistency: green means one unique form can be
derived from the description. It does not mean the building is good, or legal —
that judgement belongs to the architect looking at the plan. `koyu validate` is
the separate, growing body of architectural findings (daylight, reachability,
envelope); its findings are advice, not errors.

Codes worth recognising:

| Code | What happened |
|---|---|
| `BND04` | A boundary between spaces that do not touch. Usually a band member reached for a neighbour it does not share an edge with. |
| `OPN04` / `OPN05` | No segment can hold the opening / the boundary has several segments and needs `edge:N\|E\|S\|W`. |
| `GEO02` | Two spaces overlap on the same level. |
| `SUF01` / `SUF02` | Ceiling height or level cannot be determined for a space that has a region. |
| `REF01` | A boundary names a space that does not exist. |
| `ATT03` | An attribute key outside the ledger. Namespace it (`acme.note:…`) or drop it. |
