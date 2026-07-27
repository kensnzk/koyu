# AGENTS.md — koyu で作業するエージェントへ

koyu は建築をテキストで書く記法 (`.muro`) とその処理系である。空間が一次要素で、壁は物ではなく二つの空間の境界という関係であり、平面図・面積・動線は書かれるものではなく導出される。

この頁は**地図と掟**であって、説明の写しではない。人間の入口は [README.md](README.md)、学ぶ本は [guide/](guide/README.md)、規範は [spec/](spec/README.md) にある。同じ事実を二度書かない — 迷ったらここではなくリンク先を読む。

**最初に [spec/scope.md](spec/scope.md) を読むこと。**何を約束し、何を約束しないか — 三つの領域・保証の範囲・凍る八つの面が、そこにある。spec の別の頁とそこが食い違ったら、scope.md が正である。目的と範囲の規範は [docs/policy.md](docs/policy.md)。

## ファイルの地図

| 場所 | 中身 | 触るときの規律 |
|---|---|---|
| `src/core/` | **凍る領域** — `parse.ts` (合成) `model.ts` `vocabulary.ts` (属性の台帳) `poly.ts` (幾何の一枚岩) `diagnose.ts` (構造整合の診断。`checkDiagnostics` は節の列で、節の粒度は**走査単位**) `graph.ts` `vertical.ts` (縦動線) `fabric.ts` (床・天井・屋根) `light.ts` `site.ts` `diff.ts` | **きれいでなければならない。**実行時依存ゼロ。挙動を変えたら spec とテストを同じ変更で直す |
| `src/validate/` | **凍らない領域** — 建築的な判定 (`access.ts` `envelope.ts` `light.ts` `runs.ts` `site.ts`)。`Finding { rule, level }` を返す | **汚くてよい。**増やしてよいし捨ててよい。条件は一つ — core の保証と混同されないこと |
| `src/draw/` | **凍らない領域** — `plan.ts` `axo.ts` (SVG生成)。凍結対象外 ([spec/scope.md §8](spec/scope.md)) | 見た目は自由に変えてよい。**形は変えない** |
| `src/` 直下 | `index.ts` (公開面) `cli.ts` `mcp.ts` `parse-file.ts` | `test/domains.test.ts` が依存の一方向を機械的に守る |
| `spec/` | **規範リファレンス** (現在形) — 文法・意味論・語彙台帳・正準JSON・ツール契約 | 追補を積まない。本文をその場で書き換える |
| `guide/` | **学ぶ本** — チュートリアル・概念・how-to・診断事典・CLI/API | 規範を書かない。spec へリンクする |
| `docs/decisions/` | **ADR** — なぜそう決めたか、何を棄却したか | 決定は追記のみ。覆すときは新しいADRを書く |
| `docs/` | `policy.md` (**目的と範囲の規範**)・`roadmap.md` (1.0 の残り作業)・`writing-architecture.md` (主張の本文)・`modules.md` (寸法モジュールの台帳)・`horizon.md`・`ifc-coverage.md`・`log/`・`reviews/` | |
| `examples/` | 同梱の建物 — `two-rooms` `office` `mansion` `house.muro` `house/` `tower/` `basement/` (縦動線の最小例) `complex/` (延床31,606㎡) `twin/` (延床141,449㎡の双塔再開発) `comparison/`。`steps/` は guide/start.md の各段の到達点 | 触ったら `npm run check:examples` が門番 |
| `test/` | `node --test`。`domains.test.ts` (領域の分離) `composition.test.ts` (合成の六規則) `diagnostics.test.ts` (診断契約) ほか | 保証はテストで固定する。仕様の文だけでは着地していない |
| `eval/` | エージェント編集evalのハーネス (`run.ts` `score.ts` `tasks/` `fixtures/`) | |
| `editors/vscode/` | エディタ支援 ([ADR-0031](docs/decisions/0031-editor-support.md)) — `syntaxes/koyu.tmLanguage.json` が**唯一の文法** (VS Code と Shiki/Docusaurus が共有)、`extension.js` は `koyu check --json` を写すだけ | 語を足したら文法も直す。`test/grammar.test.ts` が実装・台帳との一致を縛る |

## コマンド

```sh
npm test                    # 全テスト (node --test、tsxで直接実行)
npm run typecheck           # tsc --noEmit
npm run check:examples      # 同梱例が全て check を通るか — 記法を変えたらここが落ちる
npm run build               # dist/ を吐く

npx tsx src/cli.ts check    examples/two-rooms.muro         # 構造整合の門番 (建築的な妥当性は言わない)
npx tsx src/cli.ts validate examples/tower/main.muro        # 建築的な判定 (checkの保証ではない)
npx tsx src/cli.ts layers   examples/house/main.muro --attrs # 層の強度順序と、属性ごとの出所
npx tsx src/cli.ts check bad.muro --json                    # 診断コードつき (人向け出力にコードは出ない)
npx tsx src/cli.ts check bad.muro --strict                  # 警告も終了コード1
npx tsx src/cli.ts plan  examples/office.muro -l L2 -o out/office-L2.svg
npx tsx src/cli.ts axo   examples/complex/main.muro -o out/axo.svg   # 立体もSVGで出る (ADR-0026)
npx tsx src/cli.ts doors examples/mansion.muro /L9/A/ldk /out
npx tsx src/cli.ts json  examples/two-rooms.muro            # 正準JSON
```

