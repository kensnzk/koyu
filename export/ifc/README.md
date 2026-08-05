# export/ifc — writing a koyu building out as IFC4

```sh
node export/ifc/bin/koyu-form.mjs examples/two-rooms.muro > out/two-rooms.form.json
python -m koyu_ifc.export out/two-rooms.form.json out/two-rooms.ifc
```

**This is not part of the npm package.** `package.json` lists what ships as an allowlist
(`dist`, `src`, `examples`, `editors`, `NOTICE`), so nothing here reaches the registry, and
`ifcopenshell` never becomes a dependency of koyu. koyu's own promise of zero runtime
dependencies is untouched.

## Two inputs, joined by path

The Node step writes one JSON document holding both, because neither half is enough on its own.

| | Holds | Does not hold |
|---|---|---|
| **Form** (`derive`) | outlines, wall segments and thicknesses, opening centres, z ranges, slabs | attributes, `uid`, and any space declaring `outside:1` |
| **canonical JSON** (`toCanonical`) | names, `uid`, attributes, the geodetic frame | any coordinate at all |

**Imports come from `dist/`, never `src/`.** The export runs against what is actually published,
which puts the build inside the test and keeps the public surface exercised by its most demanding
consumer. `test/domains.test.ts` holds that by machine.

## What comes out

| koyu | IFC4 |
|---|---|
| `level` | `IfcBuildingStorey` |
| space with a region | `IfcSpace`, extruded from its outline |
| `boundary` of kind `wall` | `IfcWall`, built at full length |
| `boundary` of kind `open` | `IfcVirtualElement` |
| `door` / `window` | `IfcOpeningElement` + `IfcDoor`/`IfcWindow`, joined by `IfcRelVoidsElement` and `IfcRelFillsElement` |
| derived floors, ceilings, roofs | `IfcSlab` |
| `column` | `IfcColumn` |
| **the boundary relation itself** | **`IfcRelSpaceBoundary`** |
| `azimuth` | `TrueNorth` on the representation context |

The last two rows are the point. `IfcRelSpaceBoundary` is the first thing a working export drops —
it is often absent even when `IfcSpace` survives — and koyu holds the relation as a first-class
edge, so it is written rather than inferred.

### The wall is built whole and the opening is cut out of it

`FormBoundary.material.panels` is already divided by the openings, so the panels alone would give
correct geometry. But then there is no `IfcOpeningElement`, and **which wall hosts a door is
nowhere in the file**. So the wall is built at full length and the openings are subtracted.

The panels are not wasted: `test_boolean_result_equals_the_panels` requires the volume left after
the boolean to equal the volume of the panels. The two derivations never met on the way in, so
agreeing on the way out means something.

## Identity

`GlobalId` is derived, not drawn. **The same model gives the same identifiers on any machine, on
every run**, with no state kept on the side — so editing one room leaves every other object's
identifier alone. Where identity comes from is `docs/reference/identity.md`, unchanged: a space
carrying `uid:` keeps its identifier across a rename, and one without it does not.

Each space also carries a `koyu` property set holding its path and uid, so a file leads back to
the source it came from even without the identifiers.

## Tests

None of them reads the file's spelling. Each asks the IFC a question koyu can also answer.

```sh
python -m pytest export/ifc/tests -q
```

| Test | What it holds |
|---|---|
| `test_every_shape_builds` | every representation resolves to a solid through the geometry engine |
| `test_space_area_agrees` | area measured off the built solid equals koyu's figure |
| `test_adjacency_agrees` | the pairs of spaces sharing a boundary are the same on both sides |
| `test_door_count_agrees` | walking door → opening → wall → space boundary gives koyu's door count |
| `test_boolean_result_equals_the_panels` | the wall left after the cut equals koyu's panels |
| `test_identity_is_stable` | exporting twice is identical; one edit moves nothing else; a `uid` survives a rename |

## Not yet

- **`IfcMapConversion` / `IfcProjectedCRS`.** `origin` is read but not yet written out. Placing
  the model on a map needs the meridian convergence, and getting that right needs a projection
  library on this side — see `docs/reference/muro/origin.md` for the formula that must be applied.
- **Stairs and ramps.** `FormRun.solids` is carried in the input and not yet mapped.
- **The site polygon.** `IfcSite` is written without its boundary.
- **Reading IFC back into `.muro`.** Deliberately not attempted.
