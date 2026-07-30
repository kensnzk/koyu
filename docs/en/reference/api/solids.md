---
title: Solids and generated fabric
mode: reference
---

# Solids and generated fabric

What a [`Form`](derive.md) holds is **centre lines, thicknesses and z ranges**. Raising bodies from those — a quadrilateral with thickness, a prism — is itself part of derivation, so core holds the only implementation. Floors, ceilings, roofs and vertical circulation take the same stance: they emerge from declarations already made.

```ts
import {
  band, bandLine, columnRect, runDrawsForLevel, runPrism, runSolids,
  slabs, slopeText, thicken, verticalRuns,
} from "@kensnzk/koyu";
```

**Nothing here is written anywhere in the source.** Floor thickness, riser count, tread, slope — all of it emerges from rules. And **none of it carries appearance**: no colour, no line weight, no annotation format, so a viewer only has to map it into geometry.

Every piece of output on this page was produced against `examples/basement/main.muro`.

```ts
import { derive } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const b = parseFile("examples/basement/main.muro");
const form = derive(b);
```

## Constructors for bodies

If every consumer rewrote these, the parts would be shared but the rules of assembly would not, and the same `Form` would yield different shapes. So the formulas for a quadrilateral and a prism live in one place.

### thicken

```ts
function thicken(x1: number, y1: number, x2: number, y2: number, t: number): Pt[]
```

Turns a centre line into a quadrilateral with thickness. **The thickness is split evenly either side of the centre line**: ±t/2 along the unit normal, which is one formula for axis-parallel and diagonal segments alike.

The vertices come in the order **start+n → end+n → end−n → start−n**, so **joining the midpoints of the opposite pair of sides gives the centre line back.**

```ts
import { thicken } from "@kensnzk/koyu";

const wall = form.boundaries.find((x) => x.material && x.material.panels.length > 1)!;
const p = wall.material!.panels[1]!;
console.log(thicken(p.x1, p.y1, p.x2, p.y2, wall.material!.t).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
15875,13600 15875,14800 16125,14800 16125,13600
```

The centre line is at x=16000 and the thickness is 250, so the quadrilateral straddles 15875 to 16125.

### bandLine / band

```ts
function bandLine(seg: Segment, cx: number, cy: number, w: number): Seg2
function band(seg: Segment, cx: number, cy: number, w: number, t: number): Pt[]

interface Seg2 { x1: number; y1: number; x2: number; y2: number }
```

`bandLine` gives the stretch a band (an opening, a `seg`) occupies on a segment: half its width either way from the centre, along the segment. `band` is that run through `thicken`.

```ts
import { band, bandLine } from "@kensnzk/koyu";

const o = form.openings.find((x) => x.kind === "door")!;
console.log(o.ref, JSON.stringify(bandLine(o.segment, o.cx, o.cy, o.w)));
console.log(band(o.segment, o.cx, o.cy, o.w, o.t).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
/B1/park|/B1/mech@5/0 {"x1":16000,"y1":13600,"x2":16000,"y2":14800}
15875,13600 15875,14800 16125,14800 16125,13600
```

**Plan entities carry both the footprint (`polygon`) and the centre line (`lines`)**, so a consumer that draws a handrail as a single line never has to recover a centre line from a quadrilateral.

### columnRect

```ts
function columnRect(c: { x: number; y: number; w: number; d: number }): Pt[]
```

The section of a column: half its width and half its depth about the grid intersection.

```ts
import { columnRect } from "@kensnzk/koyu";
const c = form.columns[0]!;
console.log(c.ref, columnRect(c).map((q) => `${q.x},${q.y}`).join(" "));
```

```text
B2/X1/Y1 -400,-400 400,-400 400,400 -400,400
```

### runPrism

```ts
function runPrism(s: RunSolid): FormPrism

interface FormPrism {
  poly: Pt[];
  bottom: number[];   // lower z per vertex
  top: number[];      // upper z per vertex
}
```

Turns a vertical-circulation solid into a prism. **The four corner heights of an inclined slab are interpolated linearly along the run** — the `up` side is higher. A box has the same height at all four corners.

An outline plus a lower and upper z per vertex is enough for both a box and an inclined slab.

```ts
import { runPrism } from "@kensnzk/koyu";

const ramp = form.runs.flatMap((r) => r.solids).find((s) => s.kind === "incline")!;
const pr = runPrism(ramp);
console.log(ramp.kind, `up=${ramp.up}`, "bottom", pr.bottom.join(" "), "top", pr.top.join(" "));
```

```text
incline up=E bottom -7600 -5750 -5750 -7600 top -7400 -5550 -5550 -7400
```

The two corners on the `up` side (east) are higher, and the thickness follows the slab.

## Floors, ceilings, roofs

### slabs

```ts
function slabs(model: Model): Slab[]

type SlabKind = "floor" | "ceiling" | "roof";

interface Slab {
  kind: SlabKind;
  space: string;
  level: string;
  outline: Pt[];    // the outline of a derived convex piece
  z0: number;
  z1: number;
}
```

