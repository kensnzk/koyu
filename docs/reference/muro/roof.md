---
title: roof — roofs and canopies
mode: reference
---

# Roofs and canopies

A roof has a path and a reference storey. Its perimeter follows grid lines and offsets. Its heights are in millimetres above that storey's datum. The same declaration can cover the building, a lower wing or an entrance beyond the building footprint. Available from Muro 1.7.

```muro-part
roof /roof/entrance level:L1 type:shed eave-z:2850 rise:+Y slope:1/20 t:120
  outline X2,Y1-1200 X3,Y1-1200 X3,Y1 X2,Y1
```

This canopy rises 60 mm over its 1,200 mm horizontal run. Its top reaches 2,910 mm above L1. Its bottom is 120 mm vertically below the top. Omitting `t` describes a top surface alone.

## Plan outline and heights

An `outline` child traces the outer eave projection as one simple polygon. A `hole` child removes a simple polygon from it, such as an open courtyard. Write each vertex once, in perimeter order. A roof with only an outline contributes its horizontal area and can be drawn in plan.

| Roof type | Geometry |
|---|---|
| `flat` | Horizontal top at `eave-z`. |
| `shed` | One plane rising in the signed dimension direction named by `rise`. |
| `gable` | Two equal pitches on a rectangular footprint. `ridge-axis` selects the direction parallel to the ridge and the pair of opposite eaves. |
| `hip` | Equal pitches up from the perimeter of a convex footprint. The intersections of adjacent planes define the hips and ridge. |

A pitched roof takes a positive `slope` (rise/run, as a decimal or ratio). Choose `eave-z` or `high-z` as the fixed height. Giving both heights instead determines the slope. A `high-z` value is the elevation of the highest point of the roof. Flat roofs use one height. For compound pitched outlines, differing eave heights or asymmetric ridges, write the roof faces directly.

`X` and `Y` denote world directions. Muro 1.8 also accepts either dimension direction of a [declared frame](grid.md#rotated-orthogonal-frames). For a wing on AB, `ridge-axis:A` places the ridge parallel to increasing A. A shed with `rise:+B` rises towards increasing B and has constant height across A. Editing the frame angle rotates its roof faces. If a specified gable direction is incompatible with the footprint, the outline retains its projection while `modeledProjectionM2` is zero.

## Surveyed panels

```muro-part
roof /roof/wing level:L2
  outline X1,Y1 X3,Y1 X3,Y2 X1,Y2
  face X1,Y1,2800 X2,Y1,3750 X2,Y2,3750 X1,Y2,2800
```

Each `face` child gives a planar top panel, as grid-relative X, grid-relative Y and storey-relative Z. Panels may cover only part of the outline. Without an outline, their combined projection defines the extent. Panels of one roof have disjoint interiors in projection. Write separate roof paths when two surfaces lie over each other. A type may label the surveyed panels. The heights and slope are carried by the vertices.

## Early design

```muro-part
roof /roof/main level:L2 type:gable
```

In building mode a roof sketch follows the storey's exposed footprint when no perimeter was written. The eave follows the next datum or the derived storey top when available. A sketch of a pitched roof can use a working slope of 1/4. When the written outline or the spaces contributing its exposed footprint share one rotated frame, its two dimension directions supply the sketch axes. A footprint spanning several frames uses X and Y unless a direction is given. A rectangular gable's ridge follows the longer axis (the first on a square). A shed rises in the positive second direction unless directed otherwise. A written height, slope, axis or perimeter controls the corresponding part of the geometry. These working values appear in `Form.roofs[].assumptions`; saving the source preserves only the authored parameters.

In spatial mode only the traced outline and supported top faces are derived by default. `derive(model, {roofSketches:true})` enables the same design assumptions for either mode. With `roofSketches:false`, the perimeter and faces supported by explicit data remain available, including partial panels.

## Derived quantities

Each roof in [Form](../form/index.md) has the outer projection as convex pieces excluding holes (`outline`), `faces` with absolute XYZ top vertices, and vertical `thickness`. `projectedAreaM2` gives the complete known projection, `modeledProjectionM2` gives the projection of the available faces, and `surfaceAreaM2` gives their actual sloping area when faces are available. Overlapping roofs on different heights have individual quantities. Roofs add no floor area or rooms.

On its reference storey a declared roof replaces the inferred roof inside its perimeter, including the openings it specifies. Where a horizontal roof of specified thickness exactly coincides with a floor layer, the explicit roof carries their common solid; the space retains its floor area.
