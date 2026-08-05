# Speckle 連携 — 何が繋がり、何は繋がらないか

日付: 2026-08-05 / 状態: 調査 + ブレスト (未決定。ADR は一本も書かれていない)

[ecosystem.md](ecosystem.md) は Speckle を**軸4 (既存BIM) の一節**に置き、優先度を**7 (最後)** にした。調べ直した結果、**置き場所も優先度も間違っている**。この文書はその調べ直しと、そこから出てくる設計判断である。

原則は ecosystem.md と同じ一つだけ。**koyu は小さいままでいる。** Speckle に繋ぐとは koyu に機能を足すことではなく、koyu が既に持っているものを向こうの受け口に差すことである。

---

## 0. 先に — ecosystem.md の三つの誤り

| 誤っている記述 | 実際 (2026-08 時点) |
|---|---|
| 「Speckle \| TS/Python/C# / **Apache-2.0**」 | Apache-2.0 **だが例外が二つある**。`packages/server/modules/workspaces/` と `packages/server/modules/gatekeeper/` は **Speckle Enterprise Edition (EE) ライセンス**。オープンコアの線は既に動いた。 |
| 「**Speckle Automate に** `koyu check` / `koyu validate` **を関数として置く**」(D15) | **Automate は OSS でも自ホストでもない。** 公式 FAQ が明言している — "Automate is not open-source or self-installable"。Speckle 社のインフラ上でしか動かない。D15 は書き直しが要る (→ §7)。 |
| 「素材は既にリポジトリにある (`IFC_samples/BLCJ_RC3000_A_Revit` 等)」(D9) | **このリポジトリに `IFC_samples/` は無い。** `examples/comparison/` にあるのは手書きの `two-rooms.ifc` (7.3 KB) と `two-rooms.ifcx` (20 KB) だけである。実務規模の IFC は調達からになる。 |

三つ目が効く。D9 (「40MB を 200 行に」) は**素材が無い**ので、書かれているより一段遠い。**そして Speckle がその一段を埋める** (→ §5)。

---

## 1. Speckle は何か — 三つの層に割れている

「Speckle は OSS か」は、そのままでは答えられない問いになった。**三つの層があり、線は年々上に動いている。**

| 層 | ライセンス | 何が入るか | koyu から使えるか |
|---|---|---|---|
| **OSS サーバー** (自ホスト) | Apache-2.0 (例外二つ) | プロジェクト/モデル/バージョン、GraphQL + REST API、3Dビューア、Webアプリ、**コネクタ網**、**Webhook** | **全部使える。** 自ホストは無料・無制限 |
| **Cloud** (app.speckle.systems) | 商用 | 上記 + **Automate** (関数実行環境)、管理された取り込み・CDE連携、Intelligence | API は同じ。**Automate だけは他で代替できない** |
| **Enterprise** | 商用 | + workspaces/gatekeeper (EE モジュール)、SSO、SLA | 対象外 |

**無料 Cloud (Explore) には量の上限がある** — 1プロジェクト、バージョン 100 本、月 50 同期、履歴 30 日程度。**デモには十分、CI の常用には足りない。**

### データモデル (v3) — ここが本題である

v2 の `Objects.BuiltElements.Wall` のような**BIM クラス階層は無くなった**。v3 は二つの型しかない。

| 型 | 役割 | 主なフィールド |
|---|---|---|
| **`Collection`** | 階層の容れ物。**データは持たない** | `elements` (子の配列) |
| **`DataObject`** | 意味を持つ要素 (壁・柱・扉…) | `properties` (キー値)、**`displayValue` (幾何プリミティブの配列)** |

両者の基底が `Base` で、共通して持つのは:

- **`id`** — **内容のハッシュ** (MD5、16進32桁)。内容が変われば別の id になる。重複排除の鍵。
- **`applicationId`** — 元アプリ側の識別子。公式の説明が **"provides stable version tracking"** (版を跨いだ安定した追跡) である。
- `speckle_type`、`units`、`totalChildrenCount`
- `@` 接頭辞の**デタッチ** (大きな子を別オブジェクトとして切り出し、参照ハッシュを置く) と**チャンク分割**

### プロトコル

