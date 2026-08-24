---
title: CMP — area-hosted components
mode: reference
---

# CMP — area-hosted components

All CMP codes are errors.

| Code | Severity | What it says |
|---|---|---|
| CMP01 | error | A component definition or placement cannot be resolved |
| CMP02 | error | The transformed physical footprint leaves its named host area |

## CMP01 — the component definition or placement cannot be resolved {#cmp01}

`error`

```muro-bad
muro 1.5
grid X 0 3000
grid Y 0 3000
level L1 0 h:2600 slab:150
asset WC component w:700 d:1200 plan-svg:wc.svg
space /L1/wc wc X1..X2 Y1..Y2
  area X1+300..X2-300 Y1+300..Y2-300 name:fixture asset:WC
space /out outside:1
boundary /L1/wc /out
```

```text
Component asset WC plan-svg takes a relative path: wc.svg
```

**Cause** — the model cannot derive one fixed component placement. CMP01 covers a component asset
missing `w:`, `d:` or `plan-svg:`; a non-relative SVG reference; a host area with no `name:`; an
undefined asset; an opening asset referenced by an area; a placement attribute written without
`asset:`; and invalid offset or rotation values.

**Fix** — complete the component definition, make `plan-svg:` start with `./` or `../`, and place
it from one named area. Offsets are finite millimetre numbers; rotation is a finite number in
`0 <= rotate < 360`. The ledger reports an invalid `align-x:` or `align-y:` value as
[ATT02](att.md#att02).

This diagnostic does not open the SVG file. Presentation bytes are read by `koyu plan`, not by
the structural consistency check.

## CMP02 — the component footprint leaves its host {#cmp02}

`error`

```muro-bad
muro 1.5
grid X 0 3000
grid Y 0 3000
level L1 0 h:2600 slab:150
asset TABLE component w:1800 d:900 plan-svg:./table.svg
space /L1/room room X1..X2 Y1..Y2
  area X1+500..X1+1500 Y1+500..Y1+1500 name:table-zone asset:TABLE
space /out outside:1
boundary /L1/room /out
```

```text
TABLE extends outside its host area table-zone
```

**Cause** — after alignment, offsets and rotation, at least one corner of the fixed physical
footprint lies outside the host rectangle or the derived region of its parent space.

**Fix** — enlarge or move the named area, change its alignment or offsets, or write the intended
rotation. koyu never shrinks, moves or rotates a component automatically. When one further
90-degree rotation fits, the diagnostic says so as a suggestion; it still does not apply it.

## Related

- [asset](../muro/asset.md) — component dimensions and plan artwork reference
- [area](../muro/area.md) — alignment, offsets, rotation and host identity
- [Area-hosted components](../form/components.md) — the derived footprint
