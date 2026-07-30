# AGENTS.md — koyu で作業するエージェントへ

koyu は建築をテキストで書く記法 (`.muro`) とその処理系である。空間が一次要素で、壁は物ではなく二つの空間の境界という関係であり、平面図・面積・動線は書かれるものではなく導出される。

この頁は**地図と掟**であって、説明の写しではない。同じ事実を二度書かない — 迷ったらここではなくリンク先を読む。

**公開ドキュメント (`docs/`) が正である。**何を約束し、何を約束しないかは [docs/reference/scope.md](docs/reference/scope.md)、凍る面は [docs/reference/stability.md](docs/reference/stability.md) にある。挙動を変えたら、その頁を同じ変更で直す。

> **正典は一つである。**かつては `spec/` (規範) と `guide/` (学ぶ本) の二冊で、「食い違ったら `spec/` が正しい」だった。2026-07-28 に統治が反転して公開ドキュメントが正となり、2026-07-30 に旧二冊を畳んで消した。**規範は `docs/` にしか無い。**

**ADR は公開しない。**リポジトリには履歴として残るが、`docs/` のどの頁からも参照してはならない — ADR はその時点の決定の記録で後から直さないため、時が経つほど現在の真と食い違うからである。`npm run gate:docs` がこれを機械で守る。掟の根拠として ADR の番号を引くこともしない (この頁も引いていない) — 引けば古い文脈が読み手に届く。

## ファイルの地図

