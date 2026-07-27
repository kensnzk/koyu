[English](en/cheatsheet.md) · **日本語**

# チートシート — 全構文を一枚に

書き方を思い出すための索引である。**規範は spec/ が持つ** — 各節の見出しから、その事実を所有する仕様の節へ飛べる。順を追って学ぶなら [start.md](start.md)、エラー文から引くなら [diagnostics.md](diagnostics.md)、動く実例は [gallery.md](gallery.md)。

記法の骨格 ([language.md §1](../spec/language.md)):

| 規則 | |
|---|---|
| 一行が一文 | `キーワード 位置引数… key:value…` |
| トークン区切り | 空白 (何個でもよい — 桁揃えは自由) |
| コメント | `#` から行末まで |
| 空白を含む値 | `"…"` で囲む (閉じなければエラー) |
| 字下げ行 | 直前の親行に従属する (`boundary` の下の `door`/`window`/`seg`、`space` の下の `area`、`band` の下の `space`)。一段だけで入れ子は無い |
| 属性値 | `-?\d+(\.\d+)?` の形なら数値、それ以外は文字列 |
| 同一行内の同名キー | エラー (後勝ちの黙認はしない) |
| 長さの単位 | mm。線分上の比率は 0..1。面積の出力は㎡ (壁芯) |

## 最小のファイル

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

`check` が緑になり `plan` が図を描く最小の4行である。

| 行 | 要否 | 理由 |
|---|---|---|
| `grid X` / `grid Y` | **必須** | 座標の直書きが無いため、通り芯が無いと領域を書けない。使う行より**前**に置く |
| `level L1 0` | 領域を持つ空間には実質必須 | 無いと `check` は警告どまりだが、`plan` は `No level is defined` で落ちる |
| `space` の型 (第2位置引数) | **必須** | 省略すると領域の1つ目が型と読まれ、`領域は X?..X? と Y?..Y? の2つで指定します` になる |
| `koyu 0.5` | 任意 | 省略時は最新版 0.5 の意味論。意味を固定したいファイルは書く ([language.md §2](../spec/language.md)) |
| `name …` / `unit mm` | 任意 | |
| `h:` / `slab:` | 任意 | 書かないと床も天井も生成されない (`Level L2 has no slab:, so not one floor is generated on this storey` — SUF03) |
| `space /out exterior` | 任意 | ただし書かないと建物に外皮が無い (下の「既定値」参照) |
| `boundary` | 任意 | 接する空間の既定は壁 ([language.md §4](../spec/language.md)) |

空のファイルも `✔ Consistent — 0 spaces / 0 boundaries` になる。**緑は「書いたものに矛盾が無い」であって「建物として成立している」ではない。**

## 基盤の宣言 — base層が一度だけ持つ ([language.md §2](../spec/language.md))

| 書き方 | 意味 |
|---|---|
| `koyu 0.5` | 言語版。base層 (entry) でのみ・一度だけ。対応は `0.1` `0.2` `0.3` `0.4` `0.5` |
| `name 街角の複合ビル` | 建物名。残りの行全体を値にとる (空白可)。一度だけ |
| `unit mm` | v0はmmのみ |
| `grid X 0 6400 12800 19200` | X軸の通り芯座標。昇順・2つ以上。`X1` `X2` … と自動命名される |
| `grid Y 0 5600 7600 13200` | Y軸。軸ごとに一度だけ |
| `level L1 0 h:3600 slab:600` | レベル: 名 z [天井高] [床組み厚mm] |
| `level L4..L10 11000 pitch:3000 h:2500 slab:450` | 等差の範囲宣言。`pitch:` 必須。`z + pitch×k` に展開 |
| `level R 30200 slab:500` | 空間を持たないレベル (屋上) は最上階の高さ検査の上限になる |

## 位置の書き方 ([language.md §2 通り参照とオフセット](../spec/language.md))

