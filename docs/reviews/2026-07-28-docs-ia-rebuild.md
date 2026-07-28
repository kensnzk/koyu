# ドキュメントサイト 情報アーキテクチャ再構築 — 診断と計画

対象: `website/` (docs.koyucore.dev) と、その原本である `guide/` `spec/` `docs/`
日付: 2026-07-28

---

## 到達状況 — 公開できる状態の7条件

| # | 条件 | |
|---|---|---|
| 1 | ナビが新IA (入門/解説/手順/リファレンス)、全頁到達可能 | ✅ `check:navigation` 167 ja / 167 en |
| 2 | リファレンスが規範を**自分の言葉で**持つ | ✅ 109頁。`docs-ledger.test.ts` が診断65・判定15・CLI14・MCP12・公開名136 の全件掲載を機械で守る |
| 3 | 公開頁から ADR/spec 参照ゼロ | ✅ `gate:canonical --strict` 0件 (着手時 1,492件) |
| 4 | spec/ と ADR が非公開 | ✅ リポジトリには履歴として残す。公開対象から外し、参照をゲートで禁止 |
| 5 | 実装と食い違う記述ゼロ | ✅ 既知の11件を新しい頁で是正。旧版宣言が残るのは VER01-04 の用例のみ (正当) |
| 6 | 旧URL全転送 | ✅ `plugin-client-redirects` で31本 |
| 7 | ja/en 対等、build 緑 | ✅ `npm test` 406件・`typecheck`・`check:examples`・`gate:examples`・本番ビルド すべて緑 |

**公開できる状態に到達している。**残りは §14 のトレードオフに挙げた既知の負債 (`spec/` の持ち方が未決であること) だけで、これは公開の前提条件ではない。

---

---

# 第一部 — 診断

## 1. 分類が理解できない理由は「分類が存在しない」から

`website/` に独自の情報設計は**一つも無い**。[prepare-content.mjs](../../website/scripts/prepare-content.mjs) が `guide/` と `spec/` を逐語コピーし、[sidebars.js](../../website/sidebars.js) が二枚のサイドバーを手書きで並べているだけである。

> **サイトの情報設計 = リポジトリのフォルダ名。**

`guide/` と `spec/` の別は**統治の軸**である — 誰が規範的事実を主張してよいかの区別であり、[AGENTS.md](../../AGENTS.md) が守らせるための境界である。読者にとっては不可視で無意味なのに、それが navbar の第一分割として出荷されている。エラーコードを持った読者は、答えが Guide と Reference のどちらの扉にあるか判定できない。

しかも統治の軸としても破れている。

| ファイル | 行数 | 実態 | 置かれている場所 |
|---|---|---|---|
| `guide/cli.md` | 647 | 規範リファレンス | 学ぶ本 (guide/) |
| `guide/api.md` | 1,045 | 規範リファレンス | 学ぶ本 (guide/) |
| `guide/diagnostics.md` | 1,564 | 規範リファレンス + 直し方 | 学ぶ本 (guide/) |

navbar が `CLI` と `TypeScript API` を**第3・第4項目として貼り付けている**のは、二枚のサイドバーがこの三本を表現できなかった証拠である。navbar の4項目のうち2つは文書種別 (Guide/Reference)、2つは製品面 (CLI/API) — 軸が混ざっている。

## 2. 実測した欠陥

| 事実 | 実測値 | 確認方法 |
|---|---|---|
| ルートページのタイトル | `guide/ — koyuを学ぶ` | dev サーバーで確認。ディレクトリ名がサイトの顔 |
| 検索 | **無し** | Algolia もローカル検索プラグインも未設定 |
| 公開ページ | 32 (ja) / サイドバー掲載 26 | `prepare-content.mjs` 出力 |
| **孤児ページ** | **6** | 下表 |
| ADR への外部リンク | **118本** | 説明層が丸ごと GitHub に流出 |
| レンダリング後に残るリテラル `**` | **150箇所 / 26ページ中 17ページ** | 本番ビルド後の HTML を grep |
| 壊れたアンカー | `#sit03` `#sit05` | build 警告 |

### 孤児ページ (公開されるがどのサイドバーにも無い)

| ファイル | 行数 | 重大度 |
|---|---|---|
| `spec/scope.md` | 229 | **最悪** — AGENTS.md が「最初に読め」「食い違ったらこれが正」と指定する裁定者 |
| `spec/derivation.md` | 393 | 最大の規範文書 |
| `spec/composition.md` | 121 | 合成の六規則 (muro 1.0 の目玉) |
| `spec/validation.md` | 79 | 判定の台帳 |
| `guide/validation.md` | 376 | 判定15規則の事典 |
| `guide/howto/identity.md` | 165 | uid の手順書 |

計 1,363行。しかも `spec/README.md` 自身の「文書の地図」は、サイドバーに無い `derivation.md` を案内している。**ページの自己申告とナビゲーションが矛盾している。**

### レンダリングの破損

CommonMark では、閉じる `**` が CJK 約物 (`。、」』）`) の直後にあると閉じられない (right-flanking 条件を満たさない)。結果、本番 HTML に `**` がそのまま出る。

