**English** · [日本語](../language.md)

# Language reference — .muro (the authored form)

The norm for the notation as of koyu v0.16.0. For semantics (derivation, checking, queries) see [semantics.md](semantics.md); for the attribute contract see [vocabulary.md](vocabulary.md).

> This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).

## 1. Lexis

**One line is one statement.** Every line takes the form `keyword positional... key:value...`. Tokens are whitespace-separated. `#` begins a comment that runs to the end of the line. Wrap a value in `"..."` when it contains whitespace or `#` (quotes may appear anywhere in a token, and an unclosed quote is an error). An indented line (leading whitespace) **is subordinate to the parent line above it** — `door` / `window` / `seg` under `boundary`, `area` under `space`, `space` under `band` (§3, bands). Indentation is one level only; there is no nesting. Blank lines are ignored.

**Attributes are `key:value`.** The key is to the left of `:` and the value to the right (an empty value is an error). A value in numeric form (`-?\d+(\.\d+)?`) is held as a number; anything else is held as a string. A repeated key on the same line is an error — silently taking the last one hides typos and merge accidents (ADR-0013; an instance overriding an asset default (§6) is two sources, not a duplicate). Interpreted attributes (★) are contracted in the ledger in vocabulary.md; any other `k:v` may be written freely and is carried through untouched.

**Units and coordinate system.** Lengths are in mm. In plan, X is east-positive and Y is north-positive; height z is up-positive. A ratio position along a segment is 0..1. Areas are reported in m² (measured to wall centerlines).

## 2. Foundation declarations (the base layer holds these, once)

```
koyu 1.0                      # version declaration (base layer only, once)
name 街角の複合ビル             # building name (the rest of the line, whitespace allowed)
unit mm                       # v0 is mm only
grid X 0 6400 12800 19200     # X-axis grid-line coordinates (ascending, two or more). X1, X2, … are named automatically
grid Y 0 5600 7600 13200
level L1 0 h:3600 slab:600    # level: name z [h:ceiling height] [slab:slab thickness]
level L4..L10 11000 pitch:3000 h:2500 slab:450   # range declaration (arithmetic). pitch is required
```

`grid` is declared once per axis (in the base layer when composing). `name` is also declared once (it may be repeated only if identical). A `level` range declaration `L4..L10` is a prefix plus consecutive numbers, expanded to `z + pitch×k`. Duplicate level names are an error. Declaring a level that holds no space (a roof `R`, say) makes it the upper bound for the topmost floor's height check.

**The version norm (ADR-0017).** The language versions this tool accepts are `0.1, 0.2, 0.3, 0.4, 0.5, 1.0`; when the declaration is omitted the file is read with the semantics of the newest version, `1.0` (omission is *not* stable in meaning across tool versions — write the version in any file whose meaning you want pinned). Newer and older follow that listed order, not the lexical order of the spelling (`1.0` is newer than `0.5`). The version declaration is the two tokens `koyu <version>` (a missing version, or extra tokens, is an error), in the base layer (the entry) only, and only once (the same discipline as `grid` — re-declaring is an error even with an identical value, which forbids a silent override that depends on composition order). An older version is accepted **only when meaning is preserved** — the parser reads it, but a file whose meaning would change is made an error by check, which offers two ways out. For `0.1`, that is a file in which default boundaries (§4) would be derived (**VER01** — declare the boundaries, or raise the file to `koyu 0.2`). For `0.3` and earlier, which inferred the daylight scope from the type, it is a space of one of those types (`unit`, `room`, `ldk`, `bedroom`, `living`) carrying no `daylight` (**VER02** — write `daylight:1`/`daylight:0`, then raise the file to `koyu 0.4`; ADR-0020). For `0.4` and earlier, which know nothing of the vertical-circulation declarations (`stair:` `ramp:` `escalator:` `lift:`), drawn lines (`line`), columns (`column`) or basements (`underground:`), it is a file in which one of them is written (**VER03** — raise the file to `koyu 0.5`; ADR-0021/0022/0023). For `0.5` and earlier, which know nothing of the composition override (`over`), removal (`drop`) or the set edits directly under `over` (`+` `-` `=`), it is a file in which one of them is written (**VER04** — raise the file to `koyu 1.0`; ADR-0035/0038). A change that changes the language raises the version, and the migration is written in an ADR.

### Grid references and offsets

