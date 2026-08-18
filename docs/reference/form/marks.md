---
title: The marks of a plan
mode: reference
---

# The marks of a plan

`planMarks(form, level)` turns [the plan](plan.md)'s classified entities into the marks a drawing is made of. It is the layer between `Form` and a sheet of paper, and it exists because there is more than one sheet: koyu draws an SVG, [Ugatsu](https://ugatsu.dev) draws a viewer, and a product draws a canvas and a DXF. Written once per consumer, that layer drifts — and it did.

```ts
import { planMarks } from "@kensnzk/koyu/draw";

for (const mark of planMarks(derive(model), "L1")) {
  // mark.role decides the stroke; mark.polygon / .lines / .arc is the shape
}
```

**It decides no shape.** Wall thickness, the intervals an opening splits a wall into, a door swing's centre and radius and sweep, where a run is cut, the projection of the void above — all of it is already in the `Form` that `derive` returns. What this decides is *which* entity becomes a mark and what the mark stands for.

## It carries no word and no style

`Form` holds no colour, no line type and no annotation wording ([Scope](../scope.md)), and neither does a mark. "UP", "DN", 「上部吹抜け」 and 「12段 蹴上180/踏面240」 are not here, because three consumers spell three different sets of them and a base that carried one would make koyu's language everyone's.

What a mark carries instead is the **seat** and the **facts**:

| | |
|---|---|
| `at` | where a symbol or an annotation goes. A point, never a string |
| `note` | the unrounded facts an annotation is worded from — a stair's risers, riser, tread, going and rise; a ramp's slope and lanes; an arrow's direction |

Rounding is part of the wording. A ramp at `slope = 1/12.5` is "1/13" to one consumer and "1/12.5" to another, and that disagreement belongs to them.

## The roles

Twenty, and closed. A consumer that spells `Record<MarkRole, …>` stops compiling when koyu adds one — which is the intent, because the alternative is a mark that silently never appears.

| role | what it is |
|---|---|
| `space` / `space-semi-outdoor` / `space-void` | a space's face, cut by the plane |
| `void-hatch` | the void's two bounding-box diagonals (a drafting convention, not a shape of the building) |
| `wall` | the body of a wall interval the plane cut |
| `rail` | the centreline of something that does not enclose (`air:1`) |
| `open` | a relation with no matter (`type:open`) |
| `seg` | the band of a segment that does not count |
| `window` / `door-leaf` / `door-arc` / `slide-panel` / `slide-tail` | openings |
| `column` | a column |
| `run-outline` / `run-tread` / `run-break` / `run-arrow` / `run-note` | vertical circulation |
| `void-above` | the projection of an upper void onto the plan below |

**`space-semi-outdoor` is a role, not a flag.** A `faint` boolean would be a stroke instruction, and the two viewers that had one already disagreed about what it meant — one paints a fill, the other lowers an opacity.

**`class` is carried, not collapsed.** A mark keeps the [`PlanClass`](plan.md) `Form` assigned it, so a clerestory above the cut arrives as a `window` with `class: "above"` rather than as a window indistinguishable from a cut one.

## Two decisions that are not taste

**A boundary has matter when it has a `polygon`.** Not when a side lookup finds a material. Reading `lines` first turns every wall into a line and empties the drawing of black — that regression is real and has happened.

**The rail branch comes before the class filter.** A rail stands 1100 high against a plane cutting at 1200, so every rail interval is classified `below`. Asking the class first draws no handrail and no fence at all, silently.

## Getting back to what was written

A mark's `written` gives its place in **canonical boundary order** — the order `canonicalBoundaryOrder(model)` returns, never an index into `model.boundaries`. Declaration order is information the canonical form discards, so indexing by it reads another boundary's `spec` and nothing throws.

`pair` gives the two spaces a boundary-derived mark relates, for a consumer that would rather key by them.

## Neighbouring pages

- [The plan](plan.md) — the classified entities these marks are made from
- [The scene](scene.md) — the same service for three dimensions
- [Matter](bodies.md) — why a wall body is not its centre line thickened
- [Scope](../scope.md) — why presentation does not freeze
