---
title: Deriving form
mode: reference
---

# Deriving form

No form is written in `.muro`. The position of a wall, the stretches a wall is divided into by its openings, the coordinates of a column, how a stair divides into risers — all of it is **generated from rules**. `derive(model)` is the one entrance to it.

```ts
import {
  canonicalBoundaryOrder, derive, DERIVATION_CONSTANTS, deriveDefaultBoundaries,
  levelPitch, placeBand, placeOpening, segmentsFor, TOLERANCES,
} from "@kensnzk/koyu";
```

## derive

```ts
function derive(model: Model, opts?: DeriveOptions): Form

interface DeriveOptions {
  cut?: number;   // height of the plan's cutting plane, mm above FL (default 1200)
}
```

The arguments are the source and **the things that decide form**, nothing else. No scale, no margin, no orientation, no colour — those are appearance, not form.

**`Form` carries no appearance at all.** What comes back is coordinates, thicknesses, z ranges, orientations and the identity of each subject. No colour, typeface, line weight, annotation string, symbol, scale or page margin appears anywhere in the type. [`svgPlan` and `svgAxo`](draw.md) merely draw it.

```ts
import { derive } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const b = parseFile("examples/basement/main.muro");
const form = derive(b);
console.log(`levels=${form.levels.length} spaces=${form.spaces.length} boundaries=${form.boundaries.length} openings=${form.openings.length} segs=${form.segs.length} slabs=${form.slabs.length} columns=${form.columns.length} runs=${form.runs.length} site=${form.site.length} plans=${form.plans.length}`);
console.log(form.input);
```

```text
levels=4 spaces=13 boundaries=45 openings=7 segs=0 slabs=29 columns=36 runs=7 site=0 plans=4
{ cut: 1200 }
```

## Form

```ts
interface Form {
  input: FormInput;          // { cut: number }
  levels: FormLevel[];
  spaces: FormSpace[];
  boundaries: FormBoundary[];
  openings: FormOpening[];
  segs: FormSeg[];
  slabs: Slab[];
  columns: FormColumn[];
  runs: FormRun[];
  site: FormSite[];
  plans: FormPlan[];
}
```

`input` echoes the arguments used. **The cut height is an input to the Form, not a part of it** — the same model can produce forms at different cut heights.

## The indices are canonical order

**The `boundary` index on `FormBoundary`, `FormOpening` and `FormSeg` indexes `canonicalBoundaryOrder(model)`, not the declaration order in `model.boundaries`.**

The reason is simple. Declaration order is information [canonical JSON](canonical.md) throws away, and **information that is thrown away must not change form.** Spell identity from declaration order and two models with byte-identical canonical JSON split into `a|b@0` and `a|b@1`.

### canonicalBoundaryOrder

```ts
function canonicalBoundaryOrder(model: Model): Boundary[]
```

Returns the boundaries in canonical order: by the collation of each boundary serialised as its canonical entry, ties broken by declaration order for stability. **Default (`derived`) boundaries are ordered by the same rule** — they never reach canonical JSON, but they are derived from the order of `model.spaces`, so without the same reordering they carry the same disease.

```ts
import { canonicalBoundaryOrder } from "@kensnzk/koyu";

const order = canonicalBoundaryOrder(b);
for (let i = 0; i < 6; i++) {
  const bb = order[i]!;
  console.log(`canonical ${i}\tdeclared ${b.boundaries.indexOf(bb)}\t${bb.a} | ${bb.b}`);
}
```

```text
canonical 0	declared 17	/B1/ev | /B1/mech
canonical 1	declared 9	/B1/ramp | /B1/ev
canonical 2	declared 13	/B1/st | /B1/ev
canonical 3	declared 47	/B2/ev | /B1/ev
canonical 4	declared 48	/B1/ev | /L1/ev
canonical 5	declared 5	/B1/park | /B1/mech
```

**The two orders do not agree.** To get from an index inside `Form` back to the source boundary, index `canonicalBoundaryOrder(model)`, not `model.boundaries`.

