---
title: Asking — doors / light / site / plan_svg
mode: reference
---

# Asking — doors / light / site / plan_svg

Four different questions put to the same description. **None of them declares a pass or a fail.** What comes back is a number or a form, not a verdict.

For a verdict, call [`validate`](tools-verify.md#validate) — whether one seventh is met, whether you can get out, whether the building escapes the site is what that tool says.

You call these four after `check` has gone green, **to confirm the consequences**. Move one partition and circulation and daylight change; change an area and coverage changes. **`check` was looking at none of it.**

Every piece of output on this page was obtained by actually running it. Absolute paths are shortened to `<abs>`.

---

## doors

> Circulation query: how many doors lie between space A and space B (the path with the fewest doors)

| Argument | Required | Contents |
|---|---|---|
| `file` | yes | The entry `.muro` path |
| `from` | yes | Path of the space to start from |
| `to` | yes | Path of the space to reach |

```json
{"name": "doors", "arguments": {"file": "<abs>/examples/two-rooms.muro", "from": "/L1/a", "to": "/out"}}
```

```text
{
 "doors": 2,
 "path": [
  "/L1/a",
  "/L1/b",
  "/out"
 ]
}
```

`doors` is the number of doors; `path` is the sequence of spaces passed through. **The route chosen is the one with the fewest doors, not the shortest one.**

Routes across storeys come out of the same question. A stair boundary carries no door, so descending ten storeys adds nothing to the count.

```text
{
 "doors": 3,
 "path": [
  "/L9/A/ldk",
  "/L9/A/hall",
  "/L9/corridor",
  "/L9/stair",
  "/L8/stair",
  "/L7/stair",
  "/L6/stair",
  "/L5/stair",
  "/L4/stair",
  "/L3/stair",
  "/L2/stair",
  "/L1/stair",
  "/out"
 ]
}
```

(`examples/mansion.muro` with `{"from": "/L9/A/ldk", "to": "/out"}`.)

### When it cannot be reached

```text
{
 "unreachable": true
}
```

**A path that does not exist gives exactly the same answer.** It is not an error. `{"to": "/nope"}`, `{"to": "/L1/x"}` (a space you forgot to write) and a genuinely sealed room are indistinguishable in this result. **Confirm the spelling with [`spaces`](tools-read.md#spaces) before you ask.**

`doors` is not a verdict on whether escape is possible. For that, read `validate`'s `access.unreachable`.

---

## light

> Daylight inputs: floor area and effective window area for every space written with daylight:1 (a 0.7 factor applies through a covered semi-outdoor space). **It delivers no verdict** — the 1/7 judgement comes from the validate tool

`file` only, required.

```text
[
 {
  "path": "/L1/a",
  "name": "居室A",
  "windowM2": 2.86,
  "floorM2": 16.2,
  "missingH": false
 },
 {
  "path": "/L1/b",
  "name": "居室B",
  "windowM2": 2.86,
  "floorM2": 16.2,
  "missingH": false
 }
]
```

| Field | Contents |
|---|---|
| `path` | The space's path |
| `name` | The value of `name:`, or the last path segment |
| `windowM2` | **Effective** area of windows facing outside, in m² |
| `floorM2` | Floor area in m² |
| `missingH` | Whether some window has no `h:`, leaving the window area under-counted |

### The population is what was declared

**Only spaces written `daylight:1` come back.** Nothing is inferred from the type. "Ask the daylight question about this room" is the writer's declaration, not the implementation's guess.

So a building that never writes `daylight:1` gets an empty array. **That means "nobody asked", not "there is enough daylight".**

```text
[]
```

### The factor is derived from the form

`windowM2` is not the plain sum of `w × h`. A factor applies according to what is on the other side of the window.

| What the window faces | Factor |
|---|---|
| `exterior` — straight outside | 1 |
| A semi-outdoor space that is open above (garden, top-floor balcony) | 1 |
| **A semi-outdoor space with something above it** (under an eave, under the balcony above) | **0.7** |
| Indoors | 0 — not counted |

A window written without `h:` **is not counted at all**, and `missingH` goes `true`. **That is the sign the number came out low** — read it before you trust `windowM2`.

### It passes no judgement

Comparing against `floorM2 / 7` is not this tool's job. **The one-seventh judgement is [`validate`](tools-verify.md#validate)'s `daylight.ratio`.** The counterpart of `missingH` is `daylight.unknown`.

---

## site

> Site query: site area (declared against derived), road frontage, footprint, and the coverage and floor-area ratios

`file` only, required.

```text
{
 "siteZone": "/site",
 "polygonVertices": 5,
 "declaredAreaM2": 1097.8,
 "derivedAreaM2": 1097.8,
 "areaMatch": true,
 "footprintM2": 569.6,
 "totalFloorM2": 4785.92,
 "coverageRatio": 51.9,
 "floorAreaRatio": 436,
 "roads": [
  {
   "path": "/out/road-s",
   "name": "南側道路",
   "widthMm": 12000,
   "frontageMm": 40600
  },
  {
   "path": "/out/road-e",
   "name": "東側道路",
   "widthMm": 6000,
   "frontageMm": 20200
  }
 ]
}
```

(From `examples/tower/main.muro`.)

| Field | When it appears | Contents |
|---|---|---|
| `siteZone` | When there is a `site:1` zone | That zone's path |
| `polygonVertices` | When a site shape is written | How many vertices the polygon has |
| `declaredAreaM2` | When the zone carries `area:` | The surveyed value as written, in m² |
| `derivedAreaM2` | When it can be derived | The area derived from the shape, in m² |
| `areaMatch` | When **both** declared and derived exist | Whether they differ by less than 0.05 m² |
| `footprintM2` | always | Building footprint in m² |
| `totalFloorM2` | always | Total floor area in m² |
| `coverageRatio` | When the site area is known | Coverage as a percentage, to one decimal |
| `floorAreaRatio` | When the site area is known | Floor-area ratio as a percentage, to one decimal |
| `roads` | always (empty array if none) | Adjoining roads: `path`, `name`, `widthMm`, `frontageMm` |

**The denominator of `coverageRatio` and `floorAreaRatio` is the declared area when there is one, and the derived area otherwise.**

### It answers even for a building with no site

```text
{
 "derivedAreaM2": 32.4,
 "footprintM2": 32.4,
 "totalFloorM2": 32.4,
 "coverageRatio": 100,
 "floorAreaRatio": 100,
 "roads": []
}
```

(From `examples/two-rooms.muro`. With no site zone there is no `siteZone` and no `declaredAreaM2`, and `derivedAreaM2` comes from the building's own outline.)

**That `coverageRatio: 100` does not mean "100% coverage".** With no site written, the building itself is being counted as the site. **Do not let anyone read those two numbers off a building with no site.**

### It compares against no limit

The coverage and floor-area limits of a zoning district are facts outside the description, so neither this tool nor `validate` holds them. **What comes back is numbers.**

What `validate` says about the site is three things: whether the building escapes the site shape (`site.escape`), whether the declared and derived areas disagree (`site.area`), and whether road frontage falls under 2 m (`site.frontage`).

---

## plan_svg

> Generates and returns the plan SVG for a level (form is generated, not written — the lowest level doubles as the site plan)

| Argument | Required | Contents |
|---|---|---|
| `file` | yes | The entry `.muro` path |
| `level` | yes | A level name (`L1`, say) |

**What comes back is the SVG string itself, not JSON.** Every other tool on the server returns JSON; this one is the exception.

```text
<svg xmlns="http://www.w3.org/2000/svg" width="682" height="782" viewBox="0 0 682 782" font-family="'Hiragino Sans','Noto Sans JP',sans-serif">
<rect width="682" height="782" fill="#faf8f4"/>
<path d="M 341 316 L 523 316 L 523 134 L 341 134 Z" fill="#f1ebdd"/>
<path d="M 159 498 L 341 498 L 341 134 L 159 134 Z" fill="#f1ebdd"/>
<path d="M 341 498 L 523 498 L 523 316 L 341 316 Z" fill="#f1ebdd"/>
<path d="M 523 498 L 598 498 L 598 84 L 523 84 Z" fill="#f8f5ec"/>
<path d="M 84 698 L 598 698 L 598 498 L 84 498 Z" fill="#f8f5ec"/>
<path d="M 159 134 L 523 134 L 523 84 L 159 84 Z" fill="#f8f5ec"/>
```

(The first eight lines of `L1` from `examples/house/main.muro`. The whole thing is 7,310 bytes and ends with these two lines.)

```text
<text x="660" y="764" text-anchor="end" font-size="9" fill="#a49b8a">koyu — generated from spaces (wall centrelines, mm)</text>
</svg>
```

**No file is written.** Only the string comes back; nothing lands on disk. Saving it is the caller's job.

**The lowest level doubles as the site plan.** If site, garden and road are written, they appear on that level's drawing.

### An undeclared level fails

```text
There is no space with a region on level L9
```

It comes back with `isError: true`. **No empty SVG is ever produced.** Confirm level names in [`model_summary`](tools-read.md#model_summary)'s `levels`.

A level with no space that has a region — a roof-only `R`, say — takes the same path.

```text
There is no space with a region on level R
```

### The form is generated, never described

The plan is written nowhere in the `.muro`. **It is derived from spaces and boundaries every time.** So the same description always yields the same drawing, and there is no way to edit the drawing directly — you edit the description.

The look (colours, line weights, typeface) is not frozen. A new version may change what the SVG contains. **Do not build on the assumption that the same drawing keeps coming back.**

## See also

- [Verifying — check / validate](tools-verify.md) — the verdicts these four withhold
- [Reading — model_summary / layers / spaces / canonical_json](tools-read.md) — confirming paths and level names
- [koyu doors](../cli/doors.md) / [koyu light](../cli/light.md) / [koyu site](../cli/site.md) — the same questions for a human
- [koyu plan](../cli/plan.md) — the same drawing written to a file
- [koyu axo](../cli/axo.md) — the axonometric. **Not available over MCP**
- [Judgement — koyu validate](../validate/index.md) — the daylight, escape and site verdicts