- 送信: `POST /objects/:projectId` — multipart、中身はオブジェクト配列の JSON、gzip 推奨。**1オブジェクト 10 MB、1リクエスト 50 MB** の上限。
- 版の作成・問い合わせ: **GraphQL**。現行ドキュメントは REST の書き込みより SDK / GraphQL を勧めている。
- 認証: Personal Access Token (スコープ付き)。
- JS 側の既製品: `@speckle/objectloader2` (受信)、`@speckle/objectsender` (送信)。

### コネクタ網 — これが唯一の資産である

Revit / Rhino / Grasshopper / Dynamo / AutoCAD / Civil3D / Blender / SketchUp / ArchiCAD / Navisworks / Tekla / Bentley / ETABS ほか CSI / Excel / Power BI / QGIS / Unity / Unreal、**および IFC 取り込みサービス**。

**これを自前で書くのは無理である**、という ecosystem.md の判断は正しい。むしろ過小評価されている。

### IFC 取り込み — 三代目は IfcOpenShell である

Speckle の IFC インポータは三度作り直されている。初代は Node.js + web-ifc、二代目は web-ifc を C++/CLR で包んだ C# 実装 (クロスプラットフォームにならなかった)、**現行は IfcOpenShell を採用**。

現行が取り出すもの: 要素プロパティ、**IfcSpace を 3D 幾何つきで**、材料数量、型属性、プロパティセット。**最大 1 GB**。結果は v3 のデータモデル (Collection + DataObject) に載る。

**IfcSpace が入る、というのが koyu にとって決定的である** (→ §5)。

---

## 2. 接ぎ手の対応 — 五つのうち四つに受け口がある

ecosystem.md の「接ぎ手は五つしかない」をそのまま当てる。

| koyu の接ぎ手 | Speckle の受け口 | 質 |
|---|---|---|
| **正準JSON** (バイト同一) | `Base.id` = **内容ハッシュ** | **思想が一致**。ただし値は一致しない (→ 観察3) |
| **パス** `/L5/A/ldk` | **`applicationId`** | **ほぼ完全一致**。向こうの定義が「版を跨いだ安定した追跡」そのもの |
| **uid** | 同上 (uid があれば uid を入れる) | 一致。ただし運用圧力が生まれる (→ 観察4) |
| **Form** (形は導出) | **`DataObject.displayValue`** | **完全一致**。向こうの定義が「表示のための幾何」 |
| **属性 / 台帳** | `DataObject.properties` | 一致。名前空間で運べる (法7 を破らない) |
| パス階層 | `Collection.elements` の入れ子 | 一致 |
| **空間グラフ** (隣接・通行可能性・境界) | **無い** | **欠落**。一級の関係という概念が Speckle に無い |

---

## 3. 四つの観察

### 観察1 — `displayValue` は「形は生成物」の Speckle 側の綴りである

koyu の [Form](../reference/form/index.md) は「原本に形は無い。形は `derive(model)` の返り値である」と言う。Speckle の `DataObject` は「**意味は `properties` にあり、幾何は `displayValue` — 見た目を表す配列**」と言う。

**同じ分割である。** ecosystem.md は同じことを OMG/FOG (`omg:hasGeometry` の先に形を置く) について書いた。だが OMG/FOG は語彙の提案にすぎず、**Speckle はその分割で実際に業界の道具を繋いでいる実装である。** koyu の主張を「特殊な思想」ではなく「既に動いている構造」として説明できる相手として、Speckle は RDF 語彙より強い。

### 観察2 — `applicationId` はパスの受け口である

koyu の売りの一つは「**GUID 対応表が要らない**」(ecosystem.md の接ぎ手の表)。Speckle には `id` (内容ハッシュ) とは別に `applicationId` があり、その存在理由が「元アプリ側の安定した識別子」である。

**つまり `applicationId: "/L5/A/ldk"` と書くだけで、対応表ゼロの主張が向こうの一級の語彙で言える。** 他のコネクタはここに Revit の GUID を入れる。koyu は**人間が読める文字列**を入れる。並べたとき、違いが一目で分かる。

### 観察3 — 内容ハッシュ同士だが、値は一致しないし、させてはいけない

koyu の正準JSON は「バイト同一なら同じ建物」を定義する。Speckle の `id` は「内容が同じなら同じオブジェクト」を定義する。**独立に同じ発見をしている。**