| 書き方 | 意味 |
|---|---|
| `X2` | 通り芯の座標 |
| `X2+600` / `Y3-150` | 通りからのオフセットmm。**整数のみ** (`X2+600.5` は `未定義の通り名です`) |
| `X1..X2+3200` | 範囲。両端とも通り参照で書く |
| `X1..X2 Y1..Y2` | 領域 = X系の範囲とY系の範囲の2トークン |
| `X1..X2 Y1..Y3 + X2..X3 Y1..Y2` | 領域の合併。`+` は独立したトークン (前後に空白) |
| `X2..X1` | 逆順は同じ矩形の別綴り。昇順に正規化して保存される |
| `-2600,-7000` | mm座標の直書き。**`polygon` だけ**の例外 ([language.md §7](../spec/language.md)) |

**方角。** X は東が正、Y は北が正。`edge` と `hinge` の N/E/S/W はこの軸で読む。

| | 向き | 軸 |
|---|---|---|
| `N` | 北 | +Y |
| `S` | 南 | −Y |
| `E` | 東 | +X |
| `W` | 西 | −X |

`edge` は**先に書いた空間 (a側) の矩形から見た辺**である ([semantics.md §2](../spec/semantics.md))。

## space — 空間 ([language.md §3](../spec/language.md))

```muro-part
space /L5/A/ldk ldk X1+3200..X2+3200 Y1..Y1+4000 + X2+3200..X3 Y1..Y1+2400 name:LDK floor:オーク
space /out/road-s exterior name:南側道路 road:12000
```

| 要素 | 書き方 | 意味 |
|---|---|---|
| パス | `/L5/A/ldk` | 同一性。`/` 区切りの集計の階層。先頭セグメントがレベル名ならそのレベルに属する |
| 型 | 第2位置引数 (必須) | 開かれた語彙。同梱例では31語が使われている |
| 領域 | `X?..X? Y?..Y?` | 無くてもよい (`exterior` など)。重なりはエラー |
| `level:L1` | 属性 | 所属レベルの明示。階を跨ぐくくり (メゾネット) で使う |
| `h:2400` | 属性 | 天井高。既定はレベルの `h` |
| `use:exclusive` | 属性 | 集計軸。`zone` から継承される |
| `daylight:1` / `daylight:0` | 属性 | 採光判定を掛ける / 掛けない (既定)。`light` の唯一の入口 |
| `road:12000` | 属性 | exterior空間の幅員 — 道路の印 |
| `uid:…` | 属性 | 改名を跨ぐ永続同一性トークン。数字だけ・空白はエラー |

**ツールが構造として解釈する型** ([vocabulary.md](../spec/vocabulary.md)):

| 型 | 解釈 |
|---|---|
| `exterior` | 外部。領域なしでよい。`/out/road-s` のように複数に割れる |
| `void` | 吹抜け。床面積に算入せず、通行できない |
| `daylight:1` (型ではなく属性) | 採光 (`light`) の 1/7 判定を掛ける室の宣言 |

**それ以外の型は運ばれるだけである。** `wc` を `room` と書けば採光判定に入り、`rooom` と綴っても黙って通る。

**子で割るときは親を `zone` にする。** 領域つきの `space` の下に領域つきの `space` を置くと `空間の領域が重なっています` (GEO02) になる。住戸を室に割る書き方は下の `zone` の節を見よ。

## band — 寸法と並びで割る ([language.md §3 帯](../spec/language.md))

```muro
grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
band X X1..X3 Y1..Y2
  space /L1/ldk ldk w:3600 name:LDK
  space /L1/hall hall w:1800 name:玄関
```

位置ではなく**寸法と並び**を書き、位置を導出させる記法である (`level` の積み上げの水平版)。領域で書く書き方と併存し、どちらでもよい。上の6行は `space … X1..X2 Y1..Y2` / `X2..X3 Y1..Y2` と同じモデルを与える。

| 要素 | 書き方 | 意味 |
|---|---|---|
| 軸 | 第1位置引数 `X` / `Y` | 割る向き (`X` = 西→東、`Y` = 南→北) |
| 範囲 | `X?..X? Y?..Y?` | 帯の範囲。**昇順必須** (並びが意味を持つため逆順を正規化しない)。`+` の合併は不可 |
| 要素 | 字下げした `space` 行 | 領域の代わりに幅 `w:` を持つ。他は通常の `space` と同じ |
| `w:1800` | 帯の向きの寸法mm | |
| `w:rest` | 残りを吸収する印 | 帯に高々一つ |