Coordinates are never written directly — position is always spoken in the language of grid lines: `X2`, `X2+600`, `Y3-150`. A range is written with a grid reference at each end, as in `X1..X2+3200`.

## 3. space — spaces

```
space /L5/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK floor:オーク
space /out/road-s exterior name:南側道路 road:12000
  area X1..X2 Y1-4600..Y1-2600 name:土間 floor:タイル      # indented: an uncounted subdivision
```

- **The path is the identity.** A `/`-separated hierarchy. A path is first of all an aggregation hierarchy, and if its first segment is a level name the space belongs to that level. A grouping that spans levels (a maisonette, say) states it with the `level:` attribute.
- **The type is an open vocabulary** (second positional, required). The only two words interpreted structurally are `exterior` (may have no region; outside) and `void` (a void through the floor — excluded from floor area, not passable). **Being in scope for the daylight check is never inferred from the type** — `light` looks at the spaces that carry `daylight:1` (the default is out of scope; ADR-0020).
- **A region is a union of rectangles.** Write `X?..X? Y?..Y?` and join several with `+` (for an L shape, say). A space with no region (an `exterior`, say) is allowed. Overlapping regions — within one space or between spaces — are an error.
- **`area` (indented)** is an uncounted subdivision inside a room: a region plus overriding attributes only. It does not affect area, room counts, or the graph (the isolation rule). Spilling outside the parent region is a warning.
- **Span expansion**: if the **first segment** of the path has the form `L3..L10`, the line expands across the declared levels in z order (all paths on one line must carry the same span).

### band — dividing a run by dimension and order

```
band X X1+3200..X2+3200 Y1+4000..Y2        # the band: which extent, divided which way
  space /L3..L10/A/wet  wet  w:4800 name:水回り   # indented: a band member (a dimension instead of a region)
  space /L3..L10/A/hall hall w:1600 name:玄関
```

**A band writes dimension and order rather than position** (ADR-0019). It is the horizontal extension of the vertical section stack-up (`level`): what is written is each room's dimension and its place in the run, and position is derived from those. It coexists with the region notation, and neither is forced.

- **`band <axis> <X?..X?> <Y?..Y?>`.** The first positional is the direction of division (`X` = west to east / `Y` = south to north), spelled the same way as `grid X 0 6400 …`. The other two are the extent of the band, with the same lexis as a `space` region and in either order (a `+` union may not be written). **No `key:value` may appear on this line** — the band does not survive into the model, so there is nowhere for an attribute to live. **Ranges must be ascending** — because the order of members carries meaning, a descending spelling is not normalized as it is for `space`.
- **A member is an indented `space` line** carrying a width `w:` in place of a region. In every other respect it is an ordinary `space` line (path, type, attributes, level span). `w` is the dimension along the band's direction, axis-relative in the same way that `door w:800` is a width along a segment. `level:` and `area` may not be written on a member. All members of one band must expand to the same level.
- **`w:rest` marks the member that absorbs the remainder**, at most one per band, in any position. **The default is a closed band, which uses no `rest`** — every member carries a dimension and the parser reconciles their sum against the width of the band. This is the same arithmetic as a dimension string on a drawing, where the partial dimensions must sum to the overall, and it is the only defense against a mistyped dimension. `rest` is reserved for the case where the remainder is not a design decision.
- **Over-determination (the sum exceeds the band) and under-determination (the sum falls short with no `w:rest`) are both errors.** There is no solver — only addition and a single subtraction, in declaration order, always from low coordinate to high. A broken band is **always a parse error** (if the band is broken, not one rectangle can be built — that is a question of form), surfacing in `check --json` as SYN01. No new diagnostic codes are minted.
- **A band is expanded into ordinary spaces at parse time and survives neither in the model nor in the canonical JSON** (the same discipline as import, spans, and stack). A plan written with bands and the same plan written with positions yield the same canonical JSON.
- **How derived cut positions are spelled (the floor rule).** The two ends of the band, and both ends across it, keep **the spelling that was written**; only the interior cuts are spelled by the tool. The rule is "the offset from the largest grid line at or below that coordinate": an offset of 0 gives the bare grid name, and a coordinate before the first grid line gives a negative offset (`8000` → `X2+1600`, `12800` → `X3`). **A spelling that subtracts from the grid line above (`Y2-1800`) never arises from derivation** — rewriting a region written that way as a band leaves the geometry identical but changes the spelling, which appears in a semantic diff.
- **`w:` may not be written on a `space` line** — a space written by width always sits indented under a band. This prevents a member that has lost its indentation from silently becoming a space with no region.

