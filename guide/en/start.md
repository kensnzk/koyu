**English** · [日本語](../start.md)

# First steps — from one room to a two-storey house

Write one two-storey house in koyu, produce its plan drawings, and confirm its circulation and daylighting. It takes 30–45 minutes.

This document is a **lesson**. Work down it in order, writing exactly what it says. No choices appear. Explanation is kept to a minimum, and doorways into the reference are placed instead — read those once you have been through.

What you will have at the end:

- One 30-line `.muro` file
- A plan drawing (SVG) for each level
- Answers to "how many doors from the upstairs bedroom to the outside?" and "do the habitable rooms get enough daylight?"

The endpoint of each stage is kept as-is under [examples/steps/](../../examples/steps/). Compare against them whenever you lose your way.

**The tool speaks Japanese.** Its output is pasted here exactly as it appears — `✔ 整合` means "consistent", `平面図を生成しました` means "generated the plan", `✖` marks an error. Each block is glossed in the prose that follows, so you never need to guess.

## Getting ready

All you need is Node.js.

```sh
git clone https://github.com/kensnzk/koyu.git
cd koyu
npm install
mkdir -p out
```

The only file you will write from here on is `out/house.muro`. `out/` is in `.gitignore`, so nothing you put there dirties the repository. Run every command from the root of the repository.

## Stage 1 — one room

Create `out/house.muro` and write these four lines.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0
space /L1/ldk ldk X1..X2 Y1..Y2
```

Here is what the four lines say.

- `grid X 0 3600 5400` — declares the **grid lines** of the X axis. They are named `X1`, `X2`, `X3` automatically, left to right. Position is always written in the language of these grid lines — apart from the shape of a site, there is no line in this notation that writes a coordinate directly.
- `grid Y 0 4000` — the same for the Y axis. `Y1` and `Y2` come into being.
- `level L1 0` — puts a level called `L1` at height 0 mm.
- `space /L1/ldk ldk X1..X2 Y1..Y2` — puts down one space. `/L1/ldk` is this space's **path** (its identity itself), the `ldk` that follows is its **type**, and the rest is its region.

The type is the second positional argument and **cannot be omitted**. Because the path begins with `L1`, this space belongs to level `L1`.

Write `grid` and `level` before any line that uses them. This is the only place where line order carries meaning — a `boundary`, for instance, may refer to a space that has not been written yet.

Check it.

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ 整合 — 空間 1 / 境界 0
```

("Consistent — 1 space / 0 boundaries.")

Produce the plan.

```sh
npx tsx src/cli.ts plan out/house.muro
```

```text
平面図を生成しました: out/house-L1.svg
```

("Generated the plan: out/house-L1.svg.")

Open `out/house-L1.svg` in a browser.

![A plan of one room only. Grid lines X1 X2 Y1 Y2, and a single pale rectangle. Not one wall is drawn](../img/start-01-one-room.svg)

**Not one wall is drawn.** There is a space, but not one boundary. A wall is not a possession that comes attached to a space.

Note that all `check` looks at is whether what was written is consistent. An empty file passes too, with `✔ 整合 — 空間 0 / 境界 0`. Green does not mean "a correct building" — stage 5 takes this head on.

## Stage 2 — two rooms, and the wall you did not write

Add one `space` line. Change nothing else.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0
space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2
```

Check it.

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ 整合 — 空間 2 / 境界 1
```

**The boundary count has gone from 0 to 1.** You have not written a single boundary line.

Produce the plan again and open it.

```sh
npx tsx src/cli.ts plan out/house.muro
```

![A plan of two rooms. A black band stands on grid line X2, separating ldk from hall](../img/start-02-two-rooms.svg)

This one line has appeared inside the SVG.

```text
<rect x="261.5" y="84" width="5" height="200" fill="#1f1f1f"/>
```

That is the wall. The previous stage's drawing had zero black bands and this one has one — and the only line you added was a `space`.

Stop here for a moment. **This notation has no operation that draws a wall.** A wall is the boundary between two spaces, derived from the layout of those spaces. Where a pair of touching spaces has no boundary declared, that means "wall" rather than "undefined". It is the rule symmetric with the vertical one: floors are not written, and the default is a floor.

- How the wall centerline segment is derived from a shared edge: [spec/semantics.md §2](../../spec/en/semantics.md).
- Why the default was made a wall: [ADR-0014](../../docs/decisions/0014-default-boundaries.md) (in Japanese).

## Stage 3 — a door

The derived wall stands there as a thing, so without a door you cannot get through. To cut an opening in it you must **declare** that boundary. Add two lines, `boundary` and `door`, at the end (with blank lines for readability).

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0