- **`band` の行に `key:value` は書けない** — 帯はモデルに残らないので属性の運び先が無い。属性は要素の `space` 行に書く。
- **既定は `rest` を使わない「閉じた帯」**である。全要素に寸法を書き、合計が帯幅と一致することを parse が照合する — 図面の「部分寸法の合計 = 総寸法」と同じ検算。
- 要素に `level:` と `area` は書けない。帯の外の `space` に `w:` は書けない (`space に w: は書けません`)。
- 帯は parse 時に通常の空間へ展開され、**モデルにも正準JSONにも残らない**。帯で書いた版と位置で書いた版は同じ正準JSONを与える。
- 破れはすべて parse のエラーで、`check --json` では SYN01 として出る (専用コードは無い)。

```text
✖ band.muro:line 4: The dimensions sum to 4600mm against a band width of 5400mm, 800mm short (fix a dimension, or make one of them w:rest)
  /L1/ldk w:3600
  /L1/hall w:1000
```

実例は [examples/tower/typical.muro](../examples/tower/typical.muro)、なぜ入れたかは [ADR-0019](../docs/decisions/0019-position-and-lines.md)。

## area — 字下げの数えない分節 ([language.md §3](../spec/language.md))

```muro-part
space /L1/hall hall X1..X2 Y1..Y2 name:エントランスホール
  area X1..X1+1800 Y1..Y2 name:土間 floor:モルタル
```

`space` の直下に字下げ。領域と上書き属性だけを持つ。面積・室数・グラフに一切現れない (隔離則)。親の領域からのはみ出しは警告、領域を持たない空間への `area` はエラー。

## boundary — 境界 ([language.md §4](../spec/language.md))

```muro-part
boundary /L5/A/hall /L5/corridor t:180 spec:RC
  door D1 at:X4 name:玄関
  seg w:1800 at:X5 edge:S spec:受付ガラス
boundary /L1/hall /L2/void type:void
```

二つの空間パスを結ぶ第一級の関係。**壁芯線分は書かない** — 両空間の割付から導出される。空間より前に書いてよい (前方参照可)。

| 属性 | 意味 |
|---|---|
| `type:` | トポロジー。既定 `wall` |
| `t:180` | 壁厚mm (芯振り分け)。未指定の描画既定は100 |
| `air:1` | 物はあるが外気・光を遮らない (手すり・柵・フェンス) |
| `edge:S` | 線分をa側矩形の特定の辺に限定する |
| `spec:RC` `fire:60` `sound:D-50` … | 自由。`spec` は物の名 — ツールは解釈しない |

**type の一覧** ([semantics.md §3](../spec/semantics.md)):

| type | 方向 | 通行 | 意味 |
|---|---|---|---|
| `wall` | 水平 (既定) | 扉があるときだけ | 物がある |
| `open` | 水平 | 常に可 | 何もない |
| `stair` | 垂直 | 可 | 階段 |
| `shaft` | 垂直 | 不可 | 連続するが通れない (EV・PS) |
| `void` | 垂直 | 不可 | 床の不在 |

床は書かない — 垂直の隣接は平面の重なりから導出され、既定は床である。壁境界を異なるレベル間に書くとエラー (BND03)。

## door / window / seg — 字下げの開口と分節 ([language.md §4 開口](../spec/language.md))

```muro-part
boundary /L1/office /out t:180 spec:EW1
  door w:1800 edge:S name:エントランス
  window w:3600 h:2200 edge:S at:0.25 sill:800
  seg w:1800 at:X5 edge:S spec:受付ガラス
```

