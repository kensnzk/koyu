---
title: The canonical JSON schema
mode: reference
---

# The canonical JSON schema

A key-by-key reference for [canonical JSON](index.md). Every example here was produced by actually running the tool on a bundled building.

## What is omitted

**A key with no value is not emitted.** `muro`, `h`, `slab`, `t`, `edge`, `attrs`, `line` and the rest appear only if the source wrote them. Empty blocks (`assets`, `polygons`, `columns`, `zones`, `areas`, `openings`, `segs`) are not emitted either.

Attribute values are **numbers if they have numeric form, strings otherwise**. `underground` is emitted as `1` only when true; `air` is emitted as `true` only when true.

## Top level

The key order is fixed.

| Key | Present | Content |
|---|---|---|
| `format` | **always** | the version of this format itself; currently `"koyu-canonical/2.0"` |
| `muro` | only with a version declaration | [the language version](../muro/version.md), passed through. **Spelled `muro` whatever word the source used** — a file written `koyu 1.1` still says `"muro": "1.1"`, because the key names the thing being versioned |
| `mode` | only with `mode spatial` | `"spatial"`; absence means the building reading. Consumers must not infer walls for a spatial model |
| `name` | if `name` was written | the name of the building |
| `unit` | **always** | currently `"mm"` only |
| `origin` | if [`origin`](../muro/origin.md) was written | `{ epsg, easting, northing, elevation?, vertical? }` — **metres**, not millimetres |
| `azimuth` | if [`azimuth`](../muro/azimuth.md) was written | a number: the true bearing of +Y, clockwise from true north, `0 ≤ v < 360` |
| `grid` | **always** | X and Y coordinate arrays, plus `slopeY` when the Y grid has a nonzero slope |
| `frames` | if a `frame` is declared | frame name → origin reference, rotation and two station arrays |
| `axes` | if an `axis` is declared | axis name → pair of primary grid-point references |
| `levels` | **always** | name → `{ z, h?, slab?, underground? }`; keys in collation order |
| `roofs` | if declared | path → level, roof parameters, grid-relative outline, holes and panels |
| `assets` | if declared | name → `{ kind, attrs? }`; keys in collation order |
| `polygons` | if declared | path → `[[x, y], …]`; keys in collation order |
| `columns` | if declared | an array, **in declaration order** |
| `beams` / `foundations` | if declared | path → section, grid references and level-relative elevations |
| `zones` | if declared | path → `{ attrs? }`; keys in collation order |
| `spaces` | **always** | path → space; keys in path collation order |
| `boundaries` | **always** | an array; lexicographic by `between`, ties by canonical content |

## origin and azimuth

```json-part
"origin": { "epsg": 6677, "easting": -8000.123, "northing": -34000.456, "elevation": 2.35, "vertical": 6695 },
"azimuth": 347.5
```

The two halves of the model's frame. They come before `grid` because they say what the coordinate system `grid` sets up actually means.

`epsg` and `vertical` are EPSG codes, carried through without being resolved. `easting`, `northing` and `elevation` are **in metres** — the one place in the format where a length is not millimetres, because these are coordinates in a foreign frame rather than lengths inside the model.

**`origin` is emitted whole or not at all**, but `elevation` and `vertical` are a pair inside it: both or neither. An absent `azimuth` means the model has no bearing — it does not mean zero.

**Nothing is derived from either.** Neither key changes an area, an adjacency or a shape, and neither appears in the derived [Form](../form/index.md).

## grid

```json-part
"grid": { "X": [0, 3600, 7200], "Y": [0, 4500] }
```

The X and Y arrays carry coordinates. For an inclined Y family, the optional numeric `slopeY` gives rise/run and the Y values are the intercepts at X1. A zero slope is omitted. Grid names are implicitly `X1`, `X2`, … from the front, so they are not spelled.

A file with named axes adds an `axes` map keyed by name. Each value contains the two primary X,Y point references, ordered by resolved X then Y. In a point containing a named axis, a primary X reference comes first, a primary Y reference comes last, and two named axes follow code-point order. Resolved intersections do not enter the canonical document; moving a primary grid line can move all the intersections derived from it.

A rotated orthogonal grid adds one entry per declaration in `frames`. The frame name determines the two local family letters. The entry preserves the referenced origin, the angle in degrees in [0,360), and each list of station dimensions. Its generated lines and world-coordinate vertices are derived. For example:

