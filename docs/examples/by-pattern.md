---
title: Look it up by what you want to write
mode: reference
---

# Look it up by what you want to write

**This is the index for when you already know what you want to write.** Find the intent on the left, open the example file on the right, and copy the shape. Every bundled example passes `koyu check`, so what you copy works.

The rules of the notation itself are in the [notation reference](../reference/muro/index.md). All this page holds is **where the real thing is**.

## Dividing a plan

| What you want | How to write it | The real thing |
|---|---|---|
| Place rooms | `space <path> <type> X1..X2 Y1..Y2` | `examples/two-rooms.muro` |
| An L-shaped or notched room | Join regions with `+` | `/home/ldk` in `examples/house.muro` |
| A wall between rooms | One `boundary` line. Omit it and a wall still stands — but it cannot be passed | `examples/two-rooms.muro` |
| Hang a door or a window | `door` / `window` indented under a boundary | `examples/two-rooms.muro` |
| Position an opening | `at:0.75` (a ratio) or `at:X2+600` (a grid reference) | `examples/office.muro` / `examples/house/L1.muro` |
| Pick a side for an opening onto the outside | `edge:N` / `edge:E` / `edge:S` / `edge:W` | `examples/two-rooms.muro` |
| Divide by dimension and order rather than position | [`band`](../reference/muro/band.md) plus indented `space` lines | `examples/tower/typical.muro` / `examples/complex/hotel.muro` |
| Cut on a diagonal | [`line`](../reference/muro/line.md) indented under a boundary | `examples/complex/L1.muro` |
| Change a floor finish without dividing the room | [`area`](../reference/muro/area.md) indented under a space | `/L1/hall` in `examples/office.muro` |
| Change the material of part of one wall | [`seg`](../reference/muro/seg.md) indented under a boundary | `examples/office.muro` |
| Keep door and window types in one place | Declare an [`asset`](../reference/muro/asset.md); openings reference it by name | `examples/house/assets.muro` |

## Stacking storeys

| What you want | How to write it | The real thing |
|---|---|---|
| Declare a storey | `level L1 0 h:2400 slab:150` | `examples/two-rooms.muro` |
| Declare an arithmetic run of storeys | `level L3..L9 6700 pitch:2900 h:2400 slab:500` | `examples/mansion.muro` |
| Give the top floor an upper bound | A `level R` that holds no spaces | `examples/office.muro` |
| Write the typical floor once | Begin the path `/L2..L9/` | `examples/mansion.muro` |
| Write an exception floor as a difference | Put only what differs into its own file | `examples/tower/L3.muro` |
| When the storey cannot be read from the path | `level:L1` on the space | `examples/house.muro` |
| Raise the ceiling of one room | `h:6700` on the space | `/L1/hall` in `examples/office.muro` |
| Write a basement | `level B1 -3700 … underground:1` | `examples/basement/main.muro` |
| A plant level absent from the public numbering | An independent `level M1` wedged in | `examples/twin/main.muro` |

## Connecting vertically

**Floors are never written.** Spaces that overlap above and below have a floor by default. Only the exceptions get written.

| What you want | How to write it | The real thing |
|---|---|---|
| Connect with a stair | `boundary /L1/stair /L2/stair type:stair` | `examples/office.muro` |
| A shaft nobody walks | `type:shaft` | `examples/office.muro` |
| Remove the floor (a void) | a `type:void` boundary plus a space declaring `void:1` | `examples/office.muro` |
| Many storeys of circulation at once | [`stack`](../reference/muro/stack.md) `ev L1..L10 type:shaft` | `examples/mansion.muro` |
| Get riser counts and treads out | Write `stair:N form:return` on the space, then ask [`runs`](../reference/cli/runs.md) | `examples/basement/main.muro` |
| A ramp | `ramp:E form:return slope:6` on the space | `examples/basement/main.muro` |
| An escalator | `escalator:N` on the space; the connection is `type:stair` | `examples/complex/L1.muro` |
| A lift | `lift:1` on the space; the connection is `type:shaft` | `examples/basement/main.muro` |
| An atrium through several storeys | `stack atrium L1..L5 type:void` | `examples/complex/main.muro` |
| Express a lift passing a floor | Run the shaft through; place no lobby space | `examples/twin/core.muro` |