サブコマンドは `check` `validate` `layers` `diff` `plan` `axo` `doors` `graph` `stats` `levels` `runs` `light` `site` `json`。実際の出力つきの解説は [guide/cli.md](guide/cli.md)、契約は [spec/tools.md](spec/tools.md)。

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

1. **check が門番である。**`npm test` と `npm run check:examples` と `npm run gate:examples` と当のファイルの `check` が緑になるまで、終わったと言わない。
2. **check が緑でも建物が使えるとは限らない。**`check` が言うのは「書かれたものがデータとして矛盾していない」までである ([spec/scope.md §3](spec/scope.md))。建築的な妥当性は `koyu validate` が別に言う。接する空間の既定は壁なので ([ADR-0014](docs/decisions/0014-default-boundaries.md))、扉を一枚も宣言しない二階建ては**緑のまま完全に密封される**。緑を根拠に「動く」と主張しない。
2b. **領域を混ぜない** ([ADR-0032](docs/decisions/0032-three-domains.md))。判定を core に足さない。core は `Diagnostic { code, severity }`、検証は `Finding { rule, level }` — 型からして別である。判定を足すなら `VALIDATION_RULES` に一行と、spec/validation.md と guide/validation.md に節を足すだけで済む。**言語の版は動かない。**
3. **変更は三点セットで着地する — ADR (なぜ) + テスト (保証) + spec (現在形)。**どれかを欠いた変更は未完了である。
4. **spec は現在形で、その場で書き換える。**日付や「追補」や「v0.9では〜」を積まない。版は git が持つ。
5. **診断は必ずコードを持ち、severity はコードの属性である** ([ADR-0016](docs/decisions/0016-diagnostic-contract.md))。同じコードが場合によって error になったり warning になったりはしない。コードを足したら [spec/semantics.md](spec/semantics.md) の台帳と [guide/diagnostics.md](guide/diagnostics.md) の両方に載せる。
   **母集団は書かれた宣言、出所は必ず持つ、並びは走査の順** ([ADR-0028](docs/decisions/0028-diagnostics-per-declaration.md))。解釈される属性 (台帳の★) の値は検査する — 書いたのに解釈されなかった値を黙って既定へ落とさない。`checkDiagnostics` を触るときは節の粒度を走査単位に保つ (コードの族で割ると並びが崩れる)。
6. **言語の意味論を変える変更は言語版を上げる** ([ADR-0017](docs/decisions/0017-language-versioning.md))。現行は `koyu 1.0` ([ADR-0038](docs/decisions/0038-version-1-0-rc.md))。移行はADRに書き、examples は最新版へ揃える。
7. **語彙は台帳が契約である** ([ADR-0008](docs/decisions/0008-vocabulary-and-level-attr.md) / [ADR-0033](docs/decisions/0033-attribute-tiers.md))。実装の唯一の出所は `src/core/vocabulary.ts` の `ATTR_LEDGER` で、[spec/vocabulary.md](spec/vocabulary.md) はその写しである。**台帳に無いキーは名前空間 (`acme.sensor`) を持たなければ書けない** — 「見ていない」と「見て問題がない」を区別するための境界である。
8. **実行時依存はゼロ。**devDependencies 以外を足さない。
9. **例は最新の言語版で書く。**新しい記法を入れたら examples を追随させる — release test がこれを検査する。
10. **文書を書くなら、貼る出力は実行して得たものだけにする。**推測した出力を貼らない。

## エラーに当たったら

`check` の人間向け出力に診断コードは出ない。`--json` を付けるとコードが出る。コードから原因と直し方を引く表は [guide/diagnostics.md](guide/diagnostics.md) (全64コード)。規範の台帳 (コード・severity・概要) は [spec/semantics.md](spec/semantics.md)。

よく踏む罠は3つある。`grid` と `level` は使用より**前**に宣言しないと効かない (`boundary` は前方参照してよい)。空間を間取りに割るなら親は `space` ではなく `zone` にする。外部への開口は境界線分が複数になるので `edge:N/E/S/W` で辺を選ぶ (N=+Y, S=-Y, E=+X, W=-X)。詳細は [guide/howto/troubleshooting.md](guide/howto/troubleshooting.md)。

## 記法そのものを知らないとき

[guide/start.md](guide/start.md) を通す。30〜45分で二階建て一棟と平面図まで届く。記法の形の理由は [guide/concepts.md](guide/concepts.md)、構文の一覧は [guide/cheatsheet.md](guide/cheatsheet.md)。
