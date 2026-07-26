[English](en/cli.md) · **日本語**

# CLI リファレンス

`koyu` コマンドの使い方を、コマンドごとに「何に答えるか」から引くための頁である。契約の表 (引数・出力・終了コードの規範) は [spec/tools.md](../spec/tools.md) が持つ — ここはそれを、実際の呼び方と実際の出力で使えるようにしたものである。

## 走らせ方

このリポジトリの中から走らせるなら、ルートで次のように書く。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

`npm run koyu -- check examples/two-rooms.muro` も同じである。パッケージをインストールしてあれば `koyu check <file>` で呼べる。**この頁の出力はすべて `npx tsx src/cli.ts …` をリポジトリのルートで実行して得たものである。**

## 共通のかたち

```text
koyu <check|diff|plan|doors|graph|stats|levels|light|site|json> <entry.muro> [args...]
```

**渡すのは常に entry のファイルパス一つである。** `import` で分割されたモデルでも、base層のファイル (`examples/house/main.muro` など) だけを渡す — レイヤーの合成は毎回自動で行われる。分割されたファイルの一枚を単体で渡すと、そのファイルには grid も level も無いので落ちる。

```sh
npx tsx src/cli.ts check examples/house/L1.muro
```

```text
✖ <絶対パス>/examples/house/L1.muro:3行目: 未宣言のレベルです: level:L1
```

`import` の相対パスは**書かれたファイルからの相対**で解決されるので、base層のファイルだけを別の場所にコピーしても合成できない (`ファイルが読めません: ./assets.muro`)。

すべてのコマンドは同じ導出を共有する。CLI・MCP・公開API は同じ答えの別の入口である。

## 終了コードの約束

| 終了コード | 意味 |
|---|---|
| 0 | 成功 (問いには「はい」) |
| 1 | 失敗 (エラーがある / 不足している / 到達できない) |
| 2 | 呼び方が違う (引数不足・未知のコマンド)、または `diff` の入力が壊れている |

`0` と `1` の意味はコマンドごとに違う。各節に書く。**`2` は「あなたの書いたモデル」ではなく「あなたの打ったコマンド」の問題である**、と読み分けてよい。

## --help について

**`--help` というフラグは実装されていない。** 引数を欠いた呼び方をすると使い方が出るが、それは「呼び方が違う」経路であり、**終了コードは 2 になる。**

```sh
npx tsx src/cli.ts --help
```

```text
使い方: koyu <check|diff|plan|doors|graph|stats|levels|light|site|json> <file.muro> [引数...]
  check: --json (Diagnostic[]をJSONで出力) / --strict (警告があれば終了コード1)
  diff:  koyu diff <a.muro> <b.muro> [--json] — 構成の言葉の差分 (0=差分なし / 1=差分あり / 2=入力が壊れている)
```

この使い方の表示は網羅していない。**`plan` の `-l` / `-o` と `doors` の二つのパス引数は書かれていない。** 各コマンドのフラグはこの頁が正である。

## check — 構成は成立しているか

