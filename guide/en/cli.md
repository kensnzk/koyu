**English** · [日本語](../cli.md)

# CLI reference

A page for looking up the `koyu` command, one command at a time, starting from what it answers. The contract table (the norms for arguments, output, and exit codes) is held by [spec/tools.md](../../spec/en/tools.md) — this makes that usable, with the real invocation and the real output.

## Running it

From inside this repository, write it like this at the root.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

`npm run koyu -- check examples/two-rooms.muro` is the same. With the package installed you can call `koyu check <file>`. **Every piece of output on this page was obtained by running `npx tsx src/cli.ts …` at the root of the repository.**

## The common shape

```text
koyu <check|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <entry.muro> [args...]
```

**What you pass is always one path, the entry.** Even for a model split up with `import`, pass only the base layer's file (`examples/house/main.muro`, say) — the layers are composed automatically each time. Pass one of the split files on its own and it dies, because that file has neither grid nor level.

```sh
npx tsx src/cli.ts check examples/house/L1.muro
```

```text
✖ <絶対パス>/examples/house/L1.muro:3行目: 未宣言のレベルです: level:L1
```

("Undeclared level." `<絶対パス>` stands in for the absolute path.)

An `import` path is resolved **relative to the file it is written in**, so copying just the base layer's file somewhere else will not compose (`ファイルが読めません: ./assets.muro`, "cannot read the file").

Every command shares the same derivations. The CLI, MCP, and the public API are different entrances to the same answers.

## The promise of the exit codes

| Exit code | Meaning |
|---|---|
| 0 | Success (the answer to the question is yes) |
| 1 | Failure (there are errors / something is missing / it cannot be reached) |
| 2 | You called it wrong (missing arguments, an unknown command), or `diff`'s input is broken |

What `0` and `1` mean differs per command, and each section says so. **`2` can be read as a problem with the command you typed, not with the model you wrote.**

## About --help

**There is no `--help` flag.** Calling it with arguments missing prints usage, but that is the "you called it wrong" path, and **the exit code is 2**.

```sh
npx tsx src/cli.ts --help
```

```text
使い方: koyu <check|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [引数...]
  check: --json (Diagnostic[]をJSONで出力) / --strict (警告があれば終了コード1)
  diff:  koyu diff <a.muro> <b.muro> [--json] — 構成の言葉の差分 (0=差分なし / 1=差分あり / 2=入力が壊れている)
```

(`使い方` is "usage".) That usage text is not exhaustive. **`plan`'s `-l` / `-o` and `doors`'s two path arguments are not written there.** This page is the norm for each command's flags.

## check — does the composition stand up

Checks consistency. It is the gate to pass after every edit, and it is what you put in CI.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ 整合 — 空間 3 / 境界 3
```

| Flag | Effect |
|---|---|
| `--json` | Emits the diagnostics as `Diagnostic[]` JSON. **This is the only time the code (`BND04` and so on) appears** |
| `--strict` | Makes the exit code 1 even for warnings |

| Exit code | Meaning |
|---|---|
| 0 | No errors (with `--strict`, no warnings either) |
| 1 | There are errors / there are warnings under `--strict` / it could not be read due to a syntax or composition error |

**Codes never appear in the human output.** To look one up, add `--json`.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro --json
```

```text
[]
```

With errors, `--json` takes this shape. `message` is the body only; the position is carried separately by `line` / `file`.

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "空間が接していないため境界を導けません: /L1/a | /L1/b",
  "line": 6,
  "file": "<絶対パス>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

(`file` is the **resolved absolute path**; it is elided here. The same path prefixes each line of the human output.)

A file that could not be read due to a syntax error still returns valid JSON under `--json` — it is copied into a single `SYN01`. The meaning, cause, and fix for each code are in [diagnostics.md](diagnostics.md), and the ledger is [spec/semantics.md §5](../../spec/en/semantics.md).

