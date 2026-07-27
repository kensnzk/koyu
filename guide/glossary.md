[English](en/glossary.md) · **日本語**

# 用語集

koyu の語を引き当てるための表である。各行は「一文の定義」「その語を規範として定義している場所」「実際に使われている場所」からなる。

**定義の正は spec/ にある。**ここに書かれた一文は引き当てのための要約であって、契約ではない。食い違ったら [spec/](../spec/README.md) が正しい。語がなぜその形をしているかは [ADR](../docs/decisions/) が持ち、語どうしの関係は [concepts.md](concepts.md) が持つ。

用語は五つの群に分けてある — 骨格 / 要素 / 導出される性質 / ファイルと版 / 検査と問い。

## 骨格 — 位置を決めるもの

| 語 | 一文の定義 | 規範 | 用例 |
|---|---|---|---|
| 通り芯 (grid) | 軸ごとに一度だけ宣言する座標の列。`X1`, `X2`… が自動命名される | [language.md §2](../spec/language.md) | [two-rooms](../examples/two-rooms.muro) |
| 通り参照 | 位置の書き方。`X2`・`X2+600`・`Y3-150` のように、常に通り芯からの言葉で書く。座標の直書きは無い | [language.md §2](../spec/language.md) | [tower/typical](../examples/tower/typical.muro) |
| レベル (level) | 階。名前と FL の高さ z、任意で基準天井高 `h` と床組み厚 `slab` を持つ | [language.md §2](../spec/language.md) | [house/main](../examples/house/main.muro) |
| 範囲宣言 | `level L4..L10 11000 pitch:3000` — 等差のレベルを一行で宣言する形 | [language.md §2](../spec/language.md) | [tower/main](../examples/tower/main.muro) |
| スパン展開 | 空間パスの**先頭セグメント**が `L3..L10` の形のとき、宣言済みレベルの z 順に展開されること。基準階を一度だけ書くための仕組み | [language.md §3](../spec/language.md)・[ADR-0004](../docs/decisions/0004-typical-floors.md) | [tower/typical](../examples/tower/typical.muro) |
| 積層 (stack) | `stack ev L1..L11 type:shaft` — 連続レベル対に垂直境界を一括で張る宣言 | [language.md §4](../spec/language.md) | [tower/main](../examples/tower/main.muro) |
| 帯 (band) | `band X X1..X3 Y1..Y2` + 字下げした `space` 行 — 位置ではなく寸法と並びを書き、位置を導出させる記法。parse時に通常の空間へ展開され、モデルにも正準JSONにも残らない | [language.md §3 帯](../spec/language.md)・[ADR-0019](../docs/decisions/0019-position-and-lines.md) | [tower/typical](../examples/tower/typical.muro) |
| 閉じた帯 | 全要素に寸法を書き、合計が帯幅と一致する帯。`w:rest` を使わないのが既定で、合計の照合が寸法の打ち間違いを捕まえる | [language.md §3 帯](../spec/language.md) | [tower/typical](../examples/tower/typical.muro) |
| 方位 (N/E/S/W) | X は東が正、Y は北が正。したがって N=+Y, S=-Y, E=+X, W=-X。`edge` はこの方位を **a側 (先に書いた空間) の矩形から見て**指す | [language.md §1・§4](../spec/language.md) | [concepts.md §2](concepts.md) |
| 壁芯 | 面積算定と壁線分の基準。壁厚 `t` は芯から両側へ振り分けられる | [language.md §1・§9](../spec/language.md) | [concepts.md §5](concepts.md) |

## 要素 — 書かれるもの