**Not one word of vocabulary was added for this.** A level's `slab` (floor build-up) already declares a floor, and `h` (ceiling height) already declares a ceiling. A roof is the inverse of "a floor with nothing above it", also a fact already in the model. There is no operation that lays a floor, hangs a ceiling, or puts on a roof.

| kind | What supplies it | Where it does not appear |
|---|---|---|
| `floor` | the level's `slab` | voids (their definition is the absence of floor), exteriors (that is ground) |
| `ceiling` | `h` (ceiling height) | voids, semi-outdoor spaces, vertical circulation, exteriors, and anything with `ceiling:0` |
| `roof` | the extent with no space stacked above | exteriors, semi-outdoor spaces |

**A partly covered space gets a roof over the uncovered part.** In a building where a tower sits on a podium, that is how the podium roof appears without being written.

**The absence of floor is not the absence of roof.** A void gets a roof too: a void with nothing above it is either a shaft capped by a rooflight or a courtyard open to the sky, and the latter is derived as semi-outdoor. So only exteriors and semi-outdoor spaces are excluded. Conversely voids do count as *covering*, so no roof appears midway up a shaft.

Vertical circulation gets no ceiling because it slopes along the run above and **is not one surface.**

```ts
import { slabs } from "@kensnzk/koyu";

const sl = slabs(b);
console.log(sl.length, "slabs;", ["floor","ceiling","roof"].map((k) => `${k}=${sl.filter((s) => s.kind === k).length}`).join(" "));
for (const s of sl.filter((x) => x.space === "/B2/park")) console.log(s.kind, s.space, s.level, `z ${s.z0}→${s.z1}`, s.outline.length + " pts");
```

```text
29 slabs; floor=15 ceiling=8 roof=6
floor /B2/park B2 z -8200→-7400 4 pts
ceiling /B2/park B2 z -4830→-4800 4 pts
```

A floor hangs below the storey's FL by the build-up (B2's FL is −7400 and `slab` is 800, so it starts at −8200). A ceiling sits at FL plus ceiling height, dropped by its face thickness.

**A ceiling does not necessarily follow the outline of the room** — coffers, dropped ceilings over beams, one continuous ceiling across several rooms, a shadow gap in front of a curtain wall. This derivation is an approximation at the resolution of a scheme design, and `ceiling:0` (an exposed soffit) is the one way out.

## Vertical circulation

### verticalRuns

```ts
function verticalRuns(model: Model): VerticalRun[]

type RunDevice = "stair" | "ramp" | "escalator" | "lift";
type RunForm = "straight" | "return";

interface VerticalRun {
  path: string;        // the space that declared it
  device: RunDevice;
  form: RunForm;
  level: string;
  upper?: string;      // the level reached above (a lift closes on its own level)
  z0: number; z1: number;
  rise: number;        // height climbed, mm
  up: Edge;            // the direction of ascent (meaningless for a lift)
  turn: "L" | "R";     // which way a return turns (default R)
  rect: Rect;
  length: number;      // total length along the run, mm
  width: number;       // width across the run, mm
  entry: number;       // depth of the boarding floor, mm
  lanes: number;       // parallel units (escalators; 1 otherwise)
  parts: RunPart[];
  risers: number;      // number of risers (stairs only)
  riser: number;       // riser, mm (stairs only)
  tread: number;       // tread, mm (stairs only)
  slope: number;       // slope of the steepest flight (rise / run)
  going: number;       // total horizontal length of the flights, mm (landings excluded)
}

interface RunPart {
  kind: "flight" | "landing";
  rect: Rect;
  t0: number; t1: number;   // span along the run, mm
  s0: number; s1: number;   // span across the run, mm
  z0: number; z1: number;   // height at t0 and at t1
  reversed: boolean;        // does a person travel in the direction of decreasing t?
  risers?: number;
  tread?: number;
  lane?: number;            // which of the parallel units
}
```

**Neither the number of risers, nor the tread, nor the slope is written.** What is written is the device (`stair:`, `ramp:`, `escalator:`, `lift:`), the direction of ascent, and the rectangle of the space. The rest is derived. Curves are not in the language — a spiral is written as a succession of returns.

The geometry of a `RunPart` is entirely `z0` and `z1`. **Which way it tilts and which end the steps rise from both follow from those two.** `reversed` is about **the direction a person travels**, independent of the geometry — a down escalator beside an up one has the same geometry and only the direction of travel reversed.

```ts
import { slopeText, verticalRuns } from "@kensnzk/koyu";

const stair = verticalRuns(b).find((r) => r.device === "stair")!;
console.log(`${stair.path} ${stair.device} form=${stair.form} level=${stair.level}→${stair.upper} rise=${stair.rise} risers=${stair.risers} riser=${Math.round(stair.riser)} tread=${Math.round(stair.tread)} slope=${slopeText(stair.slope)} going=${stair.going} parts=${stair.parts.length}`);
console.log(stair.parts[0]);
```

