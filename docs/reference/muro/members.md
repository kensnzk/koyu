---
title: Beams and foundations
mode: reference
---

# Beams and foundations

A beam spans two grid-relative points. Its top elevation is measured in millimetres from the named level. Omitting `top:` aligns its top with the level datum. `w:` measures across the span, and `d:` measures down from the top. The ends are square to the span, including a diagonal span.

```muro-part
beam /frame/b1 level:L2 from:X1,Y1 to:X2+150,Y2-75 w:400 d:700 top:0
```

A foundation uses the same level and top convention. `t:` measures down from the top surface. A negative top locates the entire body below the reference level.

```muro-part
foundation /substructure/p1 level:L1 type:pad at:X2+150,Y2-75 w:1800 d:2000 t:700 top:-600
foundation /substructure/s1 level:L1 type:strip from:X1,Y1 to:X2,Y2 w:1200 t:600 top:-500
foundation /substructure/m1 level:L1 type:mat t:500 top:-600
  outline X1,Y1 X3,Y1 X3,Y2 X1,Y2
```

| Foundation type | Plan extent |
|---|---|
| `pad` | Rectangle at the declared centre, with X width `w:` and Y depth `d:` |
| `strip` | Rectangle following the line between the declared endpoints, with perpendicular width `w:` |
| `mat` | One simple polygon of grid-relative vertices. A concave perimeter can follow a re-entrant corner. Closing the polygon is implicit. |

Each declaration has a unique path within its kind. Use `drop beam /frame/b1` or `drop foundation /substructure/p1` in a stronger layer to remove that member.

`derive(model).beams` and `.foundations` carry the plan outline, world top and bottom elevations, projected area in m² and individual gross volume in m³. These quantities include any physical intersections with adjacent members. Storey floor area still measures spaces. An occupied pit, its slab and a foundation can be described independently.

- [Column arrays and explicit centres](column.md)
- [Grid-relative positions](positions.md)
- [Derived geometry](../form/index.md)