| 属性 | 意味 |
|---|---|
| (先頭の非 `key:value` トークン) | 建具アセット参照。`door SD1 sill:800` |
| `w:900` | 幅mm。**必須** (アセット側でもよい) |
| `h:2100` | 高さmm。任意。`window` の採光計算は `h` を持つものだけ数える |
| `at:0.5` | 比率 0..1。既定0.5。線分内にクランプされる |
| `at:X2+450` | 通り参照の絶対位置。クランプしない (はみ出し・軸違いはエラー) |
| `edge:S` | 線分が複数あるときの辺選択 |
| `hinge:E` | 吊元。水平線分は W/E、垂直線分は N/S。既定は始端側 |
| `swing:b` | 開く側 a/b。既定は a (領域を持つ側) |
| `style:sliding` | `hinged` (既定) / `sliding` / `auto`。平面の建具表現が変わる |
| `sill:800` `name:…` | 自由 |

- `door` は通行、`window` は採光 (通行しない)。
- `seg` は境界上の数えない分節。位置 (`at`/`w`/`edge`) と上書き属性だけを運び、通行・接続に影響しない。`w:` 必須。
- **外部 (`/out`) に開口を置くときは、`edge:` で辺を選ぶ。** 外周は他室と接する区間を除いた残りであり、たいてい複数の辺に分かれる。分かれたまま置くと `境界線分が複数あります。edge:N/E/S/W で辺を指定してください` になる。
- 同じ線分上の開口同士の重なりはエラー (中心間距離 ≥ (w₁+w₂)/2)。

## asset — 建具アセット ([language.md §6](../spec/language.md))

```muro-part
asset SD1 door w:800 h:2000 style:sliding name:片引き戸
asset W1 window w:2600 h:2200 sill:0 name:掃き出し窓
```

`asset <名> door|window [属性…]`。参照される既定値の束で、第4の要素ではない。アセットの属性が既定になり、インスタンス側の属性が上書きする。kind不一致・未定義参照・名前の重複 (合成時も) はエラー。

## zone — 数える集約 ([language.md §5](../spec/language.md))

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
zone /site name:敷地 site:1 area:1097.80
```

幾何を持たず、**パス接頭辞**で配下の空間を束ねる。だから住戸を室に割るときは、親を `space` ではなく `zone` にして、その下に領域つきの `space` を並べる。

| 属性 | 意味 |
|---|---|
| `name:` | 自由 |
| `use:` | 配下に継承 (空間側の宣言が勝つ) |
| `site:1` | 敷地の印。`site` の問いの対象になる |
| `area:1097.80` | 敷地の宣言面積㎡ (測量値)。導出面積と照合される |
| `uid:` | 永続同一性トークン (spaceと同じ規則) |

パスの重複はエラー、配下に空間が無ければ警告。

## polygon — 敷地形状 ([language.md §7](../spec/language.md))

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

`polygon /ゾーンパス x,y x,y x,y …`。頂点は3つ以上、mm座標 (グリッドと同じ座標系)。**この記法で唯一、格子に載らない「書かれる形」**である — 敷地は測量由来の所与だから。`site:1` のゾーンに対応させる (対応が無ければ警告)。別ファイル+`import` の隔離レイヤーに置く運用が標準。

## column — 柱 ([language.md §3](../spec/language.md)・ADR-0023)

```muro-part
column 800 L1..L6
column 900 B2..L6 x:X2,X3 y:Y2 d:1200 spec:SRC
```

`column <一辺mm> <レベル範囲|レベル名> [属性…]`。**位置は書かない** — 通り芯の交点のうち、
そのレベルに床のある所に立つ。`x:` / `y:` で通りを限定 (未指定は全通り)、`d:` で矩形断面の奥行。
**同じ交点に二本は立たず、先に書いた宣言が勝つ** — だから**宣言の順序は意味**であり、
正準JSONでも並べ替えられない (ADR-0029)。

## line — 描かれた線 ([language.md §4](../spec/language.md)・ADR-0022)

```muro-part
boundary /L1/a /L1/b t:120
  line X3,Y1 X3+600,Y2-900
