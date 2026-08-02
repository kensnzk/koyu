---
title: LIN — 描かれた線
mode: reference
---

# LIN — 描かれた線

LIN は三つある。

| コード | severity | 何を言うか |
|---|---|---|
| LIN01 | error | 描かれた線が二つの空間を分離していない |
| LIN02 | error | 垂直境界に線が描かれている |
| LIN03 | warning | 描かれた線が何も切っていない |

**`line` は境界の実現を、隣接からの導出ではなく設計の行為として与える。**通常、境界の線分は二つの空間の割付の共有辺として導かれる。`line` を書くと、その導出の代わりに**書かれた線そのもの**が境界になり、両側の割付は線の両側へ分け直される。斜めの壁・隅切り・台形の部屋は、これで書く。

`line` は境界の下に字下げして書き、**一つの境界に一本だけ**である。端点は通り語で書く — 生の座標も角度も導入しない。

```muro
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2+900,Y1 X2-900,Y2
```

## 診断が線を引用するとき

**綴りは書かれたまま、順序は正準である。**

線分は向きを持たない。同じ二点を結ぶ線は、どちらの端から書いても同じ線である。だから端点の対は**解決座標の昇順** (x、同値なら y) に並べ替えられる。並べ替えるとき綴り (`X1+300` のような通り参照) も一緒に入れ替わるので、診断が引用する綴りは**書いたとおりの通り語のまま、順序だけが正準**になる。

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1+300,Y2 X1+300,Y1
```

```text
Line X1+300,Y1..X1+300,Y2 does not separate /L1/a and /L1/b (draw it so the two allocations fall on opposite sides)
```

書いたのは `X1+300,Y2 X1+300,Y1` だが、診断は `X1+300,Y1..X1+300,Y2` と引用する。`X1+300` は座標 (300) に潰されず、通り語のまま残る。

**なぜ揃えるのか。**開口の `at:` は線分の始端からの比である。始端が書き順で決まってしまうと、同じ形が二通りに読まれる — `line X1,Y1+2000 X2,Y1+4000` と `line X2,Y1+4000 X1,Y1+2000` が正準JSONとしてバイト同一のまま、扉を別の位置に置く、ということが起きる。だから合成の出口で向きを揃え、**形を正準形の関数にする**。

## LIN01 — 線が二つの空間を分離していません

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X1,Y1 X1,Y2
```

```text
Line X1,Y1..X1,Y2 does not separate /L1/a and /L1/b (draw it so the two allocations fall on opposite sides)
```

**原因** — 描かれた線は「二つの空間の割付の合併を、線の両側へ分け直す」操作である。両方の割付が線の同じ側にあれば、分け直すものが無い。

どちらの側に寄るかは面積の偏りで決まり、偏りの無い側 — 線が割付をちょうど二等分する側 — は相手の反対側として決まる。**両方とも偏りが無ければ決まらない。**

**直し方** — 二つの割付の間を通る線を引く。境界の実現を動かしたいのであって割付を動かしたいのではない、という点を確かめる。

LIN01 は同じコードで、あと二つの状態も言う。

```text
Line X2,Y1..X2,Y2 bisects the allocation exactly, so which side to keep is undetermined
```

片側が領域を持たない空間 (`exterior` など) のときの本文である。相手側が無いので「反対側」で決めることができず、線がもう一方の割付をちょうど二等分すると、残す側が決まらない。

```text
A line cannot be drawn between spaces that have no region: /out | /out2
```

両側とも領域を持たない。切り分ける相手が無い。

## LIN02 — 垂直境界に線は描けません

`error`

```muro-bad
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 slab:300
space /L1/a room X1..X2 Y1..Y2
space /L2/a X1..X2 Y1..Y2 void:1
boundary /L1/a /L2/a type:void
  line X1,Y1 X2,Y2
```

```text
A line cannot be drawn on a vertical boundary (drawing a line is an act of dividing a plan): /L1/a | /L2/a
```

**原因** — 線を描くことは平面上で空間を区切る行為である。垂直境界 (`type:stair` / `shaft` / `void`) は上下の関係であって、平面上に線分を持たない。

**直し方** — 吹抜けの輪郭を斜めにしたいのなら、線を描く先は**その階の水平境界** — 吹抜けと隣室の間の境界である。同じレベルの境界に線を移す。

## LIN03 — 線が何も切っていません

`warning`

```muro-warn
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
  line X2,Y1 X2,Y2
```

```text
Line X2,Y1..X2,Y2 cuts nothing (it is the same as the default adjacency line, or falls outside the allocation)
```

**原因** — 二つある。

- 引いた線が、既定で導かれる隣接線とちょうど同じ位置にある。上の例がそれで、`X2` は二室がもともと接している位置である。害は無いが、**書いた行が何もしていない**ことは知らされるべきである。
- 線の及ぶ範囲に割付が無い。斜めにしたつもりで端点の綴りを間違えた、という取り違えがここで出る。

**直し方** — 意図した位置に線を引き直すか、行を消す。

## 帰結は導出のその場で記録される

線が何をしたかは、形を起こすときに決まり、そのとき記録される。値は三つある。

| 帰結 | 意味 | 診断 |
|---|---|---|
| `cut` | 実際に割付を切り分けた | 無し |
| `nothing` | 何も切らなかった | LIN03 |
| `undetermined` | 残す側が決まらなかった | LIN01 |

診断はこの記録を読むだけで、切り分けをやり直さない。やり直すと、**既に切られた形**を相手に判定を組み立てることになり、母集団が食い違う — 実際に切った線に「何も切っていない」と言う経路がそこにあった。この値は API では `DrawnLine` の `effect` として読める。正準JSONには出ない — 書かれた構成ではなく導出の帰結だからである。

## 一つの境界に一本

同じ境界に二本目の `line` を書くと、これは診断ではなく構文の誤りになる。

```text
One boundary carries one line: /L1/a | /L1/b
```

同じ空間対に二箇所の隅切りが要るなら、境界を二つ書く — 線を持つ境界は、線の綴りまで含めて同一性が決まるので、同じ対に二つ書いても [BND02](./bnd.md) にならない。

## 関連

- [BND — 境界](./bnd.md) — 線を持たない境界の同一性と線分
- [VRT — 垂直境界](./vrt.md) — 線を描けない側の境界
- [VER — 言語の版](./ver.md) — `line` は 0.5 の語 (VER03)
- [SYN — 構文と合成](./syn.md) — 二本目の `line`、字下げの誤り
- [koyu check](../cli/check.md)