space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000
```

A `boundary` is a relation joining two space paths. The segment is not written — it follows from the layout of the two spaces. `t:120` is the wall thickness in mm.

The `door` line is **indented**. That an indented line is subordinate to the parent line above it is the only nesting this notation has. A `door` needs a width, `w`.

Check it and produce the drawing.

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts plan out/house.muro
```

```text
✔ 整合 — 空間 2 / 境界 1
平面図を生成しました: out/house-L1.svg
```

The boundary count is still 1. The wall that had been derived was simply replaced by a declared one.

![A plan of two rooms. An opening is cut in the middle of the wall, with a hinged door drawn as a quarter-circle swing](../img/start-03-door.svg)

Ask the model whether the door connects.

```sh
npx tsx src/cli.ts doors out/house.muro /L1/ldk /L1/hall
```

```text
1枚 — /L1/ldk → /L1/hall
```

("1 door — /L1/ldk → /L1/hall.")

**You declare a boundary only when you have something to say about it** — a thickness, a specification, an opening. If you have nothing to say, do not write it. The wall is there whether you write it or not.

The attributes a `boundary` may carry are in [spec/language.md §4](../../spec/en/language.md); how an opening's position is written is in the "Openings" part of the same section.

## Stage 4 — the outside

The outside is a space. Declare it with `space /out exterior` and write the envelope boundaries yourself.

A space whose type is `exterior` need not have a region. Add the following.

```muro-bad
grid X 0 3600 5400
grid Y 0 4000
level L1 0

space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800
boundary /L1/hall /out t:150
  door w:900 h:2000
```

Checking it fails.

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✖ …/out/house.muro:13行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/ldk | /out)
✖ …/out/house.muro:15行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/hall | /out)
```

("There are several boundary segments. Specify the side with edge:N/E/S/W." `13行目` means "line 13". The error gives its position as an absolute path; the front of it is elided here as `…`.)

This is where the outside differs from the inside. The boundary between two rooms is a single shared edge, but the boundary between a room and the outside is **what remains of the perimeter once the intervals shared with other spaces are removed**, and it splits across several edges. `/L1/ldk` faces the outside on three sides — north, south, and west — so where you want the window cannot be settled from the notation.

Select a side with `edge:`. The compass directions are as follows.

| Symbol | Direction | On the drawing |
|---|---|---|
| `N` | +Y | up |
| `S` | -Y | down |
| `E` | +X | right |
| `W` | -X | left |

X is east-positive and Y is north-positive. The direction of `edge` is **read from the rectangle of the space written first**.

Put the window and the entrance on the south face. Add `edge:S` on lines 13 and 15.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0

space /L1/ldk ldk X1..X2 Y1..Y2
space /L1/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S
```

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts plan out/house.muro
```

```text
✔ 整合 — 空間 3 / 境界 3
平面図を生成しました: out/house-L1.svg
```

![A plan with its envelope. The whole perimeter is enclosed by black bands, with the centerline of a window and the swing of an entrance door on the south face](../img/start-04-exterior.svg)

The black bands have gone from one to seven — one internal wall and six around the perimeter. **Internal walls are automatic; external walls are declared.** A boundary with the outside does not exist unless you write it, and `check` stays green whether you write it or not. Remember the envelope as a post you have to hold with your own eyes.

Now that there is a window, you can ask about daylight — but one declaration is needed first. **koyu never guesses which rooms should be tested**: spelling a type `ldk`, or `bedroom`, is no grounds for a verdict ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). Write `daylight:1` on the room you want tested. Change line 5 to this.

```muro-part
space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
```

```sh
npx tsx src/cli.ts light out/house.muro
```

```text
✔ /L1/ldk	ldk	窓 4.32㎡ / 床 14.40㎡ = 1/3.3 (必要 1/7 ≈ 2.06㎡)
✔ 全1室が 1/7 を満たします (補正係数なしの粗い判定)
```

("Window 4.32 m² / floor 14.40 m² = 1/3.3, requires 1/7 ≈ 2.06 m². All 1 room satisfies 1/7 — a coarse test with no correction factors.")

`hall` does not appear because `daylight:1` was written only on `ldk`. The type plays no part in the verdict whatsoever — rewrite `hall` as `room` and it still stays out of scope; leave it as `hall` and add `daylight:1` and it comes into scope. Of the space types, exactly two are interpreted structurally, `exterior` and `void`; the rest are free words that koyu does not interpret. The ledger is in [spec/vocabulary.md](../../spec/en/vocabulary.md).

## Stage 5 — a second storey, and the trap of green

Put a second storey on. Add one `level` line, add `h:` to `L1` as well, then two spaces, one stair boundary, and two envelope boundaries upstairs.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/hall hall X2..X3 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2 daylight:1
space /L2/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /out t:150
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150
```

