# koyu ドキュメント正典化 — ADR 欠落監査の総合

対象: ADR 41編 (0001–0042、0027 は欠番)、guide/ 21頁 ×2ロケール、spec/ 22頁。guide/ 内の参照は ADR リンク 211・spec リンク 380・素の `ADR-NNNN` 表記 16 = **591件**。実装側の実測値: 実行時エクスポート 59 / 診断コード 65 / 判定規則 15 / `DEFAULT_LANGUAGE_VERSION` = `1.0` / package 0.16.0。

---

## 1. 失われる決定

`gap` が `landed-in-spec-only` / `nowhere-but-the-adr` / `landed-in-code-only` のもの。guide/ に一言も無い、または一文の委譲しか無い決定である。**blocking = 公開ドキュメントだけを読む利用者が、書いた通りに動かない原因を特定できなくなる決定。**

### 1-A. 凍結クラスタ (ADR-0032〜0042) — blocking

#### ① 三つの領域と一方向の依存 (ADR-0032) — spec/scope.md §1 のみ

> koyu は三つの領域からなる。core (`src/core`) は凍る面で、読むこと・導出すること・構造の整合を言うことだけを行う。検証 (`src/validate`) は建築的な判定を持ち、凍らない。表現 (`src/draw`) は図を作り、凍らない。依存は一方向で、検証と描画は core に依存し、core はどちらにも依存しない。この一方向は文ではなく `test/domains.test.ts` が機械的に守る。パッケージの入口も同じ形をしていて、`@kensnzk/koyu` `@kensnzk/koyu/node` `@kensnzk/koyu/validate` `@kensnzk/koyu/draw` の四つがある。

現在: spec/scope.md §1、docs/policy.md 第二部、AGENTS.md、`src/validate/index.ts` の頭注。guide/validation.md:14 は三つのうち二つしか名指さず、依存の向きを言わない。guide/api.md:37 は今も「入口は二つ」と書く。
行き先: **/reference/scope** + **/reference/api/entrypoints**。
付随: guide/cli.md には `validate` の節も `layers` の節も無い (14サブコマンド中12個しか載っていない)。guide/api.md には検証の節が丸ごと無い (`validate` `VALIDATION_RULES` `Finding` `ValidationRule` は公開面にある)。判定15件の台帳 (`envelope.gap` … `site.frontage`) は spec/validation.md にしか無い → **/reference/cli/validate** が台帳を持つ。

#### ② 緑の意味 (ADR-0032 + ADR-0034) — spec/scope.md §3+§3.1 のみ

> `check` が緑であるとは、構造層と解釈層について宣言された不変量が成り立ち、かつ書かれたものから形を作れる、ということである。運搬層については何も言わない。建築として妥当かは何も言わない。

現在: guide/validation.md と guide/cli.md は SUF 以前の半分 (「データとして矛盾していない」) しか書いていない。ADR-0034 が緑の定義を強めたのに guide は追随していない。
行き先: **/reference/scope**。

#### ③ 属性の三層と台帳の意味 (ADR-0033) — spec/scope.md §7 のみ、spec/vocabulary.md は古い

> 属性は三層に分かれる。構造層 (`path` `type` `region` `level` 関係の相手 `kind` `t` `edge`) は必ず読まれ、壊れていれば読めない。解釈層 (`h` `use` `road` `daylight` `style` `turn` `uid` `name` …) は台帳が値域を定め、core が読む。運搬層 (`spec` `fire` `sound` `floor` `sill` `acme.sensor` …) は core が読まず、運ぶだけである。**台帳は「core が読む鍵の一覧」ではなく「書いてよい鍵の一覧」である** — `spec` `fire` `sound` `floor` `sill` は名前空間を要さない既知の鍵として台帳に載っているが、core は読まない。区別を担うのは台帳への在不在ではなく層である。

現在: guide/concepts.md:256 が一文で spec へ委譲。spec/vocabulary.md は三層に一言も触れず、しかも `spec`/`fire`/`sound`/`sill`/`floor` を「— 自由」と分類していて **spec 自身が古い**。
行き先: **/reference/muro/attributes** — `ATTR_LEDGER` から要素別表を生成する (現在この台帳は `src/core/vocabulary.ts` と spec/vocabulary.md の古い写しにしか無い)。

#### ④ 合成の六規則 (ADR-0035) — spec/composition.md のみ。guide は逆を教えている

> `import` 行を深さ優先で平らにした並びが層の並びで、後の層ほど強い。entry は添字0で最も弱い。二度 import された層は最初の位置を保つ。**強度は走査順ではない** — entry 自身の行が import 行より後にあっても entry は0のままで、その `over` は負ける。
> 一つの値は意見を持つ最も強い層が決める。`over` がその一語で、空間・ゾーン・境界・レベル・アセットを対象に取り、型付きの欄 (`type` `t` `air` `edge` `h` `slab`) にも自由属性にも届く。対象の種別は行の形で読む — パス一つなら空間 (無ければゾーン)、二つなら境界、`level <名>` ならレベル、`asset <名>` ならアセット。一つの層が同じ主体の同じ属性に二つの意見を持てばエラーである。
> 集合は明示の編集で合成する — `over` の直下に字下げした `+` (足す) `-` (外す) `=` (差し替える)、および `drop` (空間・境界・柱の宣言を消す。空間を消せば関係も一緒に消える)。同一性は「容れ物 + その中で一意な名」なので、`name:` を持たない要素は編集できず、`+` で足す要素は `name:` を持たなければならない。
> 定義 (`space` `boundary` `zone` `asset` `level` `polygon`) は重複がエラー、上書き (`over`) は対象不在がエラーである。上書きの跡は合成後のモデルにも正準JSONにも残らない — `over` で `h:2400` にしたモデルと最初から `h:2400` と書いたモデルは同一のバイト列になる。出所は `koyu layers --attrs` が属性ごとに答える (`model.attrSrc`)。

