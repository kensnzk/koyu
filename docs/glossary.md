---
title: 用語集
mode: reference
---

# 用語集

koyu の語を引き当てるための表である。**ここに書かれた一文が、その語の定義である。**より長い説明が要るときは右端の頁へ行く。

用語は六つの群に分けてある — 骨格 / 要素 / 属性 / 導出される性質 / ファイルと版 / 検査と問い。最後に koyu の外の語を置いた。

## 骨格 — 位置を決めるもの

| 語 | 定義 | 詳しく |
|---|---|---|
| 通り芯 (grid) | 軸ごとに一度だけ宣言する座標の昇順の列。`X1`, `X2`… と自動命名され、以後の位置はすべてこの名で書かれる | [grid](reference/muro/grid.md) |
| 通り参照 | 位置の書き方。`X2`・`X2+600`・`Y3-150` のように、常に通り芯からの言葉で書く。**座標の直書きは無い** | [位置の書き方](reference/muro/positions.md) |
| レベル (level) | 階。名前と FL の高さ z を持ち、任意で基準天井高 `h` と床組み厚 `slab` を持つ | [level](reference/muro/level.md) |
| 範囲宣言 | `level L4..L10 11000 pitch:3000` — 等差のレベルを一行で宣言する形 | [level](reference/muro/level.md) |
| スパン展開 | 空間パスの**先頭セグメント**が `L3..L10` の形のとき、宣言済みレベルの z 順の並びに展開されること。基準階を一度だけ書くための仕組みで、`space` も `zone` も `boundary` も展開され、字下げの開口も展開先すべてに付く | [level](reference/muro/level.md) |
| 積層 (stack) | `stack ev L1..L11 type:shaft` — 連続するレベル対のすべてに、同名の空間どうしを結ぶ垂直境界を一括で張る宣言 | [stack](reference/muro/stack.md) |
| 帯 (band) | `band X X1..X3 Y1..Y2` と字下げした `space` 行 — 位置ではなく寸法と並びを書き、位置を導出させる記法。解析時に通常の空間へ展開され、モデルにも正準JSONにも残らない | [band](reference/muro/band.md) |
| 閉じた帯 | 全要素に寸法を書き、その合計が帯幅と一致する帯。`w:rest` を使わないのが既定で、合計の照合が寸法の打ち間違いを捕まえる | [band](reference/muro/band.md) |
| 方位 (N/E/S/W) | X は東が正、Y は北が正。したがって N=+Y, S=-Y, E=+X, W=-X。`edge` はこの方位を **a側 (先に書いた空間) の矩形から見て**指す | [方位](reference/muro/orientation.md) |
| 壁芯 | 面積算定と壁線分の基準となる線。壁厚 `t` は芯から両側へ等分に振り分けられる | [boundary](reference/muro/boundary.md) |

## 要素 — 書かれるもの

