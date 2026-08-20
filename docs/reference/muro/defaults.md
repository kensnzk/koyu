---
title: What happens when you write nothing
mode: reference
---

# What happens when you write nothing

**Writing nothing means something.** And it means one of three things.

| Kind of silence | What happens | Example |
|---|---|---|
| **A default applies** | a fixed value or a fixed rule stands in for what was not written | a boundary with no `type:` is a `wall` |
| **Nothing is generated** | no value is invented, and the element is simply not made. The shape is still determinate, just thinner | a level with no `slab:` gets no floor at all (`SUF03`, a warning) |
| **It stops** | information needed for a single determinate shape is missing | with no ceiling height anywhere, `SUF01`, an error |

**No default is ever invented in order to press on.** That is why the same description always yields the same shape — and why **a shape that came out thin is always reported.**

This page is the one table of defaults. How values are written is in [the three tiers of attribute](attributes.md), how positions are spelled in [positions and regions](positions.md), and the compass defaults in [orientation and the a side](orientation.md).

## The smallest file

```muro-warn
muro 1.4
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

**Five lines, and the room already has four walls.**

```text
⚠ …/smallest.muro:line 5: A default wall was derived where /L1/a faces the outside: S 3600mm / E 4000mm / N 3600mm / W 4000mm (15200mm over 4 runs) — write a boundary to say which outside it faces
✔ Consistent — 1 space / 1 boundary (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Nothing was written about the perimeter, so the perimeter is a wall — the plan draws it and the solids build it. **The one boundary counted here is that wall**, and it appears in no machine format because nobody wrote it.

The warning is not about the shape, which is complete. It is about the one thing silence could not supply: **which** outside those four faces look at. Say it and the warning goes.

```muro
muro 1.4
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out
```

## Foundation declarations

| Written nothing | What happens |
|---|---|
| the version line | omitted, the file is read as `1.1` — frozen, not the newest. Write `muro 1.4` to opt into current semantics → [the version line](version.md) |
| `unit mm` | mm. v0 has no other unit |
| `name` | the building has no name |
| `grid X` / `grid Y` | **no grid reference can be written at all.** Any line with a region stops with `Undefined grid line name` |
| `level` | a space with a region has no determinable level — `SUF02` (error) |
| `h:` on a level | unless the space carries its own `h:`, the ceiling height is undetermined — `SUF01` (error). Neither ceiling nor roof can be generated |
| `slab:` on a level | **not one floor is generated on that storey.** `SUF03` (a warning) — the shape is determinate, so it does not stop |
| `underground:` on a level | treated as above ground. It is never inferred from a negative z |
| `pitch:` on a level | required on a range declaration (`L4..L10`); it cannot be written on a single level |

## space

| Written nothing | What happens |
|---|---|
| a region | the space has no region. It appears in no area, carries no column and no floor — which is exactly right for an `exterior` or an aggregation-only space |
| `level:` | the first path segment, if it names a level. If it does not match, `SUF02` (error) |
| `h:` | the level's `h:`. With neither, `SUF01` (error) |
| `daylight:` | **out of scope for the daylight question.** It is never inferred from the type — neither `room` nor `ldk` puts a space in scope |
| `ceiling:` | a ceiling is derived as the outline of the room × its ceiling height. `ceiling:0` builds none |
| a namespaced key (`lease.category:`, `fire.compartment:`, …) | the value of the deepest zone ancestor carrying that key. With none there either, the space is in no grouping for it — [`stats --by`](../cli/stats.md) totals it under `(unspecified)` rather than dropping it |
| `road:` | not a road. It contributes no width to frontage |
| `uid:` | the path is the identity. Rename it and the correspondence is cut |
| `stair:` `ramp:` `escalator:` `lift:` | not a vertical circulation. Just a space |
| `floor:` `spec:` | there is simply no value to carry |

## boundary

**The default between touching spaces is a wall.**

| Written nothing | What happens |
|---|---|
| a `boundary` for a touching pair on one level | **a `wall` boundary is derived.** It carries no door, so it cannot be passed. It does not appear in the machine format |
| a vertical boundary between stacked spaces | **it is a floor.** It cannot be passed. `stair` / `shaft` / `void` are the exceptions, and they are declared |
| a `boundary` to the outside | **a `wall` boundary is derived** on every run of the perimeter that no declared boundary reaches. Its counterpart is the outside itself, spelled `outside`, and it does not appear in the machine format. That a run was left unnamed is [BND08](../diagnostics/bnd.md#bnd08), a warning |
| `type:` | `wall` |
| `t:` | 100 mm for drawing and for solids. An `air:1` boundary defaults to 60 mm, capped at 80 mm |
| `air:` | treated as a thing that blocks |
| `edge:` | **all** of that boundary's segments. To place an opening or a `seg`, the face must resolve to one, or `OPN05` / `SEG05` |
| `h:` (on `air:1`) | a top at 1100 mm |
| `spec:` `fire:` `sound:` | there is simply no value to carry |

**Between two spaces, one declaration on the pair suppresses the derived wall.** That holds even if the declaration named a single face with `edge:` — the remaining faces get no derived wall either.

**Against the outside it works by run instead.** The outside is not a pair — it is whatever the rest of the perimeter faces — so there is no pair to suppress. Each declared boundary takes the runs it reaches, and the default takes what is left. Write `edge:S` alone and walls still stand on N, E and W.

## door / window

| Written nothing | What happens |
|---|---|
| `w:` | **an error.** Width is required (the asset may supply it) |
| `at:` | the ratio `0.5` — the middle of the segment. Clamped to fit |
| `hinge:` | the start end of the segment (west on a horizontal one, south on a vertical one). Pinned to the start on a diagonal |
| `swing:` | opens toward `a` if a has a region, otherwise toward `b` |
| `style:` | `hinged` |
| `h:` on a door | it rises from the floor to a head height of 2000 mm |
| `h:` on anything else | 1200 mm tall, with its head at 2000 mm |
| `name:` | it has no name. **Composition can no longer point at it** — there is nothing for `= window W1` to find |
| any door at all | **it cannot be passed.** `check` stays green |

A sill height follows without writing `sill:` — it falls out of aligning the heads. `sill:` is carried, so writing it changes no shape.

## column

| Written nothing | What happens |
|---|---|
| `d:` | the same as the size (a square column) |
| `x:` / `y:` | **every grid line.** One stands at every intersection that falls inside a space on that level (a void or an exterior does not count) |
| `name:` | `drop column` can no longer point at it |

Two columns never stand at one intersection — **the earlier declaration wins.**

## Vertical circulation

Riser count, tread and slope are never written. **What is written is the region and the direction; the rest follows from the storey height.**

| Written nothing | Default |
|---|---|
| `form:` | `straight` (it does not turn back) |
| `turn:` | `R` (turning right at the landing) |
| `entry:` | a boarding floor 1100 mm deep |
| `riser:` | a maximum riser of 180 mm — the number of steps follows from it |
| `tread:` | a target tread of 300 mm — used when the landing is taken as the remainder |
| `landing:` | derived (a minimum of 1100 mm). Write it and the tread becomes the remainder instead |
| `lane:` | 1200 mm per escalator unit — the number of units follows from it |
| `slope:` | no permitted slope was declared, so the slope is not faulted. Only escalators are checked against the usual range, by `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` |

## zone / polygon / band

| Written nothing | What happens |
|---|---|
| `site:` on a zone | it is not a site aggregation and `koyu site` ignores it |
| `area:` on a zone | there is no surveyed figure to reconcile the derived area against |
| `polygon` | the site area is derived from the union of the spaces on the site and the indoor footprint. No site boundary line is drawn |
| `w:rest` in a band | **the band is closed.** The member widths must sum to the extent of the band, or the file stops — the same arithmetic as "part dimensions add up to the overall dimension" on a drawing |

## Constants of derivation

**These are not ledger defaults.** The ledger says what may be written; this table says what is derived when nothing was. **What you write always wins.**

| Constant | Value | What it decides |
|---|---|---|
| Wall thickness | 100 mm | a wall with no `t:`. Split half to each side of the centreline |
| Non-blocking boundary thickness | 60 mm | the `t:` default on `air:1` |
| — its cap | 80 mm | whatever `t:` says, it stops here |
| — its top height | 1100 mm | the `h:` default on `air:1` |
| Head height | 2000 mm | doors rise to it; everything else hangs down from it |
| Height of a non-door opening | 1200 mm | the `h:` default |
| Ceiling face thickness | 30 mm | |
| Roof slab thickness | 200 mm | also how far above the ceiling height the top storey is capped |
| Plan cut plane | FL + 1200 mm | the height at which a plan is cut |
| Maximum riser | 180 mm | the `riser:` default |
| Target tread | 300 mm | the `tread:` default |
| Minimum intermediate landing | 1100 mm | a written `landing:` is raised to it |
| Boarding floor depth | 1100 mm | the `entry:` default |
| Nominal escalator width | 1200 mm | the `lane:` default |
| Step face thickness | 200 mm | solids |
| Landing and inclined slab thickness | 200 mm | |
| Escalator step pitch in plan | 400 mm | |

## Green does not mean "it stands up as a building"

**Because the default between touching spaces is a wall, a two-storey building with no door declared anywhere is completely sealed — and green.**

```muro
muro 1.4
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2900 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
boundary /L2/a /out t:150
```

```text
✔ Consistent — 3 spaces / 2 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Saying that it has no door is a different face (the location prefix is the resolved absolute path; it is elided below).

```text
✖ [koyu.schematic.access.unreachable] …/sealed.muro:line 6: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [koyu.schematic.access.unreachable] …/sealed.muro:line 7: Cannot reach the exterior: /L2/a (no passable boundary leads out — write a door)
Validation — 2 violations / 0 cautions
  koyu.profile.schematic-screen@1 — 2 evaluated / 14 not applicable / 0 indeterminate / 0 error
```

What `check` says goes exactly as far as "what was written does not contradict itself as data". **Never claim it works on the strength of green.**
