---
title: The canonical JSON schema
mode: reference
---

# The canonical JSON schema

A key-by-key reference for [canonical JSON](index.md). Every example here was produced by actually running the tool on a bundled building.

## What is omitted

**A key with no value is not emitted.** `koyu`, `h`, `slab`, `t`, `edge`, `attrs`, `line` and the rest appear only if the source wrote them. Empty blocks (`assets`, `polygons`, `columns`, `zones`, `areas`, `openings`, `segs`) are not emitted either.

Attribute values are **numbers if they have numeric form, strings otherwise**. `underground` is emitted as `1` only when true; `air` is emitted as `true` only when true.

## Top level

The key order is fixed.

| Key | Present | Content |
|---|---|---|
| `format` | **always** | the version of this format itself; currently `"koyu-canonical/1.0"` |
| `koyu` | only with a version declaration | [the language version](../muro/version.md), passed through |
| `name` | if `name` was written | the name of the building |
| `unit` | **always** | currently `"mm"` only |
| `grid` | **always** | `{ "X": [coords…], "Y": [coords…] }` — the names `X1..` are implicit |
| `levels` | **always** | name → `{ z, h?, slab?, underground? }`; keys in collation order |
| `assets` | if declared | name → `{ kind, attrs? }`; keys in collation order |
| `polygons` | if declared | path → `[[x, y], …]`; keys in collation order |
| `columns` | if declared | an array, **in declaration order** |
| `zones` | if declared | path → `{ attrs? }`; keys in collation order |
| `spaces` | **always** | path → space; keys in path collation order |
| `boundaries` | **always** | an array; lexicographic by `between`, ties by canonical content |

## grid

```json
"grid": { "X": [0, 3600, 7200], "Y": [0, 4500] }
```

Only the coordinate arrays. Grid names are implicitly `X1`, `X2`, … from the front, so they are not spelled.

## levels

```json
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

```json
"assets": {
  "AD1": { "kind": "door", "attrs": { "h": 2400, "name": "自動ドア", "style": "auto", "w": 1800 } }
}
```

A type of joinery. `kind` is `door` or `window`. Openings reach it through `ref`.

## polygons

```json
"polygons": { "/site": [[-2600, -7000], [38000, -7000], [38000, 19600], [2000, 21000], [-2600, 15000]] }
```

**A given, and the one geometry written into the source.** The vertex list is geometry (cyclic) and is never reordered.

## columns

```json
"columns": [
  { "size": 900, "levels": ["B2", "B1", "L1", "L2", "L3", "L4", "L5", "L6"] },
  { "size": 800, "levels": ["L7", "L8", "L9", "L10", "L11", "L12", "L13"] }
]
```

| Key | Meaning |
|---|---|
| `size` | section width in mm |
| `d` | depth in mm. Omitted when it equals `size` |
| `levels` | the levels the column stands on |
| `x` / `y` | the grids it targets. Omit for all grids. **Ordered by grid order** (`x:X2,X1` and `x:X1,X2` are the same composition) |
| `attrs` | attributes |

**This is the one array that is never sorted.** Two columns never stand on the same intersection and the earlier declaration wins, so declaration order is the composition itself.

## zones

```json
"zones": { "/L3/A": { "attrs": { "name": "Aタイプ", "use": "exclusive" } } }
```

A zone carries attributes only. No region, no type.

## spaces

```json
"/L1/s1": {
  "type": "shop",
  "at": [
    ["X1", "Y1-4600", "X3", "Y2"],
    ["X3", "Y1-4600", "X4", "Y1"]
  ],
  "attrs": { "floor": "モルタル", "name": "店舗1", "use": "rentable" },
  "areas": [
    { "at": ["X1", "Y1-4600", "X2", "Y1-2600"], "attrs": { "floor": "タイル", "name": "土間" } }
  ]
}
```

| Key | Present | Content |
|---|---|---|
| `type` | **always** | the type of the space |
| `level` | only when explicit | emitted only when the level differs from the first path segment (a maisonette, say). The default is omitted |
| `at` | if there is a region | four grid names. **A flat quadruple for a single rectangle, an array of quadruples for several**, sorted by canonical content |
| `attrs` | if there are attributes | keys in collation order |
| `areas` | if `area` was written | an array of `{ at, attrs? }` in canonical content order |

The quadruple is `[X start, Y start, X end, Y end]`. A reversed notation (`X2..X1`) is normalised to ascending coordinates.

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

```json
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