だが値を一致させようとしてはいけない。Speckle の `id` は MD5、koyu の同一性は正準JSON のバイト列で、**両者の「内容」の定義がそもそも違う** — koyu の同一性は原本 (書かれた宣言) の上にあり、Speckle の id は生成物 (Collection + Mesh) の上にある。**同じ建物から同じ Speckle id が出る**ことは保証できるし保証すべきだが (押し出しが決定的なら自動的にそうなる)、**逆は言えない**。

規律として: **Speckle の id を koyu の同一性の証拠に使わない。**

### 観察4 — 境界は落ちる。IFC と同じ場所で落ちる

**Speckle に一級の「関係」が無い。** `Collection` は包含だけ、`DataObject` は自分の属性と幾何だけを持つ。隣接も通行可能性も境界も、置き場所は `properties` の中の文字列配列しかない。

これは `IfcRelSpaceBoundary` が実務の書き出しで真っ先に落ちるのと**同じ場所の欠落**である。ecosystem.md はこれを見て「BOT の `bot:Interface` が koyu の boundary そのものだ」と書いた。その判断は Speckle を見ても変わらない。

したがって:

> **Speckle は形と属性の運び屋である。koyu の主張の運び屋ではない。**
> **主張は BOT/RDF に置く。Speckle には届けるために乗る。**

この二つを混ぜてはいけない。「Speckle に出せた」は「意味が保たれた」ではない (ecosystem.md の規律6)。

---

## 4. 関係の非対称 — そしてそれが好都合である

| | Speckle | koyu |
|---|---|---|
| 解いている問題 | **交換と配布**。多数の道具が吐く別々の形を一つのグラフに集める | **オーサリング**。建物の原本をテキストにする |
| 原本はどこに | **無い**。全ての Speckle オブジェクトは何かの書き出しである | `.muro` そのもの |
| 履歴 | project / model / **version** | **git** |

Speckle にとって koyu は「また一つのソース」、koyu にとって Speckle は「出口の束」。**対称ではない。** そして対称でないことが都合がよい — koyu はコネクタを一つも書かずに Revit/Rhino/Blender/PowerBI に届き、Speckle は「**原本が人間可読テキストで、しかも一棟 22 KB**」という珍しいソースを一つ得る (`examples/tower/` は原本9ファイル計 22,024 バイト)。

### 履歴の衝突 — 先に決めておくこと

Speckle は version 管理を売りにしている。koyu は git を使い `diff` を持つ。**どちらが履歴を持つかを決めないと二重管理になる。**

**履歴は git が持つ。Speckle の version は「その時点の射影」であって原本の歴史ではない。** これは MCP サーバーで「ステートレス、真実はファイルシステム、歴史は git」と決めたのと**同じ判断・同じ理由**である ([AGENTS.md](../../AGENTS.md))。push は常に「今の HEAD の射影」。Speckle 側の version 履歴を koyu の履歴として読ませない。

### 何を送るかで主張が決まる

koyu の Form は壁・スラブ・階段・開口・柱を持つ。**全部送ると、Speckle 上で koyu は「また一つの BIM モデル」になり、主張が消える。**

**送るべきは空間である。** 壁とスラブは別の Collection に落とすか、そもそも送らない。**Speckle で開いたとき最初に見えるのが室の一覧である**ようにする。向こうの UI に対する主張の埋め込みで、コストはゼロ。

---

## 5. 非対称の反転 — Speckle 経由だと「入れる」が安くなる

ecosystem.md の一般則はこうだった。

> **「出す」と「繋ぐ」はほぼ無料で、「入れる」だけが難しい。** そして最も説得力があるのも「入れる」である。

**Speckle を挟むとこれが崩れる。**

| | 直接 (IfcOpenShell) | Speckle 経由 |
|---|---|---|
| STEP のパース | 自分でやる (IfcOpenShell = LGPL、Python) | **向こうがやっている** (IfcOpenShell、最大 1 GB) |
| 幾何の生成 | 自分でやる (ブーリアン込み) | **向こうがやっている** |
| `IfcSpace` の抽出 | 自分でやる | **向こうがやっている。3D 幾何つき** |
| psets / 型属性 | 自分でやる | **向こうがやっている** |
| koyu 側の入力 | STEP / IFC の物理ファイル | **GraphQL の JSON** |
| 残る仕事 | 全部 | **矩形グリッドへのスナップと解像度の決定だけ** |

