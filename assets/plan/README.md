# Standard plan component assets

`library.muro` is the asset ledger. Each component declares fixed physical `w:` and `d:`
dimensions and references one original SVG in `svg/`. `catalog.muro` places every ledger entry once
so the complete library can be checked and reviewed on one sheet.

```sh
koyu check assets/plan/catalog.muro
koyu plan assets/plan/catalog.muro -l L1 -o out/component-catalog.svg
```

The artwork uses transparent backgrounds and a shared dark line style. Its `viewBox` ratio matches
the declared physical footprint, so the plan renderer applies one uniform physical scale. Asset
category is classification only and never selects an SVG or placement rule.

All SVG artwork in this directory was created for koyu and is distributed under the package
license. Manufacturer drawings may be used to check physical dimensions and plan arrangement,
but no downloaded CAD geometry is included.