## Outside, site and landscape

| What you want | How to write it | The real thing |
|---|---|---|
| Create the outside | `space /out name:外部` (no region needed) | `examples/two-rooms.muro` |
| Split the outside by orientation | Several `exterior` spaces, `/out/n`, `/out/e`, … | `examples/house.muro` |
| A road | `space /road-s exterior road:22000` | `examples/complex/site.muro` |
| A site | `zone /site … site:1`, with the survey figure in `area:` | `examples/house.muro` |
| A site shape | [`polygon`](../reference/muro/polygon.md) `/site x,y x,y …` | `examples/tower/site-geometry.muro` |
| Make gardens and paths real spaces | `exterior` / `yard` / `garden` on L1, tiling around the building | `examples/house/site.muro` |
| A wall or a fence | `spec:ブロック塀 air:1` on the boundary | `examples/house.muro` |
| Make a balcony semi-outdoor | Give it one `air:1` boundary with the outside | `examples/mansion.muro` |
| Get road frontage out | Let spaces under the site meet an exterior carrying `road:` | `examples/tower/site.muro` |

## Folding size

| What you want | How to write it | The real thing |
|---|---|---|
| Many identical storeys | Begin the path `/L7..L13/` | `examples/complex/office.muro` |
| The same layout on two basement levels | `/B2..B1/` | `examples/basement/main.muro` |
| A core from the basement to the top | Nine `space` lines under `/B2..L19/` | `examples/complex/core.muro` |
| A run of guest rooms or tenancies | List widths in a `band` | `examples/complex/hotel.muro` |
| Have the widths reconciled | Use a **closed band** with no `w:rest` | `examples/tower/typical.muro` |
| Stand columns | [`column`](../reference/muro/column.md) `900 B2..L6` (no position written) | `examples/complex/main.muro` |

## Splitting into files

| What you want | How to write it | The real thing |
|---|---|---|
| Divide the work into layers | `import ./L1.muro` from the base layer | `examples/house/main.muro` |
| Know what the base layer holds | `koyu` / `name` / `unit` / `grid` / `level`, plus boundaries that cross storeys | `examples/tower/main.muro` |
| Isolate given geometry | Give the site shape a layer of its own | `examples/tower/site-geometry.muro` |
| See how strong each layer is | [`koyu layers`](../reference/cli/layers.md) | — |
| Override a value from a stronger layer | [`over` / `drop`](../reference/muro/over-drop.md) | Not used in the bundled examples |
| Confirm a single file and a composition agree | [`koyu diff`](../reference/cli/diff.md) | `examples/house.muro` against `examples/house/main.muro` |

## Counting and asking

| What you want to know | Command | The real thing |
|---|---|---|
| Whether the composition is broken | [`check`](../reference/cli/check.md) | Every example |
| Whether anything is architecturally wrong | [`validate`](../reference/cli/validate.md) | Every example |
| Areas and the split by use | [`stats`](../reference/cli/stats.md) | [office](office.md) / [twin](twin.md) |
| How many doors to get outside | [`doors`](../reference/cli/doors.md) | [two-rooms](two-rooms.md) / [mansion](mansion.md) |
| The adjacency as a whole | [`graph`](../reference/cli/graph.md) | [two-rooms](two-rooms.md) |
| The section stack-up | [`levels`](../reference/cli/levels.md) | [office](office.md) / [basement](basement.md) |
| Riser counts, treads, slopes | [`runs`](../reference/cli/runs.md) | [basement](basement.md) / [complex](complex.md) |
| Daylight | [`light`](../reference/cli/light.md) | [mansion](mansion.md) / [tower](tower.md) |
| Site, coverage, floor area ratio, frontage | [`site`](../reference/cli/site.md) | [house](house.md) / [twin](twin.md) |
| A plan drawing | [`plan`](../reference/cli/plan.md) | Every example |
| An axonometric | [`axo`](../reference/cli/axo.md) | [complex](complex.md) / [twin](twin.md) |
| The machine format | [`json`](../reference/cli/json.md) | `examples/two-rooms.canonical.json` |

## If you would rather pick by difficulty

The scale table is in [the bundled buildings](index.md). They build up roughly in the order two-rooms → office → house → basement → mansion → tower → complex → twin.
