---
title: Drawing
mode: reference
---

# Drawing

Two functions that return a string of SVG. **Not one rule of form lives here** — wall thickness, opening position, which side a door hangs on, where a stair is cut, are all already in the `Form` that [`derive(model)`](derive.md) returns. What these two decide is colour, line style, line weight, typeface, symbols, the words of annotations, scale, projection and page margin.

```ts
import { svgPlan, svgAxo } from "@kensnzk/koyu";
import type { PlanOptions, AxoOptions } from "@kensnzk/koyu";
```

There is also a domain entrance at `@kensnzk/koyu/draw`. **It is another door to the same functions.**

```ts
import { svgPlan, svgAxo } from "@kensnzk/koyu/draw";
```

## This surface is not frozen

**The contents of the SVG are outside the promise.** The same input yields the same form; it does not yield the same bytes. Colours, line styles, typefaces, the look of symbols and the order of elements all change without notice.

So **do not use this output as a golden file.** To compare drawings mechanically, compare [`toCanonical`](canonical.md) or the value from [`derive`](derive.md) — those are the form itself, and determinism is promised there.

## svgPlan

```ts
function svgPlan(model: Model, opts?: PlanOptions): string

interface PlanOptions {
  level?: string;   // default: the first level declared
  scale?: number;   // px per mm, default 0.05
  cut?: number;     // cut height above FL, mm, default 1200
}
```

Returns a plan. `cut` is a **thing that decides form**, so it is passed straight through to `derive` — unlike scale, it is not a matter of appearance.

```ts
import { svgPlan } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const svg = svgPlan(a, { level: "L1" });
console.log(svg.length + " chars");
console.log(svg.split("\n")[0]);
```

```text
3843 chars
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="393" viewBox="0 0 528 393" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

Changing `scale` and `cut` changes the sheet.

```ts
console.log(svgPlan(a, { level: "L1", scale: 0.1, cut: 800 }).split("\n")[0]);
```

```text
<svg xmlns="http://www.w3.org/2000/svg" width="888" height="618" viewBox="0 0 888 618" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

The extents of the sheet **include the written allocation**: where the allocation sticks out past a shape a line has cut, it still lands on the paper. A site polygon is drawn as a site boundary only on the lowest plan, which doubles as a site plan. Both are decisions about the sheet, not rules of form.

### It can throw

**It throws an `Error`**, not a `SourceError`, so there is no position and no line number. Catch it yourself.

| Message | When |
|---|---|
| `No level is defined` | `level` omitted and the model has no level at all |
| `There is no space with a region on level <name>` | the level named has no space with a region |

```ts
try { svgPlan(a, { level: "L9" }); } catch (e) { console.log("throws:", (e as Error).message); }
```

```text
throws: There is no space with a region on level L9
```

## svgAxo

```ts
function svgAxo(model: Model, opts?: AxoOptions): string

interface AxoOptions {
  dir?: "NE" | "NW" | "SE" | "SW";   // which corner you look down from, default SE
  scale?: number;                     // px per mm, default 0.02
  levels?: string[];                  // which levels to draw, default all
  ceilings?: boolean;                 // draw ceilings too, default false
  walls?: boolean;                    // draw walls, default true
}
```

Returns an axonometric. Where a plan is a section taken at a level, this is **the solid projected as it is.** No WebGL and no runtime are needed — like the plan it comes out as SVG text, so you check the solid with the same gesture: generate it and look.

What is drawn is **only what was generated**: floors and roofs, walls that appeared from boundaries, columns that appeared from grid intersections, vertical circulation. None of it is in the source.

```ts
import { svgAxo } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const h = parseFile("examples/house/main.muro");
const ax = svgAxo(h);
console.log(ax.length + " chars");
console.log(ax.split("\n")[0]);
```

```text
33025 chars
<svg xmlns="http://www.w3.org/2000/svg" width="472.1363028335939" height="405.35" viewBox="0 0 472.1363028335939 405.35" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
```

`dir` picks the corner you look down from. The plan is rotated in quarter turns before the isometric projection, so each of the four shows different faces.

```ts
for (const dir of ["NE", "NW", "SE", "SW"] as const) console.log(dir, svgAxo(h, { dir }).length);
```

```text
NE 33140
NW 33016
SE 33025
SW 32957
```

**`ceilings` defaults to `false` because drawing them hides the inside.** With `walls: false` only floors, roofs, columns and vertical circulation remain, which shows how structure and surface relate.

```ts
console.log("levels:", svgAxo(h, { levels: ["L1"] }).length,
  "ceilings:", svgAxo(h, { ceilings: true }).length,
  "walls:false", svgAxo(h, { walls: false }).length);
```

```text
levels: 19982 ceilings: 36021 walls:false 7425
```

### It can throw

If nothing at all would be drawn, it throws an `Error`.

| Message | When |
|---|---|
| `There is nothing to draw` | no solid is generated — no level, no space with a region, or `levels` names nothing that exists |

## Drawing it yourself

The right way is to read the `Form` directly and map it into your own drawing system. **Draw the same derived form with a different appearance** — that is what the split is for.

```ts
import { derive } from "@kensnzk/koyu";

const form = derive(model, { cut: 1200 });
const plan = form.plans.find((p) => p.level === "L1")!;

for (const e of plan.entities) {
  // e.class is cut / below / above / swing / anchor
  // e.polygon is the footprint, e.lines the centre line — which to draw is appearance
}
```

The classes and the types are on [deriving form](derive.md); the constructors that raise bodies from centre lines are on [solids and generated fabric](solids.md). **Do not rewrite those yourself** — sharing the parts without sharing the rules of assembly is exactly how the same `Form` starts producing different shapes.

## See also

- [Deriving form](derive.md) — the `Form` these two draw
- [Solids and generated fabric](solids.md) — raising bodies from centre lines and thicknesses
- [`koyu plan`](../cli/plan.md) / [`koyu axo`](../cli/axo.md) — the same generation from the command line