For the same reason, **cutting regions by drawn lines happens in this order too.** Each cut reads the result of the previous one, so order matters; cutting in declaration order would produce different areas from the same canonical JSON.

## FormLevel

```ts
interface FormLevel {
  name: string;
  z: number;
  h?: number;
  slab?: number;
  pitch?: number;
}
```

`pitch` is the **storey height** — how far walls and columns stand.

- With a level above, the difference is the storey height.
- **With nothing above, it reaches the apex of the roof**: the greatest ceiling height on that storey plus the roof slab thickness. Any other formula and walls punch through the roof, or a gap opens under it.
- If no ceiling height can be settled, the storey height cannot either, and **no wall and no column stands on that level.** No default is invented (`SUF01` already says so as an error).

### levelPitch

```ts
function levelPitch(model: Model, level: string): number | undefined
```

The same computation, callable on its own.

```ts
import { levelPitch } from "@kensnzk/koyu";
for (const l of form.levels) console.log(l.name, levelPitch(b, l.name));
```

```text
B2 3700
B1 3700
L1 4900
R undefined
```

```ts
console.log(form.levels);
```

```text
[
  { name: 'B2', z: -7400, h: 2600, slab: 800, pitch: 3700 },
  { name: 'B1', z: -3700, h: 2600, slab: 800, pitch: 3700 },
  { name: 'L1', z: 0, h: 4000, slab: 900, pitch: 4900 },
  { name: 'R', z: 4900, slab: 500 }
]
```

The topmost level `R` has no ceiling height, so it has no `pitch` — and nothing stands there.

## FormSpace

```ts
interface FormSpace {
  path: string;
  type: string;
  level?: string;
  outline: Pt[][];     // the derived region (convex pieces), counter-clockwise
  areaM2?: number;
  z0?: number;         // the volume — only when a ceiling height is settled
  z1?: number;
  indoor: boolean;
  semiOutdoor: boolean;
  covered: boolean;    // is a space stacked above it?
}
```

Spaces with no region (an `exterior`) do not appear in the `Form` at all.

```ts
console.log(form.spaces[0]);
```

```text
{
  path: '/B2/park',
  type: 'parking',
  level: 'B2',
  outline: [ [ [Object], [Object], [Object], [Object] ] ],
  areaM2: 256,
  z0: -7400,
  z1: -4800,
  indoor: true,
  semiOutdoor: false,
  covered: true
}
```

## FormBoundary and FormPanel

```ts
interface FormBoundary {
  ref: string;          // identity of the relation — `a|b@i`
  boundary: number;     // the canonical index i
  a: string;
  b: string;
  kind: BoundaryKind;
  derived: boolean;
  level?: string;
  air: boolean;
  segment: Segment;     // the centre line
  material?: {
    t: number;
    z0: number;
    z1: number;
    panels: FormPanel[];
  };
}

interface FormPanel {
  x1: number; y1: number; x2: number; y2: number;
  z0: number; z1: number;
}
```

**A boundary with several segments produces one `FormBoundary` per segment** — same `ref`, different `segment`.

`material` is present **only where something is there**: `kind:"wall"` with a level and a storey height settled. An `open` boundary has a centre line and no material.

**A wall arrives already divided by its openings.** There is no "paint the black band the colour of the paper" step — the holes are in `panels` from the start.

```ts
const wall = form.boundaries.find((x) => x.material && x.material.panels.length > 1)!;
console.log(wall.ref, wall.a, wall.b, wall.kind, wall.derived, wall.level, wall.air);
console.log(`t=${wall.material!.t} z=${wall.material!.z0}→${wall.material!.z1}`);
for (const p of wall.material!.panels) console.log(`  panel (${p.x1},${p.y1})-(${p.x2},${p.y2}) z ${p.z0}→${p.z1}`);
```

```text
/B1/park|/B1/mech@5 /B1/park /B1/mech wall false B1 false
t=250 z=-3700→0
  panel (16000,12400)-(16000,13600) z -3700→0
  panel (16000,13600)-(16000,14800) z -1700→0
  panel (16000,14800)-(16000,16000) z -3700→0
```

