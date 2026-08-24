---
title: Area-hosted components
mode: reference
---

# Area-hosted components

A named [`area`](../muro/area.md) that references a `component` asset produces one
`FormComponent`.

```ts
interface FormComponent {
  space: string;
  area: string;
  asset: string;
  level: string;
  centre: Pt;
  w: number;
  d: number;
  rotation: number;
  footprint: Pt[];
}
```

`space` and `area` identify the host. `asset` identifies the reusable definition. `w` and `d`
are the definition's fixed physical dimensions in millimetres. `centre`, `rotation` and
`footprint` are the resolved placement in model coordinates. Rotation is degrees
counter-clockwise from +X, and the footprint runs counter-clockwise.

The host's alignment and offsets are already resolved. A consumer does not read the source area
again to place the component.

`FormComponent` contains no SVG bytes, SVG path, category, colour or line style. The footprint is
physical plan geometry; the artwork is presentation. [`svgPlan`](../cli/plan.md) joins them only
while drawing, using the asset name as the key.

`Form.components` is omitted when a model places no components. This preserves the exact Form of
older inputs that do not use the feature. When present, entries follow canonical space order and
canonical area identity order, never declaration order.

The current component contract is plan-only. It has no height, vertical position, section symbol
or elevation symbol, so a plan SVG is never reused as an inferred section.

## Neighbouring pages

- [Form](index.md) — the whole derived value
- [The plan](plan.md) — classified cut geometry
- [asset](../muro/asset.md) — the reusable definition and SVG reference
- [area](../muro/area.md) — placement in model X/Y
