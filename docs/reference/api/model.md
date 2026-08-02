---
title: Model and its types
mode: reference
---

# Model and its types

A `Model` is the result of reading and composing `.muro`. **It holds the written composition and almost no form** — the position of a wall, the floors, the roof, the coordinates of a column are not in it. [`derive`](derive.md) raises those from rules.

Every type here comes from `@kensnzk/koyu`. They carry no runtime value, so `import type` is enough.

```ts
import type { Model, Space, Boundary, Opening, Pt } from "@kensnzk/koyu";
```

## Model

```ts
interface Model {
  version: string;
  name?: string;
  unit: "mm";
  grid: { X: GridAxis; Y: GridAxis };
  levels: Record<string, Level>;
  spaces: Map<string, Space>;
  zones: Map<string, Zone>;
  assets: Map<string, Asset>;
  boundaries: Boundary[];
  polygons: Map<string, SitePolygon>;
  columns: ColumnDecl[];
  layers: string[];
  attrSrc: Map<string, number>;
  versionDeclared?: boolean;
  compositionEdits: CompositionEdit[];
}
```

**There is exactly one unit: millimetres.** `unit` is always `"mm"` and takes no other value. Every coordinate and dimension is a number of millimetres; only the area functions return m².

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log({
  version: m.version, name: m.name, unit: m.unit,
  levels: Object.keys(m.levels),
  spaces: m.spaces.size, zones: m.zones.size, assets: m.assets.size,
  boundaries: m.boundaries.length, polygons: m.polygons.size,
  columns: m.columns.length, layers: m.layers.length,
});
```

```text
{
  version: '1.0',
  name: '小さな戸建住宅',
  unit: 'mm',
  levels: [ 'L1', 'L2', 'R' ],
  spaces: 13,
  zones: 2,
  assets: 6,
  boundaries: 31,
  polygons: 0,
  columns: 0,
  layers: 5
}
```

`version` is the language version; with no declaration the default (`1.0`) goes in. **Whether it was declared is held separately in `versionDeclared`** — [canonical JSON](canonical.md) reads that to decide whether to emit the `koyu` key. The accepted versions are listed under [language versions](versions.md).

### layers — the strength order

`layers` lists the layers that took part in composition. **This order is the strength order of the layers**: index 0, the entry, is the weakest, and **later layers are stronger**. The order is the `import` lines flattened depth-first, with a layer that appears twice keeping its first position. For a single-source `parse` it is empty.

```ts
const m = parseFile("examples/house/main.muro");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")));
```

```text
[
  'examples/house/main.muro',
  'examples/house/assets.muro',
  'examples/house/site.muro',
  'examples/house/L1.muro',
  'examples/house/L2.muro'
]
```

What actually goes in is the **resolved absolute path** (the output above strips the working directory for readability). The `file` field on a diagnostic carries the same value.

### attrSrc — where each attribute came from

The keys of `attrSrc` are `<kind>:<subject>:<attribute key>` and the values are indices into `layers`. **It exists so you can say which layer gave the final value.** `over`, which lets only the stronger layer's opinion through, reads it — strength decides, not scan order.

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 name:居室 floor:オーク
import ./finish.muro`,
  "finish.muro": `over /L1/a floor:タイル`,
}, "main.muro");

