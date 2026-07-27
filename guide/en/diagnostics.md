**English** · [日本語](../diagnostics.md)

# The diagnostic index

A page for looking up every diagnostic code `check` returns, with its **cause** and its **fix**. The ledger of codes, severities, and summaries is held by [spec/semantics.md §5](../../spec/en/semantics.md) — this adds to that ledger the things the spec deliberately does not carry: why it happens, what to rewrite, and a minimal reproduction.

Diagnostic messages are emitted in Japanese by the implementation. Each code below quotes the real message and glosses it in English immediately after.

## First, get the code

**The human-facing `check` does not display codes.** What comes out is the Japanese body alone; a code like `BND04` appears nowhere. When you need the code, add `--json`. Run this before looking anything up here.

```sh
koyu check bad.muro --json
```

Take, for instance, this file (two rooms touching only at a corner).

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

The human output looks like this.

```text
✖ <絶対パス>/bad.muro:6行目: 空間が接していないため境界を導けません: /L1/a | /L1/b
```

("The spaces do not touch, so no boundary can be derived." The leading provenance is the **resolved absolute path**; it is elided here as `<絶対パス>`.)

Add `--json` and the same diagnostic comes out with its code.

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "空間が接していないため境界を導けません: /L1/a | /L1/b",
  "line": 6,
  "file": "<絶対パス>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

`message` is **the body only** and does not include the position prefix (`file:N行目: `); the position is carried separately by `line` / `file`. The message this page lists for each code is that same body. The contract for the diagnostic's structure (`code` / `severity` / `message` / `line` / `file` / `path` / `related`) is held by [spec/semantics.md §5](../../spec/en/semantics.md) and [ADR-0016](../../docs/decisions/0016-diagnostic-contract.md).

## Severity and exit codes

There are only two severities.

| severity | Meaning | `check` exit code | `check --strict` exit code |
|---|---|---|---|
| `error` | The composition does not stand up | 1 | 1 |
| `warning` | Something is suspect (it does stand up) | 0 | 1 |

**To fail on warnings too, add `--strict`.** That is what you put in the CI gate. Severity is an invariant property of a code, and when the weight is to change a new code is minted — an existing code's severity never changes silently.

Every wrong example on this page exits 1 under `koyu check --strict`, each producing **exactly one** instance of that code. You can paste them and confirm. The marks are split by severity: <code>```muro-bad</code> is what `check` rejects as an error, and <code>```muro-warn</code> is what `check` passes and `--strict` rejects. `test/guide.test.ts` verifies that correspondence by running every code.

## Looking up by symptom