```text
/B2/st stair form=return level=B2→B1 rise=3700 risers=21 riser=176 tread=300 slope=1/1.5 going=6000 parts=3
{
  kind: 'flight',
  rect: { x1: 16000, x2: 17300, y1: 8100, y2: 11100 },
  t0: 1100,
  t1: 4100,
  s0: 0,
  s1: 1300,
  z0: -7400,
  z1: -5461.9047619047615,
  reversed: false,
  risers: 11,
  tread: 300
}
```

Being a return, it has three `parts`: flight, landing, flight. Where the tread differs between flights, **the tightest flight represents the run.**

### runSolids

```ts
function runSolids(run: VerticalRun): RunSolid[]

type RunSolid =
  | { kind: "box"; rect: Rect; z0: number; z1: number }
  | { kind: "incline"; rect: Rect; up: Edge; z0: number; z1: number; t: number };
```

The solid. **Steps rise as steps; a ramp rises as an inclined slab.** Boxes are treads, landings, escalator end sections and lift cars; inclined slabs are ramps, trusses and balustrades.

It is a bare description with no dependencies, and **a viewer only has to map it into geometry** — none of the reasoning about step division or slope goes with it. To get a prism, run it through [`runPrism`](#runprism).

```ts
import { runSolids } from "@kensnzk/koyu";
console.log(runSolids(stair).length, runSolids(stair)[0]);
```

```text
20 {
  kind: 'box',
  rect: { x1: 16000, x2: 17300, y1: 8100, y2: 8400 },
  z0: -7600,
  z1: -7223.809523809524
}
```

### runDrawsForLevel

```ts
function runDrawsForLevel(model: Model, level: string, cut?: number): RunDraw[]

interface RunDraw {
  path: string;
  device: RunDevice;
  dir: "up" | "down";
  treads: Seg2[];     // nosings (stairs) / step marks (escalators)
  outline: Seg2[];    // the sides of the flight, the edges of a landing
  breaks: Seg2[];     // where the run crosses the cutting plane, across the full width
  arrows: RunArrow[];
  anchor?: { x: number; y: number };
}

interface RunArrow extends Seg2 {
  up: boolean;        // does travelling this run on this storey go up?
}
```

The drawing of the vertical circulation cut at that level. `cut` defaults to 1200 mm.

**One plan holds two runs**: the one **ascending** from this level, cut at the break line, and the one **descending** to it, seen from above. Past the cut the ascending run stops being drawn, and from that point the descending run comes into view. **The descending run appears in whatever its ascending twin left uncovered.**

**No colour, no line style, no annotation string.** `breaks` is where the run crosses the cutting plane; the conventional pair of parallel diagonals is drawn by the consumer. A `RunArrow` carries **no words** either — `up` says whether you climb, and the annotation string is assembled by the consumer. `anchor` is a seat for that annotation, one per ascending run.

```ts
import { runDrawsForLevel } from "@kensnzk/koyu";

for (const d of runDrawsForLevel(b, "B1")) {
  console.log(`${d.path}\t${d.device}\tdir=${d.dir}\ttreads=${d.treads.length}\toutline=${d.outline.length}\tbreaks=${d.breaks.length}\tarrows=${d.arrows.map((a) => (a.up ? "up" : "down")).join(",") || "-"}\tanchor=${d.anchor ? `${d.anchor.x},${d.anchor.y}` : "-"}`);
}
```

```text
/B1/ev	lift	dir=up	treads=2	outline=4	breaks=0	arrows=-	anchor=-
/B1/ramp	ramp	dir=up	treads=0	outline=2	breaks=1	arrows=up	anchor=25000,3500
/B1/st	stair	dir=up	treads=6	outline=2	breaks=1	arrows=up	anchor=17300,9700
/B2/ramp	ramp	dir=down	treads=0	outline=6	breaks=0	arrows=down	anchor=-
/B2/st	stair	dir=down	treads=11	outline=6	breaks=0	arrows=down	anchor=-
```

The B1 plan carries both the stair going up from B1 (`/B1/st`, six treads up to the break) and the stair arriving from B2 (`/B2/st`, the eleven beyond it). **That is why a stair looks different on every storey.**

### slopeText

```ts
function slopeText(slope: number): string
```

Formats a slope as `1/N`, to one decimal place with a trailing `.0` dropped. At or below zero it returns `—`.

```ts
import { slopeText } from "@kensnzk/koyu";
console.log(slopeText(1/12), slopeText(0.5), slopeText(0));
```

```text
1/12 1/2 —
```

**This is a spelling of a number, not a judgement.** Whether a slope is too steep is said by `run.slope` in [`validate`](validate.md).

## See also

- [Deriving form](derive.md) — the whole `Form` and the rules behind it
- [Drawing](draw.md) — turning all of this into SVG
- [Writing vertical circulation](../muro/vertical-circulation.md) — the declaration seen from the notation
- [`koyu runs`](../cli/runs.md) — inspecting the derived step division from the command line