console.log(m.layers);
console.log(m.spaces.get("/L1/a")!.attrs);
console.log([...m.attrSrc.entries()]);
console.log(m.compositionEdits);
```

```text
[ 'main.muro', 'finish.muro' ]
{ name: '居室', floor: 'タイル' }
[ [ 'space:/L1/a:floor', 1 ] ]
[
  {
    word: 'over',
    subject: '/L1/a floor:タイル',
    line: 1,
    file: 'finish.muro'
  }
]
```

`compositionEdits` records where `over`, `drop` and the set edits (`+` `-` `=`) were written. **No trace of an override survives into the composed model or into canonical JSON**, so this one list keeps the declarations in scan order purely so a diagnostic can catch an older-version file using a newer word. Neither derivation nor the canonical form reads it.

## GridAxis / GridRef / Rect / Pt / Edge

```ts
interface GridAxis { names: string[]; coords: number[] }  // names and mm coordinates, same order
interface GridRef { xa: string; xb: string; ya: string; yb: string }
interface Rect { x1: number; y1: number; x2: number; y2: number }  // x1<x2, y1<y2
interface Pt { x: number; y: number }
type Edge = "N" | "E" | "S" | "W";
```

Grid names are assigned in declaration order: `X1`, `X2`, … **A name is read from its position**, so inserting a coordinate in the middle renames everything after it.

```ts
console.log(m.grid);
```

```text
{
  X: { names: [ 'X1', 'X2', 'X3' ], coords: [ 0, 3640, 7280 ] },
  Y: { names: [ 'Y1', 'Y2', 'Y3' ], coords: [ 0, 3640, 7280 ] }
}
```

The compass of `Edge` is **N=+Y, S=−Y, E=+X, W=−X**: X is positive to the east, Y positive to the north. An element carrying `edge` names a side of the rectangle of the space written first.

## Attrs / AttrValue

```ts
type AttrValue = string | number;
type Attrs = Record<string, AttrValue>;
```

An attribute value is a string or a number. **A spelling that looks numeric goes in as a number** — `h:2400` is `2400`, not `"2400"`. There is no boolean; write `0` / `1`, as in `daylight:1`.

Which keys may be written is fixed by a ledger. A key absent from it and carrying no namespace is the `ATT03` error — see [the three tiers of attributes](../muro/attributes.md).

## Level

```ts
interface Level {
  name: string;
  z: number;          // finished floor level, mm
  h?: number;         // the storey's reference ceiling height, mm
  slab?: number;      // floor build-up, mm (ceiling of the storey below up to this FL)
  underground?: boolean;
  line: number;
  file?: string;
}
```

**Being underground is not inferred from a negative `z`.** Ground level is a fact about the site, not about where the origin of the coordinate system happens to sit, so `underground` is declared. Above/below-ground floor-area totals and the section display read it.

```ts
console.log(m.levels["L1"]);
```

```text
{
  name: 'L1',
  z: 0,
  line: 14,
  file: '/Users/…/examples/house/main.muro',
  h: 2400,
  slab: 400
}
```

`line` and `file` are on every element. **No declaration is without a source** — that is what lets a diagnostic name a position.

(The `/Users/…/` in the output on this page is a resolved absolute path shortened to fit the page. The real value is the full path.)

## Space

```ts
interface Space {
  path: string;
  type: string;
  level?: string;
  grids: GridRef[];
  rects: Rect[];
  pieces: Pt[][];
  areas: Area[];
  attrs: Attrs;
  line: number;
  file?: string;
}
```

**The path is the identity.** It names the space in a hierarchy a human can read, like `/L1/a`, and its first purpose is the hierarchy of aggregation. The level is read from the first segment by default; a grouping that crosses storeys (a maisonette) states it with the `level:` attribute.

`type` is an open vocabulary (`room`, `corridor`, `exterior`, `void`, …). Only two words are read structurally — `exterior` (outside) and `void` (not counted into floor area). The rest is carried as the author's own word.

**`rects` and `pieces` are not the same thing.**

- `rects` is the **written allocation**: the mm rectangles you get by resolving the grid references in `grids`. An L-shape is written as a union of rectangles.
- `pieces` is the **derived region**: a set of convex pieces. By default it is a copy of `rects`, but where a line has been drawn on a boundary it is the result of cutting along that half-plane.

**Area, plans and solids all read `pieces`.** `rects` survives into canonical JSON as the written spelling. For a space with no region (an `exterior`, say) both are empty.

```ts
console.log(m.spaces.get("/home/ldk"));
```

```text
{
  path: '/home/ldk',
  type: 'ldk',
  level: 'L1',
  grids: [
    { xa: 'X1', xb: 'X2', ya: 'Y1', yb: 'Y3' },
    { xa: 'X2', xb: 'X3', ya: 'Y1', yb: 'Y2' }
  ],
  rects: [
    { x1: 0, x2: 3640, y1: 0, y2: 7280 },
    { x1: 3640, x2: 7280, y1: 0, y2: 3640 }
  ],
  pieces: [
    [ [Object], [Object], [Object], [Object] ],
    [ [Object], [Object], [Object], [Object] ]
  ],
  areas: [],
  attrs: { name: 'LDK', floor: 'オーク', daylight: 1 },
  line: 3,
  file: '/Users/…/examples/house/L1.muro'
}
```

## Area

```ts
interface Area {
  grid: { xa: string; xb: string; ya: string; yb: string };
  rect: Rect;
  attrs: Attrs;
  line: number;
}
```

**A subdivision that is not counted.** It marks a region subordinate to a room — a change of floor finish, say — and appears in no area, no room count and no space graph. All it carries is an attribute override.

```ts
import { parseFile } from "@kensnzk/koyu/node";
const o = parseFile("examples/office.muro");
const s = [...o.spaces.values()].find((x) => x.areas.length > 0)!;
console.log(s.path, s.areas[0]);
```

```text
/L1/hall {
  grid: { xa: 'X1', xb: 'X1+1800', ya: 'Y1', yb: 'Y2' },
  rect: { x1: 0, x2: 1800, y1: 0, y2: 6400 },
  attrs: { name: '土間', floor: 'モルタル' },
  line: 20
}
```

## Zone

```ts
interface Zone {
  path: string;
  attrs: Attrs;
  line: number;
  file?: string;
}
```

**An aggregation that is counted** — a dwelling, a department, any grouping above spaces. It **carries no geometry**: its area is the sum over spaces gathered by path prefix, which [`zoneAreaM2`](queries.md#zoneaream2) derives.

```ts
console.log(m.zones.get("/home"));
```

```text
{
  path: '/home',
  attrs: { name: '住戸', use: 'exclusive' },
  line: 23,
  file: '/Users/…/examples/house/main.muro'
}
```

## Asset

```ts
interface Asset {
  name: string;
  kind: "door" | "window";
  attrs: Attrs;
  line: number;
  file?: string;
}
```

A declaration of a **type** of joinery. You write `asset SD1 door w:800 style:sliding`, and an opening refers to it with `door SD1 …`. Attributes on the instance override those on the type. Put them in their own file and `import` it.

```ts
console.log([...m.assets.values()][0]);
```

```text
{
  name: 'D1',
  kind: 'door',
  attrs: { w: 900, h: 2100, style: 'hinged', name: '玄関ドア' },
  line: 4,
  file: '/Users/…/examples/house/assets.muro'
}
```

## BoundaryKind

```ts
type BoundaryKind = "wall" | "open" | "stair" | "shaft" | "void";
```

**The kind states only the topology of the relation.** A handrail, a curtain wall — the *thing* that realises the boundary — is not a kind; that is the language of attributes.

| kind | Direction | Meaning | Passable? |
|---|---|---|---|
| `wall` | horizontal | something is there | only with a door |
| `open` | horizontal | nothing is there | yes |
| `stair` | vertical | a stair | yes |
| `shaft` | vertical | a lift shaft — continuous as space, but people do not pass | no |
| `void` | vertical | a void — the absence of floor | no |

**The vertical default is a slab, and it is never written.** The level's `slab` declaration supplies it wholesale. The horizontal default is a wall, equally unwritten: where two touching spaces have no declared boundary at all, a `kind:"wall"` boundary is derived.

## Boundary

```ts
interface Boundary {
  a: string;
  b: string;
  kind: BoundaryKind;
  drawn?: DrawnLine;
  t?: number;          // wall thickness mm, split about the centre line
  air?: boolean;       // does not enclose (handrail, fence)
  edge?: Edge;
  attrs: Attrs;
  openings: Opening[];
  segs: Seg[];
  line: number;
  file?: string;
  derived?: boolean;
}
```

**A boundary belongs to neither space.** It is a first-class relation joining two space paths. Its position is never written — it is derived from the allocation of the spaces ([`segmentsFor`](derive.md#segmentsfor)).

`air:1` says the boundary **does not enclose**: a handrail or a fence, where something is there but neither air nor light is stopped. That is a different axis from passability (a `wall` with no door is impassable whether or not it has `air:1`). **A space with an `open` or `air:1` boundary to the exterior is derived as semi-outdoor.**

`derived: true` marks a default boundary raised from mere contact. **It never appears in canonical JSON**, because it is not written composition.

```ts
console.log(m.boundaries.find((b) => b.openings.length > 0));
```

```text
{
  a: '/site/garden',
  b: '/out/road',
  kind: 'wall',
  t: 120,
  air: true,
  edge: 'S',
  attrs: { spec: 'ブロック塀+フェンス', h: 1200 },
  openings: [
    {
      kind: 'door',
      ref: 'GT1',
      w: 900,
      h: 1200,
      at: 0.5,
      atRef: 'X2',
      atAbs: 3640,
      atAxis: 'X',
      attrs: [Object],
      line: 24
    }
  ],
  segs: [],
  line: 23,
  file: '/Users/…/examples/house/site.muro'
}
```

The order of `a` and `b` matters only to `edge` and `swing`. **Form does not follow it** — write the two spaces in either order and the derived convex pieces and wall segments are identical.

## Opening

```ts
interface Opening {
  kind: "door" | "window";
  ref?: string;        // the joinery asset referred to
  w: number;           // width mm
  h?: number;          // height mm
  at: number;          // position along the segment, 0..1 (default 0.5)
  atRef?: string;      // explicit position as written (at:X2+450)
  atAbs?: number;      // its resolved value, mm
  atAxis?: "X" | "Y";
  edge?: Edge;
  hinge?: Edge;        // which side the hinge is on
  swing?: "a" | "b";   // which side it opens into
  attrs: Attrs;
  line: number;
}
```

**A ratio `at` is clamped to fit the segment.** A grid reference (`atAbs`) is not clamped; running off the end is an error. A position you wrote never moves silently.

Which `hinge` values are allowed follows from the segment's direction (`W`/`E` on a horizontal segment, `S`/`N` on a vertical one); the default is the start end. `swing` is the boundary's a-side or b-side, defaulting to whichever has a region (a first).

## Seg

```ts
interface Seg {
  w: number;
  at: number;
  atRef?: string;
  atAbs?: number;
  atAxis?: "X" | "Y";
  edge?: Edge;
  attrs: Attrs;
  line: number;
}
```

**An uncounted subdivision on a boundary** — a stretch where the wall material changes, say. It is positioned exactly as an opening is, but **affects neither passage nor connection.**

```ts
const b = o.boundaries.find((x) => x.segs.length > 0)!;
console.log(b.a, b.b, b.segs[0]);
```

```text
/L1/office /L1/corridor { w: 3600, at: 0.75, attrs: { spec: 'ガラスパーティション' }, line: 34 }
```

## DrawnLine

```ts
interface DrawnLine {
  aRef: string;    // as written
  bRef: string;
  a: Pt;           // resolved coordinates, mm
  b: Pt;
  line: number;
  effect?: "cut" | "nothing" | "undetermined";
}
```

**The act of dividing space, written down.** Endpoints are written in grid words (`X3,Y1`, `X3+600,Y2-900`) — there are no raw coordinates and no angles. The line replaces the segment a boundary would otherwise derive from adjacency.

**A segment has no direction.** The same two points joined either way round are the same line, so at the exit of parsing the endpoints are ordered by resolved coordinate (x, then y). `aRef` and `bRef` swap with them, so a diagnostic still quotes what was written. Without this the start of `at:` on an opening would depend on writing order, and **canonical JSON would stay byte-identical while a door moved.**

`effect` is the **outcome of the cut**, recorded at the moment the cut is made.

| `effect` | Meaning |
|---|---|
| `"cut"` | it actually divided a shape |
| `"nothing"` | it cut nothing (the `LIN03` warning) |
| `"undetermined"` | which side to keep is not decidable (the `LIN01` error) |

**It never appears in canonical JSON** — it is an outcome of derivation, not written composition. Recomputing it later would examine shapes that have already been cut, so the judgement and the operation stay in one place, looking at one population.

```ts
const c = parseFile("examples/complex/main.muro");
const dl = c.boundaries.find((b) => b.drawn)!;
console.log({ a: dl.a, b: dl.b, kind: dl.kind, drawn: dl.drawn });
```

```text
{
  a: '/L1/w04',
  b: '/out',
  kind: 'wall',
  drawn: {
    aRef: 'X1,Y5+2000',
    bRef: 'X2,Y6',
    a: { x: 0, y: 34000 },
    b: { x: 8000, y: 40000 },
    line: 44,
    effect: 'cut'
  }
}
```

## ColumnDecl / Column

```ts
interface ColumnDecl {
  size: number;        // side, mm
  depth?: number;      // depth of a rectangular section, mm
  levels: string[];    // expanded level names, ascending in z
  xNames?: string[];   // grid lines to restrict to; unset means all
  yNames?: string[];
  attrs: Attrs;
  line: number;
  file?: string;
}