| 場所 | 中身 | 触るときの規律 |
|---|---|---|
| `src/core/` | **凍る領域** — `parse.ts` (合成) `model.ts` `vocabulary.ts` (属性の台帳) `poly.ts` (幾何の一枚岩) `diagnose.ts` (構造整合の診断。`checkDiagnostics` は節の列で、節の粒度は**走査単位**) `graph.ts` `vertical.ts` (縦動線) `fabric.ts` (床・天井・屋根) `light.ts` `site.ts` `diff.ts` | **きれいでなければならない。**実行時依存ゼロ。挙動を変えたら公開ドキュメントとテストを同じ変更で直す |
| `src/validate/` | **凍らない領域** — 建築的な判定 (`access.ts` `envelope.ts` `light.ts` `runs.ts` `site.ts`)。`Finding { rule, level }` を返す | **汚くてよい。**増やしてよいし捨ててよい。条件は一つ — core の保証と混同されないこと |
| `src/draw/` | **凍らない領域** — `plan.ts` `axo.ts` (SVG生成)。凍結対象外 ([docs/reference/stability.md](docs/reference/stability.md)) | 見た目は自由に変えてよい。**形は変えない** |
| `src/` 直下 | `index.ts` (公開面) `cli.ts` `mcp.ts` `parse-file.ts` | `test/domains.test.ts` が依存の一方向を機械的に守る |
| `docs/` | **公開ドキュメント。これが正である。**167頁 ×2言語 (`npm run gate:docs` が数える)。`start/` (チュートリアル) `why/` (説明) `howto/` (手順) `reference/` (規範 — `muro/` `diagnostics/` `validate/` `cli/` `mcp/` `api/` `form/` `json/`) `examples/` `glossary.md` | **1ページ1仕事。**自己完結させる — ADR へ委譲しない。挙動を変えたら該当頁を同じ変更で直す |
| `docs/decisions/` | **ADR** — なぜそう決めたか、何を棄却したか。**公開しない** | 決定は追記のみ。**後から直さない** (直せば記録の意味が消える)。覆すときは新しいADRを書く |
| `docs/log/` `docs/reviews/` | 作業の記録・設計レビュー。**公開しない** | |
| `docs/policy.md` ほか loose な .md | `policy.md` `writing-architecture.md` `modules.md` `horizon.md` `ifc-coverage.md` `terminology.md`。**公開しない**素材 | |
| `examples/` | 同梱の建物 — `two-rooms` `office` `mansion` `house.muro` `house/` `tower/` `basement/` (縦動線の最小例) `complex/` (延床31,606㎡) `twin/` (延床141,449㎡の双塔再開発) `comparison/`。`steps/` は [チュートリアル](docs/start/index.md)の各段の到達点 | 触ったら `npm run check:examples` が門番 |
| `test/` | `node --test`。`domains.test.ts` (領域の分離) `composition.test.ts` (合成の六規則) `diagnostics.test.ts` (診断契約) ほか | 保証はテストで固定する。仕様の文だけでは着地していない |
| `eval/` | エージェント編集evalのハーネス (`run.ts` `score.ts` `tasks/` `fixtures/`) | |
| `editors/vscode/` | エディタ支援 ([docs/reference/cli/editor.md](docs/reference/cli/editor.md)) — `syntaxes/koyu.tmLanguage.json` が**唯一の文法** (VS Code と Shiki/Docusaurus が共有)、`extension.js` は `koyu check --json` を写すだけ | 語を足したら文法も直す。`test/grammar.test.ts` が実装・台帳との一致を縛る |

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
npx tsx src/cli.ts axo   examples/complex/main.muro -o out/axo.svg   # 立体もSVGで出る
npx tsx src/cli.ts doors examples/mansion.muro /L9/A/ldk /out
npx tsx src/cli.ts json  examples/two-rooms.muro            # 正準JSON
```

サブコマンドは `check` `validate` `layers` `diff` `plan` `axo` `doors` `graph` `stats` `levels` `runs` `light` `site` `json`。契約と実際の出力は [docs/reference/cli/](docs/reference/cli/index.md) にコマンドごと一頁ある。

専用の `--help` は無い。引数を欠いた呼び出し (`--help` を含む) が使い方を印字して**終了コード2**を返す。使い方行は `plan` の `-l/-o` と `doors` の二つのパス引数を落としているので、そこは [docs/reference/cli/plan.md](docs/reference/cli/plan.md) と [doors.md](docs/reference/cli/doors.md) を見る。

## MCPサーバー

`koyu-mcp` は依存ゼロの stdio MCP サーバーである ([docs/reference/mcp/](docs/reference/mcp/index.md))。ステートレスで、全ツールが entry の `.muro` パスを `file` で受け、毎回ゼロから合成する。原本はファイルシステムにあり、履歴は git が持つ。

ツールは12個 — `model_summary` `check` `layers` `write_layer` `new_uids` `doors` `spaces` `light` `validate` `site` `plan_svg` `canonical_json`。

標準ループはこれである。

```text
model_summary → layers → write_layer → check ──エラー──→ 直して write_layer へ戻る
                                         └───緑───→ doors / light / site で帰結を確かめる