The `h:` in `level L1 0 h:2400` is the base ceiling height, and the `slab:` in `level L2 2800 ... slab:400` is the thickness of the floor construction. A space whose path is `/L2/…` belongs to `L2`.

`boundary /L1/hall /L2/hall type:stair` is the stair. Spaces on consecutive levels become adjacent automatically wherever they overlap in plan, and the default reading is "there is a floor" — only the exceptions are declared as boundaries. `stair` means passable, `shaft` means continuous but not passable, and `void` means the absence of a floor.

Check it.

```sh
npx tsx src/cli.ts check out/house.muro
```

```text
✔ 整合 — 空間 5 / 境界 7
```

Look at how the heights stack up.

```sh
npx tsx src/cli.ts levels out/house.muro
```

```text
L2	z:2800	h:2400	slab:400
L1	z:0	h:2400
  ↑ 階高 2800 = 天井2400 + slab400
```

("Floor-to-floor 2800 = ceiling 2400 + slab 400.")

This is a section in text. If the ceiling height plus the slab above exceeds the floor-to-floor height, `check` makes it an error. Here 2400 + 400 = 2800 fits exactly.

Produce the upstairs plan. Select the level with `-l`.

```sh
npx tsx src/cli.ts plan out/house.muro -l L2
```

```text
平面図を生成しました: out/house-L2.svg
```

![An upstairs plan. The bedroom and the stair hall are separated by a wall and the perimeter is enclosed by black bands. There is a window on the south face of the bedroom](../img/start-05-L2-sealed.svg)

It looks like an ordinary upstairs plan. `check` is green too. Now ask about circulation.

```sh
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
```

```text
/L2/bed から /out へは到達できません
```

("/L2/bed cannot reach /out.")

**The bedroom is completely sealed.** `/L2/bed` and `/L2/hall` touch, so a default wall was derived, and that wall has no door. It is not that something was forgotten — it is that not writing something meant "wall".

Fix it. Declare the boundary between the bedroom and the stair hall, and cut a door in it. Add two lines after `boundary /L1/hall /L2/hall type:stair`.

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 daylight:1
space /L1/hall hall X2..X3 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2 daylight:1
space /L2/hall hall X2..X3 Y1..Y2
space /out exterior

boundary /L1/ldk /L1/hall t:120
  door w:800 h:2000

boundary /L1/ldk /out t:150
  window w:2400 h:1800 edge:S
boundary /L1/hall /out t:150
  door w:900 h:2000 edge:S

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /L2/hall t:120
  door w:800 h:2000

boundary /L2/bed /out t:150
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150
```

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
```

```text
✔ 整合 — 空間 5 / 境界 7
2枚 — /L2/bed → /L2/hall → /L1/hall → /out
```

("2 doors.") Two doors from the bedroom, through the entrance hall, to the outside. The stair is not a door, so it does not count.

**The boundary count is still 7, unchanged.** The wall that had been derived was simply replaced by a wall with a door. The output of `check` does not differ by a single character before and after — `check` does not distinguish a sealed house from a usable one.

Produce the drawing again and the door has appeared in the wall.

```sh
npx tsx src/cli.ts plan out/house.muro -l L2
```

![An upstairs plan. An opening is cut in the wall between the bedroom and the stair hall, with the swing of a hinged door drawn](../img/start-05-L2.svg)

This is the most important thing about using koyu.

> A green `check` does not mean the building can be used. Confirm circulation with `doors`, daylight with `light`, and the envelope with your own eyes.

What `check` answers is whether the authored composition is consistent, not whether the building stands up. The list of what is checked is in [spec/semantics.md §5](../../spec/en/semantics.md).

## Stage 6 — finishing

Finally, add what has been left out until now.

```muro
koyu 0.4
name 小さな家

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK floor:オーク daylight:1
space /L1/hall hall X2..X3 Y1..Y2 name:玄関ホール floor:タイル
space /L2/bed bedroom X1..X2 Y1..Y2 name:寝室 floor:オーク daylight:1
space /L2/hall hall X2..X3 Y1..Y2 name:階段ホール
space /out exterior name:外部

boundary /L1/ldk /L1/hall t:120 spec:PW1
  door w:800 h:2000 name:LDK扉

boundary /L1/ldk /out t:150 spec:EW1
  window w:2400 h:1800 edge:S name:掃き出し窓
boundary /L1/hall /out t:150 spec:EW1
  door w:900 h:2000 edge:S name:玄関

boundary /L1/hall /L2/hall type:stair

boundary /L2/bed /L2/hall t:120 spec:PW1
  door w:800 h:2000

boundary /L2/bed /out t:150 spec:EW1
  window w:1800 h:1200 edge:S
boundary /L2/hall /out t:150 spec:EW1
```

