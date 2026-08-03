---
title: mansion — writing the typical floor once
mode: explanation
---

# mansion — writing the typical floor once

`examples/mansion.muro`. 192 lines / 122 spaces / 332 boundaries / 2,366.40 m² of interior floor area / 162.16 m² semi-outdoor. A ten-storey apartment building of 43 dwellings with interior corridors. **122 spaces fit into 192 lines** because the typical floor is written exactly once.

![mansion L1](../img/mansion-L1.svg)

![mansion L5](../img/mansion-L5.svg)

![mansion L10](../img/mansion-L10.svg)

## What it shows first

- **Range declaration of levels** — `level L3..L9 6700 pitch:2900 h:2400 slab:500`. Seven levels in arithmetic progression on one line.
- **Span expansion of paths** — a first segment of `L2..L9` expands across the declared levels in z order. `space`, `zone` and `boundary` all expand, and **indented doors come along to every expansion**.
- **[`stack`](../reference/muro/stack.md)** — `stack ev L1..L10 type:shaft` draws vertical boundaries across every consecutive level pair at once. Nine lift shafts and nine stair connections in two lines.
- **Mixed granularity** — only type A is divided into rooms; B through E stay whole dwellings. `zone /L2..L9/A` keeps the vocabulary of net floor area, so divided and undivided dwellings are counted on the same footing.
- **Daylight across a balcony** — a coefficient of 0.7 if something sits above the balcony, 1.0 if nothing does. **One line produces a different answer on different storeys.**
- **An external stair** — a single boundary of `spec:手すり air:1` makes it semi-outdoor, and the stair moves out of the interior floor area into a separate line.
- **Openings decomposed** — a full-height sliding assembly is written as a sliding leaf (`door`) and a fixed light (`window`). An opening is for passage or for daylight; one opening never claims both.

## Excerpts

Eight typical floors start here. `/L2..L9/` expands eight times.

```muro-part
zone /L2..L9/A name:Aタイプ use:exclusive
space /L2..L9/A/ldk     ldk     X1+2600..X2 Y1..Y2-1800 + X1..X1+2600 Y1..Y1+1400 name:LDK
space /L2..L9/A/bedroom bedroom X1..X1+2600 Y1+1400..Y2-1800 name:洋室
space /L2..L9/A/balcony balcony X1..X2 Y1-1400..Y1 name:バルコニー
space /L2..L9/B unit X2..X3 Y1..Y2               name:Bタイプ use:exclusive
```

Vertical circulation is the last two lines.

```muro-part
stack ev L1..L10 type:shaft
stack stair L1..L10 type:stair
```

`stack ev L1..L10 type:shaft` reads as "for all nine pairs L1↔L2, L2↔L3, …, L9↔L10, draw a `shaft` boundary between the `/L?/ev` spaces". The external stair likewise. **Two lines raise eighteen vertical boundaries.**

The opening onto the balcony is written as passage and daylight separately.

```muro-part
boundary /L2..L9/A/ldk /L2..L9/A/balcony t:180 spec:EW fire:60
  door w:1200 h:2200 at:X1+1400 name:掃き出し引違い
  window w:2600 h:2200 sill:0 at:X1+4000 name:掃き出し窓
boundary /L2..L9/A/balcony /out t:120 spec:手すり air:1 h:1100
```

That last line (`spec:手すり air:1`) is what makes the balcony semi-outdoor. The railing is physically there and blocks neither air nor light.

## Questions worth putting to it

### How many doors from the fifth-floor LDK to the outside

The external stair is `type:stair`, so it is passable, and it carries no doors — so descending any number of storeys adds none.

```sh
npx tsx src/cli.ts doors examples/mansion.muro /L5/A/ldk /out
```

```text
3 doors — /L5/A/ldk → /L5/A/hall → /L5/corridor → /L5/stair → /L4/stair → /L3/stair → /L2/stair → /L1/stair → /out
```

The route passes through eight spaces and three doors.

### Can one written line give different answers on different storeys

It can. The typical-floor window is written once, but the verdict is issued for all 51 rooms after expansion.

```sh
npx tsx src/cli.ts light examples/mansion.muro
```

```text
  /L2/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L3/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L4/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L5/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L6/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L7/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L8/A/ldk	LDK	window 4.00 m2 / floor 17.08 m2 = 1/4.3
  /L9/A/ldk	LDK	window 5.72 m2 / floor 17.08 m2 = 1/3.0
```

(Only the eight type-A LDK lines are shown. The full output is 52 lines, ending in `51 rooms in daylight scope`.)

The full-height window is 2.6 × 2.2 = 5.72 m². On floors 2 through 8 it counts as 4.00 m²; on the ninth it stays at 5.72. **Nothing sits above the ninth-floor balcony.** There is nowhere to write a roof, and "what is above" is read off the arrangement of spaces on the levels overhead.

### Can a divided and an undivided dwelling be counted together

They can. The zone keeps the word "one dwelling".

```sh
npx tsx src/cli.ts stats examples/mansion.muro
```

```text
By zone (counted aggregation):
  /L2/A	Aタイプ	34.80 m2
  /L3/A	Aタイプ	34.80 m2
  /L4/A	Aタイプ	34.80 m2
  /L5/A	Aタイプ	34.80 m2
  /L6/A	Aタイプ	34.80 m2
  /L7/A	Aタイプ	34.80 m2
  /L8/A	Aタイプ	34.80 m2
  /L9/A	Aタイプ	34.80 m2
```

Type A is split into four spaces — LDK, bedroom, wet core, entrance hall — but as a zone it is one dwelling of 34.80 m². Types B to E are not split, so the space itself is the dwelling. From the counting side the difference does not arise.

The totals at the end read:

```text
Total 2366.40 m2 (indoor floor area)
Semi-outdoor 162.16 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By use: common 662.40 m2 (28.0%) / exclusive 1704.00 m2 (72.0%)
```

The 162.16 m² of semi-outdoor is the balconies and the external stair. **Whether they count is a matter of regulatory detail, so they are never folded into the total.**

## Read next

- Site polygons and exception floors written as a difference — [tower](tower.md)
- Writing vertical circulation — [basement](basement.md)
