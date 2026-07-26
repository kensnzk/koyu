# AGENTS.md — koyu で作業するエージェントへ

koyu は建築をテキストで書く記法 (`.muro`) とその処理系である。空間が一次要素で、壁は物ではなく二つの空間の境界という関係であり、平面図・面積・動線は書かれるものではなく導出される。

この頁は**地図と掟**であって、説明の写しではない。人間の入口は [README.md](README.md)、学ぶ本は [guide/](guide/README.md)、規範は [spec/](spec/README.md) にある。同じ事実を二度書かない — 迷ったらここではなくリンク先を読む。

## ファイルの地図

| 場所 | 中身 | 触るときの規律 |
|---|---|---|
| `src/` | 実装 約4,500行 — `parse.ts` `parse-file.ts` (合成) `model.ts` `check.ts` `graph.ts` `light.ts` `site.ts` `plan.ts` `diff.ts` `cli.ts` `mcp.ts` `index.ts` | 実行時依存ゼロ。挙動を変えたら spec とテストを同じ変更で直す |
| `spec/` | **規範リファレンス** (現在形) — 文法・意味論・語彙台帳・正準JSON・ツール契約 | 追補を積まない。本文をその場で書き換える |
| `guide/` | **学ぶ本** — チュートリアル・概念・how-to・診断事典・CLI/API | 規範を書かない。spec へリンクする |
| `docs/decisions/` | **ADR** — なぜそう決めたか、何を棄却したか (0001〜0019) | 決定は追記のみ。覆すときは新しいADRを書く |
| `docs/` | `writing-architecture.md` (主張の本文)・`roadmap.md`・`horizon.md`・`ifc-coverage.md`・`log/`・`reviews/` | |
| `examples/` | 同梱の建物 — `two-rooms` `office` `mansion` `house.muro` `house/` `tower/` `comparison/`。`steps/` は guide/start.md の各段の到達点 | 触ったら `npm run check:examples` が門番 |
| `test/` | `node --test` の19ファイル。196件が緑 | 保証はテストで固定する。仕様の文だけでは着地していない |
| `eval/` | エージェント編集evalのハーネス (`run.ts` `score.ts` `tasks/` `fixtures/`) | |

## コマンド

```sh
npm test                    # 全テスト (node --test、tsxで直接実行)
npm run typecheck           # tsc --noEmit
npm run check:examples      # 同梱例が全て check を通るか — 記法を変えたらここが落ちる
npm run build               # dist/ を吐く

npx tsx src/cli.ts check examples/two-rooms.muro            # 整合の門番
npx tsx src/cli.ts check bad.muro --json                    # 診断コードつき (人向け出力にコードは出ない)
npx tsx src/cli.ts check bad.muro --strict                  # 警告も終了コード1
npx tsx src/cli.ts plan  examples/office.muro -l L2 -o out/office-L2.svg
npx tsx src/cli.ts doors examples/mansion.muro /L9/A/ldk /out
npx tsx src/cli.ts json  examples/two-rooms.muro            # 正準JSON
```

サブコマンドは `check` `diff` `plan` `doors` `graph` `stats` `levels` `light` `site` `json`。実際の出力つきの解説は [guide/cli.md](guide/cli.md)、契約は [spec/tools.md](spec/tools.md)。

専用の `--help` は無い。引数を欠いた呼び出し (`--help` を含む) が使い方を印字して**終了コード2**を返す。使い方行は `plan` の `-l/-o` と `doors` の二つのパス引数を落としているので、そこは [guide/cli.md](guide/cli.md) を見る。

## MCPサーバー

`koyu-mcp` は依存ゼロの stdio MCP サーバー ([ADR-0012](docs/decisions/0012-mcp-server.md))。ステートレスで、全ツールが entry の `.muro` パスを `file` で受け、毎回ゼロから合成する。原本はファイルシステムにあり、履歴は git が持つ。

ツールは10個 — `model_summary` `check` `layers` `write_layer` `doors` `spaces` `light` `site` `plan_svg` `canonical_json`。

標準ループはこれである。

```text
model_summary → layers → write_layer → check ──エラー──→ 直して write_layer へ戻る
                                         └───緑───→ doors / light / site で帰結を確かめる
```

`write_layer` は全置換で書き、取り消しを持たない。**書かせる前にコミットしておくこと。**登録と実例は [guide/howto/agent-mcp.md](guide/howto/agent-mcp.md)。

## この企ての掟

1. **check が門番である。**`npm test` と `npm run check:examples` と当のファイルの `check` が緑になるまで、終わったと言わない。
2. **check が緑でも建物が使えるとは限らない。**接する空間の既定は壁なので ([ADR-0014](docs/decisions/0014-default-boundaries.md))、扉を一枚も宣言しない二階建ては**緑のまま完全に密封される**。外皮も自動では生えない — `/out` への境界は書かなければ無い。動線は `doors`、採光は `light` が別に答える。緑を根拠に「動く」と主張しない。
3. **変更は三点セットで着地する — ADR (なぜ) + テスト (保証) + spec (現在形)。**どれかを欠いた変更は未完了である。
4. **spec は現在形で、その場で書き換える。**日付や「追補」や「v0.9では〜」を積まない。版は git が持つ。
5. **診断は必ずコードを持ち、severity はコードの属性である** ([ADR-0016](docs/decisions/0016-diagnostic-contract.md))。同じコードが場合によって error になったり warning になったりはしない。コードを足したら [spec/semantics.md](spec/semantics.md) の台帳と [guide/diagnostics.md](guide/diagnostics.md) の両方に載せる。
6. **言語の意味論を変える変更は言語版を上げる** ([ADR-0017](docs/decisions/0017-language-versioning.md))。現行は `koyu 0.3`。移行はADRに書き、examples は最新版へ揃える。
7. **語彙は台帳が契約である** ([ADR-0008](docs/decisions/0008-vocabulary-and-level-attr.md))。[spec/vocabulary.md](spec/vocabulary.md) に載っていない属性を実装が解釈してはならない。
8. **実行時依存はゼロ。**devDependencies 以外を足さない。
9. **例は最新の言語版で書く。**新しい記法を入れたら examples を追随させる — release test がこれを検査する。
10. **文書を書くなら、貼る出力は実行して得たものだけにする。**推測した出力を貼らない。

## エラーに当たったら

`check` の人間向け出力に診断コードは出ない。`--json` を付けるとコードが出る。コードから原因と直し方を引く表は [guide/diagnostics.md](guide/diagnostics.md) (全49コード)。規範の台帳 (コード・severity・概要) は [spec/semantics.md](spec/semantics.md)。

よく踏む罠は3つある。`grid` と `level` は使用より**前**に宣言しないと効かない (`boundary` は前方参照してよい)。空間を間取りに割るなら親は `space` ではなく `zone` にする。外部への開口は境界線分が複数になるので `edge:N/E/S/W` で辺を選ぶ (N=+Y, S=-Y, E=+X, W=-X)。詳細は [guide/howto/troubleshooting.md](guide/howto/troubleshooting.md)。

## 記法そのものを知らないとき

[guide/start.md](guide/start.md) を通す。30〜45分で二階建て一棟と平面図まで届く。記法の形の理由は [guide/concepts.md](guide/concepts.md)、構文の一覧は [guide/cheatsheet.md](guide/cheatsheet.md)。