## 4. boundary — boundaries (a wall is a relation, not a thing)

```
boundary /L5/A/hall /L5/corridor t:180 spec:RC
  door D1 at:X4 name:玄関                    # indented: an opening
  seg w:1800 at:X5 edge:S spec:受付ガラス      # indented: an uncounted subdivision
boundary /L1/hall /L2/void type:void          # a vertical exception
```

- A first-class relation joining two space paths. The wall centerline segment is not written — it is derived from the layout of the two spaces (semantics.md §2). A boundary between spaces that do not touch is an error. **A duplicate boundary on the same pair of spaces (identical down to the `edge` restriction) is also an error** — a wall/open contradiction must not pass silently (ADR-0013). A pair carrying a mix of edge-restricted and unrestricted boundaries is a warning (the segments overlap).
- **The default between touching spaces is a wall (ADR-0014).** Where two spaces with regions touch in plan on the same level and no boundary is declared for that pair, a `wall` default boundary is derived — symmetric with the vertical default of a floor, so that declaration is reserved for exceptions (open, railings) and for attributes and openings. A boundary with a space that has no region (an `exterior`, say) is still declared as before — naming *which* outside is the information. The edge of a void (`type:void`) also defaults to a wall; a railing (`air:1`) or an open is declared. Default boundaries do not appear in the canonical JSON.
- **type (kind) states topology only**: horizontally, `wall` (the default — there is something there; not passable without a door) or `open` (nothing there — always passable). Vertically, `stair` (passable), `shaft` (continuous but not passable), or `void` (the absence of a floor). Floors are not written — vertical adjacency is derived from overlap in plan and defaults to a floor. Writing a wall boundary between different levels is an error.
- **The name of the thing belongs to the `spec` vocabulary** (railing, RC, LGS, curtain wall…). Tools do not interpret it.
- **`air:1`** = there is something there, but it does not block outside air or light (railings, fences, balustrades). It affects the derivation of semi-outdoor, the daylight coefficient, and thin-line drawing.
- **`t`** = wall thickness in mm (split about the centerline; the drawing default when unspecified is 100). **`edge`** restricts the segment to one side — N/E/S/W as seen from the rectangle of the a-side (the space written first).
- **`stack <name> L1..L11 type:stair|shaft|void`** declares a vertical stack in one line: it draws vertical boundaries between consecutive level pairs `/Lk/<name> | /Lk+1/<name>`.

### Openings (door / window)

- `door` is for passage, `window` for daylight (it does not admit passage). **The width `w` is required** (it may come from the asset). `h` is optional (the daylight calculation counts only windows that carry `h`).
- **Asset reference**: the leading non-`key:value` token is an asset name (`door SD1 sill:800`). The asset's attributes become defaults, and the instance's attributes override them. A kind mismatch, or an undefined asset, is an error.
- **Position `at`**: either a ratio `0..1` (default 0.5 — clamped to keep the opening within the segment) or a grid reference `at:X2+450` (an absolute position — not clamped; overrunning the segment, or using the wrong axis (a horizontal segment takes X references, a vertical one takes Y), is an error). Openings overlapping on the same segment are an error.
- **`edge` selects the side when there are several segments**, and the swing is given by **`hinge`** (the hinge side: W/E on a horizontal segment, N/S on a vertical one; the default is the starting end) and **`swing`** (the side it opens toward, a/b; the default is a, the side that has a region). `style` (hinged/sliding/auto) changes how the door is drawn in plan.
- **`seg`** is an uncounted subdivision along a boundary: a position (at/w/edge — the same idiom as an opening) plus overriding attributes. It affects neither passage nor connection.

## 5. zone — counted aggregation

```
zone /L3..L10/A name:Aタイプ use:exclusive
zone /site name:敷地 site:1 area:1097.80
```

A zone has no geometry; it bundles the spaces beneath it by path prefix. Its area is the sum of those spaces, and `use` is inherited by them (a declaration on the space wins). `site:1` marks the site and makes it the subject of the `site` query, and `area:` (the surveyed value, in m²) is reconciled against the derived area. A duplicate path is an error; a zone with no spaces beneath it is a warning.

## 6. asset — door and window assets