**A green `check` is not looking at whether the building can be used.** A building with not one door, and one with not one window, are both green. Confirm circulation with `doors` and daylight with `light`, separately ([Combinations worth using](#combinations-worth-using)).

## diff — what did this edit change about the composition

Compares two models **in the language of composition**. Line order, formatting, and the difference between a bare `wall` declaration and its omission (a default wall) are not differences. It is a diff of meaning, not of text.

```sh
npx tsx src/cli.ts diff <a.muro> <b.muro> [--json]
```

Take a straight copy of `examples/two-rooms.muro` as `before.muro`, then change `/L1/b`'s `name:居室B` to `name:書斎` ("study") and the width of the door between the rooms from `w:780` to `w:900`, and compare.

```sh
npx tsx src/cli.ts diff before.muro after.muro
```

```text
± /L1/b: name 居室B → 書斎
± 境界 /L1/a | /L1/b: door at:0.5 w 780 → 900
```

With no differences it prints this.

```sh
npx tsx src/cli.ts diff examples/two-rooms.muro examples/two-rooms.muro
```

```text
差分なし
```

("No differences.")

| Flag | Effect |
|---|---|
| `--json` | Emits `ModelDiff` as JSON (added / removed / renamed / changed for grid, levels, assets, polygons, zones, spaces, boundaries) |

| Exit code | Meaning |
|---|---|
| 0 | No differences |
| 1 | There are differences |
| 2 | The input is broken (a syntax or composition error), or no comparison file was given |

**Only `diff`'s exit codes mean something else.** `check`'s 0/1 is "is it consistent"; `diff`'s 0/1 is "are they the same". Do not mix them up when using both in CI.

Something whose `uid` matches while its path differs is detected as a **rename**. The identity mechanism is [ADR-0015](../../docs/decisions/0015-identity-uid.md); the definition of the difference is [ADR-0018](../../docs/decisions/0018-semantic-diff.md).

## plan — produce the plan drawing

Generates and writes out the plan SVG for a given level. There is no operation anywhere that draws a wall — walls appear, derived from boundaries.

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

```text
平面図を生成しました: out/house-L2.svg
```

| Flag | Effect |
|---|---|
| `-l <level>` / `--level <level>` | The level to draw. Defaults to **the first level declared** |
| `-o <path>` | The destination. Defaults to `<the entry path minus .muro>-<level>.svg` |

| Exit code | Meaning |
|---|---|
| 0 | It was written |
| 1 | It could not be drawn (the raw exception below) |

**There are three quirks to watch.**

**The default for `-l` is not the lowest storey.** It is `Object.keys(model.levels)[0]` — the first in the order the `level` lines were **written**. In a file that writes `level L2 …` before `level L1 …`, the default is L2. To be sure of the storey you meant, state `-l`.

**The form `-l=L2` does not work.** Separate the flag and its value with whitespace (`-l L2`). `-l=L2` is silently ignored and the default level is drawn.

**Omit `-o` and it writes beside the input file.** `plan examples/two-rooms.muro` creates `examples/two-rooms-L1.svg`. When you do not want to dirty the repository, pass `-o`. The destination directory is created if it does not exist.

**On failure it emits a Node stack trace.** Give `-l` a file with no level declared at all, or a level holding no space with a region, and you get a raw exception rather than a composed Japanese error (exit code 1).

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l R -o out/house-R.svg
```

```text
<絶対パス>/src/plan.ts:35
  if (rooms.length === 0) throw new Error(`レベル ${level} に領域を持つ空間がありません`);
                                ^

Error: レベル R に領域を持つ空間がありません
```

("There is no space with a region on level R.")

**`plan` can die even when `check` is green.** Drawing is not what `check` inspects. A space that is not on a level is stopped by [SUF02](diagnostics.md#suf02) as an error, but mistaking the name passed to `-l` lies outside `check`.

The drawing conventions (the black band of a wall, the dashed line of an `open`, the swing of a door, the diagonal of a void, the site boundary line) are in [spec/semantics.md §7](../../spec/en/semantics.md). What the bundled examples come out as is in [gallery.md](gallery.md).

## axo — looking at the solid (axonometric)

Check a solid with the same generate-and-look loop as a plan ([ADR-0026](../../docs/decisions/0026-axonometric.md)).
**No runtime and no WebGL** — what comes out is SVG, which opens in a browser or an editor as it is.

```sh
npx tsx src/cli.ts axo examples/basement/main.muro -o out/axo.svg
```

```text
軸測図を生成しました: out/axo.svg
```

Floors, roofs, walls, columns and vertical circulation are projected. `-d NE|NW|SE|SW`
picks the viewing direction (SE by default), `-l L1..L5` or `-l L1,L3` picks the levels,
`-s` the scale, `--no-walls` drops the walls and `--ceilings` draws the ceilings.

**An undeclared level name exits with code 2.** It never quietly writes an empty SVG and
says "generated" ([ADR-0028](../../docs/decisions/0028-diagnostics-per-declaration.md)).

```sh
npx tsx src/cli.ts axo examples/complex/main.muro -l ZZ9
```

```text
レベルが宣言されていません: ZZ9 (宣言済み: B2 B1 L1 L2 L3 L4 L5 L6 L7 L8 L9 L10 L11 L12 L13 L14 L15 L16 L17 L18 L19 R)
```

## runs — how the vertical circulation was derived

Riser counts, goings, landings and slopes are **written nowhere**
([ADR-0021](../../docs/decisions/0021-vertical-circulation.md)). They follow from the region
and the storey height. This command lists what was derived.

```sh
npx tsx src/cli.ts runs examples/basement/main.muro
```

```text
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	上り3700mm	折返し	勾配 1/7.2	走り26800mm	/B2/ramp
B2→B1	stair	避難階段	上り3700mm	折返し	21段 蹴上176 踏面300	走り6000mm	/B2/st
B1→L1	lift	EV	/B1/ev
B1→L1	ramp	車路	上り3700mm	折返し	勾配 1/7.2	走り26800mm	/B1/ramp
B1→L1	stair	避難階段	上り3700mm	折返し	21段 蹴上176 踏面300	走り6000mm	/B1/st
```

The same stair shaft divides differently when the storey height differs. The difference is
written nowhere — **that the riser count changes when the height changes is what derivation means.**
Whether the derived dimensions are usable is what `check`'s RUN06 / RUN07 says.

## doors — how many doors from there to there

Gives the route of fewest doors over the space graph. It is the question of egress and circulation.

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2枚 — /L1/a → /L1/b → /out
```

| Argument | Meaning |
|---|---|
| `<pathA> <pathB>` | The origin and destination space paths. Both required |

| Exit code | Meaning |
|---|---|
| 0 | It can be reached |
| 1 | It cannot be reached |
| 2 | Two paths were not given |

An `open` boundary and a stair are passable without counting a door. A `wall` is passable only with a door. A `shaft` (a lift and the like) and a `void` are continuous as space but people cannot pass. A railing (an `air:1` wall) is not passable either — `air` is about shielding, not about passage.

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
```

```text
3枚 — /home/bed1 → /home/hall2 → /home/hall1 → /site/east → /site/garden → /out/road
```

**Passing a path that does not exist also prints "cannot reach".** A misspelling and a genuine unreachability give the same message and the same exit code 1.

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed9 /site/garden
```

```text
/home/bed9 から /site/garden へは到達できません
```

When it says unreachable, confirm the spelling of the path with `graph` first. The outside is not necessarily one thing — `examples/house`'s outside splits into `/out/road`, `/out/n`, `/out/e`, and `/out/w`, and no space called `/out` exists.

## graph — what is this space connected to, and how

Lists the neighbors of each space, tagged with the boundary kind and the door count. It is the map that comes before `doors` gives an answer.

```sh
npx tsx src/cli.ts graph examples/two-rooms.muro
```

```text
/L1/a (居室A)
  — 扉1 → /L1/b  (spec:PW1)
  | 壁 → /out  (spec:EW1 fire:60)
/L1/b (居室B)
  — 扉1 → /L1/a  (spec:PW1)
  — 扉1 → /out  (spec:EW1 fire:60)
/out (外部)
  | 壁 → /L1/a  (spec:EW1 fire:60)
  — 扉1 → /L1/b  (spec:EW1 fire:60)
```

| Exit code | Meaning |
|---|---|
| 0 | Always |

The symbols state the boundary kind.

| Symbol | Meaning | Passable |
|---|---|---|
| `— 扉N` | A wall with N doors | Yes |
| `\| 壁` | A wall with no door | No |
| `〰 開放` | `open` — nothing there | Yes |
| `\| 手すり等(外気開放・通行不可)` | An `air:1` wall (a railing, a fence, a boundary wall) | No |
| `↕ 階段` | `stair` | Yes |
| `↕ シャフト(通行不可)` | `shaft` (a lift and the like) | No |
| `↕ 吹抜け` | `void` — the absence of a floor | No |

What is in parentheses is the boundary's attributes. **Boundaries you did not declare appear too** — the default between touching spaces is a wall, so an undeclared contact shows up as "a wall with no door" ([ADR-0014](../../docs/decisions/0014-default-boundaries.md)). A `| 壁` line with no attributes is usually one of these.

## stats — what are the areas

Gives floor area by level, semi-outdoor reported separately, and aggregations by zone, by type, and by use.

```sh
npx tsx src/cli.ts stats examples/house/main.muro
```

```text
L1
  /site/garden	南庭	garden	41.12㎡ (半屋外・別掲)
  /site/west	西側通路	yard	12.42㎡ (半屋外・別掲)
  /site/east	東側通路	yard	12.42㎡ (半屋外・別掲)
  /site/north	北側通路	yard	7.28㎡ (半屋外・別掲)
  /home/ldk	LDK	ldk	39.75㎡
  /home/hall1	玄関・階段	hall	13.25㎡
  小計 53.00㎡
L2
  /home/bed1	主寝室	bedroom	26.50㎡
  /home/void	リビング上部	吹抜け (床面積不算入)
  /home/hall2	2階ホール	hall	13.25㎡
  小計 39.75㎡
合計 92.75㎡ (屋内床面積)
半屋外 73.24㎡ (バルコニー・屋外階段等 — 算入条件は法規細部のため別掲)
ゾーン別 (数える集約):
  /home	住戸	92.75㎡
  ldk: 39.75㎡
  hall: 26.50㎡
  bedroom: 26.50㎡
use別: exclusive 92.75㎡ (100.0%)
```

| Exit code | Meaning |
|---|---|
| 0 | Always |

The columns are tab-separated `path / name / type / area`. Areas are to wall centerlines. **Semi-outdoor space and voids are not counted into interior floor area** — semi-outdoor is reported separately, and a `type:void` prints `吹抜け (床面積不算入)`, "void (not counted in floor area)". Semi-outdoor is derived rather than declared (a space touching an `exterior` with an `open` or `air:1`).

The by-type aggregation (`ldk: 39.75㎡`) counts the second positional of `space`; `use別` ("by use") counts the effective `use` inherited from the zone. **Because the type is an open vocabulary, a misspelling is quietly counted as a different type.**

## levels — how do the heights stack up

The section in text. It lists the levels in descending z and shows the floor-to-floor height decomposed into ceiling height and slab thickness.

```sh
npx tsx src/cli.ts levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ 階高 2900 = 天井2400 + slab500
L1	z:0	h:2400	slab:400
  ↑ 階高 2900 = 天井2400 + slab500
```

| Exit code | Meaning |
|---|---|
| 0 | It could be produced |
| 1 | Not one level is defined |

The `↑ 階高` line is the stack-up **as seen from the storey below**. A remainder appears if there is one (`examples/tower` shows `階高 3200 = 天井2600 + slab500 + 余り100`, where `余り` is "remainder"). Spaces carrying their own `h:` are reported separately at the end.

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ 階高 4000 = 天井2700 + slab1300
L1	z:0	h:2700	slab:600
  ↑ 階高 4000 = 天井2700 + slab1300
個別天井高: /L1/hall h:6700
```

When the decomposition does not appear, either the storey below has no `h` or the one above has no `slab`. `check` says so: the former as the error [SUF01](diagnostics.md#suf01), the latter as the warning [SUF03](diagnostics.md#suf03) (in both cases the height check does not run). **Declaring a roof level that holds no space (`level R 5800 slab:500`) brings the top storey into the check as well.**

## light — does what is in scope meet 1/7

For the habitable rooms (the spaces carrying `daylight:1`), confirms whether the window area is at least a seventh of the floor area. It is a coarse test applying no correction factors — an early warning matched to schematic-design resolution. The 1/7 ratio comes from the Japanese Building Standards Act.

```sh
npx tsx src/cli.ts light examples/house/main.muro
```

```text
✔ /home/ldk	LDK	窓 7.54㎡ / 床 39.75㎡ = 1/5.3 (必要 1/7 ≈ 5.68㎡)
✔ /home/bed1	主寝室	窓 5.72㎡ / 床 26.50㎡ = 1/4.6 (必要 1/7 ≈ 3.79㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

| Exit code | Meaning |
|---|---|
| 0 | All pass, **or not one space carries `daylight:1`** |
| 1 | Some room falls short |

The subjects are only the spaces carrying `daylight:1` — the type is not consulted ([ADR-0020](../../docs/decisions/0020-daylight-scope-is-declared.md)). **With not one window written it fails, of course.**

```sh
npx tsx src/cli.ts light examples/two-rooms.muro
```

```text
✔ /L1/a	居室A	窓 2.86㎡ / 床 16.20㎡ = 1/5.7 (必要 1/7 ≈ 2.31㎡)
✔ /L1/b	居室B	窓 2.86㎡ / 床 16.20㎡ = 1/5.7 (必要 1/7 ≈ 2.31㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

**With nothing in scope the exit code is 0 too.** In a model where no space carries `daylight:1` (an office, say) the test simply does not run.

```sh
npx tsx src/cli.ts light examples/office.muro
```

```text
採光の対象がありません (判定する室に daylight:1 を書きます)
```

("Nothing is in scope for the daylight check — write daylight:1 on the rooms to test.") Do not read this as a pass — forget a `daylight:1` and you get the same output. A `window` with no `h` is not counted, and a note saying so is appended to the line (`⚠ h未指定の窓は数えていません`). The definition of the test is in [spec/semantics.md §6](../../spec/en/semantics.md).

## site — the site's figures

Derives the site area, road frontage, building coverage ratio, and floor area ratio from the composition rather than from declarations. These are the figures of schematic massing study.

```sh
npx tsx src/cli.ts site examples/house/main.muro
```

```text
敷地 /site (敷地)
  敷地面積: 宣言 126.24㎡ / 導出 126.24㎡ ✔ 一致
  接道: /out/road (南側道路) 幅員6000mm ・ 接道長 10280mm ✔ 2m以上
  建築面積 (水平投影・粗): 53.00㎡ → 建蔽率 42.0%
  延べ面積: 92.75㎡ → 容積率 73.5%
```

| Exit code | Meaning |
|---|---|
| 0 | The site report could be produced |
| 1 | There is no site (neither a `site:1` zone nor an exterior carrying `road:`) |

Two declarations are required. **The site is a zone carrying `site:1`, and a road is an `exterior` space carrying `road:<width in mm>`.** With neither, it prints this.

```sh
npx tsx src/cli.ts site examples/mansion.muro
```

```text
敷地がありません (zone に site:1 を、道路に road:幅員 を宣言します)
```

("There is no site — declare site:1 on a zone and road:<width> on the road.")

Declare the site shape with a `polygon` and the area comes from the polygon by the shoelace formula, reconciled against the zone's `area:` (the surveyed value).

```sh
npx tsx src/cli.ts site examples/tower/main.muro
```

```text
敷地 /site (敷地)
  敷地形状: 多角形 5頂点 (polygon宣言 — 所与のジオメトリ)
  敷地面積: 宣言 1097.80㎡ / 導出 1097.80㎡ ✔ 一致
  接道: /out/road-s (南側道路) 幅員12000mm ・ 接道長 40600mm ✔ 2m以上
  接道: /out/road-e (東側道路) 幅員6000mm ・ 接道長 20200mm ✔ 2m以上
  建築面積 (水平投影・粗): 569.60㎡ → 建蔽率 51.9%
  延べ面積: 4785.92㎡ → 容積率 436.0%
```

Frontage length is the total of the boundary segment lengths between spaces beneath the site zone and the roads — **the part where the building's own outer wall directly faces the road is not counted.** The inclusion rules for the building footprint are coarse. The definitions are in [spec/semantics.md §6](../../spec/en/semantics.md).

## json — the form machines read

Writes the canonical JSON to standard output. It is the footing for diffs, external connections, and layer composition, and the ordering of its keys is stable.

```sh
npx tsx src/cli.ts json examples/two-rooms.muro
```

```text
{
  "koyu": "0.5",
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
      "h": 2400
    }
  },
  "spaces": {
```

| Exit code | Meaning |
|---|---|
| 0 | Always |

`import` does not survive — the canonical JSON is the single model after composition.

**Default boundaries do not appear in the canonical JSON.** What the canonical JSON holds is **only the authored composition**; it does not hold the derived meaning. So `check` and `json` report different boundary counts for the same file. You can confirm it on a file that writes only two touching rooms and not one `boundary` line.

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
```

```sh
npx tsx src/cli.ts check derived.muro
```

```text
✔ 整合 — 空間 2 / 境界 1
```

```sh
npx tsx src/cli.ts json derived.muro
```

```text
  "boundaries": []
```

`check`'s "1 boundary" is the count on the **meaning** side, having counted the derived default wall; `json`'s empty array is the count on the **authored composition** side. It is not a contradiction. A consumer of the canonical JSON applies `deriveDefaultBoundaries` before reading meaning ([api.md](api.md)). The schema and the stability rules are in [spec/canonical-json.md](../../spec/en/canonical-json.md).

## Combinations worth using

**Put it in place as the gate.** After every edit, before every commit, in CI.

```sh
npx tsx src/cli.ts check examples/house/main.muro --strict
```

`--strict` makes warnings fail too. Without it, "not one floor is generated" ([SUF03](diagnostics.md#suf03)) and "no shape is generated for the vertical circulation" ([SUF04](diagnostics.md#suf04)) slip through green. Give the gate `--strict`.

**Review an edit.** Read it in the language of composition rather than as a text diff. Take out the state before the commit and compare.

```sh
git show HEAD:examples/two-rooms.muro > before.muro
npx tsx src/cli.ts diff before.muro examples/two-rooms.muro
```

```text
差分なし
```

**This trick does not work on a model split with `import`.** `diff` composes the layers from the entry, so putting one extracted file somewhere else leaves the relative `import`s unresolvable. To compare a split model, expand the old version's whole tree with `git worktree` and pass both base-layer paths.

**Run the checks `check` does not.** This is the most important combination.

```sh
npx tsx src/cli.ts check examples/house/main.muro --strict
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
npx tsx src/cli.ts light examples/house/main.muro
```

`check` only looks at the consistency of the composition; **it does not look at whether the building can be used.** The default between touching spaces is a wall, and a wall is impassable without a door. So `check` is green with not one door written — a completely sealed building is pronounced "consistent". The same holds for windows: nobody looks at daylight until `light` is run.

**Only with these three lined up can you say it passed.**

**Draw it.** Level by level.

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L1 -o out/house-L1.svg
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

## The MCP server

The entrance for use from an agent is separate (`koyu-mcp`). It is stateless, and every tool takes the entry's path and composes each time. The tool list and how to register it are in [spec/tools.md](../../spec/en/tools.md).

## Related

- [spec/tools.md](../../spec/en/tools.md) — the contract for the CLI, MCP, and the public API (normative)
- [spec/semantics.md](../../spec/en/semantics.md) — the definitions of the questions each command answers (normative)
- [diagnostics.md](diagnostics.md) — the cause and fix for every diagnostic code `check` returns
- [api.md](api.md) — calling the same derivations from a program
- [gallery.md](gallery.md) — the bundled examples and the drawings that came out of them