| 語 | 一文の定義 | 規範 | 用例 |
|---|---|---|---|
| 空間 (space) | 一次要素。パス・型・領域 (矩形の合併) を持つ。室・ゾーン内の一区画・外部の領域がこれになる | [language.md §3](../spec/language.md) | [two-rooms](../examples/two-rooms.muro)・[concepts.md §1](concepts.md) |
| パス | `/L1/A/ldk` — 空間とゾーンの同一性であり、同時に集計の階層。先頭セグメントは同名の `level` が宣言されていればレベルになる | [language.md §3](../spec/language.md) | [concepts.md §4](concepts.md) |
| 型 (type) | `space` の第2位置引数 (必須)。開かれた語彙で、構造として解釈されるのは `exterior` と `void` の二語だけ。採光判定の対象かどうかは型から推定されない (`daylight` で宣言する) | [language.md §3](../spec/language.md)・[vocabulary.md](../spec/vocabulary.md) | [concepts.md §6](concepts.md) |
| 外部 (exterior) | 建物の外の領域を表す型。領域を持たなくてよい。`road:幅員` を付けると接道の対象になる | [vocabulary.md](../spec/vocabulary.md)・[ADR-0009](../docs/decisions/0009-site-and-exterior.md) | [house/site](../examples/house/site.muro) |
| 吹抜け (void) | 床の不在。空間の型としては床面積不算入かつ通行不可、境界の kind としては上下階の床が無いことを表す | [language.md §4](../spec/language.md)・[ADR-0006](../docs/decisions/0006-voids-and-light.md) | [house/main](../examples/house/main.muro) |
| 境界 (boundary) | 二つの空間を結ぶ第一級の**関係**。壁芯の線分は書かず、両空間の矩形から導出される | [language.md §4](../spec/language.md)・[semantics.md §2](../spec/semantics.md) | [concepts.md §2](concepts.md) |
| kind (境界の型) | 関係のトポロジーだけを言う語。水平は `wall` / `open`、垂直は `stair` / `shaft` / `void` | [language.md §4](../spec/language.md)・[vocabulary.md](../spec/vocabulary.md) | [tower/main](../examples/tower/main.muro) |
| spec 語彙 | 物の名 (RC・LGS・手すり・カーテンウォール…)。ツールは解釈せず運ぶだけ。IFC で要素クラスにあたるものがここでは属性の値になる | [vocabulary.md 規則2](../spec/vocabulary.md) | [two-rooms](../examples/two-rooms.muro) |
| `air` | `air:1` = 物はあるが外気と光を遮らないもの (手すり・柵・フェンス)。半屋外の導出・採光係数・細線描画に効く | [vocabulary.md](../spec/vocabulary.md)・[ADR-0007](../docs/decisions/0007-semi-outdoor-air.md) | [house/site](../examples/house/site.muro) |
| `edge` | 境界の線分を a側矩形の特定の辺 (N/E/S/W) に限定する属性。線分が複数に割れる外皮で開口を置くときに要る | [language.md §4](../spec/language.md) | [two-rooms](../examples/two-rooms.muro) |
| 開口 (opening) | 境界に字下げで従属する `door` / `window`。`door` は通行、`window` は採光 (通行しない)。幅 `w` は必須 | [language.md §4 開口](../spec/language.md) | [house/L1](../examples/house/L1.muro) |
| アセット (asset) | `asset SD1 door w:800 …` — 開口が参照する既定値の束。第4の要素ではなく、属性の出所を一箇所にするだけ | [language.md §6](../spec/language.md)・[ADR-0010](../docs/decisions/0010-assets-and-composition.md) | [house/assets](../examples/house/assets.muro) |
| ゾーン (zone) | 幾何を持たず、パス接頭辞で配下の空間を束ねる**数える**集約。領域つきの空間を子に持ちたいときは親をこれにする | [language.md §5](../spec/language.md)・[ADR-0005](../docs/decisions/0005-zones-and-unions.md) | [tower/typical](../examples/tower/typical.muro) |
| 数えない分節 (area / seg) | 面積・室数・グラフ・通行に影響しない区分。`area` は空間の中の領域、`seg` は境界の上の区間で、どちらも属性の上書きだけを運ぶ | [language.md §3・§4](../spec/language.md)・[ADR-0003](../docs/decisions/0003-uncounted-divisions.md) | [tower/L1](../examples/tower/L1.muro) |
| 敷地形状 (polygon) | `polygon /site x,y x,y …` — この記法で唯一、格子に載らない自由頂点で書かれる形。測量由来の所与として例外的に認められる | [language.md §7](../spec/language.md)・[ADR-0011](../docs/decisions/0011-site-polygon.md) | [tower/site-geometry](../examples/tower/site-geometry.muro) |
| `uid` | 空間・ゾーンに付ける不透明な永続同一性トークン。モデル全体で一意、パスから導出しない。改名を跨ぐ外部 join のためにあり、リポジトリ内の参照はパスのままでよい | [vocabulary.md](../spec/vocabulary.md)・[ADR-0015](../docs/decisions/0015-identity-uid.md) | [concepts.md §4](concepts.md) |

## 導出される性質 — 書かれないもの

