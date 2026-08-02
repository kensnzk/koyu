---
title: Questions about a model
mode: reference
---

# Questions about a model

Functions that read the same description in different ways. **None of them passes judgement.** They stop at numbers, shapes and routes; whether something is *enough* is [`validate`](validate.md)'s sentence.

```ts
import {
  areaM2, columnsFor, daylightInputs, displayName, doorsBetween, effectiveUse,
  heff, isCoveredAbove, isIndoor, isSemiOutdoor, levelsSorted, neighbors,
  passable, siteReport, unionAreaM2, zoneAreaM2,
} from "@kensnzk/koyu";
```

Every piece of output on this page was produced against the model read from `examples/house/main.muro`.

```ts
import { parseFile } from "@kensnzk/koyu/node";
const m = parseFile("examples/house/main.muro");
```

## The space graph

Nodes are spaces, edges are boundaries. **"Are these two rooms connected?" is already a question about the graph** — nothing needs converting.

### doorsBetween

```ts
function doorsBetween(model: Model, from: string, to: string): Route | undefined

interface Route { doors: number; path: string[] }
```

Returns the route joining two spaces through the fewest doors. An `open` boundary and a stair cost nothing, a `wall` boundary with a door costs one, and everything else cannot be passed.

**`undefined` comes back both when the target is unreachable and when the path does not exist.** To tell those apart, check `model.spaces.has(path)` first.

```ts
console.log(doorsBetween(m, "/home/bed1", "/out/road"));
console.log(doorsBetween(m, "/home/bed1", "/home/nope"));
```

```text
{
  doors: 3,
  path: [
    '/home/bed1',
    '/home/hall2',
    '/home/hall1',
    '/site/east',
    '/site/garden',
    '/out/road'
  ]
}
undefined
```

`path` is the list of nodes and `doors` is how many doors the route passes. **The two counts do not match**, because stairs and `open` boundaries cost nothing.

### neighbors

```ts
function neighbors(model: Model, path: string): NeighborInfo[]

interface NeighborInfo {
  space: Space;
  boundary: Boundary;
  passable: boolean;
  doors: number;      // how many doors sit on that boundary
}
```

**Derived default boundaries come back too.** What is next door is not answered by the declared boundaries alone.

```ts
import { displayName, neighbors } from "@kensnzk/koyu";

for (const n of neighbors(m, "/home/hall1")) {
  console.log(`${n.space.path}\t${displayName(n.space)}\t${n.boundary.kind}\tpassable=${n.passable}\tdoors=${n.doors}`);
}
```

```text
/home/ldk	LDK	wall	passable=true	doors=1
/site/east	東側通路	wall	passable=true	doors=1
/site/north	北側通路	wall	passable=false	doors=0
/home/hall2	2階ホール	stair	passable=true	doors=0
```

The last row is a stair. **Vertical neighbours arrive in the same array** — the graph is not a plan.

### passable

```ts
function passable(b: Boundary): boolean
```

Whether one boundary can be passed.

| kind | Passable? |
|---|---|
| `open` | always |
| `stair` | always |
| `wall` | only with a `door` opening |
| `shaft` | never |
| `void` | never |

`air:1` is **about enclosure, not passage.** A handrail wall with no door is impassable, `air:1` or not.

```ts
console.log(passable(m.boundaries.find((b) => b.kind === "stair")!));
```

```text
true
```

## Areas

### areaM2

```ts
function areaM2(s: Space): number | undefined
```

The wall-centre area of a space, in m². **It is the sum over the derived convex pieces**, so a space cut by a drawn line reports the area of that shape. A space with no region (an `exterior`) gives `undefined`.

The value is rounded to two decimals.

### zoneAreaM2

```ts
function zoneAreaM2(model: Model, zonePath: string): number
```

The sum of the areas of the spaces gathered by path prefix. **Voids and semi-outdoor spaces are not counted** — this is the language of net saleable area.

### unionAreaM2

```ts
function unionAreaM2(rects: Rect[]): number
```

The union area of a set of rectangles. **Overlaps are counted once** — computed exactly by coordinate compression. This is the horizontal projection used to derive building footprint.

