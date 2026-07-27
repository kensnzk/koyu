**English** · [日本語](../api.md)

# TypeScript API reference

A page for using `@kensnzk/koyu` from a program. **It is arranged from the side of what you want to do** — not a list of symbols, but read in the order of loading, checking, asking, borrowing the parts of derivation, generating, and comparing. The summary of the contract is held by [spec/tools.md](../../spec/en/tools.md) and the definitions of the answers by [spec/semantics.md](../../spec/en/semantics.md). This is how you call them.

Everything the CLI answers, this API answers. The CLI, MCP, and the API are different entrances to the same derivations, and **there is no answer available in only one of them.**

## The first program

Load, check, and produce areas. That alone is one full circuit.

```ts
import { checkDiagnostics, areaM2 } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/two-rooms.muro");

const diags = checkDiagnostics(model);
console.log(`${model.name} — 空間 ${model.spaces.size} / 診断 ${diags.length}件`);
for (const d of diags) console.log(`${d.severity} ${d.code} ${d.message}`);

for (const s of model.spaces.values()) {
  console.log(`${s.path}\t${s.type}\t${areaM2(s) ?? "-"}`);
}
```

```text
二室 — 空間 3 / 診断 0件
/L1/a	room	16.2
/L1/b	room	16.2
/out	exterior	-
```

`model.spaces` is a `Map<string, Space>` and `model.boundaries` is a `Boundary[]`. **The path is a space's identity**, and boundaries belong to neither space, lining up in an array as first-class relations.

## Two entrances

```ts
import { /* … */ } from "@kensnzk/koyu";        // browser-safe
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";  // pulls in node:fs
```

**The root entry does not pull in `node:fs`.** It runs as-is in a browser or a worker. Only the entrances that touch the filesystem are split out into `@kensnzk/koyu/node`. They are split to keep the parser itself pure — composition (resolving `import`) takes a "how do I read a layer" function from outside, and fs is only one implementation of it. A browser passes a set of virtual files (`parseFiles`) or its own loader (`parseWith`) ([ADR-0010](../../docs/decisions/0010-assets-and-composition.md)).

There are 48 runtime values exported from the root and 2 from `/node`. **The complete list is in [spec/tools.md](../../spec/tools.md)** — go there to see the face as a single table ([ADR-0037](../../docs/decisions/0037-public-surface.md)). This page picks up the ones you reach for, from the side of what you want to do.

## Loading and composing

Builds a `Model` from `.muro` text. These differ only in how they resolve composition (`import`); the `Model` that comes out has the same shape. **The derivation of default boundaries is already applied on the way out of every entrance** ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)).

### parse — a single source string

```ts
function parse(source: string): Model
```

Reads one piece of text. `import` cannot be resolved and is an error. For tests, scratch work, and places where you assemble a string.

```ts
import { parse } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2`);
console.log(m.spaces.size, m.version, m.layers);
```

```text
1 0.5 []
```

`model.layers` is the list of layers that took part in composition (in composition order, the entry first). `parse` takes a single source, so it is empty.

### parseFiles — a set of virtual files

```ts
function parseFiles(files: Record<string, string>, entry: string): Model
```

Pass a table of keys and contents. `import` is resolved within that key space. **The standard entrance for a browser** (you can hand it your editor's buffers directly).

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600 7200\ngrid Y 0 4000\nlevel L1 0\nimport ./L1.muro`,
  "L1.muro": `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`,
}, "main.muro");
console.log(m.spaces.size, m.layers);
```

```text
2 [ 'main.muro', 'L1.muro' ]
```

### parseWith — your own loader

```ts
type LayerLoader = (
  fromKey: string | undefined,
  ref: string,
) => { key: string; src: string };

function parseWith(loader: LayerLoader, entry: string): Model
```

Replaces how a layer is read. When `fromKey` is `undefined` it is resolving the entry itself. The `key` you return is the identity, and the same key is composed only once (a double `import` and a cycle are idempotent). Entrances that pull from HTTP or from a database ride here.

```ts
import { parseWith } from "@kensnzk/koyu";

const src: Record<string, string> = {
  e: `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`,
};
const m = parseWith((_from, ref) => ({ key: ref, src: src[ref]! }), "e");
console.log(m.spaces.size, m.layers);
```

```text
1 [ 'e' ]
```

### parseFile — the filesystem (node only)

```ts
function parseFile(filePath: string): Model
```

`import` is resolved **relative to the file it is written in**. This is what the CLI uses.

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log(m.name, m.spaces.size, m.layers.length + "レイヤー");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")).join("\n"));
```

