**English** · [日本語](../../howto/troubleshooting.md)

# Getting unstuck

Look up a cause and a fix from the message you got.

Error text can be searched for by exact match. The human output takes the form `file:line: body`, so the tables below carry only the body. When you want the diagnostic code (BND04 and so on), use `koyu check <file> --json` — codes do not appear in the human output.

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- `npx tsx src/cli.ts check <file.muro>` runs.
- The exit code is 1 if there are errors and 0 if green. Warnings alone give 0 (adding `--strict` makes it 1).

## An index of symptoms

### check stops with an error

| Symptom (the body) | Cause | Fix | More |
|---|---|---|---|
| `未定義の通り名です: X1` (undefined grid name) | There is no `grid`, or it comes after a line using a grid reference | Write `grid X` and `grid Y` before the first line that uses them | [1](#1-undefined-grid-name) |
| `空間が接していないため境界を導けません: /L1/a \| /L1/b` (the spaces do not touch, so no boundary can be derived) | They meet only at a corner. Contact requires a shared edge of nonzero length | Extend a rectangle so they share an edge, or delete that `boundary` line | [2](#2-the-spaces-do-not-touch) |
| `境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/living \| /out)` (several boundary segments) | A boundary with the outside splits across several edges of the room's perimeter | Select the side on the opening with `edge:`. `N`=+Y, `S`=−Y, `E`=+X, `W`=−X | [3](#3-several-boundary-segments) |
| `領域は X?..X? と Y?..Y? の2つで指定します` (a region takes two tokens) | Almost always a forgotten type (the second positional). The first region token is being read as the type | Write in the order `space <path> <type> X?..X? Y?..Y?` | [4](#4-a-region-takes-two-tokens) |
| `空間の領域が重なっています: /L1/home と /L1/home/ldk` (the regions overlap) | A space with a region has child spaces that also have regions | Make the parent a `zone`; a `zone` has no geometry | [5](#5-the-regions-overlap) |
| `未定義の空間を参照しています: /L1/bath` (referencing an undefined space) | A misspelled path, or the layer declaring that space is not `import`ed | Fix the path, or add the `import` | [6](#6-referencing-an-undefined-space) |
| `door には幅 w:(mm) が要ります (アセット側でも可)` (a door needs a width) | The opening has no width | Write `door w:800`, or reference an `asset` that carries a width | [spec/language.md §4](../../../spec/en/language.md) |

### check is green but it is not right

| Symptom | Cause | Fix | More |
|---|---|---|---|
| `⚠ /L1/a は領域を持ちますが、レベルが特定できません` (its level cannot be determined) | No `level` was declared. **Writing `/L1/` in a path is not a declaration of a level** | Write `level L1 0` | [7](#7-its-level-cannot-be-determined) |
| `plan` emits a raw Node stack trace (`Error: レベルが定義されていません`) | The same — there is not one `level` | Write `level L1 0` | [8](#8-plan-emits-a-raw-stack-trace) |
| `Error: レベル L2 に領域を持つ空間がありません` (no space with a region on level L2) | A wrong level name in `plan -l`. Level names are case-sensitive | Confirm the name with `koyu levels <file>` | [8](#8-plan-emits-a-raw-stack-trace) |
| `check` is green but `doors` says unreachable | Touching spaces get a derived wall with no door. Doors are never automatic | Write a `boundary` for the pair you want passable, and put a `door` under it by indentation | [9](#9-green-check-but-unreachable) |
| `check` is green but there is no envelope at all | Nothing is derived for contact with the outside (a space with no region) | Write the boundaries to `/out`, one at a time | [10](#10-green-check-but-no-envelope) |
| The daylight verdict changes, or fails to change, when you change a type | The type is an open vocabulary, and a misspelling passes silently | Confirm which types the tools read structurally | [11](#11-misspelled-types-and-attribute-keys-pass-silently) |
| An attribute has no effect (`nmae:` and the like) | A misspelled attribute key is also carried silently | Check it against the ledger ([spec/vocabulary.md](../../../spec/en/vocabulary.md)) | [11](#11-misspelled-types-and-attribute-keys-pass-silently) |
| An empty file returns `✔ 整合 — 空間 0 / 境界 0` | A composition with nothing written does stand up | Do not treat green as evidence that something is written. Look inside with `stats` or `graph` | [12](#12-an-empty-file-is-green-too) |
| `敷地面積の宣言と導出が食い違います` (SIT05) | The `area:` on the `zone` (surveyed) and the polygon's area differ by more than ±0.05 m² | Fix one of them. If the surveyed value is right, fix the vertices | [Give the site its shape](site-and-far.md) |
| The boundary count from `check` does not match `boundaries` in the canonical JSON | `check` counts after derivation; the canonical JSON holds only the authored composition | It is not a discrepancy. To see the derived state, use `graph` | [13](#13-the-boundary-count-does-not-match-the-canonical-json) |

## The fixes

### 1. Undefined grid name

`grid` is one of the few lines where declaration order matters. A `boundary` may refer forward to spaces, but `grid` and `level` must precede any line that uses them.

```muro-bad
level L1 0
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ nogrid.muro:2行目: 未定義の通り名です: X1
```

Neither `grid X` nor `grid Y` is present. An error of order alone gives the same wording.

```muro-bad
space /L1/a room X1..X2 Y1..Y2
grid X 0 3600
grid Y 0 4000
level L1 0
```

```text
✖ order.muro:1行目: 未定義の通り名です: X1
```

**The fix.** Gather the foundation declarations at the top of the file. When composing, put them in the base layer (the entry).

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0
```

The same wording appears when you write a grid name that does not exist, such as `X5`. `grid X 0 3600 7200` creates only three: `X1`, `X2`, `X3`.

### 2. The spaces do not touch

Two rooms meeting only at a corner do not touch. A boundary's wall centerline segment is derived as the shared edge of the rectangles, so **without a shared edge of nonzero length no segment can be derived**.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

```text
✖ corner.muro:6行目: 空間が接していないため境界を導けません: /L1/a | /L1/b
```

The two rectangles sit like this.

```text
        X1        X2        X3
  Y3     +---------+---------+
         |         |   /L1/b |
  Y2     +---------●---------+
         | /L1/a   |
  Y1     +---------+
```

`●` is the only point of contact, and it has zero length. The diagnostic code is BND04.

**The fix.** Extend one of the rectangles so they share an edge, or delete that `boundary` line.

### 3. Several boundary segments

What remains of a room's perimeter after removing the intervals that touch other spaces becomes its boundary with the outside. A corner room splits across several edges, south and west say, so where to put an opening is not settled.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/living living X1..X2 Y1..Y2 name:居間
space /out exterior name:外部
boundary /L1/living /out t:150
  door w:900
```

```text
✖ edge.muro:7行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/living | /out)
```

**The fix.** When putting an opening on an external wall, select the side with `edge:`.

```muro-part
boundary /L1/living /out t:150
  door w:900 edge:S
```

The compass is read from the rectangle of the space written first. `N`=+Y (north), `S`=−Y (south), `E`=+X (east), `W`=−X (west). X is east-positive and Y is north-positive. To restrict the boundary line itself to one edge, write `edge:` on the `boundary` side.

The diagnostic code is OPN05 for an opening and SEG05 for a `seg`. When there is no segment at all it is OPN04 (`開口を置ける境界線分がありません`, "there is no boundary segment on which to place the opening").

### 4. A region takes two tokens

This message points at how the region is written, but the cause is usually a forgotten type. The second positional of `space` is the type, and it is required. Forget it and the first region token (`X1..X2`) is read as the type, leaving only one behind.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a X1..X2 Y1..Y2
```

```text
✖ notype.muro:4行目: 領域は X?..X? と Y?..Y? の2つで指定します
```

**The fix.** Write the type between the path and the region.

```muro-part
space /L1/a room X1..X2 Y1..Y2
```

### 5. The regions overlap

This is the standard trap when subdividing a dwelling into rooms. A `space` has a region, so putting children with regions under a parent with a region always overlaps.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/home unit X1..X3 Y1..Y2 name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

```text
✖ 空間の領域が重なっています: /L1/home と /L1/home/ldk
✖ 空間の領域が重なっています: /L1/home と /L1/home/bed
```

**The fix.** Write the grouping as a `zone`. A `zone` has no geometry and only bundles what lies beneath it by path prefix, so nothing overlaps. The area is still totalled at `/L1/home` as before.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

```text
✔ 整合 — 空間 2 / 境界 1
```

`examples/tower/` takes this form. The diagnostic codes are GEO01 / GEO02.

### 6. Referencing an undefined space

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/bath t:120
```

```text
✖ ref.muro:6行目: 未定義の空間を参照しています: /L1/bath
```

The diagnostic code is REF01. When composing, also confirm that the layer declaring that space is `import`ed. Errors always come back with the name of the layer they came from.

### 7. Its level cannot be determined

**Writing `/L1/` at the head of a path is not a declaration of a level.** A separate `level` line is required.

```muro-part
grid X 0 3600
grid Y 0 4000
space /L1/a room X1..X2 Y1..Y2
```

```text
⚠ nolevel.muro:3行目: /L1/a は領域を持ちますが、レベルが特定できません (パス先頭か level: で指定します)
✔ 整合 — 空間 1 / 境界 0 (警告 1)
```

The warning text points at how the path is written, but what you fix is the missing `level` line. The diagnostic code is HGT05. The exit code is 0, so in CI it slips through unless you add `--strict`.

**The fix.** Add the `level` line — and **put it before the `space` line that uses it**. Put it after and the same warning appears and slips through.

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2
```

When you use an idiom that does not express the level at the head of the path (bundling by use, as in `/home/bed1`), write `level:L1` on the space. `examples/house.muro` takes this form.

### 8. plan emits a raw stack trace

`plan` can die even when `check` is green. Drawing is not among what `check` examines.

```sh
npx tsx src/cli.ts plan nolevel.muro -o out.svg
```

```text
Error: レベルが定義されていません
    at svgPlan (src/plan.ts:29:21)
    at main (src/cli.ts:140:19)
```

("No level is defined." In reality a quotation of the source line appears above this and a few more frames below; only the essentials are excerpted here.)

The cause is that there is not one `level` line. Add `level L1 0`. A green `check` does not mean `plan` will pass — confirm as far as the drawing before moving on.

When there are levels and it still dies, suspect the name passed to `-l`. **Level names are case-sensitive.**

```text
Error: レベル l1 に領域を持つ空間がありません
```

```text
Error: レベル L2 に領域を持つ空間がありません
```

The first is writing `L1` as `l1`; the second is pointing at a level that does not exist. Confirm the declared level names with `koyu levels <file>`. Omit `-l` and the first level is drawn.

### 9. Green check but unreachable

Between touching spaces, absent a declaration, a wall with no door is derived ([ADR-0014](../../../docs/decisions/0014-default-boundaries.md)). **Doors are never automatic.** Write a two-storey house declaring only the envelope and the stair, and `check` stays green while every room is sealed.

```text
✔ 整合 — 空間 5 / 境界 7
```

```text
/L2/bed から /out へは到達できません
```

Look at `graph` and the walls you did not write become visible.

```text
/L2/bed (寝室)
  | 壁 → /out  (spec:EW)
  | 壁 → /L2/hall
```

The `| 壁` line carrying no `spec:` is the derived default wall.

**The fix.** Write a `boundary` for the pair you want passable, and put a `door` under it by indentation. Declaring it stops derivation for that pair.

```muro-part
boundary /L2/bed /L2/hall t:120 spec:LGS
  door w:800
```

"Cannot reach" is also returned, in the same wording, when the origin or destination path does not exist. Confirm the spelling of the path with `graph` first. The whole procedure is in [Doors and egress](doors-and-escape.md).

### 10. Green check but no envelope

A default wall is derived only for pairs where **two spaces that have regions** touch. Nothing is derived for a pair involving a space with no region, such as `/out` — because naming *which* outside it faces is the information.

```muro-part
grid X 0 3600 7200
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

```text
✔ 整合 — 空間 2 / 境界 1
```

The one boundary is the default wall between the rooms; there is not one wall around the perimeter. It is green regardless.

**The fix.** Declare an exterior space and write one boundary from each perimeter room. Splitting the outside by direction and character makes `edge:` easier to specify and lets you ask the site questions as well ([Give the site its shape](site-and-far.md)).

```muro-part
space /out exterior name:外部
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

Internal walls automatic, external walls by hand — this asymmetry is intended.

### 11. Misspelled types and attribute keys pass silently

The type (the second positional of `space`) is an open vocabulary. Only the following are interpreted structurally by the tools; everything else is carried as a free word.

| Type | Interpretation |
|---|---|
| `exterior` | The outside. May have no region. Not counted in floor area |
| `void` | A void through the floor. Not counted in floor area, and not passable |
| `unit` `room` `ldk` `bedroom` `living` | Habitable rooms, the subjects of the daylight check (`light`) |

`hall`, `wet`, `plaza`, and `yard` are all free words, neither checked nor warned about. Write a bathroom as `room` and it enters the daylight check as a habitable room.

```muro-part
space /L1/bath room X1..X2 Y1..Y2 nmae:浴室
```

```text
✖ /L1/bath	bath	窓 0.00㎡ / 床 14.40㎡ = 窓なし (必要 1/7 ≈ 2.06㎡)
✖ 1室中 1室が不足しています
```

Correct the type to `wet` and it drops out of the verdict.

```text
対象の居室 (住居系) がありません
```

("There are no habitable rooms in scope.")

A misspelled attribute key passes just as silently. The `nmae:浴室` above is not an error and rides straight into the canonical JSON. No display name is attached, and the tail of the path (`bath`) is used instead.

```text
      "attrs": {
        "nmae": "浴室"
      }
```

**The fix.** The ledger in [spec/vocabulary.md](../../../spec/en/vocabulary.md) is the contract for which attributes the tools read. When an attribute has no effect, check it against the ledger first. To state the verdict explicitly, `hab:1` / `hab:0` sets the daylight scope directly.

### 12. An empty file is green too

```text
✔ 整合 — 空間 0 / 境界 0
```

`check` looks only at whether the authored composition stands up. **Green is not evidence that something is written.** To look inside, use `stats` (area), `graph` (adjacency), `doors` (circulation), `light` (daylight), and `site` (the site).

### 13. The boundary count does not match the canonical JSON

```text
✔ 整合 — 空間 2 / 境界 1
```

```text
  "boundaries": []
```

These are results from the same file. `check` counts the boundaries of the model after derivation, while the canonical JSON preserves **only the authored composition**. Default boundaries do not appear in the canonical JSON ([spec/semantics.md §2](../../../spec/en/semantics.md)). A consumer reading meaning from the canonical JSON applies `deriveDefaultBoundaries` first (the public API section of [spec/tools.md](../../../spec/en/tools.md)). It is not a discrepancy but a difference in the roles of two layers.

## Getting the diagnostic code

Codes do not appear in the human output. When you want to look one up, use `--json`.

```sh
npx tsx src/cli.ts check corner.muro --json
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "空間が接していないため境界を導けません: /L1/a | /L1/b",
  "line": 6,
  "file": "corner.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

A syntax or composition error is also copied into a single `SYN01` and returned as valid JSON, so a pipeline does not break. The meaning of each code is in [the diagnostic index (日本語)](../../diagnostics.md), and the normative ledger is [spec/semantics.md §5](../../../spec/en/semantics.md).

## Related

- [The how-to index](README.md)
- [The diagnostic index (日本語)](../../diagnostics.md) — looking up a cause and a fix from a code
- [Doors and egress](doors-and-escape.md)
- [Subdivide a dwelling](unit-layout.md) — item 5's `zone`-versus-`space` distinction, as a procedure
- [Add a level](add-a-level.md) — items 7 and 8's level declaration, as a procedure
- [Give the site its shape and produce coverage and floor area ratios](site-and-far.md)
- [Six ideas](../concepts.md) — why the default is a wall, and why only the outside is written by hand
- [The cheat sheet (日本語)](../../cheatsheet.md)
- [spec/language.md](../../../spec/en/language.md) — the grammar and the table of defaults
- [spec/semantics.md](../../../spec/en/semantics.md) — the norms of derivation and checking
- [spec/vocabulary.md](../../../spec/en/vocabulary.md) — the ledger of interpreted attributes