```json-part
"frames": {"AB": {"at": "X2,Y2", "angle": 30, "A": [0,3000,7000], "B": [-2000,0,4000]}}
```

## levels

```json-part
"levels": {
  "B1": { "z": -5100, "h": 4200, "slab": 900, "underground": 1 },
  "L1": { "z": 0, "h": 3600, "slab": 600 }
}
```

| Key | Meaning |
|---|---|
| `z` | FL height in mm. **Always present** |
| `h` | ceiling height in mm |
| `slab` | floor construction depth in mm |
| `underground` | the declaration that a level is below ground. **Never inferred from a negative `z`** — emitted as `1` only when written |

## assets

```json-part
"assets": {
  "WM": { "kind": "component", "attrs": { "category": "appliance", "d": 600, "plan-svg": "./wm.svg", "w": 600 } }
}
```

`kind` is `door`, `window`, or `component`. Openings reach door and window assets through `ref`. A named area reaches a component through its `asset` attribute. `plan-svg` remains a relative path in canonical JSON; the SVG bytes are drawing input and never enter this format.

## polygons

```json-part
"polygons": { "/site": [[-2600, -7000], [38000, -7000], [38000, 19600], [2000, 21000], [-2600, 15000]] }
```

**A given, and the one geometry written into the source.** The vertex list is geometry (cyclic) and is never reordered.

## columns

```json-part
"columns": [
  { "size": 900, "levels": ["B2", "B1", "L1", "L2", "L3", "L4", "L5", "L6"] },
  { "size": 800, "levels": ["L7", "L8", "L9", "L10", "L11", "L12", "L13"] }
]
```

| Key | Meaning |
|---|---|
| `size` | section width in mm |
| `d` | depth in mm. Omitted when it equals `size` |
| `at` | an explicit pair of grid references shared by the storeys, when authored |
| `sections` | level-specific width and depth overrides, ordered by first affected storey |
| `levels` | the levels the column stands on |
| `frame` | the written section orientation, if supplied. Pad foundations retain the same field. |
| `x` / `y` | the grids it targets. Omit for all grids. **Ordered by grid order** (`x:X2,X1` and `x:X1,X2` are the same composition) |
| `attrs` | attributes |

**This is the one array that is never sorted.** Coincident centres use explicit placement first and declaration order second. The order between equivalent-priority candidates affects the built result.

## roofs, beams and foundations

These optional Muro 1.7 records use paths in collation order. Roof dimensions use `eaveZ`, `highZ`, `slope`, `rise`, `ridgeAxis` and `thickness`. An `outline` is an ordered ring of grid-point strings. A roof's `holes` and `faces` hold nested rings. A face vertex includes the written level-relative height. The canonical record carries the authored driving parameters. Sketch defaults, derived absolute elevations, solid vertices and quantities are available in Form. A reader of canonical format 2.0 must also support the declared Muro edition before interpreting these fields.

## zones

```json-part
"zones": { "/L3/A": { "attrs": { "lease.category": "exclusive", "name": "Aタイプ" } } }
```

A zone carries attributes only. No region, no type.

## spaces

```json-part
"/L1/s1": {
  "type": "shop",
  "at": [
    ["X1", "Y1-4600", "X3", "Y2"],
    ["X3", "Y1-4600", "X4", "Y1"]
  ],
  "attrs": { "floor": "モルタル", "lease.category": "rentable", "name": "店舗1" },
  "areas": [
    { "at": ["X1", "Y1-4600", "X2", "Y1-2600"], "attrs": { "floor": "タイル", "name": "土間" } }
  ]
}
```

| Key | Present | Content |
|---|---|---|
| `type` | when written | the type of the space. **Optional**, so the key is absent when none was written (no default is fabricated) |
| `level` | only when explicit | emitted only when the level differs from the first path segment (a maisonette, say). The default is omitted |
| `cell` | for a grid-intersection cell | the written corner references in counterclockwise perimeter order, starting at the lexicographically first reference |
| `holes` | for a cell with inner perimeters | one array of corner references per hole, normalized in the same way as `cell`, then sorted by the normalized reference sequences |
| `at` | for rectangular allocations | four grid names. **A flat quadruple for a single rectangle, an array of quadruples for several**, sorted by canonical content |
| `attrs` | if there are attributes | keys in collation order |
| `areas` | if `area` was written | an array of `{ at, attrs? }` in canonical content order |