```text
小さな戸建住宅 13 5レイヤー
examples/house/main.muro
examples/house/assets.muro
examples/house/site.muro
examples/house/L1.muro
examples/house/L2.muro
```

What goes into `model.layers` are **resolved absolute paths** (the example above strips the cwd for readability). A diagnostic's `file` field carries the same value.

### parseFileWith — composing with a substitution (node only)

```ts
function parseFileWith(
  filePath: string,
  overlay?: (absPath: string) => string | undefined,
): Model
```

A path for which `overlay` returns a string is composed with that instead of the content on disk. **The gate before writing** uses this — it can check "would saving this content break anything?" without saving.

```ts
import { parseFileWith } from "@kensnzk/koyu/node";

const m = parseFileWith("examples/two-rooms.muro", (abs) =>
  abs.endsWith("two-rooms.muro")
    ? `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:差し替え`
    : undefined);
console.log(m.spaces.get("/L1/a")!.attrs["name"]);
```

```text
差し替え
```

### tokenize — break one line apart

```ts
function tokenize(line: string, ln: number): string[]
```

Extracts only the lexis, handling quotes and comments. A low-level part for editor completion, syntax highlighting, and the like.

```ts
import { tokenize } from "@kensnzk/koyu";
console.log(tokenize('space /L1/a room X1..X2 Y1..Y2 name:"居 室" # コメント', 1));
```

```text
[ 'space', '/L1/a', 'room', 'X1..X2', 'Y1..Y2', 'name:居 室' ]
```

## Checking

### checkDiagnostics — the primary form

```ts
function checkDiagnostics(model: Model): Diagnostic[]

interface Diagnostic {
  code: string;                 // a code from the DIAGNOSTIC_CODES ledger
  severity: "error" | "warning";
  message: string;              // the message body (no position prefix)
  line?: number;
  file?: string;                // the provenance layer, when composing
  path?: string[];              // the subject space/zone paths (both, for a boundary)
  related?: Array<{ line: number; file?: string }>;
}
```

**This is the primary form of `check`.** Use it when handling things structurally ([ADR-0016](../../docs/decisions/0016-diagnostic-contract.md)). `message` is the body only; the position is carried separately by `line` / `file`.

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const model = parse(`grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120`);
console.log(JSON.stringify(checkDiagnostics(model), null, 1));
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

**`checkDiagnostics` never throws.** Syntax and composition errors are thrown by the `parse` family as `SourceError`, so catch those at the call site. What each diagnostic means and how to fix it is in [diagnostics.md](diagnostics.md).

### check — the compatible string form

```ts
function check(model: Model): CheckResult

interface CheckResult {
  errors: string[];
  warnings: string[];
}
```

Returns strings with the position prefix (`file:N行目: `) assembled, **with the same items in the same order** as `checkDiagnostics`. For showing to a person as-is.

```ts
import { check } from "@kensnzk/koyu";
const { errors, warnings } = check(model);
console.log(errors, warnings);
```

```text
[ 'line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b' ] []
```

(This example was read with `parse`, so there is no provenance file and the prefix is just the line number. Read with `parseFile` it would carry `<absolute path>:6行目: `.)

### DIAGNOSTIC_CODES — the ledger of codes

```ts
const DIAGNOSTIC_CODES: Record<string, "error" | "warning">
```

Every code paired with its normative severity. **Severity is an invariant property of a code** — when the weight changes a new code is minted, so you may branch on this table.

```ts
import { DIAGNOSTIC_CODES } from "@kensnzk/koyu";
const codes = Object.keys(DIAGNOSTIC_CODES);
console.log(codes.length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "error").length,
  codes.filter((c) => DIAGNOSTIC_CODES[c] === "warning").length);
console.log(DIAGNOSTIC_CODES["BND04"], DIAGNOSTIC_CODES["BND07"]);
```

```text
49 34 15
error undefined
```

