---
title: 柱 — column.blocksdoor
mode: reference
---

# 柱 — column.blocksdoor

| 規則 | level |
|---|---|
| [`column.blocksdoor`](#column-blocksdoor) | violation |

**位置を書かない要素が二つあると、衝突は導出でしか分からない。**

柱は座標を持たない。書くのは断面寸法と階と、限定するなら通りの名前だけで、立つ位置は**通り芯の交点**から導かれる。扉も座標を持たない。書くのは幅と、置く位置の指定 (`at:` の比率か通り参照) だけで、実際の点は境界線分の上で決まる。

どちらも書かれていない以上、二つがぶつかっているかどうかは**図を描くまで誰にも分からない**。この規則はそれを言葉にする。

## 柱はどこに立つか

通り芯の交点のうち、**その階に床のある交点**に一本ずつ立つ。床とは、そのレベルの、領域を持つ、`type:exterior` でも `type:void` でもない空間である。

ただし例外が一つある。**半屋外で、しかも上に何も載っていない空間は床に数えない。**屋上庭園や最上階のテラスは、柱が持ち上げるものを持たないからである。半屋外かどうかは導出で決まる — 外部に対して `type:open` か `air:1` の境界で接する空間が半屋外になる。

同じ交点に二本は立たない。宣言が重なったときは**先に書いた宣言が勝つ**。宣言に対して一本も立たなければ、[`koyu check`](../cli/check.md) が警告を出す。

`x:` と `y:` は**通り芯の名前**を並べて、柱を立てる通りを限定する。オフセットではない。

## `column.blocksdoor` — 柱が扉を塞いでいる {#column-blocksdoor}

`violation`

```muro-fail
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1
boundary /L1/a /L1/b
  door w:900 at:X2
```

```text
✖ [column.blocksdoor] main.muro:line 8: A column blocks a door: the door (900mm wide) on /L1/a | /L1/b overlaps the column at X2/Y2
Validation — 1 violation / 0 cautions
```

`/L1/a` と `/L1/b` の境界は Y2 の線上にある。柱は X2/Y2 の交点に 600mm 角で立つ。扉を `at:X2` — つまり X2 の通りの真上 — に置いたので、幅 900mm の扉の中心と柱の中心が同じ点になった。**通り芯の交点は、境界線分の上でもある。**扉を通りに寄せると必ずぶつかる。

判定は素朴な矩形の重なりである。扉は線分に沿って `w` の幅を持ち、線分に直交する向きには厚みを持たない。柱は交点を中心とする `size × size` (`d:` を書けば `size × d`) の矩形である。**線分に沿って重なり、かつ線分が柱の内側を通る**ときに衝突とする。

置けない開口 — 境界の上に載らない `at:` を書いた扉など — は対象外である。それは構成の側の誤りとして [`koyu check`](../cli/check.md) が既に言っている。

violation にしてあるのは、物と物が同じ場所を占めているからである。読み方によって許される衝突ではない。

### 直し方は二つある

**扉を通りからずらす。**`at:` にオフセットを足す。

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1
boundary /L1/a /L1/b
  door w:900 at:X2+1500
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

**あるいは、その通りに柱を立てない。**`x:` / `y:` に通り芯の名前を並べて、柱の宣言のほうを限定する。

```muro
koyu 1.1
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1 x:X1,X3
boundary /L1/a /L1/b
  door w:900 at:X2
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

三つ目は壁そのものを動かすことだが、それは平面の決め直しである。結果は [`koyu plan`](../cli/plan.md) の平面図で確かめられる — **導出でしか見えない衝突は、導出を描いて見るのが一番早い。**

## 関連

- [到達](access.md) — 扉が開いていても行き先が無い場合
- [判定の台帳](index.md) — 15規則と、`Finding` が `Diagnostic` と別である理由