| 語 | 一文の定義 | 規範 | 用例 |
|---|---|---|---|
| 導出 | 書かれた構成から機械的に一つ決まるもの (壁線分・面積・隣接・半屋外・通行可能性)。原本には無い | [semantics.md 冒頭](../spec/semantics.md) | [concepts.md §5](concepts.md) |
| 生成 | 一つに決まらないもの。平面図がこれで、同じ構成から複数の形が出ることは欠陥ではない | [semantics.md §7](../spec/semantics.md) | [gallery.md](gallery.md) |
| 共有辺 | 二つの空間の矩形合併どうしが同一直線上で重なる区間。境界の壁芯線分はこれとして導かれ、共線の区間は一本にマージされる | [semantics.md §2](../spec/semantics.md) | [concepts.md §2](concepts.md) |
| 既定境界 | 同一レベルで平面が接する領域つき空間の組に宣言が一つも無いとき、合成後に導出される `wall` の境界。扉を持たないので通れない | [semantics.md §2](../spec/semantics.md)・[ADR-0014](../docs/decisions/0014-default-boundaries.md) | [concepts.md §3](concepts.md) |
| 垂直の隣接 | 上下のレベルで平面が重なる空間どうしの関係。宣言せず、既定の解釈は「床がある」。例外 (`stair`/`shaft`/`void`) だけを書く | [semantics.md §3](../spec/semantics.md)・[ADR-0002](../docs/decisions/0002-height-and-offsets.md) | [house/main](../examples/house/main.muro) |
| 半屋外 | 外部に対して `open` または `air:1` の境界を持つ、領域つきの空間。宣言ではなく導出で、屋内床面積に算入されず別掲される | [semantics.md §4](../spec/semantics.md)・[ADR-0007](../docs/decisions/0007-semi-outdoor-air.md) | [house/site](../examples/house/site.muro) |
| 庇下 (isCoveredAbove) | 上に (どのレベルであれ) 空間が重なっているか。屋根の有無すら宣言でなく導出で、採光の半屋外係数 0.7 がこれを読む | [semantics.md §4](../spec/semantics.md) | [tower/typical](../examples/tower/typical.muro) |
| 通行可能性 (passable) | `wall` は扉があるときだけ通行可、`open` と `stair` は常に通行可、`shaft` と `void` は通行不可。`air:1` は遮蔽の話であって通行の話ではない | [semantics.md §4](../spec/semantics.md) | [concepts.md 末尾](concepts.md) |
| 高さの不変量 | 各空間について「天井高 + 上階の slab ≤ 階高」であること。破れば HGT01 | [semantics.md §3](../spec/semantics.md) | [tower/main](../examples/tower/main.muro) |
| 屋内床面積 | 領域とレベルを持ち、`void` でも `exterior` でも半屋外でもない空間の壁芯面積の合計 | [semantics.md §6](../spec/semantics.md) | [gallery.md](gallery.md) |

## ファイルと版

| 語 | 一文の定義 | 規範 | 用例 |
|---|---|---|---|
| author 形式 (.muro) | 人と LLM が読み書きする原本のテキスト形式。一行が一文 | [language.md §1](../spec/language.md) | [two-rooms](../examples/two-rooms.muro) |
| 合成 (import) | `import ./L1.muro` — 書かれたファイルからの相対パスで層を読み込み、**加算合成**する。二重 import と循環は冪等 | [language.md §8](../spec/language.md)・[ADR-0010](../docs/decisions/0010-assets-and-composition.md) | [house/main](../examples/house/main.muro) |
| 層 (レイヤー) | 合成に参加する一ファイル。分担の単位であり、衝突 (パス・アセット名・grid の重複) は出所つきのビルドエラーになる。黙った上書きは無い | [language.md §8](../spec/language.md) | [tower/](../examples/tower/main.muro) |
| base 層 (entry) | 合成の入口となるファイル。`koyu` / `name` / `unit` / `grid` / `level` を一度だけ宣言できるのはここだけである | [language.md §2・§8](../spec/language.md) | [tower/main](../examples/tower/main.muro) |
| 出所 (file:行) | 診断が指す位置。合成に参加した層の名前と行番号で表される | [semantics.md §1](../spec/semantics.md) | [diagnostics.md](diagnostics.md) |
| 言語版 | `koyu 1.0` — 記法の意味論の版。対応は `0.1, 0.2, 0.3, 0.4, 0.5, 1.0` で、宣言を省略すると最新版として読まれる。base 層で一度だけ書ける | [language.md §2 版の規範](../spec/language.md)・[ADR-0017](../docs/decisions/0017-language-versioning.md) | [two-rooms](../examples/two-rooms.muro) |
| 正準JSON | `koyu json` が出す機械形式。同じ構成からは常にバイト同一で、**書かれた構成のみ**を持つ (既定境界は出ない)。diff・ハッシュ・外部接続の土台 | [canonical-json.md](../spec/canonical-json.md)・[ADR-0013](../docs/decisions/0013-semantic-guarantees.md) | [two-rooms.canonical.json](../examples/two-rooms.canonical.json) |
| 意味差分 (semantic diff) | `koyu diff` が出す構成の言葉の差分。行順・書式・素 wall 宣言と省略の違いは差分にせず、改名は `uid` の一致で検出する | [tools.md](../spec/tools.md)・[ADR-0018](../docs/decisions/0018-semantic-diff.md) | [cli.md](cli.md) |

