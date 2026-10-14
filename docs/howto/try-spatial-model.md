---
title: Try the spatial model prototype
mode: howto
---

# Try the spatial model prototype

This repository experiment lets a spatial allocation stand on its own. It accepts grid, level
and space declarations without physical boundaries, ceiling heights or slab thicknesses. It
returns area, adjacency and overlap in plan across levels, and draws the space allocation.

It runs from a repository checkout with dependencies installed. It is not an npm API or a new
accepted Muro language version.

## Write and save a spatial entry

Use a `.spatial` file whose first non-comment declaration is `mode spatial`. The rest uses Muro
notation. This example is the experimental input format, not a normal `.muro` file:

```text
mode spatial
muro 1.5
grid X 0 4000 8000
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 uid:space-a
space /L1/b room X2..X3 Y1..Y2 uid:space-b
```

The normal Muro parser rejects the marker. Reopening this source as ordinary Muro therefore
cannot silently turn its unresolved boundaries into default walls. The spatial entry may import
ordinary `.muro` layers. The entry declares the Muro version; imported layers do not.

## Inspect and draw

The bundled study has two levels. Select one explicitly when drawing:

```sh
npm run spatial -- check experiments/spatial-model/examples/layout.spatial
npm run spatial -- json experiments/spatial-model/examples/layout.spatial -o out/spatial-model/layout.json
npm run spatial -- plan experiments/spatial-model/examples/layout.spatial -l L1 -o out/spatial-model/layout.svg
```

The commands read source files and do not rewrite them. JSON is a report tagged
`koyu-spatial-prototype`; keep the source files to continue editing. `check` and `json` exit 1
when structural diagnostics contain errors. Invalid syntax, unsupported inputs and command usage
errors exit 2. `plan` refuses an invalid model.

The diagram shows space regions and area. Dashed lines identify unresolved boundary segments;
solid lines identify declared relations. These lines do not depict physical walls or opening
geometry. The report keeps grid coordinates in millimetres and areas in square metres.

## Add boundary decisions

The second entry imports the same spaces and adds an open relation and a wall with a door:

```sh
npm run spatial -- check experiments/spatial-model/examples/partial.spatial
npm run spatial -- plan experiments/spatial-model/examples/partial.spatial -l L1 -o out/spatial-model/partial.svg
```

The space paths, UIDs and regions stay the same. Only the declared segments become resolved.
The rest remain unresolved, including unnamed exterior segments. A declared wall without a door
has blocked passage; an open relation or a wall with a door has passage according to the written
declaration. Invalid models report passage as unknown.

## What the result establishes

`consistent` means the spatial declarations pass the applicable structural checks. Overlaps,
missing levels, invalid references and invalid written attributes remain errors. Missing ceiling
height (`SUF01`) and slab thickness (`SUF03`) do not prevent this spatial projection. Height is
reported only when it is known; the prototype never chooses one.

Geometric adjacency does not establish circulation. Overlap across levels does not establish a
stair, a void or another vertical connection. Circulation, daylight and egress assessments are
always `not-evaluated`. Areas are space allocations, not a certified gross or legal floor-area
calculation. Diagonal `line` declarations are explicitly unsupported in this prototype.

The experiment does not change [ordinary boundary defaults](../reference/muro/defaults.md),
[canonical JSON](../reference/json/index.md), or the [meaning of a normal check](../reference/scope.md).