| 語 | 定義 | 詳しく |
|---|---|---|
| 空間 (space) | 一次要素。パス・型・領域 (矩形の合併) を持つ。室・ゾーン内の一区画・外部の領域がこれになる | [space](reference/muro/space.md) |
| パス | `/L1/A/ldk` — 空間とゾーンの同一性であり、同時に集計の階層。先頭セグメントは、同名の `level` が宣言されていればレベルになる | [space](reference/muro/space.md) |
| 型 (type) | `space` の第2位置引数 (**任意**)。開かれた語彙で、**core は一切読まない** — 集計の軸と刷り字にだけ現れる自由なラベルである。外部・吹抜け・採光といった構成の事実は `outside:` `void:` `daylight:` の宣言の側にある | [space](reference/muro/space.md) |
| 外部 (exterior) | 建物の外の領域を表す型。領域を持たなくてよい。`road:幅員` を付けると接道の対象になる | [space](reference/muro/space.md) |
| 吹抜け (void) | 床の不在。空間の型としては床面積不算入かつ通行不可、境界の kind としては上下階の床が無いことを表す | [boundary](reference/muro/boundary.md) |
| 境界 (boundary) | 二つの空間を結ぶ第一級の**関係**。壁芯の線分は書かず、両空間の矩形から導出される。壁は物ではなくこれである | [boundary](reference/muro/boundary.md) |
| kind (境界の型) | 関係のトポロジーだけを言う語。水平は `wall` / `open`、垂直は `stair` / `shaft` / `void` | [boundary](reference/muro/boundary.md) |
| 開口 (opening) | 境界に字下げで従属する `door` / `window`。`door` は通行、`window` は採光 (通行しない)。幅 `w` は必須 | [door](reference/muro/door.md) / [window](reference/muro/window.md) |
| アセット (asset) | `asset SD1 door w:800 …` — 開口が名前で参照する既定値の束。第4の要素ではなく、属性の出所を一箇所にまとめるだけの仕組みで、インスタンス側の属性が上書きする | [asset](reference/muro/asset.md) |
| ゾーン (zone) | 幾何を持たず、パス接頭辞で配下の空間を束ねる**数える**集約。領域つきの空間を子に持ちたいときは、親をこれにする | [zone](reference/muro/zone.md) |
| 数えない分節 (area / seg) | 面積・室数・グラフ・通行のどれにも影響しない区分。`area` は空間の中の領域、`seg` は境界の上の区間で、どちらも属性の上書きだけを運ぶ | [area](reference/muro/area.md) / [seg](reference/muro/seg.md) |
| 敷地形状 (polygon) | `polygon /site x,y x,y …` — この記法で唯一、格子に載らない自由頂点で書かれる形。測量由来の所与として例外的に認められている | [polygon](reference/muro/polygon.md) |
| 線 (line) | 境界に字下げで従属し、その境界を通り参照の言葉で引いた直線に沿わせる宣言。斜めはこれで書く。頂点座標は原本に現れない | [line](reference/muro/line.md) |
| 柱 (column) | `column 900 B2..L6` — 寸法と階だけを書く要素。位置は書かれず、通り芯の交点のうちその階に床のあるところに立つ | [column](reference/muro/column.md) |
| uid | 空間とゾーンに付けられる不透明な永続同一性トークン。モデル全体で一意で、パスからは導出しない。**改名を跨ぐ外部台帳との突き合わせのためにあり**、リポジトリ内の参照はパスのままでよい。書ける対象はこの二つに閉じていて、生成は乱数である | [同一性](reference/identity.md) |

## 属性 — 三つの層

**すべての属性キーは台帳に載っているか、名前空間を持つかのどちらかである。**台帳に無く名前空間も持たないキーは診断 ATT03 (エラー) になる。「見ていない」と「見て問題がない」を区別するための境界である。

| 語 | 定義 | 詳しく |
|---|---|---|
| 構造層 | 意味を変える属性。書き換えると面積・通行・判定の母集団が動く (`level` `air` `road` `site` `daylight` など) | [属性](reference/muro/attributes.md) |
| 解釈層 | 読まれて数値や表示に効く属性 (`w` `h` `t` `sill` `use` `name` `at` など)。値の形が検査され、書いたのに解釈されなかった値は診断になる | [属性](reference/muro/attributes.md) |
| 運搬層 | 処理系が解釈せず、そのまま運ぶだけの属性 (`spec` `fire` `sound` `floor` など)。IFC で要素クラスにあたるものが、ここでは属性の値になる | [属性](reference/muro/attributes.md) |
| 名前空間 | 運搬層を自由に拡張するための綴り。ドットを一つでも含むキー (`acme.sensor` `bems.temp`) は名前空間つきとみなされ、台帳に無くても書ける | [属性](reference/muro/attributes.md) |
| `spec` 語彙 | 物の名を運ぶ運搬層のキー (RC・LGS・手すり・カーテンウォール…)。処理系は解釈しない | [属性](reference/muro/attributes.md) |
| `air` | `air:1` = 物はあるが外気と光を遮らないもの (手すり・柵・フェンス)。半屋外の導出・採光の係数・細線での描画に効く | [属性](reference/muro/attributes.md) |
| `edge` | 境界の線分を a側矩形の特定の辺 (N/E/S/W) に限定する属性。線分が複数に割れる外皮で開口を置くときに要る | [boundary](reference/muro/boundary.md) |
| `daylight` | 採光判定の母集団に入るかどうかの宣言。`daylight:1` で対象、`daylight:0` で対象外。**型からは推定されない** | [採光](reference/validate/daylight.md) |

## 導出される性質 — 書かれないもの

