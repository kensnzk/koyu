# koyu (戸牖) — writing architecture, not buildings

> 鑿戸牖以為室、当其無、有室之用
> *Cut doors and windows to make a room; it is the emptiness within that makes the room useful.* — Laozi, ch. 11

[日本語](README.ja.md)

An exploration of text-native architectural description with **space as the primary element**. A wall is not a thing — it is the boundary between two spaces. An opening is a connection cut into a boundary. Form is not source — it is generated. A whole building fits in a few hundred lines of text, which puts architecture on the same ground as git, LLMs, and city-scale data. The full argument (in Japanese) is in [docs/writing-architecture.md](docs/writing-architecture.md).

Two rooms and one door are written like this (full file: [examples/two-rooms.muro](examples/two-rooms.muro)):

```
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000
```

The floor plan is generated from this. There is no operation that draws a wall — walls are derived from the layout of spaces.

![Plan of two rooms and one door](docs/img/two-rooms.svg)

A two-story office — corridor, core, offset walls off the grid lines, stairs/elevator, vertical consistency — is about 100 lines ([examples/office.muro](examples/office.muro)). The resolution is schematic-design level. Not modeling downstand beams is not an omission but a chosen level of abstraction: the early design phase, where BIM has always been too heavy, is exactly where this notation lives. Vertical consistency is enforced as a declared invariant — ceiling height + slab above ≤ floor-to-floor height (ADR-0002).

![Office level 1 plan](docs/img/office-L1.svg)

A 10-story double-loaded apartment building — 43 units, elevator + exterior stair, roof, unit type A with its interior layout — is **183 lines** ([examples/mansion.muro](examples/mansion.muro)). The typical floor is written once and the span `/L2..L9/A` expands it across eight floors (ADR-0004). An L-shaped living room is a union of rectangles; units are `zone`s (counted aggregation), so subdividing a unit into rooms never loses the language of net area (ADR-0005). A double-height void is a vertical boundary of `type:void` — even the absence of a floor is written as a boundary (ADR-0006). `doors` answers "how many doors from the 9th-floor living room to the street"; `light` gives a first-pass check of the 1/7 daylighting ratio for habitable rooms.

![Apartment typical floor plan](docs/img/mansion-L5.svg)

The full-feature showcase is **[examples/tower/](examples/tower/)** — an 11-storey mixed-use corner building (retail below, housing above, a penthouse floor, ~4,786m² GFA) composed from 9 files. Its site is an irregular pentagon: site shape is the one thing this notation allows to be *written* as geometry (`polygon`, ADR-0011), because a site's shape is surveyed input from the world, not designed form — it lives in its own quarantined layer (site-geometry.muro) and the derived area, building containment, and the site boundary line on the plan all follow from it. Everything else demonstrates the rest of the notation at once: a two-storey entrance void, interlocking L-shaped units, balconies, a low-rise roof terrace written as an exception-floor *diff layer*, door/window assets with an auto-door, explicit grid-referenced positions, and one unit type subdivided into rooms. 178 spaces / 542 boundaries check clean; 66 habitable rooms pass the 1/7 daylight test; "how many doors from the 9th-floor living room to the street" answers 4.

A building can also be written as a set of files and composed, USD-style ([examples/house/](examples/house/)): a base layer declares the shared foundation (grid, levels) exactly once and `import`s the door/window assets, the site, and each floor — authored separately, merged additively, with conflicts (duplicate paths, duplicate asset names, re-declared grids) rejected at build time with file:line provenance. `koyu check main.muro` is the build gate for the whole building. Door/window types are `asset`s — Revit's Family, USD's Reference — referenced by instances that override their defaults (`door SD1 sill:800`), and opening positions can be written against the grid (`at:Y2+1820`) with overflow and overlap validated (ADR-0010).

## Usage

```sh
npm install
npm test

npm run koyu -- check examples/two-rooms.muro        # consistency check
npm run koyu -- plan  examples/two-rooms.muro -o out/two-rooms.svg
npm run koyu -- doors examples/two-rooms.muro /L1/a /out   # → 2 doors
npm run koyu -- graph examples/two-rooms.muro        # the space graph
npm run koyu -- stats examples/two-rooms.muro        # areas (centerline)
npm run koyu -- json  examples/two-rooms.muro        # canonical JSON (machine form)

npm run koyu -- plan   examples/office.muro -l L2    # per-level plans
npm run koyu -- levels examples/office.muro          # a textual section (height stack-up)
npm run koyu -- doors  examples/office.muro /L2/office /out   # → 4 doors (via the stair)
npm run koyu -- stats  examples/mansion.muro         # areas, zone rollups, efficiency ratio
npm run koyu -- light  examples/mansion.muro         # rough 1/7 daylight check
npm run koyu -- site   examples/house.muro           # site area, frontage, coverage, FAR
npm run koyu -- check  examples/house/main.muro      # multi-file composition: the build gate
npm run koyu -- site   examples/tower/main.muro      # showcase: polygon site, two roads, FAR
```

## LLM connection

`koyu-mcp` is a zero-dependency MCP server over stdio (ADR-0012): an LLM agent reads the building (`layers`), edits it (`write_layer`), and `check` acts as the build gate — errors come back with layer:line provenance. `doors` / `light` / `site` / `stats` are the same description read different ways. The whole 4,786m² showcase is 8,099 tokens as source (measured; IFC4 is 14x, IFCX 25x — see [examples/comparison/](examples/comparison/README.md)), so a whole building fits in one context with room to work. The horizon design (digital twin, ontology alignment via W3C BOT, city connection) is in [docs/horizon.md](docs/horizon.md).

## Layout

The notation spec and side-by-side comparisons are in [spec/notation-v0.md](spec/notation-v0.md); the contract for attributes is [spec/vocabulary.md](spec/vocabulary.md); coverage against the IFC4 architectural core is [docs/ifc-coverage.md](docs/ifc-coverage.md); design decisions are recorded in [docs/decisions/](docs/decisions/); the roadmap is [docs/roadmap.md](docs/roadmap.md); daily logs are in [docs/log/](docs/log/). The implementation is ~900 lines in src/ (parser, graph, checks, plan generation, CLI), tests in test/. Reading notes on IFCX are in [docs/ifcx-notes.md](docs/ifcx-notes.md); the same two-rooms-one-door written three ways (this notation, IFC4, IFCX) is in [examples/comparison/](examples/comparison/README.md).

## Technical stance

TypeScript, zero runtime dependencies. When BIM/IFC tooling is needed, ThatOpen's OSS (web-ifc, @thatopen/components) is used. IFC_samples/ is a sample corpus for one-way IFC import (M5) and is kept out of git (third-party files; not redistributed).

This is an exploration. It is not aimed at commercialization; it builds no authoring tool, abandons round-trip compatibility, and restricts itself to orthogonal grids.

## The name

戸牖 (*koyu*) means doors and windows — openings. Laozi, chapter 11: cut doors and windows to make a room; it is the emptiness — the space — that makes the room useful, not the walls. For a notation in which space is primary, walls are relations, and openings are connections cut into boundaries, this is the oldest source there is. The homophone 固有 (*koyu*, "proper / intrinsic") is also intended: every space is addressed by a human-readable proper name, its hierarchical path.

The file extension is `.muro` (室, *muro* — room). The unit a file holds is not a building component but a room.

## License

Code (src/, test/, examples/, …) is under the [Apache License 2.0](LICENSE). Documents (docs/, spec/, and the essay "[建築を書く / Writing Architecture](docs/writing-architecture.md)") are under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Citation metadata is in [CITATION.cff](CITATION.cff).