```
**これはリファレンスである。koyuをこれから学ぶなら guide/start.md から始めること。**引くための…
```

↑ `spec/README` の実際のレンダリング。150箇所、17ページ。**IA以前の問題であり、最優先で直す。**

## 3. 一枚に詰め込まれている量 (ソースから実測)

| 現在のページ | 行数 | 中に入っている「1つのこと」 |
|---|---|---|
| `guide/diagnostics.md` | 1,564 | 診断コード **65** (19族) |
| `guide/api.md` | 1,045 | 公開エクスポート **136** (値 59 + 型 77) ※本文の「全49」は陳腐化 |
| `guide/cli.md` | 647 | サブコマンド **14** |
| `guide/cheatsheet.md` | 387 | 宣言 **19** + 属性台帳 **45キー** |
| `guide/validation.md` | 376 | 判定規則 **15** |
| `spec/tools.md` | 106 | CLI 14 + **MCPツール 12** + 公開API **136** |

**MCP・API のリファレンスは実質存在しない。**MCPツール12個の仕様は `spec/tools.md` の**表の12行**がすべてである。`svgAxo` には署名も例も無い。`validate` / `VALIDATION_RULES` / `Finding` には 1,045行中に節が無い。JSON-RPC の面 (`initialize` / `tools/list` / `isError`) はどこにも書かれていない。CLI 14個中 `validate` と `layers` の 2つが未文書。

---

# 第二部 — 世の中の事例

11サイトの階層を実地取得した。要点だけ。

## 4. 最上位の軸には二つの流派がある

**流派A — モード先頭 (Diataxis)**

| サイト | 最上位 |
|---|---|
| **Django** (Diataxis 著者自身のプロジェクト) | Tutorials / Topic guides / Reference guides / How-to guides |
| **Python** | Tutorial / Library reference / Language reference / HOWTOs / … |
| **Kubernetes** | Getting started / Concepts / Tasks / Tutorials / Reference |

**流派B — 製品面先頭**

| サイト | 最上位 |
|---|---|
| **Typst** | Overview / Tutorial / **Reference (Language・Library・Export)** / Guides |
| **D2** | Introduction / Getting Started / … / **API / CLI manual** / Cheat Sheet |
| **Pkl** | Introduction / Tutorial / **Language / Tools** / Examples |

**重要な観察が二つある。**

1. **「spec」を独立した最上位に置くサイトはほぼ無い。**Python は言語定義を `Language reference` という**リファレンスの一巻**として置く。Django も Kubernetes も同じ。唯一 MCP が `Specification` を最上位の兄弟にしているが、**それは spec が独自の日付版で回るから**であり、koyu にその必要はない。
   → **`spec/` を navbar に出さない。規範性はページ単位のバッジにする。**

2. **モード先頭のサイトでも、リファレンス巻の中は必ず製品面で割れている。**Python の `Library reference` / `Language reference`、Kubernetes の `API reference` / `command-line tools`。
   → **モード先頭と面別は排他ではない。面は第二階層に来る。**

## 5. 「1ページ1要素」は正しい。ただし条件がある

ご指摘の粒度は、実在のサイトが実際にやっていることと一致する。

| サイト | 単位 | 規模 |
|---|---|---|
| **Rust** エラーインデックス | **1エラーコード = 1ページ** | E0001〜 数百 |
| **Terraform** Functions | **1関数 = 1ページ** | `/language/functions/ceil` など |
| **Terraform** CLI | **1サブコマンド = 1ページ** + 「Alphabetical List of Commands」 | 約30 |
| **Typst** Library | **1構文 = 1ページ** | Foundations だけで32 |

つまり `guide/cheatsheet.md` (全構文を一枚) は、Typst でいえば Foundations の32ページを1ページに畳んだ状態にあたる。**ご指摘は業界標準そのものである。**

ただし調査した2系統の分析が、独立に**同じ条件**に到達した。

> **1ページ1要素のリファレンス層は、機械生成でなければ腐る。**
> Typst の per-construct も Terraform の per-function も Rust のエラーインデックスも、**全部ソースからの生成物**である。手書きの per-thing ページ群は、二言語なら二倍の速さで腐る。

そして koyu には**すでにコード側に台帳がある**。

| 台帳 | 場所 | 生成できるページ |
|---|---|---|
| `DIAGNOSTIC_CODES` | `src/core/diagnose.ts` | 診断コード 65 |
| `VALIDATION_RULES` + 閾値 | `src/validate/*.ts` | 判定規則 15 |
| `TOOLS` | `src/mcp.ts` | MCPツール 12 |
| サブコマンド + 使い方行 | `src/cli.ts` | CLI 14 |
| `ATTR_LEDGER` | `src/core/vocabulary.ts` | 属性表 45キー |
| `.d.ts` | `src/index.ts` | API索引 136 |
| `DERIVATION_CONSTANTS` / `TOLERANCES` | `src/core/` | 導出定数 |
| `toCanonical()` | `src/core/model.ts` | 正準JSONスキーマ |

