# 用語対訳表 — Terminology (ja ↔ en)

日本語が既定ロケールであり、英語はその訳である。**同じ概念に別の語をあてない**ための契約であって、読み物ではない。`spec/en/` と `guide/en/` を書く/直すときはこの表に従う。表に無い語を新しくあてる必要が生じたら、まずこの表に足す。

This is the translation contract for `spec/en/` and `guide/en/`. Japanese is the default locale; English is its translation. The rule is one concept, one term — never two English words for the same Japanese one. If you need a term that is not here, add it here first.

## 規則 / Rules

1. **記法のキーワードと属性名は訳さない。** `space` `boundary` `zone` `band` `w:` `edge:` などはコードであり、英文中でもコードのまま書く。
2. **コードブロックは一字も変えない。** `.muro` の中身・CLIの実行例・貼られた出力は日英で**バイト同一**である (テストが検査する)。**出力に現れる日本語 (`✔ 整合 — 空間 3 / 境界 3`、診断の本文) もそのまま**である — それが実際に出るものだからで、英文の側は直後に括弧で訳を添える。
3. **診断コード (`BND04` 等) は識別子である。** 訳さない。
4. **法規まわりの語は日本の制度語である。** `建蔽率` を coverage ratio と訳すのはよいが、それが日本の建築基準法の用語であることを一度は明記する。
5. 英語は米国綴りに寄せる (`center`, `neighbor`)。ただし建築の慣用で英国綴りが標準の語 (`storey`) はそちらに従う。

## 核の概念 / Core concepts

| 日本語 | English | 備考 / Note |
|---|---|---|
| 空間 | space | 一次要素。キーワード `space` と同語 |
| 境界 | boundary | 二つの空間の**関係**であって物ではない |
| 開口 | opening | `door` / `window` の総称 |
| 建具 | door or window (as a product) | 物としての建具。`asset` が型を持つ |
| ゾーン | zone | 数える集約。幾何を持たない |
| レベル | level | 階。`level` キーワードと同語 |
| 通り芯 | grid line | 日本の実務語。構造グリッドの芯 |
| 通り参照 | grid reference | `X2`, `X2+600` の形 |
| オフセット | offset | 通り芯からの差分 |
| 領域 | region | 空間が占める矩形 (の合併) |
| 帯 | band | キーワード `band`。寸法と並びで割る |
| 敷地形状 | site polygon | `polygon` キーワード |
| 数えない分節 | uncounted subdivision | `area` / `seg`。面積・室数・グラフに影響しない |
| 分節 | subdivision | |
| 合成 | composition | `import` による加算合成 |
| レイヤー | layer | 合成に参加する一ファイル |
| base層 | base layer | 基盤 (koyu/name/unit/grid/level) を宣言する層 |
| スパン展開 | span expansion | `/L3..L10/…` が各階へ展開されること |
| 既定境界 | default boundary | 未宣言の接触から導出される壁 (ADR-0014) |
| パス | path | `/L5/A/ldk`。アドレスであり集計の階層 |

## 導出と検査 / Derivation and checking

| 日本語 | English | 備考 / Note |
|---|---|---|
| 原本 | the authored source | 人とLLMが書くもの。「原稿」も同じ |
| 導出 | derivation / derived | 書かれたものから計算されるもの |
| 生成物 | generated artifact | 図・正準JSONなど |
| 展開 | expansion | スパン・帯・stack が空間になること |
| 検査 | check | コマンド名と同語。動詞は "to check" |
| 門番 | gate | `check` は「ビルドの門番」= the build gate |
| 診断 | diagnostic | `checkDiagnostics` の返す一件 |
| 重大度 | severity | `error` / `warning`。コードの不変属性 |
| 台帳 | ledger | `DIAGNOSTIC_CODES` と語彙表 |
| 出所 | provenance | `ファイル:行` |
| 壁芯 | wall centerline | 面積算定の基準 |
| 共有辺 | shared edge | 二つの矩形が重なる区間 |
| 壁線分 | wall segment | 導出される線分 |
| 半屋外 | semi-outdoor | 宣言ではなく導出される性質 |
| 庇下 | covered above | 上に空間が重なっているか |
| 通行可能性 | passability | 空間グラフの辺 |
| 矩計 | section stack-up | `levels` が出すテキストの断面 |
| 高さの不変量 | height invariant | 天井高 + 上階slab ≤ 階高 |
| 正準JSON | canonical JSON | バイト安定な機械形式 |
| 意味保存 | meaning-preserving | 導出物が不変であること |
| 床規則 | floor rule | 帯の内側の切り位置の綴り方 |
| 閉じた帯 | closed band | `w:rest` を使わず合計を照合する帯 |

## 建築と法規 / Architecture and regulation

| 日本語 | English | 備考 / Note |
|---|---|---|
| 階高 | floor-to-floor height | |
| 天井高 | ceiling height | `h:` |
| 床組み厚 | slab thickness | `slab:` |
| 吹抜け | void | `type:void`。二層のものは double-height void |
| 基準階 | typical floor | |
| 例外階 | exception floor | 基準階からの差分を持つ階 |
| 住戸 | dwelling unit | |
| 専有面積 | net floor area (exclusive) | `use:exclusive` の集計 |
| 共用部 | common area | `use:common` |
| 延床面積 | gross floor area (GFA) | |
| 建築面積 | building footprint area | |
| 建蔽率 | building coverage ratio | 日本の建築基準法の語 |
| 容積率 | floor area ratio (FAR) | 同上 |
| 接道 | road frontage | 敷地が道路に接する長さ |
| 採光 | daylighting | 1/7 判定は日本の建築基準法由来 |
| 居室 | habitable room | 法規上の区分 |
| 避難 | means of egress | `doors` の問い |
| 防火区画 | fire compartment | |
| 戸境 | party wall | 住戸間の壁 |
| 内廊下 | interior corridor | |
| 手すり | railing | `spec:手すり` + `air:1` |
| 隔て板 | balcony partition | |
| 腰窓 | sill window | |
| 掃き出し窓 | full-height window | |
| 雁行 | staggered plan | |
| 隅切り | corner cut | |
| 斜路 | ramp | |
| 木割 | proportional rules (kiwari) | 『匠明』(1608〜) の比例規則 |

## 文書の種別 / Document kinds

| 日本語 | English | 備考 / Note |
|---|---|---|
| 規範リファレンス | normative reference | `spec/` |
| 学ぶ本 | the guide | `guide/` |
| チュートリアル | tutorial | 一本道。選択肢を出さない |
| 手順書 | how-to guide | 目的から引く |
| 説明 | explanation | 理解のための文書 |
| 早見表 | cheat sheet | |
| 実例集 | gallery | |
| 用語集 | glossary | |
| 決定記録 | ADR (architecture decision record) | `docs/decisions/` |
| 現在形 | present tense | spec の書き方。経緯を書かない |
| 三点セット | the three-part landing | ADR + test + spec |