```ts
import { areaM2, unionAreaM2, zoneAreaM2 } from "@kensnzk/koyu";

console.log(areaM2(m.spaces.get("/home/ldk")!), zoneAreaM2(m, "/home"),
  unionAreaM2([...m.spaces.get("/home/ldk")!.rects, ...m.spaces.get("/home/hall1")!.rects]));
```

```text
39.75 92.75 53
```

## Indoor, semi-outdoor, covered

**All three are derived, none is declared.**

### isIndoor

```ts
function isIndoor(model: Model, s: Space): boolean
```

Whether the space counts towards indoor floor area. True for a space that has a region, is neither `exterior` nor `void`, and is not semi-outdoor.

**Every place that asks about gross floor area uses this one answer.** The population is never decided locally.

### isSemiOutdoor

```ts
function isSemiOutdoor(model: Model, s: Space): boolean
```

**A space with a region that has an `open` or `air:1` boundary to a `type:exterior` space** is semi-outdoor. Balconies, terraces and gardens land here.

### isCoveredAbove

```ts
function isCoveredAbove(model: Model, s: Space): boolean
```

Whether a space on any higher level overlaps it. **Even having a roof is not declared.** The semi-outdoor daylight factor (0.7 under a soffit, 1.0 where the sky is open) reads these two.

```ts
import { isCoveredAbove, isIndoor, isSemiOutdoor } from "@kensnzk/koyu";

for (const p of ["/home/ldk", "/site/garden", "/out/road"]) {
  const s = m.spaces.get(p)!;
  console.log(`${p}\tindoor=${isIndoor(m, s)}\tsemi=${isSemiOutdoor(m, s)}\tcovered=${isCoveredAbove(m, s)}`);
}
```

```text
/home/ldk	indoor=true	semi=false	covered=true
/site/garden	indoor=false	semi=true	covered=false
/out/road	indoor=false	semi=false	covered=false
```

`/home/ldk` is `covered=true` because the first-floor spaces sit over it. The garden is open to the sky, so it is false.

## Height and levels

### heff

```ts
function heff(model: Model, s: Space): number | undefined
```

The effective ceiling height of a space, in mm. **The space's own `h:` if it has one, otherwise the `h` of its level.** With neither, `undefined` — and then no ceiling and no roof are generated (`SUF01` says so as an error).

### levelsSorted

```ts
function levelsSorted(model: Model): Level[]
```

Levels in ascending `z`. `model.levels` is a `Record` and promises no order, so go through this whenever you need storeys in sequence.

```ts
import { heff, levelsSorted } from "@kensnzk/koyu";
console.log(heff(m, m.spaces.get("/home/ldk")!), levelsSorted(m).map((l) => `${l.name}@${l.z}`));
```

```text
2400 [ 'L1@0', 'L2@2900', 'R@5800' ]
```

## Daylight inputs

### daylightInputs

```ts
function daylightInputs(model: Model): DaylightInput[]

interface DaylightInput {
  space: Space;
  floor: number;      // floor area, m²
  window: number;     // effective window area, m² (factor applied)
  missingH: boolean;  // was a window skipped because it had no h?
}
```

**Only spaces carrying `daylight:1` are considered; type is never consulted.** Which rooms the daylight question applies to is the author's declaration.

The factor is a derivation of what lies beyond the window: 1.0 straight to the exterior, 0.7 through a semi-outdoor space with something above it, 1.0 through a semi-outdoor space open to the sky, and 0 otherwise (not counted). **The factor is a derivation of form, not a judgement.**

**Only numbers come back — no `ok`, no `need`.** Drawing the 1/7 line is architecture's call, made by `daylight.ratio` in [`validate`](validate.md).

```ts
import { daylightInputs } from "@kensnzk/koyu";

for (const d of daylightInputs(m)) {
  console.log(`${d.space.path} floor=${d.floor} window=${d.window.toFixed(2)} missingH=${d.missingH}`);
}
```

```text
/home/ldk floor=39.75 window=7.54 missingH=false
/home/bed1 floor=26.5 window=5.72 missingH=false
```

