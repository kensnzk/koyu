---
title: import — 層を読む
mode: reference
---

# import — 層を読む

`import` は一棟を複数のファイルに分けて書くための一語である。一行が一つの層を読み、読まれた層は一棟のモデルへ合成される。

```
import <相対パス>
```

パスは**それを書いたファイルからの相対**であり、実行時のカレントディレクトリからではない。拡張子まで書く。

```muro-part
import ./assets.muro
import ./site.muro
import ./L1.muro
import ./L2.muro
```

## 一つのファイルが一つの層である

koyu には「層の宣言」という文が無い。**ファイルがそのまま層である。**`import` はファイルを読む文であり、同時に層を一つ積む文でもある。

読み込みの起点になるファイルを **entry** と呼ぶ。`koyu check` や `koyu plan` に渡すのは常に entry であり、`import` は自動でたどられる。

`examples/house/` は一棟を 5 ファイルに割っている。

| ファイル | 持つもの |
|---|---|
| `main.muro` | entry — 版・建物名・単位・グリッド・レベル、`import` の並び、階を跨ぐ関係 |
| `assets.muro` | 建具アセット — 建具表にあたる層 |
| `site.muro` | 敷地と外部空間、塀・門扉 |
| `L1.muro` | 1階の空間と境界 |
| `L2.muro` | 2階の空間と境界 |

```text
$ koyu check examples/house/main.muro
✔ Consistent — 13 spaces / 31 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

## 層の並びは深さ優先で平らにした列である

`import` は入れ子にできる — 読まれた層がさらに `import` を書いてよい。**その木を深さ優先の先行順で平らにした列が、層の並びである。**

親は子より先に列へ入る。ある `import` 行が読んだ層の内側の層は、その行の**次の** `import` 行より前に来る。

```muro-part
# main.muro
import ./a.muro     # a は自身の中で b を import している
import ./c.muro     # c も b を import している
```

```text
$ koyu layers main.muro
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	a.muro
  2	b.muro
  3	c.muro
```

添字 0 は entry である。entry はどのファイルよりも先に列へ入る。

**同じ層が二度 import されても、最初の位置を保つ。**上の例で `b.muro` は `a.muro` からも `c.muro` からも読まれるが、列に一度しか現れず、その位置は最初に読まれた添字 2 である。二重 import も循環も冪等で、エラーにはならない — 層は一度だけ合成される。

**「同じ層」はファイルシステム上の同一性で決まる。**綴りではない。symlink を経た綴りも、大文字小文字を区別しないファイルシステム上の別の綴り (`b.muro` と `B.muro`) も、指しているファイルが同じなら同じ層である。綴りで数えていれば、同じファイルが二度合成されて `grid X` の一度だけの宣言に衝突する — 書き方を変えただけで冪等が破れることになる。

この並びは飾りではない。**後の層ほど強く、添字がそのまま強度である。**同じ属性に二つの層が意見を持ったとき、どちらが勝つかはこの添字で決まる。強度の規則は [合成の六規則](composition.md) にある。

## entry が一度だけ宣言するもの

一棟の一貫性にあたる宣言は、合成のどこかで**一度だけ**現れなければならない。

| 宣言 | 規律 |
|---|---|
| `koyu <版>` | **entry でのみ**、一度だけ。同じ版での再宣言もエラー |
| `name` | 一度だけ。**同じ文字列なら再宣言してよい** |
| `unit mm` | 何度書いてもよい (値が `mm` かどうかだけを見る) |
| `grid X` / `grid Y` | 軸ごとに一度だけ |
| `level` | 名の重複はエラー。**どの層に書いてもよい** |

```text
$ koyu check main.muro
✖ l.muro:line 1: The koyu version is declared only in the base layer (the entry)
```

```text
$ koyu check main.muro
✖ l.muro:line 1: grid Y is declared once (in the base layer when composing)
```

`grid` と `level` は entry に置かなくても通る。効いているのは場所ではなく**順序**で、どちらも**使用より前**に合成されていなければならない。慣行としては entry に置くか、entry が最初に import する基盤の層に集める。

## 層は単独では読めない

分担して書かれた層は `grid` も `level` も持たないので、そのファイルだけを `check` に渡しても読めない。

```text
$ koyu check examples/house/L1.muro
✖ examples/house/L1.muro:line 3: Undeclared level: level:L1
```

**検査はつねに entry に対して行う。**`check` `plan` `stats` `json` — どれも entry を渡せば合成後のモデルを見る。

## 前方参照

`boundary` は空間を**前方参照してよい**。階を跨ぐ関係を entry に書き、それが指す空間を後から import しても通る。

```muro-part
# main.muro — 空間はこの後の import で入ってくる
boundary /home/hall1 /home/hall2 type:stair

import ./L1.muro
import ./L2.muro
```

一方で `over` と `drop` は**対象が既に合成されていなければならない**。上書きと削除は定義ではないので、対象の無い行はエラーになる。詳しくは [over / drop](over-drop.md) を見る。

## 何が層に置けるか

空間・境界・ゾーン・アセット・敷地形状・柱・`stack` — 定義はどの層に置いてもよい。切り口は分担の単位で決める。階で割ってもよいし、建具・敷地・設備で割ってもよい。

敷地形状 (`polygon`) は測量由来の所与であって設計の生成物ではないので、宣言 1 行だけの層に隔離するのが標準の書き方である。`examples/tower/site-geometry.muro` がその形をしている。

## import は残らない

正準JSON は合成後の単一のモデルであり、**`import` の跡は残らない。**5 ファイルに割って書いた建物と、同じ内容を 1 ファイルに書いた建物は、同じ正準JSONを与える。層の分け方は書き手の都合であって、建物の性質ではない。

## エラー

| 状態 | 出るもの |
|---|---|
| ファイルが読めない | `Cannot read file: ./missing.muro` |
| 空間パス・ゾーンパス・アセット名の重複 | エラー。**両者の出所を `ファイル:行` で言う** |
| `grid` / `name` / `koyu` の再宣言 | エラー |
| 二重 import・循環 | エラーではない (一度だけ合成される) |

```text
$ koyu check main.muro
✖ e4.muro:line 1: Duplicate space path: /L1/a (first seen in plan.muro at line 1)
```

パスは同一性そのものである。別の空間なら別のパスを与える。アセット名が衝突したときは、アセットを一つの層にまとめるか、別の名を与えるか、参照する側で属性を上書きする。

これらは**モデルが組み上がる前に止まる**。壊れた JSON を JSON パーサが弾くのと同じ層にあり、診断として後から報告されるものではない。

## API から

`import` はファイル合成の文である。単一の文字列を読む `parse()` には読み込み口が無いので、`import` を書いた文字列を渡すとエラーになる。

```text
import is available only in file composition (parseFile / parseFiles / CLI)
```

ファイルシステムから読むなら `parseFile`、仮想のファイル群 (ブラウザ等) から読むなら `parseFiles` を使う。後者はキーが POSIX 風の相対パスで、`import` はそのキー空間の中で解決される。

## 関連

- [合成の六規則](composition.md) — 層の強度と、合成が守る六つの規則
- [over / drop](over-drop.md) — 上書きと削除、集合の編集
- [stack](stack.md) — 階を跨ぐ関係の一括宣言とスパン展開
- [koyu check](../cli/check.md) — entry を渡す門番
- [koyu layers](../cli/layers.md) — 層の並びと属性の出所を印字する
