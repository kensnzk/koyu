---
title: The diagnostic code index
mode: reference
---

# The diagnostic code index

Every message `koyu check` returns, catalogued. There are **65** codes in **19** families: 49 errors and 16 warnings. This page shows which family a code belongs to and how heavy it is. The cause, a minimal reproduction, and the fix live on the family pages.

What `check` tells you stops at **whether what is written is self-consistent as data**. It says nothing about whether the building is usable — that is what `koyu validate` says, separately, with its 16 rules. The two are different types: `check` returns `Diagnostic { code, severity }` and `validate` returns an `AssessmentReport` whose findings carry `{ rule, level }`. Even the spellings differ on sight — a code is three letters plus two digits, a rule is a namespaced id (`koyu.schematic.site.escape`).

**The human-facing `check` does not display codes.** Get the code with `--json` before looking anything up here; the procedure is on [Reading a diagnostic](reading.md).

## There are only two severities

| severity | Meaning | `check` exit code | `check --strict` exit code |
|---|---|---|---|
| `error` | The composition does not stand up; no single shape can be made from what is written | 1 | 1 |
| `warning` | Suspect. It does stand up, and the shape is still determined | 0 | 1 |

Severity is an invariant property of a code. **The same code is never an error in one file and a warning in another.** When the weight has to change, the existing code keeps its severity and a new code is minted.

## Looking up by symptom