**With no eligible space you get an empty array**, which is indistinguishable from "everything passed" — so look at `length`. When `missingH` is true the window area is incomplete, and that number must not be used for a judgement.

## The site

### siteReport

```ts
function siteReport(model: Model): SiteReport

interface SiteReport {
  siteZone?: Zone;
  polygon?: SitePolygon;
  declaredArea?: number;  // the zone's area: (surveyed), m²
  derivedArea: number;    // derived, m²
  footprint: number;      // building footprint (horizontal projection), m²
  totalFloor: number;     // gross floor area, m²
  roads: RoadFrontage[];
}

interface RoadFrontage {
  road: Space;
  width: number;      // carriageway width, mm (the road: attribute)
  frontage: number;   // length of frontage, mm (derived)
}
```

The site is **the zone carrying `site:1`**; a road is **an `exterior` space carrying `road:<width in mm>`**.

`derivedArea` is the area of the site polygon if there is one, otherwise the union of the horizontal projections of the spaces inside the site and the indoor spaces. `footprint` is the union of the horizontal projections of the **derived shapes** of the indoor spaces — counting the written allocation instead would include what a splayed corner cut away.

**Frontage is the total length of the boundary segments between the site and the road.** An external wall facing the road is not frontage.

**Neither site coverage nor plot ratio comes back.** Those are quotients of these numbers, and what goes in the denominator is a question for the regulation, not for the model.

```ts
import { siteReport } from "@kensnzk/koyu";

const r = siteReport(m);
console.log({ zone: r.siteZone?.path, declared: r.declaredArea, derived: r.derivedArea,
  footprint: r.footprint, totalFloor: r.totalFloor,
  roads: r.roads.map((x) => ({ path: x.road.path, width: x.width, frontage: x.frontage })) });
```

```text
{
  zone: '/site',
  declared: 126.24,
  derived: 126.24,
  footprint: 53,
  totalFloor: 92.75,
  roads: [ { path: '/out/road', width: 6000, frontage: 10280 } ]
}
```

Objecting to a mismatch between `declaredArea` and `derivedArea` is validation's job (`site.area`). Here the two numbers simply sit side by side.

## Columns

### columnsFor

```ts
function columnsFor(model: Model, level: string): Column[]
```

Derives the columns standing on that level. **The position is written nowhere** — a column stands at each grid intersection that falls inside a space with floor (`exterior` and `void` excluded).

**No column stands where it would carry only sky.** A space that is semi-outdoor *and* has no floor above it — a roof garden, a top-level terrace — is out of the population, because there is nothing for a column to hold up.

**Two columns never share an intersection.** When several declarations aim at the same one, the earlier declaration wins.

```ts
import { columnsFor } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const c = parseFile("examples/complex/main.muro");
const cols = columnsFor(c, "L1");
console.log(cols.length, cols[0]);
```

```text
46 {
  x: 0,
  y: 0,
  w: 900,
  d: 900,
  level: 'L1',
  grid: 'X1/Y1',
  decl: 0,
  attrs: {}
}
```

`grid` is the pair of grid lines it stands on, in the language of the drawing. `decl` indexes `model.columns` and says **which declaration raised it** — which is what makes "this declaration raises no column at all" a question you can ask.

## Small things for display

### effectiveUse

```ts
function effectiveUse(model: Model, s: Space): string | undefined
```

The effective `use` attribute. If the space has none, it is inherited from **the deepest zone ancestor** that has one.

### displayName

```ts
function displayName(s: Space): string
```

The `name:` attribute, or the last segment of the path. **A string always comes back.**

```ts
import { displayName, effectiveUse } from "@kensnzk/koyu";
console.log(effectiveUse(m, m.spaces.get("/home/ldk")!), displayName(m.spaces.get("/home/ldk")!));
```

```text
exclusive LDK
```

## See also

- [Model and its types](model.md) — the types these questions read
- [Validation](validate.md) — the surface that puts thresholds on these numbers
- [Deriving form](derive.md) — when you need shape rather than number
- [`koyu doors`](../cli/doors.md) / [`koyu light`](../cli/light.md) / [`koyu site`](../cli/site.md) — the same questions from the command line
