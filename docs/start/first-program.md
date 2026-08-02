---
title: プログラムから建物を読む
mode: tutorial
---

# プログラムから建物を読む

`.muro` を TypeScript から読み、診断を取り、正準JSONに落とすところまでを 20行で通す。CLI が答えることは API も答える — CLI はこの API の一つの入口にすぎない。

前提は Node.js 22 以上だけである。[チュートリアル](index.md)を通していると、読ませる建物が手元にあって都合がよい。

## 用意する

作業ディレクトリを作り、koyu と `tsx` を入れる。

```sh
mkdir koyu-first && cd koyu-first
npm init -y
npm install @kensnzk/koyu
npm install --save-dev tsx
```

`package.json` に `"type": "module"` を入れておく。読ませる建物として `house.muro` を置く — 中身は[チュートリアル](index.md)第6段の30行そのままでよい。

```muro-part
koyu 1.1
name 小さな家

grid X 0 3600 5400
grid Y 0 4000
level L1 0 h:2400 slab:150
level L2 2800 h:2400 slab:400

space /L1/ldk ldk X1..X2 Y1..Y2 name:LDK floor:オーク daylight:1
...
```

## 20行

`read.ts` を作る。

```ts
import { parseFile } from "@kensnzk/koyu/node";
import { areaM2, checkDiagnostics, isOutside, toCanonical } from "@kensnzk/koyu";

const model = parseFile(process.argv[2] ?? "house.muro");

console.log(`${model.spaces.size} spaces / ${model.boundaries.length} boundaries`);

for (const space of model.spaces.values()) {
  if (isOutside(space)) continue;
  console.log(`  ${space.path}  ${space.type ?? "—"}  ${areaM2(space)!.toFixed(2)} m2`);
}

const diagnostics = checkDiagnostics(model);
for (const d of diagnostics) {
  console.log(`  ${d.severity} ${d.code} line ${d.line} — ${d.message}`);
}
console.log(diagnostics.some((d) => d.severity === "error") ? "not consistent" : "consistent");

const canonical = JSON.parse(toCanonical(model));
console.log(canonical.spaces["/L1/ldk"]);
```

走らせる。

```sh
npx tsx read.ts
```

```text
5 spaces / 7 boundaries
  /L1/ldk  ldk  14.40 m2
  /L1/hall  hall  7.20 m2
  /L2/bed  bedroom  14.40 m2
  /L2/hall  hall  7.20 m2
consistent
{
  type: 'ldk',
  at: [ 'X1', 'Y1', 'X2', 'Y2' ],
  attrs: { daylight: 1, floor: 'オーク', name: 'LDK' }
}
```

## 20行の中身

**入口は二つある。**`@kensnzk/koyu/node` の `parseFile` はファイルシステムから読む入口で、`import` の相対パスをディスク上で解決する。`@kensnzk/koyu` 本体は純粋で、ファイルシステムを知らない — ブラウザで動かすときは、そちらの `parseFiles` に仮想のファイル群を渡す。

**`parseFile` が返す `Model` が、書かれた構成そのものである。**`model.spaces` はパスをキーにした `Map`、`model.boundaries` は配列で、どちらも書かれた宣言をそのまま持っている。判定は入っていない。

**面積は `areaM2` が答える。**壁芯で、単位は㎡である。`isOutside` の空間を飛ばしているのは、外部が領域を持たなくてよく、領域が無ければ面積も無いからである。**型では飛ばせない** — 型の位置は自由なラベルで、koyu はそこを一切読まない ([space](../reference/muro/space.md))。

**診断は `checkDiagnostics` が配列で返す。**要素は `code` (`OPN05` のような台帳の記号)、`severity` (`"error"` か `"warning"`)、`message`、`line`、合成しているときは `file` を持つ。**severity はコードの属性であって、状況では動かない** — 同じコードが場合によってエラーになったり警告になったりはしない。だから「エラーが一つでもあるか」は `severity` を見れば決まる。

**`toCanonical` は文字列を返す。**JSON そのものではなく、整形済みの文字列である — バイト列として安定していることに意味があるからで、`JSON.parse` して使えばよい。書かれた構成だけが入っていて、導出された既定の境界は入っていない。

## 壊れたファイルを読ませる

`house.muro` の窓から `edge:S` を一つ落として `broken.muro` を作り、同じプログラムに渡す。

```sh
npx tsx read.ts broken.muro
```

```text
5 spaces / 7 boundaries
  /L1/ldk  ldk  14.40 m2
  /L1/hall  hall  7.20 m2
  /L2/bed  bedroom  14.40 m2
  /L2/hall  hall  7.20 m2
  error OPN05 line 29 — There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L2/bed | /out)
not consistent
{
  type: 'ldk',
  at: [ 'X1', 'Y1', 'X2', 'Y2' ],
  attrs: { daylight: 1, floor: 'オーク', name: 'LDK' }
}
```

**診断が出てもモデルは返ってくる。**構造整合の診断は解析を止めない — 面積も正準JSONも、そのまま出てくる。

解析そのものが立たないのは、行が読めないときだけである。そのとき `parseFile` は `SourceError` を投げる。行番号と、合成しているときは出所のファイルが載っている。型を落とした `space /L1/a` だけのファイルを読ませてみる。

```ts
import { SourceError } from "@kensnzk/koyu";

try {
  parseFile("syntaxerr.muro");
} catch (e) {
  if (e instanceof SourceError) console.error(e.message);
}
```

```text
…/syntaxerr.muro:line 4: space /L1/a requires a type (a word from the vocabulary)
```

## この先

- 空間グラフ、動線、採光、敷地など、CLI が答えるものを API から呼ぶ道は [TypeScript API](../reference/api/index.md) にすべて並んでいる。
- 平面図や立体を SVG で出すなら [図の生成](../reference/api/draw.md)。
- 芯線・厚み・柱・縦動線の立体まで降りるなら [形 — derive(model)](../reference/form/index.md)。
- 診断コードの意味を引くなら [診断コード索引](../reference/diagnostics/index.md) — 全65コードが載っている。
- 正準JSONの構造は [正準 JSON](../reference/json/index.md)。
- LLM エージェントに読み書きさせるなら、同じ導出を12個の道具として出す [koyu-mcp](../reference/mcp/index.md) がある。