The middle of the three stretches is the **head panel over the door**: its underside (−1700) sits at the head of the door, 2000 mm above the floor at −3700.

The spelling of `ref` is `<path a>|<path b>@<canonical index>`. `#` is avoided because it collides with the spelling of a colour.

## FormOpening and FormSwing

```ts
interface FormOpening {
  ref: string;        // `<the boundary's ref>/<opening index>`
  boundary: number;
  index: number;
  a: string; b: string;
  kind: "door" | "window";
  name?: string;
  level?: string;
  segment: Segment;
  cx: number; cy: number;   // centre, mm
  w: number;
  z0: number; z1: number;
  t: number;                // the joinery's face thickness = wall thickness
  style?: string;
  swing?: FormSwing;
  sliding: boolean;         // style:sliding / style:auto
}

interface FormSwing {
  into: string;    // the space it opens into
  hinge: Pt;
  leaf: Pt;        // where the leaf ends up fully open
  jamb: Pt;        // the opposite jamb
  ccw: boolean;    // does the arc sweep counter-clockwise?
}
```

The z range follows the kind. **A door rises from the floor**; everything else hangs down from the head height (2000 mm) by its own height. Sill height (`sill`) is a carried attribute, so core does not read it — aligning the heads is what fixes the bottom.

`swing` is present on doors only. Which side it opens into comes from `swing:a/b`, or else the side that has a region (a first). The direction is decided by the component pointing at the centre of the nearest convex piece of the **derived shape** it opens into — reading form rather than the written allocation, so a space cut by a line still opens the right way.

```ts
const o = form.openings.find((x) => x.kind === "door" && x.swing)!;
console.log(JSON.stringify(o, null, 1));
```

```text
{
 "ref": "/B1/park|/B1/mech@5/0",
 "boundary": 5,
 "index": 0,
 "a": "/B1/park",
 "b": "/B1/mech",
 "kind": "door",
 "level": "B1",
 "segment": {
  "x1": 16000,
  "y1": 12400,
  "x2": 16000,
  "y2": 16000,
  "horizontal": false,
  "edgeOfA": "E"
 },
 "cx": 16000,
 "cy": 14200,
 "w": 1200,
 "z0": -3700,
 "z1": -1700,
 "t": 250,
 "swing": {
  "into": "/B1/park",
  "hinge": {
   "x": 16000,
   "y": 13600
  },
  "leaf": {
   "x": 14800,
   "y": 13600
  },
  "jamb": {
   "x": 16000,
   "y": 14800
  },
  "ccw": false
 },
 "sliding": false
}
```

## FormSeg

```ts
interface FormSeg {
  ref: string;      // `<the boundary's ref>~<seg index>`
  boundary: number;
  index: number;
  level?: string;
  segment: Segment;
  cx: number; cy: number;
  w: number;
  t: number;        // the band's thickness = wall thickness
}
```

**Even an uncounted subdivision has a derived position.** It appears in no area and in no graph, but where it is is a question of form.

## FormColumn / FormRun / FormSite

```ts
interface FormColumn extends Column {
  ref: string;      // `<level name>/<grid pair>`
  z0: number;
  z1: number;
}

interface FormRun extends VerticalRun {
  solids: RunSolid[];
}

interface FormSite {
  path: string;
  points: Pt[];
  areaM2: number;
}
```

A column stands from `z0` to `z0 + pitch`. **On a level with no settled storey height, not one column stands.**

```ts
console.log(form.columns[0]);
```

```text
{
  x: 0,
  y: 0,
  w: 800,
  d: 800,
  level: 'B2',
  grid: 'X1/Y1',
  decl: 0,
  attrs: {},
  ref: 'B2/X1/Y1',
  z0: -7400,
  z1: -3700
}
```

`VerticalRun` and `RunSolid` are described under [solids and generated fabric](solids.md).

## FormPlan — a plan is not a pure section

```ts
interface FormPlan {
  level: string;
  cut: number;      // cut height above FL, mm
  cutZ: number;     // the cutting plane in world z, mm
  entities: PlanEntity[];
}

