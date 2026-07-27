**English** · [日本語](../validation.md)

# Validation rules

**This page is not about `check`.** `check` says only that what is written is not self-contradictory as data; it says nothing about whether the building is sound (see [spec/scope.md](../../spec/scope.md)). Daylight, envelope continuity, stair proportions, site containment — every architectural judgement comes from `koyu validate`.

Diagnostics carry a code like `BND04` and `error`/`warning`. Validation findings carry a **rule name** like `daylight.ratio` and `violation`/`caution`. The two are different types and cannot be mixed.

```sh
koyu validate examples/tower/main.muro
koyu validate examples/tower/main.muro --json
```

**This surface does not freeze.** Rules are added, sharpened, and dropped. Only core freezes — which is what makes this side cheap to change. The normative ledger lives in [spec/validation.md](../../spec/validation.md).

## Levels and exit codes

| level | meaning | `koyu validate` exit code |
|---|---|---|
| `violation` | a rule is not met | 1 |
| `caution` | suspicious, or not fully counted | 0 |

## Daylight — daylight

<a id="daylight-ratio"></a>
### `daylight.ratio` — daylight is insufficient

`violation`

```muro-fail
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
```

**Cause** — the effective window area is below one seventh of the floor area.

**Fix** — enlarge or add windows, or check that `h:` is written (windows without `h` cannot be counted).

<a id="daylight-unknown"></a>
### `daylight.unknown` — the window area could not be fully counted

`caution`

```muro-caution
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:3000 edge:S
```

**Cause** — a `window` without `h` has no area and was dropped from the sum.

**Fix** — write `h:` on that window, or drop `daylight:1` from the room.

## The envelope — envelope


Walls appear from boundaries, but **boundaries to the outside are never derived** — the default boundary (ADR-0014) is not drawn against a space with no region, because naming the other side is itself information. As a result, a forgotten boundary to the outside becomes **a silently missing wall**. This code puts into words what you could previously only catch by looking at the drawing ([ADR-0025](../../docs/decisions/0025-envelope-gaps.md)).

<a id="envelope-gap"></a>
### `envelope.gap` — part of the outline faces nothing

`caution`

```muro-caution
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W t:200
boundary /L1/b /out t:150
```

`外皮に面していない外周があります: /L1/a — S 4000mm / N 4000mm (合計 8000mm・2区間)。外部への境界を書きます`

**Why** — of `/L1/a`'s outline, everything except the east side it shares with `/L1/b` — the north, the south and the rest of the west — faces neither another space nor a declared boundary. Because a boundary was written on the west, this level counts as **having started to describe its envelope**, so the remaining holes are counted.

**What is checked is the consistency of "finish what you started", not completeness.** A level with no boundary to the outside at all says nothing — it simply has not modelled its envelope yet, and a two-room example should not be nagged. Exterior spaces, semi-outdoor spaces (derived) and the site tiles under a `site:1` zone are not counted either: not being enclosed is normal for them.

**Fix** — write boundaries for the remaining edges, choosing them with `edge:N/E/S/W` or catching the whole remainder with one unrestricted boundary. If an edge is genuinely open, write `type:open`; if it is a railing, write `air:1` — **all of these differ from writing nothing.**


## Vertical circulation — stair / run

<a id="stair-proportion"></a>
### `stair.proportion` — the derived step dimensions are cramped

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+4600 stair:N
space /L2/s stair X1..X2 Y1..Y1+4600
stack s L1..L2 type:stair
```

`導出された段の寸法が窮屈です: 17段 蹴上176mm / 踏面150mm (2×蹴上+踏面 = 502mm、目安 550〜700mm)`

**Why** — **neither the number of risers nor the going is written anywhere.** Both fall out of the storey height and the region, which is precisely why checking the derived result is worth doing ([ADR-0021](../../docs/decisions/0021-vertical-circulation.md) — write nothing, check everything). Here the shaft is too shallow and the going comes out at 150mm.

**Fix** — deepen the shaft along travel, fold it with `form:return`, or raise `riser:` to use fewer steps. This is a dimensional warning, not a code-compliance verdict.

In a return stair each flight has its own going. The check reads the **tightest flight**, so the going reported is that flight's.

<a id="run-slope"></a>
### `run.slope` — the derived slope is steeper than declared

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
stack r L1..L2 type:stair
```

`導出された勾配 1/1.3 が宣言 1/12 より急です (走り長を伸ばすか階高を下げます)`

**Why** — the slope is not written either; it is the level difference over the derived run length. `slope:` is **not the slope but the limit you will accept**, and exists only so that this check can be made. Escalators get the same code without any `slope:` when the derived pitch leaves the usual band (about 1/1.7, i.e. 30°).

**Fix** — lengthen the ramp along travel, fold it with `form:return` to double the run, or lower the storey height.

<a id="run-disconnected"></a>
### `run.disconnected` — no vertical boundary connects the levels

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
```

`/L1/s は縦動線の形を持ちますが、上下を繋ぐ垂直境界がありません (stack か boundary type:stair を書きます — 形はあってもグラフでは通れません)`

**Why** — **shape and topology are written separately.** `stair:N` builds treads; it does not claim the two levels are connected. Without a vertical boundary (`stack` / `boundary type:stair`), `doors` will not find a route upstairs. A stair that is drawn but not walkable is the hardest mismatch to notice, so it warns.

**Fix** — add `stack s L1..L2 type:stair`. Conversely, if you want connection without a generated shape (a lift shaft, say), drop the space declaration and keep the vertical boundary.


## The site — site

<a id="site-escape"></a>
### `site.escape` — it escapes the site shape

`violation`

```muro-fail
grid X 0 10000 14000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

`/L1/a が敷地形状からはみ出しています (14000,0 付近)`

**Cause** — a space with a region has gone outside the site. Beyond the containment of the four corners it also looks at vertex intrusion and edge crossing, so it catches this correctly on a concave site too. On the boundary counts as inside (1 mm tolerance). Spaces beneath the site zone (`/site/…`) and `exterior`s are out of scope.

**Fix** — bring the layout within the site, or correct the surveyed values in the `polygon`. The message prints the coordinates of the first escaping point it found.

<a id="site-area"></a>
### `site.area` — the declared and derived site areas disagree

`caution`

```muro-caution
grid X 0 10000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地面積の宣言と導出が食い違います: 宣言 120㎡ / 導出 100.00㎡` — "declared 120 m² / derived 100.00 m²".

**Cause** — the zone's `area:` (the surveyed value) and the area computed from the `polygon` differ by more than 0.05 m². Either a mistyped vertex, a transcription error in `area:`, or a survey update reflected on only one side.

**Fix** — decide which is right and correct the other. Since `area:` is a transcription of the survey result, the thing to suspect is usually the `polygon`'s vertices. `koyu site <file>` prints both figures side by side.


<a id="site-frontage"></a>
### `site.frontage` — the road frontage is too short

`violation`

```muro-fail
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n exterior X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1
boundary /site/yard /out/road-n
```

**Cause** — the boundary segments between the site zone and a road-bearing exterior space total less than 2 m. Core derives the frontage length; the 2 m threshold is an architectural rule and lives here.

**Fix** — write the boundary that faces the road. Building walls facing the road do not count as frontage.