**D9 のプロトタイプが、STEP を一行も読まずに書ける。** そして残る仕事 (スナップと解像度) こそが、ecosystem.md が「D9 を書く経験からしか決まらない」と書いた本質的な部分である。**本質的でない部分を丸ごと外注できる。**

### ただし三つの留保

1. **経路 B は解決しない。** `IfcSpace` が書き出されていない IFC (実務では珍しくない) では、壁から閉領域を検出する仕事が残る。Speckle は何も助けてくれない。**そして経路 B のほうが多い。**
2. **Speckle の解釈を継承する。** 向こうが IfcSpace をどう Collection に配置したか、psets をどう平らにしたかが、そのまま koyu 側の入力になる。**中間の解釈が一枚増える。**
3. **1 GB / 50 MB の上限と、無料枠の量の上限。** 実務規模を常用するなら自ホストが要る。

**判断: プロトタイプは Speckle 経由で書く。本番の受入 (経路 B を含む) は IfcOpenShell に直接乗る。**両方を同じ `.muro` 出力に収束させ、[comparison](../../examples/comparison/README.md) の物差し (面積・隣接・扉数) で突き合わせる。

---

## 6. 何を作るか — `koyu-speckle` 橋の最小形

置き場所は ecosystem.md の規律どおり。**npm パッケージの外、`skills/` と同じ扱い、あるいは別リポジトリ。** core には一行も入らない。

### 動詞は二つ

**`push`** — 正準JSON + Form → Collection 木 + DataObject → `POST /objects/:projectId` → GraphQL で version を作る。

**`pull`** — GraphQL で IFC 取り込み済みモデルを引く → `IfcSpace` 由来の DataObject を拾う → グリッドにスナップ → `.muro` を吐く。

### push のペイロード案 (**未検証。サーバーに投げていない**)

`speckle_type` の正確な綴りは要確認。**構造だけが主張である。**

```jsonc
// 根 — 建物ひとつ
{ "speckle_type": "…Collection",
  "name": "tower",
  "applicationId": "koyu:/",
  "units": "mm",
  "properties": {
    "koyu": { "format": "koyu-canonical/1.2", "koyu": "1.1",
              "origin": { "epsg": 6677, "easting": -8000, "northing": -34000 },
              "azimuth": -12.5 } },
  "elements": [ /* level ごとの Collection */ ] }

// 階
{ "speckle_type": "…Collection", "name": "L5", "applicationId": "koyu:/L5",
  "elements": [ /* zone の Collection と space の DataObject */ ] }

// 室 — ここが主役である
{ "speckle_type": "…DataObject",
  "name": "LDK",
  "applicationId": "koyu:/L5/A/ldk",          // uid があれば uid を優先 (→ §6 の運用)
  "properties": {
    "koyu": { "path": "/L5/A/ldk", "uid": "…", "type": "room", "level": "L5",
              "area_m2": 24.3,
              "adjacent": ["/L5/A/bed1", "/L5/corridor"], "doors": 2,
              "attrs": { "name": "LDK", "daylight": 1 } } },
  "displayValue": [ /* pieces を階高で押し出した Mesh */ ] }
```

`properties.koyu` は ecosystem.md の**ツイン・マニフェスト**とほぼ同じ一枚である。**別々に設計してはいけない — 同じ一枚を Speckle にも Brick にも DTDL にも落とす。**

### 依存

**ゼロで書ける。** `fetch` は Node 18+ に入っており、MD5 は `node:crypto` にある。gzip も `node:zlib`。**`@speckle/objectsender` を使わない選択が現実的である** — 送信側の必要な部分が小さく、依存ゼロは koyu の橋の作法に合う。受信側 (`pull`) は GraphQL の POST 一本なので、なおさら要らない。

**ただしこれは「依存ゼロだから core に入れてよい」ではない** (法8 と別の話)。Speckle の綴りは動く。橋は橋に置く。

### 測地の扱い — Speckle に CRS が無い

Speckle のモデルが持つのは `units` だけで、**座標参照系の概念が無い**。QGIS コネクタは CRS を扱うが、それは**コネクタ側の設定** (原点オフセット + 真北角) であって、モデルに載る宣言ではない。

koyu には [`origin`](../reference/muro/origin.md) (EPSG) と [`azimuth`](../reference/muro/azimuth.md) がある。**この一点で koyu のほうが強い。**

