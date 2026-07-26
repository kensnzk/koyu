**English** · [日本語](../notation-v0.md)

# koyu notation v0 — the record of how it came about (a historical document)

**The current specification is [language.md](language.md) / [semantics.md](semantics.md) / [canonical-json.md](canonical-json.md) / [tools.md](tools.md).** This document records the process by which the notation was born — the v0 comparison (DSL/YAML/JSON) and the addendum written for each version, preserved as they were written at the time. The reasons behind decisions are in docs/decisions/ (the ADRs); the argument is in docs/writing-architecture.md.

> **A note on this translation.** The Japanese original is a preserved record, kept in the words it was written in. The substantive sections below are translated in full. The per-version addenda (§v0.1 through §v0.7) are given here in condensed form, because each has since been superseded by an ADR that is the durable record of the same decision — the ADR is cited in each case. Where you need the text as written, read [the Japanese original](../notation-v0.md).

The design criterion is fixed to one thing. **Can an LLM read the whole thing in a single context and edit part of it correctly?** From that criterion follow being text-native, having references be human-readable hierarchical paths, keeping files small, and declaring units and the coordinate system once at the top.

## The model

The primary element is space. A `space` denotes a room, a zone, or an exterior region, and is named by a hierarchical path. A wall is not an independent thing; it is held as a relation between two spaces (a `boundary`). Performance attributes — thickness, specification, fire rating — ride on the boundary. An opening (`door` / `window`) is a connection cut into a boundary. The skeleton is given by the grid (`grid`) and levels (`level`). Types are an open vocabulary rather than a vast class hierarchy: free words may be added to a core vocabulary of `room`, `corridor`, `exterior`, and the like.

Form is not in this source. Wall segments are derived from the layout of spaces, and the plan is generated when it is needed. That several forms come from one composition is not a defect.

## The notation (the authored form: a bespoke DSL)

```
# 二室一扉 — 最初の一手

koyu 0.1
name 二室一扉
unit mm

grid X 0 3600 7200          # 通り芯 X1, X2, X3
grid Y 0 4500               # 通り芯 Y1, Y2
level L1 0 h:2400           # FL高さ 0、基準天井高 2400

space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  exterior name:外部

boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000

boundary /L1/a /out t:150 spec:EW1 fire:60
boundary /L1/b /out t:150 spec:EW1 fire:60
  door w:900 h:2100 edge:S name:玄関
```

The grammar is as follows. One line is one statement, taking the form `keyword positional... key:value...`. `#` begins a comment; wrap a value containing whitespace in `"..."`. An indented line is an opening (`door` / `window`) belonging to the `boundary` above it.

`grid X 0 3600 7200` declares ascending coordinates in mm, and the grid names X1, X2, … are assigned automatically. `level <name> z [h:ceiling height]` declares a level. `space <path> <type> [X?..X? Y?..Y?] [attributes...]` declares a space, and if the first segment of the path is a level name it belongs to that level. In v0 a region is limited to a single rectangle bounded by grid lines. A space with no region, such as an `exterior`, may also be written.

`boundary <pathA> <pathB> [t:thickness type:wall|open attributes...]` declares a boundary. The wall centerline segment is not written — it is derived from the layout of the two spaces. A boundary between spaces that do not touch is an error. `type:open` is an open boundary with no head above it, passable without a door. A boundary with a space that has no region, such as the exterior, is what remains of the room's perimeter once the intervals shared with other rooms are removed; because that splits across several edges, placing an opening requires `edge:N/E/S/W`. An opening is placed along the segment with `at:0..1` (default 0.5).

Defaults: a boundary is `type:wall`, an opening position is `at:0.5`, and the drawing wall thickness when `t` is unspecified is 100 mm. Area is measured to wall centerlines.

## The comparison — the same two rooms and one door in three formats

To settle v0, the same scene was written three ways. The DSL above is the first.

Second, YAML:

```yaml
koyu: "0.1"
name: 二室一扉
unit: mm
grid:
  X: [0, 3600, 7200]
  Y: [0, 4500]
levels:
  L1: {z: 0, h: 2400}
spaces:
  /L1/a: {type: room, at: [X1, Y1, X2, Y2], name: 居室A}
  /L1/b: {type: room, at: [X2, Y1, X3, Y2], name: 居室B}
  /out:  {type: exterior, name: 外部}
boundaries:
  - between: [/L1/a, /L1/b]
    t: 120
    spec: PW1
    openings:
      - {kind: door, w: 780, h: 2000}
  - between: [/L1/a, /out]
    t: 150
    spec: EW1
    fire: 60
  - between: [/L1/b, /out]
    t: 150
    spec: EW1
    fire: 60
    openings:
      - {kind: door, w: 900, h: 2100, edge: S, name: 玄関}
```

Third, JSON. This is exactly the canonical form that `koyu json` emits; the whole file is in examples/two-rooms.canonical.json (111 lines). An excerpt:

```json
{
  "koyu": "0.1",
  "name": "二室一扉",
  "unit": "mm",
  "grid": { "X": [0, 3600, 7200], "Y": [0, 4500] },
  "spaces": {
    "/L1/a": { "type": "room", "at": ["X1", "Y1", "X2", "Y2"], "attrs": { "name": "居室A" } }
  },
  "boundaries": [
    { "between": ["/L1/a", "/L1/b"], "kind": "wall", "t": 120,
      "openings": [{ "kind": "door", "w": 780, "h": 2000, "at": 0.5 }] }
  ]
}
```