```

境界の直下に字下げして書く。端点は**通り語の対** (`X3,Y1` / `X3+600,Y2-900`) で、
生の座標も角度も書けない。境界の実現を、隣接からの導出ではなく**設計の行為**として与える —
二空間の割付の合併を線の両側へ分け直すので、一方が失う面積をもう一方が得る。
一つの境界に線は一本。線は**平面を区切る行為**なので、垂直境界には引けない。

## 縦動線 — stair / ramp / escalator / lift ([vocabulary.md](../spec/vocabulary.md)・ADR-0021)

```muro-part
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N form:return turn:R
space /L1/e escalator X4..X5 Y1..Y2 escalator:E lane:1200
space /L1/ev shaft X2..X3 Y1..Y2 lift:1
```

キーが装置を名指し、値が**上る向き** (`N`/`E`/`S`/`W`。lift は `1`)。
**段数も踏面も踊り場も勾配も書かない** — 領域と階高から導かれ、`check` の RUN06/RUN07 が
導出結果を検査する。`form:return` で折返し、`turn:R|L` で回り方、
`riser:` `tread:` `entry:` `landing:` `lane:` `slope:` で規則の側を上書きする。
トポロジー (どの階と繋がるか) は別に垂直境界 (`stack` / `type:stair`) が持つ。

## import — 合成 ([language.md §8](../spec/language.md))

```muro-part
import ./assets.muro
import ./L1.muro
```

書かれたファイルからの相対パスでレイヤーを読み、**加算合成**する。

| 規則 | |
|---|---|
| base層 (entry) が持つもの | `koyu` / `name` / `unit` / `grid` / `level` を一度だけ |
| 各レイヤーが足すもの | 空間・境界・ゾーン・アセット・polygon |
| 二重import・循環 | 冪等 (同じレイヤーは一度だけ) |
| 衝突 | ビルドエラー。両者の出所 (`ファイル:行`) を言う。黙った上書きは無い |
| 正準JSON | 合成後の単一モデル。`import` は残らない |

## スパン展開と stack ([language.md §3・§4](../spec/language.md))

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:Bタイプ use:exclusive
zone /L3..L10/A name:Aタイプ use:exclusive
boundary /L2..L9/A/ldk /L2..L9/A/hall t:100 spec:LGS
  door w:800
stack ev L1..L10 type:shaft
```

| 書き方 | 意味 |
|---|---|
| パス先頭の `L2..L9` | 宣言済みレベルの**z順の並び**に展開される (名前の連番ではない) |
| 一行の中の複数パス | スパンは一つに揃える |
| 展開行の字下げ行 | 展開された全てに付く (扉も一度書けば全階に載る) |
| `stack 名 L1..L11 type:stair\|shaft\|void` | 連続レベル対 `/Lk/名 \| /Lk+1/名` に垂直境界を一括で張る |

## 既定値 ([language.md §9](../spec/language.md))

| 項目 | 既定 |
|---|---|
| 接する空間の境界 | `wall` — **書かない**。例外 (open / air:1 / 属性・開口つき) だけ宣言する |
| 垂直の隣接 | 床 (slab) — **書かない**。例外 (stair / shaft / void) だけ宣言する |
| **領域を持たない空間 (`/out` 等) との境界** | **無い。書かなければ存在しない** — どの外部かの名指しが情報だから |
| boundary type | `wall` |
| boundary t | なし (描画時のみ 100mm) |
| opening at | 0.5 (比率・クランプあり) |
| opening hinge / swing | 線分の始端側 / a側 (領域を持つ方) |
| opening style | `hinged` |
| space level | パス先頭セグメント (レベル名のとき) |
| space h | レベルの `h` |
| 面積算定 | 壁芯 |
| 言語版 | `0.5` (宣言を省略したとき) |

この表の3つ目 (領域を持たない空間との境界) が非対称の核心である。**内壁は自動で立つが、外皮は自動では立たない。** `boundary /L1/居間 /out …` を一本も書かなくても `check` は緑になる。

## CLI ([tools.md](../spec/tools.md))

```sh
npx tsx src/cli.ts <command> <entry.muro> [args…]
npm run koyu -- <command> <entry.muro> [args…]    # 同じもの
```