## 検査と問い

| 語 | 一文の定義 | 規範 | 用例 |
|---|---|---|---|
| 診断 (Diagnostic) | `check` の一次形式。`code` / `severity` / `message` / 出所 / 対象パス / 関連位置からなる構造化された一件 | [semantics.md §5](../spec/semantics.md)・[ADR-0016](../docs/decisions/0016-diagnostic-contract.md) | [diagnostics.md](diagnostics.md) |
| 診断コード | `BND04` のような識別子。severity はコードの不変属性で、重さを変えるときは新しいコードを切る。人向けの出力には現れず `check --json` にだけ出る | [semantics.md §5](../spec/semantics.md) | [diagnostics.md](diagnostics.md) |
| エラー / 警告 | エラーは構成が成立していないこと、警告は疑わしいことを言う。`--strict` は警告でも終了コード 1 にする | [semantics.md §5](../spec/semantics.md)・[tools.md](../spec/tools.md) | [cli.md](cli.md) |
| 問い | 同じ記述の異なる読み方。`doors` (動線) / `stats` (面積) / `light` (採光) / `site` (敷地) / `levels` (矩計) / `graph` (隣接) | [semantics.md §6](../spec/semantics.md) | [cli.md](cli.md) |
| 到達不能 | `doors` が空間グラフ上に経路を見つけられない状態。`check` が緑でも起きる — 扉の無い壁は通れないため | [semantics.md §6](../spec/semantics.md) | [concepts.md 末尾](concepts.md) |
| 採光 (light) | 対象の居室について「有効窓面積 ≥ 床面積 / 7」を見る粗い判定。窓の先の半屋外が庇下なら係数 0.7 | [semantics.md §6](../spec/semantics.md)・[ADR-0006](../docs/decisions/0006-voids-and-light.md) | [cli.md](cli.md) |
| 接道 | 敷地ゾーン配下の空間と `road:幅員` を持つ外部空間との境界線分長の合計。建物の外壁が道路に面する分は数えない | [semantics.md §6](../spec/semantics.md)・[ADR-0009](../docs/decisions/0009-site-and-exterior.md) | [tower/site](../examples/tower/site.muro) |
| MCP サーバー | `koyu-mcp` — エージェント向けの入口。`model_summary` → `layers` → `write_layer` → `check` が標準のループ | [tools.md](../spec/tools.md)・[ADR-0012](../docs/decisions/0012-mcp-server.md) | [api.md](api.md) |

## 隣接する語 (koyu の外)

| 語 | 一文の定義 |
|---|---|
| BIM | 建物の三次元形状と属性情報を一体で扱う手法。原本は各オーサリングツールの独自データベースの中にある |
| IFC | buildingSMART の交換用オープン標準。標準形式 (SPF) は行番号で相互参照するため、書き出し直すだけで差分が壊れる |
| IfcSpace | IFC で室や領域を表すエンティティ。規格上は存在するが、多くの現場では部材が囲んだ結果として導かれる二次的な情報として扱われる |
| IFC5 / IFCX | 開発中の次世代規格と、その JSON 形式。テキストと composition を採るが、運ぶ中身は依然として建築物のオントロジーである |
| OpenUSD | シーン記述の枠組み。koyu はここから機構だけを借りている — パス名前空間と、レイヤーの非破壊的な重ね合わせ |
| 建築 / 建築物 | 日本語はこれを区別する。建築物は建築基準法上の物としてのカテゴリで、IFC も CityGML もこちら側のオントロジー。koyu が書くのは建築の側 — 空間の分節・接続・序列である |

これらの位置づけの詳細は [docs/writing-architecture.md](../docs/writing-architecture.md)、IFC との対応表は [spec/vocabulary.md 末尾](../spec/vocabulary.md) にある。