現在: **六規則のすべてが spec/composition.md にしか無い。** guide/howto/split-into-files.md:45 は今も『レイヤー強度のような仕組みは無い』と書き、:21 は `koyu 0.4` を宣言し、:140 は ADR-0010 を根拠に挙げる。guide/glossary.md:67 は合成を「加算合成」と定義する。guide/cheatsheet.md に `over` `drop` `+` `-` `=` の項目は一つも無い。guide/cli.md に `layers` の節が無い。
行き先: **/reference/muro/composition** (六規則)、**/reference/cli/layers**、**/howto/write-as-built** (実測を計画に重ねる作業手順。これがレイヤー強度を採った理由の実例で、公開ドキュメントには存在しない)。

#### ⑤ バイトの規範 (ADR-0036) — spec/canonical-json.md のみ

> 照合順は符号位置の昇順であり、出力される UTF-8 バイトの昇順に等しい。ロケール照合も JavaScript の `<` も既定の `sort` も使えない (代用対を含む字で並びが食い違う — 𠮟 U+20B9F と 﨑 U+FA11)。並ぶキーは二種類ある — 記録の形のキー (最上位・レベル・空間・境界・開口・seg・柱) はスキーマの固定順、原本に由来するキー (レベル名・パス・アセット名・属性キー) が照合順である。
> 文字は NFC である。原本は読み込みのときに NFC へ正規化され、同一性 (パス・uid・名) もそこで決まる — 「か+濁点」と綴った空間は合成済みの `が` と同じ空間であり、両方書けばパスの重複エラーになる。NFKC は採らない。
> 符号化は UTF-8、改行は LF、字下げは空白2つ、文書の末尾に改行が一つ。非ASCIIはエスケープせず生のまま出る。数は最短往復表記で綴る — `0.30` は `0.3` として出る。丸めも桁揃えも単位変換もしない。
> 形式の約束は二方向である — 同じ構成なら常に同じバイト列、**違う構成なら必ず違うバイト列**。

現在: guide/ が正準JSONに触れるのは3箇所 (cli.md の json 節、api.md の `toCanonical`、glossary.md:72) で、照合順・正規化・符号化・数の綴りは一語も無い。NFC は同一性を決める規則なので二重に効く。
行き先: **/reference/json/**。あわせて `format` キーの数え方 (minor = キーが増えた / major = 既存のキーの名前・並び・照合順・正規化・数の綴りが変わった) と、`koyu` キーは版宣言の素通しで宣言が無ければ出力されないこと。

#### ⑥ 公開面の台帳 (ADR-0037) — spec/tools.md の `<!-- api-surface -->` 表のみ

> 公開面の唯一の出所は `src/index.ts` である。`export *` は使わない — 何を約束したかはそのファイルを読めば分かる。実行時の値は59、型は77。入口は四つ (`@kensnzk/koyu` / `/node` / `/validate` / `/draw`)、`engines.node` は `>=22`。

現在: **`test/public-api.test.ts` は spec/tools.md と spec/en/tools.md との集合一致を検査している** (SPEC_PAGES, line 91)。spec/ を退けると公開面が公開ドキュメントから列挙不能になり、同時に門番テストの参照先が消える。guide/api.md:46 は「48」、guide/README.md:34 は「全49エクスポート」で、どちらも実測59と合わない。
行き先: **/reference/api/** — 表を生成し、`test/public-api.test.ts` の照合先をその生成元へ移す (この移し替えを同じ変更でやらないとテストが宙に浮く)。

#### ⑦ 形の規則 — 開口の z・階高・面の生成 (ADR-0040) — spec/derivation.md のみ

> 扉は FL から FL + (`h` があればその値、なければ 2000mm) まで立つ。それ以外の開口は同じまぐさ高さから下へ (`h` があればその値、なければ 1200mm) 垂れる。したがって腰高は**まぐさを揃えた結果**であって入力ではない — `sill` は運搬層の属性で、core は読まない。
> 階高は上のレベルとの差である。上にレベルが無ければ、そのレベルの最大天井高 + 屋根スラブ厚である。天井高が一つも定まらなければ階高が定まらず、**そのレベルには壁も柱も立たない** — 2400 のような既定は捏造されない。
> 壁は開口で割られた面の列として返る (開口間の全高、下の腰壁、上のたれ壁)。したがって「壁を紙の色で塗って穴に見せる」操作は存在しない — 平面でも立体でも、壁は最初から穿たれた列である。斜めの線分でも同じ規則が働く。
> 平面は「立体を切った断面」ではなく、分類された二次元の要素の集合である (`cut` / `below` / `above` / `swing` / `anchor`)。切断高さは `Form` の内容ではなく `derive` の入力である。立体をどれだけ正確に切っても出てこないものが四つある — 扉の開き勝手、上の吹抜けの見上げ、切断線そのもの、下りる走り。

現在: guide/api.md は `derive` の節を持つが、規則を三箇所で spec/derivation.md へ委譲している (`:645` `:700` `:753`)。guide/diagnostics.md の SUF01 は「天井も屋根も生成されない」までしか言わず、壁と柱が立たないことを言わない。
行き先: **/reference/form/** (規則)、**/reference/muro/opening** (`sill` は運搬・腰高は結果)、**/reference/diagnostics/suf** (SUF01 の帰結に壁と柱を足す)、**/reference/api/derive**。

#### ⑧ 導出定数17個と公差7個 (ADR-0040) — spec/derivation.md §5・§6 のみ