[AGENTS.md](../../AGENTS.md) 掟7 が既に「**台帳が契約である**」と定めている。生成はその掟の機械化にすぎない。

**結論: 1ページ1要素は全面的に採る。ただし8要素を超える集合は必ずソースから生成する。**

### 5.1 原子の単位 — 「族」で止める (決定)

粒度をどこまで押すかは、**ページ内ナビゲーション (右柱の目次) が効く範囲**で決まる。目次があれば、族ページに着地した読者は一手で目的の記号に届く。したがって:

> **単位は「現在の H2 セクション一つ」。族を成すものは一枚にまとめ、記号ごとのURLはアンカーで保証する。**

| 対象 | 単位 | 枚数 |
|---|---|---|
| 診断コード 65 | **族** (BND / OPN / SEG / VRT …) | 19 |
| 判定規則 15 | **族** (daylight / access / site …) | 6 |
| MCPツール 12 | **標準ループの段** (読む / 書く / 確かめる / 問う) | 4 |
| CLIサブコマンド 14 | **1コマンド1枚** (族を成さない。旗も終了コードも個別) | 14 |
| .muro 宣言 21 | **1宣言1枚。ただし開口4語と縦動線4語は族** | 15 |
| API エクスポート 136 | **機能群** (parsing / derive / draw …) | 15 |

`OPN05` は `/reference/diagnostics/OPN#opn05` に着地し、ページ冒頭の目次に同族8コードが並ぶ。`write_layer` は `/reference/mcp/tools-write#write_layer` に着地する。**検索から記号単位で飛び込んでも、着地点が単独で完結し、かつ隣に兄弟が見えている**という状態を作る。

---

# 第三部 — 新しい情報アーキテクチャ

## 6. 読者モデル

| ペルソナ | 到達経路 | 最初の10分 | 参照様式 | 入口 |
|---|---|---|---|---|
| **建築を書く人** | koyucore.dev / README | 4行が図になるのを見て、二階建てまで通す | 最初の1時間は通読、以後は永久に検索 | `/start/` |
| **エラーを持った人** (同じ人の別状態) | `check` が赤い / コードを検索窓に貼る | `OPN05` の意味と直す行 | 中間着地、一枚読んで去る | `/reference/diagnostics/OPN05` |
| **エージェント基盤を書く人** | MCPレジストリ / AGENTS.md | 登録・標準ループ・`write_layer` の爆発半径 | コピペ → ツール単位の走査 | `/reference/mcp/` |
| **組み込む人** | npm / ビュアー実装 | 入口サブパスと凍結範囲 → `parse` して `Model` | 記号単位の中間着地 | `/reference/api/` |
| **ターミナルの人** | 使い方行 (終了コード2) / CI失敗 | 一つのサブコマンドの旗と終了コード | 中間着地、一画面 | `/reference/cli/<cmd>` |
| **評価する人** | 発表 / IFC界隈 | 5分で「本気か玩具か」 | 通読、2〜3頁で離脱 | `/why/` |

**参照様式の分布が設計を決める。**6つのうち4つが「中間着地」— navbar を経由せず、検索エンジンかターミナルから記号単位で飛び込んでくる。したがって:

- **URL が記号そのものであること** (`/reference/diagnostics/OPN05`)
- **サイト内検索があること** — 現在ゼロ。これは前提条件であってオプションではない
- 着地したページが**単独で完結**していること (1ページ1要素の本当の理由)

navbar の仕事は、**まだ何が欲しいか分かっていない読者**を捌くことに限られる。

## 7. 最上位の軸 — 決定

**決定: モード先頭 (Diataxis) + リファレンス巻の中を製品面で割る。**

```
入門 / 解説 / 手順 / リファレンス [ 記法・診断・CLI・MCP・API・形と機械形式 ]
```

理由は四つ。

1. **「どういう思想で分類しているか」への直接の答えになる。**読者が navbar を見て分類規則を言語化できる。現在は誰にもできない。
2. **Diataxis 著者自身のプロジェクト (Django) と Python と Kubernetes の一致した答え**である。
3. **生成される150ページに入門と解説が埋もれない。**面先頭にすると navbar 10項目のうち6つがリファレンスになり、`/start/` と `/why/` が1/10の面積に落ちる。
4. **製品面は消えない — リファレンスの第二階層として常時サイドバーに見えている。**Python の `Library reference` / `Language reference` と同じ。中間着地した読者は、着地点のサイドバーで自分がどの面にいるか常に分かる。

対案 (面先頭: 記法 / 診断 / CLI / MCP / API / 形) も成立し、D2・Pkl・Typst の系統である。製品構造が navbar に直接出る利点はあるが、navbar 10項目中6項目がリファレンスになり入門と解説の面積が 1/10 に落ちるため採らない。**面はリファレンスの第二階層として常時サイドバーに見えている。**

## 7.1 公開する文書と、しない文書 (決定)

**ADR と spec は公開しない。公開ページからリンクも張らない。**

