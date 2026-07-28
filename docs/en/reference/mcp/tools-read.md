---
title: Reading — model_summary / layers / spaces / canonical_json
mode: reference
---

# Reading — model_summary / layers / spaces / canonical_json

Four tools that only read. **None of them writes anything.** Each takes `file`, the path of the entry `.muro`, and composes from scratch on every call.

Every piece of output on this page was obtained by actually running it. Absolute paths are shortened to `<abs>`.

## At a glance

| Tool | What comes back | When to call it |
|---|---|---|
| [`model_summary`](#model_summary) | A summary of the whole building | **First, once.** It tells you what to read next |
| [`layers`](#layers) | The full text of every layer | Before editing, to read the original |
| [`spaces`](#spaces) | The list of spaces | To enumerate paths, areas and originating layers |
| [`canonical_json`](#canonical_json) | One composed model | To hand to a machine, connect outward, or diff |

---

## model_summary

> Summary of the building: name, levels, layer composition, zones, door/window assets, areas, and check counts. Call this first

```json
{"name": "model_summary", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

`file` only, required.

```text
{
 "name": "二室",
 "unit": "mm",
 "layers": [
  "<abs>/examples/two-rooms.muro"
 ],
 "levels": [
  {
   "name": "L1",
   "z": 0,
   "h": 2400,
   "slab": 150
  }
 ],
 "spaces": 3,
 "boundaries": 3,
 "zones": [],
 "assets": [],
 "totalFloorM2": 32.4,
 "semiOutdoorM2": 0,
 "floorsM2": {
  "L1": {
   "rooms": 2,
   "subtotalM2": 32.4
  }
 },
 "byUseM2": {
  "(unspecified)": 32.4
 },
 "check": {
  "errors": 0,
  "warnings": 0
 },
 "hint": "Read layer contents with layers, check with check, and edit with write_layer (check is the gatekeeper). Architectural verdicts come from validate."
}
```

| Field | Contents |
|---|---|
| `name` `unit` | The building name and unit as written |
| `layers` | Absolute paths of every composed layer, **in lexicographic order** (same order as [`layers`](#layers)) |
| `levels` | Ascending by `z`, not declaration order. `h` and `slab` appear **only when written** |
| `spaces` | How many spaces (including region-less spaces, `exterior` and `void`) |
| `boundaries` | How many boundaries **after derivation** |
| `zones` | `path`, `name` (only when written), `site: true` (only for the site zone), `areaM2` |
| `assets` | Each door/window asset's `name`, `kind` (`door` or `window`) and all its `attrs` |
| `totalFloorM2` | Indoor floor area |
| `semiOutdoorM2` | Semi-outdoor area. **Not part of the floor area** |
| `floorsM2` | `{rooms, subtotalM2}` per level |
| `byUseM2` | Area by `use`. Spaces with no determinable `use` fall into `(unspecified)` |
| `check` | Just the `{errors, warnings}` counts. No messages |
| `sitePolygons` | Paths of zones that have a `polygon`. **The key is absent when there are none** |
| `hint` | A fixed sentence aimed at the agent |

### How the counting works

**`boundaries` is the count after derivation.** The default between touching spaces is a wall, so boundaries appear even where no `boundary` line was written — which means the count can exceed the number of `boundary` lines `layers` gives you. For the written side of the composition, use [`canonical_json`](#canonical_json).

**`totalFloorM2` counts indoor only.** `exterior`, `void`, and anything judged semi-outdoor are excluded; the semi-outdoor share is reported separately in `semiOutdoorM2`. `floorsM2` likewise lists indoor rooms only, and a level with no indoor room gets no key at all.

**`zones[].areaM2` means two different things.** For a site zone (`site:1`) that has a `polygon`, it is the polygon's area. Otherwise it is the sum of the **indoor** floor areas of the spaces under that path. So a site zone whose members are gardens and paths reads `0`.

```text
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "site": true,
   "areaM2": 0
  },
  {
   "path": "/home",
   "name": "住戸",
   "areaM2": 92.75
  }
 ],
```

(The `zones` portion of the same output against `examples/house/main.muro`. Everything under `/site` is garden and path, so the indoor sum is 0. To ask for the site area itself, call [`site`](tools-ask.md#site) — it returns `126.24`.)

Run it against an example that has a `polygon` and the polygon's area comes straight through, along with `sitePolygons`.

```text
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "site": true,
   "areaM2": 1097.8
  },
```

```text
 "sitePolygons": [
  "/site"
 ],
```

(Excerpts of the same output against `examples/tower/main.muro`.)

---

## layers

> Returns every layer (.muro file) taking part in the composition, in strength order (later layers are stronger), with its source — this is how you read the original

```json
{"name": "layers", "arguments": {"file": "<abs>/main.muro"}}
```

`file` only, required. What comes back is an array of `{file, source}`, where `source` is the file's full text, unaltered.

Take these two files.

```muro-part
# main.muro — entry
koyu 1.0
name 二層
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150

import ./L1.muro
```

```muro-part
# L1.muro
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部

boundary /L1/b /out t:150
  door w:900 h:2100 edge:S name:玄関
```

Calling it with `main.muro` as the entry gives this.

```text
[
 {
  "file": "<abs>/tiny/L1.muro",
  "source": "# L1.muro\nspace /L1/a room X1..X2 Y1..Y2 name:居室A\nspace /L1/b room X2..X3 Y1..Y2 name:居室B\nspace /out exterior name:外部\n\nboundary /L1/b /out t:150\n  door w:900 h:2100 edge:S name:玄関\n"
 },
 {
  "file": "<abs>/tiny/main.muro",
  "source": "# main.muro — entry\nkoyu 1.0\nname 二層\nunit mm\n\ngrid X 0 3600 7200\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\n\nimport ./L1.muro\n"
 }
]
```

### The order is lexicographic, not strength order

**The array is sorted by absolute path.** It is not in composition strength order. The example above shows the difference: by strength `main.muro` is the weakest base layer and `L1.muro` sits on top of it, but `L1` sorts before `main`, so `layers` returns them the other way round.

For strength order, use [`koyu layers`](../cli/layers.md). On the same two files it prints:

```text
Layers (weakest first — later layers are stronger):
  0	<abs>/tiny/main.muro
  1	<abs>/tiny/L1.muro
```

Which layer supplied the winning value of which attribute is what `koyu layers --attrs` shows. **That surface does not exist over MCP.**

### Only composed layers are visible

A file no `import` reaches does not come back. A `.muro` sitting in the directory that nobody imports never appears in `layers`, and [`check`](tools-verify.md#check) never looks inside it either.

The entry itself is always included.

---

## spaces

> List of spaces: path, type, level, area, semi-outdoor flag, and originating layer. Optionally filtered by level

```json
{"name": "spaces", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

| Argument | Required | Contents |
|---|---|---|
| `file` | yes | The entry `.muro` path |
| `level` | no | A level name. Given, it narrows the list to that level |

```text
[
 {
  "path": "/L1/a",
  "type": "room",
  "name": "居室A",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 },
 {
  "path": "/L1/b",
  "type": "room",
  "name": "居室B",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 },
 {
  "path": "/out",
  "type": "exterior",
  "name": "外部",
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 }
]
```

| Field | Contents |
|---|---|
| `path` | The space's path |
| `type` | The type as written (`room`, `ldk`, `hall`, `exterior`, `void`, …) |
| `name` | The value of `name:` if there is one, otherwise the last path segment |
| `level` | Its level. **The key is absent when there is none** |
| `areaM2` | Floor area to wall centrelines. **The key is absent for a space with no region** |
| `semiOutdoor` | Whether it was judged semi-outdoor |
| `layer` | Absolute path of the layer that declared it |

`/out` above shows both absences at once: an `exterior` with neither a region nor a level gets neither `level` nor `areaM2`.

**Nothing is filtered out.** `exterior`, `void` and region-less spaces are all in the list. If you want to count what is indoor, read `semiOutdoor` and `type` yourself. If all you want is the totals, [`model_summary`](#model_summary) is faster.

Narrowing by `level` puts site and building spaces side by side.

```text
[
 {
  "path": "/site/garden",
  "type": "garden",
  "name": "南庭",
  "level": "L1",
  "areaM2": 41.12,
  "semiOutdoor": true,
  "layer": "<abs>/examples/house/site.muro"
 },
```

(The head of the result for `{"file": "<abs>/examples/house/main.muro", "level": "L1"}`; the same call returns six entries.)

`layer` is the key to deciding where an edit goes. The path printed there is exactly what [`write_layer`](tools-write.md#write_layer) takes as its `layer` argument.

---

## canonical_json

> The canonical JSON (machine format — one composed model, byte-stable). The ground for diffing and for external connections

```json
{"name": "canonical_json", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

`file` only, required. Returns the composed building as one JSON document a machine can read.

```text
{
 "format": "koyu-canonical/1.0",
 "koyu": "1.0",
 "name": "二室",
 "unit": "mm",
 "grid": {
  "X": [
   0,
   3600,
   7200
  ],
  "Y": [
   0,
   4500
  ]
 },
 "levels": {
  "L1": {
   "z": 0,
   "h": 2400,
   "slab": 150
  }
 },
```

(The head of it; the same call goes on to return `spaces` and `boundaries`.)

**Only what was written goes in.** Derived default walls do not. For the two-room example with no doors written, [`check`](tools-verify.md#check) answers `"boundaries": 1` while `canonical_json`'s `boundaries` is empty. **This is where you count what was actually written.**

**The indent is one space, so it is not byte-identical to the file [`koyu json`](../cli/json.md) writes** — every MCP tool response is written with a one-space indent. Key order and values are the same, so parsing both and comparing agrees. When you need a byte-stable form, use the CLI.

## See also

- [Writing — write_layer / new_uids](tools-write.md) — editing the layers you read here
- [Verifying — check / validate](tools-verify.md) — the gatekeeper after a write
- [Asking — doors / light / site / plan_svg](tools-ask.md) — confirming the consequences
- [koyu layers](../cli/layers.md) — strength order and attribute provenance
- [koyu json](../cli/json.md) — the byte-stable canonical JSON
- [koyu stats](../cli/stats.md) — the same areas laid out for a human
