# ADR-0064: A section is a function of the Form, not a part of it

Date: 2026-08-18 / Status: adopted / Origin: KOYU-316 「断面・立面」 — "the drawing side has to make sections and elevations; the cut is named anywhere on the plan, parallel to X or Y; at the resolution of a schematic design"

Ships in koyu 0.23.0. **The language version does not move**: no word is added, no source reads differently, and no bundled example changes by a byte.

## Context

koyu drew a plan and an axonometric. Between them the two most ordinary drawings were missing.

[ADR-0026](0026-axonometric.md) is where they went. It rejected "build the elevation first" — a stair's steps, a ramp's slope and a roof's reach all overlap in orthographic projection, so the axonometric came first — and it wrote down two things this change is the redemption of: **"an elevation is only a change of projection function, so it can be added later"**, and, as its own 代償2, that openings do not appear as holes in a wall face and that this would be **"needed head-on when elevations arrive, so it gets added there."**

The question that actually had to be decided was not how to cut a prism. It was **where the cutting lives.**

Everything a section needs is already public on `Form`: wall panels with their z ranges and their bodies, slabs, columns, run solids, opening leaves, space volumes, the storey ladder. So a renderer in `src/draw/` could compute one, and **`test/draw.test.ts` would not catch it** — the import ban names the functions that assemble shape, and a section would call none of them.

What forbids it is not a gate. It is [the essay](../why/plan-is-not-a-section.md):

> The essential point is that the classification lives on the form side. "This is a section, this is a projection" is decided by comparing the cut height with a z range — that is derivation's job. Leave it to the drawing side and the comparison thresholds differ per implementation, and the same source yields different drawings.

"Beyond the plane, cut by it, or in front of it" is that same comparison turned on its side, decided with the same tolerance. Left on the paper, every viewer picks its own answer for a wall lying in the plane. So: core. **It is worth recording that this is the one law here no machine holds** — a person reading the essay is the whole enforcement.

## Decision

**1. `sectionForm(form, spec)` and `elevationForm(form, face)`, in `src/core/section.ts`, exported from `@kensnzk/koyu/form`.**

They take a `Form` — not a `Model`. Every body they cut was raised by `derive`, and the constructors they call to raise the rest (`band`, `columnRect`, `runPrism`) are the published ones. **They assemble no matter**, so "there is one entry point to shape" survives intact: this re-frames what came out of that entry, the way `planOf` already does for a horizontal plane.

**2. `Form` gains no field, and `derive` is not touched.**

`Form.plans` is total — one entry per level, its only input a single scalar with a specification-fixed default — and so is every other field. A cutting plane is chosen by the caller and unbounded. Putting it inside `Form` would make the first field that is absent as a function of *the call* rather than of *the model*.

The measurement agrees with the argument. `test/fingerprints.test.ts` hashes `sha256(JSON.stringify(derive(model)))`, so an added `sections: []` moves all fifteen Form hashes, all six `derive` goldens and all seven conformance `Form`s — and that file's own header says a hash may only move when "the shape really moved", naming the rule. Nothing here moved a hash.

**3. Two classes: `cut` and `beyond`.**

A plan needs five because it is looked at from above: both sides of the cut are in view. A section is looked at from the side, and what stands in front of the plane is **behind the viewer**, not hidden by convention. It is not produced at all, and putting that rule in derivation is what stops each consumer choosing.

`depth` rides on every entity as a distance in millimetres. It is deliberately **not** a sort: `Form` holds no draw order, so the distance is shape and the stacking is appearance.

**4. The sheet's `u` axis is the viewer's right hand, `u = d × ẑ`.** Facing north, east is on the right.

The default direction of view is `W` across an X plane and `N` across a Y one, chosen by a statable rule rather than by convention: **on the default, `u` is the world coordinate along the cut line**, so a dimension taken off the plan carries into the section unreversed.

**5. The cut is named in the notation's own words.**

[positions.md](../reference/muro/positions.md) opens with "coordinates are never written directly", so `--at X3+450` takes a grid reference, not millimetres. `resolveRef` was private inside `parse.ts`; its grammar is lifted into `model.ts` as `gridRef`, and the parser now wraps it. **One grammar**, so a plane named from outside the source cannot resolve differently from one named inside it.