| 文書 | 公開 | 理由 |
|---|---|---|
| **ADR** (`docs/decisions/` 41本) | **しない** | その時点の決定の記録であり、後から直さない。直せば記録の意味が消える。したがって時が経つほど現在の真と食い違う。**公開文書を汚染させない** |
| **spec/** (11頁 ×2言語) | **しない** | 持ち方を別途検討する |
| **`docs/log/` `docs/reviews/`** | しない | 内部の経緯 |
| 公開ドキュメント | する | **今後はこれが正である** |

**帰結 — 公開ドキュメントは自己完結していなければならない。**

これは単なるリンク削除ではない。現在の `guide/` は「規範的な事実は spec/ が所有する。guide/ がそれを述べるときは必ず spec/ の該当節へリンクする」という掟の下に書かれており、**規範を述べきらないことが正しい書き方だった**。その前提が消えるので、

- 「規範は spec/ が持つ」「食い違ったら spec/ が正しい」という**権限委譲の文はすべて無効**になる
- リンク先に依存して**意図的に不完全なまま置かれている文は、リンクを外すだけでは壊れる。書き切る必要がある**
- ADR にしか無い決定、spec にしか無い決定は、**そのままでは消える**

最後の点が最も危険で、特に **ADR-0032〜0042 (直近の core の固定)** は 2026-07-27/28 の11本が一度に入っており、spec 化の取りこぼしが起きやすい位置にある (現に ADR-0042 の取りこぼしが一件、既に見つかって直されている)。**移送の前に、決定の棚卸しを機械的に行う。**

なお **ADR 自身の矛盾は直さない。**直せばその時点の決定という性質が失われる。やるべきは、**実装の真を公開ドキュメントが自分の言葉で述べること**であって、ADR を実装に合わせることではない。

## 8. サイトマップ

```
/                                        koyu ドキュメント          [ルーター]

── 入門 /start/ (4) ─────────────────────────────────────
/start/                                  はじめての .muro — 一室から二階建てまで   【一枚。分割しない】
/start/install                           koyu を入れる
/start/first-program                     プログラムから建物を読む (20行)
/start/next                              次に読むもの (ペルソナ別)

── 解説 /why/ (18) ──────────────────────────────────────
/why/                                    koyu は何のためにあるか [+ 5分で向き不向きを決める道順]
/why/space-is-primary                    空間が一次要素である
/why/boundary-is-a-relation              壁は物ではなく二つの空間の関係である
/why/silence                             書かないことが意味を持つ — 三段の既定
/why/source-and-derived                  原本が持つもの、koyu が計算するもの
/why/paths                               パスは住所であり集計の階層である
/why/open-vocabulary                     語彙が開いている理由と、開いていない二語
/why/green-is-not-a-building             緑の check は「使える建物」を意味しない  【現在11か所に散在】
/why/two-kinds-of-green                  Diagnostic と Finding — 判定が別の面である理由
/why/three-domains                       core は凍り、validate と draw は凍らない
/why/composition-is-for-time             合成は時間と分担のためにあり、大きさのためではない
/why/form-must-be-unique                 同じ正準JSONは同じ形でなければならない
/why/plan-is-not-a-section               平面図は水平断面ではない
/why/bim-ifc-usd                         前提: BIM・IFC・IfcSpace・USD合成    【到着者の入口】
/why/vs-ifc                              koyu と IFC4・IFCX・BOT・USD (トークン実測)
/why/dsl-not-yaml                        著者形式がDSLである理由 (YAML/JSON書き比べ)  [歴史]
/why/horizon                             この先どこへ行けるか   [構想と明示]
/why/1-0                                 1.0 が意味すること、語を採るときの五つの問い

── 手順 /howto/ (20) ────────────────────────────────────
  ▸ 建物を書く
/howto/add-a-storey                      階を足す
/howto/connect-storeys                   階をつなぐ — 階段・シャフト・吹抜け
/howto/subdivide-a-unit                  住戸を室に割る
/howto/typical-floors                    基準階を一度だけ書く
/howto/windows-and-daylight              窓を開けて 1/7 採光を通す
/howto/find-unreachable                  到達できない空間を見つけて開ける
/howto/describe-a-site                   敷地と外構を書く → 建蔽率・容積率
/howto/split-into-layers                 層に割って import で合成する
/howto/survive-a-rename                  改名に耐える識別 (uid と name:)
/howto/choose-dimensions                 書く前に寸法を決める (実寸モジュール)
  ▸ ツールを動かす
/howto/install-mcp                       MCP をクライアントに登録する
/howto/agent-loop                        エージェントに書かせる標準ループ
/howto/editor                            VS Code で書く — 色と保存時 check
/howto/ci                                CI で門番にする — どの終了コードで落とすか
/howto/embed-in-a-program                プログラムに組み込む
/howto/debug-mcp                         stdio で MCP を手で叩く
  ▸ 詰まったとき
/howto/troubleshooting                   よくある詰まり
/howto/by-symptom                        症状から診断を引く   【現在二つの索引が競合】
/howto/read-diagnostics                  コードを手に入れる (--json / severity / 終了コード)
/howto/write-docs                        文書を書く (フェンス6種・ja/en 同期・生成台帳)

── リファレンス /reference/ ─────────────────────────────
/reference/                              リファレンスの読み方 — 規範と参考の別、凍る八つの面

  ▸ 記法 /reference/muro/ (28)
/reference/muro/                         .muro 全構文の索引   【生成・一画面】
/reference/muro/lines                    一行の読まれ方 (トークン・コメント・引用・字下げ)
/reference/muro/positions                位置と領域の書き方 (通り参照・オフセット・範囲)
/reference/muro/orientation              N/E/S/W と辺の選び方
/reference/muro/attributes               属性の三層と名前空間の掟 (★ の意味)
/reference/muro/defaults                 書かなかったとき何が起きるか   【既定値の唯一の表】
/reference/muro/version-line             `koyu <版>` — 受理される版
    ── 宣言ごとに一枚 (21) ──
/reference/muro/name        /reference/muro/unit       /reference/muro/grid
/reference/muro/level       /reference/muro/space      /reference/muro/zone
/reference/muro/area        /reference/muro/band       /reference/muro/boundary
/reference/muro/door        /reference/muro/window     /reference/muro/seg
/reference/muro/asset       /reference/muro/line       /reference/muro/column
/reference/muro/polygon     /reference/muro/slab       /reference/muro/stack
/reference/muro/import      /reference/muro/over-drop  /reference/muro/vertical-circulation

  ▸ 診断 /reference/diagnostics/ (29)
/reference/diagnostics/                  全メッセージ索引 — 65コード + 15規則、族と severity で絞込  【生成】
/reference/diagnostics/<族>              19枚: BND(6) OPN(8) SEG(8) VRT(6) SUF(4) UID(4) VER(4) RUN(4)
                                              LIN(3) ATT(3) SIT(3) GEO(2) HGT(2) ZON(2) COL(2)
                                              REF(1) LVL(1) DAY(1) SYN(1)   【骨格生成 + 原因・直し方は手書き移送】
/reference/diagnostics/rules/            koyu validate — Finding と level
/reference/diagnostics/rules/<族>        6枚: daylight(2) access(5) site(3) run(3) envelope(1) column(1)
/reference/diagnostics/parse-errors      パーサの17メッセージ
/reference/diagnostics/retired           欠番11件と置き換え先   【現在3か所に分散・成員が食い違う】

  ▸ CLI /reference/cli/ (16)
/reference/cli/                          koyu コマンド — entry・import解決・終了コード・--help が無いこと
/reference/cli/<cmd>                     14枚: check validate layers diff plan axo doors graph
                                              stats levels runs light site json   【旗と終了コードは生成、出力はビルド時実行】
/reference/cli/editor                    VS Code 拡張の契約

  ▸ MCP /reference/mcp/ (7)
/reference/mcp/                          koyu-mcp — 無状態・ファイル指定・標準ループ・登録の一行
/reference/mcp/protocol                  JSON-RPC の面 (initialize/ping/tools/list/tools/call/isError)  【新規】
/reference/mcp/tools-read                読む — model_summary / layers / spaces / canonical_json   【生成】
/reference/mcp/tools-write               書く — write_layer / new_uids + 安全契約 (取り消しは無い) 【新規・現在1セル】
/reference/mcp/tools-verify              確かめる — check / validate   【生成】
/reference/mcp/tools-ask                 問う — doors / light / site / plan_svg   【生成】
/reference/mcp/errors                    エラーの返り方
                                         ↑ 標準ループの4段がそのまま4枚。記号URLはアンカー
                                           (例 /reference/mcp/tools-write#write_layer)

  ▸ API /reference/api/ (17)
/reference/api/                          公開面 — 四つの入口サブパスと凍結範囲
/reference/api/exports                   全エクスポート索引 (値59 + 型77、署名つき)   【生成】
/reference/api/model                     Model とその構成型 (21型)   【生成 + 散文】
/reference/api/parsing                   parse / parseFiles / parseWith / parseFile / tokenize
/reference/api/diagnostics               checkDiagnostics / check / DIAGNOSTIC_CODES
/reference/api/validate                  validate / VALIDATION_RULES / Finding   【新規】
/reference/api/queries                   doorsBetween / neighbors / daylightInputs / siteReport / 面積
/reference/api/derive                    derive / Form / 定数・許容値
/reference/api/solids                    thicken / band / columnRect / runPrism / slabs / verticalRuns
/reference/api/draw                      svgPlan / svgAxo   【svgAxo は新規】
/reference/api/canonical                 toCanonical
/reference/api/diff                      semanticDiff / renderDiff
/reference/api/identity                  newUids
/reference/api/geometry                  polygonAreaM2 / pointInPolygon / polyBounds / rectToPoly
/reference/api/errors                    SourceError / srcRef
/reference/api/versions                  SUPPORTED_LANGUAGE_VERSIONS / DEFAULT_LANGUAGE_VERSION

  ▸ 形と機械形式 /reference/form/ /reference/json/ (9)
/reference/form/                         derive() の四つの約束と、Form が持たないもの
/reference/form/regions                  矩形から凸片へ、描かれた線による再切断
/reference/form/boundaries               境界線分の導出・方位・共線併合
/reference/form/bodies                   壁・開口・扉の振れ・柱・床・天井・屋根
/reference/form/vertical-runs            階段・斜路・エスカレーター・昇降機
/reference/form/constants                導出定数と許容値   【生成】
/reference/json/                         正準JSON — 二つの版・安定性の規則・バイトの規範
/reference/json/schema                   キーごとのリファレンス   【生成】

  ▸ 凍る面 /reference/scope/ (5)
/reference/scope                         緑の check が保証すること・しないこと   【規範の裁定者】
/reference/stability                     凍る八つの面と、二本の版
/reference/identity                      uid — 書ける場所・綴り・衝突限界
/reference/not-held                      koyu が持たないもの
/reference/composition                   合成の六規則 — 層の強度

── 実例 /examples/ (11) ─────────────────────────────────
/examples/                               同梱の建物   【規模表は生成】
/examples/<name>                         8枚: two-rooms office house mansion tower basement complex twin
/examples/by-pattern                     書きたいものから引く
/examples/vs-ifc                         koyu / IFC4 / IFCX トークン実測

── 参考 (3) ─────────────────────────────────────────────
/glossary                                用語集 — 一語一行、規範への深いリンク
/glossary/japanese-building-terms        建築・法規の用語 (建蔽率・容積率・接道・居室)
/roadmap                                 1.0 まで残っていること
```

## 9. ページ数と、それが維持できる理由

族でまとめた後の実数。

族でまとめ、ADR と spec を公開対象から外した後の実数。

| 帯 | ja | 内訳 |
|---|---|---|
| 入門 | 4 | |
| 解説 | 18 | |
| 手順 | 20 | |
| リファレンス | **109** | 記法26 / 診断29 / CLI16 / MCP7 / API17 / 形とJSON9 / 凍る面5 |
| 実例 | 11 | |
| 参考 | 3 | |
| **合計** | **165** | en も 165 (ADR が消えたので左右対称になる) |

| 区分 | ja | 内容 |
|---|---|---|
| **生成が主** | 52 | 診断29 + CLI14 + MCPツール4 + api/exports + api/model + form/constants + json/schema + 各索引 |
| **手書き散文** | **113** | ← ここだけが人の仕事 |

**手書きファイルは 32×2 = 64 → 113×2 = 226。3.5倍。**

ADR 41枚が消えて ja/en が対称になったので、`check:navigation` のロケール対等ゲートに免除が要らなくなる (実装済みの `LOCALE_EXEMPT` は空のままでよい)。

**ただし作業量の質が変わった。**以前の見積り「散文の総量はほぼ変わらない — 大半は切り分けと再配置」は、spec/ を公開する前提だった。spec/ を公開しないなら、**リファレンス109枚のうち規範的内容を持つものは「移送」ではなく「書き起こし」になる。**spec/ の11頁 (ja 1,724行) が公開ドキュメントの言葉として書き直される。加えて `guide/` 側で意図的に不完全に置かれている文 (「規範は spec/ が持つ」型) を書き切る作業が乗る。

族でまとめずに記号ごとに割ると、診断は 65、MCPツールは 12、API は 59 になり ja 249枚。**生成に回せる分は増えるが手書きは変わらない**ため、それ自体は破綻しない。族で止める理由は保守量ではなく、**着地した読者の隣に兄弟が見えていること**にある。

---

# 第四部 — 実装

## 10. 文書の根と、統治の反転

### 10.1 統治が反転する

現在の AGENTS.md はこう定めている。

> 規範的な事実は spec/ が所有する。両者が食い違ったら spec/ が正しい。

**spec/ を公開しないなら、この規則は成り立たない。**公開ドキュメントが正であり、その中の規範ページが規範を持つ。これは IA の変更ではなく**統治の変更**であり、AGENTS.md と、`guide/` の全ページに埋め込まれた権限委譲の文言に及ぶ。

`spec/` を物理的にどうするか (残して内部台帳とするか、公開ドキュメントに吸収して消すか) は**別途検討**とされている。したがって当面:

- `spec/` は**リポジトリに残す。ただし公開せず、公開ページからリンクしない**
- 規範的内容は `spec/` を**素材として**、公開ドキュメントの言葉で書き起こす
- **二重の正が一時的に存在する。**同期の仕組みは無い。これは既知の負債であり、`spec/` の持ち方が決まるまでの過渡状態である

### 10.2 公開する根は一つにする

ADR も spec も公開しない以上、公開される文書は一つの木でよい。**この木が「正」である。**URL とページ契約はどの物理ディレクトリに置くかに依存しないので、木の名前 (`guide/` を拡張するか、`docs/` に寄せるか) は着手時に決めればよい。

推奨は **`docs/` に寄せる** — 「今後は docs を正としていく」という決定の字義どおりであり、`docs/decisions/` `docs/log/` `docs/reviews/` を公開対象から除外する規則を一本足すだけで済む。`guide/` はそこへ吸収される。

## 11. website 側の変更

### `website/routes.mjs` (新規)

`{ repoPath, heading?, url, title, mode, normative, locales }` の配列。`heading` があれば見出し単位で切り出す。**切片が空なら build を落とすテストを添える**(見出し文言の変更で中身が消える事故を防ぐ)。

### `website/scripts/prepare-content.mjs`

1. **公開の根を一本にする**。`spec/` を `sourceRoots` から外す。`docs/decisions/` `docs/log/` `docs/reviews/` は公開対象外。
2. **除染ゲート** (下記 §11.1)。公開ページが ADR か `spec/` を参照していたら build 失敗。
3. **生成器8本** (第5節の台帳表のとおり)。CLI は**ビルド時にコマンドを実行して出力を貼る** (AGENTS.md 掟10 の機械化)。
4. **front matter 注入**: `mode` と `normative` を各頁に打ち、サイドバーをそこから導出する。手書きID列を廃止。
5. **孤児ゲート** ✅実装済 / **ロケール対等ゲート** ✅実装済 (`scripts/check-navigation.mjs`)。ADR が非公開になったので免除は不要。
6. **CJK 強調の修正** ✅実装済 (remark-cjk-friendly)。

### 11.1 除染ゲート (新規)

リンクを消すだけでは足りない。**権限を委譲する文そのもの**が汚染である。

| 検出するもの | 例 | 措置 |
|---|---|---|
| ADR へのリンク | `](../docs/decisions/0032-…)` | build 失敗 |
| ADR の言及 | `ADR-0032`、`(ADR-0016)` | build 失敗 |
| spec へのリンク | `](../spec/language.md)`、`spec/scope.md §8` | build 失敗 |
| 権限委譲の定型文 | `規範は spec/ が持つ`、`食い違ったら spec/ が正しい`、`詳細は ADR-…` | build 失敗 |

例外は置かない。**公開ドキュメントに「詳しくは内部文書を見よ」は存在してはならない** — それが読める読者はいないからである。

### `website/docusaurus.config.js`

- navbar を **入門 / 解説 / 手順 / リファレンス** + ロケール + npm + GitHub に置換。`Guide` `Reference` `CLI` `TypeScript API` の4項目を削除。
- **`@easyops-cn/docusaurus-search-local`** ✅実装済。**165ページは Ctrl-F では救えない。前提条件。**
- Shiki の `aliases` に `muro-fail` `muro-caution` ✅実装済。
- `onBrokenAnchors: 'throw'` ✅実装済。
- `@docusaurus/plugin-client-redirects` で旧URLを全保存。`/guide/cli/` `/guide/api/` は navbar から深リンクされていた実績があるため必須。`/spec/*` は**公開を止めるので、行き先のある頁へ個別に転送する**(消えたことにしない)。

### `AGENTS.md`

- **統治の反転を書く。**「規範は spec/ が所有し、食い違ったら spec/ が正しい」を撤回し、**公開ドキュメントが正**であることと、`spec/` の扱いが未決であることを明記する。
- **ADR と spec は公開されない**こと、**公開ページからリンクしてはならない**ことを掟に足す。
- 掟に一行追加: **「機械の出所がある台帳は生成する。手で数字を書かない。」**

## 12. 段階投入

**空の器は一つも作らない** (Diataxis の指示)。各段は単独で出荷可能。

| 段 | 内容 | 得られるもの |
|---|---|---|
| **0 ✅** | 検索プラグイン + `onBrokenAnchors:'throw'` + Shiki alias + **CJK強調バグ修正** + 死んだアンカー2件 | 実測: レンダリング後のリテラル `**` が **150 → 0** (残る6件はコードブロック内の正当な記述)。検索が入った |
| **1 ✅** | **孤児6ページをサイドバーへ + 再発防止ゲート。ファイル移動ゼロ** | 1,363行が到達可能に。`spec/scope` はリファレンス先頭。`npm run check:navigation` が孤児・ロケール欠落で build を落とす |
| **2** | **決定の棚卸し** — ADR にしか無い / spec にしか無い決定を機械的に洗い出す。特に ADR-0032〜0042 (直近の core の固定) | **これを飛ばすと決定が黙って消える。**spec 非公開の前提条件 |
| **3** | ルート表 + 生成器8本 + **除染ゲート**。**ページは動かさない** | 手書き数字7件 (51/64/65/70/48/49/59) が消える |
| **4** | navbar を4モードに。既存頁を再配分 | 分類が言語化可能になる |
| **5** | **MCP を7枚に**。`protocol` `tools-write` を新規 | オーナーの疑い (MCP仕様が無い) が解消 |
| **6** | **CLI を16枚に**。未文書の `validate` `layers` を新規 | 14中2の穴が閉じる |
| **7** | **診断 29枚に** (19族 + 6規則族 + 索引)。症状索引を一本化 | 1,564行が解体される |
| **8** | **記法 26枚に** (`cheatsheet.md` と `spec/language.md` の統合解体) | ご指摘の最悪例が解消。**spec/language.md・vocabulary.md がここに吸収される** |
| **9** | **API 17枚に**。`exports` `model` `validate` `svgAxo` を新規 | 136エクスポートに索引がつく |
| **10** | `/why/` 18枚 + `/reference/form/` `/json/` `/reference/scope` + 実例11枚 | 説明層が完成。**spec/derivation.md・canonical-json.md・scope.md・composition.md がここに吸収される** |
| **11** | **spec/ と ADR を公開から外す。除染ゲートを有効化。旧URLを転送** | 公開ドキュメントが自己完結する。**段5〜10 が終わるまでやらない** — 先にやると規範が消える |

段0〜3はファイルを一枚も動かさない。**段11 は最後**である — spec/ を先に落とすとリファレンスが空になる。

## 13. 是正はしない。ただし持ち込まない

**方針: 既存文書の是正を待たずに進める。**`docs/policy.md` と `spec/scope.md` の4つの矛盾も、ADR 同士の矛盾も、遡って直さない — **ADR はその時点の決定であり、後から直せば記録の意味が消える。**

**やることは一つだけ。書き起こす先の公開ページに、実装の真を書く。**下の一覧は「直すべき箇所」ではなく、**「その内容を公開ページへ写すときに、そのまま写してはいけない箇所」**である。写す前に `src/` かテストで確かめ、確かめた側を書く。矛盾する古い版は、内部文書に残ったまま公開されない。

| 箇所 | 誤り |
|---|---|
| `guide/concepts.md` L157-171 | レベル解決の記述が実装と不一致 (現在は error / 終了1) |
| `spec/semantics.md` L124 | 「site 面積不一致は check の警告にもなる」— 実行して偽と確認 |
| `spec/tools.md` L26 | `light` の「対象なしで終了1」— `src/cli.ts` L384 は 0 を返す |
| `guide/howto/split-into-files.md` L45 | 「レイヤー強度は無い」— ADR-0035 で覆されている |
| `docs/writing-architecture.md` L51 | 「同じ構成から複数の形が出るのは欠陥ではない」— `spec/scope.md` §6 と `test/uniqueness.test.ts` に反する |
| `guide/cheatsheet.md` | 捏造された日本語エラー文字列 5件 |
| `guide/gallery.md` twin の行 | 6項目すべて誤り (実測 1,220行 / 1,808空間 / 5,973境界 / 141,449㎡) |
| `guide/README.md` | 「診断51件」「49エクスポート」「ADR19編」「5例」の4つが陳腐化 |
| `guide/howto/*.md` | `koyu 0.4` が7箇所 (現行は `koyu 1.0`) |

**`docs/policy.md` と `spec/scope.md` の重複 (§5.2-5.7・§10・§14・§16.1) にある4つの矛盾も同じ扱いとする。**どちらを正とするかを内部文書の側で決着させる必要はない。公開ページを書くときに `src/` とテストで確かめ、確かめた方を書く。**内部の矛盾は内部に残り、公開されない。**

## 14. 正直なトレードオフ

1. **早見表の一画面性は失われる。**`/reference/muro/` を生成カード索引として復元するが、387行を Ctrl-F する体験とは違う。段0の検索導入が前提。
2. **面をまたぐ仕事に家が無い。**「エージェントに書かせて CI で検査する」は MCP と CLI と記法をまたぐ。各頁末の「関連」に面をまたぐリンクを必須とすることで緩和するが、解決ではない。
3. **同じ計算が三箇所に現れる。**`doors` は `/reference/cli/doors` と `/reference/mcp/doors` と `/reference/api/queries` に出る。面別の第二階層が課す税である。
4. **「なぜ」の最深層が公開から消える。**ADR 41本・2,284行の判断の記録は読めなくなる。`/why/` 18枚が主張と理由を公開の言葉で述べ直すが、**棄却された案とその理由は落ちる** — ADR の最も価値ある部分がそこにあることは自覚しておく。将来これを公開したくなったら、ADR を publish するのではなく `/why/` に書き足すのが筋になる。
5. **二重の正が一時的に存在する。**`spec/` は残るが公開されず、同期の仕組みも無い。`spec/` の持ち方が決まるまで、規範が二箇所にある状態が続く。**この期間が長引くほど乖離する。**
6. **`spec/scope.md` の裁定者としての役割が消える。**「食い違ったらこの一枚が正」という単純な規則は、公開ドキュメントが正になった時点で失われる。`/reference/scope` が保証の定義を持つが、文書全体の裁定者ではなくなる。
7. **生成器が新しい保守対象になる。**8本のスクリプトと、その出力が空でないことを守るテストが必要。台帳が動けば生成器も追随する必要がある。
8. **段11 まで到達しないと、この計画は中途半端に悪い。**段5〜10 で公開ドキュメントに規範を書き起こしつつ、`spec/` もまだ公開されている期間は、**同じことが二箇所に書いてある状態**になる。段11 を必ず打つ。