> `WALL_T` 100 / `RAIL_T` 60 / `RAIL_T_MAX` 80 / `RAIL_H` 1100 / `OPENING_HEAD` 2000 / `OPENING_H` 1200 / `CEILING_T` 30 / `ROOF_T` 200 / `CUT_HEIGHT` 1200 / `DEFAULT_RISER_MAX` 180 / `TREAD_TARGET` 300 / `LANDING_MIN` 1100 / `ENTRY_LANDING` 1100 / `LANE_ESCALATOR` 1200 / `TREAD_SOLID` 200 / `SLAB_T` 200 / `STEP_MARK` 400。
> **導出定数は台帳の既定値ではない。** 台帳は何を*書いてよいか*を定め、導出定数は何も書かれなかったときに何が*導かれるか*を定める。書かれた値が常に勝つ。だから `WALL_T` 100mm は属性台帳ではなく開口のまぐさ高さと同じ棚に載る。
> 公差は一箇所に集める — `EPS` 0.5 / `AREA_EPS` 1 / `PROBE` 5 / `SPAN_EPS` 1 / `CROSS_EPS` 1e-6 / `PARALLEL_EPS` 1e-9 / `POINT_EPS` 1。同じ問いが二つの公差を持ってはならない。`PROBE` は形の解像度の下限である。

現在: guide/ にあるのは17個中1個 (guide/cheatsheet.md:329 の `t` 既定 100mm) だけ。**16個の数字は公開できる場所にどこにも無い。**
行き先: **/reference/form/constants** — `DERIVATION_CONSTANTS` と `TOLERANCES` から生成する。

#### ⑨ 形は正準形の関数である (ADR-0041) — spec/derivation.md §0/§1.1/§1.3/§1.5 のみ

> `toCanonical(a) === toCanonical(b)` ならば `derive(a) ≡ derive(b)` である。正準形が「同じ建物」の定義である以上、正準形が捨てるもの — 線の端点を書いた順、境界の宣言順、線の並び — は形を変えてはならない。
> **線は向きを持たない。** 読み込みの出口で各線の端点は解決座標の昇順 (x、次に y) へ正規化され、通り参照の綴りも一緒に入れ替わる。その正準の始点が、その線に乗る開口の `at:` の原点である。
> **切断は宣言順ではなく正準の境界順に働く。** 並べ方は `toCanonical` と同じ規則で、両者は同じ関数を共有する。切断が順序に依るのは設計どおりだが、合成が境界を二つの間に差し込んでも形は動かない。
> **`boundary` の a/b の向きが影響してよいのは `edge` と `swing` だけである。** `boundary /L1/room /out` と `boundary /out /L1/room` は一つの関係の二つの綴りであり、同じ面積を与える。向きはその関係をどちらの空間から見ているかを言うだけで、形を言わない。
> `Form` の境界・開口・seg の添字は `canonicalBoundaryOrder(model)` の並びを指す。`model.boundaries[i]` (宣言順) を `Form` の添字と突き合わせてはならない。

現在: guide/ にこの五つは一つも無い。`canonicalBoundaryOrder` は guide/ に一度も出てこないのに公開面にある。guide/cheatsheet.md の `## line` (261-272) は学習者が `line` に出会う唯一の場所だが、向きの非依存にも正準切断順にも触れない。
行き先: **/why/source-and-derived** (統べる原理)、**/reference/form/**、**/reference/muro/line**、**/reference/muro/boundary**、**/reference/api/derive** (`canonicalBoundaryOrder` と `DrawnLine.effect`)。

### 1-B. 凍結クラスタ — important (blocking ではないが読み手向けの事実)

| 決定 (貼れる形に要約) | 現在の所在 | 行き先 |
|---|---|---|
| HGT01/HGT02 は core に残る — 下階の天井と上階の床が同じ z を占める矛盾は、平面の重なり (GEO01/GEO02) の断面版だからである。階高・軒高・斜線といった建築的な高さの判断は保証しない | spec/scope.md §3.1 の注 | /why/what-check-guarantees |
| 利用者は二つのコマンドを走らせる。`check` だけの CI は判定を黙って見なくなる | ADR-0032 代償(1) と AGENTS.md のみ | /howto/put-koyu-in-ci |
| `level` に台帳外の鍵を書くと診断ではなく構文エラーになる (Level は attrs の袋を持たないので、残った鍵は正準JSONから痕跡なく消えるため) | `src/core/parse.ts:428` のみ | /reference/muro/level |
| 診断の節の粒度は**走査単位**であってコードの族ではない。だから一つの主体が出す複数のコードは離れない | `src/core/diagnose.ts` の注のみ | /reference/diagnostics/contract |
| 版の新旧は受理版の並び順であって綴りの辞書順ではない (`"0.5" > "1.0"` なので綴りに任せると新版が旧版と判定される) | spec/language.md §2 | /reference/muro/version |
| `drop column <名>` は曖昧なら拒む (以前は同名の柱二本が黙って両方消えていた) | `src/core/parse.ts:1539` のみ | /reference/muro/composition |
| 「意味保存」とは導出物 (canonical / graph / stats / SVG) の不変を指し、診断の増減を含まない。だから検査を足しても言語版は動かない | docs/terminology.md:70 の一行のみ | /reference/stability |
| 診断が線を引用するとき、綴りは書かれたまま・順序は正準である (`line X2,Y2 X1,Y1` は `Line X1,Y1..X2,Y2` として出る) | ADR-0041 代償3 のみ | /reference/diagnostics/lin |
| 二本の版の関係を機械が縛るものは無い (`test/release.test.ts` は二本を独立に見る)。散らばりを防ぐのは文章だけである | ADR-0042 代償1 のみ | /reference/stability |
| `RunArrow` は `up: boolean`、`RunDraw` は `anchor` (座だけ)、`breaks` は走りの全幅を横切る一本。注記の言葉も作図慣習の斜線二本も core は持たない | spec/derivation.md §4.7 | /reference/api/derive (CHANGELOG が無いので破壊的変更の着地先も無い) |
| `src/draw/` は `Form` だけを描く。SVG の見た目は凍結対象ではない — 凍るのは `Form` である | spec/derivation.md §9・spec/scope.md §8 | /reference/stability・/reference/cli/plan |

### 1-C. 基盤 (ADR-0001〜0031) — blocking