interface PlanEntity {
  class: PlanClass;
  of: PlanSubject;
  ref: string;
  role?: PlanRole;
  polygon?: Pt[];
  lines?: Seg2[];
  arc?: { cx: number; cy: number; r: number; from: Pt; to: Pt; ccw: boolean };
  anchor?: { x: number; y: number; up?: boolean };
}

type PlanClass = "cut" | "below" | "above" | "swing" | "anchor";
type PlanSubject = "space" | "boundary" | "opening" | "column" | "run";
type PlanRole = "outline" | "tread" | "break" | "arrow";
```

**Slicing a solid does not give you a plan.** The arc of a door is a sign of movement; the projection of a void above lies above the cut; the break line marks where something was cut; the descending flight is what is visible below the cut. None of it is in a section.

So the plan is held as a **classified set of 2D entities**.

| `class` | What it is |
|---|---|
| `cut` | what the cutting plane cut |
| `below` | what is visible below the cut |
| `above` | the projection of what is above the cut |
| `swing` | the arc of movement (a door) |
| `anchor` | a seat for a symbol |

**A stretch carries both its footprint (`polygon`) and its centre line (`lines`).** Whether to draw it as something with thickness or as a single line (a handrail that does not enclose) is a decision about appearance, so the consumer gets to make it.

```ts
const plan = form.plans.find((p) => p.level === "B1")!;
const count = new Map<string, number>();
for (const e of plan.entities) count.set(`${e.class}/${e.of}`, (count.get(`${e.class}/${e.of}`) ?? 0) + 1);
console.log(`level=${plan.level} cut=${plan.cut} cutZ=${plan.cutZ} entities=${plan.entities.length}`);
for (const [k, n] of [...count].sort()) console.log(`  ${k} ${n}`);
```

```text
level=B1 cut=1200 cutZ=-2500 entities=62
  above/boundary 2
  anchor/run 2
  below/run 5
  cut/boundary 19
  cut/column 15
  cut/opening 2
  cut/run 9
  cut/space 6
  swing/opening 2
```

**One plan holds both the ascending and the descending run.** On B1 the stair going up from B1 is cut at the break line, and beyond it the stair arriving from B2 is visible. That is why a stair looks different on every storey, and it is the plain fact that a plan is a section taken at that level.

The `arc` of a `swing` is absent for a sliding door — only the direction it slides remains, in `lines`.

## Parts of the derivation

The parts `derive` uses can be called individually. **What `derive` adds is the assembly** — assemble it per consumer and the same source yields different buildings.

### segmentsFor

```ts
interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  horizontal: boolean;   // horizontal means y1===y2, vertical means x1===x2
  diagonal?: boolean;    // not axis-parallel (a drawn line)
  edgeOfA?: Edge;        // which side of boundary.a's rectangle
}

function segmentsFor(model: Model, b: Boundary): Segment[]
```

**This one function is the whole answer to where a wall appears.** There is no operation that places a wall.

- Both sides have a region → the axis-parallel edges the two regions share.
- One side has no region (an `exterior`) → the perimeter minus the stretches faced by other rooms on the same level.
- The boundary has a drawn line → the stretches of that line where the two sides are exactly a and b.
- A vertical boundary (`stair` / `shaft` / `void`) → an empty array.

**Shared edges and perimeters are taken from the derived shape (`pieces`), not the written allocation.** From the allocation, a wall would stand out past the side a line cut away.

```ts
import { parse, segmentsFor } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:800
boundary /L1/a /out t:150`);

const bIn = g.boundaries.find((x) => x.b === "/L1/b")!;
console.log(segmentsFor(g, bIn));

const bOut = g.boundaries.find((x) => x.b === "/out")!;
for (const s of segmentsFor(g, bOut)) console.log(`edge:${s.edgeOfA} ${s.x1},${s.y1} → ${s.x2},${s.y2}`);
```

```text
[
  {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  }
]
edge:S 0,0 → 3600,0
edge:N 0,4000 → 3600,4000
edge:W 0,0 → 0,4000
```