entryは常にファイルパスで、`import` は自動で合成される。

| コマンド | 引数 | 返るもの | 終了コード |
|---|---|---|---|
| `check` | `--json` / `--strict` | 整合の可否・エラー/警告 (出所つき) | 0=緑 / 1=エラー (`--strict` は警告も) |
| `plan` | `-l レベル` `-o 出力.svg` | 平面SVG。既定は最初のレベル / `<entry>-<レベル>.svg` | 0 / 2=未宣言のレベル名 |
| `doors` | `/パスA /パスB` | 最少扉数と経由列 | 0 / 1=到達不能 / 2 |
| `graph` | — | 空間ごとの隣接 (境界種別・扉数) | 0 |
| `stats` | — | レベル別面積・半屋外別掲・ゾーン別・型別・use別 | 0 |
| `levels` | — | テキストの矩計 (階高の積み上がり) | 0 |
| `axo` | `-o 出力.svg` `-d NE\|NW\|SE\|SW` `-l L1..L5` `-s 縮尺` `--no-walls` `--ceilings` | 軸測図SVG (床・屋根・壁・柱・縦動線) | 0 / 2=未宣言のレベル名 |
| `runs` | — | 縦動線の一覧 (装置・上る高さ・導出された勾配と走り長) | 0 |
| `light` | — | **`daylight:1` と宣言された室**の1/7採光判定 | 0=全て✔ / 1 |
| `site` | — | 敷地面積 (宣言/導出照合)・接道・建蔽率・容積率 | 0 / 1=敷地なし |
| `json` | — | 正準JSON ([canonical-json.md](../spec/canonical-json.md)) | 0 |
| `diff` | `<b.muro>` `--json` | 構成の言葉の差分 | 0=差分なし / 1=差分あり / 2=入力が壊れている |

- 引数なしで呼ぶと使い方を表示して**終了コード2**で終わる。
- **`check` が緑でも建物が使えるとは限らない。** 扉を一枚も書かなくても緑になるので、`doors` を動線の検査として併せて回す。
- `check` の「境界 N」は導出された既定境界を含む数である。正準JSON (`json`) には書かれた境界しか出ない — 同じモデルで `境界 1` と `"boundaries": []` が両立する ([ADR-0014](../docs/decisions/0014-default-boundaries.md))。

## 解釈される属性 (★) ([vocabulary.md](../spec/vocabulary.md))

台帳に載っている語だけがツールに読まれる。**載っていない `key:value` は自由に書けて、そのまま運ばれる** — つまり `nmae:居室` は黙って通る。

| 要素 | 解釈される属性 |
|---|---|
| space | `type` (一部) `level` `h` `use` `daylight` `ceiling` `road` `uid` ・ 領域 ・ `w` (帯の要素のときのみ) ・ 縦動線 (`stair` `ramp` `escalator` `lift` `form` `turn` `entry` `landing` `riser` `tread` `lane` `slope`) |
| boundary | `type` `t` `air` `edge` ・ `h` (`air:1` の天端高) |
| opening | `kind` (door/window) ・ アセット参照 ・ `w` `h` `at` `edge` `hinge` `swing` `style` |
| level | `z` `h` `slab` `pitch` `underground` |
| zone | `use` `site` `area` `uid` |
| asset | 開口の属性すべて (既定値として) |
| polygon | 頂点列 |
| column | 一辺 ・ レベル ・ `d` `x` `y` (**宣言順も意味**) |
| line | 端点の対 (通り語) |
| area / seg | 位置 (領域 / `at`・`w`・`edge`) |

**★の値は検査される** — 数値でなければ [ATT01](diagnostics.md#att01)、決まった語彙の外なら [ATT02](diagnostics.md#att02) ([ADR-0028](../docs/decisions/0028-diagnostics-per-declaration.md))。書いたのに解釈されなかった値は黙って既定へ落ちない。

`name` `floor` `spec` `fire` `sound` `sill` などは自由語である。`spec` は物の名 (RC・LGS・手すり・カーテンウォール…) を書く場所で、ツールは解釈しない。