| Symptom | Codes to look at |
|---|---|
| You wrote a boundary and were told the spaces "do not touch" | [BND04](#bnd04) |
| You placed a door or window and were told "there are several segments" | [OPN05](#opn05) |
| You wrote a stair or a void and were told off | [VRT01](#vrt01) [VRT02](#vrt02) [VRT03](#vrt03) |
| You laid out spaces and were told "the regions overlap" | [GEO02](#geo02) |
| You thought you wrote a level and were told "its level cannot be determined" | [SUF02](#suf02) |
| The floor-height arithmetic does not pass | [HGT01](#hgt01) [HGT02](#hgt02) |
| No ceiling height or floor-construction thickness written, and neither ceilings nor floors are generated | [SUF01](#suf01) [SUF03](#suf03) |
| The site's figures do not agree | [SIT03](#sit03) [SIT05](#sit05) |
| The file dies without a single line being read | [SYN01](#syn01) |

## Boundaries — BND

<a id="bnd01"></a>
### BND01 — a boundary between a space and itself

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /out /out
```

`同じ空間同士の境界は書けません: /out` — "a boundary between the same space cannot be written".

**Cause** — a boundary is a relation joining two **different** spaces. The same path was written twice. Copying a line and forgetting to fix one side is almost the whole of it.

**Fix** — correct the second path to its intended partner.

<a id="bnd02"></a>
### BND02 — a duplicate boundary

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

`境界が重複しています: /L1/a | /L1/b (既出: <絶対パス>/bad.muro:6行目)` — "duplicate boundary, first seen at line 6".

**Cause** — there are two boundaries on the same pair of spaces (identical down to the `edge` restriction). Since the order carries no meaning, neither can be said to win. Even when `wall` and `open` contradict as they do here, the later one is not silently taken. `related` carries the position of the earlier one.

**Fix** — consolidate into one. To give different specifications per edge, put `edge:` on both and restrict them to different edges (differing `edge`s are not a duplicate).

<a id="bnd03"></a>
### BND03 — a wall boundary to a space on a different level

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a t:120
```

`異なるレベルの空間に壁境界は書けません (垂直は type:stair/shaft/void): /L1/a | /L2/a` — "a wall boundary cannot be written to a space on a different level; vertical takes type:stair/shaft/void".

**Cause** — a wall does not stand across storeys. A `boundary` was written meaning to connect two storeys, but `type:` was omitted so it defaulted to `wall`.

**Fix** — to write a relation between storeys, add `type:stair` (a stair), `type:shaft` (a lift and the like), or `type:void` (a void). **Floors are not written** — adjacency between storeys is derived automatically from overlap in plan, and the default is a floor.

<a id="bnd04"></a>
### BND04 — the spaces do not touch, so no boundary can be derived

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

`空間が接していないため境界を導けません: /L1/a | /L1/b`

**Cause** — the wall centerline segment is derived from the layout of the two spaces. Unless they touch in a way from which it can be derived, the boundary relation does not stand up. The commonest case is **touching only at a corner**. In the example, `/L1/a` is `X1..X2 Y1..Y2` and `/L1/b` is `X2..X3 Y2..Y3`; they share only the point (X2, Y2) and no edge of any length. **Without a shared edge of nonzero length, they are not "touching".** Coordinates that are simply off (writing `Y3..Y4` where `Y2..Y3` was meant) give the same symptom.

**Fix** — draw the two rectangles on paper and confirm whether they share an edge. If not, correct the layout. If you really want to connect two rooms that are apart, declare the space between them (a corridor, a hall) and split it into two boundaries.

**Related** — a boundary between touching spaces is derived as a `wall` by default, so it need not be written at all ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)). You write a `boundary` in order to carry an exception (`open`, `air:1`) or an attribute or an opening.

<a id="bnd05"></a>
### BND05 — edge-restricted and unrestricted boundaries coexist on one pair

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b edge:E t:150
```

`同じ空間対に edge 限定つきと無しの境界が併存しています (線分が重なります): /L1/a | /L1/b` — "the segments overlap".

**Cause** — a boundary with no `edge` points at **all** the segments of that pair. A boundary with `edge:E` points at the E side among them. Write both and two boundaries ride on the E side, doubling both the thickness (`t`) and the specification. It slips past BND02 (the duplicate error), but is almost never the intended state.

**Fix** — if the specification is common to every side, consolidate into the one without `edge`. To vary per side, write **every** one with `edge:`.

<a id="bnd06"></a>
### BND06 — no edge remains on the perimeter, so the boundary segment is zero

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:E t:150
boundary /L1/a /out edge:N t:150
boundary /L1/a /out edge:S t:150
boundary /L1/a /out edge:W t:150
boundary /L1/b /out t:150
```

`edge:E の外周に残る辺が無く、境界線分がゼロです: /L1/a | /out`

**Cause** — a boundary with a space that has no region (an `exterior`, say) is **what remains of the room's perimeter after removing the intervals that touch other spaces**. In the example, `/L1/a`'s E side is occupied entirely by `/L1/b`, so nothing remains facing `/out`. The boundary you wrote points at nothing.

**Fix** — the edge was mistaken. The compass of `edge:` is **read from the rectangle of the space written first (the a side)**, and is **N=+Y (north), S=−Y (south), E=+X (east), W=−X (west)**. X is east-positive and Y is north-positive. Here `edge:W` is correct. Remove the compass entirely and the boundary points at all three remaining sides.

## References — REF

<a id="ref01"></a>
### REF01 — referencing an undefined space

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /L1/zzz
```

`未定義の空間を参照しています: /L1/zzz`

**Cause** — there is no `space` matching the path written on the `boundary`. Either a typo in the path, a forgotten `space`, or a layer not loaded in composition (`import`).

**Fix** — check the spelling of the path. If the space should be in another file, look for the `import` in the base layer. The `file` from `koyu check <entry> --json` names the layers that took part in composition, so you can see there whether the intended layer was actually read.

**Note** — a `boundary` may be written **before** the spaces (it may refer forward). This is not a problem of order, which is why swapping the lines does not fix it.

## Spaces and regions — GEO, SEG (area)

<a id="geo01"></a>
### GEO01 — the regions of one space overlap each other

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2 + X2..X3 Y1..Y2
```

`/L1/a の領域同士が重なっています: X1..X3 Y1..Y2 と X2..X3 Y1..Y2`

**Cause** — the rectangles one space bundles with `+` overlap each other. It appears when you meant to write an L and got the start of the second rectangle wrong. The overlapping part would be counted twice in the area, so it is not let through.

**Fix** — split the rectangles you add with `+` so that they **do not overlap each other**. For an L, take one tall rectangle plus one that covers only what is missing beside it.

<a id="geo02"></a>
### GEO02 — the regions of two spaces overlap

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

`空間の領域が重なっています: /L1/a と /L1/b`

**Cause** — two spaces on the same level occupy the same place. `related` carries the position of the one written later.

**Fix** — correct the layout. However, **if this appeared while trying to subdivide a dwelling into rooms, the fix is not the layout.** Make the larger thing (the dwelling, the department) a `zone` rather than a `space`. A `zone` has no geometry; it is an aggregation that bundles the spaces beneath it by path prefix and totals their area, and it is the tool for writing "the whole and its parts".

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

The definition of `zone` is in [spec/language.md §5](../../spec/en/language.md).

<a id="seg01"></a>
### SEG01 — an area on a space with no region

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
  area X1..X2 Y1..Y2 floor:タイル
```

`領域を持たない空間 /out に area は書けません`

**Cause** — an `area` is an uncounted subdivision inside a room, pointing at part of the parent's region. With no region on the parent there is nothing to point at. Often the indentation has landed under the wrong `space`, one below the intended one.

**Fix** — move the `area` directly under a `space` that has a region.

<a id="seg02"></a>
### SEG02 — an area spills outside the region

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
  area X1..X3 Y1..Y2 floor:タイル
```

`area が /L1/a の領域からはみ出しています`

**Cause** — the `area`'s rectangle does not fit within the parent's. Because an `area` affects neither area, room counts, nor the graph, this is a warning rather than an error.

**Fix** — bring the `area`'s grid references within the parent's extent. On a parent with several rectangles joined by `+`, an `area` must fit within **one** of them. A subdivision spanning two rectangles is split into two `area` lines.

## Openings — OPN

`door` carries passage and `window` carries daylight. The idioms for position (a ratio `at:0.5`, a grid reference `at:X2+450`) are defined by [spec/language.md §4](../../spec/en/language.md).

<a id="opn01"></a>
### OPN01 — the wrong axis for hinge

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 hinge:E
```

`hinge:E は垂直線分 (N/S)で指定します` — "hinge:E: a vertical segment takes N/S".

**Cause** — `hinge` says which **end** the hinge is at. It only means something as a compass along the segment. The two rooms in the example sit east and west, so the edge they share is a **vertical segment running north–south**, whose ends are N and S.

**Fix** — for a vertical segment (running north–south) use `hinge:N` or `hinge:S`; for a horizontal one (running east–west) use `hinge:W` or `hinge:E`. Omitted, it takes the starting end of the segment.

<a id="opn02"></a>
### OPN02 — the openings overlap

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:2000 at:0.4
  door w:2000 at:0.6
```

`開口同士が重なっています (doorとdoor — 中心間 800mm < 必要 2000mm)` — "center to center 800 mm < the required 2000 mm".

**Cause** — two openings on the same segment cut into each other. The required center-to-center distance is `(w₁ + w₂) / 2`, and the message prints both the measured and the required value.

**Fix** — look at the numbers in the message and move the `at`s apart, or narrow the widths. A ratio `at` is a proportion of the segment length, so the shorter the segment the smaller the real distance for the same difference in ratio. To be certain, write an absolute position with a grid reference (`at:X2+900`).

<a id="opn03"></a>
### OPN03 — an opening on an open boundary has no effect on passage

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  door w:800
```

`open境界のdoorは通行に影響しません (常に通れます)` — "it is always passable".

**Cause** — `open` declares that there is nothing there. It is always passable to begin with, so adding a door changes nothing about passability. It is not counted in `doors` either.

**Fix** — if you want the door counted (that is, a real door exists), make the boundary a `wall` (the default — write no `type:`) and put the door on it. If it is merely an opening, delete the `door` line.

<a id="opn04"></a>
### OPN04 — there is no boundary segment on which to place the opening

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:800 edge:N
```

`door を置ける境界線分がありません (/L1/a | /L1/b)`

**Cause** — there is no segment where the opening's `edge:` narrowed to. The two rooms in the example sit east and west, so their shared edge is on E (seen from the a side) and there is nothing on N. The same code also appears when the boundary itself has no segment (arriving together with BND04 / BND06).

**Fix** — correct the compass of `edge:` (**N=+Y, S=−Y, E=+X, W=−X**, read from the space written first). On a boundary with only one segment, `edge:` is unnecessary.

<a id="opn05"></a>
### OPN05 — there are several boundary segments

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  door w:800
boundary /L1/b /out t:150
```

`境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)` — "specify the side with edge:N/E/S/W".

**Cause** — a boundary with the outside (`/out` and other spaces with no region) is **all that remains** of the room's perimeter not touching another room, and it usually splits across several edges. Where on that boundary to put the door is not settled. You may as well remember it as: **placing an opening on an external wall always needs `edge:`**.

**Fix** — select the side with `edge:`. The compass is **read from the rectangle of the space written first (here `/L1/a`): N=+Y, S=−Y, E=+X, W=−X**. X is east-positive and Y is north-positive. To put the entrance on the south, `door w:900 edge:S`.

<a id="opn06"></a>
### OPN06 — the opening is wider than the boundary segment

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:5000
```

`doorの幅 5000 が境界線分の長さ 4000 を超えています` — "a door width of 5000 exceeds the segment length of 4000".

**Cause** — the width is longer than the wall. The message prints the segment's real length, so you can reconcile it against the layout right there. When using an asset reference (`door SD1`), the width may be coming from the asset.

**Fix** — narrow the `w`, or widen the layout. To override an asset's width for one instance, write `w:` on the instance (the instance beats the asset).

<a id="opn07"></a>
### OPN07 — the wrong axis for an explicit opening position

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  door w:800 at:Y1+2000
```

`door の位置 Y1+2000 は水平線分なのでX系の通りで指定します` — "a horizontal segment takes an X-axis grid reference".

**Cause** — when writing a position as a grid reference, it is only a position if it is on the axis along the segment. The two rooms in the example sit north and south, so their shared edge is a **horizontal segment running east–west**, and a position on it is measured on the X axis.

**Fix** — a horizontal segment (running east–west) takes `at:X…`; a vertical one (running north–south) takes `at:Y…`. When unsure: two rooms side by side east–west share a vertical segment (Y axis); two rooms north and south share a horizontal one (X axis).

<a id="opn08"></a>
### OPN08 — an explicit opening position overruns

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  door w:900 at:Y1+200
```

`位置 Y1+200 では door (幅900) が境界線分からはみ出します (線分 0〜4000mm、中心の許容 450〜3550mm)` — "at Y1+200 the door (width 900) overruns the segment; the segment is 0–4000 mm and the center is permitted 450–3550 mm".

**Cause** — when `at` is a grid reference it is **not clamped**. A ratio (`at:0.5` and the like) is pushed back automatically to fit the segment, but a grid reference is an instruction to put it *there*, so if it does not fit it errors rather than moving silently. `at` points at the opening's **center**, so it must be at least `w/2` inside from the end.

**Fix** — bring `at` within the "center is permitted" range in the message. Here that is `at:Y1+450` or more. If you only want it flush to one end, write the ratio `at:0` and it is clamped hard against the end.

## Subdivisions along a boundary — SEG

A `seg` is an uncounted subdivision along a boundary — an interval where the wall material changes partway, say. Its idioms for position are the same as an opening's, and the diagnostics SEG04–SEG08 correspond one to one with OPN04–OPN08. It affects neither passage nor connection.

<a id="seg03"></a>
### SEG03 — a seg on an open boundary is not interpreted

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b type:open
  seg w:800 spec:X
```

`open境界 (壁が無い) の seg は解釈されません` — "there is no wall".

**Cause** — a `seg` switches the specification of part of a wall. An `open` has no wall, so there is nothing to switch.

**Fix** — if there is a wall, remove `type:open` (the default is `wall`). If there is not, delete the `seg` line.

<a id="seg04"></a>
### SEG04 — there is no boundary segment on which to place the seg

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:800 edge:N spec:X
```

`seg を置ける境界線分がありません (/L1/a | /L1/b)`

**Cause and fix** — the same as [OPN04](#opn04). The compass of `edge:` points at a side with no segment.

<a id="seg05"></a>
### SEG05 — several boundary segments for the seg — ambiguous

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  seg w:800 spec:X
boundary /L1/b /out t:150
```

`境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)`

**Cause and fix** — the same as [OPN05](#opn05). A `seg` on an external wall needs `edge:`.

<a id="seg06"></a>
### SEG06 — the seg is wider than the boundary segment

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:5000 spec:X
```

`segの幅 5000 が境界線分の長さ 4000 を超えています`

**Cause and fix** — the same as [OPN06](#opn06). To write a subdivision spanning the whole length of a wall, make it an attribute of the boundary itself rather than a `seg`.

<a id="seg07"></a>
### SEG07 — the wrong axis for an explicit seg position

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X1..X2 Y2..Y3
boundary /L1/a /L1/b t:120
  seg w:800 at:Y1+2000 spec:X
```

`seg の位置 Y1+2000 は水平線分なのでX系の通りで指定します`

**Cause and fix** — the same as [OPN07](#opn07).

<a id="seg08"></a>
### SEG08 — an explicit seg position overruns

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  seg w:900 at:Y1+200 spec:X
```

`位置 Y1+200 では seg (幅900) が境界線分からはみ出します (線分 0〜4000mm、中心の許容 450〜3550mm)`

**Cause and fix** — the same as [OPN08](#opn08). A grid reference is not clamped.

## Vertical — VRT

Adjacency between storeys is not declared — it is derived from overlap in plan, and the default is a floor. Only the exceptions are written: `stair` (passable), `shaft` (continuous but impassable), `void` (the absence of a floor).

<a id="vrt01"></a>
### VRT01 — a vertical boundary is written between spaces that have a region and a level

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out type:stair
```

`stair 境界は領域とレベルを持つ空間同士に書きます`

**Cause** — a vertical relation says "this part of the plan connects up and down", so unless both sides have a region and a level the position is undetermined. The partner is an `exterior` (no region), or a space whose level could not be determined.

**Fix** — make both sides real spaces with a region and a level. To write an exterior stair, stand up a stair space on each storey (a space facing an `exterior` with `open` / `air:1` if it is semi-outdoor) and draw `type:stair` between them.

<a id="vrt02"></a>
### VRT02 — a vertical boundary is written between adjacent levels

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L3/a room X1..X2 Y1..Y2
boundary /L1/a /L3/a type:stair
```

`stair 境界は隣り合うレベルの間に書きます: /L1/a | /L3/a`

**Cause** — one vertical boundary spans exactly one step between levels **adjacent** in z order. The example is L1 and L3, skipping L2 in between.

**Fix** — write one per step (`/L1/a | /L2/a` and `/L2/a | /L3/a`). A shaft or stair enclosure running the whole height can be declared at once with a single `stack` line.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
level L3 6000 h:2400 slab:200
space /L1/ev shaft X1..X2 Y1..Y2
space /L2/ev shaft X1..X2 Y1..Y2
space /L3/ev shaft X1..X2 Y1..Y2
stack ev L1..L3 type:shaft
```

<a id="vrt03"></a>
### VRT03 — the spaces of a vertical boundary do not overlap in plan

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/b type:stair
```

`stair 境界の空間が平面上で重なっていません: /L1/a | /L2/b`

**Cause** — to connect up and down they must overlap in plan. The layouts of the stair or shaft differ between the storeys.

**Fix** — align the rectangles on both storeys. If the design shifts the stair per storey, insert a landing space in the range where they overlap.

<a id="vrt04"></a>
### VRT04 — the space above a void boundary is not type:void

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
```

`void境界の上側は type:void の空間を想定しています: /L2/a`

**Cause** — a `type:void` boundary says "there is no floor here". If the space sitting above it stays an ordinary room, it is counted as floor area despite having no floor.

**Fix** — make the type of the space above `void` (`space /L2/a void X1..X2 Y1..Y2 name:リビング上部`). A `void` space is not counted in floor area and shows in `stats` as `吹抜け (床面積不算入)`, "void (not counted in floor area)".

<a id="vrt05"></a>
### VRT05 — an opening on a vertical boundary is not interpreted

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  door w:800
```

`垂直境界のdoorは解釈されません`

**Cause** — an opening rides on a wall centerline segment, and a vertical boundary has no segment. Written, it affects neither daylight nor passage nor the drawing. A `stair` is passable without a door, and adding one does not raise the count in `doors`.

**Fix** — delete the opening line. If there really is a door at the entrance to the stair, it is a door on the **horizontal** boundary between the stair space and the adjoining room.

<a id="vrt06"></a>
### VRT06 — a seg on a vertical boundary is not interpreted

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:200
level L2 3000 h:2400 slab:200
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
boundary /L1/a /L2/a type:stair
  seg w:800 spec:X
```

`垂直境界の seg は解釈されません`

**Cause and fix** — the same as [VRT05](#vrt05). A vertical boundary has no segment.

## Height — HGT

Height is checked as a declared invariant: **that space's ceiling height + the level above's `slab` ≤ the floor-to-floor height (the difference up to the next level's z)**. `koyu levels` shows the stack-up as a section in text.

<a id="hgt01"></a>
### HGT01 — it collides with the storey above

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2800 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X2 Y1..Y2
space /L2/a room X1..X2 Y1..Y2
```

`/L1/a が上階に食い込みます: 天井高2800 + L2のslab400 = 3200 > 階高3000` — "ceiling 2800 + L2's slab 400 = 3200 > floor-to-floor 3000".

**Cause** — the ceiling height plus the slab thickness exceeds the floor-to-floor height. The message prints all three numbers, so which to move is settled right there.

**Fix** — lower the ceiling height (`level L1 0 h:2400`), thin the floor construction (`slab:200`), or raise the floor-to-floor height (`level L2 3400 …`). To lower the ceiling of just that room, write `h:` on the space (`space /L1/a room X1..X2 Y1..Y2 h:2400` — a space's `h` beats the level's). To pierce a storey deliberately as a void, see [HGT02](#hgt02).

<a id="hgt02"></a>
### HGT02 — insufficient coverage for a partial void

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:5400 slab:400
level L2 3000 h:2400 slab:400
space /L1/a room X1..X3 Y1..Y2
space /L2/v void X1..X2 Y1..Y2
space /L2/b room X2..X3 Y1..Y2
boundary /L1/a /L2/v type:void
```

`/L1/a が上階に食い込みます: 天井高5400 + L2のslab400 = 5800 > 階高3000。吹抜けの被覆は50.0%しかありません — 部分吹抜けでは天井高を階高内に収めます (吹抜け部分の高さは導出)` — "the void's coverage is 50%; under a partial void keep the ceiling height within the storey (the void's height is derived)".

**Cause** — a void (a `type:void` boundary) is a **declarative exemption** from the height invariant, but the exemption holds only as far as the void covers the lower storey's plan. The example voids only half the lower storey, yet declares its ceiling height as 5400, piercing the storey. Over the other half there is a floor, and that part cannot be 5400. The exemption holds only at a coverage ratio of 99% or more (a full-height void).

**Fix** — bring the lower storey's ceiling height within the storey (`level L1 0 h:2400`). The height of the void part is derived from the `void` relation and need not be declared. To make the whole thing a void, make the `void` space's region the same as the lower storey's.

## Sufficiency — SUF

**Not making a shape and not being able to make one are different things.** A unique shape has to be derivable from this description, so whether the information needed to make that shape is present is part of structural integrity ([spec/scope.md §6](../../spec/scope.md)). **This is a completeness check, not a validity judgement** — it never says "that ceiling height is wrong". It says only "no ceiling height is written".

<a id="suf01"></a>
### SUF01 — the ceiling height cannot be determined

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 slab:150
space /L1/a room X1..X2 Y1..Y2
```

`/L1/a の天井高が決まりません (空間の h: も レベル L1 の h: もありません)` — "neither the space's `h:` nor level L1's `h:` is there".

**Cause** — the space has no `h:`, and neither does the level it sits on. There is no height to extrude, so **no ceiling and no roof are generated** for this space. The height invariant ([HGT01](#hgt01)) cannot be formulated either, so a ceiling height that pierces a storey passes in silence.

Three kinds are not blamed: voids (`type:void` — having neither floor nor ceiling is what a void is), the exterior (`type:exterior` — it is the ground), and semi-outdoor spaces (spaces meeting the exterior across `type:open` or `air:1` — a balcony has no ceiling height). For these three the shape is settled without a ceiling height.

**Fix** — write a base ceiling height on the level (`level L1 0 h:2400 slab:150`). Write `h:` on the space for individual rooms that differ (`space /L1/a room X1..X2 Y1..Y2 h:2700` — a space's `h` beats the level's).

<a id="suf02"></a>
### SUF02 — its level cannot be determined

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /house/a room X1..X2 Y1..Y2
```

`/house/a は領域を持ちますが、レベルが特定できません (パス先頭か level: で指定します)` — "it has a region but its level cannot be determined".

**Cause** — **this is usually a problem with the `level` declaration rather than with how the path is written.** A space sits on a level when the first segment of its path matches a declared level name, or when it carries a `level:` attribute. The example cuts its path by an aggregation hierarchy (`/house/…`), so the first segment `house` is not a level name. Conversely, if you wrote `/L1/a` and get this, **the `level L1 0` line is missing** — writing `/L1/` in a path does not declare a level.

**Fix** — one of two.

- You want the path cut by an aggregation hierarchy (`/home/ldk` and the like) → write `level:` on the space: `space /house/a room X1..X2 Y1..Y2 level:L1`
- You want the path's head to state the level (`/L1/a`) → add a `level L1 0 h:2400 slab:150` line to the base layer

**Why it is an error** — z is undetermined, so **not one solid is generated** from this space. No floor, no ceiling, no roof, no walls, and nothing in the plan drawing either. This is the state in which `koyu plan` dies with "there is no space with a region on level …".

<a id="suf03"></a>
### SUF03 — no slab, so no floor is generated

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2
```

`レベル L1 に slab: が無く、この階の床が一枚も生成されません` — "level L1 has no `slab:`, so not one floor is generated on this storey".

**Cause** — only a `level`'s `slab` (the floor-construction thickness: slab plus void plus finish) gives a floor ([ADR-0024](../../docs/decisions/0024-fabric.md)). There is no operation that places a floor; writing `slab` *is* declaring the floor. Leave it out and not one floor is generated on that storey. On top of that, the height invariant ([HGT01](#hgt01)) cannot be formulated without the level above's `slab`, so the storey below goes unchecked as well.

**Why it stops at a warning** — because the shape itself is settled. "No `slab`, no floor element" is a deterministic rule; it is not a case of several shapes coming out of one composition. But **that the building ends up with no floors ought to be told.**

**Fix** — write `slab:` on the level (`level L1 0 h:2400 slab:150`). A roof level holding no space (`level R 5800 slab:500`) carries nothing that could have a floor, so this never fires for it — that level exists only to give the top storey its upper bound.

<a id="suf04"></a>
### SUF04 — no level above, so no shape is generated

`warning`

```muro-warn
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/s stair X1..X2 Y1..Y2 stair:N
```

`L2 の上にレベルが無いため、/L2/s の形は生成されません` — "there is no level above L2, so no shape is generated for /L2/s".

**Cause** — a vertical circulation's shape is settled by "from this level's FL to the next level's FL". A stair on the top storey has nowhere to climb to, so no steps are generated (on that storey's plan only the flight coming up from below appears). The declaration is there and the shape is not: a matter of sufficiency.

**Fix** — if the stair goes out to the roof, declare the roof surface as `level R`. If it does not, drop the declaration.

## Levels — LVL

<a id="lvl01"></a>
### LVL01 — the levels have the same z

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
level L2 0
```

`レベル L1 と L2 のzが同じです`

**Cause** — two levels are at the same height. Their order in z is undetermined, so neither which is above which nor the floor-to-floor height is settled. It also appears when a **range declaration** (`level L4..L10 11000 pitch:3000`) collides at the same z with an individual declaration.

**Fix** — correct the z. If you only want another name for the same storey, bundle it with a `zone` rather than a level.

## Zones — ZON

<a id="zon01"></a>
### ZON01 — there are no spaces beneath the zone

`warning`

```muro-warn
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
zone /wing name:西棟
```

`ゾーン /wing の下に空間がありません`

**Cause** — a zone bundles the spaces beneath it by path prefix. There is nothing to bundle, so its area is 0 and nothing of it appears in the aggregations. The zone's path being offset from the spaces' paths (`/wing` versus `/L1/wing/…`) is almost the whole of it.

**Fix** — match the zone's path to the **common prefix** of the spaces beneath it. To bundle `/L1/wing/a`, use `zone /L1/wing`. If you simply have not written the spaces yet, writing them makes it go away.

<a id="zon02"></a>
### ZON02 — there is a space with the same path as a zone

`warning`

```muro-warn
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/a/x room X2..X3 Y1..Y2
zone /L1/a name:重なった名
```

`ゾーンと同じパスの空間があります (どちらかに寄せます): /L1/a` — "settle on one of them".

**Cause** — the path is identity, yet the same path carries both a space (an entity with geometry) and a zone (an aggregation). A reading exists in which the area is counted twice.

**Fix** — settle on one. To subdivide the whole into rooms, remove `space /L1/a`'s region and make it `zone /L1/a`. If you are not subdividing, delete the `zone` line. **The correct form when subdividing a dwelling into rooms is "make the parent a `zone` and the children `space`s"** (see [GEO02](#geo02)).

## The site — SIT

The site checks take as their subject a zone carrying `site:1` and the `polygon` corresponding to it (the given shape, from a survey).

<a id="sit01"></a>
### SIT01 — the site shape has duplicate vertices

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地形状に重複する頂点があります (0,0)`

**Cause** — two consecutive vertices are at the same point (within 1 mm). The typical case is pasting survey data where the final point duplicates the start. With a zero-length edge, neither the area calculation nor the intersection test can be trusted.

**Fix** — delete the duplicate vertex. The polygon is treated as closed, so **there is no need to write the start point again at the end.**

<a id="sit02"></a>
### SIT02 — the site shape is self-intersecting

`error`

```muro-bad
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 0,10000 10000,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地形状が自己交差しています (5000,5000 付近)` — "near (5000,5000)".

**Cause** — the edges cross each other (a bow-tie). The **order** of the vertices is wrong. Neither the area nor the inside/outside test can be defined, so the site checks are abandoned from there.

**Fix** — reorder the vertices along the perimeter (clockwise or counter-clockwise, either is fine). The message prints the coordinates of the intersection, so look at the two edges near it.

<a id="sit04"></a>
### SIT04 — there is no zone corresponding to the polygon

`warning`

```muro-warn
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
polygon /site 0,0 10000,0 10000,10000 0,10000
space /L1/a room X1..X2 Y1..Y2
```

`polygon /site に対応するゾーンがありません`

**Cause** — a `polygon` is written against a zone's path. With no corresponding zone, this shape is not used as a site — neither area, nor frontage, nor the escape check runs. Either the `zone` was forgotten or the path is spelled differently.

**Fix** — declare a zone at the same path: `zone /site name:敷地 site:1`. Without `site:1` it does not become the subject of the `site` query, so do not forget it.

## Identity — UID

A `uid` is an opaque token, unique across the whole model spanning `space` and `zone`. It is used to say that something is the same thing after its path changes, and `diff`'s rename detection reads it ([ADR-0015](../../docs/decisions/0015-identity-uid.md)).

<a id="uid01"></a>
### UID01 — a uid cannot be a digits-only token

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:0123
```

`uid は数字だけのトークンにできません: uid:123 (sp-123 のような形にします)` — "make it something like sp-123".

**Cause** — an attribute value in numeric form is held as a number. Write `0123` and it becomes `123`, losing the distinction of the token written (the message saying `uid:123` is exactly that). For a token that carries identity this is not allowed.

**Fix** — mix in something that is not a digit. Adding a prefix, as in `uid:sp-0123`, is the easy way.

<a id="uid02"></a>
### UID02 — a uid cannot contain whitespace

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:"sp 1"
```

`uid に空白は使えません: "sp 1"`

**Cause** — quoting lets a value contain whitespace, but a `uid` is an opaque token and does not permit it. An empty value is refused likewise.

**Fix** — replace the whitespace with a hyphen or an underscore (`uid:sp-1`).

<a id="uid03"></a>
### UID03 — a duplicate uid

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:sp-1
space /L1/b room X2..X3 Y1..Y2 uid:sp-1
```

`uid が重複しています: sp-1 (space /L1/a — <絶対パス>/bad.muro:4行目, space /L1/b — <絶対パス>/bad.muro:5行目)`

**Cause** — the same `uid` appears in two places. It must be unique across `space` and `zone`. It appears when a line was copied and the `uid` was not corrected. The message and `related` list every origin.

**Fix** — change one to a different token. When it collides with another layer under composition (`import`), deciding a prefix per layer reduces the accidents.

## Interpreted attribute values — ATT

**A value you wrote but that could not be interpreted does not quietly fall back to the default**
([ADR-0028](../../docs/decisions/0028-diagnostics-per-declaration.md)).
Which attributes the tools read is the contract in [spec/vocabulary.md](../../spec/vocabulary.md) (marked ★),
and a value that does not match the ledger's type is an error.

The silence costs most when **the attribute is the entrance to another check**.
Writing `site:yes` stops the site checks (SIT03 — the building escaping the site outline, an error) from
running at all, and writing `h:35OO` erases the height invariant (HGT01 — eating into the storey above).
In both cases `check` stays green and only the answer disappears.

<a id="att01"></a>
### ATT01 — the attribute takes a positive number

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2 h:35OO
space /L2/a room X1..X2 Y1..Y2
```

`/L1/a の h は正の数値で書きます: h:35OO`

**Why** — a value meant as a number does not read as one. `35OO` (letter O instead of digit 0), `3500mm` (with a unit) and `1/12` (a fraction) are all carried as strings, and the reader treats them as unwritten and falls back to the default. `level`'s own `h:` turns the same mistake into a syntax error on the spot; only a space's `h:` sat outside that guard.

**Fix** — write a positive number with no unit. Every length is in mm, so units are never written. A ramp's `slope:` takes **the denominator only** (`slope:12` means 1/12).

<a id="att02"></a>
### ATT02 — the value is not in the ledger's vocabulary

`error`

```muro-bad
grid X 0 5000
grid Y 0 5000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:yes
polygon /site 0,0 5000,0 5000,5000 0,5000
space /site/a room X1..X2 Y1..Y2 level:L1
```

`ゾーン /site の site は 0 / 1 のどれかです: site:yes`

**Why** — an attribute whose value set is fixed was given a spelling outside that set: `site` (0/1), `ceiling` (0/1), `turn` (R/L), `style` (hinged/sliding/auto). Case matters — `turn:l` is not `turn:L`.

**Fix** — use the ledger's spelling. `site:1` declares that this zone is the site, and it is the entrance to the site's area, frontage and containment checks (SIT01–SIT05) as well as to the `site` subcommand.

<a id="att03"></a>
### ATT03 — the attribute is not in the ledger

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 heigh:2200
```

**Cause** — a key that is not in the element's ledger ([spec/vocabulary.md](../../spec/vocabulary.md)) was written without a namespace. **A single wrong letter silently does nothing**: `heigh:2200` is not a ceiling height, and it silences the height invariant (HGT01) entirely.

Attributes come in three layers ([spec/en/scope.md §7](../../spec/en/scope.md)). The **structure** and **interpreted** layers are read by the tools, so the ledger is the contract; the **carry** layer is only transported, so anyone may write it. Requiring a namespace on the carry layer is the only way to tell the two apart by sight.

**Fix** — check the spelling. If the value really is free (sensor readings, survey data, a third party's ledger), give it a **dot-separated namespace**.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 h:2200 acme.sensor:23 bems.temp:22.5
```

Core gives no meaning at all to a namespaced attribute — it checks no value domain and uses it in neither derivation nor validation. **It can be carried but is not judged**, and saying so explicitly is the point of the layer.

## Daylight — DAY

<a id="day01"></a>
### DAY01 — daylight is either 1 (in scope) or 0 (out of scope)

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 daylight:yes
```

`daylight は 1 (採光判定の対象) か 0 (対象外) です: /L1/a に daylight:yes` — "daylight is either 1 (in scope for the daylight check) or 0 (out of scope); /L1/a carries daylight:yes".

**Cause** — `daylight` is the binary declaration of whether `light`'s 1/7 test applies to a room, and it is the **sole entrance** to that check ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). A spelling like `daylight:yes` or `daylight:true` would pass as a free attribute and drop the room silently out of scope — a total loss of the verdict — so any value but 0 or 1 is rejected.

**Fix** — write `daylight:1` (test it) or `daylight:0` (do not). The type may be anything at all: `wet` with `daylight:1` is in scope, and `bedroom` with nothing written is not.

## Vertical circulation — RUN

Stairs, ramps, escalators and lifts are one relation — "you can pass between levels" — differing only in the device ([ADR-0021](../../docs/decisions/0021-vertical-circulation.md)). The **topology** (which level connects to which) is carried by vertical boundaries (`stack` / `boundary type:stair`); the **shape** (flights, landings, slope) is derived from the space's declaration. RUN codes name the mismatches between those two, and the soundness of values that were never written.

<a id="run01"></a>
### RUN01 — more than one vertical-circulation declaration

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N ramp:N
space /L2/s stair X1..X2 Y1..Y2
```

`縦動線の宣言が複数あります: stair:N ramp:N (一つの空間に一つです)`

**Why** — `stair:` `ramp:` `escalator:` `lift:` each select a **shape-generation rule**, and one space cannot have its shape produced by two rules. A space where a stair and a ramp coexist is, in fact, two spaces.

**Fix** — split the space and write one declaration in each.

<a id="run02"></a>
### RUN02 — the value must be a direction of travel, N/E/S/W

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:up
space /L2/s stair X1..X2 Y1..Y2
```

`stair の値は上る向き N/E/S/W です: stair:up`

**Why** — laying out treads needs to know which way the run climbs. It is the one piece of information that cannot be derived from the region, so it has to be written. The value is a compass direction (N=+Y, S=-Y, E=+X, W=-X); only `lift:` has no direction and takes `1`.

**Fix** — write a direction, e.g. `stair:N`.

<a id="run03"></a>
### RUN03 — a run's region must be a single rectangle

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 + X2..X3 Y1..Y2 stair:N
space /L2/s stair X1..X3 Y1..Y2
```

`縦動線の領域は矩形一つです (合併は段割りが決まりません): /L1/s`

**Why** — the layout is fixed by a length along travel and a width across it. A union of rectangles has no single answer for either.

**Fix** — give the stair shaft one rectangle. An L-shaped shaft is usually better written as a stair plus a landing hall.

<a id="run05"></a>
### RUN05 — invalid `form`

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y2 stair:N form:spiral
space /L2/s stair X1..X2 Y1..Y2
```

`form は straight / return です: form:spiral (螺旋は折返しの連続として書きます)`

**Why** — koyu has no curves. Spiral stairs and helical ramps are approximated as a succession of half-turns ([ADR-0021](../../docs/decisions/0021-vertical-circulation.md) records this as an explicit surrender rather than a silent approximation).

**Fix** — use `form:return`, or stack half-turns across several levels.

## Lines — LIN

`line` realises a boundary as **an act of design** rather than as something derived from adjacency ([ADR-0022](../../docs/decisions/0022-lines.md)). Space is the noun, line is the verb, boundary is where they meet — everything that fixes a position is a line, and grid lines (shared), site edges (given) and `line` (drawn) differ only in provenance.

<a id="lin01"></a>
### LIN01 — the line does not separate the two spaces

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1,Y1 X1,Y2
```

`線 X1,Y1..X1,Y2 は /L1/a と /L1/b を分離していません (二つの割付が線の両側に来るように引きます)`

**Why** — a drawn line redistributes the union of the two spaces' declared cells across its two sides. If both cells lie on the same side there is nothing to redistribute. Which side a space takes is decided by where its area lies; a space the line bisects exactly takes the side opposite its partner — and if neither has a bias, nothing decides.

**Fix** — draw the line between the two cells. Check that you meant to move the boundary's realisation rather than to move the cells themselves.

<a id="lin02"></a>
### LIN02 — a vertical boundary cannot carry a line

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/a void X1..X2 Y1..Y2
boundary /L1/a /L2/a type:void
  line X1,Y1 X2,Y2
```

`垂直境界に線は描けません (線は平面を区切る行為です): /L1/a | /L2/a`

**Why** — a line divides space in plan, and vertical boundaries (`stair` / `shaft` / `void`) have no segment in plan. To make the edge of a void diagonal, draw the line on **the horizontal boundary of that level** — between the void and the room next to it.

**Fix** — move the line onto a horizontal boundary of the same level.

<a id="lin03"></a>
### LIN03 — the line cuts nothing

`warning`

```muro-warn
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2,Y1 X2,Y2
```

`線 X2,Y1..X2,Y2 は何も切っていません (既定の隣接線と同じか、割付の外にあります)`

**Why** — either the line sits exactly where the derived adjacency line already is (so writing it changes nothing), or the cells do not reach the extent the line covers. The first is harmless, but **a line that does nothing should still say so**.

**Fix** — redraw the line where you meant it, or delete it. A mistyped endpoint that was meant to be diagonal shows up here.

## Columns — COL

A column declaration carries a size, the levels and (optionally) the grid lines — **never a position** ([ADR-0023](../../docs/decisions/0023-columns.md)). Columns stand where grid lines cross and there is floor on that level: the same move that makes walls appear from boundaries, applied to a point element.

<a id="col01"></a>
### COL01 — the declaration produces no columns

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
column 600 L2
```

`柱の宣言に対して立つ柱がありません (通りの交点に床がありません): L2 600角`

**Why** — a column stands at "grid intersection ∩ floor on that level". If no space of that level covers any intersection, nothing is generated. Usually the level is wrong, the `x:` / `y:` restriction is mistyped, or that floor has not been written yet.

**Fix** — correct the level or drop the restriction. If the intent was only to slim the columns higher up, check that the level range matches floors that actually exist.

<a id="col02"></a>
### COL02 — overlapping column declarations

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
column 600 L1
column 800 L1
```

`この柱の宣言 (L1 800角) は同じ交点を先の宣言に取られていて、一本も立ちません (同じ交点では先の宣言が勝ちます)`

**Why** — two columns never stand at the same intersection, so the earlier declaration wins and the later size is silently ignored. There is no implicit "take the larger" rule.

**Fix** — restrict the declarations with `x:` / `y:` so they do not overlap, or merge them into one.

## Versions — VER

<a id="ver01"></a>
### VER01 — a koyu 0.1 file has a touching pair with no boundary declared

`error`

```muro-bad
koyu 0.1
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a hall X1..X2 Y1..Y2
space /L1/b hall X2..X3 Y1..Y2
```

`koyu 0.1 のファイルに境界が宣言されていない接触ペアがあります: /L1/a | /L1/b — 0.2では既定の壁が導出され意味が変わります。境界を宣言するか、koyu 0.2 へ上げます` — "in 0.2 a default wall is derived and the meaning changes; declare the boundary, or raise it to koyu 0.2".

**Cause** — in 0.1, "they touch but there is no boundary" stopped at a warning and no boundary grew. In 0.2 a default wall is derived ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)). Since the same file means different things under different versions, it is not silently read with the new meaning. An older version is accepted **only when meaning is preserved** ([ADR-0017](../../docs/decisions/0017-language-versioning.md)).

**Fix** — take one of the two choices the message offers.

- Have it read with the new meaning → make the first line `koyu 0.2`
- Keep 0.1's meaning → write the `boundary` explicitly for the pair named

**Note** — a file that omits the version declaration is always read with the newest version's semantics (`0.4`), so this code does not appear. Write the version in files whose meaning you want pinned. (The message body cites `0.2` because this code is the rule at the boundary between `0.1` and `0.2`.)

<a id="ver02"></a>
### VER02 — a koyu 0.3 file has a room with no daylight

`error`

```muro-bad
koyu 0.3
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

`koyu 0.3 のファイルに daylight の無い room があります: /L1/a — 0.4では型から採光の対象を推定しないので判定から外れます。daylight:1 (対象) か daylight:0 (対象外) を書いてから koyu 0.5 へ上げます` — "0.4 does not infer the daylight scope from the type, so this room falls out of the check; write daylight:1 or daylight:0, then raise the file to koyu 0.5".

**Cause** — 0.3 and earlier inferred five types (`unit`, `room`, `ldk`, `bedroom`, `living`) to be in scope and put them in the daylight check. 0.4 does not infer the scope from the type at all ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). Raise the version without writing `daylight` and this room **falls silently out of scope, and `light` returns output indistinguishable from "everything passed"**. Since an older version is accepted only when meaning is preserved ([ADR-0017](../../docs/decisions/0017-language-versioning.md)), it is stopped here.

**Fix** — state whether each room named is to be tested, then raise the version.

- It is to be tested → add `daylight:1`
- It is not (you had been writing storage or a closet) → add `daylight:0`
- Either way, once that is written, make the first line `koyu 0.5`

**Note** — a room that already carries `daylight` means the same thing under both versions, so this code does not appear for it. Nor does it appear in a file that omits the version declaration, which is read as the newest version.

<a id="ver03"></a>
### VER03 — a koyu 0.4-or-earlier file uses 0.5 vocabulary

`error`

```muro-bad
koyu 0.4
grid X 0 3000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
```

`koyu 0.4 のファイルに 0.5 の語があります: /L1/s の stair: (縦動線) — koyu 0.5 へ上げます`

**Why** — the words introduced in 0.5 — vertical-circulation declarations (`stair:` `ramp:` `escalator:` `lift:`), drawn lines (`line`), columns (`column`) and basements (`underground:`) — mean nothing to a 0.4 toolchain. There they are read as free attributes and **the shape is silently not generated**. Old versions are accepted only when meaning is preserved ([ADR-0017](../../docs/decisions/0017-language-versioning.md)), so this stops here.

**Fix** — make the first line `koyu 0.5`. If you are not using the new words, 0.4 remains fine.

## Syntax — SYN

<a id="syn01"></a>
### SYN01 — a syntax or composition error

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X9 Y1..Y2
```

`未定義の通り名です: X9`

**Cause** — SYN01 is not an individual code but **a copy, gathered into one, of the exception the parser threw**. Since the file never became a model, not one semantic check ran. With even a single syntax error, the result of `check` is just "one SYN01".

**Caution** — this code appears only under `koyu check <file> --json`. A `check` without `--json`, and every other command, emit the exception as-is as `✖ <origin>:<line>行目: <body>` and exit 1. Only under `--json` is it copied into a single SYN01, so that valid JSON can still be returned.

**Common bodies and their fixes**

| Body | Cause | Fix |
|---|---|---|
| `未定義の通り名です: X1` | `grid X` has not been written yet | Write `grid X` / `grid Y` **before** any line using a grid line. `grid` and `level` cannot be forward-referenced (a `boundary` can) |
| `未定義の通り名です: X9` | That grid line exceeds the number in the grid | With `grid X 0 3600 7200` only X1–X3 exist. Add more, or fix the reference |
| `領域は X?..X? と Y?..Y? の2つで指定します` | **The type (the second positional) was forgotten** — `space /L1/a X1..X2 Y1..Y2` | Add the type: `space /L1/a room X1..X2 Y1..Y2`. The message talks about the region, but the cause is usually the missing type |
| `space /L1/a に型(語彙)が要ります` | Neither type nor region | Add the type |
| `door には幅 w:(mm) が要ります (アセット側でも可)` | The opening has no `w:` | Write `door w:800`, or reference an asset that carries a width (`door SD1`) |
| `未知のキーワードです: door` | The opening, `seg`, or `area` **is not indented** | Put whitespace at the head of the line so it is subordinate to its parent (`boundary` / `space`) |
| `未知のキーワードです: wall` | That keyword does not exist | A wall is a relation, not a thing. Use `boundary` |
| `未宣言のレベルです: level:L9` | What `level:` points at does not exist | Declare `level L9 …`, or fix the spelling |
| `属性キーが重複しています: name` | The same key twice on one line | Consolidate into one. The later one is never silently taken |
| `引用符が閉じていません` | An odd number of `"` | Close it |
| `属性は key:value で書きます: …` | A token with no `:` is in an attribute position | Make it `key:value`. To include whitespace in a value, wrap it in `"…"` |
| `レベルが重複しています: L2` | The same level name declared twice (including a clash with a range declaration) | Delete one |
| `grid X は一度だけ宣言します (合成時はbase層で)` | Several layers carry a `grid` | Consolidate into the base layer (the entry) |
| `ファイルが読めません: ./assets.muro` | The `import`'s relative path is wrong | A path is resolved **relative to the file it is written in** |

**Note** — **a misspelled attribute key is not detected.** Write `nmae:居室A` and it is carried through as an uninterpreted free attribute, and `check` is green. The ledger of interpreted attributes is in [spec/vocabulary.md](../../spec/en/vocabulary.md). Likewise the type (the second positional) is an open vocabulary, so writing `bedroom` as `bedrom` is not an error — it simply drops out of the daylight scope, silently.

<a id="bnd07"></a>
## A retired number — BND07

`BND07` is **retired**. It was once the warning "these touch but no boundary is declared", and it was abolished by [ADR-0014](../../docs/decisions/0014-default-boundaries.md). An undeclared contact came to mean "wall" rather than "undefined", and the declaration the warning was prompting for was replaced by the default derivation. The code is not in the ledger (`DIAGNOSTIC_CODES`).

## What a green check is not looking at

**`check` only looks at the consistency of the composition, not at whether it works as a building.** Two things in particular pass through green.

**A sealed building.** The default between touching spaces is a wall, and a wall is impassable without a door. So `check` is green with not one door written. You can write a two-storey house, think it is right because `check` passed, and find there is no way out of the bedroom.

```sh
koyu doors <file> /L2/bed /out/road
```

If that answers "cannot reach", the circulation is not connected. Run it at least once after `check`.

**Daylight.** `check` is green with not one window written. `koyu light <file>` gives the 1/7 verdict per habitable room (exit code 1 = some room falls short).

The details of the commands are in [cli.md](cli.md).

## Related

- [spec/semantics.md](../../spec/en/semantics.md) §5 — the ledger of codes, severities, and summaries (normative)
- [spec/language.md](../../spec/en/language.md) — the grammar and the defaults (normative)
- [spec/vocabulary.md](../../spec/en/vocabulary.md) — the ledger of interpreted attributes (normative)
- [cli.md](cli.md) — how to call `check` and its flags, and the other commands
- [api.md](api.md) — using `checkDiagnostics` / `DIAGNOSTIC_CODES` from a program
- [ADR-0016](../../docs/decisions/0016-diagnostic-contract.md) — why the diagnostic contract took its present form