Only three external segments come back because `/L1/b` occupies the E side of `/L1/a`. **This is why a boundary to the exterior splits into several segments, and why placing an opening on one needs `edge:` to pick a side.**

The compass is **N=+Y, S=−Y, E=+X, W=−X**. If you need a length, measure it from the endpoints yourself — koyu stops at where the segments are.

### deriveDefaultBoundaries

```ts
function deriveDefaultBoundaries(model: Model): void
```

For every pair of region-bearing spaces on the same level that touch in plan and have no declared boundary at all, adds a `kind:"wall"` boundary to `model.boundaries`, marked `derived: true`. Contact is judged on the **derived shapes**, so a pair whose contact a line removed gets nothing.

**Nothing is derived against a space with no region** (an `exterior`). Naming that counterpart is itself information, so it is left to be declared.

**Every [parse function](parsing.md) has already applied this on the way out.** It is idempotent, so calling it again is harmless.

```ts
import { deriveDefaultBoundaries } from "@kensnzk/koyu";
const before = g.boundaries.length;
deriveDefaultBoundaries(g);
console.log(before, "→", g.boundaries.length);
```

```text
2 → 2
```

**The one time you must call it yourself is after building a `Model` from canonical JSON.** Canonical JSON holds only the written composition, so the default walls have to be derived to read the meaning back.

### placeOpening / placeBand

```ts
interface Band {
  w: number; at: number;
  atRef?: string; atAbs?: number; atAxis?: "X" | "Y";
  edge?: Edge; line: number;
}

interface PlacedBand { segment: Segment; cx: number; cy: number }

interface BandError {
  error: string;      // the finished sentence, with position prefix
  code: BandCode;
  line: number;
  file?: string;
  message: string;    // the body without the prefix
}

type BandCode =
  | "OPN04" | "OPN05" | "OPN06" | "OPN07" | "OPN08"
  | "SEG04" | "SEG05" | "SEG06" | "SEG07" | "SEG08";

function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | BandError
function placeBand(model: Model, b: Boundary, band: Band, label: string): PlacedBand | BandError
```

Places an opening (or a `seg`) on a boundary segment and returns the absolute coordinates of its centre. **When it cannot be placed, nothing is thrown — a `BandError` comes back**; discriminate with `"error" in result`.

A `label` of `"seg"` selects the `SEG` codes; anything else (`"door"`, `"window"`) selects the `OPN` codes. `placeOpening` is nothing but `placeBand(model, b, o, o.kind)`.

```ts
import { placeBand, placeOpening } from "@kensnzk/koyu";

console.log(placeOpening(g, bIn, bIn.openings[0]!));
console.log(placeOpening(g, bOut, bIn.openings[0]!));   // several segments — ambiguous
console.log(placeBand(g, bIn, { w: 1000, at: 0.25, line: 0 }, "seg"));
```

```text
{
  segment: {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  },
  cx: 3600,
  cy: 2000
}
{
  error: 'line 8: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)',
  code: 'OPN05',
  line: 8,
  message: 'There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/a | /out)'
}
{
  segment: {
    x1: 3600,
    y1: 0,
    x2: 3600,
    y2: 4000,
    horizontal: false,
    edgeOfA: 'E'
  },
  cx: 3600,
  cy: 1000
}
```

**A ratio `at` is clamped to fit the segment.** A grid reference (`atAbs`) is not, and running off the end is `OPN08` / `SEG08`. On a diagonal segment (a drawn line) a grid reference does not fix a unique position, so it is `OPN07` / `SEG07` — write a ratio there.

## DERIVATION_CONSTANTS

```ts
const DERIVATION_CONSTANTS: Readonly<Record<string, number>>
```

**These decide what is derived when nothing was written.** Write a value and the written value always wins. This is not a ledger of what may be written.

```ts
import { DERIVATION_CONSTANTS } from "@kensnzk/koyu";
console.log(DERIVATION_CONSTANTS);
```