| 決定 | 現在の所在 | 行き先 |
|---|---|---|
| 正準JSONは無損失で宣言順に依らない。境界は書かれた向き `a` を保存し (`edge`/`swing` はその側から読む)、書かれた表記は語り直さない (`"at": "Y2+1820"` のまま) | spec/canonical-json.md のみ。guide/cli.md:593・guide/api.md:888 はリンクするだけ | /reference/json/ |
| 語彙の五つの規則 (kind は関係のトポロジーだけ / 物の名は spec 語彙でツールは解釈しない / 解釈される属性は台帳に載せる / 単位は mm・位置は 0..1・鍵は小文字英字 / 継承と上書きを明文化する) と、要素別の台帳 | spec/vocabulary.md のみ。guide/cheatsheet.md は属性名の羅列だけで意味・既定・型を持たない | /why/open-vocabulary・/reference/muro/attributes |
| 継承と上書き — `use` は zone→space、`floor` は space→area、`spec` は boundary→seg | spec/vocabulary.md 規則5。guide は `use` しか書かない | /reference/muro/attributes |
| 診断コードの台帳 (コード・severity・概要) と**欠番の墓標** | spec/semantics.md §5 のみ。guide/diagnostics.md は各節を持つが一覧も欠番一覧も持たない | /reference/diagnostics/ledger・/reference/diagnostics/retired |
| 三つの版の分離 — 言語版 (`.muro` の意味論) / ツール版 (package.json) / 正準JSONの形式版 (`format` の綴り) | spec/language.md §2・spec/canonical-json.md のみ | /reference/stability |
| 床規則 — 導出される切り位置の綴りは「その座標以下で最も大きい通り芯からのオフセット」。上の通り芯から引く綴り (`Y2-1800`) は導出では生じないので、その流儀のファイルを帯に書き直すと幾何が同一でも `koyu diff` に現れる | spec/language.md §3・spec/canonical-json.md 規則3 | /reference/json/・/reference/muro/band |
| 縦動線の算術 — 段数 = ⌈階高 ÷ 蹴上げ上限⌉、蹴上げ = 階高 ÷ 段数、踏面 = 走り長 ÷ (蹴上げ数 − 1)、勾配 = レベル差 ÷ 走り長。踊り場は残余に寄せる。乗り込み (`entry:` 既定1100) は踊り場ではなく階の床で、部品にならず板も持たない。エスカレーターは呼び幅 (`lane:` 既定1200) で割った台数が並び、台ごとに向きが交互になる | spec/derivation.md §4.2–§4.4 のみ。guide/cli.md の runs は出力を見せるが式を書かない | /reference/form/ |
| 空間は割付 (`rects` — 書かれた構成、正準JSONに残る) と凸片 (`pieces` — 導出された領域) の二つを持つ。面積・平面図・立体・敷地照合はすべて `pieces` を読む | spec/derivation.md §0/§1.1 のみ。guide に rects/pieces の区別が無い | /reference/form/ |
| 地下は宣言である (`level` の `underground:1`)。z の負値からは推定しない — 地盤面は敷地の事実であって座標系の原点の事実ではない。土の語彙は導入せず、土に接する壁は `spec:` が運ぶ | spec/vocabulary.md §level のみ。guide には属性名として2回出るだけ | /reference/muro/level |
| 天井は室の輪郭と一致するとは限らない — これは近似である。既定は生成 (室の輪郭 × `h`)、`ceiling:0` が唯一の逃げ道 (現し天井) | spec/vocabulary.md・spec/derivation.md §3.6 のみ。`ceiling` は cheatsheet に語として載るだけ | /reference/muro/space・/reference/form/ |
| 柱は「通り芯の交点のうちその階に床のある所」に立つ。ただし**半屋外でかつ上に床が無い空間からは除かれる** — 空しか支えない床には柱を立てない (露天のテラス・屋上庭園から柱が消え、上階が張り出したバルコニーの下には残る) | spec/derivation.md:186・spec/vocabulary.md:87 のみ。guide/cheatsheet.md:256 と guide/diagnostics.md:1358/:1376 は改訂前の規則のまま | /reference/muro/column |
| 柱は空間でも境界でもない — 面積にも `doors` のグラフにも現れず、平面には塗り潰しの矩形、立体には角柱として出る。第四の一次要素ではなく第三の生成物である | spec/vocabulary.md §column・spec/language.md §9 | /reference/muro/column |
| 最下階の平面は配置図兼用で、敷地形状を一点二点鎖線の敷地境界線として描く。吹抜けは破線の対角線で描く | spec/semantics.md §7 のみ | /reference/form/ |
| 面が無い場所も既にある事実が決める — 吹抜けに床は無く、外部空間に床も天井も無く、半屋外に天井は無く、縦動線に天井は無い。部分被覆には屋根が架かる (基壇屋上は書かずに現れる) | spec/semantics.md §3・spec/derivation.md §3.6 のみ | /reference/form/ |
| 意味差分の対応付け — 空間とゾーンは 2パス (uid 一致 → パス一致)、開口は (kind, edge, at) で対にし、polygon は巡回正規化 (回転・反転) で比べる。境界は既定境界を適用した実効集合で比べる | spec/ と ADR のみ。guide/api.md は結論だけ | /reference/api/diff |
| 数える分節と数えない分節の使い分け — 「面積表に一行として現れてほしいか」(欲しければ `space`、要らなければ `area`)、「そこを通れるかが問題になるか」(なるなら `boundary`、ならないなら `seg`) | ADR-0003 のみ | /howto/uncounted-divisions |
| このデータの解像度は計画初期 (基本計画) レベルである。垂れ壁や建具詳細は表現しない — 省略ではなく抽象度の選択である | docs/policy.md・spec/scope.md §10 のみ | /why/resolution |

---

## 2. spec 化されていない ADR

**「決定が一つも spec/ に届いていない ADR」は無い。** 41編すべてについて、少なくとも一つの決定は spec/ のどこかに現在形で書かれている。ただし**個々の決定の水準では約35件が spec/ に一度も届いていない** (`landed-in-code-only` 25件 + `nowhere-but-the-adr` 10件強)。重いものは §1-B の表に挙げた。

