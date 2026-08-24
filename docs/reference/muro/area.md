---
title: area — an uncounted subdivision and component host
mode: reference
---

# area — an uncounted subdivision and component host

```muro-part
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール floor:オーク
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
```

`area <region> [attributes...]` is written indented directly under a [space](space.md) and is an **uncounted subdivision**. A change of floor finish inside a room, the extent of an entrance slab, a fixed furniture zone — anything that holds an extent without dividing the room — belongs here.

## The isolation rule

An `area` is not a room. **It appears in no area total, no room count and no graph.**

- Gross floor area comes from the parent space's region. No number of `area` lines raises or lowers it.
- Adjacency and passage belong to the parent space. An `area` cannot carry a [boundary](boundary.md), and no door or window can be placed on one.
- It appears in neither the zone totals nor any [`stats --by`](../cli/stats.md) grouping.

An area may also host one component asset. That adds a placed footprint to `Form`; it still adds
no room, boundary, passage or counted area. The moment you want to count what you are dividing,
the answer is not an `area` but two `space` lines — make the parent a [zone](zone.md) and put
spaces with regions beneath it.

## Region

A region is written exactly as on a [space](space.md): the two tokens `X?..X? Y?..Y?`. A `+` union, however, cannot be written — one `area` is one rectangle. If several extents are needed, write several `area` lines.

Spilling outside the parent's region is the warning [SEG02](../diagnostics/seg.md). The test is made against the **derived** region rather than the declared cells, so a finish placed on the part that a [drawn line](line.md) cut away is caught here.

An `area` cannot be written on a space with no region (an `exterior`, say). That one is an error.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/hall hall X1..X2 Y1..Y2
  area X1..X2 Y1-2000..Y2 name:はみ出し
space /out outside:1
  area X1..X2 Y1..Y2 name:無理
boundary /L1/hall /out
```

```text
$ npx tsx src/cli.ts check a2.muro --json
  "code": "SEG02",
  "severity": "warning",
  "message": "The area spills outside the region of /L1/hall",
  "code": "SEG01",
  "severity": "error",
  "message": "An area cannot be written on /out, which has no region",
```

## Attributes

The following keys may be written on an `area`, plus any namespaced key containing a dot. A key
in neither category is the error [ATT03](../diagnostics/att.md).

| Key | Tier | Meaning |
|---|---|---|
| `name:` | interpreted | The subdivision's name. **It must be unique within its space** |
| `floor:` | carry | Floor finish, overriding the parent space's `floor:` over this extent |
| `spec:` | carry | The name of the thing. Carried, never interpreted |
| `asset:` | interpreted | The name of a `component` asset placed by this area |
| `align-x:` | interpreted | `min` / `center` / `max`; default `center` |
| `align-y:` | interpreted | `min` / `center` / `max`; default `center` |
| `offset-x:` | interpreted | Millimetres added along model +X; default `0` |
| `offset-y:` | interpreted | Millimetres added along model +Y; default `0` |
| `rotate:` | interpreted | Degrees counter-clockwise from model +X, in `0 <= rotate < 360`; default `0` |
| `<namespace>.<key>:` | carry | Anyone may write a dotted key, and core gives its content no meaning at all |

Neither `h:` nor `daylight:` can be written. An `area` is not a room, so it does not carry a room's attributes.

```text
✖ ar.muro:line 5: area (/L1/a) carries daylight:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.daylight:1)
```

### The name is the identity

When an `area` carries a name, that name becomes **the only way to point at that subdivision inside its space** — it is what the set edits of composition look it up by. A duplicated name within one space is therefore the error [UID04](../diagnostics/uid.md).

```text
✖ s4.muro:line 6: Duplicate area name within space /L1/a: 同名 (s4.muro:line 5, s4.muro:line 6) — the name is what identifies it inside its container
```

An `area` with no name claims no identity and is not in the population of that check.

## Component placement

```muro-part
asset WASHING-MACHINE component w:640 d:640 plan-svg:./svg/washing-machine.svg

space /L1/laundry utility X1..X2 Y1..Y2
  area X1+200..X1+1100 Y1+200..Y1+1100 name:washing-machine-pan asset:WASHING-MACHINE
```

The named area is the sole placement frame. There is no second absolute-position declaration.
Changing the area moves its component with it, and the pair `(parent space path, area name)` is
the instance identity.

Alignment uses stable model X/Y, not screen direction or compass direction. `min`, `center` and
`max` refer to the bounds of the area on each axis. Offsets are applied after alignment. A
positive `offset-x` moves along +X and a positive `offset-y` along +Y. Positive rotation is
counter-clockwise from +X.

The rotated component footprint must remain inside the host rectangle and the derived region of
its parent space. It is [CMP02](../diagnostics/cmp.md#cmp02) when either containment fails. koyu
does not resize the asset, choose another alignment or rotate it automatically. A missing name,
an undefined or wrong-kind asset, or an invalid placement value is
[CMP01](../diagnostics/cmp.md#cmp01).

An area used only as a component host is not printed as a dashed subdivision in `koyu plan`.
Writing `floor:` or `spec:` keeps the subdivision visible because it also describes a finish or
another written extent.

## The indentation rules

- **Indentation is one level deep and never nests.** Nothing can be indented under an `area`.
- An `area` belongs to the `space` line immediately above it. Any unindented line in between ends that association.
- An `area` written under a `space` that expands over a level span is attached to every expanded space.
- It cannot be written on a [band](band.md) member. A member's region is derived, so an extent inside it cannot be written in advance.

```text
✖ b9.muro:line 6: area may not be written on a band member (its region is derived — write a room that needs area by position)
```

A room that needs an extent inside it is written by position, not by band.

## Canonical JSON

An `area` is emitted under its parent space as `areas`, keeping the grid-reference spelling as written.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール floor:オーク
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
space /out outside:1
boundary /L1/hall /out
```

```text
$ npx tsx src/cli.ts json a1.muro
  "spaces": {
    "/L1/hall": {
      "type": "hall",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ],
      "attrs": {
        "floor": "オーク",
        "name": "エントランスホール"
      },
      "areas": [
        {
          "at": [
            "X1",
            "Y1",
            "X1+1800",
            "Y2"
          ],
          "attrs": {
            "floor": "モルタル",
            "name": "土間"
          }
        }
      ]
    }
  },
```

## The counterpart on a boundary

Where a finish changes along a boundary, the counterpart is `seg`: the stretch where a wall turns to glass, or where the dado is a different material. Where it goes and what governs it is in [seg](seg.md). `area` holds an extent inside a room; `seg` holds an interval along a boundary.
