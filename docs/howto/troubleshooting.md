---
title: Common traps
mode: howto
---

# Common traps

**There are thirteen.** These are what people hit when they start writing, worked through from cause to fix.

If all you want is to look up a message, [Look up a diagnostic by symptom](by-symptom.md) is the index. This page is where it sends you.

Every output below was actually run. Absolute paths in the position prefix have been shortened to the file name.

## 1. Undefined grid line name

`grid` is **one of the few lines whose declaration order matters.** A `boundary` may refer forward to a space, but `grid` and `level` must come before the lines that use them.

```muro-bad
level L1 0
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ nogrid.muro:line 2: Undefined grid line name: X1
```

Getting only the order wrong gives the same wording.

```muro-bad
space /L1/a room X1..X2 Y1..Y2
grid X 0 3600
grid Y 0 4000
level L1 0
```

```text
✖ order.muro:line 1: Undefined grid line name: X1
```

**The fix.** Gather the groundwork declarations at the top of the file. When composing layers, put them in the entry.

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0
```

Writing a grid name that does not exist, such as `X5`, gives the same wording. `grid X 0 3600 7200` makes exactly three lines: `X1`, `X2`, `X3`.

## 2. The spaces do not touch

Two rooms that meet at a corner do not touch. A boundary's centre-line segment is derived as the **shared edge** of the rectangles, so without a shared edge that has length, no segment comes out.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b t:120
```

```text
✖ corner.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
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

`●` is the only contact, and it has zero length.

**The fix.** Extend one of the rectangles so an edge is shared, or delete the `boundary` line.

## 3. Pick an edge

Whatever is left of a room's perimeter after the other spaces have taken their share becomes the boundary to the exterior. For a corner room that **splits across several edges** — south and west, say — and there is no way to decide where the opening goes.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living living X1..X2 Y1..Y2 name:居間
space /out name:外部 outside:1
boundary /L1/living /out t:150
  door w:900
```

```text
✖ edge.muro:line 7: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)
```

**The fix.** Pick the edge with `edge:` when placing an opening in an exterior wall.

```muro-part
boundary /L1/living /out t:150
  door w:900 edge:S
```

Compass directions are read **from the rectangle of the space written first**: `N`=+Y, `S`=−Y, `E`=+X, `W`=−X. They are words about axes, not about where the building really points — that is [`azimuth`](../reference/muro/azimuth.md), and it does not change which face `edge:N` picks. To confine the boundary line itself to one edge, write `edge:` on the `boundary`.

## 4. A region is given as two ranges

A region is **two** ranges — one on X and one on Y. Write only one and you get this.

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2
```

```text
✖ region.muro:line 4: A region is given as two ranges, X?..X? and Y?..Y?
```

**The fix.** Write the range on the other axis too.

```muro-part
space /L1/a room X1..X2 Y1..Y2
```

**A forgotten type is not the cause.** The type is optional ([space](../reference/muro/space.md)): `space /L1/a X1..X2 Y1..Y2` passes as a space with no label. The type is a free word and no tool reads it.

## 5. Space regions overlap

The classic trap when dividing a dwelling unit into rooms. A `space` holds a region, so a child with a region under a parent with a region always overlaps.

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/home unit X1..X3 Y1..Y2 name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
```

```text
✖ overlap.muro:line 4: Space regions overlap: /L1/home and /L1/home/ldk
```

**The fix.** Write the grouping as a `zone`. A zone holds no geometry — it gathers members by path prefix — so nothing can overlap. The unit's area is summed from its members.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/ldk ldk X1..X2 Y1..Y2 name:LDK
space /L1/home/bed bedroom X2..X3 Y1..Y2 name:寝室
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

Deciding whether to divide at all is on [Counted and uncounted divisions](uncounted-divisions.md).

## 6. References an undefined space

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/bath t:120
```

```text
✖ ref.muro:line 6: References an undefined space: /L1/bath
```

**The fix.** Correct the path. When composing layers, also check **whether the layer declaring that space is imported.** The error always names the layer it came from, so you can read which layer cannot see it.

## 7. The level cannot be determined

**Writing `/L1/` at the head of a path does not declare a level.** A `level` line is required separately.

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/a room X1..X2 Y1..Y2
```

```text
✖ nolevel.muro:line 3: /L1/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

The message points at path spelling, but what needs fixing is the missing `level` line. Its severity is `error` and the exit code is 1 — with no level there is no z, and not one solid comes out of that space.

**The fix.** Add the `level` line, **before the `space` lines that use it.** Put it after and the same error stays.

```muro-part
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

When paths do not carry the level at their head — grouping by use, as in `/home/bed1` — write `level:L1` on the space instead.

## 8. plan throws a stack trace

**A green `check` does not stop `plan` from failing.** Drawing is not what `check` inspects.

```sh
koyu plan nolevel.muro -o out.svg
```

```text
Error: No level is defined
```

The cause is that there is no `level` line at all. Add `level L1 0 h:2400 slab:150`.

When levels are declared and it still fails, **no space on that level has a region.**