より危険なのは逆向きの漏れである。**spec/ が後の ADR に追随しないまま現在形で古い事実を主張している箇所**が、ADR-0042 の「二本の版は同時に到達する」(commit e6e3376 で除去済) のほかに **7件**残っている。spec/ を退けるなら公開ドキュメントへ写してはならない文である。

| # | 場所 | 現在の記述 | 実装の真 | 覆した ADR |
|---|---|---|---|---|
| 1 | spec/vocabulary.md 規則3 と要素別表 | 「それ以外の k:v は自由だが」/ `spec` `fire` `sound` `sill` `floor` を「— 自由」と分類 | 台帳に無く名前空間も持たない鍵は **ATT03 (error)**。`spec` 等は台帳に載る運搬層の語 | ADR-0033 |
| 2 | spec/vocabulary.md 全体 | 三層・名前空間・ATT03 に一言も触れない (uid の行で掠るのみ) | 三層が値域と検査の根拠 | ADR-0033 |
| 3 | spec/semantics.md COL02 の行 | 「通りを限定しない柱の宣言が同じレベルに複数」という代理指標 | 実際に一本も立たなかった宣言に対して、影を作った先を `related` に添えて出す | ADR-0028 |
| 4 | spec/semantics.md §6 | 「不一致は check の警告にもなる」(敷地面積) | 検証面の `site.area` (caution)。SIT05 は欠番 | ADR-0032 |
| 5 | spec/tools.md:25 | 「check の RUN06 / RUN07」 | `stair.proportion` / `run.slope` (検証面)。両コードとも欠番 | ADR-0032 |
| 6 | spec/composition.md:57・spec/language.md:135 | `drop column C1` の構文のみ | 同名が複数なら**拒む** | ADR-0039 |
| 7 | spec/derivation.md 全体 | `DrawnLine.effect` に一言も触れない | `effect` (`"cut"`/`"nothing"`/`"undetermined"`) は `derivePieces` が書き `checkDrawnLines` が読む。`DrawnLine` は公開型 | ADR-0041 |

付随: docs/policy.md §5.3 の「uid を持つのは空間だけである」も古い (uid は space と zone)。docs/policy.md は新方針では技術的に公開可能だが、「次を定める」「理由 —」という 1.0 に向けた計画の文体であり、そのままでは読み手向けドキュメントにならない。

---

## 3. ADR と実装が食い違っている箇所

ADR は改訂しない。ここに挙げるのは「**公開ドキュメントが実装の真を述べているかどうか**」だけである。上段は今まさに公開頁が嘘を書いている箇所 (最優先)、下段は ADR の本文が古いだけで文書には影響しない箇所 (新しい頁へ写さないこと)。

### 公開頁が実装と食い違っている — 是正必須

| # | 頁と行 | 書かれていること | 実装の真 (実行で確認) |
|---|---|---|---|
| 1 | guide/cheatsheet.md ~370 | 『載っていない key:value は自由に書けて、そのまま運ばれる — つまり `nmae:居室` は黙って通る。』 | **ATT03 (error)**。書き手が開いたままにしておく頁なので最も危険 |
| 2 | guide/cheatsheet.md:336 / guide/en/cheatsheet.md:337 / guide/api.md:1016 / guide/en/api.md:1016 | 既定の言語版は `0.5` (en は `0.4`)、貼られた出力は `[ '0.1'..'0.5' ] 0.5` | `SUPPORTED = 0.1,0.2,0.3,0.4,0.5,1.0` / `DEFAULT = 1.0`。guide/en/cheatsheet.md:48 は受理版の列から `1.0` を落としている |
| 3 | guide/howto/split-into-files.md:21,:45,:140 / guide/glossary.md:67 | `koyu 0.4`、『レイヤー強度のような仕組みは無い』、ADR-0010 を根拠に引用、「加算合成」 | 層は強度を持ち `over` / `drop` / `+` `-` `=` が動く (ADR-0035)。**公開ドキュメントが出荷物の逆を教えている** |
| 4 | guide/diagnostics.md:1111,:1153 / guide/howto/troubleshooting.md:42 / guide/howto/site-and-far.md:251 / guide/cheatsheet.md:282 / guide/cli.md:272 | SIT03・SIT05・「SIT01〜SIT05」・RUN06/RUN07 を `check` の診断として説明 | ENV01 / RUN06 / RUN07 / RUN08 / SIT03 / SIT05 は**永久欠番**。判定は `envelope.gap` `stair.proportion` `run.slope` `run.disconnected` `site.escape` `site.area` |
| 5 | guide/cheatsheet.md:34,:38 | 「`level` が無ければ check は警告どまり」「`h:` / `slab:` は任意」(SUF03 だけを引用) | `level` が定まらなければ **SUF02 (error, 終了コード1)**、`h:` が定まらなければ **SUF01 (error)** |
| 6 | guide/concepts.md:147 と結びの表 | 「外皮の欠落を検査する仕組みは無い」「自動検査は無い」 | `envelope.gap` が方角ごとに長さと区間数を言う |
| 7 | guide/cheatsheet.md:256 / guide/diagnostics.md:1358,:1376 | 柱は「通り芯の交点のうちその階に床のあるところ」に立つ (除外なし) | 半屋外でかつ上に床が無い空間は除かれる。露天テラスに柱の宣言を掛けると COL01 になるのが正しい挙動 |
| 8 | guide/cli.md:74 | 貼られた `check` 出力が `✔ Consistent — …` の一行だけ | 実際は二行目 `Structural consistency only — architectural validity is what koyu validate says, separately` が出る (掟10 違反) |
| 9 | guide/api.md:898-908 / guide/cli.md:152 / spec/tools.md:18 | `ModelDiff` の公開型に `columns` が無い | `columns` は `ModelDiff` の最上位キー。写した型を使う読み手は欄を落とす |
| 10 | 数値の陳腐化 | guide/api.md:46「48」/ guide/README.md:34「全49エクスポート」/ guide/api.md:286 の貼付出力「49 34 15」/ guide/README.md「診断コード全51件」/ guide/howto/editor.md:47「64コード」対:126「全65コード」/ guide/README.md:41「ADR 19編」 | 59 / 65・49・16 / 65 / 65 / **ADR 41編** |
| 11 | guide/cli.md:194 | 「整えられた診断ではなく生の例外が出る (終了コード1)」 | **文書が正しく、ADR-0037 の一般則 (呼び方の問題は必ず終了コード2) を実装が満たしていない。**ここだけは文書ではなくコードを直す判断が要る |