Three kinds of thing were added. (The Japanese values are names: 小さな家 "a small house", 寝室 "bedroom", オーク "oak", 掃き出し窓 "full-height window".)

- **`koyu 0.4`** — the language version declaration. A file that omits it is always read with the newest version's semantics, so its meaning can move when the tool's version rises. **Write it in files you create.**
- **`name`** — the building's name (it becomes the drawing's title), plus a name for each space, boundary, and opening.
- **`floor:` and `spec:`** — free attributes that koyu does not interpret. They are carried through as they are. That the name of a thing (RC, LGS, EW1…) is written as the value of `spec` is the stance of this notation.

The `unit mm` you see in the bundled examples need not be written. The only length in v0 is mm.

Check it, and produce the areas.

```sh
npx tsx src/cli.ts check out/house.muro
npx tsx src/cli.ts stats out/house.muro
```

```text
✔ 整合 — 空間 5 / 境界 7
L1
  /L1/ldk	LDK	ldk	14.40㎡
  /L1/hall	玄関ホール	hall	7.20㎡
  小計 21.60㎡
L2
  /L2/bed	寝室	bedroom	14.40㎡
  /L2/hall	階段ホール	hall	7.20㎡
  小計 21.60㎡
合計 43.20㎡ (屋内床面積)
  ldk: 14.40㎡
  hall: 14.40㎡
  bedroom: 14.40㎡
```

(`小計` is "subtotal", `合計 … (屋内床面積)` is "total … interior floor area".)

Areas are measured to wall centerlines. Produce the drawings for both levels.

```sh
npx tsx src/cli.ts plan out/house.muro -l L1
npx tsx src/cli.ts plan out/house.muro -l L2
```

![The ground-floor plan. The LDK and the entrance hall, with a full-height window and the entrance on the south face](../img/start-06-L1.svg)

![The upstairs plan. The bedroom and the stair hall, with a door between them](../img/start-06-L2.svg)

Finally, as stage 5 instructed, confirm circulation and daylight.

```sh
npx tsx src/cli.ts doors out/house.muro /L2/bed /out
npx tsx src/cli.ts light out/house.muro
```

```text
2枚 — /L2/bed → /L2/hall → /L1/hall → /out
✔ /L1/ldk	LDK	窓 4.32㎡ / 床 14.40㎡ = 1/3.3 (必要 1/7 ≈ 2.06㎡)
✔ /L2/bed	寝室	窓 2.16㎡ / 床 14.40㎡ = 1/6.7 (必要 1/7 ≈ 2.06㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

From 30 lines of text came a two-storey house, its plan drawings, and the answers about circulation and daylight.

There are only 13 words that can begin a line in this notation, and 5 that can sit indented. What you have used so far is `grid`, `level`, `space`, `boundary`, the indented `door` and `window`, plus `koyu` and `name` — that is enough for one house. The rest — `zone`, `import`, `asset`, `polygon`, `stack`, `band`, `unit`, the indented `area` and `seg`, and the `space` that sits indented as a band member — are the words for when the scale grows. The full list is in [cheatsheet.md](cheatsheet.md).

## What to read next

- **If why it is written this way has not settled yet** → [concepts.md](concepts.md). It covers the ideas you need first for the notation to settle.
- **If you know what you want to do** → [howto/](howto). Procedures are lined up by goal.
- **To keep beside you while writing** → [cheatsheet.md](cheatsheet.md). Every construct on one page.
- **When you get an error** → [diagnostics.md](diagnostics.md). A cause and a fix for each diagnostic.
- **If you want to know more commands** → [cli.md](cli.md). It also covers `graph`, `stats`, `site`, `diff`, and `json`, which were not used here.
- **If you want to read what others have written** → [gallery.md](gallery.md). The bundled examples, with drawings and what each one demonstrates.
- **If you need an exact definition** → [spec/](../../spec/en/README.md). The grammar is in [language.md](../../spec/en/language.md), derivation and checking in [semantics.md](../../spec/en/semantics.md), the attribute contract in [vocabulary.md](../../spec/en/vocabulary.md), and the CLI/MCP/API in [tools.md](../../spec/en/tools.md).
