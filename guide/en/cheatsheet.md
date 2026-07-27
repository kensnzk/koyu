**English** · [日本語](../cheatsheet.md)

# Cheat sheet — every construct on one page

An index for remembering how something is written. **The norms are held by spec/** — each section heading jumps to the section of the specification that owns that fact. To learn in order, [start.md](start.md); to look up from an error message, [diagnostics.md](diagnostics.md); for worked examples that run, [gallery.md](gallery.md).

The skeleton of the notation ([language.md §1](../../spec/en/language.md)):

| Rule | |
|---|---|
| One line, one statement | `keyword positional… key:value…` |
| Token separator | Whitespace (any amount — align columns freely) |
| Comment | `#` to the end of the line |
| A value containing whitespace | Wrap in `"…"` (unclosed is an error) |
| Indented line | Subordinate to the parent line above (`door`/`window`/`seg` under `boundary`, `area` under `space`, `space` under `band`). One level only; no nesting |
| Attribute value | A number if it has the form `-?\d+(\.\d+)?`, otherwise a string |
| A repeated key on one line | An error (the later one never silently wins) |
| Length unit | mm. A ratio along a segment is 0..1. Areas are output in m² (to wall centerlines) |

## The smallest file

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

The smallest four lines on which `check` is green and `plan` draws a drawing.

| Line | Required? | Why |
|---|---|---|
| `grid X` / `grid Y` | **Required** | Coordinates are never written directly, so without grid lines a region cannot be written. Put them **before** any line that uses them |
| `level L1 0` | Effectively required for a space with a region | Without it `check` stops at a warning, but `plan` dies with `レベルが定義されていません` ("no level is defined") |
| The type of `space` (2nd positional) | **Required** | Omit it and the first region token is read as the type, giving `領域は X?..X? と Y?..Y? の2つで指定します` |
| `koyu 0.5` | Optional | Omitted, the file is read with the newest semantics, 0.4. Write it in files whose meaning you want pinned ([language.md §2](../../spec/en/language.md)) |
| `name …` / `unit mm` | Optional | |
| `h:` / `slab:` | Optional | Omit them with a storey above and you get `レベル L2 に slab が未宣言のため、L1 との高さ検査ができません` |
| `space /out exterior` | Optional | But without it the building has no envelope (see "Defaults" below) |
| `boundary` | Optional | The default between touching spaces is a wall ([language.md §4](../../spec/en/language.md)) |

An empty file also gives `✔ 整合 — 空間 0 / 境界 0`. **Green means "what you wrote is free of contradiction", not "this stands up as a building".**

## Foundation declarations — held once by the base layer ([language.md §2](../../spec/en/language.md))

| How it is written | Meaning |
|---|---|
| `koyu 0.5` | The language version. Base layer (the entry) only, once. `0.1`, `0.2`, `0.3`, `0.4` are accepted |
| `name 街角の複合ビル` | The building name. Takes the rest of the line as its value (whitespace allowed). Once |
| `unit mm` | v0 is mm only |
| `grid X 0 6400 12800 19200` | The X-axis grid coordinates. Ascending, two or more. Named `X1`, `X2`, … automatically |
| `grid Y 0 5600 7600 13200` | The Y axis. Once per axis |
| `level L1 0 h:3600 slab:600` | A level: name, z, [ceiling height], [slab thickness in mm] |
| `level L4..L10 11000 pitch:3000 h:2500 slab:450` | An arithmetic range declaration. `pitch:` required. Expands to `z + pitch×k` |
| `level R 30200 slab:500` | A level holding no space (a roof) becomes the upper bound of the top storey's height check |

## How position is written ([language.md §2, grid references and offsets](../../spec/en/language.md))

| How it is written | Meaning |
|---|---|
| `X2` | The coordinate of a grid line |
| `X2+600` / `Y3-150` | An offset in mm from a grid line. **Integers only** (`X2+600.5` gives `未定義の通り名です`) |
| `X1..X2+3200` | A range. Both ends written as grid references |
| `X1..X2 Y1..Y2` | A region = two tokens, an X-axis range and a Y-axis range |
| `X1..X2 Y1..Y3 + X2..X3 Y1..Y2` | A region union. `+` is its own token (whitespace either side) |
| `X2..X1` | A descending range is another spelling of the same rectangle. Normalized to ascending on save |
| `-2600,-7000` | Raw mm coordinates. **Only in `polygon`** ([language.md §7](../../spec/en/language.md)) |

**The compass.** X is east-positive and Y is north-positive. The N/E/S/W of `edge` and `hinge` are read on those axes.

| | Direction | Axis |
|---|---|---|
| `N` | North | +Y |
| `S` | South | −Y |
| `E` | East | +X |
| `W` | West | −X |

`edge` is **the side as seen from the rectangle of the space written first (the a side)** ([semantics.md §2](../../spec/en/semantics.md)).

## space ([language.md §3](../../spec/en/language.md))

```muro-part
space /L5/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK floor:オーク
space /out/road-s exterior name:南側道路 road:12000
```

| Element | How it is written | Meaning |
|---|---|---|
| Path | `/L5/A/ldk` | Identity. A `/`-separated aggregation hierarchy. If the first segment is a level name it belongs to that level |
| Type | 2nd positional (required) | An open vocabulary. The bundled examples use 31 words |
| Region | `X?..X? Y?..Y?` | May be absent (`exterior` and the like). Overlaps are an error |
| `level:L1` | Attribute | States the level explicitly. Used for a grouping that spans levels (a maisonette) |
| `h:2400` | Attribute | Ceiling height. Defaults to the level's `h` |
| `use:exclusive` | Attribute | An aggregation axis. Inherited from `zone` |
| `daylight:1` / `daylight:0` | Attribute | Adds to or removes from the daylight scope |
| `road:12000` | Attribute | The width of an exterior space — the mark of a road |
| `uid:…` | Attribute | A persistent identity token across renames. Digits alone, or whitespace, is an error |

**Types the tools interpret structurally** ([vocabulary.md](../../spec/en/vocabulary.md)):

| Type | Interpretation |
|---|---|
| `exterior` | The outside. May have no region. Splits into several, as in `/out/road-s` |
| `void` | A void through the floor. Not counted in floor area, and not passable |
| `daylight:1` (an attribute, not a type) | Declares that `light`'s 1/7 daylight test applies to this room |

**Every other type is merely carried.** Write a `wc` as `room` and it enters the daylight check; spell it `rooom` and it passes silently.

**When subdividing with children, make the parent a `zone`.** Putting a `space` with a region under a `space` with a region gives `空間の領域が重なっています` (GEO02). For how to subdivide a dwelling into rooms, see the `zone` section below.

## band — dividing by dimension and order ([language.md §3, band](../../spec/en/language.md))

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

The notation that writes **dimension and order** rather than position, letting position be derived (the horizontal counterpart of stacking up `level`s). It coexists with writing regions; either is fine. The six lines above give the same model as `space … X1..X2 Y1..Y2` / `X2..X3 Y1..Y2`.

| Element | How it is written | Meaning |
|---|---|---|
| Axis | 1st positional, `X` / `Y` | The direction of division (`X` = west to east, `Y` = south to north) |
| Range | `X?..X? Y?..Y?` | The extent of the band. **Ascending required** (order carries meaning, so descending is not normalized). No `+` union |
| Member | An indented `space` line | Carries a width `w:` in place of a region. Otherwise an ordinary `space` |
| `w:1800` | The dimension in mm along the band's direction | |
| `w:rest` | The mark of the member absorbing the remainder | At most one per band |

- **No `key:value` may be written on the `band` line** — the band does not survive into the model, so there is nowhere for an attribute to live. Attributes go on the member `space` lines.
- **The default is a closed band, using no `rest`** — every member carries a dimension, and the parser reconciles their sum against the width of the band, the same arithmetic as "the partial dimensions sum to the overall" on a drawing.
- `level:` and `area` may not be written on a member. `w:` may not be written on a `space` outside a band (`space に w: は書けません`).
- A band is expanded into ordinary spaces at parse time and **survives neither in the model nor in the canonical JSON**. A version written with bands and one written with positions give the same canonical JSON.
- Every fault is a parse error and surfaces in `check --json` as SYN01 (there is no dedicated code).

```text
✖ 4行目: 帯の幅 5400mm に対し寸法の合計が 4600mm で、800mm 足りません (寸法を直すか、どれかを w:rest にします)
  /L1/ldk w:3600
  /L1/hall w:1000
```

("Against a band width of 5400 mm the dimensions total 4600 mm, 800 mm short — fix the dimensions, or make one of them w:rest.")

A worked example is [examples/tower/typical.muro](../../examples/tower/typical.muro); why it was introduced is [ADR-0019](../../docs/decisions/0019-position-and-lines.md).

## area — an indented uncounted subdivision ([language.md §3](../../spec/en/language.md))

```muro-part
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
```

Indented directly under a `space`. It carries only a region and overriding attributes, and appears in neither area, room counts, nor the graph (the isolation rule). Spilling outside the parent region is a warning; an `area` on a space with no region is an error.

## boundary ([language.md §4](../../spec/en/language.md))

```muro-part
boundary /L5/A/hall /L5/corridor t:180 spec:RC
  door D1 at:X4 name:玄関
  seg w:1800 at:X5 edge:S spec:受付ガラス
boundary /L1/hall /L2/void type:void
```

A first-class relation joining two space paths. **The wall centerline segment is not written** — it is derived from the layout of the two spaces. It may be written before the spaces (forward reference is allowed).

| Attribute | Meaning |
|---|---|
| `type:` | The topology. Defaults to `wall` |
| `t:180` | Wall thickness in mm (split about the centerline). The drawing default when unspecified is 100 |
| `air:1` | There is something there, but it does not block outside air or light (a railing, a fence, a balustrade) |
| `edge:S` | Restricts the segment to a particular side of the a-side rectangle |
| `spec:RC` `fire:60` `sound:D-50` … | Free. `spec` is the name of the thing — the tools do not interpret it |

**The types** ([semantics.md §3](../../spec/en/semantics.md)):

| type | Direction | Passable | Meaning |
|---|---|---|---|
| `wall` | Horizontal (default) | Only with a door | There is something there |
| `open` | Horizontal | Always | There is nothing there |
| `stair` | Vertical | Yes | A stair |
| `shaft` | Vertical | No | Continuous but impassable (a lift, a pipe shaft) |
| `void` | Vertical | No | The absence of a floor |

Floors are not written — vertical adjacency is derived from overlap in plan, and the default is a floor. Writing a wall boundary between different levels is an error (BND03).

## door / window / seg — indented openings and subdivisions ([language.md §4, openings](../../spec/en/language.md))

```muro-part
boundary /L1/office /out t:180 spec:EW1
  door w:1800 edge:S name:エントランス
  window w:3600 h:2200 edge:S at:0.25 sill:800
  seg w:1800 at:X5 edge:S spec:受付ガラス
```

| Attribute | Meaning |
|---|---|
| (the leading non-`key:value` token) | An asset reference. `door SD1 sill:800` |
| `w:900` | Width in mm. **Required** (may come from the asset) |
| `h:2100` | Height in mm. Optional. The daylight calculation for a `window` counts only those carrying `h` |
| `at:0.5` | A ratio 0..1. Defaults to 0.5. Clamped within the segment |
| `at:X2+450` | An absolute position as a grid reference. Not clamped (overrunning, or the wrong axis, is an error) |
| `edge:S` | Selects the side when there are several segments |
| `hinge:E` | The hinge side. W/E on a horizontal segment, N/S on a vertical one. Defaults to the starting end |
| `swing:b` | The side it opens toward, a/b. Defaults to a (the side with a region) |
| `style:sliding` | `hinged` (default) / `sliding` / `auto`. Changes how the door is drawn in plan |
| `sill:800` `name:…` | Free |

- `door` is for passage, `window` for daylight (it does not admit passage).
- `seg` is an uncounted subdivision along a boundary. It carries only a position (`at`/`w`/`edge`) and overriding attributes, and affects neither passage nor connection. `w:` is required.
- **When placing an opening on the outside (`/out`), select the side with `edge:`.** The perimeter is what remains after removing the intervals touching other rooms, and it usually splits across several edges. Place one without selecting and you get `境界線分が複数あります。edge:N/E/S/W で辺を指定してください`.
- Openings overlapping on the same segment are an error (center-to-center distance ≥ (w₁+w₂)/2).

## asset ([language.md §6](../../spec/en/language.md))

```muro-part
asset SD1 door w:800 h:2000 style:sliding name:片引き戸
asset W1 window w:2600 h:2200 sill:0 name:掃き出し窓
```

`asset <name> door|window [attributes…]`. A bundle of defaults to be referenced; not a fourth element. The asset's attributes become the defaults and the instance's attributes override them. A kind mismatch, an undefined reference, or a duplicate name (including across composition) is an error.

## zone — counted aggregation ([language.md §5](../../spec/en/language.md))

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
zone /site name:敷地 site:1 area:1097.80
```

It has no geometry and bundles the spaces beneath it **by path prefix**. That is why, when subdividing a dwelling into rooms, you make the parent a `zone` rather than a `space` and line the region-carrying `space`s up beneath it.

| Attribute | Meaning |
|---|---|
| `name:` | Free |
| `use:` | Inherited by what lies beneath (a declaration on the space wins) |
| `site:1` | The mark of the site. Becomes the subject of the `site` query |
| `area:1097.80` | The declared site area in m² (surveyed). Reconciled against the derived area |
| `uid:` | A persistent identity token (the same rule as for a space) |

A duplicate path is an error; a zone with no spaces beneath it is a warning.

## polygon — the site shape ([language.md §7](../../spec/en/language.md))

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

`polygon /<zone path> x,y x,y x,y …`. Three or more vertices, in mm (the same coordinate system as the grid). **The one written shape in this notation that does not sit on the grid** — because a site is surveyed input. Associate it with a `site:1` zone (its absence is a warning). The standard practice is a quarantined layer, a separate file plus `import`.

## column — columns ([language.md §3](../../spec/en/language.md), ADR-0023)

```muro-part
column 800 L1..L6
column 900 B2..L6 x:X2,X3 y:Y2 d:1200 spec:SRC
```

`column <side mm> <level range | level name> [attributes…]`. **The position is never written** —
a column stands at each grid intersection that has a floor on that level. `x:` / `y:` restrict the
grid lines (unrestricted means all of them); `d:` gives the depth of a rectangular section.
**No two columns stand on the same intersection, and the earlier declaration wins** — so
**the order of declarations is meaning**, and the canonical JSON never sorts them (ADR-0029).

## line — a drawn line ([language.md §4](../../spec/en/language.md), ADR-0022)

```muro-part
boundary /L1/a /L1/b t:120
  line X3,Y1 X3+600,Y2-900
```

Written indented under a boundary. The endpoints are **a pair of grid words**
(`X3,Y1` / `X3+600,Y2-900`); raw coordinates and angles cannot be written. It gives the boundary's
realisation as **an act of design** rather than as something derived from adjacency — the union of
the two spaces' allocations is re-divided along the line, so what one loses the other gains.
One line per boundary. Drawing a line is **an act of dividing a plan**, so it cannot go on a vertical boundary.

## Vertical circulation — stair / ramp / escalator / lift ([vocabulary.md](../../spec/en/vocabulary.md), ADR-0021)

```muro-part
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N form:return turn:R
space /L1/e escalator X4..X5 Y1..Y2 escalator:E lane:1200
space /L1/ev shaft X2..X3 Y1..Y2 lift:1
```

The key names the device and the value is **the ascending direction** (`N`/`E`/`S`/`W`; `1` for a lift).
**Riser counts, goings, landings and slopes are never written** — they follow from the region and the
storey height, and `check`'s RUN06/RUN07 check the derived result. `form:return` folds it,
`turn:R|L` picks the turn, and `riser:` `tread:` `entry:` `landing:` `lane:` `slope:` override the rule side.
The topology (which levels it joins) is held separately by a vertical boundary (`stack` / `type:stair`).

## import — composition ([language.md §8](../../spec/en/language.md))

```muro-part
import ./assets.muro
import ./L1.muro
```

Reads a layer by a path relative to the file it is written in and composes it **additively**.

| Rule | |
|---|---|
| What the base layer (the entry) holds | `koyu` / `name` / `unit` / `grid` / `level`, once each |
| What each layer adds | Spaces, boundaries, zones, assets, polygons |
| A double import, or a cycle | Idempotent (the same layer is composed once) |
| A collision | A build error. It names the provenance of both (`file:line`). There is no silent override |
| The canonical JSON | The single composed model. `import` does not survive |

## Span expansion and stack ([language.md §3, §4](../../spec/en/language.md))

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:Bタイプ use:exclusive
zone /L3..L10/A name:Aタイプ use:exclusive
boundary /L2..L9/A/ldk /L2..L9/A/hall t:100 spec:LGS
  door w:800
stack ev L1..L10 type:shaft
```

| How it is written | Meaning |
|---|---|
| `L2..L9` at the head of a path | Expands across the declared levels **in z order** (not by numeric name) |
| Several paths on one line | The spans must all be the same |
| An indented line under an expanded line | Attaches to every expansion (write the door once and it rides on every storey) |
| `stack <name> L1..L11 type:stair\|shaft\|void` | Draws vertical boundaries across every consecutive level pair `/Lk/<name> \| /Lk+1/<name>` |

## Defaults ([language.md §9](../../spec/en/language.md))

| Item | Default |
|---|---|
| The boundary between touching spaces | `wall` — **do not write it**. Declare only the exceptions (open / air:1 / anything carrying attributes or openings) |
| Vertical adjacency | A floor (slab) — **do not write it**. Declare only the exceptions (stair / shaft / void) |
| **The boundary with a space that has no region (`/out` etc.)** | **None. It does not exist unless you write it** — because naming which outside it is is the information |
| boundary type | `wall` |
| boundary t | None (100 mm when drawing only) |
| opening at | 0.5 (a ratio, clamped) |
| opening hinge / swing | The starting end of the segment / the a side (the one with a region) |
| opening style | `hinged` |
| space level | The first path segment (when it is a level name) |
| space h | The level's `h` |
| Area measurement | To wall centerlines |
| Language version | `0.4` (when the declaration is omitted) |

The third row (the boundary with a space that has no region) is the heart of the asymmetry. **Internal walls stand automatically; the envelope does not.** `check` is green even with not one `boundary /L1/living /out …` written.

## The CLI ([tools.md](../../spec/en/tools.md))

```sh
npx tsx src/cli.ts <command> <entry.muro> [args…]
npm run koyu -- <command> <entry.muro> [args…]    # the same thing
```

The entry is always a file path, and `import`s are composed automatically.

| Command | Arguments | What comes back | Exit code |
|---|---|---|---|
| `check` | `--json` / `--strict` | Whether it is consistent; errors and warnings with provenance | 0 = green / 1 = errors (with `--strict`, warnings too) |
| `plan` | `-l <level>` `-o <out.svg>` | The plan as SVG. Defaults to the first level / `<entry>-<level>.svg` | 0 / 2 = an undeclared level name |
| `doors` | `/pathA /pathB` | The fewest doors and the route | 0 / 1 = unreachable / 2 |
| `graph` | — | The neighbors of each space (boundary kind, door count) | 0 |
| `stats` | — | Area by level, semi-outdoor separately, by zone, by type, by use | 0 |
| `levels` | — | The section stack-up as text | 0 |
| `axo` | `-o <out.svg>` `-d NE\|NW\|SE\|SW` `-l L1..L5` `-s <scale>` `--no-walls` `--ceilings` | An axonometric as SVG (floors, roofs, walls, columns, vertical circulation) | 0 / 2 = an undeclared level name |
| `runs` | — | The vertical circulations (device, rise, derived slope and going length) | 0 |
| `light` | — | The 1/7 daylight verdict for **each room declared `daylight:1`** | 0 = all pass / 1 |
| `site` | — | Site area (declared vs derived), frontage, coverage ratio, floor area ratio | 0 / 1 = no site |
| `json` | — | The canonical JSON ([canonical-json.md](../../spec/en/canonical-json.md)) | 0 |
| `diff` | `<b.muro>` `--json` | The difference in the language of composition | 0 = no difference / 1 = differences / 2 = the input is broken |

- Called with no arguments it prints usage and exits with **code 2**.
- **A green `check` does not mean the building can be used.** It is green with not one door written, so run `doors` alongside as the circulation check.
- The `境界 N` from `check` is a count that includes derived default boundaries. Only written boundaries appear in the canonical JSON (`json`) — the same model can show `境界 1` and `"boundaries": []` at once ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)).

## Interpreted attributes (★) ([vocabulary.md](../../spec/en/vocabulary.md))

Only the words in the ledger are read by the tools. **Any `key:value` not listed may be written freely and is carried through** — which is to say `nmae:居室` passes silently.

| Element | Interpreted attributes |
|---|---|
| space | `type` (in part), `level`, `h`, `use`, `daylight`, `ceiling`, `road`, `uid`; the region; `w` (only as a band member); vertical circulation (`stair` `ramp` `escalator` `lift` `form` `turn` `entry` `landing` `riser` `tread` `lane` `slope`) |
| boundary | `type`, `t`, `air`, `edge` |
| opening | `kind` (door/window); the asset reference; `w`, `h`, `at`, `edge`, `hinge`, `swing`, `style` |
| level | `z`, `h`, `slab`, `pitch`, `underground` |
| zone | `use`, `site`, `area`, `uid` |
| asset | Every opening attribute (as defaults) |
| polygon | The vertex list |
| column | The side, the levels, `d` `x` `y` (**the declared order is meaning too**) |
| line | The endpoint pair (grid words) |
| area / seg | The position (a region / `at`, `w`, `edge`) |

**A ★ value is checked** — not a number gives [ATT01](diagnostics.md#att01), outside a fixed vocabulary gives [ATT02](diagnostics.md#att02) ([ADR-0028](../../docs/decisions/0028-diagnostics-per-declaration.md)). A value you wrote but that could not be interpreted never quietly falls back to the default.

`name`, `floor`, `spec`, `fire`, `sound`, `sill`, and the like are free words. `spec` is where the name of a thing goes (RC, LGS, a railing, a curtain wall…), and the tools do not interpret it.