| 語 | 定義 | 詳しく |
|---|---|---|
| 導出 | 書かれた構成から機械的に**一つ**決まるもの (壁線分・面積・隣接・半屋外・通行可能性)。原本には現れない | [形](reference/form/index.md) |
| 生成 | 一つに決まらないもの。平面図がこれで、同じ構成から複数の図が出ることは欠陥ではない | [平面](reference/form/plan.md) |
| 共有辺 | 二つの空間の矩形合併どうしが、同一直線上で重なる区間。境界の壁芯線分はこれとして導かれ、共線の区間は一本にマージされる | [境界の形](reference/form/boundaries.md) |
| 既定境界 | 同一レベルで平面が接する領域つき空間の組に、境界の宣言が一つも無いとき、**合成後に導出される** `wall` の境界。扉を持たないので通れない。正準JSONには現れない — 書かれた構成ではないからである | [既定](reference/muro/defaults.md) |
| 垂直の隣接 | 上下のレベルで平面が重なる空間どうしの関係。宣言せず、既定の解釈は「床がある」。例外 (`stair` / `shaft` / `void`) だけを書く | [縦動線](reference/form/vertical-runs.md) |
| 半屋外 | 外部に対して `open` または `air:1` の境界を持つ、領域つきの空間。**宣言ではなく導出**で、屋内床面積には算入されず別掲される。バルコニー・屋外階段・テラスがこれになる | [領域](reference/form/regions.md) |
| 庇下 (covered above) | その空間の上に、どのレベルであれ空間が重なっているか。屋根の有無すら宣言ではなく導出で、採光の半屋外係数 0.7 がこれを読む | [領域](reference/form/regions.md) |
| 通行可能性 (passable) | `wall` は扉があるときだけ通行可、`open` と `stair` は常に通行可、`shaft` と `void` は通行不可。`air:1` は遮蔽の話であって通行の話ではない | [境界の形](reference/form/boundaries.md) |
| 高さの不変量 | 各空間について「天井高 + 上階の床組み厚 ≤ 階高」であること。破れば診断 HGT01 になる | [高さの診断](reference/diagnostics/hgt.md) |
| 屋内床面積 | 領域とレベルを持ち、`void` でも `exterior` でも半屋外でもない空間の、壁芯面積の合計 | [stats](reference/cli/stats.md) |
| 描かれた線の効き (`effect`) | `line` を持つ境界について、その線が実際に何をしたか。`"cut"` は領域を切った、`"nothing"` は何も切らなかった、`"undetermined"` は決められなかった、を表す | [境界の形](reference/form/boundaries.md) |

## ファイルと版

| 語 | 定義 | 詳しく |
|---|---|---|
| author 形式 (.muro) | 人と LLM が読み書きする原本のテキスト形式。一行が一文で、字下げが従属を表す | [記法](reference/muro/index.md) |
| 合成 (import) | `import ./L1.muro` — 書かれたファイルからの相対パスで層を読み込むこと。二重 import と循環は冪等に扱われる | [import](reference/muro/import.md) |
| 層 (レイヤー) | 合成に参加する一ファイル。分担の単位であり、**層には強度がある** — 後に読まれた層のほうが強い。衝突 (パス・アセット名・grid の重複) は出所つきのビルドエラーになり、黙った上書きは無い | [合成](reference/muro/composition.md) |
| base 層 (entry) | 合成の入口となるファイル。`koyu` / `name` / `unit` / `grid` / `level` を宣言できるのはここだけである | [composition](reference/muro/composition.md) |
| `over` / `drop` | 強い層が弱い層の宣言を上書き (`over`) / 撤回 (`drop`) する形。名前が一意に定まらないときは拒まれる | [over / drop](reference/muro/over-drop.md) |
| 出所 (file:行) | 診断が指す位置。合成に参加した層の名前と行番号で表される | [診断の読み方](reference/diagnostics/reading.md) |
| 言語版 | `koyu 1.0` — 記法の意味論の版。受理されるのは `0.1` `0.2` `0.3` `0.4` `0.5` `1.0` の六つで、**宣言を省略すると最新版として読まれる**。base 層で一度だけ書ける | [版](reference/muro/version.md) |
| 形式版 | 正準JSON の綴りの版 (`format` フィールド)。言語版とは別に動く | [機械形式](reference/json/index.md) |
| 正準JSON | `koyu json` が出す機械形式。**同じ構成からは常にバイト同一**で、キーは符号位置の昇順、文字は NFC 正規化されている。持つのは**書かれた構成だけ**で、既定境界のような導出物は入らない。差分・ハッシュ・外部接続の土台である | [機械形式](reference/json/index.md) |
| 意味差分 (semantic diff) | `koyu diff` が出す、構成の言葉による差分。**行順・書式・素の `wall` 宣言と省略の違いは差分にせず**、改名は `uid` の一致で検出する。ファイルを分けたこと自体は差分にならない | [diff](reference/cli/diff.md) |