`BND07` is a retired number, so it is `undefined` ([diagnostics.md](diagnostics.md#bnd07)).

## Asking

Reading the same description in different ways.

### doorsBetween — how many doors to get through

```ts
function doorsBetween(model: Model, from: string, to: string): Route | undefined
interface Route { doors: number; path: string[] }
```

The route of fewest doors over the space graph. **It returns `undefined` both when it cannot be reached and when the path does not exist.** To distinguish them, check `model.spaces.has(path)` first.

```ts
import { doorsBetween } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
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

**A building can be sealed even when `checkDiagnostics` is empty.** The default between touching spaces is a wall, and a wall is impassable without a door, so no diagnostic appears even with not one door written. Whether circulation connects is confirmed with this function.

### neighbors / passable — what is next door

```ts
function neighbors(model: Model, path: string): NeighborInfo[]
interface NeighborInfo {
  space: Space;
  boundary: Boundary;
  passable: boolean;
  doors: number;    // the number of doors riding on that boundary
}

function passable(b: Boundary): boolean
```

`neighbors` returns **derived default boundaries as well**. `passable` states the passability of one boundary: `open` and `stair` are always passable, a `wall` only with a door, and `shaft` and `void` never. `air:1` is about shielding, not about passage (a railing wall is not passable).

```ts
import { displayName, neighbors, passable } from "@kensnzk/koyu";

for (const n of neighbors(m, "/home/hall1")) {
  console.log(`${n.space.path}\t${displayName(n.space)}\t${n.boundary.kind}\tpassable=${n.passable}\tdoors=${n.doors}`);
}
console.log(passable(m.boundaries.find((b) => b.kind === "stair")!));
```

```text
/home/ldk	LDK	wall	passable=true	doors=1
/site/east	東側通路	wall	passable=true	doors=1
/site/north	北側通路	wall	passable=false	doors=0
/home/hall2	2階ホール	stair	passable=true	doors=0
true
```

### daylightInputs — the inputs to daylight (it returns no verdict)

```ts
function daylightInputs(model: Model): DaylightInput[]
interface DaylightInput {
  space: Space;
  floor: number;      // floor area, m²
  window: number;     // effective window area, m² (after the coefficient)
  missingH: boolean;  // whether some window went uncounted for want of h
}
```

The subjects are only the spaces carrying `daylight:1`; the type is not consulted ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). **What comes back is only numbers — there is no `ok` and no `need`.** Drawing the line at 1/7 is a judgement on the architectural side, and the validation face says it (`validate`'s `daylight.ratio` — [validation.md](validation.md)) ([spec/scope.md §4](../../spec/en/scope.md)). With nothing in scope an empty array comes back — indistinguishable from "everything passed", so look at `length`.

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

### siteReport — the site's figures

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
interface RoadFrontage { road: Space; width: number; frontage: number }
```

The site is a zone carrying `site:1`, and a road is an `exterior` space carrying `road:<width in mm>`. Compute the coverage ratio and floor area ratio yourself as the quotients of these.

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

### Areas — areaM2 / zoneAreaM2 / unionAreaM2

```ts
function areaM2(s: Space): number | undefined        // to centerlines. undefined with no region
function zoneAreaM2(model: Model, zonePath: string): number  // the total bundled by path prefix
function unionAreaM2(rects: Rect[]): number          // the union area of a set of rectangles (overlap counted once)
```

`zoneAreaM2` **does not count voids or semi-outdoor space** (the language of net area). `unionAreaM2` is the horizontal projection — used to derive the building footprint.

```ts
import { areaM2, unionAreaM2, zoneAreaM2 } from "@kensnzk/koyu";

console.log(areaM2(m.spaces.get("/home/ldk")!), zoneAreaM2(m, "/home"),
  unionAreaM2([...m.spaces.get("/home/ldk")!.rects, ...m.spaces.get("/home/hall1")!.rects]));
```

```text
39.75 92.75 53
```

### effectiveUse / displayName — small things for display

```ts
function effectiveUse(model: Model, s: Space): string | undefined
function displayName(s: Space): string
```

`effectiveUse` inherits from **the deepest zone ancestor** when the space itself has no `use:`. `displayName` returns the `name:` attribute, or the last segment of the path when there is none.

```ts
import { displayName, effectiveUse } from "@kensnzk/koyu";
console.log(effectiveUse(m, m.spaces.get("/home/ldk")!), displayName(m.spaces.get("/home/ldk")!));
```

```text
exclusive LDK
```

## Identity

### newUids — mint a fresh uid

```ts
function newUids(model: Model, count?: number): string[]
```

**Derived neither from the path nor from the contents.** It is random — the prefix `u-` plus 16 characters of Crockford base32, 80 bits in all ([ADR-0039](../../docs/decisions/0039-identity-generation.md)).

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/two-rooms.muro");
const [uid] = newUids(m);
console.log(uid, uid.length);
```

```text
u-qkk0xrtqn2gqjypk 18
```

**The tokens that come back collide with nothing in that model.** Non-collision with layers not composed here is a probabilistic guarantee; UID03 under `check` is the only thing that actually proves uniqueness ([spec/en/scope.md §5.2](../../spec/en/scope.md)). Compose and check after writing them in.

**Until it is called, no tool writes a uid.** Assignment is an explicit act. The list of what can carry one is closed at `space` and `zone` — for how to use them see [howto/identity.md](howto/identity.md).

## The parts of derivation

The functions you borrow when drawing a plan yourself, or writing your own check. **There is no operation for placing a wall here either** — walls are derived from the layout of spaces.

### Wall centerline segments — segmentsFor

```ts
interface Segment {
  x1: number; y1: number; x2: number; y2: number;
  horizontal: boolean;      // horizontal means y1===y2, vertical means x1===x2
  diagonal?: boolean;       // not axis-parallel (a drawn line)
  edgeOfA?: Edge;           // the side as seen from boundary.a's rectangle (N/E/S/W)
}

function segmentsFor(model: Model, b: Boundary): Segment[]
```

**This one function is the whole answer to where a wall appears.** When both sides have regions it returns the shared edge; when one side has none (an `exterior`, say) it returns what remains of the perimeter. A vertical boundary (`stair` / `shaft` / `void`) has no segment, so the array is empty.

The compass of `edgeOfA` is **N=+Y, S=−Y, E=+X, W=−X** — X is east-positive and Y is north-positive.

```ts
import { parse, segmentsFor } from "@kensnzk/koyu";

const g = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /L1/b t:120
  door w:800
boundary /L1/a /out t:150`);

const bIn = g.boundaries.find((b) => b.b === "/L1/b")!;
console.log(segmentsFor(g, bIn));

const bOut = g.boundaries.find((b) => b.b === "/out")!;
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

Only three external walls come out because `/L1/b` occupies `/L1/a`'s E side. **That is why a boundary with the outside splits into several segments, and why placing an opening requires selecting a side with `edge:`.**

If you need a length, measure it from the endpoints yourself. **What koyu holds is where the segments are; from there on, it is the borrower's work.**

### Default boundaries — deriveDefaultBoundaries

```ts
function deriveDefaultBoundaries(model: Model): void
```

For a pair of spaces with regions touching in plan on the same level with no declared boundary, it derives a `kind:"wall"` boundary and adds it to `model.boundaries` (marked `derived: true`). **Every `parse` entrance already applies this on the way out.** It is idempotent, so calling it repeatedly is fine.

**The only time you need to call it explicitly is when you have assembled a `Model` from canonical JSON.** The canonical JSON holds only the authored composition, so reading the meaning (the default walls) requires putting it through this ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)).

```ts
import { deriveDefaultBoundaries } from "@kensnzk/koyu";
const before = g.boundaries.length;
deriveDefaultBoundaries(g);
console.log(before, "→", g.boundaries.length);
```

```text
2 → 2
```

### Placing openings and subdivisions — placeOpening / placeBand

```ts
interface Band {
  w: number; at: number;
  atRef?: string; atAbs?: number; atAxis?: "X" | "Y";
  edge?: Edge; line: number;
}
interface PlacedBand { segment: Segment; cx: number; cy: number }
interface BandError { error: string; code: string; line: number; file?: string; message: string }

function placeOpening(model: Model, b: Boundary, o: Opening): PlacedBand | BandError
function placeBand(model: Model, b: Boundary, band: Band, label: string): PlacedBand | BandError
```

Places an opening (or a `seg`) on a boundary segment and returns the absolute coordinates of its center. When it cannot be placed it returns a `BandError` rather than throwing — discriminate with `"error" in result`. The `code` is one of `OPN04`–`OPN08` / `SEG04`–`SEG08`, and a `label` of `"seg"` gives the SEG family. (This "band" is an interval along a boundary segment and is a different layer from the notation keyword `band`.)

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

A ratio `at` is clamped to fit within the segment, but a grid reference (`atAbs`) is not — overrunning gives `OPN08` / `SEG08`.

### What is generated — slabs / verticalRuns / runSolids / runDrawsForLevel

```ts
function slabs(model: Model): Slab[]                    // floors, ceilings, roofs (ADR-0024)
function verticalRuns(model: Model): VerticalRun[]      // the shape of vertical circulation (ADR-0021)
function runSolids(run: VerticalRun): RunSolid[]        // its solids (box / incline)
function runDrawsForLevel(model: Model, level: string, cut?: number): RunDraw[]  // the drawing cut at that level

interface Slab {
  kind: "floor" | "ceiling" | "roof";
  space: string; level: string;
  outline: Pt[];            // the outline of the derived convex piece
  z0: number; z1: number;
}
```

**Nothing that comes out here is written anywhere in the source.** The thickness of a floor, the number of risers, the going, the slope — all of it appears from the rules. And **none of it carries an appearance** — no colours, no line weights, no note formatting — so a viewer only maps it into geometry ([spec/scope.md §6](../../spec/en/scope.md)). ugatsu's 3D view, and the vertical circulation in its plan, are made of these four calls and nothing else.

```ts
import { runDrawsForLevel, runSolids, slabs, slopeText, verticalRuns } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const b = parseFile("examples/basement/main.muro");
for (const s of slabs(b).slice(0, 3)) console.log(s.kind, s.space, s.level, `z ${s.z0}→${s.z1}`);

const stair = verticalRuns(b).find((r) => r.device === "stair")!;
console.log(`${stair.path} ${stair.device} rise=${stair.rise} risers=${stair.risers} riser=${Math.round(stair.riser)} tread=${Math.round(stair.tread)} slope=${slopeText(stair.slope)}`);
console.log(runSolids(stair).length, runSolids(stair)[0]!.kind);
for (const d of runDrawsForLevel(b, "B1")) console.log(`${d.path} treads=${d.treads.length} arrows=${d.arrows.map((a) => a.label).join(" ")}`);
```

```text
floor /B2/park B2 z -8200→-7400
ceiling /B2/park B2 z -4830→-4800
floor /B2/ramp B2 z -8200→-7400
/B2/st stair rise=3700 risers=21 riser=176 tread=300 slope=1/1.5
20 box
/B1/ev treads=2 arrows=
/B1/ramp treads=0 arrows=UP
/B1/st treads=6 arrows=UP
/B2/ramp treads=0 arrows=DN
/B2/st treads=11 arrows=DN
```

Notice that a single plan carries **both the run going up and the run coming down**. Since a plan is "the section cut at that level", B1 shows at once the stair rising from B1 (UP) and the stair that arrived from B2 (DN).

### Height and derived properties — heff / levelsSorted / isSemiOutdoor / isCoveredAbove

```ts
function heff(model: Model, s: Space): number | undefined  // the space's h:, then the level's h
function levelsSorted(model: Model): Level[]               // ascending z
function isSemiOutdoor(model: Model, s: Space): boolean
function isCoveredAbove(model: Model, s: Space): boolean
```

**Semi-outdoor is derived rather than declared**: a space with a region carrying an `open` or `air:1` boundary with a `type:exterior`. Balconies, terraces, and gardens become this. `isCoveredAbove` is whether a space is overlapped from above by a space on any level — even the presence of a roof is not declared. The semi-outdoor daylight coefficient (0.7 when covered, 1.0 when open above) reads these two.

```ts
import { heff, isCoveredAbove, isSemiOutdoor, levelsSorted } from "@kensnzk/koyu";

console.log(heff(g, g.spaces.get("/L1/a")!), levelsSorted(g));
console.log(isSemiOutdoor(m, m.spaces.get("/site/garden")!), isSemiOutdoor(m, m.spaces.get("/home/ldk")!));
console.log(isCoveredAbove(m, m.spaces.get("/home/ldk")!), isCoveredAbove(m, m.spaces.get("/site/garden")!));
```

```text
2400 [ { name: 'L1', z: 0, h: 2400 } ]
true false
true false
```

### Site geometry — polygonAreaM2 / pointInPolygon / polyBounds / rectToPoly

```ts
interface Pt { x: number; y: number }

function polygonAreaM2(points: Pt[]): number                      // the shoelace formula. vertex order does not matter
function pointInPolygon(p: Pt, poly: Pt[], eps?: number): boolean // on the boundary counts as inside (default eps=1mm)
function polyBounds(poly: Pt[]): Rect                             // the bounding rectangle
function rectToPoly(r: Rect): Pt[]                                // a rectangle as a vertex list (counter-clockwise)
```

Coordinates are in mm and areas come back in m². **"Does the building escape the site?" is not here** — that is a judgement, so the validation face says it (`validate`'s `site.escape`) ([spec/scope.md §4](../../spec/en/scope.md)). What is here is only the numbers and shapes that judgement reads.

```ts
import { pointInPolygon, polyBounds, polygonAreaM2 } from "@kensnzk/koyu";

const poly = [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }];
console.log(polygonAreaM2(poly), pointInPolygon({ x: 5000, y: 5000 }, poly),
  pointInPolygon({ x: 12000, y: 0 }, poly), polyBounds(poly));
```

```text
100 true false { x1: 0, x2: 10000, y1: 0, y2: 10000 }
```

## Generating

### svgPlan — the plan drawing

```ts
function svgPlan(model: Model, opts?: PlanOptions): string
interface PlanOptions {
  level?: string;   // default: the first level declared
  scale?: number;   // px per mm. default 0.05
}
```

Returns an SVG string. **It can throw an `Error`** — when there is not one level, or when the given level holds no space with a region. It is not a `SourceError`, so on the CLI it becomes a raw stack trace. Catch it at the call site.

```ts
import { svgPlan } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const svg = svgPlan(a, { level: "L1" });
console.log(svg.length + "文字");
console.log(svg.split("\n")[0]);
try { svgPlan(a, { level: "L9" }); } catch (e) { console.log("throws:", (e as Error).message); }
```

```text
3369文字
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="393" viewBox="0 0 528 393" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
throws: There is no space with a region on level L9
```

The drawing conventions are in [spec/semantics.md §7](../../spec/en/semantics.md).

### toCanonical — the canonical JSON

```ts
function toCanonical(model: Model): string
```

A JSON string in stable order (with a trailing newline). `import` does not survive. **Default boundaries (`derived`) do not appear** — the canonical JSON holds only the authored composition. The leading `format` is the version of this format's spelling.

```ts
import { toCanonical } from "@kensnzk/koyu";
console.log(toCanonical(a).split("\n").slice(0, 6).join("\n"));
```

```text
{
  "format": "koyu-canonical/1.0",
  "koyu": "1.0",
  "name": "二室",
  "unit": "mm",
  "grid": {
```

The schema and the stability rules are in [spec/canonical-json.md](../../spec/en/canonical-json.md).

## Diffs

### semanticDiff / renderDiff

```ts
function semanticDiff(a: Model, b: Model): ModelDiff
function renderDiff(d: ModelDiff): string[]

interface ModelDiff {
  version?: { from: string; to: string };
  name?: { from?: string; to?: string };
  grid: GridChange[];
  levels:     { added: string[];      removed: string[];      changed: ChangedItem[] };
  assets:     { added: string[];      removed: string[];      changed: ChangedItem[] };
  polygons:   { added: string[];      removed: string[];      changed: ChangedItem[] };
  zones:      { added: string[];      removed: string[];      renamed: RenamedItem[]; changed: ChangedItem[] };
  spaces:     { added: SpaceItem[];   removed: SpaceItem[];   renamed: RenamedItem[]; changed: ChangedItem[] };
  boundaries: { added: BoundaryItem[]; removed: BoundaryItem[]; changed: BoundaryChange[] };
}
```

**Compares in the language of composition.** Line order, formatting, and the difference between a bare `wall` declaration and its omission (a default wall) are not differences. A rename is detected by a matching `uid` with a differing path. When `toCanonical` is identical, `renderDiff` returns an empty array.

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const b = parseFile("examples/two-rooms.muro");
b.spaces.get("/L1/b")!.attrs["name"] = "書斎";

console.log(renderDiff(semanticDiff(a, b)));
console.log(renderDiff(semanticDiff(a, a)));
```

```text
[ '± /L1/b: name 居室B → 書斎' ]
[]
```

The definition is [ADR-0018](../../docs/decisions/0018-semantic-diff.md).

## Errors

### SourceError

```ts
class SourceError extends Error {
  line: number;   // the line it came from
  raw: string;    // the body, without position information
  file?: string;  // the provenance layer when composing (a resolved absolute path)
  // message is `${file}:${line}行目: ${raw}`
}
```

**Only the `parse` family throws.** The checks (`check` / `checkDiagnostics`) never throw and always return arrays. A composition (`import`) failure arrives this way too.

```ts
import { SourceError, parse } from "@kensnzk/koyu";

try {
  parse("grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X9 Y1..Y2");
} catch (e) {
  if (e instanceof SourceError) {
    console.log({ name: e.name, line: e.line, raw: e.raw, file: e.file, message: e.message });
  }
}
```

```text
{
  name: 'SourceError',
  line: 4,
  raw: 'Undefined grid line name: X9',
  file: undefined,
  message: 'line 4: Undefined grid line name: X9'
}
```

Put through composition, `file` is filled in.

```ts
import { parseFile } from "@kensnzk/koyu/node";
try { parseFile("examples/house/L1.muro"); } catch (e) {
  if (e instanceof SourceError) console.log(e.message.replace(process.cwd() + "/", ""));
}
```

```text
examples/house/L1.muro:line 3: Undeclared level: level:L1
```

(Only one of the split layers was read, so the `level` declaration in the base layer is absent.)

### srcRef — how a position is written

```ts
function srcRef(line: number, file?: string): string
```

A small thing for expressing a position in the same format, in diagnostics and in errors of your own.

```ts
import { srcRef } from "@kensnzk/koyu";
console.log(srcRef(12), srcRef(12, "L1.muro"));
```

```text
line 12 L1.muro:line 12
```

## Versions

```ts
const SUPPORTED_LANGUAGE_VERSIONS: readonly string[]
const DEFAULT_LANGUAGE_VERSION: string
```

The language versions this tool accepts, and how `koyu <version>` is interpreted when omitted. **Omission means "read with the newest version", not "the meaning is stable across versions"** — write the version in files whose meaning you want pinned ([ADR-0017](../../docs/decisions/0017-language-versioning.md)).

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";
console.log(SUPPORTED_LANGUAGE_VERSIONS, DEFAULT_LANGUAGE_VERSION);
```

```text
[ '0.1', '0.2', '0.3', '0.4', '0.5' ] 0.5
```

## Types

The types come out alongside the values. Only the main ones are listed (the complete table is in [spec/tools.md](../../spec/en/tools.md)).

| Origin | Types |
|---|---|
| Model | `Model` `Space` `Zone` `Boundary` `Opening` `Seg` `Area` `Asset` `Level` `Rect` `Pt` `GridAxis` `GridRef` `SitePolygon` `Column` `ColumnDecl` `DrawnLine` `Edge` `BoundaryKind` `Attrs` `AttrValue` |
| Composition | `LayerLoader` |
| Checking | `Diagnostic` `DiagnosticCode` `CheckResult` |
| Graph and derivation | `Segment` `Band` `PlacedBand` `BandError` `BandCode` `Route` `NeighborInfo` |
| What is generated | `Slab` `SlabKind` `VerticalRun` `RunPart` `RunSolid` `RunDraw` `RunArrow` `RunDevice` `RunForm` `Seg2` |
| Queries | `DaylightInput` `SiteReport` `RoadFrontage` |
| Generation | `PlanOptions` `AxoOptions` |
| Diffs | `ModelDiff` `FieldChange` `ChangedItem` `RenamedItem` `GridChange` `SpaceItem` `BoundaryItem` `BoundaryChange` `ColumnItem` |
| Validation | `Finding` `ValidationRule` |

## An implementation to look at

The viewer **ugatsu** ([github.com/kensnzk/ugatsu](https://github.com/kensnzk/ugatsu)) is the reference consumer of this API. It performs every derivation as a call into this API and **holds not one answer of its own** — areas, wall positions, and passability are none of them computed on ugatsu's side. Write in the same posture and your implementation will not be left behind when koyu's semantics change.

## Related

- [spec/tools.md](../../spec/en/tools.md) — the contract for the CLI, MCP, and the public API (normative)
- [spec/semantics.md](../../spec/en/semantics.md) — the definitions of derivation, checking, and the queries (normative)
- [spec/canonical-json.md](../../spec/en/canonical-json.md) — the schema of the canonical JSON (normative)
- [cli.md](cli.md) — calling the same derivations from the command line
- [diagnostics.md](diagnostics.md) — the causes and fixes for the diagnostic codes
