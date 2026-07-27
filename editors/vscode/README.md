# koyu — VS Code 拡張

`.muro` (建築をテキストで書く記法 [koyu](https://github.com/kensnzk/koyu)) に色を付け、保存のたびに `koyu check` を走らせて診断を問題パネルに出す。

- **色** — `syntaxes/koyu.tmLanguage.json`。Shiki (Docusaurus) と共有する唯一の文法である。
- **赤** — `koyu check --json` を呼んで写すだけ。この拡張はパーサも規則も持たない ([ADR-0031](../../docs/decisions/0031-editor-support.md))。

台帳の★ (ツールが解釈する属性 — [spec/vocabulary.md](../../spec/vocabulary.md)) と自由な `k:v` は色が分かれる。

## 入れる

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/koyu
```

ビルドは無い。VS Code を再起動すれば効く。手順の全体と設定は [guide/howto/editor.md](../../guide/howto/editor.md)。

## 設定

| 設定 | 既定 | 意味 |
|---|---|---|
| `koyu.check.enabled` | `true` | 保存時と開いたときに check を走らせる |
| `koyu.cliPath` | `""` | CLI の場所。空なら `node_modules/.bin/koyu` → `dist/cli.js` → PATH の順に探す |
| `koyu.entry` | `""` | 合成の起点。空なら同じディレクトリの `main.muro`、無ければ開いているファイル自身 |

## 直すとき

語の一覧は文法と実装の二箇所にあり、`test/grammar.test.ts` が一致を縛っている。行頭の語を足したら `src/parse.ts` と文法の両方を直す — 片方だけでは `npm test` が落ちる。
