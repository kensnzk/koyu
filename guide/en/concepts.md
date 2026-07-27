**English** · [日本語](../concepts.md)

# Six ideas

koyu's notation is short. Not because there is little to remember, but because **there is much that is not written**. Read the syntax tables without knowing what goes unwritten, and what going unwritten means, and you cannot tell whether a line is missing or superfluous.

This document explains, in order, the six ideas you need first for the notation to read. It writes no procedure — the order in which to move your hands is held by [start.md](start.md), and the exact definitions by [spec/](../../spec/en/README.md). The six are not independent pieces of knowledge but a chain of consequences from one decision, so read in order, each falls out of the one before. It takes about ten minutes. The argument in full is in [docs/writing-architecture.md](../../docs/writing-architecture.md) (in Japanese).

## 1. Space is the primary element

Architectural data has long been a description of things to be built. Walls, floors, and columns are laid out, and rooms are derived afterwards as the result of what those enclose. koyu reverses the order. **Enumerate the rooms and the walls between them come along.**

So what stands at the center of a .muro is `space`. These four lines are the smallest file that is consistent and can be drawn as a plan.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

`koyu check` returns this.

```text
✔ Consistent — 1 space / 0 boundaries
```

Neither `koyu 0.5`, nor `unit mm`, nor `name` is needed. **All that is required is that there be a grid on both axes, that it precede any line using it, that a level be declared, and that `space` carry a type (its second positional).** Coordinates are never written directly — position is always written in the language of grid lines ([spec/language.md §2, grid references and offsets](../../spec/en/language.md)).

Add one room. Not one boundary line is written.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

It says "1 boundary" although no boundary was written. Because the two rooms touch, the wall between them has been derived (§3). `koyu graph` shows that wall.

```text
/L1/a (居室A)
  | wall → /L1/b
/L1/b (居室B)
  | wall → /L1/a
```

(`壁` is "wall". The names 居室A and 居室B are "Room A" and "Room B".)

That a file of nothing but `space` lines is a complete description of architecture, rather than a drawing with pieces missing, is where this notation starts.

## 2. A boundary is a relation, not a thing

`boundary /L1/a /L1/b` is not a line that places a wall. It is **a line declaring that a boundary relation exists between two spaces**. The wall centerline segment itself is not written — it is derived as the shared edge of the two rectangles ([spec/semantics.md §2, derivation in plan](../../spec/en/semantics.md)).

From this one fact, three rules that stand as separate table rows in the specification all fall out at once. You do not need to memorize three things. Remembering that it is a relation is enough.

**One — you cannot write a boundary between spaces that do not touch.** A declared relation from which no segment can be derived does not stand up.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b
```

The error is `The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b` (BND04). These two rooms meet at a corner, but "touching" in koyu means **sharing an edge of nonzero length**. A single corner point is not contact.

**Two — one relation can split into several segments.** A boundary with a space that has no region (the outside, say) is what remains of the room's perimeter once the intervals shared with other spaces are removed, and it usually splits across several edges. One relation, several segments. So **when placing an opening on an external wall you select which edge with `edge:`**.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out exterior
boundary /L1/living /out
  door w:900
```

The error is `There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)` (OPN05).

The compass follows from the coordinate system. **X is east-positive and Y is north-positive, so N=+Y, S=-Y, E=+X, W=-X** (`Edge` in `src/model.ts`). And `edge` is **the side as seen from the rectangle of the a side — the space written first**. In `boundary /L1/living /out`, `edge:S` means the south edge of living's rectangle. Swap the order in which they are written and the meaning changes.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out exterior
boundary /L1/living /out t:150
  door w:900 edge:S