| Aspect | DSL | YAML | JSON |
|---|---|---|---|
| Lines for the same scene | 14 (excluding comments) | about 30 | 111 |
| Human reading and writing | Closest to the density of a drawing | Readable enough | Clear in structure but verbose |
| Partial editing by an LLM | One line, one statement, so a replacement is local | Good | Good, but bracket matching gets involved |
| The language of a diff | "this room got bigger" comes out in one line | Good | Noisy |
| Parser | Bespoke (about 300 lines sufficed) | Off the shelf | Off the shelf |
| Layer composition | Not directly suited | In between | The most natural (the same ground as IFCX/USD) |

**Decision: the authored form is the DSL, the machine form is the canonical JSON.** The source that people (and LLMs) read and write is held as the DSL, and the canonical form emitted by `koyu json` is the footing for composition, diffs, and external connections. YAML sits between the two and offers nothing decisive, so it is set aside. The cost of the DSL is the absence of editor support and the burden of maintaining a grammar, held down by not growing that grammar beyond "one line, one statement + key:value + indentation".

## The shape of the canonical JSON (the machine form)

As written at the time, the canonical JSON emitted by `koyu json` carried: `koyu` (the version), `name`, `unit`, `grid` (coordinate arrays in mm per axis), `levels` (name → `{z, h?}`), `spaces` (path → `{type, at?, attrs?}`, where `at` is the 4-tuple of grid names `[XA, YA, XB, YB]`), and `boundaries` (an array whose elements are `{between, kind, t?, edge?, attrs?, openings?}`, `between` being the two paths in ascending order and each opening being `{kind, w, h?, at, edge?, attrs?}`).

The stability rules: every object key is sorted, `spaces` are in path order, and `boundaries` are in lexicographic order of `between`. Because the same composition always emits byte-identical JSON, it can serve as the footing for diffs, hashes, and layer composition. The present-tense schema is [canonical-json.md](canonical-json.md).

## The addenda, in brief (each superseded by its ADR)

| Version | What it added | The durable record |
|---|---|---|
| v0.1 | Grid offsets (`X2+600`); levels and heights (`z`/`h`/`slab`) with the invariant "ceiling height + the slab above ≤ the floor-to-floor height"; vertical boundaries (`stair`/`shaft`) with the floor left implicit; the schematic-design resolution; `use` aggregation in stats | ADR-0002 |
| v0.2 | Writing the typical floor once — arithmetic level ranges (`level L3..L9 … pitch:`), span expansion of paths (`/L2..L9/A`), and `stack` for vertical stacks | ADR-0004 |
| v0.2 | Uncounted subdivisions — `area` under a space, `seg` under a boundary, with the isolation rule that neither affects area, room counts, or the graph | ADR-0003 |
| v0.3 | L-shaped rooms (a region as a `+` union of rectangles); zones as counted aggregation, so subdividing a dwelling never loses the language of net area; mixed granularity | ADR-0005 |
| v0.3 | Voids (`type:void`) as a declarative exemption from the height invariant; the daylight query `light` (window area / floor area ≥ 1/7) | ADR-0006 |
| v0.4 | `air:1` and semi-outdoor derived rather than declared; the swing (`hinge`/`swing`); maisonettes via the `level:` attribute; partial voids controlled by a coverage ratio | ADR-0006, ADR-0007 |
| v0.4 | The vocabulary ledger as the contract for attributes | ADR-0008 |
| v0.5 | The outside is also space — `/out` split by direction and character, `road:` as the mark of a road, the site as `zone … site:1` with the declared area reconciled, and the `site` query deriving frontage, coverage ratio, and floor area ratio | ADR-0009 |
| v0.6 | Explicit opening positions (`at:Y2+1820`, not clamped); opening assets (`asset`) as Revit's Family and USD's Reference; composition by `import` with collisions as build errors carrying provenance | ADR-0010 |
| v0.7 | The site shape (`polygon`) as the one written shape, kept in a quarantined layer; the full-feature showcase examples/tower/ | ADR-0011 |

## What those few dozen lines settled

Just as the essay predicted, writing two rooms and one door put four design decisions into words. The identity of a space is given by a human-readable hierarchical path. A boundary belongs to neither space; it is a first-class relation joining two paths. A connection is an opening on a boundary, and a subdivision with no head above it is expressed as `type:open`. Paths are cut as `/level/space`, and the exterior, which belongs to no level, sits directly beneath the site. The reasons and the alternatives for each are recorded in ADR-0001.

## The open questions (as they stood then)

Voids and spaces that span levels; the subdivision of semi-outdoor and exterior space (`/out` cannot reasonably stay monolithic); the two-tier granularity of room and zone — these were to be met head-on when a whole floor was written (M1). On the notation side there remained: a region limited to one rectangle (no L-shaped rooms), the description of a door's swing (v0 fell back on a drawing convention, "it opens toward the space written first"), the granularity of the opening vocabulary, the distribution of wall thickness (v0 fixed it to the centerline), and the area convention (v0 fixed it to wall centerlines). Correspondence with IFC GUIDs would be appended later as a layer of `id:` attributes, at import time (M5).

*Every one of these questions has since been answered; see [language.md](language.md) and [semantics.md](semantics.md) for the present tense.*
