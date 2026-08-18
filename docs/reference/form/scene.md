---
title: The scene
mode: reference
---

# The scene

`sceneOf(form)` returns the three-dimensional scene a `Form` describes, **as data**. A viewer turns the nodes into meshes with its own materials, its own lighting and its own idea of what is selected; two viewers showing the same building disagree about all of that and about none of this.

```ts
import { sceneOf } from "@kensnzk/koyu/draw";

const scene = sceneOf(derive(model));
for (const node of scene.nodes) {
  // node.role decides the treatment; node.solid / .line / .mark is the geometry
}
```

## No three.js, and no options

koyu declares no runtime dependency, so a scene graph cannot come out of this package. The constraint turned out to be the right shape: every viewer already wraps the result in its own group, and none of them wants another's materials.

**There are no options either.** Which levels, whether to draw openings, how thick a ground plate is, how far to spread the storeys apart — each is a filter over `scene.nodes` or a transform on the consumer's own group:

```ts
group.position.y = level.z * (spread - 1);        // exploding storeys
scene.nodes.filter((n) => n.level === shown);     // one storey
```

Baking any of them in would stop the scene being a projection of the `Form`, and two viewers would then differ by which options they passed rather than by how they draw.

## The roles

| role | what it is |
|---|---|
| `volume` | the air a space encloses, floor to ceiling |
| `plate` | a space or the site read as a horizontal face (`bottom === top`) |
| `body` | matter — a wall body, a column, a slab, a tread, a ramp, a leaf |
| `edge` | a line, not a body — a boundary's centreline, the site edge |
| `mark` | a seat for a symbol or a word |

A plate is a **face**, not a slab. `Form` derives no thickness for the ground, and inventing one here would be a paper decision made in the wrong place; the consumer extrudes it by however much its drawing wants.

## `level` is a fact about the numbers

Every solid carries `ring`, `bottom` and `top`, one z per vertex. `level` is true when every `bottom` is one number and every `top` is one number — a right prism. It is not a hint about materials: it is what lets a consumer take the cheap extrude path and know when it must stitch a per-vertex buffer instead, which a flight of stairs and a ramp both require.

## A wall body is its footprint

Never its centreline thickened. [A junction is already settled in the body](bodies.md): where two walls meet, one runs through and the other stops at its face, so the body runs past the end of its own centre line or stops short of it. A body node carries **both** — `solid.ring` is the matter and `centre` is the axis — because the axis cannot be recovered from the footprint. A viewer that thickens the centre line puts a handrail beside itself at every corner, and the bundled buildings all contain such bodies.

## The ground is not `levels[0]`

`scene.ground` is the lowest level at or above z 0. A building with a basement otherwise lands its site and its landscaping on the basement.

## Free words are carried, never read

`facts.style`, `facts.name` and `facts.grid` are values the model wrote. koyu carries them and does not interpret them: deciding that a `spec` containing ガラス means a transparent material is a judgement about the meaning of a word, and it belongs to the viewer that makes it.

For getting back to what was written, `written` and `pair` mean exactly what they mean on [a mark](marks.md) — `written.boundary` indexes canonical boundary order, never `model.boundaries`.

## Neighbouring pages

- [Matter](bodies.md) — the bodies the scene is enumerated from
- [The marks of a plan](marks.md) — the same service in two dimensions
- [The section](section.md) — a vertical plane through the same bodies
- [Scope](../scope.md) — why presentation does not freeze