interface Column {
  x: number; y: number;
  w: number; d: number;
  level: string;
  grid: string;        // the pair of grid lines it stands on (X3/Y2)
  decl: number;        // which declaration raised it (index into model.columns)
  attrs: Attrs;
}
```

**Position is never written.** A declaration says only which grid lines, which storeys, what size; the columns then stand at the grid intersections that have floor on that storey. It is the same stance that makes a wall appear from a boundary, applied to a point element.

`model.columns` holds declarations (`ColumnDecl`). The columns that actually stand (`Column`) are derived by [`columnsFor`](queries.md#columnsfor).

**Declaration order is meaning.** Two columns never stand on the same intersection, and the earlier declaration wins. So canonical JSON and diff both preserve the order — swapping two lines changes which columns stand.

```ts
const c = parseFile("examples/complex/main.muro");
console.log(c.columns[0]);
```

```text
{
  size: 900,
  levels: [
    'B2', 'B1', 'L1',
    'L2', 'L3', 'L4',
    'L5', 'L6'
  ],
  attrs: {},
  line: 45,
  file: '/Users/…/examples/complex/main.muro'
}
```

## SitePolygon

```ts
interface SitePolygon {
  path: string;
  points: Pt[];
  line: number;
  file?: string;
}
```

A given polygon, from survey. **It is the only free vertex list in the model** — the region of a space is written as grid-referenced rectangles, so this is the one place vertices are listed directly. It corresponds to a zone carrying `site:1`.

```ts
const p = [...c.polygons.values()][0]!;
console.log({ path: p.path, points: p.points.length, first: p.points[0], line: p.line });
```

```text
{ path: '/site', points: 10, first: { x: -6000, y: -8000 }, line: 7 }
```

## See also

- [Parsing and composition](parsing.md) — the five entrances that build this type
- [Deriving form](derive.md) — raising form from this type
- [Canonical JSON](canonical.md) — writing this type out as a machine format
- [The `.muro` reference](../muro/index.md) — the same composition seen from the notation