```
asset SD1 door w:800 h:2000 style:sliding name:片引き戸
```

A bundle of defaults to be referenced (Revit's Family, USD's Reference). It is not a fourth element — it only puts the source of an opening's attributes in one place. A duplicate name is an error (including across composition).

## 7. polygon — the site shape

```
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

**This is the one place in the notation where a shape is *written* with free vertices that do not sit on the grid** (a space's region is also a written shape, but as a rectangle in grid references; an arbitrary vertex list is only `polygon`). A site's shape is surveyed input from the world rather than designed form, so it is admitted as an exception. Vertices are `x,y` in mm (the same coordinate system as the grid), three or more. Associate it with a `site:1` zone path (a missing association is a warning). The derived area, the containment check for the building, and the site boundary line on the plan all follow from it (semantics.md §5). The standard practice is to keep it in a quarantined layer (its own file, brought in by import). A duplicate is an error.

## 8. import / over / drop — composition

The normative rules live in [composition.md](composition.md). Only the spelling is given here.

```
import ./assets.muro                  # lay a layer on top. **The order is the declaration of strength** (later is stronger)

over /L5/A/ldk h:2600 spec:改修後      # override a space (one path; a zone if no space has it)
over /L5/A/hall /L5/corridor t:200    # override a boundary (two paths)
over level L3 h:2600                  # override a level (h / slab / underground only)
over asset SD1 w:900                  # override an asset
  - door D2                           # indented: remove from a set (named)
  = door D1 w:1000                    # replace in a set (only the attributes written)
  + window w:600 h:1200 name:W1       # add to a set (name: required)

drop /L5/A/store                      # remove a space (its boundaries go with it)
drop /L5/a /L5/b                      # remove a boundary
drop column C1                        # remove a column declaration
```

- **`import`** takes a path relative to the file it is written in. The base layer (the entry) declares the foundation (`koyu`/`name`/`unit`/`grid`/`level`) once. The same layer is composed only once (a double import, or a cycle, is idempotent).
- **`space` / `boundary` / `zone` / `asset` / `polygon` are definitions**, and a duplicate is a build error naming the provenance of both. **`over` is an override**, and a missing target is an error.
- **Only `+` / `-` / `=` may be written under `over`.** Set members are pointed at by `name:` — an element without a name cannot be edited.
- The list of composition entry points is in the public API section of [tools.md](tools.md) (`parse` / `parseFile` / `parseFiles` / `parseFileWith` / `parseWith`).
- The canonical JSON is the single composed model; neither `import` nor `over` nor `drop` survives in it.
- **`over`, `drop` and the set edits are muro 1.0 words.** Written in a file that declares `0.5` or earlier, they are stopped with **VER04** (§2, the version norm).

## 9. column — an element with no written position

`column <size mm> <level range|level name> [d:depth] [x:grid,..] [y:grid,..] [free attributes]`

**No position is written anywhere.** Columns stand where grid lines cross and that level has floor (ADR-0023) — the same rule that makes walls appear where two spaces touch. "Has floor" means the point falls inside a space with a region that is neither `exterior` nor `void`. But **a floor that holds up nothing but sky carries no columns** (ADR-0030): a space that is semi-outdoor (touching the exterior through an open or air:1 boundary — ADR-0007) and has no floor of any level overlapping above it (the ADR-0009 derivation) is excluded from column sites. An open roof garden or setback terrace gets no columns; the underside of an overhanging balcony still does. `x:` / `y:` restrict which grid lines carry columns (comma-separated; all by default). Two columns never stand at the same intersection — the earlier declaration wins. Writing three declarations for three level ranges gives columns that slim down as the building rises. A column is neither a space nor a boundary, so it appears in no area total and in no graph.

## 10. The defaults, in one table

| Item | Default |
|---|---|
| boundary type | `wall` |
| boundary t | none (the derivation default is 100 mm — [derivation.md](derivation.md) §5) |
| boundary between touching spaces | `wall` — not written. Declare only the exceptions (open / air:1 / anything carrying attributes or openings — ADR-0014) |
| opening at | 0.5 (a ratio — clamped) |
| opening hinge / swing | the starting end of the segment / the a side (the one with a region) |
| space level | the first path segment (when it is a level name) |
| space h | the level's h |
| vertical adjacency | a floor (slab) — not written. Declare only the exceptions (stair/shaft/void) |
| area measurement | to wall centerlines |