The quadruple is `[X start, Y start, X end, Y end]`. A reversed notation (`X2..X1`) is normalised to ascending coordinates.

A component placement is represented entirely by ordinary area attributes: `name`, `asset`, `align-x`, `align-y`, `offset-x`, `offset-y`, and `rotate`. Canonical JSON records those written constraints, not the derived centre, rotated footprint, or loaded SVG artwork.

## boundaries

```json
{
  "between": ["/home/hall1", "/home/ldk"],
  "a": "/home/ldk",
  "kind": "wall",
  "t": 120,
  "attrs": { "spec": "LGS" },
  "openings": [
    {
      "kind": "door", "ref": "SD1", "w": 800, "h": 2000,
      "at": 0.5, "edge": "E", "hinge": "S", "swing": "b",
      "attrs": { "name": "片引き戸", "style": "sliding" }
    }
  ]
}
```

| Key | Present | Content |
|---|---|---|
| `between` | **always** | the two paths in ascending order. **This is the identity of the relation** |
| `a` | **always** | **the written direction** — the space written first. `edge` and `swing` are read from that side. Without it, the swing cannot be recovered from JSON alone |
| `kind` | **always** | `wall` / `open` / `stair` / `shaft` / `void` |
| `t` | if written | wall thickness in mm |
| `air` | only when true | `true`. Something that does not enclose (a rail, a fence) |
| `edge` | if written | `N` / `E` / `S` / `W` — narrows the segments to one face seen from a |
| `line` | if written | the endpoint pair of a drawn line, **as grid words**, in ascending resolved coordinates |
| `attrs` | if there are attributes | `spec`, `fire`, `h`, … |
| `openings` | if there are openings | canonical content order |
| `segs` | if there are `seg`s | canonical content order |

The top height of an `air:1` boundary is emitted as an attribute.

```json
{
  "between": ["/home/hall2", "/home/void"],
  "a": "/home/void",
  "kind": "wall", "t": 120, "air": true,
  "attrs": { "h": 1100, "spec": "手すり" }
}
```

A boundary with a drawn line.

```json
{
  "between": ["/L1/load", "/out"],
  "a": "/L1/load",
  "kind": "wall", "t": 300,
  "line": ["X19-4200,Y12", "X19,Y12-2100"],
  "attrs": { "spec": "RC" }
}
```

**A segment has no direction**, so the endpoint pair is canonicalised to ascending resolved (x, then y). The spelling stays exactly the grid reference that was written; only the order swaps.

**Default boundaries do not appear here.** Touching spaces default to a wall, but canonical JSON holds only the written composition.

## openings

| Key | Present | Content |
|---|---|---|
| `kind` | **always** | `door` / `window` |
| `ref` | when an asset is used | the asset name |
| `w` | **always** | width in mm |
| `h` | if written | height in mm |
| `at` | **always** | **a number for a ratio, a string for a grid reference**. Unwritten it is `0.5` |
| `edge` | if written | `N` / `E` / `S` / `W` |
| `hinge` | if written | the hinge side |
| `swing` | if written | the side it opens into, `a` / `b` |
| `attrs` | if there are attributes | `name`, `style`, … **Attributes inherited from an asset are expanded and emitted too** |

## segs

```json-part
"segs": [
  { "w": 3600, "at": 0.75, "attrs": { "spec": "ガラスパーティション" } }
]
```

| Key | Present | Content |
|---|---|---|
| `w` | **always** | width in mm |
| `at` | **always** | a number for a ratio, a string for a grid reference |
| `edge` | if written | `N` / `E` / `S` / `W` |
| `attrs` | if there are attributes | an interval override such as `spec` |

A `seg` is an uncounted segment — it appears in no area and no graph, and carries only an override over an interval.

## Neighbouring pages

- [Canonical JSON](index.md) — the three stability rules and the byte-level norms
- [koyu json](../cli/json.md) — how to get the output
- [boundary](../muro/boundary.md) / [space](../muro/space.md) — the notation that produces this
- [seg](../muro/seg.md) / [area](../muro/area.md) — uncounted segments
- [column](../muro/column.md) — why declaration order is meaning