```

`write_layer` は全置換で書き、取り消しを持たない。**書かせる前にコミットしておくこと。**登録は [docs/howto/install-mcp.md](docs/howto/install-mcp.md)、ループの実例は [agent-loop.md](docs/howto/agent-loop.md)、詰まったら [debug-mcp.md](docs/howto/debug-mcp.md)。ツールの契約は [docs/reference/mcp/](docs/reference/mcp/index.md)。

## この企ての掟

1. **check が門番である。**`npm test` と `npm run check:examples` と `npm run gate:examples` と `npm run gate:docs` と当のファイルの `check` が緑になるまで、終わったと言わない。
2. **check が緑でも建物が使えるとは限らない。**`check` が言うのは「書かれたものがデータとして矛盾していない」までである ([docs/reference/scope.md](docs/reference/scope.md))。建築的な妥当性は `koyu validate` が別に言う。接する空間の既定は壁なので ([docs/reference/muro/defaults.md](docs/reference/muro/defaults.md))、扉を一枚も宣言しない二階建ては**緑のまま完全に密封される**。緑を根拠に「動く」と主張しない。
2b. **領域を混ぜない** ([docs/why/three-domains.md](docs/why/three-domains.md))。判定を core に足さない。core は `Diagnostic { code, severity }`、検証は `Finding { rule, level }` — 型からして別である。判定を足すなら `VALIDATION_RULES` に一行と、[docs/reference/validate/](docs/reference/validate/index.md) に節を足すだけで済む。**言語の版は動かない。**
3. **変更は三点セットで着地する — ADR (なぜ) + テスト (保証) + 公開ドキュメント (現在形)。**どれかを欠いた変更は未完了である。
3b. **機械の出所がある台帳は、手で数えない。**診断コード・判定規則・サブコマンド・MCPツール・公開エクスポートの数と綴りは `test/docs-ledger.test.ts` が実装と文書を突き合わせる。「全49エクスポート」「診断51件」の類はこれで死んだ。
4. **公開ドキュメントは現在形で、その場で書き換える。**日付や「追補」や「v0.9では〜」を積まない。版は git が持つ。
5. **診断は必ずコードを持ち、severity はコードの属性である** ([docs/reference/diagnostics/index.md](docs/reference/diagnostics/index.md))。同じコードが場合によって error になったり warning になったりはしない。コードを足したら [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) の該当の族に節を足す (`test/docs-ledger.test.ts` が漏れを落とす)。
   **母集団は書かれた宣言、出所は必ず持つ、並びは走査の順** ([docs/reference/diagnostics/reading.md](docs/reference/diagnostics/reading.md))。解釈される属性 (台帳の★) の値は検査する — 書いたのに解釈されなかった値を黙って既定へ落とさない。`checkDiagnostics` を触るときは節の粒度を走査単位に保つ (コードの族で割ると並びが崩れる)。
6. **言語の意味論を変える変更は言語版を上げる** ([docs/reference/muro/version.md](docs/reference/muro/version.md))。現行は `koyu 1.0`。何が意味保存かは [docs/reference/stability.md](docs/reference/stability.md) が定める。移行は ADR に書き、examples は最新版へ揃える。
7. **語彙は台帳が契約である** ([docs/reference/scope.md](docs/reference/scope.md) の属性の三層)。実装の唯一の出所は `src/core/vocabulary.ts` の `ATTR_LEDGER` で、[docs/reference/muro/attributes.md](docs/reference/muro/attributes.md) がその写しである。**台帳に無いキーは名前空間 (`acme.sensor`) を持たなければ書けない** — 「見ていない」と「見て問題がない」を区別するための境界である。
8. **実行時依存はゼロ。**devDependencies 以外を足さない。
9. **例は最新の言語版で書く。**新しい記法を入れたら examples を追随させる — release test がこれを検査する。
10. **文書を書くなら、貼る出力は実行して得たものだけにする。**推測した出力を貼らない。

## エラーに当たったら

`check` の人間向け出力に診断コードは出ない。`--json` を付けるとコードが出る。コードから原因と直し方を引くのは [docs/reference/diagnostics/](docs/reference/diagnostics/index.md) — 全65コードが族ごとに一頁ずつあり、コード・severity・直し方を持つ。症状から引くなら [docs/howto/by-symptom.md](docs/howto/by-symptom.md)。

よく踏む罠は3つある。`grid` と `level` は使用より**前**に宣言しないと効かない (`boundary` は前方参照してよい)。空間を間取りに割るなら親は `space` ではなく `zone` にする。外部への開口は境界線分が複数になるので `edge:N/E/S/W` で辺を選ぶ (N=+Y, S=-Y, E=+X, W=-X)。詳細は [docs/howto/troubleshooting.md](docs/howto/troubleshooting.md)。

## 記法そのものを知らないとき

[docs/start/](docs/start/index.md) を通す。30〜45分で二階建て一棟と平面図まで届く。記法の形の理由は [docs/why/](docs/why/index.md)、構文の一覧は [docs/reference/muro/](docs/reference/muro/index.md) (宣言ごとに一頁、索引が全構文を一枚で持つ)。