```

**Three — you cannot write a boundary twice for the same pair of spaces.** A relation has identity. Two lines for one relation would mean two answers to one question.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

The error is `Duplicate boundary: /L1/a | /L1/b (first seen at …:line 6)` (BND02). If the later one silently won, whether this wall is a wall or an opening would be settled by the order of the lines ([ADR-0013](../../docs/decisions/0013-semantic-guarantees.md)).

Note that a `boundary` may be written before the spaces — a declared relation may refer forward. The only things that need to come first are `grid` and `level`, which must precede any line that uses them.

## 3. Three tiers of default

Not writing something carries meaning. But **there are three kinds of "not writing", and they mean different things.**

| Kind of contact | What not writing it means | What declaring it is for |
|---|---|---|
| Two spaces with regions touching in plan on the same level | **A wall** (derived) | The exceptions (`type:open`, `air:1`), and attributes and openings |
| Two spaces overlapping in plan on consecutive levels | **A floor** (derived) | The exceptions (`stair`, `shaft`, `void`) |
| Contact with a space that has no region (`exterior` and the like) | **Nothing at all** | The envelope itself |

The first two are symmetric and rather beautiful. Horizontally a wall, vertically a floor, neither written ([ADR-0014](../../docs/decisions/0014-default-boundaries.md), [spec/semantics.md §2, §3](../../spec/en/semantics.md)). Only the third differs. Miss it and your drawing breaks.

The two-room file in §1 is green under `check` and yet has not one external wall. The plan shows it.

![A plan with no envelope written](../img/concepts-no-envelope.svg)

The only thing drawn in black is the single band in the middle — the derived default wall. There is nothing around the perimeter. Only when you write an exterior space, and boundaries with it, does an envelope come into being.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

![A plan with the envelope written](../img/concepts-envelope.svg)

**Internal walls are automatic; external walls are manual.** This asymmetry does not appear in the table of defaults. There is a reason — naming *which* outside (a road, a neighbor, a garden, a shared corridor) is itself information, and cannot be derived by default. But the consequence is that **there is no mechanism that checks for a missing envelope**. A green `check` is not looking at it.

The dividing line is not "is it an exterior?" but "does it have a region?". An exterior space that carries a region and a level, as in `space /out/garden exterior X2..X3 Y1..Y2 level:L1`, does get a default wall derived between it and the rooms it touches (and it counts toward road frontage).

A derived boundary is not part of the authored composition, so it does not appear in the canonical JSON ([spec/canonical-json.md](../../spec/en/canonical-json.md)). That is why `check` saying "1 boundary" and `koyu json` saying `"boundaries": []` look contradictory: the former counts the meaning after derivation, the latter the authored source.

## 4. A path is an address and, at the same time, an aggregation hierarchy

`/L1/a` is not a name but an address. And the hierarchy cut by `/` doubles as the unit of aggregation. A path plays two roles.

**The first segment becomes a level only when a `level` of the same name has been declared.** Writing `/L1/` does not bring a level into being; a separate `level L1 0` line is needed. Without it `check` emits a warning but **does not error**.

```text
⚠ nolevel.muro:line 3: /L1/x has a region, but its level cannot be determined (give it at the head of the path or with level:)
✔ Consistent — 1 space / 0 boundaries (1 warning)
```

The warning text points at the path, but the cause is not the path — it is the absent `level` line. And this file, which `check` passed with exit code 0, cannot be drawn by `plan`.

```text
Error: No level is defined
    at svgPlan (/…/src/plan.ts:29:21)
```

This is a hole in the current implementation, and a worked instance of a green `check` not meaning "drawable" (see the table at the end). Note also that only one level can be expressed at the head of a path, so a grouping that spans levels (a maisonette) states it with the `level:` attribute.

**A space with a region cannot have child spaces with regions.** Parent and child would overlap.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/home unit X1..X3 Y1..Y2
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

The error is `Space regions overlap: /L1/home and /L1/home/a` (GEO01). **When you subdivide a dwelling into rooms, make the parent a `zone` rather than a `space`.** A zone has no geometry; it is a counted aggregation that only bundles what lies beneath it by path prefix.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

`koyu stats` reports the individual rooms while keeping the total over the path prefix.

```text
By zone (counted aggregation):
  /L1/home	住戸	28.80 m2
