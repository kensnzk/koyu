---
title: koyu levels
mode: reference
---

# koyu levels

テキストの矩計。レベルを `z` の降順に並べ、階高を天井高と床組み厚に分解して見せる。

## 引数

```text
koyu levels <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 出力

```sh
npx tsx src/cli.ts levels examples/house/main.muro
```

```text
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400	slab:400
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

レベルの行はタブ区切りで、`h` と `slab` は書かれているときだけ出る。上から下へ、つまり **`z` の降順**に並ぶ。

`↑` の行は**その行のレベルから見た上への積み上がり**である。階高は上のレベルの `z` との差で、内訳はそのレベルの `h` と**上のレベルの** `slab` で説明される。上に何も無い最上部のレベルには `↑` の行が付かない。

## 余りが出るとき

階高が天井高と床組み厚の和より大きければ、その差が `left over` として出る。天井裏の懐である。

```sh
npx tsx src/cli.ts levels examples/tower/main.muro
```

```text
R	z:35200	slab:500
L11	z:32000	h:2600	slab:500
  ↑ storey height 3200 = ceiling 2600 + slab 500 + 100 left over
L10	z:29000	h:2500	slab:450
  ↑ storey height 3000 = ceiling 2500 + slab 500
L9	z:26000	h:2500	slab:450
  ↑ storey height 3000 = ceiling 2500 + slab 450 + 50 left over
```

(この建物の全出力の先頭である。)

## 分解が出ないとき

内訳が出るのは、**そのレベルが `h` を持ち、かつ上のレベルが `slab` を持つ**ときだけである。どちらかを欠くと `↑ storey height <数>` だけになる。

そのどちらの欠落も [`koyu check`](check.md) が別に言う。天井高が定まらないのはエラー、床組み厚が無いのは警告である (どちらの場合も高さの検査は行われない)。

**空間を持たない屋上レベル (`level R 5800 slab:500`) を宣言しておくと、最上階も検査の対象になる。**上に何も無ければ最上階の階高は計算できない。

## 空間側の天井高

`h:` を持つ空間があれば、末尾に別掲される。実効の天井高 — つまりその空間に効いている値 — が出る。

```sh
npx tsx src/cli.ts levels examples/office.muro
```

```text
R	z:8000	slab:1300
L2	z:4000	h:2700	slab:1300
  ↑ storey height 4000 = ceiling 2700 + slab 1300
L1	z:0	h:2700	slab:600
  ↑ storey height 4000 = ceiling 2700 + slab 1300
Per-space ceiling height: /L1/hall h:6700
```

領域を持たない空間、レベルに載っていない空間はここに出ない。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 出せた |
| 1 | レベルが一つも定義されていない、または構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

```sh
npx tsx src/cli.ts levels nolevels.muro
```

```text
No level is defined
```

## 関連

- [koyu check](check.md) — 天井高と床組み厚の欠落を診断として言う
- [koyu stats](stats.md) — レベルごとの床面積
- [koyu plan](plan.md) — ここに出るレベル名を `-l` に渡す
- [.muro リファレンス](../muro/index.md) — `level` の書き方
