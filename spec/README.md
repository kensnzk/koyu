# spec/ — koyuの仕様 (現在形)

このフォルダは**いまのkoyuがどう振る舞うか**の規範文書 (normative reference) である。経緯や理由は書かない — それは [docs/decisions/](../docs/decisions/) (ADR) と [docs/log/](../docs/log/) の仕事で、specは決定が積もった後の**結論の現在形**だけを保つ。両者が食い違ったら、実装とテストが正であり、specを直す。

## 文書の地図

| 文書 | 内容 | 読者 |
|---|---|---|
| [language.md](language.md) | **言語リファレンス** — 字句・全宣言の文法・合成 (import)・既定値・位置指定 | .muroを書く人・パーサを触る人 |
| [semantics.md](semantics.md) | **意味論リファレンス** — モデル・導出 (壁線分/垂直隣接/半屋外/高さ)・検査の一覧・問い (doors/stats/light/site) の定義 | 導出やcheckを触る人・結果を解釈する人 |
| [vocabulary.md](vocabulary.md) | **語彙の台帳** — 属性の契約 (どの語をツールが解釈するか)・開かれた語彙の開き方の規則 | 属性を足す人・全員 |
| [canonical-json.md](canonical-json.md) | **機械形式** — 正準JSONのスキーマと安定性の規則 | 外部接続・diff・合成を作る人 |
| [tools.md](tools.md) | **ツールリファレンス** — CLI・MCPサーバー・公開API | koyuを使うプログラム・エージェント |
| [notation-v0.md](notation-v0.md) | 記法の**成立記録** — v0の書き比べ (DSL/YAML/JSON) と各版の追補。歴史文書であり現在形はlanguage.mdが正 | 経緯を知りたい人 |

## 更新の作法

機能の変更は三点セットで着地する: **ADR (なぜ) + テスト (保証) + spec (現在形)**。ADRを書いてspecを更新しない変更は未完了である。specには日付や「追補」を積まない — 本文をその場で書き換え、版はgitが持つ。語彙 (解釈される属性) の追加は vocabulary.md の表に載せることが契約であり、載っていない解釈は実装してはならない (ADR-0008)。

## 対象の版

この文書群は koyu v0.10.0 の記述である。パッケージの版と乖離したら、乖離した箇所を直す。
