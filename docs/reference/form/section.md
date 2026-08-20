---
title: The section — classified 2D entities
mode: reference
---

# The section — classified 2D entities

**A section is not a slice either.** Slicing the solids gives you flat pieces at one x and an empty background — and a section drawing is mostly what stands *behind* the plane: the far wall with its windows, the stair beyond the cut. None of that falls out of cutting, and neither does the decision to throw the near half away, which is a choice of viewpoint and has to be an input.

So, as with [the plan](plan.md), what derivation returns is **a classified set of 2D entities**.

```ts
import { derive, sectionForm, elevationForm } from "@kensnzk/koyu/form";

const form = derive(model);
sectionForm(form, { axis: "X", at: 12800, atRef: "X3", look: "W" });
sectionForm(form, { cut: { x1: 0, y1: 0, x2: 12000, y2: 4500 }, atRef: "site cut" });
elevationForm(form, "S");
```

## It reads a Form, and assembles no matter

`sectionForm` takes a `Form` — not a `Model`. Every body it cuts was already raised by [`derive`](index.md), and the constructors it calls to raise the rest (`band`, `columnRect`, `runPrism`) are [the published ones](index.md#constructors-of-matter). So it cannot invent shape, and **"there is one entry point to shape" still holds**: this re-frames what came out of that entry, exactly as the plan does for a horizontal plane.

A section is therefore not a field of `Form`. Every entry of `Form` is total — one plan per level, every space, every boundary — while a cutting plane is chosen by the caller and unbounded. `derive(model)` stays a function of the model alone, byte for byte.

## Entities

```ts
interface SectionEntity {
  class: "cut" | "beyond";
  of: "space" | "boundary" | "opening" | "column" | "slab" | "run";
  ref: string;                 // identity of the subject
  kind?: string;               // what the subject already says it is
  polygon: { u: number; z: number }[];
  depth: number;               // mm behind the plane; 0 for what it cut
}
```

| Class | Meaning |
|---|---|
| `cut` | what the plane crossed |
| `beyond` | what stands behind the plane, seen head-on |

**Two, where a plan has five.** A plan is looked at from above, so it carries what is below the cut, what is above it dropped back down, and the symbols of movement. A section is looked at from the side, and **what stands in front of the plane is not hidden by convention — it is behind the viewer.** So it is not produced at all, and fixing that here is what stops each consumer deciding it separately.

`depth` is how far behind the plane the nearest point of the body stands. **It is a distance, not a draw order**; `Form` holds no draw order, and whether to sort by it, fade by it or ignore it is the drawing's business.

## The plane, and which way it is faced

An axis-parallel plane is named by an axis and a coordinate — `axis:"X"` means the plane `x = at` — and `look` says which way it is faced. A `look` that runs along the plane rather than across it is refused rather than answered.

**The sheet's `u` axis is the viewer's right hand**, `u = d × ẑ`.

| `look` | `u` increases toward |
|---|---|
| `N` (+Y) | +X — facing north, east is on the right |
| `S` (−Y) | −X |
| `E` (+X) | −Y |
| `W` (−X) | +Y |

`u` and `z` are both millimetres in the model's own frame; `u` is not re-origined to the extent, because that would make a coordinate depend on how far away the furthest wing happens to be.

**The default `look` is `W` across an X plane and `N` across a Y one.** The rule behind it is statable rather than conventional: on the default, **`u` is the world coordinate along the cut line**, so a dimension taken off the plan carries into the section without being reversed. Looking the other way mirrors the sheet, which is why it has to be asked for.

An arbitrary vertical plane is named by a directed plan line instead:

```ts
sectionForm(form, {
  cut: { x1: 1000, y1: 2000, x2: 9000, y2: 5000 },
  atRef: "boundary-normal cut",
});
```

The line direction is left-to-right on the sheet. `u = 0` is `(x1,y1)`, positive `u` follows the line toward `(x2,y2)`, and the viewer looks toward the line's left side. The endpoints name an origin, direction and facing; they do not clip the infinite cutting plane. Reversing them therefore mirrors the sheet and selects the other half of the model as `beyond`.

## The geometry is exact

Every body in a `Form` is a prism over a **convex** ring, and muro has no curves and no pitched roofs — a roof is a flat slab and a parapet is an `air:1` rail. So:

- **A convex ring meets the plane in exactly one interval.** The cut is that interval by the body's height. For a directed line, the ring is first expressed in the line's orthonormal frame and then goes through the same intersection operation as an axis cut.
- **The height is read at the crossing**, off the edge the crossing sits on. A per-vertex height means the height is linear along each edge, so reading it there is exact rather than sampled. A ramp cut across its rise comes out level; cut along it, the section leans by the whole rise.
- **The projection of a convex solid is the hull of its projected vertices**, so what stands beyond the plane is exact too, not an outline fitted to it.

Neither a new [derivation constant](constants.md) nor a new tolerance: the plane is compared with a body using `EPS`, the same half-millimetre everything else is compared with.

## Reference geometry on a drawing

`svgSection` accepts `guides`, polylines already expressed in the section's `(u,z)` frame. They are presentation supplied by the caller, not entities in the `Form`. The section renderer owns their placement on the sheet, so a limit, datum or measurement line can be laid over an axis or directed-line section without a consumer reproducing the drawing transform.

```ts
svgSection(model, {
  cut: { x1: 1000, y1: 2000, x2: 9000, y2: 5000 },
  guides: [{ points: [{ u: 0, z: 20000 }, { u: 10000, z: 32500 }], label: "limit" }],
});
```

## A wall arrives with its openings already in it

An elevation of a wall face has the gaps in it before any drawing starts, because [a wall is the run of intervals its openings split it into](bodies.md) — a sill wall below, a head wall above, and no matter between. The leaf itself is then drawn into the gap as its own subject.

**There is no operation that cuts an opening out of a wall face**, which is the same sentence [the plan already owns](plan.md), reaching the face instead of the footprint.

## A space is cut open, and never seen from outside

A space contributes `cut` and never `beyond`: a space is air, and from outside you see the matter that bounds it. Two more spaces produce nothing at all.

- **One with no ceiling height determined** has no volume — [SUF01](../diagnostics/suf.md) already says so as an error.
- **One that is outside or semi-outdoor.** A storey's ceiling height reaches it, so it carries a z range, but no ceiling is derived over it ([Matter](bodies.md)) and there is nothing above it to bound the air. Cutting one would paint a garden as a room.

## An elevation is a section whose plane misses the mass

`elevationForm(form, face)` puts the plane at the extreme of the mass along the line of sight — `face:"S"` is the south elevation, seen from the south, so the viewer looks north. **Nothing can straddle a plane placed there, so `cut` comes back empty by construction** rather than by a branch in the code.

Where exactly the plane goes is free. The projection is orthographic, so moving it further back changes no `u` and no `z` — only the datum `depth` is counted from, and only relative depth is used.

**The elevation plane is axis-parallel**, so a building face that is neither gets the elevation of no face. A caller that needs that face can request a directed-line section at its near edge; `elevationForm` remains the four named elevations.

## The order is inherited, never re-established

Entities come back per subject — spaces, then boundaries, openings, columns, slabs, runs — and within each subject in the order the `Form` array already holds, which is [canonical](index.md) and never declaration order. The section adds no ordering rule of its own, which is the strongest available statement about it.

## What a section does not hold

- **A ground line.** koyu holds no ground level: [`origin elevation:`](../muro/origin.md) is the height of model z 0 in a vertical reference system, and is explicitly not GL. Deriving one would be an invented default, which [promise 3](index.md) forbids. `koyu section` draws a line at z 0 as **a convention of the sheet**, and says so.
- **A `seg`.** [`FormSeg`](index.md) carries no z range, so an uncounted segment cannot be sectioned.
- **The site.** [`FormSite`](index.md) carries no z at all.
- **Anything of appearance** — poché, tone, line weight, the words of an annotation. Those are [the drawing's](../cli/section.md).

## Neighbouring pages

- [Form](index.md) — what `derive` returns
- [The plan](plan.md) — the horizontal plane, and the four things it needs that a cut does not give
- [Matter](bodies.md) — the bodies a plane cuts, and where their openings went
- [koyu section](../cli/section.md) / [koyu elevation](../cli/elevation.md) — turning this set into SVG
- [How plans are generated](../../why/plan-is-not-a-section.md) — why the classification is derivation's
