---
title: 実測を計画に重ねる
mode: howto
---

# 実測を計画に重ねる

図面は 120mm の間仕切りで描かれている。現場を測ったら 150mm だった。扉は 900 のはずが 850 で入っていて、図面にあった物置は結局作られなかった。

**このとき、計画のファイルを書き換えてはならない。**書き換えた瞬間、「設計はこう決めた」と「現場はこうなった」の区別が消える。二つは別の事実で、別の日付を持ち、別の責任を持つ。

koyu の合成はこれのためにある。**計画は計画のまま置き、実測を上に重ねる。**

以下の出力は実際に走らせて得たものである。絶対パスは `<dir>/` と略した。

## 三つのファイル

```text
main.muro       ← 入口。グリッド・レベルと、重ねる順序を宣言する
  plan.muro     ← 層1: 設計
  as-built.muro ← 層2: 実測 (強い)
```

**`import` 行の並びが強度の宣言である。**後に書いた層ほど強い。入口は最も弱い層 (添字 0) になる。

```muro-part
koyu 1.0
name 実測を重ねた事務所
unit mm

grid X 0 3600 7200 9000
grid Y 0 4500

level L1 0 h:2700 slab:200

import ./plan.muro
import ./as-built.muro
```

計画の層。**この頁の最後まで、この内容は一文字も変わらない。**

```muro-part
space /L1/office office X1..X2 Y1..Y2 name:事務室
space /L1/hall   hall   X2..X3 Y1..Y2 name:玄関
space /L1/store  store  X3..X4 Y1..Y2 name:物置
space /out       exterior name:外部

boundary /L1/office /L1/hall t:120 spec:LGS
  door w:800 h:2000 name:D1

boundary /L1/hall /out t:150 spec:EW edge:S
  door w:900 h:2100 name:D2
```

## 実測の層を書く

現場で分かった四つのことを、四つの書き方で重ねる。

```muro-part
over /L1/office /L1/hall t:150 spec:LGS150-実測
over level L1 h:2660

over /L1/hall /out
  = door D2 w:850
  + window w:1200 h:900 at:0.8 name:W1

drop /L1/store
```

一行ずつ何が起きているかを見る。綴りと制約の一覧は[over / drop](../reference/muro/over-drop.md)にある。

### 単一の値は `over` で差し替える

```muro-part
over /L1/office /L1/hall t:150 spec:LGS150-実測
over level L1 h:2660
```

**対象の種別は行の形で決まる。**パスが二つなら境界、`level` に続けて名を書けばレベル、パス一つなら空間 (無ければゾーン) である。「これは境界だ」と言う語は要らない。

**比較は属性ごとに行われる。**上の境界行は `t` と `spec` にだけ意見を持っている。計画側が書いた他の属性は、強い層が黙っていればそのまま残る。

### 集合は明示された編集で書く

扉や窓のように、同じ座に複数の層が意見を持ちうるものは**暗黙にマージしない。**`over` の直下に字下げして、足す・消す・差し替えるを明示する。

```muro-part
over /L1/hall /out
  = door D2 w:850
  + window w:1200 h:900 at:0.8 name:W1
```

- `=` は**全置換ではない。**名は残り、書いた属性だけが差し替わる。上の行は D2 の幅だけを 850 にし、高さ 2100 はそのままにする。
- `+` で足す要素には `name:` が要る。後から指す言葉が要るからである。
- 消すなら `- door D2` と書く。

**位置 (`at:`) と辺 (`edge:`) は `=` では動かない。**扉が別の場所に入っていたときは、消して書き直す。

```muro-part
over /L1/hall /out
  - door D2
  + door w:850 h:2100 at:0.3 name:D2
```

### 作られなかったものは `drop` で消す

```muro-part
drop /L1/store
```

**空間が消えれば、その空間を端に持つ境界も一緒に消える。**境界は二つの空間の**間**にしか存在しないからである。他の境界は無傷で残る。

`drop` が取れるのは空間・ゾーン・境界・柱の四つで、対象が無ければエラーになる。黙って何もしないということはない。

## 合成した結果を見る

```sh
koyu check main.muro
```