```

That "subdividing into rooms never loses the language of the dwelling" is what this double role buys ([spec/semantics.md §6, stats](../../spec/en/semantics.md)). So **the unit you want to aggregate by belongs toward the head of the path.** The bundled examples show two idioms — `/L1/room`, putting the level first (two-rooms, office, mansion, tower), and `/home/room` with `level:L1`, putting the dwelling first (house). Neither is better; they differ in what you want to bundle by.

Paths change. When a rename or a reorganization changes a path, the correspondence with any sensor or register that used it as a foreign key is severed. When you need a reference that outlives the path, use `uid:` — an opaque token, unique across the whole model, never derived from the path ([ADR-0015](../../docs/decisions/0015-identity-uid.md)). References inside the repository (`boundary`, `doors`, zone aggregation) stay on paths as before.

## 5. The authored source and what is derived

There is no form in a .muro. **Form, quantity, and the inside/outside distinction are none of them written in the source; all are derived.**

The two columns are not paired rows; each is its own list.

| Written (the source) | Derived |
|---|---|
| The region of a space (a rectangle union in grid references) | Wall centerline segments |
| The boundary relation (a, b, kind, attributes) | Default boundaries (the horizontal wall, the vertical floor) |
| Openings (door / window) | Area (to centerlines), interior floor area |
| grid, level | Vertical adjacency |
| The site shape (polygon) | Semi-outdoor, covered above |
| Assets, zones | Passability |
| Uncounted subdivisions (area, seg), `uid` | The plan drawing, the daylight verdict, road frontage and coverage ratio, the canonical JSON |

This one table answers two beginner questions at once.

**"Where do I write the floors?"** — You do not. Spaces overlapping in plan on consecutive levels are vertically adjacent by that overlap, and the default reading is "there is a floor". Only the exceptions (stairs, shafts, voids) are declared as boundaries.

**"I want to declare that this space is semi-outdoor."** — You cannot. Semi-outdoor is derived, not declared. A space with a region that carries an `open` or `air:1` boundary with the outside becomes semi-outdoor ([spec/semantics.md §4](../../spec/en/semantics.md)). Writing `type:terrace` on a terrace does not make it semi-outdoor. What makes it so is on the boundary side.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/room ldk X1..X2 Y1..Y2
space /L1/balcony balcony X2..X3 Y1..Y2
space /out exterior
boundary /L1/room /L1/balcony t:150
  window w:1600 h:2000
boundary /L1/balcony /out type:open
```

That last line is what makes the balcony semi-outdoor. The area table in `stats` shows it.

```text
  /L1/room	room	ldk	14.40㎡
  /L1/balcony	balcony	balcony	7.20 m2 (semi-outdoor, reported separately)
  Subtotal 14.40 m2
Total 14.40 m2 (indoor floor area)
Semi-outdoor 7.20 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
```

(`半屋外・別掲` = "semi-outdoor, reported separately"; `合計 … (屋内床面積)` = "total … interior floor area"; the last line notes that whether semi-outdoor area counts depends on regulatory detail, so it is kept separate.)

One step outside derivation there is **generation**. The plan drawing is generated rather than derived, and several forms come from one composition. That is not a defect but an expression of the position that if the composition is the same, a difference in form does not damage the identity of the architecture ([spec/semantics.md §7](../../spec/en/semantics.md)).

## 6. The vocabulary is open

The second positional of `space` (its type) is required, but **any value passes**. This openness is intended — it is the consequence of choosing to give meaning by a vocabulary rather than a vast class hierarchy ([spec/vocabulary.md](../../spec/en/vocabulary.md)).

Attributes are open too, but **the openness has a shape**. They come in three layers ([spec/scope.md §7](../../spec/en/scope.md)): the layers the tools read (structure, interpreted) are contracted by the ledger, and the layer that is merely carried has a **namespace**.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居間 acme.sensor:23 bems.temp:22.5
```

Both `acme.sensor` and `bems.temp` carry a dot, so they belong to the carry layer. Core gives them **no meaning at all** — it checks no value domain and uses them in neither derivation nor validation. Write whatever you like.

A key that is neither in the ledger nor namespaced is an error.

```muro-bad
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 nmae:居間
```

```text
✖ line 4: /L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:居間)
```

**This once passed silently.** `nmae:` is a typo for `name:`, but the reasoning was that a word absent from the ledger is not "wrong" — merely "not interpreted" — and it came out in the canonical JSON unchanged. The reasoning was consistent; the price was too high. By the same reasoning `heigh:2400` silenced the height invariant (HGT01) entirely, `sit:1` silenced the site verdicts, and `stiar:N` erased the vertical circulation — **all of them green**.

**Being open and being trustworthy are compatible, provided the boundary is declared.** Without the declaration there is no way to tell "not looked at" from "looked at and fine" — and "nothing wrong" in that state means nothing. The namespace is how that boundary is spelled ([ADR-0033](../../docs/decisions/0033-attribute-tiers.md)).

Of the types, only two are interpreted structurally by the tools.

| Type | Interpretation |
|---|---|
| `exterior` | The outside. May have no region. Adding `road:` makes it a subject of road frontage |
| `void` | A void through the floor. Excluded from floor area, and not passable |

**Every other type, however meaningful it looks, is a free word equivalent to any other as far as the tools are concerned.** These two words alone have their spelling guarded, though — write `exteriorr` and the space stops being outside, doubling the gross floor area, so a type within **one edit** of either word is refused. Distant words (`room`, `yard`, `ldk`) draw no comment. Whether a space is a subject of the daylight check is not decided by the type either — it is declared, by writing `daylight:1` ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). The entrance to a verdict is never the type; it is an attribute, and the attribute names the tool's test rather than a legal category.

The bundled examples actually use 31 type words (across 135 `space` lines). Not as a ledger but as usage, they are distributed like this.

| Category | Words (occurrences) |
|---|---|
| Interpreted structurally | `exterior` (15) · `void` (4) |
| Uninterpreted, by usage | `unit` (14) · `stair` (11) · `yard` (9) · `hall` (8) · `corridor` (8) · `balcony` (6) · `bedroom` (5) · `wc` (5) · `terrace` (5) · `machine` (5) · `ev` (5) · `ldk` (4) · `shop` (4) · `service` (4) · `office` (4) · `shaft` (3) · `room` (2) · `ps` (2) · `garden` (2) · `wet` (1) · `water` (1) · `waste` (1) · `trunk` (1) · `plaza` (1) · `parking` (1) · `meeting` (1) · `lobby` (1) · `bicycle` (1) · `backyard` (1) |

The second row is de facto usage, not a contract. One confusing overlap is worth noting — `stair`, `shaft`, and `void` are also words for a **boundary kind**, but as space types `stair` and `shaft` are not interpreted (only `void` is interpreted as a space type as well).

Where this openness bites is in seeing where the entrance to a verdict actually is. Declare that the check applies to a windowless bathroom and it enters the daylight test, with the type left as `wet`.

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
space /out exterior
boundary /L1/bath /out edge:S t:150
```

