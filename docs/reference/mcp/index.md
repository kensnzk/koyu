---
title: koyu-mcp
mode: reference
---

# koyu-mcp

`koyu-mcp` は koyu に同梱された MCP サーバーである。LLM エージェントに建物を読ませ、書かせ、確かめさせるための面で、[`koyu` コマンド](../cli/index.md)と同じ導出を、同じ答えのまま JSON で返す。

## 何であるか

| | |
|---|---|
| 実行ファイル | `koyu-mcp` — `@kensnzk/koyu` を入れると `koyu` と並んで入る |
| transport | stdio。標準入力から行区切り JSON を読み、標準出力へ行区切り JSON を書く |
| プロトコル | JSON-RPC 2.0 — 手書きである。MCP の SDK は使っていない |
| 実行時依存 | ゼロ |
| 環境変数・認証・ネットワーク | 無し |
| 動作環境 | Node 22 以上 |
| ツール | 12 個 |

`serverInfo` が名乗る版は実装の版 (`0.16.0`) であって、記法の版 (`koyu 1.0`) ではない。二本の版は別々に動く。

## 無状態である

**12 のツールはすべて `file` を必須引数に取る。**`file` は entry の `.muro` のパスで、`import` で層に割られた建物なら base 層のファイルを渡す。

一回の呼び出しはこうなる — パスを解決し、entry を読み、`import` を辿り、合成し、問いに答え、忘れる。**セッションも、開いている文書も、キャッシュも、取り消し履歴も無い。**同じ引数で二度呼べば二度合成される。

だから、サーバーがディスクの持っていない建物の版を握っていることは起こらない。**原本はファイルシステムにあり、履歴は git が持つ。**

合成をやり直す代価は小さい。同梱の 9 層の高層例は 6 ミリ秒前後、最大の同梱例 (11 層・1,808 空間・延床 141,448.56 ㎡) でも 100 ミリ秒を切る。

## 登録する

```sh
claude mcp add koyu -- npx -p @kensnzk/koyu koyu-mcp
```

クライアント別の手順と、開発版 (`node /path/to/koyu/dist/mcp.js`) の登録は[クライアントに登録する](install.md)にある。

**entry は絶対パスで渡す。**相対パスは**サーバープロセスのカレントディレクトリ**を基準に解決される。クライアントがどのディレクトリでサーバーを起動するかはクライアント次第なので、外すと `Cannot read file:` が返る。

## 標準ループ

エージェントの作業は git のそれと同型にする。

```text
model_summary  →  layers  →  write_layer  →  check ──エラー──→ 直して write_layer へ戻る
                                               │
                                               └──緑──→ doors / light / site で帰結を確かめる
```

1. **[`model_summary`](tools-read.md#model_summary) で建物を掴む。**レイヤー構成・レベル・ゾーン・アセット・面積・`check` の件数が一度に返るので、次にどのファイルを読めばよいかが決まる。
2. **[`layers`](tools-read.md#layers) で原本を読む。**合成に参加した層の全文が返る。
3. **[`write_layer`](tools-write.md#write_layer) で書く。**差分ではなく全置換である。返りには書いた直後の `check` の結果が載るので、編集と検証が一往復で済む。
4. **[`check`](tools-verify.md#check) が門番になる。**エラーが返ったら直して再度書く。
5. **[`doors`](tools-ask.md#doors) / [`light`](tools-ask.md#light) / [`site`](tools-ask.md#site) で帰結を確かめる。**間仕切りを動かせば動線と採光が、面積が変われば建蔽率が変わる。`check` はそれを見ていない。

## 12 のツール

| ツール | 引数 | 何を返すか |
|---|---|---|
| [`model_summary`](tools-read.md#model_summary) | `file` | 名前・単位・層・レベル・ゾーン・アセット・面積・`check` の件数 |
| [`layers`](tools-read.md#layers) | `file` | 合成に参加した全レイヤーの `{file, source}` |
| [`spaces`](tools-read.md#spaces) | `file`, `level`? | 空間一覧 — パス・型・名前・レベル・面積・半屋外・出所層 |
| [`canonical_json`](tools-read.md#canonical_json) | `file` | 正準 JSON (合成後の単一モデル) |
| [`write_layer`](tools-write.md#write_layer) | `file`, `layer`, `content` | レイヤーを全置換で書く。返りは `written` と直後の `check` |
| [`new_uids`](tools-write.md#new_uids) | `file`, `count`? | 新しい永続同一性トークン |
| [`check`](tools-verify.md#check) | `file` | 構造整合 — `ok`・`errors`/`warnings`・`diagnostics` |
| [`validate`](tools-verify.md#validate) | `file` | 建築的な判定 — `findings`・`violations`・`cautions` |
| [`doors`](tools-ask.md#doors) | `file`, `from`, `to` | 最少扉数の経路、到達不能なら `{unreachable: true}` |
| [`light`](tools-ask.md#light) | `file` | `daylight:1` を書いた空間の床面積と有効窓面積 |
| [`site`](tools-ask.md#site) | `file` | 敷地面積・接道・建蔽率・容積率 |
| [`plan_svg`](tools-ask.md#plan_svg) | `file`, `level` | 指定レベルの平面図 SVG 文字列 |

`?` は省略可能な引数である。JSON-RPC の面 — `initialize` が名乗るもの、`tools/call` の返りの形、エラーの返り方 — は[プロトコル](protocol.md)にある。

## 二つの緑を混同しない

`check` が緑であることと、建物として使えることは別である。接する空間の既定は壁なので、扉を一枚も宣言しない二階建ては `check` が緑のまま完全に密封される。`check` が言うのは「書かれたものがデータとして矛盾していない」までで、建築的な妥当性は `validate` が別に言う。

型からして別である。`check` の `diagnostics` は `{code, severity}`、`validate` の `findings` は `{rule, level}` で、綴りも違えば連結もできない。**緑を根拠に「動く」と主張しない。**

## 書かせる前にコミットする

`write_layer` は全置換で書き、**取り消しを持たない。**サーバーは版を一つも保存しない。分岐もレビューも巻き戻しも git の仕事である。

エージェントに書かせる作業を始める前に、`.muro` を git にコミットしておく。爆発半径の全部は[書く — write_layer / new_uids](tools-write.md)にある。

## 関連

- [クライアントに登録する](install.md) — Claude Code・`.mcp.json`・Desktop・一般の MCP クライアント
- [プロトコル](protocol.md) — JSON-RPC の面とエラーの返り方
- [読む](tools-read.md) — `model_summary` / `layers` / `spaces` / `canonical_json`
- [書く](tools-write.md) — `write_layer` / `new_uids` と安全契約
- [確かめる](tools-verify.md) — `check` / `validate`
- [問う](tools-ask.md) — `doors` / `light` / `site` / `plan_svg`
- [koyu コマンド](../cli/index.md) — 人の手で同じ導出を呼ぶ
- [.muro リファレンス](../muro/index.md) — エージェントに書かせる記法