整合を検査する。編集のたびに通す門番であり、CI に置くのもこれである。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ 整合 — 空間 3 / 境界 3
```

| フラグ | 効果 |
|---|---|
| `--json` | 診断を `Diagnostic[]` のJSONで出す。**コード (`BND04` など) が出るのはこのときだけ** |
| `--strict` | 警告があっても終了コード1にする |

| 終了コード | 意味 |
|---|---|
| 0 | エラーなし (`--strict` のときは警告も無い) |
| 1 | エラーがある / `--strict` で警告がある / 構文・合成エラーで読めなかった |

**人向けの出力にコードは出ない。** 診断コードを引きたいときは `--json` を付ける。

```sh
npx tsx src/cli.ts check examples/two-rooms.muro --json
```

```text
[]
```

エラーがあるときの `--json` は次の形になる。`message` は本文だけで、位置は `line` / `file` が別に持つ。

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

(`file` は**解決済みの絶対パス**である。ここでは省略して示した。人向けの出力の行頭にも同じパスが付く。)

構文エラーで読めなかったファイルも `--json` なら有効なJSONを返す — `SYN01` の1件に写される。コードの意味・原因・直し方は [diagnostics.md](diagnostics.md)、台帳は [spec/semantics.md §5](../spec/semantics.md)。

**`check` が緑でも、建物として使えるかは見ていない。** 扉が一枚も無い建物も、窓が一枚も無い建物も緑になる。動線は `doors`、採光は `light` で別に確かめる ([よく使う組み合わせ](#よく使う組み合わせ))。

## diff — この編集で構成の何が変わったか

二つのモデルを**構成の言葉**で比べる。行順・書式・素の `wall` 宣言と省略 (既定壁) の違いは差分にしない。テキストの diff ではなく、意味の diff である。

```sh
npx tsx src/cli.ts diff <a.muro> <b.muro> [--json]
```

`examples/two-rooms.muro` をそのままコピーしたものを `before.muro`、そこから `/L1/b` の `name:居室B` を `name:書斎` に、二室間の扉の `w:780` を `w:900` に変えたものを `after.muro` として比べる。

```sh
npx tsx src/cli.ts diff before.muro after.muro
```

```text
± /L1/b: name 居室B → 書斎
± 境界 /L1/a | /L1/b: door at:0.5 w 780 → 900
```

差分が無いときはこう出る。

```sh
npx tsx src/cli.ts diff examples/two-rooms.muro examples/two-rooms.muro
```

```text
差分なし
```

| フラグ | 効果 |
|---|---|
| `--json` | `ModelDiff` をJSONで出す (grid / levels / assets / polygons / zones / spaces / boundaries の added・removed・renamed・changed) |

| 終了コード | 意味 |
|---|---|
| 0 | 差分なし |
| 1 | 差分あり |
| 2 | 入力が壊れている (構文・合成エラー)、または比較先のファイルが渡されていない |

**`diff` の終了コードだけ意味が違う。** `check` の 0/1 は「整合しているか」、`diff` の 0/1 は「同じか」である。CI で両方使うときは取り違えないこと。

`uid` が一致してパスが違うものは**改名**として検出される。同一性の仕組みは [ADR-0015](../docs/decisions/0015-identity-uid.md)、差分の定義は [ADR-0018](../docs/decisions/0018-semantic-diff.md)。

## plan — 平面図を出す

指定したレベルの平面SVGを生成して書き出す。壁を描く操作はどこにも無い — 壁は境界から導出されて現れる。

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

```text
平面図を生成しました: out/house-L2.svg
```

| フラグ | 効果 |
|---|---|
| `-l <レベル>` / `--level <レベル>` | 描くレベル。既定は**最初に宣言されたレベル** |
| `-o <パス>` | 出力先。既定は `<entry のパスから .muro を除いたもの>-<レベル>.svg` |

| 終了コード | 意味 |
|---|---|
| 0 | 書き出した |
| 1 | 描けなかった (下記の生の例外) |

**注意すべき癖が三つある。**

**`-l` の既定は最下階ではない。** `Object.keys(model.levels)[0]` — つまり `level` 行を**書いた順**の一番目である。`level L2 …` を `level L1 …` より先に書いたファイルでは、既定が L2 になる。意図した階を確実に描くには `-l` を明示する。

**`-l=L2` の形は効かない。** フラグと値は空白で区切る (`-l L2`)。`-l=L2` は黙って無視され、既定のレベルが描かれる。

**`-o` を省くと入力ファイルの隣に書き出す。** `plan examples/two-rooms.muro` は `examples/two-rooms-L1.svg` を作る。リポジトリを汚したくないときは `-o` を付ける。出力先のディレクトリは無ければ作られる。

**失敗すると Node のスタックトレースが出る。** レベルが一つも宣言されていないファイル、あるいは領域を持つ空間が一つも無いレベルを `-l` に渡すと、整った日本語のエラーではなく生の例外が出る (終了コード1)。

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l R -o out/house-R.svg
```