規律は Form と同じにする。**幾何はモデルの mm のまま送り、枠は根の Collection の `properties` に載せる。** 投影して世界座標で送ってはいけない — [Form が枠を持たない](../reference/form/index.md)のと同じ理由で、**受け手が Form の座標を地図の座標と取り違える**からであり、しかも Speckle にはその取り違えを訂正する場所が無い。

### uid の運用圧力

`applicationId` は「版を跨いで同じ要素」を言うためのものである。koyu のパスは rename で変わり、uid は変わらない。したがって規則は「**uid があれば uid、無ければパス**」になる。

その帰結: **uid の無い空間は、Speckle 上で版を跨いで追跡できない。** 押し出しを続けるなら uid を書け、という実際的な圧力が生まれる。これは ecosystem.md が D4 の分水嶺に書いた「パスの安定性 (rename)」と**同じ問題が別の場所で出たもの**である。**先に uid の運用規則を決めるほうが安い。**

### 試験 — 問いの一致

D1 / D10 と同じ作法。**「送れた」ではなく「意味が保たれた」を試験にする。**

| 問い | koyu | Speckle から引き戻して |
|---|---|---|
| 室の数 | `stats` | DataObject の数 |
| 各室の面積 | `stats` | `properties.koyu.area_m2` と displayValue の実測 |
| 隣接 | `graph` | `properties.koyu.adjacent` |
| 扉の数 | `doors` | `properties.koyu.doors` |

面積の二重測定 (宣言された `area_m2` と、送った Mesh から測り直した面積) が**押し出しの忠実さ**を握る。ここが一致しなければ displayValue の生成が壊れている。

---

## 7. D15 の書き直し — Automate は使えるが、頼れない

ecosystem.md の D15 は「Speckle Automate に `koyu check` を関数として置く → 誰かが Revit からプッシュするたびに koyu の判定が回る」だった。**Automate が OSS でも自ホストでもないので、この絵は Speckle 社のクラウドに固定される。**

三つの選択肢がある。