```text
✖ /L1/bath	浴室	window 0.00 m2 / floor 4.00 m2 = no window (needs 1/7 ≈ 0.57 m2)
✖ Short of 1/7: 1 of 1 room (this is a validation judgement)
```

Drop the `daylight:1`, without touching a character of the type.

```muro-part
space /L1/bath wet X1..X2 Y1..Y2 name:浴室
```

```text
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

`check` is green on both files. **A type is a description of a room; it is not the entrance to a verdict.** Change the type from `wet` to `bedroom` and the verdict does not move at all — whether the daylight test applies is something the author declares with `daylight`, not something to be guessed from a room's name. (The habitable room of Article 2(iv) of the Building Standards Act is likewise a judgement about continuous use in fact, not about what the room is called. Note also that the attribute names the tool's test, not that legal category: the two are not the same set, since Article 28(1)'s daylight duty is scoped to dwellings, schools, hospitals and the like.)

## What a green check does not guarantee

What `check` looks at is whether the authored composition stands up. **It is not looking at whether the building can be used.**

| Not guaranteed | How to see it |
|---|---|
| Circulation — what can be reached from where | `koyu doors <A> <B>` · `koyu graph` |
| Envelope completeness — whether external walls were written | Your own eyes (look at the `koyu plan` drawing). There is no automatic check |
| Whether it can be drawn — whether a level was declared | `koyu plan` (`check` stops at a warning) |
| Vocabulary correctness — the spelling of a type or attribute key | Nothing |

The first is the dangerous one. As §3 says, the default between touching spaces is a wall, and **a wall with no door cannot be passed**. So writing a two-storey building without a single door gets you a sealed building, in green.

```muro
koyu 0.5
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/hall hall X1..X2 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2
space /out exterior
boundary /L1/hall /out t:150
boundary /L2/bed /out t:150
boundary /L1/hall /L2/bed type:stair
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

There are external walls, there is a stair, and it is consistent. But there is no way out.

```text
$ koyu doors two.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

A warning saying "these touch but no boundary is declared" once existed, but making the default a wall ended its job and it was retired (BND07 is a retired number — [ADR-0014](../../docs/decisions/0014-default-boundaries.md)). **The instrument for looking at circulation is `doors`, not `check`.**

As the extreme case of this asymmetry, **`check` is green on an empty file too** — `✔ Consistent — 0 spaces / 0 boundaries`. Since there is no composition that fails to stand up, that is correct. `check` tests that what is written is free of contradiction, not that what is needed has been written.

## Onward

- The order in which to move your hands — [start.md](start.md)
- The list of constructs — [cheatsheet.md](cheatsheet.md)
- Looking up a word — [glossary.md](glossary.md)
- The cause and fix for each diagnostic code — [diagnostics.md](diagnostics.md)
- The norms (grammar, semantics, the vocabulary ledger, canonical JSON, tool contracts) — [spec/](../../spec/en/README.md)
- Why it is the way it is — [docs/decisions/](../../docs/decisions/) and [docs/writing-architecture.md](../../docs/writing-architecture.md)