```text
Error: There is no space with a region on level R
```

Getting the level *name* wrong, on the other hand, comes back as a problem with how you called it rather than a stack trace. **Level names are case-sensitive.**

```text
Undeclared level: l2 (declared: L1 L2 R)
```

The exit code is 2 and the declared level names are printed alongside. `koyu levels` shows them too.

## 9. Green, and no way out

Between touching spaces, a **wall with no door** is derived when nothing is declared. **Doors are never added automatically.** A two-storey house with only the envelope and the stair declared seals every room while `check` stays green.

```muro
muro 1.3
name 密封された二室
unit mm
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW edge:W
boundary /L1/b /out t:150 spec:EW edge:E
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

```text
Cannot reach /out from /L1/a
```

`graph` shows the walls nobody wrote.

```text
/L1/a (居室A)
  | wall → /out  (spec:EW)
  | wall → /L1/b
/L1/b (居室B)
  | wall → /out  (spec:EW)
  | wall → /L1/a
/out (外部)
  | wall → /L1/a  (spec:EW)
  | wall → /L1/b  (spec:EW)
```

The `| wall` lines without a `spec:` are the walls that were derived by default.

**The fix.** Write a `boundary` for the pair you want passable, and indent a `door` under it. Declaring one stops the default derivation for that pair.

```muro-part
boundary /L1/a /L1/b t:120 spec:LGS
  door w:800
```

"Cannot reach" **comes back with identical wording when the start or end path does not exist.** Check the spelling with `graph` first.

## 10. Green, and no envelope

Default walls are derived only for pairs where **both spaces have regions.** Nothing is derived against a space with no region, such as `/out` — which exterior a room faces is information that has to be named.

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

That one boundary is the default wall between the rooms; the perimeter has none at all. It is still green.

`validate` does look at this. Against the example in trap 9 it returns:

```text
⚠ [koyu.schematic.envelope.gap] sealed.muro:line 7: Perimeter not faced by any envelope: /L1/a — N 3600mm / S 3600mm (7200mm over 2 run(s)). Write a boundary to the exterior
```

**The fix.** Declare an exterior space and write one boundary from each perimeter room. Splitting the exterior by direction or character makes `edge:` easier to write and opens up the site questions.

```muro-part
space /out name:外部 outside:1
boundary /L1/a /out t:150 spec:EW
boundary /L1/b /out t:150 spec:EW
```

**Interior walls automatic, exterior walls by hand.** The asymmetry is deliberate.

## 11. An attribute has no effect

An attribute key that is not in the ledger and has no namespace **is an error.** It never passes silently.

```text
✖ att.muro:line 4: /L1/bath carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:浴室)
```

The **type** (the second positional argument of `space`), by contrast, **is an open vocabulary.** Only two types are read structurally; everything else is carried as a free word, unchecked and unwarned.

| Type | Interpretation |
|---|---|
| `exterior` | Exterior. May be written without a region. Not counted as floor area |
| `void` | A void. Not counted as floor area, and not passable |

`hall`, `wet`, `room` and `ldk` are all free words. **Nor does the type decide whether a room is judged for daylight.** Only rooms written with `daylight:1` enter the judgement.

```muro-part
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
```

```text
  /L1/bath	浴室	window 0.00 m2 / floor 14.40 m2 = no window
1 room in daylight scope — these are numbers, not a verdict (koyu validate applies the rule)
```

Drop the `daylight:1` and it leaves the judgement without one character of the type changing.

```text
Nothing is in daylight scope (write daylight:1 on the rooms to be judged)
```

**The fix.** The list of writable attributes is on [The three attribute tiers](../reference/muro/attributes.md). Which layer supplied a value is printed by `koyu layers --attrs`.

## 12. An empty file is green too

```text
✔ Consistent — 0 spaces / 0 boundaries
```

All `check` looks at is whether the written composition stands. **Green is not evidence that anything got written.**

```text
Total 0.00 m2 (indoor floor area)
```

**The fix.** Look inside with `stats` (areas), `graph` (adjacency), `doors` (circulation), `light` (daylight) and `site` (the site).

## 13. Two places give different boundary counts

```text
✔ Consistent — 2 spaces / 1 boundary
```

```text
  "boundaries": []
```

**These are the same file.** `check` counts the composed model; canonical JSON stores **only what was written.** Default boundaries do not appear in canonical JSON.

It is not a contradiction but a difference of role between two layers. A reader taking meaning out of canonical JSON applies `deriveDefaultBoundaries` first. To see the composed picture, `graph` answers.

## Related

- [Look up a diagnostic by symptom](by-symptom.md) — the symptom index
- [Diagnostic code index](../reference/diagnostics/index.md) — looked up by code
- [Counted and uncounted divisions](uncounted-divisions.md) — the judgement behind trap 5
- [The three attribute tiers](../reference/muro/attributes.md) — the ledger to check against in trap 11
- [The scope of the promise](../reference/scope.md) — the reason shared by traps 9, 10, 12 and 13