### ADR 本文が古い — 新しい頁へ写さないこと

ADR-0006 決定5 (採光の対象は五つの型 → ADR-0020 が撤回、1/7 の合否自体も検証面へ)、ADR-0008 決定6 (「CIは未知の属性を警告しない」→ ATT03)、ADR-0010 決定3 (「レイヤー強度は採らない」→ ADR-0035)、ADR-0011 決定5 と ADR-0013 決定4 (はみ出し・面積照合は check → 検証面)、ADR-0019 決定5 (`line` は実装しない → ADR-0022 が実装)、ADR-0021 決定6 (RUN06/07/08 → 検証面)、ADR-0023 決定1 (柱の敷地 → ADR-0030 が改訂)、ADR-0025 決定1 (ENV01 → `envelope.gap`)、ADR-0029 決定2 の前提 (「線分は向きを持たないのでどちらから書いても同一」→ ADR-0041 が反例を記録し、導出が正準順を読むように直した)。**特に ADR-0029 の元の理由づけを新しい頁へ写してはならない — 直った後の規則を書く。**

---

## 4. 汚染の実態

リンク591件は機械で消せる。消せないのは**権威を委譲する文そのもの**である。数えたところ約160文あり、その多くはリンクを外すと「存在しない文書を読め」という指示に化ける。

| 文型 | 件数 (ja+en) | 正典化後に何になるか |
|---|---|---|
| 「**規範は spec/ が持つ**」 (cheatsheet.md:5, howto/README.md:5) | 4 | 権威の移譲先が消える。cheatsheet の各節見出しは spec の節へのリンクで構成されているので、前書きごと反転が要る |
| 「両者が食い違ったら **spec/ が正しい**」 (README.md:7, glossary.md:7) | 4 | **自己矛盾**。正典が「自分は正しくない」と宣言する |
| 「規範的な事実は spec/ が所有する。**リンクの無い断言を見つけたら、それは guide/ の欠陥である**」 (README.md:76 / en:78) | 2 | **最も有害な一文**。決定後は全頁がリンクの無い断言を持つことを要求されるので、この文は全頁をバグと宣告する |
| 「何が真かという規範は spec/ が持ち、guide/ は どの順に覚えるか と どうやるか を持つ」 (README.md:7) | 2 | 二冊構成そのものの憲章。頁の再設計が要る |
| 「定義の正は spec/ にある。ここに書かれた一文は**引き当てのための要約であって、契約ではない**」 (glossary.md:7) | 2 | 用語集の58の一文定義を明示的に免責している。決定後はその58行が定義そのものになる |
| 「正確な定義は … が持つ / を見よ」 (concepts.md:7, howto/add-a-level.md:28, howto/doors-and-escape.md:135, howto/agent-mcp.md:89) | 8 | 逃げ道が塞がる。逃げた先の内容を書き起こす必要がある |
| 「契約は … が持つ」「… の台帳が契約である」 (api.md:5, cli.md:5, diagnostics.md:5, diagnostics.md:1107, validation.md:14, howto/troubleshooting.md:367 ほか) | 約28 | 台帳そのもの (公開面・診断コード・判定規則・解釈される属性) の所在が消える |
| 関連ブロックの `(規範)` / `— 規範の定義` / `規範の台帳は …` | 48 (11頁×2) | 24箇条 ×2ロケール。ほぼ全部が純粋な委譲なのでブロックごと消える |
| glossary の表見出し `| 語 | 一文の定義 | 規範 | 用例 |` と前書き | 12 | 「規範」列は委譲専用の列 (spec リンク58 + ADR リンク22 がそこにしか無い)。列ごと削除して一文定義を格上げする |
| 「決定の理由は ADR-00NN」「なぜそう決めたか」 | 約38 | 理由の置き場が消える。理由が読み手に要るものなら /why/ 配下へ書き直す |
| 「かつて … 廃止された (ADR-0014)」 (concepts.md:368, diagnostics.md:1539, howto/doors-and-escape.md:189) | 6 | **BND07 が欠番である事実は残す。ADR-0014 に帰属させる部分は消す** |
| 「旧版は意味が保存される場合にだけ受理される (ADR-0017)」 | 8 | 規則自体は各所にインラインで書かれているのでリンク除去で残るが、4回の重複を一つの正典的な場所へ集約すべき |

### 意図的に不完全な文 — 「リンクを外す」では済まないもの

以下は**書かれていない事実へのポインタで代用されている文**である。ここが費用のかかる部分で、外した瞬間に読み手が答えを得られなくなる。

