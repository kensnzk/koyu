[English](../en/howto/editor.md) · **日本語**

# エディタで書く — 色と、保存のたびの check

`.muro` に色を付け、保存のたびに `koyu check` を走らせて、赤を問題パネルに出す。同じ文法をドキュメント (Docusaurus) にも使う。

文法は一枚しかない — `editors/vscode/syntaxes/koyu.tmLanguage.json` である。VS Code はこれをそのまま読み、Shiki (Docusaurus) も同じ一枚を読む ([ADR-0031](../../docs/decisions/0031-editor-support.md))。

拡張自体は整合を判定しない。`koyu check --json` を呼んで、返ってきた診断を写すだけである。**門番は一つ**で、CLI もエージェント (MCP) もエディタも同じ答えを見る。

## 前提

- VS Code (1.75 以降)。Cursor など派生エディタでも、拡張の置き場所が変わるだけで同じ。
- 色だけなら他に何も要らない。**赤を出すには `koyu` CLI が要る** — npm で入れるか、リポジトリで `npm run build` を済ませておく。

## 手順

### 1. 拡張を手元に置く

拡張フォルダを VS Code の拡張置き場へリンクする。ビルドは無い (素の JavaScript と JSON である)。

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/koyu
```

VS Code を再起動する。`.muro` を開けば色が付く。

配る場合は `.vsix` に固めてもよい。`code` コマンドが PATH に無ければ、VS Code の拡張パネルの「…」→「VSIX からのインストール」から入れる。

```sh
npx --yes @vscode/vsce package     # editors/vscode で実行 → koyu-0.1.0.vsix
```

### 2. CLI を見つけさせる

拡張は次の順に `koyu` を探す。**ふつうは設定しなくてよい。**

1. 設定 `koyu.cliPath` (空でなければそれ)
2. 開いているファイルから上へ辿って `node_modules/.bin/koyu`
3. 同じく上へ辿って `dist/cli.js` (koyu リポジトリ自身で作業しているとき — 先に `npm run build`)
4. PATH の `koyu`

見つからなければ一度だけ警告が出て、色だけになる。

### 3. 保存して、赤を見る

`.muro` を保存すると check が走る。エラーと警告が問題パネルに出て、診断コード (`SYN01` などの [68コード](../diagnostics.md)) がそのまま表示される。手で走らせたいときはコマンドパレットの **koyu: 整合を確かめる (check)**。

CLI で同じ答えを見るとこうなる。

```sh
koyu check examples/two-rooms.muro
```

```text
✔ 整合 — 空間 3 / 境界 3
```

### 4. 複数ファイルの建物

`import` で割った建物 ([split-into-files.md](split-into-files.md)) では、層を単体で検査しても意味がない — その層には `grid` も `level` も無いので、赤で埋まる。

拡張は**同じディレクトリに `main.muro` があればそれを起点に合成し**、返ってきた診断を出所ごとに配り直す。`examples/twin/office.muro` を開いて保存すれば、`examples/twin/main.muro` から一棟を合成した上で、office.muro の行にだけ赤が出る。

起点が別の場所にあるなら設定で名指しする。

```json
{
  "koyu.entry": "examples/twin/main.muro"
}
```

## 設定

| 設定 | 既定 | 意味 |
|---|---|---|
| `koyu.check.enabled` | `true` | 保存時と開いたときに check を走らせる |
| `koyu.cliPath` | `""` | CLI の場所。空なら自動で探す (手順2) |
| `koyu.entry` | `""` | 合成の起点。空なら同じディレクトリの `main.muro`、無ければ開いているファイル自身 |

## 色の読み方

色の割り当ては記法の構造をなぞっている。

| 見えるもの | 何 |
|---|---|
| `space` `boundary` `band` … | 行頭に書く語 |
| `door` `window` `seg` `line` `area` | 字下げして書く語 |
| `/L1/a` `/out` `/L2..L9/A` | 空間・ゾーンのパス (同一性) |
| `X2+600` `Y1..Y2` `L14..L19` | 通り芯とレベルの参照 |
| `room` `shop` `exterior` | 空間の型 (開かれた語彙) |
| `daylight:` `t:` `edge:` | **台帳の★** — ツールが解釈する属性 |
| `spec:` `fire:` `name:` | 自由な `k:v` — 運ばれるが解釈されない |

最後の二行が分かれているのが要点である。[spec/vocabulary.md](../../spec/vocabulary.md) の★だけが契約であり、それ以外は書いても何も起きない。`daylight:1` と `dayligth:1` の違いが、書いている最中に色で見える。

ただし**テーマによっては★と自由な語が同じ色になる** (VS Code 既定の Dark+ がそう)。色が分かれるのは GitHub Dark / GitHub Light / One Dark Pro / Monokai / Nord など。

## Docusaurus で同じ色を出す

Docusaurus v3 の既定のハイライタは Prism で、TextMate 文法を読まない。**Shiki に差し替える**と、この文法をそのまま食える (Shiki は VS Code と同じ Oniguruma を使う)。

文法は npm パッケージから引ける。

```ts
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const koyu = { ...JSON.parse(readFileSync(require.resolve("@kensnzk/koyu/syntax"), "utf8")), name: "koyu" };
```

これを `@shikijs/rehype` の `langs` に渡し、`beforeDefaultRehypePlugins` に挿す。以後 ` ```koyu ` (別名 ` ```muro `) のフェンスに色が付き、**サイトとエディタの色が定義上一致する**。

## 落とし穴

**色は正しさではない。**文法は正規表現であってパーサではないので、色が付いていても `check` は赤を出す。答えは常に `check` の側にある。

**check が緑でも建物が使えるとは限らない。**接する空間の既定は壁なので、扉を一枚も宣言しない二階建ては緑のまま密封される ([ADR-0014](../../docs/decisions/0014-default-boundaries.md))。動線は `koyu doors`、採光は `koyu light` が別に答える。

**未保存のバッファは検査されない。**CLI はファイルを読む。保存が検査の契機である。

## 次に読む

- [troubleshooting.md](troubleshooting.md) — エラーが出たときに原因まで降りる
- [diagnostics.md](../diagnostics.md) — 診断コードから直し方を引く (全68コード)
- [cli.md](../cli.md) — 拡張が呼んでいる CLI そのもの
- [ADR-0031](../../docs/decisions/0031-editor-support.md) — なぜ文法を一枚にし、赤を CLI に預けたか
