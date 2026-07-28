---
title: 解析と合成
mode: reference
---

# 解析と合成

`.muro` のテキストから [`Model`](model.md) を作る五つの入口である。**違うのは `import` の解決の仕方だけで、出てくる `Model` は同じ形である。**

```ts
import { parse, parseFiles, parseWith, tokenize } from "@kensnzk/koyu";
import { parseFile, parseFileWith } from "@kensnzk/koyu/node";
```

どの入口も出口で二つの導出を済ませてから返す。

1. **描かれた線による領域の切り分け** — 空間の `pieces` が埋まる
2. **既定境界の導出** — 接する空間の組に宣言が一つも無ければ `kind:"wall"` の境界が加わる

順序はこの通りである。逆にすると、線で接触が消えた組にも既定境界が生まれ、線分ゼロの境界に出所の無い診断が出てしまう — 書いていない関係を責めることになる。

**投げるのはこの五つだけである。**構文と合成の失敗は [`SourceError`](errors.md) として飛ぶ。検査 (`checkDiagnostics` / `check`) は投げず、必ず配列を返す。

## parse

```ts
function parse(source: string): Model
```

一枚のテキストを読む。`import` は解決できないのでエラーになる。テスト・スクラッチ・文字列を組み立てる場面向け。

```ts
import { parse } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0
space /L1/a room X1..X2 Y1..Y2`);
console.log(m.spaces.size, m.version, m.layers);
```

```text
1 1.0 []
```

`layers` は合成に参加した層の一覧なので、単一ソースでは空になる。版の宣言が無いので `version` には既定が入っている。

## parseFiles

```ts
function parseFiles(files: Record<string, string>, entry: string): Model
```

キーと中身の対応表を渡す。`import` はそのキー空間の中で解決される。キーは POSIX 風の相対パス (`L1.muro`, `floors/L1.muro`) として正規化される。

**ブラウザ向けの標準の入口である** — エディタのバッファをそのまま渡せる。

```ts
import { parseFiles } from "@kensnzk/koyu";

const m = parseFiles({
  "main.muro": `grid X 0 3600 7200\ngrid Y 0 4000\nlevel L1 0\nimport ./L1.muro`,
  "L1.muro": `space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2`,
}, "main.muro");
console.log(m.spaces.size, m.layers);
```

```text
2 [ 'main.muro', 'L1.muro' ]
```

対応表に無いキーを `import` すると `Cannot read file:` の `SourceError` になる。

## parseWith

```ts
type LayerLoader = (
  fromKey: string | undefined,
  ref: string,
) => { key: string; src: string };

function parseWith(loader: LayerLoader, entry: string): Model
```

**レイヤーの読み方そのものを差し替える。**HTTP から引く、データベースから引く、といった入口はここに載る。

`fromKey` が `undefined` のときは entry 自身の解決である。それ以外は「このキーのファイルの中に書かれた `ref`」を解決する。返す `key` が層の同一性で、**同じキーは一度しか合成されない** — 二重 `import` も循環も冪等に畳まれる。

```ts
import { parseWith } from "@kensnzk/koyu";

const src: Record<string, string> = {
  e: `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2`,
};
const m = parseWith((_from, ref) => ({ key: ref, src: src[ref]! }), "e");
console.log(m.spaces.size, m.layers);
```

```text
1 [ 'e' ]
```

ローダーが例外を投げてよい。entry の読み込みで投げれば `Cannot read file: <entry>` の `SourceError` に翻訳される。

## parseFile

```ts
function parseFile(filePath: string): Model
```

ファイルシステムから読む。**`@kensnzk/koyu/node` から出る** — ルートは `node:fs` を引かない。CLI が使っているのもこれである。

**`import` は書かれたファイルからの相対で解決される。**entry からの相対でもカレントディレクトリからの相対でもない。

```ts
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
console.log(m.name, m.spaces.size, m.layers.length + " layers");
console.log(m.layers.map((l) => l.replace(process.cwd() + "/", "")).join("\n"));
```

```text
小さな戸建住宅 13 5 layers
examples/house/main.muro
examples/house/assets.muro
examples/house/site.muro
examples/house/L1.muro
examples/house/L2.muro
```

`layers` に入るのは**解決済みの絶対パス**である (上の出力は見やすさのために cwd を削っている)。診断の `file` フィールドも同じ値になる。

割られた層の一枚を単体で渡すと落ちる。その層には `grid` も `level` も無いからである — 渡すのは常に entry の一枚だけである。

## parseFileWith

```ts
function parseFileWith(
  filePath: string,
  overlay?: (absPath: string) => string | undefined,
): Model
```

`overlay` が文字列を返したパスは、ディスクの内容の代わりにそれが合成される。渡るのは**解決済みの絶対パス**である。

**書き込み前の門番がこれを使う。**「この内容で保存したら壊れないか」を、保存せずに検査できる。

```ts
import { parseFileWith } from "@kensnzk/koyu/node";

const m = parseFileWith("examples/two-rooms.muro", (abs) =>
  abs.endsWith("two-rooms.muro")
    ? `grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X2 Y1..Y2 name:差し替え`
    : undefined);
console.log(m.spaces.get("/L1/a")!.attrs["name"]);
```

```text
差し替え
```

`overlay` を省くと `parseFile` と同じである (`parseFile` はこの関数の別名にすぎない)。

## tokenize

```ts
function tokenize(line: string, ln: number): string[]
```

一行を字句へ分解する低レベルの部品である。**空白で切り、引用符の中の空白は保つ。**引用符の外の `#` 以降はコメントとして落ちる。引用符が閉じていなければ `SourceError` を投げる (`ln` はその位置に使われる)。

エディタの補完・構文の色付け・行の書き換えを自分で書くときに使う。

```ts
import { tokenize } from "@kensnzk/koyu";
console.log(tokenize('space /L1/a room X1..X2 Y1..Y2 name:"居 室" # comment', 1));
```

```text
[ 'space', '/L1/a', 'room', 'X1..X2', 'Y1..Y2', 'name:居 室' ]
```

引用符そのものは残らない。`name:"居 室"` は一つのトークン `name:居 室` になる。

## どれを使うか

| 状況 | 入口 |
|---|---|
| ファイルを一つ読む (node) | `parseFile` |
| 保存前に検査する (node) | `parseFileWith` |
| ブラウザ・エディタのバッファ | `parseFiles` |
| HTTP・DB・独自のストレージ | `parseWith` |
| 文字列一枚だけ・テスト | `parse` |
| 一行の字句が要る | `tokenize` |

## 関連

- [Model と構成型](model.md) — 返ってくる型
- [診断](diagnostics.md) — 読んだあとの検査
- [エラー](errors.md) — `SourceError` の中身
- [`import` — 層に割る](../muro/import.md) — 記法の側から見た合成