| Symptom | Codes to look at |
|---|---|
| You wrote a boundary and were told the spaces "do not touch" | [BND04](bnd.md#bnd04) |
| You placed a door or window and were told "there is more than one segment" | [OPN05](opn.md#opn05) |
| You cannot get a window onto an external wall | [OPN04](opn.md#opn04) [OPN05](opn.md#opn05) |
| You wrote a stair or a void and were told off | [VRT01](vrt.md#vrt01) [VRT02](vrt.md#vrt02) [VRT03](vrt.md#vrt03) |
| You put a door on a stair and were told it "is not interpreted" | [VRT05](vrt.md#vrt05) |
| You laid out spaces and were told "the regions overlap" | [GEO02](geo.md#geo02) |
| The overlap appeared while subdividing a dwelling into rooms | [GEO02](geo.md#geo02) — the fix is not the layout |
| A path on a boundary is reported undefined | [REF01](ref.md#ref01) |
| A floor finish written as an `area` will not pass | [SEG01](seg.md#seg01) [SEG02](seg.md#seg02) |
| You thought you wrote a level and were told "its level cannot be determined" | [SUF02](suf.md) |
| The floor-height arithmetic does not pass | [HGT01](hgt.md) [HGT02](hgt.md) |
| No ceiling height or slab thickness written, and neither ceilings nor floors are generated | [SUF01](suf.md) [SUF03](suf.md) |
| You wrote an attribute and it had no effect | [ATT01](att.md) [ATT02](att.md) [ATT03](att.md) |
| The site's figures do not agree | `check` does not say — `koyu validate`'s `koyu.schematic.site.escape` / `koyu.schematic.site.area` do |
| The stair's going or slope is cramped | `check` does not say — `koyu validate`'s `koyu.schematic.stair.proportion` / `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` do |
| There is a hole in the envelope | `check` does not say — `koyu validate`'s `koyu.schematic.envelope.gap` does |
| The file dies without a single line being read | [SYN01](syn.md) |

## Every code

The order is the ledger's.

### REF — references (1)

| Code | severity | One line |
|---|---|---|
| [REF01](ref.md#ref01) | error | References an undefined space |

### BND — boundaries (6)

| Code | severity | One line |
|---|---|---|
| [BND01](bnd.md#bnd01) | error | A boundary between a space and itself |
| [BND02](bnd.md#bnd02) | error | A duplicate boundary |
| [BND03](bnd.md#bnd03) | error | A wall boundary to a space on a different level |
| [BND04](bnd.md#bnd04) | error | The spaces do not touch, so no boundary can be derived |
| [BND05](bnd.md#bnd05) | warning | Edge-restricted and unrestricted boundaries coexist on one pair |
| [BND06](bnd.md#bnd06) | warning | No edge remains on the perimeter, so the segment is of zero length |

### LVL — levels (1)

| Code | severity | One line |
|---|---|---|
| [LVL01](lvl.md) | error | Two levels have the same z |

### GEO — overlapping regions (2)

| Code | severity | One line |
|---|---|---|
| [GEO01](geo.md#geo01) | error | The regions of one space overlap each other |
| [GEO02](geo.md#geo02) | error | The regions of two spaces overlap |

### VRT — vertical boundaries (6)

| Code | severity | One line |
|---|---|---|
| [VRT01](vrt.md#vrt01) | error | A vertical boundary needs a region and a level on both sides |
| [VRT02](vrt.md#vrt02) | error | A vertical boundary spans one step between adjacent levels |
| [VRT03](vrt.md#vrt03) | error | The spaces of a vertical boundary do not overlap in plan |
| [VRT04](vrt.md#vrt04) | warning | The space above a void boundary is not `type:void` |
| [VRT05](vrt.md#vrt05) | warning | An opening on a vertical boundary is not interpreted |
| [VRT06](vrt.md#vrt06) | warning | A `seg` on a vertical boundary is not interpreted |

### OPN — openings (8)

| Code | severity | One line |
|---|---|---|
| [OPN01](opn.md#opn01) | error | The wrong axis for `hinge` |
| [OPN02](opn.md#opn02) | error | The openings overlap |
| [OPN03](opn.md#opn03) | warning | An opening on an open boundary has no effect on passage |
| [OPN04](opn.md#opn04) | error | There is no boundary segment on which to place the opening |
| [OPN05](opn.md#opn05) | error | There is more than one boundary segment — ambiguous |
| [OPN06](opn.md#opn06) | error | The opening is wider than the boundary segment |
| [OPN07](opn.md#opn07) | error | The wrong axis for an explicit opening position |
| [OPN08](opn.md#opn08) | error | An explicit opening position runs off the segment |

### SEG — uncounted subdivisions (8)

`area` (inside a room) is SEG01–SEG02; `seg` (along a boundary) is SEG03–SEG08.

| Code | severity | One line |
|---|---|---|
| [SEG01](seg.md#seg01) | error | An `area` on a space with no region |
| [SEG02](seg.md#seg02) | warning | An `area` spills outside the region |
| [SEG03](seg.md#seg03) | warning | A `seg` on an open boundary is not interpreted |
| [SEG04](seg.md#seg04) | error | There is no boundary segment on which to place the `seg` |
| [SEG05](seg.md#seg05) | error | There is more than one boundary segment for the `seg` — ambiguous |
| [SEG06](seg.md#seg06) | error | The `seg` is wider than the boundary segment |
| [SEG07](seg.md#seg07) | error | The wrong axis for an explicit `seg` position |
| [SEG08](seg.md#seg08) | error | An explicit `seg` position runs off the segment |

### ZON — zones (2)

| Code | severity | One line |
|---|---|---|
| [ZON01](zon.md) | warning | There are no spaces beneath the zone |
| [ZON02](zon.md) | warning | A space shares its path with a zone |

### HGT — the height invariant (2)

| Code | severity | One line |
|---|---|---|
| [HGT01](hgt.md) | error | It collides into the floor above |
| [HGT02](hgt.md) | error | Insufficient coverage for a partial void |

### SUF — sufficiency (4)

| Code | severity | One line |
|---|---|---|
| [SUF01](suf.md) | error | The ceiling height cannot be determined; no ceiling and no roof can be generated |
| [SUF02](suf.md) | error | The level cannot be determined; not one solid can be generated |
| [SUF03](suf.md) | warning | The level has no `slab`, so not one floor is generated |
| [SUF04](suf.md) | warning | A vertical-circulation declaration produces no shape at all |

### SIT — site outline (3)

| Code | severity | One line |
|---|---|---|
| [SIT01](sit.md) | error | The site shape has a duplicate vertex |
| [SIT02](sit.md) | error | The site shape is self-intersecting |
| [SIT04](sit.md) | warning | No zone corresponds to the `polygon` |

SIT03 and SIT05 are [retired numbers](retired.md).

### UID — identity (4)

| Code | severity | One line |
|---|---|---|
| [UID01](uid.md) | error | A `uid` cannot be a token of digits alone |
| [UID02](uid.md) | error | A `uid` cannot contain whitespace |
| [UID03](uid.md) | error | A duplicate `uid` |
| [UID04](uid.md) | error | A duplicate `name` within one container |

### ATT — attributes (3)

| Code | severity | One line |
|---|---|---|
| [ATT01](att.md) | error | The attribute takes a positive number |
| [ATT02](att.md) | error | The value is not in the ledger's vocabulary |
| [ATT03](att.md) | error | The key is not in the ledger and carries no namespace |

### DAY — daylight scope (1)

| Code | severity | One line |
|---|---|---|
| [DAY01](day.md) | error | `daylight` is either 1 (in scope) or 0 (out of scope) |

### RUN — vertical circulation (4)

| Code | severity | One line |
|---|---|---|
| [RUN01](run.md) | error | More than one vertical-circulation declaration on one space |
| [RUN02](run.md) | error | The value must be a direction of travel, N/E/S/W |
| [RUN03](run.md) | error | The region is not a single rectangle, or the level is unknown |
| [RUN05](run.md) | error | `form` is invalid, or the shape is not determined |

RUN04, RUN06, RUN07 and RUN08 are [retired numbers](retired.md).

### LIN — drawn lines (3)

| Code | severity | One line |
|---|---|---|
| [LIN01](lin.md) | error | The line does not separate the two spaces |
| [LIN02](lin.md) | error | A vertical boundary cannot carry a line |
| [LIN03](lin.md) | warning | The line cuts nothing |

### COL — columns (2)

| Code | severity | One line |
|---|---|---|
| [COL01](col.md) | warning | Not one column stands for this declaration |
| [COL02](col.md) | warning | An earlier declaration already took the same intersections |

### VER — language-version acceptance (4)

| Code | severity | One line |
|---|---|---|
| [VER01](ver.md) | error | A koyu 0.1 file has a touching pair with no boundary declared |
| [VER02](ver.md) | error | A koyu 0.3-or-earlier file has a habitable type with no `daylight` |
| [VER03](ver.md) | error | A koyu 0.4-or-earlier file uses 0.5 vocabulary |
| [VER04](ver.md) | error | A koyu 0.5-or-earlier file uses 1.0 vocabulary |
| [VER05](ver.md) | error | A koyu 1.0-or-earlier file writes exterior / void in the type position |

### SYN — syntax and composition (1)

| Code | severity | One line |
|---|---|---|
| [SYN01](syn.md) | error | A syntax or composition error |

SYN01 is not a check of its own but the exception thrown while reading, copied into a single diagnostic. **It appears only under `check --json`** — without `--json`, `check` prints the exception as it is and exits 1.

## Retired numbers

**Numbers are never reused.** Reusing one would make past output unreadable. Eleven are retired: six moved to `koyu validate` rules and four folded into the SUF family. What replaced what is on [Retired diagnostic codes](retired.md).

`BND07` `HGT03` `HGT04` `HGT05` `RUN04` `ENV01` `RUN06` `RUN07` `RUN08` `SIT03` `SIT05`

## What a green check has not looked at

**Green means the composition is self-consistent as data and a shape can be made from what is written.** It says nothing about architectural validity. Two things in particular walk straight through it.

**A sealed building.** The default between touching spaces is a wall, and a wall is impassable without a door. A two-storey house with not one door written is green and completely sealed.

```sh
koyu doors <file> /L2/bed /out/road
```

If that answers "unreachable", the circulation is not connected. `koyu validate`'s `koyu.schematic.access.unreachable` says the same thing as a violation.

**Daylight.** Not one window is needed to be green. `koyu light <file>` gives the 1/7 judgement per room, and `koyu validate`'s `koyu.schematic.daylight.ratio` reports it as a violation.

How to call `check` and its flags is on [koyu check](../cli/check.md); the validation surface is on [koyu validate](../cli/validate.md).
