---
title: COL — 柱
mode: reference
---

# COL — 柱

COL は二つある。どちらも警告である。

| コード | severity | 何を言うか |
|---|---|---|
| COL01 | warning | この宣言から柱が一本も立たない — 交点にその階の床が無い |
| COL02 | warning | この宣言から柱が一本も立たない — 同じ交点を先の宣言が取った |

**柱は位置を書かない。**書くのは寸法と階と通りだけで、立つ場所は導出される。壁が境界という関係から現れるのと同じ構えを、点の要素に適用したものである。

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1..L3 0 pitch:3000 h:2700 slab:300
level R 9000 slab:300
space /L1/a room X1..X3 Y1..Y2
space /L2/a room X1..X3 Y1..Y2
space /L3/a room X1..X3 Y1..Y2
column 800 L1..L2 d:600 name:C1
column 600 L3 x:X1,X2 name:C2
```

書式は `column <一辺 mm> <レベル名 または L?..L?> [x:通り,…] [y:通り,…]`。`d:` で奥行 (書かなければ正方形)、`name:` と `spec:` も書ける。`x:` / `y:` を書かなければ、その軸の通りは全部が対象になる。

## 柱はどこに立つか

**その階の床のある通り芯の交点**に立つ。「床がある」とは、その交点がその階の空間の導出された領域の内側 (許容 1mm) に入る、ということである。ただし次の三つは床として数えない。

- `type:exterior` — 地面である
- `type:void` — 床が無いことが定義である
- **半屋外で、かつ上に何も重なっていない空間** — 屋上庭園・最上階のテラスがこれで、柱が持ち上げるものを持たない

三つ目は忘れやすい。**バルコニーの下に柱は立たない** — 上に床が重なっていれば別で、そのときは持ち上げるものがあるので立つ。

**同じ交点に二本は立たない。**同じレベルの同じ交点を複数の宣言が狙ったら、**先に書かれた宣言が勝つ**。「大きい方を採る」のような暗黙の規則は持たない。

**母集団は宣言である。**COL01 も COL02 も「このレベルに何本立ったか」ではなく「**この宣言から**何本立ったか」を問う。前者を数えると、同じ階の別の宣言が一本でも立てた瞬間に、一本も立たない宣言が黙って通ってしまう。

## COL01 — 立つ柱がありません

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
column 600 L2
```

```text
Not one column stands for this declaration (the grid intersections have no floor): L2 600mm square
```

**原因** — 狙った交点に、その階の床が無い。多くは次のどれかである。

- **階の指定違い。**上の例がそれで、床があるのは `L1` なのに `L2` を指している。
- **通りの限定 (`x:` / `y:`) の書き間違い。**限定した先に床が無い。
- **その階をまだ書いていない。**骨組みを先に書いたときに出る。
- **床が半屋外で、上に何も無い。**屋上テラスに柱を立てようとした場合である。

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:300
level R 3000 slab:300
space /L1/t terrace X1..X2 Y1..Y2
space /out exterior
boundary /L1/t /out type:open
column 600 L1
```

このファイルも同じ本文の COL01 になる。テラスは外部に `type:open` で接するので半屋外で、上に空間が重なっていない。

**直し方** — 階の指定を直すか、限定を外す。上層で柱を細くしたいだけなら、階の範囲が実在の床と合っているかを確かめる。

## COL02 — 柱の宣言が重なっています

`warning`

```muro-warn
grid X 0 3000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
column 600 L1
column 800 L1
```

```text
This column declaration (L1 800mm square) stands nowhere because an earlier declaration took the same intersections (at the same intersection the earlier declaration wins)
```

**原因** — 二つの宣言が同じレベルの同じ交点を狙い、先の宣言が全部取った。後から書いた `800` は一本も立たない。

**COL01 と分けてあるのは、直す場所が違うからである。**COL01 は「床が無い」— 床か階の指定を直す。COL02 は「床はあるが先客がいる」— 宣言の側を直す。COL01 の本文を出してしまうと、実際には床のある場所へ「床がありません」と言うことになり、直しようがない。

`related` には、同じ交点に**実際に立った**先の宣言の行が入る。

**直し方** — 通りを `x:` / `y:` で限定して重ならないようにするか、宣言を一つにまとめる。

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
column 600 L1 x:X1
column 800 L1 x:X2,X3
```

## 一本も立たないのに COL が出ないとき

**階高が決まらないレベルでは、柱は導出そのものに現れない。**柱は床上面から階高いっぱいまで立つので、階高が無ければ立体が作れない。上にレベルがあれば階高は `z` の差だが、最上階の階高は「そのレベルの `h:` と、そこに載る空間の有効天井高のうち最も高いもの + 200mm」で決まる。天井高が一つも決まらなければ、この数が無い。

その状態で言葉になるのは COL01 ではなく [SUF01](./suf.md) である — 柱の宣言は正しく交点を捉えているので、COL の側から言うことは何も無い。柱も壁も無い建物が出てきたら、まず SUF01 を疑う。

## 関連

- [SUF — 充足性](./suf.md) — 階高が決まらず柱も壁も立たない状態 (SUF01)
- [UID — 同一性](./uid.md) — 柱の `name` はモデル全体で一意 (UID04)
- [VER — 言語の版](./ver.md) — `column` は 0.5 の語 (VER03)
- [koyu validate](../cli/validate.md) — 導出された柱が導出された扉と重なる `column.blocksdoor`
- [koyu check](../cli/check.md)
