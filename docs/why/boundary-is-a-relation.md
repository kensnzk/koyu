---
title: 境界による壁の表現
mode: explanation
---

# 境界による壁の表現

`boundary /L1/a /L1/b` は壁を置く行ではない。**二つの空間の間に「境界という関係がある」と宣言する行**である。壁芯の線分そのものはどこにも書かれない — 二つの領域の共有辺として導かれる。

この一つの事実から、覚えるべき規則がまとめて出てくる。三つを別々に暗記する必要はない。**関係であることを覚えれば足りる。**書き方は [boundary](../reference/muro/boundary.md) にある。

## 実体は関係に乗る

境界は二つの空間の**共有面という座**を与え、実体はその座に乗る。

- **水平** — 壁・カーテンウォール・手すり・ガラス間仕切り・開放
- **垂直** — 床・天井・スラブ・屋根・吹抜け・階段・スロープ・昇降機・エスカレーター

厚み、仕様、耐火、遮音、勾配、天端高 — 実体に属する値はすべて関係が持つ。開口は関係の上の区間として置かれる。

**なぜ空間の側に置かないのか。**関係は座を与えるが、空間の属性は座を与えないからである。実体を空間側に置けば、どの面に乗るかを導出側の規則で補うことになり、そこが曖昧さの入口になる。上下のスラブを、下の空間が天井として、上の空間が床として別々に主張できる状態は原本ではない。**関係なら所有者が一つに定まる。**

この決定には帰結がある。**外部は空間でなければならない。**屋根が関係であるためには空が、接地する床が関係であるためには地盤が、相手の空間として存在しなければならない。だから `.muro` には `space /out outside:1` が現れる。

## 規則1 — 接していない空間の間には境界を書けない

関係の宣言だけがあって線分が導けない状態は、成立していない。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000 8000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y2..Y3
boundary /L1/a /L1/b
```

```text
✖ b1.muro:line 6: The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b
```

この二室は角で触れているが、koyu の「接する」は**長さのある辺を共有すること**を意味する。角の一点は接触ではない。

## 規則2 — 一つの関係が複数の線分に割れることがある

領域を持たない空間 — 外部など — との境界は、部屋の外周から他の空間と接する区間を除いた残りである。たいてい複数の辺に分かれる。**関係は一つ、線分は複数。**

だから外壁に開口を置くときは、どの辺かを選ぶ必要がある。

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/living /out
  door w:900
```

```text
✖ b2.muro:line 7: There is more than one boundary segment; pick an edge with edge:N/E/S/W (/L1/living | /out)
```

方位は座標系から決まる。**X は東が正、Y は北が正。したがって N=+Y、S=−Y、E=+X、W=−X。**そして `edge` は **a 側 — 先に書いた空間 — の矩形から見た辺**である。

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/living room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/living /out t:150
  door w:900 edge:S
```

書く順を入れ替えれば `edge:S` の指す辺が変わる。方位の規約は [向き](../reference/muro/orientation.md) に、辺の選び方は [edge を含む位置の書き方](../reference/muro/positions.md) にある。

## 規則3 — 同じ空間対に境界を二度書けない

関係は同一性を持つ。一つの関係に二つの行があれば、一つの問いに二つの答えがあることになる。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b type:open
```

```text
✖ b3.muro:line 7: Duplicate boundary: /L1/a | /L1/b (first seen at b3.muro:line 6)
```

後勝ちで黙って上書きすれば、**この壁が壁なのか開口なのかは行の並び順で決まってしまう。**それは原本ではない。

## 関係だから、同一性を書かなくてよい

`uid` を書けるのは空間と集約 (`space` / `zone`) だけである。**関係に uid は書けない。**

理由は関係の性質そのものにある。関係は必ず二つの空間の間にあるので、**両端が定まれば関係も定まる。**外部が指したいのは空間であり、関係を指したければ両端の空間を指せばよい。

そして数の問題がある。関係の数は空間の数を上回る — 同梱の複合建築は 425 空間に対して 1,364 境界を持つ。関係ごとに uid を書けば、「一棟が機械の視野に入る」という目的を自分で削ることになる。

同一性の全体は [同一性](../reference/identity.md) にある。

## 書く順序の制約は小さい

`boundary` は空間より先に書いてもよい — **関係の宣言は前方参照できる。**前後関係が要るのは `grid` と `level` だけで、これらは使う行より前になければならない。

## この先

- [既定の境界](silence.md) — 接する空間の既定が壁であること
- [平面図の生成](plan-is-not-a-section.md) — 関係から線分が出るところ
- [boundary の書き方](../reference/muro/boundary.md)
- [既定境界](../reference/muro/defaults.md)
