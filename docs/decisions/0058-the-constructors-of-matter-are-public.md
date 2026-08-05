# ADR-0058: The constructors of matter go on the public surface

- Status: accepted
- Date: 2026-08-05
- Subject: `thicken` / `bandLine` / `band` / `columnRect` / `runPrism` and `FormPrism`, on `@kensnzk/koyu/form`

## Context

`Form` holds a wall as a centre line, a thickness and a z range. It does not hold the wall's four
corners. Turning `(3600,0)-(3600,4500)` with a thickness of 120 into the corners `(3540,0)`
`(3540,4500)` `(3660,4500)` `(3660,0)` is what `thicken` does, and koyu's own SVG drawing calls it.

`docs/reference/form/index.md` lists five such functions — `thicken`, `bandLine`, `band`,
`columnRect`, `runPrism` — and states why they exist: raising matter from centre lines is part of
the derivation, so there is one implementation of it, and a consumer that writes its own can
disagree with koyu about where the wall is.

**None of the five was exported.** `import { thicken } from "@kensnzk/koyu/form"` failed, and
`test/public-api-subpaths.test.ts` listed all five as names that must not appear on that surface.
The page described an API the package did not have.

This came out when the first serious consumer arrived. Writing a koyu building as IFC needs the
corners of every wall, the band of every opening, the section of every column and the prism of
every stair tread. With none of them importable, three had been written again in Python before the
contradiction was noticed — two implementations of the same calculation, one in TypeScript and one
in Python, either of which could round or sign differently. The same `.muro` file would then put a
wall in one place in koyu's drawing and in another place in the IFC.

## Decision

**1. Export the five constructors and `FormPrism` from `@kensnzk/koyu/form`.** The page is right,
so the surface moves to meet it rather than the page being cut down to match. The change is
additive and breaks no existing promise.

**2. A consumer holds no geometry rule.** That is what the export buys. The IFC exporter now
receives outlines koyu's own constructors produced and decides only which IFC entities exist and
how they relate. There is no longer anywhere in it to write "a wall is measured from its centre
line".

**3. Do not build the machinery that would have caught this, yet.** The drift was possible because
`test/docs-ledger.test.ts` binds the names in `src/index.ts` to the documentation and does not
bind the twelve subpaths. Building that ledger is its own change. A second drift of the same kind
is the signal to build it; one occurrence is an accident, two is a missing mechanism.

## Alternatives

**Delete the section from the page.** Treat the implementation as correct and state that consumers
write their own. Rejected because it weakens what `Form` promises: `docs/reference/stability.md`
says two `Form`s from one composition is a defect, and if shape may diverge after `Form` then that
promise stops at the package boundary rather than at the model.

**Have `derive` return the raised matter.** Put wall quadrilaterals and column sections into
`Form` itself. Rejected because `Form` grows, and because the present design — centre lines plus
thickness, with matter raised on demand — costs nothing to a consumer that wants adjacency, areas
or a difference rather than shape. Exporting the constructors as functions shares the rules while
keeping that design.

## Consequences and costs

The IFC exporter contains no geometry rule. Two implementations of "where is the face of this
wall" have become one again.

The cost is five more signatures that cannot change. `thicken(x1, y1, x2, y2, t)` takes bare
numbers where a later design might prefer a `Segment`; changing it would mean adding a name rather
than editing this one.

The subpath names remain unbound to the documentation by machine. What this episode showed is that
a published page promising something the package does not have is invisible until a consumer needs
it. The IFC export found it on the first attempt because it lives in this repository; from a
separate repository the same gap would have cost a release to close.