**6. `crossing` returns the edge and the parameter, not only the coordinate**, and `hull` joins it in `poly.ts`.

Every body in a `Form` is a prism over a convex ring, so it meets a plane in exactly one interval and its projection is the hull of its projected vertices — both exact. The height at a crossing is read off the edge the crossing sits on: a per-vertex height is linear along each edge, so a ramp cut across its rise comes out level and cut along it leans by the whole rise, from one routine with no case analysis. **Neither a new derivation constant nor a new tolerance.**

**7. ADR-0026's 代償2 is paid by doing nothing.**

A wall arrives as the run of intervals its openings split it into, so an elevation of that wall has the gap in it before any drawing starts. There is no operation that cuts one — the same sentence the plan already owns, reaching the face instead of the footprint.

## Alternatives

**`derive(model, { sections })` returning `Form.sections`.** The near miss, and defensible if — and only if — the key were absent rather than empty by default. Rejected on the category: `Form` is what freezes, and a field whose contents are entirely caller-chosen freezes the shape of the entries while promising nothing about any building. It also puts the new code outside the reach of the strongest guard in the tree, since `test/fingerprints.test.ts` hashes the default call.

**Computing the section in `src/draw/`.** Cheapest, and no gate would have stopped it. Rejected by the essay: two consumers, two epsilons, two drawings from one source.

**A `section` declaration in the notation.** Rejected outright. A section is a view of a building, not a fact about it, and [the source holds what has to be written](../reference/not-held.md).

**Deriving a ground line.** Rejected. There is no ground level anywhere in muro — `origin elevation:` is the height of model z 0 in a vertical reference system and its own page says it is not GL, not 地盤面, not 平均地盤面 — and inventing one would break promise 3. The drawing puts a line at z 0 as a convention of the sheet, in the same spirit as the slab `axo` puts under a building, and both reference pages say so. **The owner chose z 0 over a lookup through `underground:`**, which also keeps `FormLevel` unchanged and three more Form hashes still.

**A third class for what stands in front of the plane.** The plan does emit `above` and lets the drawing skip it, so the precedent exists. Rejected on cost: for the bundled `complex` it would carry roughly half of tens of thousands of bodies that nothing will ever draw, and unlike a head wall in plan, a near-side body is not hidden by convention — it is outside the view.

**Two renderers.** Rejected: an elevation is a section whose plane misses the mass, so writing the painter twice would invite the two to drift apart. One renderer, two entry points, and "an elevation cuts nothing" comes out as a consequence of where the plane sits rather than as a branch.

## Consequences and costs

**What was gained.** A section is `koyu section <file> --at X3+450 -o x.svg`, and the loop ADR-0026 built for the axonometric now closes on the drawing architects actually check heights with. It found its own first defect the same way: gardens and yards were being painted as 2400-high rooms, because a storey's ceiling height reaches a semi-outdoor space even though no ceiling is derived over it. That is fixed here, and it is only visible in a picture.

**The drawing is the thinnest of the three.** It performs no geometry at all — every polygon arrives ready — which is the strongest available demonstration that the division holds.

**Cost 1: the depth order is an approximation.** Bodies are painted far to near by a single distance, so two that interpenetrate can swap. It is a weaker approximation than the axonometric's, having one depth axis instead of the sum of three, and interpenetration in section is a contradiction [HGT01/HGT02](../reference/diagnostics/hgt.md) already reports.

**Cost 2: the plane is axis-parallel.** An oblique building face gets the elevation of no face. `koyu axo` is the drawing to reach for, and this is the resolution of a schematic design.

**Cost 3: nothing pins a section of a bundled example.** The Form fingerprints do not reach `sectionForm`, because they hash the default call. `test/section.test.ts` holds the geometry against the notation instead — the numbers there are read off `two-rooms.muro`'s own declarations and the derivation constants, not off the implementation's output.

**Cost 4: `conformance/` gains nothing.** Its four kinds of expectation cannot pin a classified section, and adding a fifth is a change to the contract of the suite. Deliberately deferred.

**Unrelated to the feature, and done in the same change:** the drawings carry the koyu mark instead of a line of credit text, and the 27 committed drawings under `docs/img/` are regenerated. Each differs by exactly one line in and one line out, which is how the mapping from example to image was checked rather than assumed.