```text
<絶対パス>/src/plan.ts:35
  if (rooms.length === 0) throw new Error(`レベル ${level} に領域を持つ空間がありません`);
                                ^

Error: レベル R に領域を持つ空間がありません
```

**`check` が緑でも `plan` は落ちうる。** 特に、空間がレベルに載っていないとき (診断 [HGT05](diagnostics.md#hgt05) は警告どまり) がこれである。`plan` が落ちたら、まず `check --strict` を通してみるとよい。

描画の規約 (壁の黒帯・open の破線・扉の軌跡・吹抜けの対角線・敷地境界線) は [spec/semantics.md §7](../spec/semantics.md)。同梱例の出来上がりは [gallery.md](gallery.md)。

## doors — そこからそこへ、扉を何枚通るか

空間グラフ上の最少扉数の経路を出す。避難・動線の問いである。

```sh
npx tsx src/cli.ts doors examples/two-rooms.muro /L1/a /out
```

```text
2枚 — /L1/a → /L1/b → /out
```

| 引数 | 意味 |
|---|---|
| `<パスA> <パスB>` | 出発と到着の空間パス。両方必須 |

| 終了コード | 意味 |
|---|---|
| 0 | 到達できる |
| 1 | 到達できない |
| 2 | パスが二つ揃っていない |

`open` 境界と階段は扉を数えず通れる。`wall` は扉があるときだけ通れる。`shaft` (EV等) と `void` (吹抜け) は空間として連続するが人は通れない。手すり (`air:1` の壁) も通れない — `air` は遮蔽の話であって通行の話ではない。

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
```

```text
3枚 — /home/bed1 → /home/hall2 → /home/hall1 → /site/east → /site/garden → /out/road
```

**存在しないパスを渡しても「到達できません」と出る。** 綴りの間違いと本当の未到達は同じメッセージ・同じ終了コード1になる。

```sh
npx tsx src/cli.ts doors examples/house/main.muro /home/bed9 /site/garden
```

```text
/home/bed9 から /site/garden へは到達できません
```

到達できないと出たら、まず `graph` でパスの綴りを確かめる。外部は一つとは限らない — `examples/house` の外部は `/out/road` `/out/n` `/out/e` `/out/w` に割れていて、`/out` という空間は存在しない。

## graph — この空間は何と、どう繋がっているか

空間ごとの隣接を、境界の種別と扉数つきで並べる。`doors` が答えを出す前の地図である。

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

| 終了コード | 意味 |
|---|---|
| 0 | 常に |

記号は境界の種別を言う。

| 記号 | 意味 | 通れるか |
|---|---|---|
| `— 扉N` | 扉が N 枚ある壁 | 通れる |
| `\| 壁` | 扉の無い壁 | 通れない |
| `〰 開放` | `open` — 物が無い | 通れる |
| `\| 手すり等(外気開放・通行不可)` | `air:1` の壁 (手すり・柵・塀) | 通れない |
| `↕ 階段` | `stair` | 通れる |
| `↕ シャフト(通行不可)` | `shaft` (EV等) | 通れない |
| `↕ 吹抜け` | `void` — 床の不在 | 通れない |

括弧の中は境界の属性である。**宣言していない境界も出る** — 接する空間の既定は壁なので、書かなかった接触は「扉の無い壁」として現れる ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。属性の付いていない `| 壁` の行はたいていこれである。

## stats — 面積はいくつか

レベル別の床面積、半屋外の別掲、ゾーン別・型別・use別の集計を出す。

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

| 終了コード | 意味 |
|---|---|
| 0 | 常に |

列はタブ区切りの `パス / 名前 / 型 / 面積` である。面積は壁芯。**半屋外と吹抜けは屋内床面積に算入されない** — 半屋外は別掲、`type:void` は「床面積不算入」と出る。半屋外は宣言ではなく導出である (`exterior` に `open` か `air:1` で接する空間)。

型別の集計 (`ldk: 39.75㎡`) は `space` の第2位置引数を、`use別` はゾーンから継承した実効 `use` を数える。**型は開かれた語彙なので、綴りを間違えても静かに別の型として数えられる。**

## levels — 高さはどう積み上がっているか

テキストの矩計。レベルを z の降順に並べ、階高を天井高と床組み厚に分解して見せる。

```sh
npx tsx src/cli.ts levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ 階高 2900 = 天井2400 + slab500
L1	z:0	h:2400
  ↑ 階高 2900 = 天井2400 + slab500
```

| 終了コード | 意味 |
|---|---|
| 0 | 出せた |
| 1 | レベルが一つも定義されていない |

`↑ 階高` の行は**下の階から見た**積み上がりである。余りがあれば出る (`examples/tower` では `階高 3200 = 天井2600 + slab500 + 余り100`)。空間側に `h:` を持つものは末尾に別掲される。

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ 階高 4000 = 天井2700 + slab1300
L1	z:0	h:2700
  ↑ 階高 4000 = 天井2700 + slab1300
個別天井高: /L1/hall h:6700
```

分解が出ないときは、下階に `h` が無いか、上階に `slab` が無い。そのときは高さの検査も行われず、[HGT03](diagnostics.md#hgt03) / [HGT04](diagnostics.md#hgt04) の警告が出る。**空間を持たない屋上レベル (`level R 5800 slab:500`) を宣言しておくと、最上階も検査の対象になる。**

## light — 居室は 1/7 を満たすか

居室 (`daylight:1` を書いた空間) について、窓面積が床面積の 1/7 以上かを確かめる。補正係数を掛けない粗い判定であり、基本計画の解像度に合わせた早期警報である。

```sh
npx tsx src/cli.ts light examples/house/main.muro
```

```text
✔ /home/ldk	LDK	窓 7.54㎡ / 床 39.75㎡ = 1/5.3 (必要 1/7 ≈ 5.68㎡)
✔ /home/bed1	主寝室	窓 5.72㎡ / 床 26.50㎡ = 1/4.6 (必要 1/7 ≈ 3.79㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

| 終了コード | 意味 |
|---|---|
| 0 | 全て満たす、**または `daylight:1` の空間が一つも無い** |
| 1 | 不足している室がある |

対象は `daylight:1` を書いた空間だけである — 型は見ない ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md))。**窓を一枚も書いていなければ当然落ちる。**

```sh
npx tsx src/cli.ts light examples/two-rooms.muro
```

```text
✖ /L1/a	居室A	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ /L1/b	居室B	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ 2室中 2室が不足しています
```

**対象が無いときも終了コードは 0 である。** `daylight:1` を一つも書いていないモデル (事務所など) では判定そのものが行われない。

```sh
npx tsx src/cli.ts light examples/office.muro
```

```text
採光の対象がありません (判定する室に daylight:1 を書きます)
```

これを「合格」と読まないこと。`daylight:1` を書き忘れても同じ出力になる。`h` を持たない `window` は数えられず、その旨が行末に付く (`⚠ h未指定の窓は数えていません`)。判定の定義は [spec/semantics.md §6](../spec/semantics.md)。

## site — 敷地の数字

敷地面積・接道・建蔽率・容積率を、宣言ではなく構成から導出する。基本計画のボリューム検討の数字である。

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

| 終了コード | 意味 |
|---|---|
| 0 | 敷地レポートを出せた |
| 1 | 敷地が無い (`site:1` のゾーンも `road:` を持つ外部も無い) |

必要な宣言は二つである。**敷地は `site:1` を持つゾーン、道路は `road:<幅員mm>` を持つ `exterior` の空間**。どちらも無ければこう出る。

```sh
npx tsx src/cli.ts site examples/mansion.muro
```

```text
敷地がありません (zone に site:1 を、道路に road:幅員 を宣言します)
```

`polygon` で敷地形状を宣言すると、面積はシューレース公式で多角形から出て、ゾーンの `area:` (測量値) と照合される。

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

接道長は敷地ゾーン配下の空間と道路の境界線分長の合計である — **建物の外壁が直接道路に面する分は数えない。** 建築面積の算入細則は粗い。定義は [spec/semantics.md §6](../spec/semantics.md)。

## json — 機械が読む形

正準JSONを標準出力に書く。差分・外部接続・レイヤー合成の土台であり、キーの並びは安定している。

```sh
npx tsx src/cli.ts json examples/two-rooms.muro
```

```text
{
  "koyu": "0.4",
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

| 終了コード | 意味 |
|---|---|
| 0 | 常に |

`import` は残らない — 正準JSONは合成後の単一のモデルである。

**既定境界は正準JSONに出ない。** 正準JSONが持つのは**書かれた構成**だけで、導出された意味は持たない。だから同じファイルに対して `check` と `json` は違う境界の数を言う。接する二室だけを書き、`boundary` を一行も書いていないファイルで確かめられる。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0
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

`check` の「境界 1」は導出された既定の壁を数えた**意味**の側の数、`json` の空配列は**書かれた構成**の側の数である。矛盾ではない。正準JSONの消費者は `deriveDefaultBoundaries` を適用してから意味を読む ([api.md](api.md))。スキーマと安定性の規則は [spec/canonical-json.md](../spec/canonical-json.md)。

## よく使う組み合わせ

**門番として置く。** 編集のたび、コミットの前、CI で。

```sh
npx tsx src/cli.ts check examples/house/main.muro --strict
```

`--strict` を付けると警告も落とす。付けないと「検査ができていません」系の警告 ([HGT03](diagnostics.md#hgt03) / [HGT04](diagnostics.md#hgt04) / [HGT05](diagnostics.md#hgt05)) が緑のまま通り抜ける。門番には `--strict` を付ける。

**編集を見直す。** テキストの diff ではなく、構成の言葉で読む。コミット前の姿を取り出して比べる。

```sh
git show HEAD:examples/two-rooms.muro > before.muro
npx tsx src/cli.ts diff before.muro examples/two-rooms.muro
```

```text
差分なし
```

**`import` で分割したモデルではこの手は使えない。** `diff` は entry からレイヤーを合成するので、取り出した一枚だけを別の場所に置くと相対 `import` が解決できない。分割モデルを比べるときは `git worktree` で旧版のツリーを丸ごと展開し、両方の base層のパスを渡す。

**`check` がしない検査を回す。** これが最も大事な組み合わせである。

```sh
npx tsx src/cli.ts check examples/house/main.muro --strict
npx tsx src/cli.ts doors examples/house/main.muro /home/bed1 /out/road
npx tsx src/cli.ts light examples/house/main.muro
```

`check` は構成の整合を見るだけで、**建物として使えるかは見ない。** 接する空間の既定は壁であり、壁は扉が無ければ通れない。だから扉を一枚も書かなくても `check` は緑になる — 完全に密閉された建物が「整合」と言われる。窓についても同じで、`light` を回すまで採光は誰も見ない。

**この三本を並べて初めて「通った」と言える。**

**図にする。** 階ごとに。

```sh
npx tsx src/cli.ts plan examples/house/main.muro -l L1 -o out/house-L1.svg
npx tsx src/cli.ts plan examples/house/main.muro -l L2 -o out/house-L2.svg
```

## MCP サーバー

エージェントから使う入口は別にある (`koyu-mcp`)。ステートレスで、全ツールが entry のパスを受けて毎回合成する。ツール一覧と登録の仕方は [spec/tools.md](../spec/tools.md)。

## 関連

- [spec/tools.md](../spec/tools.md) — CLI・MCP・公開APIの契約 (規範)
- [spec/semantics.md](../spec/semantics.md) — 各コマンドが答える問いの定義 (規範)
- [diagnostics.md](diagnostics.md) — `check` が返す全診断コードの原因と直し方
- [api.md](api.md) — 同じ導出をプログラムから呼ぶ
- [gallery.md](gallery.md) — 同梱例と、そこから出た図面
