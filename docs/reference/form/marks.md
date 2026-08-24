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

**It changes no building shape.** Wall thickness, the intervals an opening splits a wall into, an
opening's width and direction, where a run is cut and the projection of the void above are already
in the `Form` that `derive` returns. Marks select those entities and apply the shared
`architectural` presentation convention, including the 60mm clear gap of a sliding leaf and the
subdivision of an explicitly double-leaf opening. The convention is outside core so a confirmed
regional difference can replace it later without changing the building. Those lines do not become
wall, floor, graph or canonical data.

## It carries no word and no style

`Form` holds no colour, no line type and no annotation wording ([Scope](../scope.md)), and neither does a mark. Direction and stair-proportion labels are not here, because consumers may word them differently and a base that carried one would make koyu's language everyone's.

What a mark carries instead is the **seat** and the **facts**:

| | |
|---|---|
| `at` | where a symbol or an annotation goes. A point, never a string |
| `note` | the unrounded facts an annotation is worded from — a stair's risers, riser, tread, going and rise; a ramp's slope and lanes; an arrow's displayed direction |

Rounding is part of the wording. A ramp at `slope = 1/12.5` is "1/13" to one consumer and "1/12.5" to another, and that disagreement belongs to them.

## The roles

The union is closed. A consumer that spells `Record<MarkRole, …>` stops compiling when koyu adds one — which is the intent, because the alternative is a mark that silently never appears.

| role | what it is |
|---|---|
| `space` / `space-semi-outdoor` / `space-outdoor` / `space-void` | a space's face, cut by the plane |
| `void-hatch` | the void's two bounding-box diagonals (a drafting convention, not a shape of the building) |
| `wall` | the body of a wall interval the plane cut |
| `rail` | the centreline of something that does not enclose (`air:1`) |
| `open` | a relation with no matter (`type:open`) |
| `seg` | the band of a segment that does not count |
| `window` | the two unfilled wall-face lines that continue through a window opening |
| `door-leaf` / `door-arc` | hinged door leaves and their traces |
| `slide-panel` / `slide-centre` / `slide-tail` | sliding leaves, their meeting mark and dashed storage guides |
| `auto-direction` / `entrance` | automatic opening directions and a general entrance threshold |
| `gate-post` | gate jambs or posts |
| `rolling-shutter` / `overhead-door` | vertically operated doors, shown at the opening line with no horizontal storage guide |
| `window-leaf` / `window-arc` | hinged window leaves and their traces |
| `window-sash` / `window-sash-centre` / `window-fixed` | sliding, projecting and fixed window operations |
| `curtain-wall-mullion` | a thin transverse mark at an explicit curtain-wall panel boundary |
| `column` | a column |
| `run-outline` / `run-tread` / `run-break` / `run-arrow` / `run-note` | vertical circulation |
| `void-above` | the projection of an upper void onto the plan below |

A `window` mark carries the opening polygon and centre line supplied by `FormPlan`. A renderer uses
the polygon's two long edges as the wall faces and leaves them open at the jambs; it does not draw
the centre line. `slide-panel` carries a door or gate leaf parallel to the wall, offset by half that
wall's thickness plus 60mm. `slide-centre` carries its short perpendicular centre line, and
`slide-tail` carries each dashed continuation towards a storage pocket.
One sliding leaf has one centre mark and one storage guide. A pair of leaves that parts at the
opening centre has one centre mark on each leaf and one storage guide at each jamb. Bypass leaves
remain distinguishable by their parallel, overlapping sash lines.
Automatic doors divide their fixed and moving panels inside the opening and therefore carry no
`slide-tail`. A rolling shutter and an overhead door move vertically; the plan states their
operation at the opening line, while their upper path belongs to a section representation.
A curtain wall retains the `window` mark's two unfilled face lines. `curtain-wall-mullion` adds one
thin transverse line at every interior boundary of its explicit equal panel count; it carries no
product profile or fill.

A `FormPlan` arrow records direction of travel on the visible run face. A stair mark applies the
paper convention after that geometry is settled: every stair arrow points towards increasing
elevation. On a general floor, the departing arrow points towards the next floor and the arriving
arrow starts at the preceding floor's cut and continues to the current floor. Escalators keep their actual
operating direction. This changes neither the run nor the `FormPlan` entity it came from.

A departing stair arrow starts with an open circle at the exact flight boundary, centred on a
full-width first riser line. An arriving arrow starts at the preceding floor's cut symbol without a
circle. A return stair remains one continuous bent path across its intermediate landing. The top
floor omits treads below that preceding-floor cut and still draws each visible flight boundary.
The path enters the landing by half a flight width before crossing to the returning flight; the
offset is capped at half the landing depth.

**`space-semi-outdoor` is a role, not a flag.** A `faint` boolean would be a stroke instruction, and the two viewers that had one already disagreed about what it meant — one paints a fill, the other lowers an opacity.

**The three space roles are three different things, and a drawing has to be able to say which.** `space` is floor; `space-semi-outdoor` is roofed and not enclosed; `space-outdoor` is a space declared `outside:1` that carries a region — a courtyard, a plaza, the paving of a site. It is ground and not floor, and drawn as a room it reads as one: on a large plan the forecourt and the entrance hall become a single continuous field. The role carries the distinction; what each is painted is the viewer's to choose, and koyu's own plan chooses warm for inside and cool for outside.

**Being declared `outside:1` is asked before being semi-outdoor.** A space can be both — an outdoor terrace that also carries an `air:1` boundary to another outside space derives as semi-outdoor too — and of the two facts the declared one is what the space is.

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