```text
✔ Consistent — 3 spaces / 2 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

物置が消えて 3 空間になっている。階高は実測の値になっている。

```sh
koyu levels main.muro
```

```text
L1	z:0	h:2660	slab:200
```

## どの層が勝ったかを見る

**これが as-built を層で書く最大の見返りである。**最終値の出所が機械で引ける。

```sh
koyu layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<dir>/main.muro
  1	<dir>/plan.muro
  2	<dir>/as-built.muro

Attribute provenance:
  boundary:/L1/office|/L1/hall:spec	← 2 <dir>/as-built.muro
  boundary:/L1/office|/L1/hall:t	← 2 <dir>/as-built.muro
  level:L1:h	← 2 <dir>/as-built.muro
```

出所の鍵は `<種別>:<対象>:<属性キー>` である。上に出ているのは実測が奪った三つだけで、**計画が与えたままの属性はここに出ない。**「何が現場で変わったか」の一覧がそのまま出てくる。

## 何が変わったかを差分で見る

計画だけを重ねた入口をもう一つ作ると、二つのモデルを直接比べられる。

```muro-part
koyu 1.0
name 実測を重ねた事務所
unit mm

grid X 0 3600 7200 9000
grid Y 0 4500

level L1 0 h:2700 slab:200

import ./plan.muro
```

```sh
koyu diff plan-only.muro main.muro
```

```text
± level L1: h 2700 → 2660
− space /L1/store (store 8.10 m2)
− boundary /L1/hall | /L1/store
± boundary /L1/hall | /L1/office: t 120 → 150 / spec LGS → LGS150-実測
± boundary /L1/hall | /out edge:S: door D2 w 900 → 850 / + window W1 w:1200 h:900 name:W1
```

**竣工報告がそのまま出ている。**終了コードは差分があれば 1、無ければ 0 なので、CI で「実測層がまだ空である」ことを門番にもできる。

## 上書きの跡は残らない

合成後のモデルにも[正準 JSON](../reference/json/index.md) にも `over` と `drop` は現れない。`over` で `t:150` にした境界と、最初から `t:150` と書いた境界は、同じ正準 JSON を与える。

```text
      "kind": "wall",
      "t": 150,
      "attrs": {
        "spec": "LGS150-実測"
      },
```

**正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。**どう書かれたかを知りたいときが、`layers --attrs` を引くときである。

## 踏みやすい三つの穴

### `over` の対象が無い

```text
✖ <dir>/miss.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

**存在しないものに意見だけを足すことはできない。**原因はほぼ二つに絞れる — パスの綴り違いか、層の順序の思い違いである。`over` は定義しない。定義するのは `space` や `boundary` の側で、二つは別の文である。

### 同じ層が同じ属性に二度意見を持つ

```text
✖ <dir>/bad.muro:line 2: One layer holds two opinions about t on boundary /L1/office|/L1/hall
```

どちらが勝つかが決まらないので止まる。**上書きは別の層から行うものである。**同じ層の中で定義と `over` が同じ属性に触れた場合も同じエラーになる。

### 既定の壁は上書きできない

接する空間の間には、宣言が無くても壁が導かれる。この既定の境界は**すべての層を合成し終えてから**作られるので、合成の途中である `over` からは見えない。

実測で厚みや仕様を与えたい壁は、計画の層で `boundary` として宣言しておく。既定に頼っている壁は、実測層から触れない。

## 実測層を捨てる

`import ./as-built.muro` の一行を消せば、計画がそのまま戻る。**実測は計画に触れていないので、戻すのに復元作業が要らない。**

同じ形で層を足せる — 改修の層、テナント工事の層、設備更新の層。並びが強度なので、後から足した層が前の層に勝つ。

## 関連

- [over / drop](../reference/muro/over-drop.md) — 上書き・削除・集合編集の綴りと制約
- [合成 — 層の強度と六つの規則](../reference/muro/composition.md) — 強度・定義と上書きの区別・決定性・出所
- [import](../reference/muro/import.md) — 層を読む一語と、層の並びの作られ方
- [koyu layers](../reference/cli/layers.md) — 層の並びと属性の出所を印字する
- [koyu diff](../reference/cli/diff.md) — 構成の言葉で二つのモデルを比べる
