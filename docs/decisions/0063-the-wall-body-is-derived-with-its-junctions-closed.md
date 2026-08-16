# ADR-0063: The wall body is derived with its junctions closed, and it is carried in `Form`

- Status: adopted
- Date: 2026-08-16
- Ships in: koyu 0.22.0. The language version does not move

## Context

A boundary segment is a centre line, and a wall was raised from it by `thicken` — the centre line
offset by ±t/2 along its normal. Each wall therefore stopped at its own end, and two walls meeting
at a right angle left the square of t/2 by t/2 outside the point they shared belonging to neither
of them.

The holes were counted before anything was changed, by sampling the centre of that square at every
junction of every bundled building and asking whether any wall covered it.

```text
examples/two-rooms.muro        4 open corners   (the four corners of the building)
examples/office.muro           9
examples/house/main.muro      13
examples/basement/main.muro   17
examples/mansion.muro         85
examples/complex/main.muro   206
```

Every one of those is green under `check`, which is correct: nothing about them is
self-contradictory as data ([scope](../reference/scope.md)). The defect is in the derivation, and
it reached the plan, the axonometric and every outside viewer at once, because all of them draw
`Form` and `Form` said the wall ended there.

**The repair does not belong on the drawing side.** A consumer that closed the corner itself would
be inventing shape on paper, which [stability](../reference/stability.md) forbids in the sentence
"two `Form`s out of one composition is a defect; two SVGs out of one `Form` is not" — and it would
have to be invented again, identically, in every consumer. `test/draw.test.ts` holds the drawing
side to exactly that.

**Nor does it belong in the notation.** A unary boundary, or a `join:` attribute, would ask the
author to write down something the model already determines: which walls meet at a point is a fact
about the centre lines, and the answer must not depend on anyone remembering to write it.

## Decision

**`derive` settles the junctions, and every interval of a wall carries its body.**

`FormPanel` gains `footprint: Pt[]` — the body of that interval with the junctions at both of its
ends already resolved. `FormBoundary.segment` and the interval's own `x1,y1,x2,y2` are untouched:
the junction moves matter, not relations.

**Nothing is merged.** A wall stays one body per interval, with its own `ref`, its own thickness
and its own z range. What the junction decides is which of the walls meeting at a point runs
through it:

> The winner runs through, and every wall that ends at the node is cut back to the winner's face.

The election is a total order, so one model gives one shape ([promise 1](../reference/form/index.md)):
a wall that does not end at the node beats one that does; then the thicker wall wins; then the
centre line first in ascending coordinate order. Nothing in it reads declaration order or which
boundary a segment came from, and the same three rules answer a corner, a T and a cross.

The winner runs on past the node just far enough that its face carries the whole cut edge of every
wall stopping against it. Two walls running along each other are not a junction — they butt, and
neither moves.

The rule is written out on [Matter](../reference/form/bodies.md).

## Alternatives

**Merge the walls at a junction into one body.** Rejected, and it is the alternative the issue
that raised this asked to be excluded. A merged body has no `ref`: identity in `Form` is the
relation the matter came from (`<a>|<b>@<i>`), one body spanning two relations belongs to neither,
and the intervals an opening splits a wall into are per-wall. The IFC export maps one wall element
per segment for the same reason. Closing a corner and merging two objects are different operations
that happen to look alike on paper.

**Mitre every junction instead of electing a winner.** Both walls stop on the bisector, which is
what a drafting program does by default. Rejected for now because it decides nothing the winner
rule does not, and it decides it worse where the thicknesses differ: a mitre between a 200mm wall
and a 100mm wall leaves a step on both faces, while a butt joint against the thicker wall is what
gets built. The winner rule also states which wall is continuous, which is the thing a later
question about structure would want to read.

**Raise the body with a constructor, as [ADR-0058](0058-the-constructors-of-matter-are-public.md)
decided.** That ADR rejected putting wall quadrilaterals into `Form` on the grounds that "the
present design — centre lines plus thickness, with matter raised on demand — costs nothing to a
consumer that wants adjacency, areas or a difference rather than shape". **That reasoning holds
only while the body is a function of its own centre line and thickness, and the junction is
exactly the case where it is not.** A constructor is given one segment; a junction is a fact about
every wall on the level. So this reverses that part of ADR-0058 for walls, and for walls only:
`thicken`, `bandLine`, `band`, `columnRect` and `runPrism` stay exported and unchanged, and a
column section or an opening leaf is still raised on demand.

## Consequences and costs

**`Form` moved, and the canonical form did not.** `test/fingerprints.test.ts` records the
measurement: fourteen of the fifteen bundled entries moved their `Form` hash, none moved a
canonical hash, and the one that held is `examples/steps/01-one-room.muro`, which writes no
boundary and so has no wall to join. That pair — the shape moving while the reading of the source
stands still — is what says this is the derivation and not the language.

**The language version does not move.** No source text is read differently, there is no migration
an author could write, and there is no spelling to retire. The derivation rules are a surface of
their own on [stability](../reference/stability.md), and koyu is still 0.x.

**`Form` grows by a polygon per interval.** For `examples/twin` that is some thousands of
quadrilaterals of four points each. The JSON is bigger; nothing else pays.

**The join does not reach the IFC export.** It builds a wall by extruding the segment and cuts the
openings out with a boolean, on its own toolchain, and its agreement test compares volumes against
the intervals' centre lines. Both are unchanged, so it keeps passing and keeps producing walls
that stop at their own ends. Carrying the join into IFC is a separate change.

**A near-parallel junction extends a long way.** Where two walls meet at a shallow angle the
corner really is a long sliver, and the winner really does have to run its whole length to cover
it. Nothing caps that, because a cap would leave the sliver open and call the junction closed. No
bundled building has one: every junction in them is a right angle or a butt.

**Regenerating `docs/img/` is a manual step.** The committed plans are generated output that no
gate compares against the processor, and four of them do not come from a bundled example as-is.
`docs/checklists.md` now names them, which is the only thing that keeps them from rotting.