## 検査と問い

**三つの領域がある。**構成の整合を言う `check`、建築的な判定を言う `validate`、形を出す描画である。型からして別で、混ざらない。

| 語 | 定義 | 詳しく |
|---|---|---|
| 診断 (Diagnostic) | `check` の一次形式。`code` / `severity` / `message` / 出所 / 対象パス / 関連位置からなる構造化された一件 | [診断](reference/diagnostics/index.md) |
| 診断コード | `BND04` のような識別子。全65個ある。**severity はコードの不変属性**で、同じコードが場合によってエラーになったり警告になったりはしない。重さを変えるときは新しいコードを切る。人向けの出力には現れず、`check --json` にだけ出る | [診断](reference/diagnostics/index.md) |
| エラー / 警告 | エラーは構成が成立していないこと、警告は疑わしいことを言う。`--strict` を付けると警告でも終了コード 1 になる | [check](reference/cli/check.md) |
| 判定 (Finding) | `validate` の一次形式。`rule` / `level` / `message` / 出所からなる。**診断とは別の型である** — 混ぜられないことがこの型の仕事である | [判定](reference/validate/index.md) |
| 判定規則 | `site.escape` のような名前。全15個あり、`level` は `violation` (守られなかった) と `caution` (疑わしい) の二つ。**建築の側の重さ**であって、構成の壊れ方ではない | [判定](reference/validate/index.md) |
| 問い | 同じ記述の異なる読み方。`doors` (動線) / `stats` (面積) / `light` (採光) / `site` (敷地) / `levels` (矩計) / `runs` (段数・勾配) / `graph` (隣接) | [CLI](reference/cli/index.md) |
| 到達不能 | `doors` が空間グラフ上に経路を見つけられない状態。**`check` が緑でも起きる** — 扉の無い壁は通れないためで、扉を一枚も宣言しない建物は緑のまま完全に密封される | [到達](reference/validate/access.md) |
| 採光 | 対象の居室について「有効窓面積 ≥ 床面積 / 7」を見る粗い判定。窓の先が庇下の半屋外なら係数 0.7 がかかる | [採光](reference/validate/daylight.md) |
| 接道 | 敷地ゾーン配下の空間と、`road:幅員` を持つ外部空間との境界線分長の合計。**建物の外壁が道路に面する分は数えない** | [敷地](reference/validate/site.md) |
| MCP サーバー | `koyu-mcp` — エージェント向けの入口。依存ゼロの stdio サーバーで、ツールは12個。`model_summary` → `layers` → `write_layer` → `check` が標準のループ | [MCP](reference/mcp/index.md) |
| 公開面 | TypeScript API として書き下されている名前の集合 | [API](reference/api/canonical.md) |

## 隣接する語 (koyu の外)

| 語 | 定義 |
|---|---|
| BIM | 建物の三次元形状と属性情報を一体で扱う手法。原本は各オーサリングツールの独自データベースの中にある |
| IFC | buildingSMART の交換用オープン標準。標準形式 (SPF) は行番号で相互参照するため、書き出し直すだけで差分が壊れる |
| IfcSpace | IFC で室や領域を表すエンティティ。規格上は存在するが、多くの現場では部材が囲んだ結果として導かれる二次的な情報として扱われる |
| IFC5 / IFCX | 開発中の次世代規格と、その JSON 形式。テキストと composition を採るが、運ぶ中身は依然として建築物のオントロジーである |
| OpenUSD | シーン記述の枠組み。koyu はここから機構だけを借りている — パス名前空間と、レイヤーの非破壊的な重ね合わせ |
| 建築 / 建築物 | 日本語はこれを区別する。建築物は建築基準法上の物としてのカテゴリで、IFC も CityGML もこちら側のオントロジーである。**koyu が書くのは建築の側** — 空間の分節・接続・序列である |

日本の建築・法規の語 (建蔽率・容積率・接道・居室・矩計など) は[日本の建築・法規の用語](glossary/japanese-building-terms.md)に分けてある。IFC との実測比較は[koyu と IFC の実測比較](examples/vs-ifc.md)にある。