- guide/api.md:46 — 公開面の唯一の列挙。「全部の一覧は spec/tools.md が持つ」
- guide/api.md:645 / :700 — 形の導出規則。「規則は spec/derivation.md が持つ」「core が唯一の実装を持つ (§7.1)」
- guide/api.md:864 / :888 / :1021 — 作図規約・正準JSONのスキーマと安定性の規則・型の一覧。三つとも内容ゼロのポインタ
- guide/api.md:376 / :819 — core は数を返し判定はしない、という core/validate の分界
- guide/validation.md:14 — **判定規則15件の台帳への唯一のポインタ**
- guide/diagnostics.md:5 / :52 — この頁を「spec の台帳への補遺」と定義している前書きと、`Diagnostic` の構造契約
- guide/diagnostics.md:1107 / :1169 / :1534 — 解釈される属性の台帳 (★)。ATT コードを引いた読み手の答えがここで途切れる
- guide/concepts.md:256 — 属性の三層 (ADR-0033)。主張はあるが定義が無い
- guide/cli.md:5 / :117 / :475 / :524 — 契約の表・診断台帳・採光と敷地の判定定義
- guide/cheatsheet.md:5 / :36 / :67 / :321 — 前書き、版宣言を省いたときの意味、mm 直値の例外、既定値の表 (権威が全部借り物)
- guide/start.md:173 / :417 / :274 — 初学者の唯一の属性一覧・検査一覧・台帳への経路
- guide/howto/identity.md:9 — **「規範は spec/scope.md §5、決定の理由は ADR-0015 と ADR-0039。」** 一文に spec リンク3・ADR リンク2。全コーパスで最も委譲密度が高く、uid の同一性規則が丸ごと行き場を失う
- guide/howto/agent-mcp.md:89 — MCP 12ツールの契約への唯一のポインタ
- guide/howto/doors-and-escape.md:135 — 通行可能性の定義
- guide/howto/troubleshooting.md:367 / :413 — 「効かない属性はまず台帳と照合する」= 存在しなくなる文書を引けという指示
- guide/howto/site-and-far.md — 接道・建築面積・建蔽率・容積率の算術
- guide/howto/add-a-level.md:28 — level / z / h / slab の定義
- guide/glossary.md の一文定義58行 — 「契約ではない」と自称している定義が契約になる

---

## 5. 除染ゲート

### 前提として先に潰すバグ

`docusaurus.config.js` は既に `onBrokenLinks:'throw'` / `onBrokenAnchors:'throw'` だが、591件を一つも捕まえない。原因は `website/scripts/prepare-content.mjs` の `rewriteDestination()` で、`outputDocumentPath()` が写さない宛先はすべて `${repositoryWebUrl}/${view}/main/${repositoryRelative}${hash}` へ落ちる。つまり `../docs/decisions/*.md` は**有効な GitHub URL に洗浄されて公開される**。まずこのフォールバックを、`repositoryRelative` が `docs/decisions/` または `spec/` で始まるときは throw するように変える。

### ファイル

`website/scripts/check-canonical.mjs` — 既存の `website/scripts/check-navigation.mjs` と同じ形 (同じ exit-1 + 一覧出力、同じ「一度直すのではなく類ごと不可能にする」注釈の作法)。

### 走査対象

`prepare-content.mjs` の `outputDocumentPath()` を export して import し、**それが公開文書へ写す入力だけ**を走査する。ファイル一覧をゲート側にハードコードしない — 「公開されている」の定義について publisher とゲートが食い違えなくする。spec/ を `outputDocumentPath` から外せば、ゲートの守備範囲は自動的に縮む。

### フェンスの扱い

`transformMarkdown()` と同じトグル (`/^\s*(?:```|~~~)/`) で囲みブロックを除くのは **LINK 系と PATH 系だけ**。ADR 表記の検出は囲みの中も見る — guide/api.md:740-741 (`// 床・天井・屋根 (ADR-0024)`)、guide/gallery.md:368 は囲みの中にあって公開頁に描画される (227件中8件がこれ)。

### 規則

```js
// 宛先の解決は必須。同じ ADR が guide/*.md からは ../docs/decisions/、
// guide/howto/*.md からは ../../docs/decisions/ で届く。
const linkPattern = /(!?\[[^\]]*\]\()(<[^>]+>|[^\s)]+)([^)]*\))/g;   // transformMarkdown と同一
const rel = path.relative(repositoryDir, path.resolve(path.dirname(file), dest));

no-adr-link:          /^docs\/decisions(\/|$)/.test(rel)
no-spec-link:         /^spec(\/|$)/.test(rel)                    // spec/ spec/en/ 裸のディレクトリ・アンカー付き全部
no-rendered-external: /(?:github\.com\/kensnzk\/koyu\/(?:blob|tree)\/[^\s)]*?|raw\.githubusercontent\.com\/kensnzk\/koyu\/[^\s)]*?)\/(?:docs\/decisions|spec)\//
                      // 洗浄済みの形。原本と website/.generated/**・website/i18n/en/**  の両方で走らせる
no-adr-mention:       /\bADRs?\b/ , /\bADR[‐-―-]?\s?\d{3,4}\b/    // 囲みも対象。16件はリンクでない素の表記
no-spec-mention:      /(?<![\w.\/])spec\//                        // リンクを外しても残る委譲文を捕まえる
```

`no-delegation-prose` — 構文ではなく意味を捕まえる規則。囲みの外で以下のリテラルに当たれば落とす。

- ja: `食い違ったら` / `規範的な事実` / `定義の正` / `規範は` / `規範の定義` / `規範の台帳` / `(規範)` / `| 規範 |` / `正確な定義は` / `正確な契約は` / `が所有する` / `なぜそう決めたか` / `決定の理由は`
- en: `Where they disagree` / `is right.` / `Normative facts are owned` / `The norm for a definition` / `The norms are held by` / `(normative)` / `the normative definitions` / `the normative ledger` / `that owns it` / `that owns that fact`

意図的に広い。**偽陽性は許容し、正規表現を緩めない** — 偽陽性は allowlist 一行、偽陰性は嘘の出荷である。

### 免除

`check-navigation.mjs` の (現在空の) `LOCALE_EXEMPT` と同じ一つの仕組みだけを持つ。

```js
const EXEMPT = new Map([
  ["guide/cli.md:63", "WHY: この頁がフラグの正であると既に宣言している唯一の文。移行の目標であって違反ではない"],
]);
```

