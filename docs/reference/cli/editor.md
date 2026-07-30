---
title: VS Code 拡張
mode: reference
---

# VS Code 拡張

`.muro` に色を付け、保存のたびに `koyu check` を走らせて診断を問題パネルに出す。**拡張はパーサも規則も持たない** — 色は文法ファイルが、赤は CLI が持つ。

## 二つの仕事だけ

| 仕事 | 出所 |
|---|---|
| 色 | `editors/vscode/syntaxes/koyu.tmLanguage.json` — 唯一の文法。ドキュメントサイトも同じ一枚を読む |
| 赤 | `koyu check --json` を呼んで、返ってきた `Diagnostic[]` を VS Code の診断へ写す |

**門番は一つである。**CLI もエージェント (MCP) もエディタも、同じ `check` の同じ答えを見る。拡張が独自に判定することは無い。

## 入れる

拡張フォルダを VS Code の拡張置き場へリンクする。**ビルドは無い** — 素の CommonJS と JSON である。

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/koyu
```

VS Code を再起動すれば `.muro` に色が付く。VS Code 1.75 以降が要る。Cursor などの派生エディタでも、拡張の置き場所が変わるだけで同じである。

配るなら `.vsix` に固めてもよい。

```sh
npx --yes @vscode/vsce package     # editors/vscode で実行
```

## CLI の探し方

**色だけなら他に何も要らない。赤を出すには `koyu` CLI が要る。**拡張は次の順に探す。ふつうは設定しなくてよい。

1. 設定 `koyu.cliPath` (空でなければそれ)
2. 開いているファイルから上へ辿って `node_modules/.bin/koyu`
3. 同じく上へ辿って `dist/cli.js` (koyu リポジトリ自身で作業しているとき — 先に `npm run build`)
4. PATH の `koyu`

見つからなければ一度だけ警告が出て、色だけになる。

## 起点 (entry) の決め方

`import` で層に割った建物では、層を単体で検査しても意味がない — その層には `grid` も `level` も無いので赤で埋まる。拡張は起点を次の順で決める。

1. 設定 `koyu.entry` (ワークスペースからの相対、または絶対パス)
2. 開いているファイルと**同じディレクトリの `main.muro`** (開いているのが `main.muro` 自身でない場合)
3. 開いているファイルそのもの

起点が別の場所にあるなら名指しする。

```json
{
  "koyu.entry": "examples/twin/main.muro"
}
```

診断は**出所ごとに配り直される。**`examples/twin/office.muro` を開いて保存すると、`examples/twin/main.muro` から一棟が合成された上で、`office.muro` の行にだけ赤が出る。前回この起点が置いた診断のうち今回消えたものは取り下げられる。

## いつ走るか

| 契機 | 走るか |
|---|---|
| ファイルを保存した | 走る |
| ファイルを開いた | 走る |
| コマンドパレットの **koyu: 整合を確かめる (check)** | 走る (`koyu.check.enabled` が false でも走る) |
| 入力している最中 | **走らない** |

**未保存のバッファは検査されない。**CLI はファイルを読むので、保存が検査の契機である。

## 設定

| 設定 | 既定 | 意味 |
|---|---|---|
| `koyu.check.enabled` | `true` | 保存時と開いたときに `check` を走らせる |
| `koyu.cliPath` | `""` | CLI の場所。空なら上の順で探す |
| `koyu.entry` | `""` | 合成の起点。空なら同じディレクトリの `main.muro`、無ければ開いているファイル自身 |

## 診断の写り方

`Diagnostic` のフィールドは次のように写る。

| `Diagnostic` | VS Code |
|---|---|
| `message` | 診断の本文。`path` があれば末尾に対象のパスが `[/L1/a \| /L1/b]` の形で付く |
| `code` | 診断のコード欄 (`BND04` など。問題パネルにそのまま出る) |
| `severity: "warning"` | Warning |
| `severity: "error"` (それ以外すべて) | Error |
| `line` | その行の全体。`line` が無い診断は起点の 1 行目に置かれる |
| `file` | 診断を置くファイル。無ければ起点 |

`source` は常に `koyu` である。

## 色の読み方

色の割り当ては記法の構造をなぞっている。

| 見えるもの | 何 |
|---|---|
| `space` `boundary` `band` … | 行頭に書く語 |
| `door` `window` `seg` `line` `area` | 字下げして書く語 |
| `/L1/a` `/out` `/L2..L9/A` | 空間・ゾーンのパス (同一性) |
| `X2+600` `Y1..Y2` `L14..L19` | 通り芯とレベルの参照 |
| `room` `shop` `exterior` | 空間の型 (開かれた語彙) |
| `daylight:` `t:` `edge:` `slope:` `road:` `name:` … | **形と導出のために core が読む属性**。専用の色を持つ |
| `spec:` `fire:` `floor:` `acme.sensor:` | それ以外の属性。まとめて一つの色 |

最後の二行が分かれているのが要点である。専用の色を持つのは `underground` `escalator` `daylight` `ceiling` `landing` `hinge` `level` `riser` `slope` `stair` `style` `swing` `tread` `pitch` `entry` `lane` `lift` `form` `road` `slab` `site` `area` `turn` `type` `edge` `name` `ramp` `uid` `air` `use` `at` `h` `w` `t` `d` `x` `y` の 37 語で、`daylight:1` と `dayligth:1` の違いが、書いている最中に色で見える。

**綴りを間違えた属性は色が付かないだけでなく、`check` がエラーで止める。**台帳に無いキーは、ドットを含む名前空間 (`acme.sensor`) を持たないかぎり書けない。逆に、名前空間さえ付けば何を書いてもよく、core はその中身に一切の意味を与えない。

ただし**テーマによっては二種類の属性が同じ色になる** (VS Code 既定の Dark+ がそう)。色が分かれるのは GitHub Dark / GitHub Light / One Dark Pro / Monokai / Nord など。

## 拡張がしないこと

**整合を判定しない。**判定は CLI が返した JSON をそのまま写しているだけである。

**色は正しさではない。**文法は正規表現であってパーサではないので、色が付いていても `check` は赤を出しうる。答えは常に `check` の側にある。

**建築的な妥当性を出さない。**呼ぶのは `koyu check --json` だけで、[`koyu validate`](validate.md) は呼ばない。扉を一枚も宣言しない二階建ては、問題パネルが空のまま完全に密封される。動線は [`koyu doors`](doors.md)、採光は [`koyu light`](light.md) が別に答える。

**図を出さない。**平面図が要るなら [`koyu plan`](plan.md) を走らせて SVG を開く。

**補完も整形もしない。**

`check` が終了コード 2 (使い方) を返した場合や、JSON として読めない出力を返した場合は、**黙って緑にはしない。**出力パネル `koyu` にその内容を書き、ステータスバーに `koyu: check が走りませんでした (出力パネル: koyu)` を出す。

## 関連

- [koyu check](check.md) — 拡張が呼んでいるコマンドそのもの
- [koyu validate](validate.md) — 拡張が呼ばないほうの面
- [診断コード](../diagnostics/index.md) — 問題パネルに出たコードから直し方を引く
- [koyu コマンド](index.md) — 起点と import の解決