```text
{
  WALL_T: 100,
  RAIL_T: 60,
  RAIL_T_MAX: 80,
  RAIL_H: 1100,
  OPENING_HEAD: 2000,
  OPENING_H: 1200,
  CEILING_T: 30,
  ROOF_T: 200,
  CUT_HEIGHT: 1200,
  DEFAULT_RISER_MAX: 180,
  TREAD_TARGET: 300,
  LANDING_MIN: 1100,
  ENTRY_LANDING: 1100,
  LANE_ESCALATOR: 1200,
  TREAD_SOLID: 200,
  SLAB_T: 200,
  STEP_MARK: 400
}
```

| Name | Default for | Overridden by |
|---|---|---|
| `WALL_T` | wall thickness, mm, split evenly about the centre line | the boundary's `t:` |
| `RAIL_T` | thickness of a non-enclosing boundary (`air:1`), mm | the boundary's `t:` |
| `RAIL_T_MAX` | its ceiling — whatever `t:` says, it stops here | — |
| `RAIL_H` | top of a non-enclosing boundary, mm | the boundary's `h:` |
| `OPENING_HEAD` | head height of an opening, mm; doors rise to it, everything else hangs from it | — |
| `OPENING_H` | height of a non-door opening, mm | the opening's `h:` |
| `CEILING_T` | face thickness of a ceiling, mm | — |
| `ROOF_T` | roof slab thickness where nothing is above, mm | the `slab:` of the level above |
| `CUT_HEIGHT` | plan cut height above FL, mm | the `cut` option of `derive` |
| `DEFAULT_RISER_MAX` | maximum riser, mm | `riser:` |
| `TREAD_TARGET` | target tread when deriving a landing on a return stair, mm | `tread:` |
| `LANDING_MIN` | minimum landing depth, mm | — |
| `ENTRY_LANDING` | depth of the boarding floor, mm | `entry:` |
| `LANE_ESCALATOR` | nominal width of one escalator, mm | `lane:` |
| `TREAD_SOLID` | face thickness of a tread in the solid, mm | — |
| `SLAB_T` | thickness of a ramp or escalator deck, mm | — |
| `STEP_MARK` | pitch of the escalator step marks in plan, mm | — |

## TOLERANCES

```ts
const TOLERANCES: Readonly<Record<string, number>>
```

**These decide how different two things must be to be different things.** One question must not have two tolerances, so they live in one place.

```ts
import { TOLERANCES } from "@kensnzk/koyu";
console.log(TOLERANCES);
```

```text
{
  EPS: 0.5,
  AREA_EPS: 1,
  PROBE: 5,
  SPAN_EPS: 1,
  CROSS_EPS: 0.000001,
  PARALLEL_EPS: 1e-9,
  POINT_EPS: 1
}
```

| Name | Unit | Tolerance for |
|---|---|---|
| `EPS` | mm | lengths and coordinates: collinearity, facing edges, matching stretches, gaps in a collinear merge |
| `AREA_EPS` | mm² | degeneracy of area: a remnant this small is nothing |
| `PROBE` | mm | how far to probe either side of a drawn line. **This is the resolution floor of form** — a space narrower than this cannot be assigned to either side |
| `SPAN_EPS` | mm | matching of spans, cuts and frames: comparing z against the cut plane, the minimum visible run, the minimum envelope gap |
| `CROSS_EPS` | cross product | the sign when cutting by a half-plane: keep the vertex, or insert the crossing |
| `PARALLEL_EPS` | dimensionless | parallelism of an infinite line and a segment, and the range of the segment parameter |
| `POINT_EPS` | mm | how wide a band counts as "on the polygon's edge" (on the boundary is inside) |

**Coordinates are integers of millimetres by default.** So the 0.5 mm length tolerance sits at half the integer step. The 1 mm² area tolerance is a 1 mm × 1 mm sliver: a remnant that small after a half-plane cut is not counted as a shape.

## See also

- [Solids and generated fabric](solids.md) — raising quadrilaterals and prisms from a centre line and a thickness; floors, roofs, vertical circulation
- [Drawing](draw.md) — turning a `Form` into SVG
- [Model and its types](model.md) — the input to `derive`
- [Canonical JSON](canonical.md) — the format that fixes the index order