規律: (a) 全項目に WHY が要る、(b) 記録した行が当の型に当たらなくなったら**その免除自体が失敗**になる (allowlist が腐らない)、(c) ディレクトリ単位・glob 単位・規則単位の免除は作らない。特に**関連 / See-also ブロックを一括免除しない** — 11頁×2ロケールに24箇条あり、コーパス中で最も委譲が濃い場所である。

### ロケール一致

ja と en に同じ規則集合を掛け、規則ごとの件数を並べて出す。修正後に件数が食い違えば落とす。ミラーは既にずれている (ja の guide/cli.md:436・guide/validation.md:27・guide/howto/unit-layout.md:165 の ADR-0020 リンクに en の対応が無い。guide/en/validation.md:14 は英語頁から**日本語の** spec/validation.md を指している)。片側だけ直す失敗は現実的である。

### 出力と配線

`file:line:col  <rule-id>  <一致した文字列 80字まで>` を規則ごとに束ね、末尾に `no-adr-link: 211  no-spec-link: 380  no-adr-mention: 16 … TOTAL 591` と規則ごとの一行の処方 (「この頁の言葉でその事実を述べ、それから参照を消す」) を出す。当たれば exit 1。

配線は三箇所すべて必須: (1) ルート `package.json` に `"gate:docs": "node website/scripts/check-canonical.mjs"` を足し、AGENTS.md 掟1 の門番の列 (`npm test` / `check:examples` / `gate:examples`) に加える。(2) `website/package.json` で `docusaurus build` の**前**に走らせる (prepare-content.mjs の前に原本を、後に生成物を、計2回)。(3) CI で guide/** に触れた PR ごとに、サイトがビルドできるかとは独立に走らせる。

### 同じ変更に含めないと成立しない付随作業

`website/sidebars.js` から `reference` サイドバー (spec/ 11項目) を外す。`prepare-content.mjs` の `outputDocumentPath()` から spec/ と spec/en/ の写像を外す。`reference` サイドバーの上のコメントは AGENTS.md の「食い違ったら scope.md が正」を根拠に spec/scope を先頭に置いており、この根拠は決定と共に死ぬ。**`check-navigation.mjs` が「公開頁はすべてサイドバーにある」を強制しているので、この二つは同時に動かさないと既存ゲートが落ちる。**

---

## 6. 作業量の見積り

**新規に書き起こす頁: 12** — guide/ に対応物が無く、内容が spec/ か ADR にしか存在しないもの。

`/reference/scope` (三領域・緑の意味・保証の表) / `/reference/form/` (導出規則) / `/reference/form/constants` (`DERIVATION_CONSTANTS` 17 + `TOLERANCES` 7 を生成) / `/reference/json/` (バイトの規範・スキーマ・安定性) / `/reference/muro/composition` (六規則・`over`・`drop`・`+ - =`) / `/reference/muro/attributes` (三層 + `ATTR_LEDGER` を生成) / `/reference/api/` (公開面136名を生成) / `/reference/api/derive` (`Form`・`canonicalBoundaryOrder`・`DrawnLine.effect`・`RunDraw`) / `/reference/cli/layers` / `/reference/cli/validate` (判定15件の台帳) / `/reference/diagnostics/retired` (欠番11コード) / `/reference/stability` (三つの版・二本の版・凍る面と凍らない面)。

**全面改稿が要る頁: 9 × 2ロケール = 18** — リンク除去では済まず、頁の前提から書き直すもの。

guide/README.md (二冊構成の憲章そのもの) / guide/glossary.md (「規範」列の削除と一文定義58行の格上げ) / guide/howto/README.md (how-to は規範を書かないという憲章) / guide/howto/split-into-files.md (現在の記述が出荷物の逆) / guide/validation.md (規則台帳を自ら持つ) / guide/api.md (公開面の台帳を自ら持つ) / guide/diagnostics.md (コード台帳と欠番を自ら持つ) / guide/cli.md (契約の表を自ら持つ) / guide/cheatsheet.md (既定値の表の権威が全部借り物)。

**文の完成: 約71文 × 2ロケール = 142文** — 「ポインタで代用されている文」を、その頁の言葉で書き切る作業 (内訳: api.md 9 / diagnostics.md 8 / troubleshooting.md 6 / README.md 6 / cli.md 5 / start.md 5 / cheatsheet.md 4 / concepts.md 3 / doors-and-escape.md 3 / site-and-far.md 3 / split-into-files.md 3 / agent-mcp.md 3 / 他 13)。これに **glossary の一文定義 58行 × 2 = 116行**の格上げが加わる (要約として書かれているので、うち5行 — uid / 既定境界 / 半屋外 / 正準JSON / 意味差分 — は定義として不足しており加筆が要る)。

**委譲文の削除・反転: 約160文** (§4 の表の合計、両ロケール)。

**参照の除去: 591件** (ADR リンク211 + spec リンク380) **+ 素の ADR 表記16件**。42頁 (21×2) のうち、少なくとも一件の参照を持つ頁は42頁すべて。

**是正が要る事実誤り: 11件** (§3 上段)。うち即座に読者を誤らせるもの4件 — `nmae:` は黙って通る / 既定の言語版は 0.5 (en は 0.4) / レイヤー強度は無い / SIT03・RUN06 は check の診断。

**総量の目安**: 新規12頁 + 改稿18頁 + 完成142文 + 格上げ116行 + 削除160文 + 誤り11件 + ゲート1本 + 付随変更3箇所 (`sidebars.js` / `outputDocumentPath` / `test/public-api.test.ts` の照合先移設)。最も重いのは新規12頁のうち `/reference/form/`・`/reference/json/`・`/reference/muro/composition` の三つで、この三つだけで spec/derivation.md (393行)・spec/canonical-json.md・spec/composition.md の内容を読み手向けに書き直すことになる。逆に最も安いのは削除で、機械的に処理できる。**順序は「新規12頁 → ゲート導入 → 改稿・完成・削除」にしないと、ゲートが導入された瞬間にサイトがビルドできなくなる。**