| 案 | 動くところ | OSS か | 何が言えるか | 費用 |
|---|---|---|---|---|
| **A. Automate 関数** | Speckle Cloud のみ | **関数は書けるが実行環境は閉じている** (SDK は Python / C#、JS/TS は開発中) | 「**業界のプラットフォームの中に koyu が居る**」。Speckle の UI に判定が出る | 無料枠の同期上限に当たる |
| **B. 自ホスト + Webhook + 自前ランナー** | 自分のサーバー | **完全に OSS** (Webhook は Apache-2.0 側) | 同じことが誰の許可も無しにできる | サーバーの運用 |
| **C. GitHub Actions** | GitHub | OSS | 「**建物のコードレビュー**」。`.muro` の PR に平面図の差分が付く | ほぼゼロ |

**推奨: C が原本の CI、A がデモ。二つは競合しない。**

- **C が本体である。** 原本は `.muro` で、履歴は git で、変更は PR で来る (§4)。`check` / `validate` / `diff` / 平面図の差分は**そこで回るのが自然**で、Speckle は要らない。
- **A は「業界側から見える」ための一枚。** Revit の人が Speckle に押した瞬間に koyu の判定が出る絵は、C では作れない。**ただし依存であることを自覚して作る** — 動かなくなっても koyu は何も失わない位置に置く。
- **B は A が閉じたときの逃げ道**として存在を確認しておくだけでよい。今作らない。

---

## 8. リスクと規律

### オープンコアの線は動いている

`workspaces/` と `gatekeeper/` が EE になった。無料 Cloud は量で区切られた (プロジェクト数・バージョン数・月次同期数)。Automate は最初から閉じている。**次に何が動くかは分からない。**

koyu の露出は**小さく保てる**。橋が触るのは Apache-2.0 側の API (GraphQL / REST / Webhook) だけで、しかも橋は npm パッケージの外にある。だが**保つには規律が要る**。

### 規律 (ecosystem.md の規律に追加する五つ)

1. **[stability.md](../reference/stability.md) に載せない。** Speckle の綴りは動く。凍る面を増やさない (法6)。
2. **npm パッケージに入れない。** 橋は `skills/` と同じ扱い。core は一行も変わらない。
3. **`check` / `validate` の答えを Speckle に依存させない。** 判定は原本だけから出る。Speckle が落ちても koyu は完全に動く。
4. **Speckle を経由した往復を可逆と言わない。** push は射影 (一方向)。pull は受入で、**人が読んでレビューする `.muro`** を吐くから許される (ecosystem.md の規律3)。
5. **Speckle の `id` を koyu の同一性の証拠にしない** (→ 観察3)。

---

## 9. 優先順位の中の置き場所

ecosystem.md の優先順位表は Speckle を 7 (最後) に置いた。**測地が landing した今** (`origin` / `azimuth` が core に入った)、表そのものが動く。Speckle について言えることだけを書く。

| ecosystem.md の順 | Speckle がどう効くか | 動くか |
|---|---|---|
| 1. 測地 | — (**済**) | 完了。軸3 の閂は外れた |
| 2. BOT/Turtle 射影 + D1 | 効かない。**主張はこちらに置く** (→ 観察4) | 動かない。**ここが最優先のまま** |
| 3. ツイン一枚もの D4 | `properties.koyu` = ツイン・マニフェストで**同じ一枚を共有する** | 設計を合流させる |
| 4. IFC 受入 D9/D10 | **プロトタイプが Speckle 経由で劇的に安くなる** (→ §5) | **前倒しできる** |
| 7. Speckle Automate D15 | 書き直し (→ §7)。C (GitHub Actions) は独立に安い | **C を切り出して前に出す** |

そして表に無かったものが一つ増える。

> **push の一発デモ。** `.muro` 22 KB → Speckle のリンク → **同僚が Revit で開く**。
> **テキストから業界の道具までの最短経路であり、koyu 側の実装は数百行、依存ゼロ。**
> ecosystem.md の T0 (一枚もの) の段に入る安さで、T1 の説得力がある。

---

## 10. 未決定のまま置くこと

- **`speckle_type` の正確な綴り** — v3 の `Collection` / `DataObject` の完全修飾名を実サーバーで確認していない。**§6 の JSON は構造の案であって、走らせた出力ではない。**
- **押し出しの規則** — 空間の Mesh を階高で押し出すとして、スラブ厚をどう扱うか。`Form` の [bodies](../reference/form/bodies.md) をそのまま使えるか、別に組むか。
- **壁を送るか** — §4 の判断は「送らない/従属させる」だが、Speckle で「壁が見えない建物」が受け入れられるかは見てから決まる。
- **pull の解像度規則** — ecosystem.md の「受入の解像度規則」と同じ問題。Speckle 経由でも解決しない。
- **橋のリポジトリ** — `koyu-bridges` 一本か `koyu-speckle` 単体か。ecosystem.md の未決定事項のまま。
- **自ホストするか** — デモは無料 Cloud で足りる。実務規模の受入を常用するなら要る。

---

## 出典

- [speckle-server LICENSE](https://github.com/specklesystems/speckle-server/blob/main/LICENSE) — Apache-2.0 と EE の例外二つ
- [Compare Open Source, Hosted, and Enterprise Speckle](https://docs.speckle.systems/developers/server/self-hosted-vs-cloud-hosted-speckle)
- [Automate FAQ](https://docs.speckle.systems/developers/automate/faq) — "not open-source or self-installable"
- [Data schema overview](https://docs.speckle.systems/developers/data-schema/overview) / [Core concepts](https://docs.speckle.systems/developers/data-schema/concepts) — Base / Collection / DataObject / displayValue / applicationId
- [Key concepts](https://docs.speckle.systems/developers/key-concepts) — DAG、version
- [REST API (legacy)](https://speckle.guide/server/server-rest-api) — `POST /objects/`、gzip、10 MB / 50 MB
- [Webhooks (legacy)](https://speckle.guide/server/server-webhooks.html)
- [IFC integration](https://speckle.systems/integrations/ifc/) — spaces with 3D geometries、1 GB
- [speckleifc](https://github.com/specklesystems/speckleifc) — "Third itteration of our IFC file importer, this one based around IfcOpenShell"
- [Connectors](https://speckle.systems/connectors/)
- [QGIS connector](https://docs.speckle.systems/legacy/user/qgis) — CRS はコネクタ側の設定
- [Pricing](https://speckle.systems/pricing/) / [New plans FAQ](https://docs.speckle.systems/workspaces/new-plans-faq)
- [@speckle/objectloader2](https://www.npmjs.com/package/@speckle/objectloader2)